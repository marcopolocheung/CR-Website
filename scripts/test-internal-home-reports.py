"""Step 05 Home/Reports acceptance with disposable contexts and synthetic APIs.
Build and serve the static export with NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787.
No service request is allowed outside intercepted loopback endpoints.
"""
import argparse
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('base')
parser.add_argument('--prefix', default='')
parser.add_argument('--artifacts', type=Path, default=Path('/tmp/cr-home-reports'))
parser.add_argument('--rea', action='store_true')
args = parser.parse_args()
assert urlsplit(args.base).hostname == '127.0.0.1'
ROOT = Path(__file__).resolve().parent.parent
args.artifacts.mkdir(parents=True, exist_ok=True)
TOKEN = 'synthetic-step05-manager'
HOURS = b'Employee External Id,Employee,Job Title,In Date,Out Date,Total Hours,Regular Hours,Overtime Hours\ne1,Fixture,Cook,11/12/2026 08:00 AM,11/12/2026 04:00 PM,8,8,0\n'
results, screenshots, errors, external, requests = [], [], [], [], []


def record(name, observed):
    results.append({'scenario': name, 'observed': observed})
    print('PASS scenario: ' + name, flush=True)
def visible(page, selector): return page.locator(selector + ':visible')
def workspace(page, name): return page.locator('[data-internal-workspace="' + name + '"]:visible')
def home(page): return workspace(page, 'dashboard')
def reports(page): return workspace(page, 'reports')
def nav(page, item): return page.locator('[data-shell-chrome] [data-nav-item="' + item + '"]')
def selected(page, item): expect(nav(page, item)).to_have_attribute('aria-current', 'page')
def shot(page, name):
    page.evaluate('window.scrollTo(0,0)'); page.wait_for_timeout(100)
    path = args.artifacts / (name + '.png')
    page.screenshot(path=str(path), full_page=True)
    screenshots.append({'file': path.name, 'viewport': page.viewport_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
def unlock(page):
    page.wait_for_load_state('networkidle')
    visible(page, '#cashout-code').fill(TOKEN)
    page.get_by_role('button', name='Unlock', exact=True).click()
    expect(visible(page, '#cashout-code')).to_have_count(0)
def tile_value(page, label, value):
    tile = reports(page).get_by_text(label, exact=True).locator('..')
    expect(tile).to_contain_text(value)
def history(store, to):
    # Independent fixture: two saved dates. Day -1: CR2 $300 + CR3 $400;
    # day -2: CR2 $300. Two-date average $500; known over/short +$2.
    first = (date.fromisoformat(to) - timedelta(days=1)).isoformat()
    second = (date.fromisoformat(to) - timedelta(days=2)).isoformat()
    def day(day_date, am, pm, difference, z):
        return {'date': day_date, 'updatedAt': day_date + 'T23:00:00.000Z',
                'totals': {'amDeposit': am, 'pmDeposit': pm, 'deposit': am + pm,
                           'amOverShort': difference, 'pmOverShort': 0,
                           'overShort': difference, 'zOverShort': z}}
    return [day(first, 10000, 20000, 300, None), day(second, 10000, 20000, 0, 0)] if store == 'CR2' else [day(first, 20000, 20000, -100, 200)]


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--remote-debugging-port=9337'] if args.rea else [])
    def browser_workspace(width=1440, touch=False, state='populated'):
        ctx = browser.new_context(viewport={'width': width, 'height': 1000}, has_touch=touch, service_workers='block')
        mode = {'history': state, 'verify_count': 0, 'request_count': 0}
        def route(r):
            req, u = r.request, urlsplit(r.request.url)
            origin = f'{u.scheme}://{u.netloc}'
            if origin == args.base:
                r.continue_(); return
            if origin != 'http://127.0.0.1:8787':
                external.append(req.url); r.abort(); return
            mode['request_count'] += 1
            requests.append({'method': req.method, 'path': u.path})
            cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,OPTIONS'}
            if req.method == 'OPTIONS':
                r.fulfill(status=204, headers=cors); return
            assert req.method == 'GET', 'Step05 scenarios do not write service records: ' + req.method + ' ' + u.path
            assert req.headers.get('authorization') == 'Bearer ' + TOKEN
            status, body = 200, {}
            if u.path == '/api/auth/verify':
                mode['verify_count'] += 1; body = {'ok': True}
            elif u.path.startswith('/api/cashout/'):
                if u.path.count('/') == 4: status, body = 404, {'error': 'not_found'}
                elif mode['history'] == 'failure': status, body = 503, {'error': 'unavailable'}
                else:
                    store = u.path.split('/')[-1]
                    to = parse_qs(u.query).get('to', [date.today().isoformat()])[0]
                    body = {'days': [] if mode['history'] == 'empty' else history(store, to)}
            elif u.path == '/api/inventory/CR3/list': body = {'rev': 0, 'sheets': None}
            elif u.path == '/api/inventory/CR3': body = {'days': []}
            elif u.path == '/api/writeups': body = {'writeUps': []}
            elif u.path == '/api/forms': body = {'forms': []}
            elif u.path == '/api/schedule': body = {'weeks': [], 'rev': 0, 'notModified': False}
            elif u.path.startswith('/api/schedule/'): status, body = 404, {'error': 'not_found'}
            else: raise AssertionError('Unexpected endpoint: ' + req.url)
            r.fulfill(status=status, json=body, headers=cors)
        ctx.route('**/*', route)
        page = ctx.new_page(); page.on('pageerror', lambda error: errors.append(str(error)))
        return ctx, page, mode
    def visit(page, path):
        response = page.goto(args.base + args.prefix + path)
        assert response is None or response.status == 200, (path, response.status)
        expect(page.locator('[data-shell-ready=true]')).to_be_visible()
        page.wait_for_load_state('networkidle')
    def go(page, item, keyboard=False):
        if keyboard: nav(page, item).focus(); page.keyboard.press('Enter')
        else: nav(page, item).click()
        selected(page, item)
    def import_link(page, tab):
        reports(page).locator('a[href$="#' + tab + '"]').click()
        expect(page.locator('#tab-' + tab)).to_have_attribute('aria-selected', 'true')
        selected(page, 'reports')

    # Home is useful before authentication and makes no history/service read.
    ctx, page, mode = browser_workspace()
    visit(page, '/internal')
    selected(page, 'dashboard')
    expect(home(page).locator('a[href]')).to_have_count(5)
    expect(home(page).locator('#cashout-code, svg[role="img"], table')).to_have_count(0)
    assert '$0' not in home(page).inner_text()
    assert mode['request_count'] == 0
    destinations = [('Cash', '/internal/bookkeeping#cash-out'), ('Inventory', '/internal/inventory'),
                    ('Schedule', '/scheduler-demo'), ('Reports', '/internal/reports'), ('Forms', '/internal/forms')]
    for label, href in destinations:
        expect(home(page).locator('a[href="' + args.prefix + href + '"]')).to_be_visible()
    page.evaluate('window.step05HomeReselect = "same-home-document"')
    nav(page, 'dashboard').click(); page.wait_for_load_state('networkidle')
    assert page.evaluate('window.step05HomeReselect') == 'same-home-document'
    shot(page, 'home-blank-desktop')
    record('blank Home', 'Five named Cash/Inventory/Schedule/Reports/Forms task starts are available without a manager gate, charts, invented work signals or API reads')
    # The five launcher links work with pointer and native keyboard activation.
    for keyboard in (False, True):
        for label, href in destinations:
            if not home(page).is_visible(): go(page, 'dashboard')
            link = home(page).locator('a[href="' + args.prefix + href + '"]')
            if keyboard: link.focus(); page.keyboard.press('Enter')
            else: link.click()
            expect(page).to_have_url(re.compile(re.escape(args.prefix + href) + '$'))
            if label == 'Schedule':
                expect(page.locator('#demo-gate-code')).to_be_visible()
                page.get_by_role('link', name='Internal tools / Herramientas internas', exact=True).click()
                selected(page, 'dashboard')
            else:
                selected(page, label.lower())
                expect(page.locator('[data-internal-workspace]:visible')).to_have_count(1)
    record('task launch keyboard and pointer', 'All five Home links activate with pointer and Enter; each reaches its actual tool/adapter and has a way Home')
    go(page, 'reports')
    expect(reports(page).locator('a[href$="#sales"],a[href$="#hours"],a[href$="#comparison"]')).to_have_count(3)
    expect(visible(page, '#cashout-code')).to_have_count(1)
    expect(reports(page).locator('table')).to_have_count(0)
    shot(page, 'reports-locked-desktop')
    record('Reports locked hub', 'New Reports destination exposes three existing import/comparison links while protected cash history requires the shared manager unlock')
    unlock(page)
    tile_value(page, 'Deposits', '$1,000.00')
    tile_value(page, 'Average per day', '$500.00')
    tile_value(page, 'Net over / short', '+$2.00')
    table = reports(page).locator('table')
    expect(table).to_contain_text('$700.00'); expect(table).to_contain_text('$300.00'); expect(table).to_contain_text('$400.00')
    page.evaluate('window.step05ReportsReselect = "same-report-document"')
    before_reselect = mode['request_count']
    nav(page, 'reports').focus(); page.keyboard.press('Enter'); page.wait_for_load_state('networkidle')
    assert page.evaluate('window.step05ReportsReselect') == 'same-report-document'
    assert mode['request_count'] == before_reselect
    expect(visible(page, '#cashout-code')).to_have_count(0)
    record('active destination reselect', 'Pointer reselecting Home and keyboard reselecting Reports preserve the same document, manager memory session and report values without another history read')
    shot(page, 'reports-populated-desktop')
    record('independent report values', 'Three fixture store-days across two dates retain $1,000 total, $500 per saved date, +$2 net difference and $300 AM/$400 PM/$700 combined on the shared date')
    # Shared access survives Home; Home does not refetch the retained report.
    before = mode['request_count']; go(page, 'dashboard')
    page.wait_for_timeout(150)
    assert mode['request_count'] == before
    expect(home(page).locator('#cashout-code, table')).to_have_count(0)
    go(page, 'reports')
    tile_value(page, 'Deposits', '$1,000.00')
    for tab in ('sales', 'hours', 'comparison'):
        import_link(page, tab); go(page, 'reports')
    record('report routes and access', 'Reports always opens the hub; all legacy import destinations remain discoverable, protected values stay reachable, and Home adds no history reads after unlock')
    ctx.close()

    # Empty history and failure are separately rendered under Reports, not Home.
    for state in ('empty', 'failure'):
        ctx, page, mode = browser_workspace(state=state)
        visit(page, '/internal/reports'); unlock(page)
        if state == 'empty':
            expect(reports(page).get_by_role('status')).to_contain_text('No saved cash records')
            expect(reports(page).get_by_text('Deposits', exact=True)).to_have_count(0)
            expect(reports(page).locator('table')).to_have_count(0)
            shot(page, 'reports-empty-desktop')
        else:
            expect(reports(page)).to_contain_text(re.compile('not set up|Could not|unavailable|reach', re.I))
            expect(reports(page).get_by_text('No cash-out saved', exact=True)).to_have_count(0)
            expect(reports(page).locator('table')).to_have_count(0)
            shot(page, 'reports-failure-desktop')
            mode['history'] = 'populated'
            reports(page).get_by_role('button', name='Retry cash history', exact=True).click()
            tile_value(page, 'Deposits', '$1,000.00')
        go(page, 'dashboard')
        expect(home(page).locator('a')).to_have_count(5)
        assert '$0' not in home(page).inner_text()
        record('Reports ' + state, 'Reports distinguishes ' + state + ' history while Home remains a usable task launcher without a fabricated complete/empty-work claim')
        ctx.close()

    # All visited editors survive round trips through both new destinations.
    ctx, page, mode = browser_workspace(375, True)
    visit(page, '/internal/bookkeeping#cash-out'); unlock(page)
    visible(page, '#cashout-store').select_option('CR2'); visible(page, '#cashout-date').fill('2026-11-12')
    visible(page, '#draft-preparer').fill('Step05 cash fixture')
    page.get_by_role('button', name='Start new draft', exact=True).click()
    visible(page, '#am-0-name').fill('Cash retained through Home and Reports'); visible(page, '#am-0-10000').fill('3')
    page.evaluate('window.step05Document = "same-document"')
    go(page, 'dashboard'); go(page, 'reports'); import_link(page, 'hours')
    visible(page, '#hc-location').select_option(index=2)
    visible(page, '#hc-start').fill('2026-11-01'); visible(page, '#hc-end').fill('2026-11-30')
    visible(page, '#hc-file').set_input_files({'name': 'step05-hours.csv', 'mimeType': 'text/csv', 'buffer': HOURS})
    page.evaluate('window.step05File = document.querySelector("#hc-file").files[0]')
    go(page, 'forms')
    page.get_by_role('button', name='New write-up', exact=True).click()
    visible(page, '#form-draft-store').select_option('CR3'); visible(page, '#form-draft-date').fill('2026-11-11')
    visible(page, '#form-draft-preparer').fill('Step05 form fixture')
    page.get_by_role('button', name='Start new draft', exact=True).click()
    page.get_by_label('Incident Descriptions', exact=True).fill('Form narrative remains through new Home and Reports')
    go(page, 'dashboard'); go(page, 'reports'); go(page, 'cash')
    expect(visible(page, '#am-0-name')).to_have_value('Cash retained through Home and Reports')
    expect(visible(page, '#am-0-10000')).to_have_value('3')
    go(page, 'dashboard'); go(page, 'reports'); import_link(page, 'hours')
    expect(visible(page, '#hc-start')).to_have_value('2026-11-01')
    assert page.evaluate('window.step05File === document.querySelector("#hc-file").files[0]')
    go(page, 'forms')
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_have_value('Form narrative remains through new Home and Reports')
    assert page.evaluate('window.step05Document') == 'same-document'
    assert mode['verify_count'] == 1
    assert TOKEN not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})')
    record('cash form and File retention', 'Home/Reports/import round trips preserve exact CR2 cash count, CR3 narrative, selected hours date range and original browser File with one verified memory session')
    go(page, 'dashboard')
    page.get_by_role('button', name='Español', exact=True).click()
    shot(page, 'home-spanish-phone')
    for width in (768, 375, 320):
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
    page.add_style_tag(content='html { font-size: 200% !important }')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    shot(page, 'home-spanish-enlarged')
    page.emulate_media(media='print')
    expect(page.locator('header[data-shell-chrome]')).not_to_be_visible()
    pdf = args.artifacts / 'home-print.pdf'; page.pdf(path=str(pdf))
    text = '\n'.join(item.extract_text() or '' for item in PdfReader(pdf).pages)
    assert 'Cash retained through Home' not in text and 'Form narrative remains' not in text
    page.emulate_media(media='screen')
    page.add_style_tag(content='html { font-size: 100% !important }')
    go(page, 'reports'); shot(page, 'reports-spanish-phone')
    for width in (375, 320):
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
    page.add_style_tag(content='html { font-size: 200% !important }')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    shot(page, 'reports-spanish-enlarged')
    page.add_style_tag(content='html { font-size: 100% !important }')
    page.emulate_media(media='print')
    pdf = args.artifacts / 'reports-print.pdf'; page.pdf(path=str(pdf))
    text = '\n'.join(item.extract_text() or '' for item in PdfReader(pdf).pages)
    assert '1,000.00' in text and 'Cash retained through Home' not in text and 'Form narrative remains' not in text
    page.emulate_media(media='screen')
    record('language responsive and print', 'EN/ES retains data; Home reflows at 768/375/320px and 200% text; phone Reports remains contained; printing includes only active Home/Reports, preserving report values and excluding retained editors/shell')
    if args.rea:
        from urllib.request import urlopen
        with urlopen('http://127.0.0.1:9337/json/list') as response: targets = json.load(response)
        target = next(item['id'] for item in targets if item.get('url') == page.url)
        subprocess.run(['rea-project', 'run', '--project', str(ROOT), '--', 'inspect-web-page', 'http://127.0.0.1:9337', target, '--include-accessibility-text', '--include-storage-keys', '--json'], cwd=ROOT, check=True)
    ctx.close()

    # Direct aliases retain the old import routes as well as the new hub.
    ctx, page, mode = browser_workspace()
    for path, expected in [('/internal', 'dashboard'), ('/internal/', 'dashboard'), ('/internal.html', 'dashboard'),
                           ('/internal/reports', 'reports'), ('/internal/reports/', 'reports'), ('/internal/reports.html', 'reports'),
                           ('/internal/bookkeeping#cash-out', 'cash'), ('/internal/bookkeeping/#sales', 'reports'),
                           ('/internal/bookkeeping.html#hours', 'reports'), ('/internal/bookkeeping#comparison', 'reports')]:
        visit(page, path); selected(page, expected)
        if '#sales' in path or '#hours' in path or '#comparison' in path:
            tab = path.split('#')[1]
            expect(page.locator('#tab-' + tab)).to_have_attribute('aria-selected', 'true')
        expect(nav(page, 'reports')).to_have_attribute('href', args.prefix + '/internal/reports')
    record('direct aliases and compatibility', 'Home/Reports slash and HTML aliases plus old cash/sales/hours/comparison deep links land correctly; shell Reports consistently points to new hub')
    browser_version = browser.version; ctx.close(); browser.close()

assert not errors, errors
assert not external, external
sources = [*ROOT.glob('src/components/internal/*.tsx'), *ROOT.glob('src/components/internal/*.css'),
           *ROOT.glob('src/app/(order-shell)/internal/**/page.tsx'),
           ROOT / 'src/lib/internal-tools/i18n/en.ts', ROOT / 'src/lib/internal-tools/i18n/es.ts', Path(__file__).resolve()]
manifest = {'baseCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
            'sourceFilesSha256': {str(file.relative_to(ROOT)): hashlib.sha256(file.read_bytes()).hexdigest() for file in sources if file.is_file()},
            'browser': browser_version, 'frontend': args.base + args.prefix, 'api': 'http://127.0.0.1:8787 (intercepted)',
            'scenarios': results, 'screenshots': screenshots, 'pageErrors': errors, 'externalAttempts': external, 'apiRequests': requests,
            'limits': ['Synthetic local API responses, not production persistence/activation', 'Physical touch/software keyboard and full accessibility remain unverified', 'Passive REA attach does not replay prior Playwright actions']}
(args.artifacts / 'results.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'PASS Step05: {len(results)} scenarios; {len(screenshots)} screenshots; 0 browser errors/external attempts; synthetic GET/OPTIONS only')
