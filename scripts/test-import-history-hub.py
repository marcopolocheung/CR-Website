"""Step10 exact history, checkpointed resume and same-code session race acceptance."""
import copy,hashlib,json,subprocess,sys
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
BASE=sys.argv[1];assert urlparse(BASE).hostname in ('127.0.0.1','localhost')
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'docs/internal-tools-overhaul/evidence/step-10/screens';ART.mkdir(parents=True,exist_ok=True)
fixtures=json.loads(subprocess.check_output(['node','--import','jiti/register','scripts/create-history-hub-fixtures.ts'],cwd=ROOT))
original=fixtures['CR3']['imports'][0];child=copy.deepcopy(original);child['id']='hub-deliberate-reprocess';child['createdAt']='2026-10-25T12:00:00.000Z';child['data']['supersedesId']=original['id']
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--remote-debugging-port=9340'])
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,reduced_motion='reduce')
 errors=[];external=[];posts=[];queries=[];held_history=[];held_directory=[];mode={'history':'ok','directory':'ok'}
 cors={'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,POST,OPTIONS'}
 def api(r):
  req=r.request;url=urlparse(req.url);q=parse_qs(url.query,keep_blank_values=True)
  if req.method=='OPTIONS':r.fulfill(status=204,headers=cors);return
  if '/api/auth/verify' in url.path:r.fulfill(status=200,json={'ok':True},headers=cors);return
  if '/import-directory/' in url.path:
   if mode['directory']=='hold':held_directory.append(r)
   else:r.fulfill(status=200,json={'record':fixtures[url.path.rsplit('/',1)[-1]]['directory']},headers=cors)
   return
  if '/import-schedules/' in url.path:r.fulfill(status=200,json=fixtures[url.path.rsplit('/',1)[-1]]['page'],headers=cors);return
  if '/import-history/' in url.path:
   store=url.path.rsplit('/',1)[-1]
   if req.method=='POST':posts.append(req.post_data_json);r.fulfill(status=409,json={'error':{'code':'revision_conflict'}},headers=cors);return
   queries.append({'store':store,**{key:value[0] for key,value in q.items()}})
   if mode['history']=='hold':held_history.append(r);return
   if mode['history']=='fail':r.fulfill(status=503,json={},headers=cors);return
   if q.get('kind')==['sales'] and q.get('start')==['2026-10-20'] and store=='CR3':records=[fixtures['sales']];cursor=None
   elif q.get('kind')==['hours'] and q.get('start')==['2026-10-01'] and q.get('end')==['2026-10-31']:
    records=[child] if q.get('cursor',[''])[0] else fixtures[store]['imports'];cursor=None if store=='CR2' or q.get('cursor',[''])[0] else 'more-fixture'
   else:records=[];cursor=None
   r.fulfill(status=200,json={'records':records,'nextCursor':cursor},headers=cors);return
  r.fulfill(status=200,json={'days':[]},headers=cors)
 def guard(r):
  if urlparse(r.request.url).hostname in ('127.0.0.1','localhost'):r.continue_()
  else:external.append(r.request.url);r.abort()
 context.route('**/*',guard);context.route('http://127.0.0.1:8787/**',api)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept() if d.type=='beforeunload' else d.dismiss())
 def unlock():
  page.locator('#cashout-code:visible, #import-history-code:visible').fill('synthetic-history-hub');page.get_by_role('button',name='Unlock',exact=True).click()
 def hub_link():
  page.locator('#panel-hours').get_by_role('link',name='Open shared import history',exact=True).click();page.wait_for_url('**/internal/import-history*')
 def confirm(yes=True):page.get_by_role('dialog').locator('button').last.click() if yes else page.keyboard.press('Escape')
 def expire_comparison():
  for route in held_directory[:]:route.fulfill(status=401,json={},headers=cors)
  held_directory.clear();mode['directory']='ok';expect(page.locator('[data-shell-lock]')).to_be_disabled()
 def hold_comparison():
  mode['directory']='hold';page.locator('#tab-comparison').click();page.locator('#comparison-start').fill('2026-10-01');page.locator('#comparison-end').fill('2026-10-31');page.locator('#comparison-load').click()
  if page.get_by_role('dialog').count() and page.get_by_role('dialog').is_visible():confirm()
  page.wait_for_timeout(100);assert held_directory
  page.locator('#tab-hours').click()
 page.goto(BASE+'/internal/import-history/?store=CR3&kind=hours&start=2026-10-01&end=2026-10-31');page.wait_for_load_state('networkidle');unlock()
 page.locator('#import-history-load').click();expect(page.locator('[data-import-record]')).to_have_count(1)
 page.locator('#import-history-more').click();expect(page.locator('[data-import-record]')).to_have_count(2)
 expect(page.locator('[data-import-record]').last).to_contain_text('Reprocessed from an earlier import')
 assert queries[-1]['cursor']=='more-fixture' and all(q['start']=='2026-10-01' and q['end']=='2026-10-31' for q in queries)
 # Report identity and technical metadata remain discoverable without dominating summaries.
 expect(page.locator('[data-import-record]').first).to_contain_text('Synthetic reviewer')
 for width,name in [(1440,'history-desktop'),(768,'history-tablet'),(390,'history-phone'),(320,'history-spanish-enlarged')]:
  page.set_viewport_size({'width':width,'height':1000})
  if width==320:page.get_by_role('button',name='Español',exact=True).click();page.evaluate('document.documentElement.style.fontSize="32px"')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
  page.screenshot(path=str(ART/(name+'.png')),full_page=True)
 page.get_by_role('button',name='English',exact=True).click();page.evaluate('document.documentElement.style.fontSize="16px"');page.set_viewport_size({'width':1440,'height':1000})
 page.locator('[data-history=resume]').first.click();confirm(False);expect(page.locator('#import-history-load')).to_be_visible()
 page.locator('[data-history=resume]').first.click();confirm();expect(page.locator('#tab-hours')).to_have_attribute('aria-selected','true');expect(page.locator('#hours-reviewed')).not_to_be_checked()
 assert page.locator('#hc-file').evaluate('(e)=>e.files.length')==0
 page.locator('#hc-preparer').fill('Existing device editor');page.locator('#hours-reviewed').check()
 with page.expect_download() as event:page.locator('#hc-download').click()
 cells=json.loads(subprocess.check_output(['node','-e',"const x=require('xlsx'),s=x.readFile(process.argv[1]).Sheets['All Employees'];console.log(JSON.stringify(Object.fromEntries(['F2','F3','F4','G4','H4','F9'].map(k=>[k,s[k].v]))))",event.value.path()],cwd=ROOT))
 assert cells=={'F2':9,'F3':8,'F4':17,'G4':15.5,'H4':1.5,'F9':7},cells
 digest=hashlib.sha256(Path(event.value.path()).read_bytes()).hexdigest()
 with page.expect_download() as repeat:page.locator('#hc-download').click()
 assert hashlib.sha256(Path(repeat.value.path()).read_bytes()).hexdigest()==digest
 hub_link();page.locator('#import-history-load').click();page.locator('[data-history=resume]').first.click();confirm(False);expect(page.locator('#hc-preparer')).to_have_value('Existing device editor')
 page.locator('[data-history=resume]').first.click();confirm();expect(page.locator('#hc-preparer')).to_have_value('Synthetic reviewer');expect(page.locator('#hours-reviewed')).not_to_be_checked()
 checkpoints=page.evaluate("Object.entries(localStorage).filter(([key])=>key.startsWith('cr-internal-draft:')).map(([key,raw])=>({key,raw,value:JSON.parse(raw)}))")
 assert any(item['value']['payload'].get('metadata',{}).get('preparer')=='Existing device editor' and item['value']['payload']['output'] for item in checkpoints)
 # Quota denial refuses replacement and retains current values and all recovery bytes.
 page.locator('#hc-preparer').fill('Quota retained editor');hub_link();page.locator('#import-history-load').click()
 page.evaluate('() => {window.savedSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException("quota","QuotaExceededError")}}')
 page.locator('[data-history=resume]').first.click();confirm();expect(page.locator('#hc-preparer')).to_have_value('Quota retained editor');expect(page.get_by_role('alert').filter(has_text='Access remains unlocked')).to_be_visible()
 page.evaluate('() => {Storage.prototype.setItem=window.savedSet}');page.get_by_role('button',name='Close',exact=True).click()
 assert all(page.evaluate('key=>localStorage.getItem(key)',item['key'])==item['raw'] for item in checkpoints)
 # A late result for CR3 must not replace a later CR2 exact-context load.
 mode['history']='hold';page.locator('#import-history-load').click();page.wait_for_timeout(50);assert held_history
 page.evaluate("() => {const a=document.createElement('a');a.href='/internal/import-history?store=CR2&kind=hours&start=2026-10-01&end=2026-10-31';a.textContent='Synthetic context navigation';document.body.append(a)}")
 page.get_by_role('link',name='Synthetic context navigation',exact=True).click();expect(page.locator('#import-history-store')).to_have_value('CR2');mode['history']='ok';page.locator('#import-history-load').click();expect(page.locator('[data-history-scope]')).to_contain_text('CR2')
 held_history.pop().fulfill(status=200,json={'records':[original],'nextCursor':None},headers=cors);expect(page.locator('[data-history-scope]')).to_contain_text('CR2')
 mode['history']='fail';page.locator('#import-history-load').click();expect(page.get_by_role('status')).to_contain_text('unavailable or not configured');expect(page.locator('[data-import-record]')).to_have_count(1);mode['history']='ok'
 # Return to matching original hours; deliberate reprocess confirmation cannot write after expiry.
 page.get_by_role('link',name='Reports',exact=True).click();page.get_by_role('link',name='Employee hours',exact=True).click();page.locator('#hc-preparer').fill('Synthetic reviewer');page.locator('#hours-reviewed').check()
 with page.expect_download():page.locator('#hc-download').click()
 history=page.locator('#panel-hours').get_by_role('region',name='Shared import history',exact=True)
 history.locator('[data-history=save]').click();expect(history).to_contain_text('already recorded');count=len(posts)
 hold_comparison();history.locator('[data-history=reprocess]').click();expire_comparison();confirm();assert len(posts)==count
 page.locator('#tab-cash-out').click();unlock();expect(page.locator('[data-shell-lock]')).to_be_enabled();page.locator('#tab-hours').click()
 # Hold identity hashing, expire and reauthenticate with the same code, then release it.
 hold_comparison();page.evaluate("""() => {window.originalDigest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=(...args)=>new Promise(resolve=>{window.releaseIdentity=()=>resolve(window.originalDigest(...args))})}""")
 history.locator('[data-history=save]').click();page.wait_for_function('!!window.releaseIdentity');count=len(posts);expire_comparison()
 page.locator('#tab-cash-out').click();unlock();page.locator('#tab-hours').click();page.evaluate('() => {window.releaseIdentity();crypto.subtle.digest=window.originalDigest}');page.wait_for_timeout(100);assert len(posts)==count
 # Exact sales filter and matching converter resume remain compatible on this independent branch.
 hub_link();page.locator('#import-history-store').select_option('CR3');page.locator('#import-history-kind').select_option('sales');page.locator('#import-history-start').fill('2026-10-20');page.locator('#import-history-load').click();expect(page.locator('[data-import-record]')).to_have_count(1)
 page.locator('[data-history=resume]').click();confirm();expect(page.locator('#tab-sales')).to_have_attribute('aria-selected','true');expect(page.locator('#sales-reviewed')).not_to_be_checked();assert page.locator('#sc-file-general').evaluate('(e)=>e.files.length')==0
 assert json.dumps(original,sort_keys=True)==json.dumps(fixtures['CR3']['imports'][0],sort_keys=True)
 assert 'synthetic-history-hub' not in page.evaluate('JSON.stringify(localStorage)')
 from urllib.request import urlopen
 targets=json.load(urlopen('http://127.0.0.1:9340/json/list'));target=next(item['id'] for item in targets if item.get('url')==page.url)
 subprocess.run(['rea-project','run','--project',str(ROOT),'--','inspect-web-page','http://127.0.0.1:9340',target,'--include-accessibility-text','--include-storage-keys','--json'],check=True,stdout=subprocess.DEVNULL)
 assert not errors,errors;assert not external,external
 (ART/'history-results.json').write_text(json.dumps({'queries':queries,'post_attempts':len(posts),'cells':cells,'repeat_sha256':digest,'page_errors':errors,'external_attempts':external,'limitations':['Synthetic local APIs','No physical device/staff/backend/live verification']},indent=2))
 context.close();browser.close();print('PASS Step10 hub: exact-context pagination, readable metadata, EN/ES/layouts, resume/cancel/checkpoint/quota protection, immutable source, independent workbook/repeats, late reads, failed reload, and no stale reprocess/hash POST across same-code sessions')
