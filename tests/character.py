"""Machine character, diegetic cues and physical feedback (r15).

- Each machine wears its own maker's plate; doors, corners and coin slots carry wear decals.
- A worn yellow sticker sits between coin slot and Start, a taped card shows the folds,
  dryers carry a lint pictogram; the ghost finger only appears as a late fallback.
- Coins clinking in the tray or slot flash a glint and give the view a tiny jolt.
- Pouring soap draws a stream from the bottle mouth down to the drawer cup.
- Shirts dropping into the water splash it, and a loaded drum stands higher.

Usage: python tests/character.py [tag] [width] [height]
"""
import json
import os
import sys

sys.argv = [sys.argv[0]] + sys.argv[1:]
import flow as F  # noqa: E402

B = F.B

SCENE = """
(function () {
  const W = window.BilasWorld;
  const T = window.THREE;
  const ms = [W.washerBg, W.washer, W.dryer, W.dryerTop];
  function local(m, o) {
    return m.group.worldToLocal(o.getWorldPosition(new T.Vector3()));
  }
  const arrow = local(W.washer, W.washer.coinArrow);
  const slot = W.washer.group.worldToLocal(W.washer.slotWorld());
  const start = local(W.washer, W.washer.start);
  return JSON.stringify({
    brands: ms.map(function (m) { return m.brand; }),
    wear: ms.map(function (m) { return (m.wear || []).length; }),
    arrows: ms.map(function (m) { return !!m.coinArrow; }),
    arrowX: arrow.x, slotX: slot.x, startX: start.x,
    lint: [!!W.dryer.lintNote, !!W.dryerTop.lintNote, !!W.washer.lintNote],
    card: !!W.foldCard,
    passAll: ms.every(function (m) { return m.wear.every(function (d) { return d.userData.pass; }) && m.coinArrow.userData.pass; })
  });
})()
"""

SAMPLER = """
(function () {
  const W = window.BilasWorld;
  const rec = { streamMax: 0, streamSeen: 0, topAboveCup: 1, splashMax: 0, levelMax: -9 };
  window.__char = rec;
  function tick() {
    const fx = W.pourFx;
    if (fx.on && fx.len > 0) {
      rec.streamSeen += 1;
      rec.streamMax = Math.max(rec.streamMax, fx.len);
      rec.topAboveCup = Math.min(rec.topAboveCup, fx.top.y - fx.cupY);
    }
    const wu = W.washer.water.material.uniforms;
    rec.splashMax = Math.max(rec.splashMax, wu.uSplash.value);
    if (window.__bilas.MS.washer.ph === "wash") {
      rec.levelMax = Math.max(rec.levelMax, wu.uLevel.value);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return true;
})()
"""


def character(r):
    info = json.loads(r.js(SCENE))
    F.note("brands " + str(info["brands"]))
    F.expect(len(set(info["brands"])) == 4, "four machines, four different maker's plates")
    F.expect(min(info["wear"]) >= 4, f"every machine carries wear decals ({info['wear']})")
    F.expect(all(info["arrows"]), "coin sticker on every machine")
    F.expect(info["slotX"] < info["arrowX"] < info["startX"], "coin sticker sits between slot and Start")
    F.expect(info["lint"] == [True, True, False], "lint pictogram on the dryers only")
    F.expect(info["card"], "fold card taped by the board")
    F.expect(info["passAll"], "decals and stickers never catch a tap")


def clink_at_changer(r):
    r.station("change")
    before = r.js("window.BilasWorld.clinkFx.count")
    r.tap("bill", settle=False)
    r.until(B + "S.trayCoins === 4", 10)
    r.page.wait_for_timeout(300)
    after = r.js("window.BilasWorld.clinkFx.count")
    F.expect(after - before >= 4, f"each coin landing in the tray clinks ({after - before})")
    F.expect(r.js("window.BilasWorld.clinkFx.peak") > 0, "the clink flashes a glint light")
    r.tap("tray")
    F.expect(r.counts()["purse"] == 4, "scooped 4 coins")


def wash(r):
    page = r.page
    r.js(SAMPLER)
    r.station("wash")
    r.wait_idle()
    r.shot("c1-washer-front")
    r.tap("washerDoor")
    r.until(B + "MS.washer.doorOpen && !" + B + "MS.washer.busy")
    for i in range(4):
        r.tap("basket", settle=False)
        r.until(B + f"MS.washer.items.length === {i + 1}")
    r.wait_idle()
    r.tap("washerDoor")
    r.until("!" + B + "MS.washer.doorOpen && !" + B + "MS.washer.busy")
    r.wait_idle()
    # the stickers carry the first-run teaching: no ghost finger after a short idle
    page.wait_for_timeout(3000)
    cue = r.js("getComputedStyle(document.getElementById('dragCue')).visibility")
    F.expect(cue == "hidden", f"ghost finger stays away after 3 s idle ({cue})")
    r.tap("soap", settle=False)
    page.wait_for_timeout(900)
    r.shot("c2-pour")
    r.until(B + "MS.washer.soap === true", 60)
    rec = r.js("window.__char")
    F.expect(rec["streamSeen"] > 3, f"pour stream drawn ({rec['streamSeen']} frames)")
    F.expect(rec["streamMax"] > 0.02, f"stream spans mouth to cup ({1000 * rec['streamMax']:.0f} mm)")
    F.expect(rec["topAboveCup"] > 0, "stream starts above the drawer cup")
    r.wait_idle()
    clinks = r.js("window.BilasWorld.clinkFx.count")
    for i in range(2):
        r.wait_idle()
        coin = r.pos("washerCoin")
        slot = r.pos("washerSlot")
        if coin and slot:
            r.drag(coin, slot)
        r.until(B + f"MS.washer.coins === {i + 1}")
    page.wait_for_timeout(300)
    F.expect(r.js("window.BilasWorld.clinkFx.count") - clinks == 2, "both coins clink at the slot")
    kick = r.js("window.BilasWorld.clinkFx.kickMax || 0")
    F.expect(0.0003 < kick < 0.006, f"slot clink jolts the view a hair ({1000 * kick:.1f} mm)")
    r.wait_idle()
    r.tap("washerStart")
    F.expect(r.js(B + "MS.washer.phase") == "run", "washer running")
    r.js(B + "ff(12)")
    r.until(B + "MS.washer.ph === 'wash'", 20)
    r.until("(" + B + "MS.washer.splashes || 0) > 0", 20)
    page.wait_for_timeout(200)
    r.shot("c3-splash")
    rec = r.js("window.__char")
    F.expect(rec["splashMax"] > 0.5, f"a shirt dropping in splashes the water ({rec['splashMax']:.2f})")
    F.expect(rec["levelMax"] > -0.2, f"the load lifts the water line ({rec['levelMax']:.2f} vs -0.25 empty)")


def fold_card(r):
    r.station("fold")
    r.wait_idle()
    r.page.wait_for_timeout(500)
    r.shot("c4-fold-card")
    r.station("dry")
    r.wait_idle()
    r.page.wait_for_timeout(500)
    r.shot("c5-dryer-front")


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
            character(r)
            clink_at_changer(r)
            wash(r)
            fold_card(r)
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
