"""IMPORT-08 browser checks: selected sources, mapping, combined estimates and recovery."""
import sys,json,subprocess,tempfile
import fitz
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
BASE=sys.argv[1];assert urlparse(BASE).hostname in ('127.0.0.1','localhost')
ROOT=Path(__file__).resolve().parent.parent
fixtures=json.loads(subprocess.check_output(['node','--import','jiti/register','scripts/create-comparison-fixtures.ts'],cwd=ROOT))
def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True);context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,accept_downloads=True)
  state={'fail':False,'writes':[]};errors=[];remote=[]
  for value in fixtures.values():value['directory']['data']['mappings']=[m for m in value['directory']['data']['mappings'] if m['system']=='toast']
  cors={'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,OPTIONS'}
  def api(route):
   req=route.request;path=urlparse(req.url).path
   if req.method=='OPTIONS':route.fulfill(status=204,headers=cors);return
   if path=='/api/auth/verify':route.fulfill(status=200,json={'ok':True},headers=cors);return
   if path.startswith('/api/internal/'):
    if state['fail']:route.fulfill(status=503,json={'error':{'code':'unavailable'}},headers=cors);return
    store=path.rsplit('/',1)[-1];value=fixtures[store]
    if 'import-directory' in path:
     if req.method=='PUT':
      body=req.post_data_json;state['writes'].append(body);assert body['mutation']['baseRevision']==value['directory']['revision'];value['directory']['revision']+=1;value['directory']['data']=body['mutation']['data']
     route.fulfill(status=200,json={'record':value['directory']},headers=cors);return
    if 'import-schedules' in path:route.fulfill(status=200,json=value['page'],headers=cors);return
    if 'import-history' in path:route.fulfill(status=200,json={'records':value['imports'],'nextCursor':None},headers=cors);return
   route.fulfill(status=200,json={'days':[]},headers=cors)
  context.route('http://127.0.0.1:8787/**',api)
  def reject(r):remote.append(r.request.url);r.abort()
  context.route('https://*.workers.dev/**',reject)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/internal/bookkeeping/');page.wait_for_load_state('networkidle');page.locator('#cashout-code').fill('synthetic-comparison-token');page.get_by_role('button',name='Unlock',exact=True).tap();expect(page.locator('#cashout-store')).to_be_visible()
  page.locator('#tab-comparison').tap();page.locator('#comparison-start').fill('2026-10-01');page.locator('#comparison-end').fill('2026-10-31');page.locator('#comparison-preparer').fill('Synthetic comparison reviewer')
  page.locator('#comparison-load').tap();expect(page.locator('#comparison-run')).to_be_enabled();page.locator('#comparison-run').tap()
  expect(page.locator('#comparison-result-title')).to_have_text('Observed scheduled versus actual hours')
  expect(page.locator('#panel-comparison')).to_contain_text('Published assignments have no reviewed shared identity')
  for store in ('CR2','CR3'):
   identity=fixtures[store]['directory']['data']['employees'][0]['id'];page.locator(f'#schedule-map-{store}-0').select_option(identity)
   page.get_by_role('region',name='Published snapshot identity review '+store,exact=True).locator('[data-schedule-mapping=save]').tap()
   expect(page.get_by_role('region',name='Published snapshot identity review '+store,exact=True).locator('[data-schedule-mapping=save]')).to_be_disabled()
  page.locator('#comparison-run').tap();expect(page.locator('[data-comparison=combined]')).to_contain_text('source hours: 48')
  expect(page.locator('[data-comparison=combined]')).to_contain_text('unique mapped identities: 1')
  expect(page.locator('#panel-comparison')).to_contain_text('Mapped published assignments overlap')
  assert len(state['writes'])==2
  with page.expect_download() as event:page.locator('#comparison-download').tap()
  with tempfile.TemporaryDirectory() as temp:
   path=Path(temp)/'evidence.json';event.value.save_as(path);report=json.loads(path.read_text())
   assert report['combinedTotals']['includedHours']==48 and report['combinedTotals']['mappedActualHours']==34 and report['combinedTotals']['unmatchedActualHours']==14
   assert len(report['combinedEmployees'])==1 and report['combinedEmployees'][0]['actualHours']==34
   assert len(report['unmatchedActual'])==2 and len(report['overlaps'])==1
   assert report['directoryRevisions']==[{'storeId':'CR2','revision':2},{'storeId':'CR3','revision':2}]
   assert 'synthetic-comparison-token' not in path.read_text()
  page.get_by_role('button',name='Español',exact=True).tap();expect(page.locator('#comparison-result-title')).to_have_text('Comparación observada de horario y horas reales')
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.evaluate("window.dispatchEvent(new Event('beforeprint'))");expect(page.locator('#comparison-result-title')).to_have_text('Observed scheduled versus actual hours')
  with tempfile.TemporaryDirectory() as temp:
   pdf=Path(temp)/'comparison.pdf';page.emulate_media(media='print');page.pdf(path=str(pdf),format='Letter',print_background=True,margin={'top':'0.35in','bottom':'0.35in','left':'0.35in','right':'0.35in'});page.emulate_media(media='screen')
   document=fitz.open(pdf);text=' '.join(' '.join(p.get_text() for p in document).split())
   assert 'Observed scheduled versus actual hours' in text and 'Combined hours by shared employee' in text
   assert 'Explicit shared identity' in text and 'unique mapped identities: 1' in text
   assert 'Load reviewed sources and schedules' not in text
   for printed_page in document:
    assert all(word[0]>=-1 and word[2]<=printed_page.rect.width+1 for word in printed_page.get_text('words'))
   assert 1<=len(document)<=8
  page.evaluate("window.dispatchEvent(new Event('afterprint'))");expect(page.locator('#comparison-result-title')).to_have_text('Comparación observada de horario y horas reales')
  page.get_by_role('button',name='English',exact=True).tap();page.locator('#comparison-end').fill('2026-10-30');expect(page.locator('#comparison-run')).to_be_disabled()
  state['fail']=True;page.locator('#comparison-load').tap();page.get_by_role('dialog').locator('button').last.tap();expect(page.locator('#panel-comparison')).to_contain_text('unavailable or not configured')
  expect(page.locator('#comparison-result-title')).to_be_visible();expect(page.locator('#panel-comparison')).to_contain_text('2026-10-01 to 2026-10-31')
  expect(page.locator('#comparison-end')).to_have_value('2026-10-30')
  page.locator('#tab-cash-out').tap();page.locator('#draft-preparer').fill('Synthetic handoff');page.get_by_role('button',name='Start new draft',exact=True).tap();page.get_by_role('button',name='Save draft and lock',exact=True).tap();page.locator('#tab-comparison').tap()
  expect(page.locator('#comparison-result-title')).not_to_be_visible();expect(page.locator('#comparison-end')).to_have_value('2026-10-30')
  assert not errors,errors;assert not remote,remote
  context.close();browser.close();print('PASS IMPORT-08: missing identity limitations, explicit publication mappings, reviewed source selection, reconciled per-store/combined hours, one shared identity, source regular/overtime separation, overlap evidence JSON, Spanish phone/print and failed reload preserving prior snapshot')
if __name__=='__main__':run()
