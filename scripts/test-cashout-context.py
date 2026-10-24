"""CASH-01: explicit legacy assignment, four contexts, reloads and late responses.
Requires a local Next dev server using the loopback API override.
"""
import json
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:3017'
assert urlparse(base).hostname in ('127.0.0.1','localhost')
TOKEN='synthetic-cash-context-token'
legacy={'am':[{'name':'Original legacy cashier','counts':[3]+[0]*10,'toast':'125.50'}],'pm':[],'zReport':'600.25'}
raw=json.dumps(legacy,ensure_ascii=False)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':768,'height':1024},has_touch=True)
    pending=[];errors=[];mode={'hold_day':False};puts=[]
    def api(route):
        request=route.request
        headers={'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,OPTIONS'}
        path=urlparse(request.url).path
        if request.method=='OPTIONS': route.fulfill(status=204,headers=headers)
        elif request.headers.get('authorization')!='Bearer '+TOKEN: route.fulfill(status=401,json={'error':'unauthorized'},headers=headers)
        elif '/api/auth/verify' in path: route.fulfill(status=200,json={'ok':True},headers=headers)
        elif request.method=='PUT': puts.append(request.post_data_json);route.fulfill(status=200,json={'ok':True},headers=headers)
        elif path.count('/')==4 and mode['hold_day']: pending.append((route,headers))
        elif path.count('/')==4: route.fulfill(status=200,json={'sheet':legacy},headers=headers)
        else: route.fulfill(status=200,json={'days':[]},headers=headers)
    context.route('http://127.0.0.1:8787/**',api)
    def remote(route): errors.append('Unexpected production request: '+route.request.url);route.abort()
    context.route('https://*.workers.dev/**',remote)
    page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(base+'/internal/bookkeeping/');page.wait_for_load_state('networkidle')
    page.evaluate('(raw)=>localStorage.setItem("cr-cash-out",raw)',raw)
    def unlock():
        page.locator('#cashout-code').fill(TOKEN)
        page.get_by_role('button',name='Unlock',exact=True).click()
        expect(page.locator('#draft-preparer')).to_be_visible()
    def choose(store,date,preparer):
        page.locator('#cashout-store').select_option(store)
        page.locator('#cashout-date').fill(date)
        page.locator('#draft-preparer').fill(preparer)
    def start_new(store,date,preparer):
        choose(store,date,preparer)
        page.get_by_role('button',name='Start new draft',exact=True).click()
        expect(page.get_by_label('Cashier name',exact=True).first).to_be_visible()
    def leave():
        page.get_by_role('button',name='Choose another draft',exact=True).click()
        expect(page.locator('#draft-preparer')).to_be_visible()
    def source_row(preparer):
        return page.locator('li').filter(has=page.get_by_text('Preparer: '+preparer,exact=True))
    unlock()
    assert page.locator('#cashout-editor').count()==0
    choose('CR2','2026-10-20','CR2-2026-10-20')
    assignment=page.get_by_role('button',name='Use older draft for selected store/date',exact=True)
    assignment.click();dialog=page.get_by_role('dialog')
    expect(dialog).to_contain_text('CR2');expect(dialog).to_contain_text('2026-10-20')
    page.keyboard.press('Escape')
    expect(assignment).to_be_focused()
    assert page.locator('#cashout-editor').count()==0
    assert page.evaluate('Object.keys(localStorage).filter(k=>k.startsWith("cr-internal-draft:")).length')==0
    # Spanish confirmation gives the exact selected context and leaves the source intact.
    page.get_by_role('button',name='Español',exact=True).tap()
    page.get_by_role('button',name='Usar el borrador anterior para la tienda y fecha elegidas',exact=True).tap()
    expect(dialog).to_contain_text('CR2');expect(dialog).to_contain_text('2026-10-20')
    dialog.get_by_role('button',name='Confirmar',exact=True).tap()
    expect(page.get_by_label('Nombre del cajero',exact=True).first).to_have_value('Original legacy cashier')
    expect(page.locator('#am-0-10000')).to_have_value('3')
    expect(page.locator('#am-0-toast')).to_have_value('125.50')
    expect(page.locator('#z-report')).to_have_value('600.25')
    assert page.evaluate('localStorage.getItem("cr-cash-out")')==raw
    assert not puts,'Assignment must remain a local draft operation'
    page.get_by_role('button',name='English',exact=True).click()
    combinations=[('CR2','2026-10-20'),('CR2','2026-10-21'),('CR3','2026-10-20'),('CR3','2026-10-21')]
    for index,(store,date) in enumerate(combinations):
        if index:
            start_new(store,date,store+'-'+date)
            expect(page.get_by_label('Cashier name',exact=True).first).to_have_value('')
        page.get_by_label('Cashier name',exact=True).first.fill(store+' '+date)
        page.locator('#am-0-10000').fill(str(index+1))
        page.locator('#am-0-toast').fill(str(index+1)+'11.25')
        page.locator('#z-report').fill(str(index+1)+'99.99')
        leave()
    # Reload requires explicit selection/resume; none is assigned today's context automatically.
    page.reload();page.wait_for_load_state('networkidle');unlock()
    assert page.locator('#cashout-editor').count()==0
    for index,(store,date) in enumerate(combinations):
        choose(store,date,'Resume '+store+'-'+date)
        source_row(store+'-'+date).get_by_role('button',name='Resume as a copy',exact=True).click()
        expect(page.get_by_label('Cashier name',exact=True).first).to_have_value(store+' '+date)
        expect(page.locator('#am-0-10000')).to_have_value(str(index+1))
        expect(page.locator('#am-0-toast')).to_have_value(str(index+1)+'11.25')
        expect(page.locator('#z-report')).to_have_value(str(index+1)+'99.99')
        expect(page.locator('#cashout-store')).to_have_value(store)
        expect(page.locator('#cashout-date')).to_have_value(date)
        leave()
    for index in range(12):
        store,date=combinations[index%4]
        choose(store,date,'Rapid selection')
    store,date=combinations[3]
    expect(source_row(store+'-'+date)).to_be_visible()
    for text in page.locator('li > p.font-medium').all_text_contents():
        assert store in text and date in text,'Chooser showed another context after a rapid switch'
    # A load from an unmounted editor cannot open a dialog or replace the newer record.
    mode['hold_day']=True
    choose('CR2','2026-10-20','Late request source')
    source_row('CR2-2026-10-20').get_by_role('button',name='Resume as a copy',exact=True).click()
    page.get_by_role('button',name='Load saved',exact=True).click()
    expect(page.locator('[data-save-state]')).to_contain_text('Loading')
    assert pending
    leave();start_new('CR3','2026-10-21','Target after late read')
    page.get_by_label('Cashier name',exact=True).first.fill('Keep after late 200')
    held,headers=pending.pop();late={**legacy,'am':[{**legacy['am'][0],'name':'LATE OLD SHEET'}]}
    held.fulfill(status=200,json={'sheet':late},headers=headers)
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('dialog')).not_to_be_visible()
    expect(page.get_by_label('Cashier name',exact=True).first).to_have_value('Keep after late 200')
    # A late 401 belongs to the old editor and cannot lock the new one.
    page.get_by_role('button',name='Load saved',exact=True).click()
    expect(page.locator('[data-save-state]')).to_contain_text('Loading')
    assert pending
    leave();start_new('CR3','2026-10-20','Target after late auth')
    page.get_by_label('Cashier name',exact=True).first.fill('Keep after late 401')
    held,headers=pending.pop();held.fulfill(status=401,json={'error':'unauthorized'},headers=headers)
    page.wait_for_load_state('networkidle')
    expect(page.locator('#cashout-code')).not_to_be_visible()
    expect(page.get_by_label('Cashier name',exact=True).first).to_have_value('Keep after late 401')
    # Denied writes block a context change and retain the last entered value.
    page.evaluate('() => { Storage.prototype.setItem=function(){throw new DOMException("denied","SecurityError")} }')
    page.get_by_label('Cashier name',exact=True).first.fill('Retain after denied storage')
    expect(page.locator('[data-save-state]')).to_have_attribute('data-save-state','failed')
    page.get_by_role('button',name='Choose another draft',exact=True).click()
    expect(page.get_by_label('Cashier name',exact=True).first).to_have_value('Retain after denied storage')
    assert page.evaluate('localStorage.getItem("cr-cash-out")')==raw
    # Malformed legacy source offers recovery, with no assignment/coercion.
    broken=context.new_page();broken.on('pageerror',lambda error:errors.append(str(error)))
    broken.goto(base+'/internal/bookkeeping/');broken.wait_for_load_state('networkidle')
    broken.evaluate('localStorage.setItem("cr-cash-out","{broken original source")')
    broken.locator('#cashout-code').fill(TOKEN);broken.get_by_role('button',name='Unlock',exact=True).click()
    expect(broken.get_by_text('This older draft could not be assigned.',exact=False)).to_be_visible()
    expect(broken.get_by_role('button',name='Use older draft for selected store/date',exact=True)).not_to_be_visible()
    with broken.expect_download() as download:
        # The last original-source button is the legacy recovery action, outside scoped draft rows.
        broken.get_by_role('button',name='Download original source',exact=True).last.click()
    with open(download.value.path(),encoding='utf-8') as file: assert file.read()=='{broken original source'
    assert not errors,'\n'.join(errors)
    browser.close()
    print('PASS CASH-01: explicit bilingual legacy assignment/cancel, all CR2/CR3 × two-date reloads, rapid context switches, late 200/401 guards, storage denial retention and malformed-source recovery')
