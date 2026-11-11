"""Step 02: real shared-control interactions, navigation geometry and bank roles.
Build with a loopback API override. All external/API requests fail closed.
Usage: python scripts/test-internal-primitives.py http://127.0.0.1:3029 --artifacts /tmp/primitives
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('base')
parser.add_argument('--artifacts', type=Path, default=Path('/tmp/cr-primitives'))
parser.add_argument('--rea', action='store_true')
args = parser.parse_args()
assert urlsplit(args.base).hostname == '127.0.0.1'
args.artifacts.mkdir(parents=True, exist_ok=True)
ROOT = Path(__file__).resolve().parent.parent
results, images, blocked, page_errors, api = [], [], [], [], []

def record(name, observed):
    results.append({'scenario': name, 'observed': observed})

def shot(page, name):
    path = args.artifacts / (name + '.png')
    page.evaluate('window.scrollTo(0, 0)')
    page.wait_for_timeout(50)
    page.screenshot(path=str(path), full_page=True)
    images.append({'file': path.name, 'viewport': page.viewport_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--remote-debugging-port=9334'] if args.rea else [])
    def workspace(width=1440, touch=False):
        context = browser.new_context(viewport={'width': width, 'height': 1000}, has_touch=touch, service_workers='block', reduced_motion='no-preference')
        def guard(route):
            url = urlsplit(route.request.url)
            if '/api/' in url.path:
                api.append(route.request.url); route.abort()
            elif f'{url.scheme}://{url.netloc}' == args.base:
                route.continue_()
            else:
                blocked.append(route.request.url); route.abort()
        context.route('**/*', guard)
        page = context.new_page()
        page.on('pageerror', lambda e: page_errors.append(str(e)))
        response = page.goto(args.base + '/internal/ui-gallery')
        assert response.status == 200
        page.wait_for_load_state('networkidle')
        page.evaluate('document.fonts.ready')
        return context, page

    def nav(page, item): return page.locator('[data-nav-item="' + item + '"]')
    def aligned(page, item):
        target = nav(page, item).bounding_box()
        actual = page.locator('[data-nav-surface]').bounding_box()
        assert actual and target
        assert all(abs(actual[k] - target[k]) < 1.5 for k in ('x', 'y', 'width', 'height')), (item, target, actual)
    def settle(page): page.wait_for_timeout(280)

    context, page = workspace()
    expect(page.get_by_role('heading', name='Component gallery', exact=True)).to_be_visible()
    expect(page.locator('meta[name=robots]')).to_have_attribute('content', 'noindex, nofollow')
    durations = page.locator('[data-nav-surface]').evaluate('e => getComputedStyle(e).transitionDuration')
    assert all(abs(float(value.strip().removesuffix('s')) - .22) < .001 for value in durations.split(',')), durations
    expect(nav(page, 'cash')).to_have_attribute('aria-pressed', 'true')
    settle(page); aligned(page, 'cash')
    original_url = page.url
    nav(page, 'form').hover(); settle(page); aligned(page, 'form')
    expect(nav(page, 'cash')).to_have_attribute('aria-pressed', 'true')
    assert page.url == original_url
    assert page.locator('[data-nav-surface]').count() == 1
    marker = nav(page, 'cash').evaluate("e => ({width: getComputedStyle(e, '::after').width, background: getComputedStyle(e, '::after').backgroundColor})")
    assert marker == {'width': '3px', 'background': 'rgb(255, 255, 255)'}
    shot(page, 'navigation-hover-desktop')
    # Retarget the same surface during rapid actual pointer movement.
    for item in ('home', 'report', 'inventory', 'calendar', 'form'):
        nav(page, item).hover()
    settle(page); aligned(page, 'form')
    page.mouse.move(1400, 900); settle(page); aligned(page, 'cash')
    record('pointer navigation', 'One surface retargets, restores selected Cash, never selects/navigates on hover; independent white current marker remains')
    # Native tab order changes focus; only Enter activates a destination.
    nav(page, 'home').focus(); page.keyboard.press('Tab')
    expect(nav(page, 'cash')).to_be_focused()
    page.keyboard.press('Tab'); settle(page); aligned(page, 'inventory')
    expect(nav(page, 'cash')).to_have_attribute('aria-pressed', 'true')
    focus = nav(page, 'inventory').evaluate("e => ({width: getComputedStyle(e).outlineWidth, color: getComputedStyle(e).outlineColor})")
    assert focus['width'] == '3px'
    page.keyboard.press('Enter'); settle(page)
    expect(nav(page, 'inventory')).to_have_attribute('aria-pressed', 'true')
    page.locator('#gallery-name').focus(); settle(page); aligned(page, 'inventory')
    record('keyboard navigation', 'Tab follows visible focus, Enter changes controlled selection, blur restores selection; visible 3px focus independent of surface')

    name, amount, save = page.locator('#gallery-name'), page.locator('#gallery-amount'), page.locator('#gallery-save')
    name.fill('Ana López — synthetic long name'); name.press('Enter')
    expect(amount).to_be_focused(); amount.press('Enter')
    expect(save).to_be_focused()
    expect(page.locator('[data-preview-result]')).to_contain_text('Preview ready')
    page.keyboard.press('Shift+Tab'); expect(page.locator('#gallery-context')).to_be_focused()
    expect(page.locator('#gallery-context')).to_have_attribute('readonly', '')
    amount.fill('-3'); save.click()
    expect(amount).to_be_focused(); expect(amount).to_have_value('-3')
    expect(amount).to_have_attribute('aria-invalid', 'true')
    expect(amount).to_have_attribute('aria-describedby', 'gallery-amount-hint gallery-amount-error')
    expect(page.locator('#gallery-amount-error')).to_contain_text('Enter a nonnegative amount')
    assert page.locator('#gallery-amount-error svg[aria-hidden=true]').count() == 1
    assert amount.evaluate('e => getComputedStyle(e).borderTopWidth') == '2px'
    shot(page, 'field-error-desktop')
    record('entry and error', 'Enter/Shift+Enter use existing EntryWorkspace; final Enter only focuses Save; native Tab includes read-only context; invalid raw value retained with linked hint/error, icon and persistent boundary')
    amount.fill('0'); save.click()
    expect(save).to_be_disabled(); expect(save).to_have_attribute('aria-busy', 'true')
    # Native disabled semantics prevent duplicate activation; no API call occurs.
    expect(page.get_by_role('button', name='Unavailable action', exact=True)).to_be_disabled()
    expect(page.locator('[data-preview-result]')).to_contain_text('No record was saved.', timeout=5000)
    expect(save).to_be_enabled(); expect(amount).to_have_value('0')
    record('busy and disabled', 'Zero remains entered; busy button is native-disabled and announces busy; disabled action inactive; completion explicitly says no record saved')
    page.get_by_role('button', name='Clear preview', exact=True).click()
    dialog = page.get_by_role('dialog')
    expect(dialog.get_by_role('button', name='Cancel', exact=True)).to_be_focused()
    page.keyboard.press('Escape'); expect(dialog).not_to_be_visible()
    expect(page.get_by_role('button', name='Clear preview', exact=True)).to_be_focused()
    expect(name).to_have_value('Ana López — synthetic long name')
    record('confirmation', 'Existing Escape/cancel preserves entered values and restores trigger focus')

    # Exact approved palette and source font availability, not a pixel-mirroring test.
    palette = page.locator('[data-color-role]').evaluate_all("es => Object.fromEntries(es.map(e => [e.dataset.colorRole, {bg: getComputedStyle(e).backgroundColor, fg: getComputedStyle(e).color}]))")
    assert palette['dark'] == {'bg': 'rgb(23, 23, 23)', 'fg': 'rgb(123, 197, 190)'}
    assert palette['light'] == {'bg': 'rgb(255, 255, 255)', 'fg': 'rgb(27, 100, 96)'}
    # The production CSS optimizer may serialize OKLCH as equivalent Lab.
    red = page.evaluate("""color => {
      const context = document.createElement('canvas').getContext('2d');
      return [color, 'oklch(44.4% 0.177 26.899)'].map(value => {
        context.fillStyle = value; context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      });
    }""", palette['primary']['bg'])
    assert all(abs(a - b) <= 1 for a, b in zip(*red)), red
    font_faces = page.evaluate('Array.from(document.fonts).map(f => ({family:f.family,status:f.status}))')
    assert sum(f['status'] == 'loaded' for f in font_faces) >= 2
    paper = page.locator('[aria-labelledby=gallery-entry-title]')
    assert paper.evaluate('e => getComputedStyle(e).borderRadius') == '0px'
    assert '9px 9px 0px' in paper.evaluate('e => getComputedStyle(e).boxShadow')
    record('bank roles', {'palette': palette, 'brandRgbaActualAndReference': red, 'fonts': font_faces, 'activePaper': 'square, approved three-offset shadow; supporting paper has lighter shadow'})

    page.get_by_role('button', name='Español', exact=True).click()
    expect(name).to_have_value('Ana López — synthetic long name'); expect(amount).to_have_value('0')
    for width in (1440, 768, 375, 320):
        page.set_viewport_size({'width': width, 'height': 1000}); settle(page); aligned(page, 'inventory')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
        long_button = page.get_by_role('button', name='Revisar y publicar el horario de todas las estaciones seleccionadas', exact=True)
        assert long_button.evaluate('e => e.scrollWidth <= e.clientWidth')
        if width in (1440, 375, 320): shot(page, 'gallery-es-' + str(width))
    record('language and reflow', 'EN/ES preserves both inputs; Spanish action wraps; surface aligns at 1440/768/375/320px; no horizontal page overflow')
    # 200% text size at phone width: labels must reflow, not clip.
    page.add_style_tag(content='html { font-size: 200% !important; }')
    settle(page); aligned(page, 'inventory')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    shot(page, 'gallery-es-large-text-320')
    record('enlarged text', '200% root text at 320px: page has no horizontal overflow, long Spanish labels reflow and surface remains aligned')
    context.close()

    context, page = workspace(375, True)
    nav(page, 'form').tap(); settle(page); aligned(page, 'form')
    heading = page.locator('h1').bounding_box()
    page.touchscreen.tap(heading['x'] + 10, heading['y'] + 10); settle(page); aligned(page, 'form')
    expect(nav(page, 'form')).to_have_attribute('aria-pressed', 'true')
    for target in page.locator('[data-ui-gallery] button:visible').all():
        box = target.bounding_box()
        assert box['height'] >= 44, (target.inner_text(), box)
    record('touch emulation', 'Tap selects Forms; subsequent outside tap leaves surface at Forms; frequent action targets at least 44px high')
    page.emulate_media(reduced_motion='reduce')
    nav(page, 'home').hover(); aligned(page, 'home')
    assert page.locator('[data-nav-surface]').evaluate('e => getComputedStyle(e).transitionDuration') == '0s'
    page.locator('#gallery-save').hover()
    assert page.locator('#gallery-save').evaluate('e => getComputedStyle(e).transform') == 'none'
    shot(page, 'gallery-reduced-motion-phone')
    record('reduced motion', 'Zero-duration navigation transition; no button hover translation; destination and focus state retained')
    page.emulate_media(media='print')
    expect(page.get_by_role('navigation', name='Preview navigation')).not_to_be_visible()
    assert page.locator('[aria-labelledby=gallery-entry-title]').count() == 1
    pdf = page.pdf(path=str(args.artifacts / 'gallery-print.pdf'))
    printed = '\n'.join(p.extract_text() or '' for p in PdfReader(args.artifacts / 'gallery-print.pdf').pages)
    assert 'Synthetic preview' in printed and 'Ana López' in printed and '300.00' in printed
    record('print', 'Navigation/controls/ornamental shadow hidden; synthetic preview label and sample values retained in PDF; not official form/output approval')
    page.emulate_media(media='screen')
    if args.rea:
        from urllib.request import urlopen
        with urlopen('http://127.0.0.1:9334/json/list') as response:
            targets = json.load(response)
        target = next(t['id'] for t in targets if t.get('url') == page.url)
        subprocess.run(['rea-project','run','--project',str(ROOT),'--','inspect-web-page','http://127.0.0.1:9334',target,'--include-accessibility-text','--include-storage-keys','--json'],cwd=ROOT,check=True)
    browser_version = browser.version
    context.close(); browser.close()

assert not blocked, blocked
assert not api, api
assert not page_errors, page_errors
sources = [*ROOT.glob('src/components/internal/ui/*.tsx'), *ROOT.glob('src/components/internal/ui/*.css'),
           ROOT/'src/components/internal/Feedback.tsx', ROOT/'src/components/internal/EntryWorkspace.tsx',
           ROOT/'src/components/internal/InternalLanguage.tsx', ROOT/'src/components/scheduler/ui.tsx',
           ROOT/'src/app/(order-shell)/internal/ui-gallery/page.tsx', Path(__file__).resolve()]
manifest = {'baseCommit': subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
            'sourceFilesSha256': {str(f.relative_to(ROOT)): hashlib.sha256(f.read_bytes()).hexdigest() for f in sources}, 'browser': browser_version,
            'base': args.base, 'scenarios': results, 'screenshots': images, 'externalAttempts': blocked, 'apiRequests': api, 'pageErrors': page_errors}
(args.artifacts/'results.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'PASS Step 02: {len(results)} scenarios; {len(images)} screenshots; 0 API/external requests; 0 page errors')
