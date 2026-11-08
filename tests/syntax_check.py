
import sys, json
from playwright.sync_api import sync_playwright
from pathlib import Path
root = Path(sys.argv[1])
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"])
    pg = b.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(root.joinpath("index.html").as_uri())
    pg.wait_for_timeout(2500)
    print(json.dumps({"errors": errs, "hooks": pg.evaluate("!!(window.__bilas && window.__bilas.S)")}))
    b.close()
