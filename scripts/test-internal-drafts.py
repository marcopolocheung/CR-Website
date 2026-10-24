"""UX-05 local acceptance: scoped drafts, forked resume, recovery and handoff.
Run against Next dev with NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787.
"""
import json
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3017'
assert urlparse(base).hostname in ('127.0.0.1', 'localhost')
token = 'synthetic-draft-test-token'
legacy = '{"am":[],"pm":[],"zReport":"123.45"}'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':768,'height':1024},has_touch=True)
    errors = []
    def api(route):
        assert '127.0.0.1:8787' in route.request.url
        headers = {'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,OPTIONS'}
        if route.request.method == 'OPTIONS': route.fulfill(status=204,headers=headers)
        elif route.request.headers.get('authorization') != 'Bearer '+token: route.fulfill(status=401,json={'error':'unauthorized'},headers=headers)
        else: route.fulfill(status=200,json={'ok':True} if '/api/auth/' in route.request.url else {'days':[]},headers=headers)
    context.route('http://127.0.0.1:8787/**',api)
    def remote(route):
        errors.append('Unexpected remote request: '+route.request.url); route.abort()
    context.route('https://*.workers.dev/**',remote)
    def page_new():
        page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base+'/internal/bookkeeping/');page.wait_for_load_state('networkidle')
        return page
    page=page_new()
    page.evaluate('(raw)=>localStorage.setItem("cr-cash-out",raw)',legacy)
    def unlock(page):
        page.locator('#cashout-code').fill(token)
        page.get_by_role('button',name='Unlock',exact=True).click()
        expect(page.locator('#draft-preparer')).to_be_visible()
    unlock(page)
    expect(page.get_by_text('An older cash-out draft has no store or date.',exact=False)).to_be_visible()
    expect(page.get_by_role('button',name='Start new draft',exact=True)).to_be_disabled()
    assert page.locator('#cashout-editor').count()==0,'Draft applied without a choice'
    page.locator('#cashout-store').select_option('CR2');page.locator('#cashout-date').fill('2026-10-20')
    page.locator('#draft-preparer').fill('Preparer A')
    page.get_by_role('button',name='Start new draft',exact=True).tap()
    expect(page.get_by_label('Cashier name',exact=True).first).to_be_focused()
    page.get_by_label('Cashier name',exact=True).first.fill('Original A')
    page.locator('#am-0-toast').fill('123.45')
    expect(page.locator('[data-save-state]')).to_have_attribute('data-save-state','device')
    expect(page.locator('#cashout-store')).to_be_disabled();expect(page.locator('#cashout-date')).to_be_disabled()
    def drafts(): return page.evaluate('Object.entries(localStorage).filter(([k])=>k.startsWith("cr-internal-draft:")).map(([key,raw])=>({key,raw,value:JSON.parse(raw)}))')
    first=drafts()[0]
    assert first['value']['context']=={'task':'cash-out','storeId':'CR2','businessDate':'2026-10-20'}
    assert first['value']['preparer']=='Preparer A' and first['value']['knownServerRevision'] is None
    page.get_by_role('button',name='Choose another draft',exact=True).click()
    expect(page.locator('#draft-preparer')).to_be_focused()
    first=next(d for d in drafts() if d['key']==first['key'])
    page.locator('#draft-preparer').fill('Preparer B');page.get_by_role('button',name='Start new draft',exact=True).click()
    expect(page.get_by_label('Cashier name',exact=True).first).to_have_value('')
    page.get_by_label('Cashier name',exact=True).first.fill('Independent B')
    page.get_by_role('button',name='Choose another draft',exact=True).click()
    page.locator('#draft-preparer').fill('Preparer C')
    source=page.locator('li').filter(has_text='Preparer: Preparer A')
    source.get_by_role('button',name='Resume as a copy',exact=True).click()
    expect(page.get_by_label('Cashier name',exact=True).first).to_have_value('Original A')
    expect(page.locator('#am-0-toast')).to_have_value('123.45')
    page.get_by_label('Cashier name',exact=True).first.fill('Independent C')
    # Another editor resumes the same immutable source; each edits a different working ID.
    second=page_new();unlock(second)
    second.locator('#cashout-store').select_option('CR2');second.locator('#cashout-date').fill('2026-10-20')
    second.locator('#draft-preparer').fill('Preparer D')
    second.locator('li').filter(has_text='Preparer: Preparer A').get_by_role('button',name='Resume as a copy',exact=True).click()
    second.get_by_label('Cashier name',exact=True).first.fill('Independent D')
    expect(page.get_by_label('Cashier name',exact=True).first).to_have_value('Independent C')
    values=drafts()
    assert len(values)==4 and sum(d['value']['sourceId']==first['value']['id'] for d in values)==2
    assert page.evaluate('(key)=>localStorage.getItem(key)',first['key'])==first['raw']
    assert page.evaluate('localStorage.getItem("cr-cash-out")')==legacy
    # Corrupt/future sources remain recoverable and are never overwritten by a new draft.
    prefix=first['key'].rsplit(':',1)[0]
    corrupt_key=prefix+':corrupt-fixture';future_key=prefix+':future-fixture'
    future=json.dumps({**first['value'],'id':'future-fixture','schemaVersion':99})
    page.evaluate('([k,v])=>localStorage.setItem(k,v)',[corrupt_key,'{readable broken source'])
    page.evaluate('([k,v])=>localStorage.setItem(k,v)',[future_key,future])
    page.get_by_role('button',name='Choose another draft',exact=True).click()
    expect(page.get_by_text('This draft could not be read.',exact=False)).to_have_count(2)
    unreadable=page.locator('li').filter(has_text='This draft could not be read.').first
    with page.expect_download() as downloaded:
        unreadable.get_by_role('button',name='Download original source',exact=True).click()
    assert downloaded.value.suggested_filename=='internal-draft-source.txt'
    with open(downloaded.value.path(),encoding='utf-8') as f: assert f.read() in ('{readable broken source',future)
    page.locator('#draft-preparer').fill('After corruption')
    page.get_by_role('button',name='Start new draft',exact=True).click()
    page.get_by_role('button',name='Español',exact=True).tap()
    expect(page.get_by_text('Borrador de trabajo · CR2 · 2026-10-20 · After corruption',exact=True)).to_be_visible()
    page.get_by_label('Nombre del cajero',exact=True).first.fill('Conservar tras fallo')
    # Denied writes retain work; handoff must not silently discard it or claim it was saved.
    page.evaluate('() => { window.originalDraftSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(){throw new DOMException("quota","QuotaExceededError")} }')
    page.locator('#am-0-toast').fill('456.78')
    expect(page.locator('[data-save-state]')).to_have_attribute('data-save-state','failed')
    page.get_by_role('button',name='Guardar borrador y bloquear',exact=True).click()
    expect(page.locator('#cashout-editor')).to_be_visible()
    expect(page.locator('#am-0-toast')).to_have_value('456.78')
    with page.expect_download() as current_download:
        page.get_by_role('button',name='Descargar esta copia de trabajo',exact=True).click()
    with open(current_download.value.path(),encoding='utf-8') as f: copy=json.load(f)
    assert copy['payload']['am'][0]['toast']=='456.78' and copy['preparer']=='After corruption'
    assert token not in json.dumps(copy)
    page.evaluate('() => { Storage.prototype.setItem=window.originalDraftSetItem }')
    page.get_by_role('button',name='Guardar borrador y bloquear',exact=True).click()
    expect(page.locator('#cashout-code')).to_be_focused()
    expect(page.locator('#cashout-editor')).not_to_be_visible()
    assert page.evaluate('(k)=>localStorage.getItem(k)',corrupt_key)=='{readable broken source'
    assert page.evaluate('(k)=>localStorage.getItem(k)',future_key)==future
    assert token not in page.evaluate('JSON.stringify({...localStorage})')
    assert not errors,'\n'.join(errors)
    browser.close()
    print('PASS UX-05: explicit new/resume, complete context/preparer/time, independent second editors, intact corrupt/future/legacy sources, recovery downloads, quota preservation, bilingual touch, and safe credential-free handoff')
