"""IMPORT-06 browser acceptance, simulated loopback API and synthetic identities."""
import sys,csv,io,json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
from import_browser_helpers import set_source
BASE=sys.argv[1];assert urlparse(BASE).hostname in ('127.0.0.1','localhost')
HEADERS=['Employee External Id','Employee','Job Title','In Date','Out Date','Total Hours','Regular Hours','Overtime Hours']
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True);context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,accept_downloads=True)
  state={'record':None,'mode':'ok','writes':[]};errors=[];remote=[]
  cors={'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,OPTIONS'}
  def api(route):
   req=route.request
   if req.method=='OPTIONS':route.fulfill(status=204,headers=cors);return
   if '/api/auth/verify' in req.url:route.fulfill(status=200,json={'ok':True},headers=cors);return
   if '/api/internal/import-directory/CR3' in req.url:
    if state['mode']=='absent':route.fulfill(status=503,json={'error':{'code':'backend_unconfigured'}},headers=cors);return
    if req.method=='GET':route.fulfill(status=200,json={'record':state['record']},headers=cors);return
    data=req.post_data_json;state['writes'].append(data)
    if state['mode']=='conflict':route.fulfill(status=409,json={'error':{'code':'revision_conflict'}},headers=cors);return
    revision=(state['record']['revision'] if state['record'] else 0)+1
    record={'schemaVersion':1,'family':'employee-mapping','id':'imports-directory','storeId':'CR3','context':{'kind':'undated'},'revision':revision,'createdAt':'2026-10-24T12:00:00.000Z','updatedAt':'2026-10-24T12:00:00.000Z','data':data['mutation']['data']}
    state['record']=record;route.fulfill(status=200,json={'record':record},headers=cors);return
   route.fulfill(status=200,json={'days':[]},headers=cors)
  context.route('http://127.0.0.1:8787/**',api)
  def reject(r):remote.append(r.request.url);r.abort()
  context.route('https://*.workers.dev/**',reject)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/internal/bookkeeping/');page.wait_for_load_state('networkidle')
  page.locator('#cashout-code').fill('synthetic-import-token');page.get_by_role('button',name='Unlock',exact=True).tap();expect(page.locator('#cashout-store')).to_be_visible()
  page.locator('#tab-hours').tap();page.locator('#hc-location').select_option(index=1);page.locator('#hc-start').fill('2026-10-24');page.locator('#hc-end').fill('2026-10-24');page.locator('#hc-preparer').fill('Synthetic manager')
  s=io.StringIO();w=csv.writer(s);w.writerow(HEADERS)
  for external in ('','source-one','source-two'):w.writerow([external,'Same Name','Cook','10/24/2026 08:00 AM','10/24/2026 04:00 PM','8','7.5','0.5'])
  set_source(page,'#hc-file',{'name':'identities.csv','mimeType':'text/csv','buffer':s.getvalue().encode()})
  page.locator('#hours-reviewed').check();expect(page.locator('#hc-download')).to_be_disabled()
  state['mode']='absent';page.locator('#mapping-load').tap();expect(page.locator('#panel-hours')).to_contain_text('unavailable or not configured')
  expect(page.locator('#hc-preparer')).to_have_value('Synthetic manager');state['mode']='ok';page.locator('#mapping-load').tap();expect(page.locator('#mapping-new-name')).to_be_visible()
  for _ in range(2):page.locator('#mapping-new-name').fill('Same Name');page.locator('#mapping-add').tap()
  choices=page.locator('#mapping-row-2 option').evaluate_all('(options)=>options.map(o=>o.value).filter(Boolean)');assert len(choices)==2 and choices[0]!=choices[1]
  page.locator('#mapping-row-2').select_option(choices[0]);page.locator('#mapping-row-3').select_option(choices[0]);page.locator('#mapping-row-4').select_option(choices[1])
  expect(page.locator('#hc-download')).to_be_disabled()
  page.locator('#hc-end').fill('2026-10-25');page.get_by_role('dialog').locator('button').first.tap();expect(page.locator('#hc-end')).to_have_value('2026-10-24');expect(page.locator('#mapping-row-4')).to_have_value(choices[1])
  state['mode']='conflict';page.locator('#mapping-save').tap();expect(page.locator('#panel-hours')).to_contain_text('Another editor saved a newer revision')
  expect(page.locator('#mapping-row-4')).to_have_value(choices[1]);assert state['record'] is None
  first_operation=state['writes'][-1]['mutation']['operationId'];state['mode']='ok';page.locator('#mapping-save').tap();expect(page.locator('#panel-hours')).to_contain_text('Mappings saved to server')
  assert state['writes'][-1]['mutation']['operationId']==first_operation
  assert len(state['record']['data']['mappings'])==3
  assert state['record']['data']['mappings'][0]['externalId'].startswith('row:sha256:')
  page.locator('#hours-reviewed').check();expect(page.locator('#hc-download')).to_be_enabled()
  with page.expect_download():page.locator('#hc-download').tap()
  page.get_by_role('button',name='Español',exact=True).tap();expect(page.locator('#mapping-title')).to_have_text('Asignaciones revisadas de ID del personal')
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  assert 'synthetic-import-token' not in page.evaluate('JSON.stringify(localStorage)')
  assert not errors,errors;assert not remote,remote
  context.close();browser.close();print('PASS IMPORT-06: missing source ID retained, same-name UUID choices, exact row fingerprint mapping, absent backend, conflict preservation/same-operation retry, server revision, acknowledged export, Spanish phone and no persisted token')
if __name__=='__main__':run()
