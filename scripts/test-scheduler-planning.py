"""Planning workspace regression checks against a loopback static export; all APIs are synthetic."""
import argparse
import copy
import json
import re
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright
from importlib.util import module_from_spec, spec_from_file_location

spec = spec_from_file_location('scheduler_views', Path(__file__).with_name('test-scheduler-views.py'))
views = module_from_spec(spec)
spec.loader.exec_module(views)
DAYS = views.DAYS


class PlanningStore(views.FixtureStore):
    def __init__(self, kitchen=False, extra_staff=0):
        super().__init__()
        self.record = None
        self.operations = {}
        self.request_writes = []
        self.fail_request = False
        self.request_failure = None
        self.published = {}
        self.names = ['Jesus', 'Ana', 'Ben', 'Diana', 'Eli', 'Farah', 'Gabe', 'Hana', 'Ivan', 'Jules']
        roles = ['cook', 'dishwasher'] if kitchen else ['server', 'cashier']
        self.employees = [{
            'id': f'sample-{i}', 'name': name, 'roles': roles if i < 6 else [roles[i % 2]],
            'recurringAvailability': {day: [{'start': 960 if i == 8 else 570, 'end': 960 if i == 9 else 1380}] for day in DAYS},
            'active': True, 'allowDoubles': False, 'maxHoursPerWeek': 32, 'maxDaysPerWeek': 4,
        } for i, name in enumerate(self.names)]
        for i in range(extra_staff):
            name = f'Additional employee {i + 1}'
            self.employees.append({**copy.deepcopy(self.employees[0]), 'id': f'additional-{i}', 'name': name})
            self.names.append(name)
        self.template = {day: [{
            'period': period, 'role': role, 'label': role.title(), 'required': True,
            'start': 570 if period == 'AM' else 960, 'end': 960 if period == 'AM' else 1380,
        } for period in ['AM', 'PM'] for role in roles] for day in DAYS}
        self.slot_ids = [f"{day.lower()}-{slot['period'].lower()}-{i}-{slot['label'].lower()}" for day in DAYS for i, slot in enumerate(self.template[day])]
        hash_value = 0x811c9dc5
        for char in '\n'.join(self.slot_ids):
            hash_value = ((hash_value ^ ord(char)) * 0x01000193) & 0xffffffff
        self.template_hash = f'{hash_value:08x}'

    def respond(self, route, body, status=200):
        route.fulfill(status=status, body=json.dumps(body), content_type='application/json', headers={
            'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        })

    def route(self, route):
        request = route.request
        url = urlparse(request.url)
        if request.method == 'OPTIONS':
            return self.respond(route, {})
        if url.path.startswith('/api/internal/schedule-requests/'):
            station = url.path.rsplit('/', 1)[1]
            if request.method == 'GET':
                if self.request_failure:
                    return self.respond(route, {'error': {'code': self.request_failure}}, 503)
                return self.respond(route, {'record': self.record})
            assert request.headers.get('authorization') == 'Bearer fixture-password'
            body = request.post_data_json
            self.request_writes.append(copy.deepcopy(body))
            mutation = body['mutation']
            operation = mutation['operationId']
            if operation not in self.operations:
                previous = self.record['revision'] if self.record else 0
                if mutation['baseRevision'] != previous:
                    return self.respond(route, {'error': {'code': 'conflict'}}, 409)
                self.record = {
                    'schemaVersion': 1, 'family': 'schedule-request', 'id': f'requests-{station}',
                    'storeId': station.split('-')[0], 'stationId': station, 'context': {'kind': 'undated'},
                    'revision': previous + 1, 'createdAt': '2026-11-14T12:00:00.000Z', 'updatedAt': '2026-11-14T12:00:00.000Z',
                    'data': mutation['data'],
                }
                self.operations[operation] = copy.deepcopy(self.record)
            if self.fail_request:
                self.fail_request = False
                return self.respond(route, {'error': {'code': 'unavailable'}}, 503)
            return self.respond(route, {'record': self.operations[operation]})
        if request.method == 'GET' and url.path in ('/api/employees', '/api/staff'):
            return self.respond(route, {'employees': self.employees, 'rev': 1, 'updatedAt': views.UPDATED, 'canUndo': False})
        if request.method == 'GET' and url.path == '/api/template':
            return self.respond(route, {'template': self.template, 'rev': 1, 'updatedAt': views.UPDATED})
        if url.path.startswith('/api/schedule/'):
            week = url.path.rsplit('/', 1)[1]
            if request.method == 'PUT':
                self.writes.append(url.path)
                body = request.post_data_json
                if self.fail_next_save:
                    self.fail_next_save = False
                    return self.respond(route, {'rev': 2}, 409)
                self.published[week] = {**body, 'v': 3, 'weekStart': week, 'rev': body['baseRev'] + 1, 'updatedAt': views.UPDATED}
                return self.respond(route, self.published[week])
            return self.respond(route, self.published.get(week, {
                'v': 3, 'weekStart': week, 'rev': 1, 'visible': True, 'templateHash': self.template_hash, 'updatedAt': views.UPDATED,
                'week': {'version': 1, 'weekStart': week, 'name': 'Fixture week', 'people': self.names,
                         'slotPeople': [(day * 2 + index) % 8 for day in range(7) for index in range(4)]},
            }))
        return super().route(route)


def open_planning(browser, url, kitchen=False, width=1500, request_failure=None, extra_staff=0):
    context = browser.new_context(viewport={'width': width, 'height': 1050})
    context.add_init_script("localStorage.setItem('chinarose.scheduler.layout', 'workspace')")
    store = PlanningStore(kitchen, extra_staff)
    store.request_failure = request_failure
    context.route('**/*', store.route)
    page = context.new_page()
    page.set_default_timeout(10000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    station = 'CR3-kitchen' if kitchen else 'CR3-diningroom'
    page.goto(f'{url}/scheduler-demo/{station}.html', wait_until='networkidle')
    page.get_by_label('Manager code', exact=True).fill('fixture-password')
    page.get_by_role('button', name='Open the scheduler', exact=True).click()
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered')
    return context, page, store, errors


def snapshot(page):
    return page.locator('[data-planning-slot]').evaluate_all('(cells) => cells.map(c => ({slot: c.dataset.planningSlot, employee: c.dataset.employeeId, kept: c.dataset.kept}))')


def check_planning(browser, url, artifacts):
    context, page, store, errors = open_planning(browser, url)
    board = page.locator('#scheduler-panel-schedule')
    expect(page.get_by_role('checkbox', name='Auto-adjust', exact=True)).to_be_checked()
    assert page.get_by_role('button', name='Next week', exact=True).bounding_box()['height'] >= 44
    badges = page.locator('[data-planning-slot] [data-role-badge]')
    expect(badges).to_have_count(28)
    expect(badges.locator('svg[data-role-icon]')).to_have_count(28)
    role_colors = badges.evaluate_all('''badges => badges.map(b => ({role: b.dataset.roleBadge, color: getComputedStyle(b).color}))''')
    assert len({b['color'] for b in role_colors}) == 2
    for role in ['server', 'cashier']:
        assert len({b['color'] for b in role_colors if b['role'] == role}) == 1
    expect(page.locator('[data-planning-slot]').first.locator('..').locator('..').locator('h3')).to_contain_text('SUN')
    before = snapshot(page)
    source_id, target_id = store.slot_ids[0], store.slot_ids[4]
    source = page.locator(f'[data-planning-slot="{source_id}"] button').first
    target = page.locator(f'[data-planning-slot="{target_id}"] button').first
    source.drag_to(target)
    expect(target).to_have_attribute('aria-label', re.compile('Jesus, Keep$'))
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered · 1 kept')
    page.get_by_role('button', name='Undo', exact=True).click()
    assert snapshot(page) == before
    source.click()
    source.press('Escape')
    expect(source).to_be_focused()
    expect(source).to_have_attribute('aria-expanded', 'false')
    source.click()
    page.get_by_role('button', name='Edit person', exact=True).click()
    panel = page.get_by_role('complementary', name='Edit person', exact=True)
    expect(panel).to_be_focused()
    panel.get_by_role('button', name='Close', exact=True).click()
    expect(source).to_be_focused()
    # Keyboard move, then a second manual placement: both become Keep.
    source.click()
    page.get_by_role('button', name='Move Jesus', exact=True).focus()
    page.keyboard.press('Enter')
    expect(page.get_by_label('Scroll weekly schedule', exact=True)).to_be_focused()
    target.focus(); page.keyboard.press('Enter')
    expect(target).to_contain_text('Jesus')
    expect(target).to_have_attribute('aria-label', re.compile('Keep$'))
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered · 1 kept')
    page.locator('#planning-team').get_by_role('button', name='Place Jules', exact=True).click()
    second_id = store.slot_ids[13]
    second = page.locator(f'[data-planning-slot="{second_id}"] button').first
    second.click()
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered · 2 kept')
    page.get_by_role('button', name='Adjust schedule', exact=True).click()
    expect(page.locator('#planning-review')).not_to_have_attribute('aria-busy', 'true')
    expect(second).to_have_attribute('aria-label', re.compile('Jules, Keep$'))
    page.get_by_role('button', name='Undo', exact=True).click()
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered · 1 kept')
    # Invalid qualification leaves the draft unchanged.
    cashier = page.locator(f'[data-planning-slot="{store.slot_ids[1]}"] button').first
    cashier.click()
    unchanged = snapshot(page)
    page.get_by_label('Assign employee', exact=True).select_option('sample-6')
    expect(board.get_by_role('alert')).to_contain_text('not qualified')
    assert snapshot(page) == unchanged
    # Board/person editor pre-fills requests without changing coverage until approved.
    target.click()
    page.get_by_role('button', name='Edit person', exact=True).click()
    page.get_by_role('button', name='Record callout / availability request', exact=True).click()
    requests = page.locator('#schedule-requests')
    expect(requests.get_by_label('Requested for', exact=True)).to_have_value('sample-0')
    requests.get_by_label('Your name', exact=True).fill('Fixture Manager')
    requests.get_by_role('button', name='Save pending request', exact=True).click()
    expect(requests.get_by_text('Server confirmed the request change.', exact=True)).to_be_visible()
    assert snapshot(page) == unchanged
    requests.get_by_label('Reviewed by', exact=True).fill('Fixture Manager')
    # Unknown save result retains the exact operation for retry; no premature repair.
    store.fail_request = True
    requests.get_by_role('button', name='Approve', exact=True).click()
    expect(requests.get_by_role('button', name='Retry exact save', exact=True)).to_be_visible()
    assert snapshot(page) == unchanged
    requests.get_by_role('button', name='Retry exact save', exact=True).click()
    expect(page.locator('#planning-review')).to_contain_text('Approved availability applied')
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered · 0 kept')
    assert store.request_writes[-1] == store.request_writes[-2]
    assert not store.writes, 'approval must not publish'
    page.get_by_role('button', name='Undo', exact=True).click()
    assert snapshot(page) == unchanged
    assert store.record['data']['requests'][0]['status'] == 'approved'
    expect(board.get_by_role('alert')).to_contain_text('unavailable')
    # Explicitly release the now-invalid Keep, then repair using the saved approval.
    target.click()
    page.get_by_role('checkbox', name='Keep this placement', exact=True).uncheck()
    page.get_by_role('button', name='Adjust schedule', exact=True).click()
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered · 0 kept')
    expect(target).not_to_contain_text('Jesus')
    # Auto off leaves a gap; Undo restores the whole preceding placement transaction.
    page.get_by_role('checkbox', name='Auto-adjust', exact=True).uncheck()
    source = page.locator(f'[data-planning-slot="{source_id}"] button').first
    source.click()
    page.get_by_label('Assign employee', exact=True).select_option('')
    expect(page.locator('#planning-review')).to_contain_text('27/28 required spots covered')
    page.get_by_role('button', name='Undo', exact=True).click()
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered')
    # Preserve selected data and Team search across view and language changes.
    team_search = page.locator('#planning-team').get_by_role('searchbox')
    team_search.fill('Jules')
    stable = snapshot(page)
    page.get_by_label('Layout', exact=True).select_option('new')
    page.get_by_label('Layout', exact=True).select_option('workspace')
    expect(team_search).to_have_value('Jules')
    assert snapshot(page) == stable
    page.get_by_role('group', name='English / Español').get_by_role('button', name='Español').click()
    expect(page.get_by_role('checkbox', name='Ajuste automático', exact=True)).not_to_be_checked()
    assert snapshot(page) == stable
    page.get_by_role('group', name='English / Español').get_by_role('button', name='English').click()
    # Existing publication conflict/retry path remains explicit.
    page.get_by_role('button', name='Publish to staff', exact=True).click()
    store.fail_next_save = True
    page.get_by_role('button', name='Publish updates', exact=True).click()
    expect(page.get_by_text('Someone else published this week first.', exact=False)).to_be_visible()
    page.get_by_role('button', name='Publish updates', exact=True).click()
    expect(page.get_by_text('Published. Staff now see this week.', exact=True)).to_be_visible()
    page.get_by_role('button', name='Close', exact=True).first.click()
    team_search.fill('')
    page.screenshot(path=str(artifacts / 'planning-desktop.png'), full_page=True)
    page.get_by_role('tab', name='Staff & rules', exact=True).click()
    page.emulate_media(media='print')
    expect(page.locator('#scheduler-panel-schedule')).to_be_visible()
    expect(page.locator('#scheduler-panel-settings')).not_to_be_visible()
    page.emulate_media(media='screen')
    page.get_by_role('tab', name='Schedule', exact=True).click()
    for width in [768, 390, 320]:
        page.set_viewport_size({'width': width, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{width}px page overflow'
        if width == 390:
            page.screenshot(path=str(artifacts / 'planning-phone.png'), full_page=True)
        page.get_by_role('group', name='English / Español').get_by_role('button', name='Español').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{width}px Spanish page overflow'
        if width == 390:
            page.screenshot(path=str(artifacts / 'planning-phone-spanish.png'), full_page=True)
        page.get_by_role('group', name='English / Español').get_by_role('button', name='English').click()
    # Tap/select placement works on a narrow screen, without native drag.
    page.locator('#planning-team').get_by_role('button', name='Place Jules', exact=True).click()
    cashier.click()
    expect(cashier).to_have_attribute('aria-label', re.compile('Jules, Keep$'))
    page.get_by_role('button', name='Undo', exact=True).click()
    planning = page.locator('[data-planning-workspace]')
    planning.get_by_text('More actions', exact=True).click()
    planning.get_by_text('Month & week visibility', exact=True).click()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'expanded phone tools overflow'
    assert not errors, errors
    context.close()


def check_kitchen(browser, url):
    context, page, store, errors = open_planning(browser, url, kitchen=True, width=390)
    page.get_by_role('tab', name='Staff & rules', exact=True).click()
    settings = page.locator('#scheduler-panel-settings')
    expect(settings.get_by_label('Staff password', exact=True)).to_be_visible()
    expect(settings.get_by_label('Jesus working', exact=True)).to_be_disabled()
    assert not store.writes
    assert not errors, errors
    context.close()


def check_external_and_cancellation(browser, url):
    context, page, store, errors = open_planning(browser, url)
    source = page.locator(f'[data-planning-slot="{store.slot_ids[0]}"] button').first
    source.click()
    page.get_by_role('button', name='Edit person', exact=True).click()
    page.get_by_role('button', name='Record callout / availability request', exact=True).click()
    requests = page.locator('#schedule-requests')
    requests.get_by_label('Your name', exact=True).fill('Fixture Manager')
    requests.get_by_role('button', name='Save pending request', exact=True).click()
    expect(requests.get_by_text('Server confirmed the request change.', exact=True)).to_be_visible()
    before = snapshot(page)
    # Another editor approves it. Reload updates constraints without rearranging this draft.
    item = store.record['data']['requests'][0]
    item['status'] = 'approved'
    item['review'] = {'by': 'Other Fixture Manager', 'at': item['enteredAt'], 'reason': ''}
    store.record['revision'] += 1
    requests.get_by_role('button', name='Reload requests', exact=True).click()
    expect(page.get_by_text('Availability changed.', exact=False)).to_be_visible()
    assert snapshot(page) == before
    page.get_by_role('button', name='Adjust schedule', exact=True).click()
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered')
    expect(source).not_to_contain_text('Jesus')
    # Start a repair and leave the week in the same browser task. The old gap stays a gap.
    page.get_by_role('checkbox', name='Auto-adjust', exact=True).uncheck()
    source.click()
    page.get_by_label('Assign employee', exact=True).select_option('')
    expect(page.locator('#planning-review')).to_contain_text('27/28 required spots covered')
    old_week = page.locator('[aria-label="Selected week"] p').inner_text()
    page.evaluate('''() => {
      [...document.querySelectorAll('button')].find(b => b.textContent === 'Adjust schedule').click();
      document.querySelector('[aria-label="Next week"]').click();
    }''')
    expect(page.locator('[aria-label="Selected week"] p')).not_to_have_text(old_week)
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered')
    page.get_by_role('button', name='Previous week', exact=True).click()
    expect(page.locator('[aria-label="Selected week"] p')).to_have_text(old_week)
    expect(page.locator('#planning-review')).to_contain_text('27/28 required spots covered')
    assert not errors, errors
    context.close()


def check_approval_outside_week(browser, url):
    context, page, store, errors = open_planning(browser, url)
    source = page.locator(f'[data-planning-slot="{store.slot_ids[0]}"] button').first
    source.click()
    page.get_by_label('Assign employee', exact=True).select_option('')
    expect(page.locator('#planning-review')).to_contain_text('27/28 required spots covered')
    page.locator('#planning-team').get_by_role('button', name='Jesus', exact=True).click()
    page.get_by_role('button', name='Record callout / availability request', exact=True).click()
    requests = page.locator('#schedule-requests')
    next_week = (date.fromisoformat(requests.get_by_label('Starting date', exact=True).input_value()) + timedelta(days=7)).isoformat()
    requests.get_by_label('Starting date', exact=True).fill(next_week)
    requests.get_by_label('Ending date (inclusive)', exact=True).fill(next_week)
    requests.get_by_label('Your name', exact=True).fill('Fixture Manager')
    requests.get_by_role('button', name='Save pending request', exact=True).click()
    expect(requests.get_by_text('Server confirmed the request change.', exact=True)).to_be_visible()
    before = snapshot(page)
    requests.get_by_label('Reviewed by', exact=True).fill('Fixture Manager')
    requests.get_by_role('button', name='Approve', exact=True).click()
    expect(requests.get_by_text('Server confirmed the request change.', exact=True)).to_be_visible()
    assert store.record['data']['requests'][0]['status'] == 'approved'
    assert snapshot(page) == before
    expect(page.locator('#planning-review')).to_contain_text('27/28 required spots covered')
    assert not errors, errors
    context.close()


def check_colors_locks_and_same_employee_drop(browser, url, artifacts):
    context, page, store, errors = open_planning(browser, url, extra_staff=20)
    def colors():
        return page.locator('#planning-team [id^="planning-team-person-"]').evaluate_all('''buttons => Object.fromEntries(buttons.map(b => [b.id, getComputedStyle(b).getPropertyValue('--employee-color').trim()]))''')
    original_colors = colors()
    assert len(original_colors) == 30 and len(set(original_colors.values())) == 30
    page.screenshot(path=str(artifacts / 'planning-distinct-colors.png'), full_page=True)
    team_search = page.locator('#planning-team').get_by_role('searchbox')
    team_search.fill('Jesus')
    assert colors()['planning-team-person-sample-0'] == original_colors['planning-team-person-sample-0']
    team_search.fill('')
    before = snapshot(page)
    source_cell = page.locator(f'[data-planning-slot="{store.slot_ids[0]}"]')
    lock = source_cell.locator('button[aria-pressed]')
    expect(lock).to_have_text('')
    expect(lock.locator('svg')).to_have_attribute('data-lock-state', 'unlocked')
    assert lock.bounding_box()['height'] >= 44
    lock.click()
    expect(lock).to_have_attribute('aria-pressed', 'true')
    expect(lock.locator('svg')).to_have_attribute('data-lock-state', 'locked')
    lock.click()
    assert snapshot(page) == before
    page.get_by_role('button', name='Undo', exact=True).click()
    expect(lock).to_have_attribute('aria-pressed', 'true')
    page.get_by_role('button', name='Undo', exact=True).click()
    assert snapshot(page) == before
    source = source_cell.locator('button').first
    target_cell = page.locator('[data-planning-slot][data-employee-id="sample-0"]').nth(1)
    source.drag_to(target_cell.locator('button').first)
    assert snapshot(page) == before
    expect(page.get_by_role('button', name='Undo', exact=True)).to_be_disabled()
    # Even with another gap and a kept destination, a duplicate drop stays a no-op.
    target_cell.locator('button[aria-pressed]').click()
    page.locator(f'[data-planning-slot="{store.slot_ids[3]}"] button').first.click()
    page.get_by_label('Assign employee', exact=True).select_option('')
    expect(page.locator('#planning-review')).to_contain_text('27/28 required spots covered')
    with_gap = snapshot(page)
    source.drag_to(target_cell.locator('button').first)
    assert snapshot(page) == with_gap
    expect(page.locator('#planning-review')).to_contain_text('27/28 required spots covered')
    assert colors() == original_colors
    page.get_by_role('button', name='Next week', exact=True).click()
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered')
    assert colors() == original_colors
    assert not errors, errors
    context.close()


def check_optional_requests(browser, url):
    for failure in ['backend_unconfigured', 'unavailable']:
        context, page, store, errors = open_planning(browser, url, request_failure=failure)
        expect(page.get_by_text('Load confirmed requests before placing or adjusting.', exact=False)).to_have_count(0)
        expect(page.get_by_role('button', name='Make schedule', exact=True)).to_be_enabled()
        adjust = page.get_by_role('button', name='Adjust schedule', exact=True)
        expect(adjust).to_be_enabled()
        before = snapshot(page)
        adjust.click()
        expect(page.locator('#planning-review')).not_to_have_attribute('aria-busy', 'true')
        assert snapshot(page) == before
        source = page.locator(f'[data-planning-slot="{store.slot_ids[0]}"] button').first
        target = page.locator(f'[data-planning-slot="{store.slot_ids[4]}"] button').first
        source.drag_to(target)
        expect(target).to_have_attribute('aria-label', re.compile('Jesus, Keep$'))
        expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered · 1 kept')
        assert not store.writes and not store.request_writes
        assert not errors, errors
        context.close()
    # Retrying an optional service must not cancel a repair already in progress.
    context, page, store, errors = open_planning(browser, url)
    page.locator(f'[data-planning-slot="{store.slot_ids[0]}"] button').first.click()
    page.get_by_label('Assign employee', exact=True).select_option('')
    expect(page.locator('#planning-review')).to_contain_text('27/28 required spots covered')
    requests = page.locator('#schedule-requests')
    requests.get_by_role('button', name='Time off requests', exact=False).click()
    store.request_failure = 'unavailable'
    page.evaluate('''() => {
      [...document.querySelectorAll('button')].find(b => b.textContent === 'Adjust schedule').click();
      [...document.querySelectorAll('#schedule-requests button')].find(b => b.textContent === 'Reload requests').click();
    }''')
    expect(page.locator('#planning-review')).to_contain_text('28/28 required spots covered')
    assert not errors, errors
    context.close()


def check_request_shortcut_cancel(browser, url):
    context, page, store, errors = open_planning(browser, url)
    before = snapshot(page)
    page.locator('#planning-team').get_by_role('button', name='Jesus', exact=True).click()
    page.get_by_role('button', name='Record callout / availability request', exact=True).click()
    requests = page.locator('#schedule-requests')
    requests.get_by_label('Original request / reason (optional)', exact=True).fill('Unfinished original')
    page.locator('#planning-team').get_by_role('button', name='Ana', exact=True).click()
    page.get_by_role('button', name='Record callout / availability request', exact=True).click()
    expect(requests.get_by_label('Requested for', exact=True)).to_have_value('sample-0')
    expect(requests.get_by_label('Original request / reason (optional)', exact=True)).to_have_value('Unfinished original')
    expect(requests.get_by_text('Your unfinished request is still open.', exact=False)).to_be_visible()
    requests.get_by_role('button', name='Cancel', exact=True).click()
    expect(requests.locator('#schedule-requests-panel')).not_to_be_visible()
    assert not store.request_writes and not store.writes
    assert snapshot(page) == before
    assert not errors, errors
    context.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:3064')
    parser.add_argument('--artifacts', default='/tmp/cr-planning-checks')
    args = parser.parse_args()
    if urlparse(args.url).hostname not in ('localhost', '127.0.0.1', '::1'):
        parser.error('Use a loopback static server.')
    artifacts = Path(args.artifacts); artifacts.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        check_planning(browser, args.url.rstrip('/'), artifacts)
        check_kitchen(browser, args.url.rstrip('/'))
        check_external_and_cancellation(browser, args.url.rstrip('/'))
        check_approval_outside_week(browser, args.url.rstrip('/'))
        check_request_shortcut_cancel(browser, args.url.rstrip('/'))
        check_optional_requests(browser, args.url.rstrip('/'))
        check_colors_locks_and_same_employee_drop(browser, args.url.rstrip('/'), artifacts)
        browser.close()
    print(json.dumps({'planning': 'passed', 'production_api_access': False}))
