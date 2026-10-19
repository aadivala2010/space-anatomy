// The launch player in 3-D. A vehicle's mission script sets LANDINGS = [...]: set pieces { id, at } (at = the mission time
// a scene's key moment lines up with, optional `to` to hold the shot longer), long shots { id, from, to }, and one
// { id: "coast", craft } whose free-flight shots fill every gap, so a three.js view covers the stage for the whole flight.
// makeLand is shipped to the page as source (makeLand.toString()), so it must not use anything from this module.

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

// info: { start, end, hud(t) -> { alt km, vel km/h, ref, de, dm }, fx(t) -> ["burn", "chute1", ...], pose(t), speed(t), playing() }
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
    dsplash: { touch: 36, dur: 54, speed: 1, hud: 1, title: "Crew Dragon · splashdown", held: "Crew Dragon · awaiting recovery" },
    sh: { touch: 30.8, dur: 36, speed: 1, hud: 1, title: "Booster catch · Starbase tower" },
    pez: { touch: 6, dur: 64, speed: 2, title: "Starship · Starlink deploy" },
    sentry: { touch: 30, dur: 70, speed: 3, title: "Starship · belly-first entry" },
    scatch: { touch: 29.5, dur: 36, speed: 1, hud: 1, title: "Ship catch · flip and landing burn", held: "Ship · back on the tower" },
    td: { touch: 112, dur: 140, speed: 4, title: "Transposition, docking & extraction" },
    lm: { touch: tLM + 1.1, dur: 156, speed: 4, hud: 1, ref: MOON, title: "Eagle · powered descent", held: "Eagle · Tranquility Base" },
    lmasc: { touch: 3, dur: 40, speed: 1, ref: MOON, title: "Eagle · lunar liftoff" },
    lmdock: { touch: 120, dur: 140, speed: 4, title: "Lunar orbit rendezvous · docking" },
    aentry: { touch: 30, dur: 70, speed: 3, title: "Columbia · entry at 11 km/s" },
    asplash: { touch: 35, dur: 52, speed: 1, hud: 1, title: "Columbia · splashdown", held: "Columbia · awaiting USS Hornet" },
    osep: { touch: 5, dur: 100, speed: 3, title: "Orion separates from the ICPS" },
    flyby: { touch: 2000, dur: 4000, speed: 200, title: "Lunar flyby · far side" },
    oentry: { touch: 30, dur: 70, speed: 3, title: "Orion · skip entry" },
    osplash: { touch: 35, dur: 52, speed: 1, hud: 1, title: "Orion · splashdown", held: "Orion · awaiting recovery" },
    f9pad: { title: "Falcon 9 · liftoff from LC-39A" }, f9asc: { title: "Falcon 9 · ascent to orbit" },
    shpad: { title: "Starship · liftoff from Starbase" }, shasc: { title: "Starship · ascent and hot staging" },
    svpad: { title: "Apollo 11 · liftoff from LC-39A" }, svasc: { title: "Saturn V · ascent and translunar injection" },
    slspad: { title: "Artemis II · liftoff from LC-39B" }, slsasc: { title: "SLS · ascent to high Earth orbit" },
    coast: { title: "" },
  };
  const SC = [];
  for (const c of list) {
    const m = META[c.id];
    if (!m || c.id === "coast") continue;
    const span = c.from !== undefined, a0 = span ? c.from : c.at - m.touch;
    SC.push({ id: c.id, c, m, span, motion: span ? null : M[c.id], a0, a1: span ? c.to : c.to ?? a0 + m.dur, R: null });
  }
  SC.sort((a, b) => a.span - b.span); // set pieces win where they overlap a long shot
  // free flight fills every gap, so nothing of the flat figure shows between shots
  const free = list.find((c) => c.id === "coast");
  if (free) {
    let t = info.start;
    for (const [a, b] of SC.map((x) => [x.a0, x.a1]).sort((p, q) => p[0] - q[0])) { if (a > t + 1e-6) SC.push({ id: "coast", c: free, m: META.coast, span: true, a0: t, a1: a, R: null }); t = Math.max(t, b); }
    if (t < info.end) SC.push({ id: "coast", c: free, m: META.coast, span: true, a0: t, a1: info.end, R: null });
  }
  // a free-flight gap the viewer would see for under ~10 s goes to the shot before it, so cuts don't come in bursts
  // (done on first use: the player's clock speed isn't known while makeLand runs)
  let merged = false, merging = false;
  function merge() {
    merged = merging = true;
    for (const g of SC.filter((x) => x.id === "coast")) {
      let wall = 0;
      for (let i = 0, n = 200, d = (g.a1 - g.a0) / n; i < n; i++) wall += d / Math.max(1e-3, info.speed(g.a0 + (i + 0.5) * d));
      const p = wall < 10 && SC.filter((x) => x !== g && Math.abs(x.a1 - g.a0) < 1e-6).sort((a, b) => a.span - b.span)[0];
      if (p) { p.a1 = g.a1; SC.splice(SC.indexOf(g), 1); }
    }
    merging = false;
  }
  const find = (t) => { if (!merged) merge(); return SC.find((e) => t >= e.a0 && t <= e.a1); };

  // ---- overlay (one for all scenes)
  const el = document.createElement("div");
  el.className = "land"; el.hidden = true;
  el.innerHTML = '<div class="land-cap"><b></b><span></span><em></em><i>3-D view · drag to orbit · scroll to zoom</i></div>';
  stage.querySelector(".fx-flash").after(el);
  const capT = el.querySelector("b"), capE = el.querySelector("span"), capI = el.querySelector("em");

  let THREE = null, X = null, loading = null, G = null, cur = null, lastS = null, hudv = null, dead = false, cutAt = 0, lastNow = 0;
  // adaptive resolution: the pixel ratio steps down while frames arrive slower than the display wants them, and creeps
  // back up when there is headroom (ema = smoothed frame interval, min = the display's own interval, ms)
  const DRS = { pr: 1, ema: 0, min: 1e9, last: 0, at: 0, hold: 0 };
  function adapt(now) {
    const dt = now - DRS.last;
    DRS.last = now;
    if (!info.playing() || document.hidden || dt <= 0 || dt > 250) return; // pauses, seeks and stalls say nothing about the GPU
    DRS.min = Math.min(DRS.min * 1.001, Math.max(4, dt));
    DRS.ema = DRS.ema ? DRS.ema + (dt - DRS.ema) * 0.08 : dt;
    if (now - DRS.at < 1200) return;
    const goal = Math.max(16.7, DRS.min), top = Math.min(devicePixelRatio, 2);
    let pr = DRS.pr;
    if (DRS.ema > goal * 1.3 && pr > 0.55) { pr = Math.max(0.55, pr * 0.84); DRS.hold = now + 20000; }
    else if (DRS.ema < goal * 1.08 && pr < top && now > DRS.hold) pr = Math.min(top, pr * 1.12);
    else return;
    DRS.pr = pr; DRS.at = now; DRS.ema = 0;
    G.renderer.setPixelRatio(pr); G.composer.setPixelRatio(pr); G.w = 0; // render() resizes the targets
  }
  function load() {
    const U = "https://cdn.jsdelivr.net/npm/three@0.160.0/", J = U + "examples/jsm/postprocessing/";
    loading ||= Promise.all([U + "+esm", J + "EffectComposer.js/+esm", J + "RenderPass.js/+esm", J + "UnrealBloomPass.js/+esm", J + "OutputPass.js/+esm"].map((u) => import(u)))
      .then(([T, ...adds]) => { THREE = T; X = Object.assign({}, ...adds); G = shared(); prebuild(); })
      .catch((e) => { dead = true; console.warn("3-D views unavailable:", e); });
  }
  // build the scenes in the background, one at a time, so entering a window doesn't stall
  function prebuild() { const next = () => { const e = SC.slice().sort((a, b) => a.a0 - b.a0).find((x) => !x.R && !x.failed); if (!e) return; ensure(e); setTimeout(next, 60); }; setTimeout(next, 60); }
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
    const composer = new X.EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    const pass = new X.RenderPass(new THREE.Scene(), camera);
    composer.addPass(pass);
    // bloom works from a half-size copy: a glow doesn't need full resolution and this is the costliest pass
    const bloom = new X.UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 1.25), bloomSize = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => bloomSize(Math.max(2, w >> 1), Math.max(2, h >> 1));
    composer.addPass(bloom);
    composer.addPass(new X.OutputPass());
    const pmrem = new THREE.PMREMGenerator(renderer), loader = new THREE.TextureLoader(), cache = {};
    loader.setCrossOrigin("anonymous");
    return {
      renderer, camera, composer, pass, pmrem, w: 0, h: 0, shake: 0, rt: 0,
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
      // wd widens the plume (it balloons in thin air), ln stretches it
      const set = (p, wd = 1, ln = 1) => { g.visible = sp.visible = p > 0.02; g.scale.set(wd, len * ln * p * (0.93 + 0.07 * Math.random()), wd); sp.material.opacity = 0.7 * opacity * p; };
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
        step(dt, src) { // src: {x, y, z, r0, rate, speed, up, burst, dir: [dx, dz] + cone (radians) for a one-sided jet}
          if (dt <= 0) return;
          acc += src.rate * dt + (src.burst || 0);
          for (; acc >= 1; acc--) {
            const i = head++ % n, a = src.dir ? Math.atan2(src.dir[1], src.dir[0]) + (Math.random() - 0.5) * (src.cone || 0.6) : Math.random() * Math.PI * 2, s = src.speed * (0.4 + 0.8 * Math.random());
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
float f = pow(clamp(1.0 - dot(vN, vV), 0.0, 1.0), p); float day = smoothstep(-0.3, 0.3, dot(vW, sunW));
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
      // move it: `alt` m below/away along `dir`, shrunk (same angular size) when far so it stays inside the depth range
      const place = (alt, dir = dn) => { const d = R0 + alt, kk = Math.min(1, 2.5e7 / d); g.scale.setScalar(kk); g.position.copy(dir).normalize().multiplyScalar(d * kk); };
      // roll the ground by an arc length (m) along +x
      const roll = (x) => { spin.quaternion.setFromAxisAngle(axis, x / R0).multiply(Q); };
      return { g, set, place, roll };
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
      g.strokeStyle = "rgba(70,74,80,.2)"; g.lineWidth = 2;
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
      const hull = [cyl(4.5, 4.5, 1.6, 40, skin, body, 96)];
      const nose = []; for (let i = 0; i <= 18; i++) { const f = i / 18; nose.push([4.5 * Math.pow(Math.max(0, 1 - f * f), 0.55), 40 + 10.3 * f]); }
      hull.push(lathe(nose, skin, body, 96));
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
      return { root, body, hull, fires, door, flaps: (k, c) => flaps.forEach(([pv, s], i) => (pv.rotation.y = s * (k + 0.06 * Math.sin(c * 2 + i)))) };
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
      const wings = [];
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2, h = new THREE.Group(); h.rotation.y = -a; h.position.y = -2.0; orion.add(h); wings.push(h);
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
      const fire = plume(orion, 0, -7.0, 0, 0.9, 16, "#ffd9b0", { spread: 3, opacity: 0.3 }), rl10 = stage ? plume(stage, 0, -17.6, 0, 1.0, 30, "#cfdcff", { spread: 3, opacity: 0.35 }) : () => {};
      // arrays: 0 = folded inside the fairing, 1 = deployed into the X
      const arrays = (k) => wings.forEach((h) => { h.scale.set(Math.max(0.02, k), 1, 1); h.visible = k > 0.01; });
      return { root, orion, stage, rcs, top: 3.33, fire, rl10, arrays };
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
    // ---- entry plasma (world frame; F = the downstream direction)
    const LOGV = "#include <common>\n#include <logdepthbuf_pars_vertex>\n", LOGF = "#include <common>\n#include <logdepthbuf_pars_fragment>\n";
    // ribbons of glowing gas that peel off the windward edges and stream downstream, white-hot at the hull, cooling to c2
    function streaks(seeds, { F, len, spread, w, c1, c2, per = 2, k = 3 }) {
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
      const uni = { uF: { value: F.clone().normalize() }, uLen: { value: len }, uSpread: { value: spread }, uW: { value: w }, uT: { value: 0 }, uP: { value: 1 }, uC1: { value: new THREE.Color(c1).multiplyScalar(k) }, uC2: { value: new THREE.Color(c2).multiplyScalar(k) } };
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: LOGV + `attribute vec3 aOut; attribute float aU, aSide, aSeed;
uniform vec3 uF; uniform float uLen, uSpread, uW, uT;
varying float vU, vS, vSeed;
vec3 sn(vec3 v) { float l = length(v); return l > 1e-5 ? v / l : vec3(0.0, 1.0, 0.0); }
void main() {
  float u = aU, l = uLen * (0.45 + 0.8 * aSeed);
  vec3 cr = sn(cross(uF, aOut));
  vec3 p = position + uF * l * u + aOut * uSpread * pow(max(u, 1e-4), 1.3) * (0.4 + aSeed)
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
      m.frustumCulled = false; world.add(m);
      return (p, t) => { uni.uP.value = p; uni.uT.value = t; m.visible = p > 0.01; };
    }
    // a thin glowing layer just off a hull surface: brightest where it faces the flow and at its silhouette
    function hotShell(src, F, c, k = 2.5, d = 0.25) {
      const g = src.geometry.clone(), P = g.attributes.position, N = g.attributes.normal;
      for (let i = 0; i < P.count; i++) if (Number.isFinite(N.getX(i) + N.getY(i) + N.getZ(i))) P.setXYZ(i, P.getX(i) + N.getX(i) * d, P.getY(i) + N.getY(i) * d, P.getZ(i) + N.getZ(i) * d);
      const uni = { uF: { value: F.clone().normalize() }, uC: { value: new THREE.Color(c).multiplyScalar(k) }, uP: { value: 1 }, uT: { value: 0 } };
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
      return (p, t) => { uni.uP.value = p; uni.uT.value = t; m.visible = p > 0.01; };
    }
    // capsule entry: shock layer on the heat shield, streaks off its rim, ablation sparks (flowFrame: +y = downstream)
    function plasma(capFrame, flowFrame, R, len, hot) {
      const shock = mesh(new THREE.SphereGeometry(R * 1.12, 64, 16, 0, TAU, Math.PI / 2, Math.PI / 2), glow(hot, 2.6, { opacity: 0.8 }), capFrame, 0, -0.08, 0); shock.scale.y = 0.3; shock.castShadow = false;
      const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(hot).multiplyScalar(1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); core.scale.setScalar(R * 3.2); core.position.y = -0.3; capFrame.add(core);
      capFrame.updateMatrixWorld(true); flowFrame.updateMatrixWorld(true);
      const F = V3(0, 1, 0).transformDirection(flowFrame.matrixWorld), seeds = [];
      for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU; seeds.push({ p: capFrame.localToWorld(V3(Math.cos(a) * R, 0.08, Math.sin(a) * R)), out: V3(Math.cos(a), 0, Math.sin(a)).transformDirection(capFrame.matrixWorld) }); }
      const tr = streaks(seeds, { F, len: len * 2.4, spread: R * 1.8, w: R * 0.06, c1: hot, c2: "#ff3d7a", per: 1, k: 1.1 });
      const N = 500, pos = new Float32Array(N * 3), ph = Array.from({ length: N }, () => [Math.random(), Math.random() * TAU, 1 + Math.random()]);
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const sparks = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color("#ffc890").multiplyScalar(3), size: R * 0.07, map: dotTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sparks.frustumCulled = false; flowFrame.add(sparks);
      return (p, c) => {
        for (const m of [shock, core, sparks]) m.visible = p > 0.01;
        const f = 0.92 + 0.08 * Math.random();
        shock.material.opacity = 0.8 * p * f; core.material.opacity = 0.7 * p * f;
        tr(p, c);
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
      const [near, far] = world.children.slice(-2); near.position.z = 26000; far.position.z = 200700;
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

    // plasma 0..1: the scripted curve for a set piece; from the speed and height on the mission profile for a long shot
    const entryGlow = (s, rows) => {
      if (!e.span) return lin(rows, s);
      const h = info.hud(e.a0 + s), c = (x) => Math.min(1, Math.max(0, x));
      return c((h.vel - 9000) / 14000) * c((118 - h.alt) / 20) * c((h.alt - 22) / 10);
    };
    function entryScene({ cap, len, hot, spot, events, aoa = 20, chase = [16, 6, 24] }) {
      const sunDir = V3(-0.3, 0.55, 0.78).normalize();
      spaceSky(sunDir, "#3b6d9e");
      const E = planet("earth", 78e3, { spot, speed: 7200 });
      const v = cap(); world.add(v.root);
      v.root.rotation.z = Math.PI / 2 - aoa * D2R; // heat shield into the flow (+x), trimmed by the offset centre of mass
      const flow = new THREE.Group(); flow.rotation.z = Math.PI / 2; world.add(flow);
      const fx = plasma(v.root, flow, v.R, len, hot);
      return {
        chase, focus: 0, shadow: 20, sunDir, events: e.span ? [] : events, space: true, spin: 0.004,
        place: () => ({ pos: V3(0, 0, 0) }),
        update(t, s, dt) { E.set(t); if (e.span) E.place(info.hud(e.a0 + t).alt * 1000); this.c = (this.c || 0) + dt; const p = entryGlow(t, [[0, 0.7], [30, 1], [70, 0.8]]); fx(p, this.c); v.root.position.set((Math.random() - 0.5) * 0.02 * p, (Math.random() - 0.5) * 0.02 * p, 0); },
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

    // ================================================================ launch day (metres, +y up, vehicle axis at x = z = 0)
    // artwork painted on a body of revolution: an open slice of radius r (rb at the bottom) between y0 and y1, centred on
    // angle a (0 = facing +z, growing toward +x), `arc` radians wide; draw(g, w, h) paints a transparent canvas
    function decal(parent, r, y0, y1, a, arc, w, hh, draw, rb = r) {
      const m = mesh(new THREE.CylinderGeometry(r, rb, y1 - y0, 32, 1, true, a - arc / 2, arc), new THREE.MeshStandardMaterial({ map: tex(w, hh, draw), transparent: true, alphaTest: 0.04, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }), parent, 0, (y0 + y1) / 2, 0);
      m.castShadow = false; return m;
    }
    // letters stacked top to bottom, upright
    const vtext = (txt, col, font) => (g, w, hh) => { g.fillStyle = col; g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; const n = txt.length; for (let i = 0; i < n; i++) g.fillText(txt[i], w / 2, ((i + 0.5) * hh) / n); };
    // a word turned on its side, reading top to bottom
    const rtext = (txt, col, font, sx = 1) => (g, w, hh) => { g.save(); g.font = font; const k = Math.min(1, (hh * 0.94) / (g.measureText(txt).width * sx)); g.translate(w / 2, hh / 2); g.rotate(Math.PI / 2); g.scale(sx * k, k); g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 0, 0); g.restore(); };
    function flag(g, x, y, w, hh) {
      for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? "#fff" : "#b22234"; g.fillRect(x, y + (i * hh) / 13, w, hh / 13 + 0.5); }
      g.fillStyle = "#3c3b6e"; g.fillRect(x, y, w * 0.4, (hh * 7) / 13);
      g.fillStyle = "#fff"; for (let i = 0; i < 50; i++) g.fillRect(x + w * 0.02 + (i % 10) * w * 0.037, y + hh * 0.03 + Math.floor(i / 10) * hh * 0.1, w * 0.012, hh * 0.03);
    }
    const flagArt = (g, w, hh) => flag(g, 0, 0, w, hh);
    function meatball(g, cx, cy, r) {
      g.fillStyle = "#0b3d91"; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = r * 0.03; g.beginPath(); g.ellipse(cx, cy, r * 0.75, r * 0.28, -0.35, 0, TAU); g.stroke();
      g.fillStyle = "#fc3d21"; g.beginPath(); g.moveTo(cx - r * 0.9, cy + r * 0.35); g.quadraticCurveTo(cx, cy - r * 0.05, cx + r * 0.85, cy - r * 0.55); g.lineTo(cx + r * 0.2, cy - r * 0.05); g.quadraticCurveTo(cx - r * 0.2, cy + r * 0.2, cx - r * 0.9, cy + r * 0.35); g.fill();
      g.fillStyle = "#fff"; g.font = `bold ${r * 0.42}px Helvetica,Arial,sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("NASA", cx, cy + r * 0.02);
    }
    const WORM = "900 120px 'Arial Rounded MT Bold','Helvetica Rounded',Arial,sans-serif";
    const tankLines = (key, base, line, n, ny = 0) => once(key, () => tex(1024, 1024, (g, w, hh) => { // panel seams on a tank
      g.fillStyle = base; g.fillRect(0, 0, w, hh);
      const r = rng(17); for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(0,0,0,${0.02 * r()})`; g.fillRect(r() * w, r() * hh, 6 + 30 * r(), 2 + 30 * r()); }
      g.strokeStyle = line; g.lineWidth = 2; for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo((i * w) / n, 0); g.lineTo((i * w) / n, hh); g.stroke(); }
      for (let j = 1; j < ny; j++) { g.beginPath(); g.moveTo(0, (j * hh) / ny); g.lineTo(w, (j * hh) / ny); g.stroke(); }
    }));
    const bell = (r0, r1, len, seg = 40) => new THREE.LatheGeometry([[r1, -len], [r1 * 0.82, -len * 0.55], [r0 * 1.25, -len * 0.12], [r0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), seg);
    const engM = () => std("#4a4744", { metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });

    // ---- Falcon 9 Block 5 + Crew Dragon: booster feet at 0, interstage to 50.8, second stage to 63, Dragon to ~70.6
    function f9Stack() {
      const root = new THREE.Group(), b = falcon9Booster(); root.add(b.root);
      const vfont = "italic 900 150px 'Arial Black',Arial,sans-serif";
      decal(b.root, 1.845, 26, 41, 0.2, 0.7, 128, 1024, rtext("SPACEX", "#16181b", vfont, 1.2));
      decal(b.root, 1.845, 12, 19.5, 0.2, 0.7, 128, 512, rtext("NASA", "#e03c31", WORM));
      decal(b.root, 1.845, 42, 43.6, -0.5, 0.5, 190, 100, flagArt);
      const fire = plume(b.root, 0, 1.4, 0, 1.75, 50, "#ffb35a", { spread: 1.3, k: 2.2, halo: 2.5 });
      const s2 = new THREE.Group(); root.add(s2);
      cyl(1.83, 1.83, 50.8, 63, std("#ffffff", { map: tankLines("f9s2", "#f1f2f3", "rgba(0,0,0,.08)", 12, 3), roughness: 0.45 }), s2, 64);
      cyl(1.86, 1.86, 62.6, 63.0, std("#2a2c30", { roughness: 0.5 }), s2, 64);
      decal(s2, 1.845, 53, 61, 0.2, 0.55, 128, 512, rtext("SPACEX", "#16181b", vfont, 1.2));
      mesh(bell(0.45, 1.5, 6.4), std("#3b3f45", { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }), s2, 0, 49.8, 0); // MVac niobium nozzle extension, inside the interstage
      cyl(0.5, 0.45, 49.8, 50.8, engM(), s2, 24);
      const mvac = plume(s2, 0, 43.4, 0, 1.45, 70, "#ffbd8a", { spread: 3.4, opacity: 0.22, k: 1.6, halo: 3 });
      const d = crewDragon(); d.root.position.y = 63 + 3.78; root.add(d.root);
      return { root, len: 70.6, parts: { booster: b.root, s2, dragon: d.root }, fires: { m1d: fire, mvac }, dragon: d, legs: b.legs };
    }

    // ---- Starship: Super Heavy (0 to 72.5 incl. the hot-staging ring) and Ship on top (to ~122.8)
    function starshipStack() {
      const root = new THREE.Group(), sh = superHeavy(), ship = starshipShip(); root.add(sh.root, ship.root); ship.root.position.y = 72.5; ship.root.rotation.y = Math.PI * 0.75;
      const dark = std("#202226", { metalness: 0.4, roughness: 0.5 });
      for (let i = 0; i < 24; i++) { const a = (i * TAU) / 24, h = new THREE.Group(); h.rotation.y = a; sh.root.add(h); box(0.5, 2.4, 0.2, std("#0a0a0c"), h, 0, 70.9, 4.56); } // hot-staging vents
      for (let i = 0; i < 2; i++) rod([Math.cos(i * 2.2) * 4.6, 4, Math.sin(i * 2.2) * 4.6], [Math.cos(i * 2.2) * 4.6, 68, Math.sin(i * 2.2) * 4.6], 0.28, dark, sh.root); // chines / conduits
      const big = plume(sh.root, 0, -0.6, 0, 4.3, 80, "#ff9c5a", { spread: 1.3, k: 2.2, halo: 2 });
      const rv = [0, 1, 2].map((i) => { const b2 = (i * TAU) / 3 + Math.PI / 3; return plume(ship.body, Math.cos(b2) * 3, -2.1, Math.sin(b2) * 3, 1.05, 55, "#ffb0c8", { spread: 3, opacity: 0.35, k: 2.4 }); });
      const shipFire = (p) => { ship.fires.forEach((f) => f(p)); };
      return { root, len: 122.8, parts: { booster: sh.root, ship: ship.root }, fires: { booster: (p, w, l) => { big(p, w, l); sh.fires.forEach((f) => f(p * 0.6, w, l)); }, ship: shipFire, rvac: (p, w, l) => rv.forEach((f) => f(p, w, l)) }, ship };
    }

    // ---- Saturn V (Apollo 11): F-1 nozzle exits at 0; S-IC 5 to 47.1; S-II interstage to 52.6; S-II to 72; S-IVB aft
    // interstage to 77.5; S-IVB to 89.8; IU to 90.7; SLA to 99.2; CSM; boost cover and escape tower to ~116.6
    function saturnV() {
      const root = new THREE.Group(), R1 = 5.05, R3 = 3.3;
      const white = std("#f3f3ef", { roughness: 0.5 }), black = std("#17181a", { roughness: 0.55 }), grey = std("#9da1a6", { metalness: 0.5, roughness: 0.4 });
      const s1 = new THREE.Group(), inter = new THREE.Group(), s2 = new THREE.Group(), s4b = new THREE.Group(), les = new THREE.Group(); root.add(s1, inter, s2, s4b, les);
      // S-IC: roll pattern at the base, intertank and forward skirt; "UNITED STATES" down the side, the flag above it
      const sic = once("sic", () => tex(1024, 2048, (g, w, hh) => {
        g.fillStyle = "#f3f3ef"; g.fillRect(0, 0, w, hh);
        const Y = (y) => (1 - (y - 5) / 42.1) * hh;
        const quarters = (y0, y1, odd) => { for (let q = 0; q < 4; q++) if ((q % 2) === odd) { g.fillStyle = "#17181a"; g.fillRect((q * w) / 4, Y(y1), w / 4, Y(y0) - Y(y1)); } };
        quarters(5, 12.6, 1); quarters(25.8, 30.2, 0); quarters(44.4, 47.1, 1);
        g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 2; for (let i = 0; i < 64; i++) { const x = (i * w) / 64; g.beginPath(); g.moveTo(x, Y(30.2)); g.lineTo(x, Y(44.4)); g.stroke(); }
        for (const y of [12.6, 25.8, 30.2, 44.4]) { g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, Y(y) - 2, w, 4); }
        g.fillStyle = "#17181a"; g.font = "bold 66px Helvetica,Arial,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        "UNITED STATES".split("").forEach((c, i) => g.fillText(c, w * 0.875, Y(39.5 - i * 1.85)));
        flag(g, w * 0.875 - 70, Y(43.6), 140, Y(41.6) - Y(43.6));
      }));
      const sicM = std("#ffffff", { map: sic, roughness: 0.5 });
      cyl(R1, R1, 5, 47.1, sicM, s1, 96).rotation.y = Math.PI / 4; // texture u = 0.875 faces +z
      mesh(new THREE.CylinderGeometry(R1, R1, 0.25, 96), black, s1, 0, 5.1, 0);
      const f1 = bell(0.6, 1.85, 5.0, 36), f1M = std("#3e3b38", { metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
      const eng = [[0, 0]]; for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; eng.push([Math.cos(a) * 3.25, Math.sin(a) * 3.25]); }
      for (const [x, z] of eng) { mesh(f1, f1M, s1, x, 5.0, z); mesh(new THREE.TorusGeometry(1.85, 0.08, 8, 40).rotateX(Math.PI / 2), f1M, s1, x, 0.02, z); }
      for (let i = 1; i < 5; i++) { // engine fairings and fins on the outboard engines
        const [x, z] = eng[i], a = Math.atan2(z, x), h = new THREE.Group(); h.rotation.y = -a; s1.add(h);
        mesh(new THREE.CylinderGeometry(1.6, 1.1, 3.2, 32, 1, false, 0, TAU), white, h, 4.25, 3.6, 0);
        const fs = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(3.6, 0), new THREE.Vector2(3.6, 1.7), new THREE.Vector2(0, 6.5)]);
        mesh(new THREE.ExtrudeGeometry(fs, { depth: 0.24, bevelEnabled: false }), white, h, R1 - 0.1, 2.0, -0.12);
      }
      const f1fire = plume(s1, 0, -0.4, 0, 6.3, 95, "#ffa646", { spread: 1.3, k: 2.3, halo: 1.6 });
      // S-II interstage (dropped 30 s after staging), with its eight ullage motors
      cyl(R1, R1, 47.1, 52.6, white, inter, 96);
      for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8 + 0.2, h = new THREE.Group(); h.rotation.y = a; inter.add(h); cyl(0.22, 0.32, 47.6, 50.4, white, h, 12).position.z = R1 + 0.15; }
      // S-II
      cyl(R1, R1, 52.6, 72, std("#ffffff", { map: tankLines("s2", "#f2f2ee", "rgba(0,0,0,.07)", 24, 4), roughness: 0.5 }), s2, 96);
      mesh(new THREE.CylinderGeometry(R1 + 0.03, R1 + 0.03, 0.5, 96), black, s2, 0, 71.6, 0);
      decal(s2, R1 + 0.03, 57, 66, 0, 0.5, 128, 512, vtext("USA", "#17181a", "bold 150px Helvetica,Arial,sans-serif"));
      const j2 = bell(0.3, 1.0, 3.0, 28);
      for (const [x, z] of eng) mesh(j2, f1M, s2, x * 0.55, 52.6, z * 0.55);
      const j2fire = plume(s2, 0, 49.5, 0, 3.0, 70, "#ffd7b0", { spread: 2.6, opacity: 0.32, k: 2.4 });
      lathe([[R1, 72], [R1 - 0.1, 72.4], [R3 + 0.05, 77.5]], white, s2, 96); // S-IVB aft interstage stays with the S-II
      // S-IVB, instrument unit, the fixed bottom of the adapter, Eagle inside it
      const s4t = once("s4b2", () => tex(1024, 1024, (g, w, hh) => {
        g.fillStyle = "#f3f3ef"; g.fillRect(0, 0, w, hh);
        g.fillStyle = "#17181a"; for (let q = 0; q < 4; q += 2) g.fillRect(((q + 0.5) * w) / 4, hh * 0.8, w / 4, hh * 0.2);
        g.font = "bold 150px Helvetica,Arial,sans-serif"; g.textAlign = "center"; "USA".split("").forEach((c, i) => g.fillText(c, w * 0.5, hh * (0.22 + i * 0.18)));
      }));
      cyl(R3, R3, 77.5, 89.8, std("#ffffff", { map: s4t, roughness: 0.5 }), s4b, 96).rotation.y = Math.PI; // u = 0.5 faces +z
      mesh(bell(0.35, 1.0, 2.9, 28), f1M, s4b, 0, 77.5, 0);
      const s4fire = plume(s4b, 0, 74.6, 0, 1.0, 40, "#ffd7b0", { spread: 3.2, opacity: 0.32, k: 2.4 });
      cyl(R3, R3, 89.8, 90.7, std("#ffffff", { map: tankLines("iu", "#dfe0dc", "rgba(0,0,0,.25)", 16), metalness: 0.3, roughness: 0.4 }), s4b, 96);
      const slaM = std("#e6e6e2", { roughness: 0.55, side: THREE.DoubleSide }), rS = (y) => R3 - ((R3 - 1.96) * (y - 90.7)) / 8.5;
      cyl(rS(92.9), R3, 90.7, 92.9, slaM, s4b, 96, true);
      const lm = lunarModule({ folded: true }); lm.root.position.y = 89.9; s4b.add(lm.root);
      const petals = [0, 1, 2, 3].map((i) => {
        const mid = Math.PI / 4 + (i * Math.PI) / 2, hg = new THREE.Group(), pv = new THREE.Group(); hg.rotation.y = mid; hg.position.y = 92.9; s4b.add(hg);
        pv.position.z = rS(92.9); hg.add(pv);
        const m = mesh(new THREE.CylinderGeometry(1.96, rS(92.9), 6.3, 24, 1, true, -Math.PI / 4, Math.PI / 2), slaM, pv, 0, 3.15, -rS(92.9));
        m.castShadow = true; return { hg, pv };
      });
      // CSM on top, under the boost protective cover and the launch escape tower
      const csm = apolloCSM(); csm.root.position.y = 99.2 + 3.95; root.add(csm.root);
      const sps = plume(csm.root, 0, -7.0, 0, 1.2, 18, "#ffe0b8", { spread: 3, opacity: 0.3 });
      const bpc = lathe([[2.03, 103.1], [2.01, 103.35], [0.46, 106.35], [0.34, 106.6]], std("#f2f2ee", { roughness: 0.45 }), les, 96);
      bpc.castShadow = true;
      const red = std("#b9452a", { roughness: 0.5, metalness: 0.2 });
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a); rod([c * 0.95, 106.5, s * 0.95], [c * 0.42, 110.6, s * 0.42], 0.07, red, les); }
      for (let k = 0; k < 4; k++) { const y0 = 106.5 + k * 1.03, r0 = 0.95 - k * 0.13, r1 = r0 - 0.13; for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, b2 = a + Math.PI / 2; rod([Math.cos(a) * r0, y0, Math.sin(a) * r0], [Math.cos(b2) * r1, y0 + 1.03, Math.sin(b2) * r1], 0.04, red, les); } }
      cyl(0.33, 0.33, 110.6, 114.8, white, les, 32);
      for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; mesh(new THREE.ConeGeometry(0.16, 0.5, 12), black, les, Math.cos(a) * 0.32, 110.8, Math.sin(a) * 0.32).rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5 + Math.PI); }
      cyl(0.28, 0.33, 114.8, 115.4, black, les, 32); cyl(0.1, 0.28, 115.4, 116.3, white, les, 32); mesh(new THREE.SphereGeometry(0.11, 12, 8), black, les, 0, 116.35, 0);
      const lesFire = plume(les, 0, 110.6, 0, 0.5, 12, "#ffcf9a", { spread: 2.2 });
      return {
        root, len: 116.4, parts: { s1, inter, s2, s4b, les, csm: csm.root }, petals, csm, lm,
        fires: { f1: f1fire, j2: j2fire, s4: s4fire, les: lesFire, sps },
      };
    }

    // ---- SLS Block 1 (Artemis II): core stage bottom at 0 (RS-25s below it), boosters' aft skirts at -3.6 on the deck,
    // core to 64.6, adapter cone to 72.6, ICPS and Orion stage adapter, fairing panels to 80.8, Orion, abort tower to 96
    function slsStack() {
      const root = new THREE.Group(), RC = 4.2, RB = 1.86, XB = 6.6;
      const foam = std("#ffffff", { map: once("foam", () => tex(1024, 1024, (g, w, hh) => {
        g.fillStyle = "#d8732c"; g.fillRect(0, 0, w, hh);
        const r = rng(23); for (let i = 0; i < 5000; i++) { const c = r(); g.fillStyle = c < 0.5 ? `rgba(120,50,10,${0.08 * r()})` : `rgba(255,170,90,${0.08 * r()})`; g.beginPath(); g.arc(r() * w, r() * hh, 2 + 12 * r(), 0, TAU); g.fill(); }
        g.strokeStyle = "rgba(90,35,5,.12)"; g.lineWidth = 2; for (let j = 1; j < 6; j++) { g.beginPath(); g.moveTo(0, (j * hh) / 6); g.lineTo(w, (j * hh) / 6); g.stroke(); }
      })), roughness: 0.85 });
      const white = std("#f2f2ee", { roughness: 0.5 }), dark = std("#2b2c2f", { roughness: 0.5, metalness: 0.3 }), steel = std("#b8bcc0", { metalness: 0.7, roughness: 0.35 });
      const core = new THREE.Group(); root.add(core);
      lathe([[3.3, -0.2], [RC, 1.6], [RC, 5.5]], std("#e8e6e0", { map: quilt("boat", "#e6e4de", "rgba(0,0,0,.2)", 10), roughness: 0.7 }), core, 96); // boat-tail heat shield
      cyl(RC, RC, 5.5, 64.6, foam, core, 128);
      cyl(RC + 0.04, RC + 0.04, 39.5, 46.2, std("#ffffff", { map: tankLines("intertank", "#c9682a", "rgba(70,25,0,.45)", 96), roughness: 0.8 }), core, 128); // stringers
      for (const y of [5.5, 39.5, 46.2, 59.6]) mesh(new THREE.TorusGeometry(RC + 0.02, 0.06, 6, 128).rotateX(Math.PI / 2), std("#a8541e", { roughness: 0.8 }), core, 0, y, 0);
      decal(core, RC + 0.05, 20, 34, 0, 0.45, 160, 1024, rtext("NASA", "#e03c31", WORM));
      decal(core, RC + 0.05, 48, 51.5, 0, 0.45, 190, 100, flagArt);
      for (const s of [-1, 1]) { const a = Math.PI / 2 + s * 0.35; rod([Math.sin(a) * (RC + 0.35), 5.0, Math.cos(a) * (RC + 0.35)], [Math.sin(a) * (RC + 0.35), 46.4, Math.cos(a) * (RC + 0.35)], 0.22, foam, core); } // LOX feedlines
      rod([Math.sin(-0.5) * (RC + 0.2), 5.2, Math.cos(-0.5) * (RC + 0.2)], [Math.sin(-0.5) * (RC + 0.2), 62, Math.cos(-0.5) * (RC + 0.2)], 0.18, foam, core); // systems tunnel
      const rs = bell(0.42, 1.15, 3.1, 36), rsM = std("#5a5652", { metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; mesh(rs, rsM, core, Math.cos(a) * 1.65, -0.1, Math.sin(a) * 1.65); }
      const rsFire = plume(core, 0, -3.3, 0, 2.7, 60, "#bcd4ff", { spread: 1.5, opacity: 0.45, k: 2, halo: 2 });
      // launch vehicle stage adapter: short cylinder then the cone up to the ICPS
      cyl(RC, RC, 64.6, 66.4, foam, core, 128);
      lathe([[RC, 66.4], [2.56, 72.6]], foam, core, 128);
      // boosters
      const srbT = once("srb", () => tex(512, 2048, (g, w, hh) => {
        g.fillStyle = "#f3f3f0"; g.fillRect(0, 0, w, hh);
        const Y = (y) => (1 - y / 43.4) * hh; g.fillStyle = "#3b3c40"; for (const y of [8, 16, 24, 32, 40]) g.fillRect(0, Y(y) - 7, w, 14);
        g.save(); g.translate(w / 2, Y(30)); g.rotate(Math.PI / 2); g.fillStyle = "#e03c31"; g.font = WORM; g.textAlign = "center"; g.textBaseline = "middle"; g.scale(1.6, 1.2); g.fillText("NASA", 0, 0); g.restore();
      }));
      const srbs = [-1, 1].map((sd) => {
        const g = new THREE.Group(); g.position.x = sd * XB; root.add(g);
        lathe([[2.62, -3.6], [2.3, -1.4], [RB, 0.2]], std("#e7e7e3", { roughness: 0.6 }), g, 64);
        const b2 = cyl(RB, RB, 0, 43.4, std("#ffffff", { map: srbT, roughness: 0.5 }), g, 64); b2.rotation.y = Math.PI;
        const nose = []; for (let i = 0; i <= 14; i++) { const f = i / 14; nose.push([RB * Math.pow(1 - f, 0.62) * (1 - 0.08 * f) + (i === 14 ? 0 : 0), 43.4 + 6.8 * f]); }
        lathe(nose, white, g, 64);
        mesh(bell(0.75, 1.85, 1.9, 32), dark, g, 0, -3.3, 0);
        for (const y of [3.0, 41.0]) rod([-sd * RB, y, 0], [-sd * (XB - RC), y, 0], 0.18, steel, g); // attach struts toward the core
        return g;
      });
      const srbFire = srbs.map((g) => plume(g, 0, -5.0, 0, 2.0, 95, "#fff1d6", { spread: 1.35, k: 2.8, halo: 2.5 }));
      // Orion stack with the ICPS (its tank shows between the adapter cone and the Orion stage adapter)
      const o = orionStack({ icps: true }); o.root.position.y = 81.0; root.add(o.root); o.arrays(0);
      cyl(2.58, 2.58, -6.4, -5.2, steel, o.stage, 96); // Orion stage adapter
      decal(o.stage, 2.53, -10.4, -8.0, 0, 0.6, 256, 96, (g, w, hh) => { g.fillStyle = "#16181b"; g.font = "bold 70px Helvetica,Arial,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ICPS", w / 2, hh / 2); });
      // fairing panels (three) round the service module
      const sajM = std("#ffffff", { map: once("saj", () => tex(1024, 256, (g, w, hh) => {
        g.fillStyle = "#efefec"; g.fillRect(0, 0, w, hh); g.fillStyle = "rgba(0,0,0,.12)"; for (let i = 0; i < 24; i++) g.fillRect((i * w) / 24, 0, 2, hh);
        meatball(g, w * 0.17, hh * 0.5, hh * 0.32); meatball(g, w * 0.5, hh * 0.5, hh * 0.32);
        g.fillStyle = "#003247"; g.font = "bold 60px Helvetica,Arial,sans-serif"; g.textAlign = "center"; g.fillText("esa", w * 0.83, hh * 0.6);
      })), roughness: 0.5, side: THREE.DoubleSide });
      const saj = [0, 1, 2].map((i) => { const g = new THREE.Group(); root.add(g); mesh(new THREE.CylinderGeometry(2.62, 2.62, 5.0, 48, 1, true, (i * TAU) / 3 - Math.PI / 3, TAU / 3), sajM, g, 0, 78.3, 0); g.userData.a = (i * TAU) / 3; return g; });
      // launch abort system: ogive fairing over the crew module, abort motor, jettison motor, attitude control motor, nose
      const las = new THREE.Group(); root.add(las);
      const og = []; for (let i = 0; i <= 18; i++) { const f = i / 18; og.push([0.55 + 2.08 * Math.sqrt(Math.max(0, 1 - f * f)), 80.6 + 6.4 * f]); }
      const ogM = std("#ffffff", { map: once("ogive", () => tex(1024, 512, (g, w, hh) => { g.fillStyle = "#f2f2ee"; g.fillRect(0, 0, w, hh); flag(g, w * 0.5 - 70, hh * 0.45, 140, 74); g.save(); g.translate(w * 0.62, hh * 0.62); g.fillStyle = "#e03c31"; g.font = "900 70px 'Arial Rounded MT Bold',Arial,sans-serif"; g.textAlign = "center"; g.fillText("NASA", 0, 0); g.restore(); })), roughness: 0.45 });
      lathe(og, ogM, las, 96).rotation.y = Math.PI;
      cyl(0.48, 0.5, 87.0, 92.0, std("#e9e9e6", { roughness: 0.4 }), las, 32);
      for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + Math.PI / 4; const n = mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.7, 12), dark, las, Math.cos(a) * 0.55, 87.6, Math.sin(a) * 0.55); n.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); }
      cyl(0.42, 0.48, 92.0, 94.0, steel, las, 32);
      cyl(0.45, 0.42, 94.0, 95.2, std("#1d1e21", { roughness: 0.5 }), las, 32);
      lathe([[0.45, 95.2], [0.3, 95.7], [0, 96.0]], white, las, 32);
      const lasFire = plume(las, 0, 92.0, 0, 0.5, 10, "#ffd2a0", { spread: 2.4 });
      return {
        root, len: 96, parts: { srbL: srbs[0], srbR: srbs[1], core, las, saj0: saj[0], saj1: saj[1], saj2: saj[2], orion: o.root }, saj, o,
        fires: { rs25: rsFire, srb: (p, w, l) => srbFire.forEach((f) => f(p, w, l)), las: lasFire, rl10: o.rl10, oms: o.fire },
      };
    }

    // ---- pads. Each returns the deck height the vehicle stands on and a setter for its swing arms (k = 0 docked .. 1 away)
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
    function ground({ sea = true, hard = 14 } = {}) {
      const grass = mesh(new THREE.PlaneGeometry(63000, 120000).translate(-28500, 0, 0).rotateX(-Math.PI / 2), std("#ffffff", { map: once("grass", () => tex(512, 512, (g, w, hh) => { g.fillStyle = "#4f6334"; g.fillRect(0, 0, w, hh); const r = rng(41); for (let i = 0; i < 9000; i++) { const c = r(); g.fillStyle = c < 0.5 ? "rgba(40,60,25,.4)" : "rgba(120,130,80,.25)"; g.fillRect(r() * w, r() * hh, 2 + 8 * r(), 2 + 8 * r()); } }, [300, 300])), roughness: 1 }), world, 0, 0, 0);
      grass.castShadow = false;
      if (sea) { ocean(3000, 40); const [near, far] = world.children.slice(-2); near.position.set(4500, 0.3, 0); far.position.set(203000, -0.3, 0); }
      // the raised hardstand, its ramp and the flame trench
      const con = std("#ffffff", { map: once("conc", () => tex(256, 256, (g, w, hh) => { g.fillStyle = "#b9b6ae"; g.fillRect(0, 0, w, hh); const r = rng(43); for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${0.06 * r()})`; g.fillRect(r() * w, r() * hh, 3 + 9 * r(), 3 + 9 * r()); } g.strokeStyle = "rgba(0,0,0,.15)"; g.strokeRect(0, 0, w, hh); }, [20, 20])), roughness: 0.95 });
      const hill = mesh(new THREE.CylinderGeometry(85, 125, hard, 4, 1).rotateY(Math.PI / 4), con, world, 0, hard / 2, 0); hill.castShadow = false;
      box(120, 0.3, 14, std("#2a2826", { roughness: 1 }), world, 0, hard + 0.05, 0).castShadow = false;
      // water tower and a lightning mast in the distance
      const wt = new THREE.Group(); wt.position.set(-230, 0, -260); world.add(wt);
      for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; rod([Math.cos(a) * 9, 0, Math.sin(a) * 9], [Math.cos(a) * 5, 70, Math.sin(a) * 5], 0.5, std("#d9d9d4"), wt); }
      mesh(new THREE.SphereGeometry(10, 32, 16), std("#efefea", { roughness: 0.5 }), wt, 0, 78, 0);
      return hard;
    }
    // LC-39A in the 2020s for Falcon 9: fixed service structure with the crew access arm, the transporter-erector
    function padF9() {
      const sunDir = V3(-0.4, 0.62, 0.68).normalize(); earthSky(sunDir, { far: 26000 });
      const deck = ground() + 4;
      box(16, 4, 16, std("#8d9095", { metalness: 0.4, roughness: 0.6 }), world, 0, deck - 2, 0);
      for (const [x, z] of [[2.3, 0], [-2.3, 0], [0, 2.3], [0, -2.3]]) box(0.8, 3, 0.8, std("#3a3d42"), world, x, deck + 1.0, z); // hold-downs
      truss(world, 0, -24, 10, 87, "#8e9398", deck - 4);
      box(4, 26, 4, std("#8e9398"), world, 0, deck + 83 + 13, -24); // lightning mast
      const caa = swingArm(world, -3, deck + 66.2, -19, 15, "#d8d8d4", 2.6);
      const te = new THREE.Group(); te.position.set(0, deck, -6.5); te.rotation.x = -0.21; world.add(te);
      box(3.6, 70, 2.2, latM("#2e3034", 1, 18), te, 0, 35, 0); box(1, 70, 1, std("#2e3034"), te, 0, 35, -0.6);
      return { deck, sunDir, smokeY: 15, arms: (k) => caa(0.85 + 0.15 * k, -1) }; // the access arm is already swung back for launch
    }
    // LC-39A in July 1969: the Mobile Launcher with its red umbilical tower, nine swing arms and the hammerhead crane
    function padSaturn() {
      const sunDir = V3(0.5, 0.6, 0.62).normalize(); earthSky(sunDir, { far: 26000 });
      const hard = ground(), deck = hard + 6.5 + 7.6;
      for (const [x, z] of [[-18, -14], [18, -14], [-18, 14], [18, 14], [-18, 0], [18, 0]]) box(3, 6.5, 3, std("#8a8c8f"), world, x, hard + 3.25, z);
      box(49, 7.6, 41, std("#7d8084", { roughness: 0.7, metalness: 0.3 }), world, 0, hard + 6.5 + 3.8, -4);
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; box(1.2, 2.4, 1.2, std("#3a3d42"), world, Math.cos(a) * 5.6, deck + 1.2, Math.sin(a) * 5.6); }
      truss(world, 0, -18, 12, 120, "#b33b25", deck);
      box(28, 3, 3, std("#b33b25"), world, 6, deck + 121.5, -18); // hammerhead crane
      const arms = [[19, 9], [30, 9], [55, 9], [63, 9], [76, 9], [84, 9], [92, 11], [97, 12.8], [103, 12.2]].map(([y, len]) => swingArm(world, 0, deck + y, -12, len - 3.5, "#9c3424", 2.4));
      return { deck, sunDir, smokeY: 15, arms: (k) => arms.forEach((f, i) => f(i === 8 ? 1 : k, i % 2 ? 1 : -1)) };
    }
    // LC-39B in 2026: Mobile Launcher 1 with the crew access arm, three lightning towers round the pad
    function padSLS() {
      const sunDir = V3(-0.35, 0.58, 0.73).normalize(); earthSky(sunDir, { far: 26000 });
      const hard = ground(), deck = hard + 6.5 + 7.6;
      for (const [x, z] of [[-18, -14], [18, -14], [-18, 14], [18, 14], [-18, 0], [18, 0]]) box(3, 6.5, 3, std("#8a8c8f"), world, x, hard + 3.25, z);
      box(50, 7.6, 41, std("#6f7276", { roughness: 0.7, metalness: 0.3 }), world, 0, hard + 6.5 + 3.8, -4);
      truss(world, 0, -19, 12, 112, "#9aa0a6", deck);
      const caa = swingArm(world, 0, deck + 84, -13, 9, "#e9e9e6", 2.8);
      const um = [[60, 7], [70, 9], [76, 11]].map(([y, len]) => swingArm(world, 0, deck + y, -13, len, "#7d8288", 2));
      for (const [x, z] of [[-120, -110], [130, -60], [0, 150]]) { truss(world, x, z, 5, 180, "#c9ccd0", hard, 15); }
      const wire = new THREE.LineBasicMaterial({ color: "#555" });
      for (const [a, b] of [[[-120, 198, -110], [130, 198, -60]], [[130, 198, -60], [0, 198, 150]], [[0, 198, 150], [-120, 198, -110]]]) { const pts = []; for (let i = 0; i <= 20; i++) { const f = i / 20; pts.push(V3(a[0] + (b[0] - a[0]) * f, a[1] - 40 * Math.sin(f * Math.PI), a[2] + (b[2] - a[2]) * f)); } world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire)); }
      return { deck, sunDir, smokeY: 15, arms: (k) => { caa(1, -1); um.forEach((f, i) => f(k, i % 2 ? 1 : -1)); } };
    }
    function padStarbase() {
      const sunDir = V3(0.6, 0.6, 0.5).normalize(); earthSky(sunDir);
      const b = starbase(); b.arms(32 * D2R);
      return { deck: 21, sunDir, smokeY: 1, arms: () => {}, sea: b.sea };
    }

    // ---- the sky by altitude: background colour, haze, stars fading in, image light switched from day sky to black space
    const SKY = [[0, [122, 167, 214]], [3, [91, 136, 194]], [12, [46, 79, 143]], [30, [19, 35, 74]], [60, [7, 11, 24]], [120, [3, 4, 8]]];
    function atmo(sunDir) {
      const day = equi(512, 256, (g, w, hh) => { const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, "#2f64ad"); gr.addColorStop(0.495, "#c4d8ec"); gr.addColorStop(0.505, "#3c5568"); gr.addColorStop(1, "#1d2c38"); g.fillStyle = gr; g.fillRect(0, 0, w, hh); sunSpot(g, w, hh, sunDir, [[60, 0.3], [10, 1]]); });
      const night = equi(256, 128, (g, w, hh) => { const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, "#000"); gr.addColorStop(0.5, "#04060a"); gr.addColorStop(0.6, "#284a74"); gr.addColorStop(1, "#284a74"); g.fillStyle = gr; g.fillRect(0, 0, w, hh); sunSpot(g, w, hh, sunDir, [[30, 0.6], [6, 1]]); });
      const envD = pmrem.fromEquirectangular(day).texture, envN = pmrem.fromEquirectangular(night).texture;
      const st = new THREE.Mesh(new THREE.SphereGeometry(4e7, 64, 32), new THREE.MeshBasicMaterial({ map: stars(), side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }));
      st.renderOrder = -2; world.add(st);
      const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color("#fff4e0").multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      sunS.position.copy(sunDir).multiplyScalar(3.5e7); sunS.scale.setScalar(2.2e6); world.add(sunS);
      const bg = new THREE.Color(), fogC = new THREE.Color(); scene.background = bg; scene.fog = new THREE.Fog(fogC, 1, 1e12);
      return (alt, earth = true) => { // alt in km
        let c = SKY[SKY.length - 1][1];
        if (earth) for (let i = 1; i < SKY.length; i++) if (alt <= SKY[i][0]) { const [a, ca] = SKY[i - 1], [b2, cb] = SKY[i], q = (alt - a) / (b2 - a); c = ca.map((v, j) => v + (cb[j] - v) * q); break; }
        if (!earth) c = [0, 0, 0];
        bg.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
        const k = earth ? Math.min(1, Math.max(0, alt / 70)) : 1;
        fogC.copy(bg).lerp(new THREE.Color("#dfe9f4"), 0.25 * (1 - k));
        scene.fog.near = 0; scene.fog.far = earth && alt < 90 ? 9e3 + alt * 1.5e4 + alt * alt * 900 : 1e12;
        st.material.opacity = earth ? Math.min(1, Math.max(0, (alt - 25) / 45)) : 1;
        sunS.material.opacity = 0.3 + 0.7 * k;
        scene.environment = k < 0.55 ? envD : envN;
        hemi.color.set(k < 0.55 ? "#d6e6ff" : "#000"); hemi.groundColor.set(k < 0.55 ? "#3a4a5a" : "#284a74"); hemi.intensity = 0.6 - 0.25 * k;
        sun.intensity = 3.2 + 0.4 * k;
      };
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

    // ---- liftoff: the pad, the stack on the deck, ignition, hold-down release and the climb out to ~1.5 km
    function padScene({ pad, stk, rel, a, foot = 0, fires, focus, chase, smoke = "#efece6", dirs = [[1, 0], [-1, 0]], arms = [rel - 1, rel + 1.5], drift = 0, events = [] }) {
      const P = pad();
      world.add(stk.root);
      const smk = particles({ n: 9000, color: smoke, size: 26, drag: 0.35, rise: 3.5, gravity: 0, life: 16, opacity: 0.22 });
      const trail = particles({ n: 6000, color: smoke, size: 14, drag: 0.6, rise: 0.8, gravity: 0, life: 22, opacity: 0.3 });
      const light = new THREE.PointLight("#ffb46a", 0, 600, 2); world.add(light);
      let c = 0;
      const pos = V3();
      return {
        chase, focus, shadow: Math.max(90, stk.len), sunDir: P.sunDir, floor: 2, pmin: -0.6, events,
        reset() { smk.reset(); trail.reset(); },
        place(s) {
          const t = e.a0 + s, u = Math.max(0, t - rel), h = 0.5 * a * u * u;
          pos.set(drift * u * u * 0.02, P.deck + foot + h, 0);
          stk.root.position.copy(pos); stk.root.rotation.z = -drift * 0.0006 * u * u;
          return { pos, t };
        },
        update(s, st, dt) {
          const t = st.t; c += dt;
          let pw = 0; for (const [name, rows] of Object.entries(fires)) { const p = lin(rows, t); pw = Math.max(pw, p); stk.fires[name](p, 1, 1); }
          P.arms(sm(arms[0], arms[1], t));
          if (P.sea) P.sea.update(c);
          const hb = st.pos.y - P.deck - foot;
          if (dirs) for (const d of dirs) smk.step(dt, { x: d[0] * 55, y: P.smokeY, z: d[1] * 55, r0: 6, rate: pw * 160 * (1 - sm(40, 300, hb)), speed: 42, up: 9, dir: d, cone: 0.9, floor: P.smokeY });
          else smk.step(dt, { x: 0, y: P.smokeY, z: 0, r0: 14, rate: pw * 320 * (1 - sm(40, 300, hb)), speed: 45, up: 6, floor: P.smokeY });
          trail.step(dt, { x: st.pos.x, y: st.pos.y - 4, z: 0, r0: 2, rate: hb > 25 ? pw * 220 : 0, speed: 3, up: -4 });
          light.position.set(st.pos.x, st.pos.y - 8, 0); light.intensity = 2.5e4 * pw * (0.9 + 0.1 * Math.random());
          G.shake = pw * 0.35 * (1 - sm(60, 600, hb));
        },
      };
    }

    // ---- ascent and early orbit: the stack at the origin, the Earth (or Moon) placed by altitude, the sky by altitude,
    // staging via `seps`, engines via `fires` = { name: [[t, power]] }, `foc` = camera target height in the stack, `zm` = zoom
    function ascentScene({ stk, seps, fires, foc, zm, chase, vapor, tilt, extra, spot = [0.276, 0.658], events = [] }) {
      const sunDir = V3(-0.4, 0.55, 0.73).normalize(), sky = atmo(sunDir);
      const E = planet("earth", 0, { spot, seg: 384 });
      const craft = new THREE.Group(); world.add(craft); craft.add(stk.root);
      const stage = stager(stk, seps);
      const vap = vapor ? mesh(new THREE.CylinderGeometry(vapor[3] * 1.15, vapor[3] * 2.6, vapor[3] * 3, 48, 1, true), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, map: plumeTex }), stk.root, 0, vapor[2], 0) : null;
      if (vap) vap.castShadow = false;
      const puffs = Array.from({ length: 48 }, (_, i) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: "#ece8e0", transparent: true, depthWrite: false, opacity: 0 })); sp.userData.i = i; stk.root.add(sp); return sp; });
      // downrange distance along the track, from the speed profile
      const t0 = e.a0, t1 = e.a1, N = 1200, X = new Float32Array(N + 1);
      for (let i = 1; i <= N; i++) { const ta = t0 + ((i - 1) * (t1 - t0)) / N, tb = t0 + (i * (t1 - t0)) / N, hv = info.hud((ta + tb) / 2); X[i] = X[i - 1] + (hv.vel / 3.6) * Math.sin(pitchAt(hv.alt)) * (tb - ta); }
      function pitchAt(alt) { return (Math.PI / 2) * (1 - Math.exp(-alt / 42)); }
      const pos = V3();
      let lastAlt = 0;
      return {
        chase, shadow: stk.len, sunDir, space: true, pmin: -1.2, events, lift: () => 0.55 * sm(60, 160, lastAlt),
        focus: 0, zoom: (s) => lin(zm, t0 + s),
        place(s) {
          const t = t0 + s, h = info.hud(t), i = Math.min(N, Math.max(0, ((t - t0) / (t1 - t0)) * N));
          E.place(h.alt * 1000); E.roll(X[Math.floor(i)] || 0);
          sky(h.alt, true);
          craft.rotation.z = -(tilt ? lin(tilt, t) * D2R : pitchAt(h.alt));
          stk.root.position.y = -lin(foc, t);
          lastAlt = h.alt;
          return { pos, t, km: h.alt };
        },
        update(s, st, dt) {
          const t = st.t, alt = st.km, wd = 1 + 2.4 * sm(12, 90, alt), ln = 1 + 1.6 * sm(12, 90, alt);
          let pw = 0; for (const [name, rows] of Object.entries(fires)) { const p = lin(rows, t); if (["m1d", "f1", "booster", "srb", "rs25"].includes(name)) pw = Math.max(pw, p); stk.fires[name](p, wd, ln); }
          stage(t);
          if (vap) { const k = sm(vapor[0], vapor[0] + 2, t) * (1 - sm(vapor[1] - 2, vapor[1], t)); vap.material.opacity = 0.35 * k * (0.8 + 0.2 * Math.random()); vap.visible = k > 0.01; }
          const tk = pw * (1 - sm(8, 38, alt)), w0 = stk.len * 0.06;
          for (const sp of puffs) { const i = sp.userData.i, d = 6 + 9 * i + 0.6 * i * i, r = w0 * (1 + 0.08 * i) * (1 + alt * 0.08); sp.visible = tk > 0.02; sp.position.set(Math.sin(i * 1.7) * r * 0.15, -d, Math.cos(i * 2.3) * r * 0.15); sp.scale.setScalar(r * 2.4); sp.material.opacity = 0.5 * tk * (1 - i / 48); }
          if (extra) extra(t, dt);
          G.shake = pw * 0.12 * (1 - sm(20, 60, alt));
        },
      };
    }

    // ---- free flight between the set pieces: whatever is flying at that moment, over the Earth or the Moon at the map's
    // altitude, engines when the map says they burn, parachutes when it says so, sky by altitude
    function coastScene(cfg) {
      const sunDir = V3(-0.42, 0.5, 0.76).normalize(), sky = atmo(sunDir);
      const E = planet("earth", 0, { spot: [0.36, 0.55], seg: 384 }), Mo = planet("moon", 0, { spot: [0.5, 0.52], seg: 256 });
      const otherDir = V3(-0.85, 0.22, -0.48).normalize();
      // only the craft this shot needs
      const names = []; for (let i = 0; i < cfg.craft.length; i++) { const [ta] = cfg.craft[i], tb = i + 1 < cfg.craft.length ? cfg.craft[i + 1][0] : Infinity; if (tb > e.a0 && ta < e.a1 && !names.includes(cfg.craft[i][1])) names.push(cfg.craft[i][1]); }
      const models = Object.fromEntries(names.map((n) => { const m = craftModel(n); world.add(m.hold); m.hold.visible = false; return [n, m]; }));
      const nameAt = (t) => { let n = cfg.craft[0][1]; for (const [ta, x] of cfg.craft) if (t >= ta) n = x; return n; };
      const [nc, Dm, lm, col] = cfg.chutes || [3, 30, 32, "#d8442c"];
      const drogue = chutes(2, 6, lm * 0.75, col), mains = chutes(nc, Dm, lm, col);
      // capsules glow through entry: heat shield into the flow (+x) as the "retro" pose holds it
      const flow = new THREE.Group(); flow.rotation.z = Math.PI / 2; world.add(flow);
      for (const m of Object.values(models)) if (m.hot) { m.hold.rotation.set(0, 0, Math.PI / 2); m.hold.updateMatrixWorld(true); m.glow = plasma(m.hold.children[0], flow, m.R, m.plen, m.hot); m.glow(0, 0); }
      const q = new THREE.Quaternion(), pos = V3();
      let c = 0, cur0 = null, roll = 0, lastT = null, kc = 0; // kc: how far the camera backs off for parachutes
      const m0 = models[nameAt(e.a0)] || Object.values(models)[0], L0 = m0.len * 2.4 + 10;
      // attitude, zoom and framing ease toward their targets on the wall clock (snap when paused or on the first frame)
      let ang = null, zS = 1, fS = 0, lastW = null;
      return {
        chase: [-0.55 * L0, 0.3 * L0, 0.78 * L0], shadow: 60, sunDir, space: true, pmin: -1.4, spin: 0.02,
        title: (s) => (models[nameAt(e.a0 + s)] || m0).title,
        events: [],
        focus: () => fS,
        zoom: () => zS,
        reset() { lastW = null; },
        place(s) {
          const t = e.a0 + s, h = info.hud(t), fx = info.fx(t), pose = info.pose(t);
          const onMoon = h.ref === "moon";
          const pr = onMoon ? Mo : E, ot = onMoon ? E : Mo;
          pr.place(h.alt * 1000, V3(0, -1, 0)); ot.place((onMoon ? h.de : h.dm) * 1000, otherDir);
          if (lastT !== null && t > lastT && t - lastT < 5000) roll += ((h.vel / 3.6) * (t - lastT)) % 4e7;
          lastT = t; pr.roll(roll);
          sky(onMoon ? 1000 : h.alt, !onMoon);
          const n = nameAt(t), m = models[n] || m0;
          if (cur0 !== m) { for (const k in models) { models[k].hold.visible = models[k] === m; if (models[k] !== m && models[k].glow) models[k].glow(0, c); } cur0 = m; }
          const now = performance.now(), k = lastW === null || !info.playing() ? 1 : 1 - Math.exp(-Math.min(0.2, (now - lastW) / 1000) * 1.6);
          lastW = now;
          const angT = m.fixed ? 0 : pose === "retro" ? Math.PI / 2 : pose === "up" ? 0 : -Math.PI / 2;
          ang = ang === null || k === 1 ? angT : ang + (angT - ang) * k;
          m.hold.rotation.set(0, 0, ang);
          if (m.glow) m.glow(entryGlow(s, []), c);
          const burn = fx.includes("burn") ? 1 : 0;
          if (m.fire) m.fire(burn, 1 + (h.alt > 100 ? 1.5 : 0), 1);
          if (m.rcs) m.rcs(burn ? 0.4 : 0.03);
          const k1 = fx.includes("chute1") ? 1 : 0, k2 = fx.includes("chute2") ? 1 : 0;
          kc = m.top === undefined ? 0 : Math.max(k1 * 0.4, k2);
          const zT = ((m.len * 2.4 + 10) / L0) * (1 + 2.6 * kc), fT = kc * ((m.top || 0) + lm * 0.35);
          zS = k === 1 ? zT : zS + (zT - zS) * k; fS = k === 1 ? fT : fS + (fT - fS) * k;
          q.setFromEuler(m.hold.rotation);
          for (const [ch, on] of [[drogue, k1], [mains, k2 && !k1 ? 1 : 0]]) {
            ch.g.visible = on > 0 && m.top !== undefined;
            if (ch.g.visible) { ch.g.position.copy(V3(0, m.top - m.mid, 0).applyQuaternion(q)); ch.set(c); }
          }
          return { pos, t };
        },
        update(s, st, dt) { c += dt; },
      };
    }
    // models for free flight, each centred on its middle in a holder; len = how much the camera has to fit
    function craftModel(n) {
      const hold = new THREE.Group(), add = (v, mid, len, o = {}) => { v.root.position.y = -mid; hold.add(v.root); return Object.assign({ hold, mid, len }, o); };
      if (n === "dragon") { const d = crewDragon(); d.setNose(1); return add(d, 0.4, 8, { rcs: d.dracos, title: "Crew Dragon · free flight" }); }
      if (n === "capsule") { const d = crewDragon({ trunk: false }); return add(d, 1.6, 5, { rcs: d.dracos, top: 3.4, R: 2.0, hot: "#ff7a32", plen: 26, title: "Crew Dragon · coming home" }); }
      if (n === "dragonIss") {
        const st = iss(), d = crewDragon(), g = new THREE.Group(); g.add(st.root, dockAt(d, 3.47)); st.wings.forEach((w) => (w.rotation.x = 0.55));
        const m = add({ root: g }, 0, 70, { fixed: true, title: "Docked to the International Space Station" }); g.position.x = -18; return m;
      }
      if (n === "ship") { const v = starshipShip(); const all = (p, w, l) => v.fires.forEach((f) => f(p, w, l)); return add(v, 25, 50, { fire: all, title: "Starship · in orbit" }); }
      if (n === "csmlm" || n === "csmasc") {
        const g = new THREE.Group(), csm = apolloCSM(), lm = lunarModule(); g.add(csm.root, lm.root);
        lm.root.rotation.z = Math.PI; lm.root.position.y = csm.top + 6.3; if (n === "csmasc") lm.desc.visible = false;
        const sps = plume(csm.root, 0, -7.0, 0, 1.2, 18, "#ffe0b8", { spread: 3, opacity: 0.3 });
        return add({ root: g }, 1.5, 18, { fire: sps, rcs: csm.rcs, title: n === "csmlm" ? "Columbia and Eagle · docked" : "Columbia with Eagle's ascent stage" });
      }
      if (n === "csm") { const v = apolloCSM(); const sps = plume(v.root, 0, -7.0, 0, 1.2, 18, "#ffe0b8", { spread: 3, opacity: 0.3 }); return add(v, -1.9, 11, { fire: sps, rcs: v.rcs, title: "Columbia · command and service module" }); }
      if (n === "lm") { const v = lunarModule(); return add(v, 3.4, 8, { fire: v.fire, rcs: v.rcs, title: "Eagle · lunar module" }); }
      if (n === "lmasc") { const v = lunarModule(); v.desc.visible = false; return add(v, 4.6, 5, { fire: v.afire, rcs: v.rcs, title: "Eagle · ascent stage" }); }
      if (n === "apolloCm") { const v = apolloCM(); return add(v, 1.4, 4.5, { top: v.top, R: v.R, hot: "#ff6a26", plen: 22, title: "Columbia · command module" }); }
      if (n === "orion") { const v = orionStack(); return add(v, -1.8, 12, { fire: v.fire, rcs: v.rcs, title: "Orion · crew and service modules" }); }
      if (n === "orionCm") { const v = orionCM(); return add(v, 1.5, 5.5, { top: v.top, R: v.R, hot: "#ff6a2a", plen: 28, title: "Orion · crew module" }); }
      throw new Error("no model " + n);
    }
    const rangeInfo = (s) => (s.x < -0.01 ? `Range ${(-s.x).toFixed(1)} m · closing ${(s.vx * 100).toFixed(0)} cm/s` : "");

    // each scene: { chase, focus, shadow, sunDir, events, tilt, ground(t), update(t, s, dt), root | place(t), reset, info, space, spin, zoom }
    const SCENES = {
      // ---- launch and ascent, one pad shot and one ascent shot per vehicle (times = mission seconds)
      f9pad: () => padScene({ pad: padF9, stk: f9Stack(), rel: 0, a: 3.56, fires: { m1d: [[-3, 0], [-1.2, 1]] }, focus: 35, chase: [62, 4, 118] }),
      f9asc() {
        const s = f9Stack();
        return ascentScene({
          stk: s, chase: [52, -10, 112], vapor: [56, 66, 44, 1.95],
          fires: { m1d: [[-3, 0], [-1.2, 1], [149.6, 1], [150.6, 0]], mvac: [[160, 0], [162, 1], [527.5, 1], [528.5, 0]] },
          seps: [[153, "booster", { v: -1.5, a: -9, spin: [0, 0, 0.07], pivot: 25, hide: 70 }], [700, "s2", { v: -0.35, a: -0.04, spin: [0.004, 0, 0.007], pivot: 55, hide: 300 }]],
          foc: [[-1e9, 35], [153, 35], [165, 57], [700, 57], [712, 66.5]], zm: [[-1e9, 1], [153, 1], [170, 0.5], [700, 0.5], [715, 0.17]],
          extra: (t) => { s.dragon.setNose(sm(730, 744, t)); s.dragon.dracos(t > 700 && t < 716 ? 0.4 : 0); },
        });
      },
      shpad: () => padScene({ pad: padStarbase, stk: starshipStack(), rel: 0, a: 3.33, dirs: null, fires: { booster: [[-4, 0], [-0.8, 1]] }, focus: 61, chase: [120, 6, 200] }),
      shasc() {
        const s = starshipStack();
        return ascentScene({
          stk: s, chase: [95, -16, 190], vapor: [52, 62, 66, 4.9], spot: [0.23, 0.644],
          fires: { booster: [[-4, 0], [-0.8, 1], [158.5, 1], [159.5, 0.15], [164.5, 0.15], [165, 0]], ship: [[161.5, 0], [163, 1], [514.5, 1], [515.5, 0]], rvac: [[161.5, 0], [163, 1], [514.5, 1], [515.5, 0]] },
          seps: [[165, "booster", { v: -2, a: -14, spin: [0, 0, 0.09], pivot: 36, hide: 60 }]],
          foc: [[-1e9, 61], [165, 61], [178, 97]], zm: [[-1e9, 1], [165, 1], [180, 0.5]],
        });
      },
      svpad: () => padScene({ pad: padSaturn, stk: saturnV(), rel: 0.3, a: 2.72, foot: -5, fires: { f1: [[-8.9, 0], [-6, 1]] }, arms: [-1, 4], focus: 55, chase: [105, 6, 200] }),
      svasc() {
        const s = saturnV(), base = s.parts.csm.position.y;
        return ascentScene({
          stk: s, chase: [90, -14, 180], vapor: [66, 76, 60, 5.6],
          fires: { f1: [[-8.9, 0], [-6, 1], [135, 1], [135.5, 0.8], [160.5, 0.8], [161, 0]], j2: [[163, 0], [166, 1], [547.5, 1], [548.5, 0]], s4: [[551, 0], [552.5, 1], [699, 1], [700, 0], [9856, 0], [9858, 1], [10202, 1], [10203, 0]], les: [[197, 0], [197.2, 1], [200, 0]] },
          seps: [[161, "s1", { v: -2, a: -14, spin: [0.01, 0, 0.02], pivot: 26, hide: 60 }], [191, "inter", { v: -0.5, a: -8, spin: [0, 0.05, 0.02], pivot: 50, hide: 30 }], [197, "les", { v: 3, a: 40, spin: [0, 0, 0.05], pivot: 110, hide: 12 }], [548, "s2", { v: -1, a: -10, spin: [0.005, 0, 0.012], pivot: 62, hide: 80 }]],
          foc: [[-1e9, 55], [161, 55], [176, 82], [548, 82], [562, 92], [11700, 92], [11900, 104]], zm: [[-1e9, 1], [161, 1], [178, 0.75], [548, 0.75], [565, 0.4], [11700, 0.4], [11900, 0.55]],
          extra(t) {
            // CSM separation: the adapter petals open and drift off, Columbia backs out ~28 m and turns round to face Eagle
            const u = t - 11700, csm = s.parts.csm;
            csm.position.y = base + (u < 0 ? 0 : 28 * sm(0, 260, u));
            csm.rotation.x = Math.PI * sm(300, 700, u);
            s.csm.rcs(u > 0 && u < 720 ? 0.15 : 0);
            s.petals.forEach(({ hg, pv }) => { pv.rotation.x = 0.85 * sm(0, 14, u); const w = Math.max(0, u - 14); pv.position.z = 2.95 + 0.4 * w; pv.position.y = 0.1 * w; hg.visible = w < 900; });
          },
        });
      },
      slspad: () => padScene({ pad: padSLS, stk: slsStack(), rel: 0, a: 4.44, foot: 3.6, fires: { rs25: [[-6.4, 0], [-5, 1]], srb: [[-0.2, 0], [0.2, 1]] }, focus: 46, chase: [100, 6, 185] }),
      slsasc() {
        const s = slsStack();
        const panel = (i) => { const a = s.saj[i].userData.a; return [195, "saj" + i, { v: -0.6, a: -5, side: [Math.sin(a) * 4, Math.cos(a) * 4], spin: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5], pivot: 78.3, hide: 20 }]; };
        return ascentScene({
          stk: s, chase: [85, -14, 170], vapor: [50, 62, 52, 4.6],
          fires: { rs25: [[-6.4, 0], [-5, 1], [483.5, 1], [484.5, 0]], srb: [[-0.2, 0], [0.2, 1], [108, 1], [128, 0.25], [131, 0]], las: [[200, 0], [200.3, 1], [203, 0]], rl10: [[2940, 0], [2941, 1], [2962, 1], [2963, 0], [6480, 0], [6481, 1], [7380, 1], [7381, 0]] },
          seps: [[132, "srbL", { v: -1, a: -6, side: [-3, 0], spin: [0, 0, 0.04], pivot: 22, hide: 60 }], [132, "srbR", { v: -1, a: -6, side: [3, 0], spin: [0, 0, -0.04], pivot: 22, hide: 60 }], panel(0), panel(1), panel(2), [200, "las", { v: 3, a: 35, spin: [0, 0, 0.04], pivot: 88, hide: 12 }], [496, "core", { v: -0.6, a: -1.2, spin: [0.004, 0, 0.008], pivot: 32, hide: 300 }]],
          foc: [[-1e9, 46], [496, 46], [508, 72]], zm: [[-1e9, 1], [132, 1], [150, 0.9], [496, 0.9], [510, 0.36]],
          extra: (t) => s.o.arrays(sm(1100, 1330, t)),
        });
      },
      // ---- free flight between the set pieces
      coast: (c) => coastScene(c),

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
        sun.intensity = 1.2; hemi.intensity = 0.15; // dim: the plasma is the main light on the hull
        v.root.updateMatrixWorld(true);
        const F = V3(-1, 0.05, 0).normalize(), L = (x, y, z) => v.body.localToWorld(V3(x, y, z)), D = (x, z) => V3(x, 0, z).transformDirection(v.body.matrixWorld);
        const shells = v.hull.map((m) => hotShell(m, F, "#ffa6d6", 3.4, 0.3));
        // streak seeds: the two belly edges, round the nose, the flap tips and the aft skirt
        const seeds = [], rAt = (y) => (y > 40 ? 4.5 * Math.pow(Math.max(0, 1 - ((y - 40) / 10.3) ** 2), 0.55) : 4.5);
        for (let i = 0; i < 44; i++) { const y = 2 + 47 * Math.random(), a = (Math.random() < 0.5 ? -1 : 1) * (1.15 + 0.3 * Math.random()); seeds.push({ p: L(Math.cos(a) * rAt(y), y, Math.sin(a) * rAt(y)), out: D(Math.cos(a), Math.sin(a)) }); }
        for (let a = -1.2; a <= 1.2; a += 0.2) seeds.push({ p: L(Math.cos(a) * 1.4, 49.6, Math.sin(a) * 1.4), out: D(Math.cos(a), Math.sin(a)).add(V3(0, 0.5, 0)).normalize() });
        for (const [y, z] of [[42, 7.2], [48, 6.6], [3, 8.2], [12, 8.0]]) for (const sg of [-1, 1]) for (let k = 0; k < 2; k++) seeds.push({ p: L(1.3, y + k * 1.2, sg * z), out: D(0.3, sg) });
        const tr = streaks(seeds, { F, len: 90, spread: 10, w: 0.42, c1: "#ffa0d4", c2: "#5a4cff", per: 2, k: 0.9 });
        const pl = new THREE.PointLight("#ff6fae", 700, 160, 2); pl.position.copy(L(9, 26, 0)); world.add(pl);
        let c = 0;
        return {
          chase: [24, 16, 72], focus: 0, shadow: 60, sunDir, space: true, spin: 0.004,
          events: e.span ? [] : [[0, "Belly-first at ~60° angle of attack · 7 km/s"], [10, "Plasma wraps the hexagonal heat-shield tiles"], [30, "Peak heating · ~1,400 °C on the windward side"], [50, "Flaps trim the attitude like a skydiver's arms and legs"]],
          place: () => ({ pos: V3(0, 0, 0) }),
          update(t, s, dt) {
            c += dt; E.set(t); if (e.span) E.place(info.hud(e.a0 + t).alt * 1000); v.flaps(0.15, c);
            const p = entryGlow(t, [[0, 0.7], [30, 1], [70, 0.85]]), f = 0.94 + 0.06 * Math.random();
            shells.forEach((sh) => sh(p * f, c)); tr(p, c);
            pl.intensity = 700 * p * f;
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

    const sc = SCENES[e.id](e.c);
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
      G.shake = 0;
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
      // long shots turn with the wall clock (their mission clock can run thousands of times too fast), set pieces with the mission clock
      const yaw = orbit.yaw + (sc.spin || 0) * (e.span ? G.rt : ss), d = orbit.dist * (sc.zoom ? sc.zoom(ss) : 1);
      const pitch = Math.min(1.45, orbit.pitch + (sc.lift ? sc.lift(ss) : 0)), cp = Math.cos(pitch);
      camera.position.set(target.x + d * cp * Math.sin(yaw), target.y + d * Math.sin(pitch), target.z + d * cp * Math.cos(yaw));
      if (sc.floor !== undefined) camera.position.y = Math.max(sc.floor, camera.position.y);
      // shake: a smooth rumble on the wall clock (random jitter per frame reads as stutter)
      const j = G.shake * d * 0.003, c = G.rt;
      const jit = V3(j * (Math.sin(c * 31) + Math.sin(c * 19.3 + 1.7)), j * (Math.sin(c * 27.1 + 0.4) + Math.sin(c * 23.9 + 2.2)), 0);
      camera.position.add(jit);
      camera.lookAt(target.clone().add(jit));
      camera.updateMatrixWorld();
      for (const f of sunViews) f(sc.sunDir);
    }
    return { scene, frame, aim, orbit, pmin: sc.pmin ?? (sc.space ? -1.45 : -0.1), title: sc.title, reset: () => sc.reset && sc.reset() };
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
    // set pieces run at their own pace for their scripted length; long shots and held set pieces keep the mission's warp
    speedAt: (t) => { if (merging) return 0; const e = find(t); return e && !e.span && t - e.a0 <= e.m.dur ? e.m.speed : 0; },
    on: (t) => { const e = !dead && find(t); return !!e && !e.failed; },
    hud: () => hudv,
    // call every flight frame with the mission clock; -Infinity hides it
    draw(t) {
      if (t > -Infinity) load();
      const e = t > -Infinity && !dead ? find(t) : null;
      if (e && THREE) ensure(e);
      const vis = !!e && !e.failed;
      if (el.hidden === vis) el.hidden = !vis;
      if (!vis) { cur = null; lastS = null; hudv = null; return; }
      if (!e.R) { cur = null; lastS = null; capT.textContent = "Loading 3-D view…"; capE.textContent = capI.textContent = ""; return; }
      const now = performance.now(), rdt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
      lastNow = now;
      if (cur !== e) { cur = e; lastS = null; cutAt = now; }
      const s = t - e.a0;
      if (lastS !== null && s < lastS) e.R.reset();
      // a seek jumps further than a frame can at this speed: don't let the particles see it as elapsed time
      const fwd = lastS !== null && s > lastS, dt = fwd && s - lastS <= info.speed(t) * 0.25 ? s - lastS : 0;
      if (fwd) G.rt += rdt;
      lastS = s;
      // every cut is the same quick fade up from black, and only while playing (a paused seek shows the frame at once)
      G.renderer.domElement.style.opacity = info.playing() ? Math.min(1, (now - cutAt) / 350).toFixed(3) : "1";
      const ti = e.R.title ? e.R.title(s) || e.m.title : !e.span && s > e.m.dur && e.m.held ? e.m.held : e.m.title;
      if (capT.textContent !== ti) capT.textContent = ti;
      e.R.frame(s, dt);
      render();
      adapt(now);
    },
  };
}

export const LAND_RUNTIME = makeLand.toString();
