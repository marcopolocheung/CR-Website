"""UX-03 local browser acceptance. Start Next dev with a loopback API override.
Usage: python3 scripts/test-internal-feedback.py http://127.0.0.1:3017
"""
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3017'
assert urlparse(base).hostname in ('127.0.0.1', 'localhost'), 'Local server required'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 768, 'height': 1024}, has_touch=True)
    page = context.new_page()
    mode = {'hold': False, 'fail': False, 'history_fail': False}
    pending, errors = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    def api(route):
        req = route.request
        headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,PUT,OPTIONS'}
        if req.method == 'OPTIONS':
            route.fulfill(status=204, headers=headers)
        elif req.headers.get('authorization') != 'Bearer synthetic-feedback-token':
            route.fulfill(status=401, json={'error': 'unauthorized'}, headers=headers)
        elif '/api/auth/verify' in req.url:
            route.fulfill(status=200, json={'ok': True}, headers=headers)
        elif req.method == 'PUT':
            if mode['fail']:
                route.abort('failed')
            elif mode['hold']:
                pending.append((route, headers))
            else:
                route.fulfill(status=200, json={'ok': True}, headers=headers)
        elif mode['history_fail']:
            route.fulfill(status=503, json={'error': 'unavailable'}, headers=headers)
        else:
            route.fulfill(status=200, json={'days': []}, headers=headers)
    context.route('http://127.0.0.1:8787/**', api)
    def remote(route):
        errors.append('Unexpected remote request: ' + route.request.url)
        route.abort()
    context.route('https://*.workers.dev/**', remote)
    page.goto(base + '/internal/bookkeeping/')
    page.wait_for_load_state('networkidle')
    page.locator('#cashout-code').fill('synthetic-rejected-code')
    page.get_by_role('button', name='Unlock', exact=True).click()
    expect(page.locator('#cashout-code')).to_be_focused()
    expect(page.locator('#cashout-code')).to_have_value('synthetic-rejected-code')
    expect(page.locator('#cashout-code')).to_have_attribute('aria-invalid', 'true')
    expect(page.locator('#cashout-code')).to_have_attribute('aria-describedby', 'cashout-code-error')
    page.locator('#cashout-code').fill('synthetic-feedback-token')
    page.get_by_role('button', name='Unlock', exact=True).click()
    page.locator('#draft-preparer').fill('Feedback test preparer')
    page.get_by_role('button', name='Start new draft', exact=True).click()
    feedback = page.locator('[data-save-state]')
    expect(feedback).to_have_attribute('data-save-state', 'device')
    expect(feedback).to_contain_text('Saved on this device')
    page.get_by_label('Cashier name', exact=True).first.fill('Original cashier')
    clear = page.get_by_role('button', name='Clear sheet', exact=True)
    clear.click()
    dialog = page.get_by_role('dialog')
    expect(dialog).to_be_visible()
    cancel = dialog.get_by_role('button', name='Cancel', exact=True)
    expect(cancel).to_be_focused()
    page.keyboard.press('Shift+Tab')
    expect(dialog.get_by_role('button', name='Confirm', exact=True)).to_be_focused()
    page.keyboard.press('Tab')
    expect(cancel).to_be_focused()
    page.keyboard.press('Escape')
    expect(dialog).not_to_be_visible()
    expect(clear).to_be_focused()
    expect(page.get_by_label('Cashier name', exact=True).first).to_have_value('Original cashier')
    page.get_by_role('button', name='Español', exact=True).tap()
    clear = page.get_by_role('button', name='Borrar hoja', exact=True)
    clear.tap()
    expect(dialog).to_contain_text('¿Borrar toda la hoja?')
    dialog.get_by_role('button', name='Cancelar', exact=True).tap()
    expect(clear).to_be_focused()
    page.get_by_role('button', name='English', exact=True).click()
    # Missing context focuses the actual field, preserves unrelated edits, and exposes a summary link.
    page.locator('#tab-sales').click()
    page.locator('#sc-first').fill('Original preparer')
    page.locator('#sc-date').fill('2026-10-20')
    page.get_by_role('button', name='Fill from cash-out', exact=True).click()
    expect(page.locator('#sc-location')).to_be_focused()
    expect(page.locator('#sc-location')).to_have_attribute('aria-invalid', 'true')
    expect(page.locator('#sc-first')).to_have_value('Original preparer')
    expect(page.locator('#sc-date')).to_have_value('2026-10-20')
    page.get_by_role('button', name='Español', exact=True).tap()
    expect(page.locator('#panel-sales [role=alert]')).to_contain_text('Seleccione una ubicación.')
    page.locator('#panel-sales [role=alert] a').click()
    expect(page.locator('#sc-location')).to_be_focused()
    page.locator('#tab-cash-out').click()
    mode['hold'] = True
    page.get_by_role('button', name='Guardar día', exact=True).click()
    expect(feedback).to_have_attribute('data-save-state', 'sending')
    assert pending
    # Editing while a save is in flight must not label the newer values as server-saved.
    page.get_by_label('Nombre del cajero', exact=True).first.fill('Newer unsaved cashier')
    held, headers = pending.pop()
    mode['hold'] = False
    held.fulfill(status=200, json={'ok': True}, headers=headers)
    expect(feedback).to_have_attribute('data-save-state', 'device')
    expect(page.get_by_label('Nombre del cajero', exact=True).first).to_have_value('Newer unsaved cashier')
    page.get_by_role('button', name='Guardar día', exact=True).click()
    expect(feedback).to_have_attribute('data-save-state', 'server')
    mode['history_fail'] = True
    page.get_by_role('button', name='Guardar día', exact=True).click()
    expect(feedback).to_have_attribute('data-save-state', 'server')
    expect(feedback).to_contain_text('No se pudo actualizar el historial')
    mode['history_fail'] = False
    # A change of record context invalidates the last acknowledged indicator.
    page.get_by_role('button', name='Elegir otro borrador', exact=True).click()
    page.locator('#cashout-date').fill('2026-10-19')
    page.get_by_role('button', name='Empezar un borrador nuevo', exact=True).click()
    expect(feedback).to_have_attribute('data-save-state', 'device')
    mode['fail'] = True
    page.get_by_role('button', name='Guardar día', exact=True).click()
    expect(feedback).to_have_attribute('data-save-state', 'waiting')
    expect(feedback).to_contain_text('No se pudo conectar')
    mode['fail'] = False
    # Device failures remain distinct and retain the visible edit.
    page.evaluate("() => { Storage.prototype.setItem = function() { throw new DOMException('quota', 'QuotaExceededError') } }")
    page.get_by_label('Nombre del cajero', exact=True).first.fill('Keep after quota failure')
    expect(feedback).to_have_attribute('data-save-state', 'failed')
    expect(feedback).to_contain_text('No se pudo guardar en este dispositivo')
    expect(page.get_by_label('Nombre del cajero', exact=True).first).to_have_value('Keep after quota failure')
    assert not errors, '\n'.join(errors)
    browser.close()
    print('PASS UX-03: retained field errors/focus, bilingual summaries, modal focus trap/Escape/return, device/send/server/wait/failure states, stale acknowledgment guard, and post-ack history failure')
