"""Verify items 1–6 against a loopback static export; all API data is synthetic."""
import argparse
import copy
import importlib.util
import json
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import expect, sync_playwright

spec=importlib.util.spec_from_file_location('views',Path(__file__).with_name('test-scheduler-views.py'))
views=importlib.util.module_from_spec(spec);spec.loader.exec_module(views)
WEEK='2026-11-22';THURSDAY='2026-11-26';WEDNESDAY='2026-11-25'
DAYS=views.DAYS

def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def base_slots(template, day=None):
    return [dict(slot,id=f"{d.lower()}-{slot['period'].lower()}-{i}-{slot['label'].lower().replace(' ','-')}",day=d)
            for d in DAYS if day is None or d==day for i,slot in enumerate(template[d])]

class HoursStore(views.FixtureStore):
    def __init__(self):
        super().__init__();self.events={};self.reviews={};self.operations={};self.attempts=[];self.fail_review=False;self.fail_read=False
        self.template={d:[{'period':'AM','role':'server','label':'Morning','start':600,'end':960,'required':True},
                          {'period':'PM','role':'server','label':'Evening','start':960,'end':1320,'required':True},
                          {'period':'PM','role':'server','label':'Late cleanup','start':1200,'end':1320,'required':False}] for d in DAYS}
        self.employees=[{'id':f'sample-{i}','name':name,'roles':['server'],'recurringAvailability':{d:[{'start':540,'end':1380}] for d in DAYS},
                         'maxDaysPerWeek':7,'maxShiftsPerWeek':21,'maxHoursPerWeek':168,'allowDoubles':True,'active':True} for i,name in enumerate(['Ana','Ben','Cora'])]

    def response(self,route,body,status=200):
        route.fulfill(status=status,content_type='application/json',body=json.dumps(body),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, PUT, OPTIONS'})

    def rules(self,station,week):return self.saved.get(('/api/template',station,week),{}).get('template',self.template)
    def route(self,route):
        request=route.request;url=urlparse(request.url);query=parse_qs(url.query)
        if request.method=='OPTIONS':return self.response(route,{})
        if url.path=='/api/health':return self.response(route,{'ok':True,'scheduleSnapshotVersion':1,'specialHoursVersion':1})
        if url.path.startswith('/api/internal/special-hours/'):
            assert request.headers.get('authorization')=='Bearer fixture-password'
            parts=url.path.split('/');store=parts[4]
            if request.method=='GET':
                if self.fail_read:return self.response(route,{'error':{'code':'unavailable'}},503)
                start=query['start'][0];end=query['end'][0]
                events=[e for (s,d),e in self.events.items() if s==store and start<=d<=end]
                reviews=[r for (s,st,d),r in self.reviews.items() if s==store and start<=d<=end]
                states=[]
                for event in events:
                    d=event['data']['date'];which=(date.fromisoformat(d).weekday()+1)%7
                    for kind in ['diningroom','kitchen']:
                        station=store+'-'+kind;published=self.saved.get(('/api/schedule/'+start,station,''))
                        day=next((item for item in (published or {}).get('snapshot',{}).get('specialHours',[]) if item['date']==d),None)
                        states.append({'stationId':station,'date':d,'baseFingerprint':canonical(base_slots(self.rules(station,start),DAYS[which])),
                                       'published':day,'visible':bool(published and published['visible'])})
                return self.response(route,{'version':1,'storeId':store,'start':start,'end':end,'events':sorted(events,key=lambda e:e['data']['date']),'reviews':reviews,'stations':states})
            data=request.post_data_json;mutation=data['mutation'];d=parts[5];station=parts[7] if len(parts)>6 else None
            target=(store,station,d) if station else (store,d);collection=self.reviews if station else self.events
            operation=(url.path,mutation['operationId']);self.attempts.append(operation)
            if operation not in self.operations:
                prior=collection.get(target)
                if mutation['baseRevision']!=(prior or {}).get('revision',0):return self.response(route,{'error':{'code':'revision_conflict'}},409)
                if station and mutation['data']['eventRevision']!=self.events[(store,d)]['revision']:return self.response(route,{'error':{'code':'revision_conflict'}},409)
                record={'schemaVersion':1,'family':'schedule','id':f'hours-review-{station}-{d}' if station else f'hours-{d}',
                        'storeId':store,'context':{'kind':'day','businessDate':d},'revision':mutation['baseRevision']+1,
                        'createdAt':views.UPDATED,'updatedAt':views.UPDATED,'data':mutation['data']}
                if station:record['stationId']=station
                collection[target]=copy.deepcopy(record);self.operations[operation]=copy.deepcopy(record)
            if station and self.fail_review:
                self.fail_review=False
                return self.response(route,{'error':{'code':'unavailable'}},503)
            return self.response(route,{'record':self.operations[operation]})
        station=query.get('restaurant',[''])[0];week=query.get('weekStart',[''])[0]
        if request.method=='GET' and url.path in ('/api/employees','/api/staff'):
            return self.response(route,{'employees':self.employees,'rev':1,'updatedAt':views.UPDATED,'canUndo':False})
        if request.method=='GET' and url.path=='/api/template':
            return self.response(route,self.saved.get((url.path,station,week),{'template':self.template,'rev':1,'updatedAt':views.UPDATED}))
        if request.method=='GET' and url.path=='/api/schedule':
            docs=[doc for key,doc in self.saved.items() if key[0].startswith('/api/schedule/') and key[1]==station and doc['visible']]
            return self.response(route,{'weeks':docs,'rev':sum(d['rev'] for d in docs),'notModified':False})
        if request.method=='GET' and url.path.startswith('/api/schedule/'):
            doc=self.saved.get((url.path,station,''))
            return self.response(route,doc or {'error':'not_found'},200 if doc else 404)
        return super().route(route)

def open_manager(browser,url,store,station='CR2-diningroom',layout='workspace',width=1440,locale='en',week=WEEK):
    context=browser.new_context(viewport={'width':width,'height':1000},timezone_id='America/Chicago')
    context.add_init_script(f"localStorage.setItem('chinarose.scheduler.layout',{json.dumps(layout)});localStorage.setItem('cr-internal-locale',{json.dumps(locale)})")
    context.route('**/*',store.route);page=context.new_page();page.set_default_timeout(12000);errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)));page.on('dialog',lambda dialog:dialog.accept())
    page.goto(f'{url}/scheduler-demo/{station}.html?week={week}',wait_until='networkidle')
    page.get_by_label('Manager code',exact=True).fill('fixture-password');page.get_by_role('button',name='Open the scheduler',exact=True).click()
    expect(page.get_by_role('button',name=f'Hours for {THURSDAY}' if locale=='en' else f'Horario del {THURSDAY}',exact=True)).to_be_enabled()
    return context,page,errors

def hours(page,d,locale='en'):
    page.get_by_role('button',name=('Hours for ' if locale=='en' else 'Horario del ')+d,exact=True).click()
    dialog=page.get_by_role('dialog');expect(dialog).to_be_visible();return dialog
def options(dialog, locale='en'):
    summary=dialog.locator('summary').filter(has_text='More options' if locale=='en' else 'Más opciones')
    if not dialog.locator('details').evaluate('element=>element.open'):summary.click()

def apply(dialog):
    dialog.get_by_role('button',name='Save hours',exact=True).click();expect(dialog).not_to_be_visible()
def publish(page):
    page.get_by_role('button',name='Publish to staff',exact=True).first.click()
    button=page.get_by_role('button',name='Publish',exact=True)
    if not button.count():button=page.get_by_role('button',name='Publish updates',exact=True)
    button.click();expect(page.get_by_text('Published. Staff now see this week.',exact=True)).to_be_visible()
    page.get_by_role('button',name='Close',exact=True).first.click()

def check_workflow(browser,url,artifacts):
    store=HoursStore();context,page,errors=open_manager(browser,url,store)
    page.get_by_role('button',name='Make schedule',exact=True).click()
    expect(page.locator('[data-planning-slot^="thursday-"]')).to_have_count(3)
    page.locator('[data-planning-slot^="thursday-"] button').filter(has=page.locator('[data-lock-state="unlocked"]')).first.click()
    dialog=hours(page,THURSDAY);dialog.get_by_role('radio',name='Closed all day',exact=True).check();options(dialog);dialog.get_by_label('Label (optional)',exact=True).fill('Thanksgiving')
    expect(dialog.get_by_text('Removes all shifts on this date from this draft.',exact=False)).to_be_visible()
    expect(dialog.get_by_text('including 1 marked Keep.',exact=False)).to_be_visible()
    expect(dialog.get_by_text('Employee finish times',exact=True)).to_have_count(0)
    dialog.screenshot(path=str(artifacts/'closed-preview-desktop.png'))
    store.fail_review=True;dialog.get_by_role('button',name='Save hours',exact=True).click()
    expect(dialog.get_by_role('alert')).to_contain_text('not confirmed')
    expect(page.locator('[data-planning-slot^="thursday-"]')).to_have_count(3)
    dialog.get_by_role('button',name='Retry same save',exact=True).click();expect(dialog).not_to_be_visible()
    assert store.events[('CR2',THURSDAY)]['revision']==1 and store.reviews[('CR2','CR2-diningroom',THURSDAY)]['revision']==1
    assert len(store.attempts)>len(set(store.attempts)), 'uncertain review retries must reuse operation identity'
    expect(page.locator('[data-planning-slot^="thursday-"]')).to_have_count(0)
    expect(page.locator(f'[data-station-hours="CR2-kitchen:{THURSDAY}"]')).to_contain_text('Needs review')
    page.get_by_role('button',name='Undo',exact=True).first.click()
    expect(page.locator('[data-planning-slot^="thursday-"]')).to_have_count(3)
    expect(page.get_by_role('button',name='Make schedule',exact=True)).to_be_disabled()
    apply(hours(page,THURSDAY))
    dialog=hours(page,WEDNESDAY);dialog.get_by_role('radio',name='Close early',exact=True).check();options(dialog);dialog.get_by_label('Label (optional)',exact=True).fill('Holiday eve')
    dialog.get_by_label('Employee finish time · Evening minute',exact=True).select_option('30')
    expect(dialog.get_by_label('Keep this shift for cleanup',exact=True)).not_to_be_checked()
    dialog.screenshot(path=str(artifacts/'early-preview-cleanup.png'));apply(dialog)
    assert store.reviews[('CR2','CR2-diningroom',WEDNESDAY)]['data']['decisions'][0]['end']==1170
    expect(page.locator('[data-planning-slot^="wednesday-"]')).to_have_count(2)
    page.screenshot(path=str(artifacts/'manager-hours-status.png'),full_page=True)
    publish(page)
    doc=store.saved[('/api/schedule/'+WEEK,'CR2-diningroom','')]
    assert len(doc['snapshot']['specialHours'])==2
    staff=context.new_page();staff.goto(f'{url}/schedule/CR2-diningroom.html',wait_until='networkidle')
    # This fixture selects next week; the staff viewer opens the current week only automatically.
    if not staff.locator('table').count():staff.get_by_role('button',name='Open week of',exact=False).first.click()
    expect(staff.locator(f'[data-hours-note="{THURSDAY}"]').filter(visible=True).first).to_contain_text('Closed · Thanksgiving')
    expect(staff.locator(f'[data-hours-note="{WEDNESDAY}"]').filter(visible=True).first).to_contain_text('Closes at 07:00 PM')
    expect(staff.get_by_text('04:00 PM - 07:30 PM',exact=True).filter(visible=True).first).to_be_visible()
    staff.screenshot(path=str(artifacts/'staff-hours-desktop.png'),full_page=True)
    staff.set_viewport_size({'width':390,'height':844});staff.screenshot(path=str(artifacts/'staff-hours-phone.png'),full_page=True)
    staff.emulate_media(media='print');expect(staff.locator('[data-hours-summary]')).to_contain_text('Thanksgiving');staff.pdf(path=str(artifacts/'staff-special-hours.pdf'));staff.close()

    kitchen_context,kitchen,kitchen_errors=open_manager(browser,url,store,'CR2-kitchen')
    expect(kitchen.get_by_role('button',name='Make schedule',exact=True)).to_be_disabled()
    apply(hours(kitchen,THURSDAY));apply(hours(kitchen,WEDNESDAY))
    kitchen.get_by_role('button',name='Make schedule',exact=True).click();publish(kitchen)
    assert store.reviews[('CR2','CR2-kitchen',WEDNESDAY)]['data']['decisions'][0]['end']==1140, 'cleanup choices must remain station-specific'
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    expect(page.locator(f'[data-station-hours="CR2-kitchen:{THURSDAY}"]')).to_contain_text('Published')
    kitchen_context.close()

    page.get_by_role('button',name='Next week',exact=True).click()
    next_thursday='2026-12-03';expect(page.get_by_role('button',name='Hours for '+next_thursday,exact=True)).to_have_text('Hours')
    page.locator('summary').filter(has_text='More actions').first.click()
    page.get_by_role('button',name='Copy last week',exact=True).click()
    expect(page.get_by_role('button',name='Hours for '+next_thursday,exact=True)).to_have_text('Hours')
    assert ('CR2',next_thursday) not in store.events
    page.get_by_role('button',name='Previous week',exact=True).click()
    dialog=hours(page,WEDNESDAY);dialog.get_by_role('radio',name='Normal hours',exact=True).check();apply(dialog)
    expect(page.locator('[data-planning-slot^="wednesday-"]')).to_have_count(3)
    expect(page.locator(f'[data-station-hours="CR2-kitchen:{WEDNESDAY}"]')).to_contain_text('Needs review')
    # Cancellation is not silently published, and restoring spots does not assign people to them.
    assert next(day for day in store.saved[('/api/schedule/'+WEEK,'CR2-diningroom','')]['snapshot']['specialHours'] if day['date']==WEDNESDAY)['mode']=='early'
    assert not errors and not kitchen_errors,(errors,kitchen_errors)
    context.close()

def check_layouts_and_language(browser,url,artifacts):
    for layout in ['new','classic']:
        store=HoursStore();context,page,errors=open_manager(browser,url,store,layout=layout,width=768 if layout=='new' else 1440)
        trigger=page.get_by_role('button',name='Hours for '+THURSDAY,exact=True);trigger.focus();trigger.press('Enter')
        expect(page.get_by_role('dialog')).to_be_visible();page.keyboard.press('Escape')
        expect(page.get_by_role('dialog')).not_to_be_visible();expect(trigger).to_be_focused()
        dialog=hours(page,THURSDAY);dialog.get_by_role('radio',name='Closed all day',exact=True).check();apply(dialog)
        expect(page.get_by_role('button',name='Hours for '+THURSDAY,exact=True)).to_contain_text('Closed')
        page.screenshot(path=str(artifacts/f'{layout}-hours.png'),full_page=True);assert not errors,errors;context.close()
    store=HoursStore();context,page,errors=open_manager(browser,url,store,width=390,locale='es')
    dialog=hours(page,THURSDAY,'es');dialog.get_by_role('radio',name='Cerrado todo el día',exact=True).check()
    options(dialog,'es');dialog.get_by_label('Descripción (opcional)',exact=True).fill('Acción de Gracias')
    dialog.evaluate("element => element.style.fontSize = '20px'")
    assert dialog.evaluate('element=>element.scrollWidth<=element.clientWidth+1'), 'enlarged Spanish dialog must not clip horizontally'
    expect(dialog.get_by_role('button',name='Guardar horario',exact=True)).to_be_visible()
    dialog.screenshot(path=str(artifacts/'spanish-phone-preview.png'))
    dialog.get_by_role('button',name='Guardar horario',exact=True).click();expect(dialog).not_to_be_visible()
    expect(page.get_by_role('button',name='Horario del '+THURSDAY,exact=True)).to_contain_text('Cerrado')
    page.set_viewport_size({'width':320,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'page should reflow around the bounded board'
    assert not errors,errors;context.close()

def check_closed_week(browser,url):
    store=HoursStore();context,page,errors=open_manager(browser,url,store)
    for i in range(7):
        d=(date.fromisoformat(WEEK)+timedelta(days=i)).isoformat();dialog=hours(page,d);dialog.get_by_role('radio',name='Closed all day',exact=True).check();apply(dialog)
    expect(page.locator('[data-planning-slot]')).to_have_count(0);publish(page)
    assert store.saved[('/api/schedule/'+WEEK,'CR2-diningroom','')]['week']['slotPeople']==[]
    assert not errors,errors;context.close()

def check_deep_link_and_unavailable(browser,url):
    store=HoursStore();store.events[('CR2',THURSDAY)]={'schemaVersion':1,'family':'schedule','id':'hours-'+THURSDAY,'storeId':'CR2',
        'context':{'kind':'day','businessDate':THURSDAY},'revision':1,'createdAt':views.UPDATED,'updatedAt':views.UPDATED,
        'data':{'version':1,'date':THURSDAY,'mode':'closed','closeMinute':None,'label':'Thanksgiving'}}
    context=browser.new_context(viewport={'width':1440,'height':1000})
    context.add_init_script("localStorage.setItem('chinarose.scheduler.layout','workspace')")
    held=[];paused=[True]
    def route(request):
        if paused[0] and urlparse(request.request.url).path=='/api/template' and request.request.method=='GET':held.append(request)
        else:store.route(request)
    context.route('**/*',route);page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(f'{url}/scheduler-demo/CR2-diningroom.html?week={WEEK}&hoursDate={THURSDAY}',wait_until='networkidle')
    page.get_by_label('Manager code',exact=True).fill('fixture-password');page.get_by_role('button',name='Open the scheduler',exact=True).click()
    expect(page.locator('[data-hours-banner]')).to_contain_text('need review')
    expect(page.get_by_role('dialog')).not_to_be_visible()
    expect(page.get_by_role('button',name='Hours for '+THURSDAY,exact=True)).to_be_disabled()
    paused[0]=False
    for request in held:store.route(request)
    dialog=page.get_by_role('dialog');expect(dialog).to_be_visible()
    expect(dialog.get_by_role('radio',name='Closed all day',exact=True)).to_be_checked()
    expect(dialog.get_by_text('Late cleanup',exact=True)).to_have_count(0)
    dialog.get_by_role('button',name='Cancel',exact=True).click();assert not errors,errors;context.close()
    store=HoursStore();context,page,errors=open_manager(browser,url,store)
    store.fail_read=True;page.evaluate("window.dispatchEvent(new Event('focus'))")
    expect(page.locator('[data-hours-banner]')).to_contain_text('could not be checked')
    expect(page.get_by_role('button',name='Make schedule',exact=True)).to_be_disabled()
    store.fail_read=False;page.get_by_role('button',name='Reload latest',exact=True).click()
    expect(page.get_by_role('button',name='Make schedule',exact=True)).to_be_enabled()
    assert not errors,errors;context.close()

def check_conflict_and_kitchen_lock(browser,url):
    store=HoursStore();context,page,errors=open_manager(browser,url,store)
    dialog=hours(page,THURSDAY);dialog.get_by_role('radio',name='Closed all day',exact=True).check()
    options(dialog);dialog.get_by_label('Label (optional)',exact=True).fill('Original entered label')
    store.events[('CR2',THURSDAY)]={'schemaVersion':1,'family':'schedule','id':'hours-'+THURSDAY,'storeId':'CR2','context':{'kind':'day','businessDate':THURSDAY},
        'revision':1,'createdAt':views.UPDATED,'updatedAt':views.UPDATED,'data':{'version':1,'date':THURSDAY,'mode':'closed','closeMinute':None,'label':'Other manager'}}
    dialog.get_by_role('button',name='Save hours',exact=True).click()
    expect(dialog.get_by_role('alert')).to_contain_text('changed elsewhere')
    expect(dialog.get_by_label('Label (optional)',exact=True)).to_have_value('Original entered label')
    dialog.get_by_role('button',name='Reload latest',exact=True).click()
    expect(dialog.get_by_role('button',name='Save hours',exact=True)).to_be_enabled();apply(dialog)
    assert store.events[('CR2',THURSDAY)]['revision']==2
    assert store.events[('CR2',THURSDAY)]['data']['label']=='Original entered label'
    assert not errors,errors;context.close()
    store=HoursStore();context,page,errors=open_manager(browser,url,store,'CR3-kitchen')
    dialog=hours(page,THURSDAY)
    expect(dialog.get_by_text('Unlock this station’s staff editing',exact=False)).to_be_visible()
    expect(dialog.get_by_role('button',name='Save hours',exact=True)).to_be_disabled()
    expect(dialog.get_by_role('radio',name='Closed all day',exact=True)).to_be_disabled()
    dialog.get_by_role('button',name='Cancel',exact=True).click()
    assert not store.events and not errors,(store.events,errors);context.close()


def check_simple_hours(browser,url,artifacts):
    store=HoursStore();context,page,errors=open_manager(browser,url,store)
    dialog=hours(page,THURSDAY)
    expect(dialog.get_by_role('radio')).to_have_count(3)
    expect(dialog.get_by_role('radio',name='Normal hours',exact=True)).to_be_checked()
    expect(dialog.get_by_role('button',name='Save hours',exact=True)).to_be_disabled()
    expect(dialog.get_by_label('Label (optional)',exact=True)).not_to_be_visible()
    expect(dialog.get_by_text('Staffing preview',exact=True)).to_have_count(0)
    expect(dialog.get_by_text('Needs review',exact=True)).to_have_count(0)
    dialog.screenshot(path=str(artifacts/'simple-normal-desktop.png'))
    dialog.get_by_role('radio',name='Closed all day',exact=True).check()
    dialog.screenshot(path=str(artifacts/'simple-closed-desktop.png'))
    dialog.get_by_role('button',name='Cancel',exact=True).click()
    assert not store.events and not store.reviews, 'cancel must not save hours'
    dialog=hours(page,THURSDAY);dialog.get_by_role('radio',name='Close early',exact=True).check()
    expect(dialog.get_by_label('Customer closing time hour',exact=True)).to_have_value('7')
    dialog.get_by_label('Customer closing time hour',exact=True).select_option('6')
    dialog.get_by_label('Customer closing time minute',exact=True).select_option('30')
    expect(dialog.get_by_label('Employee finish time · Evening minute',exact=True)).not_to_be_visible()
    dialog.screenshot(path=str(artifacts/'simple-early-desktop.png'))
    apply(dialog)
    event=store.events[('CR2',THURSDAY)]['data'];review=store.reviews[('CR2','CR2-diningroom',THURSDAY)]['data']
    assert event['closeMinute']==1110
    assert [choice['end'] for choice in review['decisions']]==[1110,None]
    assert len(store.template['Thursday'])==3, 'normal rules must remain intact'
    dialog=hours(page,THURSDAY)
    expect(dialog.get_by_label('Customer closing time hour',exact=True)).to_have_value('6')
    summary=dialog.locator('summary');summary.focus();summary.press('Enter')
    expect(dialog.get_by_label('Employee finish time · Evening minute',exact=True)).to_be_visible()
    expect(dialog.get_by_text('Morning',exact=True)).to_have_count(0)
    dialog.get_by_label('Employee finish time · Evening minute',exact=True).select_option('45')
    expect(dialog.get_by_text('Custom employee finish times are set in More options.',exact=True)).to_be_visible()
    apply(dialog)
    dialog=hours(page,THURSDAY)
    expect(dialog.get_by_label('Employee finish time · Evening minute',exact=True)).not_to_be_visible()
    expect(dialog.get_by_text('Custom employee finish times are set in More options.',exact=True)).to_be_visible()
    apply(dialog)
    assert store.reviews[('CR2','CR2-diningroom',THURSDAY)]['data']['decisions'][0]['end']==1125
    page.set_viewport_size({'width':390,'height':844});dialog=hours(page,THURSDAY)
    dialog.screenshot(path=str(artifacts/'simple-early-phone.png'))
    page.set_viewport_size({'width':320,'height':844})
    assert dialog.evaluate('element=>element.scrollWidth<=element.clientWidth+1')
    dialog.get_by_role('button',name='Cancel',exact=True).click()
    assert not errors,errors;context.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:3064');parser.add_argument('--artifacts',default='/tmp/cr-special-hours')
    args=parser.parse_args()
    if urlparse(args.url).hostname not in ['localhost','127.0.0.1']:parser.error('Use a loopback URL')
    artifacts=Path(args.artifacts);artifacts.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True)
        check_simple_hours(browser,args.url.rstrip('/'),artifacts)
        check_workflow(browser,args.url.rstrip('/'),artifacts)
        check_layouts_and_language(browser,args.url.rstrip('/'),artifacts)
        check_closed_week(browser,args.url.rstrip('/'))
        check_deep_link_and_unavailable(browser,args.url.rstrip('/'))
        check_conflict_and_kitchen_lock(browser,args.url.rstrip('/'))
        browser.close()
    print('PASS: items 1–6, all layouts, shared dates, cleanup, uncertain retry, Undo, copying, separate publication, staff/print, Spanish/reflow and service recovery; synthetic APIs only')
