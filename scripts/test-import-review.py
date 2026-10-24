"""IMPORT-02 local synthetic browser acceptance. No real API/data operations."""
import base64
import json
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3017'
if urlparse(BASE).hostname not in ('localhost', '127.0.0.1'):
    raise SystemExit('Local server required')
ROOT = Path(__file__).resolve().parent.parent
fixtures = json.loads(subprocess.check_output(['node', '--import', 'jiti/register', 'scripts/create-import-fixtures.ts'], cwd=ROOT))
def source(key, name):
    return {'name': name, 'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'buffer': base64.b64decode(fixtures[key])}

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, accept_downloads=True)
        context.add_init_script("Storage.prototype.setItem = function() { throw new DOMException('Synthetic quota', 'QuotaExceededError') }")
        errors, production, downloads, held = [], [], [], []
        mode = {'hold': False}
        token = 'synthetic-import-review-token'
        headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,PUT,POST,OPTIONS'}
        def api(route):
            req = route.request
            if req.method == 'OPTIONS':
                route.fulfill(status=204, headers=headers)
            elif '/api/auth/verify' in req.url:
                route.fulfill(status=200, json={'ok': True}, headers=headers)
            elif req.url.endswith('/api/cashout/CR3/2026-10-20') and mode['hold']:
                held.append(route)
            else:
                route.fulfill(status=200, json={'days': []}, headers=headers)
        def reject(route):
            production.append(route.request.url)
            route.abort()
        context.route('http://127.0.0.1:8787/**', api)
        context.route('https://*.workers.dev/**', reject)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('download', lambda download: downloads.append(download))
        page.on('dialog', lambda dialog: dialog.dismiss())
        page.goto(BASE + '/internal/bookkeeping/')
        page.wait_for_load_state('networkidle')
        page.locator('#tab-sales').tap()
        for slot in ('general', 'lunch', 'dinner'):
            page.locator('#sc-file-' + slot).set_input_files(source('review-' + slot, slot + '-original.xlsx'))
            expect(page.locator('#sc-file-' + slot + '-feedback')).to_contain_text('File checks passed')
        prepare, download = page.locator('#sc-prepare'), page.locator('#sc-download')
        prepare.tap()
        expect(page.locator('#sc-location')).to_be_focused()
        expect(download).to_be_disabled()
        page.locator('#sc-location').select_option(index=1)
        page.locator('#sc-date').fill('2026-10-20')
        page.locator('#sc-day').select_option('TUE')
        page.locator('#sc-first').fill('Original preparer')
        page.locator('#sc-amDeposit').fill('123.45')
        page.locator('#sc-pmDeposit').fill('111.11')
        prepare.focus()
        page.keyboard.press('Enter')
        expect(page.locator('#sales-review-title')).to_be_focused()
        review = page.get_by_role('region', name='Figures copied to the workbook', exact=True)
        expect(review.get_by_role('row')).to_have_count(19)
        expect(review).to_contain_text('Revenue summary')
        expect(review).to_contain_text('Row 2')
        expect(review).to_contain_text('C8')
        expect(page.locator('[data-sales-check=lunch-sales]')).to_contain_text('Difference — review required')
        expect(page.locator('[data-sales-check=lunch-tax]')).to_contain_text('Arithmetic matches')
        expect(page.locator('[data-sales-check=payments]')).to_contain_text('$65.44')
        expect(page.locator('[data-sales-check=revenue-payments]')).to_contain_text('verify scope')
        expect(page.locator('#panel-sales [role=alert]')).to_contain_text('GIFT CARD')
        expect(download).to_be_disabled()
        assert not downloads
        page.get_by_role('button', name='Español', exact=True).tap()
        expect(page.locator('[data-sales-check=lunch-sales]')).to_contain_text('requiere revisión')
        expect(page.locator('#panel-sales')).to_contain_text('general-original.xlsx')
        expect(page.locator('#sales-reviewed')).not_to_be_checked()
        page.locator('#sales-reviewed').focus()
        page.keyboard.press('Space')
        expect(download).to_be_enabled()
        page.get_by_role('button', name='English', exact=True).tap()
        expect(page.locator('#sales-reviewed')).to_be_checked()
        # A context edit invalidates the old snapshot and acknowledgement immediately.
        page.locator('#sc-first').fill('Edited preparer')
        expect(page.locator('#sales-review-title')).to_have_count(0)
        expect(download).to_be_disabled()
        prepare.tap()
        expect(page.locator('#sales-reviewed')).not_to_be_checked()
        page.locator('#sales-reviewed').tap()
        page.locator('#sc-file-general').set_input_files(source('general', 'general-original.xlsx'))
        expect(page.locator('#sales-review-title')).to_have_count(0)
        expect(download).to_be_disabled()
        expect(page.locator('#sc-file-general-feedback')).to_contain_text('File checks passed')
        # Preparing freezes source/context, remains bilingual and starts one read set.
        page.evaluate("""() => {
          window.reviewReads = [];
          const read = File.prototype.arrayBuffer;
          File.prototype.arrayBuffer = function() { return new Promise(resolve => window.reviewReads.push(() => resolve(read.call(this)))) };
        }""")
        prepare.evaluate('(button) => { button.click(); button.click() }')
        expect(page.locator('#sc-date')).to_be_disabled()
        page.wait_for_function('window.reviewReads.length === 3')
        assert page.evaluate('window.reviewReads.length') == 3
        page.get_by_role('button', name='Español', exact=True).tap()
        page.evaluate('window.reviewReads.splice(0).forEach(release => release())')
        expect(page.locator('#sales-review-title')).to_be_focused()
        expect(page.locator('[data-sales-check=payments]')).to_contain_text('Falta total/detalle')
        page.evaluate('File.prototype.arrayBuffer = function() { return new Blob([this]).arrayBuffer() }')
        # A separate screen/tab retains the prepared review and selected files.
        page.locator('#sales-reviewed').tap()
        page.locator('#tab-hours').tap()
        page.locator('#tab-sales').tap()
        expect(page.locator('#sales-reviewed')).to_be_checked()
        expect(page.locator('#sc-first')).to_have_value('Edited preparer')
        page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
        expect(page.locator('#sales-review-title')).to_have_text('Review extracted sales figures')
        page.evaluate("window.dispatchEvent(new Event('afterprint'))")
        expect(page.locator('#sales-review-title')).to_have_text('Revisar las cifras de ventas extraídas')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Spanish review overflows phone viewport'
        # Optional cash-out results arriving after edits must not change this review/input.
        page.get_by_role('button', name='English', exact=True).tap()
        page.locator('#tab-cash-out').tap()
        page.locator('#cashout-code').fill(token)
        page.get_by_role('button', name='Unlock', exact=True).tap()
        expect(page.locator('#cashout-store')).to_be_visible()
        page.wait_for_load_state('networkidle')
        page.locator('#tab-sales').tap()
        mode['hold'] = True
        page.get_by_role('button', name='Fill from cash-out', exact=True).tap()
        page.wait_for_timeout(100)
        assert held
        page.locator('#sc-first').fill('Latest preparer')
        held.pop().fulfill(status=200, json={'sheet': {'am': [{'name': 'Synthetic', 'counts': [2] + [0] * 10, 'toast': '100'}], 'pm': [], 'zReport': ''}}, headers=headers)
        expect(page.locator('#sc-amDeposit')).to_have_value('123.45')
        expect(page.locator('#sc-first')).to_have_value('Latest preparer')
        expect(download).to_be_disabled()
        prepare.tap()
        page.locator('#sales-reviewed').tap()
        with page.expect_download() as result:
            download.tap()
        assert result.value.suggested_filename == '26-1020_CR3_Daily_Sales_Report.xlsx'
        assert len(downloads) == 1
        expect(page.locator('#sc-first')).to_have_value('Latest preparer')
        assert token not in page.evaluate('JSON.stringify(localStorage)')
        assert not production, production
        assert not errors, errors
        context.close()
        browser.close()
        print('PASS IMPORT-02: source/row/cell evidence, arithmetic/coverage flags, bilingual acknowledgement, invalidation, one prepare, retained tabs/context, stale cash-out suppression, phone/print and download')

if __name__ == '__main__':
    run()
