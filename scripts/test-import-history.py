"""IMPORT-07 acceptance: reviewed-values history, no raw upload, explicit reprocess."""
import sys,csv,io,json,hashlib
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
from import_browser_helpers import set_source
BASE=sys.argv[1];assert urlparse(BASE).hostname in ('127.0.0.1','localhost')
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True);context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,accept_downloads=True)
  state={'records':{},'mode':'ok','posts':[]};errors=[];remote=[]
  cors={'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,POST,OPTIONS'}
  def api(route):
   req=route.request
   if req.method=='OPTIONS':route.fulfill(status=204,headers=cors);return
   if '/api/auth/verify' in req.url:route.fulfill(status=200,json={'ok':True},headers=cors);return
   if '/api/internal/import-history/CR3' in req.url:
    if req.method=='GET':route.fulfill(status=200,json={'records':list(state['records'].values()),'nextCursor':None},headers=cors);return
    body=req.post_data_json;state['posts'].append(body)
    if state['mode']=='fail':route.fulfill(status=503,json={'error':{'code':'unavailable'}},headers=cors);return
    if body['id'] in state['records']:route.fulfill(status=409,json={'error':{'code':'revision_conflict'}},headers=cors);return
    record={'schemaVersion':1,'family':'import','storeId':'CR3','id':body['id'],'revision':1,'context':{'kind':'period','start':'2026-10-01','end':'2026-10-31'},'createdAt':'2026-10-24T12:00:00.000Z','updatedAt':'2026-10-24T12:00:00.000Z','data':body['mutation']['data']}
    state['records'][record['id']]=record;route.fulfill(status=200,json={'record':record},headers=cors);return
   route.fulfill(status=200,json={'days':[]},headers=cors)
  context.route('http://127.0.0.1:8787/**',api)
  def reject(r):remote.append(r.request.url);r.abort()
  context.route('https://*.workers.dev/**',reject)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/internal/bookkeeping/');page.wait_for_load_state('networkidle')
  page.locator('#cashout-code').fill('synthetic-history-token');page.get_by_role('button',name='Unlock',exact=True).tap();expect(page.locator('#cashout-store')).to_be_visible()
  page.locator('#tab-hours').tap();page.locator('#hc-location').select_option(index=1);page.locator('#hc-start').fill('2026-10-01');page.locator('#hc-end').fill('2026-10-31');page.locator('#hc-preparer').fill('Synthetic preparer')
  s=io.StringIO();w=csv.writer(s);w.writerow(['Employee External Id','Employee','Job Title','In Date','Out Date','Total Hours','Regular Hours','Overtime Hours']);w.writerow(['e1','Synthetic worker','Cook','10/24/2026 08:00 AM','10/24/2026 04:00 PM','8','7.5','0.5']);raw=s.getvalue().encode()
  set_source(page,'#hc-file',{'name':'original.csv','mimeType':'text/csv','buffer':raw})
  history=page.locator('#panel-hours').get_by_role('region',name='Shared import history',exact=True)
  expect(history.locator('[data-history=save]')).to_be_disabled();page.locator('#hours-reviewed').check()
  with page.expect_download():page.locator('#hc-download').tap()
  state['mode']='fail';history.locator('[data-history=save]').tap();expect(history).to_contain_text('unavailable or not configured')
  expect(page.locator('#hc-preparer')).to_have_value('Synthetic preparer');operation=state['posts'][-1]['mutation']['operationId']
  state['mode']='ok';history.locator('[data-history=save]').tap();expect(history).to_contain_text('Reviewed import saved to server')
  assert state['posts'][-1]['mutation']['operationId']==operation
  root=next(iter(state['records']));original=json.dumps(state['records'][root],sort_keys=True)
  data=state['records'][root]['data'];assert data['snapshot']['output'] is None and 'base64' not in json.dumps(data)
  assert data['sources'][0]['fingerprint']=='sha256:'+hashlib.sha256(raw).hexdigest()
  history.locator('[data-history=save]').tap();expect(history).to_contain_text('already recorded');assert len(state['records'])==1
  history.locator('[data-history=reprocess]').tap();page.get_by_role('dialog').locator('button').last.tap();expect(history).to_contain_text('Reviewed import saved to server')
  assert len(state['records'])==2;child=next(record for key,record in state['records'].items() if key!=root);assert child['data']['supersedesId']==root
  assert json.dumps(state['records'][root],sort_keys=True)==original
  history.locator('[data-history=load]').tap();expect(history.locator('[data-history=resume]')).to_have_count(2)
  history.locator('[data-history=resume]').first.tap();page.get_by_role('dialog').locator('button').last.tap()
  expect(page.locator('#hours-reviewed')).not_to_be_checked();assert page.locator('#hc-file').evaluate('(input)=>input.files.length')==0
  page.locator('#hours-reviewed').check();context.set_offline(True)
  with page.expect_download() as result:page.locator('#hc-download').tap()
  assert result.value.suggested_filename=='CR3_26_1001-26_1031_EMPLOYEE_HOUR_LOG_SUMMARY.xlsx';context.set_offline(False)
  page.get_by_role('button',name='Español',exact=True).tap();assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.locator('#hc-location').select_option(index=2);expect(page.locator('#panel-hours [data-history=resume]')).to_have_count(0)
  assert 'synthetic-history-token' not in page.evaluate('JSON.stringify(localStorage)');assert not errors,errors;assert not remote,remote
  context.close();browser.close();print('PASS IMPORT-07: exact-byte fingerprint, no raw/workbook upload, failed-save same-operation retry, duplicate gate, preserved reprocess lineage, context isolation, reviewed resume/offline regeneration and Spanish phone')
if __name__=='__main__':run()
