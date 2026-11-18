"""Step 08: staged sales, real workbooks and synthetic loopback cash. No live APIs."""
import base64, hashlib, json, subprocess, sys, tempfile
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect
from import_browser_helpers import set_source, sales_stage, sales_report
BASE=sys.argv[1]; assert urlparse(BASE).hostname in ('127.0.0.1','localhost')
ROOT=Path(__file__).resolve().parent.parent
ART=ROOT/'docs/internal-tools-overhaul/evidence/step-08/screens'; ART.mkdir(parents=True,exist_ok=True)
fixtures=json.loads(subprocess.check_output(['node','--import','jiti/register','scripts/create-import-fixtures.ts'],cwd=ROOT))
def source(key,name): return {'name':name,'mimeType':'application/octet-stream','buffer':base64.b64decode(fixtures[key])}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--remote-debugging-port=9338'])
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,reduced_motion='reduce')
 errors=[]; external=[]; held=[]; mode={'cash':'hold'}
 cors={'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,POST,OPTIONS'}
 def api(route):
  req=route.request
  if req.method=='OPTIONS':route.fulfill(status=204,headers=cors)
  elif '/api/auth/verify' in req.url:route.fulfill(status=200,json={'ok':True},headers=cors)
  elif req.url.endswith('/api/cashout/CR3/2026-10-20'):
   if mode['cash']=='hold':held.append(route)
   elif mode['cash']=='fail':route.fulfill(status=503,json={},headers=cors)
   else:route.fulfill(status=200,json=cash,headers=cors)
  else:route.fulfill(status=200,json={'days':[]},headers=cors)
 cash={'store':'CR3','date':'2026-10-20','updatedAt':'2026-10-21T01:00:00Z','sheet':{'am':[],'pm':[],'zReport':''},'totals':{'amDeposit':0,'pmDeposit':23456,'amOverShort':None,'pmOverShort':0}}
 def guard(route):
  if urlparse(route.request.url).hostname in ('127.0.0.1','localhost'):route.continue_()
  else:external.append(route.request.url);route.abort()
 context.route('**/*',guard); context.route('http://127.0.0.1:8787/**',api)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept() if d.type=='beforeunload' else d.dismiss())
 page.goto(BASE+'/internal/bookkeeping/#sales');page.wait_for_load_state('networkidle');page.locator('#tab-sales').click()
 # Unknown context never gets authority from filenames; explicit selections survive consistent metadata.
 for slot in ('general','lunch','dinner'):set_source(page,'#sc-file-'+slot,source('review-'+slot,'CR2-2020-01-01.xlsx'))
 expect(page.locator('#sc-date')).to_have_value('');expect(page.locator('#sc-location')).to_have_value('')
 page.locator('#sc-prepare').click();expect(page.locator('#sc-location')).to_be_focused()
 page.locator('#sc-date').fill('2026-10-20');page.locator('#sc-location').select_option(index=1);page.locator('#sc-first').fill('Synthetic preparer')
 page.locator('#sc-prepare').click();expect(page.locator('[data-sales-stage]')).to_be_focused()
 expect(page.locator('[data-sales-check=lunch-sales]')).to_contain_text('Difference — review required')
 expect(page.locator('[data-sales-check=payments]')).to_contain_text('$65.44')
 expect(page.locator('[data-sales-check=cash-deposits]')).to_contain_text('Missing total/detail')
 expect(page.locator('#sc-accept')).to_be_disabled()
 page.locator('#sales-context-reason').fill('Source metadata is unknown. Manager checked CR3 business date.')
 page.locator('#sales-reviewed').check()
 # Actual cash edits recompute immediately; zero differs from blank, invalid raw amount blocks acceptance.
 page.locator('#sc-amDeposit').fill('12oops');expect(page.locator('#sc-accept')).to_be_disabled()
 page.locator('#sc-amDeposit').fill('0');page.locator('#sc-pmDeposit').fill('$234.56')
 expect(page.locator('[data-sales-check=cash-deposits]')).to_contain_text('Difference: $0.00')
 expect(page.locator('#sales-reviewed')).not_to_be_checked()
 page.locator('#sales-source-details summary').click()
 expect(page.get_by_role('region',name='Figures copied to the workbook',exact=True).get_by_role('row')).to_have_count(19)
 expect(page.locator('#sales-figure-C5')).to_contain_text('$234.56')
 page.locator('#sales-reviewed').check()
 page.screenshot(path=str(ART/'review-desktop.png'),full_page=True)
 # Back navigation retains native file objects, acknowledgement and context explanation.
 sales_stage(page,'files');assert page.locator('#sc-file-general').evaluate('(e)=>e.files[0].name')=='CR2-2020-01-01.xlsx'
 page.locator('#sc-file-general').set_input_files(source('bad','replacement.xlsx'))
 page.get_by_role('dialog').locator('button').first.click()
 assert page.locator('#sc-file-general').evaluate('(e)=>e.files[0].name')=='CR2-2020-01-01.xlsx'
 sales_stage(page,'review');expect(page.locator('#sales-reviewed')).to_be_checked()
 # Failed template retains values and acceptance; retry generates before an explicit download.
 page.route('**/internal/daily-sales-template.xlsx',lambda r:r.fulfill(status=503))
 page.locator('#sc-accept').click();expect(page.locator('#sc-status')).to_contain_text('could not be generated')
 page.unroute('**/internal/daily-sales-template.xlsx');sales_report(page)
 expect(page.locator('#sc-status')).to_contain_text('Report generated')
 with page.expect_download() as downloaded:page.locator('#sc-download').click()
 path=downloaded.value.path(); first=hashlib.sha256(Path(path).read_bytes()).hexdigest()
 cells=json.loads(subprocess.check_output(['node','-e',"const x=require('xlsx'),w=x.readFile(process.argv[1]),s=w.Sheets.DATAINPUT;console.log(JSON.stringify(Object.fromEntries(['B1','B2','B3','C4','C5','C6','C7','C8','C9','C13','C18','C23'].map(k=>[k,s[k]?.v??null]))))",path],cwd=ROOT))
 assert cells=={'B1':'Synthetic preparer','B2':'TUE','B3':'2026-10-20','C4':0,'C5':234.56,'C6':None,'C7':None,'C8':1234.56,'C9':234.56,'C13':1000,'C18':500,'C23':53.63},cells
 context.set_offline(True)
 with page.expect_download() as again:page.locator('#sc-download').click()
 assert hashlib.sha256(Path(again.value.path()).read_bytes()).hexdigest()==first
 context.set_offline(False)
 # Restore/device copies covered by retention suite. Late and failed fills preserve newer cash edits.
 page.locator('#tab-cash-out').click();page.locator('#cashout-code').fill('synthetic-stages');page.get_by_role('button',name='Unlock',exact=True).click();expect(page.locator('#cashout-store')).to_be_visible()
 page.locator('#tab-sales').click();sales_stage(page,'review')
 page.get_by_role('button',name='Fill from cash-out',exact=True).click();page.wait_for_timeout(100);assert held
 page.locator('#sc-amDeposit').fill('10');held.pop().fulfill(status=200,json=cash,headers=cors)
 expect(page.locator('#sc-amDeposit')).to_have_value('10');expect(page.locator('#sales-reviewed')).not_to_be_checked()
 mode['cash']='fail';page.get_by_role('button',name='Fill from cash-out',exact=True).click();expect(page.locator('#sc-status')).to_contain_text('not set up')
 expect(page.locator('#sc-amDeposit')).to_have_value('10')
 mode['cash']='ok';page.get_by_role('button',name='Fill from cash-out',exact=True).click();expect(page.locator('#sc-amDeposit')).to_have_value('0.00');expect(page.locator('#sc-amOverShort')).to_have_value('')
 expect(page.locator('[data-sales-check=cash-deposits]')).to_contain_text('Difference: $0.00')
 # Metadata prefill only on blank fields; no overwrite of explicit date/store.
 sales_stage(page,'files')
 for slot in ('general','lunch','dinner'):set_source(page,'#sc-file-'+slot,source('context-'+slot,slot+'.xlsx'))
 expect(page.locator('#sc-date')).to_have_value('2026-10-20')
 page.locator('#sc-date').fill('2026-10-21');set_source(page,'#sc-file-general',source('context-general','again.xlsx'));expect(page.locator('#sc-date')).to_have_value('2026-10-21')
 page.locator('#sc-date').fill('');set_source(page,'#sc-file-general',source('context-general','again.xlsx'));expect(page.locator('#sc-date')).to_have_value('2026-10-20')
 page.locator('#sc-prepare').click();expect(page.locator('#sales-context-reason')).to_have_count(0)
 # Emulated desktop/tablet/phone/enlarged Spanish, keyboard and print language.
 for width,name in [(768,'review-tablet'),(390,'review-phone'),(320,'review-small')]:
  page.set_viewport_size({'width':width,'height':1000})
  if width==320:page.get_by_role('button',name='Español',exact=True).click();page.evaluate('document.documentElement.style.fontSize="32px"')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
  page.screenshot(path=str(ART/(name+'.png')),full_page=True)
 page.evaluate('document.documentElement.style.fontSize="16px"');page.set_viewport_size({'width':1440,'height':1000})
 page.locator('#sales-reviewed').focus();page.keyboard.press('Space');expect(page.locator('#sales-reviewed')).to_be_checked()
 page.evaluate('window.dispatchEvent(new Event("beforeprint"))');expect(page.locator('#sales-review-title')).to_have_text('Review extracted sales figures')
 page.pdf(path=str(ART/'review-english.pdf'),format='Letter');page.evaluate('window.dispatchEvent(new Event("afterprint"))')
 # Passive REA records the actual selected loopback page, after Playwright actions.
 from urllib.request import urlopen
 targets=json.load(urlopen('http://127.0.0.1:9338/json/list'));target=next(item['id'] for item in targets if item.get('url')==page.url)
 subprocess.run(['rea-project','run','--project',str(ROOT),'--','inspect-web-page','http://127.0.0.1:9338',target,'--include-accessibility-text','--include-storage-keys','--json'],check=True,stdout=subprocess.DEVNULL)
 assert not errors,errors;assert not external,external
 (ART/'results.json').write_text(json.dumps({'workbook_cells':cells,'repeat_sha256':first,'page_errors':errors,'external_attempts':external,'viewports':[1440,768,390,320],'limitations':['Synthetic loopback APIs only','Physical device, staff review and live services unverified']},indent=2))
 context.close();browser.close()
 print('PASS Step 08 staged review: context, issues, cash, cancellation, failed template/retry, independent workbook cells, cached repeat, late/failed fills, layouts, EN/ES, keyboard and REA')
