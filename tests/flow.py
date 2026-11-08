"""G1 + G2 + G3: full real-pointer laundry run, console errors, sound coverage.

Usage: python tests/flow.py <shots-subfolder> [width] [height]
Prints one JSON line starting with RESULT.
"""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TAG = sys.argv[1] if len(sys.argv) > 1 else "flow"
WIDTH = int(sys.argv[2]) if len(sys.argv) > 2 else 1280
HEIGHT = int(sys.argv[3]) if len(sys.argv) > 3 else 800
OUT = ROOT / "hone" / "shots" / TAG
LITE = os.environ.get("BILAS_LITE") == "1"
ENGINE = os.environ.get("BILAS_ENGINE", "chromium")  # "webkit" = Safari engine with an iPhone user agent
QUERY = "?lite" if LITE else ""
OUT.mkdir(parents=True, exist_ok=True)

for key in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]:
    os.environ.pop(key, None)
os.environ["NO_PROXY"] = "localhost,127.0.0.1"

ARGS = [
    "--enable-gpu",
    "--use-angle=d3d11",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--proxy-bypass-list=127.0.0.1;localhost",
    "--autoplay-policy=no-user-gesture-required",
]

# Headless Chromium on this machine hangs when a real AudioContext starts, so tests run the
# app's synth graph against an OfflineAudioContext: every node is still built and every sound id
# is still recorded by BilasAudio, it just is never sent to a speaker.
AUDIO_STUB = """
(() => {
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Off) {
    return;
  }
  function Fake() {
    const c = new Off(2, 44100 * 2, 44100);
    c.resume = () => Promise.resolve();
    return c;
  }
  window.AudioContext = Fake;
  window.webkitAudioContext = Fake;
})();
"""

LOG = []
FAILS = []
OCCLUDED = []


def note(msg):
    LOG.append(msg)
    print(msg, flush=True)


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(Quiet, directory=str(ROOT))
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server.server_address[1]


class Run:
    def __init__(self, page):
        self.page = page

    def js(self, expr):
        return self.page.evaluate(expr)

    def wait_idle(self, timeout=8.0):
        end = time.time() + timeout
        self.page.wait_for_timeout(150)
        while time.time() < end:
            if self.js("window.__bilas.idle()"):
                self.page.wait_for_timeout(120)
                return True
            self.page.wait_for_timeout(100)
        return False

    def until(self, expr, timeout=25.0):
        end = time.time() + timeout
        while time.time() < end:
            if self.js(expr):
                return True
            self.page.wait_for_timeout(200)
        note("TIMEOUT waiting for " + expr)
        return False

    def pos(self, name):
        return self.js(f"window.__bilas.screen({json.dumps(name)})")

    def check_hit(self, x, y, name):
        top = self.js(f"(function(){{const e=document.elementFromPoint({x},{y});return e?e.id||e.className||e.tagName:'none'}})()")
        if top != "scene":
            OCCLUDED.append(f"{name}@{int(x)},{int(y)} under {top}")

    def tap(self, name, settle=True):
        p = self.pos(name)
        if not p:
            FAILS.append(f"no screen pos for {name}")
            return False
        if not p["onScreen"]:
            FAILS.append(f"{name} off screen")
            return False
        self.check_hit(p["x"], p["y"], name)
        self.page.mouse.click(p["x"], p["y"])
        if settle:
            self.wait_idle()
        return True

    def station(self, st):
        self.page.click(f'#stations button[data-st="{st}"]')
        self.wait_idle()
        self.page.wait_for_timeout(250)

    def drag(self, a, b, steps=14):
        self.page.mouse.move(a["x"], a["y"])
        self.page.mouse.down()
        for i in range(1, steps + 1):
            k = i / steps
            self.page.mouse.move(a["x"] + (b["x"] - a["x"]) * k, a["y"] + (b["y"] - a["y"]) * k)
            self.page.wait_for_timeout(16)
        self.page.mouse.up()

    def scrub(self, prefix, xs, ys):
        first = self.pos(f"{prefix}:{xs[0]},{ys[0]}")
        if not first:
            FAILS.append(f"no {prefix}")
            return
        self.check_hit(first["x"], first["y"], prefix)
        print("scrub start", prefix, first, flush=True)
        self.page.mouse.move(first["x"], first["y"])
        self.page.mouse.down()
        for row, y in enumerate(ys):
            seq = xs if row % 2 == 0 else list(reversed(xs))
            for x in seq:
                p = self.pos(f"{prefix}:{x},{y}")
                if p:
                    self.page.mouse.move(p["x"], p["y"], steps=4)
                    self.page.wait_for_timeout(12)
        self.page.mouse.up()
        print("scrub end lastDown", self.js("window.__bilas.lastDown || null"), flush=True)

    def counts(self):
        return self.js("window.__bilas.counts()")

    def shot(self, name):
        if LITE:
            self.js("window.__bilas.hq(true)")
            self.page.wait_for_timeout(2500)
        for attempt in range(3):
            try:
                self.page.screenshot(path=str(OUT / f"{name}.png"), timeout=45000)
                break
            except Exception as exc:
                print("shot retry", name, attempt, type(exc).__name__, flush=True)
                self.page.wait_for_timeout(2000)
        if LITE:
            self.js("window.__bilas.hq(false)")


class PhaseFail(Exception):
    pass


def expect(cond, msg):
    if not cond:
        FAILS.append(msg)
        note("FAIL " + msg)
        raise PhaseFail(msg)
    note("ok   " + msg)


B = "window.__bilas."


def phase_change(r):
    page = r.page
    r.shot("00-intro")
    page.click("#btnStart")
    r.wait_idle()
    page.wait_for_timeout(600)
    r.shot("01-start")
    r.station("change")
    r.tap("bill", settle=False)
    page.wait_for_timeout(1500)
    r.shot("02-change-coins")
    r.until(B + "S.trayCoins === 4")
    r.tap("tray")
    expect(r.counts()["purse"] == 4, "changer gives 4 coins")


def phase_wash(r):
    page = r.page
    r.station("wash")
    r.tap("washerDoor")
    r.until(B + "MS.washer.doorOpen && !" + B + "MS.washer.busy")
    for i in range(4):
        r.tap("basket", settle=False)
        r.until(B + f"MS.washer.items.length === {i + 1}")
    r.wait_idle()
    expect(r.js(B + "MS.washer.items.length") == 4, "4 shirts in washer")
    r.shot("03-washer-loaded")
    r.tap("washerDoor")
    r.until("!" + B + "MS.washer.doorOpen && !" + B + "MS.washer.busy")
    r.tap("soap", settle=False)
    r.until(B + "MS.washer.soap === true", 60)
    r.wait_idle()
    expect(r.js(B + "MS.washer.soap") is True, "detergent added")
    for i in range(2):
        r.wait_idle()
        coin = r.pos("washerCoin")
        slot = r.pos("washerSlot")
        if coin and slot:
            r.drag(coin, slot)
        r.until(B + f"MS.washer.coins === {i + 1}")
    expect(r.js(B + "MS.washer.coins") == 2, "2 coins dragged into washer slot")
    r.wait_idle()
    r.tap("washerStart")
    expect(r.js(B + "MS.washer.phase") == "run", "washer running")
    page.wait_for_timeout(2500)
    r.shot("04-washing")
    r.js(B + "ff(14)")
    page.wait_for_timeout(1500)
    r.shot("04b-washing-mid")
    r.js(B + "ff(400)")
    page.wait_for_timeout(400)
    expect(r.js(B + "MS.washer.phase") == "done", "wash finished")
    r.tap("washerDoor")
    r.until(B + "MS.washer.doorOpen && !" + B + "MS.washer.busy")
    for i in range(4):
        r.tap("washerDrum", settle=False)
        r.until(B + f"MS.washer.items.length === {3 - i}")
    r.wait_idle()
    r.until(B + "counts().states.filter(function(s){return s === 'wet@basket'}).length === 4")
    st = r.counts()["states"]
    expect(sum(1 for s in st if s == "wet@basket") == 4, f"4 wet shirts back in basket ({st})")


def phase_dry(r):
    page = r.page
    r.station("dry")
    r.tap("dryerDoor")
    r.until(B + "MS.dryer.doorOpen && !" + B + "MS.dryer.busy")
    for i in range(2):
        r.tap("basket", settle=False)
        r.until(B + f"MS.dryer.items.length === {i + 1}")
    r.wait_idle()
    expect(r.js(B + "MS.dryer.items.length") == 2, "2 shirts in dryer")
    r.tap("dryerDoor")
    r.until("!" + B + "MS.dryer.doorOpen && !" + B + "MS.dryer.busy")
    r.wait_idle()
    coin = r.pos("dryerCoin")
    slot = r.pos("dryerSlot")
    if coin and slot:
        r.drag(coin, slot)
    r.until(B + "MS.dryer.coins === 1")
    r.wait_idle()
    r.tap("dryerStart")
    expect(r.js(B + "MS.dryer.phase") == "run", "dryer running")
    page.wait_for_timeout(2500)
    r.shot("05-drying")
    r.js(B + "ff(400)")
    page.wait_for_timeout(400)
    expect(r.js(B + "MS.dryer.phase") == "done", "dry finished")
    r.tap("dryerDoor")
    r.until(B + "MS.dryer.doorOpen && !" + B + "MS.dryer.busy")
    for i in range(2):
        r.tap("dryerDrum", settle=False)
        r.until(B + f"MS.dryer.items.length === {1 - i}")
    r.wait_idle()
    r.until(B + "counts().states.filter(function(s){return s === 'dry@basket'}).length === 2")
    lint_before = r.js(B + "S.lint.amount")
    expect(lint_before > 0, "lint collected after drying")
    r.tap("lintTab")
    r.until(B + "S.lint.open")
    r.wait_idle()
    r.shot("06-lint")
    for _ in range(4):
        if r.js(B + "S.lint.amount") <= 0:
            break
        r.scrub("lintPoint", [-0.11, -0.07, -0.03, 0.01, 0.05, 0.09, 0.115], [-0.075, -0.045, -0.015, 0.015, 0.045, 0.075])
    r.until(B + "S.lint.amount <= 0 && !" + B + "S.lint.open")
    expect(r.js(B + "S.lint.amount") <= 0, "lint trap cleaned by dragging")


def phase_hang(r):
    page = r.page
    r.station("hang")
    r.shot("07-hang-empty")
    for i in range(2):
        r.tap("basket", settle=False)
        r.until(B + f"S.line.filter(function(s){{return s && s.hang && s.hang.markers.length === 2}}).length === {i + 1}")
        r.wait_idle()
    for i in range(4):
        r.tap("peg", settle=False)
        r.until(B + f"S.line.filter(Boolean).reduce(function(a,s){{return a + s.hang.pegs}}, 0) === {i + 1}", 10)
    pegs = r.js(B + "S.line.filter(Boolean).map(function(s){return s.hang.pegs})")
    expect(sorted(pegs) == [2, 2], f"2 shirts pegged ({pegs})")
    page.wait_for_timeout(2500)
    r.shot("08-hanging")
    r.js(B + "ff(200)")
    page.wait_for_timeout(800)
    for i in range(2):
        r.tap("lineShirtDry", settle=False)
        r.until(B + f"S.line.filter(Boolean).length === {1 - i}")
    r.wait_idle()
    r.until(B + "counts().states.filter(function(s){return s === 'dry@basket'}).length === 4")
    st = r.counts()["states"]
    expect(sum(1 for s in st if s == "dry@basket") == 4, f"4 dry shirts in basket ({st})")


def phase_fold(r):
    page = r.page
    r.station("fold")
    for n in range(4):
        r.tap("basket", settle=False)
        r.until(B + "S.table.step === 'smooth'")
        r.wait_idle()
        if n == 0:
            r.shot("09-wrinkled")
        for _ in range(6):
            if r.js(B + "S.table.step") != "smooth":
                break
            r.scrub("tablePoint", [-0.2, -0.12, -0.04, 0.04, 0.12, 0.2], [0.2, 0.12, 0.04, -0.04, -0.12, -0.2])
        expect(r.js(B + "S.table.step") == "L", f"shirt {n + 1} smoothed")
        for k, nxt in enumerate(["R", "B", "done"]):
            r.wait_idle()
            r.tap("tablePoint:0,0", settle=False)
            if nxt == "done":
                r.until(B + "S.table.shirt === null")
            else:
                r.until(B + f"S.table.step === '{nxt}'")
            if n == 0 and k == 0:
                r.shot("10-folding")
        r.wait_idle()
    r.until(B + "counts().folded === 4")
    page.wait_for_timeout(2500)
    c = r.counts()
    expect(c["folded"] == 4, f"4 shirts folded ({c['states']})")
    r.until("!document.getElementById('done').hidden", 20)
    r.shot("11-done")
    expect(r.js("!document.getElementById('done').hidden"), "done card shown")


def flow(r):
    for ph in [phase_change, phase_wash, phase_dry, phase_hang, phase_fold]:
        try:
            ph(r)
        except PhaseFail:
            r.shot("zz-fail-" + ph.__name__)
            note("hint at failure: " + str(r.js("window.__bilas.hint()")))
            break


def main():
    port = serve()
    errors = []
    result = {}
    with sync_playwright() as p:
        if ENGINE == "webkit":
            browser = p.webkit.launch()
            ua = p.devices["iPhone 13"]["user_agent"]
            page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, user_agent=ua, device_scale_factor=2)
        else:
            browser = p.chromium.launch(args=ARGS)
            page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
        page.add_init_script(AUDIO_STUB)
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
        page.on("crash", lambda p: note("PAGE CRASHED"))
        page.on("request", lambda rq: errors.append("EXTERNAL " + rq.url) if not rq.url.startswith(f"http://127.0.0.1:{port}") and not rq.url.startswith("data:") and not rq.url.startswith("blob:") else None)
        page.goto(f"http://127.0.0.1:{port}/index.html{QUERY}")
        page.wait_for_timeout(1500)
        r = Run(page)
        try:
            flow(r)
        except Exception as e:  # noqa: BLE001
            FAILS.append("EXCEPTION " + repr(e)[:300])
            r.shot("zz-exception")
        fired = page.evaluate("window.__bilas.fired ? window.__bilas.fired() : []")
        result = {
            "size": f"{WIDTH}x{HEIGHT}",
            "fails": FAILS,
            "errors": errors[:20],
            "occluded": OCCLUDED[:20],
            "sounds": sorted(fired),
            "soundCount": len([s for s in fired if s != "ambient"]),
            "ambient": "ambient" in fired,
        }
        browser.close()
    print("RESULT " + json.dumps(result), flush=True)
    os._exit(0)


if __name__ == "__main__":
    main()
