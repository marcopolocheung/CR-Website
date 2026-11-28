"""Browser checks for the AI assistant panels using synthetic API responses; never calls Claude or the live store.

Requires Python Playwright and Chromium. Build first, serve out/ on a loopback
address, then run: python scripts/test-schedule-assistant.py --url http://127.0.0.1:3010
"""

import argparse
import importlib.util
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('scheduler_fixtures', ROOT / 'scripts/test-scheduler-views.py')
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)
HEADERS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
           'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'}


class AssistantStore(fixtures.FixtureStore):
    """Scheduler fixture plus a canned assistant that calls out the fixture employee on Friday."""

    def __init__(self, status=200):
        super().__init__()
        self.status = status
        self.sent = []

    def route(self, route):
        request = route.request
        if urlparse(request.url).path != '/api/assistant/schedule' or request.method != 'POST':
            return super().route(route)
        assert request.headers.get('authorization') == 'Bearer fixture-password'
        draft = request.post_data_json
        self.sent.append(draft)
        friday = next(slot['date'] for slot in draft['slots'] if slot['day'] == 'Friday')
        body = {'reply': 'Sample Employee is off Friday.', 'operations': [
            {'type': 'callout', 'employeeId': 'fixture-employee', 'date': friday}]} if self.status == 200 else {'error': 'assistant_unconfigured'}
        route.fulfill(status=self.status, body=json.dumps(body), content_type='application/json', headers=HEADERS)


def assistant(page):
    return page.locator('[data-schedule-assistant]')


def check_schedule(browser, url, artifacts):
    store = AssistantStore()
    context, page, store, errors = fixtures.open_scheduler(browser, url, 'CR3-diningroom', store=store)
    schedule = page.locator('#scheduler-panel-schedule')
    schedule.get_by_role('button', name='Build week', exact=True).click()
    expect(fixtures.filled_cells(page)).to_have_count(7)
    panel = assistant(page)
    panel.get_by_label('What should change?').fill('Sample is out Friday')
    panel.get_by_role('button', name='Suggest changes', exact=True).click()
    expect(panel.get_by_text('Sample Employee is off Friday.', exact=True)).to_be_visible()
    expect(panel.get_by_role('listitem')).to_contain_text('Sample Employee is off on')
    sent = store.sent[0]
    assert sent['text'] == 'Sample is out Friday' and len(sent['assignments']) == 7, sent
    assert 'recurringAvailability' not in json.dumps(sent['employees']), 'only names/roles leave the browser'
    page.screenshot(path=str(artifacts / 'assistant-suggestion-desktop.png'), full_page=True)
    panel.get_by_role('button', name='Apply to draft', exact=True).click()
    # Only one employee exists, so the Friday spot stays open after the refill attempt.
    expect(fixtures.filled_cells(page)).to_have_count(6)
    expect(page.get_by_text('AI suggestion applied to the draft', exact=False)).to_be_visible()
    expect(panel.get_by_role('button', name='Apply to draft', exact=True)).to_be_disabled()
    schedule.get_by_role('button', name='Undo', exact=True).click()
    expect(fixtures.filled_cells(page)).to_have_count(7)
    friday = next(slot['date'] for slot in sent['slots'] if slot['day'] == 'Friday')
    panel.get_by_role('button', name='Record as time-off', exact=True).click()
    requests = page.locator('#scheduler-panel-requests')
    expect(requests).to_be_visible()
    expect(requests.get_by_label('Requested for')).to_have_value('fixture-employee')
    expect(requests.get_by_label('Starting date')).to_have_value(friday)
    page.get_by_role('tab', name='Schedule', exact=True).click()
    page.set_viewport_size({'width': 375, 'height': 900})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(artifacts / 'assistant-mobile.png'), full_page=True)
    assert not errors, errors
    context.close()

    context, page, store, errors = fixtures.open_scheduler(browser, url, 'CR3-diningroom', store=AssistantStore(status=503))
    panel = assistant(page)
    panel.get_by_label('What should change?').fill('anything')
    panel.get_by_role('button', name='Suggest changes', exact=True).click()
    expect(panel.get_by_role('alert')).to_have_text("The assistant isn't set up yet.")
    assert not errors, errors
    context.close()


def check_cash(browser, url, artifacts):
    asked = []

    def route(route):
        request = route.request
        path = urlparse(request.url).path
        if not path.startswith('/api/'):
            return route.continue_() if urlparse(request.url).hostname in ('127.0.0.1', 'localhost') else route.abort()
        status, body = 200, {}
        if path == '/api/assistant/cash':
            assert request.headers.get('authorization') == 'Bearer fixture-password'
            asked.append(request.post_data_json)
            body = {'answer': 'CR3 was short $5.00 on Nov 26.', 'coveredDates': {'from': '2026-11-01', 'to': '2026-11-26'}}
        elif path.startswith('/api/cashout/'):
            body = {'days': []}
        elif path != '/api/auth/verify':
            status = 404
        route.fulfill(status=status, body=json.dumps(body), content_type='application/json', headers=HEADERS)

    context = browser.new_context(viewport={'width': 1280, 'height': 1000})
    context.route('**/*', route)
    page = context.new_page()
    page.set_default_timeout(10000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'{url}/internal/cash-history.html', wait_until='networkidle')
    code = page.get_by_label('Manager code', exact=True)
    code.fill('fixture-password')
    code.locator('xpath=ancestor::form').locator('button[type="submit"]').click()
    page.get_by_label('Question', exact=True).fill('How short was CR3 this month?')
    page.get_by_role('button', name='Ask', exact=True).click()
    answer = page.locator('[data-cash-answer]')
    expect(answer).to_contain_text('CR3 was short $5.00 on Nov 26.')
    expect(answer).to_contain_text('Based on saved sheets from 2026-11-01 to 2026-11-26.')
    assert asked[0]['question'] == 'How short was CR3 this month?', asked
    page.screenshot(path=str(artifacts / 'cash-ask-desktop.png'), full_page=True)
    page.set_viewport_size({'width': 375, 'height': 900})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors, errors
    context.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:3010')
    parser.add_argument('--artifacts', default='/tmp/cr-assistant')
    args = parser.parse_args()
    if urlparse(args.url).hostname not in ('localhost', '127.0.0.1'):
        parser.error('--url must point to a local server')
    artifacts = Path(args.artifacts)
    artifacts.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        check_schedule(browser, args.url.rstrip('/'), artifacts)
        check_cash(browser, args.url.rstrip('/'), artifacts)
        browser.close()
    print(f'Assistant checks passed. Screenshots: {artifacts}')
