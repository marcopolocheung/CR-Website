"""IMPORT-01 synthetic, local-only browser acceptance.
Usage: python3 scripts/test-import-validation.py http://127.0.0.1:3017
Source bytes are generated locally; no production API requests are permitted.
"""
import base64
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from import_browser_helpers import set_source, confirm_replacement

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3017'
if urlparse(BASE).hostname not in ('localhost', '127.0.0.1'):
    raise SystemExit('Local server required')
ROOT = Path(__file__).resolve().parent.parent
fixtures = json.loads(subprocess.check_output(['node', '--import', 'jiti/register', 'scripts/create-import-fixtures.ts'], cwd=ROOT))
def source(key, name=None):
    return {'name': name or key + ('.csv' if 'Hours' in key or key == 'hours' else '.xlsx'),
            'mimeType': 'text/csv' if key in ('hours', 'badHours') else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'buffer': base64.b64decode(fixtures[key])}

def run():
    with sync_playwright() as p, tempfile.TemporaryDirectory(prefix='import-validation-') as temp:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, accept_downloads=True)
        # File validation/export must still work when optional preference/draft writes fail.
        context.add_init_script("Storage.prototype.setItem = function() { throw new DOMException('Synthetic quota', 'QuotaExceededError') }")
        errors, remote, downloads = [], [], []
        def block(route):
            remote.append(route.request.url)
            route.abort()
        context.route('https://*.workers.dev/**', block)
        context.route('http://127.0.0.1:8787/**', lambda route: route.fulfill(status=200, json={'days': []}, headers={'access-control-allow-origin': '*'}))
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('download', lambda download: downloads.append(download))
        page.on('dialog', lambda dialog: dialog.dismiss())
        page.goto(BASE + '/internal/bookkeeping/')
        page.wait_for_load_state('networkidle')
        page.locator('#tab-sales').tap()
        sales = page.locator('#panel-sales')
        # Scope the existing export action to its mounted converter panel.
        download = sales.locator('#sc-download')
        prepare = sales.locator('#sc-prepare')
        page.locator('#sc-first').fill('Original preparer')
        page.locator('#sc-date').fill('2026-10-20')
        expect(page.locator('#sc-day')).to_have_value('TUE')
        page.locator('#sc-location').select_option(index=1)
        for key in ('general', 'lunch', 'dinner'):
            set_source(page, '#sc-file-' + key, source(key))
            expect(page.locator('#sc-file-' + key + '-feedback')).to_contain_text('File checks passed')
        expect(prepare).to_be_enabled()
        set_source(page, '#sc-file-general', source('bad', 'bad-general.xlsx'))
        expect(page.locator('#sc-file-general')).to_have_attribute('aria-invalid', 'true')
        expect(page.locator('#sc-file-general-feedback')).to_contain_text('row 2')
        expect(page.locator('#sc-file-general-feedback')).to_contain_text('Revenue summary')
        expect(download).to_be_disabled()
        page.get_by_role('button', name='Español', exact=True).tap()
        expect(page.locator('#sc-file-general-feedback')).to_contain_text('fila 2')
        expect(page.locator('#sc-first')).to_have_value('Original preparer')
        assert page.locator('#sc-file-lunch').evaluate('(el) => el.files[0].name') == 'lunch.xlsx'
        assert page.locator('#sc-file-dinner').evaluate('(el) => el.files[0].name') == 'dinner.xlsx'
        assert len(downloads) == 0
        # Keyboard Replace invokes the native chooser; cancelling keeps the selected source in state.
        replace = sales.get_by_role('button', name='Reemplazar Informe general', exact=True)
        replace.focus()
        with page.expect_file_chooser() as chosen:
            page.keyboard.press('Enter')
        chosen.value.set_files(source('general'))
        confirm_replacement(page)
        expect(page.locator('#sc-file-general-feedback')).to_contain_text('pasó las comprobaciones')
        # Empty and unreadable source reports block only their own slot.
        set_source(page, '#sc-file-dinner', {'name': 'empty.xlsx', 'mimeType': 'application/octet-stream', 'buffer': b''})
        expect(page.locator('#sc-file-dinner-feedback')).to_contain_text('está vacío')
        expect(download).to_be_disabled()
        set_source(page, '#sc-file-dinner', source('dinner'))
        expect(prepare).to_be_enabled()
        # A delayed old file read must not overwrite the replacement's result.
        page.evaluate("""() => {
          const original = File.prototype.arrayBuffer;
          File.prototype.arrayBuffer = function() {
            if (this.name === 'slow-old.xlsx') return new Promise(resolve => { window.releaseOldFile = () => resolve(original.call(this)) });
            return original.call(this);
          };
        }""")
        set_source(page, '#sc-file-general', source('bad', 'slow-old.xlsx'))
        expect(page.locator('#sc-file-general-feedback')).to_contain_text('Comprobando')
        set_source(page, '#sc-file-general', source('general', 'new-general.xlsx'))
        expect(page.locator('#sc-file-general-feedback')).to_contain_text('pasó las comprobaciones')
        page.evaluate('window.releaseOldFile()')
        expect(page.locator('#sc-file-general-feedback')).to_contain_text('pasó las comprobaciones')
        # Validate manual amounts rather than exporting parseFloat("12oops") as 12.
        page.locator('#sc-amDeposit').fill('12oops')
        prepare.tap()
        expect(page.locator('#sc-amDeposit')).to_be_focused()
        expect(sales.get_by_role('alert')).to_contain_text('importe completo')
        page.locator('#sc-amDeposit').fill('123.45')
        prepare.tap()
        expect(page.locator('#sales-review-title')).to_be_focused()
        expect(download).to_be_disabled()
        page.locator('#sales-context-reason').fill('Synthetic source context reviewed for this fixture')
        page.locator('#sales-reviewed').tap()
        expect(download).to_be_enabled()
        # Template failure retains every file and field and never claims a download.
        page.route('**/internal/daily-sales-template.xlsx', lambda route: route.fulfill(status=503))
        download.tap()
        expect(sales.get_by_role('status').last).to_contain_text('No se pudo generar')
        expect(page.locator('#sc-amDeposit')).to_have_value('123.45')
        expect(page.locator('#sc-first')).to_have_value('Original preparer')
        assert len(downloads) == 0
        page.unroute('**/internal/daily-sales-template.xlsx')
        with page.expect_download() as saved:
            download.evaluate('(button) => { button.click(); button.click() }')
        saved.value.save_as(str(Path(temp) / 'sales.xlsx'))
        expect(sales.get_by_role('status').last).to_contain_text('descarg')
        assert len(downloads) == 1, 'Two immediate submits must start one export'
        expect(page.locator('#sc-first')).to_have_value('Original preparer')
        assert 'CR3' in saved.value.suggested_filename
        # Real workbook cells/English template survive the UI locale.
        cells = json.loads(subprocess.check_output(['node', '-e', "const x=require('xlsx');const w=x.readFile(process.argv[1]);const s=w.Sheets.DATAINPUT;console.log(JSON.stringify(Object.fromEntries(['B1','C4','C8','C9','C13','C18','C23'].map(k=>[k,s[k]?.v]))))", str(Path(temp) / 'sales.xlsx')], cwd=ROOT))
        assert cells == {'B1': 'Original preparer', 'C4': 123.45, 'C8': 1234.56, 'C9': 234.56, 'C13': 1000, 'C18': 500, 'C23': 53.63}, cells
        # Hours errors preserve metadata, filename, and source values across tabs/locales.
        page.locator('#tab-hours').tap()
        hours = page.locator('#panel-hours')
        hdownload = hours.locator('#hc-download')
        page.locator('#hc-location').select_option(index=2)
        page.locator('#hc-start').fill('2026-10-01')
        page.locator('#hc-end').fill('2026-10-31')
        set_source(page, '#hc-file', source('badHours', 'bad-hours.csv'))
        expect(page.locator('#hc-file-feedback')).to_contain_text('Registro CSV 2')
        expect(page.locator('#hc-file-feedback')).to_contain_text('Registro CSV 3')
        expect(page.locator('#hc-file-feedback')).to_contain_text('Employee External Id')
        expect(hdownload).to_be_disabled()
        page.get_by_role('button', name='English', exact=True).tap()
        expect(page.locator('#hc-file-feedback')).to_contain_text('CSV record 2')
        expect(page.locator('#hc-start')).to_have_value('2026-10-01')
        page.locator('#tab-sales').tap()
        expect(page.locator('#sc-first')).to_have_value('Original preparer')
        page.locator('#tab-hours').tap()
        assert page.locator('#hc-file').evaluate('(el) => el.files[0].name') == 'bad-hours.csv'
        set_source(page, '#hc-file', {'name': 'wrong.csv', 'mimeType': 'text/csv', 'buffer': b'date,sales\n2026-10-20,5'})
        expect(page.locator('#hc-file-feedback')).to_contain_text('not the expected')
        set_source(page, '#hc-file', {'name': 'malformed.csv', 'mimeType': 'text/csv', 'buffer': b'Employee External Id,Employee,Job Title,In Date,Out Date,Total Hours,Regular Hours,Overtime Hours\n"unfinished'})
        expect(page.locator('#hc-file-feedback')).to_contain_text('format problem')
        set_source(page, '#hc-file', source('hours'))
        expect(page.locator('#hc-file-feedback')).to_contain_text('File checks passed')
        # Date metadata is validated without filtering source records or changing payroll rules.
        page.locator('#hc-end').fill('2026-09-30')
        hdownload.tap()
        expect(page.locator('#hc-end')).to_be_focused()
        expect(hours.get_by_role('alert')).to_contain_text('do not filter')
        page.locator('#hc-end').fill('2026-10-31')
        # File-only conversion needs no network and remains usable with denied storage.
        context.set_offline(True)
        with page.expect_download() as hours_saved:
            hdownload.tap()
        hours_saved.value.save_as(str(Path(temp) / 'hours.xlsx'))
        expect(hours.get_by_role('status').last).to_contain_text('download')
        assert hours_saved.value.suggested_filename == 'CR2_26_1001-26_1031_EMPLOYEE_HOUR_LOG_SUMMARY.xlsx'
        assert len(downloads) == 2
        expect(page.locator('#hc-start')).to_have_value('2026-10-01')
        page.get_by_role('button', name='Español', exact=True).tap()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Spanish phone layout overflows'
        page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
        expect(page.locator('#hc-file-feedback')).to_contain_text('File checks passed')
        page.evaluate("window.dispatchEvent(new Event('afterprint'))")
        expect(page.locator('#hc-file-feedback')).to_contain_text('pasó las comprobaciones')
        assert not errors, errors
        assert not remote, remote
        context.close()
        browser.close()
        print('PASS IMPORT-01: bilingual source validation, sheet/CSV row evidence, isolated replacement, stale reads, retained inputs, failed export/retry, duplicate submit, real workbook cells, offline hours, denied storage, keyboard/touch/phone/print')

if __name__ == '__main__':
    run()
