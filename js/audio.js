/* Bilas audio: every sound is synthesized with Web Audio. No files, no network. */
(function () {
  "use strict";
  const A = {};
  window.BilasAudio = A;

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let ambBus = null;
  let noiseBuf = null;
  let brownBuf = null;
  let ambient = null;
  let volume = 0.8;

  A.fired = new Set();
  A.log = [];

  function mark(id) {
    A.fired.add(id);
    A.log.push(id);
    if (A.log.length > 400) {
      A.log.shift();
    }
  }

  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }

  function makeNoise(seconds, brown) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        d[i] = w;
      }
    }
    return buf;
  }

  /* iOS: "suspended" after backgrounding, "interrupted" after a call or Siri.
     Any user gesture or return to the page wakes the context again. */
  function wake() {
    if (ctx && ctx.state !== "running" && ctx.state !== "closed") {
      const p = ctx.resume();
      if (p && p.catch) {
        p.catch(function () {});
      }
    }
  }

  A.init = function () {
    if (ctx) {
      wake();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      return false;
    }
    /* Safari 16.4+: play through the ring/silent switch like a music app. */
    try {
      if (navigator.audioSession) {
        navigator.audioSession.type = "playback";
      }
    } catch (e) {
      /* older browsers: no audio session API */
    }
    ctx = new AC();
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        wake();
      }
    });
    window.addEventListener("pointerdown", wake, true);
    window.addEventListener("pageshow", wake);
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    master.connect(comp);
    comp.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    ambBus = ctx.createGain();
    ambBus.gain.value = 0.9;
    ambBus.connect(master);
    noiseBuf = makeNoise(3, false);
    brownBuf = makeNoise(4, true);
    return true;
  };

  A.ready = function () {
    return !!ctx;
  };

  A.setVolume = function (v) {
    volume = v;
    if (master) {
      master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    }
  };

  A.getVolume = function () {
    return volume;
  };

  /* ---------- building blocks ---------- */

  function now() {
    return ctx.currentTime;
  }

  function gainEnv(t, attack, decay, peak, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest || sfxBus);
    return g;
  }

  function tone(opts) {
    const t = opts.t;
    const o = ctx.createOscillator();
    o.type = opts.type || "sine";
    o.frequency.setValueAtTime(opts.f, t);
    if (opts.f2) {
      o.frequency.exponentialRampToValueAtTime(opts.f2, t + (opts.glide || opts.decay));
    }
    const g = gainEnv(t, opts.attack || 0.002, opts.decay, opts.peak, opts.dest);
    o.connect(g);
    o.start(t);
    o.stop(t + (opts.attack || 0.002) + opts.decay + 0.05);
  }

  function noise(opts) {
    const t = opts.t;
    const s = ctx.createBufferSource();
    s.buffer = opts.brown ? brownBuf : noiseBuf;
    s.playbackRate.value = opts.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter || "bandpass";
    f.frequency.setValueAtTime(opts.f, t);
    if (opts.f2) {
      f.frequency.exponentialRampToValueAtTime(opts.f2, t + opts.attack + opts.decay);
    }
    f.Q.value = opts.q || 1;
    const g = gainEnv(t, opts.attack || 0.003, opts.decay, opts.peak, opts.dest);
    s.connect(f);
    f.connect(g);
    const off = Math.random() * 2;
    s.start(t, off);
    s.stop(t + (opts.attack || 0.003) + opts.decay + 0.05);
  }

  function clink(t, scale) {
    const k = scale || 1;
    const base = rnd(0.96, 1.05);
    [2630, 4170, 5590, 7350].forEach(function (f, i) {
      tone({ t: t, f: f * base, decay: 0.5 - i * 0.09, peak: 0.05 * k / (i * 0.6 + 1) });
    });
    noise({ t: t, f: 6000, q: 0.8, decay: 0.012, peak: 0.05 * k, filter: "highpass" });
  }

  function click(t, f, peak) {
    noise({ t: t, f: f || 3500, q: 3, decay: 0.008, peak: peak || 0.12 });
  }

  function thud(t, peak, f) {
    tone({ t: t, f: f || 110, f2: 45, decay: 0.16, peak: peak || 0.25 });
    noise({ t: t, f: 320, q: 0.7, decay: 0.08, peak: (peak || 0.25) * 0.5, filter: "lowpass" });
  }

  /* ---------- one-shot sounds (each has an id for the coverage gate) ---------- */

  const S = {};

  S.coinDrop = function (t) {
    clink(t, 1);
    clink(t + rnd(0.07, 0.1), 0.45);
    clink(t + rnd(0.15, 0.19), 0.2);
  };

  S.coinSlot = function (t) {
    clink(t, 0.8);
    let dt = 0.06;
    let tt = t + 0.05;
    for (let i = 0; i < 6; i++) {
      click(tt, rnd(2600, 4200), 0.06 * (1 - i * 0.1));
      tt += dt;
      dt *= 0.82;
    }
    thud(tt + 0.03, 0.12, 160);
  };

  S.coinPickup = function (t) {
    clink(t, 0.35);
    noise({ t: t, f: 1800, q: 1.2, decay: 0.05, peak: 0.03 });
  };

  S.billFeed = function (t) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 118;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.08);
    g.gain.setValueAtTime(0.05, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(lp);
    lp.connect(g);
    g.connect(sfxBus);
    o.start(t);
    o.stop(t + 1.2);
    noise({ t: t, f: 2400, q: 0.9, attack: 0.05, decay: 0.9, peak: 0.05 });
  };

  S.coinCascade = function (t) {
    for (let i = 0; i < 4; i++) {
      S.coinDrop(t + i * 0.2 + rnd(0, 0.04));
    }
  };

  S.coinScoop = function (t) {
    for (let i = 0; i < 9; i++) {
      clink(t + rnd(0, 0.32), rnd(0.15, 0.35));
    }
    noise({ t: t, f: 1500, q: 0.8, attack: 0.02, decay: 0.25, peak: 0.04 });
  };

  S.beep = function (t) {
    tone({ t: t, f: 2093, type: "square", decay: 0.07, peak: 0.025 });
  };

  S.startBeep = function (t) {
    tone({ t: t, f: 1568, type: "square", decay: 0.07, peak: 0.025 });
    tone({ t: t + 0.12, f: 2093, type: "square", decay: 0.1, peak: 0.025 });
  };

  S.doorOpen = function (t) {
    click(t, 4200, 0.15);
    noise({ t: t + 0.02, f: 700, q: 0.8, decay: 0.12, peak: 0.08, filter: "lowpass" });
    tone({ t: t + 0.03, f: 90, f2: 55, decay: 0.15, peak: 0.12 });
  };

  S.doorClose = function (t) {
    thud(t, 0.3, 120);
    click(t + 0.05, 4500, 0.18);
    click(t + 0.08, 2800, 0.1);
  };

  S.clothIn = function (t) {
    noise({ t: t, f: 1400, f2: 450, q: 0.9, attack: 0.04, decay: 0.22, peak: 0.12 });
    thud(t + 0.24, 0.12, 90);
  };

  S.clothOut = function (t) {
    noise({ t: t, f: 500, f2: 1300, q: 0.9, attack: 0.04, decay: 0.2, peak: 0.1 });
    noise({ t: t + 0.05, f: 900, q: 2, decay: 0.08, peak: 0.05 });
  };

  S.wetSlap = function (t) {
    noise({ t: t, f: 1100, q: 0.7, attack: 0.002, decay: 0.09, peak: 0.16 });
    noise({ t: t + 0.01, f: 2600, q: 4, decay: 0.05, peak: 0.05 });
  };

  S.pour = function (t) {
    noise({ t: t, f: 1900, q: 0.6, attack: 0.15, decay: 1.2, peak: 0.035 });
    for (let i = 0; i < 9; i++) {
      const tt = t + 0.1 + i * rnd(0.1, 0.14);
      noise({ t: tt, f: rnd(260, 520), q: 9, decay: 0.07, peak: 0.12 });
    }
  };

  S.button = function (t) {
    click(t, 2400, 0.12);
    click(t + 0.03, 1600, 0.06);
  };

  S.chime = function (t) {
    [[1046.5, 0], [880, 0.32], [698.5, 0.64]].forEach(function (n) {
      tone({ t: t + n[1], f: n[0], decay: 1.3, peak: 0.07 });
      tone({ t: t + n[1], f: n[0] * 2.01, decay: 0.6, peak: 0.015 });
    });
  };

  S.flap = function (t) {
    noise({ t: t, f: 900, q: 0.9, attack: 0.004, decay: 0.1, peak: 0.2 });
    noise({ t: t + 0.11, f: 1200, q: 0.9, attack: 0.004, decay: 0.07, peak: 0.1 });
  };

  S.peg = function (t) {
    click(t, 2900, 0.16);
    click(t + 0.035, 1900, 0.1);
    tone({ t: t, f: 1300, f2: 900, decay: 0.03, peak: 0.03 });
  };

  S.pegOff = function (t) {
    click(t, 2200, 0.12);
    click(t + 0.05, 3200, 0.08);
  };

  S.drip = function (t) {
    const f = rnd(1100, 1700);
    tone({ t: t, f: f, f2: f * 0.45, decay: 0.06, peak: 0.035 });
  };

  S.swish = function (t) {
    noise({ t: t, f: 700, f2: 2400, q: 0.8, attack: 0.08, decay: 0.28, peak: 0.08 });
  };

  S.pat = function (t) {
    noise({ t: t, f: 500, q: 0.6, attack: 0.002, decay: 0.07, peak: 0.12, filter: "lowpass" });
    tone({ t: t, f: 140, f2: 70, decay: 0.07, peak: 0.08 });
  };

  S.stack = function (t) {
    thud(t, 0.1, 100);
    noise({ t: t, f: 1000, q: 0.7, decay: 0.08, peak: 0.05 });
  };

  S.lintPull = function (t) {
    noise({ t: t, f: 3000, q: 0.6, attack: 0.05, decay: 0.2, peak: 0.05 });
    click(t + 0.22, 2600, 0.1);
  };

  S.lintPeel = function (t) {
    for (let i = 0; i < 7; i++) {
      noise({ t: t + rnd(0, 0.1), f: rnd(3000, 7000), q: 2, decay: 0.006, peak: rnd(0.02, 0.06) });
    }
    noise({ t: t, f: 4500, q: 0.7, decay: 0.12, peak: 0.02 });
  };

  S.smooth = function (t, k) {
    noise({ t: t, f: rnd(1800, 2600), q: 1.1, attack: 0.03, decay: 0.12, peak: 0.03 * (k || 1) });
  };

  S.thump = function (t, k) {
    tone({ t: t, f: 75, f2: 42, decay: 0.14, peak: 0.12 * (k || 1) });
    noise({ t: t, f: 240, q: 0.7, decay: 0.08, peak: 0.06 * (k || 1), filter: "lowpass" });
    if (Math.random() < 0.3) {
      click(t + 0.02, 3000, 0.04 * (k || 1));
    }
  };

  S.drain = function (t) {
    for (let i = 0; i < 14; i++) {
      noise({ t: t + i * rnd(0.08, 0.16), f: rnd(180, 420), q: 7, decay: 0.09, peak: 0.07 });
    }
  };

  S.raindrop = function (t) {
    tone({ t: t, f: rnd(2500, 4200), f2: 1800, decay: 0.03, peak: 0.008, dest: ambBus });
  };

  S.bird = function (t) {
    const base = rnd(3200, 4400);
    for (let i = 0; i < 3; i++) {
      tone({ t: t + i * 0.11, f: base, f2: base * 1.35, decay: 0.07, glide: 0.06, peak: 0.012, dest: ambBus });
    }
  };

  A.play = function (id, arg) {
    if (!ctx || !S[id]) {
      return;
    }
    mark(id);
    S[id](now() + 0.01, arg);
  };

  /* ---------- continuous loops (machines) ---------- */

  function loopNoise(filterType, f, q, brown) {
    const s = ctx.createBufferSource();
    s.buffer = brown ? brownBuf : noiseBuf;
    s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = filterType;
    fl.frequency.value = f;
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(fl);
    fl.connect(g);
    g.connect(sfxBus);
    s.start(0, Math.random() * 2);
    return { src: s, filter: fl, gain: g };
  }

  function loopOsc(type, f) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(lp);
    lp.connect(g);
    g.connect(sfxBus);
    o.start();
    return { osc: o, filter: lp, gain: g };
  }

  /* Washer: water inflow, sloshing, motor hum, spin whine. Driven every frame by set(). */
  A.washer = function () {
    if (!ctx) {
      return null;
    }
    mark("washLoop");
    const fill = loopNoise("lowpass", 1600, 0.5, false);
    const slosh = loopNoise("lowpass", 520, 1.2, true);
    const hum = loopOsc("sine", 55);
    const whine = loopOsc("sawtooth", 80);
    const air = loopNoise("bandpass", 900, 0.6, false);
    let alive = true;
    return {
      set: function (p) {
        if (!alive) {
          return;
        }
        const t = now();
        const v = p.near;
        fill.gain.gain.setTargetAtTime(p.fill * 0.05 * v, t, 0.2);
        slosh.gain.gain.setTargetAtTime(p.slosh * 0.5 * v, t, 0.08);
        slosh.filter.frequency.setTargetAtTime(380 + p.slosh * 500, t, 0.1);
        hum.gain.gain.setTargetAtTime((p.run ? 0.025 : 0) * v, t, 0.3);
        whine.gain.gain.setTargetAtTime(p.spin * 0.03 * v, t, 0.3);
        whine.osc.frequency.setTargetAtTime(70 + p.spin * 520, t, 0.6);
        whine.filter.frequency.setTargetAtTime(300 + p.spin * 1400, t, 0.6);
        air.gain.gain.setTargetAtTime(p.spin * 0.03 * v, t, 0.4);
      },
      stop: function () {
        alive = false;
        const t = now();
        [fill, slosh, hum, whine, air].forEach(function (n) {
          n.gain.gain.setTargetAtTime(0, t, 0.15);
        });
        setTimeout(function () {
          [fill, slosh, air].forEach(function (n) {
            n.src.stop();
          });
          [hum, whine].forEach(function (n) {
            n.osc.stop();
          });
        }, 1500);
      }
    };
  };

  /* Dryer: warm air rumble and motor; thumps are fired by the app as clothes fall. */
  A.dryer = function () {
    if (!ctx) {
      return null;
    }
    mark("dryLoop");
    const rumble = loopNoise("lowpass", 260, 0.7, true);
    const airflow = loopNoise("bandpass", 1300, 0.5, false);
    const motor = loopOsc("triangle", 48);
    let alive = true;
    return {
      set: function (p) {
        if (!alive) {
          return;
        }
        const t = now();
        rumble.gain.gain.setTargetAtTime(p.run * 0.35 * p.near, t, 0.3);
        airflow.gain.gain.setTargetAtTime(p.run * 0.018 * p.near, t, 0.3);
        motor.gain.gain.setTargetAtTime(p.run * 0.03 * p.near, t, 0.3);
      },
      stop: function () {
        alive = false;
        const t = now();
        [rumble, airflow, motor].forEach(function (n) {
          n.gain.gain.setTargetAtTime(0, t, 0.2);
        });
        setTimeout(function () {
          rumble.src.stop();
          airflow.src.stop();
          motor.osc.stop();
        }, 1500);
      }
    };
  };

  /* Smoothing hand on cotton: continuous, gain follows drag speed. */
  A.hand = function () {
    if (!ctx) {
      return null;
    }
    const n = loopNoise("bandpass", 2300, 0.9, false);
    return {
      set: function (speed) {
        if (speed > 0.05) {
          mark("smooth");
        }
        n.gain.gain.setTargetAtTime(Math.min(0.11, speed * 0.05), now(), 0.05);
        n.filter.frequency.setTargetAtTime(1800 + Math.min(1, speed) * 1600, now(), 0.05);
      }
    };
  };

  /* ---------- ambience: rain + fluorescent hum at night, street + birds by day ---------- */

  A.setAmbient = function (theme) {
    if (!ctx) {
      return;
    }
    if (!ambient) {
      mark("ambient");
      const rain = ctx.createBufferSource();
      rain.buffer = noiseBuf;
      rain.loop = true;
      const rl = ctx.createBiquadFilter();
      rl.type = "lowpass";
      rl.frequency.value = 2400;
      const rh = ctx.createBiquadFilter();
      rh.type = "highpass";
      rh.frequency.value = 300;
      const rg = ctx.createGain();
      rg.gain.value = 0;
      rain.connect(rl);
      rl.connect(rh);
      rh.connect(rg);
      rg.connect(ambBus);
      rain.start();
      const street = ctx.createBufferSource();
      street.buffer = brownBuf;
      street.loop = true;
      const sl = ctx.createBiquadFilter();
      sl.type = "lowpass";
      sl.frequency.value = 400;
      const sg = ctx.createGain();
      sg.gain.value = 0;
      street.connect(sl);
      sl.connect(sg);
      sg.connect(ambBus);
      street.start();
      const hum = ctx.createGain();
      hum.gain.value = 0;
      hum.connect(ambBus);
      [100, 200, 300].forEach(function (f, i) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = [1, 0.5, 0.25][i];
        o.connect(g);
        g.connect(hum);
        o.start();
      });
      ambient = { rg: rg, sg: sg, hum: hum, theme: null, timer: null };
      ambient.timer = setInterval(function () {
        if (!ctx || document.hidden) {
          return;
        }
        if (ambient.theme === "night") {
          for (let i = 0; i < 3; i++) {
            if (Math.random() < 0.6) {
              S.raindrop(now() + Math.random() * 0.4);
            }
          }
        } else if (Math.random() < 0.06) {
          mark("bird");
          S.bird(now() + 0.05);
        }
      }, 450);
    }
    ambient.theme = theme;
    const t = now();
    const night = theme === "night";
    ambient.rg.gain.setTargetAtTime(night ? 0.05 : 0, t, 0.8);
    ambient.sg.gain.setTargetAtTime(night ? 0.12 : 0.3, t, 0.8);
    ambient.hum.gain.setTargetAtTime(night ? 0.004 : 0.0015, t, 0.8);
  };
})();
