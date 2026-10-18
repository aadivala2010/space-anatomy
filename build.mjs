// SLS Block 1 (Artemis II) anatomy figure.
// node build.mjs            -> sls.html (dark)
// node build.mjs --light    -> sls-light.html
// World units are decimetres (10 = 1 m). x/y on the floor, z up. Core stage axis at x = y = 0.
import {
  k, G, TAU, P, V, sinA, cosA, RIGHT, BACK, at, depth, r1, poly, poly3, FZ, FRONT, pt, S, L, D, smooth01,
  GROUPS, PARTS, part, items, slot, put, arcAt, facing, surfQuad, checker, checkerRing, decalMatrix, decal, wormLetters, worm,
  meatball, esaLogo, usFlag, patchOutline, patchSvg, sectionSvg, liquidSvg, dome, tube, boxOn, band, fadedRibs, bandPath,
  flamePath, plumeGroup, labels, buildPage, sheen, contactShadow, chutesSvg, plasmaSvg, seaSvg, ripplesSvg,
} from "./lib.mjs";

// ---------------------------------------------------------------- geometry (dm)
const CORE_R = 42;
const SRB_R = 18.5;
const SRB_X = 66;
const Z = {
  // mobile launcher
  deckT: 34,
  // booster
  srbBase: 14, srbSkirtTop: 50, srbSegs: [50, 130, 210, 290, 370, 450], srbFwdSkirt: 484, srbTip: 552,
  // core stage
  coreBase: 50, boatTop: 60, eng: 105, lh2Top: 445, itTop: 512, loxTop: 646, coreTop: 696,
  // upper stack
  lvsaCyl: 714, lvsaTop: 776, icpsTop: 796, osaTop: 808, sajTop: 858,
  cmBase: 860, cmTop: 898, ogiveBase: 856, ogiveTop: 920, towerBase: 928, nozzleTop: 938,
  jettison: 968, acm: 988, nose: 996, tip: 1010,
};

// ---------------------------------------------------------------- parts registry
GROUPS.push(
  ["las", "Launch Abort System"],
  ["orion", "Orion spacecraft"],
  ["upper", "Upper stage (ICPS) & adapters"],
  ["core", "Core stage"],
  ["srb", "Solid rocket boosters"],
  ["ml", "Mobile Launcher 1 (deck section)"],
);
part("las-nose", "las", "LAS nose cone", "tip of the 13.4 m tower", "Aerodynamic cap at the very top of the launch abort tower, 98 m above the pad.");
part("las-acm", "las", "Attitude control motor", "8 thrust ports · up to 7,000 lbf", "A solid motor with eight valve-controlled ports that steer and flip the capsule during an abort, then orient it for parachute deployment.");
part("las-jettison", "las", "Jettison motor", "3 nozzles", "Pulls the whole launch abort system and fairing away from Orion once the crew is safely past the dangerous part of ascent.");
part("las-abort", "las", "Abort motor", "4 reverse-flow nozzles · ~400,000 lbf", "Can rip the crew module off a failing rocket in milliseconds. Its four nozzles point down and outward so the exhaust misses the capsule.");
part("las-ogive", "las", "Ogive fairing (boost protective cover)", "5.2 m Ø at base", "Composite shell over the crew module. It protects the capsule from heat, wind and noise during ascent and leaves with the LAS. Carries the US flag and NASA logotype.");
part("cm-shield", "orion", "Heat shield", "5.02 m Ø · Avcoat ablator", "The largest heat shield ever flown on a crewed craft; it chars away to protect the crew from ~2,760 °C on re-entry at ~40,000 km/h.");
part("cm-backshell", "orion", "Crew module backshell", "conical · 57.5° flank", "Thermal tiles over the pressure vessel; Artemis II's backshell is covered in reflective silver coating.");
part("cm-windows", "orion", "Cabin windows", "4 cabin + 2 hatch/docking", "Multi-pane windows the crew use to see Earth, the Moon, and to dock.");
part("cm-hatch", "orion", "Side hatch", "crew entry", "The crew climb in through this hatch from the crew access arm on the launch tower.");
part("cm-docking", "orion", "Docking tunnel & forward bay cover", "NASA Docking System", "Covers the parachute bay. Underneath it sit 11 parachutes: 2 drogues, 3 pilots and 3 mains (plus forward bay chutes).");
part("cm-rcs", "orion", "Crew module RCS thrusters", "12 thrusters", "Small hydrazine thrusters that point the capsule during re-entry after it separates from the service module.");
part("cm-cabin", "orion", "Crew cabin (pressure vessel)", "~9 m³ habitable", "Aluminium-lithium pressure vessel where four astronauts live for the ~10-day Artemis II mission.", true);
part("cm-seats", "orion", "Crew seats", "4 seats", "Four reclined seats: commander, pilot and two mission specialists.", true);
part("cm-chutes", "orion", "Parachutes", "3 × 35 m mains", "Packed in the forward bay; they slow the capsule to ~27 km/h for splashdown.", true);
part("cma", "orion", "Crew module adapter", "joins CM to ESM", "Ring that connects the crew module to the service module and carries power, data and fluid lines between them.");
part("esm", "orion", "European Service Module", "4 m Ø · built by ESA/Airbus", "Orion's powerhouse: propulsion, electricity, water, oxygen, nitrogen and thermal control. Covered in white thermal blankets and radiators.");
part("esm-arrays", "orion", "Solar array wings", "4 wings × 3 panels · 19 m span · ~11 kW", "Folded against the service module for launch, then unfolded into an X after the fairings drop away. 15,000 solar cells.");
part("esm-engine", "orion", "OMS-E main engine", "~6,000 lbf (26.7 kN)", "A refurbished Space Shuttle Orbital Maneuvering System engine that does Orion's big burns.");
part("esm-aux", "orion", "Auxiliary thrusters", "8 × 490 N", "Back-up and trim thrusters around the base of the service module.");
part("esm-rcs", "orion", "Reaction control pods", "24 × 220 N", "Small thrusters for fine attitude control.");
part("esm-tanks", "orion", "ESM propellant tanks", "MMH / MON-3", "Four large tanks of hypergolic propellant feed the main engine and thrusters.", true);
part("sa", "orion", "Spacecraft adapter", "cone", "Cone that joins the service module to the Orion stage adapter and carries the launch loads.");
part("saj", "orion", "Fairing panels (SAJ)", "3 panels", "Three panels enclose the service module during ascent, then jettison like flower petals to expose the solar arrays. They carry the NASA and ESA insignia.");
part("osa", "upper", "Orion stage adapter", "5 m Ø ring", "Connects Orion to the upper stage. On Artemis II it carried four CubeSats.");
part("icps-lh2", "upper", "ICPS hydrogen tank", "5.1 m Ø", "Interim Cryogenic Propulsion Stage, derived from the Delta IV upper stage. Its hydrogen tank is the white band seen above the adapter.");
part("icps-lox", "upper", "ICPS oxygen tank", "slung under the LH2 tank", "Insulated liquid oxygen tank hung from the hydrogen tank by a truss.", true);
part("icps-truss", "upper", "ICPS truss & avionics", "", "Struts that carry the LOX tank and engine loads into the hydrogen tank skirt.", true);
part("icps-bottles", "upper", "Helium & hydrazine bottles", "", "Pressurant and attitude-control propellant for the upper stage.", true);
part("icps-rl10", "upper", "RL10B-2 engine", "24,750 lbf (110 kN)", "Hydrogen-oxygen engine with a long carbon nozzle extension. On Artemis II it raised Orion's orbit before the crew headed for the Moon.", true);
part("lvsa", "upper", "Launch vehicle stage adapter", "8.4 → 5 m cone · orange foam", "Cone that tapers from the 8.4 m core stage to the 5 m upper stage and shields the RL10 engine. Insulated with the same orange foam as the core.");
part("lvsa-joint", "upper", "Frangible separation joint", "", "Explosive ring that lets the upper stage separate from the adapter after core stage cutoff.");
part("core-fwdskirt", "core", "Forward skirt", "3 m tall", "Top of the core stage. Houses the flight computers, avionics and cameras.");
part("core-lox", "core", "Liquid oxygen tank", "742,000 L (196,000 gal) · −183 °C", "Holds the oxidiser for the four RS-25s. Covered in orange spray-on foam insulation.");
part("core-intertank", "core", "Intertank", "stiffened by external stringers", "The core stage's backbone between the two tanks. The boosters push on it through the thrust beam inside.");
part("core-beam", "core", "Thrust beam", "inside the intertank", "A heavy beam linking the two booster forward attach points, carrying their thrust into the core.", true);
part("core-lh2", "core", "Liquid hydrogen tank", "~40 m long · 2,033,000 L (537,000 gal) · −253 °C", "The largest part of the rocket. Its orange colour is foam insulation, left unpainted to save weight.");
part("core-feedline", "core", "LOX feedlines", "2 lines outside the LH2 tank", "Carry liquid oxygen ~45 m down the outside of the hydrogen tank to the engines.");
part("core-press", "core", "Pressurisation lines", "GO2 / GH2", "Bring warm gas back up from the engines to keep the tanks pressurised as they drain.");
part("core-tunnel", "core", "Systems tunnel", "cable tray", "Carries electrical cables between the forward skirt and the engine section.");
part("core-engsec", "core", "Engine section", "houses 4 RS-25s", "Holds the engines, their thrust vector control actuators and the aft booster attachment points.");
part("core-boattail", "core", "Boat-tail & heat shield", "", "Fairing and heat shield around the engines that protect plumbing from the boosters' heat.");
part("core-umb", "core", "Tail service umbilical plates", "", "Where the launcher's masts plug in hydrogen, oxygen, power and purge lines. They drop away at liftoff.");
part("core-marks", "core", "Photogrammetry targets", "black & white checkers", "High-contrast marks that tracking cameras use to measure the rocket's motion.");
part("rs25", "core", "RS-25 engines (×4)", "512,000 lbf each · 4.3 m tall", "Former Space Shuttle main engines, burning hydrogen and oxygen for about 8 minutes.");
part("core-thrust", "core", "Engine thrust structure", "", "Frame that carries the engines' thrust into the core stage.", true);
part("core-lh2feed", "core", "LH2 feedlines", "4 lines, one per engine", "Run from the bottom of the hydrogen tank to each engine's fuel pump.", true);
part("core-loxliq", "core", "Liquid oxygen", "", "Pale blue liquid oxygen, cut away to show the fill level.", true);
part("core-lh2liq", "core", "Liquid hydrogen", "", "Clear liquid hydrogen; only 1/14 the density of water, which is why its tank is so big.", true);
part("core-baffles", "core", "Slosh baffles", "", "Rings inside the tanks that stop the propellant sloshing.", true);
part("core-avionics", "core", "Flight computers", "", "Three flight computers and avionics boxes mounted in the forward skirt.", true);
part("srb-nose", "srb", "Booster nose cone", "", "Aerodynamic nose; houses the forward booster separation motors.");
part("srb-bsm", "srb", "Booster separation motors", "8 per booster", "Small solid motors (4 forward, 4 aft) that push the spent boosters away from the core stage at ~2 minutes.");
part("srb-fwdskirt", "srb", "Booster forward skirt", "", "Houses booster avionics and carries the forward attachment to the core stage.");
part("srb-seg", "srb", "Motor segments (×5)", "54 m tall · 3.7 m Ø · 3.6 million lbf", "Five steel segments full of propellant. The two boosters give more than 75% of the thrust at liftoff and burn for about 2 minutes.");
part("srb-joints", "srb", "Field joints", "over 100 pins + 3 O-rings each", "Where the segments are pinned together at Kennedy Space Center.");
part("srb-aftskirt", "srb", "Booster aft skirt", "", "Flared skirt that carries the whole 2,600 t rocket on the launcher's support posts; houses the thrust vector control actuators.");
part("srb-nozzle", "srb", "Booster nozzle", "3.9 m exit", "Gimballed by hydraulic actuators to steer the rocket.");
part("srb-tray", "srb", "Booster cable tray", "", "Covers the electrical cables that run along the side of each booster.");
part("srb-fwdattach", "srb", "Forward attach fitting", "into the intertank", "Ball-and-socket fitting that transfers each booster's thrust into the core stage.");
part("srb-struts", "srb", "Aft attach struts", "3 per booster", "Struts that tie each booster to the core stage engine section.");
part("srb-logo", "srb", "NASA logotype & America 250", "", "The red NASA 'worm' (rotated 45° to face forward on Artemis II) and America 250 emblems.");
part("srb-marks", "srb", "Booster photogrammetry targets", "", "Checkered rings; the black ring under the nose marks the left-hand booster.");
part("srb-grain", "srb", "Solid propellant (PBAN)", "~630 t per booster", "Ammonium perchlorate oxidiser and aluminium fuel in a rubbery binder. It burns from the inside out.", true);
part("srb-bore", "srb", "Central bore", "star-shaped up front", "The hollow centre the propellant burns from. The forward segment's star shape gives extra thrust at liftoff.", true);
part("ml-deck", "ml", "Launcher deck", "steel, 7.6 m thick", "The platform the crawler-transporter carries to the pad. It holds the rocket down until ignition.");
part("ml-holes", "ml", "Exhaust openings", "", "Let the plumes pass through the deck into the flame trench.");
part("ml-vsp", "ml", "Vehicle support posts (8)", "4 under each booster", "The whole ~2,600 t rocket stands on these eight posts until liftoff.");
part("ml-tower", "ml", "Launch umbilical tower", "~108 m tall · steel truss", "The tower on Mobile Launcher 1 carries the crew access arm and the umbilical arms that feed propellant, power, data and conditioned air into the rocket until launch.");
part("ml-caa", "ml", "Crew access arm", "with white room", "The walkway the four Artemis II astronauts crossed to reach Orion's hatch. The white room at its end seals against the spacecraft.");
part("ml-umbs", "ml", "Umbilical arms", "Orion, ICPS, forward skirt, intertank", "Swing-arms that carry propellant, gases, power and data lines to each stage. They release and swing back at liftoff.");
part("ml-mast", "ml", "Lightning mast", "", "Fibreglass mast on top of the tower that protects the rocket from lightning strikes at the pad.");
part("ml-tsmu", "ml", "Tail service mast umbilicals (2)", "", "Feed hydrogen, oxygen and power into the core stage engine section and retract at liftoff.");

// ---------------------------------------------------------------- explode plan
const ASM = {
  srbL: { v: [-64, 0, 20], delay: 0.28 },
  srbR: { v: [64, 0, 20], delay: 0.28 },
  es: { v: [0, 0, 0], delay: 0.45 },
  lh2: { v: [0, 0, 16], delay: 0.42 },
  it: { v: [0, 0, 32], delay: 0.39 },
  lox: { v: [0, 0, 48], delay: 0.36 },
  fs: { v: [0, 0, 64], delay: 0.33 },
  lvsa: { v: [0, 0, 84], delay: 0.3 },
  icps: { v: [0, 0, 190], delay: 0.24 },
  osa: { v: [0, 0, 206], delay: 0.2 },
  sa: { v: [0, 0, 222], delay: 0.16 },
  esm: { v: [0, 0, 238], delay: 0.16 },
  cm: { v: [0, 0, 270], delay: 0.08 },
  las: { v: [0, 0, 330], delay: 0 },
  deck: { v: [0, 0, 0], delay: 0 },
};
const SAJ_ANGLES = [FRONT, FRONT + TAU / 3, FRONT + (2 * TAU) / 3];
SAJ_ANGLES.forEach((a, i) => {
  const rad = G.radialOf(FZ(0, 0), a);
  ASM["saj" + i] = { v: [rad[0] * 52, rad[1] * 52, 196], delay: 0.1 };
});

// =====================================================================================
// MOBILE LAUNCHER DECK
// =====================================================================================
const DECK = { x: -175, y: -260, w: 350, d: 385, r: 3 };
const HOLE_C = { x: -40, y: -40, w: 80, d: 80 };
const HOLE_S = (side) => ({ x: side * SRB_X - 19, y: -19, w: 38, d: 38 });
let holeId = 0;
function holeSvg(h) {
  const id = "hole" + holeId++;
  const z = 0;
  const c = [[h.x, h.y], [h.x + h.w, h.y], [h.x + h.w, h.y + h.d], [h.x, h.y + h.d]];
  const top = c.map(([x, y]) => [x, y, z]);
  const deep = -Z.deckT;
  // walls on the far edges (min x and min y edges) face the viewer
  const wallY = [[h.x, h.y, z], [h.x + h.w, h.y, z], [h.x + h.w, h.y, deep], [h.x, h.y, deep]];
  const wallX = [[h.x, h.y, z], [h.x, h.y + h.d, z], [h.x, h.y + h.d, deep], [h.x, h.y, deep]];
  return `<clipPath id="${id}"><path d="${poly3(top)}"/></clipPath><path class="hole-void" d="${poly3(top)}"/><g clip-path="url(#${id})"><path class="hole-wall1" d="${poly3(wallY)}"/><path class="hole-wall2" d="${poly3(wallX)}"/>` + L(poly3([[h.x, h.y, -6], [h.x + h.w, h.y, -6]], false), "lo") + L(poly3([[h.x, h.y, -6], [h.x, h.y + h.d, -6]], false), "lo") + "</g>" + L(poly3(top), "hi", { className: "iso-edge" });
}
{
  let s = `<path class="iso-halo" d="${k.haloOf(DECK, -Z.deckT, Z.deckT, P)}"/>`;
  s += S(k.slabOf(DECK, -Z.deckT, Z.deckT, P, 3, 0.8));
  // deck plating seams and girder lines
  for (let x = DECK.x + 25; x < DECK.x + DECK.w; x += 25) {
    const inHole = (y) => [HOLE_C, HOLE_S(-1), HOLE_S(1)].some((h) => x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.d);
    const segs = [];
    let cur = null;
    for (let y = DECK.y; y <= DECK.y + DECK.d; y += 2) {
      if (!inHole(y) && y > DECK.y && y < DECK.y + DECK.d) (cur ??= []).push([x, y, 0]);
      else if (cur) segs.push(cur), (cur = null);
    }
    if (cur) segs.push(cur);
    s += segs.map((seg) => L(poly3(seg, false), "faint")).join("");
  }
  s += L(k.planOutline(k.insetPlan(DECK, 6), 0, P, 3), "lo");
  // side face panels and edge girder line
  s += L(poly3([[DECK.x + DECK.w, DECK.y, -12], [DECK.x + DECK.w, DECK.y + DECK.d, -12], [DECK.x, DECK.y + DECK.d, -12]], false), "faint");
  for (let x = DECK.x + 35; x < DECK.x + DECK.w; x += 35) s += L(poly3([[x, DECK.y + DECK.d, 0], [x, DECK.y + DECK.d, -Z.deckT]], false), "faint");
  for (let y = DECK.y + 35; y < DECK.y + DECK.d; y += 35) s += L(poly3([[DECK.x + DECK.w, y, 0], [DECK.x + DECK.w, y, -Z.deckT]], false), "faint");
  s += D(k.corners(DECK, 10).map(([x, y]) => at([x, y, 0])), { size: 0.6 });
  // engraved plate
  const plate = { x: DECK.x + DECK.w - 70, y: DECK.y + DECK.d - 18, w: 52, d: 10, r: 1 };
  s += S(k.slabOf(plate, 0, 0.5, P, 2), { crease: "none" });
  s += k.faceTextSvg(k.topMatrix([plate.x + 4, plate.y + 6.6], 0.5, P, "x"), "MOBILE LAUNCHER 1 · LC-39B", { size: 3.2, tone: "lo" });
  put(0, "ml-deck", "steel", s, { asm: "deck" });
  put(0, "ml-holes", "steel", holeSvg(HOLE_C) + holeSvg(HOLE_S(-1)) + holeSvg(HOLE_S(1)), { asm: "deck" });
  put(0, "ml-deck", "steel", contactShadow(0, 0, 0, 48, 0.3) + contactShadow(-SRB_X, 0, 0, 30, 0.3) + contactShadow(SRB_X, 0, 0, 30, 0.3), { asm: "deck" });
}
// Tail service masts (behind the core, on the tower side)
function tsmu(x) {
  const y = -78;
  const base = { x: x - 9, y: y - 9, w: 18, d: 18, r: 1 };
  let s = S(k.slabOf(base, 0, 4, P, 2, 0.4));
  const body = { x: x - 7, y: y - 7, w: 14, d: 14, r: 0.8 };
  s += S(k.slabOf(body, 4, 82, P, 2, 0.4));
  for (let z = 14; z < 86; z += 9) s += L(k.sideSeam(body, z, P, 2), "faint");
  // umbilical hood reaching to the core stage engine section
  const hood = { x: x - 6, y: y + 7, w: 12, d: -y - 7 - CORE_R + 3, r: 0.6 };
  s += S(k.slabOf(hood, 70, 12, P, 2, 0.4));
  s += L(k.sideSeam(hood, 76, P, 2), "faint");
  s += D([at([x, y + 10, 82]), at([x - 4, y + 20, 82]), at([x + 4, y + 20, 82])], { size: 0.5 });
  return s;
}
put(1, "ml-tsmu", "steel", tsmu(-24), { asm: "deck" });
put(1, "ml-tsmu", "steel", tsmu(24), { asm: "deck" });
// Vehicle support posts
function vsps(side, front) {
  let s = "";
  const cx = side * SRB_X;
  const posts = [[-19, -19], [19, -19], [-19, 19], [19, 19]].map(([dx, dy]) => [cx + dx, dy]);
  for (const [x, y] of posts.sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]))) {
    const isFront = depth([x - cx, y, 0]) > 0;
    if (isFront !== front) continue;
    s += S(k.slabOf({ x: x - 6, y: y - 6, w: 12, d: 12, r: 1 }, 0, 2.5, P, 2, 0.4));
    s += S(k.cylinder(x, y, 3.6, 2.5, 9.5, P, 20, 0.3));
    s += L(k.sideArc(x, y, 3.6, 7, P, 12), "faint");
    s += S(k.cylinder(x, y, 4.4, 12, 2, P, 20, 0.3));
    s += D(k.corners({ x: x - 6, y: y - 6, w: 12, d: 12, r: 1 }, 1.6).map(([a, b]) => at([a, b, 2.5])), { size: 0.4 });
  }
  return s;
}

// =====================================================================================
// SOLID ROCKET BOOSTERS
// =====================================================================================
function srbNoseR(z) {
  // ogive from r = SRB_R at srbFwdSkirt+10 to the tip
  const z0 = Z.srbFwdSkirt + 10;
  if (z <= z0) return SRB_R - ((z - Z.srbFwdSkirt) / 10) * 0.9;
  const x = (z - z0) / (Z.srbTip - z0);
  return Math.max(0.0, (SRB_R - 0.9) * Math.pow(1 - x, 0.78) * (1 - 0.04 * x));
}
function srb(side) {
  const L_ = side < 0;
  const asm = L_ ? "srbL" : "srbR";
  const cx = side * SRB_X;
  const F = FZ(cx, 0, 0);
  const zone = L_ ? 10 : 50;
  const toCore = side < 0 ? 0 : Math.PI; // angle pointing at the core
  const front = FRONT;
  const out = (mat, id, svg, view = "both") => put(zone, id, mat, svg, { asm, view });

  // nozzle (exit cone below the aft skirt)
  {
    const prof = [[0, 19.3], [1.2, 19.3], [4, 17.6, 1], [9, 15.2, 1], [14, 13.4, 1], [16, 13]];
    let s = S(G.solidOf(prof, F, P));
    s += L(arcAt(F, 1.2, 19.3), "lo") + L(arcAt(F, 8, 15.6, -0.42), "faint");
    s += fadedRibs(F, 2, 14, 16, 36, -0.32);
    out("nozzle", "srb-nozzle", s);
  }
  // aft skirt: flared cone on the support posts
  {
    const prof = [[Z.srbBase, 27], [Z.srbBase + 2.4, 27], [Z.srbBase + 3, 26.2], [Z.srbSkirtTop - 4, SRB_R + 0.6], [Z.srbSkirtTop, SRB_R + 0.4]];
    let s = S(G.solidOf(prof, F, P));
    const slope = (SRB_R + 0.6 - 26.2) / (Z.srbSkirtTop - 4 - Z.srbBase - 3);
    s += L(arcAt(F, Z.srbBase + 2.4, 27), "lo");
    for (const z of [24, 34]) s += L(arcAt(F, z, 26.2 + slope * (z - Z.srbBase - 3), slope), "faint");
    // stiffening ribs
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.1;
      if (facing(F, a, slope) < 0.12) continue;
      s += L(poly3([pt(F, Z.srbBase + 3, 26.2, a), pt(F, Z.srbSkirtTop - 4, SRB_R + 0.6, a)], false), "faint");
    }
    // holddown shoes over the posts
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const ang = a + (L_ ? 0 : 0);
      if (facing(F, ang) < 0.05) continue;
      s += `<path class="shoe" d="${surfQuad(F, Z.srbBase, Z.srbBase + 6, 27.1, 26.3, ang - 0.16, ang + 0.16)}"/>`;
    }
    s += checkerRing(F, Z.srbSkirtTop - 9, SRB_R + 2.6, 24, 3);
    out("white", "srb-aftskirt", s);
    // aft BSMs: four small motors on the skirt with exit ports
    let b = "";
    for (const a of [0.55, 0.55 + Math.PI / 2, 0.55 + Math.PI, 0.55 + 1.5 * Math.PI]) {
      if (facing(F, a) < 0.15) continue;
      const c = pt(F, Z.srbSkirtTop - 6, SRB_R + 1.8, a);
      b += S(G.solidOf([[0, 1.6], [7, 1.6], [8, 1.2]], G.frameAlong(G.add3(c, [0, 0, -4]), [0, 0, 1]), P));
      b += `<ellipse class="port" cx="${r1(at(G.add3(c, [0, 0, -4]))[0])}" cy="${r1(at(G.add3(c, [0, 0, -4]))[1])}" rx="1.4" ry="0.6"/>`;
    }
    out("white", "srb-bsm", b);
  }
  // five motor segments with field joints
  const segs = Z.srbSegs;
  for (let i = 0; i < 5; i++) {
    const z0 = segs[i];
    const z1 = segs[i + 1];
    const id = "srb-seg";
    let s = S(G.solidOf([[z0, SRB_R], [z1, SRB_R]], F, P), { crease: "none" }) + sheen(F, z0, z1, SRB_R, { strength: 0.2 });
    // factory joint mid-segment and stiffener rings
    s += L(arcAt(F, (z0 + z1) / 2, SRB_R), "faint");
    if (i === 0) s += L(arcAt(F, z0 + 12, SRB_R), "lo") + L(arcAt(F, z0 + 15, SRB_R), "lo"); // aft attach ring
    out("white", id, s, "whole");
  }
  // field joints as raised bands
  for (const z of segs.slice(1, 5)) {
    out("white", "srb-joints", band(F, z - 2.2, z + 2.2, SRB_R + 0.5) + D(G.dotsOf(F, z, SRB_R + 0.5, 48, P, { fade: [0.04, 0.42] }), { size: 0.3, tone: "lo" }), "whole");
  }
  // markings on the segments
  {
    let s = "";
    for (const z of [436, 362, 204, 122]) s += checkerRing(F, z, SRB_R + 0.05, 28, 3.2);
    for (const [z, da] of [[400, 0.25], [330, -0.45], [250, 0.2], [170, -0.3], [95, 0.35]]) s += checker(F, z, SRB_R + 0.05, front + da * side, 2.6);
    // vertical fiducial dashes
    for (const [z0, z1, da] of [[300, 316, 0.55], [258, 266, 0.55], [150, 160, -0.6], [340, 346, -0.6]]) {
      const a = front + da * side;
      if (facing(F, a) > 0.2) s += `<path class="ck" d="${surfQuad(F, z0, z1, SRB_R + 0.05, SRB_R + 0.05, a - 0.03, a + 0.03, 1)}"/>`;
    }
    out("white", "srb-marks", s, "whole");
  }
  // NASA worm (vertical) and America 250 on the forward segment
  {
    const aWorm = front - side * 0.18;
    let s = decal(F, 255, SRB_R + 0.06, aWorm, worm(10.5, { vertical: true }));
    const aA = front - side * 0.12;
    s += decal(F, 418, SRB_R + 0.06, aA, `<text class="a250-small" text-anchor="middle" font-size="2.2" y="-3.2">AMERICA</text><text class="a250" text-anchor="middle" font-size="7.5" y="4.4">250</text>`);
    out("white", "srb-logo", s, "whole");
  }
  // cable tray up the outboard side
  {
    const a = (L_ ? Math.PI : 0) + side * 0.5 * (L_ ? -1 : 1) - 0.45;
    const tray = boxOn(F, a, SRB_R - 0.4, 2.4, 3.2, Z.srbSkirtTop + 2, Z.srbSegs[5] + 22);
    let s = S(tray, { crease: "faint" });
    for (let z = Z.srbSkirtTop + 16; z < Z.srbSegs[5] + 20; z += 26) s += S(boxOn(F, a, SRB_R - 0.4, 2.9, 4.4, z, z + 1.6), { crease: "none" });
    out("white", "srb-tray", s, "whole");
  }
  // forward skirt
  {
    let s = S(G.solidOf([[Z.srbSegs[5], SRB_R], [Z.srbFwdSkirt, SRB_R]], F, P), { crease: "none" });
    s += L(arcAt(F, Z.srbSegs[5] + 1.5, SRB_R), "lo") + L(arcAt(F, Z.srbFwdSkirt - 1.5, SRB_R), "lo");
    s += D(G.dotsOf(F, Z.srbSegs[5] + 3.5, SRB_R, 40, P, { fade: [0.04, 0.42] }), { size: 0.28, tone: "lo" });
    s += D(G.dotsOf(F, Z.srbFwdSkirt - 3.5, SRB_R, 40, P, { fade: [0.04, 0.42] }), { size: 0.28, tone: "lo" });
    // access hatch
    const ha = front + side * 0.35;
    if (facing(F, ha) > 0.2) s += L(surfQuad(F, 460, 472, SRB_R + 0.05, SRB_R + 0.05, ha - 0.12, ha + 0.12), "lo");
    if (L_) s += `<path class="ring-black" d="${bandPath(F, Z.srbFwdSkirt - 9, Z.srbFwdSkirt - 4, SRB_R + 0.06)}"/>`;
    s += checkerRing(F, 476, SRB_R + 0.05, 24, 2.6);
    out("white", "srb-fwdskirt", s);
  }
  // nose cone
  {
    const prof = [];
    for (let i = 0; i <= 28; i++) {
      const z = Z.srbFwdSkirt + ((Z.srbTip - Z.srbFwdSkirt) * i) / 28;
      prof.push([z, srbNoseR(z), 1]);
    }
    prof[0] = [Z.srbFwdSkirt, SRB_R];
    prof[prof.length - 1] = [Z.srbTip, 0];
    let s = S(G.solidOf(prof, F, P, { smooth: true }));
    s += L(arcAt(F, Z.srbFwdSkirt + 10, srbNoseR(Z.srbFwdSkirt + 10), -0.09), "faint");
    const tipZ = Z.srbTip - 4;
    s += L(arcAt(F, tipZ, srbNoseR(tipZ), -0.5), "lo");
    out("white", "srb-nose", s);
    // forward BSM exhaust ports
    let b = "";
    for (const a of [0.3, 0.3 + Math.PI / 2, 0.3 + Math.PI, 0.3 + 1.5 * Math.PI]) {
      const z = 506;
      const sl = (srbNoseR(z + 1) - srbNoseR(z - 1)) / 2;
      if (facing(F, a, sl) < 0.15) continue;
      b += `<path class="port" d="${surfQuad(F, z - 1.6, z + 1.6, srbNoseR(z - 1.6) + 0.05, srbNoseR(z + 1.6) + 0.05, a - 0.13, a + 0.13)}"/>`;
    }
    out("white", "srb-bsm", b);
  }
  // attach hardware toward the core
  {
    const pBall = pt(F, 472, SRB_R + 1.2, toCore);
    const cBall = pt(FZ(0, 0), 472, CORE_R + 0.8, toCore + Math.PI);
    let s = tube([pBall, cBall], 1.5);
    s += G.sphereOf(cBall, 2.0, P) ? S(G.sphereOf(cBall, 2.0, P)) : "";
    s += S(G.sphereOf(pBall, 2.2, P));
    out("silver", "srb-fwdattach", s);
    let t = "";
    const c = (z) => pt(FZ(0, 0), z, CORE_R + 0.5, toCore + Math.PI);
    const b = (z) => pt(F, z, SRB_R + 0.6, toCore);
    t += tube([b(70), c(70)], 1.2) + tube([b(66), c(88)], 1.2) + tube([b(90), c(92)], 1.2);
    t += [b(70), b(66), b(90), c(70), c(88), c(92)].map((p) => S(G.sphereOf(p, 1.6, P))).join("");
    out("silver", "srb-struts", t);
  }

  // ---------------- cutaway version of the motor case: propellant grain and bore
  {
    const z0 = Z.srbSegs[0] + 1;
    const z1 = Z.srbSegs[5] - 1;
    const bore = (z) => {
      if (z < 130) return 9.5 - ((z - z0) / (130 - z0)) * 4.3; // aft segment flares toward the nozzle
      if (z > 372) return 7.4 + 0.9 * Math.sin(((z - 372) / 76) * Math.PI); // star bore
      return 5.2 - ((z - 130) / 240) * 0.8;
    };
    const caseR = SRB_R - 0.9;
    const prof = [];
    for (let i = 0; i <= 40; i++) prof.push([Z.srbSegs[0] + ((Z.srbSegs[5] - Z.srbSegs[0]) * i) / 40, SRB_R]);
    let s = "";
    // bore (concave back half)
    const bprof = [];
    for (let i = 0; i <= 40; i++) {
      const z = z0 + ((z1 - z0) * i) / 40;
      bprof.push([z, bore(z)]);
    }
    s += `<g class="m-bore">${patchSvg(F, bprof, 0, Math.PI, { steps: 40, edge: false, limbs: false, sort: false })}</g>`;
    // star fins seen on the back of the forward bore
    for (const a of [0.55, 1.05, 1.57, 2.09, 2.6]) s += L(poly3([pt(F, 374, bore(374) + 0.3, a), pt(F, 446, bore(446) + 0.3, a)], false), "lo", { className: "star" });
    // grain sections in the cut plane
    s += sectionSvg(F, z0, z1, bore, () => caseR, "grain", 80);
    // inhibitor slices at the field joints
    for (const z of Z.srbSegs.slice(1, 5)) {
      for (const a of [0, Math.PI]) s += `<path class="inhib" d="${poly3([pt(F, z - 0.6, bore(z), a), pt(F, z - 0.6, caseR, a), pt(F, z + 0.6, caseR, a), pt(F, z + 0.6, bore(z), a)])}"/>`;
    }
    // case wall (steel + insulation) strips
    s += sectionSvg(F, Z.srbSegs[0], Z.srbSegs[5], () => caseR, () => caseR + 0.5, "insul", 4);
    s += sectionSvg(F, Z.srbSegs[0], Z.srbSegs[5], () => caseR + 0.5, () => SRB_R, "casecut", 4);
    s += L(poly3([pt(F, Z.srbSegs[0], SRB_R, 0), pt(F, Z.srbSegs[5], SRB_R, 0)], false), "hi", { className: "iso-edge" });
    s += L(poly3([pt(F, Z.srbSegs[0], SRB_R, Math.PI), pt(F, Z.srbSegs[5], SRB_R, Math.PI)], false), "hi", { className: "iso-edge" });
    // field joint clevis bumps in section
    for (const z of Z.srbSegs.slice(1, 5)) for (const a of [0, Math.PI]) s += `<path class="casecut" d="${poly3([pt(F, z - 2.2, SRB_R, a), pt(F, z - 2.2, SRB_R + 0.5, a), pt(F, z + 2.2, SRB_R + 0.5, a), pt(F, z + 2.2, SRB_R, a)])}"/>`;
    put(zone, "srb-seg", "white", s.replace(/^/, ""), { asm, view: "cut" });
    // label the grain & bore separately by drawing invisible hit areas
    put(zone, "srb-grain", "white", sectionSvg(F, z0, z1, bore, () => caseR, "grain hit", 80), { asm, view: "cut" });
    put(zone, "srb-bore", "white", `<path class="hit" d="${poly3([pt(F, z0, bore(z0), 0), pt(F, z1, bore(z1), 0), pt(F, z1, bore(z1), Math.PI), pt(F, z0, bore(z0), Math.PI)])}"/>`, { asm, view: "cut" });
  }
}
// left (far) booster support posts and booster
put(5, "ml-vsp", "steel", vsps(-1, false), { asm: "deck" });
put(5, "ml-vsp", "steel", vsps(-1, true), { asm: "deck" });
srb(-1);

// =====================================================================================
// CORE STAGE STACK (zone 30) – pushed in paint order
// =====================================================================================
const FC = FZ(0, 0, 0);
const ENG = [[-16.5, -16.5], [16.5, -16.5], [-16.5, 16.5], [16.5, 16.5]].sort((a, b) => depth([a[0], a[1], 0]) - depth([b[0], b[1], 0]));
const FEED = [FRONT + 0.42, FRONT + 0.42 + Math.PI]; // LOX feedline angles (front-right, back-left)
const backFeed = FEED[1];
const frontFeed = FEED[0];

function bellR(z) {
  // RS-25 nozzle radius from the heat shield (z = 50) down to the exit (z = 9)
  const x = (50 - z) / 41;
  return 5.6 + 6.1 * (1 - Math.pow(1 - x, 1.7));
}
function rs25(x, y) {
  const F = FZ(x, y, 0);
  const prof = [];
  for (let i = 0; i <= 22; i++) {
    const z = 9 + (41 * i) / 22;
    prof.push([z, bellR(z), 1]);
  }
  prof[0] = [9, bellR(9)];
  const slope = (z) => (bellR(z + 0.5) - bellR(z - 0.5)) / 1;
  let s = S(G.solidOf([[8.2, bellR(9) + 0.25], [9.6, bellR(9) + 0.25]], F, P), { crease: "none" }); // exit lip
  s += S(G.solidOf(prof, F, P, { smooth: true }), { crease: "none" });
  // regeneratively cooled tube wall + hat bands
  const ribs = G.ribsOf(F, 10, 48, bellR(10), 72, P, { r1: bellR(48), fade: [0.05, 0.5] });
  s += k.fadedSvg(ribs, { tone: "faint" });
  for (const z of [16, 25, 34, 42]) s += L(arcAt(F, z, bellR(z), -slope(z) * -1 * -1), "lo");
  // thermal boot where the engine passes the heat shield
  s += S(G.solidOf([[47, bellR(47) + 1.6], [50, bellR(50) + 2.4]], F, P), { crease: "none" });
  return s;
}
function coreCut(F, prof, layers, extra = "") {
  return patchSvg(F, prof, 0, Math.PI, { steps: 96, layers, limbs: false }) + extra;
}
const LAYERS_FOAM = [{ t: 1.4, cls: "cut-foam" }, { t: 1.0, cls: "cut-metal" }];
const LAYERS_SKIN = [{ t: 0.8, cls: "cut-foam" }, { t: 1.4, cls: "cut-metal" }];
const LAYERS_PALE = [{ t: 0.8, cls: "cut-pale" }, { t: 1.4, cls: "cut-metal" }];

// back LOX feedline, systems tunnel and press lines (behind the core)
function feedline(a, front) {
  const F = FC;
  const r = CORE_R + 4.2;
  const top = pt(F, 455, CORE_R + 0.2, a);
  const pts = [top, pt(F, 452, r, a), pt(F, 112, r, a), pt(F, 104, CORE_R + 0.2, a)];
  const path = G.fillet(pts, 4, 7);
  let s = tube(path, 2.4);
  // support brackets every ~45 dm
  for (let z = 150; z < 440; z += 46) {
    const p = pt(F, z, r, a);
    s += S(G.disc(-1, 1, 3.3, G.frameAlong(p, [0, 0, 1]), P), { crease: "none" });
    s += tube([pt(F, z, CORE_R + 0.2, a), pt(F, z, r - 2.4, a)], 0.7, { caps: [false, false] });
  }
  // flex joints (bellows) top and bottom
  for (const z of [430, 130]) s += S(G.disc(-2.5, 2.5, 3, G.frameAlong(pt(F, z, r, a), [0, 0, 1]), P), { crease: "none" }) + L(arcAt(G.frameAlong(pt(F, z, r, a), [0, 0, 1]), 0, 3), "faint");
  return s;
}
function pressLines(a) {
  const F = FC;
  let s = "";
  for (const da of [0.09, 0.14]) {
    const r = CORE_R + 1.3;
    s += tube(G.fillet([pt(F, 458, CORE_R, a + da), pt(F, 455, r, a + da), pt(F, 110, r, a + da), pt(F, 106, CORE_R, a + da)], 2, 6), 0.55);
  }
  return s;
}
function tunnel(a) {
  return S(boxOn(FC, a, CORE_R - 0.4, 2.6, 4.6, 112, 440), { crease: "faint" }) + Array.from({ length: 8 }, (_, i) => S(boxOn(FC, a, CORE_R - 0.4, 3.1, 6, 120 + i * 42, 121.4), { crease: "none" })).join("");
}
put(28, "core-feedline", "orange2", feedline(backFeed), { asm: "lh2" });
put(28, "core-press", "orange2", pressLines(backFeed), { asm: "lh2" });

// RS-25s (back pair, then front pair)
for (const [x, y] of ENG) put(30, "rs25", "engine", rs25(x, y), { asm: "es" });

// ---- engine section + boat tail
{
  const F = FC;
  const prof = [[Z.coreBase, 36.5], [Z.boatTop, CORE_R], [Z.eng, CORE_R]];
  let s = S(G.solidOf(prof, F, P), { crease: "lo" });
  const slope = (CORE_R - 36.5) / (Z.boatTop - Z.coreBase);
  s += L(arcAt(F, Z.coreBase + 3, 36.5 + slope * 3, slope), "faint");
  s += L(arcAt(F, 72, CORE_R), "faint") + L(arcAt(F, 92, CORE_R), "faint") + L(arcAt(F, Z.eng - 1.5, CORE_R), "lo");
  // stringer ribs
  s += k.fadedSvg(G.ribsOf(F, Z.boatTop + 1, Z.eng - 2, CORE_R, 64, P, { fade: [0.05, 0.45] }), { tone: "faint" });
  s += D(G.dotsOf(F, Z.boatTop + 2, CORE_R, 64, P, { fade: [0.04, 0.42] }), { size: 0.3, tone: "lo" });
  // access doors
  for (const a of [FRONT - 0.4, FRONT + 0.9]) if (facing(F, a) > 0.2) s += L(surfQuad(F, 76, 88, CORE_R + 0.05, CORE_R + 0.05, a - 0.1, a + 0.1), "lo");
  s += checker(F, 82, CORE_R + 0.05, FRONT + 0.15, 2.6);
  put(30, "core-engsec", "pale", s, { asm: "es", view: "whole" });
  // boat-tail heat shield lip
  put(30, "core-boattail", "pale", band(F, Z.coreBase - 0.8, Z.coreBase + 1.2, 36.9), { asm: "es", view: "whole" });
  // umbilical plates (seen from the back mostly – one peeks at the side)
  put(28, "core-umb", "steel", S(boxOn(F, Math.PI / 2 + 0.25, CORE_R - 0.3, 1.6, 10, 72, 84)) + S(boxOn(F, Math.PI / 2 - 0.25, CORE_R - 0.3, 1.6, 10, 72, 84)), { asm: "es" });
  // cut version
  let c = coreCut(F, [[Z.coreBase, 36.5], [Z.boatTop, CORE_R], [Z.eng, CORE_R]], LAYERS_PALE);
  put(30, "core-engsec", "pale", c, { asm: "es", view: "cut" });
  // heat shield floor (back half) seen inside the cut engine section
  {
    const ring = [];
    for (let i = 0; i <= 48; i++) ring.push(pt(F, Z.coreBase + 1.2, 36.5, (Math.PI * i) / 48));
    let h = `<path class="floor" d="${poly3(ring)}"/>`;
    for (const [x, y] of ENG) {
      const c2 = [];
      for (let i = 0; i < 32; i++) c2.push(pt(FZ(x, y), Z.coreBase + 1.3, 8.4, (TAU * i) / 32));
      if (y <= 0 || depth([x, y, 0]) < 0) h += `<path class="boot" d="${poly3(c2)}"/>`;
    }
    h += sectionSvg(F, Z.coreBase - 0.8, Z.coreBase + 1.2, () => 0.01, () => 36.9, "cut-pale", 2);
    put(30, "core-boattail", "pale", h, { asm: "es", view: "cut" });
  }
  // thrust structure inside
  let t = "";
  for (const [x, y] of ENG) {
    const top = [x * 1.25, y * 1.25, Z.eng - 2];
    t += tube([[x, y, 62], top], 1.0) + tube([[x, y, 62], [x * 0.2, y * 0.2, Z.eng - 6]], 0.8);
    t += S(G.solidOf([[54, 5.2], [60, 6.4], [66, 6.4], [70, 4.2]], FZ(x, y), P)); // powerhead
    t += S(G.solidOf([[58, 2.6], [66, 2.6]], FZ(x + 6.5, y, 0), P)); // turbopump
    t += S(G.solidOf([[58, 2.2], [65, 2.2]], FZ(x, y + 6.5, 0), P));
    t += tube([[x + 4, y + 4, 58], [x + 8, y + 8, 72]], 0.5) + tube([[x - 4, y + 4, 58], [x - 8, y + 8, 72]], 0.5); // TVC actuators
  }
  put(30, "core-thrust", "steel", t, { asm: "es", view: "cut" });
  // LH2 feedlines from the aft dome to each engine
  let f = "";
  for (const [x, y] of ENG) f += tube(G.fillet([[0, 0, 80], [x * 0.5, y * 0.5, 74], [x, y, 70]], 3, 6), 1.2);
  // back LOX feedline into the engines
  const b = pt(F, Z.eng - 2, CORE_R - 4, backFeed);
  f += tube(G.fillet([b, [b[0] * 0.6, b[1] * 0.6, 80], [ENG[0][0], ENG[0][1], 68]], 4, 6), 1.3);
  put(30, "core-lh2feed", "steel", f, { asm: "es", view: "cut" });
}

// ---- LH2 tank
const LH2_PROF = [...dome(Z.eng, 30, CORE_R, false).reverse(), [Z.lh2Top, CORE_R], ...dome(Z.lh2Top, 30, CORE_R, true).slice(1)];
// clean: strictly ascending s
const asc = (prof) => prof.filter((p, i, a) => i === 0 || p[0] > a[i - 1][0] + 1e-6);
{
  const F = FC;
  let s = S(G.solidOf([[Z.eng, CORE_R], [Z.lh2Top, CORE_R]], F, P), { crease: "none" });
  // barrel welds
  for (const z of [173, 241, 309, 377]) s += L(arcAt(F, z, CORE_R), "faint");
  s += L(arcAt(F, Z.eng + 2, CORE_R), "lo");
  // photogrammetry & foam marks
  s += checker(F, 400, CORE_R + 0.05, FRONT - 0.2, 2.8) + checker(F, 300, CORE_R + 0.05, FRONT + 0.75, 2.8) + checker(F, 210, CORE_R + 0.05, FRONT - 0.55, 2.8);
  s += decal(F, 425, CORE_R + 0.06, FRONT - 0.35, `<rect x="-2" y="-2" width="4" height="4" class="white-sq"/>`);
  s += decal(F, 335, CORE_R + 0.06, FRONT + 0.3, `<circle r="1.6" class="white-sq"/>`);
  put(30, "core-lh2", "orange", s + sheen(F, Z.eng, Z.lh2Top, CORE_R, { strength: 0.09, width: 0.22 }), { asm: "lh2", view: "whole" });
  put(30, "core-marks", "orange", checker(F, 400, CORE_R + 0.05, FRONT - 0.2, 2.8) + checker(F, 300, CORE_R + 0.05, FRONT + 0.75, 2.8) + checker(F, 210, CORE_R + 0.05, FRONT - 0.55, 2.8), { asm: "lh2", view: "whole" });
  // cut
  let c = coreCut(F, asc(LH2_PROF), LAYERS_FOAM);
  put(30, "core-lh2", "orange", c, { asm: "lh2", view: "cut" });
  put(30, "core-lh2liq", "orange", `<g clip-path="url(#lvl-lh2)">${liquidSvg(F, asc(LH2_PROF), 428, "liq-lh2")}</g>`, { asm: "lh2", view: "cut" });
  let bf = "";
  for (const z of [150, 205, 260, 315, 370, 420]) bf += L(arcAt(F, z, CORE_R - 2.6, 0, { inward: true }), "lo", { className: "baffle" });
  put(30, "core-baffles", "orange", bf, { asm: "lh2", view: "cut" });
}
put(30, "core-tunnel", "orange2", tunnel(FRONT + 0.62), { asm: "lh2", view: "whole" });
put(30, "core-press", "orange2", pressLines(frontFeed), { asm: "lh2", view: "whole" });
put(30, "core-feedline", "orange2", feedline(frontFeed), { asm: "lh2", view: "whole" });

// ---- intertank
{
  const F = FC;
  const R = CORE_R + 0.3;
  let s = S(G.solidOf([[Z.lh2Top, R], [Z.itTop, R]], F, P), { crease: "none" });
  s += k.fadedSvg(G.ribsOf(F, Z.lh2Top + 4, Z.itTop - 4, R, 120, P, { fade: [0.04, 0.5] }), { tone: "lo" });
  s += checker(F, 478, R + 0.05, FRONT + 0.05, 3);
  put(30, "core-intertank", "orange", s, { asm: "it", view: "whole" });
  // tan bands top and bottom
  let b = band(F, Z.lh2Top - 0.5, Z.lh2Top + 4, R + 0.35) + band(F, Z.itTop - 4, Z.itTop + 0.5, R + 0.35);
  put(30, "core-intertank", "tan", b, { asm: "it", view: "whole" });
  // intertank umbilical plate (front-right)
  put(30, "core-umb", "steel", S(boxOn(F, FRONT + 1.0, R - 0.2, 1.4, 9, 470, 482)) + D([at(pt(F, 476, R + 1.5, FRONT + 1.0))], { size: 0.5 }), { asm: "it", view: "whole" });
  // cut
  put(30, "core-intertank", "orange", coreCut(F, [[Z.lh2Top, R], [Z.itTop, R]], LAYERS_SKIN), { asm: "it", view: "cut" });
}

// ---- LOX tank
const LOX_PROF = asc([...dome(Z.itTop, 30, CORE_R, false).reverse(), [Z.loxTop, CORE_R], ...dome(Z.loxTop, 30, CORE_R, true).slice(1)]);
{
  const F = FC;
  let s = S(G.solidOf([[Z.itTop, CORE_R], [Z.loxTop, CORE_R]], F, P), { crease: "none" });
  s += L(arcAt(F, 579, CORE_R), "faint") + L(arcAt(F, Z.itTop + 2, CORE_R), "lo") + L(arcAt(F, Z.loxTop - 2, CORE_R), "lo");
  s += checker(F, 600, CORE_R + 0.05, FRONT + 0.1, 2.8) + checker(F, 540, CORE_R + 0.05, FRONT - 0.65, 2.8);
  for (const [z, da] of [[620, -0.25], [560, 0.45], [528, -0.1]]) s += decal(F, z, CORE_R + 0.06, FRONT + da, `<circle r="1.5" class="white-sq"/>`);
  put(30, "core-lox", "orange", s + sheen(F, Z.itTop, Z.loxTop, CORE_R, { strength: 0.09, width: 0.22 }), { asm: "lox", view: "whole" });
  put(30, "core-lox", "orange", coreCut(F, LOX_PROF, LAYERS_FOAM), { asm: "lox", view: "cut" });
  put(30, "core-loxliq", "orange", `<g clip-path="url(#lvl-lox)">${liquidSvg(F, LOX_PROF, 628, "liq-lox")}</g>`, { asm: "lox", view: "cut" });
  put(30, "core-baffles", "orange", [540, 575, 610].map((z) => L(arcAt(F, z, CORE_R - 2.6, 0, { inward: true }), "lo", { className: "baffle" })).join(""), { asm: "lox", view: "cut" });
}
// intertank internals drawn after the LOX tank cut: thrust beam and the back feedline elbow
{
  const F = FC;
  const beam = G.prismOf(G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), [[-CORE_R + 2, -3], [CORE_R - 2, -3], [CORE_R - 2, 3], [-CORE_R + 2, 3]], 466, 474, P);
  put(30, "core-beam", "steel", S(beam), { asm: "it", view: "cut" });
  const a = backFeed;
  const sump = pt(F, 488, 20, a);
  put(30, "core-feedline", "steel", tube(G.fillet([sump, pt(F, 470, 30, a), pt(F, 458, CORE_R - 2, a)], 4, 6), 2.2), { asm: "it", view: "cut" });
}

// ---- forward skirt
{
  const F = FC;
  let s = S(G.solidOf([[Z.loxTop, CORE_R], [Z.coreTop, CORE_R]], F, P), { crease: "none" });
  s += k.fadedSvg(G.ribsOf(F, Z.loxTop + 4, Z.coreTop - 4, CORE_R, 96, P, { fade: [0.05, 0.5] }), { tone: "faint" });
  // camera pods and vents
  for (const da of [-0.5, 0.35]) if (facing(F, FRONT + da) > 0.2) s += S(boxOn(F, FRONT + da, CORE_R - 0.2, 1.4, 3, 668, 672));
  s += checker(F, 682, CORE_R + 0.05, FRONT - 0.2, 2.4);
  put(30, "core-fwdskirt", "orange", s, { asm: "fs", view: "whole" });
  let b = band(F, Z.loxTop - 0.5, Z.loxTop + 4, CORE_R + 0.35) + band(F, Z.coreTop - 4, Z.coreTop, CORE_R + 0.35);
  put(30, "core-fwdskirt", "tan", b, { asm: "fs", view: "whole" });
  put(30, "core-fwdskirt", "orange", coreCut(F, [[Z.loxTop, CORE_R], [Z.coreTop, CORE_R]], LAYERS_SKIN), { asm: "fs", view: "cut" });
  // avionics boxes on the back wall
  let av = "";
  for (const [a, z] of [[1.2, 678], [1.9, 678], [1.55, 686], [0.8, 684], [2.35, 684]]) av += S(boxOn(F, a, CORE_R - 6, 4, 7, z, z + 5), { crease: "faint" });
  put(30, "core-avionics", "steel", av, { asm: "fs", view: "cut" });
}

const LVSA_CUT_SLOT = slot();
// ---- ICPS internals (drawn before the LVSA so the adapter hides them when assembled)
const ICPS_R = 25.5;
{
  const F = FC;
  // RL10B-2 engine: carbon nozzle extension + niobium primary nozzle + powerhead
  const nz = (z) => 2.2 + 8.6 * Math.pow((722 - z) / 32, 0.72);
  const nprof = [];
  for (let i = 0; i <= 16; i++) {
    const z = 690 + (32 * i) / 16;
    nprof.push([z, nz(z), 1]);
  }
  nprof[0] = [690, nz(690)];
  let e = S(G.solidOf(nprof, F, P, { smooth: true }), { crease: "none" });
  e += L(arcAt(F, 706, nz(706), (nz(706.5) - nz(705.5)) * -1 * -1), "lo");
  e += S(G.solidOf([[722, 3.2], [728, 4.4], [734, 4.4], [736, 3]], F, P));
  e += S(G.solidOf([[724, 1.6], [732, 1.6]], FZ(5.5, 0), P));
  put(30, "icps-rl10", "carbon", e, { asm: "icps", view: "both" });
  // truss from the LH2 aft skirt ring to the LOX tank
  let t = "";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    t += tube([pt(F, 746, ICPS_R - 1, a), pt(F, 728, 15, a + 0.35)], 0.55);
  }
  put(30, "icps-truss", "carbon", t, { asm: "icps", view: "both" });
  // LOX tank (insulated, silver)
  const lprof = [];
  for (let i = 0; i <= 20; i++) {
    const t2 = -Math.PI / 2 + (Math.PI * i) / 20;
    lprof.push([730 + 12 * Math.sin(t2), 16.5 * Math.cos(t2), 1]);
  }
  lprof[0] = [718, 0];
  lprof[20] = [742, 0];
  put(30, "icps-lox", "silver", S(G.solidOf(lprof, F, P, { smooth: true })) + L(arcAt(F, 730, 16.5), "faint"), { asm: "icps", view: "both" });
  // bottles
  let b = "";
  for (const a of [0.9, 2.3, 4.0, 5.4]) {
    const c = pt(F, 738, 21, a);
    b += S(G.solidOf([[0, 2.2, 1], [1, 2.4, 1], [6, 2.4, 1], [7, 2.2, 1]], G.frameAlong(c, [0, 0, 1]), P, { smooth: true }));
  }
  put(30, "icps-bottles", "red", b, { asm: "icps", view: "both" });
  // LH2 tank lower part inside the adapter (aft skirt + dome)
  put(30, "icps-lh2", "white", S(G.solidOf([[744, ICPS_R], [Z.lvsaTop, ICPS_R]], F, P), { crease: "none" }) + L(arcAt(F, 750, ICPS_R), "lo"), { asm: "icps" });
}
// ---- LVSA
{
  const F = FC;
  let s = S(G.solidOf([[Z.coreTop, CORE_R], [Z.lvsaCyl, CORE_R], [Z.lvsaTop, ICPS_R + 0.4]], F, P), { crease: "faint" });
  const slope = (ICPS_R + 0.4 - CORE_R) / (Z.lvsaTop - Z.lvsaCyl);
  s += k.fadedSvg(G.ribsOf(F, Z.lvsaCyl, Z.lvsaTop - 4, CORE_R, 64, P, { r1: CORE_R + slope * (Z.lvsaTop - 4 - Z.lvsaCyl), fade: [0.05, 0.5] }), { tone: "faint" });
  for (const z of [736, 756]) s += L(arcAt(F, z, CORE_R + slope * (z - Z.lvsaCyl), slope), "lo");
  s += decal(F, 745, CORE_R + slope * (745 - Z.lvsaCyl) + 0.06, FRONT + 0.15, `<circle r="1.6" class="white-sq"/>`, slope);
  s += decal(F, 758, CORE_R + slope * (758 - Z.lvsaCyl) + 0.06, FRONT - 0.3, `<circle r="1.4" class="white-sq"/>`, slope);
  put(30, "lvsa", "orange", s, { asm: "lvsa", view: "whole" });
  let b = band(F, Z.coreTop, Z.coreTop + 4, CORE_R + 0.35) + band(F, Z.lvsaCyl - 3, Z.lvsaCyl, CORE_R + 0.35);
  put(30, "lvsa", "tan", b, { asm: "lvsa", view: "whole" });
  put(30, "lvsa-joint", "tan", S(G.solidOf([[Z.lvsaTop - 4, ICPS_R + 1.3], [Z.lvsaTop, ICPS_R + 0.5]], F, P), { crease: "none" }), { asm: "lvsa" });
  put(30, "lvsa", "orange", coreCut(F, [[Z.coreTop, CORE_R], [Z.lvsaCyl, CORE_R], [Z.lvsaTop - 4, ICPS_R + 1.3]], LAYERS_SKIN), { asm: "lvsa", view: "cut", key: 30e6 + LVSA_CUT_SLOT });
}
const RL10_SLOT = slot();
// ---- ICPS exposed LH2 tank band
{
  const F = FC;
  let s = S(G.solidOf([[Z.lvsaTop, ICPS_R], [Z.icpsTop, ICPS_R]], F, P), { crease: "none" });
  s += L(arcAt(F, Z.lvsaTop + 3, ICPS_R), "faint") + L(arcAt(F, Z.icpsTop - 2, ICPS_R), "lo");
  s += D(G.dotsOf(F, Z.icpsTop - 3.5, ICPS_R, 48, P, { fade: [0.04, 0.42] }), { size: 0.3, tone: "lo" });
  s += checker(F, 786, ICPS_R + 0.05, FRONT + 0.25, 2.6);
  put(30, "icps-lh2", "white", s, { asm: "icps" });
}
// ---- Orion stage adapter
{
  const F = FC;
  let s = S(G.solidOf([[Z.icpsTop, ICPS_R + 0.3], [Z.osaTop, ICPS_R + 0.3]], F, P), { crease: "none" });
  s += L(arcAt(F, Z.icpsTop + 1.5, ICPS_R + 0.3), "lo") + L(arcAt(F, Z.osaTop - 1.5, ICPS_R + 0.3), "lo");
  s += D(G.dotsOf(F, Z.icpsTop + 3, ICPS_R + 0.3, 56, P, { fade: [0.04, 0.42] }), { size: 0.28, tone: "lo" });
  s += checker(F, 802, ICPS_R + 0.35, FRONT - 0.15, 2.4, 2);
  put(30, "osa", "white", s, { asm: "osa" });
}
// ---- Spacecraft adapter cone, service module, arrays, crew module adapter (zone 30, after OSA)
const ESM_R = 20;
const SAJ_R = 26.4;
{
  const F = FC;
  put(30, "sa", "silver", S(G.solidOf([[Z.osaTop, ICPS_R], [816, ESM_R + 1]], F, P), { crease: "faint" }) + L(arcAt(F, 811, ICPS_R - 2, -0.6), "faint"), { asm: "sa" });
  // OMS-E nozzle under the ESM (inside the adapter cone)
  put(30, "esm-engine", "carbon", S(G.solidOf([[806, 5.2], [810, 4.4, 1], [814, 3.2, 1], [816, 2.8]], F, P, { smooth: true })), { asm: "esm" });
}
// SAJ panels: back ones before the ESM, the front one after
function sajPanel(i) {
  const a = SAJ_ANGLES[i];
  const F = FC;
  const prof = [[Z.osaTop, ICPS_R + 0.4], [814, SAJ_R], [Z.sajTop, SAJ_R]];
  let s = patchSvg(F, prof, a - TAU / 6 + 0.006, a + TAU / 6 - 0.006, { steps: 96 });
  // separation rails at the panel edges
  for (const e of [a - TAU / 6 + 0.006, a + TAU / 6 - 0.006]) if (facing(F, e) > 0) s += L(poly3([pt(F, 814, SAJ_R + 0.05, e), pt(F, Z.sajTop, SAJ_R + 0.05, e)], false), "lo");
  // ring frames
  s += L(arcAt(F, 830, SAJ_R, 0, { from: a - TAU / 6, to: a + TAU / 6 }), "faint");
  s += L(arcAt(F, Z.sajTop - 2, SAJ_R, 0, { from: a - TAU / 6, to: a + TAU / 6 }), "lo");
  if (i === 0) {
    s += decal(F, 838, SAJ_R + 0.06, FRONT - 0.02, meatball(6.2));
    s += decal(F, 826.5, SAJ_R + 0.06, FRONT + 0.03, esaLogo(3.4));
    s += checker(F, 818, SAJ_R + 0.06, FRONT + 0.45, 2.3);
    s += checker(F, 818, SAJ_R + 0.06, FRONT - 0.5, 2.3);
    for (const [z, da] of [[848, -0.42], [848, 0.48], [823, -0.25]]) s += decal(F, z, SAJ_R + 0.06, FRONT + da, `<circle r="0.7" class="port-dot"/>`);
  }
  return s;
}
function esmBody() {
  const F = FC;
  let s = S(G.solidOf([[816, ESM_R], [852, ESM_R]], F, P), { crease: "none" });
  // radiator panels & blanket seams
  s += k.fadedSvg(G.ribsOf(F, 818, 850, ESM_R, 24, P, { fade: [0.06, 0.5] }), { tone: "faint" });
  s += L(arcAt(F, 834, ESM_R), "lo") + L(arcAt(F, 818, ESM_R), "lo") + L(arcAt(F, 850, ESM_R), "lo");
  // RCS pods (4 pairs) near the top
  for (const a of [0.0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) {
    if (facing(F, a) < 0.1) continue;
    s += S(boxOn(F, a, ESM_R - 0.3, 2.2, 4, 843, 849));
    s += D([at(pt(F, 846, ESM_R + 2.3, a - 0.06)), at(pt(F, 846, ESM_R + 2.3, a + 0.06))], { size: 0.45, tone: "hi" });
  }
  return s;
}
function esmAux() {
  const F = FC;
  let s = "";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    if (facing(F, a) < 0.05) continue;
    const c = pt(F, 816, ESM_R - 2.5, a);
    s += S(G.solidOf([[0, 0.7], [2.4, 1.3]], G.frameAlong(c, [0, 0, -1]), P));
  }
  return s;
}
// solar array wing geometry: t in [0,1]; 0 stowed down the ESM side, 1 deployed flat
const WING_ANGLES = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
const PANEL = 20;
function wingSvg(a, t) {
  const F = FC;
  const rad = G.radialOf(F, a);
  const tan = G.unit3(G.add3(G.mul3(F.u, -Math.sin(a)), G.mul3(F.v, Math.cos(a))));
  const hinge = G.add3(pt(F, 849, ESM_R + 0.4, a), [0, 0, 0]);
  const swing = smooth01(Math.min(1, t * 2)); // 0: hanging down, 1: horizontal
  const spread = smooth01(Math.max(0, t * 2 - 1)); // accordion unfold
  const ang = (swing * Math.PI) / 2; // from pointing down (-z) to radial
  const dir = G.unit3(G.add3(G.mul3([0, 0, -1], Math.cos(ang)), G.mul3(rad, Math.sin(ang))));
  const normal = G.unit3(G.cross3(dir, tan)); // panel face normal
  const n = G.dot3(normal, V) >= 0 ? normal : G.mul3(normal, -1);
  let s = "";
  // yoke arm
  const yokeLen = 2 + 7 * swing;
  const root = G.add3(hinge, G.mul3(rad, 1.6 + 0.9 * (1 - swing)));
  const yokeEnd = G.add3(root, G.mul3(dir, yokeLen));
  s += tube([root, yokeEnd], 0.45);
  const panels = [];
  for (let p = 0; p < 3; p++) {
    const along = yokeLen + 0.4 + p * PANEL * spread + p * 0.5 * spread;
    const stack = (1 - spread) * p * 0.7;
    const o = G.add3(G.add3(root, G.mul3(dir, along)), G.mul3(rad, stack * (1 - swing) + 0)).map((v, idx) => v + (idx === 2 ? stack * swing : 0));
    panels.push({ o, d: depth(G.add3(o, G.mul3(dir, PANEL / 2))) });
  }
  panels.sort((A, B) => A.d - B.d);
  for (const { o } of panels) {
    const Fp = G.frameOf(o, n, dir, tan);
    const prism = G.prismOf(Fp, [[0, -PANEL / 2], [PANEL, -PANEL / 2], [PANEL, PANEL / 2], [0, PANEL / 2]], -0.35, 0.35, P);
    s += S(prism, { crease: "none" });
    // cell grid on the visible face
    const f = (x, y) => G.add3(G.add3(G.add3(o, G.mul3(n, 0.36)), G.mul3(dir, x)), G.mul3(tan, y));
    let g = "";
    for (let x = 2.5; x < PANEL; x += 2.5) g += poly3([f(x, -PANEL / 2 + 0.6), f(x, PANEL / 2 - 0.6)], false);
    for (let y = -PANEL / 2 + 2.5; y < PANEL / 2; y += 2.5) g += poly3([f(0.6, y), f(PANEL - 0.6, y)], false);
    s += `<path class="cells" d="${g}"/>`;
    s += L(poly3([f(0.6, -PANEL / 2 + 0.6), f(PANEL - 0.6, -PANEL / 2 + 0.6), f(PANEL - 0.6, PANEL / 2 - 0.6), f(0.6, PANEL / 2 - 0.6)]), "lo", { className: "cellframe" });
  }
  return s;
}
const WING_FRAMES = 9;
function wings(front) {
  let s = "";
  for (let f = 0; f < WING_FRAMES; f++) {
    const t = f / (WING_FRAMES - 1);
    let g = "";
    const list = WING_ANGLES.filter((a) => (facing(FC, a) > 0) === front).sort((A, B) => depth(G.radialOf(FC, A)) - depth(G.radialOf(FC, B)));
    for (const a of list) g += wingSvg(a, t);
    s += `<g data-frame="${f}"${f ? ' style="display:none"' : ""}>${g}</g>`;
  }
  return s;
}
put(30, "esm-arrays", "solar", wings(false), { asm: "esm", attrs: ' data-wings=""' });
put(30, "saj", "white", sajPanel(1), { asm: "saj1" });
put(30, "saj", "white", sajPanel(2), { asm: "saj2" });
put(30, "esm", "white", esmBody(), { asm: "esm" });
put(30, "esm-aux", "carbon", esmAux(), { asm: "esm" });
// ESM tanks (cut view: visible through the open fairing window)
put(30, "esm-tanks", "white", "", { asm: "esm", view: "cut" });
put(30, "esm-arrays", "solar", wings(true), { asm: "esm", attrs: ' data-wings=""' });
put(30, "esm-rcs", "white", "", { asm: "esm" });
// crew module adapter
put(30, "cma", "silver", S(G.solidOf([[852, ESM_R], [855, ESM_R + 1], [859.5, 24.8]], FC, P), { crease: "faint" }) + L(arcAt(FC, 857, 22.9, 1.0), "faint"), { asm: "esm" });
put(30, "saj", "white", sajPanel(0), { asm: "saj0", view: "whole" });

const OGIVE_CUT_SLOT = slot();
// ---- Crew module
const CM_R = (z) => 24.6 - ((z - 865) * 15.2) / 28;
{
  const F = FC;
  // heat shield
  put(30, "cm-shield", "avcoat", S(G.solidOf([[Z.cmBase - 1.4, 0], [Z.cmBase - 1.1, 12, 1], [Z.cmBase - 0.4, 22, 1], [Z.cmBase + 1.6, 25.1, 1], [Z.cmBase + 3.4, 25.0]], F, P, { smooth: true })) + L(arcAt(F, Z.cmBase + 3.4, 25.0), "lo"), { asm: "cm" });
  // backshell
  const slope = -15.2 / 28;
  let s = S(G.solidOf([[863.4, 24.9], [865, 24.6], [893, CM_R(893)]], F, P), { crease: "lo" });
  // tile rows and the copper/blue bands seen on the Artemis II module
  s += `<path class="cm-copper" d="${coneBand(F, 864.2, 865.8, slope, CM_R)}"/>`;
  s += `<path class="cm-blue" d="${coneBand(F, 876.6, 877.3, slope, CM_R)}"/>`;
  for (const z of [870, 882, 888]) s += L(arcAt(F, z, CM_R(z), slope), "faint");
  s += k.fadedSvg(G.ribsOf(F, 866, 892, CM_R(866), 40, P, { r1: CM_R(892), fade: [0.05, 0.5] }), { tone: "faint" });
  put(30, "cm-backshell", "silver", s, { asm: "cm", view: "whole" });
  // windows (4 around, the two facing us are drawn)
  let w = "";
  for (const a of [FRONT - 0.55, FRONT + 0.55, FRONT + Math.PI - 0.55, FRONT + Math.PI + 0.55]) {
    const z = 880;
    if (facing(F, a, slope) < 0.15) continue;
    w += `<path class="window" d="${surfQuad(F, z - 2.6, z + 2.6, CM_R(z - 2.6) + 0.1, CM_R(z + 2.6) + 0.1, a - 0.16, a + 0.16, 3)}"/>`;
  }
  put(30, "cm-windows", "silver", w, { asm: "cm", view: "whole" });
  // side hatch
  if (facing(F, FRONT, slope) > 0)
    put(30, "cm-hatch", "silver", L(surfQuad(F, 869, 887, CM_R(869) + 0.1, CM_R(887) + 0.1, FRONT - 0.32, FRONT + 0.32, 4), "mid") + `<path class="window" d="${surfQuad(F, 882, 885, CM_R(882) + 0.12, CM_R(885) + 0.12, FRONT - 0.09, FRONT + 0.09, 2)}"/>` + D([at(pt(F, 878, CM_R(878) + 0.2, FRONT + 0.26))], { size: 0.45, tone: "hi" }), { asm: "cm", view: "whole" });
  // RCS ports
  let r = "";
  for (const a of [FRONT - 1.05, FRONT + 1.05, FRONT + 0.25]) {
    if (facing(F, a, slope) < 0.15) continue;
    for (const dz of [0, 3]) r += `<ellipse class="port" cx="${r1(at(pt(F, 889 - dz, CM_R(889 - dz) + 0.1, a))[0])}" cy="${r1(at(pt(F, 889 - dz, CM_R(889 - dz) + 0.1, a))[1])}" rx="0.9" ry="0.6"/>`;
  }
  put(30, "cm-rcs", "silver", r, { asm: "cm", view: "whole" });
  // docking tunnel and forward bay cover
  put(30, "cm-docking", "silver", S(G.solidOf([[893, CM_R(893)], [894.5, 8.6], [896.5, 7.4], [Z.cmTop, 6.8]], F, P)) + L(arcAt(F, 896.5, 7.4), "lo") + D(G.dotsOf(F, Z.cmTop, 5.6, 12, P, { all: true }), { size: 0.3 }), { asm: "cm" });
}
// cut crew module interior (drawn as part of the CM, visible when the ogive is cut away)
{
  const F = FC;
  const prof = [[863.6, 23.8], [866, 23.4], [892, CM_R(892) - 1.4]];
  let s = patchSvg(F, prof, 0, Math.PI, { steps: 72, layers: [{ t: 1.0, cls: "cut-silver" }, { t: 0.6, cls: "cut-metal" }] });
  // floor & seats
  const seat = (x, y, z) => {
    const Fs = G.frameOf([x, y, z], [0, 0, 1], RIGHT, BACK);
    return S(G.prismOf(Fs, [[-3.2, -4], [3.2, -4], [3.2, 4], [-3.2, 4]], 0, 1.4, P), { crease: "faint" }) + S(G.prismOf(Fs, [[-3.2, 2.6], [3.2, 2.6], [3.2, 4], [-3.2, 4]], 1.4, 7, P), { crease: "faint" });
  };
  let seats = seat(-7.5, -4, 868) + seat(7.5, -4, 868) + seat(-7.5, -2, 875) + seat(7.5, -2, 875);
  // display panels on the back wall
  seats += S(boxOn(F, Math.PI / 2, 17, 1.2, 14, 881, 886), { crease: "faint" });
  const chutes = [-5, 0, 5].map((x) => S(G.sphereOf([x, -1, 890], 2.4, P))).join("");
  put(30, "cm-cabin", "silver", s, { asm: "cm", view: "cut" });
  put(30, "cm-seats", "steel", seats, { asm: "cm", view: "cut" });
  put(30, "cm-chutes", "chute", chutes, { asm: "cm", view: "cut" });
  // heat shield section
  put(30, "cm-shield", "avcoat", sectionSvg(F, Z.cmBase - 1.3, Z.cmBase + 1.2, () => 0.01, (z) => 25, "cut-avcoat", 4), { asm: "cm", view: "cut" });
  // coming home (return scene only): plasma, parachutes, and a patch of the Pacific
  const [back, shock] = plasmaSvg([0, 0, Z.cmBase - 1.5], 25.1, { wake: 7 });
  put(29, "fx", "none", back, { asm: "glow" });
  put(38, "fx", "none", shock, { asm: "glow" });
  put(36, "fx", "none", chutesSvg(1, [0, 0, Z.cmTop + 1], { n: 2, spread: 6, height: 62, R: 8, bands: false }), { asm: "cm" });
  put(37, "fx", "none", chutesSvg(2, [0, 0, Z.cmTop + 1], { n: 3, spread: 36, height: 130, R: 38 }), { asm: "cm" });
  put(3, "fx", "none", `<g class="m-sea">${seaSvg(Z.cmBase + 4, 900)}</g>` + ripplesSvg(Z.cmBase + 4, 32), { asm: "sea", attrs: ' data-retonly=""' });
}
function coneBand(F, z0, z1, slope, R) {
  const a = [];
  const b = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * TAU;
    if (facing(F, t, slope) < -0.01) continue;
    a.push(pt(F, z0, R(z0) + 0.06, t));
    b.push(pt(F, z1, R(z1) + 0.06, t));
  }
  const order = (list) => list.map((p) => [p, at(p)[0]]).sort((x, y) => x[1] - y[1]).map(([p]) => p);
  return poly3([...order(a), ...order(b).reverse()]);
}

// ---- Launch abort system: ogive fairing + tower
const OGIVE_R = (z) => {
  if (z <= 864) return 27;
  const x = (z - 864) / (Z.ogiveTop - 864);
  return 7.3 + (27 - 7.3) * Math.pow(1 - x, 1.25) * (1 + 0.32 * x * (1 - x) * 2);
};
{
  const F = FC;
  const prof = [[Z.ogiveBase, 27], [864, 27]];
  for (let i = 1; i <= 24; i++) {
    const z = 864 + ((Z.ogiveTop - 864) * i) / 24;
    prof.push([z, OGIVE_R(z), 1]);
  }
  let s = S(G.solidOf(prof, F, P, { smooth: true }), { crease: "lo" });
  const sl = (z) => (OGIVE_R(z + 0.5) - OGIVE_R(z - 0.5)) / 1;
  for (const z of [861, 870]) s += L(arcAt(F, z, OGIVE_R(z), sl(z)), z === 861 ? "lo" : "faint");
  // panel seams (4 ogive panels)
  for (const a of [FRONT + 0.78, FRONT - 0.78]) {
    const pts = [];
    for (let z = 866; z <= Z.ogiveTop; z += 2) pts.push(pt(F, z, OGIVE_R(z) + 0.05, a));
    s += L(poly3(pts, false), "faint");
  }
  s += decal(F, 878, OGIVE_R(878) + 0.06, FRONT + 0.05, usFlag(8.5), sl(878));
  s += decal(F, 884.5, OGIVE_R(884.5) + 0.06, FRONT + 0.05, `<text class="us-text" font-size="1.7" text-anchor="middle">United States</text>`, sl(884.5));
  s += decal(F, 867.6, OGIVE_R(867.6) + 0.06, FRONT - 0.04, worm(4.2), sl(867.6));
  s += checker(F, 900, OGIVE_R(900) + 0.06, FRONT + 0.55, 1.8);
  put(30, "las-ogive", "white", s, { asm: "las", view: "whole" });
  const cprof = [[Z.ogiveBase, 27], [864, 27]];
  for (let i = 1; i <= 16; i++) {
    const z = 864 + ((Z.ogiveTop - 864) * i) / 16;
    cprof.push([z, OGIVE_R(z)]);
  }
  put(30, "las-ogive", "white", patchSvg(F, cprof, 0, Math.PI, { steps: 72, layers: [{ t: 0.6, cls: "cut-white" }, { t: 0.4, cls: "cut-metal" }] }), { asm: "las", view: "cut", key: 30e6 + OGIVE_CUT_SLOT });
}
// tower: adapter, abort nozzles (back pair, case, front pair), upper motors
{
  const F = FC;
  const NOZ = [FRONT + Math.PI / 4, FRONT - Math.PI / 4, FRONT + (3 * Math.PI) / 4, FRONT - (3 * Math.PI) / 4];
  const nozzle = (a) => {
    const rad = G.radialOf(F, a);
    const dir = G.unit3(G.add3(G.mul3(rad, 0.62), [0, 0, -0.78]));
    const root = G.add3(pt(F, 934, 4.4, a), [0, 0, 0]);
    const Fn = G.frameAlong(root, dir);
    return S(G.solidOf([[0, 2.2], [1.2, 2.2], [2.5, 2.4, 1], [5.5, 3.3, 1], [7.2, 3.8]], Fn, P, { smooth: true })) + L(G.arcOf(Fn, 7.2, 3.8, P, { slope: 0.3, inward: true, least: -1 }), "lo") + innerVoid(Fn, 7.2, 3.6);
  };
  const back = NOZ.filter((a) => facing(F, a) < 0);
  const front = NOZ.filter((a) => facing(F, a) >= 0);
  put(30, "las-abort", "white", back.map(nozzle).join(""), { asm: "las" });
  let s = S(G.solidOf([[Z.ogiveTop - 0.5, 7.6], [Z.towerBase, 6.4], [Z.nozzleTop, 5.6], [Z.jettison, 4.8]], F, P), { crease: "faint" });
  s += L(arcAt(F, 924, 7.0, -0.15), "faint") + L(arcAt(F, 944, 5.4, -0.03), "faint") + L(arcAt(F, 956, 5.1, -0.03), "faint");
  s += D(G.dotsOf(F, 926, 6.9, 20, P, { fade: [0.04, 0.42] }), { size: 0.25, tone: "lo" });
  put(30, "las-abort", "white", s, { asm: "las" });
  put(30, "las-abort", "white", front.map(nozzle).join(""), { asm: "las" });
  // jettison motor with three canted nozzles (one faces us)
  let j = S(G.solidOf([[Z.jettison, 4.8], [Z.acm, 4.6]], F, P), { crease: "none" });
  j += L(arcAt(F, Z.jettison + 1, 4.8), "lo");
  for (const a of [FRONT + 0.35, FRONT + 0.35 + TAU / 3, FRONT + 0.35 - TAU / 3]) {
    if (facing(F, a) < 0.2) continue;
    j += `<path class="port" d="${surfQuad(F, 971, 977, 4.85, 4.85, a - 0.42, a + 0.42, 6)}"/>`;
  }
  put(30, "las-jettison", "white", j, { asm: "las" });
  // attitude control motor ring with 8 ports
  let c = S(G.solidOf([[Z.acm, 4.6], [Z.nose, 4.6]], F, P), { crease: "none" });
  c += L(arcAt(F, Z.acm + 0.6, 4.6), "lo") + L(arcAt(F, Z.nose - 0.6, 4.6), "lo");
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    if (facing(F, a) < 0.25) continue;
    c += `<path class="port" d="${surfQuad(F, 990.5, 993.5, 4.65, 4.65, a - 0.2, a + 0.2, 3)}"/>`;
  }
  put(30, "las-acm", "white", c, { asm: "las" });
  // nose
  const nprof = [[Z.nose, 4.6]];
  for (let i = 1; i <= 12; i++) {
    const z = Z.nose + ((Z.tip - Z.nose) * i) / 12;
    const x = i / 12;
    nprof.push([z, 4.6 * Math.sqrt(Math.max(0, 1 - x * x)) * (1 - 0.15 * x) + (i === 12 ? 0 : 0), 1]);
  }
  nprof[nprof.length - 1] = [Z.tip, 0];
  put(30, "las-nose", "white", S(G.solidOf(nprof, F, P, { smooth: true })) + L(arcAt(F, Z.nose + 3, 4.45, -0.15), "faint"), { asm: "las" });
}
function innerVoid(Fn, s, r) {
  // dark throat seen inside an open nozzle end when it faces the viewer
  const pts = [];
  for (let i = 0; i < 32; i++) pts.push(G.pointOf(Fn, s, r, (i / 32) * TAU));
  return G.dot3(Fn.a, V) > 0.05 ? `<path class="port" d="${poly3(pts)}"/>` : "";
}

// ---- Mobile Launcher tower (behind the rocket) with its access arms
const TOWER = { x0: -58, x1: 58, y0: -238, y1: -118, top: 1080 };
function member(a, b, w = 2.2, cls = "tw") {
  const d = poly3([a, b], false);
  return `<path class="${cls}-o" d="${d}" stroke-width="${w + 1}"/><path class="${cls}-i" d="${d}" stroke-width="${w}"/>`;
}
function towerSvg() {
  const { x0, x1, y0, y1, top } = TOWER;
  const levels = [];
  for (let z = 0; z <= top; z += 54) levels.push(z);
  if (levels[levels.length - 1] !== top) levels.push(top);
  const C = { a: [x0, y0], b: [x1, y0], c: [x1, y1], d: [x0, y1] }; // a back-left, b back-right(+x), c front-right, d front-left(+y face)
  const face = (p, q, back) => {
    let s = "";
    for (let i = 0; i < levels.length - 1; i++) {
      const z0 = levels[i], z1 = levels[i + 1];
      s += member([...p, z1], [...q, z1], back ? 1.6 : 2.2, back ? "twb" : "tw");
      s += member([...p, z0], [...q, z1], back ? 1.1 : 1.5, back ? "twb" : "tw");
      s += member([...q, z0], [...p, z1], back ? 1.1 : 1.5, back ? "twb" : "tw");
    }
    return s;
  };
  let s = `<path class="iso-halo" d="${k.haloOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 2 }, 0, 4, P)}"/>`;
  // back faces (y0 face and x0 face), back columns
  s += face(C.a, C.b, true) + face(C.a, C.d, true);
  s += S(k.slabOf({ x: x0 - 4, y: y0 - 4, w: 8, d: 8, r: 0.5 }, 0, top, P, 2), { crease: "none" });
  // floor decks every 4 levels (seen from above)
  for (let i = 4; i < levels.length; i += 4) s += S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 0.5 }, levels[i] - 1.5, 1.5, P, 2), { crease: "none" });
  // elevator / stair core and piping on the inside
  s += S(k.slabOf({ x: x0 + 14, y: y0 + 16, w: 26, d: 24, r: 1 }, 0, top - 30, P, 2, 0.3), { crease: "faint" });
  for (let z = 30; z < top - 40; z += 54) s += L(k.sideSeam({ x: x0 + 14, y: y0 + 16, w: 26, d: 24, r: 1 }, z, P, 2), "faint");
  s += S(k.slabOf({ x: x1 - 8, y: y0 - 4, w: 8, d: 8, r: 0.5 }, 0, top, P, 2), { crease: "none" });
  s += S(k.slabOf({ x: x0 - 4, y: y1 - 4, w: 8, d: 8, r: 0.5 }, 0, top, P, 2), { crease: "none" });
  // front faces (x1 face and y1 face)
  s += face(C.b, C.c, false) + face(C.d, C.c, false);
  s += S(k.slabOf({ x: x1 - 8, y: y1 - 4, w: 8, d: 8, r: 0.5 }, 0, top, P, 2), { crease: "none" });
  // roof, jib crane
  s += S(k.slabOf({ x: x0 - 5, y: y0 - 5, w: x1 - x0 + 10, d: y1 - y0 + 10, r: 1 }, top, 5, P, 2, 0.5));
  s += S(k.slabOf({ x: -14, y: -190, w: 28, d: 30, r: 1 }, top + 5, 16, P, 2, 0.4));
  s += L(k.sideSeam({ x: -14, y: -190, w: 28, d: 30, r: 1 }, top + 13, P, 2), "faint");
  s += member([0, -175, top + 21], [0, -128, top + 30], 2.4) + member([0, -128, top + 30], [0, -128, top + 6], 0.8);
  return s;
}
function mastSvg() {
  const F = FZ(18, -228, 0);
  let s = S(G.solidOf([[TOWER.top + 5, 3.2], [TOWER.top + 12, 2.6], [TOWER.top + 70, 1.2], [TOWER.top + 92, 0.4]], F, P));
  for (const z of [TOWER.top + 30, TOWER.top + 52]) s += L(arcAt(F, z, 3.2 - ((z - TOWER.top - 12) / 58) * 1.4 + 0.1), "lo");
  return s;
}
// access arms reach from the tower's front face to the rocket's back side
const ARMS = [
  ["ml-caa", 875, 10, 9, CM_R(875) + 0.5, "Crew access arm"],
  ["ml-umbs", 838, 6, 5, SAJ_R + 0.5, ""],
  ["ml-umbs", 790, 6, 5, ICPS_R + 0.5, ""],
  ["ml-umbs", 672, 7, 6, CORE_R + 0.5, ""],
  ["ml-umbs", 488, 7, 6, CORE_R + 0.8, ""],
];
function armSvg([, z, w, h, reach]) {
  const y0 = TOWER.y1, y1 = -reach;
  const plan = { x: -w / 2, y: y0, w, d: y1 - y0, r: 0.4 };
  let s = S(k.slabOf(plan, z, h, P, 2, 0.3), { crease: "faint" });
  // truss texture on the visible +x side
  for (let y = y0 + 6; y < y1 - 4; y += 7) s += member([w / 2, y, z + 0.6], [w / 2, y + 7, z + h - 0.6], 0.5, "twl");
  s += L(poly3([[w / 2, y0, z + h / 2], [w / 2, y1, z + h / 2]], false), "faint");
  // interface plate at the rocket end
  s += S(k.slabOf({ x: -w / 2 - 1, y: y1 - 2.5, w: w + 2, d: 2.5, r: 0.4 }, z - 1, h + 2, P, 2), { crease: "none" });
  return s;
}
put(0, "ml-tower", "steel", towerSvg(), { asm: "deck" });
put(0, "ml-mast", "white", mastSvg(), { asm: "deck" });
for (const arm of ARMS) put(0, arm[0], arm[0] === "ml-caa" ? "white" : "steel", armSvg(arm), { asm: "deck", attrs: ' data-arm=""' });

// near booster: struts and posts first, then the booster
put(45, "ml-vsp", "steel", vsps(1, false), { asm: "deck" });
put(45, "ml-vsp", "steel", vsps(1, true), { asm: "deck" });
srb(1);

// =====================================================================================
// FLIGHT EFFECTS: exhaust plumes, propellant flow, pad steam
// =====================================================================================
function rs25Plume(x, y) {
  const [ex, ey] = at([x, y, 9]);
  const r = 11.8;
  let s = `<path class="pl" fill="url(#g-rs-o)" d="${flamePath(ex, ey, 215, (u) => r * (1 + 0.45 * Math.sin((Math.min(u * 3, 1) * Math.PI) / 2)) * (1 - u ** 2.5))}"/>`;
  s += `<path class="pl pl-flick" fill="url(#g-rs-c)" d="${flamePath(ex, ey, 150, (u) => r * 0.62 * (1 - u ** 1.6))}"/>`;
  for (let i = 0; i < 5; i++) {
    const cy = ey + 26 + i * 27;
    const w = 5.6 * (1 - i * 0.14);
    s += `<path class="pl diamond" opacity="${(0.95 - i * 0.16).toFixed(2)}" d="M${r1(ex)} ${r1(cy - 8)}L${r1(ex + w)} ${r1(cy)}L${r1(ex)} ${r1(cy + 8)}L${r1(ex - w)} ${r1(cy)}Z"/>`;
  }
  return plumeGroup("rs25", ex, ey, s);
}
function srbPlume(side) {
  const [ex, ey] = at([side * SRB_X, 0, 0.5]);
  const r = 19.3;
  const smoke = `<path class="smoke" fill="url(#g-smoke)" d="${flamePath(ex, ey + 150, 2600, (u) => r * (2.2 + 7 * Math.sqrt(u)))}"/>`;
  let s = `<path class="pl pl-flick" fill="url(#g-srb-o)" d="${flamePath(ex, ey, 600, (u) => r * (1.0 + 1.25 * Math.sqrt(u)) * (1 - u ** 4))}"/>`;
  s += `<path class="pl pl-flick2" fill="url(#g-srb-c)" d="${flamePath(ex, ey, 330, (u) => r * 0.86 * (1 + 0.55 * u) * (1 - u ** 2))}"/>`;
  return plumeGroup("srb", ex, ey, `<g class="smokeg">${smoke}</g><g class="flame">${s}</g>`);
}
function rl10Plume() {
  const [ex, ey] = at([0, 0, 690]);
  const r = 10.8;
  return plumeGroup("rl10", ex, ey, `<path class="pl pl-flick" fill="url(#g-rl10)" d="${flamePath(ex, ey, 200, (u) => r * (1 + 2.4 * u) * (1 - u ** 2))}"/><path class="pl" fill="url(#g-rs-c)" d="${flamePath(ex, ey, 70, (u) => r * 0.5 * (1 - u))}"/>`);
}
function lasPlume() {
  let s = "";
  const list = [FRONT + 0.35, FRONT + 0.35 + TAU / 3, FRONT + 0.35 - TAU / 3].sort((a, b) => depth(G.radialOf(FC, a)) - depth(G.radialOf(FC, b)));
  for (const a of list) {
    const p = pt(FC, 974, 4.9, a);
    const q = G.add3(p, G.add3(G.mul3(G.radialOf(FC, a), 26), [0, 0, -46]));
    const P0 = at(p);
    const P1 = at(q);
    const dx = P1[0] - P0[0];
    const dy = P1[1] - P0[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const pts = [[P0[0] + nx * 1.5, P0[1] + ny * 1.5], [P1[0] + nx * 9, P1[1] + ny * 9], [P1[0] + dx * 0.25, P1[1] + dy * 0.25], [P1[0] - nx * 9, P1[1] - ny * 9], [P0[0] - nx * 1.5, P0[1] - ny * 1.5]];
    s += `<path class="pl pl-flick" fill="url(#g-las)" d="${poly(pts)}"/>`;
  }
  const [ex, ey] = at([0, 0, 974]);
  return plumeGroup("las", ex, ey, s);
}
function steamSvg() {
  let s = "";
  const blobs = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const rr = 70 + ((i * 37) % 60);
    blobs.push([Math.cos(a) * rr * 1.6, Math.sin(a) * rr * 0.9, 34 + ((i * 13) % 26)]);
  }
  blobs.push([-120, 60, 60], [130, 50, 64], [0, 90, 70], [-60, 110, 50], [80, 120, 55]);
  blobs.sort((A, B) => depth([A[0], A[1], 0]) - depth([B[0], B[1], 0]));
  for (const [x, y, r] of blobs) {
    const [cx, cy] = at([x, y, r * 0.5]);
    s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r}" fill="url(#g-steam)"/>`;
  }
  const [cx, cy] = at([0, 0, 0]);
  return `<g class="steam" data-cx="${r1(cx)}" data-cy="${r1(cy)}" style="display:none">${s}</g>`;
}
function flowLine(points, cls) {
  return `<path class="flow ${cls}" d="${poly3(points, false)}"/>`;
}
put(11, "fx", "none", srbPlume(-1), { asm: "srbL" });
put(44, "fx", "none", ENG.map(([x, y]) => rs25Plume(x, y)).join(""), { asm: "es" });
put(56, "fx", "none", srbPlume(1), { asm: "srbR" });
put(57, "fx", "none", steamSvg(), { asm: "deck" });
put(30, "fx", "none", rl10Plume(), { asm: "icps", key: 30e6 + RL10_SLOT });
put(30, "fx", "none", lasPlume(), { asm: "las" });
// propellant flow: shown in the cutaway, and on the outside lines while the engines burn
{
  const F = FC;
  let lh2 = "";
  for (const [x, y] of ENG) lh2 += flowLine(G.fillet([[0, 0, 80], [x * 0.5, y * 0.5, 74], [x, y, 70]], 3, 6), "lh2");
  const b = pt(F, Z.eng - 2, CORE_R - 4, backFeed);
  const lox = flowLine(G.fillet([b, [b[0] * 0.6, b[1] * 0.6, 80], [ENG[0][0], ENG[0][1], 68]], 4, 6), "lox");
  put(30, "fx", "none", `<g class="flowg">${lh2}${lox}</g>`, { asm: "es", view: "cut" });
  const sump = pt(F, 488, 20, backFeed);
  put(30, "fx", "none", `<g class="flowg">${flowLine(G.fillet([sump, pt(F, 470, 30, backFeed), pt(F, 458, CORE_R - 2, backFeed)], 4, 6), "lox")}</g>`, { asm: "it", view: "cut" });
  const r = CORE_R + 4.2;
  const ext = flowLine(G.fillet([pt(F, 455, CORE_R + 0.2, frontFeed), pt(F, 452, r, frontFeed), pt(F, 112, r, frontFeed), pt(F, 104, CORE_R + 0.2, frontFeed)], 4, 7), "lox");
  const press = [0.09, 0.14].map((da) => flowLine(G.fillet([pt(F, 106, CORE_R, frontFeed + da), pt(F, 110, CORE_R + 1.3, frontFeed + da), pt(F, 455, CORE_R + 1.3, frontFeed + da), pt(F, 458, CORE_R, frontFeed + da)], 2, 6), "gas")).join("");
  put(30, "fx", "none", `<g class="flowg flow-ext">${ext}${press}</g>`, { asm: "lh2", view: "whole" });
}
const FLIGHT = {
  pivot: {
    cm: at([0, 0, 879]),
    srbL: at([-SRB_X, 0, 280]),
    srbR: at([SRB_X, 0, 280]),
    core: at([0, 0, 380]),
    las: at([0, 0, 960]),
    saj0: at(G.add3(G.mul3(G.radialOf(FC, SAJ_ANGLES[0]), SAJ_R), [0, 0, 835])),
    saj1: at(G.add3(G.mul3(G.radialOf(FC, SAJ_ANGLES[1]), SAJ_R), [0, 0, 835])),
    saj2: at(G.add3(G.mul3(G.radialOf(FC, SAJ_ANGLES[2]), SAJ_R), [0, 0, 835])),
  },
  y0: at([0, 0, 0])[1],
  dz: at([0, 0, 1])[1] - at([0, 0, 0])[1],
};
// WebGL launch effects: the same numbers as the drawing (world dm, rocket frame)
const FXD = (() => {
  const S = [];
  ENG.forEach(([x, y], i) => S.push({ id: "rs" + i, asm: "es", p: [x, y, 9], re: bellR(9), d: [0, 0, -1], kind: 0, len: 150, seed: i * 3.7 }));
  for (const side of [-1, 1]) S.push({ id: "srb", asm: side < 0 ? "srbL" : "srbR", p: [side * SRB_X, 0, 0.5], re: 19.3, d: [0, 0, -1], kind: 1, len: 430, seed: side * 5.3 });
  S.push({ id: "rl10", asm: "icps", p: [0, 0, 690], re: 10.8, d: [0, 0, -1], kind: 0, len: 170, ex: 1, seed: 9.1 });
  for (const a of [FRONT + 0.35, FRONT + 0.35 + TAU / 3, FRONT + 0.35 - TAU / 3]) {
    const rad = G.radialOf(FC, a);
    S.push({ id: "las", asm: "las", p: pt(FC, 974, 4.9, a), re: 2.6, d: G.unit3(G.add3(G.mul3(rad, 26), [0, 0, -46])), kind: 1, len: 70, seed: a });
  }
  for (const side of [-1, 1]) {
    S.push({ id: "bsm", asm: side < 0 ? "srbL" : "srbR", p: [side * (SRB_X + srbNoseR(506)), 0, 506], re: 3.4, d: G.unit3([side, 0, -0.3]), kind: 1, len: 95, seed: 2 + side });
    S.push({ id: "bsm", asm: side < 0 ? "srbL" : "srbR", p: [side * (SRB_X + 21), 0, 44], re: 3.4, d: G.unit3([side, 0, -0.45]), kind: 1, len: 95, seed: 4 + side });
  }
  const O = [
    { asm: "es", x: 0, y: 0, z0: 48, z1: 60, r0: 36.9, r1: CORE_R },
    { asm: "lh2", x: 0, y: 0, z0: 60, z1: Z.lvsaCyl, r0: CORE_R, r1: CORE_R },
    { asm: "lvsa", x: 0, y: 0, z0: Z.lvsaCyl, z1: Z.lvsaTop, r0: CORE_R, r1: ICPS_R + 0.4 },
    { asm: "icps", x: 0, y: 0, z0: 744, z1: Z.icpsTop, r0: ICPS_R, r1: ICPS_R },
    { asm: "osa", x: 0, y: 0, z0: Z.icpsTop, z1: Z.sajTop, r0: ICPS_R + 0.3, r1: SAJ_R },
    { asm: "cm", x: 0, y: 0, z0: Z.cmBase, z1: 893, r0: 24.9, r1: CM_R(893) },
    { asm: "las", x: 0, y: 0, z0: Z.ogiveBase, z1: Z.ogiveTop, r0: OGIVE_R(Z.ogiveBase + 0.5), r1: OGIVE_R(Z.ogiveTop - 0.5) },
    { asm: "las", x: 0, y: 0, z0: Z.ogiveTop, z1: Z.tip, r0: 5.3, r1: 1.5 },
    { asm: "icps", x: 0, y: 0, z0: 690, z1: 722, r0: 10.8, r1: 2.2, hot: "rl10" },
  ];
  for (const side of [-1, 1]) {
    const asm = side < 0 ? "srbL" : "srbR", x = side * SRB_X;
    O.push({ asm, x, y: 0, z0: 0, z1: 16, r0: 19.3, r1: 13, srb: 1 });
    O.push({ asm, x, y: 0, z0: Z.srbBase, z1: Z.srbSkirtTop, r0: 27, r1: SRB_R + 0.4, srb: 1 });
    O.push({ asm, x, y: 0, z0: Z.srbSkirtTop, z1: Z.srbFwdSkirt, r0: SRB_R, r1: SRB_R, srb: 1 });
    O.push({ asm, x, y: 0, z0: Z.srbFwdSkirt, z1: Z.srbTip - 2, r0: SRB_R, r1: srbNoseR(Z.srbTip - 2), srb: 1 });
  }
  for (const [x, y] of ENG) O.push({ asm: "es", x, y, z0: 9, z1: 50, r0: bellR(9), r1: bellR(50) });
  const hole = (h) => [h.x, h.y, h.x + h.w, h.y + h.d];
  return {
    sources: S,
    occ: O,
    deck: { asm: "deck", rect: [DECK.x, DECK.y, DECK.x + DECK.w, DECK.y + DECK.d], top: 0, bottom: -Z.deckT, holes: [hole(HOLE_C), hole(HOLE_S(-1)), hole(HOLE_S(1))] },
  };
})();

// =====================================================================================
// LABELS (name tags with leaders) – zone 90
// =====================================================================================
const LABELS = [
  // [part, world anchor, side, text, asm]
  ["las-nose", pt(FC, 1004, 2.5, FRONT), "L", "LAS nose & attitude control motor", "las"],
  ["las-jettison", pt(FC, 974, 4.9, FRONT), "L", "Jettison motor", "las"],
  ["las-abort", pt(FC, 948, 5.3, FRONT), "L", "Abort motor + 4 nozzles", "las"],
  ["las-ogive", pt(FC, 896, OGIVE_R(896), FRONT), "L", "Ogive fairing (covers Orion crew module)", "las"],
  ["saj", pt(FC, 846, SAJ_R, FRONT), "L", "Fairing panels over European Service Module", "saj0"],
  ["osa", pt(FC, 803, ICPS_R + 0.3, FRONT), "L", "Orion stage adapter", "osa"],
  ["icps-lh2", pt(FC, 786, ICPS_R, FRONT), "L", "ICPS upper stage", "icps"],
  ["lvsa", pt(FC, 745, CORE_R - (CORE_R - ICPS_R) * ((745 - Z.lvsaCyl) / (Z.lvsaTop - Z.lvsaCyl)), FRONT), "L", "Launch vehicle stage adapter", "lvsa"],
  ["core-fwdskirt", pt(FC, 672, CORE_R, FRONT), "L", "Forward skirt (avionics)", "fs"],
  ["core-lox", pt(FC, 590, CORE_R, FRONT), "L", "Liquid oxygen tank", "lox"],
  ["core-intertank", pt(FC, 490, CORE_R, FRONT - 0.3), "L", "Intertank", "it"],
  ["core-lh2", pt(FC, 330, CORE_R, FRONT - 0.3), "L", "Liquid hydrogen tank", "lh2"],
  ["core-feedline", pt(FC, 260, CORE_R + 4.2, frontFeed), "L", "LOX feedline", "lh2"],
  ["core-engsec", pt(FC, 84, CORE_R, FRONT - 0.2), "L", "Engine section", "es"],
  ["rs25", [16.5, 16.5, 20], "L", "4 × RS-25 engines", "es"],
  ["srb-nose", pt(FZ(SRB_X, 0), 520, srbNoseR(520), FRONT), "R", "Booster nose cone", "srbR"],
  ["srb-fwdskirt", pt(FZ(SRB_X, 0), 466, SRB_R, FRONT), "R", "Booster forward skirt", "srbR"],
  ["srb-seg", pt(FZ(SRB_X, 0), 330, SRB_R, FRONT), "R", "5 propellant segments", "srbR"],
  ["srb-joints", pt(FZ(SRB_X, 0), 210, SRB_R + 0.5, FRONT), "R", "Field joint", "srbR"],
  ["srb-aftskirt", pt(FZ(SRB_X, 0), 30, 23, FRONT), "R", "Booster aft skirt", "srbR"],
  ["srb-nozzle", pt(FZ(SRB_X, 0), 6, 17, FRONT), "R", "Booster nozzle", "srbR"],
  ["ml-vsp", [SRB_X + 19, 19, 13], "R", "Vehicle support posts", "deck"],
  ["ml-deck", [DECK.x + DECK.w - 20, DECK.y + DECK.d, -10], "R", "Mobile Launcher 1 deck", "deck"],
];
labels(LABELS);

// =====================================================================================
// PAGE
// =====================================================================================
FLIGHT.cx = at([0, 0, 380])[0];
const MISSION = String.raw`
// ---- Artemis II ascent, time-warped so the whole mission plays in about two minutes
const T_START = -8, T_END = 12255 + 420;
const WIN = [[-8, 12, 1], [125, 140, 5], [188, 212, 5], [478, 505, 5], [1090, 1330, 40], [2930, 2972, 10], [6470, 7400, 280], [12230, 12420, 20]];
const ALT = [[-8, 0], [0, 0], [10, 0.2], [30, 2], [60, 9.5], [90, 22], [132, 48], [200, 95], [300, 140], [400, 158], [484, 162], [1100, 180], [2940, 185], [3000, 190], [6480, 1800], [7380, 7000], [12255, 28000], [T_END, 30200]];
const VEL = [[-8, 0], [0, 0], [10, 150], [30, 650], [60, 1700], [90, 3300], [132, 5200], [200, 7000], [300, 10800], [400, 17500], [484, 28000], [2940, 27900], [3000, 28300], [6480, 25000], [7380, 33500], [12255, 16500], [T_END, 15800]];
const EVENTS = [[-8, "Hydrogen burn-off igniters", 1.6], [-6.4, "RS-25 engines start", 6], [0, "Booster ignition · LIFTOFF", 9], [9, "Clearing the tower", 9], [50, "Transonic: vapour cone", 12], [62, "Max-Q: peak aerodynamic pressure", 12], [110, "Booster thrust tail-off", 22], [132, "Booster separation", 40], [195, "Service module fairings jettison", 5], [200, "Launch abort system jettison", 40], [484, "Core stage main engine cutoff (MECO)", 12], [496, "Core stage separation", 120], [1100, "Solar array wings deploy", 230], [2940, "ICPS perigee raise burn", 60], [6480, "ICPS apogee raise burn", 900], [12255, "Orion separates from the ICPS", 420]];
// ---- the rest of Artemis II on the mission map (planned profile, seconds after liftoff)
const MAP = (() => {
  const { orb, con, hyp, fix, path, xfer, blend, dock, period, ang } = MM;
  const PI = Math.PI;
  const PH = PI - 0.05;                                         // perigee of the Earth orbits, opposite the Moon
  const low = orb("earth", 185, 2200, PH, 6900);                 // after core stage separation and the perigee raise
  const heo = orb("earth", 185, 70000, PH, 6900);                // after the ICPS apogee raise: about a day per lap
  const tTLI = 6900 + period(heo) - 200, tFB = 440000, tEI = 785000, tSplash = tEI + 1400, END = tEI + 3600;
  const site0 = ang(low, 484) - 0.3;                             // LC-39B
  const tli = orb("earth", 300, 480000, ang(heo, tTLI + 400) + 0.03, tTLI + 400);
  const flyby = hyp("moon", 8000, 0.6, 0, tFB);                 // free return around the far side
  const ret = con("earth", 40, 0.97, 3.29, tEI + 60);
  const a = ang(ret, tEI), aSplash = a + 0.905;
  const orion = {
    id: "orion", col: "#ffd29a", name: [[-1e9, "Artemis II"], [12255, "Orion"]],
    g: [[-1e9, "sls"], [484, "stack"], [12255, "orion"], [tEI - 1200, "cm"]],
    path: [
      [-8, fix("earth", site0)],
      [0, path("earth", [[0, site0, 0, 0], [60, site0 + 0.0012, 9.5, 1700], [132, site0 + 0.008, 48, 5200], [300, site0 + 0.08, 140, 10800], [484, null, null]])],
      [484, low], [6480, blend("earth")], [7380, heo], [tTLI, blend("earth")], [tTLI + 400, tli], [tTLI + 30000, xfer(0.45, 0.3)],
      [tFB - 40000, flyby], [tFB + 40000, xfer(0.45, -0.3)], [tEI - 45000, ret],
      [tEI, path("earth", [[tEI, null, null], [tEI + 130, a + 0.12, 66, 38000], [tEI + 300, a + 0.3, 58, 30000], [tEI + 520, a + 0.55, 85, 26000], [tEI + 760, a + 0.77, 55, 20000], [tEI + 900, a + 0.86, 35, 6000], [tEI + 1050, a + 0.9, 7, 500], [tEI + 1110, a + 0.903, 2.9, 200], [tSplash, aSplash, 0, 30]])],
      [tSplash, fix("earth", aSplash)],
    ],
    fx: [[0, 484, "burn"], [2940, 2962, "burn"], [6480, 7380, "burn"], [tTLI, tTLI + 400, "burn"], [tEI + 1050, tEI + 1110, "chute1"], [tEI + 1110, tSplash, "chute2"]],
    pose: [[tEI - 1200, tEI + 1050, "retro"], [tEI + 1050, END, "up"]],
  };
  // back in the 3-D view from service module separation to splashdown
  const home = {
    t0: tEI - 1300,
    state(t, h) {
      const P0 = FLIGHT.pivot.cm, c = fxClock, tDrogue = tEI + 1050, tMain = tEI + 1110, u = Math.max(0, t - (tEI - 1200));
      const tilt = t < tDrogue ? 14 + 3 * Math.sin(c * 2.1) : t < tSplash ? 4 * Math.sin(c * 1.1) : 3 * Math.sin(c * 0.8);
      const fs = { asm: { cm: { v: [0, 0, 0], rot: tilt, piv: P0 }, glow: { v: [0, 0, 0] } }, wing: 1 };
      fs.asm.esm = { v: [0.5 * u, 0, -(0.6 * u + 0.004 * u * u)], rot: tilt + 0.25 * u, piv: P0, hide: u > 240 };
      fs.chute1 = sm(tDrogue, tDrogue + 3, t) * (1 - sm(tMain, tMain + 2, t));
      fs.chute2 = (0.4 * sm(tMain, tMain + 3, t) + 0.6 * sm(tMain + 9, tMain + 15, t)) * (1 - sm(tSplash + 8, tSplash + 20, t));
      fs.asm.sea = { v: [0, 0, -520 * Math.pow(Math.min(1, h.alt / 3), 0.7)], hide: h.alt > 3 };
      fs.splash = t >= tSplash;
      const k1 = sm(tEI - 1170, tEI - 1000, t), k2 = sm(tDrogue, tMain + 20, t), k3 = sm(tSplash, tSplash + 30, t);
      fs.camZ = 862 + 17 * k1 + 80 * k2 - 55 * k3;
      fs.zoom = (5 + 2.6 * k1) * (1 - 0.42 * k2) * (1 + 0.15 * k3);
      return fs;
    },
  };
  const icps = { id: "icps", col: "#e7b98a", name: "ICPS", g: "icps", end: 40000, path: [[12255, dock("orion")], [12256, orb("earth", 185, 70000, PH, 6990)]] };
  return {
    end: END, objs: [orion, icps], hud: "orion", home,
    // 3-D: liftoff, ascent to high Earth orbit, ICPS separation, far-side flyby, skip entry, splashdown; free flight in between
    land: [
      { id: "slspad", from: -8, to: 30 }, { id: "slsasc", from: 30, to: 12250 }, { id: "osep", at: 12255 }, { id: "flyby", at: tFB },
      { id: "oentry", from: tEI, to: tEI + 900 }, { id: "osplash", at: tSplash, to: END },
      { id: "coast", craft: [[-1e9, "orion"], [tEI - 1200, "orionCm"]], chutes: [3, 35, 40, "#e2672a"] },
    ],
    marks: [{ b: "earth", a: site0, kind: "pad", name: "LC-39B", to: 30000 }, { b: "earth", a: aSplash + 0.0006, kind: "boat", name: "Recovery ship", from: tEI - 30000 }],
    cam: [
      [-8, "orion", 500], [200, "orion", 1500], [600, "earth", 9800], [6300, "earth", 14000], [7400, "earth", 90000], [12000, "orion", 2500],
      [15000, "earth", 90000], [tTLI - 3000, "earth", 14000], [tTLI + 2000, "earth", 60000], [tTLI + 25000, "sys", 250000],
      [tFB - 45000, "moon", 50000], [tFB - 6000, "moon", 22000], [tFB + 12000, "moon", 50000], [tFB + 45000, "sys", 250000],
      [tEI - 60000, "earth", 40000], [tEI - 3000, "orion", 9000], [tEI - 300, "orion", 1500], [tEI + 200, "orion", 600], [tEI + 1000, "orion", 30], [tEI + 1150, "orion", 8],
    ],
    events: [
      [13000, "Proximity operations · the crew flies Orion by hand near the ICPS"], [40000, "Day 1 · systems checkout in high Earth orbit"],
      [tTLI, "Translunar injection · Orion's main engine"], [tTLI + 30000, "Outbound coast · four days to the Moon"],
      [tFB - 40000, "Entering the Moon's sphere of influence"], [tFB, "Lunar flyby · around the far side"],
      [tFB + 12000, "Free return · the Moon's gravity swings Orion home"], [tEI - 1200, "Crew module separates from the service module"],
      [tEI, "Entry interface · 11 km/s"], [tEI + 300, "Skip entry · Orion dips in, climbs back out, then descends"],
      [tEI + 1050, "Drogue parachutes"], [tEI + 1110, "Main parachutes"], [tSplash, "Splashdown · Pacific Ocean"], [tSplash + 1800, "Crew recovered"],
    ],
  };
})();
const RET = MAP.home, LANDINGS = MAP.land;
const CORE = ["es", "lh2", "it", "lox", "fs", "lvsa"], UPPER = ["icps", "osa", "sa"], ORION = ["esm", "cm"];
const arms = [...svg.querySelectorAll("[data-arm]")];
const lvl = { lox: svg.querySelector("#lvl-lox rect"), lh2: svg.querySelector("#lvl-lh2 rect") };
const riseAt = (t) => (t > 0 ? 16 * t * t : 0);
function flightState(t) {
  const fs = { asm: {}, t };
  const rise = riseAt(t);
  fs.asm.deck = { v: [0, 0, -rise], hide: rise > 5000 };
  if (t > 132) {
    const u = t - 132;
    fs.asm.srbL = { v: [-(2.5 * u + 0.05 * u * u), 0, -0.9 * u * u], rot: -0.9 * u, piv: FLIGHT.pivot.srbL, hide: u > 90 };
    fs.asm.srbR = { v: [2.5 * u + 0.05 * u * u, 0, -0.9 * u * u], rot: 0.9 * u, piv: FLIGHT.pivot.srbR, hide: u > 90 };
  }
  if (t > 195) {
    const u = t - 195;
    for (let i = 0; i < 3; i++) {
      const a = ASM["saj" + i].v, n = Math.hypot(a[0], a[1]);
      const d = 4 * u + 0.08 * u * u;
      fs.asm["saj" + i] = { v: [(a[0] / n) * d, (a[1] / n) * d, -0.3 * u * u], rot: (i === 1 ? 1 : -1) * 1.4 * u, piv: FLIGHT.pivot["saj" + i], hide: u > 100 };
    }
  }
  if (t > 200) { const u = t - 200; fs.asm.las = { v: [1.4 * u, 0, 10 * u + 1.1 * u * u], rot: 0.15 * u, piv: FLIGHT.pivot.las, hide: u > 70 }; }
  if (t > 496) { const u = t - 496; for (const n of CORE) fs.asm[n] = { v: [0, 0, -(1.2 * u + 0.25 * u * u)], rot: 0.06 * u, piv: FLIGHT.pivot.core, hide: u > 160 }; }
  if (t > 12255) { const u = t - 12255; for (const n of ORION) fs.asm[n] = { v: [0, 0, 0.32 * u] }; for (const n of UPPER) fs.asm[n] = { v: [0, 0, -0.18 * u] }; }
  fs.wing = ramp(t, 1100, 1320);
  fs.rs = t < -6.4 ? 0 : t < 484 ? ramp(t, -6.4, -3.6) : 1 - ramp(t, 482, 487);
  fs.srb = t < 0 ? 0 : t < 110 ? ramp(t, 0, 0.4) : t < 132 ? 1 - 0.75 * ramp(t, 110, 130) : 0;
  fs.las = t > 200 && t < 214 ? 1 - ramp(t, 206, 214) : 0;
  fs.rl10 = (t > 2940 && t < 2962 ? ramp(t, 2940, 2942) * (1 - ramp(t, 2960, 2962)) : 0) + (t > 6480 && t < 7380 ? ramp(t, 6480, 6484) * (1 - ramp(t, 7375, 7380)) : 0);
  fs.fallback = { rs25: fs.rs, srb: fs.srb, las: fs.las, rl10: Math.min(1, fs.rl10) };
  fs.steam = t > -6 ? ramp(t, -6, 25) : 0;
  fs.alt = interp(ALT, t);
  fs.vel = interp(VEL, t);
  fs.burn = clamp01((t + 6) / 490);
  if (t < 496) { const k = sm(-1, 9, t); fs.camZ = 520 - 250 * k; fs.zoom = 1 - 0.12 * k; }
  else if (t < 12255) { const k = ramp(t, 496, 540); fs.camZ = 270 + (835 - 270) * k; fs.zoom = 0.88 + 1.2 * k; }
  else { const u = t - 12255; fs.camZ = 850 + 0.16 * u; fs.zoom = 2.1 + 0.4 * ramp(t, 12255, 12400); }
  return fs;
}
function vehicleFx(fs) {
  const t = fs.t;
  const armOp = (1 - ramp(t, -1, 1)).toFixed(3);
  for (const a of arms) a.style.opacity = armOp;
  lvl.lox.setAttribute("y", (FLIGHT.y0 + (628 - 108 * fs.burn) * FLIGHT.dz).toFixed(1));
  lvl.lh2.setAttribute("y", (FLIGHT.y0 + (428 - 316 * fs.burn) * FLIGHT.dz).toFixed(1));
  fs.rs > 0.05 ? stage.setAttribute("data-flow", "") : stage.removeAttribute("data-flow");
}
function vehicleReset() {
  for (const a of arms) a.style.opacity = "";
  lvl.lox.setAttribute("y", "-9000"); lvl.lh2.setAttribute("y", "-9000");
}
function rl10Heat(t) {
  let h = 0;
  for (const [a, b] of [[2940, 2960], [6480, 7378]]) if (t > a) h = Math.max(h, (1 - Math.exp(-(Math.min(t, b) - a) / 5)) * (t > b ? Math.exp(-(t - b) / 40) : 1));
  return h;
}
function fxState(fs) {
  const t = fs.t, alt = fs.alt, c = fxClock;
  const off = (n) => fs.asm[n] || { v: [0, 0, 0] };
  const sources = FXD.sources.map((s, i) => {
    const o = off(s.asm), v = o.v;
    let power = 0, ex = s.ex || 0, len = s.len;
    if (s.id.startsWith("rs")) { const k = +s.id.slice(2); power = sm(-6.4 + 0.12 * k, -3.2 + 0.12 * k, t) * (1 - sm(482 + 0.2 * k, 486.5, t)); ex = sm(6, 75, alt); len *= 1 + ex * 0.6; }
    else if (s.id === "srb") { power = fs.srb; ex = sm(3, 42, alt); len *= 1 + ex * 0.5; }
    else if (s.id === "rl10") power = 0.55 * Math.min(1, fs.rl10);
    else if (s.id === "las") power = burst(t - 200, 0.12, 1.6);
    else if (s.id === "bsm") power = burst(t - 132.2, 0.06, 0.8);
    if (o.hide) power = 0;
    const sw = s.kind === 1 ? 0.006 : 0.012;
    const d = unit([s.d[0] + sw * Math.sin(c * 2.3 + i * 1.7), s.d[1] + sw * Math.cos(c * 1.9 + i * 2.1), s.d[2]]);
    return { p: [s.p[0] + v[0], s.p[1] + v[1], s.p[2] + v[2]], re: s.re, d, kind: s.kind, power: power * (1 + 0.035 * Math.sin(c * 37 + i * 4.1)), len: len * (1 + 0.03 * Math.sin(c * 23 + i)), ex, seed: s.seed };
  });
  const occ = FXD.occ.map((o) => {
    const a = off(o.asm), v = a.v;
    return { on: !a.hide && !(o.srb && t > 132), x: o.x + v[0], y: o.y + v[1], z0: o.z0 + v[2], z1: o.z1 + v[2], r0: o.r0, r1: o.r1, heat: o.hot ? 0.78 * rl10Heat(t) : 0 };
  });
  const rise = riseAt(t);
  const dk = FXD.deck;
  return {
    rise, sources, occ,
    deck: rise < 6000 ? dk : null,
    trail: { a: 16, t, t0: 0, t1: 132, c: [0, 0], half: 66, r0: 22, start: 260, strength: 1, z: 0.5, growth: 1, thin: sm(8, 40, alt) },
    ground: { tau: Math.max(0, t + 6.4), smoke: sm(0, 3, t), steam: 0.85 * sm(-6.2, -2.5, t), z: dk.bottom, c: [0, -12], rmax: 760 },
    vapor: sm(46, 54, t) * (1 - sm(64, 73, t)),
    vap: [826, 560, 45],
    flash: burst(t, 0.06, 0.4),
    sparks: sm(-8.2, -7.9, t) * (1 - sm(-6.7, -6.0, t)),
    spark: [0, 0, 7, 24],
    wind: [9, 4], sun: 1,
  };
}
function shakeAt(t) {
  const a = 4 * burst(t, 0.08, 1.6) + 1.4 * sm(-0.2, 0.6, t) * (1 - sm(6, 16, t)) + 0.9 * (sm(46, 54, t) * (1 - sm(64, 73, t))) + 0.5 * sm(-6.4, -4, t) * (1 - sm(-1, 1, t));
  const c = fxClock;
  return [a * (Math.sin(c * 71) * 0.6 + Math.sin(c * 43 + 1) * 0.4), a * (Math.sin(c * 59 + 2) * 0.6 + Math.sin(c * 97) * 0.4)];
}
`;
buildPage({
  id: "sls",
  title: "SLS anatomy",
  h1: "Space Launch System · Block 1 · Artemis II",
  sub: "98 m tall · 2,600 t at liftoff · 8.8 million lbf thrust",
  figTitle: "SLS Block 1 · Artemis II",
  label: "Space Launch System Block 1 rocket for Artemis II, drawn in isometric on a section of the Mobile Launcher deck: two five-segment solid rocket boosters either side of the orange core stage with four RS-25 engines, the launch vehicle stage adapter and ICPS upper stage, and the Orion spacecraft under its launch abort system.",
  stageLabel: "SLS rocket figure. Keys: Space launch, E explode, C cutaway, L name tags, plus and minus zoom, 0 fit.",
  caption: "Proportions and colours follow NASA dimensions and Artemis II launch photos. Explode separates the stack the way it comes apart in flight: boosters, core stage sections, adapter, ICPS, Orion, fairings, and the solar wings unfold. Cutaway slices everything open on the plane facing you. Launch plays the ascent with ray-marched exhaust, smoke and steam.",
  infoText: "Every piece of the stack is drawn as a real part. Turn on Cutaway to see inside the tanks, the booster propellant and the crew cabin.",
  ASM: { ...ASM, wingAsm: "esm" },
  xHalf: 330,
  box: (apart) => {
    const off = (asm) => (apart ? ASM[asm].v : [0, 0, 0]);
    return [
      ...k.boxCorners(DECK, -Z.deckT, 0),
      G.add3([0, 0, Z.tip], off("las")),
      [18, -228, TOWER.top + 95],
      [TOWER.x1, TOWER.y0, 0],
      G.add3([SRB_X + 27, 0, 560], off("srbR")),
      G.add3([-SRB_X - 27, 0, 560], off("srbL")),
    ];
  },
  FLIGHT,
  FXD,
  defs: `<clipPath id="lvl-lox" clipPathUnits="userSpaceOnUse"><rect x="-3000" y="-9000" width="6000" height="18000"/></clipPath><clipPath id="lvl-lh2" clipPathUnits="userSpaceOnUse"><rect x="-3000" y="-9000" width="6000" height="18000"/></clipPath>`,
  mission: MISSION,
  wingFrames: WING_FRAMES,
});
