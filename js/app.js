/* Bilas app: state, interactions, machines, camera and HUD. */
(function () {
  "use strict";
  const STR = window.BilasI18n;
  const A = window.BilasAudio;

  /* ---------- storage that never throws (file://, private mode, opaque origins) ---------- */
  const store = (function () {
    const mem = {};
    let ls = null;
    try {
      ls = window.localStorage;
      ls.getItem("bilas.test");
    } catch (e) {
      ls = null;
    }
    return {
      get: function (k) {
        try {
          return ls ? ls.getItem("bilas." + k) : (k in mem ? mem[k] : null);
        } catch (e) {
          return k in mem ? mem[k] : null;
        }
      },
      set: function (k, v) {
        mem[k] = String(v);
        try {
          if (ls) {
            ls.setItem("bilas." + k, String(v));
          }
        } catch (e) {
          /* memory only */
        }
      }
    };
  })();

  let lang = store.get("lang") || ((navigator.language || "en").toLowerCase().indexOf("id") === 0 ? "id" : "en");
  let theme = store.get("theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "day" : "night");

  function t(key, vars) {
    let s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split("{" + k + "}").join(vars[k]);
      });
    }
    return s;
  }

  const $ = function (id) {
    return document.getElementById(id);
  };

  function applyI18n() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-lang]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang));
    });
    $("btnSound").setAttribute("aria-label", t("sound"));
    $("btnSettings").setAttribute("aria-label", t("settings"));
    $("stations").setAttribute("aria-label", t("load"));
  }

  function hasWebGL() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) {
      return false;
    }
  }

  function showNoGL() {
    document.documentElement.dataset.theme = theme;
    applyI18n();
    $("intro").hidden = true;
    $("nogl").hidden = false;
    document.querySelectorAll(".brand, .top-right, .side, .bottom").forEach(function (el) {
      el.hidden = true;
    });
    window.__bilas = { nogl: true };
  }

  document.documentElement.dataset.theme = theme;
  applyI18n();

  if (!window.THREE || !hasWebGL()) {
    showNoGL();
    return;
  }

  const T = THREE;
  const W = window.BilasWorld;
  const SH = window.BilasShirts;
  const canvas = $("scene");
  try {
    W.build(canvas, t);
  } catch (e) {
    // never fail silently: a build bug must not masquerade as "no WebGL"
    console.error("Bilas world build failed:", e);
    showNoGL();
    return;
  }

  /* ---------- state ---------- */
  const S = {
    station: "overview",
    purse: 0,
    trayCoins: 0,
    changerBusy: false,
    shirts: [],
    cycle: Number(store.get("cycle")) || 45,
    loadId: 0,
    loadStart: 0,
    sitting: false,
    lint: { open: false, amount: 0, cells: new Set(), closing: false },
    table: { shirt: null, step: null, folding: false },
    line: [null, null, null, null],
    stack: [],
    started: false,
    lastInput: 0,
    toast: null,
    doneShown: false
  };

  function makeMachineState(key, parts, need) {
    return {
      key: key,
      parts: parts,
      need: need,
      doorOpen: false,
      coins: 0,
      soap: false,
      items: [],
      phase: "idle",
      ph: "",
      t: 0,
      dur: 1,
      sound: null,
      ang: 0,
      vel: 0,
      busy: false,
      lastThump: 0,
      prog: 1,
      baseX: parts.group.position.x
    };
  }

  /* ---------- program dial: four detents, clockwise = hotter / longer ---------- */
  const DIAL_ROT = [0.75 * Math.PI, 0.25 * Math.PI, -0.25 * Math.PI, -0.75 * Math.PI];
  const DIAL_LEN = [0.85, 1, 1.15, 1.3];

  function nearestDetent(rot) {
    let best = 0;
    DIAL_ROT.forEach(function (r, i) {
      if (Math.abs(r - rot) < Math.abs(DIAL_ROT[best] - rot)) {
        best = i;
      }
    });
    return best;
  }

  function cycleFor(m) {
    return (m.key === "washer" ? 1 : 0.8) * S.cycle * DIAL_LEN[m.prog];
  }

  function progLcd(m) {
    const lab = m.parts.dialLabels[m.prog];
    return lab === "+" ? "EXTRA" : lab + "\u00b0C";
  }

  function setProg(m, i, quiet) {
    const dial = m.parts.dial;
    const from = dial.rotation.z;
    const to = DIAL_ROT[i];
    const changed = m.prog !== i;
    m.prog = i;
    if (changed && !quiet) {
      // the LCD previews the new program and its cycle time for a moment
      m.progShow = performance.now() + 2200;
    }
    tween(0.16, function (k) {
      dial.rotation.z = from + (to - from) * k;
    });
    if (!quiet) {
      A.play("button", 0.55);
      if (changed) {
        const lab = m.parts.dialLabels[i];
        toast(m.key === "washer" ? "toast_dial_wash" : "toast_dial_dry", { p: lab === "+" ? t("dial_extra") : lab + "°" });
      }
    }
  }

  function turnDial(m) {
    if (m.phase === "run") {
      toast("toast_dial_locked");
      A.play("beep");
      return;
    }
    setProg(m, (m.prog + 1) % DIAL_ROT.length);
  }

  /* ---------- detergent drawer: pull it out or push it shut by hand ---------- */
  const DRAWER_OUT = 0.09;

  function setDrawer(open) {
    const m = MS.washer;
    const d = m.parts.drawer;
    const z0 = d.position.z;
    const z1 = open ? DRAWER_OUT : 0;
    m.drawerOpen = open;
    A.play(open ? "button" : "thump");
    tween(0.25, function (k) {
      d.position.z = z0 + (z1 - z0) * k;
    });
  }
  const MS = {
    washer: makeMachineState("washer", W.washer, 2),
    dryer: makeMachineState("dryer", W.dryer, 1)
  };
  [W.washer, W.dryer, W.washerBg, W.dryerTop].forEach(function (p) {
    if (p && p.dial) {
      p.dial.rotation.z = DIAL_ROT[1];
    }
  });

  W.washer.group.userData.station = "wash";
  W.washerBg.group.userData.station = "wash";
  W.dryer.group.userData.station = "dry";
  W.dryerTop.group.userData.station = "dry";
  W.changer.group.userData.station = "change";
  W.table.userData.station = "fold";

  /* ---------- tweens ---------- */
  const tweens = [];

  function easeInOut(k) {
    return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  }

  function easeOutBack(k) {
    const c = 1.4;
    return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
  }

  function tween(dur, fn, done, easing) {
    const tw = { t: 0, dur: dur, fn: fn, done: done, easing: easing || easeInOut };
    tweens.push(tw);
    return tw;
  }

  function later(sec, fn) {
    return tween(sec, function () {}, fn, function (k) {
      return k;
    });
  }

  function stepTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (!tw) {
        continue;
      }
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.easing(k), k);
      if (k >= 1) {
        const idx = tweens.indexOf(tw);
        if (idx >= 0) {
          tweens.splice(idx, 1);
        }
        if (tw.done) {
          tw.done();
        }
      }
    }
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  /* ---------- shirts ---------- */
  const BASKET_SLOTS = [
    [-0.08, 0.0, 0.04],
    [0.08, 0.01, -0.03],
    [0.0, 0.05, -0.05],
    [-0.06, 0.07, -0.02],
    [0.07, 0.08, 0.05],
    [0.0, 0.11, 0.02],
    [-0.09, 0.12, 0.06],
    [0.09, 0.13, -0.06]
  ];

  function tint(s) {
    if (s.state === "dirty") {
      s.obj.mat.color.set("#cfc8bb");
      s.obj.crumpleMat.color.set("#cfc8bb");
    } else if (s.state === "wet") {
      s.obj.setWet(1);
    } else {
      s.obj.setWet(0);
    }
  }

  function newLoad() {
    S.loadId += 1;
    S.loadStart = performance.now();
    S.doneShown = false;
    S.receipt = { washer: 0, dryer: 0, line: 0 };
    SH.randomSpecs(4).forEach(function (spec, i) {
      const obj = SH.create(spec);
      const rec = { id: S.loadId + "-" + i, load: S.loadId, spec: spec, obj: obj, state: "dirty", loc: "basket", tumble: null, hang: null };
      obj.root.userData.shirt = rec;
      tint(rec);
      W.basket.items.add(obj.root);
      S.shirts.push(rec);
    });
    layoutBasket();
  }

  function basketShirts() {
    return S.shirts.filter(function (s) {
      return s.loc === "basket";
    });
  }

  function basketCounts() {
    const c = { dirty: 0, wet: 0, dry: 0 };
    basketShirts().forEach(function (s) {
      if (c[s.state] !== undefined) {
        c[s.state] += 1;
      }
    });
    return c;
  }

  function layoutBasket() {
    basketShirts().forEach(function (s, i) {
      const r = s.obj.root;
      if (r.parent !== W.basket.items) {
        return;
      }
      const p = BASKET_SLOTS[i % BASKET_SLOTS.length];
      r.position.set(p[0], p[1], p[2]);
      r.rotation.set(0.2, i * 1.3, 0.1);
      r.scale.setScalar(0.85);
    });
  }

  /* Move a shirt to a parent with an arc; target is recomputed every frame so a moving camera is fine. */
  function fly(s, parent, pos, quat, scale, dur, lift, done) {
    const root = s.obj.root;
    W.scene.attach(root);
    const p0 = root.position.clone();
    const q0 = root.quaternion.clone();
    const s0 = root.scale.x;
    const p1 = new T.Vector3();
    const pq = new T.Quaternion();
    const q1 = new T.Quaternion();
    const ws = new T.Vector3();
    s.flying = true;
    tween(dur, function (k) {
      parent.updateWorldMatrix(true, false);
      p1.copy(pos);
      parent.localToWorld(p1);
      parent.getWorldQuaternion(pq);
      q1.copy(pq).multiply(quat);
      parent.getWorldScale(ws);
      root.position.lerpVectors(p0, p1, k);
      root.position.y += Math.sin(k * Math.PI) * lift;
      root.quaternion.slerpQuaternions(q0, q1, k);
      root.scale.setScalar(s0 + (scale * ws.x - s0) * k);
    }, function () {
      parent.attach(root);
      root.position.copy(pos);
      root.quaternion.copy(quat);
      root.scale.setScalar(scale);
      s.flying = false;
      if (done) {
        done();
      }
    });
  }

  function toBasket(s, after) {
    s.loc = "basket";
    s.obj.setMode("crumple");
    const i = basketShirts().length - 1;
    const p = BASKET_SLOTS[i % BASKET_SLOTS.length];
    const q = new T.Quaternion().setFromEuler(new T.Euler(0.2, i * 1.3, 0.1));
    fly(s, W.basket.items, new T.Vector3(p[0], p[1], p[2]), q, 0.85, 0.55, 0.1, function () {
      layoutBasket();
      if (after) {
        after();
      }
    });
  }

  /* ---------- HUD helpers ---------- */
  const hintEl = $("hint");

  function toast(key, vars) {
    S.toast = { text: t(key, vars), until: performance.now() + 2600 };
    hintEl.classList.remove("nudge");
    void hintEl.offsetWidth;
    hintEl.classList.add("nudge");
    updateHUD();
  }

  function bumpPurse() {
    const p = $("purse");
    p.classList.remove("bump");
    void p.offsetWidth;
    p.classList.add("bump");
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  /* ---------- changer ---------- */
  const C = W.changer;
  C.bill.rotation.x = -Math.PI / 2 + 0.25;

  function feedNote() {
    if (S.changerBusy) {
      return;
    }
    if (S.trayCoins >= 8) {
      toast("h_collect");
      return;
    }
    S.changerBusy = true;
    C.bill.visible = true;
    C.bill.position.set(0, 1.085, 0.2);
    A.play("billFeed");
    tween(1.0, function (k) {
      C.bill.position.z = 0.2 - 0.2 * k;
      C.led.material.color.set(Math.sin(k * 30) > 0 ? "#6fe39a" : "#2c5a3c");
    }, function () {
      C.bill.visible = false;
      C.led.material.color.set("#6fe39a");
      for (let i = 0; i < 4; i++) {
        dropTrayCoin(i);
      }
      later(1.1, function () {
        S.trayCoins += 4;
        S.changerBusy = false;
        updateHUD();
      });
    });
  }

  function dropTrayCoin(i) {
    later(0.25 + i * 0.2, function () {
      const coin = W.makeCoin();
      const n = C.coins.length;
      const rest = new T.Vector3(-0.05 + (n % 4) * 0.033, -0.024 + Math.floor(n / 4) * 0.003, 0.045 + ((n * 37) % 5) * 0.006);
      coin.position.set(0, 0.06, 0.01);
      coin.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3));
      C.tray.add(coin);
      C.coins.push(coin);
      const start = coin.position.clone();
      tween(0.32, function (k) {
        coin.position.lerpVectors(start, rest, k);
      }, function () {
        A.play("coinDrop");
        coin.rotation.set(0, rand(0, 3), 0);
      }, function (k) {
        return k * k;
      });
    });
  }

  function collectCoins() {
    if (S.trayCoins === 0) {
      if (!S.changerBusy) {
        toast("h_feed");
      }
      return;
    }
    A.play("coinScoop");
    const coins = C.coins.splice(0);
    coins.forEach(function (c) {
      const p0 = c.position.clone();
      tween(0.45, function (k) {
        c.position.set(p0.x * (1 - k), p0.y + 0.08 * k, p0.z + 0.25 * k);
        c.scale.setScalar(1 - k * 0.8);
      }, function () {
        C.tray.remove(c);
      });
    });
    S.purse += S.trayCoins;
    S.trayCoins = 0;
    bumpPurse();
    updateHUD();
  }

  /* ---------- washer / dryer ---------- */
  const Q_IDENT = new T.Quaternion();

  function setDoor(m, open, cb) {
    if (m.doorOpen === open) {
      if (cb) {
        cb();
      }
      return;
    }
    if (m.phase === "run") {
      toast("toast_locked");
      A.play("beep");
      return;
    }
    if (m.busy) {
      return;
    }
    m.doorOpen = open;
    m.busy = true;
    A.play(open ? "doorOpen" : "doorClose");
    // a warm breath of vapour when you open the dryer on a finished load
    if (open && m.key === "dryer" && m.phase === "done") {
      W.puff(m.parts.group.localToWorld(new T.Vector3(0, m.parts.cy, 0.08)), 12);
    }
    const h = m.parts.hinge;
    const a0 = h.rotation.y;
    const a1 = open ? -1.95 : 0;
    tween(open ? 0.6 : 0.42, function (k) {
      h.rotation.y = a0 + (a1 - a0) * k;
    }, function () {
      m.busy = false;
      if (cb) {
        cb();
      }
    }, open ? easeInOut : function (k) {
      return k * k;
    });
  }

  function loadInto(m, wantState) {
    if (m.phase === "run") {
      toast("toast_locked");
      return;
    }
    if (m.phase === "done" && m.items.length) {
      toast(m.key === "washer" ? "h_unload" : "h_unload", { n: m.items.length });
      return;
    }
    if (m.items.length >= 6) {
      return;
    }
    const s = basketShirts().find(function (x) {
      return x.state === wantState && !x.flying;
    });
    if (!s) {
      toast(wantState === "dirty" ? "toast_no_dirty" : "toast_no_wet");
      return;
    }
    loadThis(m, s);
  }

  // load one specific shirt (a tap picks the next one; a drag hands over the one in your hand)
  function loadThis(m, s) {
    if (m.phase === "run" || m.items.length >= 6 || (m.phase === "done" && m.items.length)) {
      return false;
    }
    if (m.busy) {
      later(0.25, function () {
        loadThis(m, s);
      });
      return true;
    }
    const go = function () {
      s.loc = m.key;
      m.items.push(s);
      s.tumble = { phi: rand(-0.6, 0.6), r: rand(0.04, 0.1), z: rand(-0.07, 0.06), spin: rand(-1.2, 1.2), falling: false, k: rand(-0.3, 0.4) };
      const q = new T.Quaternion().setFromEuler(new T.Euler(rand(0, 3), rand(0, 3), rand(0, 3)));
      const pos = new T.Vector3(Math.sin(s.tumble.phi) * s.tumble.r, -Math.cos(s.tumble.phi) * s.tumble.r, s.tumble.z);
      A.play("clothIn");
      fly(s, m.parts.clothes, pos, q, 0.72, 0.55, 0.12);
      layoutBasket();
    };
    if (m.phase === "done") {
      m.phase = "idle";
    }
    if (!m.doorOpen) {
      setDoor(m, true, go);
    } else {
      go();
    }
    return true;
  }

  function unload(m) {
    if (m.phase === "run") {
      toast("toast_locked");
      return;
    }
    if (!m.doorOpen) {
      setDoor(m, true);
      return;
    }
    const s = m.items.find(function (x) {
      return !x.flying;
    });
    if (!s) {
      if (!m.items.length) {
        toast("toast_empty");
      }
      return;
    }
    m.items.splice(m.items.indexOf(s), 1);
    A.play("clothOut");
    if (s.state === "wet") {
      later(0.5, function () {
        A.play("wetSlap");
      });
    }
    toBasket(s);
    if (!m.items.length && m.phase === "done") {
      m.phase = "idle";
      m.soap = false;
    }
  }

  // detergent
  const stream = new T.Mesh(new T.CylinderGeometry(0.004, 0.003, 0.06, 6), new T.MeshStandardMaterial({ color: "#7fc0b3", transparent: true, opacity: 0.8 }));
  stream.position.set(-0.17, 0.69, 0.1);
  stream.visible = false;
  stream.userData.pass = true;
  W.washer.group.add(stream);

  function addSoap() {
    const m = MS.washer;
    if (m.soap || m.busy || m.phase === "run") {
      return;
    }
    m.busy = true;
    const b = m.parts.bottle;
    const d = m.parts.drawer;
    const home = m.parts.bottleHome.clone();
    const pour = new T.Vector3(-0.01, 0.77, 0.1);
    A.play("button");
    tween(0.35, function (k) {
      d.position.z = 0.09 * k;
    });
    tween(0.6, function (k) {
      b.position.lerpVectors(home, pour, k);
      b.position.y += Math.sin(k * Math.PI) * 0.06;
      b.rotation.z = 1.9 * k;
    }, function () {
      A.play("pour");
      stream.visible = true;
      tween(1.3, function (k) {
        stream.scale.set(1, 0.6 + 0.4 * Math.sin(k * 40), 1);
      }, function () {
        stream.visible = false;
        tween(0.6, function (k) {
          b.position.lerpVectors(pour, home, k);
          b.rotation.z = 1.9 * (1 - k);
        }, function () {
          tween(0.3, function (k) {
            d.position.z = 0.09 * (1 - k);
          }, function () {
            A.play("button");
            m.soap = true;
            m.busy = false;
            updateHUD();
          });
        });
      });
    });
  }

  /* Pour by hand: pick the bottle up, carry it over the drawer and it tips and pours while you hold it there.
     The cup fills over about 2 s of pouring; let go early and it remembers how full it is. */
  const POUR_AT = new T.Vector3(-0.01, 0.77, 0.1);
  const POUR_RANGE = 0.075;
  const POUR_TIME = 2.0;
  const pourPlane = new T.Plane();
  const pourTmp = new T.Vector3();

  function canPour() {
    const m = MS.washer;
    return !(m.soap || m.busy || m.phase === "run");
  }

  function startPourDrag() {
    const m = MS.washer;
    const b = m.parts.bottle;
    const n = new T.Vector3(0, 0, 1).applyQuaternion(W.washer.group.getWorldQuaternion(new T.Quaternion()));
    pourPlane.setFromNormalAndCoplanarPoint(n, W.washer.group.localToWorld(POUR_AT.clone()));
    m.soapFill = m.soapFill || 0;
    return { kind: "pour", started: false, lastSound: -9, home: m.parts.bottleHome.clone(), b: b };
  }

  function beginPour(dg) {
    const m = MS.washer;
    dg.started = true;
    m.busy = true;
    A.play("button");
    const d = m.parts.drawer;
    tween(0.3, function (k) {
      d.position.z = Math.max(d.position.z, 0.09 * k);
    });
    toast("h_pour");
  }

  function movePour(dg) {
    if (!ray.ray.intersectPlane(pourPlane, pourTmp)) {
      return;
    }
    const local = W.washer.group.worldToLocal(pourTmp.clone());
    const b = dg.b;
    b.position.x = Math.max(-0.32, Math.min(0.24, local.x));
    b.position.y = Math.max(0.62, Math.min(0.98, local.y - 0.05));
    b.position.z = POUR_AT.z;
  }

  function stepPour(dt) {
    const dg = drag;
    if (!dg || dg.kind !== "pour" || !dg.started) {
      return;
    }
    const m = MS.washer;
    const b = dg.b;
    const dist = Math.hypot(b.position.x - POUR_AT.x, b.position.y - POUR_AT.y);
    const near = dist < POUR_RANGE;
    const target = near ? 1.9 : 0.25;
    b.rotation.z += (target - b.rotation.z) * Math.min(1, dt * 9);
    const pouring = near && b.rotation.z > 1.45;
    stream.visible = pouring;
    if (pouring) {
      m.soapFill = Math.min(1, m.soapFill + dt / POUR_TIME);
      stream.scale.set(1, 0.6 + 0.4 * Math.sin(performance.now() / 25), 1);
      const now = performance.now() / 1000;
      if (now - dg.lastSound > 1.2) {
        dg.lastSound = now;
        A.play("pour");
      }
      if (m.soapFill >= 1) {
        drag = null;
        down = null;
        finishPour(true);
      }
    }
  }

  // put the bottle back; full = the cup is full and the drawer closes with soap in it
  function finishPour(full) {
    const m = MS.washer;
    const b = m.parts.bottle;
    const d = m.parts.drawer;
    const home = m.parts.bottleHome.clone();
    const p0 = b.position.clone();
    const r0 = b.rotation.z;
    stream.visible = false;
    tween(0.5, function (k) {
      b.position.lerpVectors(p0, home, k);
      b.rotation.z = r0 * (1 - k);
    }, function () {
      const z0 = d.position.z;
      m.drawerOpen = false;
      tween(0.3, function (k) {
        d.position.z = z0 * (1 - k);
      }, function () {
        if (full) {
          A.play("button");
          m.soap = true;
          m.soapFill = 0;
        }
        m.busy = false;
        updateHUD();
      });
    });
  }

  // coins on the dish
  function wantDish(m) {
    if (m.phase !== "idle" || m.doorOpen || !m.items.length) {
      return 0;
    }
    if (m.key === "washer" && !m.soap) {
      return 0;
    }
    return Math.max(0, Math.min(S.purse, m.need - m.coins));
  }

  function syncDish(m) {
    const want = wantDish(m);
    const arr = m.parts.coins;
    while (arr.length > want) {
      const c = arr.pop();
      if (!drag || drag.coin !== c) {
        if (c.parent) {
          c.parent.remove(c);
        }
      }
    }
    while (arr.length < want) {
      const c = W.makeCoin();
      c.userData.coin = { m: m.key };
      const i = arr.length;
      c.position.copy(m.parts.dishPos).add(new T.Vector3(i % 2 ? 0.024 : -0.02, i * 0.003, i % 2 ? 0.012 : -0.01));
      c.rotation.y = rand(0, 3);
      m.parts.group.add(c);
      arr.push(c);
    }
  }

  const Q_FACE = new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0));
  const Q_EDGE = new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2));

  function insertCoin(m, coin) {
    if (m.coins >= m.need || S.purse <= 0) {
      return;
    }
    const arr = m.parts.coins;
    if (!coin) {
      coin = arr[arr.length - 1];
    }
    if (!coin) {
      toast("toast_no_coins");
      return;
    }
    const idx = arr.indexOf(coin);
    if (idx >= 0) {
      arr.splice(idx, 1);
    }
    S.purse -= 1;
    m.coins += 1;
    bumpPurse();
    W.scene.attach(coin);
    const slot = m.parts.slotWorld();
    const p0 = coin.position.clone();
    const q0 = coin.quaternion.clone();
    const p1 = slot.clone().add(new T.Vector3(0, 0, 0.012));
    tween(0.35, function (k) {
      coin.position.lerpVectors(p0, p1, k);
      coin.position.y += Math.sin(k * Math.PI) * 0.03;
      coin.quaternion.slerpQuaternions(q0, Q_EDGE, k);
    }, function () {
      tween(0.22, function (k) {
        coin.position.z = p1.z - 0.03 * k;
      }, function () {
        W.scene.remove(coin);
      });
      A.play("coinSlot");
      updateHUD();
    });
  }

  function pressStart(m) {
    const st = m.parts.start;
    A.play("button");
    tween(0.18, function (k) {
      st.position.z = 0.044 - 0.005 * Math.sin(k * Math.PI);
    });
    if (m.phase === "run") {
      return;
    }
    if (!m.items.length) {
      toast("toast_empty");
      A.play("beep");
      return;
    }
    if (m.doorOpen) {
      toast(m.key === "washer" ? "h_close" : "h_dry_close");
      A.play("beep");
      return;
    }
    if (m.key === "washer" && !m.soap) {
      toast("toast_need_soap");
      A.play("beep");
      return;
    }
    if (m.coins < m.need) {
      toast("toast_need_coins", { n: m.need - m.coins });
      A.play("beep");
      return;
    }
    m.phase = "run";
    m.t = 0;
    m.dur = cycleFor(m);
    if (S.receipt) {
      S.receipt[m.key] += m.need;
    }
    m.coins = 0;
    m.lastPh = "";
    A.play("startBeep");
    m.sound = m.key === "washer" ? A.washer() : A.dryer();
    updateHUD();
  }

  function washerPhase(p) {
    if (p < 0.12) {
      return "fill";
    }
    if (p < 0.5) {
      return "wash";
    }
    if (p < 0.56) {
      return "drain";
    }
    if (p < 0.74) {
      return "rinse";
    }
    if (p < 0.78) {
      return "drain";
    }
    return "spin";
  }

  function agitate(tt) {
    const c = (tt % 7) / 7;
    if (c < 0.42) {
      return 2.6;
    }
    if (c < 0.5) {
      return 0;
    }
    if (c < 0.92) {
      return -2.6;
    }
    return 0;
  }

  const tumbleDir = new T.Vector3();
  const tumbleQ = new T.Quaternion();

  function tumble(m, dt, omega, near) {
    const R = m.parts.R;
    m.parts.drumMats[0].userData.ang = m.ang;
    m.items.forEach(function (s) {
      const root = s.obj.root;
      if (root.parent !== m.parts.clothes || s.flying) {
        return;
      }
      const tb = s.tumble;
      if (Math.abs(omega) > 7) {
        tb.phi += omega * dt;
        tb.r += (R - 0.06 - tb.r) * Math.min(1, dt * 4);
        tb.falling = false;
      } else {
        tb.phi = Math.atan2(Math.sin(tb.phi), Math.cos(tb.phi));
        if (!tb.falling) {
          tb.phi += omega * dt * 0.9;
          if (Math.abs(tb.phi) > 1.6 + tb.k) {
            tb.falling = true;
          } else if (omega === 0) {
            tb.phi *= 1 - Math.min(1, dt * 2);
          }
        } else {
          tb.phi *= 1 - Math.min(1, dt * 7);
          if (Math.abs(tb.phi) < 0.3) {
            tb.falling = false;
            tb.k = rand(-0.3, 0.4);
            if (m.key === "dryer" && m.phase === "run" && near > 0.5) {
              const now = performance.now();
              if (now - m.lastThump > 140) {
                m.lastThump = now;
                A.play("thump", 0.6 + Math.random() * 0.4);
              }
            }
          }
        }
        tb.r += (R * 0.6 - tb.r) * Math.min(1, dt * 2);
      }
      root.position.set(Math.sin(tb.phi) * tb.r, -Math.cos(tb.phi) * tb.r, tb.z);
      if (omega !== 0) {
        root.rotation.z += tb.spin * dt;
        root.rotation.x += tb.spin * dt * 0.4;
        // the cloth itself moves: stretched while it falls, a squash on landing that relaxes,
        // pressed flat against the drum in spin, and folds that keep drifting
        let target = 0.12;
        if (Math.abs(omega) > 7) {
          target = 0.75;
        } else if (tb.falling) {
          target = -0.55;
        }
        if (tb.wasFalling && !tb.falling) {
          tb.sq = 0.9;
        }
        tb.wasFalling = tb.falling;
        tb.sq = (tb.sq || 0) + (target - (tb.sq || 0)) * Math.min(1, dt * 6);
        tb.t = (tb.t || tb.k * 10 + 1) + dt * (0.7 + Math.min(Math.abs(omega), 12) * 0.08);
        if (s.obj.flex) {
          s.obj.flex(tb.t, tb.sq);
        }
      }
      // the cloth streams behind its own motion: along the drum wall while carried, downward when it drops
      if (s.obj.setTumble) {
        const dirSign = omega >= 0 ? 1 : -1;
        let flow;
        if (tb.falling) {
          tumbleDir.set(0, -1, 0);
          flow = 0.85;
        } else {
          tumbleDir.set(Math.cos(tb.phi) * dirSign, Math.sin(tb.phi) * dirSign, 0);
          flow = Math.min(1, Math.abs(omega) * tb.r * 1.6);
        }
        tb.flow = (tb.flow || 0) + (flow - (tb.flow || 0)) * Math.min(1, dt * 5);
        tumbleQ.copy(root.quaternion).invert();
        tumbleDir.applyQuaternion(tumbleQ);
        s.obj.setTumble(tb.flow, tumbleDir, performance.now() / 1000 + tb.k * 7);
      }
    });
  }

  function nearness(st) {
    return S.station === st ? 1 : S.station === "sit" || S.station === "overview" ? 0.55 : 0.3;
  }

  function stepWasher(m, dt) {
    const P = m.parts;
    let level = -1.3;
    let foam = 0;
    let target = 0;
    let fill = 0;
    let spin = 0;
    if (m.phase === "run") {
      m.t += dt;
      const p = Math.min(1, m.t / m.dur);
      const ph = washerPhase(p);
      if (ph !== m.lastPh) {
        if (ph === "drain") {
          A.play("drain");
        }
        m.lastPh = ph;
      }
      m.ph = ph;
      if (ph === "fill") {
        level = -1.1 + (p / 0.12) * 0.85;
        fill = 1;
        foam = p / 0.12;
        target = agitate(m.t) * 0.4;
      } else if (ph === "wash") {
        level = -0.25;
        foam = 1;
        target = agitate(m.t);
      } else if (ph === "drain") {
        const a = p < 0.56 ? (p - 0.5) / 0.06 : (p - 0.74) / 0.04;
        level = (p < 0.56 ? -0.25 : -0.35) - a * 0.95;
        foam = p < 0.56 ? 1 - a : 0.3 * (1 - a);
        target = 0.8;
      } else if (ph === "rinse") {
        const a = (p - 0.56) / 0.18;
        level = Math.min(-0.35, -1.2 + a * 4);
        fill = a < 0.25 ? 1 : 0;
        foam = 0.25;
        target = agitate(m.t);
      } else {
        const a = (p - 0.78) / 0.22;
        target = a < 0.85 ? Math.min(15, 2 + a * 32) : 15 * (1 - (a - 0.85) / 0.15);
        spin = Math.abs(target) / 15;
      }
      if (p >= 1) {
        finishMachine(m);
      }
    }
    m.vel += (target - m.vel) * Math.min(1, dt * (Math.abs(target) > 6 ? 0.9 : 2.5));
    m.ang += m.vel * dt;
    setDrumAngle(P, m.ang);
    tumble(m, dt, m.vel, nearness("wash"));
    const wu = P.water.material.uniforms;
    wu.uLevel.value += (level - wu.uLevel.value) * Math.min(1, dt * 3);
    wu.uFoam.value += (foam - wu.uFoam.value) * Math.min(1, dt * 2);
    wu.uSlosh.value = -m.vel * 0.045;
    P.water.visible = wu.uLevel.value > -1.05;
    P.group.position.x = m.baseX + Math.sin(performance.now() * 0.07) * 0.0014 * spin;
    if (m.sound) {
      m.sound.set({
        near: nearness("wash"),
        fill: fill,
        slosh: m.phase === "run" && level > -1 ? Math.min(1, Math.abs(m.vel) / 2.6) : 0,
        run: m.phase === "run",
        spin: spin
      });
    }
  }

  function stepDryer(m, dt) {
    const P = m.parts;
    let target = 0;
    let warm = 0;
    if (m.phase === "run") {
      m.t += dt;
      const p = Math.min(1, m.t / m.dur);
      m.ph = p < 0.85 ? "dry" : "cool";
      target = 2.4;
      warm = p < 0.85 ? Math.min(1, m.t / 3) : Math.max(0, 1 - (p - 0.85) / 0.15);
      m.items.forEach(function (s) {
        s.obj.setWet(Math.max(0, 1 - p * 1.25));
        s.obj.setWarm(warm * 0.7);
      });
      if (p >= 1) {
        finishMachine(m);
      }
    }
    m.vel += (target - m.vel) * Math.min(1, dt * 1.5);
    m.ang += m.vel * dt;
    setDrumAngle(P, m.ang);
    tumble(m, dt, m.vel, nearness("dry"));
    P.warm.intensity = warm * 0.9;
    // warm drum fogs the porthole a little
    if (P.glassMat) {
      P.glassMat.opacity = P.glassBase.opacity + warm * 0.28;
      P.glassMat.color.copy(P.glassBase.color).lerp(new T.Color("#fff3e6"), warm * 0.6);
    }
    P.drumMats.forEach(function (mt) {
      mt.emissive.setRGB(0.1 + warm * 0.45, 0.11 + warm * 0.2, 0.12);
    });
    if (m.sound) {
      m.sound.set({ near: nearness("dry"), run: m.phase === "run" ? 1 : 0 });
    }
  }

  function setDrumAngle(P, a) {
    const drum = P.clothes.parent.children.find(function (o) {
      return o.geometry && o.geometry.type === "CylinderGeometry" && o.material === P.drumMats[0];
    });
    if (drum) {
      drum.rotation.y = a;
    }
  }

  function finishMachine(m) {
    m.phase = "done";
    if (m.sound) {
      m.sound.stop();
      m.sound = null;
    }
    A.play("chime");
    m.items.forEach(function (s) {
      if (m.key === "washer") {
        s.state = "wet";
        s.obj.setWet(1);
      } else {
        s.state = "dry";
        s.obj.setWet(0);
        s.obj.setWarm(0.25);
        later(6, function () {
          s.obj.setWarm(0);
        });
      }
    });
    if (m.key === "dryer") {
      S.lint.amount = 1;
      S.lint.cells = new Set();
      drawLint(m.items.map(function (s) {
        return s.spec.color.base;
      }));
    }
    m.soap = m.key === "washer" ? m.soap : false;
    updateHUD();
  }

  /* ---------- lint trap ---------- */
  const LT = W.dryer.lint;
  LT.feltMesh.visible = false;

  function drawLint(colors) {
    // matted felt: a soft grey mat, thousands of short fibres, shirt-coloured threads and pills
    const c = LT.felt.getContext("2d");
    c.clearRect(0, 0, 256, 192);
    const base = c.createRadialGradient(128, 96, 10, 128, 96, 150);
    base.addColorStop(0, "rgba(206,204,207,0.97)");
    base.addColorStop(1, "rgba(176,176,181,0.94)");
    c.fillStyle = base;
    c.beginPath();
    if (c.roundRect) {
      c.roundRect(5, 5, 246, 182, 14);
    } else {
      c.rect(5, 5, 246, 182);
    }
    c.fill();
    for (let i = 0; i < 70; i++) {
      const x = rand(14, 242);
      const y = rand(14, 178);
      const r = rand(6, 18);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const light = Math.random() < 0.5;
      g.addColorStop(0, light ? "rgba(236,235,238,0.45)" : "rgba(140,141,147,0.35)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.lineCap = "round";
    for (let i = 0; i < 2600; i++) {
      const tinted = Math.random() < 0.22 && colors.length;
      c.strokeStyle = tinted ? colors[i % colors.length] : (Math.random() < 0.55 ? "#ecebee" : "#9a9ca2");
      c.globalAlpha = tinted ? 0.55 : rand(0.25, 0.6);
      c.lineWidth = rand(0.5, 1.1);
      const x = rand(8, 248);
      const y = rand(8, 184);
      const a = rand(0, Math.PI * 2);
      const len = rand(3, 11);
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(a + 1) * len * 0.5, y + Math.sin(a + 1) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
      c.stroke();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 26; i++) {
      const x = rand(16, 240);
      const y = rand(16, 176);
      c.fillStyle = colors.length && i % 3 === 0 ? colors[i % colors.length] : "#dcdbe0";
      c.beginPath();
      c.arc(x, y, rand(1.2, 2.6), 0, Math.PI * 2);
      c.fill();
    }
    LT.feltTex.needsUpdate = true;
    LT.feltMesh.visible = true;
  }

  function toggleLint(forceOpen) {
    if (MS.dryer.phase === "run") {
      toast("toast_locked");
      return;
    }
    if (S.lint.closing) {
      return;
    }
    const open = forceOpen === undefined ? !S.lint.open : forceOpen;
    S.lint.open = open;
    A.play("lintPull");
    const g = LT.group;
    const z0 = g.position.z;
    const z1 = open ? 0.13 : -0.11;
    tween(0.6, function (k) {
      g.position.z = z0 + (z1 - z0) * k;
    });
    updateHUD();
  }

  let lastPeel = 0;
  const feltPlane = new T.Plane();
  const feltHitPoint = new T.Vector3();

  function lintDragAt() {
    LT.feltMesh.updateWorldMatrix(true, false);
    const normal = new T.Vector3(0, 0, 1).transformDirection(LT.feltMesh.matrixWorld);
    const origin = new T.Vector3().setFromMatrixPosition(LT.feltMesh.matrixWorld);
    feltPlane.setFromNormalAndCoplanarPoint(normal, origin);
    if (!ray.ray.intersectPlane(feltPlane, feltHitPoint)) {
      return;
    }
    const local = LT.feltMesh.worldToLocal(feltHitPoint.clone());
    local.x = Math.max(-0.13, Math.min(0.13, local.x));
    local.y = Math.max(-0.09, Math.min(0.09, local.y));
    local.z = 0;
    peelAt(LT.feltMesh.localToWorld(local));
  }

  function peelAt(point) {
    if (!S.lint.open || S.lint.amount <= 0) {
      return;
    }
    const local = LT.feltMesh.worldToLocal(point.clone());
    const x = (local.x / 0.26 + 0.5) * 256;
    const y = (1 - (local.y / 0.18 + 0.5)) * 192;
    const c = LT.felt.getContext("2d");
    c.save();
    c.globalCompositeOperation = "destination-out";
    c.beginPath();
    c.arc(x, y, 26, 0, Math.PI * 2);
    c.fill();
    c.restore();
    LT.feltTex.needsUpdate = true;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cx = Math.floor(x / 256 * 10) + dx;
        const cy = Math.floor(y / 192 * 8) + dy;
        if (cx >= 0 && cx < 10 && cy >= 0 && cy < 8) {
          S.lint.cells.add(cx + cy * 10);
        }
      }
    }
    const now = performance.now();
    if (now - lastPeel > 70) {
      lastPeel = now;
      A.play("lintPeel");
    }
    if (S.lint.cells.size >= 56 && S.lint.amount > 0) {
      S.lint.amount = 0;
      S.lint.closing = true;
      tween(0.5, function (k) {
        LT.feltMesh.material.opacity = 1 - k;
      }, function () {
        LT.feltMesh.visible = false;
        LT.feltMesh.material.opacity = 1;
        later(0.4, function () {
          S.lint.closing = false;
          toggleLint(false);
        });
      });
    }
  }

  /* ---------- clothesline ---------- */
  const LINE_ORDER = [1, 2, 0, 3];
  const Q_HANG = new T.Quaternion().setFromEuler(new T.Euler(0, Math.PI / 2, 0));
  const ringTex = W.marker.material.map;
  const PEG_COLORS = ["#c8442c", "#9cc5b5", "#efe9dc", "#c9a14a"];

  function hangNext() {
    const free = LINE_ORDER.find(function (i) {
      return !S.line[i];
    });
    if (free === undefined) {
      toast("toast_full");
      return;
    }
    const s = basketShirts().find(function (x) {
      return x.state === "wet" && !x.flying;
    });
    if (!s) {
      toast("toast_no_wet");
      return;
    }
    const pivot = new T.Group();
    pivot.position.copy(W.lineSlots[free]);
    W.scene.add(pivot);
    S.line[free] = s;
    s.loc = "line";
    s.hang = { slot: free, pivot: pivot, pegs: 0, markers: [], pegMeshes: [], dry: 0, phase: rand(0, 6), swing: 0 };
    if (S.receipt) {
      S.receipt.line += 1;
    }
    layoutBasket();
    A.play("swish");
    fly(s, pivot, new T.Vector3(0, -0.29, 0), Q_HANG, 0.85, 0.6, 0.18, function () {
      s.obj.setMode("flat");
      s.obj.setDrape("line");
      A.play("flap");
      const root = s.obj.root;
      tween(0.55, function (k, raw) {
        root.scale.set(0.85, 0.85 * (0.4 + 0.6 * k), 0.85);
        pivot.rotation.z = Math.sin(raw * 12) * 0.18 * (1 - raw);
      }, function () {
        root.scale.setScalar(0.85);
        addPegMarkers(s);
      }, easeOutBack);
    });
  }

  function addPegMarkers(s) {
    [-0.19, 0.19].forEach(function (x, i) {
      const mk = new T.Mesh(new T.PlaneGeometry(0.07, 0.07), new T.MeshBasicMaterial({ map: ringTex, transparent: true, color: "#ffd2c6", toneMapped: false, depthWrite: false }));
      mk.position.set(x, 0.33, 0.02);
      mk.userData.peg = { s: s, i: i };
      mk.renderOrder = 6;
      s.obj.root.add(mk);
      s.hang.markers.push(mk);
    });
  }

  function makePeg(color) {
    const g = new T.Group();
    const mat = new T.MeshStandardMaterial({ color: color, roughness: 0.5 });
    const a = new T.Mesh(new T.BoxGeometry(0.014, 0.075, 0.007), mat);
    a.position.z = 0.006;
    const b = new T.Mesh(new T.BoxGeometry(0.014, 0.075, 0.007), mat);
    b.position.z = -0.006;
    const spring = new T.Mesh(new T.TorusGeometry(0.008, 0.002, 6, 12), W.M.chrome);
    spring.rotation.y = Math.PI / 2;
    spring.position.y = -0.005;
    g.add(a, b, spring);
    a.castShadow = true;
    return g;
  }

  function clipPeg(peg) {
    const s = peg.s;
    const mk = s.hang.markers[peg.i];
    if (!mk || !mk.parent) {
      return;
    }
    mk.parent.remove(mk);
    const p = makePeg(PEG_COLORS[(s.hang.slot + peg.i) % PEG_COLORS.length]);
    p.position.set(mk.position.x, 0.37, 0);
    p.scale.setScalar(1 / 0.85);
    s.obj.root.add(p);
    s.hang.pegMeshes.push(p);
    tween(0.18, function (k) {
      p.position.y = 0.42 - 0.05 * k;
    });
    A.play("peg");
    s.hang.pegs += 1;
    s.hang.swing += 0.05;
    updateHUD();
  }

  function takeDown(s) {
    A.play("pegOff");
    s.hang.pegMeshes.forEach(function (p) {
      const y0 = p.position.y;
      tween(0.3, function (k) {
        p.position.y = y0 + 0.08 * k;
        p.rotation.z = k * 1.2;
      }, function () {
        if (p.parent) {
          p.parent.remove(p);
        }
      });
    });
    s.hang.markers.forEach(function (mk) {
      if (mk.parent) {
        mk.parent.remove(mk);
      }
    });
    S.line[s.hang.slot] = null;
    const pivot = s.hang.pivot;
    later(0.2, function () {
      A.play("flap");
      toBasket(s, function () {
        W.scene.remove(pivot);
      });
    });
    s.hang = null;
    updateHUD();
  }

  let puddle = 0;
  let lastDripSound = 0;

  function spawnDrip(s) {
    const d = W.drips.find(function (x) {
      return !x.alive;
    });
    if (!d) {
      return;
    }
    const p = s.obj.root.localToWorld(new T.Vector3(rand(-0.23, 0.23), -0.335, 0.004));
    d.mesh.position.copy(p);
    d.mesh.visible = true;
    d.v = 0;
    d.alive = true;
  }

  function stepLine(dt) {
    const now = performance.now() / 1000;
    const day = theme === "day";
    S.line.forEach(function (s) {
      if (!s || !s.hang) {
        return;
      }
      const h = s.hang;
      if (h.pegs >= 2 && s.state === "wet") {
        h.dry += dt / (S.cycle * 0.9);
        const wet = Math.max(0, 1 - h.dry);
        s.obj.setWet(wet);
        if (Math.random() < wet * dt * 2.4) {
          spawnDrip(s);
        }
        if (h.dry >= 1) {
          s.state = "dry";
          s.obj.setWet(0);
          updateHUD();
        }
      }
      const wet = s.state === "wet" ? Math.max(0, 1 - h.dry) : 0;
      const amp = (day ? 0.07 : 0.04) * (1 - wet * 0.5);
      h.swing *= 1 - Math.min(1, dt * 1.5);
      if (h.pegs >= 2 && !s.flying) {
        h.pivot.rotation.z = Math.sin(now * 1.1 + h.phase) * amp + Math.sin(now * 0.37 + h.phase * 2) * amp * 0.6 + h.swing * Math.sin(now * 6);
        // the same breeze swells the cloth itself, a beat behind the swing
        const gust = 0.5 + 0.5 * Math.sin(now * 0.9 + h.phase - 0.6) * Math.sin(now * 0.37 + h.phase * 2);
        if (s.obj.setGust) {
          s.obj.setGust(day ? gust : gust * 0.6, wet);
        }
      }
      h.markers.forEach(function (mk) {
        mk.scale.setScalar(1 + Math.sin(now * 4) * 0.12);
      });
    });
  }

  function stepDrips(dt) {
    W.drips.forEach(function (d) {
      if (!d.alive) {
        return;
      }
      d.v -= 9.8 * dt;
      d.mesh.position.y += d.v * dt;
      if (d.mesh.position.y < 0.01) {
        d.alive = false;
        d.mesh.visible = false;
        puddle = Math.min(1, puddle + 0.01);
        const now = performance.now();
        if (S.station === "hang" && now - lastDripSound > 90) {
          lastDripSound = now;
          A.play("drip");
        }
      }
    });
    puddle = Math.max(0, puddle - dt * 0.004);
    W.puddle.material.opacity = puddle * 0.5;
  }

  /* ---------- folding table ---------- */
  const Q_FLAT = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0));
  const arrowTex = W.canvasTex(128, 128, function (c, s) {
    c.strokeStyle = "#ffffff";
    c.lineWidth = 16;
    c.lineCap = "round";
    c.beginPath();
    c.arc(s / 2, s * 0.85, s * 0.42, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
    c.strokeStyle = "#c8442c";
    c.lineWidth = 9;
    c.beginPath();
    c.arc(s / 2, s * 0.85, s * 0.42, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
    c.fillStyle = "#c8442c";
    c.beginPath();
    c.moveTo(s * 0.92, s * 0.58);
    c.lineTo(s * 0.74, s * 0.44);
    c.lineTo(s * 0.98, s * 0.38);
    c.closePath();
    c.fill();
  });
  const arrow = new T.Mesh(new T.PlaneGeometry(0.16, 0.16), new T.MeshBasicMaterial({ map: arrowTex, transparent: true, depthTest: false, toneMapped: false }));
  arrow.renderOrder = 12;
  arrow.visible = false;
  arrow.userData.pass = true;

  function layOnTable() {
    if (S.table.shirt) {
      toast("toast_table_busy");
      return;
    }
    const s = basketShirts().find(function (x) {
      return x.state === "dry" && !x.flying;
    });
    if (!s) {
      toast("toast_no_dry");
      return;
    }
    S.table.shirt = s;
    S.table.step = "lay";
    s.loc = "table";
    layoutBasket();
    A.play("swish");
    const q = Q_FLAT.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0, 0, rand(-0.04, 0.04))));
    fly(s, W.scene, W.tableSpot.clone(), q, 1, 0.65, 0.3, function () {
      s.obj.setMode("flat");
      s.obj.setWrinkled();
      s.obj.setDrape("table");
      A.play("flap");
      const root = s.obj.root;
      tween(0.4, function (k) {
        root.scale.set(1, 0.7 + 0.3 * k, 1);
      }, function () {
        A.play("pat");
        S.table.step = "smooth";
        updateHUD();
      }, easeOutBack);
    });
  }

  function smoothHit(hit) {
    const s = S.table.shirt;
    if (!s || S.table.step !== "smooth") {
      return;
    }
    const local = hit.object.worldToLocal(hit.point.clone());
    const w = s.obj.smoothAt(local.x, local.y);
    if (w <= 0) {
      S.table.step = "L";
      A.play("pat");
      updateHUD();
    }
  }

  function placeArrow() {
    const s = S.table.shirt;
    const st = S.table.step;
    if (!s || ["L", "R", "B"].indexOf(st) < 0 || S.table.folding) {
      arrow.visible = false;
      return;
    }
    if (arrow.parent !== s.obj.flat) {
      s.obj.flat.add(arrow);
    }
    arrow.visible = true;
    const bob = Math.sin(performance.now() / 300) * 0.01;
    if (st === "L") {
      arrow.position.set(-0.2 + bob, 0.08, 0.04);
      arrow.rotation.set(0, 0, 0);
    } else if (st === "R") {
      arrow.position.set(0.2 - bob, 0.08, 0.04);
      arrow.rotation.set(0, Math.PI, 0);
    } else {
      arrow.position.set(0, -0.2 + bob, 0.05);
      arrow.rotation.set(0, 0, Math.PI / 2);
    }
  }

  function doFold() {
    const st = S.table.step;
    const s = S.table.shirt;
    if (!s || ["L", "R", "B"].indexOf(st) < 0 || S.table.folding) {
      return;
    }
    S.table.folding = true;
    arrow.visible = false;
    A.play("swish");
    tween(0.6, function (k) {
      s.obj.foldAmount(st, k);
    }, function () {
      A.play("pat");
      S.table.folding = false;
      S.table.step = st === "L" ? "R" : st === "R" ? "B" : "done";
      if (S.table.step === "done") {
        finishFold(s);
      }
      updateHUD();
    });
  }

  function finishFold(s) {
    later(0.35, function () {
      if (arrow.parent) {
        arrow.parent.remove(arrow);
      }
      const n = S.stack.filter(function (x) {
        return x.loc === "stack";
      }).length;
      s.obj.setDrape("folded");
      const pos = W.stackSpot.clone().add(new T.Vector3(rand(-0.01, 0.01), n * 0.024, 0));
      const q = Q_FLAT.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0, 0, rand(-0.06, 0.06))));
      s.state = "folded";
      s.loc = "stack";
      S.stack.push(s);
      S.table.shirt = null;
      S.table.step = null;
      fly(s, W.scene, pos, q, 1, 0.6, 0.12, function () {
        A.play("stack");
        checkDone();
      });
      updateHUD();
    });
  }

  function loadShirts() {
    return S.shirts.filter(function (s) {
      return s.load === S.loadId;
    });
  }

  function allDone() {
    const ls = loadShirts();
    return ls.length > 0 && ls.every(function (s) {
      return s.state === "folded" && !s.flying;
    });
  }

  function checkDone() {
    if (!allDone() || S.doneShown) {
      return;
    }
    S.doneShown = true;
    later(1.2, function () {
      const sec = (performance.now() - S.loadStart) / 1000;
      const n = loadShirts().length;
      const r = S.receipt || { washer: 0, dryer: 0, line: 0 };
      $("doneBody").textContent = t("done_body", { n: n, time: fmtTime(sec) });
      // a thermal slip from the changer: what this load cost, line by line
      const rows = [[t("rc_shirts"), "\u00d7" + n]];
      if (r.washer) {
        rows.push([t("ticket_washer"), t(r.washer === 1 ? "rc_coin" : "rc_coins", { n: r.washer })]);
      }
      if (r.dryer) {
        rows.push([t("ticket_dryer"), t(r.dryer === 1 ? "rc_coin" : "rc_coins", { n: r.dryer })]);
      }
      if (r.line) {
        rows.push([t("rc_line"), t("rc_free", { n: r.line })]);
      }
      rows.push([t("rc_time"), fmtTime(sec)]);
      const list = $("doneLines");
      list.textContent = "";
      rows.forEach(function (row, i) {
        const li = document.createElement("li");
        li.style.animationDelay = (0.25 + i * 0.16).toFixed(2) + "s";
        const a = document.createElement("span");
        a.textContent = row[0];
        const b = document.createElement("span");
        b.textContent = row[1];
        li.appendChild(a);
        li.appendChild(b);
        list.appendChild(li);
      });
      const stamp = new Date();
      $("doneStamp").textContent = "LOAD " + String(S.loadId).padStart(3, "0") + " \u00b7 " +
        String(stamp.getHours()).padStart(2, "0") + ":" + String(stamp.getMinutes()).padStart(2, "0");
      $("done").hidden = false;
      document.body.classList.add("done-open");
      A.play("receipt");
      updateHUD();
    });
  }

  function anotherLoad() {
    $("done").hidden = true;
    document.body.classList.remove("done-open");
    const folded = S.stack.slice();
    if (folded.length > 8) {
      folded.slice(0, folded.length - 8).forEach(function (s) {
        W.scene.remove(s.obj.root);
        S.shirts.splice(S.shirts.indexOf(s), 1);
        S.stack.splice(S.stack.indexOf(s), 1);
      });
      S.stack.forEach(function (s, i) {
        s.obj.root.position.y = W.stackSpot.y + i * 0.024;
      });
    }
    newLoad();
    go(S.purse >= 2 ? "wash" : "change");
  }

  /* ---------- camera ---------- */
  const VIEWS = {
    overview: [[0.4, 1.7, 3.0], [-0.3, 0.95, -1.0]],
    change: [[1.85, 0.98, 0.0], [1.85, 0.78, -1.6]],
    wash: [[-0.75, 0.98, -0.3], [-0.75, 0.5, -1.36]],
    washPanel: [[-0.66, 1.0, -0.86], [-0.66, 0.79, -1.36]],
    dry: [[0.6, 0.98, -0.28], [0.6, 0.45, -1.36]],
    dryPanel: [[0.72, 1.0, -0.86], [0.72, 0.79, -1.36]],
    lint: [[0.6, 0.66, -0.8], [0.6, 0.11, -1.22]],
    hang: [[-0.95, 1.5, 0.0], [-2.55, 1.32, 0.0]],
    fold: [[0.85, 1.95, 1.85], [0.85, 0.84, 0.88]],
    sit: [[-1.05, 1.02, 1.95], [-0.45, 0.72, -1.4]]
  };

  function panelMode(m) {
    return m.phase === "idle" && !m.doorOpen && m.items.length > 0 && (m.key !== "washer" || m.soap) && !m.busy;
  }

  function viewKey() {
    const st = S.station;
    if (st === "wash") {
      return panelMode(MS.washer) ? "washPanel" : "wash";
    }
    if (st === "dry") {
      if (S.lint.open) {
        return "lint";
      }
      return panelMode(MS.dryer) ? "dryPanel" : "dry";
    }
    return st;
  }

  const cam = { key: "overview", pos: new T.Vector3(), look: new T.Vector3(), moving: false, factor: 1, fov: 50 };

  // portrait phones: frame the fold board itself, a little more top-down, so the whole shirt
  // and the next fold line stay on screen (the stack can sit just off to the right)
  const VIEWS_PORTRAIT = {
    fold: [[0.62, 2.12, 1.62], [0.62, 0.84, 0.86]]
  };

  function targetOf(key) {
    const v = (cam.factor > 1.2 && VIEWS_PORTRAIT[key]) || VIEWS[key];
    const look = new T.Vector3(v[1][0], v[1][1], v[1][2]);
    const pos = new T.Vector3(v[0][0], v[0][1], v[0][2]);
    pos.sub(look).multiplyScalar(cam.factor).add(look);
    return { pos: pos, look: look };
  }

  function updateCamera(dt) {
    const key = viewKey();
    const tg = targetOf(key);
    if (key !== cam.key && !cam.moving) {
      cam.key = key;
      cam.moving = true;
      const p0 = cam.pos.clone();
      const l0 = cam.look.clone();
      tween(1.1, function (k) {
        const t2 = targetOf(cam.key);
        cam.pos.lerpVectors(p0, t2.pos, k);
        cam.look.lerpVectors(l0, t2.look, k);
      }, function () {
        cam.moving = false;
        if (S.station === "sit") {
          document.body.classList.add("sitting");
        }
      });
    } else if (!cam.moving) {
      cam.pos.lerp(tg.pos, Math.min(1, dt * 4));
      cam.look.lerp(tg.look, Math.min(1, dt * 4));
    }
    const cm = W.camera;
    cm.position.copy(cam.pos);
    if (S.station === "sit" && !cam.moving) {
      const tt = performance.now() / 1000;
      cm.position.y += Math.sin(tt * 0.5) * 0.008;
      cm.position.x += Math.sin(tt * 0.21) * 0.01;
    }
    cm.lookAt(cam.look);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    W.renderer.setSize(w, h, false);
    const aspect = w / h;
    cam.fov = aspect < 0.75 ? 64 : aspect < 1.2 ? 56 : 50;
    cam.factor = aspect < 0.75 ? 1.3 : aspect < 1.2 ? 1.12 : 1;
    const bottom = document.querySelector(".bottom").offsetHeight || 120;
    const p = Math.max(0, Math.round((bottom - 70) / 2));
    W.camera.fov = cam.fov;
    W.camera.aspect = w / (h + 2 * p);
    W.camera.setViewOffset(w, h + 2 * p, 0, 2 * p, w, h);
    W.camera.updateProjectionMatrix();
    cam.offsetP = p;
    placeBasket();
  }

  function placeBasket() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const H = h + 2 * (cam.offsetP || 0);
    const d = 0.8;
    const halfH = d * Math.tan((cam.fov * Math.PI) / 360);
    const halfW = halfH * (w / H);
    const b = W.basket.group;
    const hidden = S.station === "overview" || S.station === "change" || S.station === "sit" || !S.started;
    b.visible = !hidden;
    const sc = Math.min(0.55, (halfW * 0.4) / 0.36);
    let baseY = -halfH + 0.05 * sc;
    if (w < 900) {
      const bottomPx = document.querySelector(".bottom").offsetHeight || 120;
      baseY = -halfH + ((bottomPx + 8) / H) * 2 * halfH;
    }
    b.scale.setScalar(sc);
    b.position.set(halfW - 0.21 * sc - 0.01, baseY, -d);
    b.rotation.set(0.5, -0.32, 0);
  }

  function go(st) {
    if (!S.started) {
      return;
    }
    if (S.station === "sit" && st !== "sit") {
      document.body.classList.remove("sitting");
      $("btnStand").hidden = true;
    }
    if (st === "dry" && S.lint.open && S.station !== "dry") {
      S.lint.open = false;
      LT.group.position.z = -0.11;
    }
    if (st !== S.station) {
      A.play("step");
    }
    S.station = st;
    if (st === "sit") {
      $("btnStand").hidden = false;
    }
    S.lastInput = performance.now();
    placeBasket();
    updateHUD();
  }

  /* ---------- picking ---------- */
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();

  function setRay(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, W.camera);
  }

  function chainVisible(o) {
    while (o) {
      if (!o.visible) {
        return false;
      }
      o = o.parent;
    }
    return true;
  }

  function resolve(o) {
    let piece = null;
    let station = null;
    while (o) {
      const u = o.userData;
      if (u.coin) {
        return { type: "coin", coin: o };
      }
      if (u.peg) {
        return { type: "peg", peg: u.peg };
      }
      if (u.act) {
        return { type: "act", act: u.act, obj: o };
      }
      if (u.piece && !piece) {
        piece = u.piece;
      }
      if (u.shirt) {
        return { type: "shirt", shirt: u.shirt, piece: piece };
      }
      if (u.station && !station) {
        station = u.station;
      }
      o = o.parent;
    }
    return station ? { type: "station", st: station } : null;
  }

  function pick() {
    const hits = ray.intersectObjects(W.scene.children, true);
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      const o = h.object;
      if (o.userData.pass || !chainVisible(o)) {
        continue;
      }
      if (o.material && o.material.isShaderMaterial) {
        continue;
      }
      if (Array.isArray(o.material)) {
        const mt = h.face ? o.material[h.face.materialIndex] : null;
        if (mt && mt.visible === false) {
          continue;
        }
      } else if (o.material && o.material.visible === false) {
        continue;
      }
      if (o.material === W.M.glass || (o.material && o.material.opacity < 0.3 && o.material.transparent && !o.userData.act && !(o.parent && o.parent.userData.act) && o.material !== W.M.hit)) {
        continue;
      }
      const r = resolve(o);
      if (r) {
        r.hit = h;
      }
      return r;
    }
    return null;
  }

  let drag = null;
  let down = null;
  let hand = null;

  function stationOfAct(act) {
    if (act === "bill" || act === "tray") {
      return "change";
    }
    if (act.indexOf("washer") === 0 || act === "soap" || act === "drawer") {
      return "wash";
    }
    if (act.indexOf("dryer") === 0 || act.indexOf("lint") === 0) {
      return "dry";
    }
    return null;
  }

  function onAct(act) {
    const st = stationOfAct(act);
    if (st && st !== S.station) {
      go(st);
      return;
    }
    const w = MS.washer;
    const d = MS.dryer;
    switch (act) {
      case "bill":
        feedNote();
        break;
      case "tray":
        collectCoins();
        break;
      case "basket":
        basketTap();
        break;
      case "washerDoor":
        if (w.phase === "done" && !w.doorOpen) {
          setDoor(w, true);
        } else {
          setDoor(w, !w.doorOpen);
        }
        break;
      case "washerDrum":
        if (w.doorOpen && w.items.length && w.phase !== "idle") {
          unload(w);
        } else if (w.doorOpen && basketCounts().dirty > 0) {
          loadInto(w, "dirty");
        } else if (w.doorOpen && w.items.length && w.phase === "idle") {
          setDoor(w, false);
        } else if (w.doorOpen && w.items.length) {
          unload(w);
        } else {
          setDoor(w, !w.doorOpen);
        }
        break;
      case "soap":
        addSoap();
        break;
      case "washerSlot":
        insertCoin(w);
        break;
      case "washerStart":
        pressStart(w);
        break;
      case "washerDial":
        turnDial(w);
        break;
      case "drawer":
        if (!w.busy) {
          setDrawer(!w.drawerOpen);
        }
        break;
      case "dryerDial":
        turnDial(d);
        break;
      case "dryerDoor":
        setDoor(d, !d.doorOpen);
        break;
      case "dryerDrum":
        if (d.doorOpen && d.items.length && (d.phase === "done" || basketCounts().wet === 0)) {
          unload(d);
        } else if (d.doorOpen && basketCounts().wet > 0) {
          loadInto(d, "wet");
        } else {
          setDoor(d, !d.doorOpen);
        }
        break;
      case "dryerSlot":
        insertCoin(d);
        break;
      case "dryerStart":
        pressStart(d);
        break;
      case "lintTab":
        toggleLint();
        break;
      case "lintFelt":
        break;
      default:
        break;
    }
    updateHUD();
  }

  function basketTap() {
    const st = S.station;
    if (st === "wash") {
      loadInto(MS.washer, "dirty");
    } else if (st === "dry") {
      loadInto(MS.dryer, "wet");
    } else if (st === "hang") {
      hangNext();
    } else if (st === "fold") {
      layOnTable();
    }
  }

  function shirtTap(s) {
    if (s.loc === "line" && s.hang) {
      if (S.station !== "hang") {
        go("hang");
        return;
      }
      if (s.hang.pegs < 2) {
        const mk = s.hang.markers.find(function (m) {
          return m.parent;
        });
        if (mk) {
          clipPeg(mk.userData.peg);
        }
      } else if (s.state === "dry") {
        takeDown(s);
      } else {
        s.hang.swing += 0.12;
        A.play("smooth", 0.6);
        toast("toast_damp");
      }
    } else if (s.loc === "table") {
      if (S.station !== "fold") {
        go("fold");
        return;
      }
      if (["L", "R", "B"].indexOf(S.table.step) >= 0) {
        doFold();
      }
    } else if (s.loc === "washer" || s.loc === "dryer") {
      onAct(s.loc + "Drum");
    } else if (s.loc === "basket") {
      basketTap();
    } else if (s.loc === "stack") {
      if (S.station !== "fold") {
        go("fold");
      } else {
        A.play("pat");
      }
    }
  }

  function tap(r) {
    if (!r) {
      return;
    }
    if (r.type === "coin") {
      insertCoin(MS[r.coin.userData.coin.m], r.coin);
    } else if (r.type === "peg") {
      clipPeg(r.peg);
    } else if (r.type === "shirt") {
      shirtTap(r.shirt);
    } else if (r.type === "act") {
      onAct(r.act);
    } else if (r.type === "station") {
      if (r.st !== S.station) {
        go(r.st);
      }
    }
    updateHUD();
  }

  // a soft ring where a finger lands on something you can use: visual "touch" to pair with the sound
  function touchRipple(x, y) {
    const dot = document.createElement("span");
    dot.className = "touch-ripple";
    dot.style.left = x + "px";
    dot.style.top = y + "px";
    document.body.appendChild(dot);
    setTimeout(function () {
      dot.remove();
    }, 650);
  }

  /* Carry a shirt from the basket into a drum: it follows your finger a hand's length in front of the camera,
     and letting go over the open door drops it in. Anywhere else it falls back into the basket. */
  const carryPlane = new T.Plane();
  const carryTmp = new T.Vector3();

  function drumScreen(m) {
    const r = canvas.getBoundingClientRect();
    const p = m.parts.clothes.getWorldPosition(new T.Vector3()).project(W.camera);
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, size: Math.min(r.width, r.height) };
  }

  function beginCarry(dg) {
    const s = dg.s;
    const fwd = W.camera.getWorldDirection(new T.Vector3());
    const at = W.camera.position.clone().addScaledVector(fwd, 0.62);
    carryPlane.setFromNormalAndCoplanarPoint(fwd.clone().negate(), at);
    dg.started = true;
    s.flying = true;
    W.scene.attach(s.obj.root);
    A.play("clothOut");
    if (!dg.m.doorOpen && !dg.m.busy) {
      setDoor(dg.m, true);
    }
  }

  function moveCarry(dg, e) {
    if (!ray.ray.intersectPlane(carryPlane, carryTmp)) {
      return;
    }
    const root = dg.s.obj.root;
    root.position.lerp(carryTmp, 0.6);
    const ds = drumScreen(dg.m);
    const over = Math.hypot(e.clientX - ds.x, e.clientY - ds.y) < ds.size * 0.2;
    const sc = over ? 0.5 : 0.62;
    root.scale.setScalar(root.scale.x + (sc - root.scale.x) * 0.3);
    root.rotation.z = Math.sin(performance.now() / 300) * 0.08;
    dg.over = over;
  }

  function dropCarry(dg, e) {
    const s = dg.s;
    s.flying = false;
    const ds = drumScreen(dg.m);
    const over = e && e.type === "pointerup" && Math.hypot(e.clientX - ds.x, e.clientY - ds.y) < ds.size * 0.2;
    if (over && loadThis(dg.m, s)) {
      updateHUD();
      return;
    }
    const i = Math.max(0, basketShirts().indexOf(s));
    const p = BASKET_SLOTS[i % BASKET_SLOTS.length];
    const q = new T.Quaternion().setFromEuler(new T.Euler(0.2, i * 1.3, 0.1));
    A.play("swish");
    fly(s, W.basket.items, new T.Vector3(p[0], p[1], p[2]), q, 0.85, 0.4, 0.06, layoutBasket);
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (!S.started) {
      return;
    }
    S.lastInput = performance.now();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    setRay(e);
    const r = pick();
    down = { x: e.clientX, y: e.clientY, r: r, moved: 0 };
    drag = null;
    window.__bilas.lastDown = { type: r ? r.type : null, act: r ? r.act || null : null, station: S.station, lint: S.lint.open, amount: S.lint.amount };
    if (r && r.type !== "station") {
      touchRipple(e.clientX, e.clientY);
    }
    if (!r) {
      if (S.lint.open && S.lint.amount > 0 && S.station === "dry") {
        drag = { kind: "lint" };
        lintDragAt();
      }
      return;
    }
    if (r.type === "act" && r.act === "soap" && S.station === "wash" && canPour()) {
      drag = startPourDrag();
      return;
    }
    if (r.type === "act" && (r.act === "washerDial" || r.act === "dryerDial")) {
      const dm = r.act === "washerDial" ? MS.washer : MS.dryer;
      let owner = r.obj;
      while (owner && owner !== dm.parts.dial) {
        owner = owner.parent;
      }
      if (owner && dm.phase !== "run") {
        const c = screenOf(dm.parts.dial.getWorldPosition(new T.Vector3()));
        drag = { kind: "dial", m: dm, cx: c.x, cy: c.y, prevA: Math.atan2(e.clientY - c.y, e.clientX - c.x), turned: 0, rot0: dm.parts.dial.rotation.z, last: dm.prog, started: false };
        return;
      }
    }
    if (r.type === "act" && r.act === "drawer" && S.station === "wash" && !MS.washer.busy && MS.washer.phase !== "run") {
      drag = { kind: "drawer", y0: e.clientY, z0: MS.washer.parts.drawer.position.z };
      return;
    }
    const fromBasket = (r.type === "shirt" && r.shirt.loc === "basket") || (r.type === "act" && r.act === "basket");
    if (fromBasket && (S.station === "wash" || S.station === "dry")) {
      const cm = S.station === "wash" ? MS.washer : MS.dryer;
      const want = S.station === "wash" ? "dirty" : "wet";
      let pickS = r.type === "shirt" ? r.shirt : null;
      if (!pickS || pickS.state !== want || pickS.flying) {
        pickS = basketShirts().find(function (x) {
          return x.state === want && !x.flying;
        });
      }
      if (pickS && cm.phase !== "run" && cm.items.length < 6 && !(cm.phase === "done" && cm.items.length)) {
        drag = { kind: "carry", s: pickS, m: cm, started: false };
        return;
      }
    }
    if (r.type === "coin") {
      const m = MS[r.coin.userData.coin.m];
      if (S.station === (m.key === "washer" ? "wash" : "dry") && m.coins < m.need) {
        const plane = new T.Plane(new T.Vector3(0, 0, 1), -(m.parts.slotWorld().z + 0.015));
        drag = { kind: "coin", coin: r.coin, m: m, plane: plane, home: r.coin.position.clone(), homeQ: r.coin.quaternion.clone() };
        W.scene.attach(r.coin);
        A.play("coinPickup");
      }
    } else if (r.type === "shirt" && S.table.shirt === r.shirt && S.table.step === "smooth" && S.station === "fold") {
      drag = { kind: "smooth", lx: e.clientX, ly: e.clientY };
      smoothHit(r.hit);
    } else if (S.lint.open && S.lint.amount > 0 && S.station === "dry") {
      drag = { kind: "lint", tab: r.type === "act" && r.act === "lintTab" };
      if (!drag.tab) {
        lintDragAt();
      }
    } else if (r.type === "shirt" && S.table.shirt === r.shirt && ["L", "R", "B"].indexOf(S.table.step) >= 0 && S.station === "fold") {
      drag = { kind: "fold", x: e.clientX, y: e.clientY };
    }
  });

  let hoverAt = 0;

  canvas.addEventListener("pointermove", function (e) {
    if (!S.started) {
      return;
    }
    setRay(e);
    if (down) {
      down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
    }
    if (drag && drag.kind === "pour") {
      if (!drag.started && down && down.moved > 10) {
        beginPour(drag);
      }
      if (drag.started) {
        movePour(drag);
      }
      return;
    }
    if (drag && drag.kind === "carry") {
      if (!drag.started && down && down.moved > 10) {
        beginCarry(drag);
      }
      if (drag.started) {
        moveCarry(drag, e);
      }
      return;
    }
    if (drag && drag.kind === "dial") {
      const a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
      const nearCentre = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) < 8;
      if (!drag.started && down && down.moved > 6) {
        // start measuring from here: the angle seen from a press on the knob centre is meaningless
        drag.started = true;
        drag.prevA = a;
      }
      if (drag.started && !nearCentre) {
        // accumulate the turn move by move so a half turn or more never wraps the wrong way
        let step = a - drag.prevA;
        step = Math.atan2(Math.sin(step), Math.cos(step));
        drag.prevA = a;
        drag.turned += step;
        // screen y points down, so a clockwise drag is a negative turn about the dial's axis
        const rot = Math.max(DIAL_ROT[3], Math.min(DIAL_ROT[0], drag.rot0 - drag.turned));
        drag.m.parts.dial.rotation.z = rot;
        const i = nearestDetent(rot);
        if (i !== drag.last) {
          drag.last = i;
          A.play("button", 0.4);
        }
      }
      return;
    }
    if (drag && drag.kind === "drawer") {
      const dr = MS.washer.parts.drawer;
      dr.position.z = Math.max(0, Math.min(DRAWER_OUT, drag.z0 + (e.clientY - drag.y0) * 0.0016));
      return;
    }
    if (drag && drag.kind === "coin") {
      const p = new T.Vector3();
      if (ray.ray.intersectPlane(drag.plane, p)) {
        drag.coin.position.copy(p);
        drag.coin.quaternion.copy(Q_FACE);
      }
      return;
    }
    if (drag && drag.kind === "smooth") {
      const s = S.table.shirt;
      if (s) {
        const hits = ray.intersectObjects(s.obj.pieces, false);
        if (hits.length) {
          smoothHit(hits[0]);
        }
      }
      const sp = Math.hypot(e.clientX - drag.lx, e.clientY - drag.ly) / 12;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      if (!hand) {
        hand = A.hand();
      }
      if (hand) {
        hand.set(sp);
      }
      return;
    }
    if (drag && drag.kind === "lint") {
      lintDragAt();
      return;
    }
    if (drag && drag.kind === "fold") {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 28) {
        drag = null;
        down = null;
        doFold();
      }
      return;
    }
    const now = performance.now();
    if (e.pointerType === "mouse" && now - hoverAt > 60) {
      hoverAt = now;
      const r = pick();
      canvas.style.cursor = r ? (r.type === "coin" ? "grab" : "pointer") : "default";
    }
  });

  function endPointer(e) {
    if (!S.started) {
      return;
    }
    if (hand) {
      hand.set(0);
    }
    if (drag && drag.kind === "pour") {
      const dg = drag;
      drag = null;
      if (dg.started) {
        finishPour(false);
      } else if (down && down.moved < 10 && e.type === "pointerup") {
        tap(down.r);
      }
      down = null;
      return;
    }
    if (drag && drag.kind === "carry") {
      const dg = drag;
      drag = null;
      if (dg.started) {
        dropCarry(dg, e);
      } else if (down && down.moved < 10 && e.type === "pointerup") {
        tap(down.r);
      }
      down = null;
      return;
    }
    if (drag && drag.kind === "dial") {
      const dg = drag;
      drag = null;
      if (dg.started) {
        setProg(dg.m, nearestDetent(dg.m.parts.dial.rotation.z));
        updateHUD();
      } else if (down && down.moved < 10 && e.type === "pointerup") {
        tap(down.r);
      }
      down = null;
      return;
    }
    if (drag && drag.kind === "drawer") {
      drag = null;
      if (down && down.moved < 8 && e.type === "pointerup") {
        tap(down.r);
      } else {
        setDrawer(MS.washer.parts.drawer.position.z > DRAWER_OUT / 2);
      }
      down = null;
      return;
    }
    if (drag && drag.kind === "coin") {
      const m = drag.m;
      const coin = drag.coin;
      const slot = m.parts.slotWorld();
      const dist = Math.hypot(coin.position.x - slot.x, coin.position.y - slot.y);
      if (down && down.moved < 8) {
        insertCoin(m, coin);
      } else if (dist < 0.05) {
        insertCoin(m, coin);
      } else {
        const p0 = coin.position.clone();
        const q0 = coin.quaternion.clone();
        m.parts.group.attach(coin);
        const local0 = coin.position.clone();
        const home = drag.home;
        void p0;
        void q0;
        const lq0 = coin.quaternion.clone();
        const hq = drag.homeQ;
        tween(0.35, function (k) {
          coin.position.lerpVectors(local0, home, k);
          coin.quaternion.slerpQuaternions(lq0, hq, k);
        }, function () {
          A.play("coinPickup");
        });
      }
      drag = null;
      down = null;
      return;
    }
    if (down && drag && drag.kind === "lint" && drag.tab && down.moved < 10 && e.type === "pointerup") {
      tap(down.r);
    } else if (down && !drag && down.moved < 10 && e.type === "pointerup") {
      tap(down.r);
    } else if (down && drag && drag.kind === "fold" && down.moved < 10) {
      tap(down.r);
    }
    drag = null;
    down = null;
  }

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  /* ---------- background life: someone else's wash and dry ---------- */
  const bg = [
    { m: makeMachineState("washerBg", W.washerBg, 2), kind: "washer" },
    { m: makeMachineState("dryerTop", W.dryerTop, 1), kind: "dryer" }
  ];
  bg.forEach(function (b, bi) {
    SH.randomSpecs(bi === 0 ? 3 : 4).forEach(function (spec) {
      const obj = SH.create(spec);
      const rec = { obj: obj, spec: spec, tumble: { phi: rand(-0.6, 0.6), r: rand(0.05, 0.1), z: rand(-0.07, 0.06), spin: rand(-1.2, 1.2), falling: false, k: rand(-0.3, 0.4) } };
      obj.root.scale.setScalar(0.72);
      obj.setWet(b.kind === "washer" ? 0.8 : 0);
      b.m.parts.clothes.add(obj.root);
      b.m.items.push(rec);
    });
    b.m.phase = "run";
    b.m.t = bi * 17;
  });

  function stepBackground(dt) {
    bg.forEach(function (b) {
      const m = b.m;
      m.t += dt;
      const target = b.kind === "washer" ? agitate(m.t) * 0.8 : 2.2;
      m.vel += (target - m.vel) * Math.min(1, dt * 2);
      m.ang += m.vel * dt;
      setDrumAngle(m.parts, m.ang);
      const fakeRun = m.phase;
      m.phase = "bg";
      tumble(m, dt, m.vel, 0);
      m.phase = fakeRun;
      if (b.kind === "washer") {
        const wu = m.parts.water.material.uniforms;
        wu.uLevel.value = -0.3;
        wu.uFoam.value = 0.7;
        wu.uSlosh.value = -m.vel * 0.04;
        m.parts.water.visible = true;
        const left = 1260 - (m.t % 1260);
        m.parts.display.set("WASH", fmtTime(left));
      } else {
        m.parts.warm.intensity = 0.5;
        m.parts.drumMats.forEach(function (mt) {
          mt.emissive.setRGB(0.3, 0.18, 0.12);
        });
        const left = 2040 - (m.t % 2040);
        m.parts.display.set("DRY", fmtTime(left));
      }
    });
  }

  /* ---------- machine displays and buttons ---------- */
  function displayFor(m) {
    const P = m.parts;
    let a;
    let b;
    let col = "#9be3b0";
    if (m.phase === "run") {
      a = { fill: "FILL", wash: "WASH", drain: "DRAIN", rinse: "RINSE", spin: "SPIN", dry: "DRY", cool: "COOL" }[m.ph] || "RUN";
      b = fmtTime(m.dur - m.t);
    } else if (performance.now() < (m.progShow || 0)) {
      a = progLcd(m);
      b = fmtTime(cycleFor(m));
      col = "#ffd27a";
    } else if (m.phase === "done") {
      a = "DONE";
      b = m.doorOpen ? "TAKE OUT" : "OPEN DOOR";
      col = "#ffd27a";
    } else if (m.doorOpen) {
      a = "OPEN";
      b = m.items.length ? m.items.length + " IN" : "LOAD";
    } else if (!m.items.length) {
      a = m.need + (m.need > 1 ? " COINS" : " COIN");
      b = "LOAD FIRST";
    } else if (m.key === "washer" && !m.soap) {
      a = "SOAP";
      b = "ADD DETERGENT";
    } else if (m.coins < m.need) {
      a = "INSERT";
      b = m.coins + "/" + m.need + " COIN";
    } else {
      a = "READY";
      b = "PRESS START";
    }
    P.display.set(a, b, col);
    const ready = m.phase === "idle" && m.coins >= m.need && m.items.length && !m.doorOpen;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    if (ready) {
      P.startMat.emissive.setRGB(0.1 * pulse, 0.55 * pulse, 0.25 * pulse);
    } else if (m.phase === "run") {
      P.startMat.emissive.setRGB(0.04, 0.25, 0.1);
    } else {
      P.startMat.emissive.setRGB(0, 0, 0);
    }
  }

  /* ---------- guide ring: where to tap next (appears after a short pause) ---------- */
  // where to look next, plus a short label for the in-world callout
  function guideTarget() {
    const st = S.station;
    const w = MS.washer;
    const d = MS.dryer;
    const bk = basketCounts();
    const v = new T.Vector3();
    S.guide = null;
    function at(key, who, obj) {
      S.guide = { key: key, who: who };
      return obj.getWorldPosition(v);
    }
    if (cam.moving || S.station === "sit") {
      return null;
    }
    if (st === "change") {
      if (S.changerBusy) {
        return null;
      }
      return S.trayCoins > 0 ? at("g_scoop", "", C.trayHit) : at("g_note", "", C.billHit);
    }
    if (st === "wash") {
      if (w.phase === "run" || w.busy) {
        return null;
      }
      if (w.phase === "done") {
        return w.doorOpen ? at("g_unload", "w", w.parts.drumHit) : at("g_open", "w", w.parts.doorHit);
      }
      if (w.doorOpen && bk.dirty > 0) {
        return at("g_load", "", W.basket.hit);
      }
      if (!w.items.length) {
        return bk.dirty > 0 ? at("g_open", "w", w.parts.doorHit) : null;
      }
      if (!w.soap) {
        return at("g_pour", "", w.parts.bottle).add(new T.Vector3(0, 0.09, 0));
      }
      if (w.doorOpen) {
        return at("g_close", "w", w.parts.doorHit);
      }
      if (w.coins < w.need) {
        return S.purse > 0 ? at("g_coin", "w", w.parts.slotHit) : null;
      }
      return at("g_start", "w", w.parts.start);
    }
    if (st === "dry") {
      if (S.lint.open || d.phase === "run" || d.busy) {
        return null;
      }
      if (d.phase === "done") {
        return d.doorOpen ? at("g_unload", "d", d.parts.drumHit) : at("g_open", "d", d.parts.doorHit);
      }
      if (bk.wet > 0 && d.items.length < 6 && (d.doorOpen || !d.items.length)) {
        return at("g_load_wet", "d", W.basket.hit);
      }
      if (d.items.length && d.doorOpen) {
        return at("g_close", "d", d.parts.doorHit);
      }
      if (d.items.length && d.coins < d.need) {
        return S.purse > 0 ? at("g_coin", "d", d.parts.slotHit) : null;
      }
      if (d.items.length) {
        return at("g_start", "d", d.parts.start);
      }
      if (S.lint.amount > 0) {
        return at("g_lint", "", LT.tabHit);
      }
      return null;
    }
    if (st === "hang") {
      const pending = S.line.find(function (s) {
        return s && s.hang && s.hang.pegs < 2;
      });
      if (pending) {
        return null;
      }
      const dry = S.line.find(function (s) {
        return s && s.state === "dry";
      });
      if (dry) {
        S.guide = { key: "g_unclip", who: "" };
        return dry.obj.root.localToWorld(v.set(0, 0.05, 0.02));
      }
      if (bk.wet > 0) {
        return at("g_take_wet", "", W.basket.hit);
      }
      return null;
    }
    if (st === "fold") {
      if (!S.table.shirt && bk.dry > 0) {
        return at("g_lay", "", W.basket.hit);
      }
      return null;
    }
    return null;
  }

  const callout = $("callout");
  const calloutPos = new T.Vector3();
  let calloutText = "";
  let calloutW = 0;

  function placeCallout(tgt, show) {
    if (!callout) {
      return;
    }
    const overlayOpen = !$("done").hidden;
    if (!show || !tgt || !S.guide || overlayOpen) {
      callout.classList.remove("on");
      return;
    }
    const who = S.guide.who === "w" ? t("ticket_washer") : S.guide.who === "d" ? t("ticket_dryer") : "";
    const text = (who ? who + " · " : "") + t(S.guide.key);
    if (text !== calloutText) {
      calloutText = text;
      callout.textContent = text;
      calloutW = callout.offsetWidth;
    }
    calloutPos.copy(tgt).project(W.camera);
    if (calloutPos.z > 1 || Math.abs(calloutPos.x) > 1.05 || Math.abs(calloutPos.y) > 1.05) {
      callout.classList.remove("on");
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const half = calloutW / 2 + 10;
    const x = Math.min(vw - half, Math.max(half, (calloutPos.x + 1) / 2 * vw));
    const y = (1 - calloutPos.y) / 2 * vh;
    // flip under the target when it sits close to the top HUD
    const below = y < 130;
    callout.classList.toggle("below", below);
    callout.style.transform = "translate(" + Math.round(x - calloutW / 2) + "px," + Math.round(below ? y + 26 : y - 58) + "px)";
    callout.classList.add("on");
  }

  /* Ghost fingertip: when a step needs a drag and the player has been idle, show the gesture on the object
     itself (coin -> slot, across the felt, across the shirt, sleeve -> middle). Taps keep the marker. */
  const cueEl = $("dragCue");
  const cueV = new T.Vector3();

  function dragCuePath() {
    const st = S.station;
    const s = S.table.shirt;
    if (st === "fold" && s && !S.table.folding) {
      const f = s.obj.flat;
      const at = function (x, y) {
        return f.localToWorld(new T.Vector3(x, y, 0.01));
      };
      if (S.table.step === "smooth") {
        return [at(-0.14, 0.1), at(0.14, -0.08)];
      }
      if (S.table.step === "L") {
        return [at(-0.24, 0.08), at(-0.04, 0.06)];
      }
      if (S.table.step === "R") {
        return [at(0.24, 0.08), at(0.04, 0.06)];
      }
      if (S.table.step === "B") {
        return [at(0, -0.24), at(0, -0.02)];
      }
      return null;
    }
    if (st === "dry" && S.lint.open && S.lint.amount > 0) {
      LT.feltMesh.updateWorldMatrix(true, false);
      return [LT.feltMesh.localToWorld(new T.Vector3(-0.1, 0.03, 0)), LT.feltMesh.localToWorld(new T.Vector3(0.1, -0.03, 0))];
    }
    if (st === "wash" || st === "dry") {
      const m = st === "wash" ? MS.washer : MS.dryer;
      const ready = m.phase === "idle" && m.items.length && !m.doorOpen && (st === "dry" || m.soap);
      if (ready && m.coins < m.need && m.parts.coins.length) {
        const coin = m.parts.coins[m.parts.coins.length - 1];
        coin.updateWorldMatrix(true, false);
        return [coin.getWorldPosition(new T.Vector3()), m.parts.slotWorld().clone()];
      }
    }
    return null;
  }

  function stepDragCue(sinceInput) {
    const path = !drag && sinceInput > (S.loadId <= 1 ? 1500 : 4200) ? dragCuePath() : null;
    if (!path) {
      if (cueEl.style.visibility !== "hidden") {
        cueEl.style.opacity = "0";
        cueEl.style.visibility = "hidden";
      }
      return;
    }
    // 1.9 s loop: press, glide, lift, pause
    const k = (performance.now() % 1900) / 1900;
    const glide = Math.min(1, Math.max(0, (k - 0.12) / 0.55));
    const eased = glide < 0.5 ? 2 * glide * glide : 1 - Math.pow(-2 * glide + 2, 2) / 2;
    cueV.copy(path[0]).lerp(path[1], eased);
    const p = screenOf(cueV);
    if (!p.onScreen) {
      cueEl.style.opacity = "0";
      cueEl.style.visibility = "hidden";
      return;
    }
    cueEl.style.visibility = "visible";
    const fade = k < 0.08 ? k / 0.08 : k > 0.78 ? Math.max(0, 1 - (k - 0.78) / 0.12) : 1;
    cueEl.style.transform = "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px) scale(" + (k > 0.1 && k < 0.7 ? 0.9 : 1) + ")";
    cueEl.style.opacity = (0.9 * fade).toFixed(2);
    cueEl.classList.toggle("press", k > 0.1 && k < 0.7);
  }

  function stepGuide() {
    const mk = W.marker;
    const sinceInput = performance.now() - S.lastInput;
    const tgt = guideTarget();
    stepDragCue(sinceInput);
    placeCallout(tgt, sinceInput > 650);
    const idle = sinceInput > (S.loadId <= 1 ? 1400 : 3500);
    if (!tgt || !idle) {
      mk.visible = false;
      return;
    }
    mk.visible = true;
    mk.position.copy(tgt);
    mk.quaternion.copy(W.camera.quaternion);
    const dist = W.camera.position.distanceTo(tgt);
    const pulse = 1 + Math.sin(performance.now() / 380) * 0.12;
    mk.scale.setScalar(dist * 0.13 * pulse);
    mk.material.opacity = 0.75;
  }

  /* ---------- HUD ---------- */
  const STATIONS = ["change", "wash", "dry", "hang", "fold", "sit"];

  function nextStation() {
    const w = MS.washer;
    const d = MS.dryer;
    const bk = basketCounts();
    if (allDone()) {
      return null;
    }
    if (S.trayCoins > 0) {
      return "change";
    }
    if (S.table.shirt) {
      return "fold";
    }
    if (S.line.some(function (s) {
      return s && s.hang && s.hang.pegs < 2;
    })) {
      return "hang";
    }
    if (w.phase === "done") {
      return "wash";
    }
    if (d.phase === "done") {
      return "dry";
    }
    if (S.line.some(function (s) {
      return s && s.state === "dry";
    })) {
      return "hang";
    }
    if (S.lint.open || (S.lint.amount > 0 && d.phase === "idle" && !d.items.length)) {
      return "dry";
    }
    if (w.phase === "idle" && (w.items.length || bk.dirty > 0)) {
      return S.purse < w.need - w.coins ? "change" : "wash";
    }
    if (d.phase === "idle" && d.items.length) {
      return S.purse < d.need - d.coins ? "change" : "dry";
    }
    if (bk.wet === 0 && bk.dry > 0) {
      return "fold";
    }
    if (bk.wet > 0) {
      const lineCount = S.line.filter(Boolean).length;
      const free = lineCount < 4;
      if (free && (lineCount < 2 || S.purse < 1 || d.phase !== "idle")) {
        return "hang";
      }
      if (d.phase === "idle") {
        return S.purse < 1 ? "change" : "dry";
      }
      return free ? "hang" : "sit";
    }
    if (bk.dry > 0) {
      return "fold";
    }
    if (w.phase === "run" || d.phase === "run" || S.line.some(Boolean)) {
      return "sit";
    }
    return null;
  }

  function stationHint() {
    const st = S.station;
    const w = MS.washer;
    const d = MS.dryer;
    const bk = basketCounts();
    const next = nextStation();
    const goNext = function () {
      if (!next) {
        return t("h_all_done");
      }
      if (next === "sit") {
        return t("h_wait");
      }
      return t("h_go", { st: t("st_" + next) });
    };
    // while this station only waits, point at the job the red underline marks;
    // the timer itself lives on the ticket, so the hint does not repeat it
    const whileWaiting = function (line) {
      if (next && next !== "sit" && next !== st) {
        return line + " " + t("h_meanwhile", { st: t("st_" + next) });
      }
      return line;
    };
    if (allDone()) {
      return t("h_all_done");
    }
    if (st === "overview") {
      return S.purse === 0 && S.trayCoins === 0 && w.phase === "idle" && !w.items.length ? t("h_welcome") : goNext();
    }
    if (st === "sit") {
      return t("h_sit");
    }
    if (st === "change") {
      if (S.changerBusy) {
        return t("h_feeding");
      }
      if (S.trayCoins > 0) {
        return t("h_collect");
      }
      if (S.purse >= 2 && next && next !== "change") {
        return t("h_have_coins", { n: S.purse });
      }
      return t("h_feed");
    }
    if (st === "wash") {
      if (w.phase === "run") {
        return whileWaiting(t("h_washing", { phase: t("ph_" + w.ph) }));
      }
      if (w.phase === "done") {
        return w.doorOpen ? t("h_unload", { n: w.items.length }) : t("h_wash_done");
      }
      if (w.doorOpen) {
        if (bk.dirty > 0 && w.items.length < 6) {
          return t("h_load", { n: bk.dirty });
        }
        if (w.items.length && !w.soap) {
          return t("h_soap");
        }
        if (w.items.length) {
          return t("h_close");
        }
        return goNext();
      }
      if (!w.items.length) {
        return bk.dirty > 0 ? t("h_open_washer") : goNext();
      }
      if (!w.soap) {
        return t("h_soap");
      }
      if (w.coins < w.need) {
        return S.purse > 0 ? t("h_coins", { have: w.coins, need: w.need }) : t("h_nocoins");
      }
      return t("h_start");
    }
    if (st === "dry") {
      if (S.lint.open) {
        return t("h_lint_peel");
      }
      if (d.phase === "run") {
        return whileWaiting(t("h_drying", { phase: t("ph_" + d.ph) }));
      }
      if (d.phase === "done") {
        return d.doorOpen ? t("h_unload", { n: d.items.length }) : t("h_dry_done");
      }
      if (bk.wet > 0 && d.items.length < 6 && (d.doorOpen || !d.items.length)) {
        return d.items.length ? t("h_dry_load") + " " + t("h_dry_close") : t("h_dry_load");
      }
      if (d.items.length && d.doorOpen) {
        return t("h_dry_close");
      }
      if (d.items.length) {
        if (d.coins < d.need) {
          return S.purse > 0 ? t("h_coins", { have: d.coins, need: d.need }) : t("h_nocoins");
        }
        return t("h_start");
      }
      if (S.lint.amount > 0) {
        return t("h_lint");
      }
      return goNext();
    }
    if (st === "hang") {
      if (S.line.some(function (s) {
        return s && s.hang && s.hang.pegs < 2;
      })) {
        return t("h_peg");
      }
      if (S.line.some(function (s) {
        return s && s.state === "dry";
      })) {
        return t("h_takedown");
      }
      if (bk.wet > 0 && S.line.some(function (s) {
        return !s;
      })) {
        return t("h_hang_take");
      }
      if (S.line.some(function (s) {
        return s && s.state === "wet";
      })) {
        return whileWaiting(t("h_hang_drying"));
      }
      return goNext();
    }
    if (st === "fold") {
      const s = S.table.shirt;
      if (s) {
        if (S.table.step === "smooth") {
          return t("h_smooth");
        }
        if (S.table.step === "L" || S.table.step === "R" || S.table.step === "B") {
          return t("h_fold_" + S.table.step);
        }
        return "";
      }
      if (bk.dry > 0) {
        return t("h_lay");
      }
      return goNext();
    }
    return "";
  }

  const TEE = "M9 3 L3.5 6.2 L5.6 10.4 L8 9.4 L8 21 L16 21 L16 9.4 L18.4 10.4 L20.5 6.2 L15 3 Q12 5.6 9 3 Z";
  let lastLoadSig = "";
  let lastTicketSig = "";

  let lastLoadStates = null;

  function renderLoad() {
    const ls = loadShirts();
    const sig = lang + ls.map(function (s) {
      return s.state;
    }).join(",");
    if (sig === lastLoadSig) {
      return;
    }
    lastLoadSig = sig;
    const prev = lastLoadStates;
    lastLoadStates = ls.map(function (s) {
      return s.state;
    });
    $("loadList").innerHTML = ls.map(function (s, i) {
      // a shirt whose state just changed gets a short pop so progress reads at a glance
      const just = prev && prev.length === ls.length && prev[i] !== s.state ? " just" : "";
      const col = s.spec.color.base;
      let badge = "";
      if (s.state === "dirty") {
        badge = '<circle cx="11" cy="14" r="1.3" fill="#7a5a34"/><circle cx="14" cy="17" r="1" fill="#7a5a34"/>';
      } else if (s.state === "wet") {
        badge = '<path d="M19 13c0 0-2.6 3-2.6 4.6a2.6 2.6 0 0 0 5.2 0C21.6 16 19 13 19 13z" fill="#4f8fb8" stroke="#fff" stroke-width=".8"/>';
      } else if (s.state === "dry") {
        badge = '<path d="M16.4 18.6c1-.9 1.9.9 2.9 0s1.9.9 2.9 0M16.4 15.6c1-.9 1.9.9 2.9 0s1.9.9 2.9 0" fill="none" stroke="#c8752c" stroke-width="1.3" stroke-linecap="round"/>';
      } else if (s.state === "folded") {
        badge = '<path d="M15.5 17.5l2 2 4-4.5" fill="none" stroke="#3b8f5c" stroke-width="2" stroke-linecap="round"/>';
      }
      // a short printed word under each tee, so the state never depends on decoding a glyph
      return '<li class="st-' + s.state + just + '" title="' + t("state_" + s.state) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + TEE + '" fill="' + col + '" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>' + badge + '</svg><span class="ls" aria-hidden="true">' + t("ls_" + s.state) + '</span><span class="sr">' + t("state_" + s.state) + "</span></li>";
    }).join("");
    const counts = {};
    const order = [];
    ls.forEach(function (s) {
      if (!counts[s.state]) {
        counts[s.state] = 0;
        order.push(s.state);
      }
      counts[s.state] += 1;
    });
    $("loadSum").textContent = order.map(function (k) {
      return counts[k] + " " + t("state_" + k);
    }).join(" \u00b7 ");
    $("load").setAttribute("aria-label", t("load") + ": " + ls.map(function (s) {
      return t("state_" + s.state);
    }).join(", "));
  }

  function renderTickets() {
    const items = [];
    const w = MS.washer;
    const d = MS.dryer;
    if (w.phase === "run") {
      items.push([t("ticket_washer"), t("ph_" + w.ph), fmtTime(w.dur - w.t), w.t / w.dur]);
    } else if (w.phase === "done") {
      items.push([t("ticket_washer"), t("ph_done"), "", 1]);
    }
    if (d.phase === "run") {
      items.push([t("ticket_dryer"), t("ph_" + d.ph), fmtTime(d.dur - d.t), d.t / d.dur]);
    } else if (d.phase === "done") {
      items.push([t("ticket_dryer"), t("ph_done"), "", 1]);
    }
    const hung = S.line.filter(function (s) {
      return s && s.hang && s.hang.pegs >= 2;
    });
    if (hung.length) {
      const dryN = hung.filter(function (s) {
        return s.state === "dry";
      }).length;
      const prog = hung.reduce(function (a, s) {
        return a + Math.min(1, s.hang.dry);
      }, 0) / hung.length;
      const left = Math.max.apply(null, hung.map(function (s) {
        return Math.max(0, 1 - s.hang.dry) * S.cycle * 0.9;
      }));
      items.push([t("ticket_line"), dryN + "/" + hung.length + " " + t("state_dry"), left > 0 ? fmtTime(left) : "", prog]);
    }
    const sig = JSON.stringify(items);
    if (sig === lastTicketSig) {
      return;
    }
    lastTicketSig = sig;
    $("tickets").innerHTML = items.map(function (it) {
      return '<div class="tk"><div class="tk-top"><span>' + it[0] + '</span><span class="tk-time">' + it[2] + '</span></div><div class="tk-phase">' + it[1] + '</div><div class="tk-bar"><i style="width:' + Math.round(it[3] * 100) + '%"></i></div></div>';
    }).join("");
  }

  function updateHUD() {
    if (!S.started) {
      return;
    }
    $("purseText").textContent = S.purse === 1 ? t("coin1") : t("coins", { n: S.purse });
    let text = stationHint();
    if (S.toast && performance.now() < S.toast.until) {
      text = S.toast.text;
    }
    if (hintEl.textContent !== text) {
      hintEl.textContent = text;
    }
    hintEl.hidden = !text;
    const next = nextStation();
    document.querySelectorAll("#stations button").forEach(function (b) {
      const st = b.getAttribute("data-st");
      b.setAttribute("aria-current", String(st === S.station));
      // red underline only for a real task; "sit" while machines run gets a quiet dotted mark
      b.classList.toggle("next", st === next && st !== S.station && next !== "sit");
      b.classList.toggle("wait", st === next && st !== S.station && next === "sit");
    });
    renderLoad();
    renderTickets();
  }

  /* ---------- settings ---------- */
  function setTheme(th) {
    theme = th;
    store.set("theme", th);
    document.documentElement.dataset.theme = th;
    document.querySelector('meta[name="theme-color"]').setAttribute("content", th === "day" ? "#e9e4d8" : "#151d20");
    W.setTheme(th);
    SH.setBacklight(th === "day" ? 0.2 : 0.04);
    if (A.ready()) {
      A.setAmbient(th);
    }
    document.querySelectorAll("[data-theme-set]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-theme-set") === th));
    });
  }

  function setLang(l) {
    lang = l;
    store.set("lang", l);
    applyI18n();
    W.setLang();
    lastLoadSig = "";
    lastTicketSig = "";
    updateHUD();
  }

  function setCycle(sec) {
    S.cycle = sec;
    store.set("cycle", sec);
    document.querySelectorAll("[data-cycle]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-cycle")) === sec));
    });
  }

  let savedVol = Number(store.get("vol"));
  if (!(savedVol >= 0 && savedVol <= 1) || store.get("vol") === null) {
    savedVol = 0.8;
  }
  A.setVolume(savedVol);
  $("vol").value = String(savedVol);

  $("vol").addEventListener("input", function (e) {
    const v = Number(e.target.value);
    A.setVolume(v);
    store.set("vol", v);
    $("btnSound").classList.toggle("muted", v === 0);
  });

  $("btnSound").addEventListener("click", function () {
    const v = A.getVolume() > 0 ? 0 : Number(store.get("vol")) || 0.8;
    A.setVolume(v);
    $("btnSound").classList.toggle("muted", v === 0);
    $("vol").value = String(v);
    if (v > 0) {
      A.init();
    }
  });

  $("btnSettings").addEventListener("click", function () {
    const s = $("settings");
    s.hidden = !s.hidden;
    $("btnSettings").setAttribute("aria-expanded", String(!s.hidden));
  });

  document.addEventListener("click", function (e) {
    const tb = e.target.closest("[data-theme-set]");
    if (tb) {
      setTheme(tb.getAttribute("data-theme-set"));
    }
    const lb = e.target.closest("[data-lang]");
    if (lb) {
      setLang(lb.getAttribute("data-lang"));
    }
    const cb = e.target.closest("[data-cycle]");
    if (cb) {
      setCycle(Number(cb.getAttribute("data-cycle")));
    }
    const sb = e.target.closest("[data-st]");
    if (sb) {
      go(sb.getAttribute("data-st"));
    }
    const s = $("settings");
    if (!s.hidden && !e.target.closest("#settings") && !e.target.closest("#btnSettings")) {
      s.hidden = true;
      $("btnSettings").setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", function (e) {
    if (!S.started) {
      return;
    }
    if (e.key === "Escape") {
      $("settings").hidden = true;
      if (S.station === "sit") {
        go("overview");
      }
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 6 && !e.target.closest("input")) {
      go(STATIONS[n - 1]);
    }
  });

  $("btnStand").addEventListener("click", function () {
    go(nextStation() && nextStation() !== "sit" ? nextStation() : "overview");
  });
  $("btnAgain").addEventListener("click", anotherLoad);
  $("btnStay").addEventListener("click", function () {
    $("done").hidden = true;
    document.body.classList.remove("done-open");
    go("sit");
  });

  $("btnStart").addEventListener("click", function () {
    A.init();
    A.setVolume(A.getVolume());
    A.setAmbient(theme);
    $("intro").hidden = true;
    S.started = true;
    S.lastInput = performance.now();
    updateHUD();
    later(1.0, function () {
      if (S.station === "overview") {
        go("change");
      }
    });
  });

  /* ---------- main loop ---------- */
  function stepSim(dt) {
    stepWasher(MS.washer, dt);
    stepDryer(MS.dryer, dt);
    stepLine(dt);
  }

  let last = performance.now();
  let hudT = 0;
  let clockT = 0;
  let perf = { t: 0, frames: 0, degraded: false };

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (document.hidden) {
      return;
    }
    stepTweens(dt);
    stepPour(dt);
    stepSim(dt);
    stepBackground(dt);
    stepDrips(dt);
    syncDish(MS.washer);
    syncDish(MS.dryer);
    displayFor(MS.washer);
    displayFor(MS.dryer);
    placeArrow();
    updateCamera(dt);
    stepGuide();
    const tt = now / 1000;
    MS.washer.parts.water.material.uniforms.uTime.value = tt;
    W.washerBg.water.material.uniforms.uTime.value = tt;
    W.rain.material.uniforms.uTime.value = tt;
    W.stepPuffs(dt);
    clockT += dt;
    if (clockT > 1) {
      clockT = 0;
      W.redraw(W.clockTex);
    }
    hudT += dt;
    if (hudT > 0.25) {
      hudT = 0;
      updateHUD();
    }
    perf.t += dt;
    perf.frames += 1;
    if (perf.t > 3) {
      const fps = perf.frames / perf.t;
      if (fps < 26 && !perf.degraded && !window.__bilasTest) {
        perf.degraded = true;
        W.renderer.setPixelRatio(1);
        W.renderer.shadowMap.enabled = false;
        resize();
      }
      perf.t = 0;
      perf.frames = 0;
    }
    W.renderer.render(W.scene, W.camera);
  }

  window.addEventListener("resize", resize);
  setTheme(theme);
  setCycle(S.cycle);
  applyI18n();
  newLoad();
  const startView = targetOf("overview");
  cam.pos.copy(startView.pos);
  cam.look.copy(startView.look);
  resize();
  requestAnimationFrame(frame);

  /* ---------- test hooks (used by tests/check.py) ---------- */
  function screenOf(v) {
    const r = canvas.getBoundingClientRect();
    const p = v.clone().project(W.camera);
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, onScreen: p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 };
  }

  window.__bilas = {
    hq: function (on) {
      W.renderer.setPixelRatio(on ? Math.min(window.devicePixelRatio || 1, 2) : 0.5);
      if (W.renderer.shadowMap.enabled !== on) {
        W.renderer.shadowMap.enabled = on;
        W.scene.traverse(function (o) {
          if (o.material) {
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
              m.needsUpdate = true;
            });
          }
        });
      }
      resize();
    },
    pickAt: function (x, y) {
      setRay({ clientX: x, clientY: y });
      const r = pick();
      return r ? { type: r.type, act: r.act || null, st: r.st || null, obj: r.hit ? (r.hit.object.name || r.hit.object.type) : null } : null;
    },
    S: S,
    MS: MS,
    go: go,
    idle: function () {
      return !cam.moving && !tweens.some(function (tw) {
        return tw.dur > 0 && tw.t < tw.dur;
      });
    },
    ff: function (sec) {
      for (let i = 0; i < sec * 10; i++) {
        stepSim(0.1);
      }
      updateHUD();
    },
    fired: function () {
      return Array.from(A.fired);
    },
    hint: function () {
      return hintEl.textContent;
    },
    counts: function () {
      return {
        purse: S.purse,
        folded: loadShirts().filter(function (s) {
          return s.state === "folded";
        }).length,
        states: loadShirts().map(function (s) {
          return s.state + "@" + s.loc;
        })
      };
    },
    screen: function (name) {
      const v = new T.Vector3();
      const m = name.indexOf("dryer") === 0 ? MS.dryer : MS.washer;
      const P = m.parts;
      if (name.indexOf("tablePoint:") === 0) {
        const xy = name.split(":")[1].split(",").map(Number);
        const s = S.table.shirt;
        return s ? screenOf(s.obj.flat.localToWorld(v.set(xy[0], xy[1], 0.01))) : null;
      }
      if (name.indexOf("lintPoint:") === 0) {
        const xy = name.split(":")[1].split(",").map(Number);
        return screenOf(LT.feltMesh.localToWorld(v.set(xy[0], xy[1], 0)));
      }
      const map = {
        bill: C.billHit,
        tray: C.trayHit,
        basket: W.basket.hit,
        washerDoor: W.washer.doorHit,
        washerDrum: W.washer.drumHit,
        soap: W.washer.bottle,
        washerSlot: W.washer.slotHit,
        washerStart: W.washer.start,
        washerDial: W.washer.knob,
        dryerDial: W.dryer.knob,
        washerKnob: W.washer.knob,
        dryerKnob: W.dryer.knob,
        drawer: W.washer.drawer,
        dryerDoor: W.dryer.doorHit,
        dryerDrum: W.dryer.drumHit,
        dryerSlot: W.dryer.slotHit,
        dryerStart: W.dryer.start,
        lintTab: LT.tabHit
      };
      if (name === "washerCoin" || name === "dryerCoin") {
        const c = P.coins[P.coins.length - 1];
        return c ? screenOf(c.getWorldPosition(v)) : null;
      }
      if (name === "peg") {
        for (let i = 0; i < 4; i++) {
          const s = S.line[i];
          if (s && s.hang) {
            const mk = s.hang.markers.find(function (x) {
              return x.parent;
            });
            if (mk) {
              return screenOf(mk.getWorldPosition(v));
            }
          }
        }
        return null;
      }
      if (name.indexOf("basketShirt:") === 0) {
        const want = name.split(":")[1];
        const s = basketShirts().find(function (x) {
          return x.state === want && !x.flying;
        });
        return s ? screenOf(s.obj.root.getWorldPosition(v)) : null;
      }
      if (name === "washerClothes" || name === "dryerClothes") {
        return screenOf(m.parts.clothes.getWorldPosition(v));
      }
      if (name === "pourTarget") {
        return screenOf(W.washer.group.localToWorld(v.set(POUR_AT.x, POUR_AT.y + 0.05, POUR_AT.z)));
      }
      if (name === "lineShirtDry") {
        const s = S.line.find(function (x) {
          return x && x.state === "dry";
        });
        return s ? screenOf(s.obj.root.localToWorld(v.set(0, 0.0, 0.01))) : null;
      }
      if (name === "soap") {
        return screenOf(W.washer.bottle.getWorldPosition(v).add(new T.Vector3(0, 0.09, 0)));
      }
      const o = map[name];
      return o ? screenOf(o.getWorldPosition(v)) : null;
    }
  };
})();
