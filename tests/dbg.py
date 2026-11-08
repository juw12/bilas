"""Interactive debug session: python -i tests/dbg.py  (gives `page`, `r` = Run helper)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flow  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

port = flow.serve()
pw = sync_playwright().start()
browser = pw.chromium.launch(args=flow.ARGS)
page = browser.new_page(viewport={"width": 1280, "height": 800})
page.add_init_script(flow.AUDIO_STUB)
errs = []
page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
page.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
page.goto(f"http://127.0.0.1:{port}/index.html")
page.wait_for_timeout(1500)
r = flow.Run(page)
print("READY", flush=True)
