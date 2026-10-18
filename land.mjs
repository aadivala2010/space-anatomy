// 3-D views inside the launch player. A vehicle's mission script sets LANDINGS = [{ id, at }, ...] (at = the mission time
// a scene's key moment lines up with); while the mission clock is inside one of those windows a three.js view covers the
// stage, synced to it. makeLand is shipped to the page as source (makeLand.toString()), so it must not use anything from this module.

export const LAND_CSS = `
.land{position:absolute;inset:0;z-index:2;background:#000;cursor:grab;touch-action:none;transition:opacity .25s}
.land[hidden]{display:none}
.land.drag{cursor:grabbing}
.land canvas{width:100%;height:100%;display:block}
.land-cap{position:absolute;right:8px;top:6px;padding:6px 10px 8px 28px;border-radius:8px;background:radial-gradient(ellipse at 100% 0,#000a,#0000 75%);max-width:min(380px,60%);text-align:right;pointer-events:none;font:600 13px/1.35 ui-sans-serif,system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000c}
.land-cap b{display:block;font:600 11px/1.6 var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;color:#ff8a3d}
.land-cap em{display:block;margin-top:2px;font:500 11px/1.6 var(--anatomy-mono);font-style:normal;color:#ffd29a}
.land-cap em:empty{display:none}
.land-cap i{display:block;font:11px/1.6 var(--anatomy-mono);font-style:normal;color:#c9d3e3}
`;

function makeLand(list, stage) {
  // ---- profiles: scripted, not simulated. motion rows are [t s, along-track m, height m, along-track speed, vertical speed];
  // cubic Hermite through them so the speeds are exact at each row. Other tracks are [t, value], linear.
  function herm(rows, t) {
    if (t <= rows[0][0]) return rows[0].slice(1);
    let i = 0;
    while (i < rows.length - 2 && t > rows[i + 1][0]) i++;
    const a = rows[i], b = rows[i + 1];
    if (t >= b[0]) return [b[1], b[2], 0, 0];
    const T = b[0] - a[0], s = (t - a[0]) / T, s2 = s * s, s3 = s2 * s;
    const p = (j) => (2 * s3 - 3 * s2 + 1) * a[j] + (s3 - 2 * s2 + s) * T * a[j + 2] + (-2 * s3 + 3 * s2) * b[j] + (s3 - s2) * T * b[j + 2];
    const v = (j) => ((6 * s2 - 6 * s) * (a[j] - b[j])) / T + (3 * s2 - 4 * s + 1) * a[j + 2] + (3 * s2 - 2 * s) * b[j + 2];
    return [p(1), p(2), v(1), v(2)];
  }
  function lin(rows, t) {
    if (t <= rows[0][0]) return rows[0][1];
    for (let i = 1; i < rows.length; i++) { const a = rows[i - 1], b = rows[i]; if (t <= b[0]) return a[1] + ((b[1] - a[1]) * (t - a[0])) / (b[0] - a[0]); }
    return rows[rows.length - 1][1];
  }
  const firstBelow = (m, alt) => { for (let t = 0; t < 1000; t += 0.05) if (herm(m, t)[1] <= alt) return Math.round(t * 10) / 10; };
  const sm = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

  const M = {
    // after the entry burn: ~250 m/s at 3 km, single-engine hoverslam at ~25 m/s², ~1.5 m/s at touchdown
    f9: [[0, -380, 3000, 35, -255], [7, -140, 1250, 30, -245], [13.8, -10, 140, 8, -75], [17.2, 0, 0, 0, -1.5]],
    // base height; the catch pins rest on the chopstick rails when the base is 36 m up
    sh: [[0, -1500, 4000, 110, -300], [7, -730, 1900, 110, -300], [15, -120, 460, 20, -60], [29, 0, 40, 0, -2], [31, 0, 36, 0, -1]],
    // Apollo 11-like: high gate at ~2.2 km, low gate ~150 m, ~1 m/s at contact
    lm: [[0, -9000, 2200, 150, -45], [100, -300, 150, 15, -8], [150, 0, 0, 0, -0.9]],
    // the ship's centre of mass (20 m above its base): belly-flop at terminal speed, flip, landing burn, into the arms
    scatch: [[0, -520, 1670, 22, -88], [11, -278, 700, 22, -86], [16, -170, 320, 20, -62], [24, -14, 105, 4, -10], [28, 0, 83, 0, -1.5], [29.5, 0, 81, 0, -0.4]],
    // capsules under main parachutes
    dsplash: [[0, 0, 260, 0, -7.2], [36, 0, 0, 0, -7.2]],
    asplash: [[0, 0, 300, 0, -8.6], [35, 0, 0, 0, -8.6]],
    osplash: [[0, 0, 280, 0, -8], [35, 0, 0, 0, -8]],
    // dockings: along-track = minus the gap between the docking interfaces
    dock: [[0, -150, 0, 1.5, 0], [80, -20, 0, 0, 0], [90, -20, 0, 0, 0], [95, -19.8, 0, 0.1, 0], [290, 0, 0, 0.1, 0]],
    td: [[0, -28, 0, 0.35, 0], [60, -6, 0, 0.2, 0], [100, 0, 0, 0.12, 0]],
    lmdock: [[0, -60, 0, 0.6, 0], [70, -8, 0, 0.16, 0], [120, 0, 0, 0.16, 0]],
  };
  // self-check: descents never dip below the ground or climb on the way down
  for (const id of ["f9", "sh", "lm", "scatch", "dsplash", "asplash", "osplash"]) { const m = M[id]; let prev = Infinity; for (let t = 0; t <= m[m.length - 1][0] + 2; t += 0.02) { const h = herm(m, t)[1]; console.assert(h > -0.01 && h <= prev + 1e-6, id + ": altitude misbehaves at t=" + t.toFixed(2)); prev = h; } }
  const tLM = firstBelow(M.lm, 1.7); // contact probes touch
  const MOON = " above the Moon";
  // touch = scene time lined up with the LANDINGS entry's `at`; speed = playback rate while the view is up; hud = the scene drives altitude/speed
  const META = {
    f9: { touch: 17.2, dur: 22, speed: 1, hud: 1, title: "Booster landing · droneship" },
    dock: { touch: 290, dur: 312, speed: 8, title: "Crew Dragon · docking to the ISS" },
    dentry: { touch: 30, dur: 70, speed: 3, title: "Crew Dragon · atmospheric entry" },
    dsplash: { touch: 36, dur: 54, speed: 1, hud: 1, title: "Crew Dragon · splashdown" },
    sh: { touch: 30.8, dur: 36, speed: 1, hud: 1, title: "Booster catch · Starbase tower" },
    pez: { touch: 6, dur: 64, speed: 2, title: "Starship · Starlink deploy" },
    sentry: { touch: 30, dur: 70, speed: 3, title: "Starship · belly-first entry" },
    scatch: { touch: 29.5, dur: 36, speed: 1, hud: 1, title: "Ship catch · flip and landing burn" },
    td: { touch: 112, dur: 140, speed: 4, title: "Transposition, docking & extraction" },
    lm: { touch: tLM + 1.1, dur: 156, speed: 4, hud: 1, ref: MOON, title: "Eagle · powered descent" },
    lmasc: { touch: 3, dur: 40, speed: 1, ref: MOON, title: "Eagle · lunar liftoff" },
    lmdock: { touch: 120, dur: 140, speed: 4, title: "Lunar orbit rendezvous · docking" },
    aentry: { touch: 30, dur: 70, speed: 3, title: "Columbia · entry at 11 km/s" },
    asplash: { touch: 35, dur: 52, speed: 1, hud: 1, title: "Columbia · splashdown" },
    osep: { touch: 5, dur: 100, speed: 3, title: "Orion separates from the ICPS" },
    flyby: { touch: 2000, dur: 4000, speed: 200, title: "Lunar flyby · far side" },
    oentry: { touch: 30, dur: 70, speed: 3, title: "Orion · skip entry" },
    osplash: { touch: 35, dur: 52, speed: 1, hud: 1, title: "Orion · splashdown" },
  };
  const SC = list.filter((c) => META[c.id]).map((c) => { const m = META[c.id], a0 = c.at - m.touch; return { id: c.id, m, motion: M[c.id], a0, a1: a0 + m.dur, R: null }; });
  const find = (t) => SC.find((e) => t >= e.a0 && t <= e.a1);

  // ---- overlay (one for all scenes)
  const el = document.createElement("div");
  el.className = "land"; el.hidden = true;
  el.innerHTML = '<div class="land-cap"><b></b><span></span><em></em><i>3-D view · drag to orbit · scroll to zoom</i></div>';
  stage.querySelector(".fx-flash").after(el);
  const capT = el.querySelector("b"), capE = el.querySelector("span"), capI = el.querySelector("em");

  let THREE = null, X = null, loading = null, G = null, cur = null, lastS = null, hudv = null;
  function load() {
    const U = "https://cdn.jsdelivr.net/npm/three@0.160.0/", J = U + "examples/jsm/postprocessing/";
    loading ||= Promise.all([U + "+esm", J + "EffectComposer.js/+esm", J + "RenderPass.js/+esm", J + "UnrealBloomPass.js/+esm", J + "OutputPass.js/+esm"].map((u) => import(u)))
      .then(([T, ...adds]) => { THREE = T; X = Object.assign({}, ...adds); G = shared(); prebuild(); })
      .catch((e) => console.warn("3-D views unavailable:", e));
  }
  // build the scenes in the background, one at a time, so entering a window doesn't stall
  function prebuild() { const next = () => { const e = SC.find((x) => !x.R && !x.failed); if (!e) return; ensure(e); setTimeout(next, 60); }; setTimeout(next, 60); }
  function ensure(e) {
    if (!e.R && !e.failed) try { e.R = build(e); } catch (err) { e.failed = true; console.warn("3-D view " + e.id + " failed:", err); }
    return e.R;
  }

  // one renderer + bloom chain shared by every scene
  function shared() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.prepend(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 6e7);
    const composer = new X.EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    const pass = new X.RenderPass(new THREE.Scene(), camera);
    composer.addPass(pass);
    composer.addPass(new X.UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 1.25));
    composer.addPass(new X.OutputPass());
    const pmrem = new THREE.PMREMGenerator(renderer), loader = new THREE.TextureLoader(), cache = {};
    loader.setCrossOrigin("anonymous");
    return {
      renderer, camera, composer, pass, pmrem, w: 0, h: 0,
      once: (k, f) => (cache[k] ||= f()),
      img(url, srgb) {
        return (cache[url] ||= (() => { const t = loader.load(url, () => R0()); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })());
      },
    };
  }
  const R0 = () => { if (cur) render(); }; // redraw when a texture arrives

  function build(e) {
    const { camera, pmrem, once, img } = G;
    const D2R = Math.PI / 180, TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const PLANETS = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/";
    const scene = new THREE.Scene(), world = scene;
    const hemi = new THREE.HemisphereLight("#ffffff", "#000000", 0.2), sun = new THREE.DirectionalLight("#fff6ea", 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    scene.add(hemi, sun, sun.target);
    const sunViews = []; // uniforms that want the Sun direction in view space

    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
    const glow = (color, k, o = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, ...o });
    function mesh(geo, mat, parent, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
    const cyl = (rt, rb, y0, y1, mat, parent, seg = 48, open = false) => mesh(new THREE.CylinderGeometry(rt, rb, y1 - y0, seg, 1, open), mat, parent, 0, (y0 + y1) / 2, 0);
    const lathe = (pts, mat, parent, seg = 72) => mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat, parent);
    const box = (sx, sy, sz, mat, parent, x, y, z) => mesh(new THREE.BoxGeometry(sx, sy, sz), mat, parent, x, y, z);
    function rod(a, b, r, mat, parent) { // cylinder from point a to point b
      const A = V3(...a), B = V3(...b), m = mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 10), mat, parent);
      m.position.copy(A).add(B).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize());
      return m;
    }
    function tex(w, hh, draw, repeat, srgb = true) {
      const c = document.createElement("canvas"); c.width = w; c.height = hh; draw(c.getContext("2d"), w, hh);
      const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
      return t;
    }
    const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const lattice = (cells, line, color) => (g, w, hh) => {
      g.strokeStyle = color; g.lineWidth = line;
      for (let i = 0; i <= cells; i++) { const p = (i / cells) * w; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, hh); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
    };
    // shared surface textures
    const plumeTex = once("plume", () => tex(4, 128, (g, w, hh) => { const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, "#fff"); gr.addColorStop(0.5, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, hh); }));
    const dotTex = once("dot", () => tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }));
    const foilTex = once("foil", () => tex(512, 512, (g, w, hh) => { // crinkled Kapton/Mylar blanket
      g.fillStyle = "#808080"; g.fillRect(0, 0, w, hh);
      const r = rng(21);
      for (let i = 0; i < 900; i++) { const x = r() * w, y = r() * hh, s = 8 + 40 * r(), c = 90 + 90 * r(); g.fillStyle = `rgb(${c},${c},${c})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + (r() - 0.5) * s); g.lineTo(x + (r() - 0.5) * s, y + s); g.fill(); }
    }, [2, 2], false));
    const cells = (key, base, line, nx, ny) => once(key, () => tex(512, 512, (g, w, hh) => { // solar cell blanket
      g.fillStyle = line; g.fillRect(0, 0, w, hh);
      const r = rng(5), cw = w / nx, ch = hh / ny;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const k = 0.85 + 0.3 * r(); g.fillStyle = base; g.globalAlpha = k; g.fillRect(i * cw + 1.5, j * ch + 1.5, cw - 3, ch - 3); }
      g.globalAlpha = 1;
    }));
    const quilt = (key, base, line, n) => once(key, () => tex(512, 512, (g, w, hh) => { // stitched blanket panels
      g.fillStyle = base; g.fillRect(0, 0, w, hh);
      const r = rng(13);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = `rgba(0,0,0,${0.03 + 0.06 * r()})`; g.fillRect((i * w) / n, (j * hh) / n, w / n, hh / n); }
      g.strokeStyle = line; g.lineWidth = 2; lattice(n, 2, line)(g, w, hh);
    }));

    // exhaust: an additive glowing tube that is brightest at the nozzle, plus a nozzle glow; returned setter takes power 0..1
    function plume(parent, x, y, z, r, len, color, { spread = 1.6, opacity = 1, k = 3.5 } = {}) {
      const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
      const mk = (rt, rb, c, kk, o, sy) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, 1, 24, 1, true).translate(0, -0.5, 0), glow(c, kk, { map: plumeTex, opacity: o })); m.scale.y = sy; g.add(m); };
      mk(r, r * spread, color, k * 0.6, 0.6 * opacity, 1);
      mk(r * 0.6, r * 0.3, "#fff6e6", k, 0.9 * opacity, 0.4);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(color).multiplyScalar(k), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 * opacity }));
      sp.scale.setScalar(r * 6); parent.add(sp); sp.position.set(x, y - r * 0.6, z);
      const set = (p) => { g.visible = sp.visible = p > 0.02; g.scale.set(1, len * p * (0.93 + 0.07 * Math.random()), 1); sp.material.opacity = 0.7 * opacity * p; };
      set(0);
      return set;
    }
    // small attitude-control thruster puffs: [position, direction] in the parent frame
    function thrusters(parent, list, len = 1.4) {
      const ms = list.map(([p, d]) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.28, 1, 10, 1, true).translate(0, 0.5, 0), glow("#cfe0ff", 1.6, { map: plumeTex, opacity: 0.55 }));
        m.position.set(...p); m.quaternion.setFromUnitVectors(UP, V3(...d).normalize()); m.scale.set(1, len, 1); m.visible = false; parent.add(m); return m;
      });
      return (rate) => ms.forEach((m) => { m.visible = Math.random() < rate; m.scale.set(1, len * (0.6 + 0.6 * Math.random()), 1); });
    }

    // dust, spray or steam thrown out where the exhaust hits the ground
    function particles({ n = 4000, color, size, drag, rise, gravity, life, opacity, parent = world }) {
      const pos = new Float32Array(n * 3).fill(-1e5), vel = new Float32Array(n * 3), age = new Float32Array(n).fill(1e9);
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: dotTex, transparent: true, opacity, depthWrite: false }));
      pts.frustumCulled = false; parent.add(pts);
      let head = 0, acc = 0;
      return {
        reset() { pos.fill(-1e5); age.fill(1e9); acc = 0; geo.attributes.position.needsUpdate = true; },
        step(dt, src) { // src: {x, y, z, r0, rate, speed, up, burst}
          if (dt <= 0) return;
          acc += src.rate * dt + (src.burst || 0);
          for (; acc >= 1; acc--) {
            const i = head++ % n, a = Math.random() * Math.PI * 2, s = src.speed * (0.4 + 0.8 * Math.random());
            pos.set([src.x + Math.cos(a) * src.r0, src.y + 0.3, src.z + Math.sin(a) * src.r0], i * 3);
            vel.set([Math.cos(a) * s, src.up * Math.random(), Math.sin(a) * s], i * 3);
            age[i] = 0;
          }
          const k = Math.exp(-drag * dt);
          for (let i = 0; i < n; i++) {
            if (age[i] > life) continue;
            age[i] += dt;
            const j = i * 3;
            if (age[i] > life) { pos[j + 1] = -1e5; continue; }
            vel[j] *= k; vel[j + 2] *= k; vel[j + 1] = vel[j + 1] * k + (rise - gravity) * dt;
            pos[j] += vel[j] * dt; pos[j + 1] = Math.max(src.floor ?? src.y, pos[j + 1] + vel[j + 1] * dt); pos[j + 2] += vel[j + 2] * dt;
          }
          geo.attributes.position.needsUpdate = true;
        },
      };
    }

    // ---- skies and planets
    function equi(w, hh, draw) { const t = tex(w, hh, draw); t.mapping = THREE.EquirectangularReflectionMapping; return t; }
    const toUV = (d) => [Math.atan2(d.z, d.x) / TAU + 0.5, Math.asin(Math.max(-1, Math.min(1, d.y))) / Math.PI + 0.5];
    function sunSpot(g, w, hh, d, rs) {
      const [u, v] = toUV(d), x = u * w, y = (1 - v) * hh;
      for (const [r, a] of rs) { const s = g.createRadialGradient(x, y, 0, x, y, r); s.addColorStop(0, `rgba(255,247,232,${a})`); s.addColorStop(1, "rgba(255,247,232,0)"); g.fillStyle = s; g.fillRect(0, 0, w, hh); }
    }
    // daytime sky: gradient + sun, used as background and as the image-based light
    function earthSky(sunDir, { zen = "#2f64ad", hor = "#c4d8ec", low = "#3c5568", fog = "#b9cfe3", near = 1500, far = 22000 } = {}) {
      const t = equi(1024, 512, (g, w, hh) => {
        const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, zen); gr.addColorStop(0.42, "#6d9bd0"); gr.addColorStop(0.495, hor); gr.addColorStop(0.505, low); gr.addColorStop(1, "#1d2c38");
        g.fillStyle = gr; g.fillRect(0, 0, w, hh);
        sunSpot(g, w, hh, sunDir, [[300, 0.22], [80, 0.55], [10, 1]]);
      });
      scene.background = t; scene.environment = pmrem.fromEquirectangular(t).texture;
      scene.fog = new THREE.Fog(fog, near, far);
      hemi.color.set("#d6e6ff"); hemi.groundColor.set("#3a4a5a"); hemi.intensity = 0.6;
      sun.color.set("#fff2df"); sun.intensity = 3.2;
    }
    const stars = () => once("stars", () => equi(4096, 2048, (g, w, hh) => {
      g.fillStyle = "#000"; g.fillRect(0, 0, w, hh);
      const r = rng(11);
      for (let i = 0; i < 30000; i++) { const x = r() * w, y = hh * 0.5 + Math.sin((x / w) * TAU) * hh * 0.2 + (r() + r() + r() - 1.5) * hh * 0.07; g.fillStyle = `rgba(190,200,240,${0.02 + 0.03 * r()})`; g.fillRect(x, y, 1, 1); }
      for (let i = 0; i < 9000; i++) { const m = r() ** 7, c = r(); g.fillStyle = `rgba(${c < 0.3 ? "255,220,190" : c > 0.8 ? "190,210,255" : "255,255,255"},${0.12 + 0.6 * m})`; g.beginPath(); g.arc(r() * w, r() * hh, 0.4 + 0.9 * m, 0, TAU); g.fill(); }
    }));
    // black sky with stars; the image light is the planet below glowing back up
    function spaceSky(sunDir, below = "#284a74") {
      scene.background = stars();
      const env = equi(256, 128, (g, w, hh) => {
        const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, "#000"); gr.addColorStop(0.5, "#04060a"); gr.addColorStop(0.6, below); gr.addColorStop(1, below);
        g.fillStyle = gr; g.fillRect(0, 0, w, hh); sunSpot(g, w, hh, sunDir, [[30, 0.6], [6, 1]]);
      });
      scene.environment = pmrem.fromEquirectangular(env).texture;
      hemi.color.set("#000"); hemi.groundColor.set(below); hemi.intensity = 0.35;
      sun.color.set("#fffaf2"); sun.intensity = 3.6;
    }
    // atmosphere limb: fresnel rim, lit on the day side
    function rim(color, power, sunDir) {
      return new THREE.ShaderMaterial({
        uniforms: { c: { value: new THREE.Color(color) }, p: { value: power }, sunW: { value: sunDir } },
        vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = normalize(mat3(modelMatrix) * normal); vN = normalize(normalMatrix * normal);
vec4 mv = viewMatrix * wp; vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`,
        fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 c; uniform float p; uniform vec3 sunW; varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
#include <logdepthbuf_fragment>
float f = pow(1.0 - max(dot(vN, vV), 0.0), p); float day = smoothstep(-0.3, 0.3, dot(vW, sunW));
gl_FragColor = vec4(c * f * day, 1.0); }`,
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      });
    }
    // a textured planet. `at` points from the scene origin to its centre; `spot` = texture (u, v) that sits closest to the
    // origin; `speed` (m/s) scrolls the ground the way orbital motion along +x would; k scales the whole planet down
    // (same angular size) so far planets stay inside the depth range.
    function planet(kind, alt, { k = 1, at = V3(0, -1, 0), spot = [0.6, 0.45], speed = 0, seg = 512 } = {}) {
      const R0 = kind === "earth" ? 6.371e6 : 1.7374e6, R = R0 * k, dn = at.clone().normalize();
      const g = new THREE.Group(); g.position.copy(dn).multiplyScalar((R0 + alt) * k); world.add(g);
      const spin = new THREE.Group(); g.add(spin);
      const phi = spot[0] * TAU, th = (1 - spot[1]) * Math.PI, P = V3(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
      const Q = new THREE.Quaternion().setFromUnitVectors(P, dn.clone().negate()), axis = V3(1, 0, 0).cross(dn.clone().negate()).normalize();
      const sph = (r, s = seg) => new THREE.SphereGeometry(r, s, s / 2);
      const sunW = { value: V3(0, 1, 0) }, sunV = { value: V3(0, 1, 0) };
      let surf;
      if (kind === "earth") {
        const mat = new THREE.MeshPhongMaterial({ map: img(PLANETS + "earth_atmos_4096.jpg", true), normalMap: img(PLANETS + "earth_normal_2048.jpg"), normalScale: new THREE.Vector2(0.9, 0.9), specularMap: img(PLANETS + "earth_specular_2048.jpg"), specular: new THREE.Color("#4a6680"), shininess: 22, emissiveMap: img(PLANETS + "earth_lights_2048.png", true), emissive: new THREE.Color("#ffcf8a").multiplyScalar(1.4) });
        mat.onBeforeCompile = (sh) => { // city lights only on the night side
          sh.uniforms.sunV = sunV;
          sh.fragmentShader = sh.fragmentShader.replace("void main() {", "uniform vec3 sunV;\nvoid main() {").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(0.1, -0.25, dot(normal, sunV));");
        };
        surf = new THREE.Mesh(sph(R), mat);
        const cl = new THREE.Mesh(sph(R * 1.0012), new THREE.MeshLambertMaterial({ map: img(PLANETS + "earth_clouds_2048.png", true), transparent: true, depthWrite: false }));
        spin.add(cl);
        const atmo = new THREE.Mesh(sph(R * 1.0095, Math.min(seg, 384)), rim(new THREE.Color(0.32, 0.6, 1.25).multiplyScalar(1.05), 3.6, sunW.value));
        g.add(atmo);
      } else {
        const mt = img(PLANETS + "moon_1024.jpg", true);
        surf = new THREE.Mesh(sph(R), new THREE.MeshStandardMaterial({ map: mt, bumpMap: mt, bumpScale: 2.5, roughness: 1, metalness: 0 }));
      }
      spin.add(surf);
      const set = (s) => { spin.quaternion.setFromAxisAngle(axis, (speed * s) / R0).multiply(Q); };
      set(0);
      sunViews.push((dir) => { sunW.value.copy(dir); sunV.value.copy(dir).transformDirection(camera.matrixWorldInverse); });
      return { g, set };
    }

    // open ocean: a wave-displaced patch near the action, a flat sheet out to the horizon, both with scrolling normal maps
    function ocean(size = 3000, segs = 120) {
      const base = img("https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg");
      const mk = (rep) => { const n = base.clone(); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.repeat.set(rep, rep); n.needsUpdate = true; return new THREE.MeshPhysicalMaterial({ color: "#0a2a42", roughness: 0.08, metalness: 0, normalMap: n, normalScale: new THREE.Vector2(0.5, 0.5), ior: 1.33 }); };
      const near = mesh(new THREE.PlaneGeometry(size, size, segs, segs).rotateX(-Math.PI / 2), mk(size / 30), world);
      const far = mesh(new THREE.PlaneGeometry(400000, 400000).rotateX(-Math.PI / 2), mk(400000 / 60), world, 0, -0.6, 0);
      near.castShadow = far.castShadow = false;
      const op = near.geometry.attributes.position, wave = (x, z, c) => 0.35 * Math.sin(x * 0.045 + c * 1.1) + 0.25 * Math.sin(z * 0.06 - c * 0.8) + 0.12 * Math.sin((x + z) * 0.13 + c * 1.7);
      return {
        wave,
        update(c) {
          for (let i = 0; i < op.count; i++) op.setY(i, wave(op.getX(i), op.getZ(i), c));
          op.needsUpdate = true; near.geometry.computeVertexNormals();
          near.material.normalMap.offset.set(c * 0.012, c * 0.007); far.material.normalMap.offset.set(c * 0.004, c * 0.002);
        },
      };
    }

    // ---- vehicles (metres; root origin = feet / base / heat shield unless noted)
    function falcon9Booster() {
      const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = 2.28;
      const soot = once("f9soot", () => tex(256, 1024, (g, w, hh) => {
        g.fillStyle = "#eceef0"; g.fillRect(0, 0, w, hh);
        const r = rng(9);
        for (let i = 0; i < 260; i++) { const x = r() * w, y = r() * hh, low = y / hh; g.strokeStyle = "rgba(28,24,20," + (0.08 + 0.5 * low * low * r()) + ")"; g.lineWidth = 2 + 10 * r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + 60 + 200 * r()); g.stroke(); }
        const gr = g.createLinearGradient(0, hh * 0.75, 0, hh); gr.addColorStop(0, "rgba(20,18,16,0)"); gr.addColorStop(1, "rgba(20,18,16,.85)"); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
      }));
      const white = std("#ffffff", { map: soot, roughness: 0.5 }), black = std("#15171a", { roughness: 0.6 }), metal = std("#55595f", { metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
      cyl(1.83, 1.83, 1.2, 42, white, body, 64);
      cyl(1.83, 1.83, 42, 48.5, black, body, 64);
      cyl(1.95, 1.95, 0.1, 1.4, metal, body, 64);
      rod([1.86, 3, 0.3], [1.86, 41, 0.3], 0.12, std("#d8dadc"), body); // raceway
      const bell = new THREE.LatheGeometry([[0.47, -0.55], [0.4, -0.1], [0.24, 0.45]].map(([r, y]) => new THREE.Vector2(r, y)), 24);
      for (let i = -1; i < 8; i++) { const a = (i * Math.PI) / 4, r = i < 0 ? 0 : 1.25; mesh(bell, metal, body, Math.cos(a) * r, -0.35, Math.sin(a) * r); }
      const finMat = std("#a3a8ae", { metalness: 0.6, roughness: 0.35, map: once("f9fin", () => tex(64, 64, lattice(5, 5, "#fff"))), alphaTest: 0.5, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2, f = box(1.7, 1.4, 0.12, finMat, body, Math.cos(a) * 2.7, 46.5, Math.sin(a) * 2.7); f.rotation.y = -a; }
      const legMat = std("#1c1d20", { roughness: 0.5 }), legs = [];
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4, holder = new THREE.Group(), pivot = new THREE.Group();
        holder.rotation.y = -a; body.add(holder); holder.add(pivot); pivot.position.set(1.95, 3.5, 0);
        box(0.5, 9, 0.38, legMat, pivot, 0, 4.5, 0);
        mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 16), legMat, pivot, 0, 9, 0);
        legs.push(pivot);
      }
      const fire = plume(body, 0, -0.9, 0, 0.45, 26, "#ffa64d");
      return { root, legs: (k) => legs.forEach((p) => (p.rotation.z = -k * 130 * D2R)), fire };
    }

    const steelTex = () => once("steel", () => tex(512, 1024, (g, w, hh) => {
      g.fillStyle = "#d4d8dd"; g.fillRect(0, 0, w, hh);
      g.strokeStyle = "rgba(70,74,80,.45)"; g.lineWidth = 2;
      for (let y = 0; y < hh; y += hh / 36) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      const r = rng(4);
      for (let i = 0; i < 160; i++) { const y = r() > 0.5 ? r() * 90 : hh - r() * 140; g.fillStyle = "rgba(40,34,28," + 0.15 * r() + ")"; g.fillRect(r() * w, y, 4 + 20 * r(), 10 + 60 * r()); }
    }));
    function superHeavy() {
      const root = new THREE.Group();
      const steel = std("#ffffff", { map: steelTex(), metalness: 0.55, roughness: 0.3 }), dark = std("#2a2c30", { metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide });
      cyl(4.5, 4.5, 1.4, 69, steel, root, 96);
      cyl(4.5, 4.5, 69, 72.5, dark, root, 96);
      cyl(4.62, 4.62, 0, 1.6, dark, root, 96);
      const bell = new THREE.CylinderGeometry(0.32, 0.62, 2.0, 18, 1, true), fires = [];
      const ring = (n, r, a0, lit) => { for (let i = 0; i < n; i++) { const a = a0 + (i * 2 * Math.PI) / n, x = Math.cos(a) * r, z = Math.sin(a) * r; mesh(bell, dark, root, x, 0.2, z); if (lit) fires.push(plume(root, x, -0.8, z, 0.55, 40, "#8fb6ff", { spread: 1.9 })); } };
      ring(3, 0.95, 0, true); ring(10, 2.3, 0.3, true); ring(20, 3.75, 0, false);
      const finMat = std("#7c8086", { metalness: 0.5, roughness: 0.4, map: once("shfin", () => tex(64, 64, lattice(6, 5, "#fff"))), alphaTest: 0.5, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, f = box(4, 3.2, 0.45, finMat, root, Math.cos(a) * 6.5, 67.6, Math.sin(a) * 6.5); f.rotation.y = -a; }
      for (const s of [-1, 1]) box(1.6, 0.8, 1.2, dark, root, s * 5.3, 65.4, 0); // catch pins
      return { root, fires };
    }

    // Starship upper stage. Heat-shield tiles face local +x (the belly); the Pez door is on -x.
    function starshipShip() {
      const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      const t = once("shipTex", () => tex(1024, 2048, (g, w, hh) => {
        g.drawImage(steelTex().image, 0, 0, w, hh);
        const r = rng(8), s = 26;
        g.fillStyle = "#121315"; g.fillRect(0, 0, w / 2, hh);
        for (let y = 0, row = 0; y < hh; y += s * 0.87, row++) for (let x = (row % 2) * s * 0.5; x < w / 2; x += s) {
          const c = 14 + 22 * r(); g.fillStyle = r() < 0.006 ? "#c9ccd0" : `rgb(${c},${c},${c + 2})`; g.beginPath();
          for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + Math.PI / 6; g.lineTo(x + Math.cos(a) * s * 0.48, y + Math.sin(a) * s * 0.48); } g.fill();
        }
      }));
      const skin = std("#ffffff", { map: t, metalness: 0.55, roughness: 0.32 }), dark = std("#1b1c1f", { roughness: 0.55, metalness: 0.3 }), engMat = std("#3b3d42", { metalness: 0.75, roughness: 0.3, side: THREE.DoubleSide });
      cyl(4.5, 4.5, 1.6, 40, skin, body, 96);
      const nose = []; for (let i = 0; i <= 18; i++) { const f = i / 18; nose.push([4.5 * Math.pow(Math.max(0, 1 - f * f), 0.55), 40 + 10.3 * f]); }
      lathe(nose, skin, body, 96);
      cyl(4.56, 4.56, 0, 1.6, dark, body, 96);
      const flaps = [];
      for (const [y, h, w, th] of [[45, 6, 2.6, 0.32], [7.5, 9.5, 3.4, 0.45]]) for (const s of [-1, 1]) {
        const pv = new THREE.Group(); pv.position.set(1.3, y, s * 4.3); body.add(pv);
        box(th, h, w, dark, pv, 0, 0, s * w * 0.5); flaps.push([pv, s]);
      }
      const rsl = new THREE.LatheGeometry([[0.66, -0.75], [0.52, -0.2], [0.3, 0.55]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
      const rvac = new THREE.LatheGeometry([[1.15, -1.5], [0.95, -0.6], [0.5, 0.6]].map(([r, y]) => new THREE.Vector2(r, y)), 36);
      const fires = [];
      for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3, b = a + Math.PI / 3; mesh(rsl, engMat, body, Math.cos(a) * 1.1, -0.2, Math.sin(a) * 1.1); fires.push(plume(body, Math.cos(a) * 1.1, -0.95, Math.sin(a) * 1.1, 0.6, 34, "#8fb6ff", { spread: 2 })); mesh(rvac, engMat, body, Math.cos(b) * 3, -0.6, Math.sin(b) * 3); }
      const door = box(0.25, 4.8, 3.6, std("#050506", { roughness: 0.9 }), body, -4.42, 30.5, 0);
      for (const s of [-1, 1]) box(1.0, 0.6, 1.0, dark, body, 0, 41, s * 5.0); // catch pins
      return { root, body, fires, door, flaps: (k, c) => flaps.forEach(([pv, s], i) => (pv.rotation.y = s * (k + 0.06 * Math.sin(c * 2 + i)))) };
    }

    function crewDragon({ trunk = true } = {}) {
      const root = new THREE.Group();
      const skin = std("#f4f5f6", { map: quilt("dragonSkin", "#f6f6f4", "rgba(0,0,0,.08)", 8), roughness: 0.32 });
      const black = std("#16181b", { roughness: 0.4 }), shieldM = std("#3a2f28", { roughness: 0.95 }), metal = std("#9aa0a6", { metalness: 0.85, roughness: 0.25 });
      lathe([[0, -0.22], [0.8, -0.2], [1.5, -0.12], [1.9, -0.03], [2.0, 0.06]], shieldM, root, 96);
      lathe([[2.0, 0.06], [1.98, 0.22], [1.3, 2.95], [1.0, 3.12], [0.82, 3.18]], skin, root, 96);
      cyl(0.8, 0.84, 3.18, 3.45, metal, root, 48);
      mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 48).rotateX(Math.PI / 2), metal, root, 0, 3.46, 0);
      const side = (y) => 1.98 - ((y - 0.22) * 0.68) / 2.73; // sidewall radius at height y
      for (let i = 0; i < 4; i++) { // SuperDraco pods and windows
        const a = Math.PI / 4 + (i * Math.PI) / 2, hold = new THREE.Group(); hold.rotation.y = -a; root.add(hold);
        box(0.3, 0.95, 0.62, black, hold, side(1.2) - 0.02, 1.2, 0).rotation.z = 0.24;
        const w = new THREE.Group(); w.rotation.y = -a - Math.PI / 4; root.add(w);
        box(0.06, 0.32, 0.36, std("#06080b", { metalness: 0.9, roughness: 0.08 }), w, side(2.0) + 0.01, 2.0, 0).rotation.z = 0.24;
      }
      const hinge = new THREE.Group(); hinge.position.set(1.0, 3.25, 0); root.add(hinge);
      const nose = lathe([[1.1, 0], [1.02, 0.35], [0.72, 0.78], [0, 0.98]], skin, hinge, 72); nose.position.x = -1.0;
      cyl(1.08, 1.08, -0.02, 0.02, black, nose, 48);
      const setNose = (k) => (hinge.rotation.z = -k * 1.95);
      const dracos = thrusters(root, [[[1.25, 2.6, 0], [1, 0.2, 0]], [[-1.25, 2.6, 0], [-1, 0.2, 0]], [[0, 2.6, 1.25], [0, 0.2, 1]], [[0, 2.6, -1.25], [0, 0.2, -1]], [[0.9, 2.9, 0.9], [0, 1, 0]], [[-0.9, 2.9, -0.9], [0, 1, 0]]]);
      if (trunk) {
        const tt = once("trunk", () => tex(1024, 256, (g, w, hh) => {
          g.fillStyle = "#eef0f2"; g.fillRect(0, 0, w, hh);
          const c = cells("dcells", "#1a2a52", "#8a93a6", 18, 6).image; g.drawImage(c, 0, 0, w / 2, hh);
          g.strokeStyle = "rgba(0,0,0,.12)"; for (let x = w / 2; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, hh); g.stroke(); }
        }));
        cyl(1.85, 1.85, -3.7, -0.05, std("#ffffff", { map: tt, roughness: 0.4, metalness: 0.1 }), root, 96);
        cyl(1.9, 1.9, -3.78, -3.6, metal, root, 64);
        for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2, f = box(0.08, 1.4, 0.9, skin, root, Math.cos(a) * 2.25, -3.0, Math.sin(a) * 2.25); f.rotation.y = -a; }
      }
      return { root, setNose, dracos };
    }

    // International Space Station; Harmony's forward docking port (IDA-2) at the origin facing -x
    function iss() {
      const root = new THREE.Group();
      const mod = std("#ffffff", { map: quilt("issMod", "#dcdcd6", "rgba(0,0,0,.18)", 10), roughness: 0.75 }), ru = std("#ffffff", { map: quilt("issRu", "#d7dbd2", "rgba(0,0,0,.2)", 7), roughness: 0.7 });
      const metal = std("#8a8f96", { metalness: 0.8, roughness: 0.3 }), white = std("#f2f2f0", { roughness: 0.5 });
      const xc = (r, x0, x1, mat) => { const m = mesh(new THREE.CylinderGeometry(r, r, x1 - x0, 48), mat, root, (x0 + x1) / 2, 0, 0); m.rotation.z = Math.PI / 2; mesh(new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.3, 48), metal, root, x0, 0, 0).rotation.z = Math.PI / 2; return m; };
      const zc = (r, x, z0, z1, mat, y = 0) => { const m = mesh(new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), 48), mat, root, x, y, (z0 + z1) / 2); m.rotation.x = Math.PI / 2; return m; };
      xc(0.82, 0, 0.4, metal); mesh(new THREE.TorusGeometry(0.8, 0.06, 8, 40).rotateY(Math.PI / 2), metal, root, 0.02, 0, 0);
      mesh(new THREE.CylinderGeometry(0.95, 1.3, 1.6, 40).rotateZ(Math.PI / 2), mod, root, 1.2, 0, 0);       // PMA-2
      box(0.04, 0.5, 0.5, std("#ffffff", { map: once("tgt", () => tex(64, 64, (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#000"; g.fillRect(28, 4, 8, 56); g.fillRect(4, 28, 56, 8); })) }), root, 0.45, 1.3, 0);
      xc(2.2, 2, 9.2, mod); zc(2.25, 6, 2.2, 9, mod); zc(2.2, 6, -2.2, -13, mod);                         // Harmony, Columbus, Kibo
      box(5, 1.2, 5.6, white, root, 6, -0.8, -16.2); zc(2.0, 6, -9, -12.5, mod, 3.6);                   // Kibo exposed facility, logistics
      xc(2.15, 9.2, 17.7, mod); xc(2.3, 17.7, 23.2, mod); zc(2.1, 20.4, -2.3, -9.5, mod); zc(1.8, 20.4, 2.3, 7.5, mod); // Destiny, Unity, Tranquility, Quest
      xc(2.05, 23.2, 36, ru); xc(2.1, 36, 49, ru); mesh(new THREE.SphereGeometry(2.2, 32, 16), ru, root, 49, 0, 0);       // Zarya, Zvezda
      const saw = cells("isscells", "#7a4a1c", "#c9b38a", 8, 30), back = std("#9a9890", { roughness: 0.8 }), cellM = std("#ffffff", { map: saw, metalness: 0.3, roughness: 0.35 });
      for (const s of [-1, 1]) { const w = box(2.4, 0.06, 28, std("#ffffff", { map: cells("zvcells", "#1b2b55", "#777", 4, 14) }), root, 44, 0, s * 17); w.castShadow = false; }
      // integrated truss on Destiny with eight solar array wings and the radiators
      const trussMat = std("#b5b9be", { map: once("truss", () => tex(128, 128, (g, w, hh) => { g.strokeStyle = "#fff"; g.lineWidth = 10; g.strokeRect(0, 0, w, hh); g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, hh); g.stroke(); }, [1, 28])), alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.45 });
      box(4.4, 3.8, 108, trussMat, root, 14, 4.8, 0); box(2.6, 2.2, 108, metal, root, 14, 4.8, 0); box(3, 2.2, 3, metal, root, 14, 2.6, 0);
      const wings = [];
      for (const z of [-50, -34, 34, 50]) for (const s of [-1, 1]) {
        const g = new THREE.Group(); g.position.set(14, 4.8, z); root.add(g); wings.push(g);
        rod([0, 0, 0], [s * 37, 0, 0], 0.12, metal, g);
        for (const o of [-1, 1]) {
          const p = box(34, 0.05, 4.6, cellM, g, s * 20, 0.04, o * 2.75); p.castShadow = true;
          box(34, 0.04, 4.6, back, g, s * 20, -0.03, o * 2.75);
        }
      }
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const p = box(3.2, 0.12, 23, white, root, 14 - 1 + i * 0.4, -8 - i * 0.4, s * (12 + i * 4.2)); p.rotation.x = Math.PI / 2; p.rotation.y = 0.35; } // main radiators
      for (const z of [-42, 42]) box(3, 0.1, 13, white, root, 14, -2.5, z).rotation.x = Math.PI / 2;                       // PV radiators
      const arm = std("#e8e8e6", { roughness: 0.5 });
      rod([16, 6.8, 6], [23, 11, 10], 0.18, arm, root); rod([23, 11, 10], [31, 7.5, 12], 0.18, arm, root); mesh(new THREE.SphereGeometry(0.35, 12, 8), arm, root, 23, 11, 10); // Canadarm2
      return { root, wings };
    }

    function lunarModule({ folded = false } = {}) {
      const root = new THREE.Group(), desc = new THREE.Group(), asc = new THREE.Group(); root.add(desc, asc);
      const gold = std("#c9a23a", { map: foilTex, bumpMap: foilTex, bumpScale: 1.2, metalness: 0.85, roughness: 0.32 }), foil = std("#1f1c18", { bumpMap: foilTex, bumpScale: 1, metalness: 0.6, roughness: 0.4 });
      const grey = std("#a7abb0", { roughness: 0.5, metalness: 0.2 }), dark = std("#222", { side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
      mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.65, 8), gold, desc, 0, 2.45, 0).rotation.y = Math.PI / 8;
      mesh(new THREE.CylinderGeometry(0.42, 0.8, 1.4, 24, 1, true), dark, desc, 0, 1.0, 0);
      const probes = [], fr = folded ? 2.35 : 4.3;
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), f = [c * fr, folded ? 1.1 : 0.2, s * fr];
        rod([c * 1.9, 3.1, s * 1.9], f, 0.09, gold, desc);
        rod([c * 1.9, 1.7, s * 1.9], [c * (fr - 1), f[1] + 0.9, s * (fr - 1)], 0.06, grey, desc);
        mesh(new THREE.CylinderGeometry(0.47, 0.4, 0.2, 20), grey, desc, f[0], f[1] - 0.1, f[2]);
        if (i !== 1 && !folded) probes.push(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6).translate(0, -0.8, 0), grey, desc, f[0], 0.05, f[2]));
      }
      // ascent stage: cabin, front face with windows, tanks, thruster quads, docking hatch, antennas
      const cab = mesh(new THREE.CylinderGeometry(1.25, 1.25, 2.6, 16), grey, asc, 0.1, 4.6, 0); cab.rotation.z = Math.PI / 2;
      box(0.6, 2.0, 2.4, grey, asc, 1.35, 4.35, 0);
      for (const s of [-1, 1]) box(0.05, 0.5, 0.5, std("#0b0d10", { roughness: 0.1, metalness: 0.9 }), asc, 1.67, 4.9, s * 0.55).rotation.x = s * 0.3;
      box(1.6, 1.8, 2.8, foil, asc, -1.2, 4.3, 0);
      mesh(new THREE.SphereGeometry(0.6, 16, 12), grey, asc, -0.6, 4.2, 1.75);
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; box(0.3, 0.3, 0.3, foil, asc, Math.cos(a) * 1.9, 5.3, Math.sin(a) * 1.9); }
      box(2.6, 0.35, 2.6, gold, asc, 0, 3.4, 0);
      cyl(0.45, 0.5, 5.8, 6.3, grey, asc, 20);
      rod([-1.3, 5.2, -0.9], [-1.9, 6.4, -1.3], 0.04, grey, asc);
      mesh(new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, 1.0), std("#ddd", { side: THREE.DoubleSide }), asc, -1.9, 6.4, -1.3);
      const fire = plume(desc, 0, 0.3, 0, 0.78, 14, "#ffcf8a", { spread: 5, opacity: 0.18 });
      const afire = plume(asc, 0, 3.2, 0, 0.45, 9, "#ffd9a8", { spread: 4, opacity: 0.22 });
      const rcs = thrusters(asc, [0, 1, 2, 3].map((i) => { const a = Math.PI / 4 + (i * Math.PI) / 2; return [[Math.cos(a) * 2.1, 5.3, Math.sin(a) * 2.1], [Math.cos(a), 0, Math.sin(a)]]; }), 1);
      return { root, desc, asc, fire, afire, rcs, probes: (hh) => probes.forEach((p) => (p.scale.y = Math.min(1, Math.max(0.02, (hh + 0.05) / 1.6)))) };
    }

    // capsules: heat shield at y = 0 facing -y; `top` = docking interface / parachute attach height
    function apolloCM({ probe = false } = {}) {
      const root = new THREE.Group();
      const mylar = std("#e6e7ea", { metalness: 0.92, roughness: 0.18, bumpMap: foilTex, bumpScale: 0.4 }), shield = std("#4b3b2d", { roughness: 0.95 });
      lathe([[0, -0.28], [0.9, -0.24], [1.6, -0.14], [1.92, -0.04], [1.96, 0.06]], shield, root, 96);
      lathe([[1.96, 0.06], [1.9, 0.16], [0.42, 3.1], [0.38, 3.25], [0, 3.27]], mylar, root, 96);
      for (const a of [-0.5, 0.5]) { const w = new THREE.Group(); w.rotation.y = a; root.add(w); box(0.05, 0.3, 0.32, std("#06080b", { metalness: 0.9, roughness: 0.1 }), w, 1.15, 1.75, 0).rotation.z = 0.48; }
      if (probe) { rod([0, 3.2, 0], [0, 4.0, 0], 0.06, std("#bfc3c8", { metalness: 0.8, roughness: 0.3 }), root); mesh(new THREE.ConeGeometry(0.1, 0.18, 12), std("#888"), root, 0, 4.06, 0); }
      return { root, top: probe ? 4.15 : 3.27, R: 1.96 };
    }
    function apolloCSM() {
      const root = new THREE.Group(), cm = apolloCM({ probe: true }); root.add(cm.root);
      const sm = std("#ffffff", { map: once("smTex", () => tex(512, 256, (g, w, hh) => { g.fillStyle = "#d9dadc"; g.fillRect(0, 0, w, hh); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? "#f2f2f2" : "#bfc1c4"; g.fillRect((i * w) / 6, 0, w / 6, hh); } g.fillStyle = "#222"; g.font = "bold 34px sans-serif"; g.fillText("UNITED STATES", 30, hh * 0.55); })), metalness: 0.6, roughness: 0.35 });
      cyl(1.96, 1.96, -3.95, -0.02, sm, root, 96);
      lathe([[1.96, -3.95], [1.6, -4.1], [0.6, -4.15]], std("#c9cbcf", { metalness: 0.7, roughness: 0.35 }), root, 64);
      lathe([[1.25, -7.0], [0.9, -5.6], [0.55, -4.1]], std("#4a4c50", { metalness: 0.35, roughness: 0.55, side: THREE.DoubleSide }), root, 48); // SPS bell
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, h = new THREE.Group(); h.rotation.y = -a; root.add(h); box(0.3, 0.7, 0.55, std("#d8d8d8"), h, 2.05, -0.9, 0); }
      rod([1.4, -3.9, 1.4], [2.4, -5.0, 2.4], 0.05, std("#ccc"), root);
      for (const [x, z] of [[2.4, 2.1], [2.7, 2.4], [2.1, 2.7], [2.4, 2.7]]) mesh(new THREE.SphereGeometry(0.3, 16, 8, 0, TAU, 0, 1.1), std("#e8e8e8", { side: THREE.DoubleSide }), root, x, -5.1, z);
      const rcs = thrusters(root, [0, 1, 2, 3].map((i) => { const a = Math.PI / 4 + (i * Math.PI) / 2; return [[Math.cos(a) * 2.25, -0.9, Math.sin(a) * 2.25], [Math.cos(a + 1.5), 0, Math.sin(a + 1.5)]]; }), 1.3);
      return { root, top: cm.top, rcs };
    }
    function orionCM() {
      const root = new THREE.Group();
      const tiles = std("#ffffff", { map: quilt("orionTiles", "#b9bdc2", "rgba(40,40,45,.5)", 16), metalness: 0.65, roughness: 0.35 }), shield = std("#5a4634", { roughness: 0.95 });
      lathe([[0, -0.32], [1.2, -0.28], [2.2, -0.14], [2.48, -0.03], [2.51, 0.06]], shield, root, 96);
      lathe([[2.51, 0.06], [2.45, 0.2], [0.78, 3.05], [0.72, 3.3], [0, 3.33]], tiles, root, 96);
      for (const a of [-0.45, -0.15, 0.15, 0.45]) { const w = new THREE.Group(); w.rotation.y = a; root.add(w); box(0.05, 0.28, 0.24, std("#06080b", { metalness: 0.9, roughness: 0.1 }), w, 1.55, 1.75, 0).rotation.z = 0.53; }
      return { root, top: 3.33, R: 2.51 };
    }
    function orionStack({ icps = false } = {}) {
      const root = new THREE.Group(), orion = new THREE.Group(); root.add(orion);
      const cm = orionCM(); orion.add(cm.root);
      const white = std("#f0f0ee", { map: quilt("esm", "#efefec", "rgba(0,0,0,.1)", 6), roughness: 0.45 }), dark = std("#3a3c40", { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide });
      cyl(2.51, 2.51, -0.9, -0.02, white, orion, 96);
      cyl(2.05, 2.05, -4.9, -0.9, std("#ffffff", { map: quilt("esm2", "#d8d9d6", "rgba(0,0,0,.18)", 5), metalness: 0.3, roughness: 0.4 }), orion, 96);
      lathe([[0.95, -7.0], [0.7, -5.9], [0.35, -4.9]], dark, orion, 48);
      const wc = std("#ffffff", { map: cells("ocells", "#15244a", "#6c7487", 4, 12), metalness: 0.3, roughness: 0.35 });
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2, h = new THREE.Group(); h.rotation.y = -a; h.position.y = -2.0; orion.add(h);
        rod([2.0, 0, 0], [2.8, 0, 0], 0.06, dark, h);
        for (let p = 0; p < 3; p++) { const q = box(2.25, 0.05, 1.95, wc, h, 3.0 + p * 2.3 + 1.1, 0, 0); q.rotation.x = 0.35; }
      }
      const rcs = thrusters(orion, [0, 1, 2, 3].map((i) => { const a = (i * Math.PI) / 2; return [[Math.cos(a) * 2.1, -4.6, Math.sin(a) * 2.1], [0, -1, 0]]; }), 1.2);
      let stage = null;
      if (icps) {
        stage = new THREE.Group(); root.add(stage);
        const sw = std("#efeeea", { roughness: 0.5 });
        cyl(2.05, 2.55, -6.6, -4.95, sw, stage, 96, true);
        lathe([[0, -6.4], [1.6, -6.55], [2.5, -6.9]], sw, stage, 64);
        cyl(2.5, 2.5, -11.6, -6.9, std("#ffffff", { map: quilt("icps", "#e8e4dc", "rgba(0,0,0,.1)", 4), roughness: 0.55 }), stage, 96);
        mesh(new THREE.SphereGeometry(1.7, 48, 24), std("#c79a4b", { map: foilTex, bumpMap: foilTex, bumpScale: 1, metalness: 0.8, roughness: 0.35 }), stage, 0, -12.6, 0).scale.y = 0.7;
        for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; rod([Math.cos(a) * 2.4, -11.6, Math.sin(a) * 2.4], [Math.cos(a) * 0.9, -13.6, Math.sin(a) * 0.9], 0.06, dark, stage); }
        lathe([[1.08, -17.6], [0.7, -15.2], [0.3, -13.6]], std("#2b2c2f", { metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide }), stage, 48);
      }
      return { root, orion, stage, rcs, top: 3.33 };
    }

    // parachute cluster hanging from a point; `set` breathes the canopies, k = 0..1 release/collapse after splashdown
    function chutes(n, D, len, col) {
      const g = new THREE.Group(); world.add(g);
      const ct = once("canopy" + col, () => tex(512, 128, (gg, w, hh) => { const N = 24; for (let i = 0; i < N; i++) { gg.fillStyle = i % 2 ? col : "#f3f2ee"; gg.fillRect((i * w) / N, 0, w / N + 1, hh); } gg.fillStyle = "rgba(0,0,0,.12)"; for (let y = 10; y < hh; y += 22) gg.fillRect(0, y, w, 2); }));
      const mat = std("#ffffff", { map: ct, side: THREE.DoubleSide, roughness: 0.85 }), lm = new THREE.LineBasicMaterial({ color: "#c8c8c0", transparent: true, opacity: 0.55 });
      const R = D / 2, th1 = 1.15, rimY = R * Math.cos(th1) * 0.75, rimR = R * Math.sin(th1), tilt = n > 1 ? (n > 3 ? 0.36 : 0.3) : 0, list = [];
      for (let i = 0; i < n; i++) {
        const pv = new THREE.Group(); g.add(pv); pv.rotation.set(0, (i * TAU) / n + 0.4, tilt, "YXZ");
        const c = mesh(new THREE.SphereGeometry(R, 48, 14, 0, TAU, 0.1, th1 - 0.1), mat, pv, 0, len - rimY, 0); c.scale.y = 0.75;
        const pts = []; for (let k = 0; k < 20; k++) { const a = (k / 20) * TAU; pts.push(0, 0, 0, Math.cos(a) * rimR, len, Math.sin(a) * rimR); }
        const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); pv.add(new THREE.LineSegments(lg, lm));
        list.push([pv, c, i]);
      }
      return {
        g,
        set(c, k = 0) { for (const [pv, cn, i] of list) { const b = Math.sin(c * 1.7 + i * 2.1); cn.scale.set(1 + 0.025 * b, 0.75 - 0.03 * b - 0.6 * k, 1 + 0.025 * b); pv.rotation.z = tilt + k * 1.3; pv.position.y = -len * 0.6 * k; } },
      };
    }

    // entry plasma: a shock layer hugging the heat shield (capsule frame) and a wake + ablation sparks streaming behind (flow frame, +y = downstream)
    function plasma(capFrame, flowFrame, R, len, hot) {
      const shock = mesh(new THREE.SphereGeometry(R * 1.12, 64, 16, 0, TAU, Math.PI / 2, Math.PI / 2), glow(hot, 2.6, { opacity: 0.8 }), capFrame, 0, -0.08, 0); shock.scale.y = 0.3; shock.castShadow = false;
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(hot).multiplyScalar(1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); core.scale.setScalar(R * 3.2); core.position.y = -0.3; capFrame.add(core);
      const sleeve = (r0, r1, k, o, l) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, 1, 64, 1, true).translate(0, -0.5, 0).rotateX(Math.PI), glow(hot, k, { map: plumeTex, opacity: o })); m.scale.y = l; flowFrame.add(m); return m; };
      const w1 = sleeve(R * 1.08, R * 2.2, 1.3, 0.45, len), w2 = sleeve(R * 0.95, R * 1.3, 2, 0.4, len * 0.45), w3 = sleeve(R * 1.2, R * 3.2, 0.6, 0.14, len * 1.6);
      const N = 500, pos = new Float32Array(N * 3), ph = Array.from({ length: N }, () => [Math.random(), Math.random() * TAU, 1 + Math.random()]);
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color("#ffc890").multiplyScalar(3), size: R * 0.09, map: dotTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sparks.frustumCulled = false; flowFrame.add(sparks);
      return (p, c) => {
        for (const m of [shock, core, w1, w2, w3, sparks]) m.visible = p > 0.01;
        const f = 0.92 + 0.08 * Math.random();
        shock.material.opacity = 0.8 * p * f; core.material.opacity = 0.7 * p * f;
        w1.material.opacity = 0.45 * p * f; w2.material.opacity = 0.4 * p; w3.material.opacity = 0.14 * p * f;
        w1.scale.y = len * (0.85 + 0.15 * p); w3.scale.y = len * 1.6 * (0.9 + 0.1 * Math.sin(c * 9));
        for (let i = 0; i < N; i++) { const [a, b, sp] = ph[i], u = (a + c * 0.9 * sp) % 1, rr = R * (1.05 + 1.6 * u) * (0.6 + 0.4 * Math.sin(b * 7)); pos.set([Math.cos(b + u) * rr, u * len * 1.6, Math.sin(b + u) * rr], i * 3); }
        geo.attributes.position.needsUpdate = true;
      };
    }

    // ---- shared settings
    function moonSurface(sunElev, sunAz) {
      scene.background = stars();
      const env = equi(256, 128, (g, w, hh) => { const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, "#000"); gr.addColorStop(0.5, "#060606"); gr.addColorStop(0.55, "#5a5852"); gr.addColorStop(1, "#4a4844"); g.fillStyle = gr; g.fillRect(0, 0, w, hh); });
      scene.environment = pmrem.fromEquirectangular(env).texture;
      hemi.color.set("#9aa4b5"); hemi.groundColor.set("#222"); hemi.intensity = 0.08;
      sun.color.set("#fffaf2"); sun.intensity = 4.2;
      // craters: many small ones round the site, big ones far out; flattened at the landing spot
      const r = rng(7), cr = [];
      for (let i = 0; i < 280; i++) cr.push([(r() - 0.5) * 3000, (r() - 0.5) * 3000, 3 + 40 * r() ** 2]);
      for (let i = 0; i < 160; i++) cr.push([(r() - 0.5) * 30000, (r() - 0.5) * 30000, 40 + 700 * r() ** 3]);
      const height = (x, z) => {
        let y = 4 * Math.sin(x / 700) * Math.cos(z / 900) + 1.2 * Math.sin(x / 170 + z / 230) + 0.25 * Math.sin(x / 9.3) * Math.sin(z / 11.7);
        for (const [cx, cz, cr0] of cr) { const d2 = (x - cx) ** 2 + (z - cz) ** 2; if (d2 > 2.2 * cr0 * cr0) continue; const q = Math.sqrt(d2) / cr0; y += cr0 * 0.16 * ((q < 1 ? q * q - 1 : 0) + 0.35 * Math.exp(-(((q - 1) / 0.22) ** 2))); }
        return y * sm(20, 160, Math.hypot(x, z));
      };
      const N = 320, S = 16000, geo = new THREE.PlaneGeometry(2, 2, N, N).rotateX(-Math.PI / 2), p = geo.attributes.position, col = new Float32Array(p.count * 3), uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i), w = p.getZ(i), x = S * u * (0.02 + 0.98 * u * u), z = S * w * (0.02 + 0.98 * w * w); // dense near the site, sparse far out
        p.setXYZ(i, x, height(x, z), z); uv.setXY(i, x / 40, z / 40);
        const c = 0.5 + 0.07 * ((((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1);
        col.set([c, c, c * 0.97], i * 3);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const regolith = once("regolith", () => tex(512, 512, (g, w, hh) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, hh); const q = rng(31); for (let i = 0; i < 6000; i++) { const c = 100 + 70 * q(); g.fillStyle = `rgb(${c},${c},${c})`; g.beginPath(); g.arc(q() * w, q() * hh, 0.6 + 2.5 * q() ** 3, 0, TAU); g.fill(); } for (let i = 0; i < 40; i++) { const x = q() * w, y = q() * hh, rr = 4 + 14 * q(); g.strokeStyle = "rgba(60,60,60,.5)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke(); } }, [1, 1], false));
      regolith.wrapS = regolith.wrapT = THREE.RepeatWrapping;
      mesh(geo, std("#ffffff", { vertexColors: true, roughness: 1, bumpMap: regolith, bumpScale: 3 }), world).castShadow = false;
      const em = new THREE.Mesh(new THREE.SphereGeometry(660, 64, 32), new THREE.MeshPhongMaterial({ map: img(PLANETS + "earth_atmos_2048.jpg", true), shininess: 10 }));
      em.position.set(-15000, 30000, -22000).setLength(40000); world.add(em);
      return V3(Math.cos(sunElev * D2R) * Math.cos(sunAz * D2R), Math.sin(sunElev * D2R), Math.cos(sunElev * D2R) * Math.sin(sunAz * D2R));
    }
    function usFlag(parent, x, z) {
      const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
      rod([0, 0, 0], [0, 2.4, 0], 0.025, std("#ddd"), g); rod([0, 2.35, 0], [1.2, 2.35, 0], 0.015, std("#ddd"), g);
      const ft = once("usflag", () => tex(190, 100, (c, w, hh) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? "#fff" : "#b22234"; c.fillRect(0, (i * hh) / 13, w, hh / 13 + 1); } c.fillStyle = "#3c3b6e"; c.fillRect(0, 0, w * 0.4, (hh * 7) / 13); c.fillStyle = "#fff"; for (let i = 0; i < 50; i++) c.fillRect(4 + (i % 10) * 7.4, 3 + Math.floor(i / 10) * 10.5, 2, 2); }));
      mesh(new THREE.PlaneGeometry(1.2, 0.75), std("#ffffff", { map: ft, side: THREE.DoubleSide }), g, 0.6, 1.97, 0);
      return g;
    }
    function starbase() {
      const sand = mesh(new THREE.PlaneGeometry(100000, 50000).rotateX(-Math.PI / 2), std("#c8b48e", { roughness: 1 }), world, 0, 0, -24300);
      sand.castShadow = false;
      const o = ocean(2000, 60); // sea to the east
      world.children.slice(-2).forEach((m) => (m.position.z += 26000));
      box(110, 0.4, 110, std("#a9abad", { roughness: 0.9 }), world, 0, 0.2, -10);
      const grey = std("#5d6268", { roughness: 0.5, metalness: 0.4 });
      mesh(new THREE.CylinderGeometry(9.5, 9.5, 3, 40), grey, world, 0, 19.5, 0); // orbital launch mount
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; box(2.6, 18, 2.6, std("#8e9194"), world, Math.cos(a) * 8.5, 9, Math.sin(a) * 8.5); }
      const lat = once("tower", () => tex(128, 128, (g, w, hh) => { g.strokeStyle = "#fff"; g.lineWidth = 9; g.strokeRect(0, 0, w, hh); g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, hh); g.moveTo(w, 0); g.lineTo(0, hh); g.stroke(); }, [1, 12]));
      box(12, 146, 12, std("#6e7379", { map: lat, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 }), world, 0, 73, -22).castShadow = false;
      box(3, 146, 3, std("#3a3d42"), world, 0, 73, -22);
      box(13.6, 5, 13.6, grey, world, 0, 99.5, -22);
      for (let y = 20; y < 146; y += 18) box(12.3, 0.4, 12.3, grey, world, 0, y, -22);
      const arms = [-1, 1].map((sd) => { const pv = new THREE.Group(); pv.position.set(sd * 6, 99.75, -16); world.add(pv); box(1.6, 2.5, 36, std("#3a3d42", { metalness: 0.5, roughness: 0.5 }), pv, 0, 0, 18); box(0.4, 0.4, 34, std("#d0d0d0"), pv, -sd * 0.9, 1.4, 18); return [pv, sd]; });
      return { arms: (a) => arms.forEach(([pv, sd]) => (pv.rotation.y = -sd * a)), sea: o };
    }

    function entryScene({ cap, len, hot, spot, events, aoa = 20, chase = [16, 6, 24] }) {
      const sunDir = V3(-0.3, 0.55, 0.78).normalize();
      spaceSky(sunDir, "#3b6d9e");
      const E = planet("earth", 78e3, { spot, speed: 7200 });
      const v = cap(); world.add(v.root);
      v.root.rotation.z = Math.PI / 2 - aoa * D2R; // heat shield into the flow (+x), trimmed by the offset centre of mass
      const flow = new THREE.Group(); flow.rotation.z = Math.PI / 2; world.add(flow);
      const fx = plasma(v.root, flow, v.R, len, hot);
      const heat = lin.bind(null, [[0, 0.7], [30, 1], [70, 0.8]]);
      return {
        chase, focus: 0, shadow: 20, sunDir, events, space: true, spin: 0.004,
        place: () => ({ pos: V3(0, 0, 0) }),
        update(t, s, dt) { E.set(t); this.c = (this.c || 0) + dt; const p = heat(t); fx(p, this.c); v.root.position.set((Math.random() - 0.5) * 0.02 * p, (Math.random() - 0.5) * 0.02 * p, 0); },
      };
    }
    function splashScene({ cap, n, D, len, col, chase = [40, 6, 60], events, ship = "#59606a" }) {
      const sunDir = V3(-0.45, 0.6, 0.5).normalize();
      earthSky(sunDir, { far: 30000 });
      const sea = ocean(1600, 100);
      const v = cap(); world.add(v.root);
      const ch = chutes(n, D, len, col);
      const spray = particles({ color: "#f2f6fa", size: 1.6, drag: 0.6, rise: 0, gravity: 9.8, life: 3, opacity: 0.6, n: 3000 });
      const foam = mesh(new THREE.RingGeometry(1.15, 1.6, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }), world, 0, 0.4, 0);
      const boat = new THREE.Group(); boat.position.set(-500, 0, -650); boat.rotation.y = 0.7; world.add(boat);
      box(70, 9, 15, std(ship), boat, 0, 2, 0); box(18, 12, 12, std("#e8e8e8"), boat, 20, 10, 0); box(22, 1, 14, std("#8a8f96"), boat, -22, 6.8, 0);
      const T = e.motion[e.motion.length - 1][0], q = new THREE.Quaternion();
      let c = 0, burst = false;
      return {
        chase, shadow: 60, sunDir, events, floor: 1, tilt: [[0, 0]],
        focus: (t) => 1.5 + len * 0.4 * (1 - sm(T, T + 7, t)), zoom: (t) => 1 - 0.55 * sm(T, T + 7, t), // push in after splashdown
        reset() { spray.reset(); burst = false; },
        update(t, s, dt) {
          c += dt; sea.update(c);
          const after = Math.max(0, t - T), swing = after > 0 ? 0 : 6 * Math.sin(c * 0.7);
          if (after > 0) v.root.position.y = sea.wave(0, 0, c) - 0.5 * sm(0, 1.2, after) + 0.25 * Math.sin(c * 1.3);
          v.root.rotation.set(swing * D2R, 0, (after > 0 ? 8 * Math.sin(c * 0.9) * sm(0, 3, after) : 4 * Math.sin(c * 0.5)) * D2R);
          q.setFromEuler(v.root.rotation);
          ch.g.position.copy(V3(0, cap.top, 0).applyQuaternion(q)).add(v.root.position);
          const cut = sm(T + 3, T + 10, t);
          ch.set(c, cut); ch.g.visible = cut < 0.99;
          if (after > 0 && !burst) { burst = true; spray.step(dt || 0.016, { x: 0, y: 0, z: 0, r0: cap.R, rate: 0, burst: 1400, speed: 9, up: 11 }); }
          spray.step(dt, { x: 0, y: 0, z: 0, r0: cap.R, rate: 0, speed: 8, up: 8 });
          foam.material.opacity = after > 0 ? 0.55 * (1 - sm(0, 14, after)) : 0; foam.scale.setScalar(cap.R * (1 + after * 0.9));
        },
        root: v.root,
      };
    }
    function dockAt(v, offset) { // turn a vehicle built along +y to fly along +x, its docking interface at the root origin
      const g = new THREE.Group(); v.root.rotation.z = -Math.PI / 2; v.root.position.x = -offset; g.add(v.root); return g;
    }
    const rangeInfo = (s) => (s.x < -0.01 ? `Range ${(-s.x).toFixed(1)} m · closing ${(s.vx * 100).toFixed(0)} cm/s` : "");

    // each scene: { chase, focus, shadow, sunDir, events, tilt, ground(t), update(t, s, dt), root | place(t), reset, info, space, spin, zoom }
    const SCENES = {
      f9() {
        const sunDir = V3(-0.5, 0.75, 0.4).normalize();
        earthSky(sunDir, { near: 800, far: 12000 });
        const sea = ocean();
        const ship = new THREE.Group(); world.add(ship);
        box(91, 6, 52, std("#2c3036", { roughness: 0.8 }), ship, 0, 0, 0);
        const deckTex = tex(1024, 584, (g, w, hh) => {
          g.fillStyle = "#3a3e44"; g.fillRect(0, 0, w, hh);
          const r = rng(3); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${0.1 + 0.2 * r()})`; g.fillRect(r() * w, r() * hh, 20 + 60 * r(), 2 + 4 * r()); }
          g.strokeStyle = "#e8e8e8"; g.lineWidth = 12; g.beginPath(); g.arc(w / 2, hh / 2, hh * 0.36, 0, TAU); g.stroke();
          g.lineWidth = 28; g.beginPath(); g.moveTo(w / 2 - 100, hh / 2 - 100); g.lineTo(w / 2 + 100, hh / 2 + 100); g.moveTo(w / 2 + 100, hh / 2 - 100); g.lineTo(w / 2 - 100, hh / 2 + 100); g.stroke();
          g.fillStyle = "#e8e8e8"; g.font = "bold 30px sans-serif"; g.fillText("A SHORTFALL OF GRAVITAS", 40, hh - 30);
        });
        box(91, 0.02, 52, std("#ffffff", { map: deckTex, roughness: 0.85 }), ship, 0, 3.01, 0);
        for (const s of [-1, 1]) box(91, 2.4, 1.2, std("#3b4048"), ship, 0, 4.2, s * 25.4);
        for (const s of [-1, 1]) box(6, 6, 6, std("#5a5f66"), ship, 40, 6, s * 18);
        for (const [x, z] of [[-40, -22], [-40, 22], [40, -22], [40, 22]]) box(5, 5, 5, std("#22252a"), ship, x, -2.5, z);
        rod([42, 9, 18], [42, 18, 18], 0.15, std("#aaa"), ship);
        const v = falcon9Booster(); world.add(v.root);
        const spray = particles({ color: "#e9eef3", size: 5, drag: 0.9, rise: 2.5, gravity: 0, life: 5, opacity: 0.28 });
        const legs = [[13.5, 0], [15.5, 1]], thr = [[0, 0], [6.9, 0], [7.4, 1], [13.8, 0.75], [17.2, 0.5], [17.6, 0]];
        let clock = 0;
        return {
          dir: [1, 0, 0], chase: [55, 10, 85], focus: 22, shadow: 60, sunDir, reset: spray.reset, floor: 2,
          tilt: [[0, 6], [7, 8], [14, 2], [17, 0]],
          events: [[0, "Falling through 3 km at ~920 km/h after the entry burn, grid fins steering"], [7, "Landing burn: the centre Merlin relights"], [13.5, "Landing legs swing down on helium pistons"], [17.2, "Touchdown on the droneship's X"], [17.6, "Engine cutoff"]],
          ground: () => 3 + 0.25 * Math.sin(clock * 0.7),
          update(t, s, dt) {
            clock += dt; sea.update(clock);
            ship.position.y = 0.25 * Math.sin(clock * 0.7); ship.rotation.x = 0.006 * Math.sin(clock * 0.5);
            v.legs(lin(legs, t));
            const p = lin(thr, t); v.fire(p);
            spray.step(dt, { x: s.pos.x, y: 3.3, z: s.pos.z, r0: 2, rate: s.h < 45 ? p * 500 * (1 - s.h / 45) : 0, speed: 28, up: 6 });
          },
          root: v.root,
        };
      },

      dock() {
        const sunDir = V3(-0.45, 0.45, 0.77).normalize();
        spaceSky(sunDir);
        const E = planet("earth", 420e3, { spot: [0.36, 0.55], speed: 7660 });
        const st = iss(); world.add(st.root);
        st.wings.forEach((w) => (w.rotation.x = 0.55));
        const d = crewDragon(); d.setNose(1);
        const g = dockAt(d, 3.47); world.add(g);
        return {
          dir: [1, 0, 0], chase: [-8, 7, 34], focus: 0, shadow: 90, sunDir, space: true, spin: -0.001,
          events: [[0, "Approach along the station's velocity vector, ~150 m out"], [60, "Draco thrusters brake the closing rate"], [80, "Holding at the 20 m waypoint · GO for final approach"], [95, "Final approach at 10 cm/s, guided by lidar and thermal cameras"], [290, "Soft capture: the docking ring's latches catch"], [300, "Ring retracts · 12 hooks drive closed for hard capture"]],
          info: rangeInfo,
          update(t, s, dt) { E.set(t); d.dracos(t < 290 ? (t > 50 && t < 90 ? 0.35 : 0.06) : 0); },
          root: g,
        };
      },

      dentry: () => entryScene({ cap: () => { const c = crewDragon({ trunk: false }); return { root: c.root, R: 2.0 }; }, len: 26, hot: "#ff7a32", spot: [0.12, 0.42],
        events: [[0, "Trunk gone, heat shield forward · 7.5 km/s"], [12, "Plasma sheath: the air ahead is heated to ~1,600 °C"], [25, "Radio blackout"], [45, "Dracos roll the capsule to steer its lift"]] }),

      dsplash() {
        const cap = () => { const c = crewDragon({ trunk: false }); return { root: c.root }; };
        Object.assign(cap, { top: 3.4, R: 2.0 });
        return splashScene({ cap, n: 4, D: 35, len: 38, col: "#d8442c", ship: "#2b2f35", chase: [70, 6, 100],
          events: [[0, "Four main parachutes · ~25 km/h"], [36, "Splashdown"], [40, "Main parachutes cut away"], [44, "Recovery ship Megan stands by"]] });
      },

      sh() {
        const sunDir = V3(0.6, 0.7, 0.5).normalize();
        earthSky(sunDir);
        const base = starbase();
        const v = superHeavy(); world.add(v.root);
        const steam = particles({ color: "#eef1f4", size: 9, drag: 0.7, rise: 3, gravity: 0, life: 7, opacity: 0.25 });
        const t13 = [[0, 0], [6.9, 0], [7.4, 1], [14.6, 1], [15.2, 0]], t3 = [[0, 0], [6.9, 0], [7.4, 1], [30.4, 0.6], [30.8, 0]], open = [[26, 1], [29, 0]];
        let c = 0;
        return {
          dir: [0, 0, -1], chase: [110, 20, 150], focus: 36, shadow: 110, sunDir, reset: steam.reset, floor: 1,
          tilt: [[0, 8], [15, 6], [25, 2], [29, 0]],
          events: [[0, "Coming back to Starbase at ~1,080 km/h after the boostback burn"], [7, "Landing burn: 13 Raptors light"], [15, "Down to the 3 centre engines for fine positioning"], [20, "Slides in over the launch mount, between the open chopsticks"], [26, "Chopsticks close"], [30.8, "Caught · engines off, the catch pins settle onto the arms"]],
          ground: () => 0,
          update(t, s, dt) {
            c += dt; base.sea.update(c);
            base.arms(lin(open, t) * 32 * D2R);
            const p13 = lin(t13, t), p3 = lin(t3, t);
            v.fires.forEach((f, i) => f(i < 3 ? p3 : p13));
            steam.step(dt, { x: s.pos.x, y: 0.5, z: s.pos.z, r0: 8, rate: s.h < 160 ? Math.max(p3, p13) * 600 * (1 - s.h / 160) : 0, speed: 35, up: 8 });
          },
          root: v.root,
        };
      },

      pez() {
        const sunDir = V3(-0.3, 0.6, 0.75).normalize();
        spaceSky(sunDir);
        const E = planet("earth", 172e3, { spot: [0.62, 0.38], speed: 7800 });
        const v = starshipShip(); world.add(v.root);
        v.root.rotation.z = -Math.PI / 2; v.root.position.x = -25; // nose +x, belly to the Earth, Pez door up
        v.door.material = std("#020203", { roughness: 1 });
        const satM = [std("#b8bcc4", { metalness: 0.7, roughness: 0.3 }), std("#ffffff", { map: cells("slcells", "#101a33", "#3a3f4a", 6, 10), metalness: 0.4, roughness: 0.3 })];
        const sats = Array.from({ length: 9 }, (_, i) => { const g = new THREE.Group(); world.add(g); box(4.1, 0.28, 2.7, satM[0], g, 0, 0, 0); box(4.0, 0.02, 2.6, satM[1], g, 0, 0.15, 0); g.userData.t = 6 + i * 6.2; g.userData.spin = (Math.random() - 0.5) * 0.06; return g; });
        const door = V3(5.5, 4.4, 0);
        return {
          chase: [-22, 34, 30], focus: 4, shadow: 50, sunDir, space: true, spin: 0.003,
          events: [[0, "Coasting in orbit · the Pez-dispenser door is open"], [6, "Starlink satellites slide out one at a time"], [30, "Each one drifts clear before the next is released"], [56, "Payload deployed"]],
          info: (s) => { const k = sats.filter((g) => s.t > g.userData.t).length; return k ? `${k} of ${sats.length} satellites deployed` : ""; },
          place(t) { return { pos: V3(0, 0, 0), t }; },
          update(t) {
            E.set(t);
            for (const g of sats) {
              const u = t - g.userData.t;
              g.visible = u > -1;
              g.position.copy(door).add(V3(-0.35 * Math.max(0, u), Math.min(1, Math.max(0, u + 1)) * 1.2 + 0.55 * Math.max(0, u), 0));
              g.rotation.set(Math.max(0, u) * g.userData.spin, 0, Math.max(0, u) * g.userData.spin * 0.5);
            }
          },
        };
      },

      sentry() {
        const sunDir = V3(-0.4, 0.5, 0.77).normalize();
        spaceSky(sunDir, "#3b6d9e");
        const E = planet("earth", 78e3, { spot: [0.55, 0.42], speed: 7000 });
        const v = starshipShip(); world.add(v.root);
        v.body.position.y = -25; v.root.rotation.z = -30 * D2R; // nose up ~60° from the flight path, belly into the flow
        const hot = "#ff5a9a", warm = "#ff8a3a", flow = new THREE.Group(); flow.rotation.z = Math.PI / 2; world.add(flow);
        const sheet = mesh(new THREE.CylinderGeometry(5.0, 5.0, 50, 64, 1, true, 0, Math.PI), glow(warm, 1.5, { opacity: 0.4 }), v.body, 0, 26, 0); sheet.castShadow = false;
        const sheet2 = mesh(new THREE.CylinderGeometry(6.2, 6.2, 54, 64, 1, true, 0.2, Math.PI - 0.4), glow(hot, 1.2, { opacity: 0.25 }), v.body, 0.8, 26, 0); sheet2.castShadow = false;
        const wake = [];
        for (const [r0, r1, k, o, l] of [[12, 26, 1.1, 0.24, 120], [7, 12, 2.2, 0.32, 50], [18, 50, 0.6, 0.07, 220]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, 1, 64, 1, true).translate(0, -0.5, 0).rotateX(Math.PI), glow(hot, k, { map: plumeTex, opacity: o })); m.scale.y = l; flow.add(m); wake.push([m, o]); }
        let c = 0;
        return {
          chase: [50, 12, 62], focus: 0, shadow: 60, sunDir, space: true, spin: 0.004,
          events: [[0, "Belly-first at ~60° angle of attack · 7 km/s"], [10, "Plasma wraps the hexagonal heat-shield tiles"], [30, "Peak heating · ~1,400 °C on the windward side"], [50, "Flaps trim the attitude like a skydiver's arms and legs"]],
          place: () => ({ pos: V3(0, 0, 0) }),
          update(t, s, dt) {
            c += dt; E.set(t); v.flaps(0.15, c);
            const p = lin([[0, 0.7], [30, 1], [70, 0.85]], t), f = 0.92 + 0.08 * Math.random();
            sheet.material.opacity = 0.4 * p * f; sheet2.material.opacity = 0.25 * p * f;
            for (const [m, o] of wake) m.material.opacity = o * p * f;
          },
        };
      },

      scatch() {
        const sunDir = V3(-0.5, 0.55, 0.65).normalize();
        earthSky(sunDir);
        const base = starbase();
        const v = starshipShip(); world.add(v.root);
        v.body.position.y = -20; v.body.rotation.y = -Math.PI / 2; // root = centre of mass; belly faces down while horizontal
        const steam = particles({ color: "#eef1f4", size: 8, drag: 0.7, rise: 3, gravity: 0, life: 6, opacity: 0.25 });
        const thr = [[0, 0], [10.6, 0], [11.2, 1], [24, 0.75], [29.5, 0.5], [29.9, 0]], open = [[24, 1], [28.5, 0]];
        let c = 0;
        return {
          dir: [0, 0, -1], chase: [90, 10, 120], focus: 0, shadow: 90, sunDir, reset: steam.reset, floor: 1,
          tilt: [[0, 90], [11, 90], [15.5, -8], [17, 4], [19, 0]],
          events: [[0, "Belly-flop: falling sideways at terminal velocity, ~320 km/h"], [11, "Landing flip: Raptors relight and swing the ship upright"], [16, "Landing burn"], [24, "Slides between the open chopsticks"], [29.5, "Caught · engines off"]],
          ground: () => 0,
          update(t, s, dt) {
            c += dt; base.sea.update(c);
            base.arms(lin(open, t) * 32 * D2R);
            v.flaps(t < 11 ? 0.25 * Math.sin(c * 0.6) : 0, c);
            const p = lin(thr, t); v.fires.forEach((f) => f(p));
            const by = s.h - 20;
            steam.step(dt, { x: s.pos.x, y: 0.5, z: s.pos.z, r0: 6, rate: by < 120 ? p * 400 * (1 - by / 120) : 0, speed: 25, up: 6 });
          },
          root: v.root,
        };
      },

      td() {
        const sunDir = V3(0.55, 0.45, 0.7).normalize();
        spaceSky(sunDir, "#1d3552");
        const E = planet("earth", 2.2e7, { k: 0.04, at: V3(0.5, -0.3, -0.8), spot: [0.3, 0.5], seg: 128 });
        const csm = apolloCSM(); const g = dockAt(csm, csm.top); world.add(g);
        const lm = lunarModule({ folded: true }); lm.root.rotation.z = Math.PI / 2; lm.root.position.x = 6.3; world.add(lm.root);
        const s4b = new THREE.Group(); world.add(s4b); s4b.rotation.z = Math.PI / 2; // same frame as the LM: +y toward Columbia
        const white = std("#f3f3f0", { roughness: 0.5 }), black = std("#16171a", { roughness: 0.5 });
        const y0 = -5.4; // top of the fixed lower ring of the adapter, round Eagle's descent stage (s4b +y points at Columbia)
        cyl(3.55, 3.9, y0 - 2.2, y0, std("#efefec", { side: THREE.DoubleSide, roughness: 0.5 }), s4b, 96, true);
        cyl(3.3, 3.3, y0 - 3.1, y0 - 2.2, std("#e9e8e2", { roughness: 0.6 }), s4b, 96);
        for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; rod([Math.cos(a) * 2.3, -5.0, Math.sin(a) * 2.3], [Math.cos(a) * 3.3, y0 - 2.1, Math.sin(a) * 3.3], 0.07, std("#888"), s4b); }
        cyl(3.3, 3.3, y0 - 20.1, y0 - 3.1, std("#ffffff", { map: once("s4b", () => tex(512, 512, (c, w, hh) => { c.fillStyle = "#f3f3f0"; c.fillRect(0, 0, w, hh); c.fillStyle = "#16171a"; for (let i = 0; i < 8; i += 2) c.fillRect((i * w) / 8, hh * 0.86, w / 8, hh * 0.14); c.fillStyle = "#16171a"; c.font = "bold 46px sans-serif"; c.fillText("USA", w * 0.6, hh * 0.45); })), roughness: 0.5 }), s4b, 96);
        lathe([[1.4, y0 - 23], [1.0, y0 - 21.5], [0.4, y0 - 20.1]], std("#333", { side: THREE.DoubleSide, metalness: 0.6 }), s4b, 32);
        for (const sd of [-1, 1]) box(1.1, 3.0, 0.7, black, s4b, sd * 3.6, y0 - 19, 0);
        // the four adapter panels, jettisoned before the turnaround and drifting away
        const pm = std("#efefec", { side: THREE.DoubleSide, roughness: 0.5 });
        const pan = [0, 1, 2, 3].map((i) => { const m = mesh(new THREE.CylinderGeometry(2.2, 3.9, 6.5, 24, 1, true, 0, Math.PI / 2), pm, world); m.userData.a = (i * Math.PI) / 2; return m; });
        return {
          dir: [1, 0, 0], chase: [-24, 10, 26], focus: 0, shadow: 40, sunDir, space: true, spin: 0.002,
          events: [[0, "Columbia has turned around to face the S-IVB · ~28 m away"], [60, "Collins lines up the probe on Eagle's drogue"], [100, "Probe in the drogue · capture latches"], [104, "Hard dock · 12 latches lock the tunnel"], [112, "Eagle pulled free of the S-IVB"]],
          info: rangeInfo,
          update(t, s) {
            E.set(t); csm.rcs(t < 100 ? 0.12 : 0);
            const out = Math.max(0, t - 112);
            s4b.position.x = 0.3 * out + 0.01 * out * out;
            pan.forEach((m) => { const a = m.userData.a, u = t + 60; m.position.set(4 + 0.25 * u, Math.cos(a) * (5 + 0.3 * u), Math.sin(a) * (5 + 0.3 * u)); m.rotation.set(a + 0.01 * u, 0, -Math.PI / 2 + 0.015 * u); });
          },
          root: g,
        };
      },

      lm() {
        const sunDir = moonSurface(11, 35); // Apollo 11 landed with the Sun ~10° up
        const v = lunarModule(); world.add(v.root);
        const dust = particles({ color: "#b7b2a8", size: 0.9, drag: 0, rise: 0, gravity: 1.62, life: 3.5, opacity: 0.55 });
        const thr = [[0, 0.6], [100, 0.35], [tLM + 1, 0.3], [tLM + 1.15, 0]];
        return {
          dir: [1, 0, 0], chase: [18, 4, 28], focus: 3, shadow: 40, sunDir, reset: dust.reset, floor: 1,
          tilt: [[0, 45], [60, 25], [100, 8], [140, 0]],
          events: [[0, "High gate, 2.2 km up: P64 approach, pitched back to brake"], [100, "Low gate, ~150 m: P66, Armstrong flies it by hand"], [firstBelow(M.lm, 30), "Exhaust starts blowing dust off the surface"], [tLM, "CONTACT LIGHT: a probe touches the surface"], [tLM + 1.1, "Engine stop · “The Eagle has landed”"]],
          ground: () => 0,
          update(t, s, dt) {
            const p = lin(thr, t); v.fire(p); v.probes(s.h);
            dust.step(dt, { x: s.pos.x, y: 0, z: s.pos.z, r0: 1, rate: s.h < 30 ? p * 900 * (1 - s.h / 30) : 0, speed: 60, up: 4 });
          },
          root: v.root,
        };
      },

      lmasc() {
        const sunDir = moonSurface(25, 35); // 21½ hours later the Sun is higher
        const v = lunarModule(); world.add(v.root); v.probes(0);
        const flag = usFlag(world, 9, 5);
        const flakes = particles({ color: "#e0b860", size: 0.18, drag: 0, rise: 0, gravity: 1.62, life: 9, opacity: 0.9, n: 1500 });
        const dust = particles({ color: "#b7b2a8", size: 0.8, drag: 0, rise: 0, gravity: 1.62, life: 3, opacity: 0.4, n: 2000 });
        const P = V3();
        const at = (u) => { // ascent stage position u s after liftoff: straight up, then pitch over 52° toward Columbia
          if (u <= 0) return [0, 0, 0, 0];
          if (u < 10) return [0, 0.95 * u * u, 0, 1.9 * u];
          const w = u - 10; return [1.3 * w * w, 95 + 19 * w + 0.2 * w * w, 2.6 * w, 19 + 0.4 * w];
        };
        return {
          chase: [13, 3.5, 17], focus: 3.5, shadow: 60, sunDir, floor: 1,
          events: [[0, "Ascent engine armed · Tranquility Base"], [3, "LIFTOFF · pyros cut the ascent stage free; the descent stage is its launch pad"], [3.4, "Exhaust blows foil and the flag over"], [13, "Pitchover · heading downrange toward Columbia"], [25, "Climbing toward a 17 × 83 km orbit"]],
          reset() { flakes.reset(); dust.reset(); this.b = false; },
          zoom: (t) => 1 + Math.max(0, t - 5) ** 1.5 * 0.08,
          place(t) {
            const u = t - 3, [x, y, vx, vy] = at(u);
            v.asc.position.set(x, y, 0); v.asc.rotation.z = -52 * D2R * sm(10, 14, u);
            return { pos: P.set(x * 0.85, y * 0.85, 0), alt: y / 1000, vel: Math.hypot(vx, vy) * 3.6 };
          },
          update(t, s, dt) {
            const u = t - 3, on = u > 0 ? 1 : 0;
            v.afire(on); v.rcs(u > 8 && u < 16 ? 0.4 : 0);
            if (u > 0 && !this.b) { this.b = true; flakes.step(0.016, { x: 0, y: 3.2, z: 0, r0: 2, rate: 0, burst: 900, speed: 9, up: 12, floor: 0 }); }
            flakes.step(dt, { x: 0, y: 3.2, z: 0, r0: 2, rate: 0, speed: 0, up: 0, floor: 0 });
            dust.step(dt, { x: 0, y: 0, z: 0, r0: 2, rate: u > 0 && u < 6 ? 600 * (1 - u / 6) : 0, speed: 30, up: 3 });
            flag.rotation.x = -1.45 * sm(3.2, 4.6, t);
          },
        };
      },

      lmdock() {
        const sunDir = V3(0.5, 0.55, 0.67).normalize();
        spaceSky(sunDir, "#3a3a3a");
        const Mo = planet("moon", 110e3, { spot: [0.5, 0.52], speed: 1630 });
        const em = new THREE.Mesh(new THREE.SphereGeometry(6.371e5, 64, 32), new THREE.MeshPhongMaterial({ map: img(PLANETS + "earth_atmos_2048.jpg", true), shininess: 12 }));
        em.position.set(-0.93, 0.13, -0.35).setLength(3.844e7); world.add(em);
        const csm = apolloCSM(); const g = dockAt(csm, csm.top); world.add(g);
        const lm = lunarModule(); lm.desc.visible = false; lm.root.rotation.z = Math.PI / 2; lm.root.position.x = 6.3; world.add(lm.root);
        return {
          dir: [1, 0, 0], chase: [-20, 8, 24], focus: 0, shadow: 40, sunDir, space: true, spin: 0.002,
          events: [[0, "Eagle's ascent stage station-keeping, 110 km above the Moon"], [40, "Columbia closes in · Collins at the controls"], [120, "Contact · capture latches"], [124, "“Hard dock” · Armstrong and Aldrin rejoin Collins"]],
          info: rangeInfo,
          update(t) { Mo.set(t); csm.rcs(t < 120 ? 0.12 : 0); lm.rcs(t < 120 ? 0.04 : 0); },
          root: g,
        };
      },

      aentry: () => entryScene({ cap: apolloCM, len: 22, hot: "#ff6a26", spot: [0.05, 0.47],
        events: [[0, "Columbia hits the atmosphere at 11 km/s, 25° off horizontal"], [10, "Shock layer ~2,700 °C · radio blackout"], [30, "Peak heating · up to 6.5 g"], [50, "Rolling to steer the lift vector toward the Hornet"]] }),

      asplash() {
        const cap = () => apolloCM();
        Object.assign(cap, { top: 3.27, R: 1.96 });
        return splashScene({ cap, n: 3, D: 25.4, len: 30, col: "#d33a2c", ship: "#58606a", chase: [55, 5, 78],
          events: [[0, "Three main parachutes · 31 km/h"], [35, "Splashdown in the Pacific"], [39, "Parachutes released"], [44, "Flotation bags · USS Hornet's helicopters inbound"]] });
      },

      osep() {
        const sunDir = V3(0.4, 0.5, 0.77).normalize();
        spaceSky(sunDir, "#1e3a5c");
        planet("earth", 2.8e7, { k: 0.04, at: V3(0.3, -0.4, -0.9), spot: [0.6, 0.5], seg: 128 });
        const o = orionStack({ icps: true }); world.add(o.root); o.root.rotation.z = -Math.PI / 2;
        const P = V3();
        return {
          chase: [-6, 14, 48], focus: 0, shadow: 50, sunDir, space: true, spin: 0.002,
          events: [[0, "Orion still on the ICPS after the apogee raise"], [5, "Separation · springs push Orion away"], [35, "The crew pitches Orion around to face the spent stage"], [55, "Proximity operations · flying Orion by hand"], [85, "Holding ~12 m off the ICPS"]],
          info: (s) => (s.t > 5 ? `Gap ${s.gap.toFixed(1)} m` : ""),
          place(t) {
            // Orion's offset along the stack axis (world +x): drift out, turn, come back in
            const u = t - 5, x = u < 0 ? 0 : u < 35 ? 0.7 * u : u < 55 ? 24.5 + 0.3 * (u - 35) : 30.5 - 18 * sm(55, 90, u);
            const turn = Math.PI * sm(35, 55, u), c = -2, ct = Math.cos(turn); // pitch round Orion's middle (2 m below the heat shield)
            o.orion.position.set(0, x + c - c * ct, -c * Math.sin(turn));
            o.orion.rotation.x = turn;
            const low = o.orion.position.y + Math.min(3.33 * ct, -4.9 * ct);
            return { pos: P.set(o.orion.position.y * 0.5 - 4, 0, 0), t, gap: Math.max(0, low + 4.95) };
          },
          update(t) { o.rcs(t > 35 && t < 90 ? 0.18 : 0); },
        };
      },

      flyby() {
        const sunDir = V3(0.8, 0.35, 0.48).normalize();
        spaceSky(sunDir, "#202020");
        const D = 9.737e6, md = V3(0, -0.3, -0.95).normalize(), side = V3(1, 0, 0);
        const Mo = planet("moon", 0, { at: md.clone(), spot: [0.9, 0.5], seg: 256 });
        const up = V3().crossVectors(side, md).normalize();
        const em = new THREE.Mesh(new THREE.SphereGeometry(6.371e5, 96, 48), new THREE.MeshPhongMaterial({ map: img(PLANETS + "earth_atmos_2048.jpg", true), shininess: 14 }));
        em.position.copy(md).addScaledVector(up, -0.12).normalize().multiplyScalar(3.844e7); world.add(em);
        const o = orionStack(); world.add(o.root); o.root.rotation.set(0.3, 0, -Math.PI / 2);
        return {
          chase: [5, 10, 32], focus: 0, shadow: 30, sunDir, space: true, spin: 0.00008,
          events: [[0, "Approaching the far side of the Moon"], [1070, "Earthset · out of contact behind the Moon"], [2000, "Closest approach · ~8,000 km above the far side"], [2930, "Earthrise · signal back · the free return heads home"]],
          place(t) {
            Mo.g.position.copy(md).multiplyScalar(D).addScaledVector(side, -1420 * (t - 2000)); // straight-line pass, ~1.4 km/s
            return { pos: V3(0, 0, 0) };
          },
          update() {},
        };
      },

      oentry: () => entryScene({ cap: orionCM, len: 28, hot: "#ff6a2a", spot: [0.03, 0.43],
        events: [[0, "Crew module alone, heat shield first at ~11 km/s"], [10, "Shock layer near 2,800 °C · blackout"], [30, "Skip: Orion's lift carries it back up before the final plunge"], [55, "Peak loads ~4 g"]] }),

      osplash() {
        const cap = () => orionCM();
        Object.assign(cap, { top: 3.33, R: 2.51 });
        return splashScene({ cap, n: 3, D: 35, len: 40, col: "#e2672a", ship: "#4b5560", chase: [72, 6, 102],
          events: [[0, "Three main parachutes · ~27 km/h"], [35, "Splashdown off San Diego"], [39, "Main parachutes released"], [44, "Uprighting bags inflate · Navy divers approach"]] });
      },
    };

    const sc = SCENES[e.id]();
    const dir = V3(...(sc.dir || [1, 0, 0])), axis = new THREE.Vector3().crossVectors(dir, UP), target = new THREE.Vector3();
    const shc = sun.shadow.camera; shc.left = shc.bottom = -sc.shadow; shc.right = shc.top = sc.shadow; shc.near = 1; shc.far = 3000; shc.updateProjectionMatrix();
    const off = V3(...sc.chase), orbit = { dist: off.length(), yaw: Math.atan2(off.x, off.z), pitch: Math.asin(off.y / off.length()) };
    let st = { pos: V3() }, ss = 0;

    function frame(s, dt) {
      ss = s;
      if (e.motion) {
        const [x, hh, vx, vh] = herm(e.motion, s);
        const pos = dir.clone().multiplyScalar(x).setY((sc.ground ? sc.ground(s) : 0) + hh);
        sc.root.position.copy(pos);
        sc.root.quaternion.setFromAxisAngle(axis, lin(sc.tilt || [[0, 0]], s) * D2R);
        st = { h: hh, pos, x, vx, t: s };
        if (e.m.hud) Object.assign(st, { alt: hh / 1000, vel: Math.hypot(vx, vh) * 3.6 });
      } else st = sc.place(s);
      sc.update(s, st, dt);
      target.copy(st.pos).add(V3(0, (typeof sc.focus === "function" ? sc.focus(s) : sc.focus) || 0, 0));
      sun.position.copy(target).addScaledVector(sc.sunDir, 1200);
      sun.target.position.copy(target);
      hudv = st.alt === undefined ? null : { alt: st.alt, vel: st.vel, ref: e.m.ref || "" };
      let ev = "";
      for (const [et, txt] of sc.events) if (s >= et - 1e-6) ev = txt;
      if (capE.textContent !== ev) capE.textContent = ev;
      const inf = sc.info ? sc.info(st) : "";
      if (capI.textContent !== inf) capI.textContent = inf;
    }
    function aim() {
      const yaw = orbit.yaw + (sc.spin || 0) * ss, d = orbit.dist * (sc.zoom ? sc.zoom(ss) : 1), cp = Math.cos(orbit.pitch);
      camera.position.set(target.x + d * cp * Math.sin(yaw), target.y + d * Math.sin(orbit.pitch), target.z + d * cp * Math.cos(yaw));
      if (sc.floor !== undefined) camera.position.y = Math.max(sc.floor, camera.position.y);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      for (const f of sunViews) f(sc.sunDir);
    }
    return { scene, frame, aim, orbit, pmin: sc.space ? -1.45 : -0.1, reset: () => sc.reset && sc.reset() };
  }

  function render() {
    const e = cur;
    if (!e || !e.R) return;
    const w = el.clientWidth, hh = el.clientHeight;
    if (!w || !hh) return;
    const { renderer, camera, composer, pass } = G;
    if (G.w !== w || G.h !== hh) { G.w = w; G.h = hh; renderer.setSize(w, hh, false); composer.setSize(w, hh); camera.aspect = w / hh; camera.updateProjectionMatrix(); }
    e.R.aim();
    pass.scene = e.R.scene;
    composer.render();
  }

  // drag to orbit, wheel to zoom; keep these off the stage's own pan/zoom
  let drag = null;
  el.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); drag = [ev.clientX, ev.clientY]; el.setPointerCapture(ev.pointerId); el.classList.add("drag"); });
  el.addEventListener("pointermove", (ev) => {
    if (!drag || !cur?.R) return;
    const o = cur.R.orbit;
    o.yaw -= (ev.clientX - drag[0]) * 0.006;
    o.pitch = Math.min(1.45, Math.max(cur.R.pmin, o.pitch + (ev.clientY - drag[1]) * 0.006));
    drag = [ev.clientX, ev.clientY];
    render();
  });
  el.addEventListener("pointerup", () => { drag = null; el.classList.remove("drag"); });
  el.addEventListener("wheel", (ev) => { ev.preventDefault(); ev.stopPropagation(); if (!cur?.R) return; const o = cur.R.orbit; o.dist = Math.min(4000, Math.max(4, o.dist * Math.exp(ev.deltaY * 0.0012))); render(); }, { passive: false });

  return {
    // mission-clock speed while a scene is up (0 = not in a scene)
    speedAt: (t) => find(t)?.m.speed || 0,
    on: (t) => !!find(t)?.R,
    hud: () => hudv,
    // call every flight frame with the mission clock; -Infinity hides it
    draw(t) {
      if (t > -Infinity) load();
      const e = t > -Infinity ? find(t) : null;
      if (e && THREE) ensure(e);
      const vis = !!e?.R;
      if (el.hidden === vis) el.hidden = !vis;
      if (!vis) { cur = null; lastS = null; hudv = null; return; }
      if (cur !== e) { cur = e; lastS = null; capT.textContent = e.m.title; }
      const s = t - e.a0;
      if (lastS !== null && s < lastS) e.R.reset();
      const dt = lastS === null || s < lastS || s - lastS > e.m.speed * 0.5 ? 0 : s - lastS;
      lastS = s;
      el.style.opacity = (sm(0, 0.8 * e.m.speed, s) * (1 - sm(e.m.dur - 0.8 * e.m.speed, e.m.dur, s))).toFixed(3);
      e.R.frame(s, dt);
      render();
    },
  };
}

export const LAND_RUNTIME = makeLand.toString();
