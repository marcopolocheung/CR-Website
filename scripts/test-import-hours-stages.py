"""Step09 focused stages, independent hours oracle and final local visual/REA evidence."""
import csv,io,json,hashlib,subprocess,sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
from import_browser_helpers import set_source,hours_review,hours_stage,hours_report, hours_copies
BASE=sys.argv[1];assert urlparse(BASE).hostname in ('127.0.0.1','localhost')
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'docs/internal-tools-overhaul/evidence/step-09/screens';ART.mkdir(parents=True,exist_ok=True)
HEADERS=['Employee External Id','Employee','Job Title','In Date','Out Date','Total Hours','Regular Hours','Overtime Hours']
def csvfile():
 text=io.StringIO();w=csv.writer(text);w.writerow(HEADERS);w.writerow([])
 for row in [
 ['E-A','Synthetic A','Cook','10/24/2026 11:00 PM','10/25/2026 02:00 AM',3,2.5,.5],
 ['E-A','Synthetic A','Cook','10/24/2026 08:00 AM','10/24/2026 04:00 PM',8,7,1],
 ['E-B','Synthetic B','Server','10/25/2026 08:00 AM','10/25/2026 04:00 PM',8,8,0],
 ['E-C','Open source','Server','10/24/2026 08:00 AM','',1,1,0],
 ['E-D','Ambiguous source','Server','11/01/2026 01:30 AM','11/01/2026 03:00 AM',2,2,0]]:w.writerow(row)
 return {'name':'synthetic-hours.csv','mimeType':'text/csv','buffer':text.getvalue().encode()}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--remote-debugging-port=9339'])
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,reduced_motion='reduce')
 errors=[];external=[];held=[];mode={'directory':'absent'}
 cors={'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,POST,OPTIONS'}
 def api(r):
  if r.request.method=='OPTIONS':r.fulfill(status=204,headers=cors)
  elif '/api/auth/verify' in r.request.url:r.fulfill(status=200,json={'ok':True},headers=cors)
  elif '/import-directory/' in r.request.url:
   if mode['directory']=='hold':held.append(r)
   elif mode['directory']=='auth':r.fulfill(status=401,json={},headers=cors)
   elif mode['directory']=='ok':r.fulfill(status=200,json={'record':None},headers=cors)
   else:r.fulfill(status=503,json={},headers=cors)
  else:r.fulfill(status=200,json={'days':[]},headers=cors)
 def guard(r):
  if urlparse(r.request.url).hostname in ('127.0.0.1','localhost'):r.continue_()
  else:external.append(r.request.url);r.abort()
 context.route('**/*',guard);context.route('http://127.0.0.1:8787/**',api)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept() if d.type=='beforeunload' else d.dismiss())
 page.goto(BASE+'/internal/bookkeeping/#hours');page.wait_for_load_state('networkidle');page.locator('#tab-hours').click()
 page.locator('#hc-location').select_option(index=1);page.locator('#hc-start').fill('2026-10-24');page.locator('#hc-end').fill('2026-10-24');page.locator('#hc-preparer').fill('Synthetic hours preparer')
 set_source(page,'#hc-file',csvfile());hours_review(page)
 expect(page.locator('[data-hours-stage]')).to_be_focused();expect(page.locator('[data-hours-counts]')).to_contain_text('5 source rows · 2 included · 3 excluded')
 group=page.locator('[data-hours-employee="E-A"]');expect(group).to_contain_text('11');expect(group).to_contain_text('9.5');expect(group).to_contain_text('1.5')
 page.locator('#hours-queue-filter').select_option('excluded');expect(page.locator('[data-hours-issue]')).to_have_count(3)
 page.locator('[data-hours-issue="6"]').get_by_role('button',name='Source row details',exact=True).click();expect(page.locator('[data-hours-row="6"]')).to_be_focused()
 page.locator('#hours-reviewed').check();hours_stage(page,'files');assert page.locator('#hc-file').evaluate('(e)=>e.files[0].name')=='synthetic-hours.csv'
 hours_stage(page,'review');expect(page.locator('#hours-reviewed')).to_be_checked()
 hours_report(page)
 with page.expect_download() as download:page.locator('#hc-download').click()
 path=download.value.path();first=hashlib.sha256(Path(path).read_bytes()).hexdigest()
 cells=json.loads(subprocess.check_output(['node','-e',"const x=require('xlsx'),s=x.readFile(process.argv[1]).Sheets['All Employees'];console.log(JSON.stringify(Object.fromEntries(['F2','G2','H2','F3','G3','H3','F4','G4','H4'].map(k=>[k,s[k].v]))))",path],cwd=ROOT))
 assert cells=={'F2':8,'G2':7,'H2':1,'F3':3,'G3':2.5,'H3':.5,'F4':11,'G4':9.5,'H4':1.5},cells
 context.set_offline(True)
 with page.expect_download() as again:page.locator('#hc-download').click()
 assert hashlib.sha256(Path(again.value.path()).read_bytes()).hexdigest()==first
 context.set_offline(False)
 page.locator('#panel-hours').get_by_role('button',name='Save a copy on this device',exact=True).click()
 expect(page.locator('#panel-hours').get_by_role('status').filter(has_text='saved on this device')).to_be_visible()
 saved=page.evaluate("Object.entries(localStorage).find(([key])=>key.startsWith('cr-internal-draft:')&&key.includes('hours-import'))")
 # Directory loading/failure is distinct and preserves established export eligibility.
 page.locator('#tab-cash-out').click();page.locator('#cashout-code').fill('synthetic-hours-stages');page.get_by_role('button',name='Unlock',exact=True).click();expect(page.locator('#cashout-store')).to_be_visible();page.locator('#tab-hours').click();hours_stage(page,'review')
 mode['directory']='hold';page.locator('#mapping-load').click();expect(page.locator('#panel-hours')).to_contain_text('Loading employee directory')
 expect(page.locator('#hc-accept')).to_be_enabled()
 held.pop().fulfill(status=503,json={},headers=cors);expect(page.locator('#panel-hours')).to_contain_text('unavailable or not configured');expect(page.locator('#hc-accept')).to_be_enabled();expect(page.locator('#hours-reviewed')).to_be_checked()
 # Pending completion after same-context restore cannot replace that snapshot's reviewed identity state.
 hours_copies(page);mode['directory']='hold';page.locator('#mapping-load').click();page.wait_for_timeout(50);assert held
 page.locator('#panel-hours').get_by_role('button',name='Resume as a copy',exact=True).first.click();page.get_by_role('dialog').locator('button').last.click()
 expect(page.locator('#hours-reviewed')).not_to_be_checked();assert page.locator('#hc-file').evaluate('(e)=>e.files.length')==0
 held.pop().fulfill(status=200,json={'record':None},headers=cors)
 expect(page.locator('#mapping-new-name')).to_have_count(0)
 assert page.evaluate('key=>localStorage.getItem(key)',saved[0])==saved[1]
 # A preparer/period edit invalidates acceptance while retaining rows for re-review.
 hours_stage(page,'files');page.locator('#hc-preparer').fill('Restored editor');page.locator('#hc-end').fill('2026-10-25');hours_review(page)
 expect(page.locator('[data-hours-counts]')).to_contain_text('5 source rows · 3 included · 2 excluded');expect(page.locator('#hours-reviewed')).not_to_be_checked()
 for width,name in [(1440,'hours-desktop'),(768,'hours-tablet'),(390,'hours-phone'),(320,'hours-spanish-enlarged')]:
  page.set_viewport_size({'width':width,'height':1000})
  if width==320:page.get_by_role('button',name='Español',exact=True).click();page.evaluate('document.documentElement.style.fontSize="32px"')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
  page.screenshot(path=str(ART/(name+'.png')),full_page=True)
 page.evaluate('document.documentElement.style.fontSize="16px"');page.set_viewport_size({'width':1440,'height':1000});page.locator('#hours-reviewed').focus();page.keyboard.press('Space');expect(page.locator('#hours-reviewed')).to_be_checked()
 page.evaluate('window.dispatchEvent(new Event("beforeprint"))');expect(page.locator('#hours-review-title')).to_have_text('Review employee hours');page.pdf(path=str(ART/'hours-review-english.pdf'),format='Letter');page.evaluate('window.dispatchEvent(new Event("afterprint"))')
 mode['directory']='auth';page.locator('#mapping-load').click();expect(page.locator('#mapping-load')).to_be_disabled();expect(page.locator('#hc-accept')).to_be_enabled();expect(page.locator('#hours-reviewed')).to_be_checked()
 from urllib.request import urlopen
 targets=json.load(urlopen('http://127.0.0.1:9339/json/list'));target=next(item['id'] for item in targets if item.get('url')==page.url)
 subprocess.run(['rea-project','run','--project',str(ROOT),'--','inspect-web-page','http://127.0.0.1:9339',target,'--include-accessibility-text','--include-storage-keys','--json'],check=True,stdout=subprocess.DEVNULL)
 assert not errors,errors;assert not external,external
 (ART/'results.json').write_text(json.dumps({'cells':cells,'repeat_sha256':first,'page_errors':errors,'external_attempts':external,'viewports':[1440,768,390,320],'limitations':['Synthetic local APIs','Physical device/software keyboard, staff review and live service unverified']},indent=2))
 context.close();browser.close();print('PASS Step09: stage/native CSV/ack retention, queue/counts/employee totals, independent workbook hours, cached repeats, directory failure eligibility, stale same-context restore, device bytes, edited restored review, layouts/language/keyboard/print and passive REA')
