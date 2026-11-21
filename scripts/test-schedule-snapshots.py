"""Loopback-only publication timing checks; all API calls use synthetic fixtures."""
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


class SnapshotStore(views.FixtureStore):
    def __init__(self):
        super().__init__()
        self.fail_publication = False
        self.template_reads = 0

    def route(self, route):
        request = route.request
        url = urlparse(request.url)
        if request.method == 'GET' and url.path == '/api/template':
            self.template_reads += 1
        if request.method == 'GET' and url.path == '/api/schedule':
            docs = [doc for key, doc in self.saved.items()
                    if key[0].startswith('/api/schedule/') and doc.get('visible')]
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({
                'weeks': docs, 'rev': max([doc['rev'] for doc in docs], default=0), 'notModified': False}))
        if request.method == 'PUT' and url.path.startswith('/api/schedule/') and self.fail_publication:
            self.fail_publication = False
            return route.fulfill(status=503, content_type='application/json', body='{"error":"synthetic_failure"}')
        return super().route(route)


def check(browser, url, artifacts):
    store = SnapshotStore()
    context, page, _, errors = views.open_scheduler(browser, url, 'CR3-diningroom', store=store)
    schedule = page.locator('#scheduler-panel-schedule')
    schedule.get_by_role('button', name='Make schedule', exact=True).click()
    schedule.get_by_role('button', name='Publish to staff', exact=True).first.click()
    page.get_by_role('button', name='Publish', exact=True).click()
    expect(page.get_by_text('Published. Staff now see this week.', exact=True)).to_be_visible()
    page.get_by_role('button', name='Close', exact=True).click()
    key = next(key for key in store.saved if key[0].startswith('/api/schedule/'))
    original = copy.deepcopy(store.saved[key])
    assert original['snapshot']['slots'][0]['end'] == 960

    # Save a time-only edit; its published assignment indexes and layout hash are unchanged.
    page.get_by_role('tab', name='Employee settings', exact=True).click()
    settings = page.locator('#scheduler-panel-settings')
    settings.locator('summary').filter(has_text='Shift rules').click()
    settings.get_by_label('Spot end time hour', exact=True).first.select_option('3')
    page.get_by_role('button', name='Save changes', exact=True).click()
    expect(page.get_by_role('button', name='Save changes', exact=True)).to_be_disabled()
    page.get_by_role('button', name='Back to schedule', exact=True).click()
    schedule.get_by_role('button', name='Publish to staff', exact=True).first.click()
    expect(page.get_by_text('You have changes staff cannot see yet.', exact=True)).to_be_visible()
    page.screenshot(path=str(artifacts / 'unpublished-time-change.png'), full_page=True)

    staff = context.new_page()
    staff.set_default_timeout(10000)
    staff.on('pageerror', lambda error: errors.append(str(error)))
    reads = store.template_reads
    staff.goto(f'{url}/schedule/CR3-diningroom.html', wait_until='networkidle')
    table = staff.locator('table').first
    expect(table.locator('tbody td').first).to_contain_text('04:00 PM')
    assert store.template_reads == reads, 'snapshot viewer must not fetch mutable rules'
    staff.screenshot(path=str(artifacts / 'staff-before-publish.png'), full_page=True)

    # Publication failure leaves the old staff schedule intact.
    store.fail_publication = True
    page.get_by_role('button', name='Publish updates', exact=True).click()
    expect(page.get_by_text('Saving is not set up on the server yet.', exact=False)).to_be_visible()
    assert store.saved[key] == original
    staff.reload(wait_until='networkidle')
    expect(staff.locator('table').first.locator('tbody td').first).to_contain_text('04:00 PM')

    page.get_by_role('button', name='Publish updates', exact=True).click()
    expect(page.get_by_text('Published. Staff now see this week.', exact=True)).to_be_visible()
    assert store.saved[key]['snapshot']['slots'][0]['end'] == 900
    assert store.saved[key]['templateHash'] == original['templateHash']
    staff.reload(wait_until='networkidle')
    expect(staff.locator('table').first.locator('tbody td').first).to_contain_text('03:00 PM')
    staff.screenshot(path=str(artifacts / 'staff-after-publish-desktop.png'), full_page=True)
    staff.set_viewport_size({'width': 390, 'height': 844})
    expect(staff.locator('#staff-day-Sunday')).to_contain_text('03:00 PM')
    staff.screenshot(path=str(artifacts / 'staff-after-publish-phone.png'), full_page=True)
    staff.emulate_media(media='print')
    expect(staff.get_by_text('10:00 AM - 03:00 PM', exact=True).filter(visible=True).first).to_be_visible()
    staff.pdf(path=str(artifacts / 'staff-snapshot.pdf'))
    assert not errors, errors
    context.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:3064')
    parser.add_argument('--artifacts', default='/tmp/cr-schedule-snapshots')
    args = parser.parse_args()
    if urlparse(args.url).hostname not in ('localhost', '127.0.0.1'):
        parser.error('--url must point to a loopback server')
    artifacts = Path(args.artifacts)
    artifacts.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        check(browser, args.url.rstrip('/'), artifacts)
        browser.close()
    print(f'Publication snapshot checks passed. Artifacts: {artifacts}')
