"""Quick look at the fold table: drops one shirt flat on the table and shoots each fold stage.

Not a gate - a fast visual probe for cloth shading work.
Usage: python hone/r8/foldlook.py <tag> [width] [height]
"""
import sys
from pathlib import Path

TESTS = Path(__file__).resolve().parents[2] / "tests"
sys.path.insert(0, str(TESTS))
import flow  # noqa: E402

from playwright.sync_api import sync_playwright  # noqa: E402

SETUP_JS = """
(() => {
  const B = window.__bilas;
  const W = window.BilasWorld;
  const SH = window.BilasShirts;
  document.getElementById('btnStart').click();
  const spec = { color: SH.COLORS[%d], pattern: '%s' };
  const shirt = SH.create(spec);
  shirt.setMode('flat');
  shirt.setDrape('table');
  W.scene.add(shirt.root);
  shirt.root.position.copy(W.tableSpot);
  shirt.root.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.02));
  window.__probeShirt = shirt;
  setTimeout(() => B.go('fold'), 300);
  return true;
})()
"""


def main():
    port = flow.serve()
    color = int(sys.argv[4]) if len(sys.argv) > 4 else 5
    pattern = sys.argv[5] if len(sys.argv) > 5 else "plain"
    with sync_playwright() as p:
        browser = p.chromium.launch(args=flow.ARGS)
        page = browser.new_page(viewport={"width": flow.WIDTH, "height": flow.HEIGHT})
        page.add_init_script(flow.AUDIO_STUB)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(f"http://127.0.0.1:{port}/index.html")
        page.wait_for_timeout(1500)
        page.evaluate(SETUP_JS % (color, pattern))
        page.wait_for_timeout(2500)
        page.screenshot(path=str(flow.OUT / "a-flat.png"))
        for name, which in [("b-left", "L"), ("c-right", "R")]:
            for k in range(1, 11):
                page.evaluate(f"window.__probeShirt.foldAmount('{which}', {k / 10})")
                page.wait_for_timeout(30)
            if hasattr(sys.modules[__name__], "noop"):
                pass
            page.evaluate(f"window.__probeShirt.foldDone && window.__probeShirt.foldDone('{which}')")
            page.wait_for_timeout(600)
            page.screenshot(path=str(flow.OUT / f"{name}.png"))
        page.evaluate("window.__probeShirt.foldAmount('R', 0.5)")
        page.wait_for_timeout(400)
        page.screenshot(path=str(flow.OUT / "d-right-mid.png"))
        browser.close()
    print("LOOK", flow.OUT, errors[:5], flush=True)


if __name__ == "__main__":
    main()
