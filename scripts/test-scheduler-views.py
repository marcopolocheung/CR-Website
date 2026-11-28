"""Browser regression checks using synthetic API responses; never contacts the live store.

Requires Python Playwright and Chromium. Build first, serve out/ on a loopback
address, then run: python scripts/test-scheduler-views.py --url http://127.0.0.1:3010
"""

import argparse
import copy
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright


DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
UPDATED = '2026-10-24T12:00:00Z'


class FixtureStore:
    def __init__(self):
        self.saved = {}
        self.writes = []
        self.fail_next_save = False

    def route(self, route):
        request = route.request
        url = urlparse(request.url)
        if not url.path.startswith('/api/'):
            if url.hostname in ('127.0.0.1', 'localhost'):
                route.continue_()
            else:
                route.abort()
            return
        query = parse_qs(url.query)
        station = query.get('restaurant', [''])[0]
        key = (url.path, station, query.get('weekStart', [''])[0])
        role = 'cook' if station.endswith('-kitchen') else 'server'
        employee = {
            'id': 'fixture-employee', 'name': 'Sample Employee', 'roles': [role],
            'recurringAvailability': {day: [{'start': 540, 'end': 1380}] for day in DAYS},
            'maxDaysPerWeek': 7, 'maxShiftsPerWeek': 7, 'allowDoubles': False,
            'active': True, 'incompatibleEmployeeIds': [], 'priority': 3,
        }
        template = {day: [{
            'period': 'AM', 'role': role, 'label': 'Morning coverage',
            'start': 600, 'end': 960, 'required': True,
        }] for day in DAYS}
        status = 200
        body = {}
        if request.method == 'OPTIONS':
            pass
        elif url.path == '/api/health':
            body = {'ok': True, 'scheduleSnapshotVersion': 1}
        elif url.path in ('/api/auth/verify', '/api/staff/verify'):
            assert request.headers.get('authorization') == 'Bearer fixture-password'
        elif url.path.startswith('/api/internal/schedule-requests/'):
            assert request.method == 'GET'
            assert request.headers.get('authorization') == 'Bearer fixture-password'
            body = {'record': None}
        elif url.path.startswith('/api/internal/special-hours/'):
            status, body = 503, {'schemaVersion': 1, 'error': {'code': 'backend_unconfigured'}}
        elif request.method == 'PUT':
            assert request.headers.get('authorization') == 'Bearer fixture-password'
            self.writes.append(key)
            if self.fail_next_save:
                self.fail_next_save = False
                status, body = 409, {'rev': 2}
            else:
                data = request.post_data_json
                body = {**data, 'rev': data.get('baseRev', 0) + 1, 'updatedAt': UPDATED}
                if url.path.startswith('/api/schedule/'):
                    body.update(v=3, weekStart=url.path.rsplit('/', 1)[1])
                self.saved[key] = copy.deepcopy(body)
        elif key in self.saved:
            body = self.saved[key]
        elif url.path in ('/api/employees', '/api/staff'):
            body = {'employees': [employee], 'rev': 1, 'updatedAt': UPDATED, 'canUndo': False}
        elif url.path == '/api/template':
            body = {'template': template, 'rev': 1, 'updatedAt': UPDATED}
        elif url.path == '/api/schedule':
            body = {'weeks': [], 'rev': 1, 'notModified': False}
        elif url.path.startswith('/api/schedule/'):
            status = 404
        else:
            raise AssertionError(f'Unexpected fixture request: {request.method} {request.url}')
        route.fulfill(status=status, body=json.dumps(body), content_type='application/json', headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        })


def unlock(page):
    """Shared manager gate; a visit already unlocked by another tool skips it."""
    code = page.get_by_label('Manager code', exact=True)
    if code.is_visible():
        code.fill('fixture-password')
        code.locator('xpath=ancestor::form').locator('button[type="submit"]').click()
    expect(page.get_by_role('tab', name='Schedule', exact=True)).to_be_visible()
    page.wait_for_load_state('networkidle')


def open_scheduler(browser, url, station, width=1440, layout='classic', store=None):
    context = browser.new_context(viewport={'width': width, 'height': 1000})
    # Legacy preferences must be inert; retain them to prove compatibility.
    if layout:
        context.add_init_script(f"localStorage.setItem('chinarose.scheduler.layout', {json.dumps(layout)})")
    store = store or FixtureStore()
    context.route('**/*', store.route)
    page = context.new_page()
    page.set_default_timeout(10000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'{url}/scheduler-demo/{station}.html', wait_until='networkidle')
    unlock(page)
    expect(page.get_by_text('Loading your saved schedule…', exact=True)).not_to_be_visible()
    return context, page, store, errors


def staff_tab(page):
    return page.get_by_role('tab', name=re.compile(r'^Staff & rules'))


def open_employee(settings):
    row = settings.get_by_role('listitem').filter(has_text='Sample Employee')
    row.get_by_role('button', name='Edit', exact=True).click()
    return row


def filled_cells(page):
    return page.locator('[data-planning-slot]:not([data-employee-id=""])')


def check_dining(browser, url, artifacts):
    context, page, store, errors = open_scheduler(browser, url, 'CR3-diningroom')
    schedule, settings = page.locator('#scheduler-panel-schedule'), page.locator('#scheduler-panel-settings')
    schedule_tab, settings_tab = page.get_by_role('tab', name='Schedule', exact=True), staff_tab(page)
    requests_tab = page.get_by_role('tab', name=re.compile(r'^Requests'))
    expect(schedule).to_be_visible(); expect(settings).not_to_be_visible()
    expect(page.get_by_role('button', name='Save changes', exact=True)).not_to_be_visible()
    # Three-view keyboard navigation retains accessible selection and focus.
    schedule_tab.focus(); schedule_tab.press('ArrowRight')
    expect(settings_tab).to_be_focused(); expect(settings_tab).to_have_attribute('aria-selected', 'true')
    expect(schedule.get_by_role('button', name='Build week', exact=True)).not_to_be_visible()
    settings_tab.press('End'); expect(requests_tab).to_be_focused()
    requests_tab.press('Home'); expect(schedule_tab).to_be_focused()
    schedule_tab.press('ArrowLeft'); expect(requests_tab).to_be_focused()
    requests_tab.press('Home'); schedule_tab.press('ArrowRight')
    expect(settings.get_by_role('button', name='Save changes', exact=True)).to_be_disabled()
    row = open_employee(settings)
    settings.get_by_label('Max days (1–7)').fill('6')
    settings.get_by_role('textbox', name='Search staff').fill('Sample')
    settings.get_by_role('button', name='Back to schedule', exact=True).click()
    expect(schedule_tab).to_be_focused()
    expect(settings_tab).to_contain_text('Unsaved changes')
    settings_tab.click()
    expect(settings.get_by_label('Max days (1–7)')).to_have_value('6')
    expect(settings.get_by_role('textbox', name='Search staff')).to_have_value('Sample')
    # Failed save retains exact edits; explicit retry follows existing revision handling.
    store.fail_next_save = True
    settings.get_by_role('button', name='Save changes', exact=True).click()
    expect(page.get_by_text('Someone else', exact=False)).to_be_visible()
    expect(settings.get_by_label('Max days (1–7)')).to_have_value('6')
    settings.get_by_role('button', name='Save changes', exact=True).click()
    expect(settings.get_by_role('button', name='Save changes', exact=True)).to_be_disabled()
    rules = settings.locator('#scheduler-rules')
    rules.locator('summary').first.click()
    settings.get_by_label('Label for this spot', exact=True).first.fill('')
    rules.locator('summary').first.click()
    expect(settings.get_by_role('button', name='Save changes', exact=True)).to_be_disabled()
    settings.get_by_role('button', name='Back to schedule', exact=True).click()
    expect(schedule.get_by_role('button', name='Publish to staff', exact=True)).to_be_disabled()
    schedule.get_by_role('button', name='Review shift rules', exact=True).click()
    expect(rules.locator('summary').first).to_be_focused()
    settings.get_by_label('Label for this spot', exact=True).first.fill('Morning coverage')
    settings.get_by_role('button', name='Add employee', exact=True).click()
    settings.get_by_label('Employee name', exact=True).fill('Unfinished draft')
    settings.get_by_role('button', name='Back to schedule', exact=True).click(); settings_tab.click()
    expect(settings.get_by_label('Employee name', exact=True)).to_have_value('Unfinished draft')
    settings.get_by_role('button', name='Close employee form', exact=True).click()
    week = page.locator('[aria-label="Selected week"] p').inner_text()
    page.get_by_role('button', name='Next week', exact=True).click()
    expect(page.locator('[aria-label="Selected week"] p')).not_to_have_text(week)
    settings.get_by_role('button', name='Back to schedule', exact=True).click()
    schedule.get_by_role('button', name='Build week', exact=True).click()
    expect(filled_cells(page)).to_have_count(7)
    settings_tab.click(); settings.get_by_role('button', name='Back to schedule', exact=True).click()
    expect(filled_cells(page)).to_have_count(7)
    schedule.get_by_role('button', name='Publish to staff', exact=True).click()
    page.get_by_role('button', name='Publish', exact=True).click()
    expect(page.get_by_text('Published. Staff now see this week.', exact=True)).to_be_visible()
    page.get_by_role('button', name='Close', exact=True).first.click()
    page.screenshot(path=str(artifacts / 'schedule-desktop.png'), full_page=True)
    settings_tab.click(); page.screenshot(path=str(artifacts / 'settings-desktop.png'), full_page=True)
    page.emulate_media(media='print')
    expect(page.locator('[data-scheduler-print]')).to_be_visible()
    expect(settings).not_to_be_visible()
    expect(page.locator('[data-scheduler-print]')).to_contain_text('Sample Employee')
    page.emulate_media(media='screen')
    assert not errors, errors
    assert any(key[0].startswith('/api/schedule/') for key in store.writes)
    context.close()


def check_mobile_kitchen(browser, url, artifacts):
    context, page, store, errors = open_scheduler(browser, url, 'CR3-kitchen', width=375)
    staff_tab(page).click(); settings = page.locator('#scheduler-panel-settings')
    expect(settings.get_by_text('One crew for every week.', exact=False)).to_be_visible()
    expect(settings.get_by_role('button', name='Add employee', exact=True)).not_to_be_visible()
    settings.locator('#scheduler-rules summary').first.click()
    expect(settings.get_by_role('heading', name='Shift rules (locked)')).to_be_visible()
    settings.get_by_label('Staff password', exact=True).fill('fixture-password')
    settings.get_by_role('button', name='Unlock editing', exact=True).click()
    expect(settings.get_by_role('button', name='Add employee', exact=True)).to_be_visible()
    settings.get_by_role('button', name='Lock', exact=True).click()
    expect(settings.get_by_role('button', name='Add employee', exact=True)).not_to_be_visible()
    settings.locator('#scheduler-rules summary').first.click()
    for width in (320, 375, 768):
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Settings overflow at {width}px'
        page.get_by_role('tab', name='Schedule', exact=True).click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Schedule overflow at {width}px'
        staff_tab(page).click()
    page.set_viewport_size({'width': 375, 'height': 900})
    page.screenshot(path=str(artifacts / 'settings-mobile.png'), full_page=True)
    page.get_by_role('tab', name='Schedule', exact=True).click()
    page.screenshot(path=str(artifacts / 'schedule-mobile.png'), full_page=True)
    assert not store.writes, 'Viewing and unlocking must not save anything'
    assert not errors, errors
    context.close()


def check_qualification_publishing(browser, url):
    context, page, store, errors = open_scheduler(browser, url, 'CR3-kitchen')
    schedule, settings = page.locator('#scheduler-panel-schedule'), page.locator('#scheduler-panel-settings')
    schedule.get_by_role('button', name='Build week', exact=True).click()
    expect(filled_cells(page)).to_have_count(7)
    schedule.get_by_role('button', name='Publish to staff', exact=True).click()
    page.get_by_role('button', name='Publish', exact=True).click()
    expect(page.get_by_text('Published. Staff now see this week.', exact=True)).to_be_visible()
    page.get_by_role('button', name='Close', exact=True).first.click()
    staff_tab(page).click()
    settings.get_by_label('Staff password', exact=True).fill('fixture-password')
    settings.get_by_role('button', name='Unlock editing', exact=True).click()
    open_employee(settings)
    positions = settings.get_by_role('group', name='Positions Sample Employee can work')
    expect(settings.get_by_label('New hire (any position, still limited by max days)', exact=True)).not_to_be_checked()
    positions.get_by_label('Dishwasher', exact=True).check(); positions.get_by_label('Cook', exact=True).uncheck()
    settings.get_by_role('button', name='Back to schedule', exact=True).click()
    schedule.get_by_role('button', name='Publish to staff', exact=True).click()
    warning = page.get_by_role('alert').filter(has_text='Fix these position assignments before publishing:')
    expect(warning).to_be_visible(); expect(warning.get_by_role('listitem')).to_have_count(7)
    expect(warning).to_contain_text('Sample Employee is not qualified')
    publish = page.get_by_role('button', name='Publish updates', exact=True)
    expect(publish).to_be_disabled()
    assert len(store.writes) == 1, 'Blocked publishing must not save crew, rules, or schedule'
    page.get_by_role('button', name='Off', exact=True).click()
    expect(warning).not_to_be_visible(); expect(publish).to_be_enabled(); publish.click()
    expect(page.get_by_text('Saved. This week stays hidden from staff until you turn it on.', exact=True)).to_be_visible()
    published = [doc for key, doc in store.saved.items() if key[0].startswith('/api/schedule/')]
    assert len(published) == 1 and published[0]['visible'] is False
    page.get_by_role('button', name='On', exact=True).click()
    expect(warning).to_be_visible(); expect(publish).to_be_disabled()
    page.get_by_role('button', name='Close', exact=True).first.click()
    staff_tab(page).click(); positions.get_by_label('Cook', exact=True).check()
    settings.get_by_role('button', name='Back to schedule', exact=True).click()
    schedule.get_by_role('button', name='Publish to staff', exact=True).click()
    expect(warning).not_to_be_visible(); expect(publish).to_be_enabled(); publish.click()
    expect(page.get_by_text('Published. Staff now see this week.', exact=True)).to_be_visible()
    published = [doc for key, doc in store.saved.items() if key[0].startswith('/api/schedule/')]
    assert len(published) == 1 and published[0]['visible'] is True
    assert not errors, errors
    context.close()


def check_new_layout(browser, url, artifacts):
    """Current/Classic assertions become unified-layout parity checks, retaining their behaviors."""
    context, page, store, errors = open_scheduler(browser, url, 'CR3-diningroom', layout='classic')
    schedule = page.locator('#scheduler-panel-schedule')
    expect(page.get_by_role('tab', name='Staff & rules', exact=True)).to_be_visible()
    expect(page.get_by_role('tab', name='Requests', exact=True)).to_be_visible()
    expect(page.get_by_role('switch', name='Use the classic layout')).to_have_count(0)
    expect(page.get_by_label('Layout', exact=True)).to_have_count(0)
    expect(schedule.get_by_role('button', name='Build week', exact=True)).to_be_visible()
    expect(schedule.get_by_role('button', name='Copy previous week', exact=True)).to_be_visible()
    page.screenshot(path=str(artifacts / 'schedule-unified-empty-desktop.png'), full_page=True)
    schedule.get_by_role('button', name='Build week', exact=True).click()
    expect(filled_cells(page)).to_have_count(7)
    page.get_by_role('checkbox', name='Auto-adjust', exact=True).uncheck()
    page.locator('[data-planning-slot] button').first.click()
    page.get_by_label('Assign employee', exact=True).select_option('')
    expect(filled_cells(page)).to_have_count(6)
    fix = page.locator('#planning-fix')
    expect(fix).to_be_visible()
    expect(fix.get_by_role('button', name='Ignore for now', exact=True)).to_be_disabled()
    fix.get_by_role('button', name='Choose employee', exact=True).click()
    fix.get_by_role('button', name='Sample Employee', exact=True).click()
    expect(filled_cells(page)).to_have_count(7)
    schedule.get_by_role('button', name='Undo', exact=True).click()
    expect(filled_cells(page)).to_have_count(6)
    page.get_by_role('button', name='Restore generated shift', exact=True).click()
    expect(filled_cells(page)).to_have_count(7)
    schedule.get_by_role('button', name='Undo', exact=True).click()
    expect(filled_cells(page)).to_have_count(6)
    stable = page.locator('[data-planning-slot]').evaluate_all('(cells)=>cells.map(c=>c.dataset.employeeId)')
    staff_tab(page).click(); page.get_by_role('tab', name='Requests', exact=True).click()
    page.get_by_role('tab', name='Schedule', exact=True).click()
    assert page.locator('[data-planning-slot]').evaluate_all('(cells)=>cells.map(c=>c.dataset.employeeId)') == stable
    expect(schedule.get_by_role('button', name='Undo', exact=True)).to_be_enabled()
    schedule.get_by_role('button', name='Undo', exact=True).click()
    expect(filled_cells(page)).to_have_count(7)
    staff_tab(page).click(); settings=page.locator('#scheduler-panel-settings')
    row=settings.get_by_role('listitem').filter(has_text='Sample Employee')
    expect(row).to_contain_text('Server'); expect(row).to_contain_text('this week')
    expect(settings.get_by_label('Sample Employee working')).to_be_checked()
    expect(settings.get_by_label('Max days (1–7)')).not_to_be_visible()
    row.get_by_role('button', name='Edit', exact=True).click()
    expect(settings.get_by_label('Max days (1–7)')).to_be_visible()
    row.get_by_role('button', name='Close', exact=True).click()
    expect(settings.get_by_label('Max days (1–7)')).not_to_be_visible()
    settings.locator('summary', has_text='More').first.click()
    expect(settings.get_by_role('button', name='Use saved staff list', exact=True)).to_be_visible()
    expect(settings.get_by_text('Copies on this device (0)', exact=True)).to_be_visible()
    settings.locator('summary', has_text='More').first.click()
    rules=settings.locator('#scheduler-rules'); rules.locator('summary').first.click()
    settings.get_by_label('Label for this spot', exact=True).first.fill(''); rules.locator('summary').first.click()
    settings.get_by_role('button', name='Review shift rules', exact=True).click()
    expect(rules).to_have_attribute('open',''); expect(rules.locator('summary').first).to_be_focused()
    settings.get_by_label('Label for this spot', exact=True).first.fill('Morning coverage')
    settings.get_by_label('Sample Employee working').uncheck()
    expect(settings.get_by_role('button', name='Save changes', exact=True)).to_be_enabled()
    expect(staff_tab(page)).to_contain_text('Unsaved changes')
    settings.get_by_label('Sample Employee working').check()
    page.screenshot(path=str(artifacts/'staff-rules-desktop.png'),full_page=True)
    page.get_by_role('tab',name='Schedule',exact=True).click()
    page.set_viewport_size({'width':375,'height':900})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(artifacts/'schedule-unified-mobile.png'),full_page=True)
    # Legacy choice remains inert on reload; no draft or credential serialization is added.
    page.on('dialog', lambda dialog: dialog.accept()); page.reload(wait_until='networkidle'); unlock(page)
    expect(page.get_by_label('Layout',exact=True)).to_have_count(0)
    assert page.evaluate("localStorage.getItem('chinarose.scheduler.layout')")=='classic'
    assert not errors,errors
    context.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:3010')
    parser.add_argument('--artifacts', default='/tmp/cr-scheduler-views')
    args = parser.parse_args()
    if urlparse(args.url).hostname not in ('localhost', '127.0.0.1'):
        parser.error('--url must point to a local server')
    artifacts = Path(args.artifacts)
    artifacts.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        check_dining(browser, args.url.rstrip('/'), artifacts)
        check_mobile_kitchen(browser, args.url.rstrip('/'), artifacts)
        check_qualification_publishing(browser, args.url.rstrip('/'))
        check_new_layout(browser, args.url.rstrip('/'), artifacts)
        browser.close()
    print(f'Scheduler view checks passed. Screenshots: {artifacts}')
