"""Program dial: tap advances one detent; dragging round the knob turns it and it snaps to the nearest detent.

Usage: python tests/dial.py <tag> [width] [height]
"""
import json
import math
import os
import sys

sys.argv = [sys.argv[0]] + sys.argv[1:]
import flow as F  # noqa: E402  (shares the server, audio stub and Run helpers)

B = F.B


def dial(r):
    pg = r.page
    F.phase_change(r)
    r.station("wash")
    r.wait_idle()
    c = r.pos("washerDial")
    hit = r.js(f"JSON.stringify(window.__bilas.pickAt({c['x']}, {c['y']}))")
    F.expect('"washerDial"' in hit, f"the knob is a target ({hit})")
    F.expect(r.js(B + "MS.washer.prog") == 1, "washer starts on 40")
    r.tap("washerDial")
    r.until(B + "MS.washer.prog === 2")
    F.expect(r.js(B + "MS.washer.prog") == 2, "a tap turns the dial one detent clockwise (60)")
    r.wait_idle()
    # drag half a turn anticlockwise round the knob: 60 -> 30
    c = r.pos("washerDial")
    rad = 46
    pg.mouse.move(c["x"], c["y"] - 6)
    pg.mouse.down()
    steps = 24
    for i in range(1, steps + 1):
        a = -math.pi / 2 - math.pi * i / steps
        pg.mouse.move(c["x"] + math.cos(a) * rad, c["y"] + math.sin(a) * rad)
        pg.wait_for_timeout(20)
    pg.mouse.up()
    pg.wait_for_timeout(500)
    prog = r.js(B + "MS.washer.prog")
    rot = r.js(B + "MS.washer.parts.dial.rotation.z")
    F.expect(prog == 0, f"dragging anticlockwise turns it back to 30 (prog {prog})")
    F.expect(abs(rot - 0.75 * math.pi) < 0.05, f"the pointer settles on the detent (rot {rot:.3f})")
    r.shot("d1-dial")


def main():
    port = F.serve()
    errors = []
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(args=F.ARGS)
        page = browser.new_page(viewport={"width": F.WIDTH, "height": F.HEIGHT})
        page.add_init_script(F.AUDIO_STUB)
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
        page.goto(f"http://127.0.0.1:{port}/index.html")
        page.wait_for_timeout(1500)
        r = F.Run(page)
        try:
            dial(r)
        except F.PhaseFail:
            r.shot("zz-fail")
        except Exception as e:  # noqa: BLE001
            F.FAILS.append("EXCEPTION " + repr(e)[:300])
            r.shot("zz-exception")
        browser.close()
    print("RESULT " + json.dumps({"size": f"{F.WIDTH}x{F.HEIGHT}", "fails": F.FAILS, "errors": errors[:20]}), flush=True)
    os._exit(0)


if __name__ == "__main__":
    main()
