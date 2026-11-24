"""Step 12a browser contracts against synthetic loopback APIs only.

Usage: python scripts/test-inventory-views.py http://127.0.0.1:3048
The fixtures deliberately disagree with local drafts and include gaps, raw values,
unknown IDs, and five report date pairs. No production requests are permitted.
"""
import argparse
import copy
import json
import re
import subprocess
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright
from pypdf import PdfReader

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('base')
parser.add_argument('--artifacts', type=Path)
args = parser.parse_args()
assert urlparse(args.base).hostname in ('127.0.0.1', 'localhost')
ROOT = Path(__file__).resolve().parents[1]
ART = args.artifacts or ROOT / 'docs/internal-tools-overhaul/evidence/step-12a/screens'
ART.mkdir(parents=True, exist_ok=True)
DATE = '2026-11-18'
LOOKUP = '2026-11-03'
TOKEN = 'synthetic-step12a-token'
KEY = 'cr-inventory-progress:v1:CR3:' + DATE
CATALOG = [
    {'id': 'supplies', 'title': 'Synthetic supplies', 'useLabel': 'Use', 'showSup': True,
     'items': [
        {'id': 'zero', 'name': 'Zero source', 'sup': 'D', 'use': '2', 'gray': False},
        {'id': 'fraction', 'name': 'Fraction source', 'sup': 'D', 'use': '4', 'gray': False},
        {'id': 'raw', 'name': 'Raw notation', 'sup': 'L', 'use': '3B/2T', 'gray': False},
        {'id': 'enough', 'name': 'Enough source', 'sup': 'L', 'use': '2', 'gray': False},
        {'id': 'skip', 'name': 'Skipped source', 'sup': 'D', 'use': '2', 'gray': False},
        {'id': 'blank', 'name': 'Untouched source', 'sup': 'D', 'use': '2', 'gray': False},
     ]},
    {'id': 'beverages', 'title': 'Synthetic beverages', 'useLabel': 'UNOPEN BOX', 'showSup': False,
     'items': [{'id': 'beverage', 'name': 'Beverage source', 'sup': 'Pepsi', 'use': '6', 'gray': False}]},
]
# Working baseline and four preceding dates: expected values are intentionally
# independent from suggestions and from the local working values edited below.
DOCUMENTS = {
    DATE: {'zero': {'inv': '0', 'order': '2'}, 'raw': {'inv': '3B/2T', 'order': '1B/2T'}},
    '2026-11-17': {'zero': {'inv': '17', 'order': '117'}, 'retired': {'inv': 'old17', 'order': 'gone17', 'done': True}},
    '2026-11-16': {'zero': {'inv': '16', 'order': '116'}},
    '2026-11-15': {'zero': {'inv': '15', 'order': '115'}},
    '2026-11-14': {'zero': {'inv': '14', 'order': '114'}},
    LOOKUP: {'zero': {'inv': 'saved03', 'order': '2/3', 'done': True}, 'retired': {'inv': '3B/2T', 'order': 'raw3/4'}, 'same-name-old': {'inv': 'old-id', 'order': 'old-order'}},
    '2026-11-02': {'zero': {'inv': 'saved02', 'order': ''}, 'unknown-id': {'inv': '0', 'order': '1/2'}},
    '2026-10-21': {'zero': {'inv': 'boundary21', 'order': '21-order'}},  # inclusive: end minus 13
    '2026-10-20': {'zero': {'inv': 'outside20', 'order': '20-order'}},
}
DEVICE_CATALOG = copy.deepcopy(CATALOG)
DEVICE_CATALOG[0]['items'][0]['name'] = 'Device label for saved day'
DEVICE_CATALOG[0]['items'].append({'id': 'retired', 'name': 'Device retired identity', 'sup': 'D', 'use': 'old-use', 'gray': False})
DEVICE_CATALOG[0]['items'].append({'id': 'same-name-new', 'name': 'Same name', 'sup': 'D', 'use': '1', 'gray': False})


def envelope(day, catalog):
    return {'schemaVersion': 1, 'storeId': 'CR3', 'date': day, 'updatedAt': '2026-11-18T10:00:00Z',
            'catalogRevision': 1, 'catalog': catalog,
            'counts': {'zero': {'inv': 'LOCAL-UNSAVED', 'order': 'LOCAL-ORDER'}, 'retired': {'inv': 'LOCAL-RETIRED', 'order': ''}},
            'skipped': ['zero'], 'sectionId': None}


errors, external, scenarios, all_requests = [], [], [], []


def note(text):
    scenarios.append(text)
    print('PASS ' + text, flush=True)


def progress(page):
    return page.locator('[data-inventory-total]').evaluate_all('(nodes)=>Object.fromEntries(nodes.map(n=>[n.dataset.inventoryTotal,n.textContent]))')


def device_bytes(page):
    return page.evaluate("Object.fromEntries(Object.entries(localStorage).filter(([k])=>k==='cr-inventory'||k.startsWith('cr-inventory-day:')||k.startsWith('cr-inventory-progress')))")


def view(page, name):
    return page.locator(f'[data-inventory-view="{name}"]')


def go(page, name):
    if urlparse(page.url).fragment == name and view(page, name).is_visible():
        return
    page.locator(f'nav a[href="#{name}"]').click()
    expect(view(page, name)).to_be_visible()
    expect(page.locator('[data-inventory-heading]')).to_be_focused()


def field(page, name):
    return page.locator('#inventory-on-hand-' + name)


def count_row(page, name):
    return page.locator(f'[data-count-id="{name}"]')


def open_order(page, name):
    details = count_row(page, name).locator('details')
    if details.get_attribute('open') is None:
        details.locator('summary').click()


def unlock(page, wait_for_count=True):
    page.locator('#cashout-code:visible').fill(TOKEN)
    page.get_by_role('button', name='Unlock', exact=True).click()
    expect(page.locator('#inventory-date')).to_have_value(DATE)
    if wait_for_count:
        expect(field(page, 'zero')).to_be_enabled()
    else:
        expect(page.locator('#cashout-code')).not_to_be_visible()


def confirm(page, accept=True):
    expect(page.get_by_role('dialog')).to_be_visible()
    if accept:
        page.get_by_role('dialog').locator('button').last.click()
    else:
        page.keyboard.press('Escape')


def lookup(page, end):
    page.get_by_label('History end date', exact=True).fill(end)
    page.get_by_role('button', name='Load saved days', exact=True).click()


def pdf_text(page, action, filename):
    page.get_by_role('button', name=action, exact=True).click()
    page.wait_for_timeout(100)
    target = ART / filename
    page.pdf(path=str(target), format='Letter', print_background=False)
    result = '\n'.join(p.extract_text() for p in PdfReader(target).pages)
    page.evaluate('window.dispatchEvent(new Event("afterprint"))')
    return result


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--remote-debugging-port=9344'])

    def workspace(path='/internal/inventory/#count', history_mode='ok', catalog_mode='ok', wait_for_count=True):
        ctx = browser.new_context(viewport={'width': 1440, 'height': 1000}, service_workers='block',
                                  reduced_motion='reduce', permissions=['clipboard-read', 'clipboard-write'], accept_downloads=True)
        seeds = {'cr-inventory': json.dumps({'date': DATE, 'counts': {}}),
                 'cr-inventory-progress:v1:CR3:' + LOOKUP: json.dumps(envelope(LOOKUP, DEVICE_CATALOG)),
                 # Unsupported bytes must not be trusted as historical labels.
                 'cr-inventory-progress:v1:CR3:2026-11-02': json.dumps({'schemaVersion': 99, 'catalog': DEVICE_CATALOG})}
        ctx.add_init_script('for(const [key,value] of Object.entries(' + json.dumps(seeds) + ')){if(localStorage.getItem(key)===null)localStorage.setItem(key,value)}; window.print=()=>{window.__printCount=(window.__printCount||0)+1;window.dispatchEvent(new Event("beforeprint"))}')
        state = {'catalog': copy.deepcopy(CATALOG), 'rev': 1, 'documents': copy.deepcopy(DOCUMENTS),
                 'history_mode': history_mode, 'catalog_mode': catalog_mode, 'normalize_unmarked': True, 'held': [], 'requests': [], 'writes': [], 'list_mode': 'ok'}
        cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type',
                'access-control-allow-methods': 'GET,PUT,OPTIONS'}

        def response(to):
            start = (date.fromisoformat(to) - timedelta(days=13)).isoformat()
            # Reverse fixture insertion order so the UI must sort newest first.
            return {'days': [{'date': day, 'counts': copy.deepcopy(values), 'updatedAt': day + 'T12:34:56Z'}
                             for day, values in reversed(list(state['documents'].items())) if start <= day <= to]}

        def api(route):
            req = route.request
            parsed = urlparse(req.url)
            info = {'path': parsed.path, 'query': parsed.query, 'method': req.method}
            state['requests'].append(info)
            all_requests.append(info)
            if req.method == 'OPTIONS':
                route.fulfill(status=204, headers=cors)
            elif parsed.path == '/api/auth/verify':
                route.fulfill(status=200, json={'ok': True}, headers=cors)
            elif parsed.path == '/api/inventory/CR3/list':
                if req.method == 'GET' and state['catalog_mode'] == 'fail':
                    route.fulfill(status=503, json={}, headers=cors)
                    return
                if req.method == 'PUT':
                    body = req.post_data_json
                    assert set(body) == {'sheets', 'baseRev'}
                    state['writes'].append(copy.deepcopy(body))
                    if state['list_mode'] == 'conflict':
                        state['rev'] += 1
                        state['catalog'][0]['items'][0]['name'] = 'Other editor name'
                        route.fulfill(status=409, json={'rev': state['rev']}, headers=cors)
                        return
                    state['catalog'] = body['sheets']
                    state['rev'] += 1
                route.fulfill(status=200, json={'sheets': state['catalog'], 'rev': state['rev']}, headers=cors)
            elif parsed.path == '/api/inventory/CR3':
                end = parse_qs(parsed.query)['to'][0]
                payload = response(end)
                mode = state['history_mode']
                if mode == 'hold':
                    state['held'].append((route, end, payload))
                elif mode == 'fail':
                    route.fulfill(status=503, json={}, headers=cors)
                elif mode == 'auth':
                    route.fulfill(status=401, json={}, headers=cors)
                else:
                    route.fulfill(status=200, json=payload, headers=cors)
            elif parsed.path.startswith('/api/inventory/CR3/') and req.method == 'PUT':
                body = req.post_data_json
                assert set(body) == {'counts'}
                assert all(set(cell) <= {'inv', 'order', 'done'} for cell in body['counts'].values())
                state['writes'].append(copy.deepcopy(body))
                stored = copy.deepcopy(body['counts'])
                if state['normalize_unmarked']:
                    for cell in stored.values():
                        if cell.get('done') is False:
                            cell.pop('done')
                state['documents'][parsed.path.rsplit('/', 1)[-1]] = stored
                route.fulfill(status=200, json={'ok': True}, headers=cors)
            else:
                route.fulfill(status=200, json={'days': []}, headers=cors)

        def guard(route):
            if urlparse(route.request.url).hostname in ('127.0.0.1', 'localhost'):
                route.continue_()
            else:
                external.append(route.request.url)
                route.abort()

        ctx.route('**/*', guard)
        ctx.route('http://127.0.0.1:8787/**', api)
        page = ctx.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('dialog', lambda dialog: dialog.accept() if dialog.type in ('beforeunload', 'confirm') else dialog.dismiss())
        page.goto(args.base + path)
        page.wait_for_load_state('networkidle')
        unlock(page, wait_for_count)
        return ctx, page, state, cors

    ctx, page, state, cors = workspace()
    expect(field(page, 'zero')).to_have_value('0')
    expect(view(page, 'count')).to_be_visible()
    expect(view(page, 'orders').locator('[data-inventory-orders]')).not_to_be_visible()
    expect(page.locator('[data-inventory-comparison]')).not_to_be_visible()
    field(page, 'fraction').fill('1 1/2')
    field(page, 'raw').fill('3B/2T')
    count_row(page, 'enough').get_by_role('button', name='Enough', exact=True).click()
    count_row(page, 'skip').get_by_role('button', name='Skip', exact=True).click()
    open_order(page, 'fraction')
    page.locator('#inventory-order-fraction').fill('7/8 case')
    field(page, 'beverage').fill('1/2')
    expect(page.locator('[data-inventory-total="total"]')).to_have_text('7')
    expected_progress = progress(page)
    page.locator('#inventory-search').fill('Fraction')
    page.locator('#inventory-section').select_option('supplies')
    page.locator('#inventory-filter').select_option('ordering')
    before = device_bytes(page)
    write_count = len(state['writes'])
    go(page, 'orders')
    expect(page.locator('#inventory-date')).to_have_value(DATE)
    expect(view(page, 'orders').locator('[data-inventory-orders]')).to_contain_text('Zero source')
    expect(view(page, 'orders').locator('[data-inventory-orders]')).to_contain_text('Beverage source')
    expect(view(page, 'orders').locator('[data-inventory-orders]').get_by_label('Fraction source order override', exact=True)).to_have_value('7/8 case')
    assert device_bytes(page) == before and len(state['writes']) == write_count
    note('Count rows, six states and partial raw values stay intact; checklist starts independently of Count search/section/order filters')

    # Browser history and keyboard use the same retained controller.
    page.go_back()
    expect(view(page, 'count')).to_be_visible()
    expect(page.locator('#inventory-search')).to_have_value('Fraction')
    expect(field(page, 'fraction')).to_have_value('1 1/2')
    page.go_forward()
    expect(view(page, 'orders')).to_be_visible()
    nav = page.locator('nav a[href="#catalog"]')
    nav.focus()
    page.keyboard.press('Enter')
    expect(view(page, 'catalog')).to_be_visible()
    expect(page.locator('[data-inventory-heading]')).to_be_focused()
    expect(page.locator('input[aria-label$=" name"]')).not_to_be_visible()
    page.get_by_role('button', name='Edit catalog', exact=True).click()
    name = page.get_by_label('Zero source name', exact=True)
    name.fill('Draft catalog rename')
    go(page, 'count')
    expect(field(page, 'fraction')).to_have_value('1 1/2')
    go(page, 'history')
    expect(page.get_by_label('History end date', exact=True)).to_have_value(DATE)
    go(page, 'catalog')
    expect(page.get_by_label('Draft catalog rename name', exact=True)).to_have_value('Draft catalog rename')
    page.get_by_role('button', name='Español', exact=True).click()
    # Hashes are language-independent; don't use translated action names here.
    go(page, 'orders')
    go(page, 'catalog')
    expect(page.get_by_label('Draft catalog rename name', exact=True)).to_have_value('Draft catalog rename')
    page.get_by_role('button', name='English', exact=True).click()
    page.locator('[data-shell-lock]').click()
    expect(page.locator('#cashout-code:visible')).to_be_visible()
    expect(view(page, 'catalog')).not_to_be_visible()
    unlock(page)
    page.get_by_role('button', name='Resume catalog draft', exact=True).click()
    if page.get_by_role('dialog').is_visible():
        confirm(page)
    expect(page.get_by_label('Draft catalog rename name', exact=True)).to_have_value('Draft catalog rename')
    page.reload()
    unlock(page)
    # Catalog recovery is explicit, not silently saved or discarded.
    page.get_by_role('button', name='Resume catalog draft', exact=True).click()
    if page.get_by_role('dialog').is_visible():
        confirm(page)
    expect(page.get_by_label('Draft catalog rename name', exact=True)).to_have_value('Draft catalog rename')
    go(page, 'count')
    page.locator('#inventory-search').fill('')
    page.locator('#inventory-filter').select_option('all')
    page.locator('#inventory-section').select_option('')
    expect(field(page, 'fraction')).to_have_value('1 1/2')
    expect(count_row(page, 'skip')).to_have_attribute('data-count-state', 'skipped')
    assert progress(page) == expected_progress
    view(page, 'count').get_by_role('link', name=re.compile('Catalog draft on this device')).click()
    expect(view(page, 'catalog')).to_be_visible()
    expect(page.get_by_label('Draft catalog rename name', exact=True)).to_have_value('Draft catalog rename')
    page.go_back()
    expect(view(page, 'count')).to_be_visible()
    page.go_forward()
    expect(view(page, 'catalog')).to_be_visible()
    expect(page.locator('#cashout-code')).not_to_be_visible()
    expect(page.get_by_label('Draft catalog rename name', exact=True)).to_have_value('Draft catalog rename')
    page.get_by_role('button', name='Cancel', exact=True).click()
    confirm(page, False)
    expect(page.get_by_label('Draft catalog rename name', exact=True)).to_have_value('Draft catalog rename')
    page.get_by_role('button', name='Cancel', exact=True).click()
    confirm(page)
    expect(page.get_by_role('button', name='Edit catalog', exact=True)).to_be_visible()
    assert state['catalog'][0]['items'][0]['name'] == 'Zero source'
    note('Back/Forward and keyboard focus work; partial count and catalog draft survive navigation, language, lock/unlock and reload; cancel remains explicit')

    go(page, 'orders')
    orders = view(page, 'orders').locator('[data-inventory-orders]')
    supplier = page.get_by_label('Checklist supplier', exact=True)
    expect(supplier).to_have_value('')
    supplier.select_option('D')
    expect(orders).to_contain_text('Fraction source')
    expect(orders).not_to_contain_text('Beverage source')
    # A manual checklist mark does not send an order or create a PUT.
    puts_before_mark = len(state['writes'])
    mark = orders.get_by_role('checkbox').first
    mark.check()
    expect(orders).to_contain_text('Marked ordered')
    assert len(state['writes']) == puts_before_mark
    page.get_by_role('button', name='Copy order list', exact=True).click()
    clipboard = page.evaluate('navigator.clipboard.readText()')
    assert clipboard.startswith('CR3 order ' + DATE)
    assert 'Zero source: 2' in clipboard and 'Fraction source: 7/8 case' in clipboard
    assert 'Beverage source' not in clipboard
    # Edit the same raw existing order field from this view.
    override = orders.get_by_label('Fraction source order override', exact=True)
    override.fill('')
    expect(override).to_have_value('')
    override.press_sequentially('9/10 box')
    expect(override).to_have_value('9/10 box')
    expect(override).to_be_focused()
    page.get_by_role('button', name='Save count & checklist', exact=True).click()
    expect(page.get_by_role('status').filter(has_text='saved')).to_be_visible()
    saved = state['documents'][DATE]
    assert saved['fraction']['order'] == '9/10 box' and saved['zero']['done'] is True
    assert 'skip' not in saved or set(saved['skip']) <= {'inv', 'order', 'done'}
    assert progress(page) == expected_progress
    page.reload()
    unlock(page)
    expect(view(page, 'orders')).to_be_visible()
    expect(orders.get_by_role('checkbox').first).to_be_checked()
    supplier.select_option('D')
    page.get_by_role('button', name='Copy order list', exact=True).click()
    clipboard = page.evaluate('navigator.clipboard.readText()')
    assert 'Zero source: 2' in clipboard and 'Fraction source: 9/10 box' in clipboard
    note('Checklist supplier grouping/filter is independent, manual checked lines remain in clipboard, raw overrides and marks save/reload using only existing fields')

    # Saved records always come from the server, even on dates with unsaved local envelopes.
    go(page, 'history')
    end = page.get_by_label('History end date', exact=True)
    expect(end).to_have_value(DATE)
    lookup(page, LOOKUP)
    selected = page.locator('[data-history-record]')
    expect(selected).to_contain_text('saved03')
    assert selected.locator('input,textarea,select').count() == 0
    expect(selected).to_contain_text('Device label for saved day')
    expect(selected).to_contain_text('Device retired identity')
    expect(selected).to_contain_text('same-name-old')
    expect(selected).to_contain_text('old-id')
    expect(selected).to_contain_text('3B/2T')
    expect(selected).not_to_contain_text('LOCAL-UNSAVED')
    expect(selected).not_to_contain_text('LOCAL-ORDER')
    expect(selected).not_to_contain_text('LOCAL-RETIRED')
    expect(selected).to_contain_text(re.compile('device catalog', re.I))
    expect(selected).to_contain_text(re.compile('historical catalog.*unavailable', re.I))
    records = page.locator('[data-history-results]')
    expect(records).to_contain_text('2026-10-21')
    expect(records).not_to_contain_text('2026-10-20')
    expect(records).to_contain_text('12:34')
    buttons = records.locator(':scope > ul').get_by_role('button')
    ordered_dates = [buttons.nth(i).inner_text() for i in range(buttons.count())]
    assert len(ordered_dates) == 3 and LOOKUP in ordered_dates[0] and '2026-11-02' in ordered_dates[1] and '2026-10-21' in ordered_dates[2]
    buttons.filter(has_text='2026-11-02').click()
    expect(selected).to_contain_text('saved02')
    expect(selected).to_contain_text('Zero source')
    expect(selected).to_contain_text('unknown-id')
    expect(selected).to_contain_text('1/2')
    expect(selected).to_contain_text(re.compile('current shared catalog', re.I))
    expect(selected).not_to_contain_text('Device label for saved day')
    note('Read-only 14-calendar-date lookup sorts gaps newest first, selects newest, shows saved time and server raw values; matching-date catalog metadata supplies labels only, invalid metadata falls back and unknown IDs stay visible')

    # Compare only the original working baseline, independent of browsing.
    compare = page.locator('[data-inventory-comparison]')
    compare.locator('summary').click()
    expect(compare).to_contain_text('9/10 box')
    for expected in ('117', '116', '115', '114'):
        expect(compare).to_contain_text(expected)
    expect(compare).not_to_contain_text('saved03')
    expect(compare).to_contain_text(re.compile('working', re.I))
    before = device_bytes(page)
    puts_before = len(state['writes'])
    end.fill('2026-11-01')
    expect(page.locator('[data-history-stale]')).to_be_visible()
    expect(selected).to_contain_text('saved02')
    state['history_mode'] = 'fail'
    page.get_by_role('button', name='Load saved days', exact=True).click()
    expect(view(page, 'history').get_by_role('alert')).to_be_visible()
    expect(selected).to_contain_text('saved02')
    expect(records).to_contain_text(LOOKUP)
    assert device_bytes(page) == before and len(state['writes']) == puts_before
    state['history_mode'] = 'ok'
    lookup(page, '2026-09-01')
    expect(selected).not_to_be_visible()
    expect(view(page, 'history')).to_contain_text(re.compile('no saved', re.I))
    expect(compare).to_contain_text('117')
    assert device_bytes(page) == before and len(state['writes']) == puts_before
    note('History date changes show stale original context; failed reload retains original results, empty window is distinct, browsing sends no PUT and leaves every count/device byte and working comparison unchanged')

    # Latest lookup wins even if older response resolves last; a date edit without
    # another request invalidates the old in-flight request too.
    state['history_mode'] = 'hold'
    lookup(page, LOOKUP)
    page.wait_for_timeout(50)
    assert state['held']
    older = state['held'].pop()
    lookup(page, '2026-11-02')
    page.wait_for_timeout(50)
    assert state['held']
    newer = state['held'].pop()
    newer[0].fulfill(status=200, json=newer[2], headers=cors)
    expect(selected).to_contain_text('saved02')
    older[0].fulfill(status=200, json=older[2], headers=cors)
    page.wait_for_timeout(100)
    expect(selected).to_contain_text('saved02')
    expect(selected).not_to_contain_text('saved03')
    lookup(page, LOOKUP)
    page.wait_for_timeout(50)
    pending = state['held'].pop()
    end.fill('2026-11-01')
    pending[0].fulfill(status=200, json=pending[2], headers=cors)
    page.wait_for_timeout(100)
    expect(selected).to_contain_text('saved02')
    assert device_bytes(page) == before and len(state['writes']) == puts_before
    state['history_mode'] = 'ok'
    lookup(page, LOOKUP)
    expect(selected).to_contain_text('saved03')
    # Lock hides private records and invalidates responses from the old session.
    state['history_mode'] = 'hold'
    lookup(page, '2026-11-02')
    page.wait_for_timeout(50)
    pending = state['held'].pop()
    page.locator('[data-shell-lock]').click()
    expect(page.locator('#cashout-code:visible')).to_be_visible()
    expect(selected).not_to_be_visible()
    expired = copy.deepcopy(pending[2])
    for expired_day in expired['days']:
        expired_day['counts']['zero']['inv'] = 'EXPIRED-RESPONSE'
    pending[0].fulfill(status=200, json=expired, headers=cors)
    state['history_mode'] = 'ok'
    unlock(page)
    expect(selected).to_contain_text('saved02')
    expect(selected).not_to_contain_text('EXPIRED-RESPONSE')
    assert len(state['writes']) == puts_before
    state['history_mode'] = 'auth'
    lookup(page, LOOKUP)
    expect(page.locator('#cashout-code:visible')).to_be_visible()
    expect(selected).not_to_be_visible()
    state['history_mode'] = 'ok'
    unlock(page)
    expect(field(page, 'fraction')).to_have_value('1 1/2')
    assert len(state['writes']) == puts_before
    note('Independent lookup request generations reject older/date-invalidated/expired-session responses; lock and 401 hide private history without mutating working counts')

    # Print reports exercise the explicit actions, with independent expected raw
    # values. Saved report cannot silently substitute working counts/checklist.
    lookup(page, LOOKUP)
    expect(selected).to_contain_text('saved03')
    saved_text = pdf_text(page, 'Print saved report', 'history-saved.pdf')
    for expected in ('saved03', '2/3', 'raw3/4', 'retired', 'Device retired identity', 'same-name-old', 'old-id', '2026-11-03'):
        assert expected in saved_text, expected
    assert re.search('saved', saved_text, re.I) and re.search('catalog', saved_text, re.I)
    assert 'Device label for saved day ID: zero D 2 boundary21 21-order saved02 saved03 2/3' in ' '.join(saved_text.split())
    assert saved_text.count('INV') == 9 and saved_text.count('ORDER') == 9
    for excluded in ('9/10 box', '1 1/2', 'LOCAL-UNSAVED', 'Edit catalog', 'History end date', 'Load saved days'):
        assert excluded not in saved_text, excluded
    go(page, 'orders')
    supplier.select_option('D')
    checklist_text = pdf_text(page, 'Print checklist', 'checklist-only.pdf')
    for expected in ('Zero source', '2', 'Fraction source', '9/10 box', 'Marked ordered'):
        assert expected in checklist_text, expected
    assert 'Beverage source' not in checklist_text and 'INV' not in checklist_text and 'Use' not in checklist_text
    go(page, 'count')
    page.locator('#inventory-search').fill('nothing matches')
    page.get_by_role('button', name='Español', exact=True).click()
    # Select through a data hook so the visible language can stay Spanish.
    page.locator('[data-print-full]').click()
    page.wait_for_timeout(100)
    full_pdf = ART / 'inventory-full-english.pdf'
    page.pdf(path=str(full_pdf), format='Letter', print_background=False)
    full_text = '\n'.join(p.extract_text() for p in PdfReader(full_pdf).pages)
    page.evaluate('window.dispatchEvent(new Event("afterprint"))')
    for expected in ('ITEM', 'INV', 'ORDER', 'Zero source', 'Fraction source', '9/10 box', '1 1/2', '3B/2T', 'Beverage source', '117', '116', '115', '114'):
        assert expected in full_text, expected
    flat_full = ' '.join(full_text.split())
    assert 'Zero source D 2 14 114 15 115 16 116 17 117 0 2' in flat_full
    assert 'Fraction source D 4 1 1/2 9/10 box' in flat_full
    assert full_text.count('INV') == 15 and full_text.count('ORDER') == 15
    # Two regular catalog sheets and an unknown-ID section each retain the five
    # date pairs. Check dates independently rather than counting headings.
    for day in (14, 15, 16, 17, 18):
        assert f'11/{day}' in full_text, f'11/{day}'
    for excluded in ('Existencias', 'Buscar', 'History end date', 'Edit catalog', 'Skipped on this device'):
        assert excluded not in full_text, excluded
    expect(page.get_by_role('button', name='English', exact=True)).to_be_visible()
    expect(page.locator('#inventory-search')).to_have_value('nothing matches')
    page.get_by_role('button', name='English', exact=True).click()
    page.locator('#inventory-search').fill('')
    note('Saved PDF uses selected server record/provenance, checklist PDF uses supplier selection including marks, full English PDF includes all catalog rows and five date pairs despite filters; language and print state restore')

    # Review every view on wide/tablet/phone and enlarged Spanish at 320px.
    for width, label in ((1440, 'desktop'), (768, 'tablet'), (390, 'phone'), (320, 'spanish-enlarged')):
        page.set_viewport_size({'width': width, 'height': 1000})
        if width == 320:
            page.get_by_role('button', name='Español', exact=True).click()
            page.evaluate('document.documentElement.style.fontSize="32px"')
        for name in ('count', 'orders', 'catalog', 'history'):
            go(page, name)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (width, name)
            if name == 'history' and width < 768:
                label_cell = page.locator('[data-inventory-comparison] tbody th').first
                assert label_cell.bounding_box()['width'] >= 80, 'Comparison row labels need a readable column inside bounded scrolling'
                if width == 390:
                    for region in (page.locator('[data-inventory-comparison] [role=region]'), selected.get_by_role('region').first):
                        assert region.evaluate('(node)=>node.scrollWidth>node.clientWidth')
                        region.evaluate('(node)=>node.scrollLeft=0')
                        region.focus()
                        page.keyboard.press('ArrowRight')
                        page.wait_for_function('(node)=>node.scrollLeft>0', arg=region.element_handle())
                        page.wait_for_timeout(200)
                        region.evaluate('(node)=>node.scrollTo({left:0,behavior:"instant"})')
                        expect(region).to_have_js_property('scrollLeft', 0)
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=str(ART / f'{name}-{label}.png'), full_page=True)
    page.evaluate('document.documentElement.style.fontSize="16px"')
    page.get_by_role('button', name='English', exact=True).click()
    assert TOKEN not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})')
    targets = json.load(urlopen('http://127.0.0.1:9344/json/list'))
    target_id = next(target['id'] for target in targets if target.get('url') == page.url)
    subprocess.run(['rea-project', 'run', '--project', str(ROOT), '--', 'inspect-web-page',
                    'http://127.0.0.1:9344', target_id, '--include-accessibility-text',
                    '--include-storage-keys', '--json'], check=True, stdout=subprocess.DEVNULL)
    ctx.close()
    note('Desktop/tablet/phone and 320px enlarged Spanish reflow without page overflow; keyboard heading focus, reduced motion and access-token storage boundaries retained')

    # The Worker omits false checklist marks. Its acknowledged saved-state label
    # must compare the existing fields semantically, while preserving local bytes.
    norm_ctx, norm_page, norm_state, _ = workspace()
    go(norm_page, 'orders')
    zero_mark = view(norm_page, 'orders').get_by_role('checkbox', name='Zero source Marked ordered', exact=True)
    zero_mark.check()
    norm_page.locator('#inventory-save').click()
    expect(norm_page.get_by_role('status').filter(has_text='saved')).to_be_visible()
    assert norm_state['documents'][DATE]['zero']['done'] is True
    zero_mark.uncheck()
    norm_page.locator('#inventory-save').click()
    expect(norm_page.get_by_role('status').filter(has_text='saved')).to_be_visible()
    assert 'done' not in norm_state['documents'][DATE]['zero']
    go(norm_page, 'history')
    norm_compare = norm_page.locator('[data-inventory-comparison]')
    norm_compare.locator('summary').click()
    expect(norm_compare.locator(':scope > p').first).to_contain_text('saved count & checklist fields')
    norm_page.reload()
    unlock(norm_page)
    norm_compare.locator('summary').click()
    expect(norm_compare.locator(':scope > p').first).to_contain_text('saved count & checklist fields')
    go(norm_page, 'orders')
    expect(zero_mark).not_to_be_checked()
    assert json.loads(norm_page.evaluate('key=>localStorage.getItem(key)', KEY))['counts']['zero']['done'] is False
    norm_ctx.close()
    note('Marked then unmarked checklist save stays correctly labeled saved before and after reload when the Worker omits done:false; raw local fields remain intact')

    # A failed shared catalog cannot manufacture historical labels from the
    # built-in catalog. Valid matching-day metadata is still a separate source.
    missing_ctx, missing_page, missing_state, _ = workspace('/internal/inventory/#history', catalog_mode='fail', wait_for_count=False)
    missing_selected = missing_page.locator('[data-history-record]')
    expect(missing_selected).to_contain_text('2026-11-18')
    expect(missing_selected).to_contain_text('zero')
    expect(missing_selected).to_contain_text('3B/2T')
    expect(missing_selected).to_contain_text('current shared catalog could not be loaded')
    expect(missing_selected).not_to_contain_text('Zero source')
    missing_before = device_bytes(missing_page)
    lookup(missing_page, LOOKUP)
    expect(missing_selected).to_contain_text('Device label for saved day')
    expect(missing_selected).to_contain_text('validated matching-date device catalog')
    assert device_bytes(missing_page) == missing_before and not missing_state['writes']
    go(missing_page, 'catalog')
    missing_state['catalog_mode'] = 'ok'
    missing_page.get_by_role('button', name='Retry source load', exact=True).click()
    go(missing_page, 'count')
    expect(field(missing_page, 'zero')).to_have_value('0')
    missing_ctx.close()
    note('Failed shared catalog history shows unavailable provenance and raw IDs, while validated matching-date device labels still work; Catalog retry restores the original count baseline')

    # All URL compatibility forms and known/unknown hashes initialize directly.
    for path, expected in (
        ('/internal/inventory#count', 'count'), ('/internal/inventory/#orders', 'orders'),
        ('/internal/inventory.html#catalog', 'catalog'), ('/internal/inventory/#history', 'history'),
        ('/internal/inventory/#unknown', 'count'), ('/internal/inventory/', 'count'),
    ):
        direct_ctx, direct_page, direct_state, _ = workspace(path)
        expect(view(direct_page, expected)).to_be_visible()
        assert not direct_state['writes']
        direct_ctx.close()
    note('Direct Count/orders/catalog/history hashes, empty/unknown hashes and extensionless/trailing-slash/.html routes open the expected view without writes')
    browser.close()

assert not errors, errors
assert not external, external
(ART / 'results.json').write_text(json.dumps({'scenarios': scenarios, 'page_errors': errors,
    'external_attempts': external, 'requests': all_requests, 'clipboard': clipboard,
    'viewports': [1440, 768, 390, 320],
    'limits': ['Synthetic local APIs only', 'Physical devices/software keyboard, staff acceptance and live persistence unverified']}, indent=2))
print(f'PASS Step12a {len(scenarios)} browser scenario groups; no page errors or external requests')
