"""Quick visual smoke run: load, start, visit each station, save screenshots."""
import functools
import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "hone" / "shots" / (sys.argv[1] if len(sys.argv) > 1 else "smoke")
OUT.mkdir(parents=True, exist_ok=True)

for key in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]:
    os.environ.pop(key, None)
os.environ["NO_PROXY"] = "localhost,127.0.0.1"

ARGS = [
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--proxy-bypass-list=127.0.0.1;localhost",
    "--autoplay-policy=no-user-gesture-required",
]


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a: None
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server.server_address[1]


def main():
    port = serve()
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=ARGS)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
        page.goto(f"http://127.0.0.1:{port}/index.html")
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / "00-intro.png"))
        page.click("#btnStart")
        page.wait_for_timeout(600)
        page.evaluate("window.__bilas.go('overview')")
        page.wait_for_timeout(1600)
        page.screenshot(path=str(OUT / "01-overview.png"))
        for st in ["change", "wash", "dry", "hang", "fold", "sit"]:
            page.evaluate(f"window.__bilas.go('{st}')")
            page.wait_for_timeout(1700)
            page.screenshot(path=str(OUT / f"02-{st}.png"))
        print("ERRORS:", errors[:20])
    os._exit(0)


if __name__ == "__main__":
    main()
