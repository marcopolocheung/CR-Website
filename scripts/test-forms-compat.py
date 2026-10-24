"""FORM-07 local acceptance: blank downloads, saved write-up compatibility and long-text print.
Run against Next dev with NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787.
Usage: python3 scripts/test-forms-compat.py http://127.0.0.1:3017
"""
import json
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3017'
assert urlparse(base).hostname in ('127.0.0.1', 'localhost'), 'Local server required'
TOKEN = 'synthetic-forms-token'
LONG = '\n'.join(f'Line {n}: the employee left the line during the lunch rush without telling anyone.' for n in range(1, 41))
# A write-up exactly as the pre-overhaul page saved it (v1, no extra fields).
OLD = {'v': 1, 'id': 'oldwriteup', 'label': 'First warning', 'createdAt': '2026-01-05T15:00:00.000Z', 'labelUpdatedAt': None,
       'form': {'date': '2026-01-05', 'employee': 'Ana Lopez', 'manager': 'Bob', 'violations': ['attendance', 'others'], 'otherSpecify': 'Phone',
                'actions': ['verbal'], 'incident': LONG, 'incidentCont': '', 'expected': 'Arrive on time.', 'employeeComments': '',
                'employeeSignature': 'Ana Lopez', 'employeeSignedDate': '2026-01-05', 'managerSignature': 'Bob', 'managerSignedDate': ''}}
BLANKS = ['hiring-application.xlsx', 'new-hire.pdf', 'payroll-change-request.pdf', 'pay-rate-increase.xlsx', 'paycheck-deduction-approval.docx',
          'employee-write-up.xlsx', 'injury-report.pdf', 'customer-complaint.xlsx', 'daily-cash-difference.xlsx', 'cr3-inventory-list.xlsx', 'cr3-daily-prep-list.xlsx']

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 768, 'height': 1024}, has_touch=True)
    errors, writes = [], []
    doc = json.loads(json.dumps(OLD))

    def api(route):
        req = route.request
        headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS'}
        if req.method == 'OPTIONS': return route.fulfill(status=204, headers=headers)
        if req.headers.get('authorization') != 'Bearer ' + TOKEN: return route.fulfill(status=401, json={'error': 'unauthorized'}, headers=headers)
        path = urlparse(req.url).path
        if path == '/api/auth/verify': return route.fulfill(status=200, json={'ok': True}, headers=headers)
        if path == '/api/writeups' and req.method == 'GET':
            return route.fulfill(status=200, json={'writeUps': [{'id': doc['id'], 'date': doc['form']['date'], 'employee': doc['form']['employee'], 'label': doc['label']}]}, headers=headers)
        if path == '/api/writeups/oldwriteup' and req.method == 'GET': return route.fulfill(status=200, json=doc, headers=headers)
        if path == '/api/writeups/oldwriteup/label' and req.method == 'PUT':
            writes.append((path, req.post_data_json))
            doc['label'] = req.post_data_json['label']; doc['labelUpdatedAt'] = '2026-10-24T12:00:00.000Z'
            return route.fulfill(status=200, json={'label': doc['label'], 'labelUpdatedAt': doc['labelUpdatedAt']}, headers=headers)
        writes.append((path, req.post_data_json))
        route.fulfill(status=404, json={'error': 'not_found'}, headers=headers)
    context.route('http://127.0.0.1:8787/**', api)
    context.route('https://*.workers.dev/**', lambda route: (errors.append('remote request ' + route.request.url), route.abort()))

    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/internal/forms')

    # Scenario 1: every blank form link resolves with its original format.
    links = page.locator('a[href*="/internal/forms/"]')
    hrefs = [links.nth(i).get_attribute('href') for i in range(links.count())]
    assert [h.rsplit('/', 1)[1] for h in hrefs] == BLANKS, hrefs
    for i, h in enumerate(hrefs):
        pdf = h.endswith('.pdf')
        assert (links.nth(i).get_attribute('download') is None) == pdf, h
        assert (links.nth(i).get_attribute('target') == '_blank') == pdf, h
        res = page.request.get(base + h)
        assert res.status == 200, (h, res.status)
        assert res.body()[:4] == (b'%PDF' if pdf else b'PK\x03\x04'), h

    # Scenario 2: an old saved write-up renders read-only and only its label changes.
    page.locator('#cashout-code').fill(TOKEN)
    page.get_by_role('button', name='Unlock', exact=True).click()
    expect(page.get_by_role('cell', name='Ana Lopez', exact=True)).to_be_visible()
    page.get_by_role('button', name='Open Write-up for Ana Lopez, 2026-01-05', exact=True).click()
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_have_value(LONG)
    for field in ['Incident Descriptions', 'Employee Signature', 'Manager Signature']:
        expect(page.get_by_label(field, exact=True)).to_be_disabled()
    expect(page.get_by_label('Employee Signature', exact=True)).to_have_value('Ana Lopez')
    expect(page.get_by_role('checkbox', name='ATTENDANCE')).to_be_checked()
    expect(page.get_by_role('checkbox', name='TERMINATION')).not_to_be_checked()
    page.get_by_role('checkbox', name='TERMINATION').click(force=True)
    expect(page.get_by_role('checkbox', name='TERMINATION')).not_to_be_checked()
    label = page.get_by_placeholder('e.g. Second attendance warning')
    expect(label).to_have_value('First warning')
    label.fill('Second attendance warning')
    page.get_by_role('button', name='Save label', exact=True).click()
    expect(page.get_by_text('Label saved.')).to_be_visible()
    assert writes == [('/api/writeups/oldwriteup/label', {'label': 'Second attendance warning'})], writes
    assert doc['form'] == OLD['form'], 'Form contents changed'

    # Scenario 3: printing keeps every line of a long narrative and the signature fields, over two or more pages.
    page.emulate_media(media='print')
    printed = page.locator('[data-print-text]').first
    expect(printed).to_be_visible()
    assert printed.inner_text().strip() == LONG, 'Printed narrative was truncated'
    assert page.locator('textarea').first.is_hidden()
    expect(page.get_by_label('Employee Signature', exact=True)).to_be_visible()
    assert page.get_by_role('button', name='Save label').is_hidden()
    pdf = page.pdf(format='Letter')
    pages = pdf.count(b'/Type /Page') - pdf.count(b'/Type /Pages')
    assert pages >= 3, f'Expected the long narrative to flow onto extra pages, got {pages}'
    page.emulate_media(media='screen')

    # Keyboard: the label editor is reachable and saves with Enter.
    label.focus()
    label.fill('Third label')
    page.keyboard.press('Enter')
    expect(page.get_by_text('Label saved.')).to_be_visible()
    assert writes[-1] == ('/api/writeups/oldwriteup/label', {'label': 'Third label'})

    assert not errors, errors
    browser.close()
print('PASS: FORM-07 blank downloads, saved write-up compatibility and long-text print')
