"""Fold framing probe: does the whole shirt stay on screen (and clear of the HUD) while it folds?

Runs the real flow up to the fold table, then samples the shirt's projected bounding box every
~60 ms through the lay, smooth and L/R/B folds of the first shirt.

Usage: python tests/foldframe.py <tag> [width] [height]
Prints one JSON line starting with FRAME.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flow  # noqa: E402  (flow reads tag/width/height from sys.argv)

from playwright.sync_api import sync_playwright  # noqa: E402

BOX_JS = """
(() => {
  const B = window.__bilas;
  const W = window.BilasWorld;
  const s = B.S.table.shirt;
  if (!s) {
    return null;
  }
  const box = new THREE.Box3().setFromObject(s.obj.root);
  const w = window.innerWidth;
  const h = window.innerHeight;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const cx of [box.min.x, box.max.x]) {
    for (const cy of [box.min.y, box.max.y]) {
      for (const cz of [box.min.z, box.max.z]) {
        const v = new THREE.Vector3(cx, cy, cz).project(W.camera);
        const px = (v.x + 1) / 2 * w;
        const py = (1 - v.y) / 2 * h;
        x0 = Math.min(x0, px);
        x1 = Math.max(x1, px);
        y0 = Math.min(y0, py);
        y1 = Math.max(y1, py);
      }
    }
  }
  const bottom = document.querySelector('.bottom').getBoundingClientRect().top;
  let topUi = 0;
  for (const el of document.querySelectorAll('header, .top, #hint, .hud-top')) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.top < h / 3) {
      topUi = Math.max(topUi, r.bottom);
    }
  }
  return { step: B.S.table.step, folding: B.S.table.folding, x0, y0, x1, y1, w, h, bottom, topUi };
})()
"""


def sample(r, samples, ms=1600):
    end = ms
    while end > 0:
        b = r.js(BOX_JS)
        if b:
            samples.append(b)
        r.page.wait_for_timeout(60)
        end -= 60


def main():
    port = flow.serve()
    samples = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=flow.ARGS)
        page = browser.new_page(viewport={"width": flow.WIDTH, "height": flow.HEIGHT})
        page.add_init_script(flow.AUDIO_STUB)
        page.goto(f"http://127.0.0.1:{port}/index.html")
        page.wait_for_timeout(1500)
        r = flow.Run(page)
        for ph in [flow.phase_change, flow.phase_wash, flow.phase_dry, flow.phase_hang]:
            ph(r)
        r.station("fold")
        r.tap("basket", settle=False)
        sample(r, samples, 1500)
        r.until(flow.B + "S.table.step === 'smooth'")
        r.wait_idle()
        r.shot("f0-smooth")
        for _ in range(6):
            if r.js(flow.B + "S.table.step") != "smooth":
                break
            r.scrub("tablePoint", [-0.2, -0.12, -0.04, 0.04, 0.12, 0.2], [0.2, 0.12, 0.04, -0.04, -0.12, -0.2])
        for k, nxt in enumerate(["R", "B", "done"]):
            r.wait_idle()
            r.tap("tablePoint:0,0", settle=False)
            page.wait_for_timeout(250)
            r.shot(f"f{k + 1}-mid")
            sample(r, samples, 1400)
        browser.close()
    samples = [s for s in samples if s["step"] in ("smooth", "L", "R", "B")]
    (flow.OUT / "frame.json").write_text(json.dumps(samples))
    worst = {
        "minX": min(s["x0"] for s in samples),
        "maxX": max(s["x1"] - s["w"] for s in samples),
        "minY": min(s["y0"] - s["topUi"] for s in samples),
        "maxY": max(s["y1"] - s["bottom"] for s in samples),
    }
    ok = worst["minX"] >= 0 and worst["maxX"] <= 0 and worst["minY"] >= 0 and worst["maxY"] <= 0
    print("FRAME " + json.dumps({"size": f"{flow.WIDTH}x{flow.HEIGHT}", "n": len(samples), "worst": worst, "ok": ok, "first": samples[:1], "last": samples[-1:]}), flush=True)


if __name__ == "__main__":
    main()
