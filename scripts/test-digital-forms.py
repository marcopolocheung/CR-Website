"""Digital forms acceptance against local Next + local Worker (synthetic records only).
Start Next with NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787 and the local
Worker with SCHEDULE_WRITE_TOKEN=synthetic-forms-token, then run this script.
"""
import json
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3017'
api = sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:8787'
assert all(urlparse(url).hostname in ('127.0.0.1', 'localhost') for url in [base, api]), 'Local servers required'
TOKEN = 'synthetic-forms-token'
HEADERS = {'Authorization': 'Bearer ' + TOKEN}
LONG = '\n'.join(f'Line {i}: synthetic incident details for print verification.' for i in range(1, 45))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 375, 'height': 812}, has_touch=True)
    errors, created = [], []
    context.route('https://*.workers.dev/**', lambda route: (errors.append('Remote API request'), route.abort()))
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))

    def unlock():
        page.locator('#cashout-code').fill(TOKEN)
        page.get_by_role('button', name='Unlock', exact=True).click()
        expect(page.get_by_role('button', name='New injury report', exact=True)).to_be_visible()

    def choose(title, index):
        page.get_by_role('button', name='New ' + title, exact=True).click()
        page.locator('#form-draft-store').select_option('CR2' if index % 2 else 'CR3')
        page.locator('#form-draft-date').fill(f'2026-11-0{index}')
        page.locator('#form-draft-preparer').fill('Acceptance manager')

    page.goto(base + '/internal/forms')
    unlock()
    cases = [('injury-report', 'injury report'), ('customer-complaint', 'customer complaint'),
             ('payroll-change-request', 'payroll change request'), ('pay-rate-increase', 'pay rate increase application')]
    for index, (kind, title) in enumerate(cases, 1):
        choose(title, index)
        page.get_by_role('button', name='Start new draft', exact=True).click()
        if kind == 'injury-report':
            expect(page.get_by_role('button', name='Review form', exact=True)).to_be_disabled()
            page.get_by_label('Injured person name *', exact=True).fill('Synthetic injured person')
            page.get_by_label('Date of incident *', exact=True).fill('2026-11-01')
            page.get_by_label('Describe the incident *', exact=True).fill(LONG)
            # Reload and resume a device copy before it has ever been saved to the server.
            page.once('dialog', lambda dialog: dialog.accept())
            page.reload()
            unlock()
            choose(title, index)
            page.get_by_role('button', name='Resume as a copy', exact=True).click()
            expect(page.get_by_label('Describe the incident *', exact=True)).to_have_value(LONG)
        elif kind == 'customer-complaint':
            page.get_by_role('checkbox', name='Rice cold', exact=True).check()
            page.get_by_label('Additional comments', exact=True).fill('Synthetic cold rice complaint')
        elif kind == 'payroll-change-request':
            page.get_by_label('Employee name *', exact=True).fill('Synthetic payroll employee')
            page.get_by_label('Pay period ending date *', exact=True).fill('2026-11-03')
            page.get_by_label('Pay short ($)', exact=True).fill('24.50')
            page.get_by_label('Explanation', exact=True).fill('Synthetic missing shift')
        else:
            page.get_by_label('Employee name *', exact=True).fill('Synthetic' * 6)
            page.get_by_label('Present rate ($) *', exact=True).fill('15.00')
            page.get_by_label('Increase to ($) *', exact=True).fill('16.50')
            page.get_by_label('Effective date *', exact=True).fill('2026-11-04')
        assert page.evaluate('document.documentElement.scrollWidth') <= 375
        page.get_by_role('button', name='Review form', exact=True).click()
        expect(page.get_by_role('button', name='Edit answers', exact=True)).to_be_visible()
        if kind == 'injury-report':
            page.emulate_media(media='print')
            expect(page.locator('article')).to_contain_text('Line 44:')
            assert page.locator('textarea').count() == 0
            page.emulate_media(media='screen')
        with page.expect_response(lambda response: response.url == api + '/api/forms' and response.request.method == 'POST') as response:
            page.get_by_role('button', name='Save form', exact=True).click()
        doc = response.value.json()
        created.append({'type': kind, 'id': doc['id']})
        assert response.value.status == 201 and doc['form']['store'] == ('CR2' if index % 2 else 'CR3')
        assert doc['form']['preparedBy'] == 'Acceptance manager'
        expect(page.get_by_text('Saved.', exact=True)).to_be_visible()
        assert page.locator('article input, article textarea, article select').count() == 0
        page.get_by_role('textbox', name='Label', exact=False).fill('Synthetic follow-up ' + str(index))
        page.get_by_role('button', name='Save label', exact=True).click()
        expect(page.get_by_text('Label saved.', exact=True)).to_be_visible()
        # Simulate lagging KV list metadata after the first save; the confirmed record stays visible.
        def stale_list(route):
            if route.request.method == 'GET': route.fulfill(status=200, json={'forms': []}, headers={'access-control-allow-origin': '*'})
            else: route.continue_()
        if index == 1: page.route(api + '/api/forms', stale_list)
        page.get_by_role('button', name='Back to list', exact=True).click()
        expect(page.get_by_text(f'Showing {index} of {index}', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='New write-up', exact=True)).to_be_enabled()
        if index == 1: page.unroute(api + '/api/forms', stale_list)
        assert page.evaluate('document.documentElement.scrollWidth') <= 375

    # Legacy write-ups share the list and deletion controls without changing their stored shape.
    old = {'date': '2026-10-01', 'employee': 'Synthetic legacy employee', 'manager': 'Manager', 'violations': [], 'otherSpecify': '', 'actions': [],
           'incident': 'Synthetic legacy write-up', 'incidentCont': '', 'expected': '', 'employeeComments': '', 'employeeSignature': '', 'employeeSignedDate': '', 'managerSignature': '', 'managerSignedDate': ''}
    result = page.request.post(api + '/api/writeups', headers=HEADERS, data=old)
    assert result.status == 201
    created.append({'type': 'write-up', 'id': result.json()['id']})
    page.reload(); unlock()
    expect(page.get_by_text('Showing 5 of 5', exact=True)).to_be_visible()
    page.get_by_label('Search name, label or store', exact=True).fill('cr2')
    expect(page.get_by_text('Showing 2 of 5', exact=True)).to_be_visible()
    page.get_by_role('button', name='Clear filters', exact=True).click()
    assert page.evaluate('document.documentElement.scrollWidth') <= 375

    # Reopen after reload, cancel deletion, fail a delete once, then retry successfully.
    page.get_by_role('button', name='Open Injury report for Synthetic injured person, 2026-11-01', exact=True).click()
    expect(page.locator('article')).to_contain_text('Line 44:')
    page.get_by_role('button', name='Delete form', exact=True).click()
    dialog = page.get_by_role('dialog')
    expect(dialog).to_contain_text('Synthetic injured person')
    page.get_by_role('button', name='Cancel', exact=True).click()
    expect(dialog).not_to_be_visible()
    page.get_by_role('button', name='Delete form', exact=True).click()
    target = api + '/api/forms/' + created[0]['id']
    def fail_once(route):
        if route.request.method == 'DELETE': route.fulfill(status=503, json={'error': 'unavailable'}, headers={'access-control-allow-origin': '*'})
        else: route.continue_()
    page.route(target, fail_once)
    dialog.get_by_role('button', name='Delete', exact=True).click()
    expect(dialog.get_by_role('alert')).to_be_visible()
    page.unroute(target, fail_once)
    dialog.get_by_role('button', name='Delete', exact=True).click()
    expect(dialog).not_to_be_visible()
    expect(page.get_by_text('Showing 4 of 4', exact=True)).to_be_visible()
    assert page.request.get(target, headers=HEADERS).status == 404

    # Delete the remaining saved types from their table rows.
    for title, person, date in [('Customer complaint', 'Anonymous customer', '2026-11-02'),
                                ('Payroll change request', 'Synthetic payroll employee', '2026-11-03'),
                                ('Pay rate increase application', 'Synthetic' * 6, '2026-11-04'),
                                ('Write-up', 'Synthetic legacy employee', '2026-10-01')]:
        page.get_by_role('button', name=f'Delete {title} for {person}, {date}', exact=True).click()
        dialog.get_by_role('button', name='Delete', exact=True).click()
        expect(dialog).not_to_be_visible()
    expect(page.get_by_text('No forms saved yet.', exact=True)).to_be_visible()
    # A fresh session sees the same empty server list; every old record returns 404.
    page.reload(); unlock()
    expect(page.get_by_text('No forms saved yet.', exact=True)).to_be_visible()
    for record in created:
        collection = 'writeups' if record['type'] == 'write-up' else 'forms'
        assert page.request.get(f'{api}/api/{collection}/{record["id"]}', headers=HEADERS).status == 404
    stored = page.evaluate('JSON.stringify(Object.entries(localStorage))')
    assert TOKEN not in stored and 'Bearer' not in stored
    assert not errors, errors
    browser.close()
print('PASS: digital form drafts, review, save, labels, reopen, mobile, full-text print and deletion for all five types')
