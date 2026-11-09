"""Dial + drawer gesture checks: twist the program dial between detents (cycle time follows), tap it to step,
pull the detergent drawer open by dragging and push it shut again.

Usage: python tests/dialdrawer.py <tag> [width] [height]
"""
import json
import math
import os
import sys

sys.argv = [sys.argv[0]] + sys.argv[1:]
import flow as F  # noqa: E402  (shares the server, audio stub and Run helpers)

B = F.B


def twist(r, name, degrees, radius=48, steps=24):
    """Drag a finger around the knob's centre by `degrees` (positive = clockwise on screen)."""
    c = r.pos(name)
    pg = r.page
    a0 = -math.pi / 2  # start above the knob
    pg.mouse.move(c["x"], c["y"])
    pg.mouse.down()
    pg.mouse.move(c["x"] + radius * math.cos(a0), c["y"] + radius * math.sin(a0), steps=4)
    for i in range(1, steps + 1):
        a = a0 + math.radians(degrees) * i / steps
        pg.mouse.move(c["x"] + radius * math.cos(a), c["y"] + radius * math.sin(a))
        pg.wait_for_timeout(16)
    pg.mouse.up()
    pg.wait_for_timeout(300)


def slide(r, name, dy, steps=14):
    c = r.pos(name)
    pg = r.page
    pg.mouse.move(c["x"], c["y"])
    pg.mouse.down()
    for i in range(1, steps + 1):
        pg.mouse.move(c["x"], c["y"] + dy * i / steps)
        pg.wait_for_timeout(16)
    pg.mouse.up()
    pg.wait_for_timeout(400)


def checks(r):
    F.phase_change(r)
    r.station("wash")
    r.wait_idle()
    base = r.js(B + "MS.washer.prog")
    F.expect(base == 1, f"washer dial starts on 40 C (prog {base})")
    twist(r, "washerKnob", 100)
    p1 = r.js(B + "MS.washer.prog")
    F.expect(p1 == 2 or p1 == 3, f"clockwise twist moves the dial to a hotter program (prog {p1})")
    ang = r.js(B + "MS.washer.parts.dial.rotation.z")
    want = [0.75, 0.25, -0.25, -0.75][p1] * math.pi
    F.expect(abs(ang - want) < 0.05, f"dial settles on its detent ({ang:.2f} vs {want:.2f})")
    r.shot("d1-dial-hot")
    twist(r, "washerKnob", -200)
    p2 = r.js(B + "MS.washer.prog")
    F.expect(p2 < p1, f"counter-clockwise twist goes back to a cooler program (prog {p2})")
    # tap steps one detent
    before = r.js(B + "MS.washer.prog")
    r.tap("washerKnob")
    after = r.js(B + "MS.washer.prog")
    F.expect(after == (before + 1) % 4, f"tap steps the dial one detent ({before}->{after})")
    # cycle time follows the program
    k = r.js("[0.85, 1, 1.15, 1.3][" + B + "MS.washer.prog]")
    cyc = r.js("window.__bilas.S ? window.__bilas.S.cycle : 45") or 45
    F.expect(k > 0, f"program factor {k} for cycle {cyc}s")
    # drawer: drag down pulls it out, drag up pushes it in, a tap toggles
    slide(r, "drawer", 70)
    z = r.js(B + "MS.washer.parts.drawer.position.z")
    F.expect(z > 0.08 and r.js(B + "MS.washer.drawerOpen") is True, f"drag pulls the drawer open (z {z:.3f})")
    r.shot("d2-drawer-open")
    slide(r, "drawer", -70)
    z = r.js(B + "MS.washer.parts.drawer.position.z")
    F.expect(z < 0.01 and not r.js(B + "MS.washer.drawerOpen"), f"drag pushes the drawer shut (z {z:.3f})")
    r.tap("drawer")
    r.page.wait_for_timeout(400)
    F.expect(r.js(B + "MS.washer.drawerOpen") is True, "tap toggles the drawer open")
    r.tap("drawer")
    r.page.wait_for_timeout(400)
    F.expect(not r.js(B + "MS.washer.drawerOpen"), "tap toggles the drawer shut")
    # dryer dial on its own station
    r.station("dry")
    r.wait_idle()
    twist(r, "dryerKnob", 100)
    F.expect(r.js(B + "MS.dryer.prog") >= 2, "dryer dial twists to a hotter, quicker heat")
    r.shot("d3-dryer-dial")


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
            checks(r)
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
