"""G1 (file://), G4 layout, G6 i18n/themes/contrast, G7 no-WebGL. Prints RESULT json."""
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flow  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = flow.ROOT
OUT = ROOT / "hone" / "shots" / (sys.argv[1] if len(sys.argv) > 1 else "gates")
OUT.mkdir(parents=True, exist_ok=True)
WIDTHS = [(320, 640), (390, 844), (768, 1024), (1024, 768), (1440, 900)]
RES = {}

LAYOUT_JS = """() => {
  const vw = document.documentElement.clientWidth;
  const out = { overflowX: document.documentElement.scrollWidth > vw + 1, offenders: [], small: [], clipped: [] };
  const vis = el => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !el.closest('[hidden]');
  };
  document.querySelectorAll('body *').forEach(el => {
    if (!vis(el) || el.id === 'scene') return;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) out.offenders.push((el.id || el.className || el.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  document.querySelectorAll('button, [role=button], input, select').forEach(el => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) out.small.push((el.id || el.dataset.st || el.textContent.trim().slice(0, 12) || el.className) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  document.querySelectorAll('.hint, .stations button span, .load-title, .brand, .purse, .ticket').forEach(el => {
    if (!vis(el)) return;
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') out.clipped.push(el.className + ':' + el.textContent.trim().slice(0, 20));
  });
  return out;
}"""

CONTRAST_JS = """() => {
  function parse(c) {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map(x => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function bgOf(el) {
    let e = el;
    while (e) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0.5) return c;
      e = e.parentElement;
    }
    return null;
  }
  const bad = [];
  let checked = 0;
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('[hidden]')) return;
    const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) return;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return;
    const fg = parse(s.color);
    const bg = bgOf(el);
    if (!fg || !bg) return;
    checked++;
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && parseInt(s.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) bad.push(el.textContent.trim().slice(0, 24) + ' ' + ratio.toFixed(2));
  });
  return { checked: checked, bad: bad };
}"""


def new_page(browser, w, h, url, stub=True):
    pg = browser.new_page(viewport={"width": w, "height": h})
    if stub:
        pg.add_init_script(flow.AUDIO_STUB)
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    pg.goto(url)
    pg.wait_for_timeout(1500)
    return pg, errs


def main():
    port = flow.serve()
    http = f"http://127.0.0.1:{port}/index.html"
    with sync_playwright() as p:
        browser = p.chromium.launch(args=flow.ARGS)

        # G4 layout at five widths, intro and in-scene
        g4 = {}
        for w, h in WIDTHS:
            pg, errs = new_page(browser, w, h, http)
            intro = pg.evaluate(LAYOUT_JS)
            pg.click("#btnStart")
            pg.wait_for_timeout(2500)
            pg.click('#stations button[data-st="wash"]')
            pg.wait_for_timeout(1800)
            scene = pg.evaluate(LAYOUT_JS)
            pg.screenshot(path=str(OUT / f"w{w}.png"))
            pg.click("#btnSettings")
            pg.wait_for_timeout(400)
            settings = pg.evaluate(LAYOUT_JS)
            pg.screenshot(path=str(OUT / f"w{w}-settings.png"))
            g4[f"{w}x{h}"] = {"intro": intro, "scene": scene, "settings": settings, "errors": errs[:5]}
            pg.close()
        RES["G4"] = g4

        # G6 i18n parity + both themes contrast
        pg, errs = new_page(browser, 1280, 800, http)
        parity = pg.evaluate("""() => {
          const d = window.BilasI18n && (window.BilasI18n.dict || window.BilasI18n.STR || window.BilasI18n);
          const langs = d && d.en && d.id ? d : null;
          if (!langs) return { error: 'dict not found', keys: Object.keys(window.BilasI18n || {}) };
          const en = Object.keys(langs.en), id = Object.keys(langs.id);
          return { en: en.length, id: id.length, missingId: en.filter(k => !(k in langs.id)), missingEn: id.filter(k => !(k in langs.en)),
                   emptyId: id.filter(k => !String(langs.id[k]).trim()) };
        }""")
        contrast = {}
        for theme in ["night", "day"]:
            pg.evaluate(f"document.documentElement.dataset.theme = '{theme}'")
            pg.wait_for_timeout(300)
            contrast[theme + "-intro"] = pg.evaluate(CONTRAST_JS)
        pg.click("#btnStart")
        pg.wait_for_timeout(2500)
        for theme in ["night", "day"]:
            pg.evaluate(f"document.documentElement.dataset.theme = '{theme}'")
            pg.wait_for_timeout(300)
            contrast[theme + "-scene"] = pg.evaluate(CONTRAST_JS)
            pg.screenshot(path=str(OUT / f"theme-{theme}.png"))
        # Indonesian: no English leftovers in visible HUD
        pg.click("#btnSettings")
        pg.wait_for_timeout(300)
        pg.click('button[data-lang="id"]')
        pg.wait_for_timeout(500)
        id_text = pg.evaluate("document.body.innerText")
        pg.screenshot(path=str(OUT / "lang-id.png"))
        RES["G6"] = {"parity": parity, "contrast": contrast, "idSample": id_text[:400], "errors": errs[:5]}
        pg.close()

        # G1 file:// mode
        pg, errs = new_page(browser, 1280, 800, (ROOT / "index.html").as_uri())
        pg.click("#btnStart")
        pg.wait_for_timeout(2500)
        pg.click('#stations button[data-st="dry"]')
        pg.wait_for_timeout(1500)
        started = pg.evaluate("window.__bilas && window.__bilas.S && window.__bilas.S.started")
        pg.screenshot(path=str(OUT / "file-mode.png"))
        RES["G1file"] = {"started": started, "errors": errs[:10]}
        pg.close()
        browser.close()

        # G7 no WebGL
        nogl = p.chromium.launch(args=["--disable-webgl", "--disable-3d-apis", "--disable-gpu"])
        pg, errs = new_page(nogl, 390, 844, http)
        msg = pg.evaluate("(() => { const n = document.getElementById('nogl'); return n && !n.hidden ? n.innerText : null; })()")
        pg.screenshot(path=str(OUT / "nogl.png"))
        RES["G7"] = {"message": msg, "errors": errs[:5]}
        nogl.close()

    print("RESULT " + json.dumps(RES), flush=True)
    os._exit(0)


if __name__ == "__main__":
    main()
