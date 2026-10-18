// Starship (Super Heavy + Ship, Block 2) on the Orbital Launch Mount at Starbase — anatomy figure.
// node starship.mjs          -> starship.html
// node starship.mjs --light  -> starship-light.html
// World units are decimetres. Booster Raptor exits at z = 0 (the top of the launch mount), axis at x = y = 0.
import {
  k, G, TAU, P, at, depth, r1, poly3, FZ, FRONT, pt, S, L, D,
  GROUPS, part, put, arcAt, facing, surfQuad, decal, patchSvg, liquidSvg, dome, tube, boxOn, bandPath,
  labels, buildPage, sheen, contactShadow, member, trussFaces, profileOf, flamePath, plumeGroup, plasmaSvg,
} from "./lib.mjs";

const R = 45; // 9 m
const Z = {
  bell: 16, aft: 62, loxTop: 420, chTop: 640, dome: 676, hsr: 682, bTop: 712,
  sAft: 712, sLox: 790, sLoxTop: 925, sChTop: 1050, bay: 1140, sTop: 1232,
};
const FC = FZ(0, 0, 0);
const WIND = FRONT - 1.35; // the ship's windward (tiled) side faces front-left
const OLM = { x: -150, y: -150, w: 300, d: 300, r: 3 };
const OLM_TOP = 0, OLM_T = 30, GROUND = -210;
const HOLE = { x: -60, y: -60, w: 120, d: 120 };
const PAD = { x: -420, y: -620, w: 820, d: 900, r: 4 };
const TOWER = { x0: -50, x1: 50, y0: -470, y1: -370, top: 1440, bay: 60, col: 9, base: GROUND, core: { x: -36, y: -455, w: 26, d: 22, r: 1 }, deckEvery: 4 };
const BODY = 30;
const CATCH_DROP = 150; // the ship comes home with its catch pins level with the chopsticks (z 1000)
const front = (a, sl = 0) => facing(FC, a, sl) > -0.05;
const asc = (prof) => prof.filter((p, i, a) => i === 0 || p[0] > a[i - 1][0] + 1e-6);
const CUT = [{ t: 0.6, cls: "cut-steel" }];
const cutOf = (prof, layers = CUT) => patchSvg(FC, prof, 0, Math.PI, { steps: 120, layers, limbs: false });
const cyl = (z0, z1, r, o = { crease: "none" }) => S(G.solidOf([[z0, r], [z1, r]], FC, P), o);
const rings = (zs, r, tone = "faint", sl = 0) => zs.map((z) => L(arcAt(FC, z, r, sl), tone)).join("");
// stainless rings: a weld every 1.83 m, with short vertical welds staggered ring to ring
function welds(z0, z1, r) {
  let s = "";
  for (let z = z0 + 18.3, i = 0; z < z1 - 2; z += 18.3, i++) {
    s += L(arcAt(FC, z, r), "faint");
    for (let j = 0; j < 3; j++) {
      const a = FRONT + ((i * 1.7 + j * 2.1) % TAU) - Math.PI;
      if (facing(FC, a) < 0.12) continue;
      s += L(poly3([pt(FC, z - 18.3, r + 0.02, a), pt(FC, z, r + 0.02, a)], false), "faint");
    }
  }
  return s;
}
// frost on the cold tanks: soft white streaks, thicker low down, with bare bands at the domes
function frost(z0, z1, r, seed) {
  let s = "";
  for (let i = 0; i < 16; i++) {
    const h = (n) => ((Math.sin((i + 1) * 12.9898 + n * 78.233 + seed) * 43758.5453) % 1 + 1) % 1;
    const a = FRONT + (h(1) - 0.5) * Math.PI * 1.15;
    if (facing(FC, a) < 0.08) continue;
    const za = z0 + h(2) * (z1 - z0) * 0.9, zb = Math.min(z1, za + 20 + h(3) * 70);
    const w = 0.012 + h(4) * 0.03;
    s += `<path class="frost" opacity="${(0.1 + h(5) * 0.14).toFixed(2)}" d="${surfQuad(FC, za, zb, r + 0.05, r + 0.05, a - w, a + w, 3)}"/>`;
  }
  for (let z = z0; z < z1; z += 6) s += `<path class="frost" opacity="${(0.06 + 0.1 * Math.sin(z * 0.07) ** 2).toFixed(3)}" d="${bandPath(FC, z, z + 6.3, r + 0.04)}"/>`;
  return s;
}

// ---------------------------------------------------------------- parts
GROUPS.push(["ship", "Starship (upper stage)"], ["sh", "Super Heavy booster"], ["pad", "Starbase launch site"]);
part("sh-nose", "ship", "Nose cone", "ogive", "The pointed tip of the ship; on cargo flights it holds the payload bay.");
part("sh-fflaps", "ship", "Forward flaps", "2", "Small flaps near the nose that steer the ship as it falls belly-first through the atmosphere.");
part("sh-tiles", "ship", "Heat shield", "~18,000 hexagonal tiles", "Black silica tiles on the windward side protect the steel during re-entry; they are pinned to the hull with small studs.");
part("sh-bay", "ship", "Payload bay & 'Pez' door", "Starlink dispenser slot", "A slot in the bay lets satellites slide out one by one.");
part("sh-header", "ship", "Header tanks", "methane + oxygen", "Small tanks that feed the engines for landing burns after the main tanks have run low.", true);
part("sh-ch4", "ship", "Ship methane tank", "", "The upper of the ship's two big tanks.");
part("sh-lox", "ship", "Ship LOX tank", "", "The lower tank, nearest the engines.");
part("sh-liq", "ship", "Ship propellant", "liquid methane & oxygen", "Both propellants are kept cold enough to frost the steel outside.", true);
part("sh-down", "ship", "Methane downcomer", "", "Carries methane down through the oxygen tank to the engines.", true);
part("sh-aflaps", "ship", "Aft flaps", "2 · large", "Big flaps at the back of the ship; with the forward flaps they let it 'skydive' and then flip upright to land.");
part("sh-skirt", "ship", "Aft skirt", "", "Shields the engines; the hot-staging exhaust is blasted against the booster's vented ring below it.");
part("sh-rsl", "ship", "Raptor (sea level) ×3", "~2.3 MN each · gimbaled", "Three gimbaling Raptors in the middle steer the ship and do its landing flip.");
part("sh-rvac", "ship", "Raptor Vacuum ×3", "2.3 m nozzles", "Fixed engines with long nozzles for space; they do most of the climb to orbit.");
part("sh-steel", "ship", "Stainless steel hull", "304L · 4 mm", "Starship is built from rolled steel rings 1.83 m tall, welded into a stack. Steel is strong when cold and hot.");
part("b-hsr", "sh", "Hot-staging ring", "vented interstage", "The ship lights its engines while still sitting on the booster; the vents let that exhaust out sideways.");
part("b-dome", "sh", "Forward dome & shield", "", "The top dome of the booster's methane tank, protected from the ship's engines during hot staging.");
part("b-grid", "sh", "Grid fins", "3 · steel", "Large fixed-angle grid fins that steer the booster on its way back and give the tower's chopsticks something to catch.");
part("b-ch4", "sh", "Booster methane tank", "liquid methane · −162 °C", "The upper tank of Super Heavy.");
part("b-lox", "sh", "Booster LOX tank", "liquid oxygen · −183 °C", "The larger lower tank.");
part("b-liq", "sh", "Booster propellant", "", "Liquid methane over liquid oxygen; the booster carries ~3,400 t of propellant.", true);
part("b-down", "sh", "Methane downcomer", "a pipe as wide as a car", "Takes methane down through the oxygen tank to the 33 engines.", true);
part("b-frost", "sh", "Frost", "", "Water from the humid Texas air freezes on the steel over the cold propellant: the white bands show where the tanks are full.");
part("b-steel", "sh", "Stainless steel hull", "304L", "Rings of steel welded into a 71 m tall booster.");
part("b-race", "sh", "Raceway", "cable & pressurisation conduit", "A long covered conduit up the booster's side carrying cables and the pressurisation lines between the engine bay and the top of the stage.");
part("b-qd", "sh", "Booster quick disconnect", "", "The plate at the base where the launch mount's umbilical plugs in propellant, power and data. It retracts at liftoff.");
part("sh-race", "ship", "Ship raceway", "", "Conduit along the ship's leeward side between the flaps.");
part("sh-rcs", "ship", "Cold gas RCS thrusters", "", "Small thrusters near the nose and the aft flaps that orient the ship in space.");
part("b-aft", "sh", "Aft skirt & engine bay", "", "Holds the engines and their shielding. The outer engines are fixed in the skirt; the inner ones gimbal.");
part("b-shield", "sh", "Aft heat shield", "", "A flat shield between the engine bells that protects the plumbing from the heat of 33 plumes.");
part("b-outer", "sh", "Outer Raptors ×20", "fixed", "A ring of 20 fixed engines that only fire at liftoff.");
part("b-inner", "sh", "Inner Raptors ×13", "3 centre + 10 middle · gimbaled", "Steer the booster and relight for the boostback and landing burns.");
part("p-olm", "pad", "Orbital launch mount", "~20 m tall", "The steel table the booster stands on, over a water-cooled steel plate instead of a flame trench.");
part("p-legs", "pad", "Launch mount legs", "6 concrete columns", "Carry the mount, the booster and ship above the pad.");
part("p-clamps", "pad", "Hold-down clamps", "20", "Grip the booster's base until all 33 engines are running.");
part("p-plate", "pad", "Water-cooled flame deflector", "steel 'shower head'", "A steel plate full of holes that sprays water up into the exhaust to absorb the heat and sound.");
part("p-pad", "pad", "Pad surface", "", "Concrete apron around the launch mount.");
part("p-tower", "pad", "Launch & catch tower", "~146 m", "The tower stacks the ship on the booster with its arms, fuels it through the quick-disconnect arm, and catches the booster on its return.");
part("p-chop", "pad", "Chopsticks", "catch arms", "Two arms on a carriage that ride up and down the tower. They lift the stages and catch the returning booster under its grid fins.");
part("p-qd", "pad", "Ship quick-disconnect arm", "", "Feeds propellant, power and data to the ship until liftoff.");
part("p-rod", "pad", "Lightning rod", "", "On top of the tower.");

// ---------------------------------------------------------------- explode plan
const ASM = {
  pad: { v: [0, 0, 0], delay: 0 },
  beng: { v: [0, 0, 0], delay: 0.46 },
  boost: { v: [0, 0, 40], delay: 0.42 },
  hsr: { v: [0, 0, 100], delay: 0.34 },
  seng: { v: [0, 0, 150], delay: 0.28 },
  ship: { v: [0, 0, 200], delay: 0.18 },
  nose: { v: [0, 0, 250], delay: 0.06 },
};

// =====================================================================================
// PAD: ground apron, flame plate, legs, table, tower
// =====================================================================================
{
  let s = `<path class="iso-halo" d="${k.haloOf(PAD, GROUND - 24, 24, P)}"/>`;
  s += S(k.slabOf(PAD, GROUND - 24, 24, P, 3, 0.8), { crease: "faint" });
  for (let x = PAD.x + 60; x < PAD.x + PAD.w; x += 60) s += L(poly3([[x, PAD.y + 2, GROUND], [x, PAD.y + PAD.d - 2, GROUND]], false), "faint");
  for (let y = PAD.y + 60; y < PAD.y + PAD.d; y += 60) s += L(poly3([[PAD.x + 2, y, GROUND], [PAD.x + PAD.w - 2, y, GROUND]], false), "faint");
  s += L(k.planOutline(k.insetPlan(PAD, 8), GROUND, P, 3), "lo");
  const plate = { x: PAD.x + PAD.w - 100, y: PAD.y + PAD.d - 22, w: 80, d: 12, r: 1 };
  s += S(k.slabOf(plate, GROUND, 0.5, P, 2), { crease: "none" });
  s += k.faceTextSvg(k.topMatrix([plate.x + 4, plate.y + 7.6], GROUND + 0.5, P, "x"), "STARBASE · ORBITAL LAUNCH PAD A", { size: 3.4, tone: "lo" });
  put(0, "p-pad", "concrete", s, { asm: "pad" });
  // water-cooled steel plate under the mount: a raised square with spray holes
  const pl = { x: -110, y: -110, w: 220, d: 220, r: 2 };
  let p = S(k.slabOf(pl, GROUND, 6, P, 2, 0.5));
  const holes = [];
  for (let x = pl.x + 12; x < pl.x + pl.w; x += 14) for (let y = pl.y + 12; y < pl.y + pl.d; y += 14) holes.push(at([x, y, GROUND + 6]));
  p += D(holes, { size: 0.5, tone: "lo" });
  put(1, "p-plate", "steel", p, { asm: "pad" });
}
put(1, "p-tower", "steel", trussFaces(TOWER, true), { asm: "pad" });
put(2, "p-tower", "steel", trussFaces(TOWER, false) + S(k.slabOf({ x: TOWER.x0 - 5, y: TOWER.y0 - 5, w: TOWER.x1 - TOWER.x0 + 10, d: TOWER.y1 - TOWER.y0 + 10, r: 1 }, TOWER.top, 6, P, 2, 0.5)), { asm: "pad" });
put(2, "p-rod", "white", S(G.solidOf([[TOWER.top + 6, 3], [TOWER.top + 14, 2.4], [TOWER.top + 70, 0.9], [TOWER.top + 86, 0.3]], FZ(0, -420, 0), P)), { asm: "pad" });
{
  // carriage on the tower's front face with the two chopsticks, parked high and swung open
  const zc = 1000;
  let s = S(k.slabOf({ x: -42, y: TOWER.y1, w: 84, d: 16, r: 1 }, zc - 30, 56, P, 2, 0.4), { crease: "faint" });
  for (let z = zc - 22; z < zc + 22; z += 11) s += L(k.sideSeam({ x: -42, y: TOWER.y1, w: 84, d: 16, r: 1 }, z, P, 2), "faint");
  for (const side of [-1, 1]) {
    const root = [side * 36, TOWER.y1 + 14, zc];
    const tip = [side * 120, TOWER.y1 + 300, zc + 4];
    const dir = G.unit3(G.sub3(tip, root));
    const nrm = G.unit3([dir[1], -dir[0], 0]);
    const Fa = G.frameOf(root, dir, nrm, [0, 0, 1]);
    const len = Math.hypot(tip[0] - root[0], tip[1] - root[1]);
    s += S(G.prismOf(Fa, [[-5, -9], [5, -9], [5, 9], [-5, 9]], 0, len, P), { crease: "faint" });
    for (let u = 20; u < len - 10; u += 34) s += L(poly3([G.add3(root, G.add3(G.mul3(dir, u), [0, 0, 9.05])), G.add3(root, G.add3(G.mul3(dir, u + 30), [0, 0, 9.05]))], false), "faint");
    s += S(G.prismOf(Fa, [[-6, -6], [6, -6], [6, 10], [-6, 10]], len - 16, len, P), { crease: "none" });
  }
  put(3, "p-chop", "steel", s, { asm: "pad" });
  // coming home (return scene only): the glow around the ship as it falls belly-first, already lowered to catch height
  const [back, shock] = plasmaSvg([0, 0, 972 - CATCH_DROP], 210, { wake: 1.4 });
  put(BODY - 2, "fx", "none", back, { asm: "glow" });
  put(BODY + 8, "fx", "none", shock, { asm: "glow" });
  // ship quick-disconnect arm reaching the ship's LOX tank
  const zq = 840;
  let q = S(k.slabOf({ x: -9, y: TOWER.y1, w: 18, d: TOWER.y1 * -1 - R - 14, r: 0.6 }, zq, 12, P, 2, 0.3), { crease: "faint" });
  for (let y = TOWER.y1 + 8; y < -R - 18; y += 9) q += member([9, y, zq + 0.6], [9, y + 9, zq + 11.4], 0.5, "twl");
  q += S(k.slabOf({ x: -12, y: -R - 16, w: 24, d: 14, r: 1 }, zq - 6, 24, P, 2, 0.4), { crease: "faint" });
  put(3, "p-qd", "steel", q, { asm: "pad", attrs: ' data-arm=""' });
}
// launch mount legs (back three before the table) and the table
const LEGS = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * TAU + Math.PI / 6; return [Math.cos(a) * 130, Math.sin(a) * 130]; });
function legSvg([x, y]) {
  const F = FZ(x, y, 0);
  let s = S(G.solidOf([[GROUND, 15], [GROUND + 6, 13], [OLM_TOP - OLM_T, 13]], F, P), { crease: "none" });
  for (const z of [GROUND + 60, GROUND + 120]) s += L(arcAt(F, z, 13), "faint");
  return s;
}
for (const p of LEGS.filter(([x, y]) => depth([x, y, 0]) < 0)) put(4, "p-legs", "concrete", legSvg(p), { asm: "pad" });
{
  let s = S(k.slabOf(OLM, OLM_TOP - OLM_T, OLM_T, P, 3, 0.8));
  s += L(k.planOutline(k.insetPlan(OLM, 8), OLM_TOP, P, 3), "lo");
  for (let x = OLM.x + 40; x < OLM.x + OLM.w; x += 40) s += L(poly3([[x, OLM.y + OLM.d, OLM_TOP], [x, OLM.y + OLM.d, OLM_TOP - OLM_T]], false), "faint");
  for (let y = OLM.y + 40; y < OLM.y + OLM.d; y += 40) s += L(poly3([[OLM.x + OLM.w, y, OLM_TOP], [OLM.x + OLM.w, y, OLM_TOP - OLM_T]], false), "faint");
  s += D(k.corners(OLM, 10).map(([x, y]) => at([x, y, OLM_TOP])), { size: 0.6 });
  // the round opening the booster sits over
  const ring = [];
  for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; ring.push([Math.cos(a) * 58, Math.sin(a) * 58, OLM_TOP]); }
  s += `<path class="hole-void" d="${poly3(ring)}"/>` + L(poly3(ring), "hi", { className: "iso-edge" });
  put(5, "p-olm", "steel", s, { asm: "pad" });
}
// hold-down clamps around the booster's base (back half now, front half after the booster)
function clampsSvg(frontHalf) {
  let s = "";
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    if ((facing(FC, a) >= 0) !== frontHalf) continue;
    const r0 = R + 1.5;
    const c = G.radialOf(FC, a);
    const F = G.frameOf([c[0] * r0, c[1] * r0, 0], [0, 0, 1], G.unit3([-c[1], c[0], 0]), c);
    s += S(G.prismOf(F, [[-3, 0], [3, 0], [3, 7], [-3, 7]], OLM_TOP, OLM_TOP + 22, P), { crease: "none" });
    s += S(G.prismOf(F, [[-2.2, -2.5], [2.2, -2.5], [2.2, 0], [-2.2, 0]], OLM_TOP + 16, OLM_TOP + 22, P), { crease: "none" });
  }
  return s;
}
put(6, "p-olm", "steel", contactShadow(0, 0, OLM_TOP, 50, 0.36), { asm: "pad" });
put(6, "p-clamps", "steel", clampsSvg(false), { asm: "pad" });

// =====================================================================================
// SUPER HEAVY
// =====================================================================================
const RAP = (z) => 6.5 - 3.4 * Math.pow(z / Z.bell, 0.8);
const ENGB = [];
for (const [n, rr, ph] of [[3, 9, 0.5], [10, 24, 0.1], [20, 38, 0]]) for (let i = 0; i < n; i++) { const a = (i / n) * TAU + ph; ENGB.push([Math.cos(a) * rr, Math.sin(a) * rr, n]); }
ENGB.sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
function raptor(F, z0, len = Z.bell, rf = RAP) {
  let s = S(G.solidOf(profileOf(z0, z0 + len, (z) => rf(z - z0), 10), F, P, { smooth: true }), { crease: "none" });
  s += S(G.solidOf([[z0 - 0.3, rf(0) + 0.2], [z0 + 0.7, rf(0) + 0.2]], F, P), { crease: "none" });
  s += L(arcAt(F, z0 + len * 0.55, rf(len * 0.55)), "faint");
  return s;
}
// only engines whose bells show below the skirt are drawn: the outer ring hangs lowest
for (const [x, y, n] of ENGB) put(BODY, n === 20 ? "b-outer" : "b-inner", "raptor", raptor(FZ(x, y), n === 20 ? 0 : 3), { asm: "beng" });
{
  let s = S(G.solidOf([[Z.bell - 1, R - 1.5], [Z.bell + 3, R]], FC, P), { crease: "lo" });
  put(BODY, "b-shield", "carbon", s, { asm: "boost" });
  let a = cyl(Z.bell + 3, Z.aft, R) + rings([Z.bell + 5, Z.aft - 2], R, "lo");
  a += k.fadedSvg(G.ribsOf(FC, Z.bell + 6, Z.aft - 4, R, 120, P, { fade: [0.05, 0.45] }), { tone: "faint" });
  // the engine bay's chines / shields (raised panels)
  for (let i = 0; i < 6; i++) { const ang = FRONT - 1.2 + i * 0.48; if (facing(FC, ang) > 0.15) a += S(boxOn(FC, ang, R - 0.3, 1.4, 9, Z.bell + 8, Z.aft - 8), { crease: "faint" }); }
  put(BODY, "b-aft", "steel2", a, { asm: "boost", view: "whole" });
  put(BODY, "b-aft", "steel2", cutOf([[Z.bell + 3, R], [Z.aft, R]]), { asm: "boost", view: "cut" });
}
const BLOX = asc([...dome(Z.aft, 18, R - 0.6, false).reverse(), [Z.loxTop - 4, R - 0.6], ...dome(Z.loxTop - 4, 18, R - 0.6, true).slice(1)]);
const BCH4 = asc([...dome(Z.loxTop + 4, 18, R - 0.6, false).reverse(), [Z.chTop - 4, R - 0.6], ...dome(Z.chTop - 4, 22, R - 0.6, true).slice(1)]);
{
  let s = cyl(Z.aft, Z.chTop, R) + welds(Z.aft, Z.chTop, R) + rings([Z.aft + 1.5, Z.loxTop, Z.chTop - 1.5], R, "lo");
  put(BODY, "b-steel", "steel2", s, { asm: "boost", view: "whole" });
  put(BODY, "b-frost", "steel2", frost(Z.aft + 6, Z.loxTop - 12, R, 1) + frost(Z.loxTop + 14, Z.chTop - 30, R, 7), { asm: "boost", view: "whole" });
  put(BODY, "b-steel", "steel2", sheen(FC, Z.bell + 3, Z.hsr, R, { strength: 0.42, width: 0.12 }), { asm: "boost", view: "whole" });
  put(BODY, "b-lox", "steel2", cutOf([[Z.aft, R], [Z.loxTop, R]]), { asm: "boost", view: "cut" });
  put(BODY, "b-ch4", "steel2", cutOf([[Z.loxTop, R], [Z.chTop, R]]), { asm: "boost", view: "cut" });
  put(BODY, "b-liq", "steel2", liquidSvg(FC, BLOX, Z.loxTop - 24, "liq-lox") + liquidSvg(FC, BCH4, Z.chTop - 40, "liq-ch4"), { asm: "boost", view: "cut" });
  put(BODY, "b-down", "silver", tube([[0, 0, Z.aft - 6], [0, 0, Z.loxTop + 8]], 4.2), { asm: "boost", view: "cut" });
  // invisible hit areas so hovering the whole hull names its tanks
  put(BODY, "b-lox", "steel2", `<path class="hit" d="${bandPath(FC, Z.aft, Z.loxTop, R + 0.3)}"/>`, { asm: "boost", view: "whole" });
  put(BODY, "b-ch4", "steel2", `<path class="hit" d="${bandPath(FC, Z.loxTop, Z.chTop, R + 0.3)}"/>`, { asm: "boost", view: "whole" });
}
// raceways: covered conduits up the booster and the ship
function raceway(z0, z1, a, step) {
  let s = S(boxOn(FC, a, R - 0.3, 2.4, 5.2, z0, z1), { crease: "faint" });
  for (let z = z0 + step; z < z1 - 4; z += step) s += S(boxOn(FC, a, R - 0.3, 2.9, 7, z, z + 1.6), { crease: "none" });
  return s;
}
put(BODY, "b-race", "steel2", raceway(Z.aft + 2, Z.hsr - 4, FRONT + 0.85, 36), { asm: "boost", view: "whole" });
put(BODY, "b-qd", "steel", S(boxOn(FC, FRONT - 0.95, R - 0.3, 2.2, 16, Z.bell + 10, Z.bell + 30), { crease: "faint" }) + D([pt(FC, Z.bell + 16, R + 2.3, FRONT - 1.05), pt(FC, Z.bell + 16, R + 2.3, FRONT - 0.85), pt(FC, Z.bell + 24, R + 2.3, FRONT - 0.95)].map(at), { size: 0.7, tone: "lo" }), { asm: "boost", view: "whole" });
// grid fins: three large steel lattices on stubs, sticking straight out
const GRID = [FRONT + 0.25, FRONT + 0.25 + (2 * TAU) / 3, FRONT + 0.25 + TAU / 3];
function gridFin(a) {
  const rad = G.radialOf(FC, a);
  const tan = G.unit3([-rad[1], rad[0], 0]);
  const z0 = 640, z1 = 668;
  const o = G.mul3(rad, R);
  const Fb = G.frameOf([o[0], o[1], 0], tan, rad, [0, 0, 1]);
  // the fin is a thick frame (radial 4..34, height z0..z1) seen edge on; its lattice cells cut through
  let s = S(G.prismOf(Fb, [[0, z0 + 8], [5, z0 + 8], [5, z1 - 8], [0, z1 - 8]], -3, 3, P), { crease: "none" });
  s += S(G.prismOf(Fb, [[5, z0], [34, z0], [34, z1], [5, z1]], -1.6, 1.6, P), { crease: "faint" });
  let lat = "";
  for (let i = 0; i <= 8; i++) {
    const u = 5 + (29 * i) / 8;
    lat += poly3([G.add3(G.add3(o, G.mul3(rad, u)), G.add3(G.mul3(tan, 1.65), [0, 0, z0 + 1])), G.add3(G.add3(o, G.mul3(rad, u)), G.add3(G.mul3(tan, 1.65), [0, 0, z1 - 1]))], false);
  }
  for (let j = 1; j < 6; j++) {
    const z = z0 + ((z1 - z0) * j) / 6;
    lat += poly3([G.add3(G.add3(o, G.mul3(rad, 5.5)), G.add3(G.mul3(tan, 1.65), [0, 0, z])), G.add3(G.add3(o, G.mul3(rad, 33.5)), G.add3(G.mul3(tan, 1.65), [0, 0, z]))], false);
  }
  s += L(lat, "lo");
  return s;
}
for (const a of GRID.filter((a) => !front(a))) put(BODY - 1, "b-grid", "steel", gridFin(a), { asm: "boost" });
{
  let s = cyl(Z.chTop, Z.hsr, R) + rings([Z.chTop + 1.5, Z.hsr - 1.5], R, "lo") + welds(Z.chTop - 4, Z.hsr, R);
  put(BODY, "b-dome", "steel2", s, { asm: "boost", view: "whole" });
  put(BODY, "b-dome", "steel2", cutOf([[Z.chTop, R], [Z.hsr, R]]), { asm: "boost", view: "cut" });
  // hot-staging ring: steel frame with tall dark vents
  let h = cyl(Z.hsr, Z.bTop, R + 0.2) + rings([Z.hsr + 1.5, Z.bTop - 1.5], R + 0.2, "lo");
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    if (facing(FC, a) < 0.1) continue;
    h += `<path class="vent" d="${surfQuad(FC, Z.hsr + 5, Z.bTop - 5, R + 0.25, R + 0.25, a - 0.075, a + 0.075, 2)}"/>`;
  }
  put(BODY, "b-hsr", "steel", h, { asm: "hsr", view: "whole" });
  put(BODY, "b-hsr", "steel", cutOf([[Z.hsr, R + 0.2], [Z.bTop, R + 0.2]]), { asm: "hsr", view: "cut" });
}
for (const a of GRID.filter(front)) put(BODY + 1, "b-grid", "steel", gridFin(a), { asm: "boost" });

// =====================================================================================
// SHIP
// =====================================================================================
const RVAC = (z) => 11.5 - 7.5 * Math.pow(z / 34, 0.75);
{
  // engines sit inside the skirt: drawn first, seen in the cutaway and after separation
  for (const [a, rr, rv] of [[0.4, 28, 1], [0.4 + TAU / 3, 28, 1], [0.4 + (2 * TAU) / 3, 28, 1], [0.4 + Math.PI, 9, 0], [0.4 + Math.PI + TAU / 3, 9, 0], [0.4 + Math.PI + (2 * TAU) / 3, 9, 0]].sort((p, q) => depth([Math.cos(p[0]) * p[1], Math.sin(p[0]) * p[1], 0]) - depth([Math.cos(q[0]) * q[1], Math.sin(q[0]) * q[1], 0]))) {
    const F = FZ(Math.cos(a) * rr, Math.sin(a) * rr, 0);
    put(BODY, rv ? "sh-rvac" : "sh-rsl", rv ? "rvac" : "raptor", rv ? raptor(F, Z.sAft - 2, 34, RVAC) : raptor(F, Z.sAft + 12, Z.bell), { asm: "seng" });
  }
}
const SLOX = asc([...dome(Z.sLox, 16, R - 0.6, false).reverse(), [Z.sLoxTop - 4, R - 0.6], ...dome(Z.sLoxTop - 4, 16, R - 0.6, true).slice(1)]);
const SCH4 = asc([...dome(Z.sLoxTop + 4, 16, R - 0.6, false).reverse(), [Z.sChTop - 4, R - 0.6], ...dome(Z.sChTop - 4, 18, R - 0.6, true).slice(1)]);
const NOSE = (z) => R * Math.pow(Math.max(0, 1 - ((z - Z.bay) / (Z.sTop - Z.bay)) ** 2), 0.62);
// heat-shield tiles on the windward half: black, in staggered rows
function tiles(z0, z1, rf = () => R, sl = 0) {
  const a0 = WIND - Math.PI / 2, a1 = WIND + Math.PI / 2;
  let d = "", lines = "";
  const n = 60;
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, b = a0 + ((a1 - a0) * (i + 1)) / n;
    if (facing(FC, (a + b) / 2, sl) < 0.02) continue;
    for (let z = z0; z < z1; z += 6) {
      const zb = Math.min(z1, z + 6);
      d += poly3([pt(FC, z, rf(z) + 0.06, a), pt(FC, z, rf(z) + 0.06, b + 0.002), pt(FC, zb, rf(zb) + 0.06, b + 0.002), pt(FC, zb, rf(zb) + 0.06, a)]);
    }
  }
  // rows every 8 dm, joints staggered every other row
  let row = 0;
  for (let z = z0 + 8; z < z1 - 1; z += 8, row++) {
    lines += poly3(Array.from({ length: 41 }, (_, i) => a0 + ((a1 - a0) * i) / 40).filter((a) => facing(FC, a, sl) > 0.05).map((a) => pt(FC, z, rf(z) + 0.08, a)), false);
    for (let a = a0 + (row % 2 ? 0.022 : 0); a < a1; a += 0.044) {
      if (facing(FC, a, sl) < 0.1) continue;
      lines += poly3([pt(FC, z - 8, rf(z - 8) + 0.08, a), pt(FC, z, rf(z) + 0.08, a)], false);
    }
  }
  return `<path class="tile" d="${d}"/><path class="tile-line" d="${lines}"/>`;
}
{
  let s = cyl(Z.sAft, Z.sLox, R) + rings([Z.sAft + 1.5, Z.sLox], R, "lo") + welds(Z.sAft, Z.sLox, R);
  put(BODY, "sh-skirt", "steel2", s, { asm: "ship", view: "whole" });
  put(BODY, "sh-skirt", "steel2", cutOf([[Z.sAft, R], [Z.sLox, R]]), { asm: "ship", view: "cut" });
  let t = cyl(Z.sLox, Z.sChTop, R) + welds(Z.sLox, Z.sChTop, R) + rings([Z.sLoxTop], R, "lo");
  put(BODY, "sh-steel", "steel2", t, { asm: "ship", view: "whole" });
  put(BODY, "sh-tiles", "steel2", tiles(Z.sAft + 4, Z.sChTop), { asm: "ship", view: "whole" });
  put(BODY, "sh-steel", "steel2", sheen(FC, Z.sAft, Z.sChTop, R, { strength: 0.42, width: 0.12 }), { asm: "ship", view: "whole" });
  put(BODY, "sh-lox", "steel2", frost(Z.sLox + 8, Z.sLoxTop - 10, R, 3) + `<path class="hit" d="${bandPath(FC, Z.sLox, Z.sLoxTop, R + 0.3)}"/>`, { asm: "ship", view: "whole" });
  put(BODY, "sh-ch4", "steel2", frost(Z.sLoxTop + 10, Z.sChTop - 16, R, 11) + `<path class="hit" d="${bandPath(FC, Z.sLoxTop, Z.sChTop, R + 0.3)}"/>`, { asm: "ship", view: "whole" });
  put(BODY, "sh-lox", "steel2", cutOf([[Z.sLox, R], [Z.sLoxTop, R]]), { asm: "ship", view: "cut" });
  put(BODY, "sh-ch4", "steel2", cutOf([[Z.sLoxTop, R], [Z.sChTop, R]]), { asm: "ship", view: "cut" });
  put(BODY, "sh-liq", "steel2", liquidSvg(FC, SLOX, Z.sLoxTop - 20, "liq-lox") + liquidSvg(FC, SCH4, Z.sChTop - 24, "liq-ch4"), { asm: "ship", view: "cut" });
  put(BODY, "sh-down", "silver", tube([[0, 0, Z.sLox - 4], [0, 0, Z.sLoxTop + 6]], 2.6), { asm: "ship", view: "cut" });
  // payload bay with the dispenser slot
  let b = cyl(Z.sChTop, Z.bay, R) + welds(Z.sChTop, Z.bay, R) + rings([Z.sChTop + 1.5], R, "lo");
  put(BODY, "sh-bay", "steel2", b, { asm: "nose", view: "whole" });
  put(BODY, "sh-tiles", "steel2", tiles(Z.sChTop, Z.bay), { asm: "nose", view: "whole" });
  const da = WIND + Math.PI;
  if (facing(FC, da) > 0) put(BODY, "sh-bay", "steel2", `<path class="vent" d="${surfQuad(FC, 1080, 1100, R + 0.08, R + 0.08, da - 0.22, da + 0.22, 3)}"/>`, { asm: "nose", view: "whole" });
  put(BODY, "sh-bay", "steel2", cutOf([[Z.sChTop, R], [Z.bay, R]]), { asm: "nose", view: "cut" });
  // header tanks (cutaway): a sphere in the nose, a cylinder in the methane tank
  put(BODY, "sh-header", "silver", S(G.sphereOf([0, 0, 1160], 9, P)) + S(G.solidOf([[960, 0, 1], [962, 6, 1], [990, 6, 1], [992, 0, 1]], FC, P, { smooth: true })), { asm: "nose", view: "cut" });
}
put(BODY, "sh-race", "steel2", raceway(Z.sAft + 120, Z.bay - 4, WIND + Math.PI * 0.82, 34), { asm: "ship", view: "whole" });
{
  let r = "";
  for (const [z, a] of [[1170, WIND + Math.PI + 0.4], [1170, WIND + Math.PI - 0.4], [Z.sAft + 132, WIND + Math.PI + 0.3]]) {
    if (facing(FC, a) < 0.15) continue;
    const rr = z > Z.bay ? NOSE(z) : R;
    r += `<ellipse class="port" cx="${r1(at(pt(FC, z, rr + 0.1, a))[0])}" cy="${r1(at(pt(FC, z, rr + 0.1, a))[1])}" rx="1.4" ry="1"/>`;
  }
  put(BODY + 3, "sh-rcs", "steel2", r, { asm: "nose", view: "whole" });
}
// aft flaps on both sides of the tiled half (back flap first), forward flaps near the nose
const FLAPS = [WIND - Math.PI / 2, WIND + Math.PI / 2];
function flap(a, z0, z1, span, rf = () => R) {
  const rad = G.radialOf(FC, a);
  const tan = G.unit3([-rad[1], rad[0], 0]);
  const o = G.mul3(rad, rf(z0) - 1);
  const Fb = G.frameOf([o[0], o[1], 0], tan, rad, [0, 0, 1]);
  const tilt = (rf(z1) - rf(z0));
  const shape = [[0, z0], [span, z0 + 10], [span + tilt * 0.6, z1 - 10], [tilt, z1]];
  let s = S(G.prismOf(Fb, shape, -2.4, 2.4, P), { crease: "faint" });
  // hinge fairing along the root
  s += S(G.prismOf(Fb, [[0, z0 + 4], [5, z0 + 4], [5 + tilt * 0.1, z1 - 4], [tilt, z1 - 4]], -4, 4, P), { crease: "none" });
  return s;
}
for (const a of FLAPS.filter((a) => !front(a))) {
  put(BODY - 1, "sh-aflaps", "steel2", flap(a, Z.sAft + 8, Z.sAft + 118, 34), { asm: "ship" });
  put(BODY - 1, "sh-fflaps", "steel2", flap(a, 1120, 1188, 18, (z) => (z < Z.bay ? R : NOSE(z))), { asm: "nose" });
}
{
  const prof = profileOf(Z.bay, Z.sTop, NOSE, 28);
  prof[0] = [Z.bay, R];
  prof[prof.length - 1] = [Z.sTop, 0];
  let s = S(G.solidOf(prof, FC, P, { smooth: true }));
  for (const z of [1158, 1176, 1194]) s += L(arcAt(FC, z, NOSE(z), (NOSE(z + 0.5) - NOSE(z - 0.5))), "faint");
  put(BODY + 2, "sh-nose", "steel2", s, { asm: "nose", view: "whole" });
  put(BODY + 2, "sh-tiles", "steel2", tiles(Z.bay, Z.sTop - 10, NOSE, -0.6), { asm: "nose", view: "whole" });
  put(BODY + 2, "sh-nose", "steel2", cutOf(prof), { asm: "nose", view: "cut" });
}
for (const a of FLAPS.filter(front)) {
  put(BODY + 3, "sh-aflaps", "steel2", flap(a, Z.sAft + 8, Z.sAft + 118, 34), { asm: "ship" });
  put(BODY + 3, "sh-fflaps", "steel2", flap(a, 1120, 1188, 18, (z) => (z < Z.bay ? R : NOSE(z))), { asm: "nose" });
}
// front clamps and front legs after the booster
put(45, "p-clamps", "steel", clampsSvg(true), { asm: "pad" });
for (const p of LEGS.filter(([x, y]) => depth([x, y, 0]) >= 0)) put(1, "p-legs", "concrete", legSvg(p), { asm: "pad" });

// =====================================================================================
// FALLBACK PLUMES, FX DATA, LABELS
// =====================================================================================
{
  const [ex, ey] = at([0, 0, 0]);
  put(44, "fx", "none", plumeGroup("sh", ex, ey, `<path class="pl pl-flick" fill="url(#g-ker)" d="${flamePath(ex, ey, 600, (u) => 46 * (1 + 0.4 * Math.sqrt(u)) * (1 - u ** 3))}"/>`), { asm: "beng" });
}
const FLIGHT = {
  pivot: { boost: at([0, 0, 380]), ship: at([0, 0, 972]) },
  drop: CATCH_DROP,
  y0: at([0, 0, 0])[1],
  dz: at([0, 0, 1])[1] - at([0, 0, 0])[1],
  cx: at([0, 0, 600])[0],
};
const FXD = {
  sources: [
    { id: "booster", asm: "beng", p: [0, 0, 0], re: 45, d: [0, 0, -1], kind: 3, len: 900, rings: [[3, 9], [10, 24], [20, 38]], er: 6.5, seed: 1.7 },
    { id: "rvac", asm: "seng", p: [0, 0, Z.sAft - 2], re: 40, d: [0, 0, -1], kind: 3, len: 320, ex: 1, rings: [[3, 28]], er: 11.5, seed: 3.3 },
    { id: "rsl", asm: "seng", p: [0, 0, Z.sAft + 12], re: 16, d: [0, 0, -1], kind: 3, len: 240, ex: 1, rings: [[3, 9]], er: 6.5, seed: 4.4 },
    ...Array.from({ length: 6 }, (_, i) => { const a = FRONT + 0.3 + (i * TAU) / 6; const r = G.radialOf(FC, a); return { id: "hsr", asm: "hsr", p: G.add3(G.mul3(r, R + 0.5), [0, 0, (Z.hsr + Z.bTop) / 2]), re: 7.5, d: G.unit3(G.add3(r, [0, 0, -0.35])), kind: 3, len: 110, seed: 6 + i }; }),
  ],
  occ: [
    { asm: "boost", x: 0, y: 0, z0: Z.bell - 1, z1: Z.hsr, r0: R, r1: R },
    { asm: "hsr", x: 0, y: 0, z0: Z.hsr, z1: Z.bTop, r0: R + 0.2, r1: R + 0.2 },
    { asm: "ship", x: 0, y: 0, z0: Z.sAft, z1: Z.sChTop, r0: R, r1: R },
    { asm: "nose", x: 0, y: 0, z0: Z.sChTop, z1: Z.bay, r0: R, r1: R },
    { asm: "nose", x: 0, y: 0, z0: Z.bay, z1: 1190, r0: R, r1: NOSE(1190) },
    { asm: "nose", x: 0, y: 0, z0: 1190, z1: Z.sTop - 6, r0: NOSE(1190), r1: NOSE(Z.sTop - 6) },
  ],
  deck: { asm: "pad", rect: [OLM.x, OLM.y, OLM.x + OLM.w, OLM.y + OLM.d], top: OLM_TOP, bottom: OLM_TOP - OLM_T, floor: GROUND + 6, holes: [[HOLE.x, HOLE.y, HOLE.x + HOLE.w, HOLE.y + HOLE.d]] },
};
const LABELS = [
  ["sh-nose", pt(FC, 1205, NOSE(1205), FRONT), "L", "Nose cone", "nose"],
  ["sh-fflaps", pt(FC, 1150, NOSE(1150) + 2, FLAPS[0]), "L", "Forward flaps", "nose"],
  ["sh-bay", pt(FC, 1095, R, FRONT + 0.5), "L", "Payload bay · Pez door", "nose"],
  ["sh-tiles", pt(FC, 1000, R, WIND), "L", "Heat shield tiles", "ship"],
  ["sh-ch4", pt(FC, 980, R, FRONT + 0.4), "L", "Ship methane tank", "ship"],
  ["sh-lox", pt(FC, 860, R, FRONT + 0.4), "L", "Ship LOX tank", "ship"],
  ["sh-aflaps", pt(FC, 770, R + 18, FLAPS[0]), "L", "Aft flaps", "ship"],
  ["b-hsr", pt(FC, 697, R + 0.2, FRONT), "L", "Hot-staging ring", "hsr"],
  ["b-grid", pt(FC, 654, R + 20, GRID[0]), "L", "Grid fins", "boost"],
  ["b-ch4", pt(FC, 540, R, FRONT), "L", "Booster methane tank", "boost"],
  ["b-frost", pt(FC, 330, R, FRONT + 0.3), "L", "Frost over the cold LOX", "boost"],
  ["b-lox", pt(FC, 200, R, FRONT - 0.3), "L", "Booster LOX tank", "boost"],
  ["b-aft", pt(FC, 40, R, FRONT), "L", "Aft skirt & engine bay", "boost"],
  ["b-outer", [0, 38, 4], "L", "33 Raptor engines", "beng"],
  ["p-qd", [9, -R - 30, 846], "R", "Ship quick-disconnect arm", "pad"],
  ["p-chop", [80, TOWER.y1 + 200, 1004], "R", "Chopsticks", "pad"],
  ["p-tower", [TOWER.x1, TOWER.y1, 1250], "R", "Launch & catch tower", "pad"],
  ["p-clamps", [R + 6, 0, 14], "R", "Hold-down clamps", "pad"],
  ["p-olm", [OLM.x + OLM.w, OLM.y + OLM.d - 40, OLM_TOP - 12], "R", "Orbital launch mount", "pad"],
  ["p-legs", [LEGS[0][0] + 13, LEGS[0][1], GROUND + 90], "R", "Mount legs", "pad"],
  ["p-plate", [100, 100, GROUND + 6], "R", "Water-cooled steel plate", "pad"],
];
labels(LABELS, { L: -320, R: 320 });

// =====================================================================================
// MISSION
// =====================================================================================
const MISSION = String.raw`
const LANDING = { id: "sh", at: 415 }; // 3-D booster catch view
// ---- an orbital test flight from Starbase, time-warped
const T_START = -7, T_END = 620;
const WIN = [[-7, 16, 1], [150, 180, 3], [500, 525, 6]];
function speedAt(t) { let b = t < 16 ? 1 : t < 60 ? 1 + (t - 16) * 0.45 : 22; for (const [a, z, v] of WIN) if (t >= a && t <= z) b = Math.min(b, v); return b; }
const ALT = [[-7, 0], [0, 0], [10, 0.15], [30, 1.5], [62, 9], [100, 28], [159, 66], [165, 70], [200, 95], [300, 135], [400, 155], [515, 165], [T_END, 166]];
const VEL = [[-7, 0], [0, 0], [10, 110], [30, 520], [62, 1500], [100, 3000], [159, 5800], [165, 5700], [200, 7400], [300, 12500], [400, 19500], [515, 26500], [T_END, 26600]];
const EVENTS = [[-4, "Raptor startup", 4], [0, "33 engines · LIFTOFF", 8], [10, "Clearing the tower", 8], [52, "Transonic: vapour cone", 10], [62, "Max-Q", 10], [159, "Booster MECO (centre engines stay lit)", 3], [161.5, "HOT STAGING · ship ignites on the booster", 4], [165, "Stage separation", 10], [170, "Booster flips for boostback", 20], [515, "Ship SECO", 60]];
// ---- the rest of the flight on the mission map: booster catch, a lap of the Earth, ship catch
// (Earth's rotation is left out, so the ship comes home to the same tower after one orbit)
const MAP = (() => {
  const { orb, fix, path, dock, period, ang } = MM;
  const PI = Math.PI, TAU = 2 * PI;
  const orbit = orb("earth", 165, 175, PI / 2 + 0.27, 515);
  const site0 = ang(orbit, 515) - 0.27;                                   // Starbase
  const tD = 515 + ((TAU - 1.729) / TAU) * period(orbit), tCatch = tD + 1918, END = tCatch + 1100;
  const d = ang(orbit, tD), S = site0 + TAU * Math.round((d + 1.459 - site0) / TAU);
  const ship = {
    id: "ship", col: "#ffd29a", name: [[-1e9, "Starship"], [165, "Ship"]], g: [[-1e9, "starship"], [165, "ship"]],
    path: [
      [-7, fix("earth", site0)],
      [0, path("earth", [[0, site0, 0, 0], [62, site0 + 0.0012, 9, 1500], [159, site0 + 0.011, 66, 5800], [300, site0 + 0.075, 135, 12500], [515, null, null]])],
      [515, orbit],
      [tD, path("earth", [[tD, null, null], [tD + 500, d + 0.56, 120, 26500], [tD + 900, d + 0.98, 75, 24000], [tD + 1300, d + 1.3, 45, 12000], [tD + 1700, d + 1.44, 15, 2000], [tD + 1880, S - 0.0002, 1.5, 350], [tD + 1910, S, 0.15, 30], [tCatch, S, 0.12, 0]])],
      [tCatch, fix("earth", S, 0.12)],
    ],
    fx: [[0, 159, "burn"], [161.5, 515, "burn"], [2400, 2410, "burn"], [tD, tD + 60, "burn"], [tD + 1870, tCatch, "burn"]],
    pose: [[tD + 400, tD + 1870, "belly"], [tD + 1870, END, "up"]],
  };
  const booster = {
    id: "b1", col: "#bfe3ff", name: "Super Heavy", g: "superheavy", end: 3000,
    path: [
      [-7, dock("ship")],
      [165, path("earth", [[165, null, null], [175, site0 + 0.0118, 72, 5000], [220, site0 + 0.0125, 90, 1500], [260, site0 + 0.011, 96, 1700], [330, site0 + 0.006, 60, 3600], [370, site0 + 0.003, 25, 3000], [395, site0 + 0.0008, 3, 1000], [410, site0 + 0.00002, 0.15, 30], [415, site0, 0.12, 0]])],
      [415, fix("earth", site0, 0.12)],
    ],
    fx: [[170, 215, "burn"], [395, 415, "burn"]],
    pose: [[200, 415, "retro"]],
  };
  // back in the 3-D view from the deorbit burn to the catch
  const scene = {
    t0: tD - 200,
    state(t, h) {
      const c = fxClock, flip = sm(tD + 1866, tD + 1878, t), v = [0, 0, -FLIGHT.drop];
      const rot = 90 * (1 - flip) + (t < tD + 1866 ? 3 * Math.sin(c * 1.7) : 1.5 * Math.sin(c * 3) * (1 - sm(tCatch - 4, tCatch, t)));
      const ship = { v, rot, piv: FLIGHT.pivot.ship };
      const fs = { asm: { ship, seng: ship, nose: ship, glow: { v: [0, 0, 0] } } };
      fs.asm.pad = { v: [0, 0, -2600 * Math.pow(Math.max(0, h.alt - 0.12) / 2.4, 0.8)], hide: h.alt > 2.5 };
      const burn = sm(tD + 1868, tD + 1871, t) * (1 - sm(tCatch - 3, tCatch, t));
      if (burn > 0.01) fs.gl = {
        rise: 1e6, occ: [], deck: null,
        sources: FXD.sources.map((s) => ({ p: [s.p[0], s.p[1], s.p[2] + v[2]], re: s.re, d: s.d, kind: s.kind, power: s.id === "rsl" ? 0.5 * burn * (1 + 0.04 * Math.sin(c * 37)) : 0, len: s.len, ex: 0, seed: s.seed, rings: s.rings, er: s.er })),
        trail: { a: 14, t, t0: 0, t1: 0, c: [0, 0], half: 0, r0: 40, start: 380, strength: 0, z: 0, growth: 1, thin: 0 },
        ground: { tau: 0, smoke: 0, steam: 0, z: -210, c: [0, 0], rmax: 1000, dust: 0 },
        vapor: 0, vap: [0, 0, 0], flash: 0, green: 0, sparks: 0, spark: [0, 0, 0, 1], wind: [9, 3], sun: 1,
      };
      fs.camZ = 972 - FLIGHT.drop;
      fs.zoom = 2.3 - 0.3 * sm(tD + 1866, tCatch, t);
      return fs;
    },
  };
  const sats = { id: "sats", col: "#9fb3d1", name: "Starlink", g: "sat", end: 5200, path: [[1200, orb("earth", 172, 178, ang(orbit, 1200) + 0.00005, 1200)]] };
  return {
    end: END, objs: [ship, booster, sats], hud: "ship", scene,
    marks: [{ b: "earth", a: site0, kind: "tower", name: "Starbase tower" }],
    cam: [
      [-7, "ship", 400], [140, "ship", 900], [300, "b1", 250], [385, "b1", 15], [440, "ship", 2500], [620, "earth", 9800],
      [1150, "ship", 200], [1500, "earth", 9800], [tD - 600, "ship", 2500], [tD + 600, "ship", 900], [tD + 1500, "ship", 200], [tD + 1800, "ship", 20], [tD + 1890, "ship", 3],
    ],
    events: [
      [391, "Booster landing burn"], [415, "Booster caught by the tower's chopsticks"], [1200, "Payload deploy · Starlink satellites"],
      [2400, "Raptor relight in orbit"], [tD, "Deorbit burn"], [tD + 500, "Entry interface · belly-first"], [tD + 900, "Peak heating on the heat shield"],
      [tD + 1880, "Landing flip"], [tCatch, "Ship returns to the tower for a catch"], [tCatch + 600, "Both stages back at the pad · ready to fly again"],
    ],
  };
})();
const RET = MAP.scene;
const arms = [...svg.querySelectorAll("[data-arm]")];
const riseAt = (t) => (t > 0 ? 14 * t * t : 0);
const BOOST = ["beng", "boost", "hsr"];
function flightState(t) {
  const fs = { asm: {}, t };
  const rise = riseAt(t);
  fs.asm.pad = { v: [0, 0, -rise], hide: rise > 7000 };
  if (t > 165) { const u = t - 165; for (const n of BOOST) fs.asm[n] = { v: [-0.8 * u, 0, -(5 * u + 0.8 * u * u)], rot: -Math.min(170, 2.6 * Math.max(0, u - 3) ** 1.2), piv: FLIGHT.pivot.boost, hide: u > 70 }; }
  fs.booster = t < -4 ? 0 : t < 159 ? sm(-4, -0.8, t) : 0;
  fs.ship = t < 161.5 ? 0 : t < 515 ? sm(161.5, 163, t) : 1 - sm(514.5, 515.5, t);
  fs.fallback = { sh: fs.booster };
  fs.steam = t > -3 ? ramp(t, -3, 22) : 0;
  fs.alt = interp(ALT, t);
  fs.vel = interp(VEL, t);
  if (t < 165) { const k = sm(-1, 10, t); fs.camZ = 640 - 260 * k; fs.zoom = 1 - 0.12 * k; }
  else { const k = sm(165, 190, t); fs.camZ = 380 + (900 - 380) * k; fs.zoom = 0.88 + 0.5 * k; }
  return fs;
}
function vehicleFx(fs) {
  const op = (1 - ramp(fs.t, -2, 0.5)).toFixed(3);
  for (const a of arms) a.style.opacity = op;
}
function vehicleReset() { for (const a of arms) a.style.opacity = ""; }
function fxState(fs) {
  const t = fs.t, alt = fs.alt, c = fxClock;
  const off = (n) => fs.asm[n] || { v: [0, 0, 0] };
  const sources = FXD.sources.map((s, i) => {
    const o = off(s.asm), v = o.v;
    let power = 0, ex = s.ex || 0, len = s.len;
    if (s.id === "booster") { power = 1.5 * fs.booster; ex = sm(5, 60, alt); len *= 1 + ex * 0.8; if (t > 159) power = 0; }
    else if (s.id === "rvac") power = 0.55 * fs.ship * sm(164.6, 165.8, t);
    else if (s.id === "rsl") power = 0.5 * fs.ship * sm(164.6, 165.8, t);
    else if (s.id === "hsr") power = t > 161.4 && t < 166 ? sm(161.4, 161.8, t) * (1 - sm(164.6, 165.6, t)) * 1.25 : 0;
    if (o.hide) power = 0;
    const d = s.id === "hsr" ? s.d : unit([s.d[0] + 0.01 * Math.sin(c * 2.1 + i), s.d[1] + 0.01 * Math.cos(c * 1.7 + i), s.d[2]]);
    return { p: [s.p[0] + v[0], s.p[1] + v[1], s.p[2] + v[2]], re: s.re, d, kind: s.kind, power: power * (1 + 0.04 * Math.sin(c * 37 + i * 3.1)), len: len * (1 + 0.035 * Math.sin(c * 23 + i)), ex, seed: s.seed, rings: s.rings, er: s.er };
  });
  const occ = FXD.occ.map((o) => {
    const a = off(o.asm), v = a.v;
    return { on: !a.hide && !(BOOST.includes(o.asm) && t > 165), x: o.x + v[0], y: o.y + v[1], z0: o.z0 + v[2], z1: o.z1 + v[2], r0: o.r0, r1: o.r1, heat: 0 };
  });
  const rise = riseAt(t);
  const dk = FXD.deck;
  return {
    rise, sources, occ,
    deck: rise < 8000 ? dk : null,
    trail: { a: 14, t, t0: 0, t1: 159, c: [0, 0], half: 0, r0: 40, start: 380, strength: 0.32, z: 0, growth: 1, thin: sm(6, 35, alt) },
    ground: { tau: Math.max(0, t + 4), smoke: 0.85 * sm(-2, 2, t), steam: 0.7 * sm(-3.5, 0, t), z: -210, c: [0, 0], rmax: 1000, dust: 0.75 },
    vapor: sm(50, 56, t) * (1 - sm(66, 74, t)),
    vap: [1180, 860, 47],
    flash: 0.5 * burst(t + 0.4, 0.08, 0.5) + 0.7 * burst(t - 161.5, 0.05, 0.6),
    green: 0,
    sparks: 0, spark: [0, 0, 0, 1],
    wind: [9, 3], sun: 1,
  };
}
function shakeAt(t) {
  const a = 4.6 * burst(t, 0.1, 2.0) + 1.8 * sm(-1, 0.4, t) * (1 - sm(8, 20, t)) + 0.8 * (sm(50, 56, t) * (1 - sm(66, 74, t))) + 2.6 * burst(t - 161.5, 0.04, 0.8);
  const c = fxClock;
  return [a * (Math.sin(c * 67) * 0.6 + Math.sin(c * 41 + 1) * 0.4), a * (Math.sin(c * 57 + 2) * 0.6 + Math.sin(c * 93) * 0.4)];
}
`;

const CSS = `
.m-steel2{--anatomy-paper:#a9adb2;--anatomy-shade-0:#5e6369;--anatomy-shade-1:#7b8086;--anatomy-shade-2:#999ea4;--anatomy-shade-3:#bcc1c6;--anatomy-top:#dde1e5;--edge:#1f2226;--seam:#8a8f95;--seam2:#6b7076;--seam3:#4f5459;--dot:#2a2d31}
.m-raptor{--anatomy-paper:#6a6560;--anatomy-shade-0:#35322f;--anatomy-shade-1:#48443f;--anatomy-shade-2:#5d5852;--anatomy-shade-3:#757069;--anatomy-top:#8f8981;--edge:#121110;--seam:#7d776f;--seam2:#2a2724}
.m-rvac{--anatomy-paper:#55524f;--anatomy-shade-0:#2b2927;--anatomy-shade-1:#3a3836;--anatomy-shade-2:#4b4946;--anatomy-shade-3:#605d59;--anatomy-top:#77736e;--edge:#0e0d0c;--seam:#6a6762;--seam2:#222120}
.m-concrete{--anatomy-paper:#a7a197;--anatomy-shade-0:#65605a;--anatomy-shade-1:#7c766f;--anatomy-shade-2:#948e85;--anatomy-shade-3:#aca59b;--anatomy-top:#c2bbb0;--edge:#2c2a26;--seam:#8f897f;--seam2:#726c64;--dot:#3b3833}
.cut-steel{fill:#c5c9cd}
.liq-ch4{fill:#c9f0d6;opacity:.3}
.frost{fill:#f4f8fb}
.tile{fill:#17181a;stroke:#17181a;stroke-width:.25}
.tile-line{fill:none;stroke:#2c2e31;stroke-width:.3}
.vent{fill:#0d0e10;stroke:#34373b;stroke-width:.3}
.lbl-text{font-size:10.5px}
`;

buildPage({
  id: "starship",
  title: "Starship anatomy",
  h1: "Starship · Super Heavy + Ship",
  sub: "~123 m tall · ~5,000 t at liftoff · 33 Raptors · ~74 MN thrust",
  figTitle: "Starship · Starbase, Texas",
  label: "SpaceX Starship on the orbital launch mount at Starbase: the stainless steel Super Heavy booster with frost bands, grid fins and a vented hot-staging ring, and the Ship with its black heat-shield tiles, forward and aft flaps, beside the launch and catch tower with its chopsticks.",
  stageLabel: "Starship figure. Keys: Space launch, E explode, C cutaway, L name tags, plus and minus zoom, 0 fit.",
  caption: "Proportions follow SpaceX's published dimensions for the Block 2 vehicle. Explode separates the booster engines, booster, hot-staging ring, ship engines, ship and nose. Cutaway opens both stages' tanks and downcomers. Launch plays an orbital test flight: 33-engine liftoff with the dust cloud off the steel plate, Max-Q, hot staging through the vented ring, the booster flip and the ship's climb.",
  infoText: "Every piece of the stack is drawn as a real part. Turn on Cutaway to see the propellant in all four tanks, the downcomers and the header tanks.",
  ASM,
  xHalf: 360,
  box: (apart) => {
    const off = (a) => (apart ? ASM[a].v : [0, 0, 0]);
    return [...k.boxCorners(PAD, GROUND - 24, GROUND).slice(0, 4), [PAD.x + PAD.w, PAD.y + PAD.d, GROUND - 24], G.add3([0, 0, Z.sTop], off("nose")), [0, -420, TOWER.top + 86]];
  },
  FLIGHT,
  FXD,
  css: CSS,
  mission: MISSION,
});
