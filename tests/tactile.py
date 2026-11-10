"""Tactile machine parts and readable wall notes.

- The Start button travels and springs back (the coin plate's give is checked in flow.py).
- Coins landing in the change tray rock it; scooping them rakes them forward first.
- On a phone in portrait the four wall notes sit fully on screen, left of the changer, larger than on desktop.
- Tapping a wall note lifts it into a readable paper card; a tap puts it back.

Usage: python tests/tactile.py [tag] [width] [height]
"""
import json
import os
import sys

sys.argv = [sys.argv[0]] + sys.argv[1:]
import flow as F  # noqa: E402  (shares the server, audio stub and Run helpers)

B = F.B

# Record the extremes of a few moving parts on every animation frame.
SAMPLER = """
(function () {
  const W = window.BilasWorld;
  const rec = { startMin: 1, plateMin: 1, trayMax: 0 };
  window.__tactile = rec;
  function tick() {
    rec.startMin = Math.min(rec.startMin, W.washer.start.position.z);
    rec.plateMin = Math.min(rec.plateMin, W.washer.slotPlate.position.z);
    rec.trayMax = Math.max(rec.trayMax, Math.abs(W.changer.tray.rotation.x));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return true;
})()
"""

NOTE_RECTS = """
(function () {
  const W = window.BilasWorld;
  const T = window.THREE;
  const cam = W.camera;
  const r = W.renderer.domElement.getBoundingClientRect();
  function rectOf(obj) {
    obj.updateWorldMatrix(true, true);
    const box = new T.Box3().setFromObject(obj);
    const xs = [];
    const ys = [];
    [box.min.x, box.max.x].forEach(function (x) {
      [box.min.y, box.max.y].forEach(function (y) {
        const v = new T.Vector3(x, y, box.max.z).project(cam);
        xs.push((v.x + 1) / 2 * r.width);
        ys.push((1 - v.y) / 2 * r.height);
      });
    });
    return { l: Math.min.apply(null, xs), t: Math.min.apply(null, ys), r: Math.max.apply(null, xs), b: Math.max.apply(null, ys) };
  }
  return JSON.stringify({
    notes: W.posters.map(rectOf),
    changerFace: rectOf(W.changer.tray),
    compact: !!W.compact,
    scale: W.posters.map(function (p) { return p.scale.x; })
  });
})()
"""


def notes_layout(r):
    r.station("change")
    r.page.wait_for_timeout(400)
    info = json.loads(r.js(NOTE_RECTS))
    phone = F.WIDTH / F.HEIGHT < 0.75
    F.expect(info["compact"] == phone, f"compact notes {'on' if phone else 'off'} at {F.WIDTH}x{F.HEIGHT}")
    if phone:
        on_screen = all(n["l"] >= -1 and n["r"] <= F.WIDTH + 1 for n in info["notes"])
        F.expect(on_screen, "all four wall notes fully on screen at the changer")
        F.expect(min(info["scale"][1:]) >= 1.3, "pinned notes are enlarged on phone")
        widths = [round(n["r"] - n["l"]) for n in info["notes"]]
        F.note(f"note widths px {widths}")
    return info


def read_a_note(r, info):
    pg = r.page
    target = info["notes"][1]
    x = (target["l"] + target["r"]) / 2
    y = (target["t"] + target["b"]) / 2
    pg.mouse.click(x, y)
    pg.wait_for_timeout(500)
    shown = r.js("!document.getElementById('notecard').hidden")
    F.expect(shown, "tapping a wall note lifts it into a card")
    title = r.js("document.querySelector('#notecard .nc-t').textContent")
    expected = r.js("window.BilasWorld.posters[1].userData.lines()[0]")
    F.expect(title == expected, f"note card shows the note's own text ({title})")
    size = r.js("parseFloat(getComputedStyle(document.querySelector('#notecard .nc-b')).fontSize)")
    F.expect(size >= 16, f"note body is readable size ({size}px)")
    r.shot("t1-note")
    pg.mouse.click(F.WIDTH * 0.5, F.HEIGHT * 0.5)
    pg.wait_for_timeout(300)
    F.expect(r.js("document.getElementById('notecard').hidden"), "a tap puts the note back")
    F.expect(r.js(B + "S.trayCoins") == 0, "tapping to close the note did not feed the changer")


def tray_physics(r):
    r.js(SAMPLER)
    r.tap("bill", settle=False)
    r.until(B + "S.trayCoins === 4", 10)
    r.page.wait_for_timeout(400)
    tray = r.js("window.__tactile.trayMax")
    F.expect(tray > 0.01, f"landing coins rock the tray ({tray:.3f} rad)")
    r.shot("t2-tray")
    r.tap("tray")
    F.expect(r.counts()["purse"] == 4, "scooped 4 coins")


def button_travel(r):
    r.station("wash")
    rest = r.js("window.BilasWorld.washer.start.position.z")
    r.tap("washerStart")
    r.page.wait_for_timeout(500)
    low = r.js("window.__tactile.startMin")
    back = r.js("window.BilasWorld.washer.start.position.z")
    F.expect(rest - low > 0.007, f"start button travels {1000 * (rest - low):.1f} mm")
    F.expect(abs(back - rest) < 0.0005, "start button springs back to rest")
    # the coin plate's give is checked in tests/flow.py, where real coins go through the slot


def main():
    port = F.serve()
    errors = []
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(args=F.ARGS)
        page = browser.new_page(viewport={"width": F.WIDTH, "height": F.HEIGHT})
        page.add_init_script(F.AUDIO_STUB)
        page.add_init_script("try { localStorage.setItem('bilas.beat', '1'); } catch (e) {}")
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
        page.goto(f"http://127.0.0.1:{port}/index.html")
        page.wait_for_timeout(1500)
        r = F.Run(page)
        try:
            page.click("#btnStart")
            r.wait_idle()
            info = notes_layout(r)
            read_a_note(r, info)
            tray_physics(r)
            button_travel(r)
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
