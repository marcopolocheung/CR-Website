"""Step11: synthetic CR3 counts, device envelopes, exact wire fields, recovery and print."""
import copy,json,sys
from datetime import date,timedelta
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
from pypdf import PdfReader
BASE=sys.argv[1];assert urlparse(BASE).hostname in ('127.0.0.1','localhost')
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'docs/internal-tools-overhaul/evidence/step-12a/counting';ART.mkdir(parents=True,exist_ok=True)
DATE='2026-11-18';OTHER='2026-11-19';KEY='cr-inventory-progress:v1:CR3:'+DATE
ITEMS=['blank','zero','fraction','text','enough','skip','order-only']
CATALOG=[{'id':'section-a','title':'Synthetic supplies','useLabel':'Use','showSup':True,'items':[{'id':key,'name':key.title(),'sup':'D' if key!='skip' else 'L','use':'2','gray':False} for key in ITEMS]}, {'id':'section-b','title':'Synthetic beverages','useLabel':'UNOPEN BOX','showSup':False,'items':[{'id':'beverage','name':'Beverage source','sup':'Pepsi','use':'6','gray':False},{'id':'removed','name':'Removed source item','sup':'Pepsi','use':'1','gray':False}]}]
TOKEN='synthetic-inventory-counting'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--remote-debugging-port=9342'])
 errors=[];external=[];results=[]
 def workspace(history_mode='ok',documents=None):
  ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,permissions=['clipboard-read','clipboard-write'],reduced_motion='reduce')
  ctx.add_init_script("if(localStorage.getItem('cr-inventory')===null)localStorage.setItem('cr-inventory',JSON.stringify({date:'2026-11-18',counts:{}}))")
  state={'catalog':copy.deepcopy(CATALOG),'rev':1,'history':history_mode,'save':'ok','documents':copy.deepcopy(documents or {}),'held_history':[],'held_save':[],'writes':[],'requests':[]}
  cors={'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,PUT,OPTIONS'}
  def history(to):return {'days':[{'date':day,'counts':counts,'updatedAt':'2026-11-18T12:00:00Z'} for day,counts in sorted(state['documents'].items(),reverse=True) if day<=to][:14]}
  def api(route):
   req=route.request;u=urlparse(req.url);state['requests'].append({'path':u.path,'method':req.method})
   if req.method=='OPTIONS':route.fulfill(status=204,headers=cors);return
   if u.path=='/api/auth/verify':route.fulfill(status=200,json={'ok':True},headers=cors);return
   if u.path=='/api/inventory/CR3/list':
    if req.method=='PUT':body=req.post_data_json;assert set(body)=={'sheets','baseRev'};state['catalog']=body['sheets'];state['rev']+=1
    route.fulfill(status=200,json={'rev':state['rev'],'sheets':state['catalog']},headers=cors);return
   if u.path=='/api/inventory/CR3':
    body=history(parse_qs(u.query)['to'][0])
    if state['history']=='hold':state['held_history'].append((route,body))
    elif state['history']=='fail':route.fulfill(status=503,json={},headers=cors)
    else:route.fulfill(status=200,json=body,headers=cors)
    return
   if u.path.startswith('/api/inventory/CR3/') and req.method=='PUT':
    body=req.post_data_json;assert set(body)=={'counts'};assert all(set(cell)<=set(('inv','order','done')) for cell in body['counts'].values());state['writes'].append(copy.deepcopy(body))
    if state['save']=='hold':state['held_save'].append((route,u.path.rsplit('/',1)[-1],body))
    elif state['save']=='fail':route.fulfill(status=503,json={},headers=cors)
    else:state['documents'][u.path.rsplit('/',1)[-1]]=body['counts'];route.fulfill(status=200,json={'ok':True},headers=cors)
    return
   route.fulfill(status=200,json={'days':[]},headers=cors)
  def guard(route):
   if urlparse(route.request.url).hostname in ('127.0.0.1','localhost'):route.continue_()
   else:external.append(route.request.url);route.abort()
  ctx.route('**/*',guard);ctx.route('http://127.0.0.1:8787/**',api)
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept() if d.type=='beforeunload' else d.dismiss())
  page.goto(BASE+'/internal/inventory/');page.wait_for_load_state('networkidle')
  page.locator('#cashout-code:visible').fill(TOKEN);page.get_by_role('button',name='Unlock',exact=True).click()
  return ctx,page,state,cors
 def go_view(page,name):
  page.locator(f'nav a[href="#{name}"]').click();expect(page.locator(f'[data-inventory-view="{name}"]')).to_be_visible()
 def open_catalog_difference(page):
  details=page.locator('[data-inventory-catalog-difference]')
  if details.get_attribute('open') is None:details.locator(':scope > summary').click()
 def row(page,id):return page.locator(f'[data-count-id="{id}"]')
 def field(page,id):return page.locator('#inventory-on-hand-'+id)
 def totals(page,expected):
  for key,value in expected.items():expect(page.locator(f'[data-inventory-total="{key}"]')).to_have_text(str(value))
 def release_history(state,cors):
  for route,body in state['held_history'][:]:route.fulfill(status=200,json=body,headers=cors)
  state['held_history'].clear();state['history']='ok'
 def confirm(page,yes=True):
  expect(page.get_by_role('dialog')).to_be_visible();page.get_by_role('dialog').locator('button').last.click() if yes else page.keyboard.press('Escape')
 def set_day(page,value,accept=True):
  page.locator('#inventory-date').fill(value)
  if page.get_by_role('dialog').count() and page.get_by_role('dialog').is_visible():confirm(page,accept)
 def open_order(page,id):
  details=row(page,id).locator('details');
  if details.get_attribute('open') is None:details.locator('summary').click()
 def note(name):results.append(name)
 # Fresh unknown baseline: do not expose editable empty rows before the saved day resolves.
 original_counts={'zero':{'inv':'0','order':'2'},'beverage':{'inv':'3','order':'3'},'legacy-extra':{'inv':'3B/2T','order':''}}
 ctx,page,state,cors=workspace('hold',{DATE:original_counts,**{f'2026-11-{day}':{'zero':{'inv':'1/2','order':'2'}} for day in range(14,18)}})
 expect(field(page,'zero')).to_be_disabled();expect(page.locator('#inventory-save')).to_be_disabled();expect(page.get_by_role('button',name='Clear count',exact=True)).to_be_disabled()
 assert page.evaluate('key=>localStorage.getItem(key)',KEY) is None
 page.wait_for_timeout(50);assert state['held_history'];release_history(state,cors);expect(field(page,'zero')).to_have_value('0');expect(field(page,'beverage')).to_have_value('3')
 totals(page,{'entered':2,'enough':0,'skipped':0,'remaining':7,'total':9});note('unknown first history freezes rows/save/clear and does not manufacture a ready empty envelope')
 field(page,'fraction').fill('1 1/2');field(page,'text').fill('3B/2T');row(page,'enough').get_by_role('button',name='Enough',exact=True).click();row(page,'skip').get_by_role('button',name='Skip',exact=True).click()
 open_order(page,'order-only');page.locator('#inventory-order-order-only').fill('4');field(page,'removed').fill('1/2')
 totals(page,{'entered':5,'enough':1,'skipped':1,'remaining':2,'total':9})
 expect(row(page,'blank')).to_have_attribute('data-count-state','untouched');expect(row(page,'zero')).to_have_attribute('data-count-state','zero');expect(row(page,'fraction')).to_have_attribute('data-count-state','measured');expect(row(page,'text')).to_have_attribute('data-count-state','text');expect(row(page,'enough')).to_have_attribute('data-count-state','enough');expect(row(page,'skip')).to_have_attribute('data-count-state','skipped');expect(row(page,'order-only')).to_have_attribute('data-count-state','untouched')
 row(page,'skip').get_by_role('button',name='Undo skip',exact=True).click();field(page,'skip').fill('0');expect(row(page,'skip')).to_have_attribute('data-count-state','zero');field(page,'skip').fill('');row(page,'skip').get_by_role('button',name='Skip',exact=True).click()
 page.locator('#inventory-filter').select_option('remaining');expect(page.locator('[data-count-id]')).to_have_count(2)
 field(page,'blank').focus();field(page,'blank').press_sequentially('1/2');expect(field(page,'blank')).to_have_value('1/2');expect(field(page,'blank')).to_be_focused();field(page,'blank').fill('');page.locator('#inventory-filter').select_option('ordering')
 expect(row(page,'order-only')).to_be_visible();totals(page,{'total':9,'entered':5,'enough':1,'skipped':1,'remaining':2})
 page.locator('#inventory-filter').select_option('all');page.locator('#inventory-search').fill('Fraction');expect(page.locator('[data-count-id]')).to_have_count(1);totals(page,{'total':9,'entered':5});page.locator('#inventory-search').fill('')
 page.locator('#inventory-section').select_option('section-b');expect(page.locator('[data-count-id]')).to_have_count(2);totals(page,{'total':9,'entered':5});note('all six count states, raw fractions/text, order-only remaining, skip undo/edit and filter-independent denominator with keyboard-pinned input')
 go_view(page,'orders');page.locator('[data-inventory-view="orders"] [data-inventory-orders]').get_by_role('checkbox',name='Order-Only Marked ordered',exact=True).check();go_view(page,'count')
 # Capture and resume the original catalog even after the live list renames/removes/adds.
 state['catalog'][0]['items'][1]['name']='Renamed zero';state['catalog'][1]['items'].pop();state['catalog'][0]['items'].append({'id':'new-id','name':'Removed source item','sup':'Pepsi','use':'1','gray':False});state['rev']=2
 page.reload();page.wait_for_load_state('networkidle');page.locator('#cashout-code:visible').fill(TOKEN);page.get_by_role('button',name='Unlock',exact=True).click();expect(page.locator('#inventory-section')).to_have_value('section-b');expect(field(page,'removed')).to_have_value('1/2');totals(page,{'total':9,'entered':5,'skipped':1})
 page.get_by_role('link',name='Catalog changed: review stable item IDs',exact=True).click();expect(page.locator('[data-inventory-view="catalog"]')).to_be_visible();page.go_back();expect(page.locator('[data-inventory-view="count"]')).to_be_visible();page.go_forward();expect(page.locator('[data-inventory-view="catalog"]')).to_be_visible();expect(page.locator('#cashout-code')).not_to_be_visible();open_catalog_difference(page);page.get_by_role('button',name='Use reviewed catalog by item ID',exact=True).click();confirm(page);go_view(page,'count')
 totals(page,{'total':10,'entered':5,'enough':1,'skipped':1,'remaining':3});page.locator('#inventory-section').select_option('');expect(field(page,'zero')).to_have_value('0');expect(row(page,'zero')).to_contain_text('Renamed zero');expect(field(page,'new-id')).to_have_value('');expect(field(page,'removed')).to_have_value('1/2');expect(row(page,'removed')).to_contain_text('ID: removed')
 archives=page.evaluate("Object.entries(localStorage).filter(([key])=>key.startsWith('cr-inventory-progress-archive:')).map(([key,raw])=>({key,raw,value:JSON.parse(raw)}))")
 assert archives and archives[0]['value']['catalog'][0]['items'][1]['name']=='Zero' and archives[0]['value']['counts']['removed']['inv']=='1/2'
 note('section interruption/reload uses captured catalog; explicit adoption archives previous bytes, retains removed IDs and never remaps same-name new IDs')
 # Late save and late post-ack read must never overwrite or claim newer input saved.
 state['save']='hold';state['history']='hold';page.locator('#inventory-save').click();page.wait_for_timeout(50);assert state['held_save'];field(page,'zero').fill('1')
 route,day,body=state['held_save'].pop();state['documents'][day]=body['counts'];route.fulfill(status=200,json={'ok':True},headers=cors);page.wait_for_timeout(50);assert state['held_history'];field(page,'zero').fill('2');release_history(state,cors)
 expect(page.get_by_role('status').filter(has_text='Earlier')).to_be_visible();expect(field(page,'zero')).to_have_value('2');assert state['documents'][DATE]['zero']['inv']=='0'
 state['save']='ok';state['history']='fail';page.locator('#inventory-save').click();expect(page.get_by_role('status').filter(has_text='saved-day refresh failed')).to_be_visible();assert state['documents'][DATE]['zero']['inv']=='2';state['history']='ok'
 assert all(set(body)=={'counts'} and all(set(cell)<=set(('inv','order','done')) for cell in body['counts'].values()) for body in state['writes'])
 assert state['writes'][-1]['counts'].get('skip')=={'inv':'','order':''};assert page.get_by_role('button',name='Complete',exact=True).count()==0
 note('server receives only existing fields; skips remain local; late PUT/GET preserves newer input and post-ack history failure remains distinct')
 # Date cancellation and round trip retain the exact scoped local session.
 field(page,'zero').fill('3');set_day(page,OTHER,False);expect(page.locator('#inventory-date')).to_have_value(DATE);expect(field(page,'zero')).to_have_value('3')
 set_day(page,OTHER);expect(page.locator('#inventory-date')).to_have_value(OTHER);expect(field(page,'zero')).to_have_value('');set_day(page,DATE);expect(field(page,'zero')).to_have_value('3');totals(page,{'total':10,'skipped':1})
 # Denied storage blocks a date handoff without erasing current text.
 page.evaluate('() => {window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException("quota","QuotaExceededError")}}');field(page,'fraction').fill('3/4');expect(page.get_by_role('alert').filter(has_text='Some device copies')).to_be_visible();set_day(page,OTHER);expect(page.locator('#inventory-date')).to_have_value(DATE);expect(field(page,'fraction')).to_have_value('3/4');page.get_by_role('button',name='Close',exact=True).click();page.evaluate('() => {Storage.prototype.setItem=window.originalSet}');field(page,'fraction').fill('1 1/2')
 note('date cancellation/return restores CR3/date progress; storage denial keeps fields and refuses unprotected handoff')
 # Clipboard/order checklist and familiar print remain independent of counting filters.
 go_view(page,'orders');page.get_by_role('button',name='Copy order list',exact=True).click();clip=page.evaluate('navigator.clipboard.readText()');assert 'CR3 order '+DATE in clip and 'Order-Only: 4' in clip;go_view(page,'count')
 page.locator('#inventory-search').fill('nothing matches')
 for width,name in [(1440,'count-desktop'),(768,'count-tablet'),(390,'count-phone'),(320,'count-spanish-enlarged')]:
  page.locator('#inventory-search').fill('')
  page.set_viewport_size({'width':width,'height':1000})
  if width==320:page.get_by_role('button',name='Español',exact=True).click();page.evaluate('document.documentElement.style.fontSize="32px"')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
  page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(100)
  page.screenshot(path=str(ART/(name+'.png')),full_page=True)
 page.evaluate('document.documentElement.style.fontSize="16px"');page.set_viewport_size({'width':1440,'height':1000});page.locator('#inventory-search').fill('nothing matches')
 page.evaluate('window.dispatchEvent(new Event("beforeprint"))');pdf=ART/'inventory-english.pdf';page.pdf(path=str(pdf),format='Letter',print_background=False)
 text=' '.join(p.extract_text() for p in PdfReader(pdf).pages)
 for value in ['ITEM','INV','ORDER','Renamed zero','1 1/2','3B/2T','Removed source item','Retained ID: removed','Order list']:assert value in text,value
 assert text.count('INV')==15 and text.count('ORDER')==15;assert 'legacy-extra' in text and '3B/2T' in text
 assert 'Existencias' not in text and 'Skipped on this device' not in text and 'Search items' not in text
 page.evaluate('window.dispatchEvent(new Event("afterprint"))');page.get_by_role('button',name='English',exact=True).click();page.locator('#inventory-search').fill('')
 note('copy/checklist suggestions unchanged; all captured rows and previous date pairs print in English despite filters; EN/ES/320px/enlarged/reduced-motion layouts inspected')
 # Future metadata survives an attempted write and remains downloadable verbatim.
 raw=json.dumps({'schemaVersion':99,'synthetic':'original unsupported bytes'})
 page.evaluate('([key,raw])=>localStorage.setItem(key,raw)',[KEY,raw]);field(page,'text').fill('2B/1T');expect(page.get_by_role('alert').filter(has_text='Some device copies')).to_be_visible();assert page.evaluate('key=>localStorage.getItem(key)',KEY)==raw
 detail=page.locator('details').filter(has=page.get_by_text('Original device recovery bytes',exact=True));detail.locator(':scope > summary').click()
 with page.expect_download() as event:detail.get_by_role('button',name='Download original source',exact=True).first.click()
 assert Path(event.value.path()).read_text()==raw
 note('unsupported progress bytes are preserved verbatim and downloadable; new raw values stay in memory/compatible legacy copies')
 assert TOKEN not in page.evaluate('JSON.stringify(localStorage)')
 from urllib.request import urlopen
 import subprocess
 targets=json.load(urlopen('http://127.0.0.1:9342/json/list'));target=next(item['id'] for item in targets if item.get('url')==page.url)
 subprocess.run(['rea-project','run','--project',str(ROOT),'--','inspect-web-page','http://127.0.0.1:9342',target,'--include-accessibility-text','--include-storage-keys','--json'],check=True,stdout=subprocess.DEVNULL)
 # Another device/server reload has no skip metadata, preserves unknown IDs for review.
 shared=copy.deepcopy(state['documents']);ctx.close();ctx,page,fresh,cors=workspace('ok',shared)
 expect(field(page,'zero')).to_have_value('2');totals(page,{'skipped':0,'total':9});expect(row(page,'skip')).to_have_attribute('data-count-state','untouched');note('server reload without local metadata restores only count/order fields, without inventing skips or completion')
 ctx.close()
 # Failed first history cannot be bypassed by Clear or catalog editing/adoption.
 ctx,page,failure,cors=workspace('fail',{DATE:{'zero':{'inv':'3','order':''}}})
 expect(field(page,'zero')).to_be_disabled();expect(page.get_by_role('button',name='Clear count',exact=True)).to_be_disabled();go_view(page,'catalog');page.get_by_role('button',name='Edit catalog',exact=True).click();page.get_by_label('Blank name',exact=True).fill('Catalog edit while day unavailable');page.get_by_role('button',name='Save list',exact=True).click();expect(page.get_by_role('button',name='Edit catalog',exact=True)).to_be_visible();open_catalog_difference(page);expect(page.get_by_role('button',name='Use reviewed catalog by item ID',exact=True)).to_be_disabled();assert not failure['writes']
 failure['history']='ok';go_view(page,'count');page.get_by_role('button',name='Retry source load',exact=True).click();expect(field(page,'zero')).to_have_value('3');note('failed unknown baseline remains unavailable through catalog edits/adoption until retry loads saved fields')
 # Remove/re-add a same-name item: new IDs must never inherit retired count/history identities.
 go_view(page,'catalog');page.get_by_role('button',name='Edit catalog',exact=True).click()
 page.get_by_label('Zero name',exact=True).fill('')
 page.get_by_role('button',name='Remove Row 2',exact=True).click()
 page.get_by_role('button',name='+ Add item',exact=True).first.click()
 page.get_by_label('Row 7 name',exact=True).fill('Zero')
 page.get_by_role('button',name='Save list',exact=True).click()
 expect(page.get_by_role('button',name='Edit catalog',exact=True)).to_be_visible()
 replacement=next(item['id'] for sheet in failure['catalog'] for item in sheet['items'] if item['name']=='Zero')
 assert replacement!='zero'
 open_catalog_difference(page)
 page.get_by_role('button',name='Use reviewed catalog by item ID',exact=True).click();confirm(page);go_view(page,'count')
 expect(field(page,replacement)).to_have_value('');expect(field(page,'zero')).to_have_value('3')
 expect(row(page,'zero')).to_contain_text('Retained')
 note('catalog remove/re-add of the same name allocates a fresh ID and cannot inherit retired counts/history/skips')
 ctx.close();browser.close()
assert not errors,errors;assert not external,external
(ART/'results.json').write_text(json.dumps({'scenarios':results,'page_errors':errors,'external_attempts':external,'count_puts':state['writes'],'clipboard':clip,'viewports':[1440,768,390,320],'limitations':['Synthetic local APIs only','Physical device/software keyboard, staff review and live persistence unverified']},indent=2))
print(f'PASS Step11 {len(results)} scenarios: count states, progress/catalog identity/recovery, late reads/saves, existing wire/order/print and local visual/REA evidence')
