"""IMPORT-03 local-only browser acceptance: retained outputs and device copies."""
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from import_browser_helpers import set_source

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3017'
if urlparse(BASE).hostname not in ('localhost', '127.0.0.1'):
    raise SystemExit('Local server required')
ROOT = Path(__file__).resolve().parent.parent
fixtures = json.loads(subprocess.check_output(['node', '--import', 'jiti/register', 'scripts/create-import-fixtures.ts'], cwd=ROOT))
def upload(key, name=None):
    return {'name': name or key + ('.csv' if key == 'hours' else '.xlsx'), 'mimeType': 'text/csv' if key == 'hours' else 'application/octet-stream', 'buffer': base64.b64decode(fixtures[key])}
def download_hash(page, button):
    with page.expect_download() as result:
        button.click()
    return hashlib.sha256(Path(result.value.path()).read_bytes()).hexdigest()
def drafts(page, kind):
    return page.evaluate("kind => Object.entries(localStorage).filter(([key]) => key.startsWith('cr-internal-draft:')).map(([key,raw]) => ({key,raw,draft:JSON.parse(raw)})).filter(item => item.draft.payload.kind === kind)", kind)
def confirm(page, accept):
    dialog = page.get_by_role('dialog')
    expect(dialog).to_be_visible()
    expect(dialog.locator('button').first).to_be_focused()
    if accept:
        dialog.locator('button').last.click()
    else:
        page.keyboard.press('Escape')
    expect(dialog).not_to_be_visible()
def sales_context(page):
    page.locator('#sc-location').select_option(index=1)
    page.locator('#sc-date').fill('2026-10-20')
def hours_context(page):
    page.locator('#hc-location').select_option(index=2)
    page.locator('#hc-start').fill('2026-10-01')
    page.locator('#hc-end').fill('2026-10-31')

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width':390,'height':844},has_touch=True,accept_downloads=True)
        errors, production = [], []
        def reject(route):
            production.append(route.request.url); route.abort()
        context.route('https://*.workers.dev/**',reject)
        context.route('http://127.0.0.1:8787/**',lambda route:route.fulfill(status=200,json={'days':[]},headers={'access-control-allow-origin':'*'}))
        page = context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('dialog',lambda dialog:dialog.accept() if dialog.type == 'beforeunload' else dialog.dismiss())
        page.goto(BASE+'/internal/bookkeeping/');page.wait_for_load_state('networkidle')
        page.locator('#tab-sales').tap();sales_context(page)
        page.locator('#sc-first').fill('Original preparer');expect(page.locator('#sc-day')).to_have_value('TUE')
        for slot in ('general','lunch','dinner'):
            set_source(page,'#sc-file-'+slot,upload(slot))
            expect(page.locator('#sc-file-'+slot+'-feedback')).to_contain_text('File checks passed')
        page.locator('#sc-prepare').tap();page.locator('#sales-context-reason').fill('Synthetic source context reviewed for this fixture')
        page.locator('#sales-reviewed').check()
        sales=page.locator('#panel-sales');button=page.locator('#sc-download')
        first=download_hash(page,button)
        context.set_offline(True)
        assert download_hash(page,button)==first
        sales.get_by_role('button',name='Save a copy on this device',exact=True).tap()
        expect(sales.get_by_role('status').filter(has_text='saved on this device')).to_be_visible()
        original=drafts(page,'sales')[0]
        assert original['draft']['payload']['output']['sha256']==first
        assert original['draft']['payload']['review']['sources'][0]['filename']=='general.xlsx'
        context.set_offline(False)
        # Cancellation restores the native old File as well as its review/cache.
        page.locator('#sc-file-general').set_input_files(upload('bad','replacement.xlsx'))
        confirm(page,False)
        assert page.locator('#sc-file-general').evaluate('(input)=>input.files[0].name')=='general.xlsx'
        expect(page.locator('#sales-reviewed')).to_be_checked()
        assert download_hash(page,button)==first
        page.get_by_role('button',name='Español',exact=True).tap()
        page.locator('#sc-next').tap();confirm(page,False)
        expect(page.locator('#sc-first')).to_have_value('Original preparer')
        page.locator('#sc-next').tap();confirm(page,True)
        expect(page.locator('#sc-first')).to_be_focused()
        expect(page.locator('#sc-first')).to_have_value('')
        assert page.locator('#sc-file-general').evaluate('(input)=>input.files.length')==0
        assert drafts(page,'sales')[0]['raw']==original['raw']
        # Reload and restore with no original uploads; copied output works offline.
        page.reload();page.wait_for_load_state('networkidle')
        page.get_by_role('button',name='English',exact=True).tap()
        page.locator('#tab-sales').tap();sales_context(page)
        sales.get_by_role('button',name='Resume as a copy',exact=True).first.tap();confirm(page,True)
        expect(page.locator('#sc-first')).to_have_value('Original preparer')
        assert page.locator('#sc-file-general').evaluate('(input)=>input.files.length')==0
        expect(page.locator('#sc-prepare')).to_be_disabled()
        expect(button).to_be_disabled()
        page.locator('#sales-context-reason').fill('Synthetic source context reviewed for this fixture')
        page.locator('#sales-reviewed').check();context.set_offline(True)
        assert download_hash(page,button)==first
        sales.get_by_role('button',name='Save a copy on this device',exact=True).tap()
        expect(sales.get_by_role('status').filter(has_text='saved on this device')).to_be_visible()
        copies=drafts(page,'sales');assert len(copies)==2
        assert len({item['draft']['id'] for item in copies})==2
        assert any(item['draft']['sourceId']==original['draft']['id'] for item in copies)
        assert next(item for item in copies if item['key']==original['key'])['raw']==original['raw']
        # A quota failure must not erase either working bytes or earlier saved copies.
        page.evaluate("() => { window.originalSet=Storage.prototype.setItem; Storage.prototype.setItem=function(){throw new DOMException('Synthetic quota','QuotaExceededError')} }")
        sales.get_by_role('button',name='Save a copy on this device',exact=True).tap()
        expect(sales.get_by_role('alert')).to_contain_text('Could not save this copy')
        assert download_hash(page,button)==first
        assert len(drafts(page,'sales'))==2
        page.evaluate('() => { Storage.prototype.setItem=window.originalSet }')
        context.set_offline(False)
        # Hours uses a separately keyed period, supports identical repeats and resume.
        page.locator('#tab-hours').tap();hours_context(page)
        page.locator('#hc-preparer').fill('Hours preparer')
        set_source(page,'#hc-file',upload('hours','original-hours.csv'))
        expect(page.locator('#hc-file-feedback')).to_contain_text('File checks passed')
        hours=page.locator('#panel-hours');hbutton=page.locator('#hc-download')
        hour_hash=download_hash(page,hbutton)
        context.set_offline(True)
        assert download_hash(page,hbutton)==hour_hash
        hours.get_by_role('button',name='Save a copy on this device',exact=True).tap()
        expect(hours.get_by_role('status').filter(has_text='saved on this device')).to_be_visible()
        old_hours=drafts(page,'hours')[0]
        assert old_hours['draft']['context']['storeId']=='CR2'
        assert old_hours['draft']['context']['period']=={'start':'2026-10-01','end':'2026-10-31'}
        context.set_offline(False)
        # Two editor tabs resume independently and cannot overwrite the source.
        other=context.new_page()
        other.on('pageerror',lambda error:errors.append(str(error)))
        other.on('dialog',lambda dialog:dialog.accept() if dialog.type=='beforeunload' else dialog.dismiss())
        other.goto(BASE+'/internal/bookkeeping/');other.wait_for_load_state('networkidle')
        other.locator('#tab-hours').click();hours_context(other)
        other.locator('#panel-hours').get_by_role('button',name='Resume as a copy',exact=True).first.click();confirm(other,True)
        other.locator('#hc-preparer').fill('Second editor')
        other.locator('#panel-hours').get_by_role('button',name='Save a copy on this device',exact=True).click()
        expect(other.locator('#panel-hours').get_by_role('status').filter(has_text='saved on this device')).to_be_visible()
        expect(page.locator('#hc-preparer')).to_have_value('Hours preparer')
        assert next(item for item in drafts(page,'hours') if item['key']==old_hours['key'])['raw']==old_hours['raw']
        assert len(drafts(page,'hours'))==2
        assert download_hash(other,other.locator('#hc-download'))==hour_hash
        other.close()
        page.get_by_role('button',name='Español',exact=True).tap()
        page.locator('#hc-next').tap();confirm(page,True)
        expect(page.locator('#hc-location')).to_be_focused()
        expect(page.locator('#hc-start')).to_have_value('')
        hours_context(page)
        hours.get_by_role('button',name='Continuar en una copia',exact=True).first.tap();confirm(page,True)
        context.set_offline(True)
        assert download_hash(page,hbutton)==hour_hash
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        context.set_offline(False)
        # Future/corrupt drafts remain visible and byte-for-byte downloadable.
        bad_key=old_hours['key'].rsplit(':',1)[0]+':future-copy'
        raw=json.dumps({'schemaVersion':99,'payload':{'synthetic':'preserved'}})
        page.evaluate('([key,raw])=>localStorage.setItem(key,raw)',[bad_key,raw])
        hours.get_by_role('button',name='Actualizar borradores',exact=True).click()
        expect(hours.get_by_role('alert')).to_contain_text('No se pudo leer')
        assert page.evaluate('key=>localStorage.getItem(key)',bad_key)==raw
        assert not errors,errors
        assert not production,production
        context.close();browser.close()
        print('PASS IMPORT-03: identical repeat bytes, offline cached output, replacement/start cancellation and focus, reload/device recovery, quota preservation, independent editor copies, period isolation, Spanish phone and unsupported-source preservation')

if __name__=='__main__':run()
