"""FORM-01 local acceptance: search/filter saved forms, empty/no-match/failed states, exact open by keyboard and touch.
Run against Next dev with NEXT_PUBLIC_SCHEDULE_API=http://127.0.0.1:8787.
Usage: python3 scripts/test-forms-list.py http://127.0.0.1:3017
"""
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3017'
assert urlparse(base).hostname in ('127.0.0.1', 'localhost'), 'Local server required'
TOKEN = 'synthetic-forms-token'
ROWS = [  # server order: newest date first, then employee
    {'id': 'dana000001', 'date': '2026-10-10', 'employee': 'Dana', 'label': ''},
    {'id': 'analopez02', 'date': '2026-10-09', 'employee': 'Ana López', 'label': 'Final warning'},
    {'id': 'carl000003', 'date': '2026-10-09', 'employee': 'Carl', 'label': ''},
    {'id': 'analopez01', 'date': '2026-01-05', 'employee': 'Ana López', 'label': 'First warning'},
]
def doc(row):
    return {'v': 1, 'id': row['id'], 'label': row['label'], 'createdAt': '2026-10-24T12:00:00.000Z', 'labelUpdatedAt': None,
            'form': {'date': row['date'], 'employee': row['employee'], 'manager': 'Bob', 'violations': [], 'otherSpecify': '', 'actions': [],
                     'incident': f'Record {row["id"]}', 'incidentCont': '', 'expected': '', 'employeeComments': '', 'employeeSignature': '',
                     'employeeSignedDate': '', 'managerSignature': '', 'managerSignedDate': ''}}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    errors = []
    mode = {'rows': ROWS, 'fail': False}
    def api(route):
        req = route.request
        headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS'}
        if req.method == 'OPTIONS': return route.fulfill(status=204, headers=headers)
        if req.headers.get('authorization') != 'Bearer ' + TOKEN: return route.fulfill(status=401, json={'error': 'unauthorized'}, headers=headers)
        path = urlparse(req.url).path
        if path == '/api/auth/verify': return route.fulfill(status=200, json={'ok': True}, headers=headers)
        if path == '/api/writeups':
            if mode['fail']: return route.abort('failed')
            return route.fulfill(status=200, json={'writeUps': mode['rows']}, headers=headers)
        row = next((r for r in ROWS if path == f'/api/writeups/{r["id"]}'), None)
        if row: return route.fulfill(status=200, json=doc(row), headers=headers)
        errors.append('unexpected ' + req.method + ' ' + path); route.fulfill(status=404, json={'error': 'not_found'}, headers=headers)

    def session(viewport, touch):
        context = browser.new_context(viewport=viewport, has_touch=touch)
        context.route('http://127.0.0.1:8787/**', api)
        context.route('https://*.workers.dev/**', lambda route: (errors.append('remote ' + route.request.url), route.abort()))
        page = context.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(base + '/internal/forms')
        page.locator('#cashout-code').fill(TOKEN)
        page.get_by_role('button', name='Unlock', exact=True).click()
        expect(page.get_by_text(f'Showing {len(mode["rows"])} of {len(mode["rows"])}')).to_be_visible()
        return context, page
    def employees(page):
        return [c.strip() for c in page.locator('tbody tr td:nth-child(3)').evaluate_all('cells => cells.map(c => c.firstChild.textContent)')]

    # Scenario 1: filters by employee, label, type and date keep labels and server order.
    context, page = session({'width': 768, 'height': 1024}, True)
    assert employees(page) == ['Dana', 'Ana López', 'Carl', 'Ana López']
    search = page.get_by_label('Search employee or label', exact=True)
    search.fill('ana lopez')
    expect(page.get_by_text('Showing 2 of 4')).to_be_visible()
    assert employees(page) == ['Ana López', 'Ana López']
    expect(page.get_by_role('cell', name='Final warning')).to_be_visible()
    search.fill('first warning')
    expect(page.get_by_text('Showing 1 of 4')).to_be_visible()
    search.fill('')
    page.get_by_label('From date', exact=True).fill('2026-10-09')
    page.get_by_label('To date', exact=True).fill('2026-10-09')
    expect(page.get_by_text('Showing 2 of 4')).to_be_visible()
    assert employees(page) == ['Ana López', 'Carl']
    page.get_by_label('Form type', exact=True).select_option('write-up')
    expect(page.get_by_text('Showing 2 of 4')).to_be_visible()

    # Scenario 2: no matches is distinct from no records and from a failed load.
    search.fill('nobody')
    expect(page.get_by_text('No saved forms match these filters.')).to_be_visible()
    expect(page.get_by_text('No forms saved yet.')).to_have_count(0)
    page.get_by_role('button', name='Clear filters', exact=True).click()
    expect(search).to_be_focused()
    expect(search).to_have_value('')
    expect(page.get_by_text('Showing 4 of 4')).to_be_visible()

    # Scenario 3: open the exact record by touch, return, then by keyboard.
    page.get_by_role('button', name='Open Write-up for Ana López, 2026-01-05', exact=True).tap()
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_have_value('Record analopez01')
    expect(page.get_by_placeholder('e.g. Second attendance warning')).to_have_value('First warning')
    # A failed refresh keeps the last list visible and offers a retry instead of saying there are none.
    mode['fail'] = True
    page.get_by_role('button', name='Back to list', exact=True).click()
    expect(page.get_by_text('Could not load saved forms. Your filters are kept.')).to_be_visible()
    expect(page.get_by_text('No forms saved yet.')).to_have_count(0)
    assert employees(page) == ['Dana', 'Ana López', 'Carl', 'Ana López']
    mode['fail'] = False
    page.get_by_role('button', name='Try again', exact=True).click()
    expect(page.get_by_text('Could not load saved forms.', exact=False)).to_have_count(0)
    target = page.get_by_role('button', name='Open Write-up for Ana López, 2026-10-09', exact=True)
    expect(target).to_be_enabled()
    target.focus(); page.keyboard.press('Enter')
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_have_value('Record analopez02')
    box = page.get_by_role('button', name='Back to list', exact=True).bounding_box()
    assert box['height'] >= 44, box
    context.close()

    # Phone width with records: no sideways scrolling, each Open button still names its record.
    context, page = session({'width': 375, 'height': 812}, True)
    assert page.evaluate('document.documentElement.scrollWidth') <= 375, 'Horizontal scroll at 375px with records'
    page.get_by_role('button', name='Open Write-up for Carl, 2026-10-09', exact=True).tap()
    expect(page.get_by_label('Incident Descriptions', exact=True)).to_have_value('Record carl000003')
    context.close()

    # Empty store, and a first load that fails, at phone width in Spanish.
    mode['rows'] = []
    context, page = session({'width': 375, 'height': 812}, True)
    expect(page.get_by_text('No forms saved yet.')).to_be_visible()
    page.get_by_role('button', name='Español', exact=True).click()
    expect(page.get_by_text('Todavía no hay formularios guardados.')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth') <= 375, 'Horizontal scroll at 375px'
    context.close()
    mode['fail'] = True
    context = browser.new_context(viewport={'width': 375, 'height': 812}, has_touch=True)
    context.route('http://127.0.0.1:8787/**', api)
    page = context.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/internal/forms')
    page.locator('#cashout-code').fill(TOKEN)
    page.get_by_role('button', name='Unlock', exact=True).click()
    expect(page.get_by_text('Could not load saved forms. Your filters are kept.')).to_be_visible()
    expect(page.get_by_text('No forms saved yet.')).to_have_count(0)
    context.close()

    assert not errors, errors
    browser.close()
print('PASS: FORM-01 saved form search, states and exact open')
