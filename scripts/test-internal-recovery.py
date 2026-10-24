"""UX-06 browser acceptance against mocked existing APIs, never live resources."""
import json
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect, Error

base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:3017'
assert urlparse(base).hostname in ('127.0.0.1','localhost')
TOKEN='synthetic-recovery-token'
initial=[{'id':'fixture-sheet','title':'Fixture supplies','useLabel':'Use','showSup':True,'items':[{'id':'fixture-item','name':'Original item','sup':'L','use':'1/2','gray':False}]}]
remote=[{**initial[0],'items':[{**initial[0]['items'][0],'name':'Other editor item','use':'3'}]}]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':768,'height':1024},has_touch=True,permissions=['clipboard-read','clipboard-write'])
    mode={'write':'success','list_rev':1,'list':initial,'cash_write':'success'}
    pending=[];puts=[];errors=[]
    def api(route):
        req=route.request;path=urlparse(req.url).path
        headers={'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,OPTIONS'}
        if req.method=='OPTIONS': route.fulfill(status=204,headers=headers);return
        if req.headers.get('authorization')!='Bearer '+TOKEN: route.fulfill(status=401,json={'error':'unauthorized'},headers=headers);return
        if path=='/api/auth/verify': route.fulfill(status=200,json={'ok':True},headers=headers);return
        if path=='/api/inventory/CR3/list':
            if req.method=='GET': route.fulfill(status=200,json={'rev':mode['list_rev'],'sheets':mode['list']},headers=headers);return
            puts.append(req.post_data_json)
            action=mode['write']
            if action=='hold':
                pending.append((route,headers));page.evaluate('window.__recoveryHeld=true');return
            if action=='offline': route.abort('failed');return
            if action=='auth': route.fulfill(status=401,json={'error':'unauthorized'},headers=headers);return
            if action=='conflict':
                mode['list_rev']=2;mode['list']=remote
                route.fulfill(status=409,json={'error':'conflict','rev':2},headers=headers);return
            mode['list_rev']+=1;mode['list']=req.post_data_json['sheets']
            route.fulfill(status=200,json={'rev':mode['list_rev']},headers=headers);return
        if path.startswith('/api/cashout/') and req.method=='PUT':
            puts.append(req.post_data_json)
            if mode['cash_write']=='auth': route.fulfill(status=401,json={'error':'unauthorized'},headers=headers);return
            route.fulfill(status=200,json={'ok':True},headers=headers);return
        route.fulfill(status=200,json={'days':[]},headers=headers)
    context.route('http://127.0.0.1:8787/**',api)
    def reject_remote(route): errors.append('Unexpected production request: '+route.request.url);route.abort()
    context.route('https://*.workers.dev/**',reject_remote)
    page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(base+'/internal/inventory/');page.wait_for_load_state('networkidle')
    def unlock():
        page.locator('#cashout-code').fill(TOKEN);page.get_by_role('button',name='Unlock',exact=True).click();page.wait_for_load_state('networkidle')
    unlock();page.get_by_role('button',name='Edit list',exact=True).click()
    name=page.locator('input[aria-label$=" name"]').first
    name.fill('Local retained item')
    # In-app navigation cancels without changing the page or entered fields.
    page.evaluate("() => { const a=document.createElement('a');a.href='/internal/';a.textContent='Recovery navigation fixture';document.body.append(a) }")
    page.get_by_role('link',name='Recovery navigation fixture',exact=True).click()
    dialog=page.get_by_role('dialog')
    expect(dialog).to_contain_text('without a reliable device copy')
    page.keyboard.press('Escape');expect(name).to_have_value('Local retained item')
    assert '/internal/inventory' in page.url
    # The actual browser reload dialog is cancelable after user interaction.
    unload=[]
    def cancel_unload(d): unload.append(d.type);d.dismiss()
    page.once('dialog',cancel_unload)
    try: page.reload(timeout=5000)
    except Error: pass
    assert unload==['beforeunload']
    expect(name).to_have_value('Local retained item')
    mode['write']='offline'
    page.get_by_role('button',name='Save list',exact=True).click()
    expect(page.get_by_role('status')).to_contain_text('Could not reach')
    expect(name).to_have_value('Local retained item')
    mode['write']='auth'
    page.get_by_role('button',name='Save list',exact=True).click()
    expect(page.locator('#cashout-code')).to_be_visible()
    expect(name).not_to_be_visible()
    mode['write']='success';unlock()
    expect(name).to_be_visible()
    expect(name).to_have_value('Local retained item')
    expect(page.get_by_role('button',name='Save list',exact=True)).to_be_enabled()
    # Real legacy conflict responses retain the original base and disable blind overwrite.
    mode['write']='conflict'
    page.get_by_role('button',name='Save list',exact=True).click()
    expect(page.get_by_role('button',name='Save list',exact=True)).to_be_disabled()
    expect(name).to_have_value('Local retained item')
    assert puts[-1]['baseRev']==1
    count_after_conflict=len(puts)
    page.get_by_role('button',name='Load server copy to compare',exact=True).click()
    expect(page.get_by_role('table',name='Compare changes',exact=True)).to_be_visible()
    expect(page.get_by_role('cell',name='Other editor item',exact=True)).to_be_visible()
    expect(name).to_have_value('Local retained item')
    assert len(puts)==count_after_conflict
    page.get_by_role('button',name='Copy my changes',exact=True).click()
    expect(page.get_by_text('Your changes were copied.',exact=True)).to_be_visible()
    copied=json.loads(page.evaluate('navigator.clipboard.readText()'))
    assert copied['baseRevision']==1 and copied['sheets'][0]['items'][0]['name']=='Local retained item'
    assert TOKEN not in json.dumps(copied)
    # Compare in Spanish; cancellation still retains local input and its original base.
    page.get_by_role('button',name='Español',exact=True).tap()
    expect(page.get_by_role('table',name='Comparar cambios',exact=True)).to_be_visible()
    page.get_by_role('button',name='Usar la versión del servidor',exact=True).tap()
    expect(dialog).to_contain_text('Primero copie o descargue')
    dialog.get_by_role('button',name='Cancelar',exact=True).tap()
    expect(name).to_have_value('Local retained item')
    with page.expect_download() as download:
        page.get_by_role('button',name='Descargar mis cambios',exact=True).click()
    with open(download.value.path(),encoding='utf-8') as file: exported=json.load(file)
    assert exported['baseRevision']==1 and TOKEN not in json.dumps(exported)
    page.get_by_role('button',name='Usar la versión del servidor',exact=True).click()
    dialog.get_by_role('button',name='Usar la versión del servidor',exact=True).click()
    expect(page.get_by_role('button',name='Editar lista',exact=True)).to_be_focused()
    page.get_by_role('button',name='English',exact=True).click()
    page.get_by_role('button',name='Edit list',exact=True).click()
    expect(name).to_have_value('Other editor item')
    name.fill('Reviewed new edit')
    # Two immediate clicks issue one request while the server response is held.
    mode['write']='hold';before=len(puts)
    page.get_by_role('button',name='Save list',exact=True).evaluate('(button)=>{button.click();button.click()}')
    expect(page.get_by_role('button',name='Save list',exact=True)).to_be_disabled()
    page.wait_for_function('document.querySelector("fieldset")?.disabled === true')
    page.wait_for_function('window.__recoveryHeld === true')
    assert len(puts)==before+1 and puts[-1]['baseRev']==2
    assert pending
    held,headers=pending.pop();mode['list_rev']=3;mode['list']=puts[-1]['sheets']
    held.fulfill(status=200,json={'rev':3},headers=headers)
    expect(page.get_by_role('button',name='Edit list',exact=True)).to_be_visible()
    # Successful acknowledgment clears this editor's navigation warning.
    page.get_by_role('link',name='Recovery navigation fixture',exact=True).click()
    page.wait_for_url(lambda url: urlparse(url).path.rstrip('/') == '/internal')
    # Cash-out retains an in-memory copy through auth failure even when device writes fail.
    page.goto(base+'/internal/bookkeeping/');page.wait_for_load_state('networkidle');unlock()
    page.locator('#draft-preparer').fill('Recovery preparer');page.get_by_role('button',name='Start new draft',exact=True).click()
    page.evaluate('() => { Storage.prototype.setItem=function(){throw new DOMException("quota","QuotaExceededError")} }')
    cashier=page.get_by_label('Cashier name',exact=True).first
    cashier.fill('Keep after auth and quota')
    expect(page.locator('[data-save-state]')).to_have_attribute('data-save-state','failed')
    mode['cash_write']='auth';page.get_by_role('button',name='Save day',exact=True).click()
    expect(page.locator('#cashout-code')).to_be_visible();expect(cashier).not_to_be_visible()
    mode['cash_write']='success';unlock()
    expect(cashier).to_have_value('Keep after auth and quota')
    assert TOKEN not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})')
    assert not errors,'\n'.join(errors)
    browser.close()
    print('PASS UX-06: route/reload cancellation, offline/auth retention, original-base 409 recovery, bilingual compare/copy/download/load, one in-flight save, and cash-out auth recovery after quota denial')
