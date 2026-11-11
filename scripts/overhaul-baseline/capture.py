"""Step 01 synthetic route/state baseline. Requires a loopback-configured export.
Fresh browser contexts only; no real records, profiles, credentials or Worker.
"""
import argparse
import hashlib
import json
import subprocess
from urllib.request import urlopen
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = json.loads((Path(__file__).with_name('fixtures.json')).read_text())
TOKEN = 'synthetic-baseline-code'
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type',
        'access-control-allow-methods': 'GET,PUT,OPTIONS'}

def run(base, output, rea):
    assert urlsplit(base).hostname == '127.0.0.1', 'Literal loopback frontend required'
    output.mkdir(parents=True, exist_ok=True)
    results, screenshots, requests, forbidden, errors = [], [], [], [], []
    def record(name, detail):
        results.append({'scenario': name, 'observed': detail})
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--remote-debugging-port=9333'] if rea else [])
        def workspace(width=1440):
            context = browser.new_context(viewport={'width': width, 'height': 1000},
                                          timezone_id='America/Chicago', service_workers='block')
            state = {'failure': False}
            def route(request_route):
                req = request_route.request
                url = urlsplit(req.url)
                origin = f'{url.scheme}://{url.netloc}'
                if origin == base:
                    request_route.continue_(); return
                if origin != 'http://127.0.0.1:8787':
                    forbidden.append(req.url); request_route.abort(); return
                requests.append({'method': req.method, 'path': url.path})
                if req.method == 'OPTIONS':
                    request_route.fulfill(status=204, headers=CORS); return
                status, body = 200, {}
                if url.path == '/api/auth/verify':
                    assert req.headers.get('authorization') == 'Bearer ' + TOKEN
                    body = {'ok': True}
                elif state['failure']:
                    status, body = 503, {'error': 'synthetic_unavailable'}
                elif req.method not in ('GET', 'HEAD'):
                    raise AssertionError('Baseline refuses writes: ' + req.method + ' ' + url.path)
                elif url.path.startswith('/api/cashout/'):
                    status, body = (404, {'error': 'not_found'}) if url.path.count('/') == 4 else (200, {'days': []})
                elif url.path == '/api/inventory/CR3/list': body = {'rev': 0, 'sheets': None}
                elif url.path == '/api/inventory/CR3': body = {'days': []}
                elif url.path == '/api/writeups': body = {'writeUps': []}
                elif url.path == '/api/forms': body = {'forms': []}
                elif url.path == '/api/schedule': body = {'weeks': [], 'rev': 0, 'notModified': False}
                elif url.path.startswith('/api/internal/schedule-requests/'): body = {'record': None}
                elif url.path.startswith('/api/internal/import-directory/'): body = {'record': None}
                elif url.path.startswith('/api/internal/import-history/'): body = {'records': [], 'nextCursor': None}
                elif url.path.startswith('/api/schedule/'): status, body = 404, {'error': 'not_found'}
                else: raise AssertionError('Unhandled mock endpoint: ' + req.url)
                request_route.fulfill(status=status, json=body, headers=CORS)
            context.route('**/*', route)
            page = context.new_page()
            page.on('pageerror', lambda err: errors.append(str(err)))
            return context, page, state
        def shot(page, name):
            page.screenshot(path=str(output / (name + '.png')), full_page=True)
            screenshots.append({'file': name + '.png', 'viewport': page.viewport_size})
        def visit(page, path):
            response = page.goto(base + path)
            if response is not None:  # Same-document hash changes have no response.
                assert response.status == 200, (path, response.status)
            page.wait_for_load_state('networkidle')
            expect(page.locator('h1').first).to_be_visible()
        def unlock(page):
            page.locator('#cashout-code').fill(TOKEN)
            page.get_by_role('button', name='Unlock', exact=True).click()
        # Route compatibility: all current internal destinations, station pickers,
        # station-specific manager/staff links and every supported Bookkeeping hash.
        context, page, state = workspace()
        paths = ['/internal', '/internal/bookkeeping', '/internal/inventory', '/internal/forms',
                 '/internal/qr-generator', '/scheduler-demo', '/schedule']
        for station in ('CR2-diningroom', 'CR2-kitchen', 'CR3-diningroom', 'CR3-kitchen'):
            paths += ['/scheduler-demo/' + station, '/schedule/' + station]
        for path in paths:
            visit(page, path)
            record(path, 'HTTP 200; hydrated title visible; external network blocked')
            if path in ('/internal', '/internal/inventory', '/internal/forms', '/schedule/CR2-kitchen'):
                shot(page, path.strip('/').replace('/', '-') + '-initial')
        for tab in ('cash-out', 'sales', 'hours', 'comparison'):
            visit(page, '/internal/bookkeeping#' + tab)
            expect(page.locator('#tab-' + tab)).to_have_attribute('aria-selected', 'true')
            expect(page.locator('#panel-' + tab)).to_be_visible()
            record('#' + tab, 'Matching tab selected and panel visible')
        visit(page, '/internal/bookkeeping')
        unlock(page)
        expect(page.locator('#draft-preparer')).to_be_visible()
        shot(page, 'cash-empty-desktop')
        if rea:
            targets = json.load(urlopen('http://127.0.0.1:9333/json/list'))
            target = next(item['id'] for item in targets if item.get('url') == page.url)
            subprocess.run(['rea-project', 'run', '--project', str(ROOT), '--',
                            'inspect-web-page', 'http://127.0.0.1:9333', target,
                            '--include-accessibility-text', '--include-storage-keys', '--json'],
                           cwd=ROOT, check=True)
        visit(page, '/internal/forms')
        unlock(page)
        expect(page.get_by_text('No forms saved yet.', exact=True)).to_be_visible()
        shot(page, 'forms-empty-desktop')
        state['failure'] = True
        page.reload(); page.wait_for_load_state('networkidle'); unlock(page)
        expect(page.get_by_text('Could not load saved forms. Your filters are kept.', exact=False)).to_be_visible()
        expect(page.get_by_text('No forms saved yet.', exact=True)).not_to_be_visible()
        shot(page, 'forms-history-failed')
        record('forms-empty-failed', 'Empty list and failed fetch have distinct messages; failed read does not claim an empty history')
        context.close()
        for store, width in (('CR2', 1440), ('CR3', 375)):
            context, page, state = workspace(width)
            visit(page, '/internal/bookkeeping')
            page.evaluate('(raw) => localStorage.setItem("cr-cash-out", raw)', FIXTURE['legacyDraft'])
            unlock(page)
            page.locator('#cashout-store').select_option(store)
            page.locator('#cashout-date').fill(FIXTURE['date'])
            page.locator('#draft-preparer').fill(FIXTURE['preparer'])
            page.get_by_role('button', name='Start new draft', exact=True).click()
            count = page.locator('#am-0-10000')
            expect(count).to_have_value(FIXTURE['blank'])
            expect(page.locator('#am-0-toast')).to_have_value(FIXTURE['blank'])
            count.fill(FIXTURE['zero'])
            expect(count).to_have_value('0')
            expect(page.locator('[data-cashier-card="am-0"]')).to_contain_text('1 of 11 denomination counts entered')
            count.fill(FIXTURE['count'])
            page.locator('#am-0-name').fill(FIXTURE['cashier'])
            card = page.locator('[data-cashier-card="am-0"]')
            expect(card).to_contain_text('$300.00')
            expect(card).to_contain_text('$200.00')
            page.locator('#am-0-toast').fill('0')
            expect(card).to_contain_text('+$200.00')
            shot(page, 'cash-' + store + '-populated')
            page.locator('#tab-sales').click()
            page.locator('#tab-cash-out').click()
            expect(count).to_have_value('3')
            page.wait_for_function('Object.keys(localStorage).some(k => k.startsWith("cr-internal-draft:"))')
            page.reload(); page.wait_for_load_state('networkidle'); unlock(page)
            page.locator('#cashout-store').select_option(store)
            page.locator('#cashout-date').fill(FIXTURE['date'])
            page.locator('#draft-preparer').fill(FIXTURE['preparer'])
            draft = page.locator('li').filter(has=page.get_by_text('Preparer: ' + FIXTURE['preparer'], exact=True))
            expect(draft).to_contain_text(store)
            shot(page, 'cash-' + store + '-interrupted')
            draft.get_by_role('button', name='Resume as a copy', exact=True).click()
            expect(count).to_have_value('3')
            expect(page.locator('#am-0-name')).to_have_value(FIXTURE['cashier'])
            state['failure'] = True
            page.get_by_role('button', name='Save day', exact=True).click()
            expect(page.locator('[data-save-state]')).to_have_attribute('data-save-state', 'failed')
            expect(page.locator('[data-save-state]')).to_contain_text('Saving is not set up')
            expect(count).to_have_value('3')
            shot(page, 'cash-' + store + '-save-failed')
            assert page.evaluate('localStorage.getItem("cr-cash-out")') == FIXTURE['legacyDraft']
            assert TOKEN not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})')
            record(store, 'Blank/zero distinct; $300 drawer/$200 turn-in; zero Toast gives +$200; tab/reload/resume preserves changed draft; failed save retains inputs; legacy bytes unchanged; no stored token')
            # Partial input: one valid source plus an unmatched/open punch, no workbook success claim.
            page.locator('#tab-hours').click()
            page.locator('#hc-location').select_option(index=2 if store == 'CR2' else 1)
            page.locator('#hc-start').fill('2026-11-01'); page.locator('#hc-end').fill('2026-11-30')
            page.locator('#hc-file').set_input_files({'name': store + '-partial-hours.csv', 'mimeType': 'text/csv', 'buffer': FIXTURE['partialHours'].encode()})
            expect(page.locator('#panel-hours')).to_contain_text('Synthetic matched')
            expect(page.locator('#panel-hours')).to_contain_text('2 source rows · 1 included · 1 excluded')
            expect(page.locator('#panel-hours')).to_contain_text('Included total hours: 8')
            expect(page.locator('#hc-download')).to_be_disabled()
            shot(page, 'hours-' + store + '-partial')
            record(store + '-partial-hours', 'CSV parsed with matched and open/unmatched rows; partial source retained for later review')
            context.close()
        browser_version = browser.version
        browser.close()
    assert not forbidden, forbidden
    assert not errors, errors
    manifest = {'fixture': FIXTURE['id'], 'sourceCommit': subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
                'frontend': base, 'api': 'http://127.0.0.1:8787 (intercepted; no real service)', 'assistant': 'disabled',
                'browser': browser_version, 'scenarios': results, 'screenshots': screenshots,
                'apiRequests': requests, 'externalAttempts': forbidden, 'pageErrors': errors,
                'sha256': {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in output.glob('*.png')}}
    (output / 'browser-results.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'PASS: {len(results)} scenarios; {len(screenshots)} screenshots; {len(requests)} mocked API requests; no external attempts/page errors')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://127.0.0.1:3027')
    parser.add_argument('--output', type=Path, default=ROOT/'docs/internal-tools-overhaul/baselines/2026-11-11')
    parser.add_argument('--rea', action='store_true', help='Retain passive CDP evidence with rea-project (port 9333)')
    args = parser.parse_args()
    run(args.base.rstrip('/'), args.output, args.rea)
