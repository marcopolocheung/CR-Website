"""End-to-end agent checks against synthetic Worker data and the real Node service.

Build with NEXT_PUBLIC_AGENT_API=http://127.0.0.1:8790 npm run build, then run
python3 scripts/test-scheduling-agent.py. Requires Python Playwright + Chromium.
Only loopback services are allowed; production services and paid models are unused.
"""

import functools
import http.server
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import urllib.request

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TOKEN = 'fixture-password'
FRONTEND = 'http://127.0.0.1:3010'
AGENT = 'http://127.0.0.1:8790'
spec = importlib.util.spec_from_file_location('scheduler_fixtures', ROOT / 'scripts/test-scheduler-views.py')
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)


class QuietStaticHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


class WorkerFixture(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        assert self.path.startswith('/api/internal/schedule-requests/')
        assert self.headers['Authorization'] == f'Bearer {TOKEN}'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"record":null}')

    def log_message(self, *_):
        pass


def serve(server):
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def start_agent(directory, worker_port):
    env = {**os.environ, 'AGENT_MANAGER_TOKEN': TOKEN, 'AGENT_PORT': '8790',
           'AGENT_ALLOWED_ORIGIN': FRONTEND, 'AGENT_DB_PATH': str(Path(directory) / 'checkpoints.sqlite'),
           'AGENT_SCHEDULE_API': f'http://127.0.0.1:{worker_port}',
           'ANTHROPIC_API_KEY': '', 'AGENT_ANTHROPIC_MODEL': '', 'LANGSMITH_TRACING': 'false'}
    process = subprocess.Popen(['node', '--import', 'jiti/register', 'agent/server.ts'], cwd=ROOT, env=env,
                               stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    for _ in range(200):
        if process.poll() is not None:
            raise AssertionError(process.stderr.read().decode())
        try:
            request = urllib.request.Request(f'{AGENT}/api/agent/health', headers={'Authorization': f'Bearer {TOKEN}'})
            with urllib.request.urlopen(request, timeout=1) as response:
                assert json.load(response)['planner'] == 'built-in'
                return process
        except OSError:
            time.sleep(0.1)
    process.terminate()
    raise AssertionError('Local agent did not start')


def unlock(page):
    page.get_by_label('Manager code', exact=True).fill(TOKEN)
    page.get_by_role('button', name='Open the scheduler', exact=True).click()
    expect(page.get_by_text('Loading your saved schedule…', exact=True)).not_to_be_visible()
    page.get_by_role('button', name='Open assistant', exact=True).click()
    expect(page.get_by_role('button', name='Make proposal', exact=True)).to_be_enabled()


def open_page(browser, width):
    context = browser.new_context(viewport={'width': width, 'height': 1000})
    store = fixtures.FixtureStore()

    def route(request_route):
        if request_route.request.url.startswith(AGENT + '/'):
            request_route.continue_()
        else:
            store.route(request_route)

    context.route('**/*', route)
    page = context.new_page()
    page.set_default_timeout(15000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'{FRONTEND}/scheduler-demo/CR3-diningroom.html')
    unlock(page)
    return context, page, store, errors


def main():
    artifacts = Path('/tmp/cr-agent-browser-artifacts')
    artifacts.mkdir(exist_ok=True)
    static = serve(http.server.ThreadingHTTPServer(('127.0.0.1', 3010),
                   functools.partial(QuietStaticHandler, directory=str(ROOT / 'out'))))
    worker = serve(http.server.ThreadingHTTPServer(('127.0.0.1', 0), WorkerFixture))
    process = None
    try:
        with tempfile.TemporaryDirectory(prefix='cr-agent-browser-') as directory, sync_playwright() as playwright:
            process = start_agent(directory, worker.server_port)
            browser = playwright.chromium.launch(executable_path=os.environ.get('CR_AGENT_BROWSER_EXECUTABLE'))
            context, page, store, errors = open_page(browser, 1440)
            assistant = page.locator('section', has=page.get_by_role('heading', name='Scheduling assistant', exact=True))
            page.get_by_role('button', name='Make proposal', exact=True).click()
            expect(page.get_by_role('button', name='Use proposal', exact=True)).to_be_visible()
            expect(assistant).to_contain_text('7/7 required spots covered')
            assistant.get_by_text('Review 7 changed spots', exact=True).click()
            expect(assistant.locator('tbody tr')).to_have_count(7)
            page.screenshot(path=str(artifacts / 'agent-desktop-review.png'), full_page=True)
            assert not store.writes, 'Making a proposal must not write to the Worker'

            # Actual process restart while the LangGraph review interrupt is pending.
            process.terminate(); process.wait(timeout=20)
            process = start_agent(directory, worker.server_port)
            page.reload(); unlock(page)
            expect(page.get_by_role('button', name='Use proposal', exact=True)).to_be_visible()
            expect(assistant).to_contain_text('7/7 required spots covered')

            # A newer manual draft rejects the old proposal and remains on the board.
            schedule = page.locator('#scheduler-panel-schedule')
            schedule.get_by_role('button', name='Make schedule', exact=True).first.click()
            chips = schedule.get_by_role('button', name='Move Sample Employee out of', exact=False)
            expect(chips).to_have_count(7)
            page.get_by_role('button', name='Use proposal', exact=True).click()
            expect(assistant.get_by_role('alert')).to_contain_text('Your week changed')
            expect(chips).to_have_count(7)
            schedule.get_by_role('button', name='Undo', exact=True).first.click()
            expect(chips).to_have_count(0)

            # Accepting is draft-only and undoable, with no credentials in device storage.
            page.get_by_role('button', name='Use proposal', exact=True).click()
            expect(assistant).to_contain_text('Proposal added to your draft')
            expect(chips).to_have_count(7)
            assert not store.writes, 'Using a proposal must not publish or mutate the Worker'
            saved = page.evaluate('JSON.stringify({local: {...localStorage}, session: {...sessionStorage}})')
            assert TOKEN not in saved
            schedule.get_by_role('button', name='Undo', exact=True).first.click()
            expect(chips).to_have_count(0)
            assert not errors, errors
            context.close()

            context, page, store, errors = open_page(browser, 375)
            assistant = page.locator('section', has=page.get_by_role('heading', name='Scheduling assistant', exact=True))
            assistant.get_by_label('Goal for this week').select_option('fairHours')
            page.get_by_role('button', name='Make proposal', exact=True).click()
            expect(page.get_by_role('button', name='Use proposal', exact=True)).to_be_visible()
            expect(assistant).to_contain_text('Goal: Even out hours')
            assistant.get_by_text('Review 7 changed spots', exact=True).click()
            assert assistant.evaluate('(element) => element.scrollWidth <= element.clientWidth + 1')
            page.screenshot(path=str(artifacts / 'agent-phone-review.png'), full_page=True)
            for button in assistant.get_by_role('button').all():
                assert button.bounding_box()['height'] >= 44
            page.get_by_role('button', name='Dismiss proposal', exact=True).click()
            expect(assistant).to_contain_text('Proposal dismissed')
            assert not store.writes
            assert not errors, errors
            context.close(); browser.close()
            print('PASS: real agent, restart/review recovery, stale draft protection, apply/undo, draft-only writes, credentials, desktop and 375px phone')
            print(f'Screenshots: {artifacts}')
    finally:
        if process is not None and process.poll() is None:
            process.terminate(); process.wait(timeout=20)
        static.shutdown(); worker.shutdown()


if __name__ == '__main__':
    main()
