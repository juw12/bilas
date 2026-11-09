/* Bilas world: the coin laundry room, built from three.js primitives and canvas textures (no image files). */
(function () {
  "use strict";
  const T = THREE;
  const W = {};
  window.BilasWorld = W;

  const PAL = {
    ink: "#1d2629",
    paper: "#f4f0e7",
    red: "#b8503a",
    celadon: "#9cc5b5",
    brass: "#c9a14a",
    enamel: "#f1eee8"
  };
  W.PAL = PAL;

  function canvasTex(w, h, draw, srgb) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    draw(g, w, h);
    const t = new T.CanvasTexture(c);
    if (srgb !== false) {
      t.colorSpace = T.SRGBColorSpace;
    }
    t.anisotropy = 8;
    t.userData.draw = draw;
    return t;
  }
  W.canvasTex = canvasTex;

  function redraw(t) {
    const c = t.image;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    t.userData.draw(g, c.width, c.height);
    t.needsUpdate = true;
  }
  W.redraw = redraw;

  function std(color, opts) {
    return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.6, metalness: 0 }, opts || {}));
  }

  function mesh(geo, material, x, y, z) {
    const m = new T.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  function roundedRect(w, h, r) {
    const s = new T.Shape();
    const x0 = -w / 2;
    const y0 = 0;
    s.moveTo(x0 + r, y0);
    s.lineTo(x0 + w - r, y0);
    s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
    s.lineTo(x0 + w, y0 + h - r);
    s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
    s.lineTo(x0 + r, y0 + h);
    s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
    s.lineTo(x0, y0 + r);
    s.quadraticCurveTo(x0, y0, x0 + r, y0);
    return s;
  }

  const FONT_DISPLAY = "'Bahnschrift', 'DIN Alternate', 'Barlow Condensed', 'Arial Narrow', sans-serif";
  const FONT_MONO = "'Consolas', 'Menlo', 'Courier New', monospace";
  W.FONT_DISPLAY = FONT_DISPLAY;

  /* ---------- shared materials ---------- */
  const M = {};
  W.M = M;

  function buildMaterials() {
    // porcelain enamel: a clear lacquer coat over the paint picks up the ceiling strips
    M.enamel = /[?&]lite\b/.test(window.location.search)
      ? std(PAL.enamel, { roughness: 0.32 })
      : new T.MeshPhysicalMaterial({ color: PAL.enamel, roughness: 0.38, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.1 });
    M.chrome = std("#dfe3e6", { metalness: 1, roughness: 0.16 });
    M.steelDark = std("#6d7478", { metalness: 0.8, roughness: 0.35 });
    M.panel = std("#283034", { roughness: 0.45 });
    M.rubber = std("#2f3437", { roughness: 0.9 });
    M.black = std("#0d1012", { roughness: 0.7 });
    M.invisible = new T.MeshBasicMaterial({ visible: false });
    M.hit = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide });
    M.glass = std("#d7ecf2", {
      transparent: true,
      opacity: 0.2,
      roughness: 0.04,
      metalness: 0.1,
      depthWrite: false
    });
    M.wood = std("#c19a6b", { roughness: 0.7 });
    M.woodDark = std("#8a6a48", { roughness: 0.75 });
    M.red = std(PAL.red, { roughness: 0.55 });
    const perf = canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = "#9aa3a7";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#3c4346";
      for (let y = 8; y < h; y += 16) {
        for (let x = (y / 16) % 2 ? 16 : 8; x < w; x += 16) {
          g.beginPath();
          g.arc(x, y, 3.2, 0, Math.PI * 2);
          g.fill();
        }
      }
    });
    perf.wrapS = T.RepeatWrapping;
    perf.wrapT = T.RepeatWrapping;
    perf.repeat.set(6, 2);
    M.drumSide = std("#ffffff", { map: perf, metalness: 0.6, roughness: 0.4, side: T.BackSide, emissive: "#1b1f21" });
    M.drumBack = std("#ffffff", { map: perf, metalness: 0.6, roughness: 0.4, emissive: "#1b1f21" });
    const coinFace = canvasTex(128, 128, function (g, w) {
      const grd = g.createRadialGradient(w * 0.4, w * 0.4, 4, w / 2, w / 2, w / 2);
      grd.addColorStop(0, "#f0d58a");
      grd.addColorStop(1, "#a9822f");
      g.fillStyle = grd;
      g.fillRect(0, 0, w, w);
      g.strokeStyle = "rgba(90,60,10,0.55)";
      g.lineWidth = 5;
      g.beginPath();
      g.arc(w / 2, w / 2, w * 0.4, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "rgba(90,60,10,0.6)";
      g.font = "bold 46px " + FONT_DISPLAY;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("1", w / 2, w / 2 + 2);
    });
    M.coinFace = std("#ffffff", { map: coinFace, metalness: 0.85, roughness: 0.32 });
    M.coinEdge = std(PAL.brass, { metalness: 0.9, roughness: 0.3 });
  }

  /* ---------- coins ---------- */
  const coinGeo = new T.CylinderGeometry(0.0132, 0.0132, 0.0024, 32);
  W.makeCoin = function () {
    const c = new T.Mesh(coinGeo, [M.coinEdge, M.coinFace, M.coinFace]);
    c.castShadow = true;
    const hit = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), M.hit);
    c.add(hit);
    c.userData.hit = hit;
    return c;
  };

  /* ---------- LCD display texture ---------- */
  function makeDisplay() {
    const state = { lines: ["", ""], color: "#9be3b0" };
    const t = canvasTex(256, 96, function (g, w, h) {
      g.fillStyle = "#0f2219";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(155,227,176,0.06)";
      for (let y = 0; y < h; y += 3) {
        g.fillRect(0, y, w, 1);
      }
      g.fillStyle = state.color;
      g.shadowColor = state.color;
      g.shadowBlur = 8;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "bold 40px " + FONT_MONO;
      g.fillText(state.lines[0], w / 2, 36);
      g.font = "bold 22px " + FONT_MONO;
      g.fillText(state.lines[1], w / 2, 76);
    });
    return {
      texture: t,
      set: function (a, b, color) {
        const col = color || "#9be3b0";
        if (state.lines[0] === a && state.lines[1] === b && state.color === col) {
          return;
        }
        state.lines = [a, b];
        state.color = col;
        redraw(t);
      }
    };
  }

  function sticker(text, bg, fg, size) {
    const t = canvasTex(128, 128, function (g, w) {
      g.fillStyle = bg;
      g.beginPath();
      g.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = fg;
      g.font = "bold 64px " + FONT_DISPLAY;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, w / 2, w / 2 + 4);
    });
    return new T.Mesh(new T.CircleGeometry(size, 32), new T.MeshStandardMaterial({ map: t, roughness: 0.5 }));
  }

  /* ---------- washer / dryer ---------- */
  function makeMachine(kind, number, opts) {
    opts = opts || {};
    const g = new T.Group();
    const w = 0.62;
    const h = 0.85;
    const d = 0.62;
    const R = kind === "washer" ? 0.19 : 0.21;
    const cy = kind === "washer" ? 0.4 : 0.42;
    const parts = { kind: kind, group: g, R: R, cy: cy };

    const body = mesh(new T.BoxGeometry(w, h, d), [M.enamel, M.enamel, M.enamel, M.enamel, M.invisible, M.enamel], 0, h / 2, -d / 2 - 0.004);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const shape = roundedRect(w, h, 0.025);
    const hole = new T.Path();
    hole.absarc(0, cy, R + 0.012, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const front = mesh(new T.ShapeGeometry(shape, 24), M.enamel, 0, 0, 0);
    front.receiveShadow = true;
    g.add(front);

    const bezel = mesh(new T.TorusGeometry(R + 0.016, 0.012, 10, 56), M.rubber, 0, cy, 0.004);
    g.add(bezel);

    const drum = mesh(new T.CylinderGeometry(R + 0.012, R + 0.012, 0.3, 40, 1, true), M.drumSide.clone(), 0, cy, -0.155);
    drum.rotation.x = Math.PI / 2;
    g.add(drum);
    const back = mesh(new T.CircleGeometry(R + 0.012, 40), M.drumBack.clone(), 0, cy, -0.304);
    g.add(back);
    parts.drumMats = [drum.material, back.material];

    const clothes = new T.Group();
    clothes.position.set(0, cy, -0.17);
    g.add(clothes);
    parts.clothes = clothes;

    const drumHit = mesh(new T.CircleGeometry(R, 24), M.hit, 0, cy, -0.02);
    drumHit.userData.act = kind + "Drum";
    g.add(drumHit);
    parts.drumHit = drumHit;

    if (kind === "washer") {
      const water = new T.Mesh(
        new T.CircleGeometry(R + 0.006, 48),
        new T.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: {
            uR: { value: R + 0.006 },
            uLevel: { value: -1.2 },
            uTime: { value: 0 },
            uSlosh: { value: 0 },
            uFoam: { value: 0 }
          },
          vertexShader: "uniform float uR; varying vec2 vP; void main(){ vP = position.xy / uR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
          fragmentShader: [
            "uniform float uLevel; uniform float uTime; uniform float uSlosh; uniform float uFoam; varying vec2 vP;",
            "float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }",
            "void main(){",
            "  float wave = 0.035*sin(vP.x*7.0 + uTime*2.6) + 0.02*sin(vP.x*13.0 - uTime*4.1) + uSlosh*vP.x;",
            "  float surf = uLevel + wave;",
            "  if (vP.y > surf) discard;",
            "  float depth = clamp(surf - vP.y, 0.0, 1.0);",
            "  vec3 col = mix(vec3(0.74,0.88,0.92), vec3(0.24,0.45,0.55), depth);",
            // slow swirl streaks under the surface
            "  float ang = atan(vP.y, vP.x) + uTime*1.4 + uSlosh*3.0;",
            "  float swirl = smoothstep(0.6, 1.0, sin(ang*3.0 + length(vP)*9.0)) * (1.0 - depth*0.6);",
            "  col += vec3(0.10,0.12,0.12) * swirl;",
            // a bright line where the water meets the glass
            "  float men = smoothstep(0.035, 0.0, surf - vP.y);",
            "  col = mix(col, vec3(0.95,0.99,1.0), men*0.7);",
            // foam cap with a broken lower edge, and bubbles in two sizes
            "  float edge = 0.12 + 0.08*h(floor(vec2(vP.x*18.0, 0.0) + floor(uTime*2.0)));",
            "  float foam = smoothstep(edge + 0.06, edge - 0.04, surf - vP.y) * uFoam;",
            "  vec2 c1 = (vP + vec2(sin(uTime*0.7)*0.03, -uTime*0.22)) * 14.0;",
            "  float b1 = step(0.93, h(floor(c1))) * smoothstep(0.42, 0.18, length(fract(c1) - 0.5));",
            "  vec2 c2 = (vP + vec2(0.0, -uTime*0.4)) * 30.0;",
            "  float b2 = step(0.95, h(floor(c2) + 7.0)) * smoothstep(0.4, 0.15, length(fract(c2) - 0.5));",
            "  float bubbles = (b1 + b2*0.7) * uFoam;",
            "  col = mix(col, vec3(1.0), clamp(foam*0.92 + bubbles*0.75, 0.0, 1.0));",
            "  gl_FragColor = vec4(col, 0.58 + foam*0.35 + depth*0.18 + men*0.2);",
            "}"
          ].join("\n")
        })
      );
      water.position.set(0, cy, -0.028);
      water.renderOrder = 2;
      g.add(water);
      parts.water = water;
    }

    // door
    const hinge = new T.Group();
    hinge.position.set(-(R + 0.04), cy, 0.014);
    g.add(hinge);
    const ring = mesh(new T.TorusGeometry(R + 0.026, 0.024, 14, 56), M.chrome, R + 0.04, 0, 0);
    ring.castShadow = true;
    hinge.add(ring);
    const glassTex = canvasTex(256, 256, function (g2, s) {
      g2.clearRect(0, 0, s, s);
      g2.strokeStyle = "rgba(255,255,255,0.55)";
      g2.lineWidth = 10;
      g2.beginPath();
      g2.arc(s / 2, s / 2, s * 0.38, Math.PI * 1.08, Math.PI * 1.42);
      g2.stroke();
      g2.lineWidth = 5;
      g2.beginPath();
      g2.arc(s / 2, s / 2, s * 0.3, Math.PI * 1.12, Math.PI * 1.3);
      g2.stroke();
    });
    const glassMat = M.glass.clone();
    glassMat.map = glassTex;
    const glass = mesh(new T.SphereGeometry(R + 0.012, 40, 12, 0, Math.PI * 2, 0, 0.5), glassMat, R + 0.04, 0, -0.03);
    glass.rotation.x = Math.PI / 2;
    glass.scale.set(1, 0.35, 1);
    glass.renderOrder = 3;
    hinge.add(glass);
    parts.glassMat = glassMat;
    parts.glassBase = { opacity: glassMat.opacity, color: glassMat.color.clone() };
    const handle = mesh(new T.BoxGeometry(0.03, 0.08, 0.025), M.chrome, 2 * R + 0.075, 0, 0.01);
    hinge.add(handle);
    const doorHit = mesh(new T.CircleGeometry(R + 0.045, 24), M.hit, R + 0.04, 0, 0.03);
    doorHit.userData.act = kind + "Door";
    hinge.add(doorHit);
    hinge.userData.act = kind + "Door";
    parts.hinge = hinge;
    parts.doorHit = doorHit;

    // control strip
    const strip = mesh(new T.BoxGeometry(w - 0.04, 0.13, 0.035), M.panel, 0, 0.765, 0.0175);
    g.add(strip);
    const disp = makeDisplay();
    const dispMesh = mesh(new T.PlaneGeometry(0.17, 0.064), new T.MeshBasicMaterial({ map: disp.texture, toneMapped: false }), -0.13, 0.765, 0.0356);
    g.add(dispMesh);
    parts.display = disp;
    const plate = mesh(new T.BoxGeometry(0.062, 0.09, 0.008), M.chrome, 0.085, 0.765, 0.038);
    g.add(plate);
    const slot = mesh(new T.BoxGeometry(0.0055, 0.036, 0.004), M.black, 0.085, 0.765, 0.0425);
    g.add(slot);
    const slotHit = mesh(new T.PlaneGeometry(0.07, 0.1), M.hit, 0.085, 0.765, 0.046);
    slotHit.userData.act = kind + "Slot";
    g.add(slotHit);
    parts.slotWorld = function () {
      return slot.getWorldPosition(new T.Vector3());
    };
    parts.slotHit = slotHit;
    const startRing = mesh(new T.CylinderGeometry(0.028, 0.028, 0.008, 32), M.chrome, 0.2, 0.765, 0.038);
    startRing.rotation.x = Math.PI / 2;
    g.add(startRing);
    const startMat = std("#3b6b4f", { emissive: "#000000", roughness: 0.4 });
    const start = mesh(new T.CylinderGeometry(0.021, 0.021, 0.014, 32), startMat, 0.2, 0.765, 0.044);
    start.rotation.x = Math.PI / 2;
    start.userData.act = kind + "Start";
    g.add(start);
    parts.start = start;
    parts.startMat = startMat;

    if (opts.frontDish) {
      // stacked machine: nothing can sit on top, so coins wait on a little ledge under the panel
      const ledge = mesh(new T.BoxGeometry(0.15, 0.01, 0.075), M.chrome, 0.17, 0.676, 0.037);
      g.add(ledge);
      const lip = mesh(new T.BoxGeometry(0.15, 0.022, 0.006), M.chrome, 0.17, 0.684, 0.073);
      g.add(lip);
      parts.dishPos = new T.Vector3(0.17, 0.684, 0.04);
    } else {
      // coin dish on top of the machine
      const dish = mesh(new T.CylinderGeometry(0.065, 0.055, 0.012, 32), M.panel, 0.17, h + 0.006, -0.1);
      g.add(dish);
      parts.dishPos = new T.Vector3(0.17, h + 0.014, -0.1);
    }
    parts.coins = [];

    // program dial with printed ticks (knurled knob, pointer)
    const dialTex = canvasTex(256, 256, function (g2, s) {
      g2.clearRect(0, 0, s, s);
      g2.strokeStyle = "#e9e5dc";
      g2.fillStyle = "#e9e5dc";
      g2.lineWidth = 6;
      g2.textAlign = "center";
      g2.textBaseline = "middle";
      g2.font = "bold 30px " + FONT_MONO;
      const labels = kind === "washer" ? ["30", "40", "60", "90"] : ["40", "55", "70", "+"];
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.75 + i * 0.1875);
        const r1 = s * 0.4;
        const r2 = i % 2 === 0 ? s * 0.47 : s * 0.44;
        g2.beginPath();
        g2.moveTo(s / 2 + Math.cos(a) * r1, s / 2 + Math.sin(a) * r1);
        g2.lineTo(s / 2 + Math.cos(a) * r2, s / 2 + Math.sin(a) * r2);
        g2.stroke();
      }
      labels.forEach(function (lab, i) {
        const a = Math.PI * (0.75 + i * 0.5);
        g2.fillText(lab, s / 2 + Math.cos(a) * s * 0.3, s / 2 + Math.sin(a) * s * 0.3);
      });
    });
    const dialFace = mesh(new T.CircleGeometry(0.046, 40), new T.MeshStandardMaterial({ map: dialTex, transparent: true, roughness: 0.6 }), 0.004, 0.765, 0.0356);
    g.add(dialFace);
    const knob = mesh(new T.CylinderGeometry(0.019, 0.021, 0.018, 28), std("#d9dcde", { metalness: 0.75, roughness: 0.32 }), 0.004, 0.765, 0.044);
    knob.rotation.x = Math.PI / 2;
    g.add(knob);
    const pointer = mesh(new T.BoxGeometry(0.004, 0.016, 0.003), M.red, 0.004, 0.774, 0.0545);
    g.add(pointer);
    parts.knob = knob;

    // panel seams, brushed top trim, kick plate with vent slots, rubber feet
    const groove = std("#b9b5ad", { roughness: 0.7 });
    g.add(mesh(new T.BoxGeometry(w - 0.05, 0.004, 0.003), groove, 0, 0.692, 0.0015));
    g.add(mesh(new T.BoxGeometry(w + 0.004, 0.012, 0.014), std("#c4c9cc", { metalness: 0.7, roughness: 0.36 }), 0, h - 0.006, 0.003));
    const ventTex = canvasTex(256, 32, function (g2, w2, h2) {
      g2.fillStyle = "#d8d4cb";
      g2.fillRect(0, 0, w2, h2);
      g2.fillStyle = "#4a4f52";
      for (let x = 22; x < w2 - 18; x += 14) {
        g2.fillRect(x, 9, 7, h2 - 18);
      }
    });
    const kick = mesh(new T.BoxGeometry(w - 0.03, 0.05, 0.01), [groove, groove, groove, groove, std("#ffffff", { map: ventTex, roughness: 0.6 }), groove], 0, 0.03, 0.005);
    g.add(kick);
    [-1, 1].forEach(function (sx) {
      g.add(mesh(new T.CylinderGeometry(0.018, 0.022, 0.012, 16), M.rubber, sx * (w / 2 - 0.05), 0.006, -0.03));
    });

    const num = sticker(String(number), PAL.red, "#ffffff", 0.03);
    num.position.set(0.25, 0.09, 0.002);
    g.add(num);

    // rounded front corners so the cabinet reads as pressed steel, not a box
    [-1, 1].forEach(function (sx) {
      const edge = mesh(new T.CylinderGeometry(0.014, 0.014, h - 0.03, 12, 1, false, sx < 0 ? Math.PI : 0, Math.PI), M.enamel, sx * (w / 2 - 0.013), h / 2, -0.012);
      edge.castShadow = true;
      g.add(edge);
    });
    // deep rubber gasket inside the porthole
    g.add(mesh(new T.TorusGeometry(R + 0.002, 0.016, 12, 56), M.rubber, 0, cy, -0.022));
    // brushed maker's plate
    const plateTex = canvasTex(256, 64, function (c, pw, ph) {
      const gr = c.createLinearGradient(0, 0, pw, 0);
      gr.addColorStop(0, "#c9cdd0");
      gr.addColorStop(0.5, "#eef0f1");
      gr.addColorStop(1, "#c3c7ca");
      c.fillStyle = gr;
      c.fillRect(0, 0, pw, ph);
      for (let y = 0; y < ph; y += 2) {
        c.fillStyle = "rgba(0,0,0," + (0.02 + Math.random() * 0.03).toFixed(3) + ")";
        c.fillRect(0, y, pw, 1);
      }
      c.fillStyle = "#3a4044";
      c.font = "bold 26px " + FONT_DISPLAY;
      c.textAlign = "left";
      c.fillText("bilas", 14, 40);
      c.font = "600 15px " + FONT_DISPLAY;
      c.textAlign = "right";
      c.fillText(kind === "washer" ? "PRO 7 KG" : "HEAT 8 KG", pw - 14, 39);
    }, true);
    const makerPlate = mesh(new T.PlaneGeometry(0.11, 0.0275), new T.MeshStandardMaterial({ map: plateTex, metalness: 0.65, roughness: 0.35 }), -0.2, 0.095, 0.002);
    g.add(makerPlate);

    if (kind === "washer") {
      const drawer = new T.Group();
      drawer.position.set(-0.17, 0.655, 0.0);
      g.add(drawer);
      const df = mesh(new T.BoxGeometry(0.17, 0.05, 0.02), std("#e2ded6", { roughness: 0.4 }), 0, 0, 0.01);
      drawer.add(df);
      const grip = mesh(new T.BoxGeometry(0.09, 0.008, 0.006), M.panel, 0, -0.012, 0.021);
      drawer.add(grip);
      parts.drawer = drawer;

      const bottle = new T.Group();
      const prof = [];
      const pts = [[0, 0], [0.028, 0], [0.034, 0.004], [0.037, 0.016], [0.037, 0.104], [0.035, 0.122], [0.029, 0.138], [0.019, 0.149], [0.0145, 0.153], [0.0145, 0.17], [0, 0.17]];
      pts.forEach(function (p) {
        prof.push(new T.Vector2(p[0], p[1]));
      });
      const jugMat = new T.MeshPhysicalMaterial({ color: "#4f8f86", roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.35 });
      const btl = mesh(new T.LatheGeometry(prof, 40), jugMat, 0, 0, 0);
      btl.castShadow = true;
      bottle.add(btl);
      // moulded carry handle on the back of the jug
      const handle = mesh(new T.TorusGeometry(0.026, 0.0075, 10, 24, Math.PI), jugMat, 0, 0.098, -0.034);
      handle.rotation.set(0, Math.PI / 2, Math.PI / 2);
      handle.castShadow = true;
      bottle.add(handle);
      const labelTex = canvasTex(512, 128, function (c, lw, lh) {
        c.fillStyle = "#f6f1e6";
        c.fillRect(0, 0, lw, lh);
        c.fillStyle = "#7a93b8";
        c.beginPath();
        c.moveTo(0, lh * 0.72);
        for (let x = 0; x <= lw; x += 8) {
          c.lineTo(x, lh * 0.72 + Math.sin(x / 34) * 7);
        }
        c.lineTo(lw, lh);
        c.lineTo(0, lh);
        c.fill();
        c.fillStyle = "#2b3236";
        c.textAlign = "center";
        c.font = "bold 44px " + FONT_DISPLAY;
        c.fillText("lavanda", lw * 0.25, lh * 0.5);
        c.font = "600 18px " + FONT_DISPLAY;
        c.fillText("liquid · 1.5 L", lw * 0.25, lh * 0.66);
        c.font = "500 15px " + FONT_DISPLAY;
        c.fillText("1 cap per load", lw * 0.75, lh * 0.45);
      }, true);
      labelTex.wrapS = T.RepeatWrapping;
      const label = mesh(new T.CylinderGeometry(0.0375, 0.0375, 0.056, 40, 1, true), std("#ffffff", { map: labelTex, roughness: 0.55 }), 0, 0.062, 0);
      label.rotation.y = Math.PI * 0.5;
      bottle.add(label);
      const capPts = [[0, 0], [0.0185, 0], [0.0185, 0.004], [0.017, 0.006], [0.0185, 0.008], [0.0185, 0.012], [0.017, 0.014], [0.0185, 0.016], [0.0185, 0.022], [0.016, 0.026], [0, 0.026]];
      const cap = mesh(new T.LatheGeometry(capPts.map(function (p) {
        return new T.Vector2(p[0], p[1]);
      }), 28), M.red, 0, 0.167, 0);
      bottle.add(cap);
      const bhit = mesh(new T.CylinderGeometry(0.06, 0.06, 0.22, 10), M.hit, 0, 0.1, 0);
      bhit.userData.act = "soap";
      bottle.add(bhit);
      bottle.position.set(-0.19, h, -0.12);
      g.add(bottle);
      parts.bottle = bottle;
      parts.bottleHome = bottle.position.clone();
    } else {
      // lint trap slot under the porthole
      const lintSlot = mesh(new T.BoxGeometry(0.3, 0.022, 0.006), M.black, 0, 0.115, 0.003);
      g.add(lintSlot);
      const lint = new T.Group();
      lint.position.set(0, 0.115, -0.11);
      g.add(lint);
      const tray = mesh(new T.BoxGeometry(0.28, 0.012, 0.2), std("#c9cdd0", { metalness: 0.5, roughness: 0.4 }), 0, 0, -0.1 + 0.1);
      lint.add(tray);
      const tab = mesh(new T.BoxGeometry(0.1, 0.03, 0.012), M.panel, 0, 0.004, 0.106);
      lint.add(tab);
      const fluff = { amount: 0 };
      const lintTex = canvasTex(256, 192, function (g2, w2, h2) {
        g2.fillStyle = "#c7cbcf";
        g2.fillRect(0, 0, w2, h2);
        g2.strokeStyle = "rgba(90,96,100,0.35)";
        for (let x = 0; x < w2; x += 6) {
          g2.beginPath();
          g2.moveTo(x, 0);
          g2.lineTo(x, h2);
          g2.stroke();
        }
        for (let y = 0; y < h2; y += 6) {
          g2.beginPath();
          g2.moveTo(0, y);
          g2.lineTo(w2, y);
          g2.stroke();
        }
      });
      const screen = mesh(new T.PlaneGeometry(0.26, 0.18), std("#ffffff", { map: lintTex, roughness: 0.6 }), 0, 0.0065, 0);
      screen.rotation.x = -Math.PI / 2;
      lint.add(screen);
      const felt = document.createElement("canvas");
      felt.width = 256;
      felt.height = 192;
      const feltTex = new T.CanvasTexture(felt);
      feltTex.colorSpace = T.SRGBColorSpace;
      const feltMesh = mesh(new T.PlaneGeometry(0.26, 0.18), new T.MeshStandardMaterial({ map: feltTex, bumpMap: feltTex, bumpScale: 2.2, transparent: true, roughness: 1 }), 0, 0.009, 0);
      feltMesh.rotation.x = -Math.PI / 2;
      feltMesh.userData.act = "lintFelt";
      lint.add(feltMesh);
      const tabHit = mesh(new T.BoxGeometry(0.32, 0.06, 0.05), M.hit, 0, 0, 0.11);
      tabHit.userData.act = "lintTab";
      lint.add(tabHit);
      parts.lint = { group: lint, felt: felt, feltTex: feltTex, feltMesh: feltMesh, tabHit: tabHit, fluff: fluff };
      const warm = new T.PointLight("#ff9a4a", 0, 0.6, 2);
      warm.position.set(0, cy, -0.12);
      g.add(warm);
      parts.warm = warm;
    }
    return parts;
  }
  W.makeMachine = makeMachine;

  /* ---------- changer ---------- */
  function makeChanger() {
    const g = new T.Group();
    const p = { group: g, coins: [] };
    const body = mesh(new T.BoxGeometry(0.5, 1.5, 0.4), M.enamel, 0, 0.75, -0.2);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const head = canvasTex(512, 220, function (c, w, h) {
      c.fillStyle = PAL.red;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#fff7ec";
      c.textAlign = "center";
      c.font = "bold 92px " + FONT_DISPLAY;
      c.fillText(W.str("sign_change"), w / 2, 110);
      c.font = "600 40px " + FONT_DISPLAY;
      c.fillText(W.str("sign_change_sub"), w / 2, 172);
    });
    p.headTex = head;
    g.add(mesh(new T.PlaneGeometry(0.46, 0.2), new T.MeshBasicMaterial({ map: head, toneMapped: false }), 0, 1.36, 0.002));
    g.add(mesh(new T.PlaneGeometry(0.42, 0.62), M.panel, 0, 0.93, 0.002));
    const info = canvasTex(320, 200, function (c, w, h) {
      c.fillStyle = "#283034";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#efe9dc";
      c.textAlign = "center";
      c.font = "600 38px " + FONT_DISPLAY;
      c.fillText(W.str("sign_note"), w / 2, 70);
      c.fillStyle = PAL.brass;
      c.font = "bold 50px " + FONT_DISPLAY;
      c.fillText(W.str("sign_rate"), w / 2, 140);
    });
    p.infoTex = info;
    g.add(mesh(new T.PlaneGeometry(0.3, 0.19), new T.MeshBasicMaterial({ map: info }), 0, 0.82, 0.004));
    const slot = mesh(new T.BoxGeometry(0.18, 0.035, 0.04), M.black, 0, 1.08, 0.012);
    g.add(slot);
    const led = mesh(new T.BoxGeometry(0.18, 0.006, 0.042), new T.MeshBasicMaterial({ color: "#6fe39a", toneMapped: false }), 0, 1.1, 0.012);
    g.add(led);
    p.led = led;
    const billHit = mesh(new T.PlaneGeometry(0.3, 0.16), M.hit, 0, 1.08, 0.04);
    billHit.userData.act = "bill";
    g.add(billHit);
    p.billHit = billHit;
    const billTex = canvasTex(256, 120, function (c, w, h) {
      c.fillStyle = "#cfe0c4";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#5c7f56";
      c.lineWidth = 6;
      c.strokeRect(8, 8, w - 16, h - 16);
      c.fillStyle = "#5c7f56";
      c.beginPath();
      c.arc(w * 0.7, h / 2, 30, 0, Math.PI * 2);
      c.fill();
      c.font = "bold 44px " + FONT_DISPLAY;
      c.fillText("4", 30, 76);
    });
    const bill = mesh(new T.PlaneGeometry(0.14, 0.065), new T.MeshStandardMaterial({ map: billTex, side: T.DoubleSide, roughness: 0.8 }), 0, 1.08, 0.12);
    bill.visible = false;
    g.add(bill);
    p.bill = bill;
    // coin tray
    const tray = new T.Group();
    tray.position.set(0, 0.36, 0.0);
    g.add(tray);
    tray.add(mesh(new T.PlaneGeometry(0.22, 0.13), M.black, 0, 0.02, 0.003));
    tray.add(mesh(new T.BoxGeometry(0.18, 0.006, 0.11), M.chrome, 0, -0.03, 0.05));
    tray.add(mesh(new T.BoxGeometry(0.18, 0.04, 0.006), M.chrome, 0, -0.012, 0.105));
    tray.add(mesh(new T.BoxGeometry(0.006, 0.04, 0.11), M.chrome, -0.09, -0.012, 0.05));
    tray.add(mesh(new T.BoxGeometry(0.006, 0.04, 0.11), M.chrome, 0.09, -0.012, 0.05));
    const trayHit = mesh(new T.BoxGeometry(0.26, 0.16, 0.16), M.hit, 0, 0.0, 0.06);
    trayHit.userData.act = "tray";
    tray.add(trayHit);
    p.tray = tray;
    p.trayHit = trayHit;
    return p;
  }

  /* ---------- basket (carried, bottom-right of the view) ---------- */
  function makeBasket() {
    const g = new T.Group();
    const slots = canvasTex(256, 128, function (c, w, h) {
      c.fillStyle = PAL.red;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        if (c.roundRect) {
          c.roundRect(14 + i * 26, 36, 12, 70, 6);
        } else {
          c.rect(14 + i * 26, 36, 12, 70);
        }
        c.fill();
      }
      c.globalCompositeOperation = "source-over";
    });
    const mat = std("#ffffff", { map: slots, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.5 });
    const W2 = 0.36;
    const D = 0.26;
    const H = 0.17;
    const front = mesh(new T.PlaneGeometry(W2, H), mat, 0, H / 2, D / 2);
    const back = mesh(new T.PlaneGeometry(W2, H), mat, 0, H / 2, -D / 2);
    const left = mesh(new T.PlaneGeometry(D, H), mat, -W2 / 2, H / 2, 0);
    left.rotation.y = Math.PI / 2;
    const right = mesh(new T.PlaneGeometry(D, H), mat, W2 / 2, H / 2, 0);
    right.rotation.y = Math.PI / 2;
    const bottom = mesh(new T.PlaneGeometry(W2, D), M.red, 0, 0.002, 0);
    bottom.rotation.x = -Math.PI / 2;
    const rim = mesh(new T.TorusGeometry(1, 0.012, 6, 4), M.red, 0, H, 0);
    rim.rotation.x = Math.PI / 2;
    rim.rotation.z = Math.PI / 4;
    rim.scale.set(W2 * 0.71, D * 0.71, 1);
    [front, back, left, right, bottom, rim].forEach(function (m) {
      g.add(m);
    });
    const hit = mesh(new T.BoxGeometry(W2 + 0.06, H + 0.12, D + 0.06), M.hit, 0, H / 2 + 0.03, 0);
    hit.userData.act = "basket";
    g.add(hit);
    const items = new T.Group();
    items.position.y = 0.06;
    g.add(items);
    return { group: g, items: items, hit: hit };
  }

  /* ---------- room ---------- */
  function wallTexture(w, h) {
    return canvasTex(2048, 1024, function (c, cw, ch) {
      const pxm = cw / w;
      const tileTop = ch - 1.3 * pxm;
      c.fillStyle = "#ebe5d8";
      c.fillRect(0, 0, cw, ch);
      for (let i = 0; i < 3000; i++) {
        c.fillStyle = "rgba(120,100,70," + (Math.random() * 0.03) + ")";
        c.fillRect(Math.random() * cw, Math.random() * tileTop, 2, 2);
      }
      c.fillStyle = "#f7f6f1";
      c.fillRect(0, tileTop, cw, ch - tileTop);
      const tw = 0.15 * pxm;
      const th = 0.075 * pxm;
      for (let row = 0; tileTop + row * th < ch; row++) {
        const off = row % 2 ? tw / 2 : 0;
        for (let x = -off; x < cw; x += tw) {
          const shade = 210 + Math.floor(Math.random() * 10);
          c.fillStyle = "rgb(" + (shade - 38) + "," + (shade - 8) + "," + (shade - 22) + ")";
          c.fillRect(x + 1.5, tileTop + row * th + 1.5, tw - 3, th - 3);
        }
      }
      c.fillStyle = "#7c6a52";
      c.fillRect(0, tileTop - 10, cw, 12);
    });
  }

  function floorTexture() {
    return canvasTex(1024, 1024, function (c, w) {
      const n = 16;
      const s = w / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          c.fillStyle = (i + j) % 2 ? "#d8d2c3" : "#b4c3bb";
          c.fillRect(i * s, j * s, s, s);
          // no two tiles fired the same: a faint tone shift per tile
          const tone = Math.random() * 0.08 - 0.04;
          c.fillStyle = tone > 0 ? "rgba(255,255,255," + tone + ")" : "rgba(40,40,30," + -tone + ")";
          c.fillRect(i * s, j * s, s, s);
        }
      }
      // scuffs where people stand and drag baskets
      c.lineCap = "round";
      for (let k = 0; k < 70; k++) {
        const x = Math.random() * w;
        const y = Math.random() * w;
        const len = 20 + Math.random() * 90;
        const a = Math.random() * Math.PI;
        c.strokeStyle = "rgba(70,66,58," + (0.04 + Math.random() * 0.07) + ")";
        c.lineWidth = 1 + Math.random() * 3;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 8, y + Math.sin(a) * len * 0.5 - 6, x + Math.cos(a) * len, y + Math.sin(a) * len);
        c.stroke();
      }
      for (let k = 0; k < 9000; k++) {
        c.fillStyle = Math.random() < 0.5 ? "rgba(60,60,55,0.18)" : "rgba(255,255,255,0.25)";
        c.fillRect(Math.random() * w, Math.random() * w, 2, 2);
      }
      c.strokeStyle = "rgba(80,80,70,0.35)";
      c.lineWidth = 2;
      for (let i = 0; i <= n; i++) {
        c.beginPath();
        c.moveTo(i * s, 0);
        c.lineTo(i * s, w);
        c.stroke();
        c.beginPath();
        c.moveTo(0, i * s);
        c.lineTo(w, i * s);
        c.stroke();
      }
    });
  }

  function outsideTexture(layer) {
    // the street across: hazy far towers, mid-rise flats with rooftop tanks, near shophouses with
    // awnings, overhead cables and a street lamp. Seeded so day/night redraws keep the same skyline.
    const far = layer === "far";
    return canvasTex(1024, 512, function (c, w, h) {
      const night = W.theme !== "day";
      c.clearRect(0, 0, w, h);
      // "near" skips drawing the far layer but still draws its random numbers, so both layers line up
      const ink = far ? c : { fillRect: function () {}, beginPath: function () {}, ellipse: function () {}, fill: function () {} };
      let seed = 7;
      function rnd() {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      }
      const grd = c.createLinearGradient(0, 0, 0, h);
      if (night) {
        grd.addColorStop(0, "#0a121c");
        grd.addColorStop(0.6, "#1a2632");
        grd.addColorStop(1, "#26313a");
      } else {
        grd.addColorStop(0, "#a9cbe0");
        grd.addColorStop(0.65, "#e3ebe6");
        grd.addColorStop(1, "#f2efe6");
      }
      ink.fillStyle = grd;
      ink.fillRect(0, 0, w, h);
      if (!night) {
        ink.fillStyle = "rgba(255,255,255,0.55)";
        for (let i = 0; i < 5; i++) {
          const cx = 90 + i * 210 + rnd() * 60;
          const cy = 50 + rnd() * 60;
          for (let k = 0; k < 4; k++) {
            ink.beginPath();
            ink.ellipse(cx + k * 28, cy + (k % 2) * 6, 46, 16, 0, 0, Math.PI * 2);
            ink.fill();
          }
        }
      }
      // far towers in haze
      ink.fillStyle = night ? "#1c2836" : "#c3cfd3";
      for (let x = -20; x < w; ) {
        const bw = 50 + rnd() * 70;
        const bh = 190 + rnd() * 160;
        ink.fillRect(x, h - bh - 40, bw, bh);
        if (night) {
          ink.fillStyle = "rgba(255,214,150,0.35)";
          for (let k = 0; k < 10; k++) {
            ink.fillRect(x + 6 + rnd() * (bw - 12), h - bh - 30 + rnd() * (bh - 40), 4, 5);
          }
          ink.fillStyle = "#1c2836";
        }
        x += bw + 8 + rnd() * 30;
      }
      if (far) {
        return;
      }
      // mid-rise flats with rooftop water tanks and AC boxes
      for (let x = -10; x < w; ) {
        const bw = 110 + rnd() * 80;
        const bh = 170 + rnd() * 110;
        const top = h - bh;
        c.fillStyle = night ? "#121a22" : ["#d4cbb8", "#c8beac", "#d9d2c2"][Math.floor(rnd() * 3)];
        c.fillRect(x, top, bw, bh);
        c.fillStyle = night ? "#0d1319" : "rgba(80,70,60,0.18)";
        c.fillRect(x, top, bw, 6);
        // rooftop
        c.fillStyle = night ? "#0f161c" : "#9c9483";
        c.fillRect(x + bw * 0.2, top - 22, 26, 22);
        c.fillRect(x + bw * 0.2 + 3, top - 30, 20, 8);
        c.fillRect(x + bw * 0.6, top - 10, 30, 10);
        // windows with sills and the odd lit room / balcony plant
        for (let y = top + 18; y < h - 70; y += 30) {
          for (let wx = x + 12; wx < x + bw - 22; wx += 26) {
            const lit = rnd() < (night ? 0.38 : 0);
            c.fillStyle = night ? (lit ? (rnd() < 0.7 ? "rgba(255,198,122,0.85)" : "rgba(170,210,255,0.6)") : "rgba(32,44,56,0.95)") : "rgba(96,118,130,0.5)";
            c.fillRect(wx, y, 14, 16);
            c.fillStyle = night ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)";
            c.fillRect(wx - 2, y + 16, 18, 2);
            if (rnd() < 0.08) {
              c.fillStyle = night ? "#1d3324" : "#6f8f63";
              c.beginPath();
              c.arc(wx + 7, y + 13, 6, 0, Math.PI * 2);
              c.fill();
            }
          }
        }
        x += bw + 6 + rnd() * 18;
      }
      // near shophouses with striped awnings
      for (let x = -30; x < w; ) {
        const bw = 140 + rnd() * 60;
        const top = h - 88;
        c.fillStyle = night ? "#161d24" : "#e6dfcf";
        c.fillRect(x, top, bw, 88);
        const shop = night ? (rnd() < 0.7 ? "rgba(255,206,140,0.9)" : "rgba(160,220,200,0.75)") : "rgba(70,88,96,0.55)";
        c.fillStyle = shop;
        c.fillRect(x + 12, top + 34, bw - 24, 46);
        const stripe = ["#c8483a", "#3f6f62", "#d1a548", "#2f4a5e"][Math.floor(rnd() * 4)];
        for (let k = 0; k < (bw - 8) / 16; k++) {
          c.fillStyle = k % 2 ? (night ? "#2a2f33" : "#f4efe4") : stripe;
          c.beginPath();
          c.moveTo(x + 4 + k * 16, top + 16);
          c.lineTo(x + 20 + k * 16, top + 16);
          c.lineTo(x + 24 + k * 16, top + 30);
          c.lineTo(x + 8 + k * 16, top + 30);
          c.closePath();
          c.fill();
        }
        x += bw + 4;
      }
      // overhead cables and a street lamp
      c.strokeStyle = night ? "rgba(10,14,18,0.9)" : "rgba(50,52,54,0.6)";
      c.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.moveTo(0, 120 + k * 18);
        c.quadraticCurveTo(w / 2, 170 + k * 22, w, 110 + k * 16);
        c.stroke();
      }
      const lx = w * 0.72;
      c.fillStyle = night ? "#0c1116" : "#5b6064";
      c.fillRect(lx, 150, 6, h - 150);
      c.fillRect(lx - 40, 150, 46, 5);
      if (night) {
        const lg = c.createRadialGradient(lx - 38, 160, 0, lx - 38, 160, 120);
        lg.addColorStop(0, "rgba(255,214,150,0.75)");
        lg.addColorStop(1, "rgba(255,214,150,0)");
        c.fillStyle = lg;
        c.fillRect(lx - 160, 40, 240, 240);
        for (let i = 0; i < 14; i++) {
          const x = rnd() * w;
          const y = h * 0.62 + rnd() * h * 0.32;
          const r = 8 + rnd() * 18;
          const g2 = c.createRadialGradient(x, y, 0, x, y, r);
          const col = rnd() < 0.75 ? "255,190,110" : "230,80,60";
          g2.addColorStop(0, "rgba(" + col + ",0.5)");
          g2.addColorStop(1, "rgba(" + col + ",0)");
          c.fillStyle = g2;
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.fill();
        }
      } else {
        c.fillStyle = "#7f9a74";
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.arc(120 + i * 210, h - 70, 46, 0, Math.PI * 2);
          c.fill();
        }
      }
    });
  }

  function rainMaterial() {
    return new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uOn: { value: 1 }, uStreak: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: [
        "uniform float uTime; uniform float uOn; uniform float uStreak; varying vec2 vUv;",
        "float h(float n){ return fract(sin(n)*43758.5453); }",
        "void main(){",
        "  vec2 uv = vUv * vec2(48.0, 1.0);",
        "  float col = floor(uv.x);",
        "  float speed = 0.5 + h(col)*0.8;",
        "  float y = fract(vUv.y + uTime*speed*0.35 + h(col*3.1));",
        "  float streak = smoothstep(0.0, 0.02, y) * smoothstep(0.16, 0.02, y);",
        "  float lane = smoothstep(0.5, 0.0, abs(fract(uv.x) - 0.5)) * step(0.55, h(col*7.7));",
        "  vec2 g = vUv * vec2(30.0, 18.0);",
        "  vec2 id = floor(g);",
        "  float dropOn = step(0.82, h(id.x*13.0 + id.y*7.0));",
        "  float d = length(fract(g) - 0.5);",
        "  float drop = dropOn * smoothstep(0.2, 0.05, d);",
        // sliding drops: a bead with a fading trail above it
        "  vec2 sg = vUv * vec2(22.0, 1.0);",
        "  float sc = floor(sg.x);",
        "  float sOn = step(0.6, h(sc*5.3));",
        "  float sy = 1.0 - fract(uTime*(0.05 + h(sc*2.7)*0.08) + h(sc*9.1));",
        "  float sx = abs(fract(sg.x) - 0.5 - 0.15*sin(vUv.y*20.0 + sc));",
        "  float bead = smoothstep(0.035, 0.0, length(vec2(sx*0.045, vUv.y - sy)));",
        "  float trail = smoothstep(0.06, 0.0, sx) * smoothstep(sy, sy + 0.25, vUv.y) * (1.0 - smoothstep(sy + 0.25, sy + 0.5, vUv.y)) * step(sy, vUv.y);",
        "  float slide = sOn * (bead*0.9 + trail*0.25);",
        "  float a = ((streak*lane*0.5 + slide) * uStreak + drop*0.35) * uOn;",
        "  gl_FragColor = vec4(vec3(0.85,0.9,0.95), a);",
        "}"
      ].join("\n")
    });
  }

  // soft vapour puffs: a small pool of billboards that rise, spread and fade
  const puffs = [];
  W.puff = function (pos, count) {
    if (!W.puffTex) {
      W.puffTex = canvasTex(64, 64, function (c, s) {
        const gr = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        gr.addColorStop(0, "rgba(255,255,255,0.9)");
        gr.addColorStop(0.5, "rgba(255,255,255,0.35)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = gr;
        c.fillRect(0, 0, s, s);
      });
    }
    for (let i = 0; i < (count || 10); i++) {
      const mat = new T.SpriteMaterial({ map: W.puffTex, transparent: true, depthWrite: false, opacity: 0, color: "#f4f1ea" });
      const sp = new T.Sprite(mat);
      sp.position.copy(pos).add(new T.Vector3((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.12, Math.random() * 0.06));
      sp.scale.setScalar(0.06);
      sp.userData = { t: -i * 0.07, life: 1.8 + Math.random() * 0.8, vx: (Math.random() - 0.5) * 0.05, vy: 0.12 + Math.random() * 0.08, vz: 0.05 + Math.random() * 0.05 };
      W.scene.add(sp);
      puffs.push(sp);
    }
  };
  W.stepPuffs = function (dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const sp = puffs[i];
      const u = sp.userData;
      u.t += dt;
      if (u.t < 0) {
        continue;
      }
      const k = u.t / u.life;
      if (k >= 1) {
        W.scene.remove(sp);
        sp.material.dispose();
        puffs.splice(i, 1);
        continue;
      }
      sp.position.x += u.vx * dt;
      sp.position.y += u.vy * dt;
      sp.position.z += u.vz * dt;
      sp.scale.setScalar(0.06 + k * 0.22);
      sp.material.opacity = 0.32 * Math.sin(Math.PI * Math.min(1, k * 1.3)) * (1 - k * 0.5);
    }
  };

  function poster(lines, w, h, opts) {
    // drawn at 2.4x density so pinned notes stay crisp at desktop size
    const K = 2.4;
    const t = canvasTex(Math.round(w * 1000 * K), Math.round(h * 1000 * K), function (c, fullW, fullH) {
      c.save();
      c.scale(K, K);
      const cw = fullW / K;
      const ch = fullH / K;
      c.fillStyle = opts.bg;
      c.fillRect(0, 0, cw, ch);
      c.fillStyle = opts.fg;
      c.textAlign = "left";
      let y = opts.pad + opts.size;
      lines().forEach(function (ln, i) {
        const weight = i === 0 ? "bold " : "500 ";
        let px = i === 0 ? opts.size * 1.25 : opts.size;
        c.font = weight + px + "px " + FONT_DISPLAY;
        // shrink long lines to fit instead of clipping at the card edge
        const room = cw - opts.pad * 2;
        const wide = c.measureText(ln).width;
        if (wide > room) {
          px = Math.max(px * 0.6, px * room / wide);
          c.font = weight + px + "px " + FONT_DISPLAY;
        }
        c.fillText(ln, opts.pad, y, room);
        y += opts.size * (i === 0 ? 1.7 : 1.35);
      });
      if (opts.tape) {
        c.fillStyle = "rgba(240,225,170,0.85)";
        c.fillRect(cw / 2 - 40, 0, 80, 22);
      }
      c.restore();
    });
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: t, roughness: 0.8 }));
    m.userData.tex = t;
    return m;
  }

  W.build = function (canvas, strFn) {
    W.str = strFn;
    W.theme = "night";
    buildMaterials();
    const LITE = /[?&]lite\b/.test(window.location.search);
    W.lite = LITE;
    const renderer = new T.WebGLRenderer({ canvas: canvas, antialias: !LITE, powerPreference: "high-performance" });
    renderer.setPixelRatio(LITE ? 0.5 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = !LITE;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(50, 1, 0.03, 30);
    scene.add(camera);
    W.renderer = renderer;
    W.scene = scene;
    W.camera = camera;

    // environment for chrome and glass
    const pm = new T.PMREMGenerator(renderer);
    const envScene = new T.Scene();
    const envBox = new T.Mesh(new T.BoxGeometry(10, 6, 10), new T.MeshBasicMaterial({ color: "#8e979a", side: T.BackSide }));
    envScene.add(envBox);
    [-2, 2].forEach(function (x) {
      const strip = new T.Mesh(new T.BoxGeometry(0.6, 0.1, 6), new T.MeshBasicMaterial({ color: "#ffffff" }));
      strip.position.set(x, 2.9, 0);
      envScene.add(strip);
    });
    const win = new T.Mesh(new T.BoxGeometry(0.1, 2, 4), new T.MeshBasicMaterial({ color: "#c7d9e6" }));
    win.position.set(-4.9, 1, 0);
    envScene.add(win);
    scene.environment = pm.fromScene(envScene, 0.04).texture;

    // lights
    const hemi = new T.HemisphereLight("#e6edf0", "#7d705e", 0.7);
    scene.add(hemi);
    const ceilA = new T.PointLight("#f3f7ff", 9, 0, 2);
    ceilA.position.set(-0.8, 2.55, -0.4);
    const ceilB = new T.PointLight("#f3f7ff", 9, 0, 2);
    ceilB.position.set(1.0, 2.55, 0.6);
    scene.add(ceilA, ceilB);
    const sun = new T.DirectionalLight("#ffe1b8", 0.5);
    sun.position.set(-5, 3.6, 0.6);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -3.5;
    sun.shadow.camera.right = 3.5;
    sun.shadow.camera.top = 3;
    sun.shadow.camera.bottom = -3;
    sun.shadow.bias = -0.0008;
    scene.add(sun, sun.target);
    W.lights = { hemi: hemi, ceilA: ceilA, ceilB: ceilB, sun: sun };

    // shell
    const floor = mesh(new T.PlaneGeometry(6, 5.4), std("#ffffff", { map: floorTexture(), roughness: 0.55 }), 0, 0, 0.7);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const back = mesh(new T.PlaneGeometry(6, 2.8), std("#ffffff", { map: wallTexture(6, 2.8), roughness: 0.8 }), 0, 1.4, -2);
    back.receiveShadow = true;
    scene.add(back);
    const paint = std("#e9e3d6", { roughness: 0.85 });
    const leftParts = [
      [5.4, 0.9, 0.7, 0.45],
      [5.4, 0.5, 0.7, 2.55],
      [0.8, 1.4, -1.6, 1.6],
      [2.2, 1.4, 2.3, 1.6]
    ];
    leftParts.forEach(function (p) {
      const m = mesh(new T.PlaneGeometry(p[0], p[1]), paint, -3, p[3], p[2]);
      m.rotation.y = Math.PI / 2;
      m.receiveShadow = true;
      scene.add(m);
    });
    const rightWall = mesh(new T.PlaneGeometry(5.4, 2.8), paint, 3, 1.4, 0.7);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);
    const frontWall = mesh(new T.PlaneGeometry(6, 2.8), paint, 0, 1.4, 3.4);
    frontWall.rotation.y = Math.PI;
    scene.add(frontWall);
    const ceiling = mesh(new T.PlaneGeometry(6, 5.4), std("#f1efe9", { roughness: 0.9 }), 0, 2.8, 0.7);
    ceiling.rotation.x = Math.PI / 2;
    scene.add(ceiling);
    [[-0.8, -0.4], [1.0, 0.6]].forEach(function (p) {
      const tube = mesh(new T.BoxGeometry(0.12, 0.04, 1.3), new T.MeshBasicMaterial({ color: "#ffffff" }), p[0], 2.78, p[1]);
      scene.add(tube);
      W.tubes = (W.tubes || []).concat([tube]);
    });

    // window with rain
    const frameMat = std("#3b4448", { roughness: 0.5, metalness: 0.3 });
    const fr = [
      [0.06, 0.06, 2.46, 0.9, 0],
      [0.06, 0.06, 2.46, 2.3, 0],
      [0.06, 1.46, 0.06, 1.6, -1.2],
      [0.06, 1.46, 0.06, 1.6, 1.2],
      [0.05, 1.4, 0.04, 1.6, 0]
    ];
    fr.forEach(function (f) {
      scene.add(mesh(new T.BoxGeometry(f[0], f[1], f[2]), frameMat, -2.98, f[3], f[4]));
    });
    const sill = mesh(new T.BoxGeometry(0.22, 0.03, 2.5), std("#d9d2c4"), -2.9, 0.885, 0);
    sill.receiveShadow = true;
    scene.add(sill);
    // two depth layers so the street slides against the skyline as you walk between stations
    const skyline = mesh(new T.PlaneGeometry(9, 4.8), new T.MeshBasicMaterial({ map: outsideTexture("far") }), -6.4, 1.6, 0);
    skyline.rotation.y = Math.PI / 2;
    scene.add(skyline);
    W.skyline = skyline;
    const outside = mesh(
      new T.PlaneGeometry(6, 3.2),
      new T.MeshBasicMaterial({ map: outsideTexture("near"), transparent: true, depthWrite: false }),
      -4.4, 1.5, 0
    );
    outside.rotation.y = Math.PI / 2;
    outside.renderOrder = 1;
    scene.add(outside);
    W.outside = outside;
    const rain = mesh(new T.PlaneGeometry(2.4, 1.4), rainMaterial(), -2.97, 1.6, 0);
    rain.rotation.y = Math.PI / 2;
    rain.renderOrder = 4;
    scene.add(rain);
    W.rain = rain;

    // light falling through the window: a few soft shafts and the pane pattern on the floor
    const shaftTex = canvasTex(64, 256, function (c, w, h) {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      const e = c.createLinearGradient(0, 0, w, 0);
      e.addColorStop(0, "rgba(0,0,0,1)");
      e.addColorStop(0.5, "rgba(0,0,0,0)");
      e.addColorStop(1, "rgba(0,0,0,1)");
      c.globalCompositeOperation = "destination-out";
      c.fillStyle = e;
      c.fillRect(0, 0, w, h);
    });
    const shaftMat = new T.MeshBasicMaterial({
      map: shaftTex,
      color: "#ffe3b8",
      transparent: true,
      opacity: 0.1,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side: T.DoubleSide,
      toneMapped: false
    });
    const shafts = new T.Group();
    [-0.75, -0.1, 0.55].forEach(function (z, i) {
      const shaft = mesh(new T.PlaneGeometry(0.5 + i * 0.06, 2.6), shaftMat, 0, 0, 0);
      shaft.position.set(-2.35, 1.05, z);
      shaft.rotation.set(0, Math.PI / 2, -0.62);
      shaft.raycast = function () {};
      shafts.add(shaft);
    });
    shafts.renderOrder = 5;
    scene.add(shafts);
    const patchTex = canvasTex(256, 256, function (c, w, h) {
      c.clearRect(0, 0, w, h);
      c.filter = "blur(6px)";
      c.fillStyle = "rgba(255,255,255,0.85)";
      const pad = 18;
      const half = (w - pad * 3) / 2;
      c.fillRect(pad, pad, half, h - pad * 2);
      c.fillRect(pad * 2 + half, pad, half, h - pad * 2);
    });
    const patchMat = new T.MeshBasicMaterial({
      map: patchTex,
      color: "#ffdcae",
      transparent: true,
      opacity: 0.16,
      blending: T.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const patch = mesh(new T.PlaneGeometry(1.1, 2.2), patchMat, -1.9, 0.004, 0.05);
    patch.rotation.x = -Math.PI / 2;
    patch.raycast = function () {};
    scene.add(patch);
    W.windowLight = { shaftMat: shaftMat, patchMat: patchMat };

    // sign + posters
    const signTex = canvasTex(1024, 256, function (c, w, h) {
      c.fillStyle = "#fbf8f1";
      c.fillRect(0, 0, w, h);
      c.fillStyle = PAL.red;
      c.font = "bold 150px " + FONT_DISPLAY;
      c.textBaseline = "middle";
      c.fillText("bilas", 40, h / 2 + 6);
      c.fillStyle = "#2b3236";
      c.font = "600 52px " + FONT_DISPLAY;
      c.fillText(W.str("sign_sub1"), 450, h / 2 - 30);
      c.fillText(W.str("sign_sub2"), 450, h / 2 + 40);
    });
    W.signTex = signTex;
    const sign = mesh(new T.BoxGeometry(1.6, 0.4, 0.06), [M.enamel, M.enamel, M.enamel, M.enamel, new T.MeshBasicMaterial({ map: signTex, toneMapped: false }), M.enamel], -0.35, 2.25, -1.96);
    scene.add(sign);
    const price = poster(function () {
      return [W.str("p_price_t"), W.str("p_price_1"), W.str("p_price_2"), W.str("p_price_3")];
    }, 0.36, 0.3, { bg: "#fffdf7", fg: "#2b3236", size: 30, pad: 26 });
    price.position.set(1.22, 1.33, -1.995);
    price.rotation.z = 0.01;
    scene.add(price);
    const note = poster(function () {
      return [W.str("p_note_t"), W.str("p_note_1"), W.str("p_note_2")];
    }, 0.22, 0.17, { bg: "#f3e7b8", fg: "#3a3326", size: 22, pad: 16, tape: true });
    note.position.set(1.22, 1.05, -1.995);
    note.rotation.z = -0.04;
    scene.add(note);
    const note2 = poster(function () {
      return [W.str("p_note2_t"), W.str("p_note2_1"), W.str("p_note2_2")];
    }, 0.2, 0.15, { bg: "#dfeae4", fg: "#2b3236", size: 20, pad: 14, tape: true });
    note2.position.set(1.46, 1.08, -1.994);
    note2.rotation.z = 0.05;
    scene.add(note2);
    const note3 = poster(function () {
      return [W.str("p_note3_t"), W.str("p_note3_1")];
    }, 0.16, 0.11, { bg: "#fbf8f1", fg: "#3a3326", size: 18, pad: 12, tape: true });
    note3.position.set(1.25, 0.86, -1.994);
    note3.rotation.z = -0.07;
    scene.add(note3);
    W.posters = [price, note, note2, note3];

    // wall clock with real time
    const clockTex = canvasTex(256, 256, function (c, s) {
      const d = new Date();
      c.fillStyle = "#fbf8f1";
      c.beginPath();
      c.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#2b3236";
      c.lineWidth = 10;
      c.stroke();
      c.lineWidth = 6;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        c.beginPath();
        c.moveTo(s / 2 + Math.sin(a) * 98, s / 2 - Math.cos(a) * 98);
        c.lineTo(s / 2 + Math.sin(a) * 112, s / 2 - Math.cos(a) * 112);
        c.stroke();
      }
      function hand(a, len, wd, col) {
        c.strokeStyle = col;
        c.lineWidth = wd;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(s / 2, s / 2);
        c.lineTo(s / 2 + Math.sin(a) * len, s / 2 - Math.cos(a) * len);
        c.stroke();
      }
      const hr = d.getHours() % 12 + d.getMinutes() / 60;
      hand(hr / 12 * Math.PI * 2, 60, 10, "#2b3236");
      hand(d.getMinutes() / 60 * Math.PI * 2, 92, 7, "#2b3236");
      hand(d.getSeconds() / 60 * Math.PI * 2, 100, 3, PAL.red);
    });
    const clock = mesh(new T.CylinderGeometry(0.15, 0.15, 0.03, 40), [M.panel, new T.MeshStandardMaterial({ map: clockTex, roughness: 0.4 }), M.panel], 1.75, 2.15, -1.98);
    clock.rotation.x = Math.PI / 2;
    clock.rotation.y = Math.PI;
    scene.add(clock);
    clock.rotation.set(Math.PI / 2, 0, 0);
    W.clockTex = clockTex;

    // machines
    W.washer = makeMachine("washer", 2);
    W.washer.group.position.set(-0.75, 0, -1.36);
    scene.add(W.washer.group);
    W.washerBg = makeMachine("washer", 1);
    W.washerBg.group.position.set(-1.5, 0, -1.36);
    scene.add(W.washerBg.group);
    W.dryer = makeMachine("dryer", 3, { frontDish: true });
    W.dryer.group.position.set(0.6, 0, -1.36);
    scene.add(W.dryer.group);
    W.dryerTop = makeMachine("dryer", 4);
    W.dryerTop.group.position.set(0.6, 0.87, -1.36);
    scene.add(W.dryerTop.group);
    [W.washerBg, W.dryerTop].forEach(function (m) {
      m.group.traverse(function (o) {
        if (o.userData.act) {
          o.userData.act = null;
        }
      });
    });
    W.dryerTop.lint.group.visible = false;
    if (W.washerBg.bottle) {
      W.washerBg.bottle.visible = false;
    }

    W.changer = makeChanger();
    W.changer.group.position.set(1.85, 0, -1.6);
    scene.add(W.changer.group);

    // bench
    const bench = new T.Group();
    for (let i = 0; i < 3; i++) {
      const slat = mesh(new T.BoxGeometry(1.3, 0.025, 0.1), M.wood, 0, 0.45, -0.12 + i * 0.12);
      slat.castShadow = true;
      bench.add(slat);
    }
    [-0.58, 0.58].forEach(function (x) {
      bench.add(mesh(new T.BoxGeometry(0.04, 0.45, 0.34), M.panel, x, 0.225, 0));
    });
    bench.position.set(-1.05, 0, 1.9);
    scene.add(bench);

    // plant by the window
    const pot = mesh(new T.CylinderGeometry(0.17, 0.13, 0.32, 24), std("#b5653f", { roughness: 0.8 }), -2.6, 0.16, -1.65);
    scene.add(pot);
    for (let i = 0; i < 9; i++) {
      const leaf = mesh(new T.ConeGeometry(0.05, 0.6 + (i % 3) * 0.15, 6), std("#5d7f5a", { roughness: 0.8 }), -2.6, 0.55, -1.65);
      leaf.rotation.z = Math.cos(i * 2.4) * 0.45;
      leaf.rotation.x = Math.sin(i * 2.4) * 0.45;
      leaf.position.x += Math.cos(i * 2.4) * 0.08;
      leaf.position.z += Math.sin(i * 2.4) * 0.08;
      leaf.castShadow = true;
      scene.add(leaf);
    }

    // folding table
    const table = new T.Group();
    // birch-ply top: soft grain so the table reads as wood, not a flat slab
    const grainTex = canvasTex(1024, 512, function (c, w, h) {
      c.fillStyle = "#d9c4a2";
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) {
        const y = (i / 140) * h + Math.sin(i * 1.7) * 3;
        c.strokeStyle = "rgba(120,84,48," + (0.04 + ((i * 37) % 9) / 100) + ")";
        c.lineWidth = 1 + ((i * 13) % 3);
        c.beginPath();
        c.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) {
          c.lineTo(x, y + Math.sin(x / 140 + i) * 4 + Math.sin(x / 37 + i * 3) * 1.2);
        }
        c.stroke();
      }
      c.fillStyle = "rgba(255,248,236,0.18)";
      c.fillRect(0, 0, w, 6);
    }, true);
    const top = mesh(new T.BoxGeometry(1.4, 0.04, 0.8), std("#ffffff", { roughness: 0.62, map: grainTex }), 0, 0.83, 0);
    top.receiveShadow = true;
    top.castShadow = true;
    table.add(top);
    [[-0.65, -0.35], [0.65, -0.35], [-0.65, 0.35], [0.65, 0.35]].forEach(function (p) {
      table.add(mesh(new T.BoxGeometry(0.04, 0.81, 0.04), M.panel, p[0], 0.405, p[1]));
    });
    table.position.set(0.8, 0, 0.85);
    scene.add(table);
    W.table = table;
    W.tableTopY = 0.85;
    W.tableSpot = new T.Vector3(0.62, 0.854, 0.88);
    W.stackSpot = new T.Vector3(1.25, 0.854, 0.88);

    // folding board with thirds guides (sleeve, sleeve, bottom up)
    const boardTex = canvasTex(740, 640, function (c, w, h) {
      c.fillStyle = "#2f5650";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(235,242,236,0.13)";
      c.lineWidth = 2;
      for (let x = 20; x < w; x += 40) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
      }
      for (let y = 20; y < h; y += 40) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
      c.strokeStyle = "rgba(244,222,170,0.75)";
      c.lineWidth = 4;
      c.setLineDash([18, 12]);
      [w / 3, (2 * w) / 3].forEach(function (x) {
        c.beginPath();
        c.moveTo(x, 18);
        c.lineTo(x, h - 18);
        c.stroke();
      });
      c.beginPath();
      c.moveTo(18, h * 0.55);
      c.lineTo(w - 18, h * 0.55);
      c.stroke();
      c.setLineDash([]);
      c.strokeStyle = "rgba(235,242,236,0.35)";
      c.lineWidth = 6;
      c.strokeRect(6, 6, w - 12, h - 12);
    }, true);
    const boardMat = new T.MeshStandardMaterial({ map: boardTex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -2 });
    // slope-independent offset: a slope factor pulled the board through the shirt at grazing phone angles
    const board = mesh(new T.PlaneGeometry(0.74, 0.64), boardMat, W.tableSpot.x, 0.8505, W.tableSpot.z);
    board.rotation.x = -Math.PI / 2;
    board.receiveShadow = true;
    board.userData.pass = true;
    scene.add(board);

    // table props along the back edge (decor only, clicks pass through)
    const decor = [];
    const boxTex = canvasTex(256, 320, function (c, w, h) {
      c.fillStyle = "#f4efe4";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#7a93b8";
      c.fillRect(0, h * 0.18, w, h * 0.42);
      c.fillStyle = "#fbf8f1";
      c.font = "bold 58px " + FONT_DISPLAY;
      c.textAlign = "center";
      c.fillText("lavanda", w / 2, h * 0.43);
      c.fillStyle = "#2b3236";
      c.font = "600 30px " + FONT_DISPLAY;
      c.fillText("1 kg", w / 2, h * 0.78);
    }, true);
    const boxMat = std("#f4efe4", { roughness: 0.75 });
    const box = mesh(new T.BoxGeometry(0.16, 0.2, 0.08), [boxMat, boxMat, boxMat, boxMat, std("#ffffff", { map: boxTex, roughness: 0.7 }), boxMat], 0.25, 0.95, 0.53);
    box.rotation.y = 0.18;
    decor.push(box);
    const scoop = mesh(new T.CylinderGeometry(0.03, 0.025, 0.035, 18, 1, true), std("#e8e3d8", { roughness: 0.4, side: T.DoubleSide }), 0.39, 0.868, 0.56);
    decor.push(scoop);
    const spray = new T.Group();
    const sprayPts = [[0, 0], [0.03, 0], [0.034, 0.006], [0.034, 0.118], [0.03, 0.136], [0.016, 0.152], [0.0135, 0.158], [0.0135, 0.168], [0, 0.168]];
    const sprayGlass = new T.MeshPhysicalMaterial({ color: "#cfe3dc", roughness: 0.12, transmission: W.lite ? 0 : 0.6, transparent: true, opacity: 0.78, thickness: 0.01 });
    spray.add(mesh(new T.LatheGeometry(sprayPts.map(function (p) {
      return new T.Vector2(p[0], p[1]);
    }), 32), sprayGlass, 0, 0, 0));
    spray.add(mesh(new T.CylinderGeometry(0.031, 0.031, 0.075, 28), std("#7fb7a7", { roughness: 0.2, transparent: true, opacity: 0.7 }), 0, 0.042, 0));
    const darkPlastic = std("#2b3236", { roughness: 0.45 });
    spray.add(mesh(new T.CylinderGeometry(0.017, 0.017, 0.016, 20), darkPlastic, 0, 0.174, 0));
    const headShape = new T.Shape();
    headShape.moveTo(-0.016, 0);
    headShape.lineTo(0.05, 0);
    headShape.lineTo(0.056, 0.012);
    headShape.lineTo(0.05, 0.03);
    headShape.quadraticCurveTo(0.0, 0.05, -0.02, 0.032);
    headShape.lineTo(-0.016, 0);
    const head = mesh(new T.ExtrudeGeometry(headShape, { depth: 0.026, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }), darkPlastic, 0, 0.181, -0.013);
    spray.add(head);
    const triggerShape = new T.Shape();
    triggerShape.moveTo(0, 0);
    triggerShape.quadraticCurveTo(0.014, -0.02, 0.008, -0.05);
    triggerShape.lineTo(0.0, -0.05);
    triggerShape.quadraticCurveTo(0.004, -0.02, -0.006, 0);
    spray.add(mesh(new T.ExtrudeGeometry(triggerShape, { depth: 0.012, bevelEnabled: false }), std("#d9cbb0", { roughness: 0.5 }), 0.032, 0.184, -0.006));
    spray.add(mesh(new T.CylinderGeometry(0.004, 0.005, 0.01, 10), std("#c8442c", { roughness: 0.5 }), 0.06, 0.193, 0).rotateZ(Math.PI / 2));
    spray.position.set(1.46, 0.85, 0.54);
    spray.rotation.y = -0.6;
    spray.traverse(function (o) {
      o.castShadow = true;
    });
    decor.push(spray);
    const mug = new T.Group();
    const glaze = new T.MeshPhysicalMaterial({ color: "#b8503a", roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    const mugPts = [[0, 0.004], [0.03, 0], [0.034, 0.004], [0.038, 0.08], [0.039, 0.086], [0.0345, 0.086], [0.0335, 0.012], [0, 0.012]];
    mug.add(mesh(new T.LatheGeometry(mugPts.map(function (p) {
      return new T.Vector2(p[0], p[1]);
    }), 36), glaze, 0, 0, 0));
    mug.add(mesh(new T.CircleGeometry(0.0338, 32), std("#6b3f22", { roughness: 0.15 }), 0, 0.07, 0).rotateX(-Math.PI / 2));
    const mugHandle = mesh(new T.TorusGeometry(0.021, 0.0065, 10, 20, Math.PI * 1.15), glaze, -0.038, 0.045, 0);
    mugHandle.rotation.z = Math.PI * 0.43;
    mug.add(mugHandle);
    mug.position.set(0.16, 0.851, 1.17);
    mug.traverse(function (o) {
      o.castShadow = true;
    });
    decor.push(mug);

    // rolling laundry cart parked behind the table
    const cart = new T.Group();
    const bagMat = std("#8a9a8c", { roughness: 0.95, side: T.DoubleSide });
    const bag = mesh(new T.CylinderGeometry(0.3, 0.26, 0.42, 4, 3, true), bagMat, 0, 0.55, 0);
    bag.rotation.y = Math.PI / 4;
    bag.scale.set(1.15, 1, 0.8);
    bag.castShadow = true;
    cart.add(bag);
    const lump = mesh(new T.SphereGeometry(0.2, 14, 10), std("#e9e2d2", { roughness: 0.95 }), 0.02, 0.72, 0);
    lump.scale.set(1.3, 0.45, 0.9);
    cart.add(lump);
    [[-0.3, -0.22], [0.3, -0.22], [-0.3, 0.22], [0.3, 0.22]].forEach(function (p) {
      cart.add(mesh(new T.CylinderGeometry(0.01, 0.01, 0.74, 8), M.chrome, p[0], 0.41, p[1]));
      cart.add(mesh(new T.SphereGeometry(0.025, 10, 8), M.rubber || std("#222", { roughness: 0.9 }), p[0], 0.025, p[1]));
    });
    cart.add(mesh(new T.BoxGeometry(0.64, 0.012, 0.012), M.chrome, 0, 0.78, -0.22));
    cart.add(mesh(new T.BoxGeometry(0.64, 0.012, 0.012), M.chrome, 0, 0.78, 0.22));
    cart.position.set(-0.05, 0, 0.12);
    cart.rotation.y = 0.25;
    decor.push(cart);

    // the lost grey sock from the notice board, waiting on the bench
    const sockPts = [
      new T.Vector3(0, 0, 0),
      new T.Vector3(0.09, 0.004, 0.01),
      new T.Vector3(0.16, 0.006, 0.0),
      new T.Vector3(0.2, 0.006, 0.05),
      new T.Vector3(0.21, 0.004, 0.1),
    ];
    const sock = mesh(new T.TubeGeometry(new T.CatmullRomCurve3(sockPts), 24, 0.024, 10), std("#9aa0a2", { roughness: 1 }), -0.85, 0.485, 1.86);
    sock.scale.y = 0.45;
    sock.rotation.y = 0.6;
    decor.push(sock);

    decor.forEach(function (o) {
      o.traverse(function (m) {
        if (m.isMesh) {
          m.castShadow = true;
          m.userData.pass = true;
        }
      });
      scene.add(o);
    });

    // clothesline in front of the window
    const lineX = -2.55;
    const lineY = 1.86;
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const z = -1.25 + i * 0.125;
      pts.push(new T.Vector3(lineX, lineY - 0.05 * (1 - Math.pow(z / 1.25, 2)), z));
    }
    const line = mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 0.0045, 6), std("#efe9dc", { roughness: 0.7 }), 0, 0, 0);
    line.castShadow = true;
    scene.add(line);
    [-1.27, 1.27].forEach(function (z) {
      scene.add(mesh(new T.CylinderGeometry(0.012, 0.012, 0.45, 8), M.chrome, -2.78, lineY, z).rotateZ(Math.PI / 2));
    });
    W.lineSlots = [-0.9, -0.3, 0.3, 0.9].map(function (z) {
      return new T.Vector3(lineX, lineY - 0.05 * (1 - Math.pow(z / 1.25, 2)), z);
    });

    // basket carried with the camera
    W.basket = makeBasket();
    camera.add(W.basket.group);

    // drip pool
    const dripGeo = new T.SphereGeometry(0.006, 6, 4);
    const dripMat = std("#cfe6f0", { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.8 });
    W.drips = [];
    for (let i = 0; i < 40; i++) {
      const dm = new T.Mesh(dripGeo, dripMat);
      dm.visible = false;
      dm.scale.y = 1.6;
      scene.add(dm);
      W.drips.push({ mesh: dm, v: 0, alive: false });
    }
    // puddle under the line
    const puddleMat = std("#9fb9c4", { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0 });
    const puddle = mesh(new T.CircleGeometry(0.5, 32), puddleMat, lineX + 0.05, 0.003, 0);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(0.6, 2.1, 1);
    scene.add(puddle);
    W.puddle = puddle;

    // contact shadows: soft pools where heavy things meet the floor, so nothing floats
    const aoTex = canvasTex(128, 128, function (c, s) {
      const g = c.createRadialGradient(s / 2, s / 2, s * 0.06, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(0,0,0,0.85)");
      g.addColorStop(0.5, "rgba(0,0,0,0.42)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    });
    function contactShadow(x, z, w, d, strength) {
      const m = new T.Mesh(
        new T.PlaneGeometry(w, d),
        new T.MeshBasicMaterial({ map: aoTex, color: "#20170e", transparent: true, opacity: strength, depthWrite: false })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.004, z);
      m.renderOrder = 1;
      m.userData.pass = true;
      scene.add(m);
      return m;
    }
    [-1.5, -0.75, 0.6].forEach(function (x) {
      contactShadow(x, -1.3, 0.95, 0.9, 0.55);
    });
    contactShadow(1.85, -1.55, 0.8, 0.7, 0.5);
    contactShadow(-1.05, 1.9, 1.6, 0.6, 0.28);
    [-0.58, 0.58].forEach(function (x) {
      contactShadow(-1.05 + x, 1.9, 0.18, 0.5, 0.45);
    });
    contactShadow(0.8, 0.85, 1.7, 1.1, 0.22);
    [[-0.65, -0.35], [0.65, -0.35], [-0.65, 0.35], [0.65, 0.35]].forEach(function (p) {
      contactShadow(0.8 + p[0], 0.85 + p[1], 0.16, 0.16, 0.5);
    });
    contactShadow(-2.6, -1.65, 0.55, 0.55, 0.5);

    // highlight ring for "tap here"
    const ringTex = canvasTex(128, 128, function (c, s) {
      c.strokeStyle = "rgba(255,255,255,0.95)";
      c.lineWidth = 7;
      c.beginPath();
      c.arc(s / 2, s / 2, s / 2 - 8, 0, Math.PI * 2);
      c.stroke();
    });
    const marker = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: ringTex, transparent: true, depthTest: false, toneMapped: false, color: "#ffd9cf" }));
    marker.renderOrder = 10;
    marker.userData.pass = true;
    marker.visible = false;
    scene.add(marker);
    W.marker = marker;

    W.setTheme(W.theme);
    return W;
  };

  W.setTheme = function (theme) {
    W.theme = theme;
    const night = theme !== "day";
    const L = W.lights;
    if (!L) {
      return;
    }
    L.hemi.intensity = night ? 0.55 : 1.15;
    L.hemi.color.set(night ? "#dfe8ef" : "#fff4e4");
    L.ceilA.intensity = night ? 9 : 3;
    L.ceilB.intensity = night ? 9 : 3;
    L.sun.color.set(night ? "#8fa8c8" : "#ffe1b8");
    L.sun.intensity = night ? 0.35 : 2.6;
    W.renderer.toneMappingExposure = night ? 1.0 : 1.05;
    W.scene.background = new T.Color(night ? "#0e1417" : "#e9e4d8");
    W.rain.material.uniforms.uOn.value = night ? 1 : 0.45;
    W.rain.material.uniforms.uStreak.value = night ? 1 : 0;
    if (W.windowLight) {
      // day: warm sun through the glass; night: a faint cool streetlamp spill
      W.windowLight.shaftMat.color.set(night ? "#9fb6d6" : "#ffe3b8");
      W.windowLight.shaftMat.opacity = night ? 0.05 : 0.12;
      W.windowLight.patchMat.color.set(night ? "#9fb6d6" : "#ffdcae");
      W.windowLight.patchMat.opacity = night ? 0.07 : 0.2;
    }
    redraw(W.outside.material.map);
    redraw(W.skyline.material.map);
  };

  W.setLang = function () {
    redraw(W.signTex);
    redraw(W.changer.headTex);
    redraw(W.changer.infoTex);
    W.posters.forEach(function (p) {
      redraw(p.userData.tex);
    });
  };
})();
