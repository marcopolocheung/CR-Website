"""Browser regression checks using synthetic API responses; never contacts the live store.

Requires Python Playwright and Chromium. Build first, serve out/ on a loopback
address, then run: python scripts/test-scheduler-views.py --url http://127.0.0.1:3010
"""

import argparse
import copy
import json
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
        elif url.path in ('/api/auth/verify', '/api/staff/verify'):
            assert request.headers.get('authorization') == 'Bearer fixture-password'
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


def open_scheduler(browser, url, station, width=1440):
    context = browser.new_context(viewport={'width': width, 'height': 1000})
    store = FixtureStore()
    context.route('**/*', store.route)
    page = context.new_page()
    page.set_default_timeout(10000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'{url}/scheduler-demo/{station}.html')
    page.wait_for_load_state('networkidle')
    page.get_by_label('Manager code', exact=True).fill('fixture-password')
    page.get_by_role('button', name='Open the scheduler', exact=True).click()
    expect(page.get_by_role('tab', name='Schedule', exact=True)).to_be_visible()
    expect(page.get_by_text('Loading your saved schedule…', exact=True)).not_to_be_visible()
    page.wait_for_load_state('networkidle')
    return context, page, store, errors


def check_dining(browser, url, artifacts):
    context, page, store, errors = open_scheduler(browser, url, 'CR3-diningroom')
    schedule = page.locator('#scheduler-panel-schedule')
    settings = page.locator('#scheduler-panel-settings')
    schedule_tab = page.get_by_role('tab', name='Schedule', exact=True)
    settings_tab = page.get_by_role('tab', name='Employee settings', exact=True)
    expect(schedule).to_be_visible()
    expect(settings).not_to_be_visible()
    expect(page.get_by_role('button', name='Save changes', exact=True)).not_to_be_visible()
    expect(page.get_by_label('How to build the week')).not_to_be_visible()
    # Arrow keys and Home/End activate tabs, retain focus, and expose the right panel.
    schedule_tab.focus()
    schedule_tab.press('ArrowRight')
    expect(settings_tab).to_be_focused()
    expect(settings_tab).to_have_attribute('aria-selected', 'true')
    expect(page.get_by_role('button', name='Make schedule', exact=True)).not_to_be_visible()
    expect(page.get_by_role('button', name='Publish to staff', exact=True)).not_to_be_visible()
    expect(page.get_by_role('button', name='Save changes', exact=True)).to_be_disabled()
    expect(settings.locator('summary', has_text='Staff list tools').locator('..')).not_to_have_attribute('open', '')
    settings_tab.press('Home')
    expect(schedule_tab).to_be_focused()
    schedule_tab.press('ArrowLeft')
    expect(settings_tab).to_be_focused()
    settings_tab.press('Home')
    schedule_tab.press('End')
    expect(settings_tab).to_be_focused()
    # Expanded controls, entered values, search and dirty status survive switching.
    settings.get_by_text('Edit availability', exact=True).click()
    settings.get_by_label('Max days (1–7)').fill('6')
    settings.get_by_role('textbox', name='Search staff').fill('Sample')
    page.get_by_role('button', name='Back to schedule', exact=True).click()
    expect(schedule_tab).to_be_focused()
    expect(page.get_by_role('tab', name='Employee settings Unsaved changes')).to_be_visible()
    expect(page.get_by_role('button', name='Review employee settings')).to_be_visible()
    page.get_by_role('button', name='Review employee settings').click()
    expect(settings.get_by_label('Max days (1–7)')).to_have_value('6')
    expect(settings.get_by_role('textbox', name='Search staff')).to_have_value('Sample')
    expect(settings.get_by_text('Edit availability', exact=True).locator('..')).to_have_attribute('open', '')
    # A failed save keeps edits; a deliberate retry uses the server revision.
    store.fail_next_save = True
    page.get_by_role('button', name='Save changes', exact=True).click()
    expect(page.get_by_text('Someone else', exact=False)).to_be_visible()
    expect(settings.get_by_label('Max days (1–7)')).to_have_value('6')
    page.get_by_role('button', name='Save changes', exact=True).click()
    expect(page.get_by_role('button', name='Save changes', exact=True)).to_be_disabled()
    # Rule errors remain discoverable even when their disclosure is closed.
    rules = settings.locator('details').filter(has=page.locator('summary', has_text='Shift rules'))
    rules.locator('summary').first.click()
    settings.get_by_label('Label for this spot', exact=True).first.fill('')
    rules.locator('summary').first.click()
    expect(page.get_by_role('button', name='Save changes', exact=True)).to_be_disabled()
    page.get_by_role('button', name='Back to schedule', exact=True).click()
    expect(schedule.get_by_role('button', name='Publish to staff', exact=True)).to_be_disabled()
    schedule.get_by_role('button', name='Review shift rules', exact=True).click()
    expect(rules.locator('summary').first).to_be_focused()
    expect(settings.get_by_label('Label for this spot', exact=True).first).to_be_visible()
    settings.get_by_label('Label for this spot', exact=True).first.fill('Morning coverage')
    # An unfinished new employee form is retained too.
    settings.get_by_role('button', name='Add employee', exact=True).click()
    settings.get_by_label('Employee name', exact=True).fill('Unfinished draft')
    page.get_by_role('button', name='Back to schedule', exact=True).click()
    page.get_by_role('tab', name='Employee settings', exact=True).click()
    expect(settings.get_by_label('Employee name', exact=True)).to_have_value('Unfinished draft')
    settings.get_by_role('button', name='Close employee form', exact=True).click()
    rules.locator('summary').first.click()
    # Week controls are shared; changing weeks in settings carries the same date to Schedule.
    week = page.locator('[aria-label="Selected week"] p').inner_text()
    page.get_by_role('button', name='Next week', exact=True).click()
    expect(page.locator('[aria-label="Selected week"] p')).not_to_have_text(week)
    next_week = page.locator('[aria-label="Selected week"] p').inner_text()
    page.get_by_role('button', name='Back to schedule', exact=True).click()
    expect(schedule.get_by_role('heading', name=next_week, exact=True)).to_be_visible()
    # Generate, switch views, then publish using the existing path.
    schedule.get_by_role('button', name='Make schedule', exact=True).click()
    expect(schedule.get_by_role('button', name='Make schedule', exact=True)).to_be_enabled()
    chips = schedule.get_by_role('button', name='Move Sample Employee out of', exact=False)
    expect(chips).to_have_count(7)
    page.get_by_role('tab', name='Employee settings', exact=True).click()
    page.get_by_role('button', name='Back to schedule', exact=True).click()
    expect(chips).to_have_count(7)
    schedule.get_by_role('button', name='Publish to staff', exact=True).first.click()
    page.get_by_role('button', name='Publish', exact=True).click()
    expect(page.get_by_text('Published. Staff now see this week.', exact=True)).to_be_visible()
    page.get_by_role('button', name='Close', exact=True).click()
    # Browser printing from settings still prints the schedule and hides employee parameters.
    page.screenshot(path=str(artifacts / 'schedule-desktop.png'), full_page=True)
    page.get_by_role('tab', name='Employee settings', exact=True).click()
    page.screenshot(path=str(artifacts / 'settings-desktop.png'), full_page=True)
    page.emulate_media(media='print')
    expect(schedule).to_be_visible()
    expect(settings).not_to_be_visible()
    expect(chips).to_have_count(7)
    page.emulate_media(media='screen')
    assert not errors, errors
    assert any(key[0].startswith('/api/schedule/') for key in store.writes)
    context.close()


def check_mobile_kitchen(browser, url, artifacts):
    context, page, store, errors = open_scheduler(browser, url, 'CR3-kitchen', width=375)
    page.get_by_role('tab', name='Employee settings', exact=True).click()
    settings = page.locator('#scheduler-panel-settings')
    expect(settings.get_by_text('One crew for every week.', exact=False)).to_be_visible()
    expect(settings.get_by_role('button', name='Add employee', exact=True)).not_to_be_visible()
    settings.locator('summary', has_text='Shift rules').click()
    expect(settings.get_by_role('heading', name='Shift rules (locked)')).to_be_visible()
    settings.get_by_label('Staff password', exact=True).fill('fixture-password')
    settings.get_by_role('button', name='Unlock editing', exact=True).click()
    expect(settings.get_by_role('button', name='Add employee', exact=True)).to_be_visible()
    settings.get_by_role('button', name='Lock', exact=True).click()
    expect(settings.get_by_role('button', name='Add employee', exact=True)).not_to_be_visible()
    settings.locator('summary', has_text='Shift rules').click()
    for width in (320, 375, 768):
        page.set_viewport_size({'width': width, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Settings overflow at {width}px'
        page.get_by_role('tab', name='Schedule', exact=True).click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Schedule overflow at {width}px'
        page.get_by_role('tab', name='Employee settings', exact=True).click()
    page.set_viewport_size({'width': 375, 'height': 900})
    page.screenshot(path=str(artifacts / 'settings-mobile.png'), full_page=True)
    page.get_by_role('tab', name='Schedule', exact=True).click()
    page.screenshot(path=str(artifacts / 'schedule-mobile.png'), full_page=True)
    assert not store.writes, 'Viewing and unlocking must not save anything'
    assert not errors, errors
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
        browser.close()
    print(f'Scheduler view checks passed. Screenshots: {artifacts}')
