#!/usr/bin/env python3
"""Local dev server for PDFree.

Plain `python -m http.server` lets the browser cache js/css, so edits appear
only after a hard reload. This one disables caching and picks the right MIME
types, which is all the site needs (there is no build step).

    python serve.py            # http://127.0.0.1:8787
    python serve.py 9000       # another port
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    extensions_map = dict(SimpleHTTPRequestHandler.extensions_map)
    extensions_map.update({
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.ttf': 'font/ttf',
        '.pdf': 'application/pdf',
    })

    def send_head(self):
        # Never answer 304: during development the browser must always get the
        # current file, not its cached copy.
        self.headers.replace_header('If-Modified-Since', 'Thu, 01 Jan 1970 00:00:00 GMT') \
            if 'If-Modified-Since' in self.headers else None
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        if '200' not in (args[1] if len(args) > 1 else ''):
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    server = ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory='.'))
    print('PDFree: http://127.0.0.1:%d  (Ctrl+C to stop)' % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nstopped')


if __name__ == '__main__':
    main()
