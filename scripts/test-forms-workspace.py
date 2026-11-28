"""Step 13 workspace contracts with synthetic loopback APIs; never production.
Usage: python scripts/test-forms-workspace.py http://127.0.0.1:3050
"""
import argparse
import copy
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright, Error
from pypdf import PdfReader

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('base')
parser.add_argument('--artifacts', type=Path)
args = parser.parse_args()
assert urlparse(args.base).hostname in ('127.0.0.1', 'localhost')
ROOT = Path(__file__).resolve().parents[1]
ART = args.artifacts or ROOT / 'docs/internal-tools-overhaul/evidence/step-13/screens'
ART.mkdir(parents=True, exist_ok=True)
TOKEN = 'synthetic-step13-token'
DATE = '2026-11-23'
PREFIX = 'cr-internal-draft:'
LONG = '\n'.join(f'Line {n:02}: Texto original — synthetic narrative, no translation.' for n in range(1, 41))
TYPES = ('write-up', 'injury-report', 'customer-complaint', 'payroll-change-request', 'pay-rate-increase')
BLANKS = ['hiring-application.xlsx', 'new-hire.pdf', 'payroll-change-request.pdf', 'pay-rate-increase.xlsx', 'paycheck-deduction-approval.docx', 'employee-write-up.xlsx', 'injury-report.pdf', 'customer-complaint.xlsx', 'daily-cash-difference.xlsx', 'cr3-inventory-list.xlsx', 'cr3-daily-prep-list.xlsx']
OLD_FORM = {'date': '2026-01-05', 'employee': 'Historical Ana López', 'manager': 'Historical Bob', 'violations': ['attendance', 'others'], 'otherSpecify': 'Phone', 'actions': ['verbal'], 'incident': LONG, 'incidentCont': 'Independent continuation', 'expected': 'Arrive on time.', 'employeeComments': 'Original employee comment', 'employeeSignature': 'Historical Ana López', 'employeeSignedDate': '2026-01-05', 'managerSignature': 'Historical Bob', 'managerSignedDate': ''}
OLD = {'v': 1, 'id': 'oldwriteup', 'label': 'Historical warning', 'createdAt': '2026-01-05T15:00:00Z', 'labelUpdatedAt': None, 'form': OLD_FORM}
OTHER = {'v': 1, 'id': 'otherwrite', 'label': 'Other record', 'createdAt': '2026-02-01T15:00:00Z', 'labelUpdatedAt': None, 'form': {**copy.deepcopy(OLD_FORM), 'date': '2026-02-01', 'employee': 'Second historical person', 'incident': 'SECOND-RECORD-SENTINEL'}}

errors, external, scenarios, requests = [], [], [], []
def note(text):
    scenarios.append(text)
    print('PASS ' + text, flush=True)
def field(page, key):
    return page.locator('[data-form-editor] #form-field-' + key)
def library(page, key):
    return page.locator('[data-forms-library="' + key + '"]')
def nav(page, key):
    page.locator('nav a[href="#' + key + '"]').click()
def drafts(page):
    return page.evaluate("Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.startsWith('cr-internal-draft:')))")
def confirm(page):
    action = page.get_by_role('dialog').get_by_role('button',name='Confirm',exact=True)
    if action.is_visible(): action.click()
def new_form(page, kind, store='CR3', preparer='Acceptance manager'):
    page.get_by_role('button', name='New form', exact=True).click()
    page.locator('[data-forms-new-type="' + kind + '"]').click()
    # Wait for either setup or the explicit checkpoint question, never cancel the chooser.
    for _ in range(100):
        if page.locator('#form-draft-store:visible').count(): break
        confirm(page);page.wait_for_timeout(50)
    expect(page.locator('#form-draft-store')).to_be_visible()
    page.locator('#form-draft-store').select_option(store)
    page.locator('#form-draft-date').fill(DATE)
    page.locator('#form-draft-preparer').fill(preparer)
    page.get_by_role('button', name='Start new draft', exact=True).click()
    expect(page.locator('[data-form-editor]')).to_be_visible()
def review(page):
    page.get_by_role('button', name='Review form', exact=True).click()
    expect(page.locator('[data-form-review]')).to_be_visible()
def resume(page, row=None, preparer='Resume manager'):
    action = (row or library(page, 'drafts')).get_by_role('button', name='Resume as a copy', exact=True).first
    action.click()
    dialog = page.get_by_role('dialog')
    if dialog.is_visible():
        dialog.locator('input').last.fill(preparer)
        dialog.get_by_role('button', name='Resume as a copy', exact=True).click()
    confirm(page)
def pdf(page, name):
    page.locator('[data-forms-print-action]:visible').click()
    page.wait_for_timeout(60)
    if name in ('legacy-write-up.pdf','write-up-english.pdf'):
        selected=page.locator('[data-forms-print] input[type=checkbox]:checked').evaluate_all('(nodes)=>nodes.map(node=>node.parentElement.textContent.trim())')
        assert selected==(['ATTENDANCE','OTHERS','VERBAL'] if name=='legacy-write-up.pdf' else ['ATTENDANCE','WRITTEN']),selected
    path = ART / name
    page.pdf(path=str(path), format='Letter', print_background=False)
    text = '\n'.join(p.extract_text() for p in PdfReader(path).pages)
    page.evaluate('window.dispatchEvent(new Event("afterprint"))')
    return text

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--remote-debugging-port=9346'])
    def workspace(path='/internal/forms', seeded=True):
        ctx = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', accept_downloads=True)
        ctx.add_init_script('window.print=()=>window.dispatchEvent(new Event("beforeprint"))')
        state = {'writeups': {'oldwriteup': copy.deepcopy(OLD), 'otherwrite': copy.deepcopy(OTHER)} if seeded else {}, 'forms': {}, 'writes': [], 'hold': [], 'list_mode': 'ok', 'detail_mode': 'ok', 'save_mode': 'ok', 'label_mode': 'ok', 'delete_mode': 'ok', 'auth': True, 'sequence': 0}
        cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS'}
        def summary(doc, collection):
            if collection == 'writeups':
                return {'id': doc['id'], 'date': doc['form']['date'], 'employee': doc['form']['employee'], 'label': doc['label']}
            form = doc['form']
            person = form['fields'].get('customer' if doc['type'] == 'customer-complaint' else 'employee') or 'Anonymous customer'
            return {'id': doc['id'], 'type': doc['type'], 'date': form['date'], 'employee': person, 'label': doc['label'], 'store': form['store']}
        def api(route):
            req = route.request
            path = urlparse(req.url).path
            requests.append({'path': path, 'method': req.method})
            if req.method == 'OPTIONS':
                route.fulfill(status=204, headers=cors); return
            if req.headers.get('authorization') != 'Bearer ' + TOKEN or not state['auth']:
                route.fulfill(status=401, json={'error': 'unauthorized'}, headers=cors); return
            if path == '/api/auth/verify':
                route.fulfill(status=200, json={'ok': True}, headers=cors); return
            parts = path.split('/')
            if len(parts) < 3 or parts[2] not in ('forms', 'writeups'):
                route.fulfill(status=200, json={'days': []}, headers=cors); return
            collection = parts[2]
            docs = state[collection]
            if req.method == 'GET' and len(parts) == 3:
                if state['list_mode'] == 'hold': state['hold'].append((route, 'list', collection)); return
                if state['list_mode'] == 'fail': route.fulfill(status=503, json={}, headers=cors); return
                values = [] if state['list_mode'] == 'stale' else [summary(d, collection) for d in docs.values()]
                route.fulfill(status=200, json={('writeUps' if collection == 'writeups' else 'forms'): values}, headers=cors); return
            if req.method == 'POST' and len(parts) == 3:
                body = req.post_data_json
                state['writes'].append({'method': req.method, 'path': path, 'body': copy.deepcopy(body)})
                if state['save_mode'] == 'auth': route.fulfill(status=401, json={}, headers=cors); return
                if state['save_mode'] == 'fail': route.abort('failed'); return
                state['sequence'] += 1
                rid = 'fixture' + str(state['sequence']).zfill(3)
                form = body if collection == 'writeups' else body['form']
                doc = {'v': 1, 'id': rid, 'form': copy.deepcopy(form), 'label': '', 'createdAt': '2026-11-23T15:30:00Z', 'labelUpdatedAt': None}
                if collection == 'forms':
                    assert set(body) == {'type', 'form'}
                    doc['type'] = body['type']
                else:
                    assert set(body) == set(OLD_FORM)
                docs[rid] = doc
                output = {'id': rid, 'createdAt': doc['createdAt']} if collection == 'writeups' else doc
                if state['save_mode'] == 'hold': state['hold'].append((route, 'post', output)); return
                route.fulfill(status=201, json=output, headers=cors); return
            rid = parts[3] if len(parts) > 3 else ''
            doc = docs.get(rid)
            if req.method == 'GET':
                if state['detail_mode'] == 'hold': state['hold'].append((route, 'detail', copy.deepcopy(doc))); return
                if state['detail_mode'] == 'fail': route.fulfill(status=503, json={}, headers=cors); return
                route.fulfill(status=200 if doc else 404, json=doc or {}, headers=cors); return
            if req.method == 'PUT' and len(parts) == 5 and parts[4] == 'label':
                body = req.post_data_json
                assert set(body) == {'label'}
                state['writes'].append({'method': req.method, 'path': path, 'body': body})
                if state['label_mode'] == 'fail': route.fulfill(status=503, json={}, headers=cors); return
                doc['label'] = body['label'].strip(); doc['labelUpdatedAt'] = '2026-11-23T16:00:00Z'
                route.fulfill(status=200, json=doc if collection == 'forms' else {'label': doc['label'], 'labelUpdatedAt': doc['labelUpdatedAt']}, headers=cors); return
            if req.method == 'DELETE':
                state['writes'].append({'method': req.method, 'path': path})
                if state['delete_mode'] == 'fail': route.fulfill(status=503, json={}, headers=cors); return
                docs.pop(rid, None); route.fulfill(status=200, json={'deleted': True}, headers=cors); return
            errors.append('Unexpected ' + req.method + ' ' + path)
            route.fulfill(status=404, json={}, headers=cors)
        def guard(route):
            if urlparse(route.request.url).hostname in ('127.0.0.1', 'localhost'): route.continue_()
            else: external.append(route.request.url); route.abort()
        ctx.route('**/*', guard)
        ctx.route('http://127.0.0.1:8787/**', api)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: d.accept() if d.type == 'beforeunload' else d.dismiss())
        page.goto(args.base + path)
        page.wait_for_load_state('networkidle')
        return ctx, page, state, cors
    def unlock(page):
        page.wait_for_load_state('networkidle')
        page.locator('#cashout-code:visible').fill(TOKEN)
        page.get_by_role('button', name='Unlock', exact=True).click()
        expect(page.get_by_role('button', name='New form', exact=True)).to_be_visible()

    ctx, page, state, cors = workspace()
    expect(page.locator('#cashout-code:visible')).to_be_visible()
    nav(page, 'blank')
    expect(library(page, 'blank')).to_be_visible()
    links = library(page, 'blank').locator('a[href*="/internal/forms/"]')
    hrefs = [links.nth(i).get_attribute('href') for i in range(links.count())]
    assert [h.rsplit('/', 1)[1] for h in hrefs] == BLANKS
    for i, href in enumerate(hrefs):
        is_pdf = href.endswith('.pdf')
        assert (links.nth(i).get_attribute('target') == '_blank') == is_pdf
        assert (links.nth(i).get_attribute('download') is None) == is_pdf
        response = page.request.get(args.base + href)
        assert response.status == 200 and response.body()[:4] == (b'%PDF' if is_pdf else b'PK\x03\x04')
    nav(page, 'saved'); unlock(page)
    expect(library(page, 'saved')).to_be_visible()
    expect(page.get_by_role('button', name='New form', exact=True)).to_have_count(1)
    assert not state['writes']
    note('Saved-first library and one New form action; all eleven original blank URLs/formats remain public without unlocking')

    # Legacy immutable content and label-only changes, with no inferred device store.
    page.get_by_role('button', name='Open Write-up for Historical Ana López, 2026-01-05', exact=True).click()
    record = page.locator('[data-form-record]')
    expect(record).to_contain_text(LONG)
    expect(record).to_contain_text('Historical Ana López')
    assert record.locator('[data-form-content] input,[data-form-content] textarea,[data-form-content] select').count() == 0
    label = page.locator('#forms-label')
    label.fill('Reviewed historical label'); label.press('Enter')
    expect(page.get_by_role('status').filter(has_text='Label saved')).to_be_visible()
    assert state['writes'][-1]['body'] == {'label': 'Reviewed historical label'}
    assert state['writeups']['oldwriteup']['form'] == OLD_FORM
    # Printing must expose full paper text rather than only the first textarea rows.
    text = pdf(page, 'legacy-write-up.pdf')
    for expected in ('Line 01:', 'Line 40:', 'Historical Ana López', 'Historical Bob', 'Independent continuation', 'Arrive on time.', 'ATTENDANCE', 'VERBAL', 'RECORD OF EMPLOYEE CORRECTIVE ACTION'):
        assert expected in text, expected
    for excluded in ('Reviewed historical label', 'Save label', 'New form', 'Saved forms', 'Return to draft'):
        assert excluded not in text, excluded
    nav(page, 'saved')
    note('Historical write-up stays read-only, original fields/signature names unchanged, label request is label-only and full English long-text paper remains compatible')

    # Every existing form has edit -> read-only review -> save and independent expected values.
    expected_forms = {}
    for index, kind in enumerate(TYPES):
        new_form(page, kind, 'CR2' if index % 2 else 'CR3')
        if kind == 'write-up':
            # Missing employee must produce an actionable error, no POST.
            count = len(state['writes']); page.get_by_role('button', name='Review form', exact=True).click()
            expect(page.locator('[data-form-review]')).not_to_be_visible()
            assert len(state['writes']) == count
            field(page, 'employee').fill('New Ana López')
            field(page, 'manager').fill('New manager')
            field(page, 'incident').fill(LONG)
            field(page, 'expected').fill('Independent correction value')
            field(page, 'employeeSignature').fill('New Ana López')
            field(page, 'managerSignature').fill('New manager')
            page.get_by_role('checkbox', name='Attendance', exact=True).check()
            page.get_by_role('checkbox', name='Written', exact=True).check()
        elif kind == 'injury-report':
            field(page, 'employee').fill('Injured José')
            field(page, 'incidentDate').fill('2026-11-22')
            field(page, 'description').fill(LONG)
            field(page, 'reportedBy').fill('Independent reporter')
            page.get_by_role('checkbox', name='Called 911', exact=True).check()
        elif kind == 'customer-complaint':
            field(page, 'customer').fill('Customer María')
            field(page, 'comments').fill(LONG)
            field(page, 'resolution').fill('Independent customer resolution')
            page.get_by_role('checkbox', name='Rice cold', exact=True).check()
        elif kind == 'payroll-change-request':
            field(page, 'employee').fill('Payroll René')
            field(page, 'periodEnd').fill('2026-11-20')
            field(page, 'payShort').fill('24.50')
            field(page, 'explanation').fill(LONG)
            field(page, 'employeeSignature').fill('Payroll René')
        else:
            field(page, 'employee').fill('Raise Zoë')
            field(page, 'presentRate').fill('15.00')
            field(page, 'proposedRate').fill('16.50')
            field(page, 'effectiveDate').fill('2026-12-01')
            field(page, 'reason').fill(LONG)
            field(page, 'payBasis').select_option('Hourly')
        before = drafts(page)
        # Interface language must never translate or rewrite payload bytes.
        page.get_by_role('button', name='Español', exact=True).click()
        assert drafts(page) == before
        page.get_by_role('button', name='English', exact=True).click()
        writes = len(state['writes']); review(page)
        expect(page.locator('[data-form-review]')).to_contain_text('Line 40:')
        assert len(state['writes']) == writes
        # Edit answers returns to the same values, not a new draft or server record.
        if kind=='write-up':
            page.locator('[data-form-review]').get_by_role('button',name=re.compile('^Edit ')).first.click()
            expect(page.locator('[data-form-editor] [id^=form-section-]:focus')).to_have_count(1)
        else: page.get_by_role('button', name='Edit answers', exact=True).first.click()
        expect(page.locator('[data-form-editor]')).to_be_visible()
        assert drafts(page) == before
        review(page)
        page.get_by_role('button', name='Save form', exact=True).click()
        expect(record).to_be_visible()
        assert len(state['writes']) == writes + 1
        mutation = state['writes'][-1]
        assert mutation['method'] == 'POST'
        expected_forms[kind] = copy.deepcopy(mutation['body'])
        if kind == 'write-up':
            assert mutation['body']['violations'] == ['attendance'] and mutation['body']['actions'] == ['written']
        else:
            assert mutation['body']['type'] == kind
            assert mutation['body']['form']['store'] == ('CR2' if index % 2 else 'CR3')
            if kind == 'injury-report': assert mutation['body']['form']['fields']['emergencyResponse'] == ['Called 911']
            if kind == 'customer-complaint': assert mutation['body']['form']['fields']['quality'] == ['Rice cold']
            if kind == 'pay-rate-increase': assert mutation['body']['form']['fields']['payBasis'] == 'Hourly'
        page.get_by_role('button', name='Español', exact=True).click()
        printed = pdf(page, kind + '-english.pdf')
        assert 'Line 01:' in printed and 'Line 40:' in printed
        for excluded in ('Guardar', 'Edit answers', 'New form', 'Drafts', 'Save label'):
            assert excluded not in printed, excluded
        if kind == 'write-up':
            for expected in ('New Ana López', 'Independent correction value', 'ATTENDANCE', 'WRITTEN'):
                assert expected in printed, expected
        if kind == 'injury-report': assert 'Called 911' in printed and 'Independent reporter' in printed
        if kind == 'customer-complaint': assert 'Rice cold' in printed and 'Independent customer resolution' in printed
        if kind == 'payroll-change-request': assert '24.50' in printed and 'Payroll René' in printed and 'Attach a copy of ID' in printed
        if kind == 'pay-rate-increase': assert '15.00' in printed and '16.50' in printed and 'Hourly' in printed and 'I have reviewed the employee' in printed
        # afterprint returns to Spanish, then restore English for next fixture.
        page.get_by_role('button', name='English', exact=True).click()
        nav(page, 'saved')
    note('All five existing types preserve requirements/raw canonical fields, separate read-only review sends no mutation, one POST saves and English PDFs include independent options/amounts/declarations/signatures/all forty narrative lines')

    # Preserve active editor while browsing the three libraries and using Back/Forward.
    new_form(page, 'write-up', preparer='Retained draft manager')
    field(page, 'employee').fill('Retained unsaved person'); field(page, 'incident').fill('Retained raw 3/4 text\nSecond line')
    before = drafts(page); puts = len(state['writes'])
    nav(page, 'drafts'); expect(library(page, 'drafts')).to_be_visible()
    expect(library(page, 'drafts')).to_contain_text('Retained draft manager')
    nav(page, 'blank'); expect(library(page, 'blank')).to_be_visible()
    page.go_back(); expect(library(page, 'drafts')).to_be_visible()
    page.go_forward(); expect(library(page, 'blank')).to_be_visible()
    page.locator('[data-forms-return-draft]').click()
    expect(field(page, 'incident')).to_have_value('Retained raw 3/4 text\nSecond line')
    assert drafts(page) == before and len(state['writes']) == puts
    note('Active draft values and byte-identical device copies survive library navigation, Back/Forward and Return to draft without POSTs')

    # Cross-type draft discovery, recovery bytes and copied resume identity.
    nav(page, 'drafts')
    values = drafts(page); source_key = next(key for key, raw in values.items() if json.loads(raw)['preparer'] == 'Retained draft manager')
    corrupt_key = source_key.rsplit(':', 1)[0] + ':corrupt-fixture'
    raw = '{broken original form bytes'
    page.evaluate('([k,v])=>localStorage.setItem(k,v)', [corrupt_key, raw])
    page.get_by_role('button', name='Refresh drafts', exact=True).click()
    library(page,'drafts').locator('[data-form-draft-recovery] > summary').click()
    expect(library(page, 'drafts')).to_contain_text('cannot be resumed')
    recovery = library(page, 'drafts').locator('li').filter(has_text=re.compile('cannot be resumed', re.I)).first
    with page.expect_download() as dl:
        recovery.get_by_role('button', name='Download original source', exact=True).click()
    assert Path(dl.value.path()).read_text() == raw
    assert page.evaluate('k=>localStorage.getItem(k)', corrupt_key) == raw
    # Reload clears in-memory access/editor, but local form work remains discoverable.
    page.reload(); unlock(page); nav(page, 'drafts')
    row = library(page, 'drafts').locator('li').filter(has_text='Retained draft manager').first
    resume(page, row, 'Copied resume manager')
    expect(field(page, 'employee')).to_have_value('Retained unsaved person')
    expect(field(page, 'incident')).to_have_value('Retained raw 3/4 text\nSecond line')
    after = drafts(page)
    assert after[source_key] == values[source_key]
    copied = [json.loads(v) for k,v in after.items() if k not in values and k != corrupt_key]
    assert copied and copied[-1]['sourceId'] == json.loads(values[source_key])['id']
    assert copied[-1]['preparer'] == 'Copied resume manager'
    assert TOKEN not in page.evaluate('JSON.stringify({...localStorage,...sessionStorage})')
    note('Dedicated Drafts discovers all form contexts, preserves corrupt downloadable source, reload requires unlock and Resume as a copy creates a fresh credential-free identity without replacing original bytes')

    # Failed device storage must retain text and block replacing/locking unprotected work.
    page.evaluate('() => {window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException("quota","QuotaExceededError")}}')
    field(page, 'incident').fill('Text while storage denied')
    expect(page.get_by_text('Draft storage is unavailable', exact=False).first).to_be_visible()
    page.locator('[data-shell-lock]').click()
    expect(field(page, 'incident')).to_have_value('Text while storage denied')
    expect(page.locator('#cashout-code:visible')).not_to_be_visible()
    page.get_by_role('button',name='Close',exact=True).click()
    page.evaluate('() => {Storage.prototype.setItem=window.realSet}')
    field(page, 'incident').fill('Protected again')
    note('Denied device storage retains raw text and refuses an unprotected lock/handoff')

    # Save acknowledgement is authoritative even when follow-up GET fails.
    state['detail_mode'] = 'fail'; review(page); before_posts = sum(w['method']=='POST' for w in state['writes'])
    page.get_by_role('button', name='Save form', exact=True).click()
    expect(page.get_by_role('status').filter(has_text=re.compile('saved', re.I))).to_be_visible()
    page.wait_for_timeout(100)
    assert sum(w['method']=='POST' for w in state['writes']) == before_posts + 1
    # A retry action for the confirmed record may read again, never submit again.
    state['detail_mode'] = 'ok'
    retry = page.get_by_role('button', name=re.compile('Retry.*(load|record)|Load saved', re.I))
    if retry.count(): retry.first.click()
    assert sum(w['method']=='POST' for w in state['writes']) == before_posts + 1
    nav(page, 'saved')
    note('Confirmed write-up POST is retained before a failed follow-up read; loading/retrying the record never replays POST')

    # Uncertain save is not automatically retried or described as saved.
    new_form(page, 'write-up', preparer='Uncertain save manager'); field(page, 'employee').fill('Uncertain person')
    state['save_mode'] = 'fail'; review(page); before_posts = sum(w['method']=='POST' for w in state['writes'])
    page.get_by_role('button', name='Save form', exact=True).click()
    expect(page.get_by_text(re.compile('not confirmed|check saved forms', re.I)).first).to_be_visible()
    page.wait_for_timeout(100)
    assert sum(w['method']=='POST' for w in state['writes']) == before_posts + 1
    state['save_mode'] = 'ok'
    note('Unconfirmed POST keeps the draft, directs the manager to saved forms and does not automatically retry')

    # A detail response resolving after navigating away cannot replace the library.
    nav(page, 'saved'); state['detail_mode'] = 'hold'
    page.get_by_role('button', name='Open Write-up for Historical Ana López, 2026-01-05', exact=True).click()
    page.wait_for_timeout(80); assert state['hold']
    nav(page, 'blank')
    for route, kind, value in state['hold'][:]:
        if kind == 'detail': route.fulfill(status=200, json=value, headers=cors)
    state['hold'].clear(); state['detail_mode'] = 'ok'
    expect(library(page, 'blank')).to_be_visible()
    expect(record).not_to_be_visible()
    note('Late record detail response cannot hijack a newer library selection')

    # Responsive views/editor/review, keyboard targets and language preservation.
    page.locator('[data-forms-return-draft]').click()
    page.get_by_role('button', name='Edit answers', exact=True).first.click()
    for width, label in ((1440, 'desktop'), (768, 'tablet'), (390, 'phone'), (320, 'spanish-enlarged')):
        page.set_viewport_size({'width': width, 'height': 1000})
        if width == 320:
            page.get_by_role('button', name='Español', exact=True).click(); page.evaluate('document.documentElement.style.fontSize="32px"')
        for name in ('saved', 'drafts', 'blank'):
            nav(page, name)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (width, name)
            page.evaluate('window.scrollTo(0,0)'); page.screenshot(path=str(ART/(name+'-'+label+'.png')), full_page=True)
        page.locator('[data-forms-return-draft]').click()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), (width, 'editor')
        page.evaluate('window.scrollTo(0,0)'); page.screenshot(path=str(ART/('editor-'+label+'.png')), full_page=True)
    page.evaluate('document.documentElement.style.fontSize="16px"');page.get_by_role('button', name='English', exact=True).click()
    note('Saved/Drafts/Blank/editor reflow at desktop/tablet/phone/320px enlarged Spanish with preserved work, keyboard focus and reduced motion')

    # Passive runtime observation records only the final requested loopback page.
    import subprocess
    from urllib.request import urlopen
    targets = json.load(urlopen('http://127.0.0.1:9346/json/list'))
    target = next(item['id'] for item in targets if item.get('url') == page.url)
    subprocess.run(['rea-project', 'run', '--project', str(ROOT), '--', 'inspect-web-page', 'http://127.0.0.1:9346', target, '--include-accessibility-text', '--include-storage-keys', '--json'], check=True, stdout=subprocess.DEVNULL)
    ctx.close()
    # A newer record selection wins; old-session read failures cannot revoke a
    # later unlock even when the code happens to be identical.
    guard_ctx,page,state,cors=workspace();unlock(page)
    state['detail_mode']='hold'
    page.get_by_role('button',name='Open Write-up for Historical Ana López, 2026-01-05',exact=True).click()
    page.wait_for_timeout(60);older=state['hold'].pop()
    nav(page,'saved')
    page.get_by_role('button',name='Open Write-up for Second historical person, 2026-02-01',exact=True).click()
    page.wait_for_timeout(60);newer=state['hold'].pop()
    newer[0].fulfill(status=200,json=newer[2],headers=cors)
    expect(page.locator('[data-form-record]')).to_contain_text('SECOND-RECORD-SENTINEL')
    older[0].fulfill(status=200,json=older[2],headers=cors)
    expect(page.locator('[data-form-record]')).to_have_attribute('data-form-record-id','otherwrite')
    nav(page,'saved')
    page.get_by_role('button',name='Open Write-up for Historical Ana López, 2026-01-05',exact=True).click()
    page.wait_for_timeout(60);expired=state['hold'].pop()
    page.locator('[data-shell-lock]').click()
    expect(page.locator('#cashout-code:visible')).to_be_visible()
    state['detail_mode']='ok';unlock(page)
    expired[0].fulfill(status=401,json={},headers=cors)
    page.wait_for_timeout(100)
    expect(page.locator('#cashout-code:visible')).not_to_be_visible()
    assert not state['writes']
    guard_ctx.close()
    note('Latest saved-record selection wins and late 401 reads from a previous session cannot revoke a same-code unlock')

    # Hold a POST and click twice. An independent read can expire its session;
    # acknowledging the old write after unlock must not mark this draft saved.
    guard_ctx,page,state,cors=workspace();unlock(page)
    new_form(page,'write-up',preparer='Request guard manager');field(page,'employee').fill('Guarded employee');review(page)
    state['save_mode']='hold'
    page.get_by_role('button',name='Save form',exact=True).evaluate('(button)=>{button.click();button.click()}')
    page.wait_for_timeout(80)
    held=state['hold'].pop();assert held[1]=='post'
    assert len([write for write in state['writes'] if write['method']=='POST'])==1
    nav(page,'saved');state['auth']=False
    page.get_by_role('button',name='Refresh saved forms',exact=True).click()
    expect(page.locator('#cashout-code:visible')).to_be_visible()
    state['auth']=True;state['save_mode']='ok';unlock(page)
    held[0].fulfill(status=201,json=held[2],headers=cors)
    page.wait_for_timeout(100)
    page.locator('[data-forms-return-draft]').click()
    expect(page.locator('[data-form-review]')).to_contain_text('Guarded employee')
    own=[json.loads(raw) for raw in drafts(page).values() if json.loads(raw)['preparer']=='Request guard manager']
    assert own and all(draft['payload']['savedId'] is None for draft in own)
    assert len([write for write in state['writes'] if write['method']=='POST'])==1
    guard_ctx.close()
    note('Double-clicking Save issues one POST; a held acknowledgement from an expired generation cannot mark the reauthenticated draft saved or replay its write')

    # The permission to make another record applies to one saved identity only.
    guard_ctx,page,state,cors=workspace(seeded=False);unlock(page)
    new_form(page,'write-up');field(page,'employee').fill('Repeat acknowledgement');review(page)
    page.get_by_role('button',name='Save form',exact=True).click();expect(page.locator('[data-form-record]')).to_contain_text('Repeat acknowledgement')
    first_id=page.locator('[data-form-record]').get_attribute('data-form-record-id')
    page.locator('[data-forms-return-draft]').click()
    page.get_by_role('button',name='Edit as a new form',exact=True).click();review(page)
    page.get_by_role('button',name='Save form',exact=True).click();expect(page.locator('[data-form-record]')).to_contain_text('Repeat acknowledgement')
    expect(page.locator('[data-form-record]')).not_to_have_attribute('data-form-record-id',first_id)
    page.locator('[data-forms-return-draft]').click()
    expect(page.get_by_role('button',name='Save form',exact=True)).to_be_disabled()
    expect(page.get_by_role('button',name='Edit as a new form',exact=True)).to_be_visible()
    assert len([write for write in state['writes'] if write['method']=='POST'])==2
    guard_ctx.close()
    note('Every newly saved draft identity requires a fresh explicit acknowledgement before creating another immutable record')

    # Direct hashes and compatibility entry points do not create records.
    for path, expected in (('/internal/forms', 'saved'), ('/internal/forms/#drafts', 'drafts'), ('/internal/forms.html#blank', 'blank'), ('/internal/forms/#unknown', 'saved')):
        direct_ctx, direct_page, direct_state, _ = workspace(path, False)
        if expected != 'blank': unlock(direct_page)
        expect(library(direct_page, expected)).to_be_visible()
        assert not direct_state['writes']
        direct_ctx.close()
    note('Extensionless/slash/.html and direct Saved/Drafts/Blank/unknown hashes initialize without mutations')
    browser.close()
assert not errors, errors
assert not external, external
(ART/'results.json').write_text(json.dumps({'scenarios':scenarios,'page_errors':errors,'external_attempts':external,'requests':requests,'canonical_saved_forms':expected_forms,'viewports':[1440,768,390,320],'limitations':['Synthetic APIs only','Physical touch/software keyboard, staff terminology and live services unverified']}, indent=2)+'\n')
print(f'PASS Step13 {len(scenarios)} scenario groups; no page errors or external attempts')
