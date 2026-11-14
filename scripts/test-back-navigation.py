"""Back navigation checks with synthetic API responses; no live service requests.

Build, serve out/ with scripts/overhaul-baseline/serve.py, then run this script.
"""
import argparse
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('base')
parser.add_argument('--artifacts', type=Path, default=Path('/tmp/cr-back-navigation'))
args = parser.parse_args()
assert urlsplit(args.base).hostname in ('127.0.0.1', 'localhost')
args.artifacts.mkdir(parents=True, exist_ok=True)
TOKEN = 'synthetic-back-navigation-manager'
errors = []


def back(page):
    return page.locator('[data-back-navigation] a')


def nav(page, destination):
    return page.locator(f'[data-shell-chrome] [data-nav-item="{destination}"]')


def ready(page):
    page.wait_for_load_state('networkidle')
    expect(back(page)).to_have_count(1)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    def context(width=1440, deny_storage=False):
        ctx = browser.new_context(viewport={'width': width, 'height': 1000}, service_workers='block')
        if deny_storage:
            ctx.add_init_script("Object.defineProperty(window, 'sessionStorage', {get() {throw new Error('Storage denied')}})")

        def route(r):
            request = r.request
            url = urlsplit(request.url)
            if url.path.startswith('/api/'):
                headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type',
                           'access-control-allow-methods': 'GET,OPTIONS'}
                if request.method == 'OPTIONS':
                    r.fulfill(status=204, headers=headers)
                    return
                assert request.method == 'GET', 'Navigation must not write server data'
                if not url.path.startswith('/api/schedule') and url.path != '/api/template':
                    assert request.headers.get('authorization') == 'Bearer ' + TOKEN
                status, body = 200, {}
                if url.path == '/api/auth/verify':
                    body = {'ok': True}
                elif url.path == '/api/inventory/CR3/list':
                    body = {'rev': 1, 'sheets': [{'id': 'fixture', 'title': 'Supplies', 'useLabel': 'Use', 'showSup': True,
                        'items': [{'id': 'item', 'name': 'Fixture rice', 'sup': 'L', 'use': '2', 'gray': False}]}]}
                elif url.path == '/api/inventory/CR3':
                    body = {'days': []}
                elif url.path.startswith('/api/cashout/'):
                    status, body = (404, {}) if url.path.count('/') == 4 else (200, {'days': []})
                elif url.path == '/api/writeups':
                    body = {'writeUps': []}
                elif url.path == '/api/forms':
                    body = {'forms': []}
                elif url.path == '/api/schedule':
                    body = {'weeks': [], 'rev': 0, 'notModified': False}
                elif url.path.startswith('/api/schedule/'):
                    status, body = 404, {'error': 'not_found'}
                elif url.path == '/api/template':
                    body = {'template': None, 'rev': 0, 'updatedAt': None}
                else:
                    raise AssertionError('Unexpected API: ' + request.url)
                r.fulfill(status=status, json=body, headers=headers)
            elif request.url.startswith(args.base + '/'):
                r.continue_()
            else:
                r.abort()

        ctx.route('**/*', route)
        page = ctx.new_page()
        page.set_default_timeout(10000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        return ctx, page

    for width in (1440, 390):
        ctx, page = context(width)
        page.goto(args.base + '/internal/inventory')
        ready(page)
        expect(back(page)).to_have_attribute('href', '/internal')
        page.get_by_label('Manager code', exact=True).fill(TOKEN)
        page.get_by_role('button', name='Unlock', exact=True).click()
        count = page.get_by_label('Fixture rice inventory', exact=True)
        count.fill('3')
        page.evaluate('window.navigationSentinel = "retained"')
        nav(page, 'cash').click()
        ready(page)
        expect(back(page)).to_have_attribute('href', args.base + '/internal/inventory')
        back(page).focus()
        page.keyboard.press('Enter')
        expect(nav(page, 'inventory')).to_have_attribute('aria-current', 'page')
        expect(count).to_have_value('3')
        assert page.evaluate('window.navigationSentinel') == 'retained'
        page.go_forward()
        expect(nav(page, 'cash')).to_have_attribute('aria-current', 'page')
        page.reload()
        ready(page)
        back(page).click()
        expect(nav(page, 'inventory')).to_have_attribute('aria-current', 'page')
        # Replacement tabs must retain Inventory as the previous history entry.
        nav(page, 'cash').click()
        page.get_by_role('tab', name='Employee hours', exact=True).click()
        expect(back(page)).to_have_attribute('href', args.base + '/internal/inventory')
        back(page).click()
        expect(nav(page, 'inventory')).to_have_attribute('aria-current', 'page')
        page.get_by_role('button', name='Español', exact=True).click()
        expect(back(page)).to_have_text('←Volver')
        page.screenshot(path=str(args.artifacts / f'internal-{width}.png'))
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
        page.emulate_media(media='print')
        expect(back(page)).not_to_be_visible()
        ctx.close()
        print(f'PASS inventory/cash, retained count, keyboard, Forward, reload, replaced hash, Spanish, print at {width}px')

    # New visits have fallbacks; the root home has no dead-end Back link.
    ctx, page = context()
    page.goto(args.base + '/')
    page.wait_for_load_state('networkidle')
    expect(back(page)).to_have_count(0)
    page.locator('nav').first.get_by_role('link', name='Menu', exact=True).click()
    ready(page)
    back(page).click()
    expect(page).to_have_url(args.base + '/')
    # Cross-root loads retain the real predecessor through same-tab storage.
    page.goto(args.base + '/internal')
    ready(page)
    nav(page, 'schedule').click()
    ready(page)
    expect(back(page)).to_have_attribute('href', args.base + '/internal')
    back(page).click()
    expect(nav(page, 'dashboard')).to_have_attribute('aria-current', 'page')
    ctx.close()
    print('PASS public pages and cross-root Schedule return')

    ctx, page = context()
    page.goto(args.base + '/menu')
    ready(page)
    page.goto(args.base + '/internal/bookkeeping#hours', referer=args.base + '/menu')
    ready(page)
    page.locator('#hc-preparer:visible').fill('Retain my unfinished import')
    back(page).click()
    dialog = page.get_by_role('dialog')
    expect(dialog).to_be_visible()
    page.keyboard.press('Escape')
    expect(page.locator('#hc-preparer:visible')).to_have_value('Retain my unfinished import')
    back(page).click()
    dialog.get_by_role('button', name='Leave page', exact=True).click()
    expect(page).to_have_url(args.base + '/menu')
    ctx.close()
    print('PASS unsaved-work departure confirmation and Cancel')

    for path in ('/careers', '/locations/w-military', '/locations/sw-military', '/schedule',
                 '/schedule/CR3-kitchen', '/scheduler-demo/CR3-kitchen', '/scheduler-prototype',
                 '/order', '/order/review?location=CR3&table=1', '/order/confirmation',
                 '/internal/forms', '/internal/reports', '/internal/qr-generator',
                 '/internal/ui-gallery', '/internal/inventory.html', '/internal/inventory/'):
        ctx, page = context()
        page.goto(args.base + path)
        ready(page)
        expect(back(page)).to_be_visible()
        ctx.close()
    print('PASS direct links across public, order, schedule and internal pages, including URL aliases')

    ctx, page = context(deny_storage=True)
    page.goto(args.base + '/internal/inventory')
    ready(page)
    nav(page, 'cash').click()
    ready(page)
    back(page).click()
    expect(nav(page, 'inventory')).to_have_attribute('aria-current', 'page')
    ctx.close()
    print('PASS blocked session storage')
    browser.close()

assert not errors, errors
print('Back navigation browser checks passed')
