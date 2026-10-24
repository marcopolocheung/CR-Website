"""UX-01 local browser acceptance. Serve a build using the local API override.
Usage: python3 scripts/test-internal-language.py http://127.0.0.1:3017
Never sends mutations to a live backend: all local API requests are fulfilled here.
"""
import json
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3017'
if urlparse(BASE).hostname not in ('127.0.0.1', 'localhost'):
    raise SystemExit('A local static server is required')
TOKEN = 'synthetic-language-test-token'

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 768, 'height': 1024}, has_touch=True)
        page = context.new_page()
        errors, requests, saves = [], [], []
        mode = {'fail': False, 'hold': False}
        pending = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        def api(route):
            request = route.request
            requests.append(request.url)
            headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,PUT,OPTIONS'}
            if request.method == 'OPTIONS':
                route.fulfill(status=204, headers=headers)
            elif mode['fail']:
                route.abort('failed')
            elif request.headers.get('authorization') != 'Bearer ' + TOKEN:
                route.fulfill(status=401, json={'error': 'unauthorized'}, headers=headers)
            elif '/api/auth/verify' in request.url:
                route.fulfill(status=200, json={'ok': True}, headers=headers)
            elif request.method == 'PUT':
                saves.append({'url': request.url, 'body': request.post_data_json})
                if mode['hold']:
                    pending.append((route, headers))
                else:
                    route.fulfill(status=200, json={'ok': True}, headers=headers)
            else:
                route.fulfill(status=200, json={'days': []}, headers=headers)
        context.route('http://127.0.0.1:8787/**', api)
        # A production request is an error even if it would otherwise be read-only.
        def reject_remote(route):
            errors.append('Unexpected production request: ' + route.request.url)
            route.abort()
        context.route('https://*.workers.dev/**', reject_remote)
        page.goto(BASE + '/internal/bookkeeping/')
        page.wait_for_load_state('networkidle')
        page.locator('#cashout-code').fill('synthetic-rejected-token')
        page.get_by_role('button', name='Unlock', exact=True).click()
        expect(page.locator('form [role=alert]')).to_contain_text('not accepted')
        spanish = page.get_by_role('button', name='Español', exact=True)
        spanish.focus()
        page.keyboard.press('Enter')
        expect(spanish).to_be_focused()
        expect(spanish).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('form [role=alert]')).to_contain_text('No se aceptó')
        expect(page.locator('#cashout-code')).to_have_value('synthetic-rejected-token')
        page.locator('#cashout-code').fill(TOKEN)
        page.get_by_role('button', name='Acceder', exact=True).tap()
        expect(page.locator('#cashout-store')).to_be_visible()
        page.wait_for_load_state('networkidle')
        page.locator('#cashout-store').select_option('CR2')
        page.locator('#cashout-date').fill('2026-10-20')
        page.locator('#draft-preparer').fill('Original preparer label')
        page.get_by_role('button', name='Empezar un borrador nuevo', exact=True).click()
        expect(page.get_by_text('Aún no hay días guardados.', exact=True)).to_be_visible()
        page.get_by_label('Nombre del cajero', exact=True).first.fill('Nombre original')
        page.locator('#am-0-10000').fill('3')
        page.locator('#am-0-toast').fill('123.45')
        page.locator('#z-report').fill('900.00')
        snapshot = page.evaluate("JSON.stringify(Object.entries(localStorage).filter(([key]) => key.startsWith('cr-internal-draft:')))")
        count_before_switch = len(requests)
        page.get_by_role('button', name='English', exact=True).tap()
        expect(page.locator('#cashout-store')).to_have_value('CR2')
        expect(page.locator('#cashout-date')).to_have_value('2026-10-20')
        expect(page.get_by_label('Cashier name', exact=True).first).to_have_value('Nombre original')
        expect(page.locator('#am-0-toast')).to_have_value('123.45')
        assert page.evaluate("JSON.stringify(Object.entries(localStorage).filter(([key]) => key.startsWith('cr-internal-draft:')))") == snapshot
        assert len(requests) == count_before_switch, 'Language switch must not refetch/remount the cash sheet'
        mode['hold'] = True
        page.get_by_role('button', name='Save day', exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('Sending')
        page.get_by_role('button', name='Español', exact=True).tap()
        expect(page.get_by_role('status')).to_contain_text('Enviando')
        assert pending, 'Expected held local save request'
        held, headers = pending.pop()
        mode['hold'] = False
        held.fulfill(status=200, json={'ok': True}, headers=headers)
        expect(page.get_by_role('status')).to_contain_text('Guardado en el servidor: CR2 2026-10-20')
        page.get_by_role('button', name='English', exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('Saved to server: CR2 2026-10-20')
        assert saves[-1]['url'].endswith('/api/cashout/CR2/2026-10-20')
        assert saves[-1]['body']['sheet']['am'][0]['name'] == 'Nombre original'
        page.get_by_role('button', name='Español', exact=True).tap()
        expect(page.get_by_role('status')).to_contain_text('Guardado en el servidor: CR2 2026-10-20')
        # Same mounted converter panels and values survive tab/language changes.
        page.locator('#tab-sales').click()
        page.locator('#sc-first').fill('Original preparer')
        page.get_by_role('button', name='English', exact=True).click()
        expect(page.locator('#tab-sales')).to_have_attribute('aria-selected', 'true')
        expect(page.locator('#sc-first')).to_have_value('Original preparer')
        page.locator('#tab-hours').click()
        page.locator('#hc-start').fill('2026-10-01')
        page.locator('#hc-file').set_input_files({'name': 'fixture.csv', 'mimeType': 'text/csv', 'buffer': b'fixture,only\n'})
        page.get_by_role('button', name='Español', exact=True).tap()
        expect(page.locator('#tab-hours')).to_have_attribute('aria-selected', 'true')
        expect(page.locator('#hc-start')).to_have_value('2026-10-01')
        assert page.locator('#hc-file').evaluate('(element) => element.files[0].name') == 'fixture.csv'
        page.locator('#tab-cash-out').click()
        expect(page.locator('#am-0-toast')).to_have_value('123.45')
        mode['fail'] = True
        page.get_by_role('button', name='Guardar día', exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('No se pudo conectar')
        page.get_by_role('button', name='English', exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('Could not reach')
        expect(page.locator('#am-0-toast')).to_have_value('123.45')
        mode['fail'] = False
        page.get_by_role('button', name='Español', exact=True).tap()
        dialogs = []
        def dismiss(dialog):
            dialogs.append(dialog.message)
            dialog.dismiss()
        page.on('dialog', dismiss)
        page.get_by_role('button', name='Borrar hoja', exact=True).click()
        if page.get_by_role('dialog').is_visible():
            expect(page.get_by_role('dialog')).to_contain_text('¿Borrar')
            page.get_by_role('button', name='Cancelar', exact=True).click()
        else:
            assert dialogs[-1].startswith('¿Borrar')
        expect(page.locator('#am-0-toast')).to_have_value('123.45')
        # Browser print events preserve existing English output, then restore screen language.
        page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
        expect(page.get_by_role('heading', name='Day total', exact=True)).to_be_visible()
        page.emulate_media(media='print')
        expect(page.get_by_role('button', name='English', exact=True)).not_to_be_visible()
        page.emulate_media(media='screen')
        page.evaluate("window.dispatchEvent(new Event('afterprint'))")
        expect(page.get_by_role('heading', name='Total del día', exact=True)).to_be_visible()
        expect(page.locator('#am-0-toast')).to_have_value('123.45')
        for width, height in [(768, 1024), (1024, 768)]:
            page.set_viewport_size({'width': width, 'height': height})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Spanish layout overflows viewport'
        for name in ['English', 'Español']:
            button = page.get_by_role('button', name=name, exact=True)
            assert button.bounding_box()['height'] >= 44
        all_storage = page.evaluate('JSON.stringify({local: {...localStorage}, session: {...sessionStorage}})')
        assert TOKEN not in all_storage, 'Manager token leaked to storage'
        page.reload()
        page.wait_for_load_state('networkidle')
        expect(page.get_by_role('button', name='Español', exact=True)).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('#cashout-code')).to_be_visible() # authentication remains in memory only
        # Preference storage denial does not prevent a language switch or clear form input.
        page.evaluate("() => { Storage.prototype.setItem = function() { throw new DOMException('denied', 'SecurityError') } }")
        page.locator('#cashout-code').fill('retain-this-input')
        page.get_by_role('button', name='English', exact=True).click()
        expect(page.get_by_role('button', name='Unlock', exact=True)).to_be_visible()
        expect(page.locator('#cashout-code')).to_have_value('retain-this-input')
        # Dashboard navigation and empty/missing summary remain translated, with no backend mutation.
        page.goto(BASE + '/internal/')
        page.wait_for_load_state('networkidle')
        page.get_by_role('button', name='Español', exact=True).click()
        expect(page.get_by_role('heading', name='Panel de control', exact=True)).to_be_visible()
        expect(page.get_by_role('link', name='Contabilidad', exact=False)).to_be_visible()
        page.locator('#cashout-code').fill(TOKEN)
        page.get_by_role('button', name='Acceder', exact=True).click()
        expect(page.get_by_text('Cierres de caja pendientes', exact=True)).to_be_visible()
        assert not errors, '\n'.join(errors)
        assert saves and all('127.0.0.1:8787' in request for request in requests)
        browser.close()
        print('PASS UX-01: dictionary integration, keyboard/touch, mid-edit switch, mounted tabs/files, localized late/save/failure states, confirmation cancellation, denied preference storage, print recovery, tablet layout, and credential isolation')

if __name__ == '__main__':
    run()
