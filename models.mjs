// The launch vehicles of the 3-D player, built from simple solids and canvas textures to the dimensions of the
// anatomy figures and the real rockets (metres, +y up, the vehicle's axis on x = z = 0; an angle a on a body of
// revolution faces (sin a, 0, cos a), so 0 faces +z). makeModels is shipped to the page as source next to makeLand,
// which calls it with its kit of helpers once for every 3-D scene, so it must not use anything from this module.
export function makeModels(K) {
  const { THREE, X, V3, TAU, D2R, std, mesh, cyl, lathe, box, rod, tex, once, rng, exhaust, thrusters } = K;
  const NS = THREE.NoColorSpace;

  // ---------------------------------------------------------------- kit
  // a group sitting on a body of revolution at angle a, radius r, height y: local +z points out of the skin, +x along it.
  // Yaw first, then pitch: rotation.x set later tilts it about its own +x (the skin's tangent), so a leg or fin
  // swings out along its own azimuth and a window leans with the cone it sits on
  function skin(parent, a, r, y) { const g = new THREE.Group(); g.position.set(Math.sin(a) * r, y, Math.cos(a) * r); g.rotation.order = "YXZ"; g.rotation.y = a; parent.add(g); return g; }
  // canvas texture cached for every scene; normal(...) turns a height drawing into a tangent-space normal map
  const ctex = (key, w, h, draw, o = {}) => once(key, () => { const t = tex(w, h, draw, o.repeat, o.srgb !== false); if (o.flip === false) t.flipY = false; return t; });
  function normal(key, w, h, draw, k = 2, repeat) {
    return once(key, () => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"); draw(g, w, h);
      const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), o = out.data, H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k, n = 1 / Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
        o[i] = (0.5 - dx * n * 0.5) * 255; o[i + 1] = (0.5 + dy * n * 0.5) * 255; o[i + 2] = n * 255; o[i + 3] = 255;
      }
      g.putImageData(out, 0, 0);
      const t = new THREE.CanvasTexture(c); t.colorSpace = NS; t.anisotropy = 8;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
      return t;
    });
  }
  // merge many small parts into one mesh (one draw call): add(geometry, x, y, z, rx, ry, rz)
  function batch(mat, parent) {
    const list = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V3(1, 1, 1);
    return {
      add(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m4.compose(V3(x, y, z), q.setFromEuler(e.set(rx, ry, rz, "YXZ")), one)); delete g.attributes.uv2; list.push(g); return this; },
      addTo(frame, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { frame.updateMatrixWorld(true); const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m4.compose(V3(x, y, z), q.setFromEuler(e.set(rx, ry, rz, "YXZ")), one)).applyMatrix4(frame.matrix); list.push(g); return this; },
      done() { const m = mesh(X.mergeGeometries(list), mat, parent); list.length = 0; return m; },
    };
  }
  // a box tapering from w0 x d0 at y = 0 to w1 x d1 at y = h, its back (z = 0) flat
  function taper(w0, d0, w1, d1, h) {
    const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0.5), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getY(i); p.setXYZ(i, p.getX(i) * (w0 + (w1 - w0) * t), t * h, p.getZ(i) * (d0 + (d1 - d0) * t)); }
    g.computeVertexNormals(); return g;
  }
  // profile [[r, y], ...] turned round the axis
  const latheGeo = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
  // artwork painted on a body of revolution: a curved slice of radius r (rb at the bottom) between y0 and y1, centred
  // on angle a and `arc` radians wide; draw(g, w, h) paints a transparent canvas
  function decal(parent, r, y0, y1, a, arc, w, hh, draw, rb = r) {
    const m = mesh(new THREE.CylinderGeometry(r, rb, y1 - y0, 32, 1, true, a - arc / 2, arc), new THREE.MeshStandardMaterial({ map: tex(w, hh, draw), transparent: true, alphaTest: 0.04, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }), parent, 0, (y0 + y1) / 2, 0);
    m.castShadow = false; return m;
  }
  // the same, sized in metres: `width` across the skin, the canvas at ppm pixels per metre so the art keeps its shape
  const label = (parent, r, y0, y1, a, width, draw, ppm = 64, rb = r) => decal(parent, r, y0, y1, a, width / r, Math.max(8, Math.round(width * ppm)), Math.max(8, Math.round((y1 - y0) * ppm)), draw, rb);
  // a word turned on its side, reading top to bottom
  const rtext = (txt, col, font, sx = 1) => (g, w, hh) => { g.save(); g.font = font; const k = Math.min(1, (hh * 0.94) / (g.measureText(txt).width * sx)); g.translate(w / 2, hh / 2); g.rotate(Math.PI / 2); g.scale(sx * k, k); g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 0, 0); g.restore(); };
  // letters stacked top to bottom, upright, as big as the panel allows
  const vtext = (txt, col, weight = 800, family = "Helvetica,Arial,sans-serif") => (g, w, hh) => { const n = txt.length, size = Math.min((hh / n) * 0.9, w * 1.05); g.fillStyle = col; g.font = `${weight} ${size}px ${family}`; g.textAlign = "center"; g.textBaseline = "middle"; for (let i = 0; i < n; i++) g.fillText(txt[i], w / 2, ((i + 0.5) * hh) / n); };
  function flag(g, x, y, w, hh) {
    for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? "#fff" : "#b22234"; g.fillRect(x, y + (i * hh) / 13, w, hh / 13 + 0.5); }
    g.fillStyle = "#3c3b6e"; g.fillRect(x, y, w * 0.4, (hh * 7) / 13);
    g.fillStyle = "#fff"; for (let i = 0; i < 50; i++) g.fillRect(x + w * 0.02 + (i % 10) * w * 0.037, y + hh * 0.03 + Math.floor(i / 10) * hh * 0.1, w * 0.012, hh * 0.03);
  }
  const flagArt = (g, w, hh) => flag(g, 0, 0, w, hh);
  // the flag turned on its side (stripes running down the rocket), as flown on the boosters
  const flagSide = (g, w, hh) => { g.save(); g.translate(0, hh); g.rotate(-Math.PI / 2); flag(g, 0, 0, hh, w); g.restore(); };
  function meatball(g, cx, cy, r) {
    g.fillStyle = "#0b3d91"; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = r * 0.03; g.beginPath(); g.ellipse(cx, cy, r * 0.75, r * 0.28, -0.35, 0, TAU); g.stroke();
    g.fillStyle = "#fc3d21"; g.beginPath(); g.moveTo(cx - r * 0.9, cy + r * 0.35); g.quadraticCurveTo(cx, cy - r * 0.05, cx + r * 0.85, cy - r * 0.55); g.lineTo(cx + r * 0.2, cy - r * 0.05); g.quadraticCurveTo(cx - r * 0.2, cy + r * 0.2, cx - r * 0.9, cy + r * 0.35); g.fill();
    g.fillStyle = "#fff"; g.font = `bold ${r * 0.42}px Helvetica,Arial,sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("NASA", cx, cy + r * 0.02);
  }
  // NASA's "worm" logotype as stroked letters (no crossbars on the A's), h tall, centred on (cx, cy); vertical turns it
  // to read top to bottom down the side of a booster
  function worm(g, cx, cy, h, { vertical = false, down = false, col = "#d9262c" } = {}) {
    const w = h * 0.86, gap = h * 0.24, x = (i) => i * (w + gap), total = x(3) + w;
    const N = (o) => `M${o} ${h}V${h * 0.3}Q${o} 0 ${o + w * 0.32} ${h * 0.18}L${o + w * 0.68} ${h * 0.82}Q${o + w} ${h} ${o + w} ${h * 0.7}V0`;
    const A = (o) => `M${o} ${h}L${o + w * 0.36} ${h * 0.14}Q${o + w / 2} ${-h * 0.12} ${o + w * 0.64} ${h * 0.14}L${o + w} ${h}`;
    const S = (o) => `M${o + w} ${h * 0.02}H${o + w * 0.32}Q${o} ${h * 0.02} ${o} ${h * 0.27}Q${o} ${h * 0.5} ${o + w * 0.32} ${h * 0.5}H${o + w * 0.68}Q${o + w} ${h * 0.5} ${o + w} ${h * 0.74}Q${o + w} ${h * 0.98} ${o + w * 0.68} ${h * 0.98}H${o}`;
    g.save(); g.translate(cx, cy); if (vertical) g.rotate(down ? Math.PI / 2 : -Math.PI / 2); g.translate(-total / 2, -h / 2);
    g.strokeStyle = col; g.lineWidth = h * 0.22; g.lineCap = g.lineJoin = "round"; g.stroke(new Path2D(N(x(0)) + A(x(1)) + S(x(2)) + A(x(3)))); g.restore();
    return total;
  }
  // SpaceX's wordmark, approximated: heavy wide italic capitals with the swoosh through the X
  function spacex(g, cx, cy, h, col = "#101214", vertical = true) {
    g.save(); g.translate(cx, cy); if (vertical) g.rotate(-Math.PI / 2); // reads bottom to top, as on the rocket
    g.font = `italic 900 ${h}px 'Arial Black','Segoe UI Black',Arial,sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = col;
    g.scale(1.25, 1); const tw = g.measureText("SPACEX").width; g.fillText("SPACEX", 0, h * 0.04);
    g.lineWidth = h * 0.07; g.strokeStyle = col; g.beginPath(); g.moveTo(tw * 0.18, h * 0.32); g.quadraticCurveTo(tw * 0.42, -h * 0.05, tw * 0.62, -h * 0.55); g.stroke();
    g.restore();
  }
  // a rocket engine bell hanging below y = 0 is its exit; outer skin, a dark inside that glows (emissive) while it
  // fires, and a lip ring. rf(f) = radius at fraction f of the visible length up from the exit.
  function bellGeo(key, rExit, rTop, len, k = 0.8, seg = 40) {
    return once("bell:" + key, () => latheGeo(Array.from({ length: 17 }, (_, i) => { const f = i / 16; return [rExit - (rExit - rTop) * Math.pow(f, k), f * len]; }), seg));
  }
  function engineMats(outer, inside, glow) {
    return {
      out: std(outer, { metalness: 0.75, roughness: 0.38 }),
      in: std(inside, { metalness: 0.5, roughness: 0.6, side: THREE.BackSide, emissive: new THREE.Color(glow), emissiveIntensity: 0 }),
    };
  }
  function bell(parent, geo, mats, x, y, z, lip) {
    const a = mesh(geo, mats.out, parent, x, y, z), b = mesh(geo, mats.in, parent, x, y, z);
    b.castShadow = false;
    if (lip) mesh(once("lip" + lip, () => new THREE.TorusGeometry(lip, lip * 0.035, 6, 40).rotateX(Math.PI / 2)), mats.out, parent, x, y + lip * 0.02, z);
    return a;
  }

  // ---------------------------------------------------------------- Falcon 9 Block 5 and Crew Dragon
  // metres from the Merlin exit plane: bells to 1.4, base heat shield, white tanks to 41.2, black interstage to 47.7 with
  // the grid fins and cold-gas pods at its top, second stage to 57.6, Crew Dragon's trunk to 61.2, the capsule to 65.7
  const F9 = { R: 1.83, bell: 1.45, base: 1.9, tank: 41.2, is: 47.7, mvExit: 43.6, s2: 57.6 };
  const XANG = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]; // legs and grid fins in an X
  const f9Body = () => ctex("f9body", 1024, 2048, (g, w, h) => {
    // a flight-proven booster: white paint, faint barrel welds, soot from its entry and landing burns, darker toward
    // the top (under the interstage) and the base, in streaks that run down the tank
    const Y = (y) => (1 - (y - F9.base) / (F9.tank - F9.base)) * h, r = rng(9);
    g.fillStyle = "#f3f4f5"; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(60,64,70,.07)"; for (let y = 4.4; y < F9.tank; y += 2.75) g.fillRect(0, Y(y), w, 3);
    g.fillStyle = "rgba(60,64,70,.12)"; g.fillRect(0, Y(16.9), w, 4); // the common dome between RP-1 and LOX
    const band = (ya, yb, a0, a1) => { const gr = g.createLinearGradient(0, Y(ya), 0, Y(yb)); gr.addColorStop(0, `rgba(34,29,24,${a0})`); gr.addColorStop(1, `rgba(34,29,24,${a1})`); g.fillStyle = gr; g.fillRect(0, Y(ya), w, Y(yb) - Y(ya)); };
    band(F9.tank, 33, 0.78, 0); band(F9.base, 6.5, 0.6, 0);
    for (let i = 0; i < 420; i++) {
      const x = r() * w, top = r() < 0.75, len = (top ? 3 + 14 * r() * r() : 1 + 5 * r()) * (h / (F9.tank - F9.base)), y0 = top ? Y(F9.tank) - 10 : Y(F9.base) - len;
      const gr = g.createLinearGradient(0, y0, 0, y0 + len); const a = 0.05 + 0.32 * r() * r();
      gr.addColorStop(top ? 0 : 1, `rgba(30,26,22,${a})`); gr.addColorStop(top ? 1 : 0, "rgba(30,26,22,0)");
      g.fillStyle = gr; g.fillRect(x, y0, 2 + 9 * r(), len);
    }
  });
  const f9Rough = () => ctex("f9rough", 256, 512, (g, w, h) => { // soot is matte, paint has a sheen (green channel)
    g.drawImage(f9Body().image, 0, 0, w, h); const d = g.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const v = 90 + (255 - d.data[i]) * 1.6; d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.min(235, v); } g.putImageData(d, 0, 0);
  }, { srgb: false });
  // a titanium grid fin: frame and diamond lattice, its hinge on the bottom edge at the origin, lying in the x-y plane
  // (x along the hinge, y away from it, thickness along z)
  function gridFinGeo(key, W, Hh, T, cell) {
    return once("grid:" + key, () => {
      const parts = [], add = (g, x, y, rz) => { const q = g.toNonIndexed(); q.applyMatrix4(new THREE.Matrix4().makeRotationZ(rz)).translate(x, y, 0); delete q.attributes.uv; parts.push(q); };
      const bar = (L, w, t) => new THREE.BoxGeometry(L, w, t);
      add(bar(W, 0.07, T), 0, 0.035, 0); add(bar(W, 0.07, T), 0, Hh - 0.035, 0); add(bar(0.07, Hh, T), -W / 2 + 0.035, Hh / 2, 0); add(bar(0.07, Hh, T), W / 2 - 0.035, Hh / 2, 0);
      // diagonals across the frame at ±45°, each clipped to the rectangle
      for (const s of [1, -1]) for (let c = -(W + Hh); c <= W + Hh; c += cell) {
        const pts = [];
        for (const x of [-W / 2, W / 2]) { const y = (c - s * x) ; if (y >= 0 && y <= Hh) pts.push([x, y]); }
        for (const y of [0, Hh]) { const x = s * (c - y); if (x >= -W / 2 && x <= W / 2) pts.push([x, y]); }
        if (pts.length < 2) continue;
        const [[x0, y0], [x1, y1]] = pts, L = Math.hypot(x1 - x0, y1 - y0);
        if (L < 0.05) continue;
        add(bar(L, 0.016, T * 0.9), (x0 + x1) / 2, (y0 + y1) / 2, Math.atan2(y1 - y0, x1 - x0));
      }
      return X.mergeGeometries(parts);
    });
  }
  // the booster alone; root origin = Merlin exit plane. legs(k): 0 stowed .. 1 deployed; fins(k): 0 stowed .. 1 out;
  // fire(p, thin): the centre engine (entry and landing burns); all9(p, thin): the whole cluster (launch)
  function falcon9Booster() {
    const root = new THREE.Group(), R = F9.R;
    const white = std("#ffffff", { map: f9Body(), roughnessMap: f9Rough(), roughness: 1 });
    const carbon = std("#151619", { roughness: 0.55, metalness: 0.15 }), shield = std("#26231f", { roughness: 0.9 });
    cyl(R, R, F9.base, F9.tank, white, root, 96, true);
    // interstage: black composite, a ring of rivet lines at each end
    const ist = cyl(R + 0.02, R + 0.02, F9.tank, F9.is, std("#17181b", { roughness: 0.45, metalness: 0.2, normalMap: normal("f9isN", 512, 256, (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); g.fillStyle = "#606060"; for (let x = 0; x < w; x += w / 24) g.fillRect(x, 0, 2, h); for (const y of [0.04, 0.96]) g.fillRect(0, y * h, w, 2); }, 1.5) }), root, 96, true);
    ist.receiveShadow = true;
    mesh(new THREE.CircleGeometry(R + 0.02, 96).rotateX(-Math.PI / 2), carbon, root, 0, F9.is, 0); // its top (hidden by the second stage)
    // base: the heat shield with a boot round each engine, the Merlins hanging below it
    mesh(new THREE.CylinderGeometry(R, R - 0.06, 0.5, 96), shield, root, 0, F9.base - 0.25, 0);
    const em = engineMats("#3d3a37", "#2a2420", "#ffb066"), bg = bellGeo("merlin", 0.46, 0.22, F9.bell + 0.2);
    for (const [x, z] of MERLIN9) {
      bell(root, bg, em, x, 0, z, 0.46);
      mesh(once("boot", () => new THREE.CylinderGeometry(0.3, 0.36, 0.22, 24)), shield, root, x, F9.base - 0.55, z);
    }
    // landing legs, folded flat against the thrust section and tanks; pivot at the bottom, foot pad at the top
    const steel = std("#8f9297", { metalness: 0.8, roughness: 0.3 }), strutGeo = once("f9strut", () => new THREE.CylinderGeometry(0.075, 0.075, 1, 10).translate(0, 0.5, 0));
    const legs = XANG.map((a) => {
      const pv = skin(root, a, R - 0.02, 2.55);
      mesh(once("f9leg", () => taper(0.92, 0.42, 0.5, 0.26, 9.7)), carbon, pv);
      const pad = mesh(once("f9legPad", () => new THREE.CylinderGeometry(0.55, 0.62, 0.14, 24)), steel, pv, 0, 9.7, 0.32);
      pad.rotation.x = -125 * D2R; // flat on the deck once the leg is down
      // the telescoping pusher between the tank wall and the middle of the leg
      return { pv, a, strut: mesh(strutGeo, steel, root) };
    });
    const lp = V3(), bp = V3(), up = V3(0, 1, 0);
    const setLegs = (k) => legs.forEach(({ pv, a, strut }) => {
      pv.rotation.x = k * 125 * D2R; pv.updateMatrix();
      lp.set(0, 4.6, 0.2).applyMatrix4(pv.matrix); bp.set(Math.sin(a) * (R + 0.05), 9.4, Math.cos(a) * (R + 0.05));
      strut.position.copy(bp); strut.scale.set(1, bp.distanceTo(lp), 1); strut.quaternion.setFromUnitVectors(up, lp.sub(bp).normalize());
    });
    setLegs(0);
    // raceway and the flag, the NASA worm and SpaceX's wordmark
    box(0.32, F9.tank - 4.6, 0.16, white, skin(root, -1.25, R, (F9.tank + 4.6) / 2), 0, 0, 0.05);
    label(root, R + 0.012, 19, 30.5, 0, 1.45, (g, w, h) => spacex(g, w / 2, h / 2, w * 0.84));
    label(root, R + 0.012, 9.2, 12.9, 0.12, 0.95, (g, w, h) => worm(g, w / 2, h / 2, w * 0.8, { vertical: true }), 96);
    label(root, R + 0.012, 36.6, 37.78, 0, 2.2, flagArt, 96);
    // grid fins at the top of the interstage (stowed: folded up flat; deployed: straight out, the flow through the cells)
    const gm = std("#6d6a66", { metalness: 0.85, roughness: 0.42 }), fins = XANG.map((a) => {
      const pv = skin(root, a, R + 0.12, F9.is - 1.75);
      mesh(gridFinGeo("f9", 1.25, 1.5, 0.16, 0.13), gm, pv, 0, 0, 0.1);
      box(0.5, 0.3, 0.3, carbon, skin(root, a, R, F9.is - 1.85), 0, 0, 0.12); // hinge actuator housing
      return pv;
    });
    // cold-gas thruster pods between the fins
    for (const a of [Math.PI / 2, -Math.PI / 2]) { const s = skin(root, a, R, F9.is - 0.55); box(0.55, 0.75, 0.32, carbon, s, 0, 0, 0.12); mesh(new THREE.CircleGeometry(0.09, 12), std("#050506"), s, 0, 0, 0.285); }
    const ENG = MERLIN9;
    const all9 = exhaust(root, { at: [0, 0, 0], re: 0.46, len: 60, kind: "kero", cluster: ENG, nozR: 0.46, glow: em.in });
    const fire = exhaust(root, { at: [0, 0, 0], re: 0.46, len: 26, kind: "kero", glow: em.in });
    // the pads' undersides once the legs are down (the pad sits 0.32 m off the leg's back face, 0.07 m half-thick)
    return {
      root, all9, fire, legFoot: 2.55 + 9.7 * Math.cos(125 * D2R) - 0.32 * Math.sin(125 * D2R) - 0.07,
      legs: setLegs,
      fins: (k) => fins.forEach((p) => (p.rotation.x = k * 90 * D2R)),
    };
  }
  const MERLIN9 = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.sin((i * TAU) / 8 + Math.PI / 8) * 1.28, Math.cos((i * TAU) / 8 + Math.PI / 8) * 1.28])];

  // Crew Dragon; root origin = the bottom of the heat shield. setNose(k): 0 closed .. 1 open; dracos(rate): thruster puffs
  function crewDragon({ trunk = true } = {}) {
    const root = new THREE.Group();
    const skinT = ctex("dragonSkin", 1024, 512, (g, w, h) => { // white thermal protection with faint panel lines
      g.fillStyle = "#f5f5f3"; g.fillRect(0, 0, w, h); const r = rng(31);
      g.strokeStyle = "rgba(0,0,0,.07)"; g.lineWidth = 2;
      for (let i = 0; i < 24; i++) { g.beginPath(); g.moveTo((i * w) / 24, h * 0.1); g.lineTo((i * w) / 24, h); g.stroke(); }
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${0.015 * r()})`; g.fillRect(r() * w, r() * h, 4 + 30 * r(), 2 + 20 * r()); }
    });
    const white = std("#ffffff", { map: skinT, roughness: 0.38 }), dark = std("#1b1d20", { roughness: 0.45, metalness: 0.2 });
    const pica = std("#2a2622", { roughness: 0.95, map: ctex("pica", 256, 256, (g, w, h) => { g.fillStyle = "#3a352f"; g.fillRect(0, 0, w, h); g.strokeStyle = "#221e1a"; g.lineWidth = 3; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8, h); g.moveTo(0, (i * h) / 8); g.lineTo(w, (i * h) / 8); g.stroke(); } }) });
    // heat shield (PICA-X tiles), the capsule's lower band and its sidewall cone up to the nose cone's seat
    lathe([[0.01, -0.12], [0.9, -0.1], [1.6, -0.04], [1.97, 0.04], [2.0, 0.12]], pica, root, 96);
    const side = (y) => 2.0 - ((y - 0.42) * (2.0 - 1.04)) / (3.28 - 0.42); // sidewall radius at height y
    lathe([[2.0, 0.12], [2.0, 0.42], [side(1.5), 1.5], [1.04, 3.28], [0.98, 3.3]], white, root, 128);
    // SuperDraco pods: a raised fairing with two engine bells at its foot, four pods round the capsule
    const podGeo = once("sdPod", () => taper(0.62, 0.16, 0.46, 0.1, 1.25));
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const s = skin(root, a, side(0.5), 0.5); s.rotation.x = -16 * D2R; // lean with the sidewall
      mesh(podGeo, white, s);
      for (const dx of [-0.15, 0.15]) mesh(once("sdBell", () => new THREE.CylinderGeometry(0.06, 0.1, 0.16, 16, 1, true)), dark, s, dx, -0.04, 0.09);
    }
    // four windows and the hatch with its own window; Draco ports near the top
    const glass = std("#05070a", { metalness: 0.9, roughness: 0.08 });
    for (const a of [0.55, -0.55, Math.PI - 0.6, Math.PI + 0.6]) { const s = skin(root, a, side(2.55) + 0.01, 2.55); s.rotation.x = -16 * D2R; mesh(once("dWin", () => new THREE.CircleGeometry(0.17, 20)), glass, s); }
    { const s = skin(root, 0, side(1.85) + 0.012, 1.85); s.rotation.x = -16 * D2R; mesh(new THREE.RingGeometry(0.44, 0.48, 4, 1, Math.PI / 4).scale(1, 1.5, 1), dark, s); mesh(new THREE.CircleGeometry(0.1, 16), glass, s, 0, 0.25, 0.002); }
    for (const a of [0.3, 1.9, 3.5, 5.1]) { const s = skin(root, a, side(3.05) + 0.01, 3.05); s.rotation.x = -16 * D2R; for (const dx of [-0.07, 0.07]) mesh(once("draco", () => new THREE.CircleGeometry(0.04, 10)), std("#020203"), s, dx, 0, 0); }
    decal(root, side(2.1) + 0.012, 1.7, 2.5, 1.35, 0.42, 160, 84, flagArt, side(1.7) + 0.012);
    decal(root, side(2.95) + 0.012, 2.75, 3.15, -1.2, 0.7, 256, 64, (g, w, h) => spacex(g, w / 2, h / 2, h * 0.7, "#101214", false), side(2.75) + 0.012);
    // docking adapter under the nose cone, and the cone on its forward hinge
    cyl(0.62, 0.66, 3.3, 3.52, std("#a2a6ab", { metalness: 0.85, roughness: 0.3 }), root, 48);
    mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 48).rotateX(Math.PI / 2), std("#c9ccd0", { metalness: 0.8, roughness: 0.3 }), root, 0, 3.53, 0);
    const hinge = new THREE.Group(); hinge.position.set(0, 3.32, 1.0); root.add(hinge);
    const nose = lathe(Array.from({ length: 13 }, (_, i) => { const t = (i / 12) * (Math.PI / 2); return [1.0 * Math.cos(t) + 0.0, 1.08 * Math.sin(t)]; }), white, hinge, 96);
    nose.position.z = -1.0;
    const setNose = (k) => (hinge.rotation.x = k * 1.95);
    const dracos = thrusters(root, [[[1.15, 3.0, 0], [1, 0.25, 0]], [[-1.15, 3.0, 0], [-1, 0.25, 0]], [[0, 3.0, 1.15], [0, 0.25, 1]], [[0, 3.0, -1.15], [0, 0.25, -1]], [[0.75, 3.35, 0.75], [0, 1, 0]], [[-0.75, 3.35, -0.75], [0, 1, 0]]]);
    // the trunk is its own group: it is jettisoned before the deorbit burn
    const tg = new THREE.Group();
    if (trunk) {
      root.add(tg);
      // unpressurised trunk: solar cells on one half, white radiator panels on the other, four fins at its foot
      const tt = ctex("dTrunk", 1024, 512, (g, w, h) => {
        g.fillStyle = "#eef0f1"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "rgba(0,0,0,.09)"; g.lineWidth = 2; for (let x = 0; x < w; x += w / 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
        const r = rng(5), x0 = w * 0.25, x1 = w * 0.75, nx = 30, ny = 12, cw = (x1 - x0) / nx, ch = (h * 0.86) / ny;
        g.fillStyle = "#59606c"; g.fillRect(x0, h * 0.07, x1 - x0, h * 0.86);
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const k = 0.8 + 0.4 * r(); g.fillStyle = `rgb(${18 * k},${30 * k},${62 * k})`; g.fillRect(x0 + i * cw + 1, h * 0.07 + j * ch + 1, cw - 2, ch - 2); }
      });
      cyl(1.83, 1.83, -3.62, -0.02, std("#ffffff", { map: tt, roughness: 0.35, metalness: 0.1 }), tg, 96, true);
      cyl(1.86, 1.86, -3.7, -3.56, std("#b8bcc1", { metalness: 0.8, roughness: 0.35 }), tg, 96);
      const finShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.62, 0), new THREE.Vector2(0.62, 0.55), new THREE.Vector2(0, 1.55)]);
      const fg = once("dFin", () => new THREE.ExtrudeGeometry(finShape, { depth: 0.07, bevelEnabled: false }).translate(0, 0, -0.035).rotateY(-Math.PI / 2));
      for (const a of XANG) mesh(fg, white, skin(tg, a, 1.82, -3.56));
    }
    return { root, setNose, dracos, trunk: tg };
  }

  // the whole stack on the pad: booster feet... root origin = Merlin exit plane, 65.7 m to the top of Dragon's nose
  function f9Stack() {
    const root = new THREE.Group(), b = falcon9Booster(); root.add(b.root);
    const R = F9.R, s2 = new THREE.Group(); root.add(s2);
    const s2T = ctex("f9s2", 1024, 1024, (g, w, h) => { g.fillStyle = "#f2f3f4"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(60,64,70,.08)"; for (const f of [0.18, 0.42, 0.66]) g.fillRect(0, f * h, w, 3); });
    cyl(R, R, F9.is, F9.s2, std("#ffffff", { map: s2T, roughness: 0.4 }), s2, 96, true);
    cyl(R + 0.03, R + 0.03, F9.s2 - 0.22, F9.s2, std("#2b2d31", { roughness: 0.5, metalness: 0.4 }), s2, 96);
    label(s2, R + 0.012, 49.8, 56.6, 0, 1.15, (g, w, h) => spacex(g, w / 2, h / 2, w * 0.84));
    // Merlin Vacuum: the niobium nozzle extension glows red-hot while it fires; hidden in the interstage until staging
    const mv = std("#4a4643", { metalness: 0.7, roughness: 0.5, emissive: new THREE.Color("#ff4a12"), emissiveIntensity: 0, side: THREE.DoubleSide });
    mesh(bellGeo("mvac", 1.6, 0.44, 3.95, 0.7, 64), mv, s2, 0, F9.mvExit, 0);
    cyl(0.44, 0.5, F9.mvExit + 3.95, F9.is + 0.2, std("#3a3836", { metalness: 0.7, roughness: 0.4 }), s2, 32);
    const mvacFire = exhaust(s2, { at: [0, F9.mvExit, 0], re: 1.6, len: 80, kind: "kero" });
    const mvac = (p) => { mvacFire(p, 1); mv.emissiveIntensity = p * 1.8; };
    const d = crewDragon(); d.root.position.y = F9.s2 + 3.62; root.add(d.root);
    return { root, len: 65.7, parts: { booster: b.root, s2, dragon: d.root }, fires: { m1d: b.all9, mvac }, dragon: d, legs: b.legs, booster: b };
  }

  // ---------------------------------------------------------------- Starship (Block 2): Super Heavy and the Ship
  // metres from the booster's outer Raptor exits (the top of the launch mount): engine bay to 6.2, LOX tank to 42,
  // methane tank to 64, forward dome to 68.2, vented hot-staging ring to 71.2. The ship from there: skirt to 79, LOX to
  // 92.5, methane to 105, payload bay to 114, nose to 123.2. 9 m across.
  const SS = { R: 4.5, aft: 6.2, lox: 42, ch: 64, hsr: 68.2, top: 71.2, sLox: 7.8, sLoxTop: 21.3, sCh: 33.8, bay: 42.8, sTop: 52 }; // ship heights from its own base
  // booster engines: 3 in the middle and 10 round them gimbal and relight to come home; 20 fixed on the rim
  const RAPTORS = [[3, 0.9, 0.5], [10, 2.4, 0.1], [20, 3.8, 0]].flatMap(([n, r, ph], k) => Array.from({ length: n }, (_, i) => [Math.sin((i * TAU) / n + ph) * r, Math.cos((i * TAU) / n + ph) * r, k]));
  // stainless steel: rings 1.83 m tall of 4 sheets each, staggered vertical welds, a slightly different tone sheet to
  // sheet. frost [[y0, y1, strength]] lays matte white frost over the cold tanks; soot darkens a returning booster.
  // Returns { map, orm } for the hull between y0 and y1 (orm: roughness in G, metalness in B).
  function steelSkin(key, y0, y1, { frost = [], soot = 0, heat = 0, seed = 3 } = {}) {
    return once("steel:" + key, () => {
      const W = 1024, H = 2048, Y = (y) => (1 - (y - y0) / (y1 - y0)) * H, r = rng(seed);
      const a = document.createElement("canvas"), o = document.createElement("canvas"); a.width = o.width = W; a.height = o.height = H;
      const g = a.getContext("2d"), q = o.getContext("2d");
      const both = (ca, co, f) => { g.fillStyle = ca; f(g); q.fillStyle = co; f(q); };
      both("#c3c7cb", "rgb(0,78,255)", (c) => c.fillRect(0, 0, W, H));
      for (let yy = y0, i = 0; yy < y1; yy += 1.83, i++) {
        const off = r(), ya = Y(Math.min(y1, yy + 1.83)), yb = Y(yy);
        for (let j = 0; j < 4; j++) {
          const x0 = ((j + off) / 4) * W, t = 188 + 14 * r(), rough = 64 + 30 * r();
          both(`rgb(${t},${t + 4},${t + 8})`, `rgb(0,${rough},255)`, (c) => { c.fillRect(x0, ya, W / 4, yb - ya); c.fillRect(x0 - W, ya, W / 4, yb - ya); });
          both("rgba(96,86,74,.55)", "rgb(0,120,200)", (c) => c.fillRect(x0 - 1, ya, 2.5, yb - ya)); // vertical weld
        }
        both("rgba(96,86,74,.6)", "rgb(0,130,190)", (c) => c.fillRect(0, yb - 1.5, W, 3)); // ring weld
      }
      if (heat) { const gr = g.createLinearGradient(0, Y(y0 + heat), 0, Y(y0)); gr.addColorStop(0, "rgba(120,96,70,0)"); gr.addColorStop(0.6, "rgba(126,94,62,.5)"); gr.addColorStop(1, "rgba(70,74,96,.75)"); g.fillStyle = gr; g.fillRect(0, Y(y0 + heat), W, H - Y(y0 + heat)); }
      for (const [fa, fb, k] of frost) { // frost: soft matte white over the cold tank, thinner at the welds, with drips
        const top = Y(fb), bot = Y(fa), fr = rng(Math.round(fa * 7 + fb));
        const fade = (c, rgb, a) => { const gr = c.createLinearGradient(0, top - 40, 0, top + 30); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(1, `rgba(${rgb},${a})`); c.fillStyle = gr; c.fillRect(0, top - 40, W, 70); c.fillStyle = `rgba(${rgb},${a})`; c.fillRect(0, top + 30, W, bot - top - 30); };
        fade(g, "232,236,240", 0.8 * k); fade(q, "0,215,30", 0.85 * k);
        for (let i = 0; i < 900; i++) { // patches thicker and thinner
          const x = fr() * W, yy = top + (bot - top) * fr(), rad = 6 + 40 * fr(), rgb = fr() < 0.5 ? "250,251,252" : "176,182,188", a = (0.3 + 0.1 * fr()) * k;
          const gr = g.createRadialGradient(x, yy, 0, x, yy, rad); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - rad, yy - rad, rad * 2, rad * 2);
        }
        for (let yy = fa; yy < fb; yy += 1.83) { const y = Y(yy); both(`rgba(170,176,183,${0.55 * k})`, "rgba(0,110,220,.5)", (c) => c.fillRect(0, y - 3, W, 6)); }
        for (let i = 0; i < 120; i++) { // drips: condensation running down, steel showing through
          const x = fr() * W, yy = top + (bot - top) * fr(), hh = Math.min(40 + 260 * fr(), bot - yy), w = 2 + 5 * fr(), gr = g.createLinearGradient(0, yy, 0, yy + hh);
          gr.addColorStop(0, "rgba(176,182,189,0)"); gr.addColorStop(0.3, `rgba(176,182,189,${0.6 * k})`); gr.addColorStop(1, "rgba(176,182,189,0)");
          g.fillStyle = gr; g.fillRect(x, yy, w, hh); q.fillStyle = "rgba(0,110,220,.35)"; q.fillRect(x, yy, w, hh);
        }
      }
      if (soot) { // a flown booster: soot streaks from the top and the engine bay
        for (let i = 0; i < 300; i++) {
          const x = r() * W, fromTop = r() < 0.6, len = (fromTop ? 0.12 : 0.06) * H * (0.3 + r()), y = fromTop ? 0 : H - len;
          const gr = g.createLinearGradient(0, y, 0, y + len), al = soot * (0.08 + 0.3 * r() * r());
          gr.addColorStop(fromTop ? 0 : 1, `rgba(32,28,24,${al})`); gr.addColorStop(fromTop ? 1 : 0, "rgba(32,28,24,0)");
          g.fillStyle = gr; g.fillRect(x, y, 3 + 14 * r(), len);
        }
      }
      const map = new THREE.CanvasTexture(a), orm = new THREE.CanvasTexture(o);
      map.colorSpace = THREE.SRGBColorSpace; orm.colorSpace = NS; map.anisotropy = orm.anisotropy = 8;
      return { map, orm };
    });
  }
  const steelMat = (sk, o = {}) => std("#ffffff", { map: sk.map, roughnessMap: sk.orm, metalnessMap: sk.orm, roughness: 1, metalness: 1, ...o });
  // the ship's heat shield: black hexagonal tiles (about 31 cm) with dark gaps; tileable, with a matching normal map
  const tileArt = (g, w, h, height) => {
    const s = 32, dy = 28, r = rng(12);
    g.fillStyle = height ? "#000" : "#0b0b0c"; g.fillRect(0, 0, w, h);
    for (let row = -1; row <= h / dy + 1; row++) for (let col = -1; col <= w / s + 1; col++) {
      const cx = col * s + (row % 2 ? s / 2 : 0), cy = row * dy, t = height ? 200 : 26 + 16 * r() + (r() < 0.012 ? 70 : 0);
      g.fillStyle = height ? "#c8c8c8" : `rgb(${t},${t},${t + 2})`;
      g.beginPath(); for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU + Math.PI / 6; g.lineTo(cx + Math.cos(an) * s * 0.55, cy + Math.sin(an) * s * 0.55); } g.fill();
    }
  };
  const tileMat = (rx, ry) => {
    const map = ctex("tiles", 512, 504, (g, w, h) => tileArt(g, w, h, false), { repeat: [1, 1] }), nm = normal("tilesN", 512, 504, (g, w, h) => tileArt(g, w, h, true), 1.2, [1, 1]);
    const m = std("#ffffff", { map: map.clone(), normalMap: nm.clone(), roughness: 0.72, metalness: 0.05 });
    for (const t of [m.map, m.normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; }
    return m;
  };
  // a grid fin: a rectangular frame W x H with a lattice of square cells, lying in the x-y plane, the hinge edge on y = 0
  function boxGridGeo(key, W, Hh, T, nx, ny) {
    return once("bgrid:" + key, () => {
      const parts = [], add = (g, x, y) => { const q = g.toNonIndexed(); q.translate(x, y, 0); delete q.attributes.uv; parts.push(q); };
      const t = 0.12;
      add(new THREE.BoxGeometry(W, t, T), 0, t / 2); add(new THREE.BoxGeometry(W, t, T), 0, Hh - t / 2);
      for (let i = 0; i <= nx; i++) add(new THREE.BoxGeometry(i % nx === 0 ? t : 0.05, Hh, T), -W / 2 + (i * W) / nx, Hh / 2);
      for (let j = 1; j < ny; j++) add(new THREE.BoxGeometry(W, 0.05, T), 0, (j * Hh) / ny);
      return X.mergeGeometries(parts);
    });
  }
  function raptorField(parent, list, em, y0) { // the bells of an engine cluster, merged per size
    const big = bellGeo("raptor", 0.65, 0.31, 1.75, 0.8, 32), out = batch(em.out, parent), inn = batch(em.in, parent);
    for (const [x, z, k] of list) { const y = y0 + (k < 2 ? 0.3 : 0); out.add(big, x, y, z); inn.add(big, x, y, z); }
    out.done(); inn.done().castShadow = false;
  }
  // Super Heavy; root origin = the outer Raptors' exits. fire33 / fire13 / fire3: the whole cluster, the inner engines,
  // the centre three. frost: fuelled on the pad; flown: soot from a previous flight's entry
  function superHeavy({ frost = true, flown = false } = {}) {
    const root = new THREE.Group(), R = SS.R;
    const sk = steelSkin("sh" + (frost ? "F" : "") + (flown ? "S" : ""), 1.9, SS.hsr, { frost: frost ? [[7.6, 40.4, 1], [44.5, 62.2, 0.85]] : [], soot: flown ? 1 : 0, heat: 4, seed: 7 });
    const steel = steelMat(sk), plain = std("#c4c8cc", { metalness: 1, roughness: 0.34 }), dark = std("#2a2c30", { metalness: 0.5, roughness: 0.55 });
    cyl(R, R, 1.9, SS.hsr, steel, root, 128, true);
    // engine bay: the base heat shield, the 33 bells below it, stiffener panels and the quick-disconnect plate
    mesh(new THREE.CylinderGeometry(R, R - 0.1, 0.45, 128), std("#2b2724", { roughness: 0.9 }), root, 0, 1.7, 0);
    const em = engineMats("#45484d", "#2c2a2a", "#ffb7a8");
    raptorField(root, RAPTORS, em, 0);
    const pan = batch(plain, root);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU + 0.13; pan.add(new THREE.BoxGeometry(0.42, 3.6, 0.14), Math.sin(a) * (R + 0.05), 4.0, Math.cos(a) * (R + 0.05), 0, a, 0); }
    pan.done();
    box(1.6, 2.2, 0.3, dark, skin(root, 2.2, R, 3.6), 0, 0, 0.12);
    // raceways up the side, chopstick catch pins, three big steel grid fins and the vented hot-staging ring
    for (const [a, w] of [[-0.55, 0.62], [Math.PI - 0.55, 0.4]]) box(w, SS.hsr - 7.8, 0.32, plain, skin(root, a, R, (SS.hsr + 7.8) / 2), 0, 0, 0.12);
    for (const s of [-1, 1]) box(1.5, 0.9, 1.4, dark, root, s * (R + 0.55), 65.6, 0); // the chopsticks catch it by these
    const gf = std("#7d8187", { metalness: 0.85, roughness: 0.38 });
    for (const a of [0.6, 0.6 + TAU / 3, 0.6 + (2 * TAU) / 3]) {
      const s = skin(root, a, R, 66.7);
      const fin = mesh(boxGridGeo("sh", 2.9, 3.3, 0.55, 6, 7), gf, s, 0, 0, 0.35); fin.rotation.x = Math.PI / 2; // straight out, cells along the flow
      box(1.2, 0.9, 0.5, dark, s, 0, 0.1, 0.18);
    }
    const ring = cyl(R + 0.03, R + 0.03, SS.hsr, SS.top, std("#ffffff", { map: ctex("hsr", 2048, 128, (g, w, h) => {
      g.fillStyle = "#b9bdc2"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 28; i++) { const x = ((i + 0.5) / 28) * w; g.fillStyle = "#050506"; g.beginPath(); g.roundRect(x - w / 28 * 0.3, h * 0.14, (w / 28) * 0.6, h * 0.72, 10); g.fill(); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(x - w / 28 * 0.3, h * 0.14, (w / 28) * 0.6, 3); }
      g.fillStyle = "rgba(60,50,40,.5)"; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
    }), metalness: 0.9, roughness: 0.35 }), root, 128, true);
    ring.castShadow = true;
    mesh(new THREE.CircleGeometry(R, 64).rotateX(-Math.PI / 2), dark, root, 0, SS.top - 0.6, 0); // the forward dome's shield, seen through the vents
    // exhaust: one volume per set of engines that fire together
    const cl = (k) => RAPTORS.filter((e) => e[2] <= k).map(([x, z]) => [x, z]);
    const f33 = exhaust(root, { re: 0.65, len: 120, kind: "methalox", cluster: cl(2), nozR: 0.65 });
    const f13 = exhaust(root, { at: [0, 0.3, 0], re: 0.65, len: 70, kind: "methalox", cluster: cl(1), nozR: 0.65 });
    const f3 = exhaust(root, { at: [0, 0.3, 0], re: 0.65, len: 40, kind: "methalox", cluster: cl(0), nozR: 0.65 });
    const pw = [0, 0, 0], glow = () => (em.in.emissiveIntensity = Math.max(...pw) * 2.4);
    return {
      root,
      fire33: (p, th = 0) => { pw[0] = p; f33(p, th); glow(); },
      fire13: (p, th = 0) => { pw[1] = p; f13(p, th); glow(); },
      fire3: (p, th = 0) => { pw[2] = p; f3(p, th); glow(); },
    };
  }

  // the Ship; root origin = the base of its skirt, `body` holds everything (scenes move it to pivot on the centre of
  // mass). The heat-shield tiles face local +x (the belly), the payload door is on -x. fireRSL / fireRVac: the three
  // sea-level Raptors in the middle and the three vacuum Raptors round them. flaps(k, c): flap deflection
  function starshipShip({ frost = false } = {}) {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const R = SS.R, sk = steelSkin("ship" + (frost ? "F" : ""), 0, SS.bay, { frost: frost ? [[8.4, 20.4, 0.9], [22.6, 32.4, 0.75]] : [], heat: 2, seed: 19 });
    const steel = steelMat(sk), dark = std("#1d1e21", { metalness: 0.3, roughness: 0.6 });
    const NOSE = (y) => R * Math.pow(Math.max(0, 1 - ((y - SS.bay) / (SS.sTop - SS.bay)) ** 2), 0.62);
    const noseProf = Array.from({ length: 29 }, (_, i) => { const y = SS.bay + ((SS.sTop - SS.bay) * i) / 28; return [NOSE(y), y]; });
    const hull = [cyl(R, R, 0, SS.bay, steel, body, 128, true), lathe(noseProf, std("#ffffff", { map: steelSkin("shipNose", SS.bay, SS.sTop, { seed: 23 }).map, metalness: 0.95, roughness: 0.32 }), body, 128)];
    // heat shield: tiles over the windward half (+x), from the skirt up over the nose
    const tSide = Math.PI / 2, half = Math.PI * 1.06;
    mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, SS.bay - 0.6, 96, 1, true, tSide - half / 2, half), tileMat(3, 9), body, 0, (SS.bay + 0.6) / 2, 0);
    mesh(new THREE.LatheGeometry(noseProf.slice(0, 26).map(([r, y]) => new THREE.Vector2(r + 0.03, y)), 96, tSide - half / 2, half), tileMat(3, 2.2), body);
    // engines: three vacuum Raptors (2.3 m nozzles) and three sea-level ones in the middle, under a dark aft shield
    mesh(new THREE.CylinderGeometry(R - 0.05, R - 0.05, 0.3, 96), std("#2b2724", { roughness: 0.9 }), body, 0, 1.6, 0);
    const em = engineMats("#45484d", "#2c2a2a", "#ffb7a8"), rv = bellGeo("rvac", 1.15, 0.36, 3.4, 0.75, 48), rs = bellGeo("raptor", 0.65, 0.31, 1.75, 0.8, 32);
    const RV = [0, 1, 2].map((i) => [Math.sin(0.4 + (i * TAU) / 3) * 2.8, Math.cos(0.4 + (i * TAU) / 3) * 2.8]), RS = [0, 1, 2].map((i) => [Math.sin(0.4 + Math.PI + (i * TAU) / 3) * 0.95, Math.cos(0.4 + Math.PI + (i * TAU) / 3) * 0.95]);
    for (const [x, z] of RV) bell(body, rv, em, x, -0.2, z, 1.15);
    for (const [x, z] of RS) bell(body, rs, em, x, 1.2, z, 0.65);
    // aft flaps on the edges of the tiled side, smaller forward flaps up on the nose, leaning back with it
    const flaps = []; // [deflection group, side]
    const flapGeo = (span, h, lean) => { const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(span, 1.0), new THREE.Vector2(span - lean * 0.4, h - 1.0), new THREE.Vector2(-lean, h)]); return new THREE.ExtrudeGeometry(s, { depth: 0.46, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 }).translate(0, 0, -0.23).rotateY(-Math.PI / 2); };
    const flapM = tileMat(0.6, 1.2);
    for (const s of [-1, 1]) {
      const a = tSide + s * (Math.PI / 2 + 0.05);
      const pa = new THREE.Group(); skin(body, a, R - 0.1, 0.8).add(pa); mesh(once("aftFlap", () => flapGeo(3.4, 11, 0)), flapM, pa); flaps.push([pa, s]);
      const yb = SS.bay + 0.6, pf = new THREE.Group(), fs = skin(body, tSide + s * (Math.PI / 2 + 0.38), NOSE(yb) - 0.1, yb); fs.rotation.x = -0.18; fs.add(pf);
      mesh(once("fwdFlap", () => flapGeo(1.9, 6.4, 1.6)), flapM, pf); flaps.push([pf, s]);
      box(0.9, 0.6, 1.0, dark, skin(body, tSide + s * (Math.PI / 2 - 0.25), R, 41.6), 0, 0, 0.4); // catch pin
    }
    // payload door (Pez dispenser slot) and the leeward raceway
    const door = box(4.2, 2.4, 0.2, std("#060607", { roughness: 0.9 }), skin(body, -Math.PI / 2, R, 37.6), 0, 0, 0.0);
    box(0.5, 28, 0.28, steel, skin(body, -Math.PI / 2 + 0.55, R, 23), 0, 0, 0.1);
    const fireRSL = exhaust(body, { at: [0, 1.2, 0], re: 0.65, len: 60, kind: "methalox", cluster: RS, nozR: 0.65, glow: em.in });
    const fireRVac = exhaust(body, { at: [0, -0.2, 0], re: 1.15, len: 70, kind: "methalox", cluster: RV, nozR: 1.15 });
    return {
      root, body, hull, door, fireRSL, fireRVac, fires: [fireRSL],
      flaps: (k, c) => flaps.forEach(([pv, s], i) => (pv.rotation.y = s * (k + 0.06 * Math.sin(c * 2 + i)))),
    };
  }
  // the full stack on the launch mount: root origin = booster engine exits; the ship sits on the hot-staging ring
  function starshipStack() {
    const root = new THREE.Group(), sh = superHeavy({ frost: true }), ship = starshipShip({ frost: true });
    root.add(sh.root, ship.root); ship.root.position.y = SS.top; ship.root.rotation.y = 0.54; // tiles to one side of the usual view
    // hot staging: the ship lights up while still sitting on the booster; its exhaust hits the booster's forward dome and
    // blasts out sideways through the vents in the ring. Until the booster has fallen away the ship's plumes stop at it.
    const vents = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * TAU + 0.2; return exhaust(sh.root, { at: [Math.sin(a) * (SS.R + 0.1), SS.hsr + 1.5, Math.cos(a) * (SS.R + 0.1)], re: 0.6, len: 18, kind: "methalox", dir: [Math.sin(a), -0.3, Math.cos(a)] }); });
    const room = (exitY) => (sh.root.visible ? exitY + ship.root.position.y - sh.root.position.y - SS.top : Infinity); // clear air under an exit
    return {
      root, len: SS.top + SS.sTop, parts: { booster: sh.root, ship: ship.root }, ship, sh,
      fires: {
        booster: (p, th) => sh.fire33(p, th), ship: (p, th) => ship.fireRSL(p, th, room(1.2)), rvac: (p, th) => ship.fireRVac(p, th, room(-0.2)),
        hsr: (p, th) => vents.forEach((f) => f(p, th)),
      },
    };
  }

  // ---------------------------------------------------------------- Apollo command and service module
  // root origin = the base of the command module's heat shield. top = the docking probe's tip
  function apolloCM({ probe = false, burnt = false } = {}) {
    const root = new THREE.Group();
    // the ablator is wrapped in aluminised Kapton tape: a shiny, crinkled silver until entry scorches it brown
    const mylar = burnt ? std("#5b4b3d", { roughness: 0.85, metalness: 0.2 }) : std("#dfe2e6", { metalness: 0.95, roughness: 0.22, bumpMap: ctex("kapton", 256, 256, (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); const r = rng(41); for (let i = 0; i < 500; i++) { const c = 100 + 60 * r(); g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(r() * w, r() * h, 2 + 30 * r(), 1 + 3 * r()); } }, { srgb: false, repeat: [3, 2] }), bumpScale: 0.6 });
    lathe([[0.01, -0.28], [0.9, -0.24], [1.6, -0.14], [1.93, -0.04], [1.956, 0.06]], std("#4a3a2c", { roughness: 0.95 }), root, 96);
    const side = (y) => 1.956 - ((y - 0.16) * (1.956 - 0.42)) / (2.95 - 0.16);
    lathe([[1.956, 0.06], [1.94, 0.16], [0.46, 2.92], [0.42, 3.0], [0.42, 3.2], [0.01, 3.23]], mylar, root, 96);
    const glass = std("#05070a", { metalness: 0.9, roughness: 0.08 });
    for (const a of [-0.35, 0.35]) { const s = skin(root, a, side(2.15), 2.15); s.rotation.x = -29 * D2R; mesh(once("cmRvWin", () => new THREE.PlaneGeometry(0.22, 0.3)), glass, s, 0, 0, 0.012); }
    for (const a of [-1.2, 1.2, 0]) { const s = skin(root, a, side(1.35), 1.35); s.rotation.x = -29 * D2R; mesh(once("cmWin", () => new THREE.CircleGeometry(0.15, 20)), glass, s, 0, 0, 0.012); }
    for (const a of [0.8, 2.4, 3.9, 5.5]) { const s = skin(root, a, side(2.5), 2.5); s.rotation.x = -29 * D2R; for (const d of [-0.08, 0.08]) mesh(once("cmRcs", () => new THREE.CircleGeometry(0.035, 10)), std("#020203"), s, d, 0, 0.01); }
    if (probe) { rod([0, 3.2, 0], [0, 3.95, 0], 0.05, std("#c3c7cb", { metalness: 0.85, roughness: 0.3 }), root); mesh(new THREE.ConeGeometry(0.09, 0.2, 12), std("#8c9095", { metalness: 0.8, roughness: 0.3 }), root, 0, 4.05, 0); }
    return { root, top: probe ? 4.15 : 3.23, R: 1.956 };
  }
  // the CSM: service module below the CM (to -4.4) with the SPS bell hanging to -7.4; fire = the SPS. The service
  // module is its own group (`sm`), jettisoned before entry
  function apolloCSM() {
    const top = new THREE.Group(), cm = apolloCM({ probe: true }), root = new THREE.Group(); top.add(cm.root, root);
    const smT = ctex("apolloSM", 1024, 512, (g, w, h) => { // aluminium panels, white radiator stripes, the stencilled name
      g.fillStyle = "#cfd2d5"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgb(${196 + 10 * (i % 2)},${199 + 10 * (i % 2)},${203 + 10 * (i % 2)})`; g.fillRect((i * w) / 6, 0, w / 6, h); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect((i * w) / 6, 0, 2, h); }
      g.fillStyle = "#f4f4f2"; for (const x of [0.06, 0.4, 0.56, 0.9]) g.fillRect(x * w, h * 0.12, w * 0.05, h * 0.62);
      g.fillStyle = "#16171a"; g.font = "bold 40px Helvetica,Arial,sans-serif"; g.textAlign = "center"; g.fillText("UNITED STATES", w * 0.25, h * 0.2);
      g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(0, h * 0.04, w, 3); g.fillRect(0, h * 0.95, w, 3);
    });
    cyl(1.956, 1.956, -4.4, -0.02, std("#ffffff", { map: smT, metalness: 0.75, roughness: 0.32 }), root, 96, true);
    lathe([[1.956, -4.4], [1.75, -4.55], [0.62, -4.6]], std("#bfc2c6", { metalness: 0.75, roughness: 0.35 }), root, 64); // aft bulkhead
    // SPS engine: a dark bell, 2.5 m across
    const em = engineMats("#4c4e52", "#2a2826", "#ffcc99");
    bell(root, bellGeo("sps", 1.25, 0.5, 2.9, 0.7, 48), em, 0, -7.4, 0, 1.25);
    // RCS quads, the S-band high-gain antenna on its boom (folded at the aft end)
    const quad = std("#e3e4e2", { roughness: 0.5 });
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) { const s = skin(root, a, 1.956, -0.9); box(0.3, 0.75, 0.32, quad, s, 0, 0, 0.12); for (const [x, y] of [[0, 0.42], [0, -0.42], [0.2, 0], [-0.2, 0]]) mesh(once("rcsN", () => new THREE.CylinderGeometry(0.035, 0.06, 0.12, 8)), std("#3a3b3e", { metalness: 0.7 }), s, x, y, 0.2); }
    rod([1.3, -4.3, 1.3], [2.25, -5.2, 2.25], 0.05, std("#cfcfcf"), root);
    for (const [x, z] of [[2.25, 2.0], [2.55, 2.3], [2.0, 2.55], [2.3, 2.6]]) mesh(once("hga", () => new THREE.SphereGeometry(0.3, 16, 8, 0, TAU, 0, 1.1)), std("#ececea", { side: THREE.DoubleSide }), root, x, -5.3, z);
    const rcs = thrusters(root, [0, 1, 2, 3].map((i) => { const a = Math.PI / 4 + (i * Math.PI) / 2; return [[Math.sin(a) * 2.25, -0.9, Math.cos(a) * 2.25], [Math.sin(a + 1.5), 0, Math.cos(a + 1.5)]]; }), 1.3);
    const fire = exhaust(root, { at: [0, -7.4, 0], re: 1.25, len: 22, kind: "hyper", glow: em.in });
    return { root: top, cm: cm.root, sm: root, top: cm.top, rcs, fire };
  }

  // ---------------------------------------------------------------- Saturn V (Apollo 11, AS-506)
  // metres from the F-1 exits: base heat shield to 5.8, S-IC to 41 (thrust section, RP-1 tank, corrugated intertank,
  // LOX tank, forward skirt), S-II interstage ring to 46.5, S-II to 66, the S-IVB's aft interstage cone to 71.5, S-IVB
  // to 85.2, instrument unit to 86.1, the lunar module adapter to 94.6, service module to 99, command module under its
  // boost cover to 102.5, escape tower to 106.8, escape motor to 110, nose 111.2. 10.1 m across.
  const SV = { R1: 5.05, R3: 3.3, base: 5.8, fuel: 20.5, it: 23.8, lox: 38, sic: 41, is: 46.5, s2: 66, ais: 71.5, s4: 85.2, iu: 86.1, sla: 94.6, cm: 99, bpc: 102.5, tower: 106.8, motor: 110, tip: 111.2 };
  const SVF = 0.47; // the side the launch cameras look at (the anatomy figure's front)
  // paint between angles a0..a1 (round the body) and heights y0..y1 on a texture covering Y0..Y1
  const span = (g, w, h, Y0, Y1, a0, a1, y0, y1) => { const Y = (y) => (1 - (y - Y0) / (Y1 - Y0)) * h; for (const k of [-1, 0, 1]) g.fillRect((a0 / TAU + k) * w, Y(y1), ((a1 - a0) / TAU) * w, Y(y0) - Y(y1)); };
  function saturnV() {
    const root = new THREE.Group(), R1 = SV.R1, R3 = SV.R3, Q = [0, 1, 2, 3].map((i) => SVF + Math.PI / 4 + (i * Math.PI) / 2);
    const paint = "#f1f0eb", black = std("#151618", { roughness: 0.55 }), white = std(paint, { roughness: 0.5 });
    const s1 = new THREE.Group(), inter = new THREE.Group(), s2 = new THREE.Group(), s4b = new THREE.Group(), les = new THREE.Group();
    root.add(s1, inter, s2, s4b, les);
    // S-IC: the roll pattern, panel seams; the intertank is its own corrugated band
    const sic = ctex("svSIC", 1024, 2048, (g, w, h) => {
      const Y = (y) => (1 - (y - SV.base) / (SV.sic - SV.base)) * h;
      g.fillStyle = paint; g.fillRect(0, 0, w, h);
      g.fillStyle = "#151618"; for (const a of [SVF, SVF + Math.PI]) span(g, w, h, SV.base, SV.sic, a, a + Math.PI / 2, SV.base, 17.5);
      g.fillStyle = "rgba(0,0,0,.14)"; for (const y of [9.2, 12, 15, 17.8, 27, 30, 33, 35.6]) g.fillRect(0, Y(y) - 1, w, 2);
      g.fillStyle = "rgba(0,0,0,.3)"; for (const y of [SV.fuel, SV.lox]) g.fillRect(0, Y(y) - 2, w, 4);
      g.fillStyle = "#1a1b1d"; for (let i = 0; i < 24; i++) { const a = SVF - 1.2 + i * 0.27; span(g, w, h, SV.base, SV.sic, a, a + 0.05, 39.4, 40.2); } // forward skirt vents
    });
    cyl(R1, R1, SV.base, SV.sic, std("#ffffff", { map: sic, roughness: 0.5 }), s1, 128, true);
    const itT = ctex("svIT", 1024, 128, (g, w, h) => { g.fillStyle = paint; g.fillRect(0, 0, w, h); g.fillStyle = "#151618"; for (let i = 0; i < 8; i += 2) span(g, w, h, 0, 1, SVF + (i * Math.PI) / 4 + 0.2, SVF + ((i + 1) * Math.PI) / 4 + 0.2, 0, 1); });
    cyl(R1 + 0.04, R1 + 0.04, SV.fuel, SV.it, std("#ffffff", { map: itT, roughness: 0.55, normalMap: normal("svITN", 1024, 32, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 128 + 120 * Math.sin((x / w) * TAU * 120); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); } }, 3) }), s1, 128, true);
    label(s1, R1 + 0.02, 34.6, 35.8, SVF - 0.18, 2.2, flagArt, 80);
    label(s1, R1 + 0.02, 28.0, 32.95, SVF - 0.18, 1.6, vtext("USA", "#151618"), 60);
    // base: thrust structure and heat shield, the five F-1s (dark film-cooled nozzle extensions), engine fairings, fins
    lathe([[R1 - 0.7, 5.36], [R1 - 0.12, 5.6], [R1, SV.base]], std("#2c2b29", { roughness: 0.85 }), s1, 96);
    mesh(new THREE.CircleGeometry(R1 - 0.6, 64).rotateX(Math.PI / 2), std("#3a3836", { roughness: 0.9 }), s1, 0, 5.36, 0);
    const f1T = ctex("f1", 512, 256, (g, w, h) => { g.fillStyle = "#4a4541"; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(0,0,0,${0.25 + 0.2 * Math.sin(x)})`; g.fillRect(x, 0, 1.4, h * 0.56); } g.fillStyle = "#121212"; g.fillRect(0, h * 0.56, w, h * 0.44); }, { srgb: true });
    const f1m = { out: std("#ffffff", { map: f1T, metalness: 0.55, roughness: 0.55 }), in: std("#2a2420", { metalness: 0.4, roughness: 0.7, side: THREE.BackSide, emissive: new THREE.Color("#ffb070"), emissiveIntensity: 0 }) };
    const F1 = [[0, 0], ...Q.map((a) => [Math.sin(a) * 3.2, Math.cos(a) * 3.2])];
    for (const [x, z] of F1) { bell(s1, bellGeo("f1", 1.85, 0.85, 4.9, 0.75, 48), f1m, x, 0, z, 1.85); mesh(once("f1ring", () => new THREE.TorusGeometry(1.32, 0.12, 8, 40).rotateX(Math.PI / 2)), std("#3a3734", { metalness: 0.6, roughness: 0.5 }), s1, x, 2.2, z); }
    const fairGeo = once("svFair", () => latheGeo([[1.15, 3.6], [1.24, 3.8], [1.56, 5.2], [1.76, 6.6], [1.82, 7.4]], 40));
    const finShape = new THREE.Shape([new THREE.Vector2(0, 3.0), new THREE.Vector2(4.2, 3.0), new THREE.Vector2(4.2, 5.0), new THREE.Vector2(0, 9.6)]);
    const finGeo = once("svFin", () => new THREE.ExtrudeGeometry(finShape, { depth: 0.16, bevelEnabled: false }).translate(0, 0, -0.08).rotateY(-Math.PI / 2));
    const whiteDS = std(paint, { roughness: 0.5, side: THREE.DoubleSide });
    for (const a of Q) {
      mesh(fairGeo, whiteDS, s1, Math.sin(a) * 3.2, 0, Math.cos(a) * 3.2);
      const f = skin(s1, a, 4.3, 0); mesh(finGeo, white, f); box(0.26, 2.0, 0.36, white, f, 0, 3.9, 4.0); // fin and its tip pod
    }
    // S-II interstage ring with its eight ullage motors (dropped 30 s after staging)
    cyl(R1 + 0.02, R1 + 0.02, SV.sic, SV.is, std("#ffffff", { map: ctex("svIS", 1024, 256, (g, w, h) => { g.fillStyle = paint; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(0, 3, w, 3); g.fillRect(0, h - 6, w, 3); g.fillRect(0, h * 0.45, w, 2); }), roughness: 0.5 }), inter, 128, true);
    for (let i = 0; i < 8; i++) { const s = skin(inter, (i / 8) * TAU + 0.2, R1, 44.6); mesh(once("ullage", () => new THREE.CylinderGeometry(0.2, 0.26, 1.8, 16)), white, s, 0, 0.3, 0.22); mesh(once("ullageN", () => new THREE.ConeGeometry(0.18, 0.4, 16, 1, true)), black, s, 0, -0.75, 0.22).rotation.x = Math.PI; }
    // S-II: five J-2s inside the interstage, "UNITED STATES" down the side
    const j2m = engineMats("#45423f", "#2a2826", "#cfd8ff"), J2 = [[0, 0], ...Q.map((a) => [Math.sin(a) * 2.7, Math.cos(a) * 2.7])];
    for (const [x, z] of J2) bell(s2, bellGeo("j2", 1.0, 0.4, 3.0, 0.8, 36), j2m, x, 41.8, z, 1.0);
    cyl(R1, R1, SV.is, SV.s2, std("#ffffff", { map: ctex("svS2", 1024, 1024, (g, w, h) => { g.fillStyle = paint; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,.12)"; for (const f of [0.23, 0.42, 0.62, 0.81]) g.fillRect(0, f * h, w, 2); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, 2, w, 3); g.fillRect(0, h - 5, w, 3); }), roughness: 0.5 }), s2, 128, true);
    mesh(new THREE.CircleGeometry(R1, 64).rotateX(Math.PI / 2), black, s2, 0, SV.is + 0.05, 0);
    label(s2, R1 + 0.02, 48.9, 64.6, SVF + 0.28, 1.2, vtext("UNITED STATES", "#151618"), 48);
    // S-IVB with its aft interstage cone (stays with the S-II), the roll pattern on its aft skirt, the APS pods
    lathe([[R1 + 0.02, SV.s2], [R1 - 0.05, SV.s2 + 0.3], [R3 + 0.04, SV.ais]], std(paint, { roughness: 0.5, side: THREE.DoubleSide }), s2, 128);
    for (const a of Q) { const s = skin(s2, a, (R1 + R3) / 2, 68.8); s.rotation.x = -17 * D2R; box(0.42, 2.0, 0.3, white, s, 0, 0, 0.15); }
    bell(s4b, bellGeo("j2", 1.0, 0.4, 3.0, 0.8, 36), j2m, 0, 67.8, 0, 1.0);
    cyl(R3, R3, SV.ais, SV.s4, std("#ffffff", { map: ctex("svS4", 1024, 1024, (g, w, h) => { g.fillStyle = paint; g.fillRect(0, 0, w, h); g.fillStyle = "#151618"; for (const a of [SVF - Math.PI / 4, SVF + (3 * Math.PI) / 4]) span(g, w, h, SV.ais, SV.s4, a, a + Math.PI / 2, SV.ais, 75.5); g.fillStyle = "rgba(0,0,0,.14)"; for (const f of [0.3, 0.55, 0.75]) g.fillRect(0, f * h, w, 2); }), roughness: 0.5 }), s4b, 128, true);
    mesh(new THREE.CircleGeometry(R3, 64).rotateX(Math.PI / 2), black, s4b, 0, SV.ais + 0.05, 0);
    for (const a of [SVF + Math.PI / 2, SVF - Math.PI / 2]) { const s = skin(s4b, a, R3, 72.6); mesh(once("aps", () => new THREE.CapsuleGeometry(0.5, 1.6, 6, 16)), white, s, 0, 0, 0.32); box(0.5, 1.2, 0.3, black, s, 0, -0.2, 0.62); }
    cyl(R3 + 0.02, R3 + 0.02, SV.s4, SV.iu, std("#ffffff", { map: ctex("svIU", 1024, 64, (g, w, h) => { g.fillStyle = "#c7c9cb"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,.3)"; for (let x = 0; x < w; x += w / 16) g.fillRect(x, 0, 2, h); g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); }), metalness: 0.5, roughness: 0.4 }), s4b, 128, true);
    // spacecraft-LM adapter: a fixed ring and four panels hinged at their foot that open like petals; Eagle inside
    const rS = (y) => R3 - ((R3 - 1.96) * (y - SV.iu)) / (SV.sla - SV.iu), hy = 88.3, slaM = std("#e9e9e4", { roughness: 0.55, side: THREE.DoubleSide });
    cyl(rS(hy), R3 + 0.02, SV.iu, hy, slaM, s4b, 128, true);
    const lm = K.lunarModule({ folded: true }); lm.root.position.y = SV.iu - 0.2; s4b.add(lm.root);
    const petals = [0, 1, 2, 3].map((i) => {
      const hg = new THREE.Group(), pv = new THREE.Group(); hg.rotation.y = SVF + (i * Math.PI) / 2; hg.position.y = hy; s4b.add(hg); pv.position.z = rS(hy); hg.add(pv);
      mesh(new THREE.CylinderGeometry(1.96, rS(hy), SV.sla - hy, 24, 1, true, -Math.PI / 4, Math.PI / 2), slaM, pv, 0, (SV.sla - hy) / 2, -rS(hy));
      return { hg, pv, r0: rS(hy) };
    });
    // CSM under the boost protective cover, and the launch escape tower: red truss, escape motor, canards, Q-ball
    const csm = apolloCSM(); csm.root.position.y = SV.cm; root.add(csm.root);
    lathe([[2.03, 98.95], [2.02, 99.2], [0.48, 102.2], [0.36, SV.bpc]], std("#f2f2ee", { roughness: 0.45 }), les, 96);
    const red = std("#b34a2c", { roughness: 0.5, metalness: 0.25 }), tb = batch(red, les);
    const leg = (a, y) => { const w = 0.56 - ((y - SV.bpc) / (SV.tower - SV.bpc)) * 0.24; return V3(Math.sin(a) * w, y, Math.cos(a) * w); };
    const strut = (A, B, r) => { const L = A.distanceTo(B), g = new THREE.CylinderGeometry(r, r, L, 8), q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), B.clone().sub(A).normalize()); g.applyQuaternion(q).translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); tb.add(g); };
    const QA = [0, 1, 2, 3].map((i) => SVF + Math.PI / 4 + (i * Math.PI) / 2);
    for (const a of QA) strut(leg(a, SV.bpc), leg(a, SV.tower), 0.07);
    for (let y = SV.bpc; y < SV.tower - 0.5; y += 1.07) for (let i = 0; i < 4; i++) { strut(leg(QA[i], y), leg(QA[(i + 1) % 4], y + 1.07), 0.035); strut(leg(QA[i], y + 1.07), leg(QA[(i + 1) % 4], y + 1.07), 0.04); }
    tb.done();
    const motorWhite = std("#f1f1ee", { roughness: 0.45 });
    lathe([[0.54, SV.tower], [0.54, 107.1], [0.46, 109.4], [0.36, SV.motor]], motorWhite, les, 48);
    for (const a of QA) { const n = mesh(once("lesNoz", () => new THREE.CylinderGeometry(0.1, 0.2, 0.55, 16, 1, true)), black, les, Math.sin(a) * 0.5, 107.0, Math.cos(a) * 0.5); n.quaternion.setFromUnitVectors(V3(0, -1, 0), V3(Math.sin(a) * 0.55, -0.83, Math.cos(a) * 0.55)); }
    lathe([[0.36, SV.motor], [0.3, 110.3], [0.26, 110.4]], black, les, 32);
    for (const a of [SVF, SVF + Math.PI]) box(0.06, 0.4, 0.3, motorWhite, skin(les, a, 0.27, 110.6), 0, 0, 0.12); // canards, folded
    lathe(Array.from({ length: 9 }, (_, i) => { const f = i / 8; return [0.26 * Math.cos(f * (Math.PI / 2)), 110.4 + 0.8 * Math.sin(f * (Math.PI / 2))]; }), motorWhite, les, 32);
    // engines
    const em1 = f1m, f1fire = exhaust(s1, { re: 1.85, len: 120, kind: "f1", cluster: F1, nozR: 1.85, glow: em1.in });
    const j2fire = exhaust(s2, { at: [0, 41.8, 0], re: 1.0, len: 75, kind: "hydrolox", cluster: J2, nozR: 1.0, glow: j2m.in });
    const s4fire = exhaust(s4b, { at: [0, 67.8, 0], re: 1.0, len: 48, kind: "hydrolox", glow: j2m.in });
    const lesF = QA.map((a) => exhaust(les, { at: [Math.sin(a) * 0.62, 106.8, Math.cos(a) * 0.62], re: 0.2, len: 14, kind: "solid", dir: [Math.sin(a) * 0.55, -0.83, Math.cos(a) * 0.55] }));
    return {
      root, len: SV.tip, parts: { s1, inter, s2, s4b, les, csm: csm.root }, petals, csm, lm,
      fires: { f1: f1fire, j2: j2fire, s4: s4fire, les: (p, th) => lesF.forEach((f) => f(p, th)), sps: csm.fire },
    };
  }

  // ---------------------------------------------------------------- Orion (Artemis II) and the ICPS
  // root origin = the base of the crew module's heat shield; the service module hangs below it, the ICPS below that.
  function orionCM({ burnt = false } = {}) {
    const root = new THREE.Group(), R = 2.51, side = (y) => R - ((y - 0.2) * (R - 0.78)) / (3.05 - 0.2);
    // Artemis II's backshell tiles carry a reflective silver coating; a copper-coloured band and a blue one near the base
    const shellT = ctex("orionShell", 1024, 512, (g, w, h) => {
      g.fillStyle = "#c9ccd0"; g.fillRect(0, 0, w, h); const r = rng(51);
      for (let i = 0; i < 48; i++) for (let j = 0; j < 14; j++) { const c = 186 + 26 * r(); g.fillStyle = `rgb(${c},${c + 2},${c + 5})`; g.fillRect((i * w) / 48 + 1, (j * h) / 14 + 1, w / 48 - 2, h / 14 - 2); }
      g.fillStyle = "#9a5a2c"; g.fillRect(0, h * 0.94, w, h * 0.05); g.fillStyle = "#2d5aa8"; g.fillRect(0, h * 0.58, w, h * 0.022);
    });
    const shell = burnt ? std("#62503f", { roughness: 0.85, metalness: 0.15 }) : std("#ffffff", { map: shellT, metalness: 0.85, roughness: 0.28 });
    lathe([[0.01, -0.32], [1.2, -0.28], [2.2, -0.14], [2.48, -0.03], [2.51, 0.06]], std("#4e3d2e", { roughness: 0.95 }), root, 96);
    lathe([[2.51, 0.06], [2.47, 0.2], [0.78, 3.05], [0.74, 3.3], [0.01, 3.33]], shell, root, 128);
    const glass = std("#05070a", { metalness: 0.9, roughness: 0.08 });
    for (const a of [-0.55, 0.55, Math.PI - 0.55, Math.PI + 0.55]) { const s = skin(root, a, side(1.75) + 0.01, 1.75); s.rotation.x = -31 * D2R; mesh(once("orWin", () => new THREE.PlaneGeometry(0.34, 0.4)), glass, s); }
    { const s = skin(root, 0, side(1.3) + 0.012, 1.3); s.rotation.x = -31 * D2R; mesh(new THREE.RingGeometry(0.55, 0.6, 4, 1, Math.PI / 4).scale(0.9, 1.25, 1), std("#55595f"), s); }
    for (const a of [-1.05, 1.05, 0.25, 2.6, 4.2]) { const s = skin(root, a, side(2.65) + 0.01, 2.65); s.rotation.x = -31 * D2R; for (const dy of [0, 0.25]) mesh(once("orRcs", () => new THREE.CircleGeometry(0.05, 10)), std("#020203"), s, 0, dy, 0); }
    return { root, top: 3.33, R };
  }
  // the service module (white blankets, four folded solar wings, the OMS-E), the ICPS when `icps`
  function orionStack({ icps = false } = {}) {
    // `orion` = crew module + service module; the service module (`esm`) is its own group, left behind before entry
    const root = new THREE.Group(), orion = new THREE.Group(), esm = new THREE.Group(); root.add(orion);
    const cm = orionCM(); orion.add(cm.root, esm);
    const blanket = std("#ffffff", { map: ctex("esm", 1024, 512, (g, w, h) => { g.fillStyle = "#eeeeea"; g.fillRect(0, 0, w, h); const r = rng(61); for (let i = 0; i < 16; i++) for (let j = 0; j < 6; j++) { g.fillStyle = `rgba(0,0,0,${0.03 + 0.06 * r()})`; g.fillRect((i * w) / 16, (j * h) / 6, w / 16, h / 6); } g.strokeStyle = "rgba(0,0,0,.14)"; g.lineWidth = 2; for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo((i * w) / 16, 0); g.lineTo((i * w) / 16, h); g.stroke(); } g.fillStyle = "#d8d9d6"; g.fillRect(0, h * 0.3, w, h * 0.12); }), roughness: 0.55 });
    const dark = std("#34363a", { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide });
    lathe([[2.51, -0.02], [2.4, -0.4], [2.05, -0.78]], std("#d9dbdd", { metalness: 0.6, roughness: 0.35 }), esm, 96); // crew module adapter
    cyl(2.05, 2.05, -4.4, -0.78, blanket, esm, 96, true);
    lathe([[2.05, -4.4], [1.6, -4.55], [0.5, -4.6]], std("#b9bcc0", { metalness: 0.7, roughness: 0.4 }), esm, 64);
    const em = engineMats("#3e4044", "#2a2826", "#ffc89a");
    bell(esm, bellGeo("omse", 0.62, 0.22, 1.9, 0.7, 36), em, 0, -6.5, 0, 0.62);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; mesh(once("aux", () => new THREE.CylinderGeometry(0.05, 0.11, 0.24, 10, 1, true)), dark, esm, Math.sin(a) * 1.7, -4.72, Math.cos(a) * 1.7); }
    for (let i = 0; i < 4; i++) { const s = skin(esm, (i * Math.PI) / 2, 2.05, -1.35); box(0.4, 0.5, 0.3, std("#dcdcd8"), s, 0, 0, 0.12); }
    // four solar array wings (three panels each): folded down the module for launch, an X 19 m across once deployed
    const cellsT = ctex("orCells", 512, 512, (g, w, h) => { g.fillStyle = "#565d6a"; g.fillRect(0, 0, w, h); const r = rng(5); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const k = 0.8 + 0.4 * r(); g.fillStyle = `rgb(${16 * k},${28 * k},${60 * k})`; g.fillRect((i * w) / 8 + 3, (j * h) / 8 + 3, w / 8 - 6, h / 8 - 6); } });
    const wc = std("#ffffff", { map: cellsT, metalness: 0.4, roughness: 0.3 }), wings = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, h = new THREE.Group(); h.rotation.y = a - Math.PI / 2; h.position.y = -1.9; esm.add(h); wings.push(h);
      rod([2.0, 0, 0], [2.85, 0, 0], 0.06, dark, h);
      for (let p = 0; p < 3; p++) { const q = box(2.25, 0.05, 1.95, wc, h, 3.0 + p * 2.32 + 1.1, 0, 0); q.rotation.x = 0.35; }
    }
    const rcs = thrusters(esm, [0, 1, 2, 3].map((i) => { const a = (i * Math.PI) / 2; return [[Math.sin(a) * 2.1, -1.35, Math.cos(a) * 2.1], [0, -1, 0]]; }), 1.2);
    let stage = null, rl10 = () => {};
    if (icps) {
      // the Interim Cryogenic Propulsion Stage: the adapter cone, its white hydrogen tank, the insulated LOX tank slung
      // below on a truss, and the RL10B-2 with its long carbon nozzle extension
      stage = new THREE.Group(); root.add(stage);
      const sw = std("#f0efe9", { roughness: 0.5 });
      lathe([[2.05, -4.95], [2.4, -5.6], [2.58, -6.2]], std("#e7e7e1", { roughness: 0.5, side: THREE.DoubleSide }), stage, 96);
      cyl(2.58, 2.58, -7.4, -6.2, std("#e6e8ea", { roughness: 0.45, metalness: 0.3 }), stage, 96); // Orion stage adapter
      cyl(2.55, 2.55, -14.6, -7.4, std("#ffffff", { map: ctex("icps", 1024, 512, (g, w, h) => { g.fillStyle = "#f2f1ec"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(0, h * 0.3, w, 3); g.fillRect(0, h * 0.7, w, 3); g.fillStyle = "#101010"; for (let i = 0; i < 4; i++) g.fillRect((i / 4) * w + w * 0.03, h * 0.05, w * 0.03, h * 0.08); }), roughness: 0.5 }), stage, 96, true);
      mesh(once("icpsLox", () => new THREE.SphereGeometry(1.65, 48, 24)), std("#b68a46", { metalness: 0.75, roughness: 0.4 }), stage, 0, -15.3, 0).scale.y = 0.72;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; rod([Math.sin(a) * 2.45, -14.6, Math.cos(a) * 2.45], [Math.sin(a + 0.35) * 1.5, -16.2, Math.cos(a + 0.35) * 1.5], 0.06, dark, stage); }
      const rm = engineMats("#262626", "#1e1c1a", "#d4dcff");
      bell(stage, bellGeo("rl10x", 1.07, 0.3, 4.2, 0.72, 48), rm, 0, -21.0, 0, 1.07);
      cyl(0.32, 0.45, -16.8, -16.3, std("#5b5b5e", { metalness: 0.7, roughness: 0.4 }), stage, 24);
      rl10 = exhaust(stage, { at: [0, -21.0, 0], re: 1.07, len: 34, kind: "hydrolox", glow: rm.in });
    }
    const fire = exhaust(esm, { at: [0, -6.5, 0], re: 0.62, len: 16, kind: "hyper", glow: em.in });
    // arrays: 0 = folded inside the fairing, 1 = deployed into the X
    const arrays = (k) => wings.forEach((h) => { h.scale.set(Math.max(0.02, k), 1, 1); h.visible = k > 0.01; });
    return { root, orion, cm: cm.root, esm, stage, rcs, top: 3.33, fire, rl10, arrays };
  }

  // ---------------------------------------------------------------- SLS Block 1 (Artemis II) on Mobile Launcher 1
  // metres above the launcher deck: the boosters stand on their aft skirts at 1.4 (nozzle exits at 0), 54 m to their
  // noses; the core stage from its boat-tail at 5.0 (RS-25 exits at 0.9) up through the engine section, hydrogen tank,
  // intertank and oxygen tank to its forward skirt at 69.6; the adapter cone to 77.6; ICPS and Orion stage adapter;
  // fairing panels to 85.8; Orion under the launch abort system's ogive; the abort tower to 101.
  const SL = { RC: 4.2, RB: 1.85, XB: 6.6, base: 5.0, boat: 6.0, eng: 10.5, lh2: 44.5, it: 51.2, lox: 64.6, top: 69.6, lvsa: 77.6, cm: 86.0 };
  const SLF = 0.48; // the side the launch cameras look at
  function slsStack() {
    const root = new THREE.Group(), RC = SL.RC, RB = SL.RB, XB = SL.XB;
    const foamT = ctex("slsFoam", 1024, 2048, (g, w, h) => { // sprayed-on foam: orange, darkening in the sun, blotchy, with photogrammetry marks
      const Y = (y) => (1 - (y - SL.eng) / (SL.top - SL.eng)) * h, r = rng(23);
      g.fillStyle = "#c7672a"; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const c = r(); g.fillStyle = c < 0.5 ? `rgba(110,46,12,${0.07 * r()})` : `rgba(240,150,80,${0.07 * r()})`; g.beginPath(); g.arc(r() * w, r() * h, 2 + 14 * r(), 0, TAU); g.fill(); }
      g.fillStyle = "rgba(90,35,8,.25)"; for (const y of [17.3, 24.1, 30.9, 37.7, 57.9]) g.fillRect(0, Y(y), w, 2);
      const ck = (a, y, s) => { const x = (a / TAU) * w, yy = Y(y), px = (s / (TAU * RC)) * w, py = (s / (SL.top - SL.eng)) * h; g.fillStyle = "#fff"; g.fillRect(x - px, yy - py, px * 2, py * 2); g.fillStyle = "#111"; g.fillRect(x - px, yy - py, px, py); g.fillRect(x, yy, px, py); };
      for (const [a, y] of [[SLF - 0.2, 40], [SLF + 0.75, 30], [SLF - 0.55, 21], [SLF + 0.1, 60], [SLF - 0.65, 54], [SLF - 0.2, 68.2]]) ck(a, y, 0.28);
      g.fillStyle = "#f4f2ea"; for (const [a, y] of [[SLF - 0.35, 42.5], [SLF + 0.3, 33.5], [SLF - 0.25, 62], [SLF + 0.45, 56]]) { g.beginPath(); g.ellipse((a / TAU) * w, Y(y), (0.16 / (TAU * RC)) * w, (0.16 / (SL.top - SL.eng)) * h, 0, 0, TAU); g.fill(); }
    });
    const foam = std("#ffffff", { map: foamT, roughness: 0.88 }), foamDS = std("#ffffff", { map: foamT, roughness: 0.88, side: THREE.DoubleSide });
    const tan = std("#b9884d", { roughness: 0.85 }), pale = std("#d7d0c1", { roughness: 0.8 }), white = std("#f3f3ef", { roughness: 0.5 }), steel = std("#b5b9be", { metalness: 0.75, roughness: 0.35 }), dark = std("#28292c", { roughness: 0.55, metalness: 0.3 });
    const core = new THREE.Group(); root.add(core);
    // engine section and boat-tail (light thermal protection), the four RS-25s
    lathe([[3.65, SL.base], [RC, SL.boat], [RC, SL.eng]], std("#ffffff", { map: ctex("slsEng", 1024, 256, (g, w, h) => { g.fillStyle = "#d9d2c3"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,.12)"; for (let x = 0; x < w; x += w / 64) g.fillRect(x, h * 0.2, 1.5, h * 0.8); for (const a of [SLF - 0.4, SLF + 0.9]) g.strokeRect((a / TAU) * w - 12, h * 0.35, 24, h * 0.3); }), roughness: 0.8 }), core, 128);
    mesh(new THREE.CircleGeometry(3.66, 64).rotateX(Math.PI / 2), std("#3b3833", { roughness: 0.9 }), core, 0, SL.base + 0.02, 0);
    const rsT = ctex("rs25", 512, 256, (g, w, h) => { g.fillStyle = "#6a6158"; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 2.4) { g.fillStyle = `rgba(30,20,12,${0.3 + 0.2 * Math.sin(x * 1.3)})`; g.fillRect(x, 0, 1.1, h); } g.fillStyle = "rgba(255,240,220,.18)"; for (const f of [0.18, 0.4, 0.6, 0.8]) g.fillRect(0, f * h, w, 3); });
    const rsm = { out: std("#ffffff", { map: rsT, metalness: 0.65, roughness: 0.45 }), in: std("#2b2622", { metalness: 0.4, roughness: 0.65, side: THREE.BackSide, emissive: new THREE.Color("#cfd8ff"), emissiveIntensity: 0 }) };
    const RS = [[-1.65, -1.65], [1.65, -1.65], [-1.65, 1.65], [1.65, 1.65]];
    for (const [x, z] of RS) { bell(core, bellGeo("rs25", 1.17, 0.56, 4.15, 0.6, 48), rsm, x, 0.9, z, 1.17); mesh(once("rsBoot", () => new THREE.CylinderGeometry(0.62, 0.78, 0.35, 32)), std("#e2ddd2", { roughness: 0.9 }), core, x, 4.85, z); }
    // hydrogen tank, intertank (stringers between tan bands), oxygen tank and forward skirt in one foam skin
    cyl(RC, RC, SL.eng, SL.top, foam, core, 128, true);
    cyl(RC + 0.035, RC + 0.035, SL.lh2, SL.it, std("#ffffff", { map: foamT, roughness: 0.85, normalMap: normal("slsITN", 1024, 32, (g, w, h) => { for (let x = 0; x < w; x++) { const v = 128 + 110 * Math.max(0, Math.sin((x / w) * TAU * 96)) ** 6; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); } }, 4) }), core, 128, true);
    for (const [y0, y1] of [[SL.lh2 - 0.05, SL.lh2 + 0.4], [SL.it - 0.4, SL.it + 0.05], [SL.lox - 0.05, SL.lox + 0.4], [SL.top - 0.4, SL.top]]) cyl(RC + 0.05, RC + 0.05, y0, y1, tan, core, 128, true);
    // LOX feedlines and pressurisation lines down the hydrogen tank, the systems tunnel, umbilical plates
    for (const a of [SLF + 0.42, SLF + 0.42 + Math.PI]) {
      const c = (y, r = RC + 0.42) => [Math.sin(a) * r, y, Math.cos(a) * r];
      rod(c(10.6), c(45.2), 0.24, foam, core); rod(c(45.2), c(45.5, RC), 0.24, foam, core); rod(c(10.6), c(10.4, RC), 0.24, foam, core);
      for (let y = 15; y < 44; y += 4.6) box(0.6, 0.18, 0.45, foam, skin(core, a, RC, y), 0, 0, 0.22);
      for (const d of [0.09, 0.14]) rod([Math.sin(a + d) * (RC + 0.13), 11.0, Math.cos(a + d) * (RC + 0.13)], [Math.sin(a + d) * (RC + 0.13), 45.5, Math.cos(a + d) * (RC + 0.13)], 0.055, foam, core);
    }
    box(0.46, 33, 0.26, foam, skin(core, SLF + 0.62, RC, 27.6), 0, 0, 0.1);
    for (const d of [-0.25, 0.25]) box(1.0, 1.2, 0.16, steel, skin(core, SLF + Math.PI + d, RC, 7.8), 0, 0, 0.06);
    // the launch vehicle stage adapter: a short cylinder, then the cone up to the ICPS
    lathe([[RC, SL.top], [RC, 71.4], [2.59, SL.lvsa]], foamDS, core, 128);
    lathe([[RC + 0.05, SL.top], [RC + 0.05, SL.top + 0.4]], tan, core, 128); lathe([[RC + 0.05, 71.0], [RC + 0.05, 71.4]], tan, core, 128);
    lathe([[2.72, 77.2], [2.6, SL.lvsa]], tan, core, 96);
    // boosters: aft skirt on the posts, nozzle, five steel segments, forward skirt and nose; the NASA worm, America 250
    // and checkered photogrammetry rings. Their exhaust comes out at y = 0.
    const srbT = ctex("srb", 512, 2048, (g, w, h) => {
      const Y = (y) => (1 - (y - 5.0) / (48.4 - 5.0)) * h;
      g.fillStyle = "#f2f2ef"; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(0,0,0,.18)"; for (const y of [9, 17, 25, 33, 41]) g.fillRect(0, Y(y), w, 2);
      const ring = (y, n, s) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? "#111" : "#f2f2ef"; g.fillRect((i / n) * w, Y(y + s / 2), w / n + 0.5, Y(y - s / 2) - Y(y + s / 2)); } };
      for (const y of [43.6, 36.2, 20.4, 12.2]) ring(y, 28, 0.32);
      g.fillStyle = "#111"; for (const [u, y] of [[0.12, 40], [0.9, 33], [0.1, 25], [0.85, 17], [0.15, 9.5]]) { g.fillRect(u * w - 6, Y(y + 0.13), 12, Y(y - 0.13) - Y(y + 0.13)); }
    });
    const srbM = std("#ffffff", { map: srbT, roughness: 0.5 }), srbs = [-1, 1].map((sd) => {
      const g = new THREE.Group(); g.position.x = sd * XB; root.add(g);
      lathe([[2.7, 1.4], [2.7, 1.64], [2.62, 1.7], [1.91, 4.6], [1.89, 5.0]], std("#ebebe7", { roughness: 0.6, side: THREE.DoubleSide }), g, 96);
      bell(g, once("srbNoz", () => latheGeo([[1.93, 0], [1.93, 0.12], [1.76, 0.4], [1.52, 0.9], [1.34, 1.4], [1.3, 1.6]], 64)), { out: std("#2c2b29", { roughness: 0.7, metalness: 0.2 }), in: std("#141210", { roughness: 0.9, side: THREE.BackSide, emissive: new THREE.Color("#ffd9a0"), emissiveIntensity: 0 }) }, 0, 0, 0);
      const seg = cyl(RB, RB, 5.0, 48.4, srbM, g, 96, true); seg.rotation.y = sd < 0 ? SLF + Math.PI : SLF;
      for (const y of [13, 21, 29, 37]) cyl(RB + 0.05, RB + 0.05, y - 0.22, y + 0.22, white, g, 96, true); // field joints
      const nose = Array.from({ length: 17 }, (_, i) => { const f = i / 16, y = 48.4 + f * 6.8; return [y < 49.4 ? RB - (y - 48.4) * 0.09 : (RB - 0.09) * Math.pow(1 - (y - 49.4) / 5.8, 0.78) * (1 - 0.04 * ((y - 49.4) / 5.8)), y]; });
      lathe(nose, white, g, 96);
      if (sd < 0) cyl(RB + 0.01, RB + 0.01, 47.5, 48.0, std("#111", { roughness: 0.6 }), g, 96, true); // the black ring that marks the left booster
      const out = sd < 0 ? Math.PI * 1.5 : Math.PI / 2; // outboard side
      box(0.3, 41, 0.34, white, skin(g, out + 0.35 * sd, RB, 26.5), 0, 0, 0.1); // cable tray
      const wa = SLF + 0.18 * -sd; // the worm, turned to read down the booster
      label(g, RB + 0.012, 23.3, 27.7, wa, 1.2, (gg, w, h) => worm(gg, w / 2, h / 2, w * 0.82, { vertical: true, down: true }), 96);
      label(g, RB + 0.012, 41.0, 42.6, SLF + 0.12 * -sd, 1.6, (gg, w, h) => { gg.textAlign = "center"; gg.fillStyle = "#1f3a7a"; gg.font = `700 ${h * 0.2}px Helvetica,Arial,sans-serif`; gg.fillText("AMERICA", w / 2, h * 0.24); gg.font = `900 ${h * 0.62}px Helvetica,Arial,sans-serif`; gg.lineWidth = h * 0.05; gg.strokeStyle = "#1f3a7a"; gg.strokeText("250", w / 2, h * 0.9); gg.fillStyle = "#c8202a"; gg.fillText("250", w / 2, h * 0.9); }, 96);
      // attach hardware toward the core: forward ball fitting, three aft struts
      const toCore = -sd;
      rod([toCore * RB, 47.2, 0], [toCore * (XB - RC), 47.2, 0], 0.15, steel, g);
      for (const [y0, y1, z] of [[7.0, 7.0, 0], [6.6, 8.8, 0.6], [9.0, 9.2, -0.6]]) rod([toCore * RB, y0, z], [toCore * (XB - RC), y1, z], 0.12, steel, g);
      return g;
    });
    // ICPS, Orion stage adapter and Orion; the three fairing panels round the service module; the abort system
    const o = orionStack({ icps: true }); o.root.position.y = SL.cm; root.add(o.root); o.arrays(0);
    const sajT = ctex("saj", 1024, 256, (g, w, h) => {
      g.fillStyle = "#efefec"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,.12)"; for (let i = 0; i < 24; i++) g.fillRect((i * w) / 24, 0, 2, h);
      meatball(g, w * 0.17, h * 0.42, h * 0.3); g.fillStyle = "#003247"; g.beginPath(); g.arc(w * 0.17 - h * 0.17, h * 0.85, h * 0.07, 0, TAU); g.fill(); g.font = `bold ${h * 0.16}px Helvetica,Arial,sans-serif`; g.fillText("esa", w * 0.17 - h * 0.06, h * 0.9);
      for (const x of [0.06, 0.29]) { g.fillStyle = "#fff"; g.fillRect(x * w, h * 0.1, 14, 14); g.fillStyle = "#111"; g.fillRect(x * w, h * 0.1, 7, 7); g.fillRect(x * w + 7, h * 0.1 + 7, 7, 7); }
    });
    const sajM = std("#ffffff", { map: sajT, roughness: 0.5, side: THREE.DoubleSide });
    const saj = [0, 1, 2].map((i) => {
      const g = new THREE.Group(), a = SLF + (i * TAU) / 3; root.add(g);
      mesh(new THREE.CylinderGeometry(2.64, 2.64, 4.4, 48, 1, true, a - Math.PI / 3 + 0.004, TAU / 3 - 0.008), sajM, g, 0, 83.6, 0);
      mesh(new THREE.CylinderGeometry(2.64, 2.59, 0.6, 48, 1, true, a - Math.PI / 3 + 0.004, TAU / 3 - 0.008), sajM, g, 0, 81.1, 0);
      g.userData.a = a; return g;
    });
    const las = new THREE.Group(); root.add(las);
    const ogR = (y) => (y <= 86.4 ? 2.7 : 0.73 + (2.7 - 0.73) * Math.pow(1 - (y - 86.4) / 5.6, 1.25) * (1 + 0.64 * ((y - 86.4) / 5.6) * (1 - (y - 86.4) / 5.6)));
    const ogT = ctex("ogive", 1024, 512, (g, w, h) => {
      g.fillStyle = "#f2f2ee"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(0,0,0,.12)"; for (const x of [0.125, 0.375, 0.625, 0.875]) g.fillRect(x * w, 0, 2, h);
      const cx = ((SLF / TAU) % 1) * w; flag(g, cx - 29, h * 0.66 - 15, 58, 30); // the flag, "United States" above it, the worm below
      g.fillStyle = "#20242a"; g.font = "600 12px Helvetica,Arial,sans-serif"; g.textAlign = "center"; g.fillText("United States", cx, h * 0.56);
      worm(g, cx, h * 0.8, 24);
    });
    lathe(Array.from({ length: 25 }, (_, i) => { const y = 85.6 + (i / 24) * 6.4; return [ogR(y), y]; }), std("#ffffff", { map: ogT, roughness: 0.45 }), las, 96);
    lathe([[0.76, 91.95], [0.64, 92.8], [0.56, 93.8], [0.48, 96.8]], white, las, 48);
    for (let i = 0; i < 4; i++) { const a = SLF + Math.PI / 4 + (i * Math.PI) / 2, n = mesh(once("abortNoz", () => latheGeo([[0.22, 0], [0.22, 0.12], [0.26, 0.25], [0.33, 0.55], [0.38, 0.72]].map(([r, y]) => [r, -y]), 24)), std(white.color, { roughness: 0.5, side: THREE.DoubleSide }), las, Math.sin(a) * 0.44, 93.4, Math.cos(a) * 0.44); n.quaternion.setFromUnitVectors(V3(0, -1, 0), V3(Math.sin(a) * 0.62, -0.78, Math.cos(a) * 0.62)); }
    cyl(0.48, 0.46, 96.8, 98.8, white, las, 48);
    for (const a of [SLF + 0.35, SLF + 0.35 + TAU / 3, SLF + 0.35 - TAU / 3]) mesh(once("jetPort", () => new THREE.PlaneGeometry(0.42, 0.55)), dark, skin(las, a, 0.48, 97.4), 0, 0, 0.005);
    cyl(0.46, 0.46, 98.8, 99.6, white, las, 48);
    for (let i = 0; i < 8; i++) mesh(once("acmPort", () => new THREE.PlaneGeometry(0.16, 0.22)), dark, skin(las, (i / 8) * TAU + 0.2, 0.465, 99.2), 0, 0, 0.004);
    lathe(Array.from({ length: 13 }, (_, i) => { const f = i / 12; return [0.46 * Math.sqrt(Math.max(0, 1 - f * f)) * (1 - 0.15 * f), 99.6 + f * 1.4]; }), white, las, 48);
    // engines: RS-25s (hydrogen: faint blue with Mach diamonds), boosters (solid: blinding, smoky), the abort motor
    const rsFire = exhaust(core, { at: [0, 0.9, 0], re: 1.17, len: 60, kind: "hydrolox", cluster: RS, nozR: 1.17, glow: rsm.in });
    const srbFire = srbs.map((g) => exhaust(g, { re: 1.93, len: 110, kind: "solid" }));
    const lasF = [0, 1, 2, 3].map((i) => { const a = SLF + Math.PI / 4 + (i * Math.PI) / 2; return exhaust(las, { at: [Math.sin(a) * 0.9, 92.9, Math.cos(a) * 0.9], re: 0.38, len: 22, kind: "solid", dir: [Math.sin(a) * 0.62, -0.78, Math.cos(a) * 0.62] }); });
    return {
      root, len: 101, parts: { srbL: srbs[0], srbR: srbs[1], core, las, saj0: saj[0], saj1: saj[1], saj2: saj[2], orion: o.root }, saj, o,
      fires: { rs25: rsFire, srb: (p, th) => srbFire.forEach((f) => f(p, th)), las: (p, th) => lasF.forEach((f) => f(p, th)), rl10: o.rl10, oms: o.fire },
    };
  }

  return { falcon9Booster, f9Stack, crewDragon, superHeavy, starshipShip, starshipStack, apolloCM, apolloCSM, saturnV, orionCM, orionStack, slsStack };
}
export const MODELS_RUNTIME = makeModels.toString();
