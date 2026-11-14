"""Step06 focused cash acceptance with independent money expectations.
Use an explicit loopback API build; all service responses are synthetic.
Physical touch/software keyboard and full accessibility are separate review gates.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('base')
parser.add_argument('--prefix', default='')
parser.add_argument('--artifacts', type=Path, default=Path('/tmp/cr-focused-cash'))
parser.add_argument('--rea', action='store_true')
args = parser.parse_args()
assert urlsplit(args.base).hostname == '127.0.0.1'
ROOT = Path(__file__).resolve().parent.parent
args.artifacts.mkdir(parents=True, exist_ok=True)
TOKEN = 'synthetic-step06-manager'
DATE = '2026-11-13'
# The full denomination contract is intentionally literal, independent of app helpers.
DENOMS = [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 1]
results, screenshots, errors, external, requests = [], [], [], [], []


def record(name, observed):
    results.append({'scenario': name, 'observed': observed})
    print('PASS scenario: ' + name, flush=True)
def visible(page, selector): return page.locator(selector + ':visible')
def card(page, drawer): return page.locator('[data-cashier-card="' + drawer + '"]')
def active_card(page): return visible(page, '[data-cashier-card]')
def drawer_button(page, drawer): return page.locator('[data-drawer-select="' + drawer + '"]')
def select_drawer(page, drawer, keyboard=False):
    target = drawer_button(page, drawer)
    if keyboard: target.focus(); page.keyboard.press('Enter')
    else: target.click()
    expect(card(page, drawer)).to_be_visible()
    expect(visible(page, '[data-cashier-card]')).to_have_count(1)
def shot(page, name):
    page.evaluate('window.scrollTo(0,0)'); page.wait_for_timeout(100)
    path = args.artifacts / (name + '.png')
    page.screenshot(path=str(path), full_page=True)
    screenshots.append({'file': path.name, 'viewport': page.viewport_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
def accept(page):
    expect(page.get_by_role('dialog')).to_be_visible()
    page.get_by_role('dialog').get_by_role('button').last.click()
def row_value(scope, label, value):
    # Existing cash Row consists of label and value siblings.
    row = scope.get_by_text(label, exact=True).last.locator('..')
    expect(row).to_contain_text(value)
def assert_single_line_money(page):
    broken = page.evaluate('''() => [...document.querySelectorAll('[data-cash-money], [data-cashier-card] td label')]
      .filter(e => e.getClientRects().length > 0).flatMap(e => {
        const range = document.createRange(); range.selectNodeContents(e);
        const lines = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
        return new Set(lines.map(r => Math.round(r.top))).size > 1 ? [e.textContent] : [];
      })''')
    assert not broken, broken
def unlock(page):
    page.wait_for_load_state('networkidle')
    visible(page, '#cashout-code').fill(TOKEN)
    page.get_by_role('button', name='Unlock', exact=True).click()
    expect(visible(page, '#cashout-code')).to_have_count(0)
def choose(page, preparer):
    visible(page, '#cashout-store').select_option('CR2')
    visible(page, '#cashout-date').fill(DATE)
    visible(page, '#draft-preparer').fill(preparer)
    page.get_by_role('button', name='Start new draft', exact=True).click()
    expect(visible(page, '#am-0-name')).to_be_visible()
def set_counts(page, drawer, values):
    select_drawer(page, drawer)
    for denomination, value in zip(DENOMS, values): visible(page, '#' + drawer + '-' + str(denomination)).fill(str(value))
def open_controls(page, text):
    target = page.get_by_text(text, exact=True)
    if target.is_visible(): return
    for summary in page.locator('#cashout-editor summary').all():
        if summary.is_visible() and not summary.locator('..').evaluate('e => e.open'):
            summary.click()
            if target.is_visible(): return
    expect(target).to_be_visible()
def deny_storage(page):
    page.evaluate('''() => { window.focusedOriginalSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function() { throw new DOMException('Synthetic quota', 'QuotaExceededError') } }''')
def restore_storage(page): page.evaluate('() => { Storage.prototype.setItem = window.focusedOriginalSet }')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--remote-debugging-port=9338'] if args.rea else [])
    def browser_workspace(width=1440, touch=False):
        ctx = browser.new_context(viewport={'width': width, 'height': 1000}, has_touch=touch, service_workers='block')
        mode = {'write': 'success', 'writes': [], 'doc': None, 'held': []}
        def route(r):
            req, u = r.request, urlsplit(r.request.url)
            origin = f'{u.scheme}://{u.netloc}'
            if origin == args.base:
                r.continue_(); return
            if origin != 'http://127.0.0.1:8787':
                external.append(req.url); r.abort(); return
            requests.append({'method': req.method, 'path': u.path})
            cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,PUT,OPTIONS'}
            if req.method == 'OPTIONS': r.fulfill(status=204, headers=cors); return
            assert req.headers.get('authorization') == 'Bearer ' + TOKEN
            status, body = 200, {}
            if u.path == '/api/auth/verify': body = {'ok': True}
            elif u.path.startswith('/api/cashout/'):
                if req.method == 'PUT':
                    mode['writes'].append(req.post_data_json)
                    if mode['write'] == 'offline': r.abort('failed'); return
                    if mode['write'] == 'auth': status, body = 401, {'error': 'unauthorized'}
                    elif mode['write'] == 'hold': mode['held'].append((r, cors)); return
                    else:
                        mode['doc'] = {**req.post_data_json, 'store': 'CR2', 'date': DATE, 'updatedAt': '2026-11-13T20:00:00.000Z'}
                        body = {'ok': True, 'extraMoney': req.post_data_json['sheet'].get('extraMoney', '')}
                elif u.path.count('/') == 4: status, body = (401, {}) if mode['write'] == 'auth' else (200, mode['doc']) if mode['doc'] else (404, {'error': 'not_found'})
                else: body = {'days': []}
            elif u.path == '/api/writeups': body = {'writeUps': []}
            elif u.path == '/api/forms': body = {'forms': []}
            elif u.path == '/api/inventory/CR3/list': body = {'rev': 0, 'sheets': None}
            elif u.path == '/api/inventory/CR3': body = {'days': []}
            else: raise AssertionError('Unexpected endpoint: ' + req.method + ' ' + req.url)
            r.fulfill(status=status, json=body, headers=cors)
        ctx.route('**/*', route)
        page = ctx.new_page(); page.on('pageerror', lambda error: errors.append(str(error)))
        return ctx, page, mode
    def visit(page):
        response = page.goto(args.base + args.prefix + '/internal/bookkeeping#cash-out')
        assert response is None or response.status == 200
        expect(page.locator('[data-shell-ready=true]')).to_be_visible()
        page.wait_for_load_state('networkidle')
    def request_save(page, mode):
        visible(page, '#cashout-save').click()
        if mode['doc'] and mode['write'] != 'auth':
            expect(visible(page,'[data-cash-comparison]')).to_be_visible()
            page.get_by_role('button', name='Review replacement', exact=True).click()
            accept(page)
    def save(page, mode):
        request_save(page, mode)
        expect(visible(page, '[data-save-state]')).to_have_attribute('data-save-state', 'server')
        return mode['writes'][-1]

    ctx, page, mode = browser_workspace()
    visit(page); unlock(page); choose(page, 'Focused denomination fixture')
    expect(active_card(page)).to_have_count(1)
    expect(card(page, 'pm-0')).not_to_be_visible()
    assert card(page, 'pm-0').count() == 1, 'Inactive drawer must stay mounted'
    expect(page.get_by_role('button', name='Print', exact=True)).not_to_be_visible()
    expect(page.get_by_role('button', name='Clear sheet', exact=True)).not_to_be_visible()
    for selector in ('[data-cash-context]', '[data-cash-tools]'):
        assert not page.locator(selector).evaluate('e => e.open'), selector
    shot(page, 'focused-blank-desktop')
    visible(page, '#am-0-name').fill('Focused AM cashier')
    visible(page, '#am-0-name').press('Enter')
    expect(visible(page, '#am-0-10000')).to_be_focused()
    visible(page, '#am-0-10000').fill('0')
    expect(card(page, 'am-0')).to_contain_text('1 of 11 denomination counts entered')
    visible(page, '#am-0-10000').fill('')
    expect(card(page, 'am-0')).to_contain_text('0 of 11 denomination counts entered')
    expect(visible(page, '#am-0-toast')).to_have_value('')
    row_value(card(page, 'am-0'), 'Over / short', '—')
    visible(page, '#am-0-toast').fill('0')
    row_value(card(page, 'am-0'), 'Over / short', '-$100.00')
    visible(page, '#am-0-toast').fill('')
    record('focused blank and explicit zero', 'One AM drawer visible while PM remains mounted; zero denomination changes progress and blank restores untouched state; blank Toast is unavailable while entered zero produces real negative comparison; secondary controls start collapsed')

    # Exercise every denomination through both synchronized entry alternatives.
    for denomination in DENOMS:
        visible(page, '#am-0-' + str(denomination)).fill('2')
        expect(visible(page, '#am-0-' + str(denomination) + '-amount')).to_have_value(f'{denomination * 2 / 100:.2f}')
        visible(page, '#am-0-' + str(denomination) + '-amount').fill(f'{denomination / 100:.2f}')
        expect(visible(page, '#am-0-' + str(denomination))).to_have_value('1')
    row_value(card(page, 'am-0'), 'Drawer total', '$186.91')
    row_value(card(page, 'am-0'), 'Turn-in (− $100.00)', '$86.91')
    expect(card(page, 'am-0')).to_contain_text('11 of 11 denomination counts entered')
    visible(page, '#am-0-2000-amount').fill('10')
    expect(visible(page, '#am-0-2000-amount')).to_have_attribute('aria-invalid', 'true')
    select_drawer(page, 'pm-0')
    visible(page, '#cashout-save').click()
    expect(card(page, 'am-0')).to_be_visible()
    expect(visible(page, '#am-0-2000-amount')).to_be_focused()
    assert not mode['writes']
    visible(page, '#am-0-2000-amount').fill('20.00')
    visible(page, '#am-0-10000').fill('1e3')
    select_drawer(page, 'pm-0'); visible(page, '#cashout-save').click()
    expect(visible(page, '#am-0-10000')).to_be_focused()
    expect(visible(page, '#am-0-10000')).to_have_value('1e3')
    assert not mode['writes']
    visible(page, '#am-0-10000').fill('1')
    record('full denomination and correction coverage', 'All eleven Count/Amount alternatives synchronize exact values; one of each totals $186.91/$86.91 turn-in; invalid scientific count and nonmultiple $20 amount stay editable and Save reveals/focuses the invalid inactive drawer without a request')

    set_counts(page, 'am-0', [3] + [0] * 10)
    visible(page, '#am-0-toast').fill('200')
    row_value(card(page, 'am-0'), 'Drawer total', '$300.00')
    row_value(card(page, 'am-0'), 'Turn-in (− $100.00)', '$200.00')
    set_counts(page, 'pm-0', [3] + [0] * 10)
    visible(page, '#pm-0-name').fill('Focused PM cashier'); visible(page, '#pm-0-toast').fill('200')
    expect(page.locator('[data-entry-summary]')).to_contain_text('$400.00')
    visible(page, '#z-report').fill('0')
    visible(page, '#extra-money').fill('1.005')
    visible(page, '#cashout-save').click()
    expect(visible(page, '#extra-money')).to_be_focused()
    expect(visible(page, '#extra-money')).to_have_attribute('aria-invalid', 'true')
    assert not mode['writes']
    visible(page, '#extra-money').fill('20.00')
    payload = save(page, mode)
    expected = {'amDeposit': 20000, 'pmDeposit': 20000, 'amOverShort': 0, 'pmOverShort': 0, 'deposit': 42000, 'overShort': 0, 'zOverShort': 42000}
    assert payload['totals'] == expected, payload
    assert payload['sheet']['am'][0]['counts'] == [3] + [0] * 10
    assert 'countInputs' not in json.dumps(payload) and 'amountInputs' not in json.dumps(payload)
    visible(page, '#z-report').fill(''); payload = save(page, mode)
    assert payload['totals']['zOverShort'] is None
    record('independent two-drawer and Extra money arithmetic', 'Each $300 drawer keeps its own $100 and turns in $200; two give $400; $20 Extra money raises only day/Z to $420 while drawer/shift Toast comparisons stay zero; blank Z differs from real zero; wire model has no device entry metadata')
    shot(page, 'focused-two-drawers-desktop')

    # Drawer selector is a real keyboard control; added and removed drawers retain exact identity.
    select_drawer(page, 'am-0', keyboard=True)
    drawer_button(page, 'am-0').focus(); page.keyboard.press('ArrowRight')
    expect(card(page, 'pm-0')).to_be_visible()
    page.keyboard.press('Home'); expect(card(page, 'am-0')).to_be_visible()
    visible(page, '#am-add-cashier').click()
    expect(visible(page, '#am-1-name')).to_be_focused()
    visible(page, '#am-1-name').fill('Disposable added cashier')
    card(page, 'am-1').get_by_role('button', name='Remove cashier', exact=True).click(); accept(page)
    expect(card(page, 'am-1')).to_have_count(0)
    select_drawer(page, 'pm-0')
    card(page, 'pm-0').get_by_role('button', name='Remove cashier', exact=True).click(); accept(page)
    select_drawer(page, 'am-0')
    visible(page, '#extra-money').fill('')
    payload = save(page, mode)
    assert payload['totals']['deposit'] == 20000
    set_counts(page, 'am-0', [0, 1] + [0] * 9)
    payload = save(page, mode)
    assert payload['totals']['deposit'] == -5000 and payload['totals']['amDeposit'] == -5000
    row_value(card(page, 'am-0'), 'Turn-in (− $100.00)', '-$50.00')
    record('drawer lifecycle and negative turn-in', 'Keyboard selector, added drawer focus/removal and removal of last PM preserve remaining values; one $300 drawer gives $200; reducing it to $50 preserves negative $50 turn-in in UI and service payload')

    # Optional keypad edits selected denomination and skips across mounted hidden drawers.
    visible(page, '#pm-add-cashier').click()
    expect(visible(page, '#pm-0-name')).to_be_focused()
    visible(page, '#pm-0-name').fill('Printed PM retained drawer')
    select_drawer(page, 'am-0'); visible(page, '#am-0-1').focus()
    page.get_by_role('button', name='Count keypad', exact=True).click()
    keypad = page.get_by_role('group', name='Count keypad', exact=True)
    keypad.get_by_role('button', name='Next count', exact=True).click()
    expect(card(page, 'pm-0')).to_be_visible()
    keypad.get_by_role('button', name='3', exact=True).click()
    expect(page.locator('#pm-0-10000')).to_have_value('3')
    page.keyboard.press('Escape')
    expect(visible(page, '#pm-0-10000')).to_be_focused()
    visible(page, '#pm-0-name').press('Enter')
    expect(visible(page, '#pm-0-10000')).to_be_focused()
    visible(page, '#pm-0-10000').press('Enter')
    expect(visible(page, '#pm-0-10000-amount')).to_be_focused()
    visible(page, '#pm-0-10000-amount').press('Enter')
    expect(visible(page, '#pm-0-5000')).to_be_focused()
    assert len(mode['writes']) == 4, 'Entry navigation must not auto-save'
    record('keyboard and keypad continuity', 'Native Enter moves through visible name/Count/Amount inputs without submitting; optional keypad Next crosses AM→PM, selects the corresponding drawer and Escape returns exact field focus')

    # Failed device storage and authorization do not erase current focused work.
    deny_storage(page)
    visible(page, '#pm-0-name').fill('Retained through denied storage and expiry')
    mode['write'] = 'auth'; visible(page, '#cashout-save').click()
    expect(visible(page, '#cashout-code')).to_have_count(1)
    expect(visible(page, '[data-cashier-card]')).to_have_count(0)
    mode['write'] = 'success'; unlock(page)
    select_drawer(page, 'pm-0')
    expect(visible(page, '#pm-0-name')).to_have_value('Retained through denied storage and expiry')
    restore_storage(page)
    mode['write'] = 'offline'; request_save(page, mode)
    expect(visible(page, '[data-save-state]')).to_have_attribute('data-save-state', 'waiting')
    expect(visible(page, '#pm-0-10000')).to_have_value('3')
    mode['write'] = 'success'; save(page, mode)
    record('offline authorization and failed storage recovery', 'Forced 401 hides protected focused workspace despite denied storage; unlock restores same drawer, name and count; offline save retains input and explicit retry succeeds')

    # Print includes every drawer, even when only one drawer is visible on screen.
    page.get_by_role('button', name='Español', exact=True).click()
    expect(visible(page, '#pm-0-name')).to_have_value('Retained through denied storage and expiry')
    page.evaluate('window.dispatchEvent(new Event("beforeprint"))'); page.emulate_media(media='print')
    pdf = args.artifacts / 'all-drawers-print.pdf'; page.pdf(path=str(pdf), format='Letter', print_background=True)
    printed = '\n'.join(item.extract_text() or '' for item in PdfReader(pdf).pages)
    if 'Focused AM cashier' not in printed:
        print('PRINT DIAGNOSTIC ' + json.dumps(card(page, 'am-0').evaluate('''e => {let a=e,chain=[];while(a){chain.push({tag:a.tagName,id:a.id,cls:a.className,hidden:a.hidden,display:getComputedStyle(a).display,visibility:getComputedStyle(a).visibility,rect:a.getBoundingClientRect().toJSON()});a=a.parentElement}return {value:e.querySelector('input').value,chain}}''')), flush=True)
    for value in ['Focused AM cashier', 'Retained through denied storage and expiry', 'AM shift', 'PM shift', '300.00']:
        assert value in printed, value
    assert 'Count keypad' not in printed and 'Save drafts' not in printed
    page.emulate_media(media='screen'); page.evaluate('window.dispatchEvent(new Event("afterprint"))')
    expect(visible(page, '[data-cashier-card]')).to_have_count(1)
    record('English paper from Spanish focused UI', 'Spanish language switch preserves active drawer; printed paper retains all AM/PM drawer names, full denominations and money while focused controls/shell/keypad stay off paper')
    assert TOKEN not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})')
    ctx.close()

    # A late save acknowledges its original snapshot, not a newer count edit.
    ctx, page, mode = browser_workspace()
    visit(page); unlock(page); choose(page, 'Focused late response fixture')
    visible(page, '#am-0-name').fill('Late response retained cashier')
    visible(page, '#am-0-10000').fill('3')
    mode['write'] = 'hold'; request_save(page, mode)
    page.wait_for_timeout(100); assert len(mode['held']) == 1
    visible(page, '#am-0-10000').fill('4')
    select_drawer(page, 'pm-0')
    route, cors = mode['held'].pop()
    route.fulfill(status=200, json={'ok': True}, headers=cors)
    page.wait_for_timeout(200)
    select_drawer(page, 'am-0')
    expect(visible(page, '#am-0-10000')).to_have_value('4')
    assert visible(page, '[data-save-state]').get_attribute('data-save-state') != 'server'
    assert mode['writes'][0]['sheet']['am'][0]['counts'][0] == 3
    record('late save and drawer switch', 'A delayed save retains its submitted three-count snapshot while a later four-count edit and drawer switch survive; current work is not mislabeled server-saved')
    ctx.close()

    # Reload requires explicit authentication and labelled resume, preserving raw entry semantics.
    ctx, page, mode = browser_workspace(375, True)
    visit(page); unlock(page); choose(page, 'Focused reload fixture')
    visible(page, '#am-0-name').fill('Reload raw focused cashier')
    visible(page, '#am-0-10000').fill('0'); visible(page, '#am-0-5000-amount').fill('100.00')
    page.once('dialog', lambda dialog: dialog.accept()); page.reload(); page.wait_for_load_state('networkidle')
    unlock(page)
    visible(page, '#cashout-store').select_option('CR2'); visible(page, '#cashout-date').fill(DATE)
    visible(page, '#draft-preparer').fill('Focused resumed copy')
    page.locator('li').filter(has=page.get_by_text('Preparer: Focused reload fixture', exact=True)).get_by_role('button', name='Resume as a copy', exact=True).click()
    expect(visible(page, '#am-0-name')).to_have_value('Reload raw focused cashier')
    expect(visible(page, '#am-0-10000')).to_have_value('0')
    expect(visible(page, '#am-0-5000')).to_have_value('2')
    expect(visible(page, '#am-0-2000')).to_have_value('')
    record('reload and explicit resume', 'Reload clears memory access; explicit labelled resume restores name, actual zero count, Amount-derived count two and still-blank denominations without treating remembered preparer as authentication')
    page.get_by_role('button', name='Español', exact=True).click()
    for width in (768, 375, 320):
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        assert_single_line_money(page)
    shot(page, 'focused-spanish-phone')
    page.add_style_tag(content='html {font-size:200% !important}')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert_single_line_money(page)
    shot(page, 'focused-spanish-enlarged')
    page.add_style_tag(content='html {font-size:100% !important}')
    page.set_viewport_size({'width': 768, 'height': 430})
    visible(page, '#am-0-5000').focus()
    page.get_by_role('button', name='Teclado de conteo', exact=True).click()
    keypad = page.get_by_role('group', name='Teclado de conteo', exact=True)
    keypad.get_by_role('button', name='Cerrar teclado', exact=True).scroll_into_view_if_needed()
    expect(keypad.get_by_role('button', name='Cerrar teclado', exact=True)).to_be_visible()
    for button in keypad.get_by_role('button').all(): assert button.bounding_box()['height'] >= 44
    shot(page, 'focused-spanish-keypad-short-viewport')
    keypad.get_by_role('button', name='Cerrar teclado', exact=True).click()
    expect(visible(page, '#am-0-5000')).to_be_focused()
    page.set_viewport_size({'width': 768, 'height': 900})
    page.evaluate('''() => {
      const viewport = new EventTarget(); viewport.height = 430; viewport.offsetTop = 24;
      Object.defineProperty(window, 'visualViewport', {configurable: true, value: viewport});
      window.dispatchEvent(new Event('resize'));
    }''')
    visible(page, '#am-0-1').focus()
    page.wait_for_function('''() => {
      const field = document.querySelector('#am-0-1').getBoundingClientRect();
      const summary = document.querySelector('[data-entry-summary]').getBoundingClientRect();
      const banner = document.querySelector('[data-internal-banner]');
      const obstruction = getComputedStyle(banner).position === 'sticky' ? banner.offsetHeight : 0;
      return summary.height <= 216 && field.top >= 24 + summary.height + obstruction + 16 && field.bottom <= 430;
    }''')
    visible(page, '#cashout-save').scroll_into_view_if_needed()
    save_box = visible(page, '#cashout-save').bounding_box()
    assert save_box['y'] >= 0 and save_box['y'] + save_box['height'] <= 430
    shot(page, 'focused-reduced-visual-viewport')
    page.emulate_media(reduced_motion='reduce')
    assert page.locator('[data-shell-chrome] [data-nav-surface]').evaluate('e=>getComputedStyle(e).transitionDuration') == '0s'
    record('responsive language and short viewport', 'English/Spanish focused workspace retains entry at 768/375/320px and 200% text; keypad buttons meet 44px, Close/Save remain reachable and a panned keyboard-sized VisualViewport leaves space for the focused count below the half-height summary; reduced motion removes shell slide')
    if args.rea:
        from urllib.request import urlopen
        with urlopen('http://127.0.0.1:9338/json/list') as response: targets = json.load(response)
        target = next(item['id'] for item in targets if item.get('url') == page.url)
        subprocess.run(['rea-project', 'run', '--project', str(ROOT), '--', 'inspect-web-page', 'http://127.0.0.1:9338', target, '--include-accessibility-text', '--include-storage-keys', '--json'], cwd=ROOT, check=True)
    browser_version = browser.version; ctx.close(); browser.close()

assert not errors, errors
assert not external, external
sources = [*ROOT.glob('src/components/internal/*.tsx'), *ROOT.glob('src/components/internal/*.css'),
           ROOT / 'src/lib/cashout.ts', ROOT / 'src/lib/internal-tools/cashout-draft.ts',
           ROOT / 'src/lib/internal-tools/i18n/en.ts', ROOT / 'src/lib/internal-tools/i18n/es.ts', Path(__file__).resolve()]
manifest = {'baseCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
            'sourceFilesSha256': {str(file.relative_to(ROOT)): hashlib.sha256(file.read_bytes()).hexdigest() for file in sources if file.is_file()},
            'browser': browser_version, 'frontend': args.base + args.prefix, 'api': 'http://127.0.0.1:8787 (intercepted)',
            'scenarios': results, 'screenshots': screenshots, 'pageErrors': errors, 'externalAttempts': external, 'apiRequests': requests,
            'limits': ['Synthetic local API responses, not production persistence/activation', 'Physical touch/software keyboard and full accessibility unverified', 'Emulated short viewport is not a native keyboard observation', 'Passive REA attach does not replay prior Playwright actions']}
(args.artifacts / 'results.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'PASS Step06: {len(results)} scenarios; {len(screenshots)} screenshots; 0 browser errors/external attempts; synthetic loopback APIs only')
