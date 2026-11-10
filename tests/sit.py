"""Sit mode, first-run beat and film-grain checks.

- The first start shows one quiet opening line, which ends by itself and walks to the changer.
- While sitting, taps on the room never change game state; they only nudge "Stand up".
- The film-grain toggle drops the noise layer, keeps the vignette, and survives a reload.
- A second start skips the opening line.

Usage: python tests/sit.py [tag] [width] [height]
"""
import json
import os
import sys

sys.argv = [sys.argv[0]] + sys.argv[1:]
import flow as F  # noqa: E402  (shares the server, audio stub and Run helpers)

B = F.B
SNAPSHOT = (
    "JSON.stringify({purse: " + B + "S.purse, tray: " + B + "S.trayCoins,"
    " washerDoor: " + B + "MS.washer.doorOpen, dryerDoor: " + B + "MS.dryer.doorOpen,"
    " drawer: " + B + "MS.washer.drawerOpen, washerItems: " + B + "MS.washer.items.length,"
    " lint: " + B + "S.lint.open, prog: " + B + "MS.washer.prog})"
)


def beat_visible(pg):
    return pg.evaluate("(function(){const b=document.getElementById('beat');return !b.hidden && b.textContent.length > 0})()")


def first_run(r):
    pg = r.page
    pg.click("#btnStart")
    pg.wait_for_timeout(500)
    F.expect(beat_visible(pg), "first start shows the opening line")
    r.shot("s1-beat")
    r.until(B + "S.station === 'change'", 8)
    F.expect(not beat_visible(pg), "opening line clears itself")
    F.expect(r.js(B + "S.station") == "change", "opening line ends at the changer")


def sit_is_safe(r):
    pg = r.page
    r.station("sit")
    pg.wait_for_timeout(1600)
    before = r.js(SNAPSHOT)
    taps = 0
    for name in ["bill", "tray", "washerDoor", "dryerDoor", "soap", "washerDial"]:
        p = r.pos(name)
        if p and p["onScreen"]:
            pg.mouse.click(p["x"], p["y"])
            pg.wait_for_timeout(250)
            taps += 1
    pg.mouse.click(F.WIDTH * 0.5, F.HEIGHT * 0.45)
    pg.wait_for_timeout(250)
    pg.mouse.click(F.WIDTH * 0.25, F.HEIGHT * 0.6)
    pg.wait_for_timeout(600)
    taps += 2
    after = r.js(SNAPSHOT)
    F.expect(r.js(B + "S.station") == "sit", f"still sitting after {taps} taps on the room")
    F.expect(before == after, "sitting taps leave the game state alone")
    nudged = pg.evaluate("document.getElementById('btnStand').classList.contains('nudge')")
    F.expect(nudged, "a tap while sitting nudges Stand up")
    r.shot("s2-sitting")
    pg.click("#btnStand")
    r.wait_idle()
    F.expect(r.js(B + "S.station") != "sit", "Stand up leaves the seat")


def lens_has_noise(pg):
    return pg.evaluate("getComputedStyle(document.querySelector('.lens')).backgroundImage.indexOf('svg') >= 0")


def grain_toggle(r):
    pg = r.page
    F.expect(lens_has_noise(pg), "grain is on by default")
    pg.click("#btnSettings")
    pg.click('[data-grain="off"]')
    F.expect(pg.evaluate("document.documentElement.dataset.grain") == "off", "grain toggle sets data-grain=off")
    F.expect(not lens_has_noise(pg), "grain off drops the noise layer")
    keeps_vignette = pg.evaluate("getComputedStyle(document.querySelector('.lens')).backgroundImage.indexOf('radial-gradient') >= 0")
    F.expect(keeps_vignette, "grain off keeps the vignette")
    r.shot("s3-grain-off")
    pg.click("#btnSettings")


def second_run(r, port):
    pg = r.page
    pg.goto(f"http://127.0.0.1:{port}/index.html")
    pg.wait_for_timeout(1500)
    F.expect(pg.evaluate("document.documentElement.dataset.grain") == "off", "grain choice survives a reload")
    pg.click("#btnStart")
    pg.wait_for_timeout(500)
    F.expect(not beat_visible(pg), "second start skips the opening line")
    r.until(B + "S.station === 'change'", 6)
    pg.click("#btnSettings")
    pg.click('[data-grain="on"]')
    F.expect(lens_has_noise(pg), "grain back on restores the noise layer")


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
            first_run(r)
            sit_is_safe(r)
            grain_toggle(r)
            second_run(r, port)
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
