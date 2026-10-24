"""UX-04 browser checks. Requires a local server with the loopback API override.
Reduced VisualViewport coverage simulates keyboard occlusion; it is not a native OS keyboard test.
"""
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3027'
assert urlparse(base).hostname in ('127.0.0.1', 'localhost')
TOKEN = 'synthetic-entry-token'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 768, 'height': 1024}, has_touch=True)
    errors, writes = [], []
    def api(route):
        headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,PUT,OPTIONS'}
        request = route.request
        if request.method == 'OPTIONS': route.fulfill(status=204, headers=headers)
        elif request.headers.get('authorization') != 'Bearer ' + TOKEN: route.fulfill(status=401, json={'error':'unauthorized'}, headers=headers)
        elif request.method == 'PUT': writes.append(request.post_data_json); route.fulfill(status=200, json={'ok':True}, headers=headers)
        elif '/api/auth/verify' in request.url: route.fulfill(status=200, json={'ok':True}, headers=headers)
        else: route.fulfill(status=200, json={'days':[]}, headers=headers)
    context.route('http://127.0.0.1:8787/**', api)
    def remote(route): errors.append('Unexpected production request: ' + route.request.url); route.abort()
    context.route('https://*.workers.dev/**', remote)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/internal/bookkeeping/'); page.wait_for_load_state('networkidle')
    page.locator('#cashout-code').fill(TOKEN)
    page.get_by_role('button', name='Unlock', exact=True).click()
    page.locator('#cashout-date').fill('2026-10-24')
    page.locator('#draft-preparer').fill('Keyboard fixture')
    page.get_by_role('button', name='Start new draft', exact=True).click()
    name = page.get_by_label('Cashier name', exact=True).first
    name.fill('Keyboard cashier')
    name.press('Enter'); expect(page.locator('#am-0-10000')).to_be_focused()
    page.locator('#am-0-10000').fill('2')
    page.keyboard.press('Tab'); expect(page.locator('#am-0-5000')).to_be_focused()
    page.keyboard.press('Shift+Tab'); expect(page.locator('#am-0-10000')).to_be_focused()
    page.keyboard.press('Enter'); expect(page.locator('#am-0-5000')).to_be_focused()
    page.keyboard.press('Shift+Enter'); expect(page.locator('#am-0-10000')).to_be_focused()
    page.locator('#z-report').focus(); page.keyboard.press('Enter')
    expect(page.locator('#cashout-save')).to_be_focused()
    assert not writes, 'Entry must not submit a cash-out'
    page.get_by_role('button', name='Clear sheet', exact=True).click()
    expect(page.get_by_role('dialog')).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.get_by_role('button', name='Clear sheet', exact=True)).to_be_focused()
    expect(name).to_have_value('Keyboard cashier')
    # Roving tabs support direct tap/select as well as arrows, Home, End, and native Tab.
    page.get_by_role('tab', name='Cash out', exact=True).focus()
    page.keyboard.press('ArrowRight')
    expect(page.get_by_role('tab', name='Daily sales report', exact=True)).to_be_focused()
    page.locator('#sc-first').fill('Retained tab input')
    page.get_by_role('tab', name='Daily sales report', exact=True).focus()
    page.keyboard.press('End'); expect(page.get_by_role('tab', name='Employee hours', exact=True)).to_be_focused()
    page.keyboard.press('Home'); expect(page.get_by_role('tab', name='Cash out', exact=True)).to_be_focused()
    expect(name).to_have_value('Keyboard cashier')
    page.get_by_role('tab', name='Daily sales report', exact=True).tap()
    expect(page.locator('#sc-first')).to_have_value('Retained tab input')
    page.get_by_role('tab', name='Cash out', exact=True).tap()
    # Both languages retain entry values and focus when moving through fields.
    page.get_by_role('button', name='Español', exact=True).tap()
    page.locator('#am-0-10000').focus(); page.keyboard.press('Enter')
    expect(page.locator('#am-0-5000')).to_be_focused()
    expect(page.locator('[data-entry-summary]')).to_contain_text('Intro nunca guarda')
    expect(page.locator('#am-0-10000')).to_have_value('2')
    # Small tablet visual viewport with an offset, like a panned native keyboard.
    page.evaluate('''() => {
      const viewport = new EventTarget(); viewport.height = 430; viewport.offsetTop = 24;
      Object.defineProperty(window, 'visualViewport', {configurable: true, value: viewport});
      window.visualViewport.dispatchEvent(new Event('resize'));
    }''')
    page.locator('#pm-0-1').focus()
    page.wait_for_function('''() => {
      const box = document.activeElement.getBoundingClientRect();
      const summary = document.querySelector('[data-entry-summary]').getBoundingClientRect();
      const banner = document.querySelector('[data-internal-banner]').getBoundingClientRect();
      return box.top >= 24 + summary.height + banner.height + 16 && box.bottom <= 430 && summary.top >= banner.bottom;
    }''')
    # Frequent controls and count fields have 44px touch targets. No drag gesture is required.
    assert page.locator('#pm-0-1').bounding_box()['height'] >= 44
    for locator in [page.get_by_role('button', name='+ Agregar cajero', exact=True).first,
                    page.get_by_role('button', name='Eliminar cajero', exact=True).first,
                    page.get_by_role('tab', name='Cierre de caja', exact=True)]:
        assert locator.bounding_box()['height'] >= 44
    page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('#am-0-10000').focus()
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal page overflow'
    page.screenshot(path='/tmp/ux-04-phone.png', full_page=True)
    # New interaction furniture is omitted from the familiar print layout.
    page.emulate_media(media='print')
    expect(page.locator('[data-entry-summary]')).not_to_be_visible()
    expect(page.locator('#am-0-10000')).to_have_value('2')
    page.emulate_media(media='screen')
    assert not errors, '\n'.join(errors)
    browser.close()
    print('PASS UX-04: Enter/Tab/reverse entry, no implicit save, Escape focus, roving/touch tabs, mounted inputs, EN/ES, 44px targets, keyboard-sized VisualViewport, phone overflow and print exclusion')
