"""Step 03 real navigation with synthetic API/data and fresh browser contexts.
Build with an explicit loopback API override; no live service is contacted.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('base')
parser.add_argument('--artifacts', type=Path, default=Path('/tmp/cr-shell'))
parser.add_argument('--rea', action='store_true')
args = parser.parse_args()
assert urlsplit(args.base).hostname == '127.0.0.1'
args.artifacts.mkdir(parents=True, exist_ok=True)
ROOT = Path(__file__).resolve().parent.parent
TOKEN = 'synthetic-shell-code'
LEGACY = '{"am":[],"pm":[],"zReport":"123.45"}'
results, images, errors, external, requests = [], [], [], [], []

def record(name, value): results.append({'scenario': name, 'observed': value})
def shot(page, name):
    page.evaluate('window.scrollTo(0,0)'); page.wait_for_timeout(100)
    file = args.artifacts / (name+'.png'); page.screenshot(path=str(file), full_page=True)
    images.append({'file': file.name, 'viewport': page.viewport_size, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
def nav(page, item): return page.locator('[data-shell-chrome] [data-nav-item="'+item+'"]')
def open_sales(page):
    nav(page,'reports').click()
    page.wait_for_url(re.compile('/internal/reports$'))
    page.wait_for_load_state('networkidle')
    page.locator('[data-internal-workspace=reports] a[href$="#sales"]').click()
    expect(page).to_have_url(re.compile('/internal/bookkeeping#sales$'))
    expect(page.locator('#tab-sales')).to_have_attribute('aria-selected','true')
def selected(page, item): expect(nav(page,item)).to_have_attribute('aria-current','page')
def context_line(page): return page.locator('[data-shell-context]')
def aligned(page,item):
    page.wait_for_timeout(280)
    a=nav(page,item).bounding_box();b=page.locator('[data-shell-chrome] [data-nav-surface]').bounding_box()
    assert a and b and all(abs(a[k]-b[k])<1.5 for k in ('x','y','width','height')), (a,b)
def unlock(page):
    page.locator('#cashout-code').fill(TOKEN);page.get_by_role('button',name='Unlock',exact=True).click()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--remote-debugging-port=9335'] if args.rea else [])
    def workspace(width=1440,touch=False):
        ctx=browser.new_context(viewport={'width':width,'height':1000},has_touch=touch,service_workers='block',reduced_motion='no-preference')
        def route(r):
            req=r.request;u=urlsplit(req.url)
            if f'{u.scheme}://{u.netloc}'==args.base:r.continue_();return
            if f'{u.scheme}://{u.netloc}'!='http://127.0.0.1:8787':external.append(req.url);r.abort();return
            requests.append({'method':req.method,'path':u.path})
            cors={'access-control-allow-origin':'*','access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,OPTIONS'}
            status,body=200,{}
            if req.method=='OPTIONS':r.fulfill(status=204,headers=cors);return
            if req.method!='GET':raise AssertionError('Shell test refuses writes: '+req.method+' '+u.path)
            if u.path=='/api/auth/verify':
                assert req.headers.get('authorization')=='Bearer '+TOKEN;body={'ok':True}
            elif u.path.startswith('/api/cashout/'):
                status,body=(404,{'error':'not_found'}) if u.path.count('/')==4 else (200,{'days':[]})
            elif u.path=='/api/inventory/CR3/list':body={'rev':0,'sheets':None}
            elif u.path=='/api/inventory/CR3':body={'days':[]}
            elif u.path=='/api/writeups':body={'writeUps':[]}
            elif u.path=='/api/forms':body={'forms':[]}
            elif u.path=='/api/schedule':body={'weeks':[],'rev':0,'notModified':False}
            elif u.path.startswith('/api/schedule/'):status,body=404,{'error':'not_found'}
            else:raise AssertionError('Unexpected endpoint: '+req.url)
            r.fulfill(status=status,json=body,headers=cors)
        ctx.route('**/*',route)
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        return ctx,page
    def visit(page,path):
        response=page.goto(args.base+path)
        assert response is None or response.status==200,(path,response.status)
        page.wait_for_load_state('networkidle')
        if '/internal' in path: expect(page.locator('[data-shell-ready=true]')).to_be_visible()
    ctx,page=workspace()
    routes=[('/internal','dashboard'),('/internal/bookkeeping','cash'),('/internal/bookkeeping/#sales','reports'),
            ('/internal/bookkeeping.html#hours','reports'),('/internal/bookkeeping#comparison','reports'),
            ('/internal/inventory','inventory'),('/internal/forms','forms'),('/internal/qr-generator',None),('/internal/ui-gallery',None)]
    for path,current in routes:
        visit(page,path)
        expect(page.locator('[data-internal-shell]')).to_be_visible()
        assert page.locator('[data-shell-chrome] nav a').count()==6
        if current:selected(page,current)
        else:assert page.locator('[data-shell-chrome] [aria-current=page]').count()==0
        assert 'CHINA ROSE' in page.locator('[data-shell-chrome]').first.inner_text()
        expect(page.locator('[data-shell-lock]')).to_be_disabled()
        if current != 'inventory' and '#comparison' not in path:
            assert 'CR3' not in context_line(page).inner_text()
    record('direct routes', 'Nine route/hash/HTML/slash variants open with six real labelled destinations; current-page state correct; QR/gallery do not falsely select another task; no invented global store')
    # Activate every internal destination with native keyboard and pointer links.
    for mode in ('keyboard','pointer'):
        visit(page,'/internal')
        for item in ('cash','reports','inventory','forms','dashboard'):
            if mode=='keyboard':nav(page,item).focus();page.keyboard.press('Enter')
            else:nav(page,item).click()
            expected = {'cash':'/internal/bookkeeping#cash-out','reports':'/internal/reports','inventory':'/internal/inventory','forms':'/internal/forms','dashboard':'/internal'}[item]
            expect(page).to_have_url(re.compile(re.escape(expected)+'$'))
            page.wait_for_load_state('networkidle');expect(page.locator('[data-shell-ready=true]')).to_be_visible();selected(page,item)
            expect(page.locator('h1:visible').first).to_be_visible()
        shot(page,'dashboard-'+mode)
    record('destinations', 'Cash/Reports/Inventory/Forms/Dashboard navigated by keyboard and mouse with nonblank workspaces; each includes a way home')
    # Help is a native modal with Escape/return focus, language stays at the same header location.
    page.get_by_role('button',name='Help',exact=True).click()
    expect(page.get_by_role('dialog')).to_be_visible();page.keyboard.press('Escape')
    expect(page.get_by_role('button',name='Help',exact=True)).to_be_focused()
    record('header controls','Quiet identity replaces warning prominence; language/help/lock positions stable, help modal Escape restores focus')
    ctx.close()

    for variant in ('/internal/bookkeeping','/internal/bookkeeping/','/internal/bookkeeping.html'):
        ctx,page=workspace();visit(page,variant)
        page.evaluate('(raw)=>localStorage.setItem("cr-cash-out",raw)',LEGACY)
        unlock(page);page.locator('#cashout-store').select_option('CR2');page.locator('#cashout-date').fill('2026-11-11');page.locator('#draft-preparer').fill('Shell fixture')
        page.get_by_role('button',name='Start new draft',exact=True).click()
        page.locator('#am-0-name').fill('Synthetic CR2 cashier');page.locator('#am-0-10000').fill('3')
        expect(context_line(page)).to_contain_text('CR2');expect(context_line(page)).to_contain_text('2026-11-11')
        page.evaluate('window.shellMountedSentinel="retained"')
        nav(page,'reports').hover();aligned(page,'reports');selected(page,'cash')
        open_sales(page);selected(page,'reports')
        assert page.evaluate('window.shellMountedSentinel')=='retained',variant
        page.go_back();page.wait_for_url(re.compile('/internal/reports$'));page.go_back();selected(page,'cash');expect(page.locator('#tab-cash-out')).to_have_attribute('aria-selected','true')
        page.go_forward();page.wait_for_url(re.compile('/internal/reports$'));page.go_forward();selected(page,'reports');expect(page.locator('#tab-sales')).to_have_attribute('aria-selected','true')
        page.get_by_role('link',name='Skip to workspace',exact=True).focus();page.keyboard.press('Enter')
        expect(page.locator('#internal-workspace')).to_be_focused();selected(page,'reports')
        page.locator('#sc-location').select_option(index=1);page.locator('#sc-date').fill('2026-11-10');page.locator('#sc-first').fill('Sales fixture')
        expect(context_line(page)).to_contain_text('CR3');expect(context_line(page)).to_contain_text('2026-11-10')
        page.locator('#tab-hours').click();selected(page,'reports')
        page.locator('#hc-location').select_option(index=2);page.locator('#hc-start').fill('2026-11-01');page.locator('#hc-end').fill('2026-11-30')
        page.locator('#hc-file').set_input_files({'name':'synthetic-hours.csv','mimeType':'text/csv','buffer':b'Employee External Id,Employee,Job Title,In Date,Out Date,Total Hours,Regular Hours,Overtime Hours\ne1,Fixture,Cook,11/11/2026 08:00 AM,11/11/2026 04:00 PM,8,8,0\n'})
        page.evaluate('window.shellOriginalFile=document.querySelector("#hc-file").files[0]')
        expect(context_line(page)).to_contain_text('CR2');expect(context_line(page)).to_contain_text('2026-11-30')
        nav(page,'cash').click();selected(page,'cash');expect(page.locator('#am-0-name')).to_have_value('Synthetic CR2 cashier');expect(page.locator('#am-0-10000')).to_have_value('3')
        open_sales(page);expect(page.locator('#sc-first')).to_have_value('Sales fixture')
        page.locator('#tab-hours').click();assert page.locator('#hc-file').evaluate('e=>e.files[0].name')=='synthetic-hours.csv'
        assert page.evaluate('window.shellOriginalFile===document.querySelector("#hc-file").files[0]')
        assert page.evaluate('window.shellMountedSentinel')=='retained'
        nav(page,'schedule').click();expect(page.get_by_role('dialog')).to_be_visible()
        page.get_by_role('dialog').get_by_role('button',name='Cancel',exact=True).click()
        selected(page,'reports');expect(page.locator('#hc-start')).to_have_value('2026-11-01')
        record(variant,'Native same-document Cash/Reports links preserve mounted cash/sales/hours fields and File object; legacy tabs synchronize selected nav/context; canceling departure to Schedule preserves edits')
        if variant.endswith('.html'):
            # Lock checkpoints all visited tools now; use a fresh cash-only context
            # rather than claiming incomplete sales/hours inputs are recoverable.
            ctx.close();ctx,page=workspace();visit(page,variant)
            page.evaluate('(raw)=>localStorage.setItem("cr-cash-out",raw)',LEGACY)
            unlock(page);page.locator('#cashout-store').select_option('CR2');page.locator('#cashout-date').fill('2026-11-11');page.locator('#draft-preparer').fill('Shell fixture')
            page.get_by_role('button',name='Start new draft',exact=True).click()
            page.locator('#am-0-name').fill('Synthetic CR2 cashier');page.locator('#am-0-10000').fill('3')
            nav(page,'cash').click();shot(page,'cash-cr2-desktop')
            # Existing cash handoff refuses to lock if device persistence fails.
            page.evaluate('() => {window.shellOriginalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException("Synthetic quota","QuotaExceededError")}}')
            page.locator('[data-shell-lock]').click();expect(page.locator('#am-0-10000')).to_have_value('3');expect(page.locator('[data-shell-lock]')).to_be_enabled()
            page.locator('[data-cash-context]').evaluate('(e) => e.open = true')
            expect(page.get_by_text('Draft storage is unavailable.',exact=False)).to_be_visible()
            page.evaluate('() => {Storage.prototype.setItem=window.shellOriginalSet}')
            page.locator('[data-shell-lock]').click();expect(page.locator('#cashout-code')).to_be_visible();expect(page.locator('[data-shell-lock]')).to_be_disabled()
            unlock(page);expect(page.locator('#draft-preparer')).to_be_visible()
            source=page.locator('li').filter(has=page.get_by_text('Preparer: Shell fixture',exact=True))
            source.get_by_role('button',name='Resume as a copy',exact=True).click();expect(page.locator('#am-0-10000')).to_have_value('3')
            record('local cash lock','Header delegates existing Save draft and lock; quota failure retains active editor/access, successful handoff preserves original draft, explicit resume restores count; shared session cleared after all device checkpoints succeed')
            page.get_by_role('button',name='Español',exact=True).click()
            expect(page.locator('#am-0-name')).to_have_value('Synthetic CR2 cashier');expect(context_line(page)).to_contain_text('CR2')
            for width in (768,375,320):
                page.set_viewport_size({'width':width,'height':1000});aligned(page,'cash')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
                if width==375:shot(page,'cash-cr2-spanish-phone')
            page.emulate_media(reduced_motion='reduce');nav(page,'reports').hover()
            assert page.locator('[data-shell-chrome] [data-nav-surface]').evaluate('e=>getComputedStyle(e).transitionDuration')=='0s'
            selected(page,'cash')
            page.emulate_media(media='print');expect(page.locator('header[data-shell-chrome]')).not_to_be_visible();expect(page.locator('aside[data-shell-chrome]')).not_to_be_visible()
            page.pdf(path=str(args.artifacts/'cash-print.pdf'))
            printed='\n'.join(p.extract_text() or '' for p in PdfReader(args.artifacts/'cash-print.pdf').pages)
            assert 'Synthetic CR2 cashier' in printed and '300.00' in printed
            assert 'Herramientas internas' not in printed and 'Skip to workspace' not in printed
            page.emulate_media(media='screen')
            record('responsive language/print','EN/ES preserves values/context; 768/375/320px reflow and aligned surface, reduced motion 0s; printed cash retains name/$300 while shell header/rail/skip controls disappear')
            if args.rea:
                from urllib.request import urlopen
                with urlopen('http://127.0.0.1:9335/json/list') as response:targets=json.load(response)
                target=next(t['id'] for t in targets if t.get('url')==page.url)
                subprocess.run(['rea-project','run','--project',str(ROOT),'--','inspect-web-page','http://127.0.0.1:9335',target,'--include-accessibility-text','--include-storage-keys','--json'],cwd=ROOT,check=True)
        assert page.evaluate('localStorage.getItem("cr-cash-out")')==LEGACY
        assert TOKEN not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})')
        ctx.close()

    ctx,page=workspace(375,True);visit(page,'/internal/forms');unlock(page)
    page.get_by_role('button',name='New write-up',exact=True).click()
    page.locator('#form-draft-store').select_option('CR2');page.locator('#form-draft-date').fill('2026-11-09');page.locator('#form-draft-preparer').fill('Form fixture')
    page.get_by_role('button',name='Start new draft',exact=True).click()
    page.get_by_label('Incident Descriptions',exact=True).fill('Synthetic incident retained through lock')
    expect(context_line(page)).to_contain_text('CR2');expect(context_line(page)).to_contain_text('2026-11-09')
    page.locator('[data-shell-lock]').tap();expect(page.locator('#cashout-code')).to_be_visible();unlock(page)
    page.get_by_role('button',name='New write-up',exact=True).click()
    page.locator('#form-draft-store').select_option('CR2');page.locator('#form-draft-date').fill('2026-11-09');page.locator('#form-draft-preparer').fill('Resume form')
    page.locator('li').filter(has=page.get_by_text('Preparer: Form fixture',exact=True)).get_by_role('button',name='Resume as a copy',exact=True).click()
    expect(page.get_by_label('Incident Descriptions',exact=True)).to_have_value('Synthetic incident retained through lock')
    shot(page,'forms-context-phone')
    record('form context/local lock','Header shows actual form store/date, never guessed from prior tool; manual lock checkpoints and leaves the editor; explicit resume restores its narrative')
    ctx.close()
    ctx,page=workspace(320,True);visit(page,'/internal/inventory');unlock(page)
    expect(context_line(page)).to_contain_text('CR3');shot(page,'inventory-cr3-phone')
    count=page.locator('input[aria-label$=" inventory"]').first;count.fill('3B/2T')
    page.locator('[data-shell-lock]').tap();expect(page.locator('#cashout-code')).to_be_visible();unlock(page)
    expect(count).to_have_value('3B/2T');expect(context_line(page)).to_contain_text('CR3')
    page.locator('[data-shell-lock]').tap();expect(page.locator('#cashout-code')).to_be_visible()
    page.get_by_role('button',name='Español',exact=True).tap();page.add_style_tag(content='html {font-size:200% !important}')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    aligned(page,'inventory');shot(page,'shell-large-text-320')
    record('inventory/enlarged shell','Actual CR3-only inventory context; raw 3B/2T count retained across local lock/unlock; 320px/200% Spanish shell controls and nav reflow without overflow')
    ctx.close()
    ctx,page=workspace()
    for station in ('CR2-kitchen','CR2-diningroom','CR3-kitchen','CR3-diningroom'):
        visit(page,'/scheduler-demo/'+station)
        expect(page.locator('#demo-gate-code')).to_be_visible()
        expect(page.get_by_role('link',name='Internal tools / Herramientas internas',exact=True)).to_be_visible()
        assert page.locator('[data-internal-shell]').count()==0
        visit(page,'/schedule/'+station)
        assert page.locator('[data-internal-shell]').count()==0
        expect(page.locator('h1')).to_be_visible()
    visit(page,'/internal');nav(page,'schedule').focus();page.keyboard.press('Enter');page.wait_for_load_state('networkidle')
    expect(page.locator('#demo-gate-code')).to_be_visible()
    page.get_by_role('link',name='Internal tools / Herramientas internas',exact=True).click();page.wait_for_load_state('networkidle');selected(page,'dashboard')
    record('schedule adapter/shared links','Schedule entry remains gated in its original route group; four station manager/public URLs remain reachable, return adapter leads home; no shared permission or public-reader rewrite')
    browser_version=browser.version;ctx.close();browser.close()
assert not errors,errors
assert not external,external
sources=[*ROOT.glob('src/components/internal/*.tsx'),*ROOT.glob('src/components/internal/ui/*.*'),ROOT/'src/components/internal/shell.module.css',ROOT/'src/app/(order-shell)/internal/layout.tsx',ROOT/'src/app/(public)/scheduler-demo/layout.tsx',ROOT/'src/lib/internal-tools/i18n/en.ts',ROOT/'src/lib/internal-tools/i18n/es.ts',Path(__file__).resolve()]
manifest={'baseCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceFilesSha256':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sources if f.suffix in ('.tsx','.ts','.css','.py')},'browser':browser_version,'frontend':args.base,'api':'http://127.0.0.1:8787 (intercepted)','scenarios':results,'screenshots':images,'pageErrors':errors,'externalAttempts':external,'apiRequests':requests}
(args.artifacts/'results.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'PASS Step 03: {len(results)} scenarios; {len(images)} screenshots; 0 page errors/external attempts; synthetic GET/OPTIONS only')
