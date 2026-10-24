"""Synthetic request-entry/review checks. Build with a loopback API override and serve out/."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright

spec = importlib.util.spec_from_file_location('views', Path(__file__).with_name('test-scheduler-views.py'))
views = importlib.util.module_from_spec(spec)
spec.loader.exec_module(views)

class RequestStore(views.FixtureStore):
    def __init__(self):
        super().__init__()
        self.record = None
        self.attempts = []
        self.failure = None

    def route(self, route):
        request = route.request
        path = urlparse(request.url).path
        if not path.startswith('/api/internal/schedule-requests/'):
            return super().route(route)
        assert urlparse(request.url).hostname in ('localhost', '127.0.0.1'), 'Production API must never be contacted'
        assert request.headers.get('authorization') == 'Bearer fixture-password'
        status = 200
        if request.method == 'PUT':
            body = request.post_data_json
            self.attempts.append(copy.deepcopy(body))
            if self.failure == 'unavailable':
                self.failure = None
                status, result = 503, {'schemaVersion': 1, 'error': {'code': 'unavailable'}}
            elif self.failure == 'conflict':
                self.failure = None
                status, result = 409, {'schemaVersion': 1, 'error': {'code': 'revision_conflict'}}
            else:
                mutation = body['mutation']
                station = path.rsplit('/', 1)[1]
                self.record = {'schemaVersion': 1, 'family': 'schedule-request', 'id': 'requests-' + station,
                    'storeId': station[:3], 'stationId': station, 'context': {'kind': 'undated'},
                    'revision': mutation['baseRevision'] + 1, 'createdAt': '2026-10-24T12:00:00.000Z',
                    'updatedAt': '2026-10-24T14:00:00.000Z', 'data': mutation['data']}
                result = {'record': self.record}
        elif self.failure == 'unconfigured':
            status, result = 503, {'schemaVersion': 1, 'error': {'code': 'backend_unconfigured'}}
        else:
            result = {'record': self.record}
        route.fulfill(status=status, body=json.dumps(result), content_type='application/json', headers={
            'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS'})

def open_page(browser, url, width=1440, station='CR3-diningroom', failure=None):
    context = browser.new_context(viewport={'width': width, 'height': 1000}, timezone_id='America/Chicago')
    store = RequestStore()
    store.failure = failure
    context.route('**/*', store.route)
    page = context.new_page()
    page.set_default_timeout(10000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'{url}/scheduler-demo/{station}.html')
    page.wait_for_load_state('networkidle')
    page.get_by_label('Manager code', exact=True).fill('fixture-password')
    page.get_by_role('button', name='Open the scheduler', exact=True).click()
    page.wait_for_load_state('networkidle')
    panel = page.locator('#schedule-requests')
    panel.get_by_role('button', name='Time off and availability requests', exact=False).click()
    return context, page, panel, store, errors

def fill_entry(panel, reason='Original spoken request'):
    panel.get_by_label('Requested for', exact=True).select_option('fixture-employee')
    panel.get_by_label('Entered by (manager label)', exact=True).fill('Entry Manager')
    panel.get_by_label('Starting date', exact=True).fill('2026-10-31')
    panel.get_by_label('Ending date (inclusive)', exact=True).fill('2026-11-01')
    panel.get_by_label('Original request / reason (optional)', exact=True).fill(reason)

def check_flow(browser, url, artifacts):
    context, page, panel, store, errors = open_page(browser, url)
    fill_entry(panel)
    panel.get_by_role('button', name='Español', exact=True).click()
    expect(panel.get_by_label('Solicitud original / motivo (opcional)', exact=True)).to_have_value('Original spoken request')
    expect(panel.get_by_label('Fecha inicial', exact=True)).to_have_value('2026-10-31')
    panel.get_by_role('button', name='English', exact=True).click()
    # Existing scheduler link protection includes pending request text.
    page.once('dialog', lambda dialog: dialog.dismiss())
    page.get_by_role('link', name='Menu', exact=True).first.click()
    expect(panel.get_by_label('Original request / reason (optional)', exact=True)).to_have_value('Original spoken request')
    store.failure = 'unavailable'
    panel.get_by_role('button', name='Save pending request', exact=True).click()
    expect(panel.get_by_role('alert')).to_contain_text('Could not confirm')
    expect(panel.get_by_label('Original request / reason (optional)', exact=True)).to_have_value('Original spoken request')
    panel.get_by_role('button', name='Retry exact save', exact=True).click()
    expect(panel.get_by_text('Server confirmed the request change.', exact=True)).to_be_visible()
    assert store.attempts[0] == store.attempts[1], 'Retry must preserve operation ID, base, timestamps and original text'
    pending = panel.get_by_role('region', name='Pending requests', exact=True)
    expect(pending.get_by_text('Original spoken request', exact=True)).to_be_visible()
    panel.get_by_label('Reviewed by (manager label)', exact=True).fill('Review Manager')
    pending.get_by_label('Review reason (optional)', exact=True).fill('Reviewed carefully')
    store.failure = 'conflict'
    pending.get_by_role('button', name='Approve', exact=True).click()
    expect(panel.get_by_role('alert')).to_contain_text('Another manager changed')
    expect(pending.get_by_label('Review reason (optional)', exact=True)).to_have_value('Reviewed carefully')
    panel.get_by_role('button', name='Reload requests', exact=True).click()
    confirm = panel.get_by_role('group', name='Resolve an uncertain save', exact=True)
    confirm.get_by_role('button', name='Reload requests', exact=True).click()
    expect(panel.get_by_text('Latest requests loaded.', exact=False)).to_be_visible()
    expect(pending.get_by_label('Review reason (optional)', exact=True)).to_have_value('Reviewed carefully')
    pending.get_by_role('button', name='Approve', exact=True).click()
    approved = panel.get_by_role('region', name='Approved exceptions', exact=True)
    expect(approved.get_by_text('Original spoken request', exact=True)).to_be_visible()
    expect(approved.get_by_text('Reviewed carefully', exact=False)).to_be_visible()
    assert store.record['data']['requests'][0]['enteredBy'] == 'Entry Manager'
    assert store.record['data']['requests'][0]['review']['by'] == 'Review Manager'
    # A pending overlapping request is retained; a second approval is rejected locally.
    fill_entry(panel, 'Second overlapping request')
    panel.get_by_role('button', name='Save pending request', exact=True).click()
    expect(pending.get_by_text('Second overlapping request', exact=True)).to_be_visible()
    pending.get_by_role('button', name='Approve', exact=True).click()
    expect(panel.get_by_role('alert')).to_contain_text('overlaps an already approved')
    pending.get_by_role('button', name='Decline', exact=True).click()
    declined = panel.get_by_role('region', name='Declined requests', exact=True)
    expect(declined.get_by_text('Second overlapping request', exact=True)).to_be_visible()
    stored = page.evaluate('JSON.stringify({...localStorage}) + JSON.stringify({...sessionStorage})')
    assert 'fixture-password' not in stored and 'Original spoken request' not in stored
    page.screenshot(path=str(artifacts / 'requests-desktop.png'), full_page=True)
    assert not errors, errors
    context.close()

def check_mobile_and_absent(browser, url, artifacts):
    context, page, panel, store, errors = open_page(browser, url, width=390, station='CR3-kitchen')
    fill_entry(panel, 'Phone request retained')
    panel.get_by_label('Request type', exact=True).select_option('availability')
    panel.get_by_label('Available from', exact=True).fill('23:00')
    panel.get_by_label('Available until', exact=True).fill('02:00')
    panel.get_by_label('Ends the next day', exact=True).check()
    panel.get_by_role('button', name='Español', exact=True).click()
    save = panel.get_by_role('button', name='Guardar solicitud pendiente', exact=True)
    save.focus()
    save.press('Enter')
    expect(panel.get_by_text('El servidor confirmó el cambio de solicitud.', exact=True)).to_be_visible()
    assert store.record['data']['requests'][0]['ranges'] == [{'start': 1380, 'end': 1560}]
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.screenshot(path=str(artifacts / 'requests-spanish-phone.png'), full_page=True)
    assert not errors, errors
    context.close()
    context, page, panel, store, errors = open_page(browser, url, failure='unconfigured')
    expect(panel.get_by_text('Request storage is not active', exact=False)).to_be_visible()
    expect(panel.get_by_role('button', name='Save pending request', exact=True)).to_be_disabled()
    expect(page.get_by_role('button', name='Make schedule', exact=True)).to_be_enabled()
    assert not store.attempts and not errors
    context.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', required=True)
    parser.add_argument('--artifacts', default='/tmp/cr-schedule-requests')
    args = parser.parse_args()
    if urlparse(args.url).hostname not in ('127.0.0.1', 'localhost'):
        parser.error('Use a loopback server')
    artifacts = Path(args.artifacts)
    artifacts.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        check_flow(browser, args.url.rstrip('/'), artifacts)
        check_mobile_and_absent(browser, args.url.rstrip('/'), artifacts)
        browser.close()
    print('PASS: request entry, review, retries, conflicts, original provenance, bilingual phone and absent capability')
