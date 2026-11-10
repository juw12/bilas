"""Project the wall notes and the changer to screen pixels at the change station."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "tests"))
import flow as F  # noqa: E402

RECTS = """
(function () {
  const W = window.BilasWorld;
  const T = window.THREE;
  const cam = W.camera;
  const canvas = W.renderer.domElement.getBoundingClientRect();
  function rectOf(obj) {
    obj.updateWorldMatrix(true, true);
    const box = new T.Box3().setFromObject(obj);
    const xs = [];
    const ys = [];
    [box.min.x, box.max.x].forEach(function (x) {
      [box.min.y, box.max.y].forEach(function (y) {
        [box.min.z, box.max.z].forEach(function (z) {
          const v = new T.Vector3(x, y, z).project(cam);
          xs.push((v.x + 1) / 2 * canvas.width);
          ys.push((1 - v.y) / 2 * canvas.height);
        });
      });
    });
    return [Math.round(Math.min.apply(null, xs)), Math.round(Math.min.apply(null, ys)),
            Math.round(Math.max.apply(null, xs)), Math.round(Math.max.apply(null, ys))];
  }
  return JSON.stringify({
    posters: W.posters.map(rectOf),
    changer: rectOf(W.changer.group),
    canvas: [canvas.width, canvas.height]
  });
})()
"""


def main():
    port = F.serve()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(args=F.ARGS)
        page = browser.new_page(viewport={"width": F.WIDTH, "height": F.HEIGHT})
        page.add_init_script(F.AUDIO_STUB)
        page.add_init_script("try { localStorage.setItem('bilas.beat', '1'); localStorage.setItem('beat', '1'); } catch (e) {}")
        page.goto(f"http://127.0.0.1:{port}/index.html")
        page.wait_for_timeout(1500)
        r = F.Run(page)
        page.click("#btnStart")
        r.until(F.B + "S.station === 'change'", 10)
        r.until(F.B + "idle()", 15)
        page.wait_for_timeout(1200)
        print("RECTS " + page.evaluate(RECTS), flush=True)
        tag = sys.argv[1] if len(sys.argv) > 1 else "probe"
        r.shot("p-change")
        browser.close()
    os._exit(0)


if __name__ == "__main__":
    main()
