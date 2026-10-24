"""CASH-02: guided counts, local entry status, keypad, parity, print and recovery.
Uses synthetic loopback responses only. Requires local Next with the loopback API override.
"""
import json
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3027'
assert urlparse(base).hostname in ('127.0.0.1', 'localhost')
TOKEN = 'synthetic-guided-count-token'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':768, 'height':1024}, has_touch=True)
    errors, writes = [], []
    mode = {'offline': False}
    saved = {'sheet': None}
    def api(route):
        headers = {'access-control-allow-origin':'*', 'access-control-allow-headers':'Authorization,Content-Type', 'access-control-allow-methods':'GET,PUT,OPTIONS'}
        request = route.request
        path = urlparse(request.url).path
        if request.method == 'OPTIONS': route.fulfill(status=204, headers=headers)
        elif request.headers.get('authorization') != 'Bearer '+TOKEN: route.fulfill(status=401, json={'error':'unauthorized'}, headers=headers)
        elif '/api/auth/verify' in path: route.fulfill(status=200, json={'ok':True}, headers=headers)
        elif request.method == 'PUT':
            if mode['offline']: route.abort(); return
            writes.append(request.post_data_json)
            saved['sheet'] = request.post_data_json['sheet']
            route.fulfill(status=200, json={'updatedAt':'2026-10-24T20:00:00Z'}, headers=headers)
        elif path.count('/') == 4:
            route.fulfill(status=200 if saved['sheet'] else 404, json={'sheet':saved['sheet']} if saved['sheet'] else {'error':'not_found'}, headers=headers)
        else: route.fulfill(status=200, json={'days':[]}, headers=headers)
    context.route('http://127.0.0.1:8787/**', api)
    def remote(route): errors.append('Unexpected production request: '+route.request.url); route.abort()
    context.route('https://*.workers.dev/**', remote)
    page = context.new_page(); page.on('pageerror', lambda error: errors.append(str(error)))
    def unlock(target):
        target.locator('#cashout-code').fill(TOKEN)
        target.get_by_role('button', name='Unlock', exact=True).click()
        expect(target.locator('#draft-preparer')).to_be_visible()
    def choose(target, preparer):
        target.locator('#cashout-store').select_option('CR2')
        target.locator('#cashout-date').fill('2026-10-24')
        target.locator('#draft-preparer').fill(preparer)
    def row(target, preparer):
        return target.locator('li').filter(has=target.get_by_text('Preparer: '+preparer, exact=True))
    page.goto(base+'/internal/bookkeeping/'); page.wait_for_load_state('networkidle')
    unlock(page); choose(page, 'Guided fixture')
    page.get_by_role('button', name='Start new draft', exact=True).click()
    am = page.locator('[data-cashier-card="am-0"]')
    expect(page.locator('#am-0-10000')).to_have_value('')
    expect(page.locator('#am-0-5000')).to_have_value('')
    page.locator('#am-0-name').fill('Ana long cashier name for wrapped context')
    page.locator('#am-0-name').press('Enter')
    expect(page.locator('#am-0-10000')).to_be_focused()
    page.locator('#am-0-10000').fill('0')
    expect(page.locator('#am-0-10000')).to_have_value('0')
    expect(am).to_contain_text('1 of 11 denomination counts entered')
    page.locator('#am-0-10000').fill('')
    expect(am).to_contain_text('0 of 11 denomination counts entered')
    page.locator('#am-add-cashier').click()
    expect(page.locator('#am-1-name')).to_be_focused()
    expect(page.locator('#am-1-10000')).to_have_value('')
    page.locator('[data-cashier-card="am-1"]').get_by_role('button', name='Remove cashier', exact=True).click()
    page.get_by_role('dialog').get_by_role('button', name='Confirm', exact=True).click()
    expect(page.locator('#am-1-name')).not_to_be_visible()
    expect(page.locator('#am-add-cashier')).to_be_focused()
    page.locator('#am-0-10000').focus()
    # Optional inline keypad edits the selected field, retaining visible cashier/shift/total context.
    page.get_by_role('button', name='Count keypad', exact=True).tap()
    keypad = page.get_by_role('group', name='Count keypad', exact=True)
    expect(keypad).to_be_visible()
    expect(page.locator('[data-entry-summary]')).to_contain_text('AM · Ana long')
    keypad.get_by_role('button', name='0', exact=True).tap()
    expect(page.locator('#am-0-10000')).to_have_value('0')
    keypad.get_by_role('button', name='Next count', exact=True).tap()
    keypad.get_by_role('button', name='2', exact=True).tap()
    expect(page.locator('#am-0-5000')).to_have_value('2')
    expect(page.locator('[data-entry-summary]')).to_contain_text('$100.00')
    keypad.get_by_role('button', name='Delete digit', exact=True).tap()
    expect(page.locator('#am-0-5000')).to_have_value('')
    keypad.get_by_role('button', name='2', exact=True).tap()
    page.keyboard.press('Escape')
    expect(keypad).not_to_be_visible()
    expect(page.locator('#am-0-5000')).to_be_focused()
    # Raw invalid text must remain correctable; it is not truncated or sent to the server.
    page.locator('#am-0-10000').fill('1e3')
    expect(page.locator('#am-0-10000')).to_have_attribute('aria-invalid','true')
    page.get_by_role('button', name='Save day', exact=True).click()
    expect(page.locator('#am-0-10000')).to_be_focused()
    assert not writes
    expect(page.locator('#am-0-10000')).to_have_value('1e3')
    page.locator('#am-0-10000').fill('0')
    page.get_by_role('button', name='Choose another draft', exact=True).click()
    page.reload(); page.wait_for_load_state('networkidle'); unlock(page); choose(page, 'Reload fixture')
    row(page, 'Guided fixture').get_by_role('button', name='Resume as a copy', exact=True).click()
    expect(page.locator('#am-0-10000')).to_have_value('0')
    expect(page.locator('#am-0-5000')).to_have_value('2')
    expect(page.locator('#am-0-2000')).to_have_value('')
    # Independent resume preserves the original and does not overwrite the first editor's local status.
    second = context.new_page(); second.on('pageerror', lambda error: errors.append(str(error)))
    second.goto(base+'/internal/bookkeeping/'); second.wait_for_load_state('networkidle')
    unlock(second); choose(second, 'Independent fixture')
    row(second, 'Guided fixture').get_by_role('button', name='Resume as a copy', exact=True).click()
    second.locator('#am-0-10000').fill('9')
    expect(page.locator('#am-0-10000')).to_have_value('0')
    second.close()
    # EN/ES switching, touch keypad and small-screen wrapping retain values.
    page.get_by_role('button', name='Español', exact=True).tap()
    page.locator('#am-0-5000').tap()
    page.get_by_role('button', name='Teclado de conteo', exact=True).tap()
    spanish_keypad = page.get_by_role('group', name='Teclado de conteo', exact=True)
    expect(spanish_keypad).to_contain_text('Conteo de denominación de $50.00')
    page.set_viewport_size({'width':390, 'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    for button in spanish_keypad.get_by_role('button').all():
        assert button.bounding_box()['height'] >= 44
    page.screenshot(path='/tmp/cash-02-keypad-phone.png', full_page=True)
    # The expanded keypad scrolls internally in a short landscape viewport, keeping Close reachable.
    page.set_viewport_size({'width':768, 'height':430})
    page.wait_for_function('''() => {
      const summary = document.querySelector('[data-entry-summary]');
      return summary.getBoundingClientRect().height <= 430 - document.querySelector('[data-internal-banner]').offsetHeight - 16;
    }''')
    spanish_keypad.get_by_role('button', name='Cerrar teclado', exact=True).tap()
    expect(page.locator('#am-0-5000')).to_be_focused()
    expect(page.locator('#am-0-10000')).to_have_value('0')
    page.get_by_role('button', name='English', exact=True).tap()
    # Existing float, cents, AM/PM and Toast/Z examples must produce the same wire totals.
    page.set_viewport_size({'width':1280, 'height':900})
    page.locator('#am-0-10000').fill('3'); page.locator('#am-0-5000').fill('0')
    page.locator('#am-0-toast').fill('199.75')
    page.locator('#pm-0-name').fill('PM cashier')
    page.locator('#pm-0-5000').fill('2'); page.locator('#pm-0-toast').fill('0')
    page.locator('#z-report').fill('200')
    page.get_by_role('button', name='Save day', exact=True).click()
    expect(page.locator('[data-save-state]')).to_have_attribute('data-save-state','server')
    expected = {'amDeposit':20000,'pmDeposit':0,'amOverShort':25,'pmOverShort':0,'deposit':20000,'overShort':25,'zOverShort':0}
    assert writes[-1]['totals'] == expected, writes[-1]
    assert 'countInputs' not in json.dumps(writes[-1])
    assert writes[-1]['sheet']['am'][0]['counts'] == [3]+[0]*10
    # Existing sales converter receives the same saved-day amounts.
    page.get_by_role('tab', name='Daily sales report', exact=True).click()
    page.locator('#sc-date').fill('2026-10-24')
    page.locator('#sc-location').select_option('CHINA ROSE #2 - 2535 SW MILITARY DR')
    page.get_by_role('button', name='Fill from cash-out', exact=True).click()
    expect(page.locator('#sc-amDeposit')).to_have_value('200.00')
    expect(page.locator('#sc-amOverShort')).to_have_value('0.25')
    expect(page.locator('#sc-pmDeposit')).to_have_value('0.00')
    expect(page.locator('#sc-pmOverShort')).to_have_value('0.00')
    page.get_by_role('tab', name='Cash out', exact=True).click()
    # Print produces the familiar English AM/PM/count/Toast/Z paper output even from Spanish UI.
    page.get_by_role('button', name='Español', exact=True).click()
    page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
    page.emulate_media(media='print')
    expect(page.locator('[data-entry-summary]')).not_to_be_visible()
    page.pdf(path='/tmp/cash-02-output.pdf', format='Letter', print_background=True)
    text = '\n'.join(sheet.extract_text() for sheet in PdfReader('/tmp/cash-02-output.pdf').pages)
    for content in ['AM shift','PM shift','Toast cash payments','Z report expected cash','199.75','200.00','Ana long cashier','PM cashier']:
        assert content in text, 'Missing print content: '+content
    assert 'Count keypad' not in text and 'denomination counts entered' not in text
    page.emulate_media(media='screen'); page.evaluate("window.dispatchEvent(new Event('afterprint'))")
    expect(page.get_by_role('button', name='Teclado de conteo', exact=True)).to_be_visible()
    page.get_by_role('button', name='English', exact=True).click()
    # Loading server data preserves financial values without guessing device entry completeness.
    page.get_by_role('button', name='Load saved', exact=True).click()
    page.get_by_role('dialog').get_by_role('button', name='Confirm', exact=True).click()
    expect(am).to_contain_text('original entry status is unknown')
    expect(page.locator('#am-0-10000')).to_have_value('3')
    page.locator('#am-0-10000').fill('4')
    expect(am).to_contain_text('1 of 11 denomination counts entered')
    expect(am).to_contain_text('original entry status is unknown')
    mode['offline'] = True
    page.get_by_role('button', name='Save day', exact=True).click()
    expect(page.locator('[data-save-state]')).to_have_attribute('data-save-state','waiting')
    expect(page.locator('#am-0-10000')).to_have_value('4')
    mode['offline'] = False
    page.get_by_role('button', name='Save day', exact=True).click()
    expect(page.locator('[data-save-state]')).to_have_attribute('data-save-state','server')
    # Storage denial keeps raw count text visible and blocks destructive handoff.
    page.evaluate('() => { Storage.prototype.setItem=function(){throw new DOMException("denied","SecurityError")} }')
    page.locator('#am-0-10000').fill('2.5')
    expect(page.locator('[data-save-state]')).to_have_attribute('data-save-state','failed')
    page.get_by_role('button', name='Choose another draft', exact=True).click()
    expect(page.locator('#am-0-10000')).to_have_value('2.5')
    assert not errors, '\n'.join(errors)
    browser.close()
    print('PASS CASH-02: blank/zero/reload/independent editor, EN/ES touch keypad, invalid retention/save guard, unchanged cents/float/Toast/Z wire and sales linkage, English PDF output, legacy unknown status, offline retry and denied-storage recovery')
