"""Serve the local static export with Next-style HTML route resolution. No proxy."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        resolved = super().translate_path(path)
        html = Path(resolved.rstrip('/') + '.html')
        if not Path(resolved).is_file() and html.is_file():
            return str(html)
        return resolved

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=3027)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2] / 'out'
    if not (root / 'index.html').is_file():
        parser.error('Build the export with the loopback API override first.')
    ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(root))).serve_forever()
