/* Bilas shirts: a T-shirt split into six panels on hinges so it can fold in thirds and in half,
   plus a crumpled form for the basket and drum, and a wrinkle layer that smoothing erases. */
(function () {
  "use strict";
  const T = THREE;
  const SH = {};
  window.BilasShirts = SH;

  const TEX = 256;
  // wrinkle + composite layers are drawn at twice the fabric density so creases stay crisp
  const WTEX = 512;
  const WS = WTEX / TEX;
  const BX = 0.9;
  const BY = 0.7;
  const Q = 0.125;
  const HALF = 0.25;
  const TOP = 0.34;

  SH.COLORS = [
    { base: "#d9cbb0", trim: "#8c7a5b", name: "oat" },
    { base: "#9db59a", trim: "#56704f", name: "sage" },
    { base: "#2f4057", trim: "#f1ece0", name: "navy" },
    { base: "#b5653f", trim: "#f1d8bf", name: "rust" },
    { base: "#9cc0d8", trim: "#2f4a5e", name: "sky" },
    { base: "#efe7d6", trim: "#c8442c", name: "cream" },
    { base: "#45494d", trim: "#d9cbb0", name: "charcoal" },
    { base: "#d1a548", trim: "#5a4318", name: "mustard" },
    { base: "#d49a94", trim: "#6f3b36", name: "rose" }
  ];
  SH.PATTERNS = ["plain", "stripe", "pocket", "ringer", "print"];


  /* jersey knit: tiny V loops in rows, shared by every shirt (bump only, no colour) */
  let knitCache = null;

  function knitTexture() {
    if (knitCache) {
      return knitCache;
    }
    const cv = document.createElement("canvas");
    cv.width = 128;
    cv.height = 128;
    const c = cv.getContext("2d");
    c.fillStyle = "#808080";
    c.fillRect(0, 0, 128, 128);
    c.lineWidth = 1.4;
    for (let y = 0; y < 128; y += 4) {
      for (let x = 0; x < 128; x += 4) {
        const v = 150 + Math.floor(Math.random() * 40);
        c.strokeStyle = "rgb(" + v + "," + v + "," + v + ")";
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + 2, y + 3.4);
        c.lineTo(x + 4, y);
        c.stroke();
      }
    }
    const flat = new T.CanvasTexture(cv);
    flat.wrapS = T.RepeatWrapping;
    flat.wrapT = T.RepeatWrapping;
    flat.repeat.set(10, 10);
    const crumple = flat.clone();
    crumple.repeat.set(14, 14);
    knitCache = { flat: flat, crumple: crumple };
    return knitCache;
  }

  function px(x) {
    return (x / BX + 0.5) * TEX;
  }

  function py(y) {
    return (1 - (y / BY + 0.5)) * TEX;
  }

  function drawFabric(c, spec) {
    c.fillStyle = spec.color.base;
    c.fillRect(0, 0, TEX, TEX);
    if (spec.pattern === "stripe") {
      c.fillStyle = spec.color.trim;
      for (let y = -0.34; y < 0.36; y += 0.05) {
        c.fillRect(0, py(y), TEX, 0.017 / BY * TEX);
      }
    }
    if (spec.pattern === "pocket") {
      c.strokeStyle = "rgba(0,0,0,0.25)";
      c.lineWidth = 1.5;
      c.setLineDash([3, 2]);
      c.strokeRect(px(0.075), py(0.22), 0.075 / BX * TEX, 0.08 / BY * TEX);
      c.setLineDash([]);
    }
    if (spec.pattern === "ringer") {
      c.strokeStyle = spec.color.trim;
      c.lineWidth = 6;
      c.beginPath();
      c.ellipse(px(0), py(0.34), 0.088 / BX * TEX, 0.052 / BY * TEX, 0, 0, Math.PI);
      c.stroke();
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(px(-0.43), py(0.24));
      c.lineTo(px(-0.37), py(0.12));
      c.moveTo(px(0.43), py(0.24));
      c.lineTo(px(0.37), py(0.12));
      c.stroke();
    }
    if (spec.pattern === "print") {
      c.fillStyle = spec.color.trim;
      c.beginPath();
      c.arc(px(0), py(0.13), 0.055 / BX * TEX, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = spec.color.base;
      c.lineWidth = 2.5;
      c.beginPath();
      for (let i = 0; i <= 20; i++) {
        const x = -0.045 + i * 0.0045;
        const y = 0.13 + Math.sin(i * 0.9) * 0.012;
        if (i === 0) {
          c.moveTo(px(x), py(y));
        } else {
          c.lineTo(px(x), py(y));
        }
      }
      c.stroke();
    }
    // weave and hem stitches
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
      c.fillRect(Math.random() * TEX, Math.random() * TEX, 2, 1);
    }
    c.strokeStyle = "rgba(0,0,0,0.22)";
    c.lineWidth = 1;
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(px(-0.25), py(-0.315));
    c.lineTo(px(0.25), py(-0.315));
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = "rgba(0,0,0,0.18)";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(px(0), py(0.34), 0.092 / BX * TEX, 0.056 / BY * TEX, 0, 0, Math.PI);
    c.stroke();
  }

  function drawWrinkles(c, seed) {
    // Cotton creases as a cloth would really hold them: tapered folds in near-parallel families
    // (drag folds from each armpit, compression ripples above the hem, one fold down each sleeve).
    // Each fold is a soft shaded valley with a thin lit ridge on its upper-left side.
    c.clearRect(0, 0, WTEX, WTEX);
    let s = seed;
    function r() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    }
    function wx(x) {
      return px(x) * WS;
    }
    function wy(y) {
      return py(y) * WS;
    }
    function band(pts, widths, side) {
      // closed tapered ribbon along pts, offset by `side` (in widths) from the centre line
      c.beginPath();
      const left = [];
      const right = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const w = widths[i];
        const o = side * w;
        left.push([pts[i][0] + nx * (o + w * 0.5), pts[i][1] + ny * (o + w * 0.5)]);
        right.push([pts[i][0] + nx * (o - w * 0.5), pts[i][1] + ny * (o - w * 0.5)]);
      }
      left.forEach(function (p, i) {
        if (i === 0) {
          c.moveTo(p[0], p[1]);
        } else {
          c.lineTo(p[0], p[1]);
        }
      });
      for (let i = right.length - 1; i >= 0; i--) {
        c.lineTo(right[i][0], right[i][1]);
      }
      c.closePath();
      c.fill();
    }
    function fold(x1, y1, x2, y2, bend, width, depth) {
      const pts = [];
      const widths = [];
      const n = 26;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const cx = mx - Math.sin(ang) * bend;
      const cy = my + Math.cos(ang) * bend;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        const x = u * u * x1 + 2 * u * t * cx + t * t * x2;
        const y = u * u * y1 + 2 * u * t * cy + t * t * y2;
        pts.push([wx(x), wy(y)]);
        widths.push(width * WS * Math.pow(Math.sin(Math.PI * t), 0.75));
      }
      // valley: soft shade spread wider than the crease
      c.filter = "blur(" + (2.2 * WS).toFixed(1) + "px)";
      c.fillStyle = "rgba(24,16,10," + (0.2 * depth).toFixed(3) + ")";
      band(pts, widths.map(function (w) {
        return w * 1.6;
      }), 0.15);
      // crease core: narrow, darker, nearly sharp
      c.filter = "blur(" + (0.6 * WS).toFixed(1) + "px)";
      c.fillStyle = "rgba(20,12,6," + (0.26 * depth).toFixed(3) + ")";
      band(pts, widths.map(function (w) {
        return w * 0.42;
      }), 0.35);
      // lit ridge beside it, thin and quiet so dark shirts never look scribbled
      c.filter = "blur(" + (0.9 * WS).toFixed(1) + "px)";
      c.fillStyle = "rgba(255,250,238," + (0.13 * depth).toFixed(3) + ")";
      band(pts, widths.map(function (w) {
        return w * 0.5;
      }), -0.55);
    }
    c.save();
    // broad rumple underneath, very low contrast
    c.filter = "blur(" + (14 * WS).toFixed(0) + "px)";
    for (let i = 0; i < 6; i++) {
      c.fillStyle = r() < 0.5 ? "rgba(20,15,10,0.05)" : "rgba(255,255,255,0.05)";
      c.beginPath();
      c.ellipse(wx(-0.2 + r() * 0.4), wy(-0.26 + r() * 0.52), (14 + r() * 20) * WS, (7 + r() * 10) * WS, r() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
    // drag folds fanning from each armpit toward the opposite hip
    [-1, 1].forEach(function (side) {
      const count = 3 + Math.floor(r() * 2);
      for (let i = 0; i < count; i++) {
        const sx = side * (0.17 - i * 0.012) + (r() - 0.5) * 0.01;
        const sy = 0.12 - i * 0.045 + (r() - 0.5) * 0.015;
        const len = 0.15 + r() * 0.08 - i * 0.01;
        const a = -Math.PI / 2 - side * (0.3 + i * 0.05 + (r() - 0.5) * 0.1);
        fold(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len, (r() - 0.5) * 0.03, 5 + r() * 2.5, 0.85 + r() * 0.3);
      }
    });
    // compression ripples above the hem, staggered so they never line up
    for (let i = 0; i < 3; i++) {
      const y = -0.17 - i * 0.045 + (r() - 0.5) * 0.012;
      const x0 = -0.2 + r() * 0.12;
      const x1 = x0 + 0.14 + r() * 0.16;
      fold(x0, y, Math.min(0.22, x1), y + (r() - 0.5) * 0.03, (r() - 0.5) * 0.025, 4.5 + r() * 2, 0.8 + r() * 0.3);
    }
    // one soft fold down each sleeve and a small dip under the collar
    [-1, 1].forEach(function (side) {
      fold(side * 0.27, 0.23 + (r() - 0.5) * 0.02, side * 0.38, 0.17, (r() - 0.5) * 0.02, 4, 0.8);
    });
    fold(-0.05, 0.25, 0.05, 0.25, -0.012, 3.5, 0.6);
    c.restore();
  }

  function shapeFrom(points) {
    const s = new T.Shape();
    points.forEach(function (p, i) {
      if (i === 0) {
        s.moveTo(p[0], p[1]);
      } else {
        s.lineTo(p[0], p[1]);
      }
    });
    s.closePath();
    return tessellate(new T.ShapeGeometry(s), 0.03);
  }

  // Split every edge longer than maxLen at its midpoint (decided per edge, so neighbours agree and
  // the drape displacement never opens cracks). Gives the flat panels interior vertices to bend.
  function tessellate(geo, maxLen) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const pos = src.attributes.position;
    const uv = src.attributes.uv;
    const outP = [];
    const outU = [];
    function vert(i) {
      return { x: pos.getX(i), y: pos.getY(i), u: uv.getX(i), v: uv.getY(i) };
    }
    function mid(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 };
    }
    function long(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y) > maxLen;
    }
    function emit(a, b, c) {
      [a, b, c].forEach(function (p) {
        outP.push(p.x, p.y, 0);
        outU.push(p.u, p.v);
      });
    }
    function tri(a, b, c, depth) {
      const lab = long(a, b);
      const lbc = long(b, c);
      const lca = long(c, a);
      if (depth > 9 || (!lab && !lbc && !lca)) {
        emit(a, b, c);
        return;
      }
      const d = depth + 1;
      if (lab && lbc && lca) {
        const m1 = mid(a, b);
        const m2 = mid(b, c);
        const m3 = mid(c, a);
        tri(a, m1, m3, d);
        tri(m1, b, m2, d);
        tri(m3, m2, c, d);
        tri(m1, m2, m3, d);
      } else if (lab && lbc) {
        const m1 = mid(a, b);
        const m2 = mid(b, c);
        tri(a, m1, c, d);
        tri(m1, b, m2, d);
        tri(m1, m2, c, d);
      } else if (lbc && lca) {
        const m2 = mid(b, c);
        const m3 = mid(c, a);
        tri(a, b, m3, d);
        tri(b, m2, m3, d);
        tri(m3, m2, c, d);
      } else if (lca && lab) {
        const m3 = mid(c, a);
        const m1 = mid(a, b);
        tri(a, m1, m3, d);
        tri(m1, b, c, d);
        tri(m3, m1, c, d);
      } else if (lab) {
        const m1 = mid(a, b);
        tri(a, m1, c, d);
        tri(m1, b, c, d);
      } else if (lbc) {
        const m2 = mid(b, c);
        tri(a, b, m2, d);
        tri(a, m2, c, d);
      } else {
        const m3 = mid(c, a);
        tri(a, b, m3, d);
        tri(m3, b, c, d);
      }
    }
    for (let i = 0; i < pos.count; i += 3) {
      tri(vert(i), vert(i + 1), vert(i + 2), 0);
    }
    const out = new T.BufferGeometry();
    out.setAttribute("position", new T.Float32BufferAttribute(outP, 3));
    out.setAttribute("uv", new T.Float32BufferAttribute(outU, 2));
    out.computeVertexNormals();
    return out;
  }

  // Cloth drape in the vertex shader: soft rumple (fades as you smooth), a belly that billows on
  // the line, sag between the pegs and hem ripples. Displacement is a function of the panel's own
  // shirt coordinates, so neighbouring panels stay stitched together.
  const DRAPE_GLSL = [
    "uniform float uRumple; uniform float uBillow; uniform float uSag; uniform float uSeed; uniform float uBack; uniform float uOnLine;",
    "varying float vFold;",
    // pull folds: shallow ridges that fan out from each peg when the shirt hangs
    "float pegFolds(vec2 p){",
    "  float f = 0.0;",
    "  for (int i = 0; i < 2; i++) {",
    "    vec2 d = p - vec2(i == 0 ? -0.19 : 0.19, " + TOP.toFixed(3) + ");",
    "    float r = length(d);",
    "    float a = atan(d.y, d.x);",
    "    f += sin(a*9.0 + uSeed) * smoothstep(0.34, 0.05, r) * smoothstep(0.0, 0.05, r);",
    "  }",
    "  return f;",
    "}",
    "float drapeZf(vec2 p, float hi){",
    "  float n = sin(p.x*23.0+uSeed)*sin(p.y*19.0+uSeed*1.7)*0.5 + hi*(sin(p.x*41.0-p.y*37.0+uSeed*2.3)*0.3 + sin((p.x+p.y)*67.0+uSeed)*0.12);",
    "  float rumple = uRumple*(0.55+0.45*n);",
    "  float bx = 1.0 - pow(clamp(abs(p.x)/" + (HALF * 1.05).toFixed(3) + ", 0.0, 1.0), 2.0);",
    "  float by = smoothstep(" + TOP.toFixed(3) + ", " + (TOP - 0.16).toFixed(3) + ", p.y) * (0.55 + 0.45*smoothstep(-" + TOP.toFixed(3) + ", -" + (TOP - 0.18).toFixed(3) + ", p.y));",
    "  float hem = smoothstep(-0.05, -" + TOP.toFixed(3) + ", p.y);",
    "  float ripple = sin(p.x*26.0+uSeed*3.0)*0.35 + sin(p.x*47.0-uSeed)*0.15;",
    "  return rumple + uBillow*(bx*by + hem*ripple*0.45) + uSag*0.32*pegFolds(p);",
    "}",
    "float drapeZ(vec2 p){ return drapeZf(p, 1.0); }",
    // shading uses only the broad folds, so fine rumple never reads as blotches
    "float drapeS(vec2 p){ return drapeZf(p, 0.0); }",
    "float drapeY(vec2 p){",
    "  float top = smoothstep(" + (TOP - 0.2).toFixed(3) + ", " + TOP.toFixed(3) + ", p.y);",
    "  float between = max(0.0, 1.0 - pow(p.x/0.19, 2.0));",
    "  float sleeve = smoothstep(0.17, " + HALF.toFixed(3) + ", abs(p.x)) * smoothstep(0.0, 0.3, p.y);",
    "  return -uSag*(top*between*0.8 + sleeve*1.6);",
    "}"
  ].join("\n");

  function addDrape(material, uniforms) {
    material.onBeforeCompile = function (shader) {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uBack; uniform float uOnLine; varying float vFold;")
        .replace("#include <color_fragment>", [
          "#include <color_fragment>",
          // ridges catch the light, valleys between folds fall into soft shade
          "float foldSide = gl_FrontFacing ? 1.0 : -1.0;",
          "diffuseColor.rgb *= clamp(1.0 + vFold * foldSide, 0.66, 1.14);"
        ].join("\n"))
        .replace("#include <emissivemap_fragment>", [
          "#include <emissivemap_fragment>",
          // daylight through thin cotton on the line
          "totalEmissiveRadiance += diffuseColor.rgb * uBack * uOnLine;"
        ].join("\n"));
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\n" + DRAPE_GLSL)
        .replace("#include <beginnormal_vertex>", [
          "vec3 objectNormal = vec3(normal);",
          "{",
          "  float e = 0.008;",
          "  float gx = drapeZ(position.xy + vec2(e, 0.0)) - drapeZ(position.xy - vec2(e, 0.0));",
          "  float gy = drapeZ(position.xy + vec2(0.0, e)) - drapeZ(position.xy - vec2(0.0, e));",
          "  objectNormal = normalize(vec3(-gx / (2.0*e), -gy / (2.0*e), 1.0)) * (normal.z < 0.0 ? -1.0 : 1.0);",
          "}",
          "#ifdef USE_TANGENT",
          "vec3 objectTangent = vec3(tangent.xyz);",
          "#endif"
        ].join("\n"))
        .replace("#include <begin_vertex>", [
          "vec3 transformed = vec3(position);",
          "{",
          "  float e2 = 0.012;",
          "  float c0 = drapeS(position.xy);",
          "  float lap = drapeS(position.xy + vec2(e2, 0.0)) + drapeS(position.xy - vec2(e2, 0.0)) + drapeS(position.xy + vec2(0.0, e2)) + drapeS(position.xy - vec2(0.0, e2)) - 4.0*c0;",
          "  vFold = clamp(-lap / (e2*e2) * 0.035, -0.26, 0.12);",
          "}",
          "transformed.z += drapeZ(position.xy);",
          "transformed.y += drapeY(position.xy);"
        ].join("\n"));
    };
    material.customProgramCacheKey = function () {
      return "bilas-drape-2";
    };
  }

  const neck = [];
  for (let i = 0; i <= 10; i++) {
    const a = i / 10 * Math.PI;
    neck.push([0.088 * Math.cos(a), TOP - 0.052 * Math.sin(a)]);
  }

  const GEO = {
    centerTop: shapeFrom([[-Q, 0], [Q, 0], [Q, TOP]].concat(neck).concat([[-Q, TOP]])),
    centerBottom: shapeFrom([[-Q, -TOP], [Q, -TOP], [Q, 0], [-Q, 0]]),
    leftTop: shapeFrom([[-Q, 0], [-HALF, 0], [-HALF, 0.17], [-0.36, 0.115], [-0.43, 0.245], [-HALF, 0.335], [-Q, TOP]]),
    leftBottom: shapeFrom([[-HALF, -TOP], [-Q, -TOP], [-Q, 0], [-HALF, 0]]),
    rightTop: shapeFrom([[Q, 0], [Q, TOP], [HALF, 0.335], [0.43, 0.245], [0.36, 0.115], [HALF, 0.17], [HALF, 0]]),
    rightBottom: shapeFrom([[Q, -TOP], [HALF, -TOP], [HALF, 0], [Q, 0]])
  };

  function crumpleGeo(seed) {
    const g = new T.IcosahedronGeometry(0.1, 5);
    const p = g.attributes.position;
    const v = new T.Vector3();
    const ph = [seed * 1.3, seed * 2.1, seed * 0.7];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = v.clone().normalize();
      // big lumps + soft fabric ridges (abs of a sine gives a fold crest, not a facet)
      const ridge = 1 - Math.abs(Math.sin(n.x * 6.5 + n.z * 4.2 + ph[1]));
      const ridge2 = 1 - Math.abs(Math.sin(n.y * 7.5 - n.x * 3.1 + ph[2]));
      const k = 1 + 0.16 * Math.sin(n.x * 5 + ph[0]) * Math.cos(n.y * 4 + ph[1]) + 0.1 * Math.sin(n.z * 7 + ph[2]) + 0.07 * ridge * ridge + 0.05 * ridge2 * ridge2;
      v.copy(n).multiplyScalar(0.1 * k);
      p.setXYZ(i, v.x * 1.3, v.y * 0.62, v.z * 1.05);
    }
    g.computeVertexNormals();
    return g;
  }

  let seedCounter = 1;
  const BACKLIGHT = { value: 0.2 };

  SH.setBacklight = function (v) {
    BACKLIGHT.value = v;
  };

  SH.create = function (spec) {
    const seed = seedCounter++;
    const base = document.createElement("canvas");
    base.width = TEX;
    base.height = TEX;
    drawFabric(base.getContext("2d"), spec);
    const wr = document.createElement("canvas");
    wr.width = WTEX;
    wr.height = WTEX;
    const comp = document.createElement("canvas");
    comp.width = WTEX;
    comp.height = WTEX;
    const tex = new T.CanvasTexture(comp);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = T.RepeatWrapping;
    tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(1 / BX, 1 / BY);
    tex.offset.set(0.5, 0.5);
    const knit = knitTexture();
    const mat = new T.MeshStandardMaterial({ map: tex, bumpMap: knit.flat, bumpScale: 1.2, side: T.DoubleSide, roughness: 0.95, color: "#ffffff" });
    const drape = {
      uRumple: { value: 0 },
      uBillow: { value: 0 },
      uSag: { value: 0 },
      uSeed: { value: seed * 1.37 },
      uBack: BACKLIGHT,
      uOnLine: { value: 0 }
    };
    addDrape(mat, drape);
    const crumpleTex = tex.clone();
    crumpleTex.repeat.set(2.2, 2.2);
    crumpleTex.offset.set(0.1, 0.2);
    const crumpleMat = new T.MeshStandardMaterial({ map: crumpleTex, bumpMap: knit.crumple, bumpScale: 1.6, roughness: 0.95, color: "#ffffff" });

    const root = new T.Group();
    const flat = new T.Group();
    root.add(flat);

    function piece(geo, tag, parent, offset) {
      const m = new T.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.position.copy(offset);
      m.userData.piece = tag;
      parent.add(m);
      return m;
    }
    const pivots = {};
    const pieces = [];
    pieces.push(piece(GEO.centerTop, "C", flat, new T.Vector3(0, 0, 0)));
    pivots.lt = new T.Group();
    pivots.lt.position.set(-Q, 0, 0.002);
    flat.add(pivots.lt);
    pieces.push(piece(GEO.leftTop, "L", pivots.lt, new T.Vector3(Q, 0, -0.002)));
    pivots.rt = new T.Group();
    pivots.rt.position.set(Q, 0, 0.004);
    flat.add(pivots.rt);
    pieces.push(piece(GEO.rightTop, "R", pivots.rt, new T.Vector3(-Q, 0, -0.004)));
    pivots.b = new T.Group();
    pivots.b.position.set(0, 0, 0.006);
    flat.add(pivots.b);
    pieces.push(piece(GEO.centerBottom, "B", pivots.b, new T.Vector3(0, 0, -0.006)));
    pivots.lb = new T.Group();
    pivots.lb.position.set(-Q, 0, 0.002 - 0.006);
    pivots.b.add(pivots.lb);
    pieces.push(piece(GEO.leftBottom, "L", pivots.lb, new T.Vector3(Q, 0, -0.002)));
    pivots.rb = new T.Group();
    pivots.rb.position.set(Q, 0, 0.004 - 0.006);
    pivots.b.add(pivots.rb);
    pieces.push(piece(GEO.rightBottom, "R", pivots.rb, new T.Vector3(-Q, 0, -0.004)));

    const crumple = new T.Mesh(crumpleGeo(seed), crumpleMat);
    crumple.castShadow = true;
    root.add(crumple);

    // folded bulk: the layers under a folded shirt, so the stack has real thickness
    const slabMat = new T.MeshStandardMaterial({ color: spec.color.base, bumpMap: knit.flat, bumpScale: 1, roughness: 0.95 });
    const slab = new T.Mesh(new T.BoxGeometry(2 * Q - 0.006, TOP - 0.006, 0.009), slabMat);
    slab.position.set(0, TOP / 2, -0.0047);
    slab.castShadow = true;
    slab.receiveShadow = true;
    slab.visible = false;
    flat.add(slab);

    const shirt = {
      spec: spec,
      root: root,
      flat: flat,
      crumple: crumple,
      pieces: pieces,
      pivots: pivots,
      mat: mat,
      crumpleMat: crumpleMat,
      drape: drape,
      slab: slab,
      wet: 0,
      wrinkles: 0,
      touched: new Set(),
      cells: 0
    };

    shirt.compose = function () {
      const c = comp.getContext("2d");
      c.clearRect(0, 0, WTEX, WTEX);
      c.drawImage(base, 0, 0, WTEX, WTEX);
      if (shirt.wrinkles > 0) {
        c.drawImage(wr, 0, 0);
      }
      tex.needsUpdate = true;
      crumpleTex.needsUpdate = true;
    };

    // drape presets: "line" billows and sags, "table" rumples with the wrinkles, "folded" lies flat
    shirt.setDrape = function (kind) {
      shirt.drapeKind = kind;
      drape.uBillow.value = kind === "line" ? 0.03 : 0;
      drape.uSag.value = kind === "line" ? 0.018 : 0;
      drape.uRumple.value = kind === "line" ? 0.004 : kind === "table" ? 0.014 * shirt.wrinkles : 0;
      drape.uOnLine.value = kind === "line" ? 1 : 0;
      slab.visible = kind === "folded";
    };

    shirt.setWrinkled = function () {
      drawWrinkles(wr.getContext("2d"), seed * 977);
      shirt.wrinkles = 1;
      shirt.touched = new Set();
      shirt.compose();
    };

    // count body cells for the smoothing metric (12 x 12 grid over the body rectangle)
    shirt.cells = 144;

    shirt.smoothAt = function (x, y) {
      const c = wr.getContext("2d");
      c.save();
      c.globalCompositeOperation = "destination-out";
      const gx = px(x) * WS;
      const gy = py(y) * WS;
      const rad = 22 * WS;
      const grd = c.createRadialGradient(gx, gy, 2 * WS, gx, gy, rad);
      grd.addColorStop(0, "rgba(0,0,0,1)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = grd;
      c.beginPath();
      c.arc(gx, gy, rad, 0, Math.PI * 2);
      c.fill();
      c.restore();
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const cx = Math.floor((x + HALF) / (2 * HALF) * 12) + dx;
          const cy2 = Math.floor((y + TOP) / (2 * TOP) * 12) + dy;
          if (cx >= 0 && cx < 12 && cy2 >= 0 && cy2 < 12) {
            shirt.touched.add(cx + cy2 * 12);
          }
        }
      }
      shirt.wrinkles = 1 - Math.min(1, shirt.touched.size / (shirt.cells * 0.62));
      if (shirt.drapeKind === "table") {
        drape.uRumple.value = 0.014 * shirt.wrinkles;
      }
      shirt.compose();
      return shirt.wrinkles;
    };

    shirt.setWet = function (k) {
      shirt.wet = k;
      slabMat.color.set(spec.color.base).lerp(new T.Color("#5f6b78"), k * 0.5);
      const col = new T.Color("#ffffff").lerp(new T.Color("#7d8a99"), k * 0.75);
      mat.color.copy(col);
      crumpleMat.color.copy(col);
      mat.roughness = 0.95 - k * 0.45;
      crumpleMat.roughness = mat.roughness;
    };

    shirt.setWarm = function (k) {
      mat.emissive.set("#3a1a08").multiplyScalar(k);
      crumpleMat.emissive.copy(mat.emissive);
    };

    shirt.setMode = function (mode) {
      shirt.mode = mode;
      if (mode === "crumple") {
        shirt.setDrape("none");
      }
      flat.visible = mode !== "crumple";
      crumple.visible = mode === "crumple";
      if (mode === "flat" || mode === "crumple") {
        pivots.lt.rotation.set(0, 0, 0);
        pivots.lb.rotation.set(0, 0, 0);
        pivots.rt.rotation.set(0, 0, 0);
        pivots.rb.rotation.set(0, 0, 0);
        pivots.b.rotation.set(0, 0, 0);
      }
    };

    // fold k in [0,1]; which = "L" | "R" | "B"
    shirt.foldAmount = function (which, k) {
      const a = Math.PI * k;
      if (which === "L") {
        pivots.lt.rotation.y = a;
        pivots.lb.rotation.y = a;
      } else if (which === "R") {
        pivots.rt.rotation.y = -a;
        pivots.rb.rotation.y = -a;
      } else {
        pivots.b.rotation.x = -a;
      }
    };

    shirt.setMode("crumple");
    shirt.compose();
    return shirt;
  };

  SH.randomSpecs = function (n) {
    const cols = SH.COLORS.slice().sort(function () {
      return Math.random() - 0.5;
    });
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        color: cols[i % cols.length],
        pattern: SH.PATTERNS[Math.floor(Math.random() * SH.PATTERNS.length)]
      });
    }
    return out;
  };

  SH.BX = BX;
  SH.BY = BY;
})();
