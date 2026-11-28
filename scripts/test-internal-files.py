"""Step 14a Files library checks with an intercepted, in-memory Files API (synthetic data, loopback only).

Usage: python3 scripts/test-internal-files.py http://127.0.0.1:3052 [--artifacts DIR]
The static export must be built with NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787.
"""
import argparse, base64, csv, hashlib, io, json, re
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
from playwright.sync_api import expect, sync_playwright
from import_browser_helpers import set_source, hours_review, hours_report, hours_copies

TOKEN = 'synthetic-files-token'
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Meta',
        'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS'}


class FileApi:
    """Mirrors the Worker contract: size/SHA-256 checks, base-revision conflicts, versions, activity and trash."""
    def __init__(self, unconfigured=False):
        self.unconfigured = unconfigured; self.docs = {}; self.objects = {}; self.calls = []; self.external = []
        self.imports = {}; self.clock = 0

    def now(self):
        self.clock += 1; return f'2026-11-27T12:{self.clock // 60:02d}:{self.clock % 60:02d}.000Z'

    def reply(self, route, status, body=None, headers=None):
        route.fulfill(status=status, content_type='application/json', body=json.dumps(body if body is not None else {}), headers={**CORS, **(headers or {})})

    def route(self, route):
        request = route.request; url = urlparse(request.url)
        if url.hostname not in ('127.0.0.1', 'localhost'):
            self.external.append(request.url); return route.abort()
        if url.port != 8787:
            return route.continue_()
        if request.method == 'OPTIONS':
            return route.fulfill(status=204, headers=CORS)
        self.calls.append((request.method, url.path, url.query))
        if url.path == '/api/auth/verify':
            return self.reply(route, 200, {'ok': True})
        if url.path.startswith('/api/internal/import-history/CR3'):
            return self.import_history(route, request)
        if not url.path.startswith('/api/internal/files'):
            return self.reply(route, 200, {'days': []})
        assert request.headers.get('authorization') == f'Bearer {TOKEN}'
        if self.unconfigured:
            return self.reply(route, 503, {'schemaVersion': 1, 'error': {'code': 'backend_unconfigured'}})
        parts = url.path.split('/')[4:]
        if not parts:
            return self.reply(route, 200, self.page(parse_qs(url.query)))
        store = parts[0]
        if parts[1] == 'versions':
            data, name = self.objects[parts[2]]
            return route.fulfill(status=200, body=data, headers={**CORS, 'Content-Type': 'application/octet-stream', 'Content-Disposition': f'attachment; filename="{name}"'})
        key = (store, parts[1])
        if request.method == 'GET':
            return self.reply(route, 200, self.docs[key]) if key in self.docs else self.reply(route, 404, {'error': {'code': 'not_found'}})
        if request.method == 'PUT':
            return self.upload(route, request, store, parts[1])
        return self.change(route, request, key)

    def page(self, query):
        trash = query.get('trash', [''])[0] == '1'
        rows = [d['record'] for d in self.docs.values() if (d['record']['data']['trashedAt'] is not None) == trash]
        if 'store' in query: rows = [r for r in rows if r['storeId'] == query['store'][0]]
        if 'folder' in query: rows = [r for r in rows if r['data']['folder'] == query['folder'][0]]
        if 'label' in query: rows = [r for r in rows if query['label'][0].lower() in [l.lower() for l in r['data']['labels']]]
        if 'q' in query: rows = [r for r in rows if query['q'][0].lower() in r['data']['name'].lower()]
        if 'link' in query: rows = [r for r in rows if query['link'][0] in [f"{l['kind']}:{l['key']}" for l in r['data']['links']]]
        live = [d['record'] for d in self.docs.values() if d['record']['data']['trashedAt'] is None]
        return {'records': sorted(rows, key=lambda r: r['updatedAt'], reverse=True), 'nextCursor': None,
                'folders': sorted({r['data']['folder'] for r in live}), 'labels': sorted({l for r in live for l in r['data']['labels']}, key=str.lower)}

    def upload(self, route, request, store, doc):
        meta = json.loads(base64.urlsafe_b64decode(request.headers['x-file-meta'] + '=' * (-len(request.headers['x-file-meta']) % 4)))
        body = request.post_data_buffer or b''
        if len(body) != meta['size'] or hashlib.sha256(body).hexdigest() != meta['sha256']:
            return self.reply(route, 400, {'error': {'code': 'validation_failed'}})
        key = (store, doc); current = self.docs.get(key)
        if (current['record']['revision'] if current else 0) != meta['baseRevision']:
            return self.reply(route, 409, {'error': {'code': 'revision_conflict', 'currentRevision': current['record']['revision'] if current else 0}})
        self.objects[meta['versionId']] = (body, meta['name'])
        return self.reply(route, 200, {'record': self.commit(key, 'upload' if not current else 'replace', meta['addedBy'], meta, current)})

    def commit(self, key, action, actor, meta=None, current=None, data=None):
        at = self.now()
        if current is None and meta:
            data = {k: meta[k] for k in ('name', 'folder', 'labels', 'links', 'addedBy')} | {'currentVersionId': meta['versionId'], 'trashedAt': None}
            current = {'record': {'schemaVersion': 1, 'family': 'attachment', 'id': key[1], 'storeId': key[0], 'context': {'kind': 'undated'}, 'revision': 0, 'createdAt': at, 'updatedAt': at, 'data': data}, 'versions': [], 'activity': []}
            self.docs[key] = current
        record = current['record']
        if meta: record['data'] = {**record['data'], 'currentVersionId': meta['versionId']}; current['versions'].insert(0, {'id': meta['versionId'], 'filename': meta['name'], 'mediaType': 'application/octet-stream', 'size': meta['size'], 'sha256': meta['sha256'], 'createdAt': at, 'addedBy': actor})
        if data is not None and action != 'upload': record['data'] = data
        record['revision'] += 1; record['updatedAt'] = at
        current['activity'].insert(0, {'action': action, 'actor': actor, 'at': at, 'revision': record['revision']})
        return record

    def change(self, route, request, key):
        body = request.post_data_json; current = self.docs[key]
        if current['record']['revision'] != body['baseRevision']:
            return self.reply(route, 409, {'error': {'code': 'revision_conflict', 'currentRevision': current['record']['revision']}})
        data = dict(current['record']['data'])
        if body['action'] == 'update': data.update(name=body['name'], folder=body['folder'], labels=body['labels'])
        else: data['trashedAt'] = self.now() if body['action'] == 'trash' else None
        return self.reply(route, 200, {'record': self.commit(key, body['action'], body['addedBy'], data=data, current=current)})

    def other_tab_replace(self, key, content=b'other-tab-version'):
        meta = {'versionId': 'ver_othertab-0001', 'name': 'Order sheet.xlsx', 'size': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
        self.objects[meta['versionId']] = (content, meta['name']); self.commit(key, 'replace', 'Luis', meta, self.docs[key])

    def import_history(self, route, request):
        if request.method == 'GET':
            return self.reply(route, 200, {'records': list(self.imports.values()), 'nextCursor': None})
        body = request.post_data_json
        record = {'schemaVersion': 1, 'family': 'import', 'storeId': 'CR3', 'id': body['id'], 'revision': 1, 'context': {'kind': 'period', 'start': '2026-10-01', 'end': '2026-10-31'},
                  'createdAt': '2026-10-24T12:00:00.000Z', 'updatedAt': '2026-10-24T12:00:00.000Z', 'data': body['mutation']['data']}
        self.imports[record['id']] = record
        return self.reply(route, 200, {'record': record})

    def writes(self):
        return [c for c in self.calls if c[0] in ('PUT', 'POST') and c[1].startswith('/api/internal/files')]


def start(browser, base, api, width=1440, path='/internal/files'):
    context = browser.new_context(viewport={'width': width, 'height': 1000}, accept_downloads=True, timezone_id='America/Chicago')
    context.route('**/*', api.route)
    page = context.new_page(); page.set_default_timeout(12000)
    errors = []; page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + path, wait_until='networkidle')
    return context, page, errors


def workspace(page):
    return page.locator('[data-internal-workspace="files"]')


def unlock(page):
    code = page.locator('#files-code'); expect(code).to_be_visible()
    code.fill(TOKEN); code.locator('xpath=ancestor::form').locator('button[type="submit"]').click()
    expect(code).to_have_count(0)


def status(page):
    return workspace(page).locator('p[role=status]').first


def upload(page, name, data, store, folder, labels, who='Maria'):
    ws = workspace(page)
    if not ws.locator('#files-upload').is_visible(): ws.get_by_role('button', name='Upload file', exact=True).click()
    ws.locator('#files-file').set_input_files({'name': name, 'mimeType': 'application/octet-stream', 'buffer': data})
    ws.locator('#files-upload-store').select_option(store); ws.locator('#files-folder').fill(folder); ws.locator('#files-labels').fill(labels)
    ws.locator('#files-name').fill(who); ws.get_by_role('button', name='Upload', exact=True).click()


def check_library(browser, base, artifacts, results):
    api = FileApi(); context, page, errors = start(browser, base, api)
    ws = workspace(page)
    expect(page.locator('[data-shell-chrome] [data-nav-item="files"]')).to_have_attribute('aria-current', 'page')
    unlock(page); expect(ws.locator('[data-files-empty]')).to_have_text('No files here yet.')
    xlsx, csv_bytes, pdf = b'PK\x03\x04synthetic-xlsx', b'date,net\n2026-11-27,100.00\n', b'%PDF-1.4 synthetic'
    # Disallowed types and oversize files never reach the server.
    upload(page, 'page.html', b'<script>x</script>', 'CR3', '', ''); expect(status(page)).to_contain_text('not allowed')
    upload(page, 'huge.pdf', b'0' * (25 * 1024 * 1024 + 1), 'CR3', '', ''); expect(status(page)).to_contain_text('over 25 MB')
    assert not api.writes()
    upload(page, 'Order sheet.xlsx', xlsx, 'CR3', ' Ordering / Suppliers ', 'Weekly order, CR3'); expect(status(page)).to_have_text('Saved to Files.')
    upload(page, 'Ventas día.csv', csv_bytes, 'CR2', 'Reports', 'Sales'); expect(status(page)).to_have_text('Saved to Files.')
    upload(page, 'Deposit.pdf', pdf, 'CR2', 'Reports', 'Sales'); expect(status(page)).to_have_text('Saved to Files.')
    expect(ws.locator('tbody tr')).to_have_count(3)
    stored = {name: data for data, name in api.objects.values()}
    assert stored == {'Order sheet.xlsx': xlsx, 'Ventas día.csv': csv_bytes, 'Deposit.pdf': pdf}
    doc = next(d['record'] for d in api.docs.values() if d['record']['data']['name'] == 'Order sheet.xlsx')
    assert doc['data']['folder'] == 'Ordering/Suppliers' and doc['data']['labels'] == ['Weekly order', 'CR3'] and doc['data']['addedBy'] == 'Maria'
    results.append('Upload sends exact bytes with checksum; .html and >25 MB are refused locally with no request; folder/labels normalize')
    # Filters and folders.
    ws.locator('#files-store').select_option('CR2'); expect(ws.locator('tbody tr')).to_have_count(2)
    ws.locator('#files-store').select_option(''); ws.locator('#files-label').select_option('Weekly order'); expect(ws.locator('tbody tr')).to_have_count(1)
    ws.locator('#files-label').select_option(''); ws.get_by_role('navigation', name='Folders').get_by_role('button', name='Reports', exact=True).click()
    expect(ws.locator('tbody tr')).to_have_count(2)
    ws.get_by_role('navigation', name='Folders').get_by_role('button', name='All folders', exact=True).click()
    ws.locator('#files-search').fill('order'); ws.locator('#files-search').press('Enter'); expect(ws.locator('tbody tr')).to_have_count(1)
    results.append('Store, label, folder and name search filters each narrow the shared CR2 + CR3 library')
    # Detail, download and activity.
    ws.get_by_role('button', name='Order sheet.xlsx', exact=True).click()
    detail = ws.locator('section[aria-labelledby="files-detail-title"]')
    expect(detail.get_by_role('heading', name='Order sheet.xlsx')).to_be_visible()
    expect(detail.locator('ul').last).to_contain_text('Uploaded · Maria (entered)')
    with page.expect_download() as download: detail.get_by_role('button', name='Download', exact=True).click()
    assert Path(download.value.path()).read_bytes() == xlsx and download.value.suggested_filename == 'Order sheet.xlsx'
    # Another tab saves first: replace gets a 409 and both choices work without losing a version.
    api.other_tab_replace(('CR3', doc['id']))
    detail.get_by_label('Replace with a new version').set_input_files({'name': 'Order sheet.xlsx', 'mimeType': 'application/octet-stream', 'buffer': b'PK\x03\x04mine'})
    conflict = ws.get_by_role('alert'); expect(conflict).to_contain_text('Changed since you downloaded it.')
    with page.expect_download() as latest: conflict.get_by_role('button', name='Download latest', exact=True).click()
    assert Path(latest.value.path()).read_bytes() == xlsx  # detail still shows what this tab loaded; the newer copy downloads after refresh
    conflict.get_by_role('button', name='Upload as new version anyway', exact=True).click(); expect(status(page)).to_have_text('New version saved.')
    expect(detail.get_by_role('button', name='Download this version')).to_have_count(3)
    results.append('Download returns exact bytes; a stale replace shows the named conflict with Download latest and Upload anyway; all three versions remain')
    # Rename/move, trash with undo, trash view.
    detail.get_by_role('button', name='Rename, move or relabel', exact=True).click()
    ws.locator('#files-edit-name').fill('Order sheet final.xlsx'); ws.locator('#files-edit-folder').fill('Archive')
    ws.get_by_role('button', name='Save details', exact=True).click(); expect(status(page)).to_have_text('File details saved.')
    detail.get_by_role('button', name='Move to trash', exact=True).click(); expect(status(page)).to_contain_text('Moved to trash.')
    expect(ws.locator('tbody tr')).to_have_count(0)
    status(page).get_by_role('button', name='Undo', exact=True).click(); expect(status(page)).to_have_text('Restored from trash.')
    ws.get_by_role('button', name='Order sheet final.xlsx', exact=True).click()
    detail.get_by_role('button', name='Move to trash', exact=True).click(); expect(status(page)).to_contain_text('Moved to trash.')
    ws.get_by_label('Show trash').check(); expect(ws.locator('tbody tr')).to_have_count(1)
    ws.get_by_role('button', name='Order sheet final.xlsx', exact=True).click()
    expect(detail.locator('ul').last).to_contain_text('Moved to trash · Maria (entered)')
    expect(detail.get_by_role('button', name='Download this version')).to_have_count(3)
    actions = [a['action'] for a in api.docs[('CR3', doc['id'])]['activity']]
    assert actions == ['trash', 'restore', 'trash', 'update', 'replace', 'replace', 'upload'], actions
    results.append('Rename/move, trash, Undo and the trash view each add one activity entry; trashed files keep every version')
    assert TOKEN not in page.evaluate('JSON.stringify(localStorage)') and not errors and not api.external, (errors, api.external)
    context.close()


def check_unconfigured(browser, base, results):
    api = FileApi(unconfigured=True); context, page, errors = start(browser, base, api); unlock(page)
    expect(workspace(page).get_by_text('File storage isn’t set up yet. Nothing has been uploaded.').first).to_be_visible()
    expect(workspace(page).get_by_role('button', name='Upload file')).to_have_count(0)
    assert not errors; context.close()
    results.append('Without storage bindings the screen says storage is not set up instead of showing an empty library')


def check_import_source(browser, base, results):
    api = FileApi(); context, page, errors = start(browser, base, api, width=1280, path='/internal/bookkeeping/')
    page.locator('#cashout-code').fill(TOKEN); page.get_by_role('button', name='Unlock', exact=True).first.click(); expect(page.locator('#cashout-store')).to_be_visible()
    page.locator('#tab-hours').click(); page.locator('#hc-location').select_option(index=1); page.locator('#hc-start').fill('2026-10-01'); page.locator('#hc-end').fill('2026-10-31'); page.locator('#hc-preparer').fill('Synthetic preparer')
    s = io.StringIO(); w = csv.writer(s); w.writerow(['Employee External Id', 'Employee', 'Job Title', 'In Date', 'Out Date', 'Total Hours', 'Regular Hours', 'Overtime Hours'])
    w.writerow(['e1', 'Synthetic worker', 'Cook', '10/24/2026 08:00 AM', '10/24/2026 04:00 PM', '8', '7.5', '0.5']); raw = s.getvalue().encode()
    set_source(page, '#hc-file', {'name': 'original.csv', 'mimeType': 'text/csv', 'buffer': raw})
    history = page.locator('#panel-hours').get_by_role('region', name='Shared import history', exact=True)
    hours_copies(page); hours_review(page); page.locator('#hours-reviewed').check(); hours_report(page)
    history.locator('[data-history=save]').click(); expect(history).to_contain_text('Reviewed import saved to server')
    assert not api.writes(), 'saving an import must not upload the raw file'
    record_id = next(iter(api.imports))
    sources = history.locator(f'[data-related-files="import:{record_id}"]')
    sources.locator('summary').click(); expect(sources.get_by_role('button', name='Save original.csv to Files', exact=True)).to_be_visible()
    sources.get_by_role('button', name='Save original.csv to Files', exact=True).click(); expect(sources.get_by_role('status')).to_have_text('Saved to Files.')
    doc = next(iter(api.docs.values()))['record']
    assert doc['data']['links'] == [{'kind': 'import', 'key': record_id}] and doc['data']['folder'] == 'Imports/Hours' and doc['data']['labels'] == ['hours']
    assert doc['data']['addedBy'] == 'Synthetic preparer' and next(iter(api.objects.values()))[0] == raw
    expect(sources.get_by_role('button', name='Save original.csv to Files')).to_have_count(0)
    expect(sources).to_contain_text('original.csv · Synthetic preparer (entered)')
    assert not errors and not api.external, (errors, api.external)
    context.close()
    results.append('Saving an import uploads nothing; the explicit Save source action stores the exact original file linked to that import in Imports/Hours')


def check_screens(browser, base, artifacts, results):
    api = FileApi(); context, page, errors = start(browser, base, api)
    unlock(page); upload(page, 'Order sheet.xlsx', b'PK\x03\x04x', 'CR3', 'Ordering/Suppliers', 'Weekly order'); expect(status(page)).to_have_text('Saved to Files.')
    workspace(page).get_by_role('button', name='Order sheet.xlsx', exact=True).click()
    for width in (1440, 768, 375):
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), width
        page.screenshot(path=str(artifacts / f'files-{width}.png'), full_page=True)
    page.get_by_role('group', name='Language / Idioma', exact=True).get_by_role('button', name='Español', exact=True).click()
    expect(workspace(page).get_by_role('heading', name='Archivos', level=1)).to_be_visible()
    page.set_viewport_size({'width': 320, 'height': 900}); page.add_style_tag(content='html{font-size:200% !important}')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(artifacts / 'files-spanish-enlarged-320.png'), full_page=True)
    # Keyboard: the Files nav link and the upload toggle work without a pointer.
    page.get_by_role('group', name='Language / Idioma', exact=True).get_by_role('button', name='English', exact=True).click()
    page.set_viewport_size({'width': 1440, 'height': 1000}); page.add_style_tag(content='html{font-size:100% !important}')
    toggle = workspace(page).get_by_role('button', name='Upload file', exact=True); toggle.focus(); page.keyboard.press('Enter')
    expect(toggle).to_have_attribute('aria-expanded', 'true')
    assert not errors and not api.external; context.close()
    results.append('Desktop/tablet/phone and 320px enlarged Spanish reflow without horizontal overflow; keyboard opens upload')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('base'); parser.add_argument('--artifacts', default='/tmp/cr-files')
    args = parser.parse_args(); assert urlparse(args.base).hostname in ('127.0.0.1', 'localhost')
    artifacts = Path(args.artifacts); artifacts.mkdir(parents=True, exist_ok=True); results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        check_library(browser, args.base, artifacts, results)
        check_unconfigured(browser, args.base, results)
        check_import_source(browser, args.base, results)
        check_screens(browser, args.base, artifacts, results)
        browser.close()
    (artifacts / 'results.json').write_text(json.dumps({'groups': results}, indent=2) + '\n')
    print(f'PASS Step 14a Files: {len(results)} groups; screenshots in {artifacts}')
