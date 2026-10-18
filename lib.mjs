// Shared library for the rocket anatomy figures (SLS, Starship, Falcon 9, Saturn V).
// World units are decimetres (10 = 1 m). x/y on the floor, z up. Vehicle axis at x = y = 0.
// A vehicle script imports this, registers parts with part(), draws with put(), then calls buildPage().
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FX_FRAGMENT, FX_RUNTIME } from "./fx.mjs";
import { MAP_CSS, MAP_RUNTIME } from "./map.mjs";
import { LAND_CSS, LAND_RUNTIME } from "./land.mjs";

const SKILL = join(homedir(), ".claude", "skills", "anatomy-3d-skill");
export const k = await import(pathToFileURL(join(SKILL, "kit", "iso-kit.mjs")).href);
export const G = await import(pathToFileURL(join(SKILL, "kit", "lathe.mjs")).href);
export const { tubePieces, tubeSvg } = await import(pathToFileURL(join(SKILL, "kit", "tube.mjs")).href);
const { kitScript, glScript } = await import(pathToFileURL(join(SKILL, "scripts", "inline-kit.mjs")).href);

export const HERE = dirname(fileURLToPath(import.meta.url));
export const theme = process.argv.includes("--light") ? "light" : "dark";
export const TAU = Math.PI * 2;

// ---------------------------------------------------------------- camera
export const P = { origin: [0, 0], scale: 1 / Math.sqrt(1.6), azimuth: 62, elevation: 18 };
export const V = G.viewOf(P);
export const { sinA, cosA } = k.cameraOf(P);
export const RIGHT = [sinA, -cosA, 0]; // floor direction that runs screen-right
export const BACK = [-cosA, -sinA, 0]; // floor direction away from the viewer
export const at = (p) => k.iso(p, P);
export const depth = (p) => G.dot3(p, V);
export const r1 = (n) => Math.round(n * 10) / 10;
export const poly = (pts, close = true) => "M" + pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join("L") + (close ? "Z" : "");
export const poly3 = (pts, close = true) => poly(pts.map(at), close);
// Vertical frame: angle 0 = screen right, PI/2 = straight back, -PI/2 = facing the viewer.
export const FZ = (x, y, z = 0) => G.frameOf([x, y, z], [0, 0, 1], RIGHT, BACK);
export const FRONT = -Math.PI / 2;
export const pt = G.pointOf;
export const S = (paths, o = {}) => k.solidSvg(paths, { tone: "hi", crease: "faint", ...o });
export const L = (d, tone = "lo", o = {}) => k.lineSvg(d, { tone, ...o });
export const D = (pts, o = {}) => k.dotsSvg(pts, { size: 0.35, tone: "mid", ...o });
export const smooth01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const FX_CAMERA = { origin: P.origin, k: P.scale * Math.sqrt(1.6), cam: [sinA, cosA, Math.sin((P.elevation * Math.PI) / 180), Math.cos((P.elevation * Math.PI) / 180)] };

// ---------------------------------------------------------------- parts registry and item list
export const GROUPS = [];
export const PARTS = {};
export function part(id, group, name, spec, info, cut = false) {
  PARTS[id] = { id, group, name, spec, info, cut };
}
export const items = [];
let seq = 0;
export const slot = () => seq++;
export function put(zone, id, mat, svg, { asm, view = "both", key, attrs = "" } = {}) {
  if (!svg) return;
  if (id !== "fx" && !PARTS[id]) throw new Error("unknown part " + id);
  items.push({ key: key ?? zone * 1e6 + seq++, id, mat, asm, view, svg, attrs });
}

// ---------------------------------------------------------------- helpers
export function arcAt(F, s, r, slope = 0, o = {}) {
  return G.arcOf(F, s, r, P, { slope, ...o });
}
// any closed point list on the surface, drawn only if it faces the viewer
export function facing(F, angle, slope = 0) {
  return G.facingOf(F, angle, P, slope);
}
// Quad on a surface of revolution (radius r, s0..s1, angle a0..a1)
export function surfQuad(F, s0, s1, r0, r1q, a0, a1, n = 4) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(pt(F, s0, r0, a0 + ((a1 - a0) * i) / n));
  for (let i = n; i >= 0; i--) pts.push(pt(F, s1, r1q, a0 + ((a1 - a0) * i) / n));
  return poly3(pts);
}
// a 2x2 checker patch (dark squares only) centred at angle a, height s
export function checker(F, s, r, a, size, cells = 2) {
  if (facing(F, a) < 0.2) return "";
  const da = size / r;
  let d = "";
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < cells; j++)
      if ((i + j) % 2 === 0) d += surfQuad(F, s + size * (cells / 2 - j - 1), s + size * (cells / 2 - j), r, r, a + da * (i - cells / 2), a + da * (i + 1 - cells / 2), 2);
  return `<path class="ck" d="${d}"/>`;
}
// ring of alternating squares around a body
export function checkerRing(F, s, r, count, h, rows = 1) {
  let d = "";
  const da = TAU / count;
  for (let row = 0; row < rows; row++)
    for (let i = 0; i < count; i++) {
      if ((i + row) % 2) continue;
      const a = i * da;
      const f = facing(F, a + da / 2);
      if (f < 0.08) continue;
      d += surfQuad(F, s + h * row, s + h * (row + 1), r, r, a, a + da, 3);
    }
  return `<path class="ck" d="${d}"/>`;
}
// transform for flat artwork laid on a body at angle a: local x along the hoop, local y down the body
export function decalMatrix(F, s, r, a, slope = 0) {
  const o = pt(F, s, r, a);
  const t = G.unit3(G.add3(G.mul3(F.u, -Math.sin(a)), G.mul3(F.v, Math.cos(a))));
  const down = G.unit3(G.sub3(G.mul3(G.radialOf(F, a), -slope), F.a));
  const O = at(o);
  const X = G.sub3([...at(G.add3(o, t)), 0], [...O, 0]);
  const Y = G.sub3([...at(G.add3(o, down)), 0], [...O, 0]);
  return `matrix(${[X[0], X[1], Y[0], Y[1], O[0], O[1]].map((n) => n.toFixed(4)).join(" ")})`;
}
export function decal(F, s, r, a, inner, slope = 0, least = 0.25) {
  if (facing(F, a, slope) < least) return "";
  return `<g transform="${decalMatrix(F, s, r, a, slope)}">${inner}</g>`;
}
// NASA "worm" logotype in a 4 x 1 box (local units), drawn as fat round strokes
export function wormLetters(h) {
  const w = h * 0.86;
  const gap = h * 0.24;
  const sw = h * 0.22;
  const x = (i) => i * (w + gap);
  const N = (o) => `M${o} ${h}V${h * 0.3}Q${o} 0 ${o + w * 0.32} ${h * 0.18}L${o + w * 0.68} ${h * 0.82}Q${o + w} ${h} ${o + w} ${h * 0.7}V0`;
  const A = (o) => `M${o} ${h}L${o + w * 0.36} ${h * 0.14}Q${o + w / 2} ${-h * 0.12} ${o + w * 0.64} ${h * 0.14}L${o + w} ${h}`;
  const Sx = (o) => `M${o + w} ${h * 0.02}H${o + w * 0.32}Q${o} ${h * 0.02} ${o} ${h * 0.27}Q${o} ${h * 0.5} ${o + w * 0.32} ${h * 0.5}H${o + w * 0.68}Q${o + w} ${h * 0.5} ${o + w} ${h * 0.74}Q${o + w} ${h * 0.98} ${o + w * 0.68} ${h * 0.98}H${o}`;
  const total = x(3) + w;
  return { d: N(x(0)) + A(x(1)) + Sx(x(2)) + A(x(3)), sw, total };
}
export function worm(h, { vertical = false } = {}) {
  const { d, sw, total } = wormLetters(h);
  const g = `<path class="worm" d="${d}" stroke-width="${r1(sw * 10) / 10}"/>`;
  if (vertical) return `<g transform="rotate(90) translate(${-total / 2} ${-h / 2})">${g}</g>`;
  return `<g transform="translate(${-total / 2} ${-h / 2})">${g}</g>`;
}
export function meatball(rad) {
  const swoosh = `M${-rad * 1.05} ${rad * 0.55}Q${-rad * 0.1} ${rad * 0.05} ${rad * 1.1} ${-rad * 0.62}Q${rad * 0.15} ${rad * 0.2} ${-rad * 0.6} ${rad * 0.95}Z`;
  return `<g class="meatball"><circle r="${rad}" class="mb-blue"/><ellipse rx="${rad * 0.78}" ry="${rad * 0.3}" transform="rotate(-18)" class="mb-orbit"/><path d="${swoosh}" class="mb-red"/><text y="${rad * 0.18}" font-size="${rad * 0.5}" class="mb-text" text-anchor="middle">NASA</text><circle cx="${-rad * 0.45}" cy="${-rad * 0.5}" r="${rad * 0.05}" class="mb-star"/><circle cx="${rad * 0.3}" cy="${-rad * 0.62}" r="${rad * 0.04}" class="mb-star"/><circle cx="${rad * 0.55}" cy="${rad * 0.45}" r="${rad * 0.04}" class="mb-star"/></g>`;
}
export function esaLogo(h) {
  return `<g class="esa"><circle cx="${-h * 1.15}" cy="0" r="${h * 0.45}" class="esa-dot"/><circle cx="${-h * 1.15}" cy="0" r="${h * 0.16}" class="esa-hole"/><text x="${-h * 0.55}" y="${h * 0.35}" font-size="${h}" class="esa-text">esa</text></g>`;
}
export function usFlag(w) {
  const h = w * 0.526;
  let s = `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" class="fl-white"/>`;
  for (let i = 0; i < 13; i += 2) s += `<rect x="${-w / 2}" y="${-h / 2 + (h / 13) * i}" width="${w}" height="${h / 13}" class="fl-red"/>`;
  s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w * 0.4}" height="${(h * 7) / 13}" class="fl-blue"/>`;
  return s;
}
export function patchOutline(F, prof, a0, a1, n = 24) {
  const side = (a) => prof.map(([s, r]) => pt(F, s, r, a));
  const arc = (s, r, rev) => {
    const list = [];
    for (let i = 0; i <= n; i++) list.push(pt(F, s, r, a0 + ((a1 - a0) * (rev ? n - i : i)) / n));
    return list;
  };
  const [s0, r0] = prof[0];
  const [sN, rN] = prof[prof.length - 1];
  return poly3([...arc(s0, r0, false), ...side(a1), ...arc(sN, rN, true), ...side(a0).reverse()]);
}
// A shell patch (open surface of revolution between angles a0..a1). Facets are painted back to front,
// showing the outside where it faces the viewer and the (darker) inside elsewhere.
export function patchSvg(F, prof, a0, a1, { steps = 72, layers = [], edge = true, limbs = true, sort = true } = {}) {
  const n = Math.max(4, Math.round((steps * (a1 - a0)) / TAU));
  const quads = [];
  const outerAt = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    const tm = (t0 + t1) / 2;
    const rad = G.radialOf(F, tm);
    let column = 0;
    for (let j = 0; j < prof.length - 1; j++) {
      const [s0, ra] = prof[j];
      const [s1, rb] = prof[j + 1];
      if (ra < 1e-6 && rb < 1e-6) continue;
      const nrm = G.unit3(G.sub3(G.mul3(rad, s1 - s0), G.mul3(F.a, rb - ra)));
      const f = G.dot3(nrm, V);
      const outer = f >= 0;
      column += f;
      const tone = outer ? G.toneOf(nrm, P) : Math.max(0, G.toneOf(G.mul3(rad, -1), P) - 1);
      const c = pt(F, (s0 + s1) / 2, (ra + rb) / 2, tm);
      quads.push({ d: depth(c), tone, outer, pts: [pt(F, s0, ra, t0), pt(F, s0, ra, t1), pt(F, s1, rb, t1), pt(F, s1, rb, t0)] });
    }
    outerAt.push(column >= 0);
  }
  if (sort) quads.sort((a, b) => a.d - b.d);
  else quads.sort((a, b) => (a.outer - b.outer) || (a.tone - b.tone));
  const runs = [];
  for (const q of quads) {
    const last = runs[runs.length - 1];
    const cls = (q.outer ? "o" : "i") + q.tone;
    if (last && last.cls === cls) last.d += poly3(q.pts);
    else runs.push({ cls, tone: q.tone, outer: q.outer, d: poly3(q.pts) });
  }
  let out = runs.map((run) => (run.tone >= 4 ? `<path class="iso-top${run.outer ? "" : " inn"}" d="${run.d}"/>` : `<path class="iso-shade${run.outer ? "" : " inn"}" data-shade="${run.tone}" d="${run.d}"/>`)).join("");
  // cut faces
  for (const a of layers.length ? [a0, a1] : []) {
    let rOut = 0;
    for (const layer of layers) {
      const outerPts = prof.map(([s, r]) => pt(F, s, Math.max(0, r - rOut), a));
      const innerPts = prof.map(([s, r]) => pt(F, s, Math.max(0, r - rOut - layer.t), a)).reverse();
      out += `<path class="cutf ${layer.cls}" d="${poly3([...outerPts, ...innerPts])}"/>`;
      rOut += layer.t;
    }
    const outerLine = prof.map(([s, r]) => pt(F, s, r, a));
    out += L(poly3(outerLine, false), "hi", { className: "iso-edge" });
    if (rOut > 0) out += L(poly3(prof.map(([s, r]) => pt(F, s, Math.max(0, r - rOut), a)), false), "faint");
  }
  if (limbs) {
    for (let i = 1; i < outerAt.length; i++) {
      if (outerAt[i] !== outerAt[i - 1]) {
        const a = a0 + ((a1 - a0) * i) / n;
        out += L(poly3(prof.map(([s, r]) => pt(F, s, r, a)), false), "hi", { className: "iso-edge" });
      }
    }
  }
  if (edge) out += `<path class="iso-line iso-edge" data-tone="hi" d="${patchOutline(F, prof, a0, a1)}"/>`;
  return `<g class="iso-solid" data-seamless="">${out}</g>`;
}
// Flat section of a body of revolution in the cut plane (angle 0 / PI), between radius functions.
export function sectionSvg(F, s0, s1, rIn, rOut, cls, n = 40, both = true) {
  let out = "";
  for (const a of both ? [0, Math.PI] : [0]) {
    const outer = [];
    const inner = [];
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n;
      outer.push(pt(F, s, rOut(s), a));
      inner.push(pt(F, s, rIn(s), a));
    }
    out += `<path class="${cls}" d="${poly3([...outer, ...inner.reverse()])}"/>`;
  }
  return out;
}
// Liquid in a cut tank: a flat section plus the visible half of the free surface
export function liquidSvg(F, prof, level, cls) {
  const below = [];
  for (let i = 0; i < prof.length; i++) {
    const [s, r] = prof[i];
    if (s <= level) below.push([s, r]);
    else {
      const [sp, rp] = prof[i - 1];
      below.push([level, rp + ((r - rp) * (level - sp)) / (s - sp)]);
      break;
    }
  }
  const right = below.map(([s, r]) => pt(F, s, r - 1.6, 0));
  const left = below.map(([s, r]) => pt(F, s, r - 1.6, Math.PI)).reverse();
  const rl = below[below.length - 1][1] - 1.6;
  const surf = [];
  for (let i = 0; i <= 36; i++) surf.push(pt(F, level, rl, (Math.PI * i) / 36));
  return `<path class="${cls}" d="${poly3([...right, ...left])}"/><path class="${cls} liq-top" d="${poly3(surf)}"/>` + L(poly3([pt(F, level, rl, 0), pt(F, level, rl, Math.PI)], false), "mid", { className: "liq-line" });
}
export function dome(sBase, h, r, up, n = 10) {
  // elliptical dome points from the rim (sBase, r) to the apex
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (Math.PI / 2);
    out.push([sBase + (up ? 1 : -1) * h * Math.sin(t), r * Math.cos(t)]);
  }
  return out;
}
export function tube(points, radius, o = {}) {
  return tubePieces(points, radius, P, { maxLength: 4000, ...o })
    .map((piece) => tubeSvg(piece))
    .join("");
}
// box on a vertical body face: frame at the body's surface at angle a, height z0..z1
export function boxOn(F, a, rIn, depthOut, width, z0, z1) {
  const rad = G.radialOf(F, a);
  const tan = G.unit3(G.add3(G.mul3(F.u, -Math.sin(a)), G.mul3(F.v, Math.cos(a))));
  const o = G.add3(F.o, G.mul3(rad, rIn));
  const Fb = G.frameOf([o[0], o[1], 0], [0, 0, 1], tan, rad);
  return G.prismOf(Fb, [[-width / 2, 0], [width / 2, 0], [width / 2, depthOut], [-width / 2, depthOut]], z0, z1, P);
}

export function band(F, z0, z1, r) {
  return patchSvg(F, [[z0, r], [z1, r]], Math.PI, TAU, { steps: 96, limbs: false, sort: false });
}
export function fadedRibs(F, s0, s1, r0, count, slope) {
  const list = G.ribsOf(F, s0, s1, r0, count, P, { r1: r0 + slope * (s1 - s0), fade: [0.05, 0.45], seams: true });
  return k.fadedSvg(list, { tone: "faint" });
}
export function bandPath(F, s0, s1, r) {
  // visible part of a painted band on a cylinder
  const pts0 = [];
  const pts1 = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * TAU;
    if (facing(F, a) < -0.02) continue;
    pts0.push(pt(F, s0, r, a));
    pts1.push(pt(F, s1, r, a));
  }
  // order by screen x so the strip is one polygon
  const order = (list) => list.map((p) => [p, at(p)[0]]).sort((a, b) => a[1] - b[1]).map(([p]) => p);
  return poly3([...order(pts0), ...order(pts1).reverse()]);
}


// ---------------------------------------------------------------- SVG fallback plumes (shown only without WebGL)
export function flamePath(cx, cy, L, w, n = 28) {
  const right = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    right.push([cx + w(u), cy + u * L]);
  }
  const left = right.map(([x, y]) => [2 * cx - x, y]).reverse();
  return poly([...right, ...left]);
}
export function plumeGroup(kind, ex, ey, inner) {
  return `<g class="plume" data-plume="${kind}" data-ex="${r1(ex)}" data-ey="${r1(ey)}" style="display:none">${inner}</g>`;
}

// ---------------------------------------------------------------- coming home: parachutes, plasma, sea (shown only in the return scene)
const RET_ONLY = ' data-retonly=""';
// n canopies on risers from `attach`, clustered `height` above it; stage 1 = drogues, 2 = mains
export function chutesSvg(stage, attach, { n, spread, height, R, h = R * 0.62, bands = true }) {
  const tops = Array.from({ length: n }, (_, i) => { const a = FRONT + 0.5 + (i / n) * TAU; return [attach[0] + Math.cos(a) * spread, attach[1] + Math.sin(a) * spread, attach[2] + height]; })
    .sort((p, q) => depth(p) - depth(q));
  const dome = (z0, z1) => profileOf(z0, z1, (z) => R * Math.sqrt(Math.max(0.002, 1 - (z / h) ** 2)), 10);
  let s = "";
  for (const c of tops) {
    for (let j = 0; j < 6; j++) { const a = (j / 6) * TAU + 0.2; s += L(poly3([[c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R, c[2]], attach], false), "faint"); }
    const F = FZ(c[0], c[1], c[2]);
    if (bands) s += `<g class="m-white">${S(G.solidOf(dome(0, h * 0.3), F, P, { smooth: true }), { crease: "none" })}</g><g class="m-chute">${S(G.solidOf(dome(h * 0.3, h * 0.72), F, P, { smooth: true }), { crease: "none" })}</g><g class="m-white">${S(G.solidOf(dome(h * 0.72, h), F, P, { smooth: true }), { crease: "none" })}</g>`;
    else s += `<g class="m-chute">${S(G.solidOf(dome(0, h), F, P, { smooth: true }), { crease: "none" })}</g>`;
  }
  const [ex, ey] = at(attach);
  return `<g data-chute="${stage}" data-ex="${r1(ex)}" data-ey="${r1(ey)}"${RET_ONLY} style="display:none">${s}</g>`;
}
// re-entry glow: the shock layer under the heat shield (front) and the wake streaming up past the craft (back)
export function plasmaSvg(c, r, { wake = 7, front = true } = {}) {
  const [x, y] = at(c), rs = Math.hypot(...[0, 1].map((i) => at([c[0] + r, c[1], c[2]])[i] - at(c)[i])), Lw = rs * wake;
  const back = `<path d="M${r1(x - rs * 1.1)} ${r1(y)}C${r1(x - rs * 1.5)} ${r1(y - Lw * 0.4)} ${r1(x - rs * 0.6)} ${r1(y - Lw * 0.8)} ${r1(x)} ${r1(y - Lw)}C${r1(x + rs * 0.6)} ${r1(y - Lw * 0.8)} ${r1(x + rs * 1.5)} ${r1(y - Lw * 0.4)} ${r1(x + rs * 1.1)} ${r1(y)}Z" fill="url(#g-wake)"/>`;
  const shock = `<ellipse cx="${r1(x)}" cy="${r1(y + rs * 0.12)}" rx="${r1(rs * 1.45)}" ry="${r1(rs * 0.75)}" fill="url(#g-plasma)"/>`;
  const g = (inner) => `<g class="plasma" data-plasma=""${RET_ONLY} style="display:none">${inner}</g>`;
  return front ? [g(back), g(shock)] : [g(back + shock), ""];
}
// a square of ocean with its surface at z, and splash rings around the axis
export function seaSvg(z, half = 300, thick = 30) {
  const plate = { x: -half, y: -half, w: 2 * half, d: 2 * half, r: 3 };
  let s = S(k.slabOf(plate, z - thick, thick, P, 3, 0.8));
  for (let i = 1; i < 9; i++) { const y = -half + (2 * half * i) / 9; s += L(poly3([[-half + 8, y, z + 0.1], [half - 8, y + 6, z + 0.1]], false), "faint"); }
  return s;
}
export function ripplesSvg(z, r) {
  let s = "";
  for (let i = 0; i < 3; i++) {
    const ring = Array.from({ length: 49 }, (_, j) => { const a = (j / 48) * TAU; return [Math.cos(a) * r, Math.sin(a) * r, z + 0.2]; });
    s += `<path class="ripple" style="animation-delay:${(-i * 0.8).toFixed(1)}s" d="${poly3(ring, false)}"/>`;
  }
  return `<g data-splash=""${RET_ONLY} style="display:none">${s}</g>`;
}

// ---------------------------------------------------------------- name tags with leaders (zone 90)
export function labels(list, X = { L: -250, R: 250 }) {
  const placed = { L: [], R: [] };
  for (const [id, anchor, side, text, asm] of list) placed[side].push({ id, anchor, text, asm, y: at(anchor)[1] });
  for (const side of ["L", "R"]) {
    const rows = placed[side].sort((a, b) => a.y - b.y);
    for (let i = 1; i < rows.length; i++) if (rows[i].y - rows[i - 1].y < 13) rows[i].y = rows[i - 1].y + 13;
    for (const l of rows) {
      const A = at(l.anchor);
      const x = X[side];
      const elbow = side === "L" ? x + 12 : x - 12;
      const d = `M${r1(A[0])} ${r1(A[1])}L${r1(elbow)} ${r1(l.y)}L${r1(side === "L" ? x + 3 : x - 3)} ${r1(l.y)}`;
      const svg = `<g class="lbl"><path class="lbl-line" d="${d}"/><circle class="lbl-dot" cx="${r1(A[0])}" cy="${r1(A[1])}" r="1.3"/><text class="lbl-text" x="${x}" y="${r1(l.y + 2.6)}" text-anchor="${side === "L" ? "end" : "start"}">${l.text}</text></g>`;
      put(90, l.id, "none", svg, { asm: l.asm });
    }
  }
}

// ---------------------------------------------------------------- launch towers: square steel trusses with decks and access arms
export function member(a, b, w = 2.2, cls = "tw") {
  const d = poly3([a, b], false);
  return `<path class="${cls}-o" d="${d}" stroke-width="${w + 1}"/><path class="${cls}-i" d="${d}" stroke-width="${w}"/>`;
}
// T = { x0, x1, y0, y1, top, bay, deckEvery, col } ; back = true draws only the far faces, false only the near faces
export function trussFaces(T, back) {
  const { x0, x1, y0, y1, top } = T;
  const bay = T.bay || 54;
  const levels = [];
  for (let z = T.base || 0; z <= top; z += bay) levels.push(z);
  if (levels[levels.length - 1] !== top) levels.push(top);
  const C = { a: [x0, y0], b: [x1, y0], c: [x1, y1], d: [x0, y1] };
  const col = T.col || 8;
  const face = (p, q, far) => {
    let s = "";
    for (let i = 0; i < levels.length - 1; i++) {
      const z0 = levels[i], z1 = levels[i + 1];
      s += member([...p, z1], [...q, z1], far ? 1.6 : 2.2, far ? "twb" : "tw");
      s += member([...p, z0], [...q, z1], far ? 1.1 : 1.5, far ? "twb" : "tw");
      s += member([...q, z0], [...p, z1], far ? 1.1 : 1.5, far ? "twb" : "tw");
    }
    return s;
  };
  const colAt = (x, y) => S(k.slabOf({ x: x - col / 2, y: y - col / 2, w: col, d: col, r: 0.5 }, T.base || 0, top - (T.base || 0), P, 2), { crease: "none" });
  let s = "";
  if (back) {
    s += `<path class="iso-halo" d="${k.haloOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 2 }, T.base || 0, 4, P)}"/>`;
    s += face(C.a, C.b, true) + face(C.a, C.d, true);
    s += colAt(x0, y0);
    for (let i = T.deckEvery || 4; i < levels.length; i += T.deckEvery || 4) s += S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.5 }, levels[i] - 1.5, 1.5, P, 2), { crease: "none" });
    if (T.core) {
      const c = T.core;
      s += S(k.slabOf(c, T.base || 0, top - 30 - (T.base || 0), P, 2, 0.3), { crease: "faint" });
      for (let z = (T.base || 0) + 30; z < top - 40; z += bay) s += L(k.sideSeam(c, z, P, 2), "faint");
    }
    s += colAt(x1, y0) + colAt(x0, y1);
  } else {
    s += face(C.b, C.c, false) + face(C.d, C.c, false);
    s += colAt(x1, y1);
  }
  return s;
}
// an arm from the tower's near face (y = from) toward the rocket (y = to), centred on x
export function accessArm(x, from, to, z, w, h) {
  const plan = { x: x - w / 2, y: from, w, d: to - from, r: 0.4 };
  let s = S(k.slabOf(plan, z, h, P, 2, 0.3), { crease: "faint" });
  for (let y = from + 6; y < to - 4; y += 7) s += member([x + w / 2, y, z + 0.6], [x + w / 2, Math.min(y + 7, to - 2), z + h - 0.6], 0.5, "twl");
  s += L(poly3([[x + w / 2, from, z + h / 2], [x + w / 2, to, z + h / 2]], false), "faint");
  s += S(k.slabOf({ x: x - w / 2 - 1, y: to - 2.5, w: w + 2, d: 2.5, r: 0.4 }, z - 1, h + 2, P, 2), { crease: "none" });
  return s;
}
// specular sheen: a soft vertical highlight where the light reflects toward the viewer on a round body
const SHEEN_A = (() => {
  const Lt = G.lightOf(P), H = G.unit3(G.add3(Lt, V));
  let best = 0, bv = -9;
  for (let i = 0; i < 720; i++) { const a = (i / 720) * TAU, r = G.radialOf(FZ(0, 0), a), d = r[0] * H[0] + r[1] * H[1]; if (d > bv) { bv = d; best = a; } }
  return best;
})();
export function sheen(F, z0, z1, r, { slope = 0, strength = 0.22, width = 0.16, cls = "sheen" } = {}) {
  let out = "";
  const n = 9;
  for (let i = -n; i <= n; i++) {
    const a = SHEEN_A + (i / n) * width * 2, b = SHEEN_A + ((i + 1) / n) * width * 2;
    const u = (i + 0.5) / n;
    const op = strength * Math.exp(-u * u * 2.6);
    if (op < 0.01 || facing(F, (a + b) / 2, slope) < 0.05) continue;
    const ra = (z) => r + slope * (z - z0);
    out += `<path class="${cls}" opacity="${op.toFixed(3)}" d="${surfQuad(F, z0, z1, ra(z0) + 0.03, ra(z1) + 0.03, a, b + 0.001, 2)}"/>`;
  }
  return out;
}
// soft contact shadow on a floor at height z: concentric ellipses fading out
export function contactShadow(x, y, z, r, strength = 0.32) {
  let s = "";
  for (let i = 6; i >= 1; i--) {
    const rr = r * (0.9 + i * 0.12);
    const pts = [];
    for (let j = 0; j < 48; j++) { const a = (j / 48) * TAU; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr, z + 0.05]); }
    s += `<path class="cshadow" opacity="${((strength / 6) * (1.2 - i * 0.12)).toFixed(3)}" d="${poly3(pts)}"/>`;
  }
  return s;
}
// a smooth lathe solid from a profile [[z, r, smooth?], ...] in frame F
export const lathe = (F, prof, o = {}) => S(G.solidOf(prof, F, P, { smooth: prof.some((p) => p[2]) }), o);
// sample an analytic radius function into a smooth lathe profile
export const profileOf = (z0, z1, rf, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const z = z0 + ((z1 - z0) * i) / n; return [z, Math.max(0, rf(z)), 1]; });

export const VEHICLES = [
  ["sls", "SLS"],
  ["starship", "Starship"],
  ["falcon9", "Falcon 9"],
  ["saturnv", "Saturn V"],
];

const CSS = `
html,body{height:100%;overflow:hidden}
.app{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px;align-items:stretch}
.app>div:first-child{display:flex;flex-direction:column;min-height:0}
.iso-figure{flex:1;min-height:0;display:flex;flex-direction:column;margin:0!important}
.iso-plate{flex:1;min-height:0;display:flex;flex-direction:column}
.iso-legend{display:none!important}
@media (max-width:560px){.iso-plate-corner[data-corner="hint"]{display:none}}
@media (max-width:980px){.app{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) 34vh;gap:10px}.side{height:auto}.head p{display:none}.tb kbd{display:none}}
.iso-page{width:min(1280px,100% - 24px)!important;height:100vh;height:100dvh;margin:0 auto!important;padding:14px 0;display:flex;flex-direction:column;box-sizing:border-box}
.head{flex:none;display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 20px;margin:0 0 10px}
.head h1{margin:0;font-size:18px;font-weight:600;color:var(--anatomy-strong);letter-spacing:.01em}
.head p{margin:0;color:var(--anatomy-muted);font-size:13px}
.toolbar{flex:none;display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}
.tb{font:500 12px/1 var(--anatomy-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--anatomy-text);background:var(--anatomy-card);border:1px solid var(--anatomy-lo);padding:8px 11px;border-radius:7px;cursor:pointer}
.tb:hover{border-color:var(--anatomy-mid);color:var(--anatomy-strong)}
.tb[aria-pressed="true"]{background:var(--anatomy-strong);color:var(--anatomy-card);border-color:var(--anatomy-strong)}
.tb:focus-visible,.row:focus-visible,.stage:focus-visible{outline:2px solid #ff8a3d;outline-offset:2px}
.tb.sep{margin-left:auto}
.iso-plate{padding:34px 10px 34px!important}
.stage{position:relative;flex:1;min-height:0;touch-action:none;cursor:grab;border-radius:4px}
.stage.drag{cursor:grabbing}
.stage{overflow:hidden}.stage .rk-svg{width:100%;height:100%;display:block;overflow:hidden}
.side{min-height:0;height:100%;overflow:auto;overscroll-behavior:contain;padding:4px 4px 4px 0}
.info{background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-lo);border-radius:8px;padding:14px 16px;margin:0 0 14px;min-height:118px}
.info h2{margin:0 0 2px;font-size:15px;color:var(--anatomy-strong);font-weight:600}
.info .spec{font:12px/1.5 var(--anatomy-mono);color:#ff8a3d;margin:0 0 8px}
.info p{margin:0;font-size:13px;line-height:1.55}
.grp h3{margin:14px 0 4px;font:600 11px/1.4 var(--anatomy-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--anatomy-muted)}
.grp ul{list-style:none;margin:0;padding:0}
.row{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;background:none;border:0;border-radius:6px;padding:5px 8px;color:var(--anatomy-text);cursor:pointer;font:inherit}
.row:hover,.row[data-on]{background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-lo)}
.row[data-on]{box-shadow:0 0 0 1px #ff8a3d}
.row-name{font-size:13px;color:var(--anatomy-strong);line-height:1.35}
.row-spec{font:11px/1.4 var(--anatomy-mono);color:var(--anatomy-muted)}
.cut-tag{font-style:normal;font:10px var(--anatomy-mono);color:#ff8a3d;margin-left:4px;letter-spacing:.06em}
.pop{position:absolute;z-index:5;width:min(300px,calc(100% - 16px));background:var(--anatomy-card);box-shadow:0 0 0 1px #ff8a3d,0 12px 32px -8px #000a;border-radius:10px;padding:14px 16px;cursor:auto;animation:pop-in .18s var(--anatomy-ease)}
.pop[hidden]{display:none}
.pop{max-height:calc(100% - 16px);overflow:auto}
.pop-photo{margin:-14px -16px 12px;position:relative;border-radius:10px 10px 0 0;overflow:hidden;background:var(--anatomy-page)}
.pop-photo[hidden]{display:none}
.pop-photo img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;opacity:0;transition:opacity .25s}
.pop-photo.ok img{opacity:1}
.pop-photo:not(.ok) a{display:block;aspect-ratio:16/10;background:linear-gradient(100deg,transparent 30%,#ffffff0d 50%,transparent 70%) 0 0/200% 100%;animation:shimmer 1.2s linear infinite}
.pop-photo.ok a{animation:none;background:none}
.pop-photo.bad{display:none}
@keyframes shimmer{to{background-position:-200% 0}}
.pop-photo figcaption{font:10.5px/1.4 var(--anatomy-mono);color:var(--anatomy-muted);padding:6px 16px 0}
.pop-photo figcaption a{color:var(--anatomy-text)}
.pop-x{z-index:2;background:#000a!important;border-radius:50%;width:26px;height:26px;padding:0!important;color:#fff!important}
@keyframes pop-in{from{opacity:0;transform:translateY(4px) scale(.98)}to{opacity:1;transform:none}}
.pop-x{position:absolute;top:6px;right:8px;background:none;border:0;color:var(--anatomy-muted);font-size:20px;line-height:1;cursor:pointer;padding:4px}
.pop-x:hover{color:var(--anatomy-strong)}
.pop-group{font:600 10px/1.4 var(--anatomy-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--anatomy-muted);margin:0 22px 4px 0}
.pop-name{margin:0 22px 2px 0;font-size:16px;font-weight:600;color:var(--anatomy-strong);line-height:1.3}
.pop-spec{font:12px/1.5 var(--anatomy-mono);color:#ff8a3d;margin:0 0 8px}
.pop-spec:empty,.pop-note:empty{display:none}
.pop-info{margin:0;font-size:13px;line-height:1.55;color:var(--anatomy-text)}
.pop-note{font:11px/1.4 var(--anatomy-mono);color:#ff8a3d;margin-top:8px}
@media (prefers-reduced-motion:reduce){.pop{animation:none}}

/* flight */
.tb-launch{color:#ffb070;border-color:#7a4a22}
.tb-launch[aria-pressed="true"]{background:#ff8a3d;border-color:#ff8a3d;color:#1a0d02}
.stage{background:var(--anatomy-card)}
.stage[data-flight]{background:var(--sky,#5b88c2);transition:none}
.stage::before,.stage::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:0}
.stage[data-flight]::before{opacity:var(--stars,0);background-image:radial-gradient(1px 1px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 37% 72%,#fff,transparent),radial-gradient(1.2px 1.2px at 64% 33%,#fff,transparent),radial-gradient(1px 1px at 82% 61%,#fff,transparent),radial-gradient(1px 1px at 22% 88%,#dfe8ff,transparent),radial-gradient(1px 1px at 55% 9%,#fff,transparent),radial-gradient(1.3px 1.3px at 91% 14%,#fff,transparent),radial-gradient(1px 1px at 7% 52%,#fff,transparent),radial-gradient(1px 1px at 47% 47%,#cfdcff,transparent),radial-gradient(1px 1px at 73% 86%,#fff,transparent);background-size:340px 340px}
.stage[data-flight]::after{opacity:var(--streak,0);background-image:repeating-linear-gradient(90deg,transparent 0 37px,#ffffff14 37px 38px,transparent 38px 91px),linear-gradient(transparent,transparent);background-size:91px 260px;background-position:0 var(--streak-y,0);-webkit-mask-image:repeating-linear-gradient(transparent 0 30px,#000 30px 140px,transparent 140px 260px);mask-image:repeating-linear-gradient(transparent 0 30px,#000 30px 140px,transparent 140px 260px);mask-position:0 var(--streak-y,0);-webkit-mask-position:0 var(--streak-y,0)}
.stage[data-flight] .m-none{display:none}
.plume{mix-blend-mode:screen}
.plume .smokeg{mix-blend-mode:normal}
.pl-flick{animation:flick .07s steps(2) infinite alternate;transform-box:fill-box;transform-origin:50% 0}
.pl-flick2{animation:flick2 .05s steps(2) infinite alternate;transform-box:fill-box;transform-origin:50% 0}
@keyframes flick{from{transform:scale(.985,.96)}to{transform:scale(1.02,1.05)}}
@keyframes flick2{from{opacity:.85;transform:scaleY(.95)}to{opacity:1;transform:scaleY(1.04)}}
.diamond{fill:#fff4f2}
.hud{position:absolute;left:12px;top:10px;z-index:3;pointer-events:none;font:12px/1.35 var(--anatomy-mono);color:#eef3ff;text-shadow:0 1px 2px #0009}
.hud[hidden]{display:none}
.hud-met{font:600 22px/1.1 var(--anatomy-mono);letter-spacing:.04em;font-variant-numeric:tabular-nums}
.hud-tel{display:flex;gap:14px;margin-top:4px;font-variant-numeric:tabular-nums}
.hud-tel b{font-weight:600;color:#fff}
.hud-warp{color:#ffd29a}
.hud-ev{margin-top:8px;font:600 13px/1.3 ui-sans-serif,system-ui,sans-serif;color:#fff;background:#0008;border-left:2px solid #ff8a3d;padding:4px 8px;display:inline-block;border-radius:0 4px 4px 0}
.hud-ev:empty{display:none}
.hud-ev.pulse{animation:evin .4s var(--anatomy-ease)}
@keyframes evin{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
.fbar{flex:none;display:flex;align-items:center;gap:10px;margin-top:8px}
.fbar[hidden]{display:none}
.fbar-track{position:relative;flex:1;min-width:80px}
.fbar input{width:100%;accent-color:#ff8a3d;margin:0;display:block}
.fbar-ticks{position:absolute;left:0;right:0;top:-6px;height:4px;pointer-events:none}
.fbar-ticks i{position:absolute;top:0;width:2px;height:5px;margin-left:-1px;background:#ff8a3d;border-radius:1px}
.fbar-t{font:12px var(--anatomy-mono);color:var(--anatomy-text);font-variant-numeric:tabular-nums;min-width:92px}
/* coming home */
.stage:not([data-ret]) [data-retonly]{display:none!important}
.m-sea{--anatomy-paper:#1d5a8c;--anatomy-shade-0:#0c2e4d;--anatomy-shade-1:#123d63;--anatomy-shade-2:#1a4f7c;--anatomy-shade-3:#226396;--anatomy-top:#2f78ad;--edge:#06182a;--seam:#5fa3d6}
.plasma{mix-blend-mode:screen;animation:plz .09s steps(2) infinite alternate}
@keyframes plz{from{filter:brightness(.92)}to{filter:brightness(1.12)}}
.ripple{fill:none;stroke:#cfe8ff;stroke-width:.9;vector-effect:non-scaling-stroke;transform-box:fill-box;transform-origin:center;animation:rip 2.4s linear infinite}
@keyframes rip{from{transform:scale(.4);opacity:.9}to{transform:scale(2.2);opacity:0}}
/* WebGL launch effects */
.fx-gl{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;display:none}
.stage[data-flight][data-gl] .fx-gl{display:block}
.stage[data-gl] .plume,.stage[data-gl] .steam{display:none!important}
.fx-flash{position:absolute;inset:0;pointer-events:none;z-index:2;opacity:0;background:radial-gradient(circle closest-side at 50% 80%,#fff6dc,#ffd59a80 45%,transparent);mix-blend-mode:screen}
/* propellant flow */
.flow{fill:none;stroke-width:1.5;stroke-linecap:round;stroke-dasharray:2.5 5.5;vector-effect:non-scaling-stroke;animation:flowmv .45s linear infinite}
.flow.lox{stroke:#9fd0ff}
.flow.lh2{stroke:#eaf8ff}
.flow.gas{stroke:#ffcf9a;stroke-width:1;animation-duration:.3s}
@keyframes flowmv{to{stroke-dashoffset:-8}}
.flow-ext{display:none}
.stage[data-flow] .flow-ext{display:inline}
@media (prefers-reduced-motion:reduce){.flow,.pl-flick,.pl-flick2{animation:none}}

.zoomnote{font:11px var(--anatomy-mono);color:var(--anatomy-muted);margin:8px 0 0}
/* materials: four shade tones dark→light and a top tone */
.pt{transition:opacity .25s}
.pt .iso-edge{stroke:var(--edge,var(--anatomy-hi))}
.pt .iso-line[data-tone="faint"]{stroke:var(--seam,var(--anatomy-faint))}
.pt .iso-line[data-tone="lo"]{stroke:var(--seam2,var(--anatomy-lo))}
.pt .iso-line[data-tone="mid"]{stroke:var(--seam3,var(--anatomy-mid))}
.pt .iso-dots circle{fill:var(--dot,var(--anatomy-dot))}
.pt .tb-body{fill:var(--anatomy-shade-2)}
.pt .tb-shine{fill:var(--anatomy-top)}
.pt .tb-shade{fill:var(--anatomy-shade-0)}
.pt .tb .iso-line,.pt .tb path[class*="edge"]{stroke:var(--edge)}
.m-orange{--anatomy-paper:#a0501c;--anatomy-shade-0:#6a300e;--anatomy-shade-1:#86401a;--anatomy-shade-2:#a3511f;--anatomy-shade-3:#bd6226;--anatomy-top:#d4762f;--edge:#3a1806;--seam:#8a3f14;--seam2:#6e3010;--seam3:#c98a55;--dot:#3a1806}
.m-orange2{--anatomy-paper:#b06024;--anatomy-shade-0:#7a3812;--anatomy-shade-1:#9a4a1a;--anatomy-shade-2:#b85e24;--anatomy-shade-3:#cf712d;--anatomy-top:#e2873a;--edge:#3a1806;--seam:#8a3f14;--seam2:#6e3010;--dot:#3a1806}
.m-tan{--anatomy-paper:#c08a42;--anatomy-shade-0:#80592a;--anatomy-shade-1:#9c6f35;--anatomy-shade-2:#b9853f;--anatomy-shade-3:#d29a4b;--anatomy-top:#e3ad5d;--edge:#4a3210;--seam:#9c6f35}
.m-white{--anatomy-paper:#c9ccd0;--anatomy-shade-0:#8a8e94;--anatomy-shade-1:#a7abb0;--anatomy-shade-2:#c2c5c9;--anatomy-shade-3:#d9dbde;--anatomy-top:#eeefef;--edge:#2e3238;--seam:#a3a7ad;--seam2:#7c8188;--seam3:#565b62;--dot:#3b4048}
.m-pale{--anatomy-paper:#c9c2b4;--anatomy-shade-0:#8c8577;--anatomy-shade-1:#a8a092;--anatomy-shade-2:#c1baab;--anatomy-shade-3:#d6cfc1;--anatomy-top:#e7e1d4;--edge:#2f2b24;--seam:#a39b8c;--seam2:#7d7668;--dot:#3b362e}
.m-silver{--anatomy-paper:#a5abb1;--anatomy-shade-0:#666c73;--anatomy-shade-1:#858b92;--anatomy-shade-2:#a3a9af;--anatomy-shade-3:#c2c8cd;--anatomy-top:#dde2e6;--edge:#22262b;--seam:#868c93;--seam2:#61676e;--dot:#2c3036}
.m-steel{--anatomy-paper:#5d6268;--anatomy-shade-0:#33373b;--anatomy-shade-1:#42464b;--anatomy-shade-2:#52575c;--anatomy-shade-3:#646a70;--anatomy-top:#7a8086;--edge:#16181a;--seam:#4a4e53;--seam2:#3a3d41;--dot:#1c1e20}
.m-engine{--anatomy-paper:#5a5550;--anatomy-shade-0:#2f2c29;--anatomy-shade-1:#413d39;--anatomy-shade-2:#55504a;--anatomy-shade-3:#6c665e;--anatomy-top:#867f75;--edge:#121110;--seam:#6f6960;--seam2:#2a2724;--seam3:#9a9184;--dot:#1a1816}
.m-nozzle{--anatomy-paper:#4a4a4c;--anatomy-shade-0:#262628;--anatomy-shade-1:#333336;--anatomy-shade-2:#424245;--anatomy-shade-3:#535357;--anatomy-top:#68686c;--edge:#0e0e10;--seam:#5b5b60;--seam2:#1c1c1f}
.m-carbon{--anatomy-paper:#3a3a3d;--anatomy-shade-0:#1d1d1f;--anatomy-shade-1:#28282b;--anatomy-shade-2:#333336;--anatomy-shade-3:#414145;--anatomy-top:#55555a;--edge:#0b0b0c;--seam:#4a4a4f;--seam2:#151517}
.m-avcoat{--anatomy-paper:#4a3c31;--anatomy-shade-0:#261e18;--anatomy-shade-1:#33291f;--anatomy-shade-2:#433528;--anatomy-shade-3:#564434;--anatomy-top:#6b5643;--edge:#120d09;--seam2:#2a2018}
.m-solar{--anatomy-paper:#1c2b4a;--anatomy-shade-0:#0f1729;--anatomy-shade-1:#152139;--anatomy-shade-2:#1b2a48;--anatomy-shade-3:#223458;--anatomy-top:#2c426e;--edge:#080c16;--seam:#3a5280;--seam2:#4b5f86}
.m-red{--anatomy-paper:#a52222;--anatomy-shade-0:#6a1212;--anatomy-shade-1:#851919;--anatomy-shade-2:#a02020;--anatomy-shade-3:#b92828;--anatomy-top:#d13636;--edge:#2a0606}
.m-chute{--anatomy-paper:#d0782e;--anatomy-shade-0:#8a4614;--anatomy-shade-1:#a8581c;--anatomy-shade-2:#c46a26;--anatomy-shade-3:#da7f33;--anatomy-top:#eb9649;--edge:#3a1806}
.m-steel .iso-shade,.m-steel .iso-top{}
.ck{fill:#141414;stroke:none}
.tw-o,.twb-o,.twl-o{fill:none;stroke-linecap:round}
.tw-i,.twb-i,.twl-i{fill:none;stroke-linecap:round}
.tw-o{stroke:#1f2225}.tw-i{stroke:#7b8187}
.twb-o{stroke:#17191b}.twb-i{stroke:#4c5157}
.twl-o{stroke:none}.twl-i{stroke:#5a5f65}
body[data-theme="light"] .tw-i{stroke:#8e949a}
.white-sq{fill:#f2f0ea}
.shoe{fill:#6c7076}
.port{fill:#1a1a1c;stroke:none}
.port-dot{fill:#3a3e44}
.ring-black{fill:#151515}
.window{fill:#16202c;stroke:#0b0f14;stroke-width:.4}
.cm-copper{fill:#9a5a2c}
.cm-blue{fill:#2d5aa8}
.worm{fill:none;stroke:#d8272e;stroke-linecap:round;stroke-linejoin:round}
.a250{font:900 7px Helvetica,Arial,sans-serif;fill:#c8202a;stroke:#1f3a7a;stroke-width:.35;paint-order:stroke}
.a250-small{font:700 2px Helvetica,Arial,sans-serif;fill:#1f3a7a;letter-spacing:.08em}
.mb-blue{fill:#0b3d91}.mb-orbit{fill:none;stroke:#fff;stroke-width:.35}.mb-red{fill:#fc3d21}.mb-text{font:900 3px Helvetica,Arial,sans-serif;fill:#fff;letter-spacing:.02em}.mb-star{fill:#fff}
.esa-dot{fill:#003247}.esa-hole{fill:#e9eaec}.esa-text{font:700 3px Helvetica,Arial,sans-serif;fill:#003247}
.fl-white{fill:#f4f4f4}.fl-red{fill:#b22234}.fl-blue{fill:#3c3b6e}
.us-text{font:600 1.7px Helvetica,Arial,sans-serif;fill:#20242a}
.cells{fill:none;stroke:#3d5a95;stroke-width:.35;vector-effect:non-scaling-stroke;opacity:.85}
.hole-void{fill:#060606}
.floor{fill:#8a8478;stroke:#3a362e;stroke-width:.5;vector-effect:non-scaling-stroke}
.boot{fill:#e8e4dc;stroke:#6d675c;stroke-width:.4;vector-effect:non-scaling-stroke}
.hole-wall1{fill:#26292c}.hole-wall2{fill:#1a1c1e}
/* cutaway fills */
.cutf{stroke:none}
.cut-foam{fill:#e08a43}
.cut-metal{fill:#b9bfc6}
.cut-pale{fill:#ddd6c8}
.cut-white{fill:#eceeef}
.cut-silver{fill:#cdd2d6}
.cut-avcoat{fill:url(#hatch2)}
.hatch2-bg{fill:#4a3c31}.hatch2-line{stroke:#6d5948;stroke-width:.8}
.pt .iso-shade.inn[data-shade="0"]{fill:var(--in0);stroke:var(--in0)}
.pt .iso-shade.inn[data-shade="1"]{fill:var(--in1);stroke:var(--in1)}
.pt .iso-shade.inn[data-shade="2"]{fill:var(--in2);stroke:var(--in2)}
.pt .iso-shade.inn[data-shade="3"]{fill:var(--in3);stroke:var(--in3)}
.pt .iso-top.inn{fill:var(--in4);stroke:var(--in4)}
.pt{--in0:#3c4146;--in1:#4c5258;--in2:#5e656b;--in3:#737a81;--in4:#8a9197}
.m-white{--in0:#55595e;--in1:#666b70;--in2:#7a7f84;--in3:#8f9499;--in4:#a5aaae}
.m-silver{--in0:#5a6066;--in1:#6b7279;--in2:#80878d;--in3:#969da3;--in4:#adb3b8}
.grain{fill:url(#hatch)}
.hatch-bg{fill:#5f5750}.hatch-line{stroke:#776d64;stroke-width:.6}
.grain.hit,.hit{fill:transparent;stroke:none}
.inhib{fill:#2a2522}
.insul{fill:#2b2b2b}
.casecut{fill:#c3c7cc}
.m-bore{--in0:#2c2622;--in1:#3a332d;--in2:#4a423a;--in3:#5c5248;--in4:#6c6157;--anatomy-shade-0:#2c2622;--anatomy-shade-1:#3a332d;--anatomy-shade-2:#4a423a;--anatomy-shade-3:#5c5248;--anatomy-top:#6c6157;--edge:#1a1614}
.liq-lox{fill:#7fb3f0;opacity:.42}
.liq-lh2{fill:#d4ecff;opacity:.26}
.liq-top{opacity:.55}
.baffle{stroke-width:1.2!important;stroke:#8d959c!important}
.pt[data-view="cut"] .iso-shade.inn[data-shade]{filter:none}
/* labels */
.lbl-line{fill:none;stroke:var(--anatomy-mid);stroke-width:.6;vector-effect:non-scaling-stroke}
.lbl-dot{fill:var(--anatomy-card);stroke:var(--anatomy-hi);stroke-width:.7;vector-effect:non-scaling-stroke}
.lbl-text{font:500 7.4px var(--anatomy-mono);fill:var(--anatomy-text);letter-spacing:.02em}
.stage[data-labels="off"] .m-none{display:none}
/* views */
.stage:not([data-cut]) [data-view="cut"]{display:none}
.stage[data-cut] [data-view="whole"]{display:none}
/* highlight */
.stage[data-hot] .pt:not([data-on]){opacity:.16}
.stage[data-hot] .m-none:not([data-on]){opacity:.08}
.pt[data-on] .iso-edge{stroke:#ff8a3d!important}
.pt[data-on] .lbl-text{fill:var(--anatomy-strong)}
.pt[data-on] .lbl-line{stroke:#ff8a3d}
.pt.m-none{pointer-events:none}
.pt.m-none .lbl-text{pointer-events:auto;cursor:pointer}
.stage .pt{cursor:pointer}
.stage.drag,.stage.drag .pt{cursor:grabbing}
.stage[data-labels="off"] .pt.m-none{display:none}
body[data-theme="light"] .lbl-dot{fill:#fff}
body[data-theme="light"] .hole-void{fill:#2a2c2f}
body[data-theme="light"] .hole-wall1{fill:#55595e}
body[data-theme="light"] .hole-wall2{fill:#474b50}

/* sheen and contact shadows */
.sheen{fill:#fff;pointer-events:none}
.cshadow{fill:#000;pointer-events:none}
body[data-theme="light"] .cshadow{fill:#2a2c30}
/* vehicle switcher, Earth limb */
.head{align-items:center}
.head-l{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 18px}
.veh{display:flex;gap:2px;background:var(--anatomy-card);box-shadow:0 0 0 1px var(--anatomy-lo);border-radius:9px;padding:3px}
.veh a{font:600 12px/1 var(--anatomy-mono);letter-spacing:.04em;color:var(--anatomy-muted);text-decoration:none;padding:7px 11px;border-radius:6px}
.veh a[href]:hover{color:var(--anatomy-strong);background:var(--anatomy-page)}
.veh a[aria-current]{background:#ff8a3d;color:#1a0d02}
.veh a:focus-visible{outline:2px solid #ff8a3d;outline-offset:2px}
@media (max-width:980px){.veh a{padding:6px 8px;font-size:11px}}
.earth{position:absolute;left:50%;top:var(--earth-y,90%);width:var(--earth-r,900vmax);height:var(--earth-r,900vmax);transform:translateX(-50%);border-radius:50%;pointer-events:none;opacity:0;z-index:0;
  background:radial-gradient(circle at 50% 50%,#0b2a52 0,#0f3a6e 48%,#2c6fb3 49.4%,#8cc6ff 49.8%,#d9efff 49.93%,transparent 50%);
  box-shadow:0 0 60px 18px #5aa7ff55}
.stage:not([data-flight]) .earth{display:none}
.stage>svg{position:relative;z-index:0}
`;

// ---------------------------------------------------------------- page
// cfg: { id, title, h1, sub, figTitle, label, stageLabel, caption, infoText, ASM, box(apart) -> world points, xHalf,
//        FLIGHT, FXD, defs, css, mission (JS source), photos (file), wingFrames }
export function buildPage(cfg) {
  items.sort((a, b) => a.key - b.key);
  const body = items
    .map((it) => `<g class="${it.id === "fx" ? "fx" : "pt m-" + it.mat}"${it.id === "fx" ? "" : ` data-part="${it.id}"`} data-asm="${it.asm}"${it.view !== "both" ? ` data-view="${it.view}"` : ""}${it.attrs}>${it.svg}</g>`)
    .join("\n");
  const boxFor = (apart) => {
    const ys = cfg.box(apart).map((p) => at(p)[1]);
    const top = Math.min(...ys) - 40;
    const bottom = Math.max(...ys) + 24;
    return [-cfg.xHalf, top, cfg.xHalf * 2, bottom - top];
  };
  const BOX0 = boxFor(false);
  const BOX1 = boxFor(true);
  const svg = `<svg class="iso-svg rk-svg" viewBox="${BOX0.map(r1).join(" ")}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${cfg.label}">
<defs>
<pattern id="hatch" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.4" height="2.4" class="hatch-bg"/><line x1="0" y1="0" x2="0" y2="2.4" class="hatch-line"/></pattern>
<pattern id="hatch2" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="3" height="3" class="hatch2-bg"/><line x1="0" y1="0" x2="0" y2="3" class="hatch2-line"/></pattern>
<linearGradient id="g-rs-o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".12" stop-color="#dcd0ff" stop-opacity=".75"/><stop offset=".45" stop-color="#ffa3b8" stop-opacity=".32"/><stop offset="1" stop-color="#ff7a6a" stop-opacity="0"/></linearGradient>
<linearGradient id="g-rs-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="#ece8ff" stop-opacity=".6"/><stop offset="1" stop-color="#c9b8ff" stop-opacity="0"/></linearGradient>
<linearGradient id="g-srb-o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".1" stop-color="#fff3c4"/><stop offset=".3" stop-color="#ffd36b" stop-opacity=".95"/><stop offset=".55" stop-color="#ff9a3a" stop-opacity=".75"/><stop offset=".8" stop-color="#ff6a2a" stop-opacity=".35"/><stop offset="1" stop-color="#ff5a20" stop-opacity="0"/></linearGradient>
<linearGradient id="g-srb-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#fff8e0" stop-opacity=".9"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></linearGradient>
<linearGradient id="g-smoke" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6e6" stop-opacity="0"/><stop offset=".06" stop-color="#ebe4d8" stop-opacity=".95"/><stop offset=".5" stop-color="#bdb6ac" stop-opacity=".8"/><stop offset="1" stop-color="#8a857e" stop-opacity="0"/></linearGradient>
<linearGradient id="g-rl10" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1ecff" stop-opacity=".9"/><stop offset=".3" stop-color="#b9a8ff" stop-opacity=".45"/><stop offset="1" stop-color="#8f7dff" stop-opacity="0"/></linearGradient>
<linearGradient id="g-las" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".4" stop-color="#ffd27a" stop-opacity=".75"/><stop offset="1" stop-color="#ff8a3a" stop-opacity="0"/></linearGradient>
<linearGradient id="g-ker" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".15" stop-color="#ffe7a8"/><stop offset=".45" stop-color="#ffab45" stop-opacity=".8"/><stop offset="1" stop-color="#ff6a1e" stop-opacity="0"/></linearGradient>
<radialGradient id="g-plasma"><stop offset="0" stop-color="#fff8e8"/><stop offset=".35" stop-color="#ffd27a" stop-opacity=".95"/><stop offset=".7" stop-color="#ff7a2a" stop-opacity=".55"/><stop offset="1" stop-color="#ff4a1a" stop-opacity="0"/></radialGradient>
<linearGradient id="g-wake" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".9"/><stop offset=".3" stop-color="#ff8a3a" stop-opacity=".55"/><stop offset="1" stop-color="#ff5a20" stop-opacity="0"/></linearGradient>
<radialGradient id="g-steam"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".6" stop-color="#ebe8e3" stop-opacity=".75"/><stop offset="1" stop-color="#d9d6d0" stop-opacity="0"/></radialGradient>
${cfg.defs || ""}
</defs>
${body}
</svg>`;

  const groupsHtml = GROUPS.map(([g, title]) => {
    const rows = Object.values(PARTS)
      .filter((p) => p.group === g)
      .map((p) => `<li><button type="button" class="row" data-row="${p.id}"><span class="row-name">${p.name}${p.cut ? ' <em class="cut-tag">cutaway</em>' : ""}</span><span class="row-spec">${p.spec}</span></button></li>`)
      .join("");
    return `<section class="grp"><h3>${title}</h3><ul>${rows}</ul></section>`;
  }).join("");
  const suffix = theme === "light" ? "-light" : "";
  const nav = `<nav class="veh" aria-label="Vehicle">${VEHICLES.map(([id, name]) => (id === cfg.id ? `<a aria-current="page">${name}</a>` : `<a href="${id}${suffix}.html">${name}</a>`)).join("")}</nav>`;
  const page = `
<div class="head"><div class="head-l"><h1>${cfg.h1}</h1><p>${cfg.sub}</p></div>${nav}</div>
<div class="app">
  <div>
    <div class="toolbar" role="toolbar" aria-label="View">
      <button class="tb tb-launch" data-act="launch" aria-pressed="false">Launch <kbd>Space</kbd></button>
      <button class="tb" data-act="explode" aria-pressed="false">Explode <kbd>E</kbd></button>
      <button class="tb" data-act="cut" aria-pressed="false">Cutaway <kbd>C</kbd></button>
      <button class="tb" data-act="labels" aria-pressed="true">Name tags <kbd>L</kbd></button>
      <button class="tb sep" data-act="zin" aria-label="Zoom in">＋</button>
      <button class="tb" data-act="zout" aria-label="Zoom out">－</button>
      <button class="tb" data-act="reset">Fit</button>
    </div>
    ${k.plateHtml({
      fig: cfg.fig || "Fig 1",
      title: cfg.figTitle,
      hint: "Hover a part · scroll to zoom · drag to pan",
      readout: "",
      body: `<div class="stage" tabindex="0" data-labels="on" aria-label="${cfg.stageLabel}"><div class="earth" aria-hidden="true"></div>${svg}<canvas class="fx-gl" aria-hidden="true"></canvas><div class="fx-flash" aria-hidden="true"></div><div class="mmap" hidden title="Mission map"><canvas aria-hidden="true"></canvas></div><div class="hud" hidden><div class="hud-met" data-met>T−00:00:10</div><div class="hud-tel"><span>ALT <b data-alt>0</b> km<i data-ref></i></span><span>SPEED <b data-vel>0</b> km/h</span><span class="hud-warp" data-warp></span></div><div class="hud-ev" data-ev></div></div><div class="pop" role="dialog" aria-live="polite" hidden><button type="button" class="pop-x" aria-label="Close">×</button><figure class="pop-photo"><a target="_blank" rel="noopener"><img alt="" referrerpolicy="no-referrer"></a><figcaption></figcaption></figure><div class="pop-group"></div><h2 class="pop-name"></h2><div class="pop-spec"></div><p class="pop-info"></p><div class="pop-note"></div></div></div><div class="fbar" hidden><button type="button" class="tb" data-fl="play" aria-label="Pause">❚❚</button><div class="fbar-track"><div class="fbar-ticks"></div><input type="range" min="0" max="1000" value="0" step="1" aria-label="Mission timeline"></div><span class="fbar-t">T−00:00:10</span><button type="button" class="tb" data-fl="exit">Back to pad</button></div>`,
      keys: [],
      caption: cfg.caption,
    })}
  </div>
  <aside class="side">
    <div class="info" aria-live="polite"><h2 data-i="name">Hover or tap any part</h2><div class="spec" data-i="spec">${Object.keys(PARTS).length} labelled parts</div><p data-i="info">${cfg.infoText}</p></div>
    ${groupsHtml}
  </aside>
</div>`;

  let PHOTOS = {};
  try { PHOTOS = JSON.parse(readFileSync(join(HERE, cfg.photos || "photos.json"), "utf8")); } catch {}
  for (const id of Object.keys(PHOTOS)) if (!PARTS[id]) delete PHOTOS[id];
  const live = `
const P = ${JSON.stringify(P)};
const ASM = ${JSON.stringify(cfg.ASM)};
const PARTS = ${JSON.stringify(Object.fromEntries(Object.values(PARTS).map((p) => [p.id, { name: p.name, group: p.group, spec: p.spec, info: p.info, cut: p.cut }])))};
const PHOTOS = ${JSON.stringify(PHOTOS)};
const FLIGHT = ${JSON.stringify(cfg.FLIGHT)};
const FXD = ${JSON.stringify({ ...cfg.FXD, camera: FX_CAMERA })};
const BOX0 = ${JSON.stringify(BOX0)}, BOX1 = ${JSON.stringify(BOX1)};
const FRAMES = ${cfg.wingFrames || 1};
const GROUP_NAMES = ${JSON.stringify(Object.fromEntries(GROUPS))};
${LIVE}
`;
  const out = cfg.id + (theme === "light" ? "-light.html" : ".html");
  const html = k
    .pageHtml({ title: cfg.title, theme, body: page, script: kitScript() + glScript() + `const FX_FRAGMENT = ${JSON.stringify(FX_FRAGMENT)};` + FX_RUNTIME + live.replace("/*@MISSION@*/", () => MAP_RUNTIME + LAND_RUNTIME + cfg.mission), width: 1280 })
    .replace("</style>", () => CSS + MAP_CSS + LAND_CSS + (cfg.css || "") + "</style>");
  writeFileSync(join(HERE, out), html);
  console.log("wrote", out, (html.length / 1024).toFixed(0) + " KB,", items.length, "items,", Object.keys(PARTS).length, "parts");
}

// ---------------------------------------------------------------- browser runtime (generic)
const LIVE = String.raw`
const stage = document.querySelector(".stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const byAsm = {};
svg.querySelectorAll("[data-asm]").forEach((el) => (byAsm[el.dataset.asm] ??= []).push(el));
const byPart = {};
svg.querySelectorAll("[data-part]").forEach((el) => (byPart[el.dataset.part] ??= []).push(el));
const rows = {};
document.querySelectorAll("[data-row]").forEach((el) => (rows[el.dataset.row] = el));
const wingGroups = [...svg.querySelectorAll("[data-wings]")];
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
let e = 0, target = 0, frame = 0, last = 0;
function shareOf(name, t) {
  const d = ASM[name].delay;
  return ease((t - d) / (1 - 0.45));
}
let lastWing = -1;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
function setWing(f) {
  if (f === lastWing || FRAMES < 2) return;
  for (const g of wingGroups) g.querySelectorAll("[data-frame]").forEach((el) => (el.style.display = Number(el.dataset.frame) === f ? "" : "none"));
  lastWing = f;
}
function draw() {
  const fs = flight ? stateAt(missionT) : null;
  for (const name in byAsm) {
    let v = [0, 0, 0], rot = 0, piv = null, hide = false;
    if (fs) {
      const o = fs.asm[name];
      if (o) { v = o.v; rot = o.rot || 0; piv = o.piv; hide = !!o.hide; }
    } else if (ASM[name]) {
      const a = ASM[name], s = shareOf(name, e);
      v = [a.v[0] * s, a.v[1] * s, a.v[2] * s];
    }
    let tr = v[0] || v[1] || v[2] ? translateAlong(P, v) : "";
    if (rot && piv) tr += " rotate(" + rot.toFixed(2) + " " + piv[0] + " " + piv[1] + ")";
    const disp = hide ? "none" : "";
    for (const el of byAsm[name]) {
      if (el.getAttribute("transform") !== tr) tr ? el.setAttribute("transform", tr) : el.removeAttribute("transform");
      if (el.style.display !== disp) el.style.display = disp;
    }
  }
  const w = fs ? fs.wing || 0 : ASM.wingAsm ? clamp01((shareOf(ASM.wingAsm, e) - 0.55) / 0.45) : clamp01((e - 0.55) / 0.45);
  setWing(Math.round(w * (FRAMES - 1)));
  if (fs) applyFlightFx(fs);
  if (cam.follow && !flight) { [cam.cx, cam.cy] = homeCenter(ease(e)); cam.k = homeK(ease(e)); applyCam(); }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.25) : 1 / 60;
  last = now;
  const speed = 1 / 2.4;
  if (still.matches) e = target;
  else e = target > e ? Math.min(target, e + dt * speed) : Math.max(target, e - dt * speed);
  draw();
  frame = e !== target ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } };
// ---- toggles
const btn = (act) => document.querySelector('[data-act="' + act + '"]');
function setExplode(on) { if (typeof flight !== "undefined" && flight) exitFlight(); if (typeof pop !== "undefined") pop.hidden = true; target = on ? 1 : 0; btn("explode").setAttribute("aria-pressed", on); run(); }
function setCut(on) { on ? stage.setAttribute("data-cut", "") : stage.removeAttribute("data-cut"); btn("cut").setAttribute("aria-pressed", on); if (typeof pop !== "undefined" && !pop.hidden) { if (!on && PARTS[pinned]?.cut) closeCard(); else pop.querySelector(".pop-note").textContent = ""; } }
function setLabels(on) { stage.dataset.labels = on ? "on" : "off"; btn("labels").setAttribute("aria-pressed", on); }
btn("explode").onclick = () => setExplode(target < 0.5);
btn("cut").onclick = () => setCut(!stage.hasAttribute("data-cut"));
btn("labels").onclick = () => setLabels(stage.dataset.labels !== "on");
// ---- camera: fixed scale (px per unit), drag pans, wheel/pinch zoom around the pointer
const cam = { cx: 0, cy: 0, k: 1, follow: true };
let fitK = 1;
const centerOf = (b) => [b[0] + b[2] / 2, b[1] + b[3] / 2];
const homeCenter = (t) => { const a = centerOf(BOX0), b = centerOf(BOX1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
const kOf = (b) => { const [W, H] = stageSize(); return Math.min(W / b[2], H / b[3]); };
const homeK = (t) => kOf(BOX0) + (kOf(BOX1) - kOf(BOX0)) * t;
function stageSize() { const r = stage.getBoundingClientRect(); return [Math.max(1, r.width), Math.max(1, r.height)]; }
function fit() {
  const [W, H] = stageSize();
  const b = target > 0.5 ? BOX1 : BOX0;
  fitK = Math.min(W / BOX0[2], H / BOX0[3]);
  cam.k = kOf(b);
  [cam.cx, cam.cy] = centerOf(b);
  cam.follow = true;
  applyCam();
}
let curVB = [0, 0, 1, 1], shake = [0, 0];
function applyCam() {
  const [W, H] = stageSize();
  const w = W / cam.k, h = H / cam.k;
  const fl = typeof flight !== "undefined" && flight;
  const sx = fl ? shake[0] / cam.k : 0, sy = fl ? shake[1] / cam.k : 0;
  curVB = [cam.cx - w / 2 + sx, cam.cy - h / 2 + sy, w, h];
  svg.setAttribute("viewBox", curVB.map((v) => v.toFixed(2)).join(" "));
  if (fl) fxFrame();
}
function toWorld(x, y) {
  const r = stage.getBoundingClientRect();
  return [cam.cx + (x - r.left - r.width / 2) / cam.k, cam.cy + (y - r.top - r.height / 2) / cam.k];
}
function zoomAt(factor, x, y) {
  const r = stage.getBoundingClientRect();
  if (x === undefined) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
  const before = toWorld(x, y);
  cam.k = Math.max(fitK * 0.4, Math.min(fitK * 16, cam.k * factor));
  const after = toWorld(x, y);
  cam.cx += before[0] - after[0];
  cam.cy += before[1] - after[1];
  cam.follow = false;
  applyCam();
}
btn("zin").onclick = () => zoomAt(1.4);
btn("zout").onclick = () => zoomAt(1 / 1.4);
btn("reset").onclick = () => fit();
stage.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  const d = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
  zoomAt(Math.exp(-d * 0.0018), ev.clientX, ev.clientY);
}, { passive: false });
let drag = null;
const pointers = new Map();
function pinchState() {
  const [a, b] = [...pointers.values()];
  return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
}
stage.addEventListener("pointerdown", (ev) => {
  if (ev.button !== undefined && ev.button > 0) return;
  pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (pointers.size === 1) drag = { x: ev.clientX, y: ev.clientY, cx: cam.cx, cy: cam.cy, moved: false, id: ev.pointerId };
  else if (pointers.size === 2) { drag = { ...pinchState(), k: cam.k, moved: true, pinch: true }; drag.world = toWorld(drag.mx, drag.my); }
});
stage.addEventListener("pointermove", (ev) => {
  if (!pointers.has(ev.pointerId)) return;
  pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (!drag) return;
  if (drag.pinch && pointers.size === 2) {
    const p = pinchState();
    cam.k = Math.max(fitK * 0.4, Math.min(fitK * 16, drag.k * (p.d / drag.d)));
    const r = stage.getBoundingClientRect();
    cam.cx = drag.world[0] - (p.mx - r.left - r.width / 2) / cam.k;
    cam.cy = drag.world[1] - (p.my - r.top - r.height / 2) / cam.k;
    cam.follow = false;
    applyCam();
    return;
  }
  if (drag.pinch) return;
  const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) > 4) {
    drag.moved = true;
    stage.classList.add("drag");
    try { stage.setPointerCapture(ev.pointerId); } catch {}
  }
  if (drag.moved) {
    cam.cx = drag.cx - dx / cam.k;
    cam.cy = drag.cy - dy / cam.k;
    cam.follow = false;
    applyCam();
  }
});
const up = (ev) => {
  pointers.delete(ev.pointerId);
  if (pointers.size === 1 && drag?.pinch) {
    const [[x, y]] = [...pointers.values()];
    drag = { x, y, cx: cam.cx, cy: cam.cy, moved: true };
    return;
  }
  if (!pointers.size) { setTimeout(() => (drag = null), 0); stage.classList.remove("drag"); }
};
stage.addEventListener("pointerup", up);
stage.addEventListener("pointercancel", up);
stage.addEventListener("dblclick", (ev) => { if (!ev.target.closest(".pop") && !ev.target.closest("[data-part]")) fit(); });
new ResizeObserver(() => (cam.follow && !flight ? fit() : applyCam())).observe(stage);
// ---- highlight: what is lit is the pinned part, else the part under the cursor (or the hovered list row)
let hover = null, pinned = null, hot = null;
const info = { name: document.querySelector('[data-i="name"]'), spec: document.querySelector('[data-i="spec"]'), info: document.querySelector('[data-i="info"]') };
const DEFAULT_INFO = [info.name.textContent, info.spec.textContent, info.info.textContent];
function render() {
  const id = pinned ?? hover;
  if (hot === id) return;
  if (hot) { (byPart[hot] || []).forEach((el) => el.removeAttribute("data-on")); rows[hot]?.removeAttribute("data-on"); }
  hot = id;
  if (id) {
    stage.setAttribute("data-hot", "");
    (byPart[id] || []).forEach((el) => el.setAttribute("data-on", ""));
    rows[id]?.setAttribute("data-on", "");
    const p = PARTS[id];
    info.name.textContent = p.name;
    info.spec.textContent = p.spec || " ";
    info.info.textContent = p.info + (p.cut && !stage.hasAttribute("data-cut") ? " (Turn on Cutaway to see it.)" : "");
    readout.textContent = p.name + (p.spec ? " · " + p.spec : "");
  } else {
    stage.removeAttribute("data-hot");
    [info.name.textContent, info.spec.textContent, info.info.textContent] = DEFAULT_INFO;
    readout.textContent = "";
  }
}
function setHover(id) { if (hover !== id) { hover = id; render(); } }
const partAt = (target) => target.closest?.("[data-part]")?.dataset.part ?? null;
svg.addEventListener("pointermove", (ev) => { if (pointers.size) return; if (ev.pointerType === "touch") return; setHover(partAt(ev.target)); });
stage.addEventListener("pointerleave", () => setHover(null));
stage.addEventListener("pointerup", (ev) => { if (ev.pointerType !== "touch") requestAnimationFrame(() => setHover(partAt(document.elementFromPoint(ev.clientX, ev.clientY) || stage))); });
stage.addEventListener("pointerdown", (ev) => { if (!ev.target.closest(".pop")) setHover(null); });
const pop = stage.querySelector(".pop");
let cardAt = null;
function placeCard() {
  if (!cardAt || pop.hidden) return;
  const [x, y] = cardAt;
  const r = stage.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = x - r.left + 18, top = y - r.top - h / 2;
  if (left + w > r.width - 8) left = x - r.left - w - 18;
  left = Math.max(8, Math.min(left, r.width - w - 8));
  top = Math.max(8, Math.min(top, r.height - h - 8));
  pop.style.left = left + "px";
  pop.style.top = top + "px";
}
function openCard(id, x, y) {
  cardAt = [x, y];
  const p = PARTS[id];
  const ph = PHOTOS[id], fig = pop.querySelector(".pop-photo"), img = fig.querySelector("img");
  if (ph) {
    fig.hidden = false;
    fig.classList.remove("ok", "bad");
    img.onload = () => { fig.classList.add("ok"); placeCard(); };
    img.onerror = () => { fig.classList.add("bad"); };
    img.alt = "Photo: " + ph.caption;
    img.src = ph.src;
    fig.querySelector("a").href = ph.page;
    const cap = fig.querySelector("figcaption");
    cap.innerHTML = "";
    cap.append(ph.caption + " · ");
    const a = document.createElement("a"); a.href = ph.page; a.target = "_blank"; a.rel = "noopener"; a.textContent = ph.credit + (ph.lic && ph.lic !== "Public domain" ? " (" + ph.lic + ")" : "") + " / Wikimedia";
    cap.append(a);
  } else fig.hidden = true;
  pop.querySelector(".pop-group").textContent = GROUP_NAMES[p.group] || "";
  pop.querySelector(".pop-name").textContent = p.name;
  pop.querySelector(".pop-spec").textContent = p.spec || "";
  pop.querySelector(".pop-info").textContent = p.info;
  pop.querySelector(".pop-note").textContent = p.cut && !stage.hasAttribute("data-cut") ? "Inside part: turn on Cutaway (C) to see it." : "";
  pop.hidden = false;
  placeCard();
}
function select(id, x, y) { pinned = id; render(); if (id) openCard(id, x, y); else pop.hidden = true; }
function closeCard() { pop.hidden = true; pinned = null; render(); }
pop.querySelector(".pop-x").addEventListener("click", (ev) => { ev.stopPropagation(); closeCard(); });
pop.addEventListener("pointerdown", (ev) => ev.stopPropagation());
pop.addEventListener("wheel", (ev) => ev.stopPropagation());
pop.addEventListener("dblclick", (ev) => ev.stopPropagation());
svg.addEventListener("click", (ev) => {
  if (drag?.moved) return;
  const id = partAt(ev.target);
  if (!id || (pinned === id && !pop.hidden)) { closeCard(); setHover(id); return; }
  select(id, ev.clientX, ev.clientY);
});
function partBox(id) {
  let box = null;
  for (const el of byPart[id] || []) {
    if (el.classList.contains("m-none")) continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    box = box ? { l: Math.min(box.l, r.left), t: Math.min(box.t, r.top), r: Math.max(box.r, r.right), b: Math.max(box.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom };
  }
  return box;
}
function revealAndSelect(id) {
  if (PARTS[id].cut && !stage.hasAttribute("data-cut")) setCut(true);
  let b = partBox(id);
  const s = stage.getBoundingClientRect();
  if (b) {
    const cx = (b.l + b.r) / 2, cy = (b.t + b.b) / 2;
    if (cx < s.left + 40 || cx > s.right - 40 || cy < s.top + 40 || cy > s.bottom - 40) {
      cam.cx += (cx - (s.left + s.width / 2)) / cam.k;
      cam.cy += (cy - (s.top + s.height / 2)) / cam.k;
      cam.follow = false;
      applyCam();
      b = partBox(id);
    }
  }
  const x = b ? Math.min(b.r, s.right) : s.left + s.width / 2;
  const y = b ? Math.max(s.top, Math.min(s.bottom, (b.t + b.b) / 2)) : s.top + s.height / 2;
  select(id, x, y);
}
for (const id in rows) {
  rows[id].addEventListener("pointerenter", (ev) => { if (ev.pointerType !== "touch") setHover(id); });
  rows[id].addEventListener("pointerleave", () => setHover(null));
  rows[id].addEventListener("click", () => (pinned === id && !pop.hidden ? closeCard() : revealAndSelect(id)));
}
document.addEventListener("keydown", (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const key = ev.key.toLowerCase();
  if (key === " " && !ev.target.closest("button,input")) { flight ? setPlaying(!playing) : startFlight(); }
  else if (key === "e") setExplode(target < 0.5);
  else if (key === "c") setCut(!stage.hasAttribute("data-cut"));
  else if (key === "l") setLabels(stage.dataset.labels !== "on");
  else if (key === "+" || key === "=") zoomAt(1.4);
  else if (key === "-" || key === "_") zoomAt(1 / 1.4);
  else if (key === "0") fit();
  else if (key === "escape") { if (!pop.hidden || pinned) closeCard(); else if (flight) exitFlight(); }
  else return;
  ev.preventDefault();
});

// ---- flight: shared helpers, then the vehicle's mission script, then the player
const ramp = (t, a, b) => clamp01((t - a) / (b - a));
const sm = (a, b, x) => smooth(a, b, x);
const unit = (v) => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const interp = (tab, t) => { if (t <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (t <= tab[i][0]) { const [a, va] = tab[i - 1], [b, vb] = tab[i]; return va + ((vb - va) * (t - a)) / (b - a); } return tab[tab.length - 1][1]; };
const SKY = [[0, [122, 167, 214]], [3, [91, 136, 194]], [12, [46, 79, 143]], [30, [19, 35, 74]], [60, [7, 11, 24]], [120, [3, 4, 8]]];
function skyAt(alt) {
  let c = SKY[SKY.length - 1][1];
  for (let i = 1; i < SKY.length; i++) if (alt <= SKY[i][0]) { const [a, ca] = SKY[i - 1], [b, cb] = SKY[i], k = (alt - a) / (b - a); c = ca.map((v, j) => v + (cb[j] - v) * k); break; }
  return c;
}
let fxClock = 0, lastFs = null;
/*@MISSION@*/
if (typeof speedAt === "undefined") window.speedAt = (t) => { let b = t < 10 ? 1 : t < 60 ? 1 + (t - 10) * 0.5 : t < 500 ? 30 : t < 1500 ? 120 : 1500; for (const [a, z, v] of WIN) if (t >= a && t <= z) b = Math.min(b, v); return b; };
// 3-D landing view: the vehicle's LANDING says which one and when; the clock runs at its speed while it is up
const LAND = typeof LANDING === "object" ? makeLand(LANDING, stage) : null;
const inLand = (t) => !!LAND && t >= LAND.a0 && t <= LAND.a1;
// the vehicle scene ends at its T_END; the mission map carries on to MAP.end
const ISO_END = T_END, HAS_MAP = typeof MAP === "object", M_END = HAS_MAP ? MAP.end : T_END;
if (HAS_MAP) { EVENTS.push(...MAP.events); EVENTS.sort((a, b) => a[0] - b[0]); }
const KEY_T = EVENTS.map((e) => e[0]);
// after the scene: fast through coasts, slow near every event
function missionSpeed(t) {
  if (inLand(t)) return LAND.speed;
  if (t < ISO_END) return speedAt(t);
  let d = Infinity;
  for (const k of KEY_T) d = Math.min(d, Math.abs(t - k));
  const [m, f] = MAP.warp || [20, 2];
  return m + f * d;
}
const TAB = [];
{ let t = T_START; while (t < M_END) { TAB.push(t); t += missionSpeed(t) / 60; } TAB.push(M_END); }
const TOTAL = (TAB.length - 1) / 60;
function tAt(tau) { const i = Math.max(0, tau) * 60, j = Math.floor(i); if (j >= TAB.length - 1) return M_END; return TAB[j] + (TAB[j + 1] - TAB[j]) * (i - j); }
function tauAt(t) { let lo = 0, hi = TAB.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; TAB[m] <= t ? (lo = m) : (hi = m); } return lo / 60; }
let flight = false, playing = false, tau = 0, missionT = T_START, flightFrame = 0, flightLast = 0;
const plumes = [...svg.querySelectorAll("[data-plume]")].map((el) => ({ el, kind: el.dataset.plume, ex: +el.dataset.ex, ey: +el.dataset.ey, smoke: el.querySelector(".smokeg") }));
const steamEl = svg.querySelector(".steam");
const hud = stage.querySelector(".hud"), fbar = document.querySelector(".fbar"), slider = fbar.querySelector("input"), tlabel = fbar.querySelector(".fbar-t");
const hudEl = { met: hud.querySelector("[data-met]"), ev: hud.querySelector("[data-ev]"), alt: hud.querySelector("[data-alt]"), vel: hud.querySelector("[data-vel]"), warp: hud.querySelector("[data-warp]"), ref: hud.querySelector("[data-ref]") };
const earth = stage.querySelector(".earth");
const mmap = stage.querySelector(".mmap");
let mapForced = false;
if (HAS_MAP) {
  for (const ev of MAP.events) ev[2] = tAt(tauAt(ev[0]) + (ev[2] || 3.4)) - ev[0];
  MM.init(MAP, tauAt);
  mmap.addEventListener("pointerdown", (ev) => ev.stopPropagation());
  mmap.addEventListener("click", () => { if (missionT < ISO_END || inRet(missionT)) { mapForced = !mapForced; MM.zoomReset(); drawMap(); } });
  mmap.addEventListener("wheel", (ev) => { if (!stage.dataset.map) return; ev.preventDefault(); ev.stopPropagation(); MM.zoomBy(Math.exp((ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY) * 0.0015)); drawMap(); }, { passive: false });
}
// ---- return scene: back in the 3-D view for re-entry and landing (the vehicle's RET says what is shown)
const HAS_RET = typeof RET === "object";
const inRet = (t) => HAS_RET && t >= RET.t0;
const retEls = { plasma: [...svg.querySelectorAll("[data-plasma]")], chutes: [...svg.querySelectorAll("[data-chute]")], splash: [...svg.querySelectorAll("[data-splash]")] };
function retState(t) {
  const h = MM.hud(t), fs = RET.state(t, h);
  fs.t = t; fs.ret = true; fs.alt = h.alt; fs.vel = h.vel;
  for (const n in byAsm) fs.asm[n] ??= { v: [0, 0, 0], hide: true };
  // glow while fast and inside the upper atmosphere
  if (fs.plasma === undefined) fs.plasma = clamp01((h.vel - 9000) / 14000) * clamp01((118 - h.alt) / 20) * clamp01((h.alt - 22) / 10);
  return fs;
}
const stateAt = (t) => (inRet(t) ? retState(t) : flightState(Math.min(t, ISO_END)));
function retShake() { const a = 2.6 * ((lastFs && lastFs.plasma) || 0), c = fxClock; return [a * Math.sin(c * 61), a * Math.sin(c * 47 + 1)]; }
function retFx(fs) {
  for (const el of retEls.plasma) { const on = fs.plasma > 0.01; el.style.display = on ? "" : "none"; if (on) el.style.opacity = fs.plasma.toFixed(3); }
  for (const el of retEls.chutes) {
    const k = (el.dataset.chute === "1" ? fs.chute1 : fs.chute2) || 0, on = k > 0.01;
    el.style.display = on ? "" : "none";
    if (on) { const sy = 0.3 + 0.7 * k, sx = sy * (0.35 + 0.65 * k); el.setAttribute("transform", "translate(" + el.dataset.ex + " " + el.dataset.ey + ") scale(" + sx.toFixed(3) + " " + sy.toFixed(3) + ") translate(" + -el.dataset.ex + " " + -el.dataset.ey + ")"); }
  }
  for (const el of retEls.splash) el.style.display = fs.splash ? "" : "none";
}
function drawMap() {
  if (!HAS_MAP) return;
  const on = flight, full = on && !(LAND && LAND.on(missionT)) && ((missionT >= ISO_END && !inRet(missionT)) || mapForced);
  mmap.hidden = !on;
  const st = full ? (missionT >= ISO_END && !inRet(missionT) ? "full" : "forced") : "";
  if ((stage.dataset.map || "") !== st) { st ? (stage.dataset.map = st) : delete stage.dataset.map; if (!st) MM.zoomReset(); }
  if (on) MM.draw(missionT, tau, full);
}
// WebGL launch effects
const fxCanvas = stage.querySelector(".fx-gl"), fxFlash = stage.querySelector(".fx-flash");
const fxOn = FX.init(fxCanvas);
if (fxOn) stage.setAttribute("data-gl", "");
function fxFrame() {
  if (!fxOn || !lastFs) return;
  const st = stage.dataset.map ? null : lastFs.ret ? lastFs.gl : fxState(lastFs);
  if (!st) { FX.clear(); fxFlash.style.opacity = "0"; return; }
  st.clock = fxClock;
  st.sky = skyAt(lastFs.alt).map((x) => x / 255);
  FX.draw(st, curVB, FXD.camera, performance.now());
  fxFlash.style.opacity = ((st.flash || 0) * 0.28).toFixed(3);
}
function plumeTr(p, sx, sy) { return "translate(" + p.ex + " " + p.ey + ") scale(" + sx.toFixed(3) + " " + sy.toFixed(3) + ") translate(" + -p.ex + " " + -p.ey + ")"; }
function applyFlightFx(fs) {
  lastFs = fs;
  const t = missionT;
  let alt = fs.alt, vel = fs.vel, ref = "";
  if (HAS_MAP && t >= ISO_END) { const h = MM.hud(t); alt = h.alt; vel = h.vel; ref = h.ref === "moon" ? " above the Moon" : ""; }
  if (LAND) { LAND.draw(t); if (LAND.on(t)) ({ alt, vel, ref } = LAND.hud()); }
  drawMap();
  fs.ret ? stage.setAttribute("data-ret", "") : stage.removeAttribute("data-ret");
  if (fs.ret) retFx(fs);
  if (!fxOn) {
    for (const p of plumes) {
      const op = (fs.fallback && fs.fallback[p.kind]) || 0;
      const wide = 1 + Math.min(alt / 60, 1) * 1.6;
      const d = op > 0.005 ? "" : "none";
      if (p.el.style.display !== d) p.el.style.display = d;
      if (op > 0.005) { p.el.style.opacity = op.toFixed(3); p.el.setAttribute("transform", plumeTr(p, wide, 1 + Math.min(alt / 60, 1) * 0.5)); }
      if (p.smoke) p.smoke.style.opacity = (1 - clamp01(alt / 32)).toFixed(3);
    }
    if (steamEl) {
      const st = fs.steam || 0;
      steamEl.style.display = st > 0 ? "" : "none";
      if (st > 0) { const s = 0.45 + 1.3 * st; steamEl.style.opacity = st.toFixed(3); steamEl.setAttribute("transform", "translate(" + steamEl.dataset.cx + " " + steamEl.dataset.cy + ") scale(" + s.toFixed(3) + ") translate(" + -steamEl.dataset.cx + " " + -steamEl.dataset.cy + ")"); }
    }
  }
  if (typeof vehicleFx === "function" && !fs.ret) vehicleFx(fs);
  if (fs.ret) stage.removeAttribute("data-flow");
  // sky, stars, speed streaks and the Earth's limb
  const c = skyAt(alt);
  const top = c.map((v) => Math.round(v * 0.72));
  stage.style.setProperty("--sky", "linear-gradient(to top, rgb(" + c.map(Math.round).join(",") + "), rgb(" + top.join(",") + "))");
  stage.style.setProperty("--stars", clamp01((alt - 30) / 50).toFixed(3));
  stage.style.setProperty("--streak", (clamp01(alt / 1.5) * (1 - clamp01((alt - 20) / 20))).toFixed(3));
  stage.style.setProperty("--streak-y", ((t > 0 ? 6 * t * t : 0) % 4000).toFixed(0) + "px");
  if (fs.ret) { // falling: streaks run upward past the craft
    stage.style.setProperty("--streak", (clamp01((vel - 300) / 1500) * clamp01((45 - alt) / 12)).toFixed(3));
    stage.style.setProperty("--streak-y", (-(fxClock * 900) % 4000).toFixed(0) + "px");
  }
  const ek = clamp01((alt - 25) / 140), eo = clamp01((alt - 18) / 30);
  earth.style.opacity = eo.toFixed(3);
  stage.style.setProperty("--earth-r", (900 - 520 * Math.sqrt(ek)).toFixed(0) + "vmax");
  stage.style.setProperty("--earth-y", (88 - 10 * Math.sqrt(ek)).toFixed(1) + "%");
  // HUD
  const met = Math.abs(t), h = Math.floor(met / 3600), m = Math.floor((met % 3600) / 60), sec = Math.floor(met % 60);
  const hh = h < 1000 ? String(h).padStart(2, "0") : Math.floor(h / 24) + "d " + String(h % 24).padStart(2, "0");
  const label = "T" + (t < 0 ? "−" : "+") + hh + ":" + String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  hudEl.met.textContent = label;
  tlabel.textContent = label;
  hudEl.alt.textContent = alt < 100 ? alt.toFixed(1) : Math.round(alt).toLocaleString();
  hudEl.vel.textContent = Math.round(vel).toLocaleString();
  hudEl.ref.textContent = ref;
  const sp = missionSpeed(t);
  hudEl.warp.textContent = sp > 1.01 ? "×" + Math.round(sp) + " time warp" : "real time";
  let ev = "";
  for (const [a, txt, span] of EVENTS) if (t >= a && t < a + span) ev = txt;
  if (hudEl.ev.textContent !== ev) { hudEl.ev.textContent = ev; hudEl.ev.classList.remove("pulse"); void hudEl.ev.offsetWidth; if (ev) hudEl.ev.classList.add("pulse"); }
}
function camFollow(dt, snap) {
  if (!cam.follow) return;
  const fs = stateAt(missionT);
  const tx = FLIGHT.cx, ty = FLIGHT.y0 + fs.camZ * FLIGHT.dz, tk = fitK * fs.zoom;
  const a = snap ? 1 : 1 - Math.exp(-dt * 2.5);
  cam.cx += (tx - cam.cx) * a; cam.cy += (ty - cam.cy) * a; cam.k += (tk - cam.k) * a;
  applyCam();
}
function flightTick(now) {
  const dt = flightLast ? Math.min((now - flightLast) / 1000, 0.1) : 1 / 60;
  flightLast = now;
  if (playing) { tau = Math.min(TOTAL, tau + dt); fxClock += still.matches ? 0 : dt; if (tau >= TOTAL) setPlaying(false); }
  missionT = tAt(tau);
  slider.value = String(Math.round((tau / TOTAL) * 1000));
  shake = still.matches ? [0, 0] : inRet(missionT) ? retShake() : missionT > ISO_END ? [0, 0] : shakeAt(missionT);
  draw();
  camFollow(dt, false);
  if (!cam.follow) fxFrame();
  flightFrame = flight && (playing || cam.follow) ? requestAnimationFrame(flightTick) : 0;
}
function runFlight() { if (!flightFrame) { flightLast = 0; flightFrame = requestAnimationFrame(flightTick); } }
function setPlaying(on) {
  playing = on;
  const b = fbar.querySelector('[data-fl="play"]');
  b.textContent = on ? "❚❚" : "▶";
  b.setAttribute("aria-label", on ? "Pause" : "Play");
  if (on) { if (tau >= TOTAL) tau = 0; runFlight(); }
}
function startFlight() {
  closeCard();
  target = 0; e = 0;
  flight = true; tau = 0; missionT = T_START;
  stage.setAttribute("data-flight", "");
  hud.hidden = false; fbar.hidden = false;
  btn("explode").setAttribute("aria-pressed", "false");
  btn("launch").setAttribute("aria-pressed", "true");
  cam.follow = true;
  camFollow(0, true);
  setPlaying(true);
}
function exitFlight() {
  flight = false; playing = false;
  if (flightFrame) cancelAnimationFrame(flightFrame);
  flightFrame = 0;
  stage.removeAttribute("data-flight"); stage.removeAttribute("data-flow"); stage.removeAttribute("data-ret");
  hud.hidden = true; fbar.hidden = true;
  btn("launch").setAttribute("aria-pressed", "false");
  for (const p of plumes) p.el.style.display = "none";
  if (steamEl) steamEl.style.display = "none";
  if (typeof vehicleReset === "function") vehicleReset();
  if (fxOn) FX.clear();
  fxFlash.style.opacity = "0"; shake = [0, 0]; lastFs = null;
  earth.style.opacity = "0";
  mapForced = false; drawMap();
  if (LAND) LAND.draw(-Infinity);
  draw();
  fit();
}
btn("launch").onclick = () => (flight ? exitFlight() : startFlight());
window.__seek = (t, clock) => { if (!flight) startFlight(); tau = tauAt(t); missionT = tAt(tau); if (clock !== undefined) fxClock = clock; setPlaying(false); shake = [0, 0]; draw(); camFollow(0, true); if (!cam.follow) fxFrame(); return hudEl.met.textContent; };
fbar.querySelector('[data-fl="play"]').onclick = () => setPlaying(!playing);
fbar.querySelector('[data-fl="exit"]').onclick = exitFlight;
slider.addEventListener("input", () => { tau = (Number(slider.value) / 1000) * TOTAL; missionT = tAt(tau); setPlaying(false); shake = [0, 0]; draw(); camFollow(0, true); if (!cam.follow) fxFrame(); });
{
  const ticks = fbar.querySelector(".fbar-ticks");
  for (const [a, txt] of EVENTS) { if (a > M_END) continue; const s = document.createElement("i"); s.style.left = ((tauAt(a) / TOTAL) * 100).toFixed(2) + "%"; s.title = txt; ticks.append(s); }
}
fit();
draw();
{ const m = /[#&]t=(-?[\d.]+)/.exec(location.hash); if (m) addEventListener("load", () => window.__seek(+m[1])); }
`;
