"""Measure frame rate and WebGL renderer string under different Chromium GPU flags."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flow  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

VARIANTS = {
    "d3d11-stub": ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-webgl"],
}

AUDIO_STUB = """
(() => {
  const Off = window.OfflineAudioContext;
  function Fake() {
    const c = new Off(2, 44100 * 2, 44100);
    c.resume = () => Promise.resolve();
    return c;
  }
  window.AudioContext = Fake;
  window.webkitAudioContext = Fake;
})();
"""

FPS_JS = """new Promise(res => {
  let n = 0;
  const s = performance.now();
  function f() {
    n++;
    if (performance.now() - s < 2000) {
      requestAnimationFrame(f);
    } else {
      res(n / 2);
    }
  }
  requestAnimationFrame(f);
})"""

GL_JS = """(() => {
  const c = document.createElement('canvas');
  const g = c.getContext('webgl2') || c.getContext('webgl');
  if (!g) return 'none';
  const e = g.getExtension('WEBGL_debug_renderer_info');
  return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER);
})()"""

port = flow.serve()
with sync_playwright() as p:
    for name, args in VARIANTS.items():
        for headless in [True]:
            try:
                b = p.chromium.launch(args=args + ["--autoplay-policy=no-user-gesture-required"], headless=headless)
                pg = b.new_page(viewport={"width": 1280, "height": 800})
                pg.add_init_script(AUDIO_STUB)
                pg.on("console", lambda m: print("console", m.type, m.text[:150], flush=True) if m.type == "error" else None)
                pg.goto(f"http://127.0.0.1:{port}/index.html")
                pg.wait_for_timeout(2500)
                print(name, "renderer:", pg.evaluate(GL_JS), flush=True)
                pg.click("#btnStart")
                pg.wait_for_timeout(1500)
                print(name, "fps:", pg.evaluate(FPS_JS), flush=True)
                b.close()
            except Exception as e:  # noqa: BLE001
                print(name, "ERR", repr(e)[:200], flush=True)
os._exit(0)
