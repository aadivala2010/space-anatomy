// Saturn V (Apollo 11) on Mobile Launcher 1 — anatomy figure.
// node saturnv.mjs          -> saturnv.html
// node saturnv.mjs --light  -> saturnv-light.html
// World units are decimetres. F-1 nozzle exits at z = 0, vehicle axis at x = y = 0.
import {
  k, G, TAU, P, at, depth, r1, poly3, FZ, FRONT, pt, S, L, D,
  GROUPS, part, put, arcAt, facing, surfQuad, decal, usFlag, patchSvg, liquidSvg, dome, tube, boxOn, band, bandPath,
  labels, buildPage, sheen, contactShadow, member, trussFaces, accessArm, profileOf, flamePath, plumeGroup,
  chutesSvg, plasmaSvg, seaSvg, ripplesSvg,
} from "./lib.mjs";

const R1 = 50.5; // S-IC and S-II: 10.1 m
const R3 = 33; // S-IVB: 6.6 m
const RS = 19.5; // service module: 3.9 m
const Z = {
  f1: 58, base: 58, fuelTop: 205, itTop: 238, loxTop: 380, sicTop: 410,
  isTop: 465, s2Top: 660, aisTop: 715, s4Top: 852, iuTop: 861, slaTop: 946, smTop: 990, cmTop: 1024,
  towerTop: 1068, motorTop: 1100, tip: 1112,
};
const FC = FZ(0, 0, 0);
const DECK = { x: -230, y: -300, w: 460, d: 420, r: 3 };
const DECK_TOP = 40, DECK_T = 76;
const HOLE = { x: -70, y: -70, w: 140, d: 140 };
const LUT = { x0: -60, x1: 60, y0: -290, y1: -170, top: 1180, bay: 60, col: 9, base: DECK_TOP, core: { x: -40, y: -270, w: 30, d: 26, r: 1 }, deckEvery: 3 };
const QUAD = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
const front = (a, sl = 0) => facing(FC, a, sl) > -0.05;
const BODY = 30;
const asc = (prof) => prof.filter((p, i, a) => i === 0 || p[0] > a[i - 1][0] + 1e-6);
const CUT = [{ t: 0.7, cls: "cut-white" }, { t: 1.1, cls: "cut-metal" }];
const cutOf = (prof, layers = CUT) => patchSvg(FC, prof, 0, Math.PI, { steps: 110, layers, limbs: false });
const cyl = (z0, z1, r, o = { crease: "none" }) => S(G.solidOf([[z0, r], [z1, r]], FC, P), o);
const rings = (zs, r, tone = "faint", sl = 0) => zs.map((z) => L(arcAt(FC, z, r, sl), tone)).join("");
const dots = (z, r, n = 96) => D(G.dotsOf(FC, z, r, n, P, { fade: [0.04, 0.42] }), { size: 0.28, tone: "lo" });
// black paint between two angles on a cylinder, only where it faces the viewer
function paint(z0, z1, r, a0, a1, cls = "ck") {
  let d = "";
  const n = Math.max(2, Math.round((a1 - a0) / 0.06));
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, b = a0 + ((a1 - a0) * (i + 1)) / n;
    if (facing(FC, (a + b) / 2) < 0.02) continue;
    d += surfQuad(FC, z0, z1, r, r, a, b + 0.002, 1);
  }
  return d ? `<path class="${cls}" d="${d}"/>` : "";
}
function stackedText(F, z, r, a, txt, size, cls = "sv-text") {
  return [...txt].map((ch, i) => decal(F, z - i * size * 1.15, r, a, `<text class="${cls}" font-size="${size}" text-anchor="middle" y="${size * 0.36}">${ch}</text>`)).join("");
}

// ---------------------------------------------------------------- parts
GROUPS.push(["les", "Launch Escape System"], ["csm", "Apollo CSM & Lunar Module"], ["s4", "S-IVB third stage & IU"], ["s2", "S-II second stage"], ["s1", "S-IC first stage"], ["ml", "Mobile Launcher 1"]);
part("les-nose", "les", "Q-ball nose cone", "angle-of-attack sensor", "Pressure ports on the very tip measure the angle of attack so the abort system knows if the rocket is tumbling.");
part("les-canard", "les", "Canards", "2 · deploy in an abort", "Small fins that flip the capsule heat-shield-first after an abort.");
part("les-tjm", "les", "Tower jettison motor", "2 nozzles · 141 kN", "Pulls the whole tower away once the second stage is burning smoothly.");
part("les-motor", "les", "Launch escape motor", "4 nozzles · 653 kN · 3 s", "A solid motor that could yank the command module off a failing Saturn V.");
part("les-tower", "les", "Escape tower", "titanium truss", "Holds the motors ahead of the capsule so their exhaust clears it.");
part("les-bpc", "les", "Boost protective cover", "", "A fibreglass and cork cover over the command module that protects it from heat and the motor's exhaust; it leaves with the tower.");
part("cm", "csm", "Command module Columbia", "3.9 m Ø · 3 crew", "The only part that came home: a cone with a heat shield, three couches and the docking tunnel in its nose.");
part("cm-couches", "csm", "Crew couches", "Armstrong, Collins, Aldrin", "Three couches side by side, facing up for launch.", true);
part("cm-probe", "csm", "Docking probe", "", "Fits into the lunar module's drogue to dock the two spacecraft after transposition.", true);
part("sm", "csm", "Service module", "7.5 m · 25 t fuelled", "Carried the main engine, fuel cells, oxygen and power for the trip to the Moon and back. Discarded just before re-entry.");
part("sm-rcs", "csm", "RCS quads", "4 × 4 thrusters", "Clusters of small thrusters that steer the spacecraft.");
part("sm-rad", "csm", "Radiator panels", "", "Panels on the SM's skin that radiate the electronics' heat to space.");
part("sm-sps", "csm", "SPS engine", "91 kN · hypergolic", "The service propulsion system: it put Apollo into lunar orbit and brought it home. Its bell hangs inside the adapter.", true);
part("lm", "csm", "Lunar module Eagle", "7 m tall · 15 t", "Folded legs, gold foil descent stage and the ascent stage that brought Armstrong and Aldrin back up from the Moon. Rides inside the adapter.", true);
part("sla", "csm", "Spacecraft–LM adapter", "4 panels", "The cone that encloses the lunar module. Its four panels swing open like petals and are jettisoned after the CSM pulls away.");
part("iu", "s4", "Instrument unit", "0.9 m ring", "The computer, gyroscopes and radios that guided the whole Saturn V.");
part("s4", "s4", "S-IVB stage", "6.6 m Ø · 18 m", "Burned twice: once to reach Earth orbit and again for translunar injection.");
part("s4-lh2", "s4", "S-IVB hydrogen tank", "", "The large upper tank of liquid hydrogen.", true);
part("s4-lox", "s4", "S-IVB oxygen tank", "", "The smaller lower tank of liquid oxygen, behind a common bulkhead.", true);
part("s4-aps", "s4", "Auxiliary propulsion modules", "2 pods", "Small engines that settle the propellant and point the stage between burns.");
part("s4-j2", "s4", "J-2 engine", "1,033 kN · restartable", "Hydrogen-oxygen engine that restarted in orbit for the burn to the Moon.", true);
part("s4-ais", "s4", "Aft interstage", "10.1 → 6.6 m cone", "Joins the S-IVB to the wider S-II; it stays on the S-II after separation.");
part("s2", "s2", "S-II stage", "10.1 m Ø · 25 m", "Five J-2 engines burning liquid hydrogen and oxygen for about six minutes.");
part("s2-lh2", "s2", "S-II hydrogen tank", "", "Most of the stage; it holds 1,000 m³ of liquid hydrogen.", true);
part("s2-lox", "s2", "S-II oxygen tank", "common bulkhead", "Sits under the hydrogen tank behind a single insulated common bulkhead.", true);
part("s2-j2", "s2", "J-2 engines (×5)", "", "Four outboard engines on gimbals around a fixed centre engine.", true);
part("s2-ring", "s2", "Interstage ring", "jettisoned at T+3:10", "The skirt around the J-2s. It is dropped 30 s after staging once the engines have cleared it.");
part("s2-ullage", "s2", "Ullage motors", "8 solids", "Fire briefly at staging to push the propellant to the bottom of the tanks before the J-2s start.");
part("s1-fwd", "s1", "S-IC forward skirt", "", "Top of the first stage; the vents let the gases out.");
part("s1-lox", "s1", "S-IC oxygen tank", "1,300 m³", "The upper tank of the first stage.");
part("s1-it", "s1", "S-IC intertank", "corrugated", "Between the two tanks; painted black and white for roll tracking.");
part("s1-fuel", "s1", "S-IC RP-1 tank", "kerosene", "The lower tank; the five LOX lines run through it.");
part("s1-liq", "s1", "S-IC propellant", "", "Liquid oxygen over kerosene.", true);
part("s1-lines", "s1", "LOX suction lines", "5 tunnels", "Insulated tunnels carrying oxygen straight down through the kerosene tank to each engine.", true);
part("s1-thrust", "s1", "Thrust structure & heat shield", "", "Carries 34 MN of thrust into the stage.");
part("s1-fair", "s1", "Engine fairings", "4", "Streamlined cowls over the outboard engines; they house the retro-rockets.");
part("s1-fins", "s1", "Fins", "4", "Stabilising fins: they kept the rocket steady if an engine gimbal failed.");
part("s1-retro", "s1", "Retro-rockets", "8 solids", "Fire at staging to brake the spent first stage so it falls away.");
part("f1", "s1", "F-1 engines (×5)", "6.77 MN each", "The most powerful single-chamber liquid engines ever flown. The dark band is the fuel-rich turbine exhaust that cools the nozzle extension.");
part("s1-paint", "s1", "Roll pattern & USA", "", "Black and white areas let tracking cameras see the rocket roll; the flag and 'USA' run down the first stage.");
part("ml-deck", "ml", "Mobile Launcher deck", "49 × 41 m · 7.6 m thick", "The steel platform carried to the pad by the crawler-transporter.");
part("ml-hole", "ml", "Exhaust opening", "14 m square", "The five F-1 plumes pass down through this into the flame deflector.");
part("ml-lut", "ml", "Launch umbilical tower", "121 m · red steel", "The red tower with nine swing arms that fed the Saturn V until liftoff.");
part("ml-arms", "ml", "Swing arms", "9", "They carried propellant, power and air across to each stage and swung away at liftoff.");
part("ml-caa", "ml", "Crew access arm", "white room", "The walkway Armstrong, Aldrin and Collins crossed to board Columbia.");
part("ml-hold", "ml", "Hold-down arms", "4", "Held the rocket down for 6 seconds as the F-1s came to full thrust, then released.");
part("ml-tsm", "ml", "Tail service masts", "3", "Supplied fuel and oxygen to the S-IC base, then swung back at liftoff.");
part("ml-crane", "ml", "Hammerhead crane", "", "The crane on the tower's roof.");

// ---------------------------------------------------------------- explode plan
const ASM = {
  ml: { v: [0, 0, 0], delay: 0 },
  eng: { v: [0, 0, 0], delay: 0.44 },
  s1: { v: [0, 0, 40], delay: 0.42 },
  ring: { v: [0, 0, 100], delay: 0.36 },
  s2: { v: [0, 0, 150], delay: 0.32 },
  ais: { v: [0, 0, 200], delay: 0.28 },
  s4: { v: [0, 0, 240], delay: 0.22 },
  sla: { v: [0, 0, 280], delay: 0.16 },
  csm: { v: [0, 0, 340], delay: 0.08 },
  cm: { v: [0, 0, 372], delay: 0.06 },
  les: { v: [0, 0, 400], delay: 0 },
};
["sla0", "sla1", "sla2", "sla3"].forEach((n, i) => {
  const rad = G.radialOf(FC, QUAD[i]);
  ASM[n] = { v: [rad[0] * 40, rad[1] * 40, 290], delay: 0.12 };
});

// =====================================================================================
// MOBILE LAUNCHER
// =====================================================================================
{
  let s = `<path class="iso-halo" d="${k.haloOf(DECK, DECK_TOP - DECK_T, DECK_T, P)}"/>`;
  s += S(k.slabOf(DECK, DECK_TOP - DECK_T, DECK_T, P, 3, 0.8));
  for (let x = DECK.x + 30; x < DECK.x + DECK.w; x += 30) {
    const segs = [];
    let cur = null;
    for (let y = DECK.y; y <= DECK.y + DECK.d; y += 2) {
      const inHole = x > HOLE.x && x < HOLE.x + HOLE.w && y > HOLE.y && y < HOLE.y + HOLE.d;
      if (!inHole && y > DECK.y && y < DECK.y + DECK.d) (cur ??= []).push([x, y, DECK_TOP]);
      else if (cur) segs.push(cur), (cur = null);
    }
    if (cur) segs.push(cur);
    s += segs.map((seg) => L(poly3(seg, false), "faint")).join("");
  }
  s += L(k.planOutline(k.insetPlan(DECK, 6), DECK_TOP, P, 3), "lo");
  s += L(poly3([[DECK.x + DECK.w, DECK.y, DECK_TOP - 24], [DECK.x + DECK.w, DECK.y + DECK.d, DECK_TOP - 24], [DECK.x, DECK.y + DECK.d, DECK_TOP - 24]], false), "faint");
  for (let x = DECK.x + 46; x < DECK.x + DECK.w; x += 46) s += L(poly3([[x, DECK.y + DECK.d, DECK_TOP], [x, DECK.y + DECK.d, DECK_TOP - DECK_T]], false), "faint");
  for (let y = DECK.y + 46; y < DECK.y + DECK.d; y += 46) s += L(poly3([[DECK.x + DECK.w, y, DECK_TOP], [DECK.x + DECK.w, y, DECK_TOP - DECK_T]], false), "faint");
  s += D(k.corners(DECK, 12).map(([x, y]) => at([x, y, DECK_TOP])), { size: 0.6 });
  const plate = { x: DECK.x + DECK.w - 82, y: DECK.y + DECK.d - 20, w: 64, d: 11, r: 1 };
  s += S(k.slabOf(plate, DECK_TOP, 0.5, P, 2), { crease: "none" });
  s += k.faceTextSvg(k.topMatrix([plate.x + 4, plate.y + 7], DECK_TOP + 0.5, P, "x"), "MOBILE LAUNCHER 1 · LC-39A · 1969", { size: 3.2, tone: "lo" });
  put(0, "ml-deck", "mlgray", s, { asm: "ml" });
  const c = [[HOLE.x, HOLE.y], [HOLE.x + HOLE.w, HOLE.y], [HOLE.x + HOLE.w, HOLE.y + HOLE.d], [HOLE.x, HOLE.y + HOLE.d]];
  const top = c.map(([x, y]) => [x, y, DECK_TOP]);
  const deep = DECK_TOP - DECK_T;
  let h = `<clipPath id="svhole"><path d="${poly3(top)}"/></clipPath><path class="hole-void" d="${poly3(top)}"/><g clip-path="url(#svhole)">`;
  h += `<path class="hole-wall1" d="${poly3([[HOLE.x, HOLE.y, DECK_TOP], [HOLE.x + HOLE.w, HOLE.y, DECK_TOP], [HOLE.x + HOLE.w, HOLE.y, deep], [HOLE.x, HOLE.y, deep]])}"/>`;
  h += `<path class="hole-wall2" d="${poly3([[HOLE.x, HOLE.y, DECK_TOP], [HOLE.x, HOLE.y + HOLE.d, DECK_TOP], [HOLE.x, HOLE.y + HOLE.d, deep], [HOLE.x, HOLE.y, deep]])}"/>`;
  h += L(poly3([[HOLE.x, HOLE.y, DECK_TOP - 12], [HOLE.x + HOLE.w, HOLE.y, DECK_TOP - 12]], false), "lo") + L(poly3([[HOLE.x, HOLE.y, DECK_TOP - 12], [HOLE.x, HOLE.y + HOLE.d, DECK_TOP - 12]], false), "lo");
  h += "</g>" + L(poly3(top), "hi", { className: "iso-edge" });
  put(1, "ml-hole", "mlgray", h, { asm: "ml" });
}
// the red launch umbilical tower
put(1, "ml-lut", "lutred", trussFaces(LUT, true), { asm: "ml", attrs: ' data-red=""' });
put(2, "ml-lut", "lutred", trussFaces(LUT, false) + S(k.slabOf({ x: LUT.x0 - 5, y: LUT.y0 - 5, w: LUT.x1 - LUT.x0 + 10, d: LUT.y1 - LUT.y0 + 10, r: 1 }, LUT.top, 6, P, 2, 0.5)), { asm: "ml", attrs: ' data-red=""' });
{
  // hammerhead crane: a mast and a long jib over the rocket
  let s = S(k.slabOf({ x: -8, y: -250, w: 16, d: 16, r: 1 }, LUT.top + 6, 40, P, 2, 0.4));
  s += S(k.slabOf({ x: -4, y: -310, w: 8, d: 150, r: 0.6 }, LUT.top + 46, 7, P, 2, 0.3), { crease: "faint" });
  for (let y = -304; y < -166; y += 9) s += member([4, y, LUT.top + 46.5], [4, y + 9, LUT.top + 52.5], 0.5, "twl");
  s += member([0, -170, LUT.top + 46], [0, -170, LUT.top + 12], 0.6);
  put(2, "ml-crane", "lutred", s, { asm: "ml" });
}
// swing arms reaching from the tower to each stage (and the crew access arm at the CM)
const ARMS = [
  ["ml-caa", 1006, 10, 9, 15.5],
  ["ml-arms", 955, 7, 6, RS + 0.5],
  ["ml-arms", 840, 8, 7, R3 + 0.5],
  ["ml-arms", 700, 8, 7, R1 - 4],
  ["ml-arms", 620, 8, 7, R1 + 0.5],
  ["ml-arms", 470, 8, 7, R1 + 0.5],
  ["ml-arms", 390, 8, 7, R1 + 0.5],
  ["ml-arms", 220, 8, 7, R1 + 0.5],
];
for (const [id, z, w, h, reach] of ARMS) {
  let s = accessArm(0, LUT.y1, -reach, z, w, h);
  if (id === "ml-caa") s += S(k.slabOf({ x: -9, y: -reach - 13, w: 18, d: 12, r: 0.8 }, z - 3, 15, P, 2, 0.4), { crease: "faint" });
  put(3, id, id === "ml-caa" ? "white" : "lutred", s, { asm: "ml", attrs: ' data-arm=""' });
}
// tail service masts and hold-down arms
function tsm(x, y) {
  const b = { x: x - 8, y: y - 8, w: 16, d: 16, r: 1 };
  let s = S(k.slabOf(b, DECK_TOP, 30, P, 2, 0.4));
  for (let z = DECK_TOP + 8; z < DECK_TOP + 30; z += 8) s += L(k.sideSeam(b, z, P, 2), "faint");
  s += S(k.slabOf({ x: x - 4, y: y - 4, w: 8, d: 8, r: 0.6 }, DECK_TOP + 30, 14, P, 2, 0.3));
  return s;
}
function holdDown(a) {
  const rad = G.radialOf(FC, a);
  const c = [rad[0] * (R1 + 14), rad[1] * (R1 + 14)];
  const b = { x: c[0] - 9, y: c[1] - 9, w: 18, d: 18, r: 1 };
  let s = S(k.slabOf(b, DECK_TOP, Z.base - DECK_TOP - 1, P, 2, 0.4));
  s += L(k.sideSeam(b, DECK_TOP + 6, P, 2), "faint");
  const p0 = [c[0], c[1], Z.base + 2], p1 = [rad[0] * (R1 - 4), rad[1] * (R1 - 4), Z.base + 2];
  s += tube([p0, p1], 2.4) + S(G.sphereOf(p0, 3.2, P));
  return s;
}
put(4, "ml-deck", "mlgray", contactShadow(0, 0, DECK_TOP, 62, 0.34), { asm: "ml" });
for (const a of QUAD.filter((a) => !front(a))) put(5, "ml-hold", "mlgray", holdDown(a), { asm: "ml" });
for (const [x, y] of [[-40, -78], [40, -78], [0, -86]]) put(5, "ml-tsm", "mlgray", tsm(x, y), { asm: "ml", attrs: ' data-arm=""' });

// =====================================================================================
// S-IC
// =====================================================================================
const F1R = (z) => 18.5 - 10 * Math.pow(z / 48, 0.75);
const F1 = [[0, 0], ...QUAD.map((a) => { const r = G.radialOf(FC, a); return [r[0] * 32, r[1] * 32]; })].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
function f1(x, y) {
  const F = FZ(x, y, 0);
  let s = S(G.solidOf(profileOf(0, 48, F1R, 18), F, P, { smooth: true }), { crease: "none" });
  s += S(G.solidOf([[-0.5, F1R(0) + 0.4], [1, F1R(0) + 0.4]], F, P), { crease: "none" });
  // nozzle extension (darker, the turbine exhaust film) below the manifold ring
  s += `<g class="m-nozzle">${S(G.solidOf(profileOf(0, 21, (z) => F1R(z) + 0.05, 10), F, P, { smooth: true }), { crease: "none" })}</g>`;
  s += S(G.solidOf([[20.5, F1R(20.5) + 1.6], [23.5, F1R(23.5) + 1.6]], F, P), { crease: "none" });
  s += k.fadedSvg(G.ribsOf(F, 25, 46, F1R(25), 60, P, { r1: F1R(46), fade: [0.05, 0.5] }), { tone: "faint" });
  s += k.fadedSvg(G.ribsOf(F, 2, 19, F1R(2) + 0.05, 32, P, { r1: F1R(19) + 0.05, fade: [0.05, 0.5] }), { tone: "faint" });
  return s;
}
// the bells hang below the deck top: show them only through the hole opening or above the deck
{
  const [x0, y0, x1, y1] = [HOLE.x, HOLE.y, HOLE.x + HOLE.w, HOLE.y + HOLE.d], hi = DECK_TOP + 3000;
  const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const faces = [c.map(([x, y]) => [x, y, DECK_TOP]), ...c.map(([x, y], i) => { const [u, v] = c[(i + 1) % 4]; return [[x, y, DECK_TOP], [u, v, DECK_TOP], [u, v, hi], [x, y, hi]]; })];
  put(BODY, "f1", "engine", `<clipPath id="svf1clip">${faces.map((f) => `<path d="${poly3(f)}"/>`).join("")}</clipPath><g clip-path="url(#svf1clip)">${F1.map(([x, y]) => f1(x, y)).join("")}</g>`, { asm: "eng" });
}
// engine fairings, fins and retros: back ones before the stage, front ones after
function fairing(a) {
  const F = FC;
  const rad = G.radialOf(F, a);
  const c = G.mul3(rad, 32);
  const Ff = FZ(c[0], c[1], 0);
  let s = S(G.solidOf([[36, 11.5], [38, 12.4, 1], [52, 15.6, 1], [66, 17.6, 1], [Z.base + 16, 18.2]], Ff, P, { smooth: true }), { crease: "none" });
  s += L(arcAt(Ff, 38, 12.4, 0.2), "lo") + L(arcAt(Ff, 54, 15.9, 0.12), "faint");
  // retro-rocket exhaust ports on the fairing's upper flank
  for (const da of [-0.35, 0.35]) {
    const aa = a + da;
    if (facing(Ff, aa) < 0.15) continue;
    s += `<path class="port" d="${surfQuad(Ff, 64, 68, 17.5, 17.8, aa - 0.13, aa + 0.13, 2)}"/>`;
  }
  return s;
}
function fin(a) {
  const F = FC;
  const rad = G.radialOf(F, a);
  const tan = G.unit3(G.add3(G.mul3(F.u, -Math.sin(a)), G.mul3(F.v, Math.cos(a))));
  const o = G.mul3(rad, 32 + 17);
  // a flat plate in the radial plane: (radial out, height), extruded across its thickness
  const Fb = G.frameOf([o[0], o[1], 0], tan, rad, [0, 0, 1]);
  const plate = [[0, 30], [36, 30], [36, 50], [0, 96]];
  let s = S(G.prismOf(Fb, plate, -0.8, 0.8, P), { crease: "faint" });
  s += S(G.prismOf(Fb, [[34, 28], [37.5, 28], [37.5, 48], [34, 48]], -1.3, 1.3, P), { crease: "none" });
  s += L(poly3([G.add3(o, G.add3(G.mul3(rad, 6), [0, 0, 32])), G.add3(o, G.add3(G.mul3(rad, 6), [0, 0, 86]))].map((p) => G.add3(p, G.mul3(tan, 0.85))), false), "faint");
  return s;
}
for (const a of QUAD.filter((a) => !front(a))) { put(BODY - 3, "s1-fins", "white", fin(a), { asm: "s1" }); put(BODY - 2, "s1-fair", "white", fairing(a), { asm: "s1" }); }
// thrust structure + heat shield
{
  let s = S(G.solidOf([[Z.base - 4, R1 - 6], [Z.base, R1 - 1], [Z.base + 4, R1]], FC, P), { crease: "lo" });
  put(BODY, "s1-thrust", "carbon", s, { asm: "s1" });
  let t = cyl(Z.base + 4, 92, R1) + rings([Z.base + 6, 90], R1, "lo") + dots(Z.base + 9, R1);
  t += k.fadedSvg(G.ribsOf(FC, Z.base + 10, 88, R1, 90, P, { fade: [0.05, 0.45] }), { tone: "faint" });
  // black quadrants of the roll pattern
  t += paint(Z.base + 4, 92, R1 + 0.04, FRONT, FRONT + Math.PI / 2) + paint(Z.base + 4, 92, R1 + 0.04, FRONT + Math.PI, FRONT + 1.5 * Math.PI);
  put(BODY, "s1-thrust", "white", t, { asm: "s1", view: "whole" });
  put(BODY, "s1-thrust", "white", cutOf([[Z.base + 4, R1], [92, R1]]), { asm: "s1", view: "cut" });
}
const FUEL_PROF = asc([...dome(92, 14, R1 - 1, false).reverse(), [Z.fuelTop - 4, R1 - 1], ...dome(Z.fuelTop - 4, 14, R1 - 1, true).slice(1)]);
const LOX_PROF = asc([...dome(Z.itTop + 4, 14, R1 - 1, false).reverse(), [Z.loxTop - 4, R1 - 1], ...dome(Z.loxTop - 4, 16, R1 - 1, true).slice(1)]);
{
  let s = cyl(92, Z.fuelTop, R1) + rings([120, 150, 178], R1) + rings([93.5, Z.fuelTop - 1.5], R1, "lo");
  s += paint(92, Z.fuelTop - 30, R1 + 0.04, FRONT, FRONT + Math.PI / 2) + paint(92, Z.fuelTop - 30, R1 + 0.04, FRONT + Math.PI, FRONT + 1.5 * Math.PI);
  put(BODY, "s1-fuel", "white", s, { asm: "s1", view: "whole" });
  put(BODY, "s1-paint", "white", paint(92, Z.fuelTop - 30, R1 + 0.05, FRONT, FRONT + Math.PI / 2), { asm: "s1", view: "whole" });
  put(BODY, "s1-fuel", "white", cutOf([[92, R1], [Z.fuelTop, R1]]), { asm: "s1", view: "cut" });
  put(BODY, "s1-liq", "white", liquidSvg(FC, FUEL_PROF, Z.fuelTop - 16, "liq-rp1"), { asm: "s1", view: "cut" });
  let ln = "";
  for (const [x, y] of F1) ln += tube([[x * 0.6, y * 0.6, 70], [x * 0.6, y * 0.6, Z.fuelTop + 6]], 2.6);
  put(BODY, "s1-lines", "silver", ln, { asm: "s1", view: "cut" });
  // intertank: corrugated, black with white panels
  let t = cyl(Z.fuelTop, Z.itTop, R1 + 0.3);
  t += k.fadedSvg(G.ribsOf(FC, Z.fuelTop + 2, Z.itTop - 2, R1 + 0.3, 160, P, { fade: [0.04, 0.5] }), { tone: "lo" });
  for (let i = 0; i < 8; i += 2) t += paint(Z.fuelTop, Z.itTop, R1 + 0.34, FRONT + (i * Math.PI) / 4 + 0.2, FRONT + ((i + 1) * Math.PI) / 4 + 0.2);
  put(BODY, "s1-it", "white", t, { asm: "s1", view: "whole" });
  put(BODY, "s1-it", "white", cutOf([[Z.fuelTop, R1 + 0.3], [Z.itTop, R1 + 0.3]]), { asm: "s1", view: "cut" });
  let x = cyl(Z.itTop, Z.loxTop, R1) + rings([270, 300, 330, 356], R1) + rings([Z.itTop + 1.5, Z.loxTop - 1.5], R1, "lo") + dots(Z.itTop + 3.5, R1);
  x += decal(FC, 352, R1 + 0.06, FRONT - 0.18, usFlag(22));
  x += stackedText(FC, 322, R1 + 0.06, FRONT - 0.18, "USA", 14);
  put(BODY, "s1-lox", "white", x, { asm: "s1", view: "whole" });
  put(BODY, "s1-lox", "white", sheen(FC, Z.base + 4, Z.sicTop, R1 + 0.3, { strength: 0.2, width: 0.13 }), { asm: "s1", view: "whole" });
  put(BODY, "s1-paint", "white", decal(FC, 352, R1 + 0.07, FRONT - 0.18, usFlag(22)) + stackedText(FC, 322, R1 + 0.07, FRONT - 0.18, "USA", 14), { asm: "s1", view: "whole" });
  put(BODY, "s1-lox", "white", cutOf([[Z.itTop, R1], [Z.loxTop, R1]]), { asm: "s1", view: "cut" });
  put(BODY, "s1-liq", "white", liquidSvg(FC, LOX_PROF, Z.loxTop - 22, "liq-lox"), { asm: "s1", view: "cut" });
  let f = cyl(Z.loxTop, Z.sicTop, R1 + 0.2) + rings([Z.loxTop + 1.5, Z.sicTop - 1.5], R1 + 0.2, "lo") + dots(Z.sicTop - 4, R1 + 0.2);
  f += k.fadedSvg(G.ribsOf(FC, Z.loxTop + 3, Z.sicTop - 6, R1 + 0.2, 120, P, { fade: [0.05, 0.5] }), { tone: "faint" });
  for (const a of [FRONT - 0.5, FRONT + 0.4, FRONT + 1.2]) if (facing(FC, a) > 0.2) f += `<path class="port" d="${surfQuad(FC, 395, 400, R1 + 0.25, R1 + 0.25, a - 0.05, a + 0.05, 1)}"/>`;
  put(BODY, "s1-fwd", "white", f, { asm: "s1", view: "whole" });
  put(BODY, "s1-fwd", "white", cutOf([[Z.loxTop, R1 + 0.2], [Z.sicTop, R1 + 0.2]]), { asm: "s1", view: "cut" });
}
for (const a of QUAD.filter(front)) { put(BODY, "s1-fair", "white", fairing(a), { asm: "s1" }); put(BODY, "s1-fins", "white", fin(a), { asm: "s1" }); }

// =====================================================================================
// S-II with its interstage ring (the J-2s inside are drawn first)
// =====================================================================================
const J2R = (z) => 10 - 6 * Math.pow((z - 418) / 30, 0.8);
const J2S = [[0, 0], ...QUAD.map((a) => { const r = G.radialOf(FC, a); return [r[0] * 27, r[1] * 27]; })].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
function j2(F, z0) {
  let s = S(G.solidOf(profileOf(z0, z0 + 30, (z) => J2R(z - z0 + 418), 14), F, P, { smooth: true }), { crease: "none" });
  s += k.fadedSvg(G.ribsOf(F, z0 + 1, z0 + 28, J2R(419), 36, P, { r1: J2R(446), fade: [0.05, 0.5] }), { tone: "faint" });
  s += S(G.solidOf([[z0 + 30, 4.4], [z0 + 36, 5.6], [z0 + 42, 5.2], [z0 + 44, 3]], F, P));
  return s;
}
for (const [x, y] of J2S) put(BODY, "s2-j2", "engine", j2(FZ(x, y), 418), { asm: "s2" });
{
  let s = cyl(Z.sicTop, Z.isTop, R1 + 0.2) + rings([Z.sicTop + 2, Z.isTop - 2], R1 + 0.2, "lo") + rings([440], R1 + 0.2);
  s += k.fadedSvg(G.ribsOf(FC, Z.sicTop + 4, Z.isTop - 4, R1 + 0.2, 96, P, { fade: [0.05, 0.5] }), { tone: "faint" });
  put(BODY, "s2-ring", "white", s, { asm: "ring", view: "whole" });
  put(BODY, "s2-ring", "white", cutOf([[Z.sicTop, R1 + 0.2], [Z.isTop, R1 + 0.2]]), { asm: "ring", view: "cut" });
  let u = "";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    if (facing(FC, a) < 0.1) continue;
    u += S(boxOn(FC, a, R1, 2.6, 4.4, 445, 462), { crease: "faint" });
    u += S(G.solidOf([[0, 1.6], [3, 2.0]], G.frameAlong(pt(FC, 442, R1 + 1.3, a), [0, 0, 1]), P), { crease: "none" });
  }
  put(BODY + 1, "s2-ullage", "white", u, { asm: "ring" });
}
const S2_LOX = asc([...dome(Z.isTop + 4, 18, R1 - 1, false).reverse(), [Z.isTop + 26, R1 - 1], ...dome(Z.isTop + 26, 16, R1 - 1, true).slice(1)]);
const S2_LH2 = asc([[Z.isTop + 26, 0.01], [Z.isTop + 42, R1 - 1], [Z.s2Top - 8, R1 - 1], ...dome(Z.s2Top - 8, 16, R1 - 1, true).slice(1)]);
{
  let s = cyl(Z.isTop, Z.s2Top, R1) + rings([510, 548, 586, 624], R1) + rings([Z.isTop + 1.5, Z.s2Top - 1.5], R1, "lo") + dots(Z.s2Top - 4, R1);
  s += stackedText(FC, 640, R1 + 0.06, FRONT + 0.28, "UNITED STATES", 10.5, "sv-text sm");
  put(BODY, "s2", "white", s + sheen(FC, Z.isTop, Z.s2Top, R1, { strength: 0.2, width: 0.13 }), { asm: "s2", view: "whole" });
  put(BODY, "s2", "white", cutOf([[Z.isTop, R1], [Z.s2Top, R1]]), { asm: "s2", view: "cut" });
  put(BODY, "s2-lox", "white", liquidSvg(FC, S2_LOX, Z.isTop + 30, "liq-lox"), { asm: "s2", view: "cut" });
  put(BODY, "s2-lh2", "white", liquidSvg(FC, S2_LH2, Z.s2Top - 20, "liq-lh2") + L(arcAt(FC, Z.isTop + 34, R1 - 3, 0, { inward: true }), "lo"), { asm: "s2", view: "cut" });
}

// =====================================================================================
// S-IVB, aft interstage, IU
// =====================================================================================
put(BODY, "s4-j2", "engine", j2(FC, 678), { asm: "s4" });
{
  const sl = (R3 - R1) / (Z.aisTop - Z.s2Top);
  let s = S(G.solidOf([[Z.s2Top, R1 + 0.2], [Z.aisTop, R3 + 0.4]], FC, P), { crease: "faint" });
  s += k.fadedSvg(G.ribsOf(FC, Z.s2Top + 3, Z.aisTop - 3, R1 + 0.2 + sl * 3, 96, P, { r1: R3 + 0.4 - sl * 3, fade: [0.05, 0.5] }), { tone: "faint" });
  s += L(arcAt(FC, Z.s2Top + 2, R1 + 0.2 + sl * 2, sl), "lo") + L(arcAt(FC, Z.aisTop - 2, R3 + 0.4 - sl * 2, sl), "lo");
  // four retro-rockets on the cone
  for (const a of QUAD) if (facing(FC, a, sl) > 0.1) s += S(boxOn(FC, a, R1 - 4 + sl * 20, 3, 5, 668, 692), { crease: "faint" });
  put(BODY, "s4-ais", "white", s, { asm: "ais", view: "whole" });
  put(BODY, "s4-ais", "white", cutOf([[Z.s2Top, R1 + 0.2], [Z.aisTop, R3 + 0.4]]), { asm: "ais", view: "cut" });
}
const S4_LOX = asc([...dome(Z.aisTop + 2, 12, R3 - 1, false).reverse(), [Z.aisTop + 18, R3 - 1], ...dome(Z.aisTop + 18, 14, R3 - 1, true).slice(1)]);
const S4_LH2 = asc([[Z.aisTop + 18, 0.01], [Z.aisTop + 32, R3 - 1], [Z.s4Top - 8, R3 - 1], ...dome(Z.s4Top - 8, 14, R3 - 1, true).slice(1)]);
{
  let s = cyl(Z.aisTop, Z.s4Top, R3) + rings([760, 800, 830], R3) + rings([Z.aisTop + 1.5, Z.s4Top - 1.5], R3, "lo") + dots(Z.s4Top - 4, R3, 72);
  // black quadrants on the aft skirt
  s += paint(Z.aisTop, Z.aisTop + 40, R3 + 0.04, FRONT - Math.PI / 4, FRONT + Math.PI / 4) + paint(Z.aisTop, Z.aisTop + 40, R3 + 0.04, FRONT + (3 * Math.PI) / 4, FRONT + (5 * Math.PI) / 4);
  put(BODY, "s4", "white", s + sheen(FC, Z.aisTop, Z.s4Top, R3, { strength: 0.2 }), { asm: "s4", view: "whole" });
  put(BODY, "s4", "white", cutOf([[Z.aisTop, R3], [Z.s4Top, R3]]), { asm: "s4", view: "cut" });
  put(BODY, "s4-lox", "white", liquidSvg(FC, S4_LOX, Z.aisTop + 22, "liq-lox"), { asm: "s4", view: "cut" });
  put(BODY, "s4-lh2", "white", liquidSvg(FC, S4_LH2, Z.s4Top - 18, "liq-lh2"), { asm: "s4", view: "cut" });
  // APS pods
  let a = "";
  for (const ang of [0, Math.PI]) {
    if (facing(FC, ang) < -0.3) continue;
    const c = pt(FC, Z.aisTop + 6, R3 + 3.4, ang);
    a += S(G.solidOf([[0, 2.6, 1], [2, 4.2, 1], [14, 4.4, 1], [18, 3, 1]], G.frameAlong(c, [0, 0, 1]), P, { smooth: true }));
    a += `<path class="ck" d="${surfQuad(FC, Z.aisTop + 8, Z.aisTop + 18, R3 + 0.1, R3 + 0.1, ang - 0.12, ang + 0.12, 2)}"/>`;
  }
  put(BODY + 1, "s4-aps", "white", a, { asm: "s4" });
  let iu = cyl(Z.s4Top, Z.iuTop, R3 + 0.2) + rings([Z.s4Top + 1.2, Z.iuTop - 1.2], R3 + 0.2, "lo") + dots(Z.s4Top + 4.5, R3 + 0.2, 72);
  for (let i = 0; i < 8; i++) { const ang = FRONT - 1.2 + i * 0.32; if (facing(FC, ang) > 0.15) iu += L(surfQuad(FC, Z.s4Top + 2, Z.iuTop - 2, R3 + 0.25, R3 + 0.25, ang - 0.12, ang + 0.12, 2), "faint"); }
  put(BODY, "iu", "silver", iu, { asm: "s4" });
}

// =====================================================================================
// SLA (four petals) with the LM inside, then the CSM, BPC and LES
// =====================================================================================
const SLA = (z) => R3 + ((RS + 0.4 - R3) * (z - Z.iuTop)) / (Z.slaTop - Z.iuTop);
const SLA_K = (RS + 0.4 - R3) / (Z.slaTop - Z.iuTop);
// petals: back two first
function petal(i) {
  const a0 = QUAD[i] - Math.PI / 4, a1 = QUAD[i] + Math.PI / 4;
  const prof = [[Z.iuTop, R3 + 0.2], [Z.slaTop, RS + 0.6]];
  let s = patchSvg(FC, prof, a0, a1, { steps: 120, limbs: true });
  for (const z of [880, 905, 928]) s += L(arcAt(FC, z, SLA(z) + 0.25, SLA_K, { from: a0, to: a1 }), "faint");
  return s;
}
const PETAL_ORDER = [0, 1, 2, 3].sort((a, b) => depth(G.radialOf(FC, QUAD[a])) - depth(G.radialOf(FC, QUAD[b])));
for (const i of PETAL_ORDER.slice(0, 2)) put(BODY, "sla", "white", petal(i), { asm: "sla" + i, view: "whole" });
put(BODY, "sla", "white", cutOf([[Z.iuTop, R3 + 0.2], [Z.slaTop, RS + 0.6]]), { asm: "sla", view: "cut" });
{
  // lunar module: seen in the cutaway and once the petals open: gold descent stage with folded legs, ascent stage above
  const F = FC;
  let lm = S(G.prismOf(G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * TAU + Math.PI / 8; return [Math.cos(a) * 21, Math.sin(a) * 21]; }), 868, 886, P), { crease: "faint" });
  for (const a of QUAD) lm += tube([pt(F, 884, 20, a), pt(F, 870, 25, a)], 0.8) + S(G.sphereOf(pt(F, 869, 25.4, a), 1.4, P));
  put(BODY, "lm", "gold", lm, { asm: "sla" });
  let as = S(G.prismOf(G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[-12, -9], [10, -11], [13, 0], [10, 10], [-12, 9]], 886, 906, P), { crease: "faint" });
  as += S(G.solidOf([[906, 5], [910, 5], [911, 3.6]], FZ(0, 0), P), { crease: "none" });
  as += `<path class="window" d="${poly3([[13.1, -3, 900], [13.1, 3, 900], [12.6, 3, 895], [12.6, -3, 895]])}"/>`;
  put(BODY, "lm", "lmgray", as, { asm: "sla" });
}

put(BODY, "sm-sps", "engine", S(G.solidOf(profileOf(930, 950, (z) => 9 - 6 * Math.pow((z - 930) / 20, 0.8), 10), FC, P, { smooth: true }), { crease: "none" }), { asm: "csm", view: "cut" });
for (const i of PETAL_ORDER.slice(2)) put(BODY, "sla", "white", petal(i), { asm: "sla" + i, view: "whole" });
{
  let s = cyl(Z.slaTop, Z.smTop, RS) + rings([Z.slaTop + 1.5, Z.smTop - 1.5], RS, "lo");
  // radiator panels and seams
  for (let i = 0; i < 6; i++) { const a = FRONT - 1.3 + i * 0.52; if (facing(FC, a) > 0.15) s += L(poly3([pt(FC, Z.slaTop + 3, RS + 0.05, a), pt(FC, Z.smTop - 3, RS + 0.05, a)], false), "faint"); }
  put(BODY, "sm", "silver", s + sheen(FC, Z.slaTop, Z.smTop, RS, { strength: 0.38 }), { asm: "csm", view: "whole" });
  put(BODY, "sm", "silver", cutOf([[Z.slaTop, RS], [Z.smTop, RS]], [{ t: 0.5, cls: "cut-silver" }]), { asm: "csm", view: "cut" });
  let rad = "";
  for (const a of [FRONT - 0.6, FRONT + 0.15, FRONT + 0.9]) if (facing(FC, a) > 0.2) rad += `<path class="sm-rad" d="${surfQuad(FC, 958, 976, RS + 0.07, RS + 0.07, a - 0.2, a + 0.2, 3)}"/>`;
  put(BODY, "sm-rad", "silver", rad, { asm: "csm", view: "whole" });
  // RCS quads: a little box with four nozzles
  let q = "";
  for (const a of QUAD) {
    if (facing(FC, a) < 0.05) continue;
    q += S(boxOn(FC, a, RS - 0.2, 2.4, 5, 978, 985), { crease: "faint" });
    q += D([pt(FC, 981.5, RS + 2.5, a - 0.13), pt(FC, 981.5, RS + 2.5, a + 0.13), pt(FC, 986, RS + 1.2, a), pt(FC, 977, RS + 1.2, a)].map(at), { size: 0.5, tone: "hi" });
  }
  put(BODY + 1, "sm-rcs", "white", q, { asm: "csm" });
}
// command module under the boost protective cover
const CMR = (z) => RS - ((z - Z.smTop) / (Z.cmTop - Z.smTop)) * (RS - 4.2);
{
  let c = S(G.solidOf([[Z.smTop, RS - 0.2], [Z.smTop + 1.5, RS], [Z.cmTop, 4.2]], FC, P), { crease: "lo" });
  put(BODY - 1, "cm", "avcoat", S(G.solidOf([[985.6, 0.5], [986.4, 8], [987.6, 15], [989.2, RS - 0.6], [990.2, RS - 0.2]], FC, P), { crease: "none" }), { asm: "cm", attrs: ' data-retonly=""' });
  put(BODY, "cm", "silver", c, { asm: "cm" });
  let couches = "";
  for (const x of [-7, 0, 7]) couches += S(G.prismOf(G.frameOf([x, 2, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[-2.6, -5], [2.6, -5], [2.6, 5], [-2.6, 5]], 996, 998.5, P), { crease: "none" });
  put(BODY, "cm-couches", "pale", couches, { asm: "cm", view: "cut" });
  put(BODY, "cm-probe", "silver", S(G.solidOf([[1018, 2.2], [1030, 1.2], [1033, 0.5]], FC, P)), { asm: "cm", view: "cut" });
  const sl = -(RS - 4.2) / (Z.cmTop - Z.smTop);
  let b = S(G.solidOf([[Z.smTop - 0.5, RS + 0.6], [Z.smTop + 2, RS + 0.6], [Z.cmTop + 1, 4.6]], FC, P), { crease: "lo" });
  b += L(arcAt(FC, Z.smTop + 6, CMR(Z.smTop + 6) + 0.7, sl), "faint") + L(arcAt(FC, Z.smTop + 20, CMR(Z.smTop + 20) + 0.7, sl), "faint");
  for (const a of [FRONT - 0.45, FRONT + 0.45]) if (facing(FC, a, sl) > 0.2) b += `<path class="window" d="${surfQuad(FC, 1006, 1010, CMR(1006) + 0.8, CMR(1010) + 0.8, a - 0.09, a + 0.09, 2)}"/>`;
  put(BODY, "les-bpc", "white", b, { asm: "les", view: "whole" });
}
// LES tower (truss), motor, canards, nose
{
  let s = "";
  const legs = QUAD.map((a) => G.radialOf(FC, a));
  const back = legs.filter((r) => depth(r) < 0), frontL = legs.filter((r) => depth(r) >= 0);
  const legPt = (r, z) => { const w = 5.6 - ((z - Z.cmTop) / (Z.towerTop - Z.cmTop)) * 2.4; return [r[0] * w, r[1] * w, z]; };
  const draw = (list) => {
    for (const r of list) s += member(legPt(r, Z.cmTop + 1), legPt(r, Z.towerTop), 1.4, "les");
  };
  draw(back);
  for (let z = Z.cmTop + 1; z < Z.towerTop - 1; z += 11) {
    for (let i = 0; i < 4; i++) {
      const a = legs[i], b = legs[(i + 1) % 4];
      s += member(legPt(a, z), legPt(b, z + 11), 0.6, "les") + member(legPt(a, z + 11), legPt(b, z + 11), 0.7, "les");
    }
  }
  draw(frontL);
  put(BODY + 2, "les-tower", "lesred", s, { asm: "les" });
  let m = S(G.solidOf([[Z.towerTop, 5.4], [Z.towerTop + 3, 5.4], [Z.motorTop - 6, 4.6], [Z.motorTop, 3.6]], FC, P), { crease: "faint" });
  m += rings([Z.towerTop + 8], 5.3) + L(arcAt(FC, Z.towerTop + 1.5, 5.4), "lo");
  // four escape nozzles at the bottom of the motor
  for (const a of QUAD) if (facing(FC, a) > -0.1) m += S(G.solidOf([[0, 1.2], [3.5, 2.0]], G.frameAlong(pt(FC, Z.towerTop + 1, 6.4, a), G.unit3(G.add3(G.mul3(G.radialOf(FC, a), 0.6), [0, 0, -1]))), P), { crease: "none" });
  put(BODY + 3, "les-motor", "white", m, { asm: "les" });
  let tj = S(G.solidOf([[Z.motorTop, 3.6], [Z.motorTop + 4, 2.6]], FC, P), { crease: "none" });
  for (const a of [0, Math.PI]) tj += S(G.solidOf([[0, 0.9], [2.4, 1.4]], G.frameAlong(pt(FC, Z.motorTop + 1.5, 3.4, a), G.unit3(G.add3(G.mul3(G.radialOf(FC, a), 0.8), [0, 0, -0.4]))), P), { crease: "none" });
  put(BODY + 3, "les-tjm", "white", tj, { asm: "les" });
  let cn = "";
  for (const a of [0, Math.PI]) cn += S(boxOn(FC, a, 2.3, 3, 0.8, Z.motorTop + 4, Z.motorTop + 8), { crease: "none" });
  put(BODY + 3, "les-canard", "white", cn, { asm: "les" });
  put(BODY + 4, "les-nose", "white", S(G.solidOf(profileOf(Z.motorTop + 4, Z.tip, (z) => 2.6 * Math.cos(((z - Z.motorTop - 4) / (Z.tip - Z.motorTop - 4)) * (Math.PI / 2)) + 0.01, 10), FC, P, { smooth: true })), { asm: "les" });
}
for (const a of QUAD.filter(front)) put(45, "ml-hold", "mlgray", holdDown(a), { asm: "ml" });

// ---- coming home (return scene only): plasma, parachutes, and a patch of the Pacific
{
  const [back, shock] = plasmaSvg([0, 0, 986], RS, { wake: 7 });
  put(BODY - 2, "fx", "none", back, { asm: "glow" });
  put(BODY + 8, "fx", "none", shock, { asm: "glow" });
  put(BODY + 6, "fx", "none", chutesSvg(1, [0, 0, 1026], { n: 2, spread: 5, height: 55, R: 7, bands: false }), { asm: "cm" });
  put(BODY + 7, "fx", "none", chutesSvg(2, [0, 0, 1026], { n: 3, spread: 30, height: 115, R: 32 }), { asm: "cm" });
  put(3, "fx", "none", `<g class="m-sea">${seaSvg(993, 900)}</g>` + ripplesSvg(993, 24), { asm: "sea", attrs: ' data-retonly=""' });
}

// =====================================================================================
// FALLBACK PLUMES, FX DATA, LABELS
// =====================================================================================
{
  const [ex, ey] = at([0, 0, 0]);
  put(44, "fx", "none", plumeGroup("f1", ex, ey, `<path class="pl pl-flick" fill="url(#g-ker)" d="${flamePath(ex, ey, 620, (u) => 60 * (1 + 0.6 * Math.sqrt(u)) * (1 - u ** 3))}"/>`), { asm: "eng" });
}
const FLIGHT = {
  pivot: { cm: at([0, 0, 1007]), s1: at([0, 0, 230]), s2: at([0, 0, 560]), les: at([0, 0, 1060]), sla: at([0, 0, Z.iuTop]) },
  side: QUAD.map((a) => Math.sign(at(G.mul3(G.radialOf(FC, a), R3))[0] - at([0, 0, 0])[0]) || 1),
  y0: at([0, 0, 0])[1],
  dz: at([0, 0, 1])[1] - at([0, 0, 0])[1],
  cx: at([0, 0, 500])[0],
};
const FXD = {
  sources: [
    ...F1.map(([x, y], i) => ({ id: "f1" + (x === 0 && y === 0 ? "c" : i), asm: "eng", p: [x, y, 0], re: 18.5, d: [0, 0, -1], kind: 2, len: 720, soot: 1, seed: i * 2.3 })),
    { id: "j2s2", asm: "s2", p: [0, 0, 418], re: 38, d: [0, 0, -1], kind: 0, len: 260, ex: 1, rings: [[1, 0], [4, 27]], er: 10, seed: 5.1 },
    { id: "j2s4", asm: "s4", p: [0, 0, 678], re: 10, d: [0, 0, -1], kind: 0, len: 200, ex: 1, seed: 6.1 },
    ...[FRONT + Math.PI / 4, FRONT - Math.PI / 4, FRONT + (3 * Math.PI) / 4].map((a, i) => { const r = G.radialOf(FC, a); return { id: "retro", asm: "s1", p: G.add3(G.mul3(r, 52.5), [0, 0, 68]), re: 3.2, d: G.unit3(G.add3(G.mul3(r, 0.7), [0, 0, 1])), kind: 1, len: 110, seed: 7 + i }; }),
    ...[FRONT + 0.2, FRONT + 0.2 + (2 * Math.PI) / 3, FRONT + 0.2 - (2 * Math.PI) / 3].map((a, i) => { const r = G.radialOf(FC, a); return { id: "ullage", asm: "ring", p: G.add3(G.mul3(r, R1 + 1.3), [0, 0, 442]), re: 2.2, d: G.unit3(G.add3(G.mul3(r, 0.25), [0, 0, -1])), kind: 1, len: 80, seed: 9 + i }; }),
    ...[0, Math.PI].map((a, i) => { const r = G.radialOf(FC, a); return { id: "tjm", asm: "les", p: pt(FC, Z.motorTop + 1.5, 4.4, a), re: 1.6, d: G.unit3(G.add3(G.mul3(r, 0.8), [0, 0, -0.4])), kind: 1, len: 60, seed: 11 + i }; }),
  ],
  occ: [
    { asm: "s1", x: 0, y: 0, z0: Z.base - 4, z1: Z.sicTop, r0: R1 - 4, r1: R1 + 0.2 },
    { asm: "ring", x: 0, y: 0, z0: Z.sicTop, z1: Z.isTop, r0: R1 + 0.2, r1: R1 + 0.2 },
    { asm: "s2", x: 0, y: 0, z0: Z.isTop, z1: Z.s2Top, r0: R1, r1: R1 },
    { asm: "ais", x: 0, y: 0, z0: Z.s2Top, z1: Z.aisTop, r0: R1 + 0.2, r1: R3 + 0.4 },
    { asm: "s4", x: 0, y: 0, z0: Z.aisTop, z1: Z.iuTop, r0: R3, r1: R3 },
    { asm: "sla", x: 0, y: 0, z0: Z.iuTop, z1: Z.slaTop, r0: R3 + 0.2, r1: RS + 0.6 },
    { asm: "csm", x: 0, y: 0, z0: Z.slaTop, z1: Z.smTop, r0: RS, r1: RS },
    { asm: "les", x: 0, y: 0, z0: Z.smTop, z1: Z.cmTop, r0: RS + 0.6, r1: 4.6 },
    { asm: "les", x: 0, y: 0, z0: Z.towerTop, z1: Z.motorTop, r0: 5.4, r1: 3.6 },
    ...F1.map(([x, y]) => ({ asm: "eng", x, y, z0: 0, z1: 48, r0: F1R(0), r1: F1R(48) })),
    ...QUAD.map((a) => { const r = G.radialOf(FC, a); return { asm: "s1", x: r[0] * 32, y: r[1] * 32, z0: 36, z1: Z.base + 16, r0: 11.5, r1: 18.2 }; }),
  ],
  deck: { asm: "ml", rect: [DECK.x, DECK.y, DECK.x + DECK.w, DECK.y + DECK.d], top: DECK_TOP, bottom: DECK_TOP - DECK_T, holes: [[HOLE.x, HOLE.y, HOLE.x + HOLE.w, HOLE.y + HOLE.d]] },
};
const LABELS = [
  ["les-nose", pt(FC, 1106, 1.5, FRONT), "L", "Q-ball nose & canards", "les"],
  ["les-motor", pt(FC, 1085, 5, FRONT), "L", "Launch escape motor", "les"],
  ["les-tower", pt(FC, 1046, 4.5, FRONT), "L", "Escape tower", "les"],
  ["les-bpc", pt(FC, 1008, CMR(1008) + 0.6, FRONT), "L", "Command module under its cover", "les"],
  ["sm", pt(FC, 970, RS, FRONT), "L", "Service module", "csm"],
  ["sla", pt(FC, 905, SLA(905), FRONT), "L", "Adapter with the LM inside", "sla" + PETAL_ORDER[3]],
  ["iu", pt(FC, 857, R3 + 0.2, FRONT), "L", "Instrument unit", "s4"],
  ["s4", pt(FC, 800, R3, FRONT), "L", "S-IVB third stage", "s4"],
  ["s4-ais", pt(FC, 690, R1 - 9, FRONT), "L", "S-IVB aft interstage", "ais"],
  ["s2", pt(FC, 560, R1, FRONT), "L", "S-II second stage", "s2"],
  ["s2-ring", pt(FC, 440, R1, FRONT), "L", "S-II interstage ring", "ring"],
  ["s1-fwd", pt(FC, 396, R1, FRONT), "L", "S-IC forward skirt", "s1"],
  ["s1-lox", pt(FC, 300, R1, FRONT), "L", "S-IC LOX tank", "s1"],
  ["s1-it", pt(FC, 222, R1, FRONT), "L", "Intertank", "s1"],
  ["s1-fuel", pt(FC, 150, R1, FRONT), "L", "S-IC RP-1 tank", "s1"],
  ["f1", [32 * Math.cos(FRONT - Math.PI / 4 + Math.PI / 2 * 0), 0, 10], "L", "5 × F-1 engines", "eng"],
  ["s4-aps", pt(FC, Z.aisTop + 12, R3 + 4, 0), "R", "APS module", "s4"],
  ["s2-ullage", pt(FC, 452, R1 + 2.6, 0.2), "R", "Ullage motors", "ring"],
  ["s1-fins", pt(FC, 70, 80, FRONT + Math.PI / 4), "R", "Fins & engine fairings", "s1"],
  ["ml-hold", [R1 + 14, 0, DECK_TOP + 10], "R", "Hold-down arms", "ml"],
  ["ml-lut", [LUT.x1, LUT.y1, 760], "R", "Launch umbilical tower", "ml"],
  ["ml-deck", [DECK.x + DECK.w - 20, DECK.y + DECK.d, DECK_TOP - 12], "R", "Mobile Launcher 1", "ml"],
];
labels(LABELS, { L: -270, R: 270 });

// =====================================================================================
// MISSION
// =====================================================================================
const MISSION = String.raw`
// 3-D (times = MAP times below): liftoff, ascent to TLI and separation, transposition & docking, Eagle's landing and stay,
// lunar liftoff, docking in lunar orbit, entry, splashdown; free flight in between
const LANDINGS = [
  { id: "svpad", from: -9, to: 30 }, { id: "svasc", from: 30, to: 15308 }, { id: "td", at: 15420 }, { id: "lm", at: 369940, to: 447717 },
  { id: "lmasc", at: 447720 }, { id: "lmdock", at: 460980 }, { id: "asplash", at: 703115, to: 703115 + 2400 },
  { id: "coast", craft: [[-1e9, "csmlm"], [360720, "lm"], [447720, "lmasc"], [460980, "csmasc"], [468600, "csm"], [701340, "apolloCm"]], chutes: [3, 25.4, 30, "#d33a2c"] },
];
// ---- Apollo 11, 16 July 1969, time-warped
const T_START = -9, T_END = 11880;
const WIN = [[-9, 14, 1], [130, 172, 4], [185, 200, 4], [540, 560, 5], [9850, 10220, 120], [11700, 11880, 20]];
function speedAt(t) { let b = t < 14 ? 1 : t < 60 ? 1 + (t - 14) * 0.45 : t < 720 ? 22 : 300; for (const [a, z, v] of WIN) if (t >= a && t <= z) b = Math.min(b, v); return b; }
const ALT = [[-9, 0], [0, 0], [12, 0.13], [30, 1.2], [66, 7.5], [83, 12.5], [135, 44], [162, 67], [200, 95], [460, 176], [552, 187], [700, 191], [9856, 334], [10200, 600], [11700, 6000], [T_END, 7400]];
const VEL = [[-9, 0], [0, 0], [12, 80], [30, 380], [66, 1250], [83, 1700], [135, 5700], [162, 8600], [200, 9500], [460, 22000], [552, 24600], [700, 28000], [9856, 28000], [10200, 38900], [11700, 26000], [T_END, 24000]];
const EVENTS = [[-8.9, "Ignition sequence start", 3], [-6, "F-1 engines at full thrust", 6], [0, "LIFTOFF · hold-down arms release", 12], [12, "Tower cleared", 8], [66, "Mach 1: vapour cone", 10], [83, "Max-Q", 10], [135, "Centre engine cutoff", 20], [161, "Outboard engine cutoff · S-IC separation", 4], [164, "S-II ignition", 20], [191, "Interstage ring jettison", 6], [197, "Launch escape tower jettison", 30], [548, "S-II cutoff · S-IVB ignition", 30], [699, "Earth orbit insertion", 600], [9856, "Translunar injection burn", 350], [11700, "CSM separation · adapter petals open", 180]];
// ---- the rest of Apollo 11 on the mission map (real mission elapsed times, seconds)
const MAP = (() => {
  const { orb, hyp, con, fix, path, xfer, blend, dock, period, ang } = MM;
  const PI = Math.PI;
  const tLOI = 272990, tUndock = 360720, tDOI = 365760, tLand = 369940, tLift = 447720, tIns = 448154, tDock = 460980, tJett = 468600;
  const tTEI = 487422, tSM = 701340, tEI = 702186, tDrogue = 702666, tMain = 702716, tSplash = 703115, END = tSplash + 2400;
  const SITE = PI + 0.02;            // Tranquility Base, on the near side (Earth is to the left)
  const peri = SITE - 0.27;          // Eagle's low point, where powered descent starts
  const llo = orb("moon", 110, 110, peri - PI, tDOI);                    // Columbia, 110 km circular
  const doi = orb("moon", 15, 110, peri, 0); doi.tp = tDOI + period(doi) / 2; // Eagle after DOI: 15 x 110 km
  const tPDI = doi.tp;
  const leo = orb("earth", 190, 190, PI - 0.45, 9856);                   // parking orbit, phased so TLI aims at the Moon
  const site0 = ang(leo, 702) - 0.33;                                    // LC-39A
  const tli = orb("earth", 334, 470000, ang(leo, 10203) + 0.04, 10203);
  const loi = hyp("moon", 110, 1.15, ang(llo, tLOI), tLOI);
  const tei = hyp("moon", 110, 1.2, ang(llo, tTEI), tTEI);
  const ret = con("earth", 40, 0.97, 3.29, tEI + 60);
  const aEI = ang(ret, tEI), aSplash = aEI + 0.43;
  const csm = {
    id: "csm", col: "#ffd29a", name: [[-1e9, "Apollo 11"], [11700, "Columbia"]],
    g: [[-1e9, "saturn"], [161, "stack"], [11700, "csm"], [15420, "csmlm"], [tUndock, "csm"], [tDock, "csmlm"], [tJett, "csm"], [tSM, "cm"]],
    path: [
      [-9, fix("earth", site0)],
      [0, path("earth", [[0, site0, 0, 0], [60, site0 + 0.0008, 7, 1500], [162, site0 + 0.014, 67, 8600], [400, site0 + 0.13, 172, 19000], [548, site0 + 0.24, 187, 24600], [702, null, null]])],
      [702, leo], [9856, blend("earth")], [10203, tli], [40000, xfer(0.45, 0.3)], [tLOI - 50000, loi], [tLOI, llo],
      [tTEI, tei], [tTEI + 50000, xfer(0.45, -0.3)], [tEI - 45000, ret],
      [tEI, path("earth", [[tEI, null, null], [tEI + 150, aEI + 0.17, 64, 37000], [tEI + 300, aEI + 0.32, 48, 18000], [tEI + 394, aEI + 0.39, 25, 4000], [tDrogue, aEI + 0.42, 7.3, 640], [tMain, aEI + 0.425, 3, 300], [tSplash, aSplash, 0, 30]])],
      [tSplash, fix("earth", aSplash)],
    ],
    fx: [[0, 700, "burn"], [9856, 10203, "burn"], [tLOI, tLOI + 357, "burn"], [tTEI, tTEI + 150, "burn"], [tDrogue, tMain, "chute1"], [tMain, tSplash, "chute2"]],
    pose: [[tSM, tDrogue, "retro"], [tDrogue, END, "up"]],
  };
  const lm = {
    id: "lm", col: "#ffe08a", name: "Eagle", end: tJett + 9000, g: [[0, "lm"], [tLift, "lmasc"]],
    path: [
      [tUndock, dock("csm", true)], [tDOI, doi],
      [tPDI, path("moon", [[tPDI, null, null], [tPDI + 300, peri + 0.17, 9, 3600], [tPDI + 600, peri + 0.25, 2, 900], [tPDI + 700, SITE - 0.002, 0.15, 60], [tLand, SITE, 0, 0]])],
      [tLand, fix("moon", SITE)],
      [tLift, path("moon", [[tLift, SITE, 0, 0], [tLift + 60, SITE + 0.002, 1.2, 500], [tLift + 200, SITE + 0.05, 10, 2800], [tIns, null, null]])],
      [tIns, orb("moon", 17, 83, SITE + 0.25, tIns)], [tIns + 1500, blend("moon")], [tDock, dock("csm")],
      [tJett, orb("moon", 110, 110, ang(llo, tJett) - 0.004, tJett)],
    ],
    fx: [[tDOI, tDOI + 30, "burn"], [tPDI, tLand, "burn"], [tLand - 25, tLand + 15, "dust"], [tLift, tIns, "burn"], [tLift, tLift + 12, "dust"]],
    pose: [[tPDI + 520, tLift + 40, "up"]],
  };
  // back in the 3-D view from service module jettison to splashdown
  const home = {
    t0: tSM - 120,
    state(t, h) {
      const P0 = FLIGHT.pivot.cm, c = fxClock, u = Math.max(0, t - tSM);
      const tilt = t < tDrogue ? 16 + 3 * Math.sin(c * 2.3) : t < tSplash ? 5 * Math.sin(c * 1.2) : 3 * Math.sin(c * 0.8);
      const fs = { asm: { cm: { v: [0, 0, 0], rot: tilt, piv: P0 }, glow: { v: [0, 0, 0] } } };
      fs.asm.csm = { v: [-0.5 * u, 0, -(0.6 * u + 0.004 * u * u)], rot: tilt - 0.25 * u, piv: P0, hide: u > 240 };
      fs.chute1 = sm(tDrogue, tDrogue + 3, t) * (1 - sm(tMain, tMain + 2, t));
      fs.chute2 = (0.4 * sm(tMain, tMain + 3, t) + 0.6 * sm(tMain + 9, tMain + 15, t)) * (1 - sm(tSplash + 8, tSplash + 20, t));
      fs.asm.sea = { v: [0, 0, -480 * Math.pow(Math.min(1, h.alt / 3), 0.7)], hide: h.alt > 3 };
      fs.splash = t >= tSplash;
      const k1 = sm(tSM + 30, tSM + 200, t), k2 = sm(tDrogue, tMain + 20, t), k3 = sm(tSplash, tSplash + 30, t);
      fs.camZ = 985 + 22 * k1 + 70 * k2 - 50 * k3;
      fs.zoom = (5.5 + 3 * k1) * (1 - 0.4 * k2) * (1 + 0.15 * k3);
      return fs;
    },
  };
  return {
    end: END, objs: [csm, lm], home,
    hud: [[-1e9, "csm"], [tUndock, "lm"], [tDock, "csm"]],
    marks: [
      { b: "earth", a: site0, kind: "pad", name: "LC-39A", to: 30000 },
      { b: "moon", a: SITE, kind: "lmdesc", from: tLift },
      { b: "moon", a: SITE - 0.0004, kind: "flag", name: "Tranquility Base", from: tLand },
      { b: "earth", a: aSplash + 0.0006, kind: "boat", name: "USS Hornet", from: tEI - 30000 },
    ],
    cam: [
      [-9, "csm", 500], [200, "csm", 1500], [600, "earth", 9800], [10000, "earth", 40000], [16000, "sys", 250000],
      [tLOI - 50000, "moon", 40000], [tLOI - 3000, "moon", 4200], [tUndock - 1000, "lm", 900], [tPDI - 600, "lm", 300],
      [tPDI + 560, "lm", 22], [tLand + 400, "lm", 8], [tLift - 600, "lm", 30], [tLift + 300, "lm", 400], [tIns + 1200, "moon", 4200],
      [tTEI - 2000, "csm", 3000], [tTEI + 3000, "moon", 40000], [tTEI + 60000, "sys", 250000], [tEI - 60000, "earth", 40000],
      [tEI - 3000, "csm", 9000], [tEI - 300, "csm", 1500], [tEI + 200, "csm", 300], [tDrogue - 60, "csm", 30], [tMain + 120, "csm", 8],
    ],
    events: [
      [15420, "Transposition & docking · Eagle pulled from the S-IVB"], [40000, "Translunar coast · three days out"],
      [tLOI - 50000, "Entering the Moon's sphere of influence"], [tLOI, "Lunar orbit insertion · behind the Moon, no radio"],
      [tUndock, "Eagle undocks · “The Eagle has wings”"], [tDOI, "Descent orbit insertion"], [tPDI, "Powered descent initiation"],
      [tPDI + 300, "1202 program alarm · still GO"], [tLand - 1, "Contact light"], [tLand, "“The Eagle has landed” · Tranquility Base"],
      [393860, "“One small step” · first moonwalk"], [401940, "Moonwalk ends · 2 h 31 min outside"], [tLift, "Lunar liftoff · ascent stage"],
      [tDock, "Eagle docks with Columbia"], [tJett, "Ascent stage jettisoned"], [tTEI, "Trans-Earth injection · behind the Moon"],
      [tTEI + 60000, "Trans-Earth coast · 2½ days"], [tSM, "Service module jettisoned"], [tEI, "Entry interface · 11 km/s at 122 km"],
      [tEI + 150, "Peak heating · radio blackout"], [tDrogue, "Drogue parachutes"], [tMain, "Main parachutes"],
      [tSplash, "Splashdown · Pacific Ocean · 8 d 3 h 18 min"], [tSplash + 1800, "Crew recovered by USS Hornet"],
    ],
  };
})();
const RET = MAP.home;
const arms = [...svg.querySelectorAll("[data-arm]")];
const f1clip = svg.querySelector("#svf1clip"), f1g = svg.querySelector('[clip-path="url(#svf1clip)"]');
const riseAt = (t) => (t > 0.3 ? 8.5 * (t - 0.3) ** 2 : 0);
const S1 = ["eng", "s1"];
function flightState(t) {
  const fs = { asm: {}, t };
  const rise = riseAt(t);
  fs.asm.ml = { v: [0, 0, -rise], hide: rise > 7000 };
  if (t > 162) { const u = t - 162; for (const n of S1) fs.asm[n] = { v: [0, 0, -(6 * u + 0.9 * u * u)], rot: 0.5 * u, piv: FLIGHT.pivot.s1, hide: u > 60 }; }
  if (t > 191) { const u = t - 191; fs.asm.ring = { v: [0, 0, -(2 * u + 0.6 * u * u)], rot: 0.4 * u, piv: FLIGHT.pivot.s1, hide: u > 40 }; }
  if (t > 197) { const u = t - 197; fs.asm.les = { v: [2.2 * u, 0, 12 * u + 1.4 * u * u], rot: 0.3 * u, piv: FLIGHT.pivot.les, hide: u > 60 }; }
  if (t > 552) { const u = t - 552; for (const n of ["s2", "ais"]) fs.asm[n] = { v: [0, 0, -(3 * u + 0.4 * u * u)], rot: 0.2 * u, piv: FLIGHT.pivot.s2, hide: u > 80 }; }
  if (t > 11700) {
    const u = t - 11700;
    fs.asm.csm = fs.asm.cm = { v: [0, 0, 0.5 * u] };
    for (let i = 0; i < 4; i++) {
      const a = ASM["sla" + i].v, n = Math.hypot(a[0], a[1]);
      const k = Math.min(1, u / 30), d = 30 * k * k + 0.5 * Math.max(0, u - 30);
      fs.asm["sla" + i] = { v: [(a[0] / n) * d, (a[1] / n) * d, -0.2 * d], rot: FLIGHT.side[i] * 38 * k, piv: FLIGHT.pivot.sla, hide: u > 160 };
    }
  }
  fs.f1 = t < -6.4 ? 0 : t < 135 ? sm(-6.4, -3.5, t) : 1 - sm(160.6, 161.6, t);
  fs.f1c = t < 135 ? fs.f1 : 1 - sm(134.6, 135.6, t);
  fs.j2 = t < 164 ? 0 : t < 548 ? sm(164, 167, t) : 1 - sm(547.5, 548.5, t);
  fs.j2s4 = (t > 552 && t < 700 ? sm(552, 555, t) * (1 - sm(698.5, 699.5, t)) : 0) + (t > 9856 && t < 10203 ? sm(9856, 9862, t) * (1 - sm(10201, 10203, t)) : 0);
  fs.fallback = { f1: fs.f1 };
  fs.steam = t > -6 ? ramp(t, -6, 25) : 0;
  fs.alt = interp(ALT, t);
  fs.vel = interp(VEL, t);
  if (t < 162) { const k = sm(-1, 12, t); fs.camZ = 560 - 300 * k; fs.zoom = 1 - 0.08 * k; }
  else if (t < 552) { const k = sm(162, 200, t); fs.camZ = 260 + (640 - 260) * k; fs.zoom = 0.92 + 0.28 * k; }
  else if (t < 11700) { const k = sm(552, 600, t); fs.camZ = 640 + (900 - 640) * k; fs.zoom = 1.2 + 0.5 * k; }
  else { fs.camZ = 900 + 0.12 * (t - 11700); fs.zoom = 1.7; }
  return fs;
}
function vehicleFx(fs) {
  const op = (1 - ramp(fs.t, -0.5, 1.5)).toFixed(3);
  for (const a of arms) a.style.opacity = op;
  // the deck drops away under the engines; once they clear it, stop clipping (they tumble after staging)
  const rise = riseAt(fs.t);
  f1clip.setAttribute("transform", "translate(0 " + (-rise * FLIGHT.dz).toFixed(2) + ")");
  rise > 60 ? f1g.removeAttribute("clip-path") : f1g.setAttribute("clip-path", "url(#svf1clip)");
}
function vehicleReset() { for (const a of arms) a.style.opacity = ""; f1clip.removeAttribute("transform"); f1g.setAttribute("clip-path", "url(#svf1clip)"); }
function fxState(fs) {
  const t = fs.t, alt = fs.alt, c = fxClock;
  const off = (n) => fs.asm[n] || { v: [0, 0, 0] };
  const sources = FXD.sources.map((s, i) => {
    const o = off(s.asm), v = o.v;
    let power = 0, ex = s.ex || 0, len = s.len, soot = s.soot || 0;
    if (s.id.startsWith("f1")) {
      const centre = s.id === "f1c";
      const stagger = centre ? 0 : (i % 2 ? 0.3 : 0.6);
      power = (t < 135 ? sm(-6.4 + stagger, -3.6 + stagger, t) : 1) * (centre ? 1 - sm(134.6, 135.6, t) : 1 - sm(160.6, 161.6, t));
      ex = sm(5, 55, alt); len *= 1 + ex * 0.7; soot *= 1 - ex * 0.8;
    } else if (s.id === "j2s2") power = 0.6 * fs.j2;
    else if (s.id === "j2s4") power = 0.6 * fs.j2s4;
    else if (s.id === "retro") power = burst(t - 161.7, 0.05, 0.7);
    else if (s.id === "ullage") power = burst(t - 161.9, 0.06, 1.2) * 0.9;
    else if (s.id === "tjm") power = burst(t - 197, 0.08, 1.1);
    if (o.hide) power = 0;
    const d = s.kind === 1 ? s.d : unit([s.d[0] + 0.01 * Math.sin(c * 2.1 + i), s.d[1] + 0.01 * Math.cos(c * 1.7 + i), s.d[2]]);
    return { p: [s.p[0] + v[0], s.p[1] + v[1], s.p[2] + v[2]], re: s.re, d, kind: s.kind, power: power * (1 + 0.04 * Math.sin(c * 33 + i * 3.1)), len: len * (1 + 0.035 * Math.sin(c * 21 + i)), ex, soot, seed: s.seed, rings: s.rings, er: s.er };
  });
  const occ = FXD.occ.map((o) => {
    const a = off(o.asm), v = a.v;
    const gone = (S1.includes(o.asm) && t > 162) || (o.asm === "ring" && t > 191) || (["s2", "ais"].includes(o.asm) && t > 552) || (o.asm === "les" && t > 197) || (o.asm === "sla" && t > 11700);
    return { on: !a.hide && !gone, x: o.x + v[0], y: o.y + v[1], z0: o.z0 + v[2], z1: o.z1 + v[2], r0: o.r0, r1: o.r1, heat: 0 };
  });
  const rise = riseAt(t);
  const dk = FXD.deck;
  return {
    rise, sources, occ,
    deck: rise < 8000 ? dk : null,
    trail: { a: 8.5, t: t - 0.3, t0: 0, t1: 161, c: [0, 0], half: 0, r0: 50, start: 420, strength: 0.75, z: 0, growth: 1.1, thin: sm(8, 45, alt) },
    ground: { tau: Math.max(0, t + 6.4), smoke: 0.9 * sm(-6, 0, t), steam: 0.6 * sm(-6, -1, t), z: dk.bottom, c: [0, -30], rmax: 900, dust: 0.25 },
    vapor: sm(62, 68, t) * (1 - sm(80, 88, t)),
    vap: [1024, 760, 21],
    flash: 0.6 * burst(t + 6.2, 0.1, 0.8) + 0.5 * burst(t - 161.7, 0.05, 0.5),
    green: 0,
    sparks: 0, spark: [0, 0, 0, 1],
    wind: [7, 3], sun: 1,
  };
}
function shakeAt(t) {
  const a = 3.2 * burst(t - 0.3, 0.1, 2.4) + 1.6 * sm(-5, -3, t) * (1 - sm(10, 22, t)) + 0.8 * (sm(62, 68, t) * (1 - sm(80, 88, t))) + 2 * burst(t - 161.7, 0.04, 0.5);
  const c = fxClock;
  return [a * (Math.sin(c * 61) * 0.6 + Math.sin(c * 37 + 1) * 0.4), a * (Math.sin(c * 53 + 2) * 0.6 + Math.sin(c * 89) * 0.4)];
}
`;

const CSS = `
.m-lutred{--anatomy-paper:#8e2a1e;--anatomy-shade-0:#4e140c;--anatomy-shade-1:#661b11;--anatomy-shade-2:#842517;--anatomy-shade-3:#a12f1e;--anatomy-top:#bb3e2a;--edge:#220704;--seam:#6e1d12;--seam2:#5a170e;--dot:#2a0905}
.m-lutred .tw-o,.m-lutred .twb-o{stroke:#2b0a06}.m-lutred .tw-i{stroke:#b23a26}.m-lutred .twb-i{stroke:#7a2316}.m-lutred .twl-i{stroke:#c0503a}
.m-lesred .les-o{fill:none;stroke:#3a0d06;stroke-linecap:round}.m-lesred .les-i{fill:none;stroke:#c8462a;stroke-linecap:round}
.m-mlgray{--anatomy-paper:#6e7277;--anatomy-shade-0:#3c3f43;--anatomy-shade-1:#4c5055;--anatomy-shade-2:#5e6267;--anatomy-shade-3:#72767b;--anatomy-top:#888c91;--edge:#18191b;--seam:#5a5e63;--seam2:#45484c;--dot:#202224}
.m-gold{--anatomy-paper:#b8902e;--anatomy-shade-0:#6e5212;--anatomy-shade-1:#8c6a1a;--anatomy-shade-2:#ad8526;--anatomy-shade-3:#c99d34;--anatomy-top:#e1b84a;--edge:#3a2a06;--seam:#9c7820;--seam2:#7a5c14}
.m-lmgray{--anatomy-paper:#9a9a94;--anatomy-shade-0:#55554f;--anatomy-shade-1:#6e6e68;--anatomy-shade-2:#8a8a83;--anatomy-shade-3:#a3a39c;--anatomy-top:#bdbdb6;--edge:#22221f}
.liq-rp1{fill:#e2b25a;opacity:.38}
.sv-text{font-family:Futura,"Century Gothic","Trebuchet MS",Arial,sans-serif;font-weight:700;fill:#121315}
.sv-text.sm{font-weight:700}
.sm-rad{fill:#e9ecee;stroke:#8f959b;stroke-width:.25}
.lbl-text{font-size:9px}
`;

buildPage({
  id: "saturnv",
  title: "Saturn V anatomy",
  h1: "Saturn V · Apollo 11",
  sub: "110.6 m tall · 2,970 t at liftoff · 34.5 MN thrust · 16 July 1969",
  figTitle: "Saturn V · Apollo 11 · LC-39A",
  label: "Saturn V rocket for Apollo 11 on Mobile Launcher 1 with its red launch umbilical tower: the black and white S-IC first stage with five F-1 engines, fins and engine fairings, the S-II, the S-IVB and instrument unit, the spacecraft adapter holding the lunar module, the service module, and the command module under its launch escape tower.",
  stageLabel: "Saturn V figure. Keys: Space launch, E explode, C cutaway, L name tags, plus and minus zoom, 0 fit.",
  caption: "Proportions follow NASA's Saturn V and Apollo drawings; colours follow Apollo 11's roll pattern. Explode separates the stages as they came apart: S-IC, interstage ring, S-II, aft interstage, S-IVB, the adapter's four petals, the CSM and the escape tower. Cutaway opens the tanks, shows the J-2s inside the interstages and the lunar module folded inside the adapter.",
  infoText: "Every piece of the stack is drawn as a real part. Turn on Cutaway to see the propellant, the five LOX tunnels through the kerosene tank, and the lunar module Eagle inside the adapter.",
  ASM,
  xHalf: 340,
  box: (apart) => {
    const off = (a) => (apart ? ASM[a].v : [0, 0, 0]);
    return [...k.boxCorners(DECK, DECK_TOP - DECK_T, DECK_TOP), G.add3([0, 0, Z.tip], off("les")), [0, -250, LUT.top + 53], [LUT.x1, LUT.y0, 0]];
  },
  FLIGHT,
  FXD,
  css: CSS,
  mission: MISSION,
});
