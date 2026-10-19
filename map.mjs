// Mission map: the whole mission to scale, drawn on a canvas in the Earth–Moon rotating frame.
// It runs as an inset during the pad/ascent scene and takes over the stage when that scene ends.
// Each vehicle's mission script defines MAP = { end, objs, cam, events, marks, hud, warp } using MM's builders.

export const MAP_CSS = `
.mmap{position:absolute;right:12px;bottom:12px;width:min(36%,360px);aspect-ratio:4/3;z-index:2;border-radius:8px;overflow:hidden;box-shadow:0 0 0 1px #ffffff30,0 6px 24px #0009;cursor:zoom-in;background:#03050b}
.mmap[hidden]{display:none}
.mmap canvas{width:100%;height:100%;display:block}
.stage[data-map="full"] .mmap{right:0;bottom:0;width:100%;height:100%;aspect-ratio:auto;border-radius:0;box-shadow:none;cursor:default}
.stage[data-map="forced"] .mmap{right:0;bottom:0;width:100%;height:100%;aspect-ratio:auto;border-radius:0;cursor:zoom-out}
`;

export const MAP_RUNTIME = String.raw`
// ---- mission map (km; Earth at the origin, Moon fixed on +x)
const MM = (() => {
  const MU = { earth: 398600.4, moon: 4902.8 }, R = { earth: 6378, moon: 1737 }, C = { earth: [0, 0], moon: [384400, 0] }, TAU = Math.PI * 2;
  const lerp = (a, b, k) => a + (b - a) * k;
  const s01 = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
  const wrap = (a, near) => a + TAU * Math.round((near - a) / TAU);
  const terrain = (b, a) => { if (b !== "moon") return 0; const s = a * 1737; return 0.35 * Math.sin(s / 9.1) + 0.12 * Math.sin(s / 2.9 + 1) + 0.05 * Math.sin(s / 0.71 + 2); };
  const polar = (b, a, r) => [C[b][0] + r * Math.cos(a), C[b][1] + r * Math.sin(a)];
  const surf = (b, a, h) => polar(b, a, R[b] + terrain(b, a) + h);
  const rel = (b, p) => { const x = p[0] - C[b][0], y = p[1] - C[b][1], a = Math.atan2(y, x); return [a, Math.hypot(x, y) - R[b] - terrain(b, a)]; };
  const nearest = (p) => (Math.hypot(p[0] - C.moon[0], p[1]) < 66100 ? "moon" : "earth");
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

  // ---- segment builders
  const orb = (b, hp, ha, w, tp, dir = 1) => { const rp = R[b] + hp, ra = R[b] + ha; return { k: "conic", b, rp, e: (ra - rp) / (ra + rp), w, tp, dir }; };
  const hyp = (b, hp, vinf, w, tp, dir = 1) => { const rp = R[b] + hp; return { k: "conic", b, rp, e: 1 + (rp * vinf * vinf) / MU[b], w, tp, dir }; };
  const con = (b, hp, e, w, tp, dir = 1) => ({ k: "conic", b, rp: R[b] + hp, e, w, tp, dir });
  const fix = (b, a, h = 0) => ({ k: "fix", b, a, h });
  const path = (b, rows) => ({ k: "path", b, rows }); // [t, angle, alt km, speed km/h]; a null row joins the neighbour
  const drift = (b, rows, a0) => ({ k: "drift", b, rows, a0 }); // circular orbit whose altitude eases through [t, alt]
  const xfer = (k = 0.5, c = 0, a = 320000) => ({ k: "xfer", kk: k, c, a }); // smooth coast between the neighbours
  const blend = (b) => ({ k: "blend", b }); // ease from the previous orbit into the next (burns, rendezvous)
  const dock = (o, show = false) => ({ k: "dock", o, show });
  const period = (s) => TAU * Math.sqrt((s.rp / (1 - s.e)) ** 3 / MU[s.b]);

  function conic(s, t) {
    const { b, rp, e } = s, a = rp / (1 - e), M = Math.sqrt(MU[b] / Math.abs(a) ** 3) * (t - s.tp);
    let nu, r;
    if (e < 1) {
      const m = ((((M + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      let E = m + e * Math.sin(m);
      for (let i = 0; i < 40; i++) { const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-13) break; }
      nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
      r = a * (1 - e * Math.cos(E));
    } else {
      let H = Math.asinh(M / e);
      for (let i = 0; i < 60; i++) { const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1); H -= d; if (Math.abs(d) < 1e-13) break; }
      nu = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));
      r = a * (1 - e * Math.cosh(H));
    }
    return polar(b, s.w + s.dir * nu, r);
  }
  // Catmull-Rom through table rows, column j, with tangents limited so it never overshoots a row
  function rowsAt(rs, t, j) {
    let i = 0;
    while (i < rs.length - 2 && t > rs[i + 1][0]) i++;
    const r0 = rs[Math.max(0, i - 1)], r1 = rs[i], r2 = rs[i + 1], r3 = rs[Math.min(rs.length - 1, i + 2)], span = r2[0] - r1[0];
    const u = Math.max(0, Math.min(1, (t - r1[0]) / span)), u2 = u * u, u3 = u2 * u;
    const dd = r2[j] - r1[j], lim = (m) => (dd === 0 || m / dd < 0 ? 0 : m / dd > 3 ? 3 * dd : m);
    const m1 = lim(((r2[j] - r0[j]) / (r2[0] - r0[0])) * span), m2 = lim(((r3[j] - r1[j]) / (r3[0] - r1[0])) * span);
    return (2 * u3 - 3 * u2 + 1) * r1[j] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * r2[j] + (u3 - u2) * m2;
  }
  function prepPath(s) {
    if (s.ok) return;
    s.ok = true;
    const rs = s.rows, f = rs[0], l = rs[rs.length - 1], sp = rs.some((r) => r.length > 3);
    if (f[1] == null) { const [a, h] = rel(s.b, pos(s.prev, f[0])); f[1] = wrap(a, rs[1][1]); f[2] = h; if (sp) f[3] = segSpeed(s.prev, f[0]); }
    if (l[1] == null) { const [a, h] = rel(s.b, pos(s.next, l[0])); l[1] = wrap(a, rs[rs.length - 2][1]); l[2] = h; if (sp) l[3] = segSpeed(s.next, l[0]); }
    s.sp = sp;
  }
  function prepDrift(s) {
    if (s.cum) return;
    const t0 = s.rows[0][0], t1 = s.rows[s.rows.length - 1][0], n = 1200, dt = (t1 - t0) / n;
    s.cum = [0];
    for (let i = 0; i < n; i++) s.cum.push(s.cum[i] + Math.sqrt(MU[s.b] / (R[s.b] + rowsAt(s.rows, t0 + (i + 0.5) * dt, 1)) ** 3) * dt);
    s.d0 = t0; s.ddt = dt;
    if (s.a0 === undefined) s.a0 = rel(s.b, pos(s.prev, t0))[0];
  }
  function prepXfer(s) {
    if (s.m0) return;
    const sub = (p, q) => [p[0] - q[0], p[1] - q[1]], up = (p) => sub(p, C[nearest(p)]), unit = (v) => { const n = Math.hypot(v[0], v[1]) || 1; return [v[0] / n, v[1] / n]; };
    s.p0 = pos(s.prev, s.t0); s.p1 = pos(s.next, s.t1);
    let v0 = sub(s.p0, pos(s.prev, s.t0 - 2)), v1 = sub(pos(s.next, s.t1 + 2), s.p1);
    if (Math.hypot(v0[0], v0[1]) < 1e-3) v0 = up(s.p0);
    if (Math.hypot(v1[0], v1[1]) < 1e-3) v1 = up(s.p1).map((x) => -x);
    const L = dist(s.p0, s.p1) * s.kk;
    s.m0 = unit(v0).map((x) => x * L); s.m1 = unit(v1).map((x) => x * L);
  }
  function pos(s, t) {
    switch (s.k) {
      case "conic": return conic(s, t);
      case "fix": return surf(s.b, s.a, s.h);
      case "path": { // altitude above the mean sphere, settling onto the terrain in the last 2 km
        prepPath(s);
        const a = rowsAt(s.rows, t, 1), h = Math.max(0, rowsAt(s.rows, t, 2));
        return polar(s.b, a, R[s.b] + h + terrain(s.b, a) * Math.max(0, 1 - h / 2));
      }
      case "drift": {
        prepDrift(s);
        const x = Math.max(0, Math.min(s.cum.length - 1, (t - s.d0) / s.ddt)), i = Math.min(s.cum.length - 2, Math.floor(x));
        return polar(s.b, s.a0 + lerp(s.cum[i], s.cum[i + 1], x - i), R[s.b] + rowsAt(s.rows, t, 1));
      }
      case "xfer": {
        prepXfer(s);
        const u0 = Math.max(0, Math.min(1, (t - s.t0) / (s.t1 - s.t0))), u = u0 + s.c * u0 * (1 - u0), u2 = u * u, u3 = u2 * u;
        const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
        return [0, 1].map((j) => h00 * s.p0[j] + h10 * s.m0[j] + h01 * s.p1[j] + h11 * s.m1[j]);
      }
      case "blend": {
        const [a1, h1] = rel(s.b, pos(s.prev, t)), [a2, h2] = rel(s.b, pos(s.next, t)), k = s01((t - s.t0) / (s.t1 - s.t0));
        return surf(s.b, lerp(a1, wrap(a2, a1), k), lerp(h1, h2, k));
      }
      case "dock": return at(OBJ[s.o], t);
    }
  }
  function segSpeed(s, t) {
    if (s.k === "dock") return segSpeed(segAt(OBJ[s.o], t), t);
    if (s.k === "fix") return 0;
    if (s.k === "path" && (prepPath(s), s.sp)) return Math.max(0, rowsAt(s.rows, t, 3));
    const p = pos(s, t);
    if (s.k === "xfer") return Math.sqrt(Math.max(0, MU.earth * (2 / Math.hypot(p[0], p[1]) - 1 / s.a))) * 3600;
    if (s.k === "conic") return Math.sqrt(Math.max(0, MU[s.b] * (2 / dist(p, C[s.b]) - (1 - s.e) / s.rp))) * 3600;
    if (s.k === "drift") return Math.sqrt(MU[s.b] / dist(p, C[s.b])) * 3600;
    return dist(pos(s, t + 0.5), pos(s, t - 0.5)) * 3600;
  }

  // ---- objects
  const OBJ = {};
  let CFG = null, LIST = [], CAM = [], MARKS = [];
  const segAt = (o, t) => { for (let i = o.segs.length - 1; i > 0; i--) if (t >= o.segs[i].t0) return o.segs[i]; return o.segs[0]; };
  const at = (o, t) => { t = Math.max(o.t0, Math.min(o.t1, t)); return pos(segAt(o, t), t); };
  const pick = (v, t, d) => { if (!Array.isArray(v)) return v ?? d; let r = d; for (const [a, x] of v) if (t >= a) r = x; return r; };
  const during = (list, t) => { for (const [a, b, x] of list || []) if (t >= a && t < b) return x; return null; };
  function sample(o) {
    const T = [], X = [], Y = [], G = [];
    const add = (t, p, g) => { T.push(t); X.push(p[0]); Y.push(p[1]); G.push(g); };
    for (const s of o.segs) {
      if (s.k === "dock" || s.k === "fix") { add(NaN, [NaN, NaN], 0); continue; }
      let spans = [[s.t0, s.t1]];
      // many laps of an orbit: keep the first and the last, they cover the rest
      const P = s.k === "conic" && s.e < 1 ? period(s) : s.k === "drift" ? TAU * Math.sqrt((R[s.b] + s.rows[0][1]) ** 3 / MU[s.b]) : Infinity;
      if (s.t1 - s.t0 > 2.5 * P) spans = [[s.t0, s.t0 + 1.02 * P], [s.t1 - 1.02 * P, s.t1]];
      spans.forEach(([a, b], j) => {
        if (j) add(NaN, [NaN, NaN], 0);
        const lo = (b - a) / 6000, hi = (b - a) / (s.k === "path" || s.k === "blend" ? 2000 : 60);
        for (let t = a; ; ) {
          const p = pos(s, t);
          if (t >= b) { add(t, p, 0); break; }
          const v = dist(p, pos(s, t + 1)) || 1e-6, d = dist(p, C[nearest(p)]);
          const dt = Math.min(b - t, Math.max(lo, Math.min(hi, (0.02 * d) / v)));
          add(t, p, dt);
          t += dt;
        }
      });
    }
    o.tr = { T, X, Y, G };
  }
  function init(cfg, tauAt) {
    CFG = cfg;
    LIST = cfg.objs;
    for (const o of LIST) {
      const end = o.end ?? cfg.end;
      o.segs = o.path.map(([t0, s], i) => ({ ...s, t0, t1: i + 1 < o.path.length ? o.path[i + 1][0] : end }));
      o.segs.forEach((s, i) => { s.prev = o.segs[i - 1]; s.next = o.segs[i + 1]; });
      o.t0 = o.segs[0].t0; o.t1 = end;
      OBJ[o.id] = o;
    }
    for (const o of LIST) sample(o);
    CAM = cfg.cam.map(([t, f, r]) => ({ t, f, r, tau: tauAt(t) }));
    MARKS = cfg.marks || [];
  }
  function focus(f, t) {
    if (Array.isArray(f)) return f;
    if (f === "sys") return [192200, 0];
    if (C[f]) return C[f];
    return at(OBJ[f], t);
  }
  function camAt(t, tau) {
    let i = 0;
    while (i < CAM.length - 1 && CAM[i + 1].t <= t) i++;
    const b = CAM[i], a = CAM[Math.max(0, i - 1)], k = i === 0 ? 1 : s01((tau - b.tau) / 1.6);
    const pa = focus(a.f, t), pb = focus(b.f, t);
    return { c: [lerp(pa[0], pb[0], k), lerp(pa[1], pb[1], k)], r: Math.exp(lerp(Math.log(a.r), Math.log(b.r), k)) };
  }
  function hud(t) {
    const o = OBJ[pick(CFG.hud, t, LIST[0].id)], p = at(o, t), b = nearest(p);
    return { alt: Math.max(0, rel(b, p)[1]), vel: segSpeed(segAt(o, t), Math.max(o.t0, Math.min(o.t1, t))), ref: b, de: dist(p, C.earth) - R.earth, dm: dist(p, C.moon) - R.moon };
  }
  // where the HUD's craft is (km, map frame) and the body it is nearest, for the 3-D view's geometry
  function where(t) { const p = at(OBJ[pick(CFG.hud, t, LIST[0].id)], t); return { p, ref: nearest(p) }; }

  // ---- drawing
  let cv, ctx, W = 1, H = 1, zoom = 1, LABELS = [];
  const STARS = [];
  { let q = 7; const rnd = () => ((q = (q * 16807) % 2147483647) / 2147483647); for (let i = 0; i < 260; i++) STARS.push([rnd(), rnd(), rnd() * 1.2 + 0.3, rnd() * 0.6 + 0.2]); }
  const INK = "#0a0c10";
  function shape(pts, fill) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); }
  function box(x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); }
  function line(x0, y0, x1, y1, col, w = 1) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore(); }
  // craft are drawn nose along +x, about 20 units long
  function glyph(g) {
    ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.lineJoin = "round";
    const Wt = "#eef1f5", Gy = "#9aa3ae", Dk = "#3a3f47", Au = "#d9b45a", Or = "#e0893a", Sp = "#355f9e";
    const cone = (x0, x1, r0, r1, f) => shape([[x0, -r0], [x1, -r1], [x1, r1], [x0, r0]], f);
    const bell = (x, r = 1.6, l = 2.6) => shape([[x, -r * 0.5], [x - l, -r], [x - l, r], [x, r * 0.5]], Dk);
    switch (g) {
      case "saturn": box(-12, -2.4, 20, 4.8, Wt); box(-12, -2.4, 6, 4.8, "#1b1d22"); cone(8, 12, 2.4, 0.9, Wt); line(12, 0, 15, 0, "#d24a2a", 1); break;
      case "sls": box(-12, -2.6, 19, 5.2, Or); box(-12, -4.6, 15, 2, Wt); box(-12, 2.6, 15, 2, Wt); cone(7, 12, 2.6, 0.8, Wt); break;
      case "f9": box(-12, -1.9, 21, 3.8, Wt); cone(9, 13, 1.9, 0.6, Wt); break;
      case "starship": box(-13, -2.8, 15, 5.6, "#c6cad0"); box(2, -2.8, 9, 5.6, "#2a2d33"); cone(11, 15, 2.8, 0.9, "#2a2d33"); break;
      case "stack": box(-9, -2.2, 12, 4.4, Wt); bell(-9); cone(3, 7, 2.2, 0.8, "#c9ccd2"); break;
      case "csm": box(-5, -2.6, 7, 5.2, "#c3c7cc"); bell(-5); cone(2, 6, 2.6, 0.8, "#e6e8ea"); break;
      case "csmlm": box(-5, -2.6, 7, 5.2, "#c3c7cc"); bell(-5); cone(2, 6, 2.6, 0.8, "#e6e8ea"); box(6.4, -2.4, 3.2, 4.8, Gy); shape([[9.6, -2.6], [12, -2.6], [12.6, 0], [12, 2.6], [9.6, 2.6]], Au); break;
      case "cm": case "capsule": cone(-2, 3, 4, 1.2, "#e6e8ea"); break;
      case "lm": case "lmdesc":
        line(-1, -3, -4.5, -6, Au, 1); line(-1, 3, -4.5, 6, Au, 1);
        shape([[-2, -3.4], [1.5, -3.4], [1.5, 3.4], [-2, 3.4]], Au);
        if (g === "lm") shape([[1.5, -2.6], [5, -2.2], [5.5, 0], [5, 2.2], [1.5, 2.6]], Gy);
        break;
      case "lmasc": shape([[-1, -2.6], [2.5, -2.2], [3, 0], [2.5, 2.2], [-1, 2.6]], Gy); bell(-1, 1, 1.4); break;
      case "orion":
        line(-3, -2.6, -7, -9, Gy, 0.6); line(-3, 2.6, -7, 9, Gy, 0.6);
        shape([[-7.6, -9.4], [-5.6, -9.4], [-4.4, -5.6], [-6.4, -5.6]], Sp); shape([[-7.6, 9.4], [-5.6, 9.4], [-4.4, 5.6], [-6.4, 5.6]], Sp);
        box(-5, -2.6, 7, 5.2, Wt); bell(-5); cone(2, 6, 2.8, 0.9, "#e6e8ea"); break;
      case "dragon": box(-6, -3.4, 4.5, 6.8, Gy); box(-6, -3.4, 4.5, 3.4, "#20242b"); shape([[-1.5, -3.6], [2.5, -2.6], [4, 0], [2.5, 2.6], [-1.5, 3.6]], Wt); break;
      case "booster": case "boosterlegs":
        if (g === "boosterlegs") { line(-10, -1.9, -14, -5, Dk, 1.1); line(-10, 1.9, -14, 5, Dk, 1.1); }
        box(-12, -1.9, 20, 3.8, Wt); box(7, -3.4, 1.6, 1.5, Dk); box(7, 1.9, 1.6, 1.5, Dk); break;
      case "superheavy": box(-12, -2.8, 21, 5.6, "#c6cad0"); box(7, -4.4, 1.8, 1.6, Dk); box(7, 2.8, 1.8, 1.6, Dk); break;
      case "ship": box(-9, -2.6, 14, 5.2, "#c6cad0"); shape([[5, -2.6], [9, -2], [11, 0], [9, 2], [5, 2.6]], "#c6cad0"); box(-9, -2.6, 14, 2.6, "#25282e"); shape([[5, -2.6], [8, -2.2], [9.4, -1], [9.4, 0], [5, 0]], "#25282e"); box(-8, -4.4, 3, 1.8, Dk); box(-8, 2.6, 3, 1.8, Dk); box(4, -3.8, 2, 1.2, Dk); box(4, 2.6, 2, 1.2, Dk); break;
      case "icps": box(-5, -2.4, 7, 4.8, "#d79a5a"); bell(-5); break;
      case "stage2": box(-7, -1.9, 11, 3.8, Wt); bell(-7, 1.8, 3.4); break;
      case "iss":
        for (const y of [-11, -6, 6, 11]) { box(-4.5, y - 2, 3.4, 4, Au); box(1.1, y - 2, 3.4, 4, Au); }
        line(0, -13, 0, 13, "#c8ccd2", 1.4); box(-1.6, -3.2, 3.2, 6.4, Wt); box(-5, -1.2, 10, 2.4, Wt); break;
      case "sat": box(-1.5, -1.5, 3, 3, Gy); box(-1, -6, 2, 4, Sp); box(-1, 2, 2, 4, Sp); break;
      // surface markers (drawn standing up)
      case "pad": box(0, -1.6, 13, 3.2, "#b8462a"); box(0, -5, 1.2, 10, "#6b6f78"); break;
      case "tower": box(0, -1.8, 18, 3.6, "#5c6270"); line(15, 1.8, 15, 8, "#9aa3ae", 1.2); line(15, -1.8, 15, -8, "#9aa3ae", 1.2); break;
      case "droneship": box(0, -10, 2, 20, "#3b3f47"); box(2, -10, 1.5, 2, Dk); box(2, 8, 1.5, 2, Dk); break;
      case "boat": shape([[0, -11], [0, 11], [2.6, 12], [2.6, -9]], "#6f7783"); box(2.6, -4, 3.2, 7, "#c9ced6"); break;
      case "flag": line(0, 0, 11, 0, "#e8e8e8", 0.9); box(7.4, 0, 3.6, 5.6, "#f2f2f2"); line(9.2, 0.4, 9.2, 5.2, "#c8324a", 1.2); break;
    }
  }
  function flame(len) {
    const g = ctx.createLinearGradient(0, 0, -len, 0);
    g.addColorStop(0, "#fffbe8"); g.addColorStop(0.3, "#ffc35acc"); g.addColorStop(1, "#ff6a1e00");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -1.6); ctx.quadraticCurveTo(-len * 0.5, -3.2, -len, 0); ctx.quadraticCurveTo(-len * 0.5, 3.2, 0, 1.6); ctx.fill();
  }
  function body(b, X, Y, s) {
    const c = C[b], r = R[b] * s, x = X(c), y = Y(c), diag = Math.hypot(W, H);
    if (x + r < -40 || x - r > W + 40 || y + r < -40 || y - r > H + 40) return;
    const earth = b === "earth";
    if (r < 2500) {
      const rr = Math.max(r, 2.2);
      if (earth) { ctx.beginPath(); ctx.arc(x, y, rr * 1.035, 0, TAU); ctx.fillStyle = "#4f8fe633"; ctx.fill(); }
      const g = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.35, rr * 0.05, x, y, rr);
      if (earth) { g.addColorStop(0, "#7ab8ff"); g.addColorStop(0.55, "#2463b0"); g.addColorStop(1, "#0b2a55"); }
      else { g.addColorStop(0, "#dedad2"); g.addColorStop(0.6, "#9d9a93"); g.addColorStop(1, "#4d4b47"); }
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fillStyle = g; ctx.fill();
      if (rr > 10) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = earth ? "#e9f3ff22" : "#3a383522";
        const spots = earth ? [[-0.3, 0.35, 0.3, 0.12], [0.25, -0.2, 0.4, 0.1], [0.1, 0.6, 0.25, 0.08], [-0.5, -0.4, 0.3, 0.1]] : [[-0.4, 0.2, 0.25, 0.25], [-0.2, -0.35, 0.18, 0.18], [0.1, 0.45, 0.15, 0.15], [-0.6, -0.05, 0.12, 0.12], [0.3, -0.1, 0.1, 0.1]];
        for (const [u, v, a, bb] of spots) { ctx.beginPath(); ctx.ellipse(x + u * rr, y + v * rr, a * rr, bb * rr, 0.4, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
      if (r > 5 && r < 60) { ctx.fillStyle = "#9fb3d1"; ctx.font = "600 10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText(earth ? "EARTH" : "MOON", x, y + rr + 14); ctx.textAlign = "left"; }
      return;
    }
    // close up: trace the visible stretch of the rim (with lunar terrain) and fill inward
    const a0 = Math.atan2(-(H / 2 - y), W / 2 - x), span = Math.min(Math.PI, (1.3 * diag) / r), N = 360;
    const rim = [];
    for (let i = 0; i <= N; i++) { const a = a0 - span + (2 * span * i) / N, rr = (R[b] + terrain(b, a)) * s; rim.push([x + rr * Math.cos(a), y - rr * Math.sin(a)]); }
    const deep = (a) => [x + (r - diag * 1.5) * Math.cos(a), y - (r - diag * 1.5) * Math.sin(a)];
    ctx.beginPath(); rim.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    const e1 = deep(a0 + span), e0 = deep(a0 - span); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e0[0], e0[1]); ctx.closePath();
    ctx.fillStyle = earth ? "#174a86" : "#8c8882"; ctx.fill();
    ctx.save(); ctx.beginPath(); rim.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    if (earth) { ctx.strokeStyle = "#7fb6ff40"; ctx.lineWidth = Math.min(40, Math.max(3, 60 * s)); ctx.stroke(); ctx.strokeStyle = "#bfe0ff"; ctx.lineWidth = 1.2; ctx.stroke(); }
    else { ctx.strokeStyle = "#c9c5bd"; ctx.lineWidth = 1.4; ctx.stroke(); }
    ctx.restore();
  }
  function trail(o, t, X, Y, col, future) {
    const { T, X: xs, Y: ys, G } = o.tr;
    ctx.strokeStyle = col; ctx.lineWidth = future ? 1 : 1.4; ctx.setLineDash(future ? [3, 5] : []);
    ctx.beginPath();
    let pen = false, last = -1;
    for (let i = 0; i < T.length; i++) {
      const ti = T[i];
      if (!future && ti > t) break;
      if (future && !(ti >= t)) { pen = false; continue; }
      if (ti !== ti) { pen = false; continue; }
      const sx = X([xs[i], ys[i]]), sy = Y([xs[i], ys[i]]);
      if (Math.abs(sx) > 4e5 || Math.abs(sy) > 4e5) { pen = false; continue; }
      pen ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
      pen = true; last = i;
    }
    if (!future && pen && last >= 0 && T[last] + G[last] * 1.01 >= t && t <= o.t1 && segAt(o, t).k !== "dock") { const p = at(o, t); ctx.lineTo(X(p), Y(p)); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  function drawObj(o, t, X, Y, gs, s, full) {
    if (t < o.t0 || t > o.t1) return;
    const seg = segAt(o, t);
    if (seg.k === "dock" && !seg.show) return;
    const p = at(o, t), x = X(p), y = Y(p);
    if (x < -80 || x > W + 80 || y < -80 || y > H + 80) return;
    const b = nearest(p), q = at(o, t + 1), pm = at(o, t - 1);
    const vx = q[0] - pm[0], vy = q[1] - pm[1], moving = Math.hypot(vx, vy) > 1e-5;
    const up = Math.atan2(-(p[1] - C[b][1]), p[0] - C[b][0]), va = moving ? Math.atan2(-vy, vx) : up;
    const mode = during(o.pose, t);
    let ang = va;
    if (mode === "up" || (!moving && seg.k !== "dock")) ang = up;
    else if (mode === "retro") ang = va + Math.PI;
    else if (mode === "belly") { const a1 = va + Math.PI / 2, a2 = va - Math.PI / 2; ang = Math.cos(a1 - up) > Math.cos(a2 - up) ? a1 : a2; }
    const fx = during(o.fx, t), h = rel(b, p)[1], v = segSpeed(seg, t);
    ctx.save(); ctx.translate(x, y);
    // re-entry plasma, in the direction of travel
    if (b === "earth" && h > 25 && h < 115 && v > 9000 && moving) {
      const k = Math.min(1, (v - 9000) / 15000) * Math.min(1, (115 - h) / 25);
      ctx.save(); ctx.rotate(va); ctx.scale(gs, gs);
      const g = ctx.createRadialGradient(4, 0, 0, 4, 0, 14);
      g.addColorStop(0, "#fff4d8"); g.addColorStop(0.35, "#ffb05acc"); g.addColorStop(1, "#ff5a2000");
      ctx.globalAlpha = 0.35 + 0.65 * k; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(4, 0, 14, 0, TAU); ctx.fill();
      const tg = ctx.createLinearGradient(0, 0, -60, 0); tg.addColorStop(0, "#ff9a4acc"); tg.addColorStop(1, "#ff5a2000");
      ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(4, -5); ctx.lineTo(-60, -1.5); ctx.lineTo(-60, 1.5); ctx.lineTo(4, 5); ctx.fill();
      ctx.restore();
    }
    if (fx === "chute1" || fx === "chute2") {
      ctx.save(); ctx.rotate(up); ctx.scale(gs, gs); ctx.strokeStyle = "#d8dde4"; ctx.lineWidth = 0.5;
      const big = fx === "chute2", d = big ? 22 : 13, rr = big ? 6 : 2.6, ys = big ? [-11, 0, 11] : [-4, 4];
      for (const yy of ys) { line(3, 0, d, yy, "#d8dde4", 0.5); ctx.beginPath(); ctx.arc(d + rr * 0.3, yy, rr, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fillStyle = big ? "#f0f0f0" : "#ff8a3d"; ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
    if (fx === "dust") { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 26 * gs); g.addColorStop(0, "#d8d2c6aa"); g.addColorStop(1, "#d8d2c600"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 26 * gs, 0, TAU); ctx.fill(); }
    if (seg.k === "fix" && b === "earth" && t - seg.t0 < 4000) {
      const c = (fxClock * 0.6) % 1;
      for (const k of [c, (c + 0.5) % 1]) { ctx.strokeStyle = "rgba(220,240,255," + (0.6 * (1 - k)).toFixed(3) + ")"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, 6 + 22 * k, 3 + 9 * k, -up, 0, TAU); ctx.stroke(); }
    }
    ctx.rotate(ang); ctx.scale(gs, gs);
    if (fx === "burn") { ctx.save(); ctx.translate(-glyphTail(pick(o.g, t)), 0); flame(10 + 3 * Math.sin(fxClock * 40)); ctx.restore(); }
    glyph(pick(o.g, t));
    ctx.restore();
    if (o.name) {
      let ly = y - 10 * gs;
      while (LABELS.some(([lx, yy]) => Math.abs(lx - x) < 90 && Math.abs(yy - ly) < 12)) ly -= 13;
      LABELS.push([x, ly]);
      ctx.font = (full ? "600 11px" : "600 9px") + " ui-monospace,monospace"; ctx.fillStyle = o.col || "#cfe0ff";
      ctx.fillText(pick(o.name, t), x + 14 * gs, ly);
    }
  }
  const glyphTail = (g) => ({ saturn: 12, sls: 12, f9: 12, starship: 13, stack: 11.6, csm: 7.6, csmlm: 7.6, orion: 7.6, lmasc: 2.4, dragon: 6, booster: 12, boosterlegs: 12, superheavy: 12, ship: 9, icps: 7.6, stage2: 10.4, lm: 2, lmdesc: 2 })[g] ?? 4;
  function mark(m, t, X, Y, gs, full) {
    if ((m.from !== undefined && t < m.from) || (m.to !== undefined && t > m.to)) return;
    const p = surf(m.b, m.a, 0), x = X(p), y = Y(p);
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(-(p[1] - C[m.b][1]), p[0] - C[m.b][0])); ctx.scale(gs, gs); glyph(m.kind); ctx.restore();
    if (m.name && full) { ctx.font = "10px ui-monospace,monospace"; ctx.fillStyle = "#9fb3d1"; ctx.fillText(m.name, x + 12 * gs, y + 14 * gs); }
  }
  const nice = (v) => { const e = 10 ** Math.floor(Math.log10(v)), f = v / e; return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * e; };
  const km = (v) => (v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  function draw(t, tau, full) {
    if (!cv) { cv = document.querySelector(".mmap canvas"); ctx = cv.getContext("2d"); }
    const dpr = Math.min(2, devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight;
    if (!cw || !ch) return;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    W = cw; H = ch;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#03050b"; ctx.fillRect(0, 0, W, H);
    for (const [u, v, r, a] of STARS) { ctx.globalAlpha = a; ctx.fillStyle = "#dfe8ff"; ctx.fillRect(u * W, v * H, r, r); }
    ctx.globalAlpha = 1;
    const cam = camAt(t, tau), vr = cam.r * (full ? zoom : 1), s = Math.min(W, H) / 2 / vr;
    const X = (p) => W / 2 + (p[0] - cam.c[0]) * s, Y = (p) => H / 2 - (p[1] - cam.c[1]) * s;
    const gs = full ? 1.5 : 0.8;
    if (vr > 25000 && vr < 2e6) { ctx.strokeStyle = "#9fb3d12e"; ctx.setLineDash([2, 6]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X(C.earth), Y(C.earth), C.moon[0] * s, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    body("earth", X, Y, s); body("moon", X, Y, s);
    const main = pick(CFG.hud, t, LIST[0].id);
    LABELS = [];
    for (const o of LIST) if (o.id === main) trail(o, t, X, Y, (o.col || "#cfe0ff") + "55", true);
    for (const o of LIST) if (t >= o.t0) trail(o, t, X, Y, (o.col || "#cfe0ff") + "cc", false);
    for (const m of MARKS) mark(m, t, X, Y, gs, full);
    for (const o of LIST) if (o.id !== main) drawObj(o, t, X, Y, gs, s, full);
    drawObj(OBJ[main], t, X, Y, gs, s, full);
    // scale bar and tag
    const L = nice((W * 0.2) / s), lp = L * s, y0 = H - (full ? 18 : 10);
    ctx.strokeStyle = "#cfe0ff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, y0 - 4); ctx.lineTo(10, y0); ctx.lineTo(10 + lp, y0); ctx.lineTo(10 + lp, y0 - 4); ctx.stroke();
    ctx.font = (full ? "11px" : "9px") + " ui-monospace,monospace"; ctx.fillStyle = "#cfe0ff";
    ctx.fillText((L >= 1 ? L.toLocaleString() + " km" : L * 1000 + " m"), 14, y0 - 6);
    ctx.textAlign = "right"; ctx.fillStyle = "#9fb3d1";
    ctx.fillText(full ? "MISSION MAP · TO SCALE · CRAFT ICONS ENLARGED" : "MISSION MAP · CLICK TO EXPAND", W - 10, 16);
    if (full) {
      const hh = hud(t);
      ctx.fillStyle = "#cfe0ff";
      ctx.fillText("Earth " + km(Math.max(0, hh.de)) + " km  ·  Moon " + km(Math.max(0, hh.dm)) + " km", W - 10, H - 18);
    }
    ctx.textAlign = "left";
  }
  return { orb, hyp, con, fix, path, drift, xfer, blend, dock, period, R, ang: (s, t) => rel(s.b, pos(s, t))[0], init, draw, hud, where, zoomBy: (f) => (zoom = Math.max(0.02, Math.min(60, zoom * f))), zoomReset: () => (zoom = 1) };
})();
`;
