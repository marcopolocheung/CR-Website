"""Step 14 retained scheduler integration checks with synthetic, intercepted APIs only."""
import argparse
import importlib.util
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright
from pypdf import PdfReader

spec = importlib.util.spec_from_file_location('views', Path(__file__).with_name('test-scheduler-views.py'))
views = importlib.util.module_from_spec(spec); spec.loader.exec_module(views)
STATIONS = ['CR3-diningroom', 'CR3-kitchen', 'CR2-kitchen', 'CR2-diningroom']
WEEK = '2026-11-22'


class Store:
    def __init__(self):
        self.stores = {station: views.FixtureStore() for station in STATIONS}
        self.default = views.FixtureStore()
        self.external = []
        self.calls = []
        self.held = []
        self.hold_next_requests = False

    def route(self, route):
        request = route.request; url = urlparse(request.url)
        if url.hostname not in ('127.0.0.1', 'localhost'):
            self.external.append(request.url); return route.abort()
        if not url.path.startswith('/api/'):
            return route.continue_()
        self.calls.append({'method': request.method, 'path': url.path, 'query': url.query})
        if url.path.startswith('/api/internal/schedule-requests/'):
            station = url.path.rsplit('/', 1)[1]
            if self.hold_next_requests and request.method == 'GET':
                self.hold_next_requests = False; self.held.append(route); return
        else:
            station = parse_qs(url.query).get('restaurant', [''])[0]
        # The Forms library may load once while its direct Blank view initializes.
        if url.path in ('/api/writeups', '/api/forms') and request.method == 'GET':
            return route.fulfill(status=200, content_type='application/json', body='[]', headers={'Access-Control-Allow-Origin': '*'})
        return self.stores.get(station, self.default).route(route)

    def writes(self):
        return [call for call in self.calls if call['method'] not in ('GET', 'OPTIONS')]


def start(browser, base, path, width=1440, old_layout=None):
    context = browser.new_context(viewport={'width': width, 'height': 1000}, timezone_id='America/Chicago')
    if old_layout:
        context.add_init_script(f"localStorage.setItem('chinarose.scheduler.layout',{json.dumps(old_layout)})")
    store = Store(); context.route('**/*', store.route)
    page = context.new_page(); page.set_default_timeout(12000)
    errors=[]; page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base+path, wait_until='networkidle'); views.unlock(page)
    return context, page, store, errors


def active(page, station='CR3-diningroom'):
    return page.locator(f'[data-scheduler-station="{station}"]:visible')


def snap(root):
    return root.locator('[data-planning-slot]').evaluate_all('(cells)=>cells.map(c=>({id:c.dataset.planningSlot,employee:c.dataset.employeeId,kept:c.dataset.kept}))')


def language(page, name):
    page.get_by_role('group', name='Language / Idioma', exact=True).get_by_role('button', name=name, exact=True).click()


def go_station(page, station):
    page.locator('nav[aria-label="Internal navigation"] a[href$="/scheduler-demo"]').click()
    page.locator(f'a[href$="/scheduler-demo/{station}"]').click()
    expect(active(page,station)).to_be_visible()
    page.wait_for_load_state('networkidle')


def check_links(browser, base, results):
    for suffix in ['', '/', '.html']:
        for view, tab in [('schedule','Schedule'),('staff','Staff & rules'),('requests','Requests'),('unknown','Schedule')]:
            path=f'/scheduler-demo/CR3-diningroom{suffix}?week={WEEK}#{view}'
            context,page,store,errors=start(browser,base,path,old_layout='classic')
            expect(page.get_by_role('tab',name=tab,exact=True)).to_have_attribute('aria-selected','true')
            expect(active(page).get_by_label('Selected week')).to_contain_text('22')
            expect(page.get_by_label('Layout',exact=True)).to_have_count(0)
            assert not store.writes() and not errors and not store.external
            context.close()
    results.append('Extensionless/slash/.html routes, direct three views/unknown hash and Sunday week links preserve URLs and issue no mutations; legacy Classic preference is inert')


def check_copy_and_weeks(browser,base,results):
    context,page,store,errors=start(browser,base,f'/scheduler-demo/CR3-diningroom?week={WEEK}')
    root=active(page); root.get_by_role('button',name='Build week',exact=True).click()
    expect(root.locator('[data-planning-slot]:not([data-employee-id=""])')).to_have_count(7)
    prior=snap(root)
    root.get_by_role('button',name='Next week',exact=True).click()
    expect(page).to_have_url(re.compile(r'week=2026-11-29'))
    expect(root.locator('[data-planning-slot]:not([data-employee-id=""])')).to_have_count(0)
    root.get_by_role('button',name='Copy previous week',exact=True).click()
    expect(root.locator('[data-planning-slot]:not([data-employee-id=""])')).to_have_count(7)
    assert [c['employee'] for c in snap(root)]==[c['employee'] for c in prior]
    assert not store.writes()
    root.get_by_role('button',name='Previous week',exact=True).click()
    expect(page).to_have_url(re.compile(r'week=2026-11-22'))
    assert snap(root)==prior
    page.go_back()
    expect(page).to_have_url(re.compile(r'week=2026-11-29'))
    expect(root.locator('[data-planning-slot]:not([data-employee-id=""])')).to_have_count(7)
    assert not store.writes() and not errors and not store.external
    context.close(); results.append('Build and Copy previous week preserve each working week and URL history without roster/rule/publication writes')


def check_retention(browser,base,artifacts,results):
    context,page,store,errors=start(browser,base,f'/scheduler-demo/CR3-diningroom?week={WEEK}')
    root=active(page); root.get_by_role('button',name='Build week',exact=True).click()
    expect(root.locator('[data-planning-slot]:not([data-employee-id=""])')).to_have_count(7)
    root.get_by_role('checkbox',name='Auto-adjust',exact=True).uncheck()
    cell=root.locator('[data-planning-slot]').first; cell.locator('button').first.click()
    root.get_by_label('Assign employee',exact=True).select_option('')
    baseline=snap(root); root.locator('#planning-team').get_by_role('searchbox').fill('Sample')
    page.get_by_role('tab',name='Staff & rules',exact=True).click()
    settings=root.locator('#scheduler-panel-settings')
    settings.get_by_role('button',name='Add employee',exact=True).click()
    settings.get_by_label('Employee name',exact=True).fill('Partial employee draft')
    page.get_by_role('tab',name='Requests',exact=True).click()
    requests=root.locator('#schedule-requests')
    requests.get_by_role('button',name='Time off requests',exact=False).click()
    requests.get_by_label('Original request / reason (optional)',exact=True).fill('Retained original request')
    page.get_by_role('tab',name='Schedule',exact=True).click()
    assert snap(root)==baseline
    page.go_back(); expect(page.get_by_role('tab',name=re.compile('^Requests'))).to_have_attribute('aria-selected','true')
    expect(requests.get_by_label('Original request / reason (optional)',exact=True)).to_have_value('Retained original request')
    page.go_forward(); expect(page.get_by_role('tab',name='Schedule',exact=True)).to_have_attribute('aria-selected','true')
    # A different tool retains the mounted controller and needs no second manager unlock.
    page.locator('nav[aria-label="Internal navigation"] a[href$="/internal/forms"]').click()
    expect(page.locator('[data-internal-workspace="forms"]')).to_be_visible()
    expect(page.get_by_label('Manager code',exact=True)).to_have_count(0)
    go_station(page,'CR2-kitchen'); kitchen=active(page,'CR2-kitchen')
    kitchen.get_by_role('button',name='Build week',exact=True).click()
    expect(kitchen.locator('[data-planning-slot]:not([data-employee-id=""])')).to_have_count(7)
    go_station(page,'CR3-diningroom'); root=active(page)
    assert snap(root)==baseline
    expect(root.locator('#planning-team').get_by_role('searchbox')).to_have_value('Sample')
    # Same-session language change preserves assignment values and unfinished forms.
    language(page,'Español'); assert snap(root)==baseline; language(page,'English')
    page.get_by_role('tab',name='Staff & rules',exact=True).click()
    expect(root.get_by_label('Employee name',exact=True)).to_have_value('Partial employee draft')
    page.get_by_role('tab',name='Requests',exact=True).click()
    expect(root.get_by_label('Original request / reason (optional)',exact=True)).to_have_value('Retained original request')
    page.locator('[data-shell-lock]').click()
    expect(page.get_by_label('Manager code',exact=True)).to_be_visible()
    expect(page.locator('[data-scheduler-print]:visible')).to_have_count(0)
    views.unlock(page)
    expect(root.get_by_label('Original request / reason (optional)',exact=True)).to_have_value('Retained original request')
    page.get_by_role('tab',name='Schedule',exact=True).click(); assert snap(root)==baseline
    go_station(page,'CR2-kitchen')
    expect(active(page,'CR2-kitchen').locator('[data-planning-slot]:not([data-employee-id=""])')).to_have_count(7)
    go_station(page,'CR3-diningroom'); assert snap(active(page))==baseline
    stored=page.evaluate('JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage})')
    assert 'fixture-password' not in stored and 'Partial employee draft' not in stored and 'Retained original request' not in stored
    assert not store.writes() and not errors and not store.external
    # Reload prompts, then deliberately loses memory drafts and asks for access again.
    dialogs=[]
    page.on('dialog',lambda dialog:(dialogs.append(dialog.type),dialog.accept()))
    page.reload(wait_until='networkidle'); expect(page.get_by_label('Manager code',exact=True)).to_be_visible()
    views.unlock(page); assert dialogs==['beforeunload'], dialogs
    expect(active(page).locator('[data-planning-slot]:not([data-employee-id=""])')).to_have_count(0)
    assert not store.writes() and not errors
    context.close()
    results.append('Partial assignments, staff entry, original request and search survive view history, language, other tools, station switching and lock/unlock without writes or credential/draft serialization; reload warns and starts a new locked visit')


def check_late_access(browser,base,results):
    context,page,store,errors=start(browser,base,f'/scheduler-demo/CR3-diningroom?week={WEEK}#requests')
    requests=active(page).locator('#schedule-requests')
    requests.get_by_role('button',name='Time off requests',exact=False).click()
    store.hold_next_requests=True
    requests.get_by_role('button',name='Reload requests',exact=True).click()
    expect(page.locator('[data-shell-lock]')).to_be_enabled()
    assert len(store.held)==1
    page.locator('[data-shell-lock]').click()
    code=page.get_by_label('Manager code',exact=True); expect(code).to_be_visible()
    code.fill('fixture-password'); code.locator('xpath=ancestor::form').locator('button[type="submit"]').click()
    expect(page.get_by_role('tab',name='Requests',exact=True)).to_be_visible()
    store.held.pop().fulfill(status=401,content_type='application/json',body='{}',headers={'Access-Control-Allow-Origin':'*'})
    page.wait_for_load_state('networkidle')
    expect(page.get_by_label('Manager code',exact=True)).to_have_count(0)
    expect(page.get_by_role('tab',name='Requests',exact=True)).to_be_visible()
    assert not store.writes() and not errors and not store.external
    context.close(); results.append('A held unauthorized read from a prior access generation cannot revoke a same-code reauthentication')


def check_output(browser,base,artifacts,results):
    pdfs=[]
    for station in STATIONS:
        context,page,store,errors=start(browser,base,f'/scheduler-demo/{station}?week={WEEK}')
        root=active(page,station)
        staff_link=root.locator(f'a[href$="/schedule/{station}"]')
        expect(staff_link).to_have_attribute('target','_blank')
        expect(staff_link).to_have_attribute('rel',re.compile('noopener'))
        root.get_by_role('button',name='Build week',exact=True).click()
        expect(root.locator('[data-planning-slot]:not([data-employee-id=""])')).to_have_count(7)
        language(page,'Español')
        # Browser print from configuration still includes only active station English report.
        page.get_by_role('tab',name=re.compile('^Personal')).click()
        page.emulate_media(media='print')
        printable=page.locator('[data-scheduler-print]:visible'); expect(printable).to_have_count(1)
        pdf=artifacts/f'{station}-english.pdf'; page.pdf(path=str(pdf),format='Letter',print_background=True)
        text='\n'.join(p.extract_text() for p in PdfReader(str(pdf)).pages)
        assert text.count('Sample Employee')>=7 and re.search(r'Sun,\s*Nov\s*22',text) and re.search(r'Sat,\s*Nov\s*28',text), text
        assert 'Partial employee draft' not in text and 'Unlock' not in text and 'Personal y reglas' not in text
        pdfs.append({'station':station,'pages':len(PdfReader(str(pdf)).pages),'bytes':pdf.stat().st_size})
        page.emulate_media(media='screen'); language(page,'English')
        page.get_by_role('tab',name='Schedule',exact=True).click()
        if station==STATIONS[0]:
            before=snap(root)
            for width,label in [(1440,'desktop'),(768,'tablet'),(390,'phone'),(320,'spanish-enlarged')]:
                page.set_viewport_size({'width':width,'height':1000})
                if width==320:
                    language(page,'Español'); page.add_style_tag(content='html{font-size:20px!important}')
                for view,tab in [('schedule',re.compile('^Horario$|^Schedule$')),('staff',re.compile('^Staff & rules|^Personal')),('requests',re.compile('^Requests|^Solicitudes'))]:
                    page.get_by_role('tab',name=tab).click()
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,view)
                    page.screenshot(path=str(artifacts/f'{view}-{label}.png'),full_page=True)
                assert snap(root)==before
            page.emulate_media(reduced_motion='reduce')
            assert page.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches')
        assert not store.writes() and not errors and not store.external
        context.close()
    (artifacts/'pdf-manifest.json').write_text(json.dumps(pdfs,indent=2)+'\n')
    results.append('All four station reports contain independent expected employee/day fields in English from Spanish configuration; 12 view screenshots cover desktop/tablet/phone/320px enlarged Spanish with no page overflow or mutations')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--url',default='http://127.0.0.1:3051');parser.add_argument('--artifacts',default='/tmp/cr-step14-workspace');args=parser.parse_args()
    if urlparse(args.url).hostname not in ('127.0.0.1','localhost'):parser.error('Use a loopback server')
    artifacts=Path(args.artifacts);artifacts.mkdir(parents=True,exist_ok=True);results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        check_links(browser,args.url.rstrip('/'),results)
        check_copy_and_weeks(browser,args.url.rstrip('/'),results)
        check_retention(browser,args.url.rstrip('/'),artifacts,results)
        check_late_access(browser,args.url.rstrip('/'),results)
        check_output(browser,args.url.rstrip('/'),artifacts,results)
        browser.close()
    (artifacts/'results.json').write_text(json.dumps({'groups':results,'external_requests':0},indent=2)+'\n')
    for result in results:print('PASS '+result,flush=True)
