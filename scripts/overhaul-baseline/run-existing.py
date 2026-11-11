"""Run an existing browser script with external requests blocked and audited.
Usage: python scripts/overhaul-baseline/run-existing.py scripts/test-foo.py [args]
Does not contact a real Worker; each existing script supplies its own API mock.
"""
import runpy
import sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import Browser

original = Browser.new_context
attempts = []
def new_context(self, *args, **kwargs):
    kwargs['service_workers'] = 'block'
    context = original(self, *args, **kwargs)
    def guard(route):
        url = urlsplit(route.request.url)
        if url.scheme in ('http', 'https') and url.hostname in ('127.0.0.1', 'localhost'):
            route.continue_()
        else:
            attempts.append(route.request.url)
            route.abort()
    context.route('**/*', guard)
    return context
Browser.new_context = new_context
script = Path(sys.argv[1]).resolve()
sys.argv = sys.argv[1:]
sys.path.insert(0, str(script.parent))
try:
    runpy.run_path(str(script), run_name='__main__')
finally:
    print(f'External network guard: {len(attempts)} blocked attempts', flush=True)
    assert not attempts, attempts
