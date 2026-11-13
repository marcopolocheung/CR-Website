"""Step 04 acceptance using disposable browser contexts and synthetic loopback APIs.
Build/start the frontend with NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787.
All API traffic is intercepted; unexpected external requests fail the run.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('base')
parser.add_argument('--prefix', default='', help='Configured Next basePath, for example /review')
parser.add_argument('--artifacts', type=Path, default=Path('/tmp/cr-session'))
parser.add_argument('--rea', action='store_true', help='Retain passive REA page evidence through local CDP')
args = parser.parse_args()
assert urlsplit(args.base).hostname == '127.0.0.1'
ROOT = Path(__file__).resolve().parent.parent
args.artifacts.mkdir(parents=True, exist_ok=True)
TOKEN = 'synthetic-step04-manager'
DATE = '2026-11-12'
INVENTORY = [{'id': 'session-sheet', 'title': 'Session supplies', 'useLabel': 'Use', 'showSup': True, 'items': [{'id': 'session-item', 'name': 'Session item', 'sup': 'L', 'use': '1/2', 'gray': False}]}]
HOURS = b'Employee External Id,Employee,Job Title,In Date,Out Date,Total Hours,Regular Hours,Overtime Hours\ne1,Fixture,Cook,11/12/2026 08:00 AM,11/12/2026 04:00 PM,8,8,0\n'
results, images, errors, external, requests = [], [], [], [], []


def record(name, observed):
    results.append({'scenario': name, 'observed': observed})
    print('PASS scenario: ' + name, flush=True)
def visible(page, selector): return page.locator(selector + ':visible')
def nav(page, destination): return page.locator('[data-shell-chrome] [data-nav-item="' + destination + '"]')
def selected(page, destination): expect(nav(page, destination)).to_have_attribute('aria-current', 'page')
def context_line(page): return page.locator('[data-shell-context]')
def shot(page, name):
    page.evaluate('window.scrollTo(0,0)')
    page.wait_for_timeout(100)
    path = args.artifacts / (name + '.png')
    page.screenshot(path=str(path), full_page=True)
    images.append({'file': path.name, 'viewport': page.viewport_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
def unlock(page):
    expect(visible(page, '#cashout-code')).to_have_count(1)
    visible(page, '#cashout-code').fill(TOKEN)
    page.get_by_role('button', name='Unlock', exact=True).click()
    expect(visible(page, '#cashout-code')).to_have_count(0)
def start_cash(page, store='CR2', preparer='Session cash fixture'):
    visible(page, '#cashout-store').select_option(store)
    visible(page, '#cashout-date').fill(DATE)
    visible(page, '#draft-preparer').fill(preparer)
    page.get_by_role('button', name='Start new draft', exact=True).click()
    visible(page, '#am-0-name').fill('Session synthetic cashier')
    visible(page, '#am-0-10000').fill('3')
def start_form(page):
    page.get_by_role('button', name='New write-up', exact=True).click()
    visible(page, '#form-draft-store').select_option('CR3')
    visible(page, '#form-draft-date').fill('2026-11-11')
    visible(page, '#form-draft-preparer').fill('Session form fixture')
    page.get_by_role('button', name='Start new draft', exact=True).click()
    page.get_by_label('Incident Descriptions', exact=True).fill('Narrative retained across tools and denied storage')
def deny_storage(page):
    page.evaluate('''() => {
      window.step04OriginalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function() { throw new DOMException('Synthetic quota', 'QuotaExceededError') };
    }''')
def restore_storage(page):
    page.evaluate('() => { Storage.prototype.setItem = window.step04OriginalSetItem }')
def accept_dialog_if_any(page):
    page.wait_for_timeout(150)
    dialog = page.get_by_role('dialog')
    if dialog.is_visible():
        dialog.get_by_role('button').last.click()
def assert_no_credentials(page):
    assert TOKEN not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--remote-debugging-port=9336'] if args.rea else [])
    def workspace(width=1440, touch=False):
        ctx = browser.new_context(viewport={'width': width, 'height': 1000}, has_touch=touch, service_workers='block')
        mode = {'cash_write': 'success', 'verify_count': 0, 'held': [], 'put_count': 0, 'inventory_auth': False, 'list_rev': 7, 'import_auth': False}
        def route(r):
            req = r.request
            u = urlsplit(req.url)
            origin = f'{u.scheme}://{u.netloc}'
            if origin == args.base:
                r.continue_(); return
            if origin != 'http://127.0.0.1:8787':
                external.append(req.url); r.abort(); return
            requests.append({'method': req.method, 'path': u.path})
            cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,PUT,POST,DELETE,OPTIONS'}
            if req.method == 'OPTIONS':
                r.fulfill(status=204, headers=cors); return
            assert req.headers.get('authorization') == 'Bearer ' + TOKEN
            status, body = 200, {}
            if u.path == '/api/auth/verify':
                mode['verify_count'] += 1
                body = {'ok': True}
            elif u.path.startswith('/api/cashout/'):
                if req.method == 'PUT':
                    mode['put_count'] += 1
                    if mode['cash_write'] == 'hold':
                        mode['held'].append((r, cors)); return
                    if mode['cash_write'] == 'auth': status, body = 401, {'error': 'unauthorized'}
                    else: body = {'ok': True, 'extraMoney': req.post_data_json['sheet'].get('extraMoney', '')}
                else: status, body = (404, {'error': 'not_found'}) if u.path.count('/') == 4 else (200, {'days': []})
            elif u.path == '/api/inventory/CR3/list':
                status, body = (401, {'error': 'unauthorized'}) if mode['inventory_auth'] else (200, {'rev': mode['list_rev'], 'sheets': INVENTORY})
            elif u.path == '/api/inventory/CR3': body = {'days': []}
            elif u.path.startswith('/api/internal/import-history/'):
                status, body = (403, {'error': 'unauthorized'}) if mode['import_auth'] else (200, {'records': [], 'nextCursor': None})
            elif u.path == '/api/writeups': body = {'writeUps': []}
            elif u.path == '/api/forms': body = {'forms': []}
            elif u.path == '/api/schedule': body = {'weeks': [], 'rev': 0, 'notModified': False}
            elif u.path.startswith('/api/schedule/'): status, body = 404, {'error': 'not_found'}
            else: raise AssertionError('Unexpected endpoint: ' + req.method + ' ' + req.url)
            r.fulfill(status=status, json=body, headers=cors)
        ctx.route('**/*', route)
        page = ctx.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        return ctx, page, mode
    def visit(page, path):
        response = page.goto(args.base + args.prefix + path)
        assert response is None or response.status == 200, (path, response.status)
        expect(page.locator('[data-shell-ready=true]')).to_be_visible()
        page.wait_for_load_state('networkidle')
    def go(page, destination, keyboard=False):
        if keyboard:
            nav(page, destination).focus(); page.keyboard.press('Enter')
        else: nav(page, destination).click()
        selected(page, destination)
        expect(page.locator('[data-shell-ready=true]')).to_be_visible()
        assert not page.get_by_role('dialog').is_visible(), 'Retained internal navigation must not ask to abandon work'

    # One unlock and one document retain exact cash fields, form values and browser File objects.
    ctx, page, mode = workspace()
    visit(page, '/internal/bookkeeping')
    unlock(page); start_cash(page)
    page.get_by_role('button', name='Choose another draft', exact=True).click()
    expect(page.get_by_role('dialog')).to_be_visible()
    page.keyboard.press('Escape')
    expect(visible(page, '#am-0-name')).to_have_value('Session synthetic cashier')
    expect(visible(page, '#am-0-10000')).to_have_value('3')
    record('cancel cash context transition', 'Canceling draft change retains exact store/date, count and cashier; no replacement occurs')
    page.evaluate('window.step04DocumentSentinel = "same-document"')
    expect(context_line(page)).to_contain_text('CR2'); expect(context_line(page)).to_contain_text(DATE)
    go(page, 'forms', keyboard=True)
    expect(visible(page, '#cashout-code')).to_have_count(0)
    start_form(page)
    expect(context_line(page)).to_contain_text('CR3'); expect(context_line(page)).to_contain_text('2026-11-11')
    go(page, 'inventory')
    expect(visible(page, '#cashout-code')).to_have_count(0)
    expect(context_line(page)).to_contain_text('CR3')
    go(page, 'cash')
    expect(visible(page, '#am-0-name')).to_have_value('Session synthetic cashier')
    expect(visible(page, '#am-0-10000')).to_have_value('3')
    expect(context_line(page)).to_contain_text('CR2'); expect(context_line(page)).to_contain_text(DATE)
    go(page, 'reports')
    page.locator('#tab-hours').click()
    visible(page, '#hc-location').select_option(index=2)
    visible(page, '#hc-start').fill('2026-11-01'); visible(page, '#hc-end').fill('2026-11-30')
    visible(page, '#hc-file').set_input_files({'name': 'step04-hours.csv', 'mimeType': 'text/csv', 'buffer': HOURS})
    page.evaluate('window.step04OriginalFile = document.querySelector("#hc-file").files[0]')
    go(page, 'dashboard'); go(page, 'reports')
    page.locator('#tab-hours').click()
    assert page.evaluate('window.step04OriginalFile === document.querySelector("#hc-file").files[0]')
    go(page, 'forms')
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_have_value('Narrative retained across tools and denied storage')
    assert page.evaluate('window.step04DocumentSentinel') == 'same-document'
    assert mode['verify_count'] == 1
    record('shared access and retained work', 'One verified unlock crosses all internal tools using pointer and keyboard; exact CR2 cash/CR3 form contexts and values plus original import File survive without document reload or departure prompt')
    shot(page, 'forms-retained-desktop')
    # Native same-layout history preserves the retained editors and active shell identity.
    page.go_back(); selected(page, 'reports')
    page.go_forward(); selected(page, 'forms')
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_have_value('Narrative retained across tools and denied storage')
    record('history', 'Back/Forward changes visible workspace while retaining entered narrative and task context')
    page.locator('[data-shell-lock]').click(); accept_dialog_if_any(page)
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_have_value('Narrative retained across tools and denied storage')
    expect(visible(page, '#cashout-code')).to_have_count(0)
    expect(page.locator('[data-shell-lock]')).to_be_enabled()
    expect(page.get_by_role('alert').filter(has_text=re.compile('copy|save|storage|work', re.I)).first).to_be_visible()
    go(page, 'reports'); page.locator('#tab-hours').click()
    assert page.evaluate('window.step04OriginalFile === document.querySelector("#hc-file").files[0]')
    record('incomplete import handoff', 'Shared manual lock refuses memory-only incomplete import work without claiming a durable copy; exact File and entered dates remain available for completing or exporting work')
    assert_no_credentials(page)
    ctx.close()

    # Save-and-leave lock prepares every visited dirty editor, and quota failure leaves access intact.
    ctx, page, mode = workspace(375, True)
    visit(page, '/internal/bookkeeping'); unlock(page); start_cash(page)
    go(page, 'forms'); start_form(page)
    deny_storage(page)
    page.get_by_label('Incident Descriptions', exact=True).fill('Quota retained form narrative')
    page.locator('[data-shell-lock]').click(); accept_dialog_if_any(page)
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_have_value('Quota retained form narrative')
    expect(visible(page, '#cashout-code')).to_have_count(0)
    expect(page.locator('[data-shell-lock]')).to_be_enabled()
    go(page, 'cash')
    expect(visible(page, '#am-0-10000')).to_have_value('3')
    record('manual lock refuses failed storage', 'Denied device writes in a visited form block shared manual lock and retain both form/cash values and manager access; internal navigation remains available')
    restore_storage(page)
    page.locator('[data-shell-lock]').click(); accept_dialog_if_any(page)
    expect(visible(page, '#cashout-code')).to_have_count(1)
    expect(page.locator('[data-shell-lock]')).to_be_disabled()
    unlock(page)
    expect(visible(page, '#draft-preparer')).to_be_visible()
    visible(page, '#draft-preparer').fill('Resume after lock')
    source = page.locator('li').filter(has=page.get_by_text('Preparer: Session cash fixture', exact=True)).first
    source.get_by_role('button', name='Resume as a copy', exact=True).click()
    expect(visible(page, '#am-0-10000')).to_have_value('3')
    go(page, 'forms')
    expect(page.get_by_role('button', name='New write-up', exact=True)).to_be_visible()
    page.get_by_role('button', name='New write-up', exact=True).click()
    visible(page, '#form-draft-store').select_option('CR3')
    visible(page, '#form-draft-date').fill('2026-11-11')
    visible(page, '#form-draft-preparer').fill('Resume form after lock')
    page.locator('li').filter(has=page.get_by_text('Preparer: Session form fixture', exact=True)).first.get_by_role('button', name='Resume as a copy', exact=True).click()
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_have_value('Quota retained form narrative')
    record('manual lock saves and leaves', 'Successful shared lock returns cash to draft choice and Forms to list; both explicit resumes recover the exact separately labelled drafts; tokens absent from device storage')
    shot(page, 'forms-resumed-phone')
    assert_no_credentials(page)
    ctx.close()

    # Forced expiry always clears access even when manual save-and-leave could not persist.
    ctx, page, mode = workspace()
    visit(page, '/internal/bookkeeping'); unlock(page); start_cash(page)
    deny_storage(page)
    visible(page, '#am-0-name').fill('Expiry retained without storage')
    mode['cash_write'] = 'auth'
    visible(page, '#cashout-save').click()
    expect(visible(page, '#cashout-code')).to_have_count(1)
    expect(visible(page, '#am-0-name')).to_have_count(0)
    go(page, 'inventory')
    expect(visible(page, '#cashout-code')).to_have_count(1)
    mode['cash_write'] = 'success'; unlock(page)
    go(page, 'cash')
    expect(visible(page, '#am-0-name')).to_have_value('Expiry retained without storage')
    expect(visible(page, '#am-0-10000')).to_have_value('3')
    expect(visible(page, '#cashout-save')).to_be_enabled()
    assert mode['put_count'] == 1, 'Unlock must not automatically replay the failed save'
    restore_storage(page)
    visible(page, '#cashout-save').click()
    expect(visible(page, '[data-save-state]')).to_have_attribute('data-save-state', 'server')
    record('authorization expiry and explicit retry', 'A 401 clears shared access immediately despite denied storage, hides protected work in every tool, retains the original draft, and requires an explicit retry after unlock')
    # Print only the active retained workspace, with no hidden form/inventory content.
    go(page, 'forms'); start_form(page); go(page, 'cash')
    page.emulate_media(media='print')
    expect(page.locator('header[data-shell-chrome]')).not_to_be_visible()
    pdf = args.artifacts / 'active-cash-print.pdf'
    page.pdf(path=str(pdf))
    printed = '\n'.join(item.extract_text() or '' for item in PdfReader(pdf).pages)
    assert 'Expiry retained without storage' in printed and '300.00' in printed
    assert 'Narrative retained across tools' not in printed and 'CR3 Inventory' not in printed
    page.emulate_media(media='screen')
    record('active-only print', 'Printed cash includes cashier and $300 while retained inactive Forms/Inventory and shell controls stay out of output')
    # Language switching preserves work and shell on narrow enlarged layouts.
    page.get_by_role('button', name='Español', exact=True).click()
    expect(visible(page, '#am-0-name')).to_have_value('Expiry retained without storage')
    page.set_viewport_size({'width': 320, 'height': 1000})
    page.add_style_tag(content='html { font-size: 200% !important }')
    shot(page, 'cash-expiry-spanish-large-text')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), page.evaluate('Array.from(document.querySelectorAll("body *")).map(e => ({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+1).slice(-15)')
    record('language and enlarged layout', 'EN/ES switch retains cash inputs and exact context at 320px with 200% text; headless touch remains distinct from physical keyboard/device evidence')
    if args.rea:
        from urllib.request import urlopen
        with urlopen('http://127.0.0.1:9336/json/list') as response: targets = json.load(response)
        target = next(item['id'] for item in targets if item.get('url') == page.url)
        subprocess.run(['rea-project', 'run', '--project', str(ROOT), '--', 'inspect-web-page', 'http://127.0.0.1:9336', target, '--include-accessibility-text', '--include-storage-keys', '--json'], cwd=ROOT, check=True)
    assert_no_credentials(page)
    # Reload starts a fresh memory session even when a preparer and draft remain on device.
    page.once('dialog', lambda dialog: dialog.accept())
    page.reload(); expect(visible(page, '#cashout-code')).to_have_count(1)
    record('fresh-session boundary', 'Reload requires authentication again; labelled device drafts and remembered preparer never confer access')
    ctx.close()

    # Exact-day count copies and catalog recovery retain independent context/revision.
    ctx, page, mode = workspace()
    visit(page, '/internal/inventory'); unlock(page)
    count = page.locator('input[aria-label$=" inventory"]').first
    expect(count).to_be_visible()
    original_date = visible(page, '#inventory-date').input_value()
    count.fill('3B/2T')
    next_date = '2026-10-01' if original_date != '2026-10-01' else '2026-10-02'
    visible(page, '#inventory-date').fill(next_date)
    expect(page.get_by_role('dialog')).to_be_visible()
    page.keyboard.press('Escape')
    expect(visible(page, '#inventory-date')).to_have_value(original_date)
    expect(count).to_have_value('3B/2T')
    visible(page, '#inventory-date').fill(next_date)
    expect(page.get_by_role('dialog')).to_be_visible()
    page.get_by_role('dialog').get_by_role('button').last.click()
    expect(visible(page, '#inventory-date')).to_have_value(next_date)
    expect(count).to_have_value('')
    visible(page, '#inventory-date').fill(original_date); accept_dialog_if_any(page)
    expect(count).to_have_value('3B/2T')
    page.locator('#inventory-edit-list').click()
    name = page.locator('input[aria-label$=" name"]').first
    name.fill('Catalog name retained across shared lock')
    go(page, 'dashboard')
    page.locator('[data-shell-lock]').click(); accept_dialog_if_any(page)
    expect(visible(page, '#cashout-code')).to_have_count(1)
    recovery = page.evaluate('JSON.parse(localStorage.getItem("cr-inventory-catalog-recovery-v1"))')
    assert recovery['baseRevision'] == 7 and recovery['sheets'][0]['items'][0]['name'] == 'Catalog name retained across shared lock'
    mode['list_rev'] = 9
    unlock(page); go(page, 'inventory')
    expect(count).to_have_value('3B/2T')
    expect(page.get_by_role('button', name='Resume catalog draft', exact=True)).to_be_visible()
    expect(page.locator('input[aria-label$=" name"]:visible')).to_have_count(0)
    page.get_by_role('button', name='Resume catalog draft', exact=True).click(); accept_dialog_if_any(page)
    expect(name).to_have_value('Catalog name retained across shared lock')
    expect(page.get_by_role('button', name='Save list', exact=True)).to_be_disabled()
    assert page.evaluate('JSON.parse(localStorage.getItem("cr-inventory-catalog-recovery-v1")).baseRevision') == 7
    record('inventory context and catalog recovery', 'Cancel retains exact date/raw 3B/2T count; confirmed date change preserves its exact-day copy; locking from Dashboard checkpoints catalog name/base revision, unlock returns to counting, explicit resume retains original revision and detects newer server baseline')
    shot(page, 'inventory-catalog-recovery')
    assert_no_credentials(page)
    ctx.close()

    # Import APIs use a different error class and may return 403 rather than 401.
    ctx, page, mode = workspace()
    visit(page, '/internal/bookkeeping'); unlock(page)
    go(page, 'reports')
    visible(page, '#sc-location').select_option(index=2)
    visible(page, '#sc-date').fill(DATE)
    mode['import_auth'] = True
    visible(page, '[data-history="load"]').click()
    expect(page.locator('[data-shell-lock]')).to_be_disabled()
    go(page, 'cash')
    expect(visible(page, '#cashout-code')).to_have_count(1)
    mode['import_auth'] = False; unlock(page)
    go(page, 'reports')
    expect(visible(page, '#sc-date')).to_have_value(DATE)
    expect(visible(page, '[data-history="load"]')).to_be_enabled()
    record('import forbidden expiry', 'A 403 import-history response clears shared access through the import error adapter while retaining selected store/date; a new verified unlock restores access without an automatic write')
    ctx.close()

    # Same-code reauthentication must still invalidate an old response generation.
    ctx, page, mode = workspace()
    visit(page, '/internal/bookkeeping'); unlock(page); start_cash(page)
    mode['cash_write'] = 'hold'
    visible(page, '#cashout-save').click()
    page.wait_for_timeout(100)
    assert len(mode['held']) == 1
    mode['inventory_auth'] = True
    go(page, 'inventory')
    expect(visible(page, '#cashout-code')).to_have_count(1)
    mode['inventory_auth'] = False
    unlock(page)
    go(page, 'cash')
    held, cors = mode['held'].pop()
    held.fulfill(status=200, json={'ok': True}, headers=cors)
    page.wait_for_timeout(200)
    expect(visible(page, '#am-0-name')).to_have_value('Session synthetic cashier')
    assert visible(page, '[data-save-state]').get_attribute('data-save-state') != 'server'
    expect(page.locator('[data-shell-lock]')).to_be_enabled()
    assert mode['put_count'] == 1
    record('late response generation', 'A held cash write acknowledged after another tool expires access and the same code reauthenticates cannot mark the current draft server-saved, revoke the new session or replay the write')
    ctx.close()

    # Existing station gates remain independent from an internal manager unlock.
    ctx, page, mode = workspace()
    visit(page, '/internal/bookkeeping'); unlock(page)
    go(page, 'dashboard')
    nav(page, 'schedule').click()
    expect(page.locator('#demo-gate-code')).to_be_visible()
    assert page.locator('[data-internal-shell]').count() == 0
    record('scheduler boundary', 'Internal shared unlock does not grant the separate scheduler gate; public/crew permission adapters remain independent')
    browser_version = browser.version
    ctx.close(); browser.close()

assert not errors, errors
assert not external, external
sources = [*ROOT.glob('src/components/internal/*.tsx'), *ROOT.glob('src/components/internal/*.ts'), *ROOT.glob('src/lib/internal-tools/*session*'), *ROOT.glob('src/lib/internal-tools/work-transitions*'), *ROOT.glob('src/lib/internal-tools/i18n/*.ts'), *ROOT.glob('src/app/(order-shell)/internal/**/*.tsx'), ROOT / 'src/lib/cashout-store.ts', Path(__file__).resolve()]
manifest = {'baseCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
            'sourceFilesSha256': {str(file.relative_to(ROOT)): hashlib.sha256(file.read_bytes()).hexdigest() for file in sources if file.is_file()},
            'browser': browser_version, 'frontend': args.base + args.prefix, 'api': 'http://127.0.0.1:8787 (intercepted)',
            'scenarios': results, 'screenshots': images, 'pageErrors': errors, 'externalAttempts': external,
            'apiRequests': requests,
            'limits': ['Synthetic service responses; no live persistence/activation claim', 'Headless touch is not physical touch/software keyboard evidence', 'Passive REA attach is separate from Playwright action assertions']}
(args.artifacts / 'results.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'PASS Step 04: {len(results)} scenarios; {len(images)} screenshots; 0 page errors/external attempts; synthetic loopback APIs only')
