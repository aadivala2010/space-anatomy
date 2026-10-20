// The launch player in 3-D. A vehicle's mission script sets LANDINGS = [...]: one { id: "flight", kind, beats, ...times }
// that films the whole mission as a single unbroken shot (pad, ascent, staging, orbit, the Moon, entry, splashdown or the
// catch), and the booster landings { id, at } (at = the mission time the landing's touchdown lines up with), the only
// shots that cut away from the flight and back. makeLand is shipped to the page as source (makeLand.toString()), so it
// must not use anything from this module.

import { MODELS_RUNTIME } from "./models.mjs";

export const LAND_CSS = `
.land{position:absolute;inset:0;z-index:2;background:#000;cursor:grab;touch-action:none}
.stage .mmap{z-index:3;width:min(26%,280px)}
.land[hidden]{display:none}
.land.drag{cursor:grabbing}
.land canvas{width:100%;height:100%;display:block}
.land-cap{position:absolute;right:8px;top:6px;padding:6px 10px 8px 28px;border-radius:8px;background:radial-gradient(ellipse at 100% 0,#000a,#0000 75%);max-width:min(380px,60%);text-align:right;pointer-events:none;font:600 13px/1.35 ui-sans-serif,system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000c}
.land-cap b{display:block;font:600 11px/1.6 var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;color:#ff8a3d}
.land-cap em{display:block;margin-top:2px;font:500 11px/1.6 var(--anatomy-mono);font-style:normal;color:#ffd29a}
.land-cap em:empty{display:none}
.land-cap i{display:block;font:11px/1.6 var(--anatomy-mono);font-style:normal;color:#c9d3e3}
`;

// info: { start, end, ascEnd, hud(t) -> { alt km, vel km/h, ref, de, dm }, where(t) -> { p: [x, y] km on the mission map, ref },
// fx(t) -> ["burn", "chute1", ...], pose(t), speed(t), playing() }

function makeLand(list, stage, info) {
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
    // dockings: along-track = minus the gap between the docking interfaces
    dock: [[0, -150, 0, 1.5, 0], [80, -20, 0, 0, 0], [90, -20, 0, 0, 0], [95, -19.8, 0, 0.1, 0], [290, 0, 0, 0.1, 0]],
    td: [[0, -28, 0, 0.35, 0], [60, -6, 0, 0.2, 0], [100, 0, 0, 0.12, 0]],
    lmdock: [[0, -60, 0, 0.6, 0], [70, -8, 0, 0.16, 0], [120, 0, 0, 0.16, 0]],
  };
  // self-check: descents never dip below the ground or climb on the way down
  for (const id of ["f9", "sh", "lm", "scatch"]) { const m = M[id]; let prev = Infinity; for (let t = 0; t <= m[m.length - 1][0] + 2; t += 0.02) { const h = herm(m, t)[1]; console.assert(h > -0.01 && h <= prev + 1e-6, id + ": altitude misbehaves at t=" + t.toFixed(2)); prev = h; } }
  const tLM = firstBelow(M.lm, 1.7); // contact probes touch
  // the booster landings, the only cuts: touch = the scene time lined up with the entry's `at`; they play in real time
  const META = {
    f9: { touch: 17.2, dur: 22, speed: 1, hud: 1, title: "Booster landing · droneship" },
    sh: { touch: 30.8, dur: 36, speed: 1, hud: 1, title: "Booster catch · Starbase tower" },
  };
  const SC = [];
  let FL = null;
  for (const c of list) {
    if (c.id === "flight") { FL = { id: c.kind, c, m: { title: "" }, flight: true, a0: info.start, a1: info.end, R: null }; continue; }
    const m = META[c.id];
    if (m) { const a0 = c.at - m.touch; SC.push({ id: c.id, c, m, motion: M[c.id], a0, a1: a0 + m.dur, R: null }); }
  }
  const find = (t) => SC.find((e) => t >= e.a0 && t <= e.a1) || (FL && t >= FL.a0 - 1e-6 && t <= FL.a1 + 1e-6 ? FL : null);
  // playback speed (0 = leave it to the player): a booster landing plays in real time; the flight slows down for its
  // beats [from, to, speed], easing into and out of each over a few seconds of playback (blended in log speed)
  function speedAt(t, base) {
    const e = SC.find((x) => t >= x.a0 && t <= x.a1);
    if (e) return e.m.speed;
    let w = 0, s = base;
    for (const [a, z, v] of (FL && FL.c.beats) || []) { const k = Math.exp(-Math.max(0, a - t, t - z) / (2.5 * v)); if (k > w) { w = k; s = v; } }
    return w > 1e-3 ? Math.exp(Math.log(base) + (Math.log(s) - Math.log(base)) * w) : 0;
  }

  // ---- where the craft is drawn, sampled every 1/60 s of playback exactly as the player steps its clock, so a frame is the
  // same played or scrubbed: the mission time, the body it is nearest (0 Earth, 1 Moon) and its angle round that body on the
  // mission map. Near the body that angle may turn no faster than once in ~25 s of playback, so a low orbit at a huge warp rolls the globe
  // by steadily instead of strobing; it catches up with the map once the warp drops. For the first minutes the downrange
  // distance comes from the speed and pitch profile (the map's ascent rows are coarse near the ground).
  const pitchAt = (alt) => (Math.PI / 2) * (1 - Math.exp(-alt / 42));
  let TB = null;
  function tab() {
    if (TB) return TB;
    const T = [], A = [], P = [], CEN = [[0, 0], [384400, 0]], TAU = Math.PI * 2, CAP = 0.25 / 60, FIX = 0.05 / 60;
    const wrap = (x) => x - TAU * Math.round(x / TAU);
    let t = info.start, av = 0, pr = -1, last = 0, X = 0, a0 = null, ht = null;
    for (;;) {
      const w = info.where(t), pm = w.ref === "moon" ? 1 : 0, c = CEN[pm];
      let a = Math.atan2(w.p[1] - c[1], w.p[0] - c[0]);
      if (a0 === null) a0 = a;
      if (t < 200) {
        const h = info.hud(t);
        if (ht !== null) X += (h.vel / 3600) * Math.sin(pitchAt(h.alt)) * (t - ht); // km downrange
        ht = t;
        const ax = a0 + X / 6378;
        a = ax + wrap(a - ax) * sm(100, 200, t);
      }
      if (pm !== pr) { av = a; pr = pm; }
      // far from the body (its ground a blur) the drawn angle simply follows the map
      else if (Math.hypot(w.p[0] - c[0], w.p[1] - c[1]) > (pm ? 1737 : 6378) + 5000) av = a + TAU * Math.round((av - a) / TAU);
      else { // any lag is made up quickly while high (the ground a blur), gently once low
        const da = wrap(a - last), up = Math.hypot(w.p[0] - c[0], w.p[1] - c[1]) - (pm ? 1737 : 6378), fx = FIX * (1 + 12 * Math.min(1, Math.max(0, (up - 150) / 800)));
        av += Math.abs(da) <= CAP ? da + Math.max(-fx, Math.min(fx, wrap(a - av))) : Math.sign(da) * CAP + Math.max(-fx, Math.min(fx, wrap(a - av))) * Math.min(1, Math.max(0, (up - 150) / 800));
      }
      last = a;
      T.push(t); A.push(av); P.push(pm);
      if (t >= info.end) break;
      t = Math.min(info.end, t + Math.max(1e-3, info.speed(t)) / 60);
    }
    return (TB = { T, A, P });
  }
  // the table at mission time t: playback time tau (s), the visual angle a, the primary p and the row j
  function at(t) {
    const { T, A, P } = tab();
    let lo = 0, hi = T.length - 1;
    if (t <= T[0]) return { tau: 0, a: A[0], p: P[0], j: 0 };
    if (t >= T[hi]) return { tau: hi / 60, a: A[hi], p: P[hi], j: hi };
    while (hi - lo > 1) { const m = (lo + hi) >> 1; T[m] <= t ? (lo = m) : (hi = m); }
    const f = (t - T[lo]) / (T[hi] - T[lo]), same = P[lo] === P[hi];
    return { tau: (lo + f) / 60, a: same ? A[lo] + (A[hi] - A[lo]) * f : f < 0.5 ? A[lo] : A[hi], p: same || f < 0.5 ? P[lo] : P[hi], j: f < 0.5 || same ? lo : hi };
  }


  // ---- overlay (one for all scenes)
  const el = document.createElement("div");
  el.className = "land"; el.hidden = true;
  el.innerHTML = '<div class="land-cap"><b></b><span></span><em></em><i>3-D view · drag to orbit · scroll to zoom</i></div>';
  stage.querySelector(".fx-flash").after(el);
  const capT = el.querySelector("b"), capE = el.querySelector("span"), capI = el.querySelector("em");

  let THREE = null, X = null, loading = null, G = null, cur = null, lastS = null, hudv = null, dead = false, cutAt = 0, lastNow = 0, waitT = null;
  // adaptive quality: the pixel ratio steps down while frames arrive slower than the display wants them, and creeps
  // back up when there is headroom; at the top it swaps the cheap FXAA for 4x MSAA, the first thing given up again
  // (ema = smoothed frame interval, min = the display's own interval, ms)
  const DRS = { pr: 1, ema: 0, min: 1e9, last: 0, at: 0, hold: 0, msaa: false };
  function adapt(now) {
    const dt = now - DRS.last;
    DRS.last = now;
    if (!info.playing() || document.hidden || dt <= 0 || dt > 250) return; // pauses, seeks and stalls say nothing about the GPU
    DRS.min = Math.min(DRS.min * 1.001, Math.max(4, dt));
    DRS.ema = DRS.ema ? DRS.ema + (dt - DRS.ema) * 0.08 : dt;
    if (now - DRS.at < 1200) return;
    const goal = Math.max(16.7, DRS.min), top = Math.min(devicePixelRatio, 2);
    let pr = DRS.pr;
    if (DRS.ema > goal * 1.3 && DRS.msaa) { G.aa(false); DRS.hold = now + 30000; DRS.at = now; DRS.ema = 0; return; }
    if (DRS.ema < goal * 1.05 && pr >= top && !DRS.msaa && now > DRS.hold) { G.aa(true); DRS.at = now; DRS.ema = 0; return; }
    if (DRS.ema > goal * 1.3 && pr > 0.55) { pr = Math.max(0.55, pr * 0.84); DRS.hold = now + 20000; }
    else if (DRS.ema < goal * 1.08 && pr < top && now > DRS.hold) pr = Math.min(top, pr * 1.12);
    else return;
    DRS.pr = pr; DRS.at = now; DRS.ema = 0;
    G.renderer.setPixelRatio(pr); G.composer.setPixelRatio(pr); G.w = 0; // render() resizes the targets
  }
  function load() {
    const U = "https://cdn.jsdelivr.net/npm/three@0.160.0/", J = U + "examples/jsm/postprocessing/";
    loading ||= Promise.all([U + "+esm", J + "EffectComposer.js/+esm", J + "RenderPass.js/+esm", J + "UnrealBloomPass.js/+esm", J + "OutputPass.js/+esm", J + "ShaderPass.js/+esm", J + "Pass.js/+esm", U + "examples/jsm/shaders/FXAAShader.js/+esm", U + "examples/jsm/utils/BufferGeometryUtils.js/+esm"].map((u) => import(u)))
      // a frame asked for while three.js was still loading gets drawn now (paused, nothing else would redraw it)
      .then(([T, ...adds]) => { THREE = T; X = Object.assign({}, ...adds); G = shared(); prebuild(); if (waitT !== null) draw(waitT); })
      .catch((e) => { dead = true; console.warn("3-D views unavailable:", e); });
  }
  // build the scenes in the background, one at a time, so entering a window doesn't stall
  function prebuild() { const next = () => { const e = [FL, ...SC].filter(Boolean).find((x) => !x.R && !x.failed); if (!e) return; ensure(e); setTimeout(next, 60); }; setTimeout(next, 60); }
  function ensure(e) {
    if (!e.R && !e.failed) try { e.R = build(e); } catch (err) { e.failed = true; console.warn("3-D view " + e.id + " failed:", err); }
    return e.R;
  }

  // one renderer + bloom chain shared by every scene
  function shared() {
    const renderer = new THREE.WebGLRenderer({ antialias: false, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
    DRS.pr = Math.min(devicePixelRatio, 1.25);
    renderer.setPixelRatio(DRS.pr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.prepend(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 6e7);
    const composer = new X.EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0, depthTexture: new THREE.DepthTexture(1, 1) }));
    const pass = new X.RenderPass(new THREE.Scene(), camera);
    composer.addPass(pass);
    // the soft effects (plumes, smoke, clouds: layer 2) are drawn at half size into their own target, testing the opaque
    // scene's depth themselves, then laid over the image before the bloom
    const fxU = { uDepth: { value: null }, uDRes: { value: new THREE.Vector2(1, 1) }, uLogF: { value: 1 } };
    class FxPass extends X.Pass {
      constructor() {
        super(); this.needsSwap = false;
        this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
        this.quad = new X.FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { tFx: { value: null } }, vertexShader: `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`, fragmentShader: `uniform sampler2D tFx; varying vec2 vUv;
void main() { gl_FragColor = texture2D(tFx, vUv); }`, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
      }
      setSize(w, h) { this.rt.setSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2))); fxU.uDRes.value.set(1 / this.rt.width, 1 / this.rt.height); }
      render(r, writeBuffer, readBuffer) {
        const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha(), su = r.shadowMap.autoUpdate, sc = pass.scene, bg = sc.background;
        fxU.uDepth.value = readBuffer.depthTexture; fxU.uLogF.value = Math.log2(camera.far + 1);
        // the background ignores layers: left on, a starry sky would be painted opaque over the whole image
        r.shadowMap.autoUpdate = false; camera.layers.set(2); sc.background = null; r.setClearColor(0x000000, 0); r.setRenderTarget(this.rt); r.clear(true, false, false);
        r.render(sc, camera);
        sc.background = bg; camera.layers.set(0); r.shadowMap.autoUpdate = su; r.setClearColor(cc, ca);
        const ac = r.autoClear; r.autoClear = false; // lay it over the image, don't wipe it
        this.quad.material.uniforms.tFx.value = this.rt.texture; r.setRenderTarget(readBuffer); this.quad.render(r); r.autoClear = ac;
      }
    }
    composer.addPass(new FxPass());
    // bloom works from a half-size copy: a glow doesn't need full resolution and this is the costliest pass
    const bloom = new X.UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 1.25), bloomSize = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => bloomSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    composer.addPass(bloom);
    composer.addPass(new X.OutputPass());
    // anti-aliasing: FXAA on the finished image (MSAA on a half-float target costs too much on integrated GPUs)
    const fxaa = new X.ShaderPass(X.FXAAShader); composer.addPass(fxaa);
    const aa = (on) => { DRS.msaa = on; fxaa.enabled = !on; for (const rt of [composer.renderTarget1, composer.renderTarget2]) { rt.samples = on ? 4 : 0; rt.dispose(); } };
    const pmrem = new THREE.PMREMGenerator(renderer), loader = new THREE.TextureLoader(), cache = {};
    loader.setCrossOrigin("anonymous");
    return {
      renderer, camera, composer, pass, pmrem, fxaa, aa, fxU, w: 0, h: 0, shake: 0, rt: 0, clock: { value: 0 }, // clock: rt as a shader uniform
      once: (k, f) => (cache[k] ||= f()),
      img(url, srgb) {
        return (cache[url] ||= (() => { const t = loader.load(url, () => R0()); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })());
      },
    };
  }
  const R0 = () => { if (cur) render(); }; // redraw when a texture arrives or the stage resizes while paused
  new ResizeObserver(R0).observe(el);

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
    function plume(parent, x, y, z, r, len, color, { spread = 1.6, opacity = 1, k = 3.5, halo = 6 } = {}) {
      const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
      // soft gas, not a tube: bright where you look through the middle, fading to nothing at the silhouette and down the length
      const mat = (c, kk, o) => new THREE.ShaderMaterial({
        uniforms: { uC: { value: new THREE.Color(c).multiplyScalar(kk) }, uO: { value: o } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN, vV; varying float vY;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalMatrix * normal; vN = length(n) > 1e-6 ? normalize(n) : vec3(0.0, 0.0, 1.0); vV = normalize(-mv.xyz); vY = uv.y;
gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`,
        fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uC; uniform float uO; varying vec3 vN, vV; varying float vY;
void main() {
#include <logdepthbuf_fragment>
  float edge = pow(abs(dot(vN, vV)), 2.0), along = vY * vY * (0.4 + 0.6 * vY);
  gl_FragColor = vec4(uC * edge * along * uO * 0.5, 1.0);
}`,
      });
      const mk = (rt, rb, c, kk, o, sy) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, 1, 24, 1, true).translate(0, -0.5, 0), mat(c, kk, o)); m.scale.y = sy; g.add(m); };
      mk(r, r * spread, color, k * 0.6, 0.6 * opacity, 1);
      mk(r * 0.6, r * 0.3, "#fff6e6", k, 0.9 * opacity, 0.4);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(color).multiplyScalar(k), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 * opacity }));
      sp.scale.setScalar(r * halo); parent.add(sp); sp.position.set(x, y - r * 0.6, z);
      // thin air widens the plume (it balloons) and stretches it
      const set = (p, thin = 0) => { const wd = 1 + 2.4 * thin; g.visible = sp.visible = p > 0.02; g.scale.set(wd, len * (1 + 1.6 * thin) * p, wd); sp.material.opacity = 0.7 * opacity * p; };
      set(0);
      return set;
    }
    // ---- rocket exhaust: a soft emissive gas volume ray-marched inside a bounding cylinder hung below the nozzle exit
    // (flow along -y in the parent's frame, or along `dir`). `kind` picks the propellant's colours; `cluster` lists the
    // nozzle centres [x, z] of an engine cluster so the plume starts as separate jets that merge downstream; `glow` is a
    // material whose emissive follows the throttle (the hot inside of a bell). Returns set(power 0..1, thin 0..1), where
    // `thin` is how far the outside air has thinned: it widens and lengthens the plume into a pale hollow cone.
    // core / body / shock-diamond colours, brightness, diamond strength, soot
    // core / body / shock-diamond colours, brightness, diamond strength, soot (dark smoke at the edge), opacity of the
    // glowing gas itself (a sooty kerosene flame hides the sky behind it, hydrogen's barely does), spreading rate
    const KINDS = {
      kero: { core: "#fff1d2", body: "#ff7b22", dc: "#fff2dc", vac: "#ffcfa0", gain: 1.7, dia: 0.5, soot: 0, op: 0.55, spread: 0.085 }, // RP-1: Merlin
      f1: { core: "#ffe9c2", body: "#ff6d16", dc: "#fff0d8", vac: "#ffc890", gain: 1.8, dia: 0.25, soot: 1.1, op: 0.6, spread: 0.08 }, // F-1: sooty turbine exhaust film
      solid: { core: "#fffaf0", body: "#ffc670", dc: "#ffffff", vac: "#ffe6c0", gain: 3.4, dia: 0, soot: 0, op: 0.9, spread: 0.07 }, // aluminised solid motors
      hydrolox: { core: "#dfe6ff", body: "#6f7dff", dc: "#ffe6cf", vac: "#b4c0ff", gain: 0.42, dia: 1.6, soot: 0, op: 0.04, spread: 0.05 }, // RS-25, J-2, RL10
      methalox: { core: "#fff0f6", body: "#ff8a55", dc: "#d9c8ff", vac: "#d4bcff", gain: 1.35, dia: 0.85, soot: 0, op: 0.3, spread: 0.075 }, // Raptor
      hyper: { core: "#ffe0c0", body: "#ff9468", dc: "#ffe0c0", vac: "#ffc8a8", gain: 0.34, dia: 0, soot: 0, op: 0.02, spread: 0.06 }, // storable propellants
    };
    const noise3 = () => once("noise3", () => { // tileable smooth value-noise fbm, 64³
      const N = 64, d = new Uint8Array(N * N * N), r = rng(77), f = (x) => x * x * x * (x * (x * 6 - 15) + 10);
      const oct = [[4, 0.5], [8, 0.3], [16, 0.2]].map(([n, a]) => [n, a, Float32Array.from({ length: n * n * n }, r)]);
      for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        let v = 0;
        for (const [n, a, L] of oct) {
          const px = (x * n) / N, py = (y * n) / N, pz = (z * n) / N, ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
          const fx = f(px - ix), fy = f(py - iy), fz = f(pz - iz), g = (i, j, k) => L[(i % n) + (j % n) * n + (k % n) * n * n];
          const l = (a0, b0, t) => a0 + (b0 - a0) * t;
          v += a * l(l(l(g(ix, iy, iz), g(ix + 1, iy, iz), fx), l(g(ix, iy + 1, iz), g(ix + 1, iy + 1, iz), fx), fy), l(l(g(ix, iy, iz + 1), g(ix + 1, iy, iz + 1), fx), l(g(ix, iy + 1, iz + 1), g(ix + 1, iy + 1, iz + 1), fx), fy), fz);
        }
        d[x + y * N + z * N * N] = Math.max(0, Math.min(255, (v - 0.5) * 1.8 * 255 + 128));
      }
      const t = new THREE.Data3DTexture(d, N, N, N);
      t.format = THREE.RedFormat; t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.unpackAlignment = 1; t.needsUpdate = true;
      return t;
    });
    // the cluster's nozzle layout seen from below: blurred (mip-mapped) further down the plume, so the jets merge
    function layoutTex(cluster, R, nozR) {
      const t = tex(256, 256, (g, w, hh) => {
        g.fillStyle = "#000"; g.fillRect(0, 0, w, hh);
        for (const [x, z] of cluster) {
          const cx = (x / R) * 0.5 * w + w / 2, cy = (z / R) * 0.5 * hh + hh / 2, rr = (nozR / R) * 0.5 * w, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
          gr.addColorStop(0, "#fff"); gr.addColorStop(0.6, "#bbb"); gr.addColorStop(1, "#000"); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.fill();
        }
      }, null, false);
      t.flipY = false;
      return t;
    }
    const EXH_V = `#include <common>
#include <logdepthbuf_pars_vertex>
uniform mat4 uMat; uniform float uTaper; varying vec3 vP, vView;
void main() { // a unit cylinder below the origin, narrowed toward the top into a cone that hugs the plume
  vec3 q = position; q.xz *= mix(uTaper, 1., clamp(-q.y, 0., 1.));
  vP = (uMat * vec4(q, 1.0)).xyz; vView = (modelViewMatrix * vec4(q, 1.0)).xyz; gl_Position = projectionMatrix * vec4(vView, 1.0);
#include <logdepthbuf_vertex>
}`;
    const EXH_F = `precision highp sampler3D;
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCam; uniform vec4 uUp; uniform float uT, uIn;
uniform vec4 uA; // exit radius, length, thin air 0..1, power
uniform vec4 uB; // bound radius, spreading rate, cluster radius (0: one nozzle), single nozzle radius
uniform vec3 uCore, uBody, uDia, uVac;
uniform vec4 uK; // gain, diamonds, soot, opacity
uniform sampler3D uNoise; uniform sampler2D uLay;
uniform sampler2D uDepth; uniform vec2 uDRes; uniform float uLogF; // the opaque scene's (logarithmic) depth
varying vec3 vP, vView;
void main() {
#include <logdepthbuf_fragment>
  if (gl_FrontFacing == (uIn > .5)) discard; // near faces from outside, far faces from inside: each pixel once
  float re = uA.x, L = uA.y, X = uA.z, R1 = uB.x;
  vec3 ro = uCam, rd = normalize(vP - uCam);
  // the stretch of the ray inside the bounding cylinder, between just above the exit and the tail
  float qa = dot(rd.xz, rd.xz), qb = dot(ro.xz, rd.xz), qc = dot(ro.xz, ro.xz) - R1 * R1;
  float t0 = -1e9, t1 = 1e9;
  if (qa > 1e-7) { float disc = qb * qb - qa * qc; if (disc <= 0.) discard; float sq = sqrt(disc); t0 = (-qb - sq) / qa; t1 = (-qb + sq) / qa; }
  else if (qc > 0.) discard;
  float smin = -.3 * re;
  if (abs(rd.y) > 1e-6) { float u0 = (-ro.y - smin) / rd.y, u1 = (-ro.y - L) / rd.y; t0 = max(t0, min(u0, u1)); t1 = min(t1, max(u0, u1)); }
  float sceneW = exp2(texture2D(uDepth, gl_FragCoord.xy * uDRes).r * uLogF) - 1.; // stop at whatever solid is in the way
  t1 = min(t1, sceneW * length(vView) / max(-vView.z, 1e-4));
  t0 = max(t0, 0.);
  if (t1 <= t0) discard;
  float tc = clamp(qa > 1e-7 ? -qb / qa : t0, t0, t1), H = max(t1 - tc, tc - t0);
  float dith = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))); // interleaved gradient noise
  bool clus = uB.z > 0.;
  float lam = (clus ? uB.w : re) * (1.8 + 3. * X); // shock-cell spacing
  vec3 acc = vec3(0.); float T = 1.;
  // a thin-air plume is smooth and huge: fewer samples do (and keep its cost down when it fills the screen)
  int N = int(mix(22., 9., X));
  for (int j = 0; j < 22; j++) {
    if (j >= N) break;
    float xs = 1. - 2. * (float(j) + dith) / float(N);
    float t = tc + H * xs * abs(xs);
    if (t < t0 || t > t1) continue;
    float w = 4. * H * abs(xs) / float(N);
    vec3 p = ro + rd * t;
    float s = -p.y, sp = max(s, 0.), rr = length(p.xz);
    float R = re * (1. + X * 3. * (1. - exp(-sp / (re * 1.3)))) + sp * (uB.y + .3 * X);
    float start = smoothstep(-re * .3, re * .1, s) * smoothstep(-re * 1.2, re * .2, uUp.w + dot(p, uUp.xyz));
    float fade = pow(max(1. - sp / L, 0.), 1.5) * start;
    if (fade <= 0.) continue;
    float u = rr / R;
    vec3 np = vec3(p.x / (re * 2.4), (sp - uT * re * 26.) / (re * 3.2), p.z / (re * 2.4)) * .21 / (1. + 2.5 * X); // thin air: broad, smooth
    float n1 = texture(uNoise, np).r, n2 = texture(uNoise, np * 2.63 + vec3(.37, uT * .9, .73)).r;
    float tw = smoothstep(0., L * .25, sp);
    float edge = u + (n1 - .5) * .9 * tw + (n2 - .5) * .35 * (1. - .8 * X);
    float e2 = edge * edge;
    float prof = mix(exp(-e2 * e2 * 1.6), exp(-pow((edge - .78) / .22, 2.)) * .9 + exp(-e2 * 2.2) * .25, X);
    float body = prof * fade * mix(1., .3 + 1.5 * n1, tw * .85) * (1. - .82 * X) * re / mix(re, R, X * .6); // thin air: spread thinner
    float core = (exp(-u * u * 6.) * exp(-sp / (L * .18)) + exp(-u * u * 3.) * exp(-sp / (re * 1.1)) * .8) * (1. - .55 * X);
    if (clus) { // separate jets near the exits, merging as the layout blurs downstream (gone by ~30 nozzle radii)
      core *= .12;
      if (sp < uB.w * 30. * (1. + 2. * X)) {
        float lod = log2(1. + sp / uB.w) * 1.7;
        float jet = textureLod(uLay, p.xz / uB.z * .5 + .5, lod).r * smoothstep(uB.z * (1.1 + .12 * lod), uB.z * .85, rr);
        float cell = fract(s / lam + .5) - .5;
        jet *= exp(-sp / (uB.w * 9. * (1. + 2. * X))) * (1. + uK.y * 2.5 * exp(-cell * cell * 40.) * smoothstep(lam * .4, lam, s) * exp(-s / (lam * 4.)));
        core += jet * 1.8;
      }
    }
    // hotter (whiter) in the middle and near the exits, cooling to the body colour at the edge and to dull red at the tail
    float heat = clamp(core * 1.4 + (1. - smoothstep(.2, 1., u)) * exp(-sp / (L * .35)) * (.5 + .5 * n2), 0., 1.);
    vec3 col = mix(mix(mix(uBody, uBody * vec3(.95, .55, .35), smoothstep(.45, 1., sp / L)), uVac, X * .65), uCore, heat);
    acc += T * col * (body + core * start * .55) * w;
    float od = uK.w * (body + core * start * .3) * (1. - .7 * X); // the glowing gas hides what is behind it
    if (uK.z > 0.) od += uK.z * exp(-pow((u - .75) / .3, 2.)) * exp(-sp / (re * 3.)) * (.3 + n1) * start;
    T *= exp(-od * w / re * 1.4 * uA.w);
  }
  acc /= re;
  if (!clus && uK.y > 0.) { // Mach diamonds, integrated where the ray passes the axis
    float b = -rd.y, den = max(1. - b * b, .05), tcl = qa > 1e-7 ? -qb / qa : -1.;
    if (tcl > t0 && tcl < t1) {
      vec3 xc = ro + rd * tcl; float s = -xc.y, m = length(xc.xz);
      float f = fract(s / lam + .5) - .5, dd = abs(f) * lam * .6 + m, wd = re * .4;
      float on = smoothstep(lam * .35, lam * .9, s) * exp(-s / (lam * 5.)) * (1. - X * .9);
      acc += uDia * uK.y * exp(-dd * dd / (wd * wd)) * on * wd * 1.77 / sqrt(den) / re * 1.6;
    }
  }
  float pw = uA.w;
  gl_FragColor = vec4(acc * uK.x * pw * (1. - .6 * X), 1. - T); // a plume in vacuum is a faint, wide cone
}`;
    const exhFloor = { y: -1e9 }; // a scene sets the ground height its plumes stop at
    function exhaust(parent, { at = [0, 0, 0], re, len, kind = "kero", cluster = null, nozR = re, dir = null, glow = null, glowK = 2.5 }) {
      const K = KINDS[kind], frame = new THREE.Group(); frame.position.set(...at); parent.add(frame);
      if (dir) frame.quaternion.setFromUnitVectors(V3(0, -1, 0), V3(...dir).normalize());
      const cr = cluster ? Math.max(...cluster.map(([x, z]) => Math.hypot(x, z))) + nozR : 0, R0 = cluster ? cr : re;
      const uni = {
        uCam: { value: V3() }, uUp: { value: new THREE.Vector4(0, 1, 0, 0) }, uT: G.clock, uIn: { value: 0 }, uMat: { value: new THREE.Matrix4() }, uTaper: { value: 1 },
        uA: { value: new THREE.Vector4(R0, len, 0, 0) }, uB: { value: new THREE.Vector4(R0, K.spread, cr, nozR) },
        uCore: { value: new THREE.Color(K.core) }, uBody: { value: new THREE.Color(K.body) }, uDia: { value: new THREE.Color(K.dc) }, uVac: { value: new THREE.Color(K.vac) },
        uK: { value: new THREE.Vector4(K.gain, K.dia, K.soot, K.op) }, uNoise: { value: noise3() }, ...G.fxU,
        uLay: { value: cluster ? layoutTex(cluster, cr, nozR) : once("blankTex", () => new THREE.DataTexture(new Uint8Array(4), 1, 1)) },
      };
      const m = new THREE.Mesh(once("exhGeo", () => new THREE.CylinderGeometry(1, 1, 1, 40, 1).translate(0, -0.5, 0)), new THREE.ShaderMaterial({
        uniforms: uni, vertexShader: EXH_V, fragmentShader: EXH_F, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      }));
      m.frustumCulled = false; m.visible = false; m.layers.set(2); frame.add(m); // drawn in the half-size effects pass
      const inv = new THREE.Matrix4(), wp = V3(), top = 0.35 * R0;
      m.onBeforeRender = (r, s, cam) => {
        inv.copy(frame.matrixWorld).invert();
        uni.uCam.value.copy(cam.position).applyMatrix4(inv);
        const c = uni.uCam.value, B = uni.uB.value.x;
        uni.uIn.value = c.x * c.x + c.z * c.z < B * B && c.y < top && c.y > -uni.uA.value.y ? 1 : 0;
        const up = V3(0, 1, 0).transformDirection(inv);
        uni.uUp.value.set(up.x, up.y, up.z, wp.setFromMatrixPosition(frame.matrixWorld).y - exhFloor.y);
      };
      // cap: the most it may reach (m), e.g. while it plays on the stage below at hot staging
      return (p, thin = 0, cap = Infinity) => {
        m.visible = p > 0.01 && cap > 0.05;
        if (glow) glow.emissiveIntensity = p * glowK;
        if (!m.visible) return;
        const L = Math.min(cap, len * (1 + 1.2 * thin) * (0.55 + 0.45 * p)), Rend = R0 * (1 + 3 * thin) + L * (K.spread + 0.3 * thin), B = Math.max(R0 * 1.25, Rend * 1.3);
        uni.uA.value.set(R0, L, thin, p); uni.uB.value.x = B; uni.uTaper.value = Math.min(1, (R0 * (1.5 + 3 * thin)) / B);
        m.position.y = top; m.scale.set(B, L + top, B); m.updateMatrix(); uni.uMat.value.copy(m.matrix);
      };
    }
    // small attitude-control thruster puffs: [position, direction] in the parent frame
    function thrusters(parent, list, len = 1.4) {
      const ms = list.map(([p, d]) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.28, 1, 10, 1, true).translate(0, 0.5, 0), glow("#cfe0ff", 1.6, { map: plumeTex, opacity: 0.55 }));
        m.position.set(...p); m.quaternion.setFromUnitVectors(UP, V3(...d).normalize()); m.scale.set(1, len, 1); m.visible = false; parent.add(m); return m;
      });
      // each nozzle fires in short pulses on its own rhythm (smooth in time, so it doesn't flicker frame to frame)
      return (rate) => { const c = G.rt; ms.forEach((m, i) => { const ph = (c * (1.3 + 0.37 * i) + i * 0.618) % 1; m.visible = rate > 0.001 && ph < Math.min(0.9, rate * 1.4); m.scale.set(1, len * (0.75 + 0.25 * Math.sin(c * 23 + i)), 1); }); };
    }

    // ---- smoke, steam, spray and dust: soft, sunlit billboard puffs that grow as they age, simulated on the CPU and
    // drawn back to front. size = starting diameter (m), grow = how many times wider at the end of its life; glow(...)
    // lights them from a fire (the engines at liftoff) by distance
    const puffTex = () => once("puff", () => tex(256, 256, (g) => { // a 2 x 2 atlas of cloudy puffs (alpha)
      const r = rng(71);
      for (let k = 0; k < 4; k++) {
        const ox = (k % 2) * 128, oy = Math.floor(k / 2) * 128;
        for (let i = 0; i < 46; i++) {
          const a = r() * TAU, d = 36 * Math.sqrt(r()), x = ox + 64 + Math.cos(a) * d, y = oy + 64 + Math.sin(a) * d, rr = 10 + 24 * r() * (1 - d / 48);
          const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, "rgba(255,255,255,.3)"); gr.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = gr; g.fillRect(ox, oy, 128, 128);
        }
      }
    }, null, false));
    const PUFF_V = `#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 iPos; attribute vec4 iData; // size, opacity, rotation, atlas cell
varying vec2 vUv, vQ; varying float vA, vZ, vS; varying vec3 vW;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0); vZ = -mv.z; vS = iData.x * 0.35;
  float c = cos(iData.z), s = sin(iData.z);
  vec2 q = position.xy;
  mv.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y) * iData.x;
  gl_Position = projectionMatrix * mv;
  vQ = q * 2.0; vA = iData.y; vW = (modelMatrix * vec4(iPos, 1.0)).xyz;
  vUv = (q + 0.5) * 0.5 + vec2(mod(iData.w, 2.0), floor(iData.w / 2.0)) * 0.5;
#include <logdepthbuf_vertex>
}`;
    const PUFF_F = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap; uniform vec3 uCol, uSun, uAmb, uSunV, uGlowP, uGlowC, uFogC, uCam; uniform float uGlowR, uFogN, uFogF, uHaze;
uniform sampler2D uDepth; uniform vec2 uDRes; uniform float uLogF;
varying vec2 vUv, vQ; varying float vA, vZ, vS; varying vec3 vW;
void main() {
#include <logdepthbuf_fragment>
  float r2 = dot(vQ, vQ);
  if (r2 > 1.0) discard;
  float d = texture2D(uMap, vUv).a * vA;
  d *= clamp((exp2(texture2D(uDepth, gl_FragCoord.xy * uDRes).r * uLogF) - 1.0 - vZ) / max(vS, 0.5), 0.0, 1.0); // soft where it meets solid things
  if (d < 0.003) discard;
  vec3 n = normalize(vec3(vQ, sqrt(1.0 - r2))); // a ball facing the camera, lit on the sun's side
  float lit = clamp(dot(n, uSunV) * 0.6 + 0.45, 0.0, 1.0);
  vec3 col = uCol * (uAmb + uSun * lit) + uGlowC * exp(-distance(vW, uGlowP) / uGlowR);
  col = mix(col, uFogC, smoothstep(uFogN, uFogF, distance(vW, uCam) / uHaze)); // far puffs fade into the haze
  gl_FragColor = vec4(col * d, d);
}`;
    // haze: how many times farther than the ground's fog they keep showing (clouds float above the hazy ground layer)
    function particles({ n = 1500, color, size, grow = 3, drag, rise, gravity, life, opacity, parent = world, haze = 1 }) {
      const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), age = new Float32Array(n).fill(1e9), lf = new Float32Array(n).fill(1), sz = new Float32Array(n), rot = new Float32Array(n), spin = new Float32Array(n), cell = new Float32Array(n), al = new Float32Array(n).fill(-1);
      const quad = once("puffQuad", () => new THREE.PlaneGeometry(1, 1)), geo = new THREE.InstancedBufferGeometry();
      geo.index = quad.index; geo.setAttribute("position", quad.attributes.position);
      const iPos = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage), iData = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute("iPos", iPos); geo.setAttribute("iData", iData); geo.instanceCount = 0;
      const uni = { uMap: { value: puffTex() }, uCol: { value: new THREE.Color(color) }, uSun: { value: new THREE.Color() }, uAmb: { value: new THREE.Color() }, uSunV: { value: V3(0, 1, 0) }, uGlowP: { value: V3() }, uGlowC: { value: new THREE.Color(0, 0, 0) }, uGlowR: { value: 30 }, uFogC: { value: new THREE.Color() }, uFogN: { value: 1e9 }, uFogF: { value: 2e9 }, uCam: { value: V3() }, uHaze: { value: haze }, ...G.fxU };
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: PUFF_V, fragmentShader: PUFF_F, transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
      m.frustumCulled = false; m.layers.set(2); parent.add(m); // drawn in the half-size effects pass
      // sorted for the camera that is about to draw them; lit by the scene's sun and sky, hazed like its fog
      m.onBeforeRender = (r, s, cam) => {
        write();
        uni.uSun.value.copy(sun.color).multiplyScalar(sun.intensity * 0.2); uni.uAmb.value.copy(hemi.color).multiplyScalar(0.25 + hemi.intensity * 0.5);
        uni.uCam.value.copy(cam.position);
        if (scene.fog) { uni.uFogC.value.copy(scene.fog.color); uni.uFogN.value = scene.fog.near; uni.uFogF.value = scene.fog.far; } else uni.uFogN.value = uni.uFogF.value = 1e12;
      };
      sunViews.push((dir) => uni.uSunV.value.copy(dir).transformDirection(camera.matrixWorldInverse));
      let head = 0, acc = 0, live = 0;
      const order = new Uint32Array(n), dep = new Float32Array(n), cam = V3();
      const write = () => { // alive puffs, farthest first
        cam.copy(camera.position); parent.worldToLocal(cam);
        live = 0;
        for (let i = 0; i < n; i++) if (age[i] < lf[i]) { dep[i] = (pos[i * 3] - cam.x) ** 2 + (pos[i * 3 + 1] - cam.y) ** 2 + (pos[i * 3 + 2] - cam.z) ** 2; order[live++] = i; }
        const o = order.subarray(0, live).sort((a, b) => dep[b] - dep[a]), P = iPos.array, D = iData.array;
        for (let k = 0; k < live; k++) {
          const i = o[k], f = age[i] / lf[i];
          P[k * 3] = pos[i * 3]; P[k * 3 + 1] = pos[i * 3 + 1]; P[k * 3 + 2] = pos[i * 3 + 2];
          D[k * 4] = sz[i] * (1 + (grow - 1) * Math.sqrt(f)); D[k * 4 + 1] = al[i] >= 0 ? al[i] : opacity * Math.min(1, f * 12) * (1 - f) ** 1.3; D[k * 4 + 2] = rot[i] + spin[i] * age[i]; D[k * 4 + 3] = cell[i];
        }
        geo.instanceCount = live; iPos.needsUpdate = iData.needsUpdate = true;
      };
      return {
        reset() { age.fill(1e9); al.fill(-1); acc = 0; geo.instanceCount = 0; },
        // draw these puffs as given, no simulation: [[x, y, z, size, opacity], ...]
        place(list) {
          for (let i = 0; i < n; i++) {
            const q = list[i];
            if (!q || q[4] < 0.004) { age[i] = 1e9; continue; }
            pos[i * 3] = q[0]; pos[i * 3 + 1] = q[1]; pos[i * 3 + 2] = q[2]; sz[i] = q[3]; al[i] = q[4]; age[i] = 0; lf[i] = 1e9; rot[i] = i * 2.4; spin[i] = 0; cell[i] = i % 4;
          }
        },
        glow(x, y, z, col, k, R = 30) { uni.uGlowP.value.set(x, y, z); uni.uGlowC.value.set(col).multiplyScalar(k); uni.uGlowR.value = R; },
        step(dt, src) { // src: {x, y, z, r0, rate, speed, up, burst, dir: [dx, dz] + cone (radians) for a one-sided jet, floor}
          if (dt <= 0) return;
          acc += src.rate * dt + (src.burst || 0);
          for (; acc >= 1; acc--) {
            const i = head++ % n, a = src.dir ? Math.atan2(src.dir[1], src.dir[0]) + (Math.random() - 0.5) * (src.cone || 0.6) : Math.random() * TAU, s = src.speed * (0.4 + 0.8 * Math.random());
            pos[i * 3] = src.x + Math.cos(a) * src.r0; pos[i * 3 + 1] = src.y + 0.3; pos[i * 3 + 2] = src.z + Math.sin(a) * src.r0;
            vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = src.up * Math.random(); vel[i * 3 + 2] = Math.sin(a) * s;
            age[i] = 0; al[i] = -1; lf[i] = life * (0.7 + 0.6 * Math.random()); sz[i] = size * (0.6 + 0.8 * Math.random()); rot[i] = Math.random() * TAU; spin[i] = (Math.random() - 0.5) * 0.3; cell[i] = Math.floor(Math.random() * 4);
          }
          const k = Math.exp(-drag * dt), fl = src.floor ?? src.y;
          for (let i = 0; i < n; i++) {
            if (age[i] >= lf[i]) continue;
            age[i] += dt;
            const j = i * 3;
            vel[j] *= k; vel[j + 2] *= k; vel[j + 1] = vel[j + 1] * k + (rise - gravity) * dt;
            pos[j] += vel[j] * dt; pos[j + 1] = Math.max(fl, pos[j + 1] + vel[j + 1] * dt); pos[j + 2] += vel[j + 2] * dt;
          }
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
    // ---- sky dome: the zenith colour fading into a hazy horizon, the sun's glow and disc; below the horizon the haze
    // the ground fades into. Drawn behind everything (depth 1); `env()` bakes it into the scene's image-based light.
    const SKY_V = `varying vec3 vD;
void main() { vD = (modelMatrix * vec4(position, 0.0)).xyz; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
    const SKY_F = `uniform vec3 uZen, uHor, uLow, uSun, uSunD; uniform float uBand, uDisc;
varying vec3 vD;
void main() {
  vec3 d = normalize(vD);
  float h = d.y, t = pow(1.0 - clamp(h, 0.0, 1.0), uBand); // 1 at the horizon, 0 overhead
  vec3 col = mix(uZen, uHor, t);
  col = mix(col, uLow, smoothstep(0.0, -0.12, h));
  float cs = max(dot(d, uSunD), 0.0);
  col += uSun * (pow(cs, 6.0) * 0.12 + pow(cs, 90.0) * 0.6) * (0.4 + 0.6 * smoothstep(-0.1, 0.1, h));
  col += uSun * smoothstep(1.0 - uDisc, 1.0 - uDisc * 0.55, cs) * 40.0;
  gl_FragColor = vec4(col, 1.0);
}`;
    function skyDome(sunDir) {
      const u = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uLow: { value: new THREE.Color() }, uSun: { value: new THREE.Color("#fff1dc") }, uSunD: { value: sunDir.clone().normalize() }, uBand: { value: 6 }, uDisc: { value: 0.00012 } };
      const dome = new THREE.Mesh(once("skyGeo", () => new THREE.SphereGeometry(1, 64, 32)), new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, fog: false }));
      dome.scale.setScalar(1e7); dome.renderOrder = -3; dome.frustumCulled = false; dome.onBeforeRender = (r, s, cam) => dome.position.copy(cam.position); world.add(dome);
      const set = (zen, hor, low, band = 6) => { u.uZen.value.set(zen); u.uHor.value.set(hor); u.uLow.value.set(low); u.uBand.value = band; };
      // bake the dome (no disc: the sun light does that) into a prefiltered cube for reflections and ambient light
      const env = () => { const s = new THREE.Scene(), d = dome.clone(); d.material = dome.material.clone(); d.material.uniforms.uDisc = { value: 0 }; d.position.set(0, 0, 0); d.scale.setScalar(100); s.add(d); return pmrem.fromScene(s, 0, 1, 1000).texture; };
      return { dome, u, set, env };
    }
    // daytime sky over the ground: the dome, matching haze on the ground, and the sky's light
    function earthSky(sunDir, { zen = "#2f6cc0", hor = "#c6d9ec", low = "#b4c8da", near = 1500, far = 22000 } = {}) {
      const sky = skyDome(sunDir); sky.set(zen, hor, low);
      scene.background = null; scene.environment = sky.env();
      scene.fog = new THREE.Fog(new THREE.Color(hor).lerp(new THREE.Color(low), 0.4), near, far);
      hemi.color.set("#d6e6ff"); hemi.groundColor.set("#4a5a48"); hemi.intensity = 0.6;
      sun.color.set("#fff2df"); sun.intensity = 3.2;
      clouds(world, { n: 170, inner: 7000, outer: 34000, y0: 1000, y1: 2000, seed: 5 });
      return sky;
    }
    // fair-weather cumulus: flat-bottomed clusters of lit puffs scattered round the scene (or round a point on a planet:
    // `frame` = a matrix placing local +y up at the launch site)
    function clouds(parent, { n = 60, inner = 4000, outer = 25000, y0 = 1200, y1 = 2400, seed = 5, frame = null }) {
      const r = rng(seed), list = [], P = V3();
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = inner + (outer - inner) * Math.sqrt(r()), base = y0 + (y1 - y0) * r(), big = 350 + 650 * r() * r();
        const cx = Math.cos(a) * d, cz = Math.sin(a) * d, m = 2 + Math.floor(r() * 3);
        for (let j = 0; j < m; j++) {
          P.set(cx + (r() - 0.5) * big * 1.6, base + big * (0.35 + 0.5 * r()), cz + (r() - 0.5) * big * 1.6);
          if (frame) P.applyMatrix4(frame);
          list.push([P.x, P.y, P.z, big * (0.8 + 0.7 * r()), 0.9]);
        }
      }
      const field = particles({ n: list.length, color: "#ffffff", size: 1, grow: 1, drag: 0, rise: 0, gravity: 0, life: 1, opacity: 1, parent, haze: 3 });
      field.place(list);
      return field;
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
float f = pow(clamp(1.0 - dot(vN, vV), 0.0, 1.0), p); float day = smoothstep(-0.3, 0.3, dot(vW, sunW));
gl_FragColor = vec4(c * f * day, 1.0); }`,
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      });
    }
    // a textured planet, placed and turned by the flight each frame: put(v) puts its centre at v (m), shrunk (same angular
    // size) when far so it stays inside the depth range; spin.quaternion turns its ground. 512 segments keep the facets
    // within ~120 m of the true sphere, which the ground patches at the sites sit on.
    function planet(kind, { seg = 512 } = {}) {
      const R0 = kind === "earth" ? 6.371e6 : 1.7374e6;
      const g = new THREE.Group(); world.add(g);
      const spin = new THREE.Group(); g.add(spin);
      const sph = (r, s = seg) => new THREE.SphereGeometry(r, s, s / 2);
      const sunW = { value: V3(0, 1, 0) }, sunV = { value: V3(0, 1, 0) }, detailK = { value: 0 };
      let surf, cl = null;
      if (kind === "earth") {
        const mat = new THREE.MeshPhongMaterial({ map: img(PLANETS + "earth_atmos_4096.jpg", true), normalMap: img(PLANETS + "earth_normal_2048.jpg"), normalScale: new THREE.Vector2(0.9, 0.9), specularMap: img(PLANETS + "earth_specular_2048.jpg"), specular: new THREE.Color("#4a6680"), shininess: 22, emissiveMap: img(PLANETS + "earth_lights_2048.png", true), emissive: new THREE.Color("#ffcf8a").multiplyScalar(1.4) });
        // city lights only on the night side; close to the ground, two octaves of mottling break up the 10 km texels of the land
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.sunV = sunV; sh.uniforms.detailMap = { value: detailTex() }; sh.uniforms.detailK = detailK;
          sh.fragmentShader = sh.fragmentShader.replace("void main() {", "uniform vec3 sunV; uniform sampler2D detailMap; uniform float detailK;\nvoid main() {")
            .replace("#include <map_fragment>", "#include <map_fragment>\nfloat landK = detailK * (1.0 - texture2D(specularMap, vSpecularMapUv).r); /* the land, not the sea */\nif (landK > 0.001) { float f = texture2D(detailMap, vMapUv * vec2(3000.0, 1500.0)).r, c = texture2D(detailMap, vMapUv * vec2(400.0, 200.0)).g; diffuseColor.rgb *= mix(vec3(1.0), vec3(0.62 + 0.75 * f) * (0.72 + 0.6 * c) * vec3(1.35, 1.32, 1.18), landK); }")
            .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(0.1, -0.25, dot(normal, sunV));");
        };
        surf = new THREE.Mesh(sph(R0), mat);
        // the cloud layer sits 7.6 km up: from below it would read as an overcast smear, so it fades in above ~10 km
        cl = new THREE.Mesh(sph(R0 * 1.0012, 256), new THREE.MeshLambertMaterial({ map: img(PLANETS + "earth_clouds_2048.png", true), transparent: true, depthWrite: false }));
        spin.add(cl);
        g.add(new THREE.Mesh(sph(R0 * 1.0095, 256), rim(new THREE.Color(0.32, 0.6, 1.25).multiplyScalar(1.05), 3.6, sunW.value)));
      } else {
        const mt = img(PLANETS + "moon_1024.jpg", true);
        surf = new THREE.Mesh(sph(R0), new THREE.MeshStandardMaterial({ map: mt, bumpMap: mt, bumpScale: 2.5, roughness: 1, metalness: 0 }));
      }
      spin.add(surf);
      sunViews.push((dir) => { sunW.value.copy(dir); sunV.value.copy(dir).transformDirection(camera.matrixWorldInverse); });
      const put = (v) => { const kk = Math.min(1, 2.5e7 / v.length()); g.scale.setScalar(kk); g.position.copy(v).multiplyScalar(kk); };
      return { g, spin, R0, put, detail: (k) => (detailK.value = k), haze: (k) => { if (cl) { cl.material.opacity = k; cl.visible = k > 0.01; } } };
    }
    // mottled ground at two scales for low-altitude views of the planet (R: fine, G: coarse)
    const detailTex = () => once("detail", () => {
      const t = tex(512, 512, (g, w, h) => {
        const r = rng(91), N = 8, L = Array.from({ length: N * N }, r), sm5 = (x) => x * x * (3 - 2 * x);
        g.fillStyle = "rgb(128,0,0)"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) { const x = r() * w, y = r() * h, s = 2 + 18 * r() * r(), v = Math.floor(70 + 120 * r()); g.fillStyle = `rgba(${v},0,0,.5)`; g.beginPath(); g.ellipse(x, y, s, s * (0.4 + r()), r() * TAU, 0, TAU); g.fill(); }
        const d = g.getImageData(0, 0, w, h); // G: smooth tileable patches (value noise on an 8 x 8 grid)
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const fx = (x / w) * N, fy = (y / h) * N, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm5(fx - ix), ty = sm5(fy - iy), q = (i, j) => L[((i + N) % N) + ((j + N) % N) * N];
          const v = q(ix, iy) * (1 - tx) * (1 - ty) + q(ix + 1, iy) * tx * (1 - ty) + q(ix, iy + 1) * (1 - tx) * ty + q(ix + 1, iy + 1) * tx * ty;
          d.data[(y * w + x) * 4 + 1] = v * 255;
        }
        g.putImageData(d, 0, 0);
      }, [1, 1], false);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    });

    // open ocean: a wave-displaced patch near the action, a flat sheet out to the horizon, both with scrolling normal maps
    // (the swell is moved on the GPU; wave() is the same surface for things that float on it)
    function ocean(size = 3000, segs = 120, { parent = world, far = true } = {}) {
      const base = img("https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg"), uT = { value: 0 };
      const mk = (rep, swell) => {
        const n = base.clone(); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.repeat.set(rep, rep); n.needsUpdate = true;
        const m = new THREE.MeshStandardMaterial({ color: "#0a2a42", roughness: 0.07, metalness: 0, normalMap: n, normalScale: new THREE.Vector2(0.5, 0.5) });
        if (swell) m.onBeforeCompile = (sh) => {
          sh.uniforms.uT = uT;
          sh.vertexShader = sh.vertexShader.replace("void main() {", "uniform float uT;\nvoid main() {")
            .replace("#include <beginnormal_vertex>", "vec2 wq = position.xz; float wa = wq.x * 0.045 + uT * 1.1, wb = wq.y * 0.06 - uT * 0.8, wc = (wq.x + wq.y) * 0.13 + uT * 1.7;\nvec3 objectNormal = normalize(vec3(-(0.35 * 0.045 * cos(wa) + 0.12 * 0.13 * cos(wc)), 1.0, -(0.25 * 0.06 * cos(wb) + 0.12 * 0.13 * cos(wc))));\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(tangent.xyz);\n#endif")
            .replace("#include <begin_vertex>", "vec3 transformed = vec3(position); transformed.y += 0.35 * sin(wa) + 0.25 * sin(wb) + 0.12 * sin(wc);");
        };
        return m;
      };
      const near = mesh(new THREE.PlaneGeometry(size, size, segs, segs).rotateX(-Math.PI / 2), mk(size / 30, true), parent);
      const fm = far ? mesh(new THREE.PlaneGeometry(400000, 400000).rotateX(-Math.PI / 2), mk(400000 / 60, false), parent, 0, -0.6, 0) : null;
      near.castShadow = false; if (fm) fm.castShadow = false;
      const wave = (x, z, c) => 0.35 * Math.sin(x * 0.045 + c * 1.1) + 0.25 * Math.sin(z * 0.06 - c * 0.8) + 0.12 * Math.sin((x + z) * 0.13 + c * 1.7);
      return {
        wave, near, far: fm, mk,
        update(c) { uT.value = c; near.material.normalMap.offset.set(c * 0.012, c * 0.007); if (fm) fm.material.normalMap.offset.set(c * 0.004, c * 0.002); },
      };
    }

    // ---- vehicles. The launch vehicles and Crew Dragon come from models.mjs; the rest are below (metres; root origin
    // = base / heat shield unless noted)
    const MOD = makeModels({ THREE, X, V3, UP, TAU, D2R, std, mesh, cyl, lathe, box, rod, tex, once, rng, exhaust, thrusters, lunarModule });
    const { falcon9Booster, crewDragon, f9Stack, superHeavy, starshipShip, starshipStack, apolloCM, apolloCSM, saturnV, orionCM, orionStack, slsStack } = MOD;
    // capsules: heat shield at y = 0 facing -y; `top` = docking interface / parachute attach height
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
      // landing gear: the main strut, its side brace, the footpad and (on three legs) the contact probe, folded against the
      // descent stage for the ride in the adapter and swung out in lunar orbit; legs(k): 0 folded .. 1 down
      const span = (m, A, B) => { m.position.copy(A).add(B).multiplyScalar(0.5); m.scale.set(1, A.distanceTo(B), 1); m.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize()); };
      const strut = (r) => once("lmStrut" + r, () => new THREE.CylinderGeometry(r, r, 1, 10));
      const gear = [0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        return { c: Math.cos(a), s: Math.sin(a), main: mesh(strut(0.09), gold, desc), aux: mesh(strut(0.06), grey, desc), pad: mesh(once("lmPad", () => new THREE.CylinderGeometry(0.47, 0.4, 0.2, 20)), grey, desc), probe: i === 1 ? null : mesh(once("lmProbe", () => new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6).translate(0, -0.8, 0)), grey, desc) };
      });
      const legs = (k) => gear.forEach(({ c, s, main, aux, pad, probe }) => {
        const fr = 2.35 + 1.95 * k, fy = 1.1 - 0.9 * k, F = V3(c * fr, fy, s * fr);
        span(main, V3(c * 1.9, 3.1, s * 1.9), F); span(aux, V3(c * 1.9, 1.7, s * 1.9), V3(c * (fr - 1), fy + 0.9, s * (fr - 1)));
        pad.position.set(F.x, fy - 0.1, F.z);
        if (probe) { probe.position.set(F.x, fy - 0.15, F.z); probe.visible = k > 0.98; }
      });
      legs(folded ? 0 : 1);
      const probes = gear.map((l) => l.probe).filter(Boolean);
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
      return { root, desc, asc, fire, afire, rcs, legs, probes: (hh) => probes.forEach((p) => (p.scale.y = Math.min(1, Math.max(0.02, (hh + 0.05) / 1.6)))) };
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

    // ---- entry plasma. F = the downstream direction (world), set every frame as the craft turns
    const LOGV = "#include <common>\n#include <logdepthbuf_pars_vertex>\n", LOGF = "#include <common>\n#include <logdepthbuf_pars_fragment>\n";
    // ribbons of glowing gas that peel off the windward edges and stream downstream, white-hot at the hull, cooling to c2;
    // seeds are points and outward directions on the hull in `parent`'s frame, so the ribbons ride along with it
    function streaks(seeds, { parent = world, len, spread, w, c1, c2, per = 2, k = 3 }) {
      const S = 28, pos = [], out = [], uu = [], side = [], seed = [], idx = [];
      let v = 0;
      for (const sd of seeds) for (let j = 0; j < per; j++) {
        const r = Math.random();
        for (let i = 0; i <= S; i++) for (const sg of [-1, 1]) { pos.push(sd.p.x, sd.p.y, sd.p.z); out.push(sd.out.x, sd.out.y, sd.out.z); uu.push((i / S) ** 1.6); side.push(sg); seed.push(r); }
        for (let i = 0; i < S; i++) { const a = v + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        v += (S + 1) * 2;
      }
      const geo = new THREE.BufferGeometry(), at = (n, a, c) => geo.setAttribute(n, new THREE.Float32BufferAttribute(a, c));
      at("position", pos, 3); at("aOut", out, 3); at("aU", uu, 1); at("aSide", side, 1); at("aSeed", seed, 1); geo.setIndex(idx);
      const uni = { uF: { value: V3(-1, 0, 0) }, uLen: { value: len }, uSpread: { value: spread }, uW: { value: w }, uT: { value: 0 }, uP: { value: 1 }, uC1: { value: new THREE.Color(c1).multiplyScalar(k) }, uC2: { value: new THREE.Color(c2).multiplyScalar(k) } };
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: LOGV + `attribute vec3 aOut; attribute float aU, aSide, aSeed;
uniform vec3 uF; uniform float uLen, uSpread, uW, uT;
varying float vU, vS, vSeed;
vec3 sn(vec3 v) { float l = length(v); return l > 1e-5 ? v / l : vec3(0.0, 1.0, 0.0); }
void main() {
  float u = aU, l = uLen * (0.45 + 0.8 * aSeed);
  vec3 o = sn(mat3(modelMatrix) * aOut), cr = sn(cross(uF, o));
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz + uF * l * u + o * uSpread * pow(max(u, 1e-4), 1.3) * (0.4 + aSeed)
         + cr * sin(u * 5.0 + aSeed * 40.0 + uT * 2.5) * uSpread * 0.18 * u;
  vec3 sd = sn(cross(uF, sn(cameraPosition - p)));
  p += sd * aSide * uW * (0.3 + 1.6 * u) * (0.5 + 0.8 * aSeed);
  vU = u; vS = aSide; vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
#include <logdepthbuf_vertex>
}`,
        fragmentShader: LOGF + `uniform vec3 uC1, uC2; uniform float uT, uP; varying float vU, vS, vSeed;
void main() {
#include <logdepthbuf_fragment>
  float edge = max(0.0, 1.0 - vS * vS);
  float fade = pow(clamp(1.0 - vU, 0.0, 1.0), 2.4) * smoothstep(0.0, 0.03, vU);
  float st = 0.8 + 0.2 * sin(vU * 9.0 - uT * 14.0 + vSeed * 60.0);
  vec3 col = mix(vec3(max(uC1.r, max(uC1.g, uC1.b))) * 1.2, uC1, smoothstep(0.0, 0.12, vU));
  col = mix(col, uC2, smoothstep(0.12, 0.75, vU));
  gl_FragColor = vec4(col * edge * fade * st * uP * (0.6 + 0.4 * vSeed), 1.0);
}`,
      }));
      m.frustumCulled = false; parent.add(m);
      return (p, t, F) => { uni.uP.value = p; uni.uT.value = t; m.visible = p > 0.01; if (F) uni.uF.value.copy(F); };
    }
    // a thin glowing layer just off a hull surface: brightest where it faces the flow and at its silhouette
    function hotShell(src, c, k = 2.5, d = 0.25) {
      const g = src.geometry.clone(), P = g.attributes.position, N = g.attributes.normal;
      for (let i = 0; i < P.count; i++) if (Number.isFinite(N.getX(i) + N.getY(i) + N.getZ(i))) P.setXYZ(i, P.getX(i) + N.getX(i) * d, P.getY(i) + N.getY(i) * d, P.getZ(i) + N.getZ(i) * d);
      const uni = { uF: { value: V3(-1, 0, 0) }, uC: { value: new THREE.Color(c).multiplyScalar(k) }, uP: { value: 1 }, uT: { value: 0 } };
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: LOGV + `varying vec3 vN, vV, vW;
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vec3 n = mat3(modelMatrix) * normal; vN = length(n) > 1e-5 ? normalize(n) : vec3(0.0, 1.0, 0.0); vW = wp.xyz; vV = normalize(cameraPosition - wp.xyz);
gl_Position = projectionMatrix * viewMatrix * wp;
#include <logdepthbuf_vertex>
}`,
        fragmentShader: LOGF + `uniform vec3 uF, uC; uniform float uP, uT; varying vec3 vN, vV, vW;
void main() {
#include <logdepthbuf_fragment>
  float wind = smoothstep(-0.2, 0.8, dot(vN, -uF));
  float fr = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 2.2);
  float fl = 0.85 + 0.15 * sin(dot(vW, vec3(2.1, 3.3, 1.7)) + uT * 18.0);
  gl_FragColor = vec4(uC * wind * wind * (0.03 + 2.6 * fr * fr * fr) * fl * uP, 1.0);
}`,
      }));
      m.position.copy(src.position); m.rotation.copy(src.rotation); m.scale.copy(src.scale); src.parent.add(m);
      return (p, t, F) => { uni.uP.value = p; uni.uT.value = t; m.visible = p > 0.01; if (F) uni.uF.value.copy(F); };
    }
    // capsule entry: a shock layer on the heat shield (cap: the capsule's root, heat shield at y = 0 facing -y), ribbons off
    // its rim and ablation sparks streaming downstream. Returns set(p 0..1, clock, F downstream)
    function plasma(cap, R, len, hot) {
      const shock = mesh(new THREE.SphereGeometry(R * 1.12, 64, 16, 0, TAU, Math.PI / 2, Math.PI / 2), glow(hot, 2.6, { opacity: 0.8 }), cap, 0, -0.08, 0); shock.scale.y = 0.3; shock.castShadow = false;
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(hot).multiplyScalar(1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); core.scale.setScalar(R * 3.2); core.position.y = -0.3; cap.add(core);
      const seeds = [];
      for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU; seeds.push({ p: V3(Math.cos(a) * R, 0.08, Math.sin(a) * R), out: V3(Math.cos(a), 0, Math.sin(a)) }); }
      const tr = streaks(seeds, { parent: cap, len: len * 2.4, spread: R * 1.8, w: R * 0.06, c1: hot, c2: "#ff3d7a", per: 1, k: 1.1 });
      const N = 500, pos = new Float32Array(N * 3), ph = Array.from({ length: N }, () => [Math.random(), Math.random() * TAU, 1 + Math.random()]);
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color("#ffc890").multiplyScalar(3), size: R * 0.07, map: dotTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const flow = new THREE.Group(); world.add(flow); flow.add(sparks); sparks.frustumCulled = false; // +y downstream, at the capsule
      return (p, c, F) => {
        for (const m of [shock, core, sparks]) m.visible = p > 0.01;
        tr(p, c, F);
        if (p <= 0.01) return;
        const f = 0.92 + 0.08 * Math.random();
        shock.material.opacity = 0.8 * p * f; core.material.opacity = 0.7 * p * f;
        cap.getWorldPosition(flow.position); flow.quaternion.setFromUnitVectors(UP, F);
        for (let i = 0; i < N; i++) { const [a, b, sp] = ph[i], u = (a + c * 0.9 * sp) % 1, rr = R * (1.05 + 1.6 * u) * (0.6 + 0.4 * Math.sin(b * 7)); pos.set([Math.cos(b + u) * rr, u * len * 1.6, Math.sin(b + u) * rr], i * 3); }
        geo.attributes.position.needsUpdate = true;
      };
    }

    // ---- shared pieces of the sites
    function usFlag(parent, x, z) {
      const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
      rod([0, 0, 0], [0, 2.4, 0], 0.025, std("#ddd"), g); rod([0, 2.35, 0], [1.2, 2.35, 0], 0.015, std("#ddd"), g);
      const ft = once("usflag", () => tex(190, 100, (c, w, hh) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? "#fff" : "#b22234"; c.fillRect(0, (i * hh) / 13, w, hh / 13 + 1); } c.fillStyle = "#3c3b6e"; c.fillRect(0, 0, w * 0.4, (hh * 7) / 13); c.fillStyle = "#fff"; for (let i = 0; i < 50; i++) c.fillRect(4 + (i % 10) * 7.4, 3 + Math.floor(i / 10) * 10.5, 2, 2); }));
      mesh(new THREE.PlaneGeometry(1.2, 0.75), std("#ffffff", { map: ft, side: THREE.DoubleSide }), g, 0.6, 1.97, 0);
      return g;
    }
    // Starbase's orbital launch mount and tower, the chopsticks opening toward +z; returns their setter (radians open)
    function mountTower(parent) {
      box(110, 0.4, 110, std("#a9abad", { roughness: 0.9 }), parent, 0, 0.2, -10);
      const grey = std("#5d6268", { roughness: 0.5, metalness: 0.4 });
      mesh(new THREE.CylinderGeometry(9.5, 9.5, 3, 40), grey, parent, 0, 19.5, 0); // orbital launch mount
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; box(2.6, 18, 2.6, std("#8e9194"), parent, Math.cos(a) * 8.5, 9, Math.sin(a) * 8.5); }
      const lat = once("tower", () => tex(128, 128, (g, w, hh) => { g.strokeStyle = "#fff"; g.lineWidth = 9; g.strokeRect(0, 0, w, hh); g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, hh); g.moveTo(w, 0); g.lineTo(0, hh); g.stroke(); }, [1, 12]));
      box(12, 146, 12, std("#6e7379", { map: lat, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 }), parent, 0, 73, -22).castShadow = false;
      box(3, 146, 3, std("#3a3d42"), parent, 0, 73, -22);
      box(13.6, 5, 13.6, grey, parent, 0, 99.5, -22);
      for (let y = 20; y < 146; y += 18) box(12.3, 0.4, 12.3, grey, parent, 0, y, -22);
      const arms = [-1, 1].map((sd) => { const pv = new THREE.Group(); pv.position.set(sd * 6, 99.75, -16); parent.add(pv); box(1.6, 2.5, 36, std("#3a3d42", { metalness: 0.5, roughness: 0.5 }), pv, 0, 0, 18); box(0.4, 0.4, 34, std("#d0d0d0"), pv, -sd * 0.9, 1.4, 18); return [pv, sd]; });
      return (a) => arms.forEach(([pv, sd]) => (pv.rotation.y = -sd * a));
    }
    // Starbase for the booster catch: sand, the Gulf to the east, the mount and tower
    function starbase() {
      const sand = mesh(new THREE.PlaneGeometry(100000, 50000).rotateX(-Math.PI / 2), std("#c8b48e", { roughness: 1 }), world, 0, 0, -24300);
      sand.castShadow = false;
      const o = ocean(2000, 60); o.near.position.z = 26000; o.far.position.z = 200700; // sea to the east
      return { arms: mountTower(world), sea: o };
    }

    // ================================================================ launch sites, built in the site's own frame (metres, +y
    // up, +x along the launch heading, the pad at x = z = 0). Each returns the deck the stack stands on, the height its steam
    // rolls out at, a setter for its swing arms (k = 0 docked .. 1 away), its ground and the coast: the sea lies beyond
    // `coast` m toward azimuth `coastAz`
    const latM = (col, nx, ny) => std(col, { map: once("lat" + nx + "x" + ny, () => tex(128, 128, (g, w, hh) => { g.strokeStyle = "#fff"; g.lineWidth = 10; g.strokeRect(0, 0, w, hh); g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, hh); g.moveTo(w, 0); g.lineTo(0, hh); g.stroke(); }, [nx, ny])), alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.45, roughness: 0.5 });
    function truss(parent, x, z, w, h, col, y0 = 0, deck = 7) {
      const m = box(w, h, w, latM(col, Math.max(1, Math.round(w / 4)), Math.round(h / 4)), parent, x, y0 + h / 2, z); m.castShadow = true;
      const cm = std(col, { metalness: 0.45, roughness: 0.5 });
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) box(0.7, h, 0.7, cm, parent, x + sx * (w / 2 - 0.35), y0 + h / 2, z + sz * (w / 2 - 0.35));
      for (let y = y0 + deck; y < y0 + h - 1; y += deck) box(w + 0.8, 0.35, w + 0.8, std("#5d6064", { metalness: 0.5, roughness: 0.5 }), parent, x, y, z);
      return m;
    }
    // an arm from the tower face toward the vehicle, pivoting at the tower: swing(k) turns it away
    function swingArm(parent, x, y, z, len, col, w = 2.4) {
      const pv = new THREE.Group(); pv.position.set(x, y, z); parent.add(pv);
      box(w, w * 0.9, len, latM(col, 1, Math.max(1, Math.round(len / 3))), pv, 0, 0, len / 2);
      box(w * 0.4, 0.25, len, std("#4d5055"), pv, 0, -w * 0.4, len / 2);
      return (k, sd = 1) => (pv.rotation.y = sd * k * 1.35);
    }
    // the raised pad (hardstand) and its flame trench, the sound-suppression water tower behind
    function hardstand(S, hard = 14) {
      const con = std("#ffffff", { map: once("conc", () => tex(256, 256, (g, w, hh) => { g.fillStyle = "#b9b6ae"; g.fillRect(0, 0, w, hh); const r = rng(43); for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${0.06 * r()})`; g.fillRect(r() * w, r() * hh, 3 + 9 * r(), 3 + 9 * r()); } g.strokeStyle = "rgba(0,0,0,.15)"; g.strokeRect(0, 0, w, hh); }, [20, 20])), roughness: 0.95 });
      mesh(new THREE.CylinderGeometry(85, 125, hard, 4, 1).rotateY(Math.PI / 4), con, S, 0, hard / 2, 0).castShadow = false;
      box(120, 0.3, 14, std("#2a2826", { roughness: 1 }), S, 0, hard + 0.05, 0).castShadow = false;
      const wt = new THREE.Group(); wt.position.set(-230, 0, -260); S.add(wt);
      for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; rod([Math.cos(a) * 9, 0, Math.sin(a) * 9], [Math.cos(a) * 5, 70, Math.sin(a) * 5], 0.5, std("#d9d9d4"), wt); }
      mesh(new THREE.SphereGeometry(10, 32, 16), std("#efefea", { roughness: 0.5 }), wt, 0, 78, 0);
      return hard;
    }
    // LC-39A in the 2020s for Falcon 9: the fixed service structure with the crew access arm, the transporter-erector
    function padF9(S) {
      const deck = hardstand(S) + 4;
      box(16, 4, 16, std("#8d9095", { metalness: 0.4, roughness: 0.6 }), S, 0, deck - 2, 0);
      for (const [x, z] of [[2.3, 0], [-2.3, 0], [0, 2.3], [0, -2.3]]) box(0.8, 3, 0.8, std("#3a3d42"), S, x, deck + 1.0, z); // hold-downs
      truss(S, 0, -24, 10, 87, "#8e9398", deck - 4);
      box(4, 26, 4, std("#8e9398"), S, 0, deck + 83 + 13, -24); // lightning mast
      const caa = swingArm(S, -3, deck + 66.2, -19, 15, "#d8d8d4", 2.6);
      const te = new THREE.Group(); te.position.set(0, deck, -6.5); te.rotation.x = -0.21; S.add(te);
      box(3.6, 70, 2.2, latM("#2e3034", 1, 18), te, 0, 35, 0); box(1, 70, 1, std("#2e3034"), te, 0, 35, -0.6);
      return { deck, smokeY: 15, arms: (k) => caa(0.85 + 0.15 * k, -1), land: "grass", coast: 1600, coastAz: 70 }; // the access arm is already swung back for launch
    }
    // LC-39A in July 1969: the Mobile Launcher with its red umbilical tower, nine swing arms and the hammerhead crane
    function padSaturn(S) {
      const hard = hardstand(S), deck = hard + 6.5 + 7.6;
      for (const [x, z] of [[-18, -14], [18, -14], [-18, 14], [18, 14], [-18, 0], [18, 0]]) box(3, 6.5, 3, std("#8a8c8f"), S, x, hard + 3.25, z);
      box(49, 7.6, 41, std("#7d8084", { roughness: 0.7, metalness: 0.3 }), S, 0, hard + 6.5 + 3.8, -4);
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; box(1.2, 2.4, 1.2, std("#3a3d42"), S, Math.cos(a) * 5.6, deck + 1.2, Math.sin(a) * 5.6); }
      truss(S, 0, -18, 12, 120, "#b33b25", deck);
      box(28, 3, 3, std("#b33b25"), S, 6, deck + 121.5, -18); // hammerhead crane
      const arms = [[19, 9], [30, 9], [55, 9], [63, 9], [76, 9], [84, 9], [92, 11], [97, 12.8], [103, 12.2]].map(([y, len]) => swingArm(S, 0, deck + y, -12, len - 3.5, "#9c3424", 2.4));
      return { deck, smokeY: 15, arms: (k) => arms.forEach((f, i) => f(i === 8 ? 1 : k, i % 2 ? 1 : -1)), land: "grass", coast: 1600, coastAz: 70 };
    }
    // LC-39B in 2026: Mobile Launcher 1 with the crew access arm, three lightning towers round the pad
    function padSLS(S) {
      const hard = hardstand(S), deck = hard + 6.5 + 7.6;
      for (const [x, z] of [[-18, -14], [18, -14], [-18, 14], [18, 14], [-18, 0], [18, 0]]) box(3, 6.5, 3, std("#8a8c8f"), S, x, hard + 3.25, z);
      box(50, 7.6, 41, std("#6f7276", { roughness: 0.7, metalness: 0.3 }), S, 0, hard + 6.5 + 3.8, -4);
      truss(S, 0, -19, 12, 112, "#9aa0a6", deck);
      const caa = swingArm(S, 0, deck + 84, -13, 9, "#e9e9e6", 2.8);
      const um = [[60, 7], [70, 9], [76, 11]].map(([y, len]) => swingArm(S, 0, deck + y, -13, len, "#7d8288", 2));
      for (const [x, z] of [[-120, -110], [130, -60], [0, 150]]) { truss(S, x, z, 5, 180, "#c9ccd0", hard, 15); }
      const wire = new THREE.LineBasicMaterial({ color: "#555" });
      for (const [a, b] of [[[-120, 198, -110], [130, 198, -60]], [[130, 198, -60], [0, 198, 150]], [[0, 198, 150], [-120, 198, -110]]]) { const pts = []; for (let i = 0; i <= 20; i++) { const f = i / 20; pts.push(V3(a[0] + (b[0] - a[0]) * f, a[1] - 40 * Math.sin(f * Math.PI), a[2] + (b[2] - a[2]) * f)); } S.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire)); }
      return { deck, smokeY: 15, arms: (k) => { caa(1, -1); um.forEach((f, i) => f(k, i % 2 ? 1 : -1)); }, land: "grass", coast: 1400, coastAz: 70 };
    }
    // Starbase: the mount and tower turned so the chopsticks open toward -x, where the ship comes back from
    function padStarbase(S) {
      const g = new THREE.Group(); g.rotation.y = -Math.PI / 2; S.add(g);
      const arms = mountTower(g); arms(32 * D2R);
      return { deck: 21, smokeY: 1, arms: () => {}, catchArms: arms, land: "sand", coast: 900, coastAz: 90 };
    }
    // the ground round a site, curved to its globe (radius R), fading out into it between 0.55 r and r: `land` (grass or
    // sand) up to a straight coast = [cx, cz, d] (the sea where x·cx + z·cz > d, site frame) and the sea beyond, with a hole
    // of radius `inner` for a closer patch; lifted `lift` m so the globe's facets never show through
    function siteGround(S, { R = 6.371e6, r = 30000, land = "grass", coast = [1, 0, 1e9], inner = 0, lift = 1 }) {
      const N = 150, geo = new THREE.PlaneGeometry(2, 2, N, N).rotateX(-Math.PI / 2), p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i), w = p.getZ(i), x = r * u * (0.03 + 0.97 * u * u), z = r * w * (0.03 + 0.97 * w * w);
        p.setXYZ(i, x, lift - (x * x + z * z) / (2 * R), z); uv.setXY(i, x / (2 * r) + 0.5, z / (2 * r) + 0.5);
      }
      geo.computeVertexNormals();
      const mask = (m, wet) => {
        m.transparent = true;
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uCoast = { value: new THREE.Vector3(...coast) }; sh.uniforms.uRim = { value: new THREE.Vector3(r * 0.55, r, inner) };
          sh.vertexShader = sh.vertexShader.replace("void main() {", "varying vec2 vSite;\nvoid main() {\nvSite = position.xz;");
          sh.fragmentShader = sh.fragmentShader.replace("void main() {", "uniform vec3 uCoast, uRim; varying vec2 vSite;\nvoid main() {")
            .replace("#include <alphamap_fragment>", `#include <alphamap_fragment>
float cst = smoothstep(-30.0, 30.0, dot(vSite, uCoast.xy) - uCoast.z), dd = length(vSite);
diffuseColor.a *= (1.0 - smoothstep(uRim.x, uRim.y, dd)) * (uRim.z > 0.0 ? smoothstep(uRim.z * 0.85, uRim.z, dd) : 1.0) * ${wet ? "cst" : "(1.0 - cst)"};`);
        };
        return m;
      };
      let sea = null;
      if (land) mesh(geo, mask(land === "grass" ? std("#ffffff", { map: once("grass", () => tex(512, 512, (g, w, hh) => { g.fillStyle = "#4f6334"; g.fillRect(0, 0, w, hh); const q = rng(41); for (let i = 0; i < 9000; i++) { const c = q(); g.fillStyle = c < 0.5 ? "rgba(40,60,25,.4)" : "rgba(120,130,80,.25)"; g.fillRect(q() * w, q() * hh, 2 + 8 * q(), 2 + 8 * q()); } }, [300, 300])), roughness: 1 }) : std("#c8b48e", { roughness: 1 }), false), S).castShadow = false;
      if (coast[2] < r) {
        const n = img("https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg").clone(); n.wrapS = n.wrapT = THREE.RepeatWrapping; n.repeat.set(r / 30, r / 30); n.needsUpdate = true;
        sea = mask(new THREE.MeshStandardMaterial({ color: "#0a2a42", roughness: 0.07, metalness: 0, normalMap: n, normalScale: new THREE.Vector2(0.5, 0.5) }), true);
        mesh(geo, sea, S).castShadow = false;
      }
      return { sea };
    }
    // the Moon's ground round the landing site: many small craters near it, a few big ones far out, flattened where Eagle
    // sets down, curved to the Moon and faded out into the globe; the ground at the site sits 1.5 m above the true sphere
    function moonGround(S, R = 1.7374e6) {
      const r = rng(7), cr = [];
      for (let i = 0; i < 280; i++) cr.push([(r() - 0.5) * 3000, (r() - 0.5) * 3000, 3 + 40 * r() ** 2]);
      for (let i = 0; i < 160; i++) cr.push([(r() - 0.5) * 30000, (r() - 0.5) * 30000, 40 + 700 * r() ** 3]);
      const height = (x, z) => {
        let y = 4 * Math.sin(x / 700) * Math.cos(z / 900) + 1.2 * Math.sin(x / 170 + z / 230) + 0.25 * Math.sin(x / 9.3) * Math.sin(z / 11.7);
        for (const [cx, cz, cr0] of cr) { const d2 = (x - cx) ** 2 + (z - cz) ** 2; if (d2 > 2.2 * cr0 * cr0) continue; const q = Math.sqrt(d2) / cr0; y += cr0 * 0.16 * ((q < 1 ? q * q - 1 : 0) + 0.35 * Math.exp(-(((q - 1) / 0.22) ** 2))); }
        return y * sm(20, 160, Math.hypot(x, z));
      };
      const N = 300, Sz = 22000, geo = new THREE.PlaneGeometry(2, 2, N, N).rotateX(-Math.PI / 2), p = geo.attributes.position, col = new Float32Array(p.count * 3), uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i), w = p.getZ(i), x = Sz * u * (0.02 + 0.98 * u * u), z = Sz * w * (0.02 + 0.98 * w * w); // dense near the site, sparse far out
        p.setXYZ(i, x, 1.5 + height(x, z) - (x * x + z * z) / (2 * R), z); uv.setXY(i, x / 40, z / 40);
        const c = 0.5 + 0.07 * ((((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1);
        col.set([c, c, c * 0.97], i * 3);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const regolith = once("regolith", () => tex(512, 512, (g, w, hh) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, hh); const q = rng(31); for (let i = 0; i < 6000; i++) { const c = 100 + 70 * q(); g.fillStyle = `rgb(${c},${c},${c})`; g.beginPath(); g.arc(q() * w, q() * hh, 0.6 + 2.5 * q() ** 3, 0, TAU); g.fill(); } for (let i = 0; i < 40; i++) { const x = q() * w, y = q() * hh, rr = 4 + 14 * q(); g.strokeStyle = "rgba(60,60,60,.5)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke(); } }, [1, 1], false));
      regolith.wrapS = regolith.wrapT = THREE.RepeatWrapping;
      const m = std("#ffffff", { vertexColors: true, roughness: 1, bumpMap: regolith, bumpScale: 3, transparent: true });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace("void main() {", "varying vec2 vSite;\nvoid main() {\nvSite = position.xz;");
        sh.fragmentShader = sh.fragmentShader.replace("void main() {", "varying vec2 vSite;\nvoid main() {").replace("#include <alphamap_fragment>", `#include <alphamap_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(${(Sz * 0.5).toFixed(1)}, ${Sz.toFixed(1)}, length(vSite));`);
      };
      mesh(geo, m, S).castShadow = false;
    }
    // the splashdown sea: a swell that things float on round the capsule, open water out to the horizon, the recovery ship;
    // the water surface is 1.2 m above the site's origin
    function seaPatch(S, shipCol) {
      const o = ocean(1600, 100, { parent: S, far: false }); o.near.position.y = 1.2;
      const far = siteGround(S, { land: null, coast: [1, 0, -1e9], inner: 760 });
      const boat = new THREE.Group(); S.add(boat);
      box(70, 9, 15, std(shipCol), boat, 0, 2, 0); box(18, 12, 12, std("#e8e8e8"), boat, 20, 10, 0); box(22, 1, 14, std("#8a8f96"), boat, -22, 6.8, 0);
      return { wave: o.wave, update(c) { o.update(c); far.sea.normalMap.offset.set(c * 0.004, c * 0.002); },
        // the ship steams in after splashdown and stops alongside
        ship(after) { const k = sm(30, 1400, after); boat.position.set(-500 + 470 * k, 1.2, -650 + 610 * k); boat.rotation.y = 0.7 + 0.5 * k; } };
    }
    // splashdown: a burst of spray and a ring of foam spreading on the water (sea site frame)
    function splashFx(S, R) {
      const spray = particles({ color: "#f2f6fa", size: 1.6, drag: 0.6, rise: 0, gravity: 9.8, life: 3, opacity: 0.6, n: 3000, parent: S });
      const foam = mesh(new THREE.RingGeometry(1.15, 1.6, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }), S, 0, 1.4, 0);
      foam.castShadow = false;
      let burst = false;
      return {
        reset() { spray.reset(); burst = false; },
        step(dt, after) { // after: s since splashdown (negative before)
          if (after > 0 && after < 2 && !burst) { burst = true; spray.step(dt || 0.016, { x: 0, y: 1.2, z: 0, r0: R, rate: 0, burst: 1400, speed: 9, up: 11 }); }
          if (after < 0) burst = false;
          spray.step(dt, { x: 0, y: 1.2, z: 0, r0: R, rate: 0, speed: 8, up: 8 });
          foam.material.opacity = after > 0 ? 0.55 * (1 - sm(0, 14, after)) : 0; foam.scale.setScalar(R * (1 + Math.max(0, after) * 0.9)); foam.visible = after > 0 && after < 14;
        },
      };
    }

    // ---- the sky by altitude: the dome darkening to black, haze over the ground, stars fading in, image light switched
    // from day sky to black space
    // the dome's colours by altitude (km): zenith, horizon haze, how tight the horizon band is
    const SKYC = [[0, "#2f6cc0", "#c6d9ec", 6], [6, "#2457a8", "#a9c5e4", 8], [15, "#123574", "#6f97c8", 12], [30, "#061a42", "#3c639a", 20], [55, "#010612", "#1a3358", 34], [90, "#000000", "#060c18", 60]];
    function atmo(sunDir) {
      const sky = skyDome(sunDir);
      sky.set(SKYC[0][1], SKYC[0][2], "#b4c8da"); const envD = sky.env();
      sky.set("#000000", "#0a1830", "#284a74", 40); const envN = sky.env();
      const st = new THREE.Mesh(new THREE.SphereGeometry(4e7, 64, 32), new THREE.MeshBasicMaterial({ map: stars(), side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }));
      st.renderOrder = -2; world.add(st);
      const fogC = new THREE.Color(), zen = new THREE.Color(), hor = new THREE.Color(), tmp = new THREE.Color();
      scene.background = null; scene.fog = new THREE.Fog(fogC, 1, 1e12);
      const set = (alt, earth = true) => { // alt in km
        let i = 1; while (i < SKYC.length - 1 && alt > SKYC[i][0]) i++;
        const [a, za, ha, ba] = SKYC[i - 1], [b, zb, hb, bb] = SKYC[i], q = earth ? Math.min(1, Math.max(0, (alt - a) / (b - a))) : 1;
        zen.set(earth ? za : "#000").lerp(tmp.set(earth ? zb : "#000"), q); hor.set(earth ? ha : "#000").lerp(tmp.set(earth ? hb : "#000"), q);
        sky.u.uZen.value.copy(zen); sky.u.uHor.value.copy(hor); sky.u.uLow.value.copy(hor).multiplyScalar(0.85); sky.u.uBand.value = earth ? ba + (bb - ba) * q : 60;
        const k = earth ? Math.min(1, Math.max(0, alt / 70)) : 1;
        fogC.copy(hor);
        scene.fog.near = 0; scene.fog.far = earth && alt < 90 ? 6e4 + alt * 2.5e4 + alt * alt * 1500 : 1e12; // aerial haze over the ground below
        st.material.opacity = earth ? Math.min(1, Math.max(0, (alt - 25) / 45)) : 1;
        scene.environment = k < 0.55 ? envD : envN;
        hemi.color.set(k < 0.55 ? "#d6e6ff" : "#000"); hemi.groundColor.set(k < 0.55 ? "#4a5a48" : "#284a74"); hemi.intensity = 0.6 - 0.25 * k;
        sun.intensity = 3.2 + 0.4 * k;
      };
      set.dome = sky;
      return set;
    }

    // ---- staging: a part that comes loose at t drifts away in the stack's frame. sep = [t, part, { v (m/s along the
    // stack axis, + = forward), a (m/s², relative), side [x, z] m/s, spin [x, y, z] rad/s, hide (s), after(u, obj) }]
    function stager(stk, list) {
      const home = new Map();
      for (const [, p] of list) { const o = stk.parts[p]; home.set(p, { pos: o.position.clone(), rot: o.rotation.clone() }); }
      return (t) => {
        for (const [t0, p, o = {}] of list) {
          const ob = stk.parts[p], h = home.get(p), u = t - t0;
          ob.position.copy(h.pos); ob.rotation.copy(h.rot);
          if (u <= 0) { ob.visible = true; continue; }
          ob.visible = u < (o.hide ?? 60);
          const along = (o.v ?? -1) * u + 0.5 * (o.a ?? -12) * u * u, sd = o.side || [0, 0], sp = o.spin || [0, 0, 0];
          ob.position.x += sd[0] * u; ob.position.y += along; ob.position.z += sd[1] * u;
          if (o.pivot !== undefined) { // tumble round the part's own middle, `pivot` m up its axis
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(sp[0] * u, sp[1] * u, sp[2] * u)), c = ob.position.clone(); c.y += o.pivot;
            ob.quaternion.premultiply(q); ob.position.copy(c).add(V3(0, -o.pivot, 0).applyQuaternion(q));
          } else ob.rotation.set(h.rot.x + sp[0] * u, h.rot.y + sp[1] * u, h.rot.z + sp[2] * u);
          if (o.after) o.after(u, ob);
        }
      };
    }

    // ================================================================ the flight: the whole mission as one unbroken shot
    // The craft stays at the world origin and the world is placed round it every frame. Its frame: +y away from the body it
    // is nearest, +x along its motion (every orbit on the mission map runs anticlockwise), +z = x × y. The globe below turns
    // as the craft's angle round it changes (the table at the top), the other body sits where the map puts it, and the
    // launch site, the Moon landing site and the splashdown sea are fixed to their globes' ground: the pad falls away under
    // the rocket, the Moon comes up under Eagle, the sea comes up to meet the capsule.
    const spotDir = ([u, v]) => { const ph = u * TAU, th = (1 - v) * Math.PI; return V3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)); };
    // a site's frame on its globe (sphere coordinates): +y up, +x along heading az (rad east of north), origin R + h out
    function spotFrame(sp, az, R, h = 0) {
      const P = spotDir(sp), N = V3(0, 1, 0).addScaledVector(P, -P.y).normalize(), E = N.clone().cross(P);
      const D = N.multiplyScalar(Math.cos(az)).addScaledVector(E, Math.sin(az));
      return new THREE.Matrix4().makeBasis(D, P, D.clone().cross(P)).setPosition(P.multiplyScalar(R + h));
    }
    // the mission map's frame at angle a round a body: x along the (anticlockwise) motion, y up, z = x × y
    const mapBasis = (a) => new THREE.Matrix4().makeBasis(V3(-Math.sin(a), Math.cos(a), 0), V3(Math.cos(a), Math.sin(a), 0), V3(0, 0, -1));
    const craftQ = (a) => new THREE.Quaternion().setFromRotationMatrix(mapBasis(a)).invert(); // map → craft frame
    // a globe's turn (sphere → map) that puts site frame F straight under map angle a, its +x along the motion
    const turnTo = (F, a) => new THREE.Quaternion().setFromRotationMatrix(mapBasis(a).multiply(F.clone().setPosition(0, 0, 0).transpose()));
    // the Moon keeps its near side (texture u = 0.5) toward the Earth (map -x), its north on the map's +z
    const QM = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3(-1, 0, 0), V3(0, 0, 1), V3(0, 1, 0)));
    // a value eased between keyframes [[t, v], ...] over w s of playback after each; each step eases in on its own, so
    // keyframes closer together than w still make one continuous curve
    function eased(keys, w = 3) {
      const K = keys.map(([t, v]) => [at(t).tau, v]);
      return (tau) => { let v = K[0][1]; for (let i = 1; i < K.length; i++) v += (K[i][1] - K[i - 1][1]) * sm(K[i][0], K[i][0] + w, tau); return v; };
    }
    // the same for a value that follows its own function of time in each phase [[t, f(t)], ...]
    function phases(keys, w = 3) {
      const K = keys.map(([t, f]) => [at(t).tau, f]);
      return (t, tau) => { let v = K[0][1](t); for (let i = 1; i < K.length; i++) { const k = sm(K[i][0], K[i][0] + w, tau); if (k > 0) v += (K[i][1](t) - K[i - 1][1](t)) * k; } return v; };
    }
    // the plasma's strength from the speed and height on the mission profile
    const entryP = (x) => { const c = (v) => Math.min(1, Math.max(0, v)); return c((x.vel - 9000) / 14000) * c((118 - x.alt) / 20) * c((x.alt - 22) / 10); };
    // the stack's base above the site while it climbs off the pad (released at rel with acceleration a), handing over to
    // the profile's altitude by 30 s
    const padAlt = (t, km, P, rel, a, foot = 0) => { const u = Math.max(0, t - rel), h = 0.5 * a * u * u; return P.deck + foot + h + (km * 1000 - h) * sm(10, 30, t); };
    // a point in the craft's frame (vehicle coordinates) → world, for attitude th with subject point S at the origin
    const Zax = V3(0, 0, 1), toWorld = (x, y, th, S) => V3(x, y, 0).sub(S).applyAxisAngle(Zax, th);
    const fireAll = (stk, fires, t, thin) => { let pw = 0; for (const [n, rows] of Object.entries(fires)) { const p = lin(rows, t); pw = Math.max(pw, p); stk.fires[n](p, thin); } return pw; };

    // the launch: steam rolling out of the trench, the smoke column the engines leave in the air, their glow on the pad
    function launchFx(site, P, { smoke = "#efece6", trailK = 1, dirs = [[1, 0], [-1, 0]] } = {}) {
      const smk = particles({ n: 1200, color: smoke, size: 25, grow: 3.4, drag: 0.35, rise: 3.5, gravity: 0, life: 18, opacity: 0.55, parent: site });
      const trail = particles({ n: 1000, color: smoke, size: 8 + 4.5 * trailK, grow: 4.5, drag: 0.6, rise: 0.6, gravity: 0, life: 26, opacity: Math.min(0.85, 0.35 + 0.3 * trailK), parent: site });
      const light = new THREE.PointLight("#ffb46a", 0, 600, 2); site.add(light);
      const b = V3(), dk = V3();
      return {
        reset() { smk.reset(); trail.reset(); },
        // pw: engine power 0..1, noz: the engines' exits (world), alt: km; returns how hard the camera shakes
        step(dt, pw, noz, alt, clock) {
          site.updateMatrixWorld(true); b.copy(noz); site.worldToLocal(b);
          const hb = b.y - P.deck, low = 1 - sm(40, 300, hb);
          if (dirs) for (const d of dirs) smk.step(dt, { x: d[0] * 55, y: P.smokeY, z: d[1] * 55, r0: 6, rate: pw * 40 * low, speed: 42, up: 9, dir: d, cone: 0.9, floor: P.smokeY });
          else smk.step(dt, { x: 0, y: P.smokeY, z: 0, r0: 14, rate: pw * 80 * low, speed: 45, up: 6, floor: P.smokeY });
          trail.step(dt, { x: b.x, y: b.y - 6, z: b.z, r0: 2, rate: hb > 12 ? pw * 34 * trailK * (1 - sm(8, 38, alt)) : 0, speed: 3, up: -6, floor: P.smokeY });
          const fl = 0.94 + 0.06 * Math.sin(clock * 37) * Math.sin(clock * 23);
          light.position.set(b.x, b.y - 8, b.z); light.intensity = 2.5e4 * pw * fl * (1 - sm(300, 900, hb));
          smk.glow(b.x, P.deck, b.z, "#ff9a48", pw * 1.8 * (1 - sm(20, 160, hb)), 45); trail.glow(b.x, b.y - 12, b.z, "#ffa860", pw * 1.6, 22);
          exhFloor.y = hb < 800 ? site.localToWorld(dk.set(0, P.deck, 0)).y : -1e9;
          return Math.max(pw * 0.35 * (1 - sm(60, 600, hb)), pw * 0.12 * (1 - sm(20, 60, alt)));
        },
      };
    }
    // the vapour cone round a stack going transonic, at height y on its axis, radius r; set(k 0..1)
    function vaporCone(parent, y, r) {
      const m = mesh(new THREE.CylinderGeometry(r * 1.15, r * 2.6, r * 3, 48, 1, true), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, map: plumeTex }), parent, 0, y, 0);
      m.castShadow = false; m.visible = false;
      return (k) => { m.material.opacity = 0.35 * k * (0.8 + 0.2 * Math.random()); m.visible = k > 0.01; };
    }
    // a capsule's parachutes: two drogues, then the mains (reefed, then full), cut away after splashdown; hung each frame
    // from `top` (world). Returns how far out they are (0, 0.4 drogues, 1 mains)
    function chuteSet(nc, D, len, col, tDrogue, tMain, tSplash) {
      const dr = chutes(2, 6, len * 0.75, col), mn = chutes(nc, D, len, col);
      return (t, top, c) => {
        const k1 = t >= tDrogue && t < tMain + 1.5, cut = sm(tSplash + 3, tSplash + 10, t), k2 = t >= tMain && cut < 0.99;
        dr.g.visible = k1; if (k1) { dr.g.position.copy(top); dr.set(c); dr.g.scale.setScalar(0.3 + 0.7 * sm(tDrogue, tDrogue + 2.5, t)); }
        mn.g.visible = k2; if (k2) { mn.g.position.copy(top); mn.set(c, cut); mn.g.scale.setScalar(0.3 + 0.3 * sm(tMain, tMain + 3, t) + 0.4 * sm(tMain + 9, tMain + 15, t)); }
        return t >= tMain ? 1 - cut : t >= tDrogue ? 0.4 : 0;
      };
    }

    function flight(K) {
      const sunD = V3(...K.sun[0][1]).normalize(), sky = atmo(sunD);
      const E = planet("earth"), Mo = planet("moon");
      const site = new THREE.Group(); site.matrixAutoUpdate = false; E.spin.add(site);
      const siteF = spotFrame(K.site.spot, K.site.az * D2R, E.R0); site.matrix.copy(siteF);
      const P = K.pad(site);
      { const a = (P.coastAz - K.site.az) * D2R; siteGround(site, { land: P.land, coast: [Math.cos(a), Math.sin(a), P.coast] }); }
      clouds(E.spin, { n: 520, inner: 2500, outer: 42000, y0: 1300, y1: 2600, seed: 9, frame: siteF }); // fair-weather cumulus round the launch site
      let seaG = null, moonG = null;
      if (K.sea) { seaG = new THREE.Group(); seaG.matrixAutoUpdate = false; seaG.matrix.copy(spotFrame(K.land.spot, K.land.az * D2R, E.R0)); E.spin.add(seaG); }
      if (K.moon) {
        const a = at(K.moon.t).a, iq = QM.clone().invert(), U = V3(Math.cos(a), Math.sin(a), 0).applyQuaternion(iq), F = V3(-Math.sin(a), Math.cos(a), 0).applyQuaternion(iq);
        moonG = new THREE.Group(); moonG.matrixAutoUpdate = false; moonG.matrix.makeBasis(F, U, F.clone().cross(U)).setPosition(U.clone().multiplyScalar(Mo.R0)); Mo.spin.add(moonG);
      }
      // the Earth's turn: the launch site under the craft at liftoff, eased (while the Earth is far or racing by) to put the
      // landing site under it at the landing
      const Qa = turnTo(siteF, at(info.start).a), Qb = K.land ? turnTo(spotFrame(K.land.spot, K.land.az * D2R, E.R0), at(K.land.t).a) : Qa;
      const qT = K.land ? [at(K.land.from).tau, at(K.land.to).tau] : [0, 1];
      const craft = new THREE.Group(); world.add(craft);
      const C = K.make({ site, P, seaG, moonG, craft, E, Mo });
      // a change of the body below turns the frame over 3 s of playback instead of at once
      const { A: TA, P: TP } = tab(), SW = [];
      for (let j = 1; j < TP.length; j++) if (TP[j] !== TP[j - 1]) SW.push([j, craftQ(TA[j - 1]).multiply(craftQ(TA[j]).invert())]);
      const cy = eased(K.cam.map(([t, y]) => [t, y * D2R])), cp = eased(K.cam.map(([t, , p]) => [t, p * D2R])), cd = eased(K.cam.map(([t, , , d]) => [t, Math.log(d)]));
      const sx = eased(K.sun.map(([t, v]) => [t, v[0]]), 8), sy = eased(K.sun.map(([t, v]) => [t, v[1]]), 8), sz = eased(K.sun.map(([t, v]) => [t, v[2]]), 8);
      const EV = K.events.map(([t, x]) => [t, at(t).tau, x]);
      const Rm = [6378, 1737], Cm = [[0, 0], [384400, 0]], Rv = [E.R0, Mo.R0];
      const qL = new THREE.Quaternion(), qc = new THREE.Quaternion(), qE = new THREE.Quaternion(), refW = V3(), v = V3(), pos = V3(), gc = V3();
      let gr = 0;
      return {
        chase: [0, 0, 1], shadow: 60, sunDir: sunD, space: true, flight: true, events: [],
        title: (s) => { let x = ""; for (const [a, ti] of K.titles) if (info.start + s >= a) x = ti; return x; },
        reset() { if (C.reset) C.reset(); },
        place(s, dt) {
          const t = info.start + s, L = at(t), h = info.hud(t), p = L.p;
          const x = { t, tau: L.tau, dt, km: h.alt, alt: p ? 1e4 : h.alt, vel: h.vel, a: L.a, p, thin: p ? 1 : 1 - Math.exp(-h.alt / 25), clock: G.rt, fx: info.fx(t) };
          const r = C.step(t, x);
          // the craft: turned to its attitude, shifted so its subject sits at the origin; ref = the point the altitude is of
          craft.rotation.z = r.th; craft.position.copy(r.S).applyAxisAngle(Zax, r.th).negate();
          refW.copy(r.ref).applyAxisAngle(Zax, r.th).add(craft.position);
          // the craft frame for its drawn angle round the body below, eased after a change of body
          const a = r.a ?? L.a;
          qL.copy(craftQ(a));
          for (let i = SW.length - 1; i >= 0; i--) if (SW[i][0] <= L.j) { const u = L.tau - SW[i][0] / 60; if (u < 3) qL.premultiply(qc.copy(SW[i][1]).slerp(new THREE.Quaternion(), sm(0, 3, u))); break; }
          const altM = r.altM ?? h.alt * 1000, km = Rm[p] + altM / 1000, pv = [Cm[p][0] + km * Math.cos(a), Cm[p][1] + km * Math.sin(a)];
          v.set(-Math.cos(a), -Math.sin(a), 0).multiplyScalar(Rv[p] + altM).applyQuaternion(qL).add(refW);
          (p ? Mo : E).put(v); gc.copy(v); gr = Rv[p] + 2;
          const o = 1 - p;
          v.set((Cm[o][0] - pv[0]) * 1000, (Cm[o][1] - pv[1]) * 1000, 0).applyQuaternion(qL).add(refW);
          (o ? Mo : E).put(v);
          qE.copy(Qa).slerp(Qb, sm(qT[0], qT[1], L.tau));
          E.spin.quaternion.copy(qL).multiply(qE); Mo.spin.quaternion.copy(qL).multiply(QM);
          // sky, haze and what is near enough to draw
          const altE = p ? 1e4 : altM / 1000;
          sky(altE, !p);
          E.detail(p ? 0 : 1 - sm(4, 45, altE)); E.haze(p ? 1 : sm(10, 30, altE));
          site.visible = !p && altE < 160;
          if (seaG) seaG.visible = !p && altE < 90 && t > K.land.t - 8000;
          if (moonG) moonG.visible = p === 1 && altM < 3e5;
          sunD.set(sx(L.tau), sy(L.tau), sz(L.tau)).normalize(); sky.dome.u.uSunD.value.copy(sunD);
          const sh = r.shadow ?? 60, shc = sun.shadow.camera;
          if (shc.right !== sh) { shc.left = shc.bottom = -sh; shc.right = shc.top = sh; shc.updateProjectionMatrix(); }
          let ev = "";
          for (let i = EV.length - 1; i >= 0; i--) if (t >= EV[i][0]) { if (L.tau - EV[i][1] < 9) ev = EV[i][2]; break; }
          return { pos: pos.set(0, 0, 0), t, alt: r.hud ? r.hud.alt : h.alt, vel: r.hud ? r.hud.vel : h.vel, ref: p ? " above the Moon" : "", ev, info: r.info || "" };
        },
        update() {},
        cam(s) { const tau = at(info.start + s).tau; return { yaw: cy(tau), pitch: cp(tau), dist: Math.exp(cd(tau)) }; },
        ground: () => ({ c: gc, r: gr }),
      };
    }

    const SCENES = {
      // ---- Falcon 9 and Crew Dragon: LC-39A, the climb and staging (the booster's landing is the one cut away), Dragon's
      // free flight, the ISS (approach along its velocity vector, six months docked, undocking), the trunk jettisoned,
      // entry, and splashdown in the Gulf of Mexico
      f9flight(c) {
        const { tDock, tUndock, tD, tDrogue, tMain, tSplash } = c, aE = info.ascEnd, a0 = tDock - 290;
        return flight({
          site: { spot: [0.2761, 0.6589], az: 44 }, land: { spot: [0.2556, 0.65], az: 40, t: tSplash, from: tDock + 30 * 86400, to: tUndock - 30 * 86400 }, sea: true,
          pad: padF9,
          sun: [[-1e9, [-0.4, 0.62, 0.68]], [700, [-0.42, 0.5, 0.76]], [tD + 1500, [-0.45, 0.6, 0.5]]],
          cam: [[-1e9, 28, 2, 134], [10, 25, -4.6, 124], [153, 25, -4.6, 62], [700, -20, 10, 30], [aE, -35, 17.5, 29], [tDock - 1500, -13, 11, 40], [tDock + 15, -35, 22, 175], [tUndock - 240, -25, 25, 140], [tUndock + 1200, -35, 17.5, 29], [tD - 700, -30, 15, 26], [tD + 1800, 34, 12, 30], [tDrogue, 30, 8, 70], [tMain, 35, 3, 118], [tSplash + 4, 35, 3, 52]],
          titles: [[-1e9, "Falcon 9 · liftoff from LC-39A"], [12, "Falcon 9 · ascent to orbit"], [700, "Crew Dragon · free flight"], [tDock - 1500, "Crew Dragon · docking to the ISS"], [tDock + 30, "Docked to the International Space Station"], [tUndock - 60, "Crew Dragon · undocking"], [tUndock + 1200, "Crew Dragon · heading home"], [tD + 1800, "Crew Dragon · atmospheric entry"], [tDrogue, "Crew Dragon · splashdown"], [tSplash + 20, "Crew Dragon · awaiting recovery"]],
          events: [[a0, "Approach along the station's velocity vector, ~150 m out"], [a0 + 60, "Draco thrusters brake the closing rate"], [a0 + 80, "Holding at the 20 m waypoint · GO for final approach"], [a0 + 95, "Final approach at 10 cm/s, guided by lidar and thermal cameras"], [tDock, "Soft capture: the docking ring's latches catch"], [tDock + 10, "Ring retracts · 12 hooks drive closed for hard capture"], [tD - 600, "Trunk jettisoned · nose cone closed"], [tD + 2100, "Plasma sheath: the air ahead is heated to ~1,600 °C"], [tDrogue, "Two drogue parachutes"], [tMain, "Four main parachutes · ~25 km/h"], [tSplash, "Splashdown"], [tSplash + 4, "Main parachutes cut away"], [tSplash + 30, "The recovery ship comes alongside"]],
          make(W) {
            const s = f9Stack(), d = s.dragon, dy = d.root.position.y; W.craft.add(s.root);
            const seps = stager(s, [[153, "booster", { v: -1.5, a: -9, spin: [0, 0, 0.07], pivot: 25, hide: 70 }], [700, "s2", { v: -0.35, a: -0.04, spin: [0.004, 0, 0.007], pivot: 55, hide: 300 }]]);
            const fires = { m1d: [[-3, 0], [-1.2, 1], [149.6, 1], [150.6, 0]], mvac: [[160, 0], [162, 1], [527.5, 1], [528.5, 0]] };
            const vap = vaporCone(s.root, 44, 1.95), fx = launchFx(W.site, W.P, { trailK: 0.6 });
            // the ISS, its forward port (IDA-2 on Harmony) facing the way it flies; Dragon comes in from ahead, nose first
            const st = iss(); st.wings.forEach((w) => (w.rotation.x = 0.55)); st.root.rotation.y = Math.PI; world.add(st.root);
            const hot = plasma(d.root, 2.0, 26, "#ff7a32"), chute = chuteSet(4, 35, 38, "#d8442c", tDrogue, tMain, tSplash);
            const sea = seaPatch(W.seaG, "#2b2f35"), splash = splashFx(W.seaG, 2.0), F = V3(-1, 0, 0);
            const att = eased([[-1e9, -Math.PI / 2], [tDock - 1500, Math.PI / 2], [tUndock + 600, -Math.PI / 2], [tD + 1600, Math.PI / 2], [tDrogue, 0]]);
            const foc = eased([[-1e9, 33], [10, 35], [153, 57], [700, dy + 1.4], [tDock + 30, dy + 24], [tUndock - 30, dy + 1.4], [tDrogue, dy + 8], [tMain, dy + 18], [tSplash + 6, dy + 3]]);
            // the gap between the docking ports: closing from ~2.8 km, the scripted last 150 m, docked, backing away
            const gap = (t) => (t < a0 ? 150 + 1.5 * (a0 - t) + 0.0006 * (a0 - t) ** 2 : t < tDock ? -herm(M.dock, t - a0)[0] : t < tUndock ? 0 : ((u) => (u < 120 ? 0.15 * u : 18 + 0.5 * (u - 120) + 0.002 * (u - 120) ** 2))(t - tUndock));
            return {
              reset() { fx.reset(); splash.reset(); },
              step(t, x) {
                seps(t);
                const pw = fireAll(s, fires, t, x.thin);
                vap(sm(56, 58, t) * (1 - sm(64, 66, t)));
                s.booster.fins(sm(166, 172, t));
                d.setNose(sm(730, 744, t) * (1 - sm(tD - 1300, tD - 1200, t)));
                const ut = t - (tD - 600); // the trunk leaves before the deorbit burn
                d.trunk.position.y = ut > 0 ? -(0.3 * ut + 0.002 * ut * ut) : 0; d.trunk.rotation.x = Math.max(0, ut) * 0.004; d.trunk.visible = ut < 400;
                const g = gap(t), after = t - tSplash;
                d.dracos(x.fx.includes("burn") && t > 700 ? 0.4 : t > 700 && t < 716 ? 0.4 : t > tDock - 1500 && t < tDock ? (t < a0 + 90 ? 0.35 : 0.06) : 0.03);
                // attitude: the pitch program on the way up, eased keyframes after, a sway under the chutes and on the water
                let th = t < aE - 40 ? -pitchAt(x.km) : att(x.tau);
                if (t > tDrogue) th += (after < 0 ? 6 * Math.sin(x.clock * 0.7) : 8 * Math.sin(x.clock * 0.9) * sm(0, 3, after)) * D2R;
                const S = V3(0, foc(x.tau), 0);
                const shake = fx.step(x.dt, pw, toWorld(0, 0, th, S), x.km, x.clock);
                G.shake = shake;
                // the ISS: its forward port held `gap` m off Dragon's along -x, the station stretching away behind it
                st.root.visible = g < 6000 && t > tDock - 1600 && t < tUndock + 5000;
                if (st.root.visible) { const pw2 = toWorld(0, dy + 3.55, th, S); st.root.position.set(pw2.x - g, pw2.y, pw2.z); }
                hot(entryP(x), x.clock, F);
                chute(t, toWorld(0, dy + 3.4, th, S), x.clock);
                sea.update(x.clock); sea.ship(after); splash.step(x.dt, after);
                const bob = after > 0 ? sea.wave(0, 0, x.clock) - 0.5 * sm(0, 1.2, after) + 0.25 * Math.sin(x.clock * 1.3) : 0;
                const early = t < 700;
                return {
                  th, S, ref: early ? V3(0, 0, 0) : V3(0, dy - 0.12, 0), altM: early ? padAlt(t, x.km, W.P, 0, 3.56, 0.4) : x.km * 1000 + 1.2 + bob,
                  shadow: t < 200 ? 120 : t > tDock - 300 && t < tUndock + 300 ? 90 : 45,
                  info: t > tDock - 1500 && t < tDock ? `Range ${g.toFixed(g < 100 ? 1 : 0)} m · closing ${((gap(t - 0.5) - gap(t + 0.5)) * 100).toFixed(0)} cm/s` : t > tUndock && g < 3000 ? `Range ${g.toFixed(0)} m · opening` : "",
                };
              },
            };
          },
        });
      },

      // ---- Starship: Starbase, 33 Raptors, hot staging (Super Heavy's catch is the one cut away), a lap of the Earth with a
      // Starlink deploy, the belly-first entry, the flip and landing burn, and the catch back on the same tower
      shflight(c) {
        const { tD, tCatch } = c, aE = info.ascEnd, w0 = tCatch - 29.5;
        return flight({
          site: { spot: [0.2301, 0.6444], az: 97 }, land: { spot: [0.2301, 0.6444], az: 97, t: tCatch, from: 700, to: tD - 300 },
          pad: padStarbase,
          sun: [[-1e9, [0.6, 0.6, 0.5]], [600, [-0.3, 0.6, 0.75]], [tD + 300, [-0.4, 0.5, 0.77]], [tD + 1600, [-0.5, 0.55, 0.65]]],
          cam: [[-1e9, 31, 1.5, 233], [10, 26.6, -4.3, 213], [165, 26.6, -4.3, 107], [aE, -35, 17.5, 135], [1150, -36, 38, 58], [1330, -35, 17.5, 135], [tD + 380, 18, 12, 80], [tD + 1650, 30, 8, 120], [w0, 37, 4, 150], [tCatch + 3, 37, 6, 170]],
          titles: [[-1e9, "Starship · liftoff from Starbase"], [10, "Starship · ascent and hot staging"], [520, "Starship · in orbit"], [1180, "Starship · Starlink deploy"], [1330, "Starship · in orbit"], [tD - 30, "Starship · deorbit burn"], [tD + 400, "Starship · belly-first entry"], [w0, "Ship catch · flip and landing burn"], [tCatch + 4, "Ship · back on the tower"]],
          events: [[1180, "The Pez-dispenser door opens"], [1200, "Starlink satellites slide out one at a time"], [1225, "Each one drifts clear before the next is released"], [1256, "Payload deployed"], [tD + 400, "Belly-first at ~60° angle of attack · 7 km/s"], [tD + 450, "Plasma wraps the hexagonal heat-shield tiles"], [tD + 900, "Peak heating · ~1,400 °C on the windward side"], [tD + 1200, "Flaps trim the attitude like a skydiver's arms and legs"], [w0, "Belly-flop: falling sideways at terminal velocity, ~320 km/h"], [w0 + 11, "Landing flip: Raptors relight and swing the ship upright"], [w0 + 16, "Landing burn"], [w0 + 24, "Slides between the open chopsticks"], [tCatch, "Caught · engines off"]],
          make(W) {
            const s = starshipStack(), ship = s.ship, B = ship.body, sy = ship.root.position.y; W.craft.add(s.root);
            const seps = stager(s, [[165, "booster", { v: -2, a: -14, spin: [0, 0, 0.09], pivot: 36, hide: 60 }]]);
            const fires = { booster: [[-4, 0], [-0.8, 1], [158.5, 1], [159.5, 0.15], [164.5, 0.15], [165, 0]], ship: [[161.5, 0], [163, 1], [514.5, 1], [515.5, 0]], rvac: [[161.5, 0], [163, 1], [514.5, 1], [515.5, 0]], hsr: [[161.5, 0], [162.2, 1], [164.6, 1], [165.4, 0]] };
            const vap = vaporCone(s.root, 66, 4.9), fx = launchFx(W.site, W.P, { trailK: 0.35, dirs: null });
            // Starlink: nine satellites slide out of the Pez door one by one and drift clear
            const satM = [std("#b8bcc4", { metalness: 0.7, roughness: 0.3 }), std("#ffffff", { map: cells("slcells", "#101a33", "#3a3f4a", 6, 10), metalness: 0.4, roughness: 0.3 })];
            const sats = Array.from({ length: 9 }, (_, i) => { const g = new THREE.Group(); B.add(g); box(4.1, 0.28, 2.7, satM[0], g, 0, 0, 0); box(4.0, 0.02, 2.6, satM[1], g, 0, 0.15, 0); g.rotation.z = Math.PI / 2; g.userData = { t: 1200 + i * 6.2, spin: Math.sin(i * 7.1) * 0.03 }; return g; });
            const doorM = ship.door.material, open = std("#020203", { roughness: 1 });
            // entry: the hull glows, ribbons stream off the belly edges, round the nose and off the flaps; a pink light on the belly
            const shells = ship.hull.map((m) => hotShell(m, "#ffa6d6", 3.4, 0.3)), seeds = [], rAt = (y) => (y > 40 ? 4.5 * Math.pow(Math.max(0, 1 - ((y - 40) / 10.3) ** 2), 0.55) : 4.5);
            for (let i = 0; i < 44; i++) { const y = 2 + 47 * Math.random(), a = (Math.random() < 0.5 ? -1 : 1) * (1.15 + 0.3 * Math.random()); seeds.push({ p: V3(Math.cos(a) * rAt(y), y, Math.sin(a) * rAt(y)), out: V3(Math.cos(a), 0, Math.sin(a)) }); }
            for (let a = -1.2; a <= 1.2; a += 0.2) seeds.push({ p: V3(Math.cos(a) * 1.4, 49.6, Math.sin(a) * 1.4), out: V3(Math.cos(a), 0.5, Math.sin(a)).normalize() });
            for (const [y, z] of [[42, 7.2], [48, 6.6], [3, 8.2], [12, 8.0]]) for (const sg of [-1, 1]) for (let k = 0; k < 2; k++) seeds.push({ p: V3(1.3, y + k * 1.2, sg * z), out: V3(0.3, 0, sg).normalize() });
            const tr = streaks(seeds, { parent: B, len: 90, spread: 10, w: 0.42, c1: "#ffa0d4", c2: "#5a4cff", per: 2, k: 0.9 });
            const pl = new THREE.PointLight("#ff6fae", 0, 160, 2); pl.position.set(9, 26, 0); B.add(pl);
            const steam = particles({ color: "#eef1f4", size: 8, drag: 0.7, rise: 3, gravity: 0, life: 6, opacity: 0.25, parent: W.site });
            const att = eased([[-1e9, -Math.PI / 2], [tD + 380, -30 * D2R], [tD + 1600, -Math.PI / 2]]), roll = eased([[-1e9, 0.54], [560, 0]], 6);
            const foc = eased([[-1e9, 61], [165, sy + 26], [w0 - 25, sy + 20]]);
            const thr = [[0, 0], [10.6, 0], [11.2, 1], [24, 0.75], [29.5, 0.5], [29.9, 0]], arms = [[24, 1], [28.5, 0]], tilt = [[0, 90], [11, 90], [15.5, -8], [17, 4], [19, 0]];
            const aCatch = at(tCatch).a, F = V3(-1, 0.05, 0).normalize();
            return {
              reset() { fx.reset(); steam.reset(); },
              step(t, x) {
                seps(t);
                const pw = fireAll(s, fires, t, x.thin);
                vap(sm(52, 54, t) * (1 - sm(60, 62, t)));
                ship.root.rotation.y = roll(x.tau); // roll belly-down once the booster is gone
                // in orbit: the Pez door and the satellites
                ship.door.material = t > 1185 && t < 1330 ? open : doorM;
                let out = 0;
                for (const g of sats) {
                  const u = t - g.userData.t; g.visible = u > -1 && u < 240; if (u > 0) out++;
                  const w = Math.max(0, u); g.position.set(-4.5 - Math.min(1, Math.max(0, u + 1)) * 1.2 - 0.55 * w, 37.6 - 0.35 * w, 0); g.rotation.set(w * g.userData.spin, 0, Math.PI / 2 + w * g.userData.spin * 0.5);
                }
                const burn = t > 600 && x.fx.includes("burn") ? 1 : 0;
                if (t > 600 && t < w0) { ship.fireRSL(burn * 0.8, 1); ship.fireRVac(burn, 1); }
                const p = entryP(x), f = 0.94 + 0.06 * Math.random();
                shells.forEach((sh) => sh(p * f, x.clock, F)); tr(p, x.clock, F); pl.intensity = 700 * p * f;
                // the catch: the scripted fall, flip and landing burn over the tower (centre of mass 20 m above the ship's base)
                let th = t < aE - 40 ? -pitchAt(x.km) : att(x.tau), altM = t < 400 ? padAlt(t, x.km, W.P, 0, 3.33) : x.km * 1000, a, hud = null;
                const u = t - w0, k = sm(w0 - 4, w0 + 1, t);
                ship.flaps(t > tD + 300 && t < w0 + 11 ? (u < 0 ? 0.15 : 0.25 * Math.sin(x.clock * 0.6)) : 0, x.clock);
                if (u > -4) {
                  const [cx, ch, vx, vh] = herm(M.scatch, Math.max(0, u));
                  th += (-lin(tilt, Math.max(0, u)) * D2R - th) * k; altM += (ch - altM) * k; a = x.a + (aCatch + cx / W.E.R0 - x.a) * k;
                  hud = { alt: ch / 1000, vel: Math.hypot(vx, vh) * 3.6 };
                  const q = lin(thr, Math.max(0, u)); ship.fireRSL(q, 0); ship.fireRVac(0, 0);
                  W.P.catchArms(lin(arms, u) * 32 * D2R);
                  steam.step(x.dt, { x: 0, y: 0.5, z: 0, r0: 6, rate: ch - 20 < 120 ? q * 400 * (1 - (ch - 20) / 120) : 0, speed: 25, up: 6 });
                }
                const S = V3(0, foc(x.tau), 0);
                G.shake = fx.step(x.dt, pw, toWorld(0, 0, th, S), x.km, x.clock);
                return {
                  th, S, ref: t < 400 ? V3(0, 0, 0) : V3(0, sy + 20, 0), altM, a, hud, shadow: t < 200 ? 150 : u > -20 ? 120 : 70,
                  info: t > 1194 && t < 1330 ? `${out} of ${sats.length} satellites deployed` : "",
                };
              },
            };
          },
        });
      },

      // ---- Apollo 11: LC-39A, the Saturn V to orbit and TLI, transposition and docking, three days out, Eagle's legs swing
      // down and it undocks, powered descent onto Tranquility Base, the stay, lunar liftoff, docking with Columbia in lunar
      // orbit, the trip home, the command module alone through entry and down to the Pacific
      svflight(c) {
        const { tLOI, tUndock, tDOI, tPDI, tLand, tLift, tIns, tDock, tJett, tTEI, tSM, tEI, tDrogue, tMain, tSplash } = c, aE = info.ascEnd;
        const tSep = 11700, a0td = 15308, tDocked = 15408, tOut = 15420, a0lm = tLand - (tLM + 1.1), a0dk = tDock - 120;
        return flight({
          site: { spot: [0.2761, 0.6589], az: 72 }, land: { spot: [0.0301, 0.574], az: 45, t: tSplash, from: tLOI + 20000, to: tTEI - 20000 }, sea: true, moon: { t: tLand },
          pad: padSaturn,
          sun: [[-1e9, [0.5, 0.6, 0.62]], [800, [-0.4, 0.55, 0.73]], [tUndock + 1200, [0.804, 0.191, 0.563]], [tLift - 900, [0.75, 0.42, 0.52]], [tDock + 900, [-0.4, 0.55, 0.73]], [tSM - 1200, [-0.45, 0.6, 0.5]]],
          cam: [[-1e9, 28, 1.5, 226], [12, 26.6, -4, 202], [161, 26.6, -4, 152], [548, 26.6, -4, 82], [tSep - 120, -38, 14, 62], [a0td, -43, 16, 40], [tOut + 120, -35, 17.5, 53], [tUndock - 300, -30, 12, 40], [tUndock + 600, 32, 7, 33], [a0lm - 300, 33, 7, 34], [tLand + 400, 40, 10, 40], [tLift - 60, 37, 9.4, 22], [tLift + 25, 30, 12, 70], [tLift + 900, -30, 15, 40], [a0dk, -40, 14, 32], [tDock + 600, -35, 17.5, 45], [tJett, -35, 17.5, 36], [tSM, -30, 15, 21], [tEI - 100, 34, 12, 26], [tDrogue, 30, 8, 60], [tMain, 35, 3, 95], [tSplash + 4, 35, 3, 45]],
          titles: [[-1e9, "Apollo 11 · liftoff from LC-39A"], [12, "Saturn V · ascent to orbit"], [700, "Apollo 11 · Earth parking orbit"], [9800, "Saturn V · translunar injection"], [tSep - 60, "Columbia separates from the S-IVB"], [a0td, "Transposition, docking & extraction"], [tOut + 600, "Columbia and Eagle · translunar coast"], [tLOI - 600, "Columbia and Eagle · lunar orbit"], [tUndock - 120, "Eagle undocks"], [tDOI - 120, "Eagle · descent to the Moon"], [a0lm, "Eagle · powered descent"], [tLand + 5, "Eagle · Tranquility Base"], [tLift - 30, "Eagle · lunar liftoff"], [tIns + 300, "Eagle · rendezvous with Columbia"], [tDock - 60, "Lunar orbit rendezvous · docking"], [tJett - 60, "Columbia · heading home"], [tSM - 60, "Columbia · command module"], [tEI - 60, "Columbia · entry at 11 km/s"], [tDrogue, "Columbia · splashdown"], [tSplash + 20, "Columbia · awaiting USS Hornet"]],
          events: [[tSep, "The adapter's petals open · Columbia backs out"], [tSep + 300, "Collins turns Columbia round to face the S-IVB"], [a0td + 60, "Collins lines up the probe on Eagle's drogue"], [a0td + 100, "Probe in the drogue · capture latches"], [a0td + 104, "Hard dock · 12 latches lock the tunnel"], [tOut, "Eagle pulled free of the S-IVB"], [tUndock - 2400, "Eagle's landing gear swings down"], [tUndock, "“The Eagle has wings”"], [a0lm, "High gate, 2.2 km up: P64 approach, pitched back to brake"], [a0lm + 100, "Low gate, ~150 m: P66, Armstrong flies it by hand"], [tLand - 25, "Exhaust starts blowing dust off the surface"], [tLand - 1, "CONTACT LIGHT: a probe touches the surface"], [tLand, "Engine stop · “The Eagle has landed”"], [393860, "“One small step for man…”"], [395000, "The flag goes up at Tranquility Base"], [tLift, "LIFTOFF · the descent stage is the launch pad"], [tLift + 1, "Exhaust blows foil and the flag over"], [tLift + 13, "Pitchover · heading downrange toward Columbia"], [a0dk, "Columbia closes in · Collins at the controls"], [tDock, "Contact · capture latches"], [tDock + 4, "“Hard dock” · Armstrong and Aldrin rejoin Collins"], [tJett, "Eagle's ascent stage is cast off"], [tSM, "Service module jettisoned"], [tEI + 10, "Shock layer ~2,700 °C · radio blackout"], [tDrogue, "Drogue parachutes"], [tMain, "Three main parachutes · 31 km/h"], [tSplash, "Splashdown in the Pacific"], [tSplash + 30, "Flotation collar · USS Hornet's helicopters inbound"]],
          make(W) {
            const s = saturnV(), csm = s.csm, lm = s.lm; W.craft.add(s.root); W.craft.updateMatrixWorld(true);
            W.craft.attach(csm.root); W.craft.attach(lm.root); // flown on their own from the turnaround on (craft frame)
            const seps = stager(s, [[161, "s1", { v: -2, a: -14, spin: [0.01, 0, 0.02], pivot: 23, hide: 60 }], [191, "inter", { v: -0.5, a: -8, spin: [0, 0.05, 0.02], pivot: 43.7, hide: 30 }], [197, "les", { v: 3, a: 40, spin: [0, 0, 0.05], pivot: 106, hide: 12 }], [548, "s2", { v: -1, a: -10, spin: [0.005, 0, 0.012], pivot: 56, hide: 80 }]]);
            const fires = { f1: [[-8.9, 0], [-6, 1], [135, 1], [135.5, 0.8], [160.5, 0.8], [161, 0]], j2: [[163, 0], [166, 1], [547.5, 1], [548.5, 0]], s4: [[551, 0], [552.5, 1], [699, 1], [700, 0], [9856, 0], [9858, 1], [10202, 1], [10203, 0]], les: [[197, 0], [197.2, 1], [200, 0]] };
            const vap = vaporCone(s.root, 60, 5.6), fx = launchFx(W.site, W.P, { trailK: 1.1 });
            // Tranquility Base: the ground, the descent stage left behind, the flag
            moonGround(W.moonG);
            const base = lunarModule(); base.asc.visible = false; base.probes(0); base.root.position.y = 1.5; W.moonG.add(base.root);
            const flag = usFlag(W.moonG, 9, 5); flag.position.y = 1.5;
            const dust = particles({ color: "#b7b2a8", size: 0.9, drag: 0, rise: 0, gravity: 1.62, life: 3.5, opacity: 0.55, parent: W.moonG });
            const flakes = particles({ color: "#e0b860", size: 0.18, drag: 0, rise: 0, gravity: 1.62, life: 9, opacity: 0.9, n: 1500, parent: W.moonG });
            const dust2 = particles({ color: "#b7b2a8", size: 0.8, drag: 0, rise: 0, gravity: 1.62, life: 3, opacity: 0.4, n: 2000, parent: W.moonG });
            const hot = plasma(csm.cm, 1.956, 22, "#ff6a26"), chute = chuteSet(3, 25.4, 30, "#d33a2c", tDrogue, tMain, tSplash);
            const sea = seaPatch(W.seaG, "#58606a"), splash = splashFx(W.seaG, 1.96), F = V3(-1, 0, 0);
            // the stack after extraction drifts off; LMy = Eagle's base in the craft frame, csmY = Columbia's heat shield
            const dY = (t) => (t < tOut ? 0 : Math.min(4000, 0.3 * (t - tOut) + 0.01 * (t - tOut) ** 2));
            const LMy = (t) => 85.9 + dY(t) - (t > tJett ? 0.25 * (t - tJett) + 0.0005 * (t - tJett) ** 2 : 0);
            const gapC = (t) => (t < tUndock ? 0 : t < tDock ? Math.min(0.3 * (t - tUndock) + 0.001 * (t - tUndock) ** 2, t < a0dk ? 60 + (a0dk - t) + 0.0005 * (a0dk - t) ** 2 : -herm(M.lmdock, t - a0dk)[0]) : 0);
            const csmY = (t) => (t < tSep ? 99 : t < a0td ? 99 + 25.35 * sm(0, 260, t - tSep) : t < tDocked ? 96.35 - herm(M.td, t - a0td)[0] : t < tJett ? 85.9 + dY(t) + 10.45 + gapC(t) : 85.9 + dY(tJett) + 10.45);
            const att = eased([[-1e9, -Math.PI / 2], [tUndock + 900, Math.PI / 2], [a0lm - 150, 45 * D2R], [tLand - 5, 0], [tLift + 150, -Math.PI / 2], [tTEI - 2400, Math.PI / 2], [tSM + 60, -Math.PI / 2], [tDrogue, -Math.PI]]);
            const S = phases([[-1e9, () => 55], [161, () => 82], [548, () => 92], [tSep, (t) => (csmY(t) + 86) / 2], [tOut, (t) => LMy(t) + 8.9], [tUndock, (t) => LMy(t) + 3.5], [tLift, (t) => LMy(t) + 4.6], [tDock, (t) => csmY(t) + 0.15], [tJett, (t) => csmY(t) + 1.6], [tSM, (t) => csmY(t) - 1.4], [tDrogue, (t) => csmY(t) - 9], [tMain, (t) => csmY(t) - 18], [tSplash + 6, (t) => csmY(t) - 3]]);
            const asc = (u) => (u <= 0 ? [0, 0, 0, 0] : u < 10 ? [0, 0.95 * u * u, 0, 1.9 * u] : ((w) => [1.3 * w * w, 95 + 19 * w + 0.2 * w * w, 2.6 * w, 19 + 0.4 * w])(u - 10)); // straight up, then pitch over toward Columbia
            const thr = [[tPDI, 1], [tPDI + 400, 0.6], [a0lm, 0.6], [a0lm + 100, 0.35], [tLand - 0.1, 0.3], [tLand, 0]];
            const aSite = at(tLand).a;
            let blown = false;
            return {
              reset() { fx.reset(); splash.reset(); dust.reset(); flakes.reset(); dust2.reset(); blown = false; },
              step(t, x) {
                seps(t);
                const pw = fireAll(s, fires, t, x.thin);
                vap(sm(66, 68, t) * (1 - sm(74, 76, t)));
                // the adapter's petals open and drift off; the S-IVB falls behind once Eagle is pulled free
                const up = t - tSep;
                s.petals.forEach(({ hg, pv, r0 }) => { pv.rotation.x = 0.85 * sm(0, 14, up); const w = Math.max(0, up - 14); pv.position.z = r0 + 0.4 * w; pv.position.y = 0.1 * w; hg.visible = w < 900; });
                s.parts.s4b.visible = t < tOut + 500;
                csm.root.position.y = csmY(t); csm.root.rotation.x = Math.PI * sm(300, 700, up); csm.root.visible = t < tUndock + 600 || (t > tDock - 2000 && gapC(t) < 4000) || t > tDock;
                lm.root.position.y = LMy(t); lm.root.visible = t < tJett + 1500;
                lm.legs(sm(tUndock - 2400, tUndock - 2300, t)); lm.desc.visible = t < tLift;
                const sms = t - tSM; csm.sm.position.y = sms > 0 ? -(0.3 * sms + 0.002 * sms * sms) : 0; csm.sm.visible = sms < 400;
                // engines: the SPS for lunar orbit insertion and the way home, Eagle's descent and ascent engines
                csm.fire((t > tLOI && t < tLOI + 357) || (t > tTEI && t < tTEI + 150) ? 1 : 0, 1);
                lm.fire(t > tDOI && t < tDOI + 30 ? 1 : t > tPDI && t < tLand ? lin(thr, t) : 0);
                const ua = t - tLift; lm.afire(ua > 0 && t < tIns ? 1 : 0);
                csm.rcs((up > 0 && t < tDocked) || (t > a0dk - 600 && t < tDock) ? 0.12 : 0); lm.rcs(ua > 8 && ua < 16 ? 0.4 : t > a0dk && t < tDock ? 0.04 : 0);
                // attitude: the pitch program, then eased keyframes; the scripted last 150 s of the descent and the ascent
                let th = t < aE - 40 ? -pitchAt(x.km) : att(x.tau), altM, a, hud = null;
                const ul = t - a0lm, kl = sm(a0lm - 4, a0lm + 1, t) * (1 - sm(tLand + 1, tLand + 3, t)), Sy = S(t, x.tau);
                if (t < 700) altM = padAlt(t, x.km, W.P, 0.3, 2.72, -4);
                else if (t < tUndock) altM = x.km * 1000;
                else if (t < tJett) {
                  altM = 1.5 + x.km * 1000;
                  if (kl > 0) { // Apollo 11's last 2.2 km: high gate, low gate, contact
                    const [lx, lh, vx, vh] = herm(M.lm, Math.max(0, ul));
                    th += (lin([[0, 45], [60, 25], [100, 8], [140, 0]], Math.max(0, ul)) * D2R - th) * kl;
                    altM += (1.5 + lh - altM) * kl; a = x.a + (aSite + lx / W.Mo.R0 - x.a) * kl; hud = { alt: lh / 1000, vel: Math.hypot(vx, vh) * 3.6 };
                    dust.step(x.dt, { x: lx, y: 1.5, z: 0, r0: 1, rate: lh < 30 ? lin(thr, t) * 900 * (1 - lh / 30) : 0, speed: 60, up: 4 });
                  }
                  if (ua > -1) { // lunar liftoff: straight up, pitching over 52° toward Columbia
                    const [ax, ay, vx, vy] = asc(ua), k = 1 - sm(tLift + 40, tLift + 70, t);
                    th = (-52 * D2R * sm(10, 14, ua)) * k + th * (1 - k);
                    altM += (1.5 + ay - altM) * k; a = x.a + (aSite + ax / W.Mo.R0 - x.a) * k; if (k > 0.01) hud = { alt: ay / 1000, vel: Math.hypot(vx, vy) * 3.6 };
                    if (ua > 0 && !blown) { blown = true; flakes.step(0.016, { x: 0, y: 4.7, z: 0, r0: 2, rate: 0, burst: 900, speed: 9, up: 12, floor: 1.5 }); }
                    if (ua < 0) blown = false;
                    flakes.step(x.dt, { x: 0, y: 4.7, z: 0, r0: 2, rate: 0, speed: 0, up: 0, floor: 1.5 });
                    dust2.step(x.dt, { x: 0, y: 1.5, z: 0, r0: 2, rate: ua > 0 && ua < 6 ? 600 * (1 - ua / 6) : 0, speed: 30, up: 3 });
                  }
                  lm.probes(altM - 1.5);
                } else altM = x.km * 1000 + 1.2;
                flag.visible = t > 395000; flag.rotation.x = -1.45 * sm(tLift + 0.2, tLift + 1.6, t);
                const after = t - tSplash;
                if (t > tDrogue) th += (after < 0 ? 5 * Math.sin(x.clock * 1.2) : 3 * Math.sin(x.clock * 0.8)) * D2R;
                const SV3 = V3(0, Sy, 0);
                G.shake = fx.step(x.dt, pw, toWorld(0, 0, th, SV3), x.km, x.clock);
                hot(entryP(x), x.clock, F);
                chute(t, toWorld(0, csmY(t) - 3.23, th, SV3), x.clock);
                sea.update(x.clock); sea.ship(after); splash.step(x.dt, after);
                if (after > 0) altM += sea.wave(0, 0, x.clock) - 0.5 * sm(0, 1.2, after) + 0.25 * Math.sin(x.clock * 1.3);
                const ref = t < 700 ? V3(0, 0, 0) : t < tUndock ? V3(0, csmY(t), 0) : t < tJett ? V3(0, LMy(t), 0) : V3(0, csmY(t) + 0.28, 0);
                return {
                  th, S: SV3, ref, altM, a, hud, shadow: t < 200 ? 140 : t < tOut + 300 ? 90 : 40,
                  info: t > a0td - 200 && t < tDocked ? `Range ${Math.max(0, -herm(M.td, t - a0td)[0]).toFixed(1)} m` : t > a0dk - 1200 && t < tDock ? `Range ${gapC(t).toFixed(gapC(t) < 100 ? 1 : 0)} m` : "",
                };
              },
            };
          },
        });
      },

      // ---- Artemis II: LC-39B, SLS to orbit, the ICPS raising the orbit, Orion's separation and hand-flown proximity
      // operations, the translunar burn, the far-side flyby, the service module left behind, the skip entry, splashdown off
      // San Diego
      slsflight(c) {
        const { tSep, tTLI, tFB, tEI, tDrogue, tMain, tSplash } = c, aE = info.ascEnd;
        return flight({
          site: { spot: [0.2761, 0.6591], az: 72 }, land: { spot: [0.1708, 0.675], az: 45, t: tSplash, from: tTLI + 30000, to: tEI - 45000 }, sea: true,
          pad: padSLS,
          sun: [[-1e9, [-0.35, 0.58, 0.73]], [600, [-0.4, 0.55, 0.73]], [tFB - 20000, [0.8, 0.35, 0.48]], [tFB + 20000, [-0.4, 0.55, 0.73]], [tEI - 1500, [-0.45, 0.6, 0.5]]],
          cam: [[-1e9, 28, 1.6, 210], [10, 26.6, -4.2, 191], [132, 26.6, -4.2, 172], [496, 26.6, -4.2, 70], [aE - 300, -30, 15, 50], [tSep - 30, -7, 16, 50], [tSep + 400, -35, 17.5, 39], [tFB - 3000, 9, 76, 40], [tFB + 3000, -35, 17.5, 39], [tEI - 1300, -30, 15, 23], [tEI - 100, 34, 12, 30], [tDrogue, 30, 8, 62], [tMain, 35, 3, 110], [tSplash + 4, 35, 3, 55]],
          titles: [[-1e9, "Artemis II · liftoff from LC-39B"], [9, "SLS · ascent to orbit"], [500, "SLS · ICPS and Orion in Earth orbit"], [tSep - 10, "Orion separates from the ICPS"], [tSep + 600, "Orion · high Earth orbit"], [tTLI - 300, "Orion · translunar injection"], [tTLI + 3000, "Orion · outbound coast"], [tFB - 40000, "Lunar flyby · far side"], [tFB + 40000, "Orion · free return"], [tEI - 1300, "Orion · crew module"], [tEI - 60, "Orion · skip entry"], [tDrogue, "Orion · splashdown"], [tSplash + 20, "Orion · awaiting recovery"]],
          events: [[tSep - 5, "Orion still on the ICPS after the apogee raise"], [tSep, "Separation · springs push Orion away"], [tSep + 30, "The crew pitches Orion around to face the spent stage"], [tSep + 50, "Proximity operations · flying Orion by hand"], [tSep + 80, "Holding ~12 m off the ICPS"], [tFB - 930, "Earthset · out of contact behind the Moon"], [tFB, "Closest approach · ~8,000 km above the far side"], [tFB + 930, "Earthrise · signal back · the free return heads home"], [tEI - 1200, "Crew module separates from the service module"], [tEI + 10, "Shock layer near 2,800 °C · blackout"], [tEI + 300, "Skip: Orion's lift carries it back up before the final plunge"], [tDrogue, "Drogue parachutes"], [tMain, "Three main parachutes · ~27 km/h"], [tSplash, "Splashdown off San Diego"], [tSplash + 30, "Uprighting bags inflate · Navy divers approach"]],
          make(W) {
            const s = slsStack(), o = s.o; W.craft.add(s.root);
            const panel = (i) => { const a = s.saj[i].userData.a; return [195, "saj" + i, { v: -0.6, a: -5, side: [Math.sin(a) * 4, Math.cos(a) * 4], spin: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5], pivot: 83.3, hide: 20 }]; };
            const seps = stager(s, [[132, "srbL", { v: -1, a: -6, side: [-3, 0], spin: [0, 0, 0.04], pivot: 27, hide: 60 }], [132, "srbR", { v: -1, a: -6, side: [3, 0], spin: [0, 0, -0.04], pivot: 27, hide: 60 }], panel(0), panel(1), panel(2), [200, "las", { v: 3, a: 35, spin: [0, 0, 0.04], pivot: 93, hide: 12 }], [496, "core", { v: -0.6, a: -1.2, spin: [0.004, 0, 0.008], pivot: 37, hide: 300 }]]);
            const fires = { rs25: [[-6.4, 0], [-5, 1], [483.5, 1], [484.5, 0]], srb: [[-0.2, 0], [0.2, 1], [108, 1], [128, 0.25], [131, 0]], las: [[200, 0], [200.3, 1], [203, 0]], rl10: [[2940, 0], [2941, 1], [2962, 1], [2963, 0], [6480, 0], [6481, 1], [7380, 1], [7381, 0]] };
            const vap = vaporCone(s.root, 52, 4.6), fx = launchFx(W.site, W.P, { trailK: 2 });
            const hot = plasma(o.cm, 2.51, 28, "#ff6a2a"), chute = chuteSet(3, 35, 40, "#e2672a", tDrogue, tMain, tSplash);
            const sea = seaPatch(W.seaG, "#4b5560"), splash = splashFx(W.seaG, 2.5), F = V3(-1, 0, 0);
            const oy0 = o.root.position.y, back = eased([[-1e9, 0], [tTLI - 2500, Math.PI]], 8);
            const att = eased([[-1e9, -Math.PI / 2], [tEI - 1100, Math.PI / 2], [tDrogue, 0]]);
            // Orion's offset from the ICPS along the stack axis: springs push it off, it turns to face the stage, closes to
            // ~12 m, then backs away; later it turns back round for the translunar burn
            const ox = (u) => (u < 0 ? 0 : u < 35 ? 0.7 * u : u < 55 ? 24.5 + 0.3 * (u - 35) : u < 300 ? 30.5 - 18 * sm(55, 90, u) : Math.min(4000, 12.5 + 0.5 * (u - 300) + 0.0005 * (u - 300) ** 2));
            const S = phases([[-1e9, () => 51], [496, () => 77], [tSep, (t) => oy0 + o.orion.position.y - 1.6 * Math.cos(o.orion.rotation.x)], [tEI - 1200, (t) => oy0 + o.orion.position.y + 1.5], [tDrogue, (t) => oy0 + o.orion.position.y + 9], [tMain, (t) => oy0 + o.orion.position.y + 18], [tSplash + 6, (t) => oy0 + o.orion.position.y + 3]]);
            return {
              reset() { fx.reset(); splash.reset(); },
              step(t, x) {
                seps(t);
                const pw = fireAll(s, fires, t, x.thin);
                vap(sm(50, 52, t) * (1 - sm(60, 62, t)));
                o.arrays(sm(1100, 1330, t));
                const u = t - tSep, turn = Math.PI * sm(35, 55, u) + back(x.tau), cc = -2, ct = Math.cos(turn);
                o.orion.position.set(0, ox(u) + cc - cc * ct, -cc * Math.sin(turn)); o.orion.rotation.x = turn;
                o.stage.visible = ox(u) < 3000;
                o.rcs(u > 35 && u < 300 ? 0.18 : 0);
                o.fire(t > tSep && x.fx.includes("burn") ? 1 : 0, 1);
                const ue = t - (tEI - 1200); o.esm.position.y = ue > 0 ? -(0.3 * ue + 0.002 * ue * ue) : 0; o.esm.visible = ue < 400;
                let th = t < aE - 40 ? -pitchAt(x.km) : att(x.tau);
                const after = t - tSplash;
                if (t > tDrogue) th += (after < 0 ? 4 * Math.sin(x.clock * 1.1) : 3 * Math.sin(x.clock * 0.8)) * D2R;
                const SV3 = V3(0, S(t, x.tau), 0), oyw = oy0 + o.orion.position.y;
                G.shake = fx.step(x.dt, pw, toWorld(0, 0, th, SV3), x.km, x.clock);
                hot(entryP(x), x.clock, F);
                chute(t, toWorld(0, oyw + 3.33, th, SV3), x.clock);
                sea.update(x.clock); sea.ship(after); splash.step(x.dt, after);
                const bob = after > 0 ? sea.wave(0, 0, x.clock) - 0.5 * sm(0, 1.2, after) + 0.25 * Math.sin(x.clock * 1.3) : 0;
                return {
                  th, S: SV3, ref: t < 700 ? V3(0, 0, 0) : V3(0, oyw - 0.32, 0), altM: t < 700 ? padAlt(t, x.km, W.P, 0, 4.44) : x.km * 1000 + 1.2 + bob,
                  shadow: t < 200 ? 140 : u > -60 && u < 400 ? 60 : 40,
                  info: u > 5 && u < 400 ? `Gap ${Math.max(0, ox(u) - 4.9).toFixed(1)} m` : "",
                };
              },
            };
          },
        });
      },

      // ---- the booster landings: the cuts away from the flight
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
        // the booster hangs from its holder by its feet (the legs' pads), so touchdown is holder height = deck
        const v = falcon9Booster(), hold = new THREE.Group(); hold.add(v.root); v.root.position.y = -v.legFoot; world.add(hold); v.fins(1);
        exhFloor.y = 3;
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
            const p = lin(thr, t); v.fire(p, 0);
            spray.step(dt, { x: s.pos.x, y: 3.3, z: s.pos.z, r0: 2, rate: s.h < 45 ? p * 500 * (1 - s.h / 45) : 0, speed: 28, up: 6 });
          },
          root: hold,
        };
      },

      sh() {
        const sunDir = V3(0.6, 0.7, 0.5).normalize();
        earthSky(sunDir);
        const base = starbase();
        const v = superHeavy({ frost: false, flown: true }); world.add(v.root);
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
            v.fire13(p13); v.fire3(p13 > 0.02 ? 0 : p3);
            steam.step(dt, { x: s.pos.x, y: 0.5, z: s.pos.z, r0: 8, rate: s.h < 160 ? Math.max(p3, p13) * 600 * (1 - s.h / 160) : 0, speed: 35, up: 8 });
          },
          root: v.root,
        };
      },

    };

    const sc = SCENES[e.id](e.c);
    const dir = V3(...(sc.dir || [1, 0, 0])), axis = new THREE.Vector3().crossVectors(dir, UP), target = new THREE.Vector3();
    const shc = sun.shadow.camera; shc.left = shc.bottom = -sc.shadow; shc.right = shc.top = sc.shadow; shc.near = 1; shc.far = 3000; shc.updateProjectionMatrix();
    // only things that could throw a shadow into the shadow camera's box draw into the shadow map: small parts and
    // far scenery (a water tower 300 m away, planets) don't, and transparent effects never do
    sun.updateMatrixWorld(); scene.updateMatrixWorld(true);
    { const bs = new THREE.Sphere(), box3 = new THREE.Box3(); scene.traverse((o) => {
      if (!o.isMesh || !o.castShadow) return;
      if (o.material.transparent || o.layers.mask === 4) { o.castShadow = false; return; }
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      bs.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if (bs.radius < 0.12 * Math.max(1, sc.shadow / 60) || (!sc.flight && bs.center.distanceTo(sun.target.position) > sc.shadow * 3 + bs.radius)) o.castShadow = false;
    }); }
    // the flight's camera is scripted; dragging and zooming add to it (orbit = offsets, dist a factor)
    const off = V3(...sc.chase), orbit = sc.cam ? { dist: 1, yaw: 0, pitch: 0 } : { dist: off.length(), yaw: Math.atan2(off.x, off.z), pitch: Math.asin(off.y / off.length()) };
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
      } else st = sc.place(s, dt);
      G.shake = 0;
      sc.update(s, st, dt);
      target.copy(st.pos).add(V3(0, (typeof sc.focus === "function" ? sc.focus(s) : sc.focus) || 0, 0));
      sun.position.copy(target).addScaledVector(sc.sunDir, 1200);
      sun.target.position.copy(target);
      hudv = st.alt === undefined ? null : { alt: st.alt, vel: st.vel, ref: st.ref ?? e.m.ref ?? "" };
      let ev = st.ev ?? "";
      if (st.ev === undefined) for (const [et, txt] of sc.events) if (s >= et - 1e-6) ev = txt;
      if (capE.textContent !== ev) capE.textContent = ev;
      const inf = st.info !== undefined ? st.info : sc.info ? sc.info(st) : "";
      if (capI.textContent !== inf) capI.textContent = inf;
    }
    function aim() {
      // long shots turn with the wall clock (their mission clock can run thousands of times too fast), set pieces with the mission clock
      let yaw, d, pitch;
      if (sc.cam) { const k = sc.cam(ss); yaw = k.yaw + orbit.yaw; d = k.dist * orbit.dist; pitch = Math.max(-1.45, Math.min(1.45, k.pitch + orbit.pitch)); }
      else { yaw = orbit.yaw + (sc.spin || 0) * ss; d = orbit.dist * (sc.zoom ? sc.zoom(ss) : 1); pitch = Math.min(1.45, orbit.pitch + (sc.lift ? sc.lift(ss) : 0)); }
      const cp = Math.cos(pitch);
      camera.position.set(target.x + d * cp * Math.sin(yaw), target.y + d * Math.sin(pitch), target.z + d * cp * Math.cos(yaw));
      if (sc.floor !== undefined) camera.position.y = Math.max(sc.floor, camera.position.y);
      if (sc.cam) { const g = sc.ground(), v = camera.position.clone().sub(g.c); if (v.length() < g.r) camera.position.copy(g.c).addScaledVector(v.normalize(), g.r); }
      // shake: a smooth rumble on the wall clock (random jitter per frame reads as stutter)
      const j = G.shake * d * 0.003, c = G.rt;
      const jit = V3(j * (Math.sin(c * 31) + Math.sin(c * 19.3 + 1.7)), j * (Math.sin(c * 27.1 + 0.4) + Math.sin(c * 23.9 + 2.2)), 0);
      camera.position.add(jit);
      camera.lookAt(target.clone().add(jit));
      camera.updateMatrixWorld();
      for (const f of sunViews) f(sc.sunDir);
    }
    return { scene, frame, aim, orbit, pmin: sc.cam ? -1.4 : sc.pmin ?? (sc.space ? -1.45 : -0.1), pmax: sc.cam ? 1.4 : 1.45, dl: sc.cam ? [0.1, 15] : [4, 4000], title: sc.title, reset: () => sc.reset && sc.reset() };
  }

  function render() {
    const e = cur;
    if (!e || !e.R) return;
    const w = el.clientWidth, hh = el.clientHeight;
    if (!w || !hh) return;
    const { renderer, camera, composer, pass } = G;
    if (G.w !== w || G.h !== hh) { G.w = w; G.h = hh; renderer.setSize(w, hh, false); composer.setSize(w, hh); camera.aspect = w / hh; camera.updateProjectionMatrix(); const pr = renderer.getPixelRatio(); G.fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (hh * pr)); }
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
    o.pitch = Math.min(cur.R.pmax, Math.max(cur.R.pmin, o.pitch + (ev.clientY - drag[1]) * 0.006));
    drag = [ev.clientX, ev.clientY];
    render();
  });
  el.addEventListener("pointerup", () => { drag = null; el.classList.remove("drag"); });
  el.addEventListener("wheel", (ev) => { ev.preventDefault(); ev.stopPropagation(); if (!cur?.R) return; const o = cur.R.orbit; o.dist = Math.min(cur.R.dl[1], Math.max(cur.R.dl[0], o.dist * Math.exp(ev.deltaY * 0.0012))); render(); }, { passive: false });
  window.__land = () => ({ cur, G, SC, FL, THREE }); // for poking at the live view from the console

  return {
    // mission-clock speed while a scene is up (0 = not in a scene)
    // set pieces run at their own pace for their scripted length; long shots and held set pieces keep the mission's warp
    speedAt,
    on: (t) => { const e = !dead && find(t); return !!e && !e.failed; },
    hud: () => hudv,
    draw,
  };
  // call every flight frame with the mission clock; -Infinity hides it
  function draw(t) {
    if (t > -Infinity) load();
    const e = t > -Infinity && !dead ? find(t) : null;
    if (e && THREE) ensure(e);
    const vis = !!e && !e.failed;
    if (el.hidden === vis) el.hidden = !vis;
    waitT = null;
    if (!vis) { cur = null; lastS = null; hudv = null; return; }
    if (!e.R) { cur = null; lastS = null; waitT = t; capT.textContent = "Loading 3-D view…"; capE.textContent = capI.textContent = ""; return; }
    const now = performance.now(), rdt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
    lastNow = now;
    if (cur !== e) { cur = e; lastS = null; cutAt = now; }
    const s = t - e.a0;
    if (lastS !== null && s < lastS) e.R.reset();
    // a seek jumps further than a frame can at this speed: don't let the particles see it as elapsed time
    const fwd = lastS !== null && s > lastS, dt = fwd && s - lastS <= info.speed(t) * 0.25 ? s - lastS : 0;
    if (fwd) G.rt += rdt;
    G.clock.value = G.rt;
    lastS = s;
    // every cut is the same quick fade up from black, and only while playing (a paused seek shows the frame at once)
    G.renderer.domElement.style.opacity = info.playing() ? Math.min(1, (now - cutAt) / 350).toFixed(3) : "1";
    const ti = e.R.title ? e.R.title(s) || e.m.title : !e.span && s > e.m.dur && e.m.held ? e.m.held : e.m.title;
    if (capT.textContent !== ti) capT.textContent = ti;
    e.R.frame(s, dt);
    render();
    adapt(now);
  }
}

export const LAND_RUNTIME = makeLand.toString() + ";\n" + MODELS_RUNTIME;
