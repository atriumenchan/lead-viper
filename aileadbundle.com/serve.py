#!/usr/bin/env python3
"""Local static server with SPA fallback for the mirrored aileadbundle.com site."""

import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.dirname(os.path.abspath(__file__))


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Allow ES modules to load from local server
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        file_path = os.path.join(ROOT, path.lstrip("/"))

        if path != "/" and not os.path.isfile(file_path) and not os.path.isdir(file_path):
            # React Router client-side routes — serve index.html
            self.path = "/index.html"

        return super().do_GET()


if __name__ == "__main__":
    os.chdir(ROOT)
    with http.server.ThreadingHTTPServer(("", PORT), SPAHandler) as httpd:
        print(f"Serving AI Lead Bundle at http://localhost:{PORT}")
        print(f"Root directory: {ROOT}")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
