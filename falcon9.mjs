// Falcon 9 Block 5 with Crew Dragon on LC-39A — anatomy figure.
// node falcon9.mjs          -> falcon9.html
// node falcon9.mjs --light  -> falcon9-light.html
// World units are decimetres. Merlin nozzle exits at z = 0, vehicle axis at x = y = 0.
import {
  k, G, TAU, P, at, depth, r1, poly3, FZ, FRONT, pt, S, L, D,
  GROUPS, part, put, arcAt, facing, surfQuad, decal, worm, usFlag, patchSvg, liquidSvg, dome, tube, boxOn, band, fadedRibs, bandPath,
  labels, buildPage, sheen, contactShadow, member, trussFaces, accessArm, lathe, profileOf, chutesSvg, plasmaSvg, seaSvg, ripplesSvg,
} from "./lib.mjs";

const R = 18.3; // 3.66 m
const Z = {
  exit: 0, bell: 14, base: 20, thrust: 50, rp1Top: 168, loxTop: 340, s1Top: 346, isTop: 412,
  mvExit: 352, s2Top: 520, trunkTop: 557, capBody: 597, nose: 612,
};
const FC = FZ(0, 0, 0);
const DECK = { x: -140, y: -160, w: 280, d: 290, r: 3 };
const DECK_TOP = -4, DECK_T = 40;
const HOLE = { x: -30, y: -30, w: 60, d: 60 };
const TOWER = { x0: -46, x1: 46, y0: -150, y1: -70, top: 640, bay: 50, col: 7, core: { x: -30, y: -140, w: 22, d: 20, r: 1 } };

// ---------------------------------------------------------------- parts
GROUPS.push(["dragon", "Crew Dragon"], ["s2", "Second stage"], ["s1", "First stage (booster)"], ["pad", "Launch Complex 39A"]);
part("dr-nose", "dragon", "Nose cone", "hinged · opens in orbit", "Protects the docking adapter and forward Draco thrusters during ascent, then swings open on a hinge once Dragon is in orbit.");
part("dr-dock", "dragon", "Docking adapter (IDSS)", "NASA Docking System", "The ring that latches onto the space station's docking port. Hidden under the nose cone until orbit.", true);
part("dr-capsule", "dragon", "Pressure section", "4 m Ø · up to 7 seats", "The crew cabin's outer mould line: a cone of thermal tiles and SpaceX's white paint over an aluminium pressure vessel.");
part("dr-windows", "dragon", "Cabin windows", "4 windows + hatch window", "The crew's view out. The largest of Dragon's windows sits in the side hatch.");
part("dr-hatch", "dragon", "Side hatch", "crew entry", "The astronauts board through this hatch from the crew access arm's white room.");
part("dr-sd", "dragon", "SuperDraco abort engines", "8 × 71 kN · 3D-printed", "Four pods of two engines each. In an emergency they push the capsule clear of a failing rocket in less than a second; they are built into the capsule's side walls.");
part("dr-draco", "dragon", "Draco thrusters", "16 × 400 N", "Small hypergolic thrusters for attitude control and orbit adjustments.");
part("dr-shield", "dragon", "Heat shield", "PICA-X ablator", "Protects the capsule from ~1,600 °C on re-entry; SpaceX's variant of NASA's phenolic impregnated carbon ablator.");
part("dr-seats", "dragon", "Crew seats", "4 seats + touchscreens", "Carbon fibre seats with Alcantara covers, in front of three large touchscreen panels.", true);
part("dr-chutes", "dragon", "Parachutes", "2 drogues + 4 mains", "Packed around the top of the capsule; they slow Dragon for a splashdown at about 25 km/h.", true);
part("dr-trunk", "dragon", "Trunk", "3.7 m tall · unpressurised", "Carries unpressurised cargo and stabilises the capsule during an abort. It is jettisoned before re-entry and burns up.");
part("dr-solar", "dragon", "Trunk solar array", "body-mounted cells", "Solar cells laid on one half of the trunk provide Dragon's power in orbit.");
part("dr-radiator", "dragon", "Trunk radiators", "", "The other half of the trunk is a radiator that rejects the cabin's heat to space.");
part("dr-fins", "dragon", "Trunk fins", "4 fins", "Aerodynamic fins that keep Dragon stable, nose first, during an abort.");
part("s2-mvac", "s2", "Merlin Vacuum engine", "981 kN · 348 s", "A single Merlin with a huge nozzle extension for thin air. It glows orange-red while it burns.", true);
part("s2-nozzle", "s2", "MVac nozzle extension", "niobium alloy · 3.3 m exit", "Radiatively cooled: it glows red hot instead of carrying coolant. Hidden inside the interstage until stage separation.", true);
part("s2-tank", "s2", "Second stage tanks", "LOX + RP-1 · aluminium-lithium", "The upper stage is a shorter version of the first stage tank, with one engine. It carries Dragon to orbit.");
part("s2-liq", "s2", "Second stage propellant", "", "Liquid oxygen above a common dome, RP-1 kerosene below.", true);
part("s2-copv", "s2", "Helium pressure vessels", "COPVs", "Carbon-overwrapped bottles of helium that keep the tanks pressurised as they drain.", true);
part("s2-adapter", "s2", "Dragon interface ring", "", "Joins the trunk to the top of the second stage. Separation springs push Dragon away at the end of the climb.");
part("s1-interstage", "s1", "Interstage", "carbon composite · 6.7 m", "Black composite shell that joins the stages and protects the MVac nozzle. The pneumatic pushers that separate the stages sit inside.");
part("s1-grid", "s1", "Grid fins", "4 · titanium", "Folded flat for launch. They unfold after separation and steer the booster through the atmosphere on its way down to the landing.");
part("s1-cgt", "s1", "Cold gas thrusters", "nitrogen", "Puffs of nitrogen flip the booster around after separation so its engines face the way it is going.");
part("s1-lox", "s1", "LOX tank", "liquid oxygen · −207 °C (densified)", "The upper tank of the booster. SpaceX chills its propellants below their boiling points so more fits in.");
part("s1-rp1", "s1", "RP-1 tank", "rocket-grade kerosene · −7 °C", "The lower tank. The LOX for the engines passes straight through it in the downcomer pipe.");
part("s1-liq", "s1", "First stage propellant", "", "Pale blue liquid oxygen on top, amber kerosene below.", true);
part("s1-downcomer", "s1", "LOX downcomer", "through the RP-1 tank", "A pipe that carries liquid oxygen down the middle of the kerosene tank to the engines.", true);
part("s1-copv", "s1", "Helium COPVs", "submerged in the LOX", "Helium bottles stored inside the cold oxygen tank to pressurise the tanks in flight.", true);
part("s1-raceway", "s1", "Raceway", "cable tunnel", "A covered tray up the side of the booster carrying power and data cables between the stages.");
part("s1-legs", "s1", "Landing legs", "4 · carbon fibre & aluminium honeycomb", "Folded against the booster for launch. Helium pushers swing them out just before touchdown; together they span about 18 m.");
part("s1-octaweb", "s1", "Octaweb & thrust section", "", "The structure that carries all nine engines' thrust into the booster; eight engines in a ring around a centre engine.");
part("s1-shield", "s1", "Base heat shield", "", "Protects the plumbing between the engines from the heat of the plume, especially during the entry and landing burns.");
part("s1-merlin", "s1", "Merlin 1D engines (×9)", "845 kN each at sea level", "Kerosene and liquid oxygen, gas-generator cycle. Lit with a green flash of TEA-TEB, they throttle down for landing.");
part("s1-soot", "s1", "Re-entry soot", "flight-proven booster", "Kerosene soot from the booster's previous entry and landing burns. A Block 5 booster can fly again and again.");
part("s1-logo", "s1", "NASA worm & SpaceX logotype", "", "Crew missions fly the red NASA 'worm' on the booster beside the SpaceX logotype.");
part("s1-flag", "s1", "US flag", "", "Painted on the booster and on Dragon.");
part("pad-mount", "pad", "Launch mount", "concrete & steel", "The pedestal that carries the rocket over the flame trench.");
part("pad-trench", "pad", "Flame trench", "", "The opening under the engines; the exhaust is turned sideways by a deflector below.");
part("pad-clamps", "pad", "Hold-down clamps", "4", "Hold the booster down while all nine engines come up to full thrust; the computer releases them only if everything is healthy.");
part("pad-fss", "pad", "Fixed service structure", "~80 m · from the Apollo era", "The steel tower at Launch Complex 39A, first built for Apollo, rebuilt for the Shuttle and now SpaceX's crew tower.");
part("pad-caa", "pad", "Crew access arm & white room", "", "The walkway the crew cross to reach Dragon's hatch. It swings back about 40 minutes before launch.");
part("pad-te", "pad", "Transporter erector", "strongback", "Rolls the rocket out horizontally, raises it and holds it with umbilical lines until moments before launch, then tilts back.");
part("pad-mast", "pad", "Lightning mast", "", "Protects the rocket from lightning strikes on the pad.");

// ---------------------------------------------------------------- explode plan
const ASM = {
  pad: { v: [0, 0, 0], delay: 0 },
  eng: { v: [0, 0, 0], delay: 0.42 },
  s1: { v: [0, 0, 30], delay: 0.4 },
  is: { v: [0, 0, 70], delay: 0.34 },
  s2: { v: [0, 0, 120], delay: 0.26 },
  trunk: { v: [0, 0, 165], delay: 0.16 },
  cap: { v: [0, 0, 200], delay: 0.08 },
  nose: { v: [0, 0, 225], delay: 0 },
};

// ---------------------------------------------------------------- helpers
const ANG = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]; // legs and grid fins in an X
const isFront = (a) => facing(FC, a) > -0.05;
const BODY = 30;
function bodyCut(prof, layers = [{ t: 0.6, cls: "cut-white" }, { t: 0.9, cls: "cut-metal" }]) {
  return patchSvg(FC, prof, 0, Math.PI, { steps: 96, layers, limbs: false });
}
function textDecal(F, z, r, a, txt, cls, size) {
  return decal(F, z, r, a, `<g transform="rotate(90)"><text class="${cls}" font-size="${size}" text-anchor="middle" y="${size * 0.36}">${txt}</text></g>`);
}
const asc = (prof) => prof.filter((p, i, a) => i === 0 || p[0] > a[i - 1][0] + 1e-6);

// =====================================================================================
// PAD (zone 0-5)
// =====================================================================================
{
  let s = `<path class="iso-halo" d="${k.haloOf(DECK, DECK_TOP - DECK_T, DECK_T, P)}"/>`;
  s += S(k.slabOf(DECK, DECK_TOP - DECK_T, DECK_T, P, 3, 0.8));
  for (let x = DECK.x + 28; x < DECK.x + DECK.w; x += 28) {
    const segs = [];
    let cur = null;
    for (let y = DECK.y; y <= DECK.y + DECK.d; y += 2) {
      const inHole = x > HOLE.x - 6 && x < HOLE.x + HOLE.w + 6 && y > HOLE.y - 6 && y < HOLE.y + HOLE.d + 6;
      if (!inHole && y > DECK.y && y < DECK.y + DECK.d) (cur ??= []).push([x, y, DECK_TOP]);
      else if (cur) segs.push(cur), (cur = null);
    }
    if (cur) segs.push(cur);
    s += segs.map((seg) => L(poly3(seg, false), "faint")).join("");
  }
  s += L(k.planOutline(k.insetPlan(DECK, 6), DECK_TOP, P, 3), "lo");
  for (let x = DECK.x + 40; x < DECK.x + DECK.w; x += 40) s += L(poly3([[x, DECK.y + DECK.d, DECK_TOP], [x, DECK.y + DECK.d, DECK_TOP - DECK_T]], false), "faint");
  for (let y = DECK.y + 40; y < DECK.y + DECK.d; y += 40) s += L(poly3([[DECK.x + DECK.w, y, DECK_TOP], [DECK.x + DECK.w, y, DECK_TOP - DECK_T]], false), "faint");
  s += D(k.corners(DECK, 10).map(([x, y]) => at([x, y, DECK_TOP])), { size: 0.6 });
  const plate = { x: DECK.x + DECK.w - 76, y: DECK.y + DECK.d - 18, w: 58, d: 10, r: 1 };
  s += S(k.slabOf(plate, DECK_TOP, 0.5, P, 2), { crease: "none" });
  s += k.faceTextSvg(k.topMatrix([plate.x + 4, plate.y + 6.6], DECK_TOP + 0.5, P, "x"), "LAUNCH COMPLEX 39A · KSC", { size: 3.2, tone: "lo" });
  put(0, "pad-mount", "concrete", s, { asm: "pad" });
  // flame trench opening with a steel collar
  const c = [[HOLE.x, HOLE.y], [HOLE.x + HOLE.w, HOLE.y], [HOLE.x + HOLE.w, HOLE.y + HOLE.d], [HOLE.x, HOLE.y + HOLE.d]];
  const top = c.map(([x, y]) => [x, y, DECK_TOP]);
  const deep = DECK_TOP - DECK_T;
  let h = `<clipPath id="f9hole"><path d="${poly3(top)}"/></clipPath><path class="hole-void" d="${poly3(top)}"/><g clip-path="url(#f9hole)">`;
  h += `<path class="hole-wall1" d="${poly3([[HOLE.x, HOLE.y, DECK_TOP], [HOLE.x + HOLE.w, HOLE.y, DECK_TOP], [HOLE.x + HOLE.w, HOLE.y, deep], [HOLE.x, HOLE.y, deep]])}"/>`;
  h += `<path class="hole-wall2" d="${poly3([[HOLE.x, HOLE.y, DECK_TOP], [HOLE.x, HOLE.y + HOLE.d, DECK_TOP], [HOLE.x, HOLE.y + HOLE.d, deep], [HOLE.x, HOLE.y, deep]])}"/>`;
  // the deflector's curved steel face glimpsed at the bottom
  for (let i = 1; i < 6; i++) h += L(poly3([[HOLE.x, HOLE.y + (HOLE.d * i) / 6, deep + 4 + i * 2], [HOLE.x + HOLE.w, HOLE.y + (HOLE.d * i) / 6, deep + 4 + i * 2]], false), "lo");
  h += "</g>" + L(poly3(top), "hi", { className: "iso-edge" });
  const collar = { x: HOLE.x - 6, y: HOLE.y - 6, w: HOLE.w + 12, d: HOLE.d + 12, r: 1 };
  for (const [x, y, w, d] of [[collar.x, collar.y, collar.w, 6], [collar.x, HOLE.y + HOLE.d, collar.w, 6], [collar.x, HOLE.y, 6, HOLE.d], [HOLE.x + HOLE.w, HOLE.y, 6, HOLE.d]]) h += S(k.slabOf({ x, y, w, d, r: 0.3 }, DECK_TOP, 2.2, P, 2, 0.3), { crease: "none" });
  put(1, "pad-trench", "steel", h, { asm: "pad" });
}
// fixed service structure (behind) with the crew access arm
put(1, "pad-fss", "steel", trussFaces(TOWER, true), { asm: "pad" });
put(2, "pad-fss", "steel", trussFaces(TOWER, false) + S(k.slabOf({ x: TOWER.x0 - 5, y: TOWER.y0 - 5, w: TOWER.x1 - TOWER.x0 + 10, d: TOWER.y1 - TOWER.y0 + 10, r: 1 }, TOWER.top, 5, P, 2, 0.5)), { asm: "pad" });
{
  const F = FZ(-10, -112, 0);
  let s = S(G.solidOf([[TOWER.top + 5, 3.4], [TOWER.top + 14, 2.8], [TOWER.top + 60, 1.4], [TOWER.top + 78, 0.4]], F, P));
  for (const z of [TOWER.top + 30, TOWER.top + 48]) s += L(arcAt(F, z, 2.8 - ((z - TOWER.top - 14) / 46) * 1.4 + 0.1), "lo");
  put(2, "pad-mast", "white", s, { asm: "pad" });
}
{
  // crew access arm at the hatch, with the white room at its end
  const z = 572, reach = -R - 3;
  let s = accessArm(0, TOWER.y1, reach - 12, z, 9, 9);
  s += S(k.slabOf({ x: -9, y: reach - 13, w: 18, d: 12, r: 0.8 }, z - 3, 15, P, 2, 0.4), { crease: "faint" });
  s += L(k.sideSeam({ x: -9, y: reach - 13, w: 18, d: 12, r: 0.8 }, z + 6, P, 2), "faint");
  put(3, "pad-caa", "white", s, { asm: "pad", attrs: ' data-arm=""' });
}
// transporter erector: a strongback truss tilted back from the rocket
{
  const y0 = -42, tilt = 0.035, top = 520;
  const yAt = (z) => y0 - z * tilt;
  let s = "";
  const xs = [-9, 9];
  for (const x of xs) s += member([x, yAt(0), DECK_TOP], [x, yAt(top), top], 2.4);
  for (let z = 0; z < top; z += 30) {
    s += member([xs[0], yAt(z), z], [xs[1], yAt(z + 30), z + 30], 1.1) + member([xs[0], yAt(z), z], [xs[1], yAt(z), z], 1.3);
  }
  s += member([xs[0], yAt(top), top], [xs[1], yAt(top), top], 1.6);
  // hinge block on the deck
  s += S(k.slabOf({ x: -16, y: y0 - 8, w: 32, d: 14, r: 1 }, DECK_TOP, 12, P, 2, 0.4));
  put(3, "pad-te", "steel", s, { asm: "pad", attrs: ' data-arm=""' });
}
// hold-down clamps (back pair before the vehicle, front pair after)
function clamp(a) {
  const rad = G.radialOf(FC, a);
  const c = [rad[0] * (R + 7), rad[1] * (R + 7)];
  let s = S(k.slabOf({ x: c[0] - 5, y: c[1] - 5, w: 10, d: 10, r: 0.8 }, DECK_TOP, Z.base - DECK_TOP - 2, P, 2, 0.4));
  s += L(k.sideSeam({ x: c[0] - 5, y: c[1] - 5, w: 10, d: 10, r: 0.8 }, 6, P, 2), "faint");
  // clamp jaw reaching the octaweb
  const p0 = [c[0], c[1], Z.base - 2], p1 = [rad[0] * (R - 1), rad[1] * (R - 1), Z.base - 2];
  s += tube([p0, p1], 1.5) + S(G.sphereOf(p0, 2.2, P));
  return s;
}
put(4, "pad-mount", "concrete", contactShadow(0, 0, DECK_TOP, 24, 0.34), { asm: "pad" });
for (const a of ANG.filter((a) => !isFront(a))) put(5, "pad-clamps", "steel", clamp(a), { asm: "pad" });

// =====================================================================================
// FIRST STAGE
// =====================================================================================
const BELL = (z) => 4.6 - 2.5 * Math.pow(z / Z.bell, 0.8);
const ENG = [[0, 0], ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * TAU + Math.PI / 8; return [Math.cos(a) * 12.8, Math.sin(a) * 12.8]; })].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
function merlin(x, y) {
  const F = FZ(x, y, 0);
  let s = S(G.solidOf(profileOf(0, Z.bell, BELL, 14), F, P, { smooth: true }), { crease: "none" });
  s += S(G.solidOf([[-0.4, BELL(0) + 0.25], [0.6, BELL(0) + 0.25]], F, P), { crease: "none" });
  s += k.fadedSvg(G.ribsOf(F, 1, Z.bell - 1, BELL(1), 40, P, { r1: BELL(Z.bell - 1), fade: [0.05, 0.5] }), { tone: "faint" });
  s += L(arcAt(F, 7, BELL(7)), "lo");
  return s;
}
for (const [x, y] of ENG) put(BODY, "s1-merlin", "engine", merlin(x, y), { asm: "eng" });
// base heat shield and octaweb skirt
{
  const F = FC;
  let s = S(G.solidOf([[Z.bell - 0.5, R - 1.2], [Z.base, R - 0.4], [Z.base + 2, R]], F, P), { crease: "lo" });
  s += L(arcAt(F, Z.bell + 2, R - 1), "faint");
  put(BODY, "s1-shield", "carbon", s, { asm: "s1" });
  let o = S(G.solidOf([[Z.base + 2, R], [Z.thrust, R]], F, P), { crease: "none" });
  o += L(arcAt(F, Z.base + 4, R), "lo") + L(arcAt(F, Z.thrust - 2, R), "lo");
  o += D(G.dotsOf(F, Z.base + 6, R, 64, P, { fade: [0.04, 0.42] }), { size: 0.28, tone: "lo" });
  o += k.fadedSvg(G.ribsOf(F, Z.base + 7, Z.thrust - 4, R, 48, P, { fade: [0.05, 0.45] }), { tone: "faint" });
  put(BODY, "s1-octaweb", "white", o, { asm: "s1", view: "whole" });
  put(BODY, "s1-octaweb", "white", bodyCut([[Z.base + 2, R], [Z.thrust, R]]), { asm: "s1", view: "cut" });
}
// landing legs: back pair drawn before the tanks, front pair after
function leg(a) {
  const F = FC;
  let s = "";
  const z0 = Z.base + 1, z1 = 128;
  // tapered carbon leg: a box on the body face, narrower at the top
  const rad = G.radialOf(F, a);
  const tan = G.unit3(G.add3(G.mul3(F.u, -Math.sin(a)), G.mul3(F.v, Math.cos(a))));
  const o = G.mul3(rad, R - 0.3);
  const Fb = G.frameOf([o[0], o[1], 0], [0, 0, 1], tan, rad);
  const shape = (w, d) => [[-w / 2, 0], [w / 2, 0], [w / 2, d], [-w / 2, d]];
  s += S(G.prismOf(Fb, shape(8.4, 2.4), z0, z0 + 26, P), { crease: "faint" });
  s += S(G.prismOf(Fb, shape(6.6, 2.0), z0 + 26, z1 - 10, P), { crease: "faint" });
  s += S(G.prismOf(Fb, shape(4.2, 1.6), z1 - 10, z1, P), { crease: "faint" });
  // foot and the telescoping pusher housing
  s += S(G.prismOf(Fb, shape(10.5, 3.4), z0 - 3, z0 + 3, P), { crease: "none" });
  s += S(G.prismOf(Fb, shape(2.2, 3.2), z0 + 30, z0 + 70, P), { crease: "none" });
  s += L(poly3([pt(F, z0 + 34, R + 3.2, a), pt(F, z0 + 66, R + 3.2, a)], false), "faint");
  s += D([at(pt(F, z1 - 4, R + 1.7, a)), at(pt(F, z0 + 12, R + 2.5, a))], { size: 0.45, tone: "lo" });
  return s;
}
for (const a of ANG.filter((a) => !isFront(a))) put(BODY - 2, "s1-legs", "carbon", leg(a), { asm: "s1" });
// RP-1 and LOX tanks
const RP1_PROF = asc([...dome(Z.thrust, 12, R - 0.6, false).reverse(), [Z.rp1Top - 2, R - 0.6], ...dome(Z.rp1Top - 2, 10, R - 0.6, true).slice(1)]);
const LOX_PROF = asc([...dome(Z.rp1Top + 2, 10, R - 0.6, false).reverse(), [Z.loxTop - 2, R - 0.6], ...dome(Z.loxTop - 2, 12, R - 0.6, true).slice(1)]);
{
  const F = FC;
  let s = S(G.solidOf([[Z.thrust, R], [Z.rp1Top, R]], F, P), { crease: "none" });
  for (const z of [80, 110, 140]) s += L(arcAt(F, z, R), "faint");
  s += L(arcAt(F, Z.thrust + 1.5, R), "lo");
  put(BODY, "s1-rp1", "white", s, { asm: "s1", view: "whole" });
  put(BODY, "s1-rp1", "white", bodyCut([[Z.thrust, R], [Z.rp1Top, R]]), { asm: "s1", view: "cut" });
  put(BODY, "s1-liq", "white", liquidSvg(F, RP1_PROF, Z.rp1Top - 10, "liq-rp1"), { asm: "s1", view: "cut" });
  // downcomer through the kerosene tank
  put(BODY, "s1-downcomer", "silver", tube([[0, 0, Z.thrust - 4], [0, 0, Z.rp1Top + 4]], 2.2), { asm: "s1", view: "cut" });
  let t = S(G.solidOf([[Z.rp1Top, R], [Z.loxTop + 4, R]], F, P), { crease: "none" });
  for (const z of [200, 232, 264, 296]) t += L(arcAt(F, z, R), "faint");
  t += L(arcAt(F, Z.rp1Top, R), "lo");
  t += D(G.dotsOf(F, Z.rp1Top + 2, R, 72, P, { fade: [0.04, 0.42] }), { size: 0.26, tone: "lo" });
  put(BODY, "s1-lox", "white", t, { asm: "s1", view: "whole" });
  put(BODY, "s1-rp1", "white", sheen(F, Z.thrust, Z.loxTop + 4, R, { strength: 0.26 }), { asm: "s1", view: "whole" });
  put(BODY, "s1-lox", "white", bodyCut([[Z.rp1Top, R], [Z.loxTop + 4, R]]), { asm: "s1", view: "cut" });
  put(BODY, "s1-liq", "white", liquidSvg(F, LOX_PROF, Z.loxTop - 20, "liq-lox"), { asm: "s1", view: "cut" });
  let cp = "";
  for (const [a, z] of [[2.2, 300], [1.2, 300], [1.7, 318], [2.6, 318], [0.8, 318]]) {
    const c = pt(F, z, 9, a);
    cp += S(G.solidOf([[0, 0, 1], [1.2, 2.6, 1], [9, 2.6, 1], [10.2, 0, 1]], G.frameAlong(c, [0, 0, 1]), P, { smooth: true }));
  }
  put(BODY, "s1-copv", "carbon", cp, { asm: "s1", view: "cut" });
  // re-entry soot: darker toward the top and near the engines, in vertical streaks
  let soot = "";
  const bands = [[Z.loxTop - 70, Z.loxTop + 4, 0.05, 0.42], [Z.thrust, Z.thrust + 46, 0.3, 0.04]];
  for (const [za, zb, oa, ob] of bands) {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const z0 = za + ((zb - za) * i) / n, z1 = za + ((zb - za) * (i + 1)) / n;
      const op = oa + ((ob - oa) * (i + 0.5)) / n;
      soot += `<path class="soot" opacity="${op.toFixed(3)}" d="${bandPath(F, z0, z1 + 0.3, R + 0.04)}"/>`;
    }
  }
  for (let i = 0; i < 26; i++) {
    const a = FRONT + (i / 26 - 0.5) * 2.9 + Math.sin(i * 7.3) * 0.05;
    if (facing(F, a) < 0.1) continue;
    const z1 = Z.loxTop + 2, z0 = z1 - 40 - ((i * 37) % 70);
    soot += `<path class="soot" opacity="${(0.12 + ((i * 13) % 7) * 0.025).toFixed(3)}" d="${surfQuad(F, z0, z1, R + 0.05, R + 0.05, a - 0.018, a + 0.018, 1)}"/>`;
  }
  put(BODY, "s1-soot", "white", soot, { asm: "s1", view: "whole" });
  // logotypes and the flag
  let lg = textDecal(F, 212, R + 0.06, FRONT + 0.22, "SPACEX", "sx-logo", 9.5);
  lg += decal(F, 120, R + 0.06, FRONT - 0.32, worm(7.4, { vertical: true }));
  put(BODY, "s1-logo", "white", lg, { asm: "s1", view: "whole" });
  put(BODY, "s1-flag", "white", decal(F, 300, R + 0.06, FRONT - 0.3, `<g transform="rotate(90)">${usFlag(11)}</g>`), { asm: "s1", view: "whole" });
}
// raceway up the side of the booster
{
  const a = FRONT + 0.95;
  let s = S(boxOn(FC, a, R - 0.3, 1.6, 2.8, Z.thrust + 2, Z.loxTop + 2), { crease: "faint" });
  for (let z = Z.thrust + 20; z < Z.loxTop; z += 28) s += S(boxOn(FC, a, R - 0.3, 2.1, 3.8, z, z + 1.2), { crease: "none" });
  put(BODY, "s1-raceway", "white", s, { asm: "s1", view: "whole" });
}
for (const a of ANG.filter(isFront)) put(BODY, "s1-legs", "carbon", leg(a), { asm: "s1" });

// =====================================================================================
// INTERSTAGE + MVAC (the nozzle is drawn first so the interstage hides it)
// =====================================================================================
const MV = (z) => 4.2 + 11.8 * Math.pow((392 - z) / 40, 0.9);
{
  const F = FC;
  let n = S(G.solidOf(profileOf(Z.mvExit, 392, MV, 18), F, P, { smooth: true }), { crease: "none" });
  n += L(arcAt(F, Z.mvExit + 1, MV(Z.mvExit + 1)), "lo") + L(arcAt(F, 376, MV(376), (MV(376.5) - MV(375.5))), "faint");
  put(BODY, "s2-nozzle", "niobium", n, { asm: "s2" });
  let e = S(G.solidOf([[392, 4.2], [398, 5.6], [404, 5.6], [407, 3.8]], F, P));
  e += S(G.solidOf([[396, 1.8], [404, 1.8]], FZ(6.5, 0), P)) + tube([[5, -3, 403], [10, -8, 410]], 0.6);
  put(BODY, "s2-mvac", "engine", e, { asm: "s2" });
}
{
  const F = FC;
  let s = S(G.solidOf([[Z.s1Top - 6, R + 0.05], [Z.isTop, R + 0.05]], F, P), { crease: "none" });
  s += k.fadedSvg(G.ribsOf(F, Z.s1Top - 4, Z.isTop - 3, R + 0.05, 56, P, { fade: [0.05, 0.5] }), { tone: "faint" });
  for (const z of [Z.s1Top - 4, 386, Z.isTop - 2]) s += L(arcAt(F, z, R + 0.05), "lo");
  s += textDecal(F, 368, R + 0.1, FRONT + 0.45, "FALCON 9", "sx-logo w", 5.4);
  put(BODY, "s1-interstage", "black", s + sheen(F, Z.s1Top - 6, Z.isTop, R + 0.05, { strength: 0.16, width: 0.1 }), { asm: "is", view: "whole" });
  put(BODY, "s1-interstage", "black", bodyCut([[Z.s1Top - 6, R + 0.05], [Z.isTop, R + 0.05]], [{ t: 0.8, cls: "cut-carbon" }]), { asm: "is", view: "cut" });
  // cold gas thruster pods (two, opposite)
  let c = "";
  for (const a of [0, Math.PI]) {
    if (facing(F, a) < -0.2) continue;
    c += S(boxOn(F, a, R - 0.2, 2.4, 6, 401, 408), { crease: "faint" });
    c += `<ellipse class="port" cx="${r1(at(pt(F, 404.5, R + 2.5, a))[0])}" cy="${r1(at(pt(F, 404.5, R + 2.5, a))[1])}" rx="0.9" ry="1.3"/>`;
  }
  put(BODY + 1, "s1-cgt", "black", c, { asm: "is" });
}
// grid fins, stowed flat: a titanium lattice in a frame
function gridFin(a) {
  const F = FC;
  const z0 = 389, z1 = 405, w = 13;
  let s = S(boxOn(F, a, R + 0.2, 1.6, w, z0, z1), { crease: "none" });
  const rad = G.radialOf(F, a);
  const tan = G.unit3(G.add3(G.mul3(F.u, -Math.sin(a)), G.mul3(F.v, Math.cos(a))));
  const o = (u, z) => G.add3(G.add3(G.mul3(rad, R + 1.85), G.mul3(tan, u)), [0, 0, z]);
  let lat = "";
  for (let i = -5; i <= 5; i++) {
    const u = (i / 5.5) * (w / 2 - 0.8);
    lat += poly3([o(u - 3, z0 + 0.8), o(u + 3, z1 - 0.8)].map((p) => p), false) + poly3([o(u + 3, z0 + 0.8), o(u - 3, z1 - 0.8)], false);
  }
  s += `<g clip-path="none">${L(lat, "lo")}</g>`;
  s += S(boxOn(F, a, R + 0.2, 2.6, 3.4, z1, z1 + 3), { crease: "none" });
  return s;
}
for (const a of ANG) if (facing(FC, a) > -0.3) put(BODY + 1, "s1-grid", "ti", gridFin(a), { asm: "is" });

// =====================================================================================
// SECOND STAGE
// =====================================================================================
const S2_PROF = asc([...dome(Z.isTop + 2, 8, R - 0.6, false).reverse(), [Z.s2Top - 6, R - 0.6], ...dome(Z.s2Top - 6, 10, R - 0.6, true).slice(1)]);
{
  const F = FC;
  let s = S(G.solidOf([[Z.isTop, R], [Z.s2Top, R]], F, P), { crease: "none" });
  for (const z of [440, 470, 500]) s += L(arcAt(F, z, R), "faint");
  s += L(arcAt(F, Z.isTop + 1.5, R), "lo") + L(arcAt(F, Z.s2Top - 1.5, R), "lo");
  s += D(G.dotsOf(F, Z.s2Top - 3.5, R, 72, P, { fade: [0.04, 0.42] }), { size: 0.26, tone: "lo" });
  s += textDecal(F, 466, R + 0.06, FRONT + 0.35, "SPACEX", "sx-logo", 6.6);
  put(BODY, "s2-tank", "white", s + sheen(F, Z.isTop, Z.s2Top, R, { strength: 0.26 }), { asm: "s2", view: "whole" });
  put(BODY, "s2-tank", "white", bodyCut([[Z.isTop, R], [Z.s2Top, R]]), { asm: "s2", view: "cut" });
  put(BODY, "s2-liq", "white", liquidSvg(F, S2_PROF, 455, "liq-rp1") + liquidSvg(F, asc([[458, 0.01], [460, R - 0.6], [Z.s2Top - 6, R - 0.6], ...dome(Z.s2Top - 6, 10, R - 0.6, true).slice(1)]), 502, "liq-lox"), { asm: "s2", view: "cut" });
  let cp = "";
  for (const a of [1.0, 2.1]) cp += S(G.sphereOf(pt(F, 508, 9, a), 3.6, P));
  put(BODY, "s2-copv", "carbon", cp, { asm: "s2", view: "cut" });
  // the dome line inside the cut
  put(BODY, "s2-tank", "white", L(arcAt(F, 458, R - 1.6, 0, { inward: true }), "lo"), { asm: "s2", view: "cut" });
}
// interface ring
put(BODY, "s2-adapter", "silver", S(G.solidOf([[Z.s2Top, R + 0.3], [Z.s2Top + 3, R + 0.3]], FC, P), { crease: "none" }) + D(G.dotsOf(FC, Z.s2Top + 1.5, R + 0.3, 56, P, { fade: [0.04, 0.42] }), { size: 0.3, tone: "lo" }), { asm: "s2" });

// =====================================================================================
// CREW DRAGON
// =====================================================================================
const TR = 18.6;
{
  const F = FC;
  // trunk: solar cells on the back half, radiator on the front half
  const z0 = Z.s2Top + 3, z1 = Z.trunkTop;
  let s = S(G.solidOf([[z0, TR], [z1, TR]], F, P), { crease: "none" });
  s += L(arcAt(F, z0 + 1.5, TR), "lo") + L(arcAt(F, z1 - 1.5, TR), "lo");
  // radiator panel seams on the front half
  for (let i = 0; i < 12; i++) {
    const a = FRONT - 1.1 + i * 0.2;
    if (facing(F, a) < 0.1) continue;
    s += L(poly3([pt(F, z0 + 2, TR + 0.05, a), pt(F, z1 - 2, TR + 0.05, a)], false), "faint");
  }
  put(BODY, "dr-radiator", "white", s, { asm: "trunk" });
  // solar cells: a dark band on the sides that face away
  let c = "";
  const a0 = FRONT + 1.2, a1 = FRONT + 2 * Math.PI - 1.2;
  for (let a = a0; a < a1; a += 0.08) {
    if (facing(F, a + 0.04) < 0.04) continue;
    c += `<path class="cellq" d="${surfQuad(F, z0 + 3, z1 - 3, TR + 0.06, TR + 0.06, a, a + 0.075, 1)}"/>`;
  }
  put(BODY, "dr-solar", "solar", c, { asm: "trunk" });
  // fins
  let fn = "";
  for (const a of [FRONT + Math.PI / 4, FRONT - Math.PI / 4, FRONT + (3 * Math.PI) / 4, FRONT - (3 * Math.PI) / 4]) {
    if (facing(F, a) < -0.1) continue;
    const rad = G.radialOf(F, a);
    const tan = G.unit3(G.add3(G.mul3(F.u, -Math.sin(a)), G.mul3(F.v, Math.cos(a))));
    const o = G.mul3(rad, TR - 0.2);
    const Fb = G.frameOf([o[0], o[1], 0], [0, 0, 1], tan, rad);
    fn += S(G.prismOf(Fb, [[-0.6, 0], [0.6, 0], [0.6, 5.5], [-0.6, 5.5]], z0 + 1, z0 + 14, P), { crease: "none" });
  }
  put(BODY, "dr-fins", "white", fn, { asm: "trunk" });
}
const CAP = (z) => (z < 561 ? 18.6 : 18.6 - ((z - 561) / (Z.capBody - 561)) * 8.8);
{
  const F = FC;
  // heat shield peeks out as a dark band under the capsule
  put(BODY, "dr-shield", "avcoat", S(G.solidOf([[Z.trunkTop, 18.9], [Z.trunkTop + 2.4, 18.9], [Z.trunkTop + 4, 18.6]], F, P), { crease: "none" }), { asm: "cap" });
  let s = S(G.solidOf([[Z.trunkTop + 4, 18.6], [561, 18.6], [Z.capBody, CAP(Z.capBody)]], F, P), { crease: "lo" });
  const slope = -8.8 / (Z.capBody - 561);
  for (const z of [570, 582, 592]) s += L(arcAt(F, z, CAP(z), slope), "faint");
  s += k.fadedSvg(G.ribsOf(F, 562, Z.capBody - 2, CAP(562), 36, P, { r1: CAP(Z.capBody - 2), fade: [0.05, 0.5] }), { tone: "faint" });
  s += decal(F, 573, CAP(573) + 0.06, FRONT + 0.55, usFlag(5.6), slope);
  s += decal(F, 584, CAP(584) + 0.06, FRONT - 0.5, `<text class="sx-logo" font-size="2.6" text-anchor="middle">SPACEX</text>`, slope);
  put(BODY, "dr-capsule", "white", s, { asm: "cap", view: "whole" });
  put(BODY, "dr-capsule", "white", bodyCut([[Z.trunkTop + 4, 18.6], [561, 18.6], [Z.capBody, CAP(Z.capBody)]]), { asm: "cap", view: "cut" });
  // windows and hatch
  let w = "";
  for (const a of [FRONT - 0.9, FRONT + 0.9, FRONT + 2.2]) {
    if (facing(F, a, slope) < 0.15) continue;
    w += `<path class="window" d="${surfQuad(F, 585, 590, CAP(585) + 0.1, CAP(590) + 0.1, a - 0.13, a + 0.13, 3)}"/>`;
  }
  put(BODY, "dr-windows", "white", w, { asm: "cap", view: "whole" });
  put(BODY, "dr-hatch", "white", L(surfQuad(F, 568, 586, CAP(568) + 0.1, CAP(586) + 0.1, FRONT - 0.26, FRONT + 0.26, 4), "mid") + `<path class="window" d="${surfQuad(F, 579, 583, CAP(579) + 0.12, CAP(583) + 0.12, FRONT - 0.08, FRONT + 0.08, 2)}"/>`, { asm: "cap", view: "whole" });
  // SuperDraco pods: raised fairings with a pair of nozzle openings each
  let sd = "";
  for (const a of [FRONT + Math.PI / 4, FRONT - Math.PI / 4, FRONT + (3 * Math.PI) / 4, FRONT - (3 * Math.PI) / 4]) {
    if (facing(F, a, slope) < 0.1) continue;
    sd += `<path class="sd-pod" d="${surfQuad(F, 566, 579, CAP(566) + 0.5, CAP(579) + 0.5, a - 0.16, a + 0.16, 3)}"/>`;
    for (const da of [-0.07, 0.07]) sd += `<path class="port" d="${surfQuad(F, 566.5, 569, CAP(566.5) + 0.55, CAP(569) + 0.55, a + da - 0.04, a + da + 0.04, 1)}"/>`;
  }
  put(BODY, "dr-sd", "white", sd, { asm: "cap", view: "whole" });
  let dr = "";
  for (const a of [FRONT + 0.25, FRONT - 1.35, FRONT + 1.6]) {
    if (facing(F, a, slope) < 0.15) continue;
    dr += `<ellipse class="port" cx="${r1(at(pt(F, 593, CAP(593) + 0.1, a))[0])}" cy="${r1(at(pt(F, 593, CAP(593) + 0.1, a))[1])}" rx="0.7" ry="0.5"/>`;
  }
  put(BODY, "dr-draco", "white", dr, { asm: "cap", view: "whole" });
  // inside: seats and touchscreens, parachutes around the top
  let seats = "";
  for (const [x, y] of [[-8, -4], [-2.7, -6], [2.7, -6], [8, -4]]) {
    const Fs = FZ(x, y, 0);
    seats += S(G.prismOf(G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[-2.2, -2], [2.2, -2], [2.2, 2.5], [-2.2, 2.5]], 568, 570, P), { crease: "none" });
    seats += S(G.prismOf(G.frameOf([x, y - 2.2, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[-2.2, -0.6], [2.2, -0.6], [2.2, 0.6], [-2.2, 0.6]], 570, 576, P), { crease: "none" });
  }
  seats += S(G.prismOf(G.frameOf([0, -13, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[-9, -0.5], [9, -0.5], [9, 0.5], [-9, 0.5]], 578, 584, P), { crease: "none" });
  put(BODY, "dr-seats", "carbon", seats, { asm: "cap", view: "cut" });
  let ch = "";
  for (const a of [Math.PI * 0.3, Math.PI * 0.55, Math.PI * 0.8]) ch += S(G.solidOf([[0, 0, 1], [1, 2.1, 1], [4, 2.1, 1], [5, 0, 1]], G.frameAlong(pt(F, 590, 7, a), [0, 0, 1]), P, { smooth: true }));
  put(BODY, "dr-chutes", "chute", ch, { asm: "cap", view: "cut" });
  put(BODY, "dr-dock", "silver", S(G.solidOf([[Z.capBody - 1, 8.4], [Z.capBody + 3, 8.4], [Z.capBody + 3.6, 7.6]], F, P), { crease: "none" }), { asm: "cap", view: "cut" });
}
// nose cone (hinged at the front-right)
{
  const F = FC;
  const prof = [];
  for (let i = 0; i <= 14; i++) {
    const t = (i / 14) * (Math.PI / 2);
    prof.push([Z.capBody + (Z.nose - Z.capBody) * Math.sin(t), CAP(Z.capBody) * Math.cos(t), 1]);
  }
  prof[0] = [Z.capBody, CAP(Z.capBody) + 0.3];
  prof[14] = [Z.nose, 0];
  let s = S(G.solidOf(prof, F, P, { smooth: true }));
  s += L(arcAt(F, Z.capBody + 0.6, CAP(Z.capBody) + 0.2), "lo");
  s += S(boxOn(F, FRONT + 0.9, CAP(Z.capBody) - 0.4, 1.6, 4, Z.capBody - 1, Z.capBody + 3), { crease: "none" });
  put(BODY + 2, "dr-nose", "white", s, { asm: "nose" });
}
// coming home (return scene only): plasma, parachutes, and a patch of ocean
{
  const [back, shock] = plasmaSvg([0, 0, Z.trunkTop - 1], 19, { wake: 7 });
  put(BODY - 2, "fx", "none", back, { asm: "glow" });
  put(BODY + 8, "fx", "none", shock, { asm: "glow" });
  put(BODY + 6, "fx", "none", chutesSvg(1, [0, 0, Z.nose - 6], { n: 2, spread: 5, height: 55, R: 7, bands: false }), { asm: "cap" });
  put(BODY + 7, "fx", "none", chutesSvg(2, [0, 0, Z.nose - 6], { n: 4, spread: 36, height: 120, R: 30 }), { asm: "cap" });
  put(3, "fx", "none", `<g class="m-sea">${seaSvg(Z.trunkTop + 4, 900)}</g>` + ripplesSvg(Z.trunkTop + 4, 24), { asm: "sea", attrs: ' data-retonly=""' });
}

// front hold-down clamps after the vehicle
for (const a of ANG.filter(isFront)) put(45, "pad-clamps", "steel", clamp(a), { asm: "pad" });

// =====================================================================================
// FALLBACK PLUMES, FX DATA, LABELS
// =====================================================================================
import { flamePath, plumeGroup } from "./lib.mjs";
{
  const [ex, ey] = at([0, 0, 0]);
  put(44, "fx", "none", plumeGroup("merlin", ex, ey, `<path class="pl pl-flick" fill="url(#g-ker)" d="${flamePath(ex, ey, 300, (u) => 18 * (1 + 0.5 * Math.sqrt(u)) * (1 - u ** 3))}"/>`), { asm: "eng" });
  const [mx, my] = at([0, 0, Z.mvExit]);
  put(30, "fx", "none", plumeGroup("mvac", mx, my, `<path class="pl pl-flick" fill="url(#g-ker)" opacity=".6" d="${flamePath(mx, my, 220, (u) => 16 * (1 + 3 * u) * (1 - u ** 2))}"/>`), { asm: "s2" });
}
const FLIGHT = {
  pivot: { cap: at([0, 0, 580]), s1: at([0, 0, 220]), nose: at([18, 0, Z.capBody]) },
  y0: at([0, 0, 0])[1],
  dz: at([0, 0, 1])[1] - at([0, 0, 0])[1],
  cx: at([0, 0, 300])[0],
};
const FXD = {
  sources: [
    { id: "m1d", asm: "eng", p: [0, 0, 0], re: 18, d: [0, 0, -1], kind: 2, len: 320, rings: [[1, 0], [8, 12.8]], er: 4.6, seed: 1.3 },
    { id: "mvac", asm: "s2", p: [0, 0, Z.mvExit], re: 16, d: [0, 0, -1], kind: 2, len: 260, ex: 1, seed: 4.1 },
    { id: "cgt", asm: "is", p: [R + 2.5, 0, 404.5], re: 1.4, d: [1, 0, 0], kind: 4, len: 70, seed: 2.2 },
    { id: "cgt", asm: "is", p: [-R - 2.5, 0, 404.5], re: 1.4, d: [-1, 0, 0], kind: 4, len: 70, seed: 3.2 },
  ],
  occ: [
    { asm: "s1", x: 0, y: 0, z0: Z.bell - 0.5, z1: Z.s1Top - 6, r0: R, r1: R },
    { asm: "is", x: 0, y: 0, z0: Z.s1Top - 6, z1: Z.isTop, r0: R + 0.1, r1: R + 0.1 },
    { asm: "s2", x: 0, y: 0, z0: Z.isTop, z1: Z.s2Top + 3, r0: R, r1: R },
    { asm: "s2", x: 0, y: 0, z0: Z.mvExit, z1: 392, r0: MV(Z.mvExit), r1: 4.2, hot: "mvac" },
    { asm: "trunk", x: 0, y: 0, z0: Z.s2Top + 3, z1: Z.trunkTop, r0: TR, r1: TR },
    { asm: "cap", x: 0, y: 0, z0: Z.trunkTop, z1: Z.capBody, r0: 18.8, r1: CAP(Z.capBody) },
    { asm: "nose", x: 0, y: 0, z0: Z.capBody, z1: Z.nose - 3, r0: CAP(Z.capBody), r1: 5 },
    ...ENG.map(([x, y]) => ({ asm: "eng", x, y, z0: 0, z1: Z.bell, r0: BELL(0), r1: BELL(Z.bell) })),
  ],
  deck: { asm: "pad", rect: [DECK.x, DECK.y, DECK.x + DECK.w, DECK.y + DECK.d], top: DECK_TOP, bottom: DECK_TOP - DECK_T, holes: [[HOLE.x, HOLE.y, HOLE.x + HOLE.w, HOLE.y + HOLE.d]] },
};
const LABELS = [
  ["dr-nose", pt(FC, 606, 6, FRONT), "L", "Nose cone (hinged)", "nose"],
  ["dr-windows", pt(FC, 588, CAP(588), FRONT - 0.9), "L", "Crew Dragon capsule", "cap"],
  ["dr-sd", pt(FC, 572, CAP(572) + 0.5, FRONT - Math.PI / 4), "L", "SuperDraco abort engines", "cap"],
  ["dr-shield", pt(FC, Z.trunkTop + 1, 18.9, FRONT), "L", "PICA-X heat shield", "cap"],
  ["dr-radiator", pt(FC, 545, TR, FRONT), "L", "Trunk: radiator + solar cells", "trunk"],
  ["s2-tank", pt(FC, 470, R, FRONT), "L", "Second stage", "s2"],
  ["s1-interstage", pt(FC, 380, R, FRONT), "L", "Interstage (MVac inside)", "is"],
  ["s1-lox", pt(FC, 270, R, FRONT), "L", "LOX tank", "s1"],
  ["s1-rp1", pt(FC, 110, R, FRONT), "L", "RP-1 kerosene tank", "s1"],
  ["s1-octaweb", pt(FC, 34, R, FRONT), "L", "Octaweb thrust section", "s1"],
  ["s1-merlin", [12.8 * Math.cos(Math.PI / 8 + Math.PI / 4 * 2), 12.8 * Math.sin(Math.PI / 8 + Math.PI / 4 * 2), 5], "L", "9 × Merlin 1D", "eng"],
  ["s1-grid", pt(FC, 398, R + 1.6, FRONT + Math.PI / 4), "R", "Grid fins (stowed)", "is"],
  ["s1-cgt", pt(FC, 404, R + 2, 0), "R", "Cold gas thrusters", "is"],
  ["s1-soot", pt(FC, 330, R, FRONT + 0.6), "R", "Re-entry soot", "s1"],
  ["s1-raceway", pt(FC, 230, R + 1.5, FRONT + 0.95), "R", "Raceway", "s1"],
  ["s1-legs", pt(FC, 90, R + 2.2, FRONT + Math.PI / 4), "R", "Landing legs (folded)", "s1"],
  ["pad-clamps", [R + 7, 0, 6], "R", "Hold-down clamps", "pad"],
  ["pad-mount", [DECK.x + DECK.w - 20, DECK.y + DECK.d, DECK_TOP - 10], "R", "Launch mount, LC-39A", "pad"],
];
labels(LABELS, { L: -190, R: 190 });

// =====================================================================================
// MISSION
// =====================================================================================
const MISSION = String.raw`
// ---- Crew Dragon ascent (a Crew rotation flight), time-warped
const T_START = -6, T_END = 760;
const WIN = [[-6, 14, 1], [140, 175, 4], [520, 540, 6], [700, 760, 12]];
function speedAt(t) { let b = t < 12 ? 1 : t < 60 ? 1 + (t - 12) * 0.45 : t < 400 ? 22 : 30; for (const [a, z, v] of WIN) if (t >= a && t <= z) b = Math.min(b, v); return b; }
const ALT = [[-6, 0], [0, 0], [10, 0.15], [30, 1.6], [60, 7], [72, 11], [100, 25], [150, 66], [200, 110], [300, 160], [400, 185], [530, 200], [T_END, 205]];
const VEL = [[-6, 0], [0, 0], [10, 120], [30, 560], [60, 1500], [72, 1900], [100, 3300], [150, 7700], [200, 9100], [300, 13000], [400, 18000], [530, 27200], [T_END, 27400]];
const EVENTS = [[-3, "Merlin ignition · TEA-TEB green flash", 3], [0, "Hold-down release · LIFTOFF", 8], [12, "Clearing the tower", 8], [56, "Transonic: vapour cone", 10], [72, "Max-Q", 10], [150, "MECO · main engine cutoff", 3], [153, "Stage separation", 6], [160, "Second stage ignition (MVac)", 14], [168, "Booster flips with cold gas thrusters", 30], [528, "SECO · second stage cutoff", 30], [700, "Dragon separates", 40], [730, "Nose cone opens", 30]];
// ---- the rest of the flight on the mission map: booster landing, ISS rendezvous, a six-month stay, splashdown
const MAP = (() => {
  const { orb, fix, path, drift, dock, ang } = MM;
  const PI = Math.PI, DAY = 86400;
  const ins = orb("earth", 200, 210, PI / 2 + 0.32, 528);
  const site0 = ang(ins, 528) - 0.32, ship = site0 + 0.0881;    // LC-39A and the droneship ~560 km downrange
  const tDock = 100800, tUndock = tDock + 180 * DAY, tD = tUndock + 54000, tSplash = tD + 3150, END = tSplash + 3000;
  const phase = drift("earth", [[3000, 205], [20000, 250], [60000, 380], [95000, 415], [tDock - 1500, 419], [tDock, 420]], ang(ins, 3000));
  const iss = orb("earth", 420, 420, ang(phase, tDock), tDock);
  const home = drift("earth", [[tUndock, 420], [tUndock + 3000, 412], [tUndock + 30000, 380], [tD, 360]], ang(iss, tUndock));
  const d = ang(home, tD);
  const dragon = {
    id: "dragon", col: "#ffd29a", name: [[-1e9, "Falcon 9"], [153, "Crew Dragon"]],
    g: [[-1e9, "f9"], [153, "stack"], [700, "dragon"], [tD - 600, "capsule"]],
    path: [
      [-6, fix("earth", site0)],
      [0, path("earth", [[0, site0, 0, 0], [60, site0 + 0.0015, 7, 1500], [150, site0 + 0.012, 66, 7700], [300, site0 + 0.09, 160, 13000], [528, null, null]])],
      [528, ins], [3000, phase], [tDock, dock("iss")], [tUndock, home],
      [tD, path("earth", [[tD, null, null], [tD + 1000, d + 1.14, 260, 27000], [tD + 2100, d + 2.36, 120, 27200], [tD + 2400, d + 2.6, 60, 22000], [tD + 2600, d + 2.7, 35, 6000], [tD + 2780, d + 2.74, 5.7, 560], [tD + 2830, d + 2.742, 2, 190], [tSplash, d + 2.743, 0, 25]])],
      [tSplash, fix("earth", d + 2.743)],
    ],
    fx: [[0, 150, "burn"], [160, 528, "burn"], [3000, 3060, "burn"], [20000, 20040, "burn"], [60000, 60040, "burn"], [tD, tD + 600, "burn"], [tD + 2780, tD + 2830, "chute1"], [tD + 2830, tSplash, "chute2"]],
    pose: [[tD + 1800, tD + 2780, "retro"], [tD + 2780, END, "up"]],
  };
  const booster = {
    id: "b1", col: "#bfe3ff", name: "Booster", g: [[0, "booster"], [515, "boosterlegs"]], end: 3000,
    path: [
      [-6, dock("dragon")],
      [153, path("earth", [[153, null, null], [180, site0 + 0.016, 80, 6000], [260, site0 + 0.045, 125, 4800], [330, site0 + 0.07, 105, 4600], [395, site0 + 0.082, 55, 5000], [420, site0 + 0.085, 40, 3800], [480, site0 + 0.0875, 12, 1600], [515, site0 + 0.088, 2.5, 900], [540, ship, 0, 0]])],
      [540, fix("earth", ship)],
    ],
    fx: [[395, 415, "burn"], [515, 540, "burn"]],
    pose: [[170, 540, "retro"]],
  };
  // back in the 3-D view from trunk jettison to splashdown
  const scene = {
    t0: tD - 700,
    state(t, h) {
      const P0 = FLIGHT.pivot.cap, c = fxClock, tDrogue = tD + 2780, tMain = tD + 2830, u = Math.max(0, t - (tD - 600));
      const tilt = t < tDrogue ? 15 + 3 * Math.sin(c * 2.2) : t < tSplash ? 4 * Math.sin(c * 1.1) : 3 * Math.sin(c * 0.8);
      const cap = { v: [0, 0, 0], rot: tilt, piv: P0 };
      const fs = { asm: { cap, nose: cap, glow: { v: [0, 0, 0] } } };
      fs.asm.trunk = { v: [-0.5 * u, 0, -(0.6 * u + 0.004 * u * u)], rot: tilt - 0.25 * u, piv: P0, hide: u > 240 };
      fs.chute1 = sm(tDrogue, tDrogue + 3, t) * (1 - sm(tMain, tMain + 2, t));
      fs.chute2 = (0.4 * sm(tMain, tMain + 3, t) + 0.6 * sm(tMain + 9, tMain + 15, t)) * (1 - sm(tSplash + 8, tSplash + 20, t));
      fs.asm.sea = { v: [0, 0, -420 * Math.pow(Math.min(1, h.alt / 3), 0.7)], hide: h.alt > 3 };
      fs.splash = t >= tSplash;
      const k1 = sm(tD - 570, tD - 400, t), k2 = sm(tDrogue, tMain + 20, t), k3 = sm(tSplash, tSplash + 30, t);
      fs.camZ = 560 + 20 * k1 + 72 * k2 - 50 * k3;
      fs.zoom = (4.2 + 2 * k1) * (1 - 0.42 * k2) * (1 + 0.15 * k3);
      return fs;
    },
  };
  const station = { id: "iss", col: "#cfe0ff", name: "ISS", g: "iss", path: [[-6, iss]] };
  return {
    end: END, objs: [dragon, booster, station], hud: "dragon", scene,
    // 3-D: the whole flight in one shot, slowing down for the docking, the undocking and the splashdown; the booster's
    // landing on the droneship is the one cut away
    land: [
      { id: "flight", kind: "f9flight", tDock, tUndock, tD, tDrogue: tD + 2780, tMain: tD + 2830, tSplash,
        beats: [[tDock - 1500, tDock - 290, 120], [tDock - 290, tDock + 22, 8], [tUndock - 10, tUndock + 240, 12], [tD - 120, tD + 2100, 60], [tSplash - 36, tSplash + 18, 1]] },
      { id: "f9", at: 541 },
    ],
    marks: [{ b: "earth", a: site0, kind: "pad", name: "LC-39A", to: 3000 }, { b: "earth", a: ship, kind: "droneship", name: "Droneship", to: 3000 }, { b: "earth", a: d + 2.7436, kind: "boat", name: "Recovery ship", from: tD }],
    cam: [
      [-6, "dragon", 400], [140, "dragon", 1200], [400, "b1", 150], [490, "b1", 25], [575, "dragon", 3500], [760, "earth", 9800],
      [tDock - 5000, "dragon", 1500], [tDock - 1500, "iss", 60], [tDock - 300, "iss", 6], [tDock + 3000, "earth", 9800],
      [tUndock - 900, "iss", 6], [tUndock + 1500, "earth", 9800], [tD + 1500, "dragon", 3000], [tD + 2100, "dragon", 500], [tD + 2700, "dragon", 40], [tD + 2900, "dragon", 6],
    ],
    events: [
      [395, "Booster entry burn"], [531, "Booster landing burn · legs deploy"], [541, "Booster lands on the droneship"],
      [3000, "Phasing burns · Dragon climbs toward the ISS"], [tDock - 1500, "Final approach to the ISS"], [tDock, "Soft capture · docked to the ISS"],
      [tDock + 7200, "Hatches open · the crew joins the station"], [tDock + 90 * DAY, "Expedition · about six months aboard the ISS"],
      [tUndock, "Undocking · Dragon backs away"], [tD - 600, "Trunk jettison"], [tD, "Deorbit burn"], [tD + 2100, "Entry interface · 7.5 km/s"],
      [tD + 2780, "Drogue parachutes"], [tD + 2830, "Main parachutes"], [tSplash, "Splashdown"], [tSplash + 1500, "Dragon hoisted aboard the recovery ship"],
    ],
  };
})();
const RET = MAP.scene, LANDINGS = MAP.land;
const arms = [...svg.querySelectorAll("[data-arm]")];
const riseAt = (t) => (t > 0 ? 18 * t * t : 0);
const S1 = ["eng", "s1", "is"];
function flightState(t) {
  const fs = { asm: {}, t };
  const rise = riseAt(t);
  fs.asm.pad = { v: [0, 0, -rise], hide: rise > 5000 };
  if (t > 153) {
    const u = t - 153;
    for (const n of S1) fs.asm[n] = { v: [-0.6 * u, 0, -(4 * u + 0.6 * u * u)], rot: -Math.min(180, 0.0 + 2.2 * Math.max(0, u - 12) ** 1.15), piv: FLIGHT.pivot.s1, hide: u > 90 };
  }
  if (t > 700) { const u = t - 700; for (const n of ["eng", "s1", "is", "s2"]) if (!fs.asm[n] || !fs.asm[n].hide) fs.asm[n] = { v: [0, 0, -0.5 * u] }; }
  if (t > 730) { const u = Math.min(1, (t - 730) / 14); fs.asm.nose = { v: [0, 0, 0], rot: 105 * u * u * (3 - 2 * u), piv: FLIGHT.pivot.nose }; }
  fs.m1d = t < -3 ? 0 : t < 150 ? sm(-3, -1.2, t) : 1 - sm(149.6, 150.6, t);
  fs.mvac = t < 160 ? 0 : t < 528 ? sm(160, 162, t) : 1 - sm(527.5, 528.5, t);
  fs.fallback = { merlin: fs.m1d, mvac: fs.mvac };
  fs.steam = t > -3 ? ramp(t, -3, 20) : 0;
  fs.alt = interp(ALT, t);
  fs.vel = interp(VEL, t);
  if (t < 153) { const k = sm(-1, 9, t); fs.camZ = 330 - 80 * k; fs.zoom = 1 + 0.25 * k; }
  else if (t < 700) { const k = sm(153, 175, t); fs.camZ = 250 + (430 - 250) * k; fs.zoom = 1.25 + 0.55 * k; }
  else { const k = sm(700, 720, t); fs.camZ = 470 + 110 * k; fs.zoom = 1.65 + 0.7 * k; }
  return fs;
}
function vehicleFx(fs) {
  const op = (1 - ramp(fs.t, -1.5, 1)).toFixed(3);
  for (const a of arms) a.style.opacity = op;
}
function vehicleReset() { for (const a of arms) a.style.opacity = ""; }
function mvacHeat(t) { if (t < 160) return 0; const on = 1 - Math.exp(-(Math.min(t, 528) - 160) / 6); return on * (t > 528 ? Math.exp(-(t - 528) / 25) : 1); }
function fxState(fs) {
  const t = fs.t, alt = fs.alt, c = fxClock;
  const off = (n) => fs.asm[n] || { v: [0, 0, 0] };
  const flip = t > 165 && t < 200;
  const sources = FXD.sources.map((s, i) => {
    const o = off(s.asm), v = o.v;
    let power = 0, ex = s.ex || 0, len = s.len;
    if (s.id === "m1d") { power = fs.m1d; ex = sm(5, 60, alt); len *= 1 + ex * 0.8; }
    else if (s.id === "mvac") { power = 0.42 * fs.mvac; }
    else if (s.id === "cgt") { const k = s.p[0] > 0 ? 0 : 1.3; power = flip ? 0.9 * (0.5 + 0.5 * Math.sin(c * 9 + k)) ** 4 : 0; }
    if (o.hide) power = 0;
    const d = s.kind === 4 ? s.d : unit([s.d[0] + 0.012 * Math.sin(c * 2.1 + i), s.d[1] + 0.012 * Math.cos(c * 1.7 + i), s.d[2]]);
    return { p: [s.p[0] + v[0], s.p[1] + v[1], s.p[2] + v[2]], re: s.re, d, kind: s.kind, power: power * (1 + 0.04 * Math.sin(c * 41 + i * 3.1)), len: len * (1 + 0.035 * Math.sin(c * 27 + i)), ex, seed: s.seed, rings: s.rings, er: s.er };
  });
  const occ = FXD.occ.map((o) => {
    const a = off(o.asm), v = a.v;
    return { on: !a.hide && !(S1.includes(o.asm) && t > 153), x: o.x + v[0], y: o.y + v[1], z0: o.z0 + v[2], z1: o.z1 + v[2], r0: o.r0, r1: o.r1, heat: o.hot ? 0.95 * mvacHeat(t) : 0 };
  });
  const rise = riseAt(t);
  const dk = FXD.deck;
  return {
    rise, sources, occ,
    deck: rise < 6000 ? dk : null,
    trail: { a: 18, t, t0: 0, t1: 150, c: [0, 0], half: 0, r0: 16, start: 160, strength: 0.5, z: 0, growth: 0.8, thin: sm(8, 40, alt) },
    ground: { tau: Math.max(0, t + 3), smoke: 0.35 * sm(-1, 2, t), steam: sm(-2.6, 0.5, t), z: dk.bottom, c: [40, 40], rmax: 560 },
    vapor: sm(54, 60, t) * (1 - sm(70, 78, t)),
    vap: [600, 380, 21],
    flash: 0.5 * burst(t + 2.6, 0.05, 0.25),
    green: burst(t + 2.8, 0.05, 0.35),
    sparks: 0, spark: [0, 0, 0, 1],
    wind: [8, 3], sun: 1,
  };
}
function shakeAt(t) {
  const a = 2.6 * burst(t, 0.08, 1.4) + 1.1 * sm(-0.2, 0.6, t) * (1 - sm(6, 14, t)) + 0.7 * (sm(54, 60, t) * (1 - sm(70, 78, t))) + 0.4 * sm(-2.5, -1, t) * (1 - sm(-0.5, 0.5, t)) + 1.4 * burst(t - 153, 0.04, 0.4);
  const c = fxClock;
  return [a * (Math.sin(c * 71) * 0.6 + Math.sin(c * 43 + 1) * 0.4), a * (Math.sin(c * 59 + 2) * 0.6 + Math.sin(c * 97) * 0.4)];
}
`;

const CSS = `
.m-black{--anatomy-paper:#232427;--anatomy-shade-0:#0f1012;--anatomy-shade-1:#17181b;--anatomy-shade-2:#202125;--anatomy-shade-3:#2a2c30;--anatomy-top:#3a3d42;--edge:#050506;--seam:#33363b;--seam2:#3f4247;--seam3:#5a5e64;--dot:#6a6e74}
.m-ti{--anatomy-paper:#4b4f55;--anatomy-shade-0:#25282c;--anatomy-shade-1:#34373c;--anatomy-shade-2:#44484e;--anatomy-shade-3:#565b62;--anatomy-top:#6d737a;--edge:#0d0e10;--seam:#5f646b;--seam2:#1f2124;--seam3:#7a8087}
.m-niobium{--anatomy-paper:#6e6a66;--anatomy-shade-0:#3b3835;--anatomy-shade-1:#4f4b47;--anatomy-shade-2:#64605b;--anatomy-shade-3:#7a756f;--anatomy-top:#938d86;--edge:#141210;--seam:#857f78;--seam2:#2e2b28}
.m-concrete{--anatomy-paper:#9d9a93;--anatomy-shade-0:#5f5d58;--anatomy-shade-1:#75726c;--anatomy-shade-2:#8c8981;--anatomy-shade-3:#a3a098;--anatomy-top:#b8b5ad;--edge:#2b2a27;--seam:#86837c;--seam2:#6a6862;--dot:#3a3936}
.cut-carbon{fill:#2a2b2e}
.liq-rp1{fill:#e2b25a;opacity:.38}
.soot{fill:#2b2722}
.sx-logo{font-family:"Arial Black",Arial,Helvetica,sans-serif;font-style:italic;font-weight:900;fill:#141618;letter-spacing:.06em}
.sx-logo.w{fill:#e9ecef}
.cellq{fill:#14203a;stroke:#2c4677;stroke-width:.25}
.sd-pod{fill:#d4d7db;stroke:#7d8288;stroke-width:.3}
.lbl-text{font-size:8.2px}
`;

buildPage({
  id: "falcon9",
  title: "Falcon 9 anatomy",
  h1: "Falcon 9 Block 5 · Crew Dragon",
  sub: "~65 m tall · 549 t at liftoff · 7.6 MN thrust · reusable first stage",
  figTitle: "Falcon 9 · Crew Dragon · LC-39A",
  label: "SpaceX Falcon 9 Block 5 with Crew Dragon on the launch mount at Launch Complex 39A: the white booster with folded black landing legs and grid fins under the black interstage, the second stage, Dragon's trunk and capsule, with the fixed service structure and crew access arm behind.",
  stageLabel: "Falcon 9 figure. Keys: Space launch, E explode, C cutaway, L name tags, plus and minus zoom, 0 fit.",
  caption: "Proportions follow SpaceX's published dimensions for Falcon 9 Block 5 and Crew Dragon. Explode separates the booster, interstage, second stage, trunk, capsule and nose cone. Cutaway opens the tanks, the MVac nozzle inside the interstage and Dragon's cabin. Launch plays a crew flight: green TEA-TEB ignition, Max-Q, staging, the booster flip, the glowing MVac burn and Dragon separation.",
  infoText: "Every piece of the stack is drawn as a real part. Turn on Cutaway to see the propellant, the LOX downcomer, the MVac nozzle inside the interstage and the crew seats.",
  ASM,
  xHalf: 245,
  box: (apart) => {
    const off = (a) => (apart ? ASM[a].v : [0, 0, 0]);
    return [...k.boxCorners(DECK, DECK_TOP - DECK_T, DECK_TOP), G.add3([0, 0, Z.nose], off("nose")), [-10, -112, TOWER.top + 78], [TOWER.x1, TOWER.y0, 0]];
  },
  FLIGHT,
  FXD,
  css: CSS,
  mission: MISSION,
});
