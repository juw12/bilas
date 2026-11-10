"""Gesture checks: carry shirts from the basket into the drums, and pour detergent by holding the bottle over the drawer.

Usage: python tests/gestures.py <tag> [width] [height]
"""
import json
import os
import sys

sys.argv = [sys.argv[0]] + sys.argv[1:]
import flow as F  # noqa: E402  (shares the server, audio stub and Run helpers)

B = F.B


def carry(r, frm, to, hold_ms=250):
    a = r.pos(frm)
    b = r.pos(to)
    if not a or not b:
        F.FAILS.append(f"no pos {frm}->{to}")
        return False
    pg = r.page
    pg.mouse.move(a["x"], a["y"])
    pg.mouse.down()
    steps = 18
    for i in range(1, steps + 1):
        k = i / steps
        pg.mouse.move(a["x"] + (b["x"] - a["x"]) * k, a["y"] + (b["y"] - a["y"]) * k)
        pg.wait_for_timeout(20)
    pg.wait_for_timeout(hold_ms)
    pg.mouse.up()
    return True


def gestures(r):
    pg = r.page
    F.phase_change(r)
    r.station("wash")
    # two shirts by hand, the rest by tap
    for i in range(2):
        r.wait_idle()
        before = (r.pos("basketShirt:dirty"), r.pos("washerClothes"))
        carry(r, "basketShirt:dirty", "washerClothes")
        r.until(B + f"MS.washer.items.length === {i + 1}")
        if r.js(B + "MS.washer.items.length") != i + 1:
            print("debug carry", i, "from/to", before)
            print("debug state", r.js("JSON.stringify({w: " + B + "MS.washer.items.length, busy: " + B + "MS.washer.busy, door: " + B + "MS.washer.doorOpen, down: " + B + "lastDown})"))
            r.shot(f"g-debug-carry{i}")
        if i == 0:
            pg.wait_for_timeout(300)
            r.shot("g1-carried")
    F.expect(r.js(B + "MS.washer.items.length") == 2, "2 shirts carried into the washer by drag")
    # a drag that ends away from the drum puts the shirt back
    r.wait_idle()
    carry(r, "basketShirt:dirty", "basket")
    pg.wait_for_timeout(900)
    F.expect(r.js(B + "MS.washer.items.length") == 2, "drop outside the drum returns the shirt to the basket")
    F.expect(r.js("window.__bilas.counts().states.filter(s => s === 'dirty@basket').length") == 2, "2 dirty shirts still in the basket")
    for i in range(2):
        r.tap("basket", settle=False)
        r.until(B + f"MS.washer.items.length === {i + 3}")
    r.wait_idle()
    r.tap("washerDoor")
    r.until("!" + B + "MS.washer.doorOpen && !" + B + "MS.washer.busy")
    # closing the door swings the camera to the soap view; grab the bottle once it has settled
    r.wait_idle()
    # pour: carry the bottle over the drawer and hold, release early once, then finish
    s = r.pos("soap")
    t = r.pos("pourTarget")
    # release as soon as the cup has started filling. The release is fired from inside the page on the
    # first frame past 10 %: on a loaded machine each scripted mouse move is a slow round trip, and a
    # release sent from here can arrive after the whole 2 s pour has already finished.
    r.js("""(function () {
        const canvas = document.getElementById('scene');
        window.__earlyRelease = null;
        (function watch() {
            const fill = window.__bilas.MS.washer.soapFill || 0;
            if (fill > 0.1) {
                canvas.dispatchEvent(new PointerEvent('pointerup', {
                    bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
                    clientX: %f, clientY: %f
                }));
                window.__earlyRelease = fill;
                return;
            }
            if (!window.__bilas.MS.washer.soap) {
                requestAnimationFrame(watch);
            }
        })();
        return true;
    })()""" % (t["x"], t["y"]))
    pg.mouse.move(s["x"], s["y"])
    pg.mouse.down()
    for i in range(1, 19):
        k = i / 18
        pg.mouse.move(s["x"] + (t["x"] - s["x"]) * k, s["y"] + (t["y"] - s["y"]) * k)
        pg.wait_for_timeout(20)
    r.until("window.__earlyRelease !== null", 12)
    pg.mouse.up()
    pg.wait_for_timeout(1200)
    part = r.js(B + "MS.washer.soapFill || 0")
    released = r.js("window.__earlyRelease")
    soap_now = r.js(B + "MS.washer.soap")
    F.expect(0 < part < 1 and soap_now is False, f"early release keeps a partial cup ({part:.2f}, released at {released}, soap {soap_now})")
    r.wait_idle()
    s = r.pos("soap")
    t = r.pos("pourTarget")
    pg.mouse.move(s["x"], s["y"])
    pg.mouse.down()
    for i in range(1, 19):
        k = i / 18
        pg.mouse.move(s["x"] + (t["x"] - s["x"]) * k, s["y"] + (t["y"] - s["y"]) * k)
        pg.wait_for_timeout(20)
    # mid-pour shot on the full pour, where running to a full cup is the intended outcome
    r.until("(" + B + "MS.washer.soapFill || 0) > " + str(round(part + 0.1, 2)), 6)
    r.shot("g2-pouring")
    r.until(B + "MS.washer.soap === true", 8)
    pg.mouse.up()
    F.expect(r.js(B + "MS.washer.soap") is True, "detergent poured by holding the bottle over the drawer")
    r.wait_idle()
    F.expect(abs(r.js(B + "MS.washer.parts.bottle.rotation.z")) < 0.05, "bottle back upright at home")
    # finish the wash quickly, then carry one wet shirt into the dryer
    for i in range(2):
        r.wait_idle()
        r.drag(r.pos("washerCoin"), r.pos("washerSlot"))
        r.until(B + f"MS.washer.coins === {i + 1}")
    r.wait_idle()
    r.tap("washerStart")
    r.js(B + "ff(400)")
    r.until(B + "MS.washer.phase === 'done'")
    r.tap("washerDoor")
    for _ in range(6):
        if r.js(B + "MS.washer.items.length") == 0:
            break
        r.tap("washerDrum")
    r.until(B + "MS.washer.items.length === 0")
    r.station("dry")
    r.wait_idle()
    carry(r, "basketShirt:wet", "dryerClothes")
    r.until(B + "MS.dryer.items.length === 1")
    F.expect(r.js(B + "MS.dryer.items.length") == 1, "wet shirt carried into the dryer by drag")
    r.shot("g3-dryer")


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
            gestures(r)
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
