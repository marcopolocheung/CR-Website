"""Step 07 saved lookup and frozen-save recovery. Loopback synthetic APIs only."""
import argparse
from copy import deepcopy
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('base')
parser.add_argument('--artifacts', type=Path, default=Path('/tmp/cr-step07-history'))
parser.add_argument('--rea', action='store_true')
args = parser.parse_args()
assert urlsplit(args.base).hostname == '127.0.0.1'
args.artifacts.mkdir(parents=True, exist_ok=True)
TOKEN = 'synthetic-step07-manager'
TODAY = date.today().isoformat()
DAY = '2026-11-13'
OTHER = '2026-11-12'
ROOT = Path(__file__).resolve().parent.parent
results, errors, external, screenshots, requests = [], [], [], [], []

def record(name, value):
    results.append({'scenario': name, 'observed': value})
    print('PASS scenario: ' + name, flush=True)
def visible(page, selector): return page.locator(selector + ':visible')
def accept(page):
    expect(page.get_by_role('dialog')).to_be_visible()
    page.get_by_role('dialog').get_by_role('button').last.click()
def cancel(page): page.get_by_role('dialog').get_by_role('button').first.click()
def shot(page, name):
    page.evaluate('window.scrollTo(0,0)')
    path = args.artifacts / (name + '.png')
    page.screenshot(path=str(path), full_page=True)
    screenshots.append({'file':path.name,'viewport':page.viewport_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
def unlock(page):
    page.wait_for_load_state('networkidle')
    expect(page.locator('[data-shell-ready=true]')).to_be_visible()
    visible(page, '#cashout-code').fill(TOKEN)
    page.get_by_role('button', name='Unlock', exact=True).click()
    expect(visible(page, '#cashout-code')).to_have_count(0)
def start(page):
    page.goto(args.base + '/internal/bookkeeping')
    unlock(page)
    visible(page, '#cashout-store').select_option('CR2')
    visible(page, '#cashout-date').fill(DAY)
    visible(page, '#draft-preparer').fill('Original preparer')
    page.get_by_role('button', name='Start new draft', exact=True).click()
    visible(page, '#am-0-name').fill('Unchanged draft')
    visible(page, '#am-0-10000-amount').fill('300.00')
    page.locator('[data-drawer-select="pm-0"]').click()
    visible(page, '#pm-0-1').fill('0')
def cash_bytes(page):
    return page.evaluate('''() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('cr-internal-draft:')).map(k => [k,localStorage.getItem(k)]))''')
def cash_payload(page): return json.loads(next(iter(cash_bytes(page).values())))['payload']
def browse(page):
    page.get_by_role('link',name='Saved cash days',exact=True).click()
    expect(visible(page, '#cash-history-store')).to_be_visible()
    visible(page, '#cash-history-store').select_option('CR2')
    visible(page, '#cash-history-to').fill(DAY)
    expect(page.locator('[data-lookup-window]')).to_contain_text(DAY)
def exact(page, day=OTHER):
    visible(page, '#cash-history-exact').fill(day)
    page.get_by_role('button',name='Open saved day',exact=True).click()
    expect(page.locator('[data-lookup-detail] [data-saved-cash-detail]')).to_be_visible()
def copy_form(page):
    page.get_by_role('button',name='Edit a copy',exact=True).click()
    visible(page,'#cash-copy-preparer').fill('Copy preparer')
    page.get_by_role('button',name='Create device draft',exact=True).click()
    expect(page.get_by_role('dialog')).to_be_visible()
def return_cash(page):
    page.get_by_role('link',name='Return to cash draft',exact=True).click()
    expect(visible(page, '#cashout-editor')).to_be_visible()
def save(page): visible(page,'#cashout-save').click()
def review(page):
    expect(visible(page,'[data-cash-comparison]')).to_be_visible()
    page.get_by_role('button',name='Review replacement',exact=True).click()
    expect(page.get_by_role('dialog')).to_be_visible()
def feedback(page): return visible(page, '#cashout-editor [data-save-state]').first

def totals(sheet):
    # Independent literal integer-cent oracle, not imported from application code.
    values = [10000,5000,2000,1000,500,100,50,25,10,5,1]
    def shift(drawers):
        turns = [sum(n*d for n,d in zip(c['counts'],values))-10000 for c in drawers]
        diffs = [turn-round(float(c['toast'])*100) if c['toast'].strip() else None for turn,c in zip(turns,drawers)]
        return sum(turns), None if None in diffs else sum(diffs)
    a,ad = shift(sheet['am']); p,pd = shift(sheet['pm'])
    deposit = a+p+round(float(sheet.get('extraMoney') or 0)*100)
    return dict(amDeposit=a,pmDeposit=p,amOverShort=ad,pmOverShort=pd,deposit=deposit,overShort=None if ad is None or pd is None else ad+pd,zOverShort=None if not sheet['zReport'].strip() else deposit-round(float(sheet['zReport'])*100))
def document(store='CR2',day=OTHER,stamp='2026-11-14T18:00:00.000Z',count=3):
    sheet = {'am':[{'name':'Saved AM','counts':[count]+[0]*10,'toast':'200'}], 'pm':[{'name':'Saved PM','counts':[0,1]+[0]*9,'toast':''}], 'zReport':'175','extraMoney':'20'}
    return {'v':1,'store':store,'date':day,'sheet':sheet,'totals':totals(sheet),'updatedAt':stamp}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,args=['--remote-debugging-port=9338'] if args.rea else [])
    def workspace():
        ctx = browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
        mode = {'docs':{('CR2',OTHER):document(),('CR3',OTHER):document('CR3')},'history':'ok','read':'ok','write':'ok','writes':[],'held':[],'reads':[]}
        def route(r):
            req,u = r.request,urlsplit(r.request.url)
            origin = f'{u.scheme}://{u.netloc}'
            if origin == args.base: r.continue_(); return
            if origin != 'http://127.0.0.1:8787': external.append(req.url); r.abort(); return
            cors = {'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,OPTIONS'}
            if req.method == 'OPTIONS': r.fulfill(status=204,headers=cors); return
            assert req.headers.get('authorization') == 'Bearer '+TOKEN
            requests.append({'method':req.method,'path':u.path,'query':u.query})
            status,body = 200,{}
            if u.path == '/api/auth/verify': body = {'ok':True}
            elif u.path.startswith('/api/cashout/'):
                parts = u.path.split('/'); store = parts[3]
                if len(parts) == 5:
                    key = (store,parts[4]); mode['reads'].append(key) if req.method == 'GET' else None
                    if req.method == 'PUT':
                        payload = req.post_data_json; mode['writes'].append(deepcopy(payload))
                        if mode['write'] == 'hold': mode['held'].append((r,key,payload,cors)); return
                        if mode['write'] in ['ok','lost']:
                            mode['docs'][key] = dict(v=1,store=store,date=parts[4],**payload,updatedAt='2026-11-14T19:00:00.000Z')
                        if mode['write'] in ['lost','offline']: r.abort('failed'); return
                        body = {'updatedAt':'2026-11-14T19:00:00.000Z','extraMoney':payload['sheet'].get('extraMoney','')}
                    elif mode['read'] == 'hold': mode['held'].append((r,key,None,cors)); return
                    elif mode['read'] == 'failed': status = 503
                    elif mode['read'] == 'auth': status = 401
                    elif mode['read'] == 'malformed': body = {**document(store,parts[4]),'sheet':{}}
                    elif key in mode['docs']: body = deepcopy(mode['docs'][key])
                    else: status,body = 404,{'error':'not_found'}
                else:
                    if mode['history'] == 'hold': mode['held'].append((r,(store,parse_qs(u.query)['to'][0]),'history',cors)); return
                    if mode['history'] == 'failed': status = 503
                    elif mode['history'] == 'malformed': body = {'days':[{}]}
                    elif mode['history'] == 'empty': body = {'days':[]}
                    else:
                        end = date.fromisoformat(parse_qs(u.query)['to'][0]); dates = {(end-timedelta(days=i)).isoformat() for i in range(30)}
                        body = {'days':[{'date':d['date'],'totals':d['totals'],'updatedAt':d['updatedAt']} for (s,day),d in mode['docs'].items() if s == store and day in dates]}
            elif u.path.startswith('/api/'): body = {'days':[]}
            r.fulfill(status=status,content_type='application/json',headers=cors,body=json.dumps(body))
        ctx.route('**/*',route)
        page = ctx.new_page(); page.on('pageerror',lambda e: errors.append(str(e)))
        return ctx,page,mode

    ctx,page,mode = workspace(); start(page)
    before = cash_bytes(page); raw = cash_payload(page)
    browse(page); exact(page)
    assert cash_bytes(page) == before
    expect(page.locator('[data-lookup-detail] input:not([readonly])')).to_have_count(0)
    expect(page.locator('[data-lookup-detail] [data-cashier-card]')).to_have_count(2)
    expect(page.locator('[data-lookup-detail]')).to_contain_text('2026-11-14T18:00:00.000Z')
    assert len(mode['writes']) == 0
    shot(page,'saved-day-desktop')
    copy_form(page); cancel(page)
    return_cash(page)
    expect(visible(page,'#pm-0-1')).to_have_value('0')
    expect(page.locator('[data-drawer-select="pm-0"]')).to_have_attribute('aria-selected','true')
    assert cash_bytes(page) == before
    record('browse and cancel preserve active draft bytes, raw Count/Amount, selected drawer',raw)
    page.get_by_role('link',name='Saved cash days',exact=True).click()
    expect(visible(page,'#cash-history-store')).to_have_value('CR2')
    expect(visible(page,'#cash-history-to')).to_have_value(DAY)
    expect(page.locator('[data-lookup-detail] [data-saved-cash-detail]')).to_be_visible()
    record('retained lookup filters and record survive a visit to the cash editor',True)
    return_cash(page)
    browse(page); exact(page); copy_form(page)
    page.evaluate("() => { window.savedSet=Storage.prototype.setItem; Storage.prototype.setItem=function(){throw new DOMException('synthetic denied','QuotaExceededError')} }")
    accept(page)
    expect(page.get_by_text('Copy was canceled or could not be protected on this device.',exact=False)).to_be_visible()
    return_cash(page)
    expect(visible(page,'#pm-0-1')).to_have_value('0')
    assert cash_payload(page) == raw
    page.evaluate('() => { Storage.prototype.setItem=window.savedSet }')
    record('hidden editor checkpoint denied leaves prior editor and payload intact',True)
    browse(page); exact(page); copy_form(page); accept(page)
    expect(visible(page,'#cashout-editor')).to_be_visible()
    expect(visible(page,'#am-0-name')).to_have_value('Saved AM')
    assert len(cash_bytes(page)) == 2 and not mode['writes']
    assert 'countInputs' not in [json.loads(v) for v in cash_bytes(page).values() if json.loads(v)['preparer']=='Copy preparer'][0]['payload']['am'][0]
    record('explicit copy creates new device draft for exact destination with unknown server entry metadata',True)
    # Changed baseline must be reviewable before a modal permits replacement.
    mode['docs'][('CR2',OTHER)] = document(stamp='2026-11-14T18:30:00.000Z',count=4)
    save(page)
    expect(visible(page,'[data-cash-comparison]')).to_contain_text('18:30:00')
    expect(page.get_by_role('dialog')).not_to_be_visible()
    shot(page,'changed-baseline-comparison')
    mode['docs'][('CR2',OTHER)] = document(stamp='2026-11-14T18:45:00.000Z',count=5)
    page.get_by_role('button',name='Review replacement',exact=True).click()
    expect(visible(page,'[data-cash-comparison]')).to_contain_text('18:45:00')
    expect(page.get_by_role('dialog')).not_to_be_visible()
    review(page); expect(page.get_by_role('dialog')).to_contain_text('differs from your baseline')
    cancel(page); assert not mode['writes']
    review(page); accept(page)
    expect(feedback(page)).to_have_attribute('data-save-state','server')
    assert mode['writes'][-1]['sheet']['am'][0]['counts'][0] == 3
    record('changed baseline review, cancel, explicit replacement, successful read-back',True)
    # Successful ack is separate from list refresh.
    mode['history'] = 'failed'; visible(page,'#am-0-name').fill('Acknowledged')
    save(page); review(page); accept(page)
    expect(feedback(page)).to_contain_text('history')
    expect(feedback(page)).to_have_attribute('data-save-state','server')
    record('acknowledgment remains saved when history refresh fails',True)
    ctx.close()

    # Exact/direct links and distinct empty/missing/failure/invalid states.
    ctx,page,mode = workspace()
    page.goto(args.base+'/internal/cash-history?store=CR3&date='+OTHER); unlock(page)
    expect(page.locator('[data-lookup-detail] [data-saved-cash-detail]')).to_be_visible()
    assert mode['reads'] and all(s=='CR3' for s,d in mode['reads'])
    expect(page.locator('[data-shell-chrome] a[aria-current="page"]')).to_contain_text('Cash')
    mode['history']='empty'; page.get_by_role('button',name='Look up 30 dates',exact=True).click()
    expect(page.locator('[data-lookup-window]')).to_contain_text('No saved days')
    visible(page,'#cash-history-exact').fill('2026-10-01'); page.get_by_role('button',name='Open saved day',exact=True).click()
    expect(page.locator('[data-lookup-detail]')).to_contain_text('never saved or expired')
    mode['history']='failed'; mode['read']='failed'
    page.get_by_role('button',name='Open saved day',exact=True).click()
    expect(page.locator('[data-lookup-window]')).to_contain_text('Lookup failed')
    expect(page.locator('[data-lookup-detail]')).to_contain_text('could not be read or validated')
    mode['history']='ok'; mode['read']='malformed'
    page.locator('[data-lookup-detail]').get_by_role('button').click()
    expect(page.locator('[data-lookup-detail]')).to_contain_text('could not be read or validated')
    expect(visible(page,'#cash-history-exact')).to_have_value('2026-10-01')
    record('CR3 direct link and empty vs missing vs failed vs malformed with filters retained',True)
    before_reads = len(mode['reads'])
    # Client navigation preserves unlocked session and validates before fetching.
    page.evaluate("history.pushState(null,'','/internal/cash-history?store=CR4&date=2026-02-30'); window.dispatchEvent(new PopStateEvent('popstate'))")
    expect(page.get_by_text('Invalid saved-day link.',exact=False)).to_be_visible()
    page.wait_for_timeout(150); assert len(mode['reads']) == before_reads
    record('invalid direct parameters do not select or fetch a fallback record',True)
    ctx.close()

    ctx,page,mode = workspace()
    page.goto(args.base+'/internal/cash-history?store=CR3&date='+OTHER); unlock(page)
    expect(page.locator('[data-lookup-detail] [data-saved-cash-detail]')).to_be_visible()
    copy_form(page); accept(page)
    expect(visible(page,'#cashout-editor')).to_be_visible()
    expect(page.locator('#cashout-store')).to_have_value('CR3')
    expect(page.locator('#cashout-date')).to_have_value(OTHER)
    assert len(cash_bytes(page)) == 1 and not mode['writes']
    record('direct-link copy creates exact CR3 draft when no cash editor was mounted',True)
    ctx.close()

    # Lost ack matching readback; reload and frozen attempt survives with original draft keys.
    ctx,page,mode = workspace(); start(page)
    mode['write']='lost'; save(page)
    expect(feedback(page)).to_contain_text('outcome is uncertain')
    assert len(mode['writes']) == 1
    page.once('dialog',lambda dialog:dialog.accept()); page.reload(); unlock(page)
    visible(page,'#cashout-store').select_option('CR2'); visible(page,'#cashout-date').fill(DAY)
    visible(page,'#draft-preparer').fill('Resumed preparer')
    page.get_by_role('button',name='Resume as a copy',exact=True).click()
    expect(feedback(page)).to_contain_text('frozen attempt')
    mode['write']='ok'; save(page)
    expect(feedback(page)).to_contain_text('No additional save was sent')
    expect(feedback(page)).to_have_attribute('data-save-state','server')
    assert len(mode['writes']) == 1
    record('lost acknowledgment matches read-back after reload without another PUT',True)
    ctx.close()

    # Divergent retry retains attempted and newer sheets, never silently retries.
    ctx,page,mode = workspace(); start(page)
    mode['write']='offline'; save(page)
    expect(feedback(page)).to_contain_text('outcome is uncertain')
    mode['docs'][('CR2',DAY)] = document(day=DAY,count=8)
    visible(page,'#pm-0-1').fill('9')
    mode['read']='failed'; save(page)
    expect(feedback(page)).to_contain_text('No retry was sent')
    assert len(mode['writes']) == 1
    mode['read']='ok'; save(page)
    expect(visible(page,'[data-cash-comparison]')).to_be_visible()
    assert len(mode['writes']) == 1
    review(page); expect(page.get_by_role('dialog')).to_contain_text('uncertain attempt'); cancel(page)
    assert len(mode['writes']) == 1
    mode['write']='ok'; review(page); accept(page)
    expect(feedback(page)).to_have_attribute('data-save-state','device')
    expect(visible(page,'#pm-0-1')).to_have_value('9')
    assert len(mode['writes']) == 2 and mode['writes'][1] == mode['writes'][0]
    record('divergent retry blocks on read failure, preserves both copies, confirms frozen replacement and retains newer input',True)
    ctx.close()

    # Missing retry requires confirmation; pending save cannot label later input saved.
    ctx,page,mode = workspace(); start(page)
    mode['write']='offline'; save(page); expect(feedback(page)).to_contain_text('outcome is uncertain')
    mode['write']='hold'; save(page)
    expect(page.get_by_role('dialog')).to_contain_text('Retry the frozen attempt')
    accept(page)
    expect(feedback(page)).to_have_attribute('data-save-state','sending')
    visible(page,'#pm-0-1').fill('17')
    r,key,payload,cors = mode['held'].pop()
    mode['docs'][key] = dict(v=1,store=key[0],date=key[1],**payload,updatedAt='2026-11-14T19:00:00.000Z')
    r.fulfill(status=200,headers=cors,content_type='application/json',body=json.dumps({'extraMoney':payload['sheet'].get('extraMoney','')}))
    expect(feedback(page)).to_have_attribute('data-save-state','device')
    expect(visible(page,'#pm-0-1')).to_have_value('17')
    assert len(mode['writes']) == 2 and mode['writes'][0] == mode['writes'][1]
    record('missing read-back allows explicit frozen retry; edits during request stay unsaved',True)
    ctx.close()

    # Preflight must not write when it cannot establish current saved context.
    ctx,page,mode = workspace(); start(page); mode['read']='malformed'; save(page)
    expect(feedback(page)).to_contain_text('Replacement is blocked'); assert not mode['writes']
    record('malformed preflight blocks replacement and retains draft',True)
    ctx.close()

    # Reordered reads: CR2 response arriving after CR3 cannot select CR2 detail.
    ctx,page,mode = workspace(); mode['read']='hold'
    page.goto(args.base+'/internal/cash-history?store=CR2&date='+OTHER); unlock(page)
    expect(page.locator('[data-lookup-detail]')).to_contain_text('Loading')
    page.wait_for_timeout(100)
    held = mode['held'].pop()
    mode['read']='ok'; visible(page,'#cash-history-store').select_option('CR3'); exact(page)
    r,key,_,cors = held
    r.fulfill(status=200,headers=cors,content_type='application/json',body=json.dumps(document('CR2')))
    expect(page.locator('[data-lookup-detail] [data-saved-cash-detail] > h2')).to_have_text('CR3 · '+OTHER)
    record('out-of-order exact record response cannot replace selected store/day',True)
    mode['history']='hold'
    visible(page,'#cash-history-to').fill('2026-11-13')
    expect(page.locator('[data-lookup-window]')).to_contain_text('Loading')
    page.wait_for_timeout(100)
    old_list = mode['held'].pop()
    mode['history']='empty'
    visible(page,'#cash-history-to').fill('2026-11-14')
    expect(page.locator('[data-lookup-window]')).to_contain_text('No saved days')
    r,key,_,cors = old_list
    r.fulfill(status=200,headers=cors,content_type='application/json',body=json.dumps({'days':[{'date':OTHER,'totals':document('CR3')['totals'],'updatedAt':'2026-11-14T18:00:00.000Z'}]}))
    expect(page.locator('[data-lookup-window]')).to_contain_text('No saved days')
    record('out-of-order window response cannot replace the current lookup',True)
    mode['history']='ok'
    page.get_by_role('button',name='Open saved day',exact=True).click()
    expect(page.locator('[data-lookup-detail] [data-saved-cash-detail]')).to_be_visible()
    # EN/ES, narrow/enlarged, keyboard and full-drawer English print.
    page.get_by_role('button',name='Español',exact=True).click()
    for width,scale,name in [(375,1,'saved-day-spanish-phone'),(320,2,'saved-day-spanish-enlarged')]:
        page.set_viewport_size({'width':width,'height':1000})
        page.evaluate('(scale) => document.documentElement.style.fontSize = (16*scale)+"px"',scale)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'horizontal page overflow'
        shot(page,name)
    page.get_by_role('button',name='English',exact=True).click()
    page.set_viewport_size({'width':1440,'height':1000}); page.evaluate('document.documentElement.style.fontSize="16px"')
    visible(page,'#cash-history-exact').focus(); page.keyboard.press('Tab'); page.keyboard.press('Enter')
    expect(page.locator('[data-lookup-detail] [data-saved-cash-detail]')).to_be_visible()
    page.get_by_role('button',name='Español',exact=True).click()
    page.evaluate('window.dispatchEvent(new Event("beforeprint"))')
    pdf = args.artifacts/'saved-all-drawers.pdf'; page.pdf(path=str(pdf),format='Letter',print_background=False)
    text = '\n'.join(p.extract_text() for p in PdfReader(pdf).pages)
    for label in ['Saved AM','Saved PM','Extra money','175','20','CR3',OTHER]: assert label in text,label
    assert 'Guardar' not in text and 'Unchanged draft' not in text
    page.evaluate('window.dispatchEvent(new Event("afterprint"))')
    record('EN/ES, keyboard exact opening, 375px and 320px enlarged layout, English full-drawer print',{'pdf':pdf.name})
    # Keep one selected local page for passive REA evidence.
    if args.rea:
        from urllib.request import urlopen
        with urlopen('http://127.0.0.1:9338/json/list') as response: targets = json.load(response)
        target = next(item['id'] for item in targets if item.get('url') == page.url)
        subprocess.run(['rea-project','run','--project',str(ROOT),'--','inspect-web-page','http://127.0.0.1:9338',target,'--include-accessibility-text','--include-storage-keys','--json'],check=True,stdout=subprocess.DEVNULL)
        newest = sorted((ROOT/'.rea/runs').iterdir())[-1]
        (args.artifacts/'rea-run.txt').write_text(str(newest.relative_to(ROOT)))
    ctx.close(); browser.close()
assert not errors,errors
assert not external,external
report = {'base':args.base,'synthetic_api':'http://127.0.0.1:8787','scenarios':results,'screenshots':screenshots,'page_errors':errors,'external_attempts':external,'requests':requests,'limitations':['Synthetic loopback service only; no live persistence, retention or atomic conflict claim.','Headless device sizes do not verify physical touch or software keyboard.']}
(args.artifacts/'results.json').write_text(json.dumps(report,indent=2))
print(f'PASS {len(results)} scenarios; {len(screenshots)} screenshots; no page errors or external requests',flush=True)
