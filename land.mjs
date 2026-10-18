// 3-D landing view inside the launch player. A vehicle's mission script sets LANDING = { id, at } (at = mission time of
// touchdown); while the mission clock is inside that landing's window a three.js view covers the stage, synced to it.
// makeLand is shipped to the page as source (makeLand.toString()), so it must not use anything from this module.

export const LAND_CSS = `
.land{position:absolute;inset:0;z-index:2;background:#000;cursor:grab;touch-action:none;transition:opacity .25s}
.land[hidden]{display:none}
.land.drag{cursor:grabbing}
.land canvas{width:100%;height:100%;display:block}
.land-cap{position:absolute;right:12px;top:10px;max-width:min(340px,55%);text-align:right;pointer-events:none;font:600 13px/1.35 ui-sans-serif,system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000c}
.land-cap b{display:block;font:600 11px/1.6 var(--anatomy-mono);letter-spacing:.1em;text-transform:uppercase;color:#ff8a3d}
.land-cap i{display:block;font:11px/1.6 var(--anatomy-mono);font-style:normal;color:#c9d3e3}
`;

function makeLand(cfg, stage) {
  // ---- profiles: scripted, not simulated. motion rows are [t s, along-track m, altitude m, along-track speed, vertical speed];
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
  };
  // self-check: altitude never dips below the ground or climbs on the way down
  for (const [id, m] of Object.entries(M)) { let prev = Infinity; for (let t = 0; t <= m[m.length - 1][0] + 2; t += 0.02) { const h = herm(m, t)[1]; console.assert(h > -0.01 && h <= prev + 1e-6, id + ": altitude misbehaves at t=" + t.toFixed(2)); prev = h; } }
  const tLM = firstBelow(M.lm, 1.7); // contact probes touch
  // touch = scene time lined up with LANDING.at; speed = playback rate while the view is up
  const META = {
    f9: { touch: 17.2, dur: 22, speed: 1, title: "Booster landing · droneship" },
    sh: { touch: 30.8, dur: 36, speed: 1, title: "Booster catch · Starbase tower" },
    lm: { touch: tLM + 1.1, dur: 156, speed: 4, title: "Eagle · powered descent", ref: " above the Moon" },
  }[cfg.id];
  const motion = M[cfg.id], a0 = cfg.at - META.touch, a1 = a0 + META.dur;

  // ---- overlay
  const el = document.createElement("div");
  el.className = "land"; el.hidden = true;
  el.innerHTML = '<div class="land-cap"><b></b><span></span><i>3-D view · drag to orbit · scroll to zoom</i></div>';
  stage.querySelector(".fx-flash").after(el);
  const capT = el.querySelector("b"), capE = el.querySelector("span");
  capT.textContent = META.title;

  let THREE = null, loading = null, R = null, last = { s: 0 }, lastS = null, h = { alt: 0, vel: 0 };
  const orbit = { yaw: 0, pitch: 0, dist: 100 };
  function load() {
    loading ||= import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js").then((m) => { THREE = m; build(); }).catch((e) => console.warn("3-D landing unavailable:", e));
  }

  function build() {
    const D2R = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene(), world = scene;
    const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 300000);
    const hemi = new THREE.HemisphereLight(), sun = new THREE.DirectionalLight();
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    scene.add(hemi, sun, sun.target);

    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
    function mesh(geo, mat, parent, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
    const cyl = (rt, rb, y0, y1, mat, parent, seg = 48, open = false) => mesh(new THREE.CylinderGeometry(rt, rb, y1 - y0, seg, 1, open), mat, parent, 0, (y0 + y1) / 2, 0);
    function rod(a, b, r, mat, parent) { // cylinder from point a to point b
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), m = mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 10), mat, parent);
      m.position.copy(A).add(B).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize());
      return m;
    }
    function tex(w, hh, draw, repeat) {
      const c = document.createElement("canvas"); c.width = w; c.height = hh; draw(c.getContext("2d"), w, hh);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
      return t;
    }
    const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const lattice = (cells, line, color) => (g, w, hh) => {
      g.strokeStyle = color; g.lineWidth = line;
      for (let i = 0; i <= cells; i++) { const p = (i / cells) * w; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, hh); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
    };
    const plumeTex = tex(4, 128, (g, w, hh) => { const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, "#fff"); gr.addColorStop(0.5, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, hh); });
    const dotTex = tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });

    // exhaust: an additive glowing tube that is brightest at the nozzle; returned setter takes power 0..1
    function plume(parent, x, y, z, r, len, color, { spread = 1.6, opacity = 1 } = {}) {
      const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
      const mk = (rt, rb, c, o, sy) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, 1, 24, 1, true).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: c, map: plumeTex, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.scale.y = sy; g.add(m); };
      mk(r, r * spread, color, 0.6 * opacity, 1);
      mk(r * 0.6, r * 0.3, "#fff6e6", 0.9 * opacity, 0.4);
      return (p) => { g.visible = p > 0.02; g.scale.set(1, len * p * (0.93 + 0.07 * Math.random()), 1); };
    }

    // dust, spray or steam thrown out where the exhaust hits the ground
    function particles({ n = 4000, color, size, drag, rise, gravity, life, opacity }) {
      const pos = new Float32Array(n * 3).fill(-1e5), vel = new Float32Array(n * 3), age = new Float32Array(n).fill(1e9);
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: dotTex, transparent: true, opacity, depthWrite: false }));
      pts.frustumCulled = false; world.add(pts);
      let head = 0, acc = 0;
      return {
        reset() { pos.fill(-1e5); age.fill(1e9); acc = 0; geo.attributes.position.needsUpdate = true; },
        step(dt, src) { // src: {x, y, z, r0, rate, speed, up}
          if (dt <= 0) return;
          acc += src.rate * dt;
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
            pos[j] += vel[j] * dt; pos[j + 1] = Math.max(src.y, pos[j + 1] + vel[j + 1] * dt); pos[j + 2] += vel[j + 2] * dt;
          }
          geo.attributes.position.needsUpdate = true;
        },
      };
    }
    function earthSky(top, fog, near, far) {
      scene.background = new THREE.Color(top);
      scene.fog = new THREE.Fog(fog, near, far);
      hemi.color.set("#d6e6ff"); hemi.groundColor.set("#3a4a5a"); hemi.intensity = 1.6;
      sun.color.set("#fff2df"); sun.intensity = 2.8;
    }

    // ---- vehicles (metres; root origin = feet / base)
    function falcon9Booster() {
      const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = 2.28;
      const soot = tex(256, 1024, (g, w, hh) => {
        g.fillStyle = "#eceef0"; g.fillRect(0, 0, w, hh);
        const r = rng(9);
        for (let i = 0; i < 260; i++) { const x = r() * w, y = r() * hh, low = y / hh; g.strokeStyle = "rgba(28,24,20," + (0.08 + 0.5 * low * low * r()) + ")"; g.lineWidth = 2 + 10 * r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + 60 + 200 * r()); g.stroke(); }
        const gr = g.createLinearGradient(0, hh * 0.75, 0, hh); gr.addColorStop(0, "rgba(20,18,16,0)"); gr.addColorStop(1, "rgba(20,18,16,.85)"); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
      });
      const white = std("#ffffff", { map: soot, roughness: 0.55 }), black = std("#15171a", { roughness: 0.7 }), metal = std("#55595f", { metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide });
      cyl(1.83, 1.83, 1.2, 42, white, body);
      cyl(1.83, 1.83, 42, 48.5, black, body);
      cyl(1.95, 1.95, 0.1, 1.4, metal, body);
      const bell = new THREE.CylinderGeometry(0.24, 0.47, 1.1, 20, 1, true);
      for (let i = -1; i < 8; i++) { const a = (i * Math.PI) / 4, r = i < 0 ? 0 : 1.25; mesh(bell, metal, body, Math.cos(a) * r, -0.35, Math.sin(a) * r); }
      const finMat = std("#a3a8ae", { metalness: 0.5, roughness: 0.4, map: tex(64, 64, lattice(5, 5, "#fff")), alphaTest: 0.5, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2, f = mesh(new THREE.BoxGeometry(1.7, 1.4, 0.12), finMat, body, Math.cos(a) * 2.7, 46.5, Math.sin(a) * 2.7); f.rotation.y = -a; }
      const legMat = std("#1c1d20", { roughness: 0.5 }), legs = [];
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4, holder = new THREE.Group(), pivot = new THREE.Group();
        holder.rotation.y = -a; body.add(holder); holder.add(pivot); pivot.position.set(1.95, 3.5, 0);
        mesh(new THREE.BoxGeometry(0.5, 9, 0.38), legMat, pivot, 0, 4.5, 0);
        mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 16), legMat, pivot, 0, 9, 0);
        legs.push(pivot);
      }
      const fire = plume(body, 0, -0.9, 0, 0.45, 26, "#ffa64d");
      return { root, legs: (k) => legs.forEach((p) => (p.rotation.z = -k * 130 * D2R)), fire };
    }

    function superHeavy() {
      const root = new THREE.Group();
      const steelTex = tex(512, 1024, (g, w, hh) => {
        g.fillStyle = "#d4d8dd"; g.fillRect(0, 0, w, hh);
        g.strokeStyle = "rgba(70,74,80,.45)"; g.lineWidth = 2;
        for (let y = 0; y < hh; y += hh / 36) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        const r = rng(4);
        for (let i = 0; i < 160; i++) { const y = r() > 0.5 ? r() * 90 : hh - r() * 140; g.fillStyle = "rgba(40,34,28," + 0.15 * r() + ")"; g.fillRect(r() * w, y, 4 + 20 * r(), 10 + 60 * r()); }
      });
      const steel = std("#ffffff", { map: steelTex, metalness: 0.45, roughness: 0.32 }), dark = std("#2a2c30", { metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide });
      cyl(4.5, 4.5, 1.4, 69, steel, root);
      cyl(4.5, 4.5, 69, 72.5, dark, root);
      cyl(4.62, 4.62, 0, 1.6, dark, root);
      const bell = new THREE.CylinderGeometry(0.32, 0.62, 2.0, 18, 1, true), fires = [];
      const ring = (n, r, a0, lit) => { for (let i = 0; i < n; i++) { const a = a0 + (i * 2 * Math.PI) / n, x = Math.cos(a) * r, z = Math.sin(a) * r; mesh(bell, dark, root, x, 0.2, z); if (lit) fires.push(plume(root, x, -0.8, z, 0.55, 40, "#8fb6ff", { spread: 1.9 })); } };
      ring(3, 0.95, 0, true); ring(10, 2.3, 0.3, true); ring(20, 3.75, 0, false);
      const finMat = std("#7c8086", { metalness: 0.5, roughness: 0.4, map: tex(64, 64, lattice(6, 5, "#fff")), alphaTest: 0.5, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, f = mesh(new THREE.BoxGeometry(4, 3.2, 0.45), finMat, root, Math.cos(a) * 6.5, 67.6, Math.sin(a) * 6.5); f.rotation.y = -a; }
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(1.6, 0.8, 1.2), dark, root, s * 5.3, 65.4, 0); // catch pins
      return { root, fires };
    }

    function lunarModule() {
      const root = new THREE.Group();
      const gold = std("#c9a23a", { metalness: 0.35, roughness: 0.45 }), foil = std("#2d2a25", { roughness: 0.5 }), grey = std("#a7abb0", { roughness: 0.55 }), dark = std("#222", { side: THREE.DoubleSide });
      mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.65, 8), gold, root, 0, 2.45, 0).rotation.y = Math.PI / 8;
      mesh(new THREE.CylinderGeometry(0.42, 0.8, 1.4, 24, 1, true), dark, root, 0, 1.0, 0);
      const probes = [];
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), f = [c * 4.3, 0.2, s * 4.3];
        rod([c * 1.9, 3.1, s * 1.9], f, 0.09, gold, root);
        rod([c * 1.9, 1.7, s * 1.9], [c * 3.3, 1.1, s * 3.3], 0.06, grey, root);
        mesh(new THREE.CylinderGeometry(0.47, 0.4, 0.2, 20), grey, root, f[0], 0.1, f[2]);
        if (i !== 1) probes.push(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6).translate(0, -0.8, 0), grey, root, f[0], 0.05, f[2]));
      }
      // ascent stage: cabin, front face with windows, tanks, thruster quads, docking hatch, antenna
      const cab = mesh(new THREE.CylinderGeometry(1.25, 1.25, 2.6, 12), grey, root, 0.1, 4.6, 0); cab.rotation.z = Math.PI / 2;
      mesh(new THREE.BoxGeometry(0.6, 2.0, 2.4), grey, root, 1.35, 4.35, 0);
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.05, 0.5, 0.5), std("#0b0d10", { roughness: 0.2, metalness: 0.6 }), root, 1.67, 4.9, s * 0.55).rotation.x = s * 0.3;
      mesh(new THREE.BoxGeometry(1.6, 1.8, 2.8), foil, root, -1.2, 4.3, 0);
      mesh(new THREE.SphereGeometry(0.6, 16, 12), grey, root, -0.6, 4.2, 1.75);
      for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), foil, root, Math.cos(a) * 1.9, 5.3, Math.sin(a) * 1.9); }
      cyl(0.45, 0.5, 5.8, 6.3, grey, root, 20);
      rod([-1.3, 5.2, -0.9], [-1.9, 6.4, -1.3], 0.04, grey, root);
      mesh(new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, 1.0), std("#ddd", { side: THREE.DoubleSide }), root, -1.9, 6.4, -1.3);
      const fire = plume(root, 0, 0.3, 0, 0.78, 14, "#ffcf8a", { spread: 5, opacity: 0.18 });
      return { root, fire, probes: (hh) => probes.forEach((p) => (p.scale.y = Math.min(1, Math.max(0.02, (hh + 0.05) / 1.6)))) };
    }

    function moonWorld(sunElev, sunAz) {
      scene.background = new THREE.Color("#000");
      hemi.color.set("#9aa4b5"); hemi.groundColor.set("#222"); hemi.intensity = 0.12;
      sun.color.set("#fffaf2"); sun.intensity = 3.4;
      // craters: many small ones round the site, big ones far out; flattened at the landing spot
      const r = rng(7), cr = [];
      for (let i = 0; i < 280; i++) cr.push([(r() - 0.5) * 3000, (r() - 0.5) * 3000, 3 + 40 * r() ** 2]);
      for (let i = 0; i < 160; i++) cr.push([(r() - 0.5) * 30000, (r() - 0.5) * 30000, 40 + 700 * r() ** 3]);
      const height = (x, z) => {
        let y = 4 * Math.sin(x / 700) * Math.cos(z / 900) + 1.2 * Math.sin(x / 170 + z / 230);
        for (const [cx, cz, cr0] of cr) { const d2 = (x - cx) ** 2 + (z - cz) ** 2; if (d2 > 2.2 * cr0 * cr0) continue; const q = Math.sqrt(d2) / cr0; y += cr0 * 0.16 * ((q < 1 ? q * q - 1 : 0) + 0.35 * Math.exp(-(((q - 1) / 0.22) ** 2))); }
        return y * sm(20, 160, Math.hypot(x, z));
      };
      const N = 280, S = 16000, geo = new THREE.PlaneGeometry(2, 2, N, N).rotateX(-Math.PI / 2), p = geo.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i), w = p.getZ(i), x = S * u * (0.02 + 0.98 * u * u), z = S * w * (0.02 + 0.98 * w * w); // dense near the site, sparse far out
        p.setXYZ(i, x, height(x, z), z);
        const c = 0.5 + 0.06 * ((((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) + 1) % 1);
        col.set([c, c, c * 0.97], i * 3);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.computeVertexNormals();
      mesh(geo, std("#ffffff", { vertexColors: true, roughness: 1 }), world).castShadow = false;
      const sg = new THREE.BufferGeometry(), sp = new Float32Array(2500 * 3);
      for (let i = 0; i < 2500; i++) { const v = new THREE.Vector3(r() - 0.5, r() * 0.9 + 0.02, r() - 0.5).normalize().multiplyScalar(100000); sp.set([v.x, v.y, v.z], i * 3); }
      sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
      world.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: "#fff", size: 1.3, sizeAttenuation: false })));
      const earth = mesh(new THREE.SphereGeometry(660, 48, 24), std("#3d78c9", { roughness: 0.8, emissive: "#0a1830" }), world);
      earth.position.set(-15000, 30000, -22000).setLength(40000);
      earth.castShadow = false;
      return new THREE.Vector3(Math.cos(sunElev * D2R) * Math.cos(sunAz * D2R), Math.sin(sunElev * D2R), Math.cos(sunElev * D2R) * Math.sin(sunAz * D2R));
    }

    // each scene: { dir, chase, focus, shadow, sunDir, events, tilt, ground(t), update(t, s, dt), status(t), root, reset }
    const SCENES = {
      f9() {
        earthSky("#86acd6", "#a8c4e2", 800, 9000);
        const ocean = mesh(new THREE.PlaneGeometry(3000, 3000, 120, 120).rotateX(-Math.PI / 2), std("#1c4563", { roughness: 0.22, metalness: 0.2 }), world);
        ocean.castShadow = false;
        mesh(new THREE.PlaneGeometry(200000, 200000).rotateX(-Math.PI / 2), std("#1c4563", { roughness: 0.3 }), world, 0, -0.7, 0).castShadow = false;
        const ship = new THREE.Group(); world.add(ship);
        mesh(new THREE.BoxGeometry(91, 6, 52), std("#2c3036", { roughness: 0.8 }), ship);
        const deckTex = tex(512, 292, (g, w, hh) => {
          g.fillStyle = "#3a3e44"; g.fillRect(0, 0, w, hh);
          g.strokeStyle = "#e8e8e8"; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, hh / 2, hh * 0.36, 0, Math.PI * 2); g.stroke();
          g.lineWidth = 14; g.beginPath(); g.moveTo(w / 2 - 50, hh / 2 - 50); g.lineTo(w / 2 + 50, hh / 2 + 50); g.moveTo(w / 2 + 50, hh / 2 - 50); g.lineTo(w / 2 - 50, hh / 2 + 50); g.stroke();
          const r = rng(3); g.fillStyle = "rgba(0,0,0,.25)"; for (let i = 0; i < 60; i++) g.fillRect(r() * w, r() * hh, 30, 3);
        });
        mesh(new THREE.PlaneGeometry(91, 52).rotateX(-Math.PI / 2), std("#ffffff", { map: deckTex, roughness: 0.85 }), ship, 0, 3.01, 0);
        for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(91, 2.4, 1.2), std("#3b4048"), ship, 0, 4.2, s * 25.4);
        for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(6, 6, 6), std("#5a5f66"), ship, 40, 6, s * 18);
        const v = falcon9Booster(); world.add(v.root);
        const spray = particles({ color: "#e9eef3", size: 5, drag: 0.9, rise: 2.5, gravity: 0, life: 5, opacity: 0.28 });
        const legs = [[13.5, 0], [15.5, 1]], thr = [[0, 0], [6.9, 0], [7.4, 1], [13.8, 0.75], [17.2, 0.5], [17.6, 0]];
        const op = ocean.geometry.attributes.position, wave = (x, z, c) => 0.35 * Math.sin(x * 0.045 + c * 1.1) + 0.25 * Math.sin(z * 0.06 - c * 0.8) + 0.12 * Math.sin((x + z) * 0.13 + c * 1.7);
        let clock = 0;
        return {
          dir: [1, 0, 0], chase: [55, 10, 85], focus: 22, shadow: 60, sunDir: new THREE.Vector3(-0.5, 0.75, 0.4).normalize(), reset: spray.reset,
          tilt: [[0, 6], [7, 8], [14, 2], [17, 0]],
          events: [[0, "Falling through 3 km at ~920 km/h after the entry burn, grid fins steering"], [7, "Landing burn: the centre Merlin relights"], [13.5, "Landing legs swing down on helium pistons"], [17.2, "Touchdown on the droneship's X"], [17.6, "Engine cutoff"]],
          ground: () => 3 + 0.25 * Math.sin(clock * 0.7),
          update(t, s, dt) {
            clock += dt;
            for (let i = 0; i < op.count; i++) op.setY(i, wave(op.getX(i), op.getZ(i), clock));
            op.needsUpdate = true; ocean.geometry.computeVertexNormals();
            ship.position.y = 0.25 * Math.sin(clock * 0.7); ship.rotation.x = 0.006 * Math.sin(clock * 0.5);
            v.legs(lin(legs, t));
            const p = lin(thr, t); v.fire(p);
            spray.step(dt, { x: s.pos.x, y: 3.3, z: s.pos.z, r0: 2, rate: s.h < 45 ? p * 500 * (1 - s.h / 45) : 0, speed: 28, up: 6 });
          },
          root: v.root,
        };
      },

      sh() {
        earthSky("#8db3dc", "#bcd0e4", 1500, 20000);
        const sand = mesh(new THREE.PlaneGeometry(100000, 50000).rotateX(-Math.PI / 2), std("#c8b48e", { roughness: 1 }), world, 0, 0, -24300);
        const sea = mesh(new THREE.PlaneGeometry(100000, 50000).rotateX(-Math.PI / 2), std("#2a5a7c", { roughness: 0.25, metalness: 0.2 }), world, 0, -0.3, 25700);
        sand.castShadow = sea.castShadow = false;
        mesh(new THREE.BoxGeometry(110, 0.4, 110), std("#a9abad", { roughness: 0.9 }), world, 0, 0.2, -10);
        const grey = std("#5d6268", { roughness: 0.6, metalness: 0.3 });
        // orbital launch mount under the catch point
        mesh(new THREE.CylinderGeometry(9.5, 9.5, 3, 40), grey, world, 0, 19.5, 0);
        for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; mesh(new THREE.BoxGeometry(2.6, 18, 2.6), std("#8e9194"), world, Math.cos(a) * 8.5, 9, Math.sin(a) * 8.5); }
        // tower: lattice box, a carriage and the two chopstick arms
        const lat = tex(128, 128, (g, w, hh) => { g.strokeStyle = "#fff"; g.lineWidth = 9; g.strokeRect(0, 0, w, hh); g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, hh); g.moveTo(w, 0); g.lineTo(0, hh); g.stroke(); }, [1, 12]);
        mesh(new THREE.BoxGeometry(12, 146, 12), std("#6e7379", { map: lat, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.4 }), world, 0, 73, -22).castShadow = false;
        mesh(new THREE.BoxGeometry(13.6, 5, 13.6), grey, world, 0, 99.5, -22);
        const arms = [-1, 1].map((sd) => { const pv = new THREE.Group(); pv.position.set(sd * 6, 99.75, -16); world.add(pv); mesh(new THREE.BoxGeometry(1.6, 2.5, 36), std("#3a3d42", { metalness: 0.5, roughness: 0.5 }), pv, 0, 0, 18); return [pv, sd]; });
        const v = superHeavy(); world.add(v.root);
        const steam = particles({ color: "#eef1f4", size: 9, drag: 0.7, rise: 3, gravity: 0, life: 7, opacity: 0.25 });
        const t13 = [[0, 0], [6.9, 0], [7.4, 1], [14.6, 1], [15.2, 0]], t3 = [[0, 0], [6.9, 0], [7.4, 1], [30.4, 0.6], [30.8, 0]], open = [[26, 1], [29, 0]];
        return {
          dir: [0, 0, -1], chase: [110, 20, 150], focus: 36, shadow: 110, sunDir: new THREE.Vector3(0.6, 0.7, 0.5).normalize(), reset: steam.reset,
          tilt: [[0, 8], [15, 6], [25, 2], [29, 0]],
          events: [[0, "Coming back to Starbase at ~1,080 km/h after the boostback burn"], [7, "Landing burn: 13 Raptors light"], [15, "Down to the 3 centre engines for fine positioning"], [20, "Slides in over the launch mount, between the open chopsticks"], [26, "Chopsticks close"], [30.8, "Caught · engines off, the catch pins settle onto the arms"]],
          ground: () => 0,
          update(t, s, dt) {
            const a = lin(open, t) * 32 * D2R;
            for (const [pv, sd] of arms) pv.rotation.y = -sd * a;
            const p13 = lin(t13, t), p3 = lin(t3, t);
            v.fires.forEach((f, i) => f(i < 3 ? p3 : p13));
            steam.step(dt, { x: s.pos.x, y: 0.5, z: s.pos.z, r0: 8, rate: s.h < 160 ? Math.max(p3, p13) * 600 * (1 - s.h / 160) : 0, speed: 35, up: 8 });
          },
          root: v.root,
        };
      },

      lm() {
        const sunDir = moonWorld(11, 35); // Apollo 11 landed with the Sun ~10° up
        const v = lunarModule(); world.add(v.root);
        const dust = particles({ color: "#b7b2a8", size: 0.9, drag: 0, rise: 0, gravity: 1.62, life: 3.5, opacity: 0.55 });
        const thr = [[0, 0.6], [100, 0.35], [tLM + 1, 0.3], [tLM + 1.15, 0]];
        return {
          dir: [1, 0, 0], chase: [18, 4, 28], focus: 3, shadow: 40, sunDir, reset: dust.reset,
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
    };

    const sc = SCENES[cfg.id]();
    const dir = new THREE.Vector3(...sc.dir), axis = new THREE.Vector3().crossVectors(dir, UP), target = new THREE.Vector3();
    const shc = sun.shadow.camera; shc.left = shc.bottom = -sc.shadow; shc.right = shc.top = sc.shadow; shc.near = 1; shc.far = 2000; shc.updateProjectionMatrix();
    const off = new THREE.Vector3(...sc.chase);
    orbit.dist = off.length(); orbit.yaw = Math.atan2(off.x, off.z); orbit.pitch = Math.asin(off.y / orbit.dist);

    function frame(s, dt) {
      const [x, hh, vx, vh] = herm(motion, s);
      const pos = dir.clone().multiplyScalar(x).setY(sc.ground(s) + hh);
      sc.root.position.copy(pos);
      sc.root.quaternion.setFromAxisAngle(axis, lin(sc.tilt, s) * D2R);
      sc.update(s, { h: hh, pos }, dt);
      target.copy(pos).add(new THREE.Vector3(0, sc.focus, 0));
      sun.position.copy(target).addScaledVector(sc.sunDir, 600);
      sun.target.position.copy(target);
      h = { alt: hh / 1000, vel: Math.hypot(vx, vh) * 3.6 };
      let ev = "";
      for (const [et, txt] of sc.events) if (s >= et - 1e-6) ev = txt;
      if (capE.textContent !== ev) capE.textContent = ev;
    }
    function render() {
      const w = el.clientWidth, hh = el.clientHeight;
      if (!w || !hh) return;
      if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix(); }
      const cp = Math.cos(orbit.pitch);
      camera.position.set(target.x + orbit.dist * cp * Math.sin(orbit.yaw), Math.max(1, target.y + orbit.dist * Math.sin(orbit.pitch)), target.z + orbit.dist * cp * Math.cos(orbit.yaw));
      camera.lookAt(target);
      renderer.render(scene, camera);
    }
    R = { frame, render, reset: sc.reset };
  }

  // drag to orbit, wheel to zoom; keep these off the stage's own pan/zoom
  let drag = null;
  el.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); drag = [ev.clientX, ev.clientY]; el.setPointerCapture(ev.pointerId); el.classList.add("drag"); });
  el.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    orbit.yaw -= (ev.clientX - drag[0]) * 0.006;
    orbit.pitch = Math.min(1.45, Math.max(-0.1, orbit.pitch + (ev.clientY - drag[1]) * 0.006));
    drag = [ev.clientX, ev.clientY];
    R?.render();
  });
  el.addEventListener("pointerup", () => { drag = null; el.classList.remove("drag"); });
  el.addEventListener("wheel", (ev) => { ev.preventDefault(); ev.stopPropagation(); orbit.dist = Math.min(4000, Math.max(8, orbit.dist * Math.exp(ev.deltaY * 0.0012))); R?.render(); }, { passive: false });

  const on = (t) => t >= a0 && t <= a1;
  return {
    a0, a1, speed: META.speed,
    on: (t) => on(t) && !!R,
    hud: () => ({ alt: h.alt, vel: h.vel, ref: META.ref || "" }),
    // call every flight frame with the mission clock; -Infinity hides it
    draw(t) {
      if (t > -Infinity) load();
      const vis = on(t) && !!R;
      if (el.hidden === vis) el.hidden = !vis;
      if (!vis) { lastS = null; return; }
      const s = t - a0;
      if (lastS !== null && s < lastS) R.reset();
      const dt = lastS === null || s < lastS || s - lastS > 1 ? 0 : s - lastS;
      lastS = s;
      el.style.opacity = (sm(0, 0.8, s) * (1 - sm(META.dur - 0.8, META.dur, s))).toFixed(3);
      R.frame(s, dt);
      R.render();
    },
  };
}

export const LAND_RUNTIME = makeLand.toString();
