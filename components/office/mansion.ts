import type { HouseStyle } from "@/lib/settings";
import type { Part } from "./batch";
import { MANSION, rnd } from "./homes";

/**
 * The boss's house on the double lot behind the office, in the style picked in Settings (boss.house). Every
 * style keeps the same bones so the rest of the town keeps working: the garage at MANSION.garage, open at the
 * front so the car can drive in to MANSION.park; the driveway gap in the street wall over the garage's width;
 * the pedestrian gate and the front door on the left; nothing solid on the drive; inside x0..x1, back..gateZ
 * and under the name badge (6.6 m). Built into its own merged mesh (Neighbourhood.tsx), so changing the style
 * rebuilds only the house.
 */

/** A lit window or light panel: a plane facing +z (default) or +x. (Same shape as Neighbourhood's Win.) */
type Win = { x: number; y: number; z: number; w: number; h: number; face?: "x" };
/** What a house builder adds to: merged parts and windows that glow at night. */
export type HouseKit = { solid: Part[]; homeWins: Win[] };
type Town = HouseKit;

export function mansion(t: HouseKit, style: HouseStyle): void {
  STYLES[style](t);
}

/** The fixed points every style is built around. */
const K = (() => {
  const M = MANSION;
  const hx0 = M.x0 + 0.6, hx1 = M.garage.x0 - 0.2;
  const gFront = M.front + 0.4;
  return {
    hx0, hx1, hcx: (hx0 + hx1) / 2, hw: hx1 - hx0,
    d: M.front - M.back, cz: (M.front + M.back) / 2,
    /** The driveway gap in the street wall, the pedestrian gate, the front door. */
    gx0: M.garage.x0 - 0.3, gx1: M.garage.x1 + 0.3, px0: hx0 + 1.7, px1: hx0 + 2.7, doorX: hx0 + 2.2,
    /** The garage: width, centre x, open front, depth, centre z. */
    gw: M.garage.x1 - M.garage.x0, gcx: (M.garage.x0 + M.garage.x1) / 2, gFront, gd: gFront - M.back, gcz: (gFront + M.back) / 2,
  };
})();
/** The street wall's runs (between the corner, the pedestrian gate and the driveway) and its pillars. */
const RUNS: readonly (readonly [number, number])[] = [[MANSION.x0, K.px0], [K.px1, K.gx0], [K.gx1, MANSION.x1]];
const POSTS = [MANSION.x0, K.px0, K.px1, K.gx0, K.gx1, MANSION.x1];

/* ------------------------------------------------------------------ shared pieces */

/** Lawn over the whole lot, the driveway to the garage and the path to the door. */
function grounds(S: Part[], lawn: string, drive: string, path: string): void {
  const M = MANSION;
  S.push({ size: [M.x1 - M.x0, 0.03, M.gateZ - M.back + 0.6], pos: [(M.x0 + M.x1) / 2, -0.11, (M.gateZ + M.back) / 2], color: lawn });
  S.push({ size: [M.garage.x1 - M.garage.x0 + 0.4, 0.04, M.gateZ - M.front + 0.1], pos: [M.driveX, -0.09, (M.gateZ + M.front) / 2], color: drive });
  S.push({ size: [1.0, 0.04, M.gateZ - M.front], pos: [K.doorX, -0.09, (M.gateZ + M.front) / 2], color: path });
}

/**
 * The garage: two side walls and a back wall, open at the front (the door is rolled up into the header), a
 * concrete floor and a roof slab at `h`; lamps either side of the opening and a window on the +x side.
 */
function garage(t: Town, o: { wall: string; header: string; slab: string; floor?: string; h: number }): void {
  const S = t.solid, M = MANSION, { gw, gcx, gFront, gd, gcz } = K, GH = o.h;
  for (const x of [M.garage.x0 + 0.1, M.garage.x1 - 0.1]) S.push({ size: [0.2, GH, gd], pos: [x, GH / 2 - 0.1, gcz], color: o.wall });
  S.push({ size: [gw, GH, 0.2], pos: [gcx, GH / 2 - 0.1, M.back + 0.1], color: o.wall });
  S.push({ size: [gw - 0.4, 0.02, gd - 0.2], pos: [gcx, -0.08, gcz], color: o.floor ?? "#6b7280" });
  S.push({ size: [gw - 0.2, 0.55, 0.3], pos: [gcx, GH - 0.37, gFront - 0.1], color: o.header });
  S.push({ size: [gw + 0.1, 0.12, gd + 0.1], pos: [gcx, GH - 0.04, gcz], color: o.slab });
  t.homeWins.push({ x: M.garage.x1 + 0.04, y: 1.3, z: K.cz, w: 1.6, h: 0.5, face: "x" });
  for (const x of [M.garage.x0 + 0.2, M.garage.x1 - 0.2]) t.homeWins.push({ x, y: GH - 0.6, z: gFront + 0.05, w: 0.12, h: 0.3 });
}

/** The driveway gate, slid open behind the wall to the left of the gap: horizontal slats. */
function slidingGate(S: Part[], color: string, h = 1.3): void {
  const { gx0, gx1 } = K, n = Math.round(h / 0.095);
  for (let k = 0; k < n; k++) S.push({ size: [gx1 - gx0 - 0.4, 0.05, 0.04], pos: [gx0 - (gx1 - gx0) / 2 + 0.1, 0.15 + k * 0.095, MANSION.gateZ - 0.2], color });
}

/** The pedestrian gate: vertical bars across its opening. */
function footGate(S: Part[], color: string, h = 1.3): void {
  const { px0, px1 } = K;
  for (let k = 0; k < 9; k++) S.push({ size: [0.04, h, 0.05], pos: [px0 + 0.1 + (k * (px1 - px0 - 0.2)) / 8, h / 2 - 0.05, MANSION.gateZ], color });
}

/** The usual street wall: runs of `h` with an optional band, pillars with caps and (optionally) lamps on top. */
function streetWall(t: Town, o: { h: number; wall: string; band?: string; pillar: string; cap: string; lamps?: boolean; thick?: number }): void {
  const S = t.solid, z = MANSION.gateZ, th = o.thick ?? 0.22;
  for (const [a, b] of RUNS) {
    if (b - a < 0.05) continue;
    S.push({ size: [b - a, o.h, th], pos: [(a + b) / 2, o.h / 2 - 0.1, z], color: o.wall });
    if (o.band) S.push({ size: [b - a, 0.1, th + 0.02], pos: [(a + b) / 2, o.h - 0.3, z], color: o.band });
  }
  for (const x of POSTS) {
    S.push({ size: [0.4, o.h + 0.3, 0.4], pos: [x, (o.h + 0.3) / 2 - 0.1, z], color: o.pillar });
    S.push({ size: [0.48, 0.1, 0.48], pos: [x, o.h + 0.25, z], color: o.cap });
    if (o.lamps) t.homeWins.push({ x, y: o.h + 0.42, z: z + 0.21, w: 0.22, h: 0.16 });
  }
}

/** A window frame (top, bottom, sides) facing +z. */
function frame(S: Part[], x: number, y: number, z: number, w: number, h: number, color: string, t = 0.08): void {
  S.push({ size: [w + t * 2, t, 0.06], pos: [x, y + h / 2 + t / 2, z], color }, { size: [w + t * 2, t, 0.06], pos: [x, y - h / 2 - t / 2, z], color });
  S.push({ size: [t, h, 0.06], pos: [x - w / 2 - t / 2, y, z], color }, { size: [t, h, 0.06], pos: [x + w / 2 + t / 2, y, z], color });
}

/** A grid of thin bars over a window facing +z: `nx` panes across, `ny` up. */
function grid(S: Part[], x: number, y: number, z: number, w: number, h: number, nx: number, ny: number, color: string, bar = 0.035): void {
  for (let i = 1; i < nx; i++) S.push({ size: [bar, h, bar], pos: [x - w / 2 + (i * w) / nx, y, z], color });
  for (let j = 1; j < ny; j++) S.push({ size: [w, bar, bar], pos: [x, y - h / 2 + (j * h) / ny, z], color });
}

/** A heart standing up, facing +z (two discs on a square turned 45°), `s` across. */
function heart(S: Part[], x: number, y: number, z: number, s: number, color: string): void {
  const a = s * 0.7, o = a / (2 * Math.SQRT2);
  S.push({ size: [a, a, 0.04], pos: [x, y, z], rot: [0, 0, Math.PI / 4], color });
  for (const dx of [-o, o]) S.push({ shape: "cyl", size: [a / 2, 0.04, 14], pos: [x + dx, y + o, z], rot: [Math.PI / 2, 0, 0], color });
}

/** A heart lying flat on the ground (a flower bed), its point toward the street. */
function heartBed(S: Part[], x: number, z: number, s: number, color: string, y = -0.07): void {
  const a = s * 0.7, o = a / (2 * Math.SQRT2);
  S.push({ size: [a, 0.06, a], pos: [x, y, z], rotY: Math.PI / 4, color });
  for (const dx of [-o, o]) S.push({ shape: "cyl", size: [a / 2, 0.06, 14], pos: [x + dx, y, z - o], color });
}

/** A coconut palm: a slightly leaning trunk and a crown of fronds. */
function palm(S: Part[], x: number, z: number, h = 3.2, lean = 0.12): void {
  S.push({ shape: "cyl", size: [0.08, h, 6], pos: [x, h / 2 - 0.1, z], rot: [0, 0, lean], color: "#8a6a4a" });
  const tx = x - Math.sin(lean) * h, ty = h - 0.15;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    S.push({ size: [1.4, 0.04, 0.3], pos: [tx + Math.cos(a) * 0.58, ty, z + Math.sin(a) * 0.58], rot: [0, -a, -0.38], color: k % 2 ? "#3f7d4a" : "#4f8f4f" });
  }
  S.push({ shape: "cyl", size: [0.16, 0.2, 6], pos: [tx, ty - 0.1, z], color: "#6b5a2a" });
}

/** A leafy tree: trunk and a cluster of tumbled faceted blobs (low-poly, like the town's trees). */
function bushyTree(S: Part[], x: number, z: number, trunk: number, r: number, colors: readonly string[], trunkColor = "#6b4a33"): void {
  S.push({ shape: "cyl", size: [0.09, trunk, 6], pos: [x, trunk / 2 - 0.1, z], color: trunkColor });
  blob(S, x, trunk + r * 0.3, z, r, colors);
}

/** A faceted clump of leaves (or blossom) about `r` across: a few boxes turned every which way. */
function blob(S: Part[], x: number, y: number, z: number, r: number, colors: readonly string[]): void {
  const parts = [[0, 0, 0, 1], [0.4, 0.25, 0.25, 0.75], [-0.35, 0.35, -0.2, 0.72], [0.05, 0.7, 0.05, 0.6], [-0.1, -0.15, 0.4, 0.62]] as const;
  parts.forEach(([dx, dy, dz, k], i) => {
    const s = r * 1.25 * k;
    S.push({ size: [s, s * 0.85, s], pos: [x + dx * r, y + dy * r, z + dz * r], rot: [0.6 + i * 0.35, 0.5 + i * 0.9, 0.4 - i * 0.2], color: colors[i % colors.length] });
  });
}

/** A little bush or a pot of flowers: a blob of `color` with a few dots of `flower`. */
function shrub(S: Part[], x: number, z: number, r: number, color: string, flower?: string, y = 0): void {
  S.push({ shape: "cyl", size: [r, r * 1.1, 7], pos: [x, y + r * 0.45, z], color });
  if (flower) for (let k = 0; k < 4; k++) { const a = k * 1.7; S.push({ size: [0.09, 0.09, 0.09], pos: [x + Math.cos(a) * r * 0.75, y + r * 0.85, z + Math.sin(a) * r * 0.75], color: flower }); }
}

/**
 * The fillers that turn a rectangular opening into an arch: layers of boxes from each side, following a
 * circle that rises `rise` above the springing line over a half-span `half`. Faces +z, `depth` thick.
 */
function arch(S: Part[], cx: number, half: number, ySpring: number, rise: number, z: number, depth: number, color: string, n = 4): void {
  const R = (half * half + rise * rise) / (2 * rise), yc = ySpring + rise - R;
  const h = rise / n;
  for (let j = 0; j < n; j++) {
    const y = ySpring + (j + 0.5) * h;
    const open = Math.sqrt(Math.max(0, R * R - (y - yc) * (y - yc)));
    const fill = half - open;
    if (fill < 0.02) continue;
    for (const side of [-1, 1]) S.push({ size: [fill, h + 0.01, depth], pos: [cx + side * (half - fill / 2), y, z], color });
  }
}

/** Shutters either side of a window facing +z. */
function shutters(S: Part[], x: number, y: number, z: number, w: number, h: number, color: string): void {
  for (const side of [-1, 1]) S.push({ size: [w * 0.42, h, 0.05], pos: [x + side * (w / 2 + w * 0.23), y, z], color });
}

/**
 * Rows of tiles on a hip roof built at (cx, y, cz) with size [w, h, d] (ridge along x): `n` lines across the
 * front slope and down the +x end (the two slopes the camera sees).
 */
function tileRows(S: Part[], cx: number, y: number, cz: number, w: number, h: number, d: number, n: number, color: string): void {
  const pitch = Math.atan2(h, d / 2);
  for (let k = 1; k <= n; k++) {
    const f = k / (n + 1);
    S.push({ size: [w - f * d, 0.05, 0.08], pos: [cx, y + f * h + 0.02, cz + (d / 2) * (1 - f)], rot: [pitch, 0, 0], color });
    S.push({ size: [0.08, 0.05, d * (1 - f)], pos: [cx + w / 2 - (f * d) / 2 + 0.0, y + f * h + 0.02, cz], rot: [0, 0, -pitch], color });
  }
}

/* ------------------------------------------------------------------ modern */

/**
 * The boss's house: a modern tropical two-storey across two lots. A white rendered block with a timber-slat
 * upper floor that cantilevers over the porch, floor-to-ceiling glass, a glass-railed balcony, a flat roof
 * with a deep overhang; a garage on the right (its door opens when the car comes and goes, see Car.tsx) with a
 * roof terrace; a lawn, garden lights and palms behind a long wall with a sliding gate for the driveway.
 */
function modern(t: Town): void {
  const S = t.solid;
  const M = MANSION;
  const white = "#f4f2ee", wood = "#8a5a3b", dark = "#2b2f33", glassRail = "#cbd5e1";
  const hx0 = M.x0 + 0.6, hx1 = M.garage.x0 - 0.2, hcx = (hx0 + hx1) / 2, hw = hx1 - hx0;
  const d = M.front - M.back, cz = (M.front + M.back) / 2;
  // grounds: lawn, the driveway and the path to the door
  S.push({ size: [M.x1 - M.x0, 0.03, M.gateZ - M.back + 0.6], pos: [(M.x0 + M.x1) / 2, -0.11, (M.gateZ + M.back) / 2], color: "#7fa36a" });
  S.push({ size: [M.garage.x1 - M.garage.x0 + 0.4, 0.04, M.gateZ - M.front + 0.1], pos: [M.driveX, -0.09, (M.gateZ + M.front) / 2], color: "#c9c6bf" });
  S.push({ size: [1.0, 0.04, M.gateZ - M.front], pos: [hx0 + 2.2, -0.09, (M.gateZ + M.front) / 2], color: "#d6d3cc" });
  // ground floor: white, a wide glass front with a dark frame, the timber front door
  const G = 3.0;
  S.push({ size: [hw, G, d], pos: [hcx, G / 2 - 0.1, cz], color: white });
  t.homeWins.push({ x: hcx + 1.1, y: 1.3, z: M.front + 0.04, w: hw - 3.6, h: 2.1 });
  for (let k = 0; k <= 4; k++) S.push({ size: [0.06, 2.2, 0.07], pos: [hx0 + 2.9 + (k * (hw - 3.6)) / 4, 1.3, M.front + 0.05], color: dark });
  S.push({ size: [1.1, 2.4, 0.08], pos: [hx0 + 2.2, 1.1, M.front + 0.04], color: wood });
  S.push({ size: [0.05, 0.6, 0.05], pos: [hx0 + 2.6, 1.1, M.front + 0.1], color: "#d4a017" });
  t.homeWins.push({ x: hx1 + 0.04, y: 1.4, z: cz, w: 2.4, h: 1.4, face: "x" });
  // upper floor: timber slats, cantilevered 1.2 m over the porch, a long window band and the balcony
  const U = 2.9, uy = G - 0.1 + U / 2, ud = d + 1.2, ucz = cz + 0.6;
  S.push({ size: [hw + 0.4, 0.22, ud], pos: [hcx, G - 0.02, ucz], color: white });
  S.push({ size: [hw, U, ud - 0.2], pos: [hcx, uy, ucz - 0.1], color: wood });
  for (let k = 0; k < 26; k++) S.push({ size: [0.04, U - 0.2, 0.04], pos: [hx0 + 0.15 + (k * (hw - 0.3)) / 25, uy, M.front + 1.1 + 0.03], color: "#6b4430" });
  t.homeWins.push({ x: hcx - 0.6, y: uy + 0.1, z: M.front + 1.15, w: hw - 2.8, h: 1.5 });
  t.homeWins.push({ x: hx1 + 0.04, y: uy, z: ucz, w: 3, h: 1.3, face: "x" });
  // the roof: a thin white slab with a deep overhang, a dark fascia
  S.push({ size: [hw + 1.2, 0.2, ud + 1.0], pos: [hcx, G + U, ucz + 0.2], color: white });
  S.push({ size: [hw + 1.22, 0.08, ud + 1.02], pos: [hcx, G + U - 0.12, ucz + 0.2], color: dark });
  // porch: two slim steel columns under the cantilever, wide steps, planters, two palms
  for (const x of [hx0 + 0.3, hx1 - 0.3]) S.push({ size: [0.1, G - 0.1, 0.1], pos: [x, G / 2 - 0.1, M.front + 1.05], color: dark });
  S.push({ size: [2.4, 0.12, 0.9], pos: [hx0 + 2.2, -0.04, M.front + 0.5], color: "#d6d3cc" });
  for (const x of [M.x0 + 0.6, hx1 - 0.6]) {
    S.push({ shape: "cyl", size: [0.08, 3.2, 6], pos: [x, 1.5, M.gateZ - 0.9], color: "#8a6a4a" });
    for (let k = 0; k < 6; k++) S.push({ size: [1.3, 0.04, 0.3], pos: [x + Math.cos((k / 6) * Math.PI * 2) * 0.55, 3.1, M.gateZ - 0.9 + Math.sin((k / 6) * Math.PI * 2) * 0.55], rot: [0, -(k / 6) * Math.PI * 2, -0.35], color: "#3f7d4a" });
  }
  for (const x of [hx0 + 3.6, hx0 + 6.5]) S.push({ size: [1.4, 0.4, 0.5], pos: [x, 0.1, M.front + 0.4], color: "#57534e" }, { shape: "cyl", size: [0.4, 0.5, 8], pos: [x, 0.5, M.front + 0.4], color: "#4a7f50" });

  // the garage: white box, a dark roll-up door facing the street, a terrace with glass rail on its roof
  const gw = M.garage.x1 - M.garage.x0, gcx = (M.garage.x0 + M.garage.x1) / 2;
  const gFront = M.front + 0.4;
  // open at the front (the roll-up door is up, rolled into the box over the opening), so the car drives in
  const gd = gFront - M.back, gcz = (gFront + M.back) / 2, GH = G - 0.2;
  for (const x of [M.garage.x0 + 0.1, M.garage.x1 - 0.1]) S.push({ size: [0.2, GH, gd], pos: [x, GH / 2 - 0.1, gcz], color: white });
  S.push({ size: [gw, GH, 0.2], pos: [gcx, GH / 2 - 0.1, M.back + 0.1], color: white });
  S.push({ size: [gw - 0.4, 0.02, gd - 0.2], pos: [gcx, -0.08, gcz], color: "#6b7280" });
  S.push({ size: [gw - 0.2, 0.55, 0.3], pos: [gcx, GH - 0.37, gFront - 0.1], color: dark });
  S.push({ size: [gw + 0.1, 0.12, gd + 0.1], pos: [gcx, GH - 0.04, gcz], color: "#d6d3cc" });
  S.push({ size: [gw, 0.05, 0.05], pos: [gcx, G + 0.65, gFront], color: glassRail });
  t.homeWins.push({ x: M.garage.x1 + 0.04, y: 1.3, z: cz, w: 1.6, h: 0.5, face: "x" });
  // wall lamps either side of the garage door
  for (const x of [M.garage.x0 + 0.2, M.garage.x1 - 0.2]) t.homeWins.push({ x, y: 2.2, z: gFront + 0.05, w: 0.12, h: 0.3 });

  // the boundary wall on the street: rendered, with a dark band, a sliding steel gate for the driveway
  // and a pedestrian gate; lamp-topped pillars
  const FH = 1.5, gx0 = M.garage.x0 - 0.3, gx1 = M.garage.x1 + 0.3, px0 = hx0 + 1.7, px1 = hx0 + 2.7;
  const wall = (a: number, b: number) => {
    if (b - a < 0.05) return;
    S.push({ size: [b - a, FH, 0.22], pos: [(a + b) / 2, FH / 2 - 0.1, M.gateZ], color: white });
    S.push({ size: [b - a, 0.1, 0.24], pos: [(a + b) / 2, FH - 0.3, M.gateZ], color: dark });
  };
  wall(M.x0, px0); wall(px1, gx0); wall(gx1, M.x1);
  for (const x of [M.x0, px0, px1, gx0, gx1, M.x1]) {
    S.push({ size: [0.4, FH + 0.4, 0.4], pos: [x, (FH + 0.4) / 2 - 0.1, M.gateZ], color: white });
    t.homeWins.push({ x, y: FH + 0.38, z: M.gateZ + 0.21, w: 0.22, h: 0.16 });
  }
  for (let k = 0; k < 9; k++) S.push({ size: [0.04, 1.3, 0.05], pos: [px0 + 0.1 + (k * (px1 - px0 - 0.2)) / 8, 0.6, M.gateZ], color: dark });
  // the sliding gate: slatted dark steel, slid open behind the wall to the left of the driveway
  for (let k = 0; k < 14; k++) S.push({ size: [gx1 - gx0 - 0.4, 0.05, 0.04], pos: [gx0 - (gx1 - gx0) / 2 + 0.1, 0.15 + k * 0.095, M.gateZ - 0.2], color: dark });
  // the house number
  S.push({ size: [0.5, 0.3, 0.04], pos: [px1 + 0.6, 1.0, M.gateZ + 0.13], color: "#d4a017" });
}


/* ------------------------------------------------------------------ pastel dream */

/**
 * Pastel dream: a blush-pink two-storey with white trim and a rose gable roof, a front bay with a heart in its
 * gable, white-framed windows with rose shutters and flower boxes, a pink-and-white striped awning with a
 * scalloped edge over the white door, a heart-shaped flower bed and two cherry trees in blossom, a white picket
 * fence on a pink base with a rose arch over the garden gate.
 */
function pastel(t: Town): void {
  const S = t.solid, M = MANSION, F = M.front, gz = M.gateZ;
  const { hx0, hx1, hcx, hw, d, cz, px0, px1, doorX, gx0, gx1, gcx, gw, gd, gcz, gFront } = K;
  const pink = "#f6c3cf", blush = "#fbdce3", white = "#fffdfb", rose = "#f4b0c2", deep = "#d6336c", leaf = "#5e9b58";
  const FLOWERS = ["#f472b6", "#ffffff", "#fb7185", "#fde047", "#c084fc"];
  grounds(S, "#8cc07a", "#efe4de", "#f8d3dc");
  const G = 2.9, U = 2.5, base = G - 0.1, top = base + U, uF = F - 0.5;
  // downstairs blush pink, upstairs paler and set back; white corner boards and a white band between floors
  S.push({ size: [hw, G, d], pos: [hcx, G / 2 - 0.1, cz], color: pink });
  S.push({ size: [hw - 0.3, U, d - 0.5], pos: [hcx, base + U / 2, cz - 0.25], color: blush });
  S.push({ size: [hw + 0.14, 0.18, d + 0.14], pos: [hcx, base, cz], color: white });
  S.push({ size: [hw + 0.06, 0.22, d + 0.06], pos: [hcx, 0.0, cz], color: white });
  for (const x of [hx0 + 0.06, hx1 - 0.06]) S.push({ size: [0.18, G - 0.2, 0.18], pos: [x, G / 2 - 0.2, F + 0.02], color: white });
  for (const x of [hx0 + 0.2, hx1 - 0.2]) S.push({ size: [0.16, U, 0.16], pos: [x, base + U / 2, uF + 0.02], color: white });
  // the bay over the door steps forward, under its own little gable with a heart in a round white window
  const bw = 2.6, bayF = uF + 0.8;
  S.push({ size: [bw, U, 0.9], pos: [doorX, base + U / 2, uF + 0.35], color: blush });
  S.push({ size: [bw + 0.1, 0.14, 0.95], pos: [doorX, base + 0.02, uF + 0.35], color: white });
  // the roofs: rose gables with white fascia and ridge
  S.push({ shape: "gable", size: [hw + 0.3, 1.1, d + 0.1], pos: [hcx, top, cz - 0.25], color: rose });
  S.push({ size: [hw + 0.34, 0.1, d + 0.14], pos: [hcx, top - 0.02, cz - 0.25], color: white });
  S.push({ size: [hw + 0.32, 0.07, 0.14], pos: [hcx, top + 1.09, cz - 0.25], color: white });
  S.push({ shape: "gable", size: [1.6, 0.95, bw + 0.3], pos: [doorX, top, bayF - 0.7], rotY: Math.PI / 2, color: rose });
  const pitch = Math.atan2(0.95, (bw + 0.3) / 2), barge = Math.hypot(0.95, (bw + 0.3) / 2);
  for (const side of [-1, 1]) S.push({ size: [barge, 0.08, 0.08], pos: [doorX + (side * (bw + 0.3)) / 4, top + 0.47, bayF + 0.12], rot: [0, 0, -side * pitch], color: white });
  S.push({ shape: "cyl", size: [0.28, 0.04, 16], pos: [doorX, top + 0.33, bayF + 0.12], rot: [Math.PI / 2, 0, 0], color: white });
  heart(S, doorX, top + 0.3, bayF + 0.15, 0.36, deep);

  // windows: white frames and cross bars, rose shutters, a flower box under each
  const flowerBox = (x: number, y: number, z: number, w: number) => {
    S.push({ size: [w + 0.2, 0.22, 0.28], pos: [x, y, z + 0.14], color: white });
    S.push({ size: [w + 0.1, 0.08, 0.22], pos: [x, y + 0.13, z + 0.14], color: leaf });
    for (let k = 0; k < 6; k++) S.push({ size: [0.14, 0.14, 0.14], pos: [x - w / 2 + ((k + 0.5) * w) / 6, y + 0.19, z + 0.14 + (k % 2 ? 0.05 : -0.04)], color: FLOWERS[k % FLOWERS.length] });
  };
  const win = (x: number, y: number, z: number, w: number, h: number) => {
    t.homeWins.push({ x, y, z: z + 0.01, w, h });
    frame(S, x, y, z + 0.02, w, h, white);
    grid(S, x, y, z + 0.03, w, h, 2, 2, white, 0.05);
    shutters(S, x, y, z + 0.01, w, h, rose);
    flowerBox(x, y - h / 2 - 0.16, z, w);
  };
  for (const x of [hx0 + 4.7, hx0 + 7.5]) win(x, 1.35, F + 0.03, 1.4, 1.3);
  for (const x of [hx0 + 5.3, hx0 + 7.9]) win(x, base + 1.2, uF + 0.03, 1.1, 1.1);
  win(doorX, base + 1.2, bayF + 0.03, 1.2, 1.1);
  t.homeWins.push({ x: hx1 - 0.11, y: base + 1.2, z: cz - 0.25, w: 2.0, h: 1.0, face: "x" });

  // the white door with blush panels and a heart, the porch light, the striped awning with its scallops
  S.push({ size: [1.0, 2.15, 0.08], pos: [doorX, 0.97, F + 0.04], color: white });
  S.push({ size: [0.7, 0.75, 0.02], pos: [doorX, 0.55, F + 0.09], color: blush });
  heart(S, doorX, 1.5, F + 0.1, 0.34, deep);
  S.push({ size: [0.06, 0.06, 0.08], pos: [doorX + 0.36, 1.0, F + 0.1], color: "#e9b949" });
  t.homeWins.push({ x: doorX + 0.8, y: 1.95, z: F + 0.05, w: 0.16, h: 0.22 });
  for (let k = 0; k < 8; k++) {
    const x = doorX - 0.875 + k * 0.25, c = k % 2 ? white : rose;
    S.push({ size: [0.25, 0.04, 0.9], pos: [x, 2.45, F + 0.42], rot: [0.38, 0, 0], color: c });
    S.push({ shape: "cyl", size: [0.125, 0.03, 10], pos: [x, 2.23, F + 0.85], rot: [Math.PI / 2, 0, 0], color: c });
  }
  S.push({ size: [2.0, 0.12, 0.7], pos: [doorX, -0.04, F + 0.35], color: white });
  for (const dx of [-0.85, 0.85]) {
    S.push({ shape: "cyl", size: [0.18, 0.35, 10], pos: [doorX + dx, 0.08, F + 0.3], color: white });
    S.push({ shape: "cyl", size: [0.26, 0.45, 10], pos: [doorX + dx, 0.5, F + 0.3], color: leaf });
  }
  // a flower bed along the front, a heart-shaped one in the lawn, two cherry trees in blossom
  const bx0 = hx0 + 3.4, bx1 = hx1 - 0.2;
  S.push({ size: [bx1 - bx0, 0.3, 0.45], pos: [(bx0 + bx1) / 2, 0.05, F + 0.3], color: leaf });
  for (let k = 0; k < 12; k++) S.push({ size: [0.16, 0.16, 0.16], pos: [bx0 + 0.25 + (k * (bx1 - bx0 - 0.5)) / 11, 0.25, F + 0.3 + (k % 2 ? 0.1 : -0.08)], color: FLOWERS[k % FLOWERS.length] });
  heartBed(S, 13.4, gz - 1.45, 1.6, "#fbcfe8");
  heartBed(S, 13.4, gz - 1.45, 1.05, "#ec4899", -0.06);
  const blossom = ["#f9a8d4", "#fbcfe8", "#f472b6", "#fce7f3"];
  bushyTree(S, M.x0 + 0.7, gz - 0.9, 2.2, 0.85, blossom, "#7a4b3a");
  bushyTree(S, hx1 - 0.9, gz - 0.95, 2.0, 0.75, blossom, "#7a4b3a");

  // the garage: pink, white header with a rose stripe, its own rose gable with a heart
  garage(t, { wall: pink, header: white, slab: white, h: 2.8 });
  S.push({ size: [gw - 0.2, 0.1, 0.02], pos: [gcx, 2.43, gFront + 0.06], color: rose });
  S.push({ shape: "gable", size: [gd + 0.3, 0.9, gw + 0.4], pos: [gcx, 2.78, gcz], rotY: Math.PI / 2, color: rose });
  heart(S, gcx, 3.12, gFront + 0.17, 0.42, deep);

  // the picket fence on a pink base; pink pillars with white caps and lamps, hearts by the driveway
  for (const [a, b] of RUNS) {
    if (b - a < 0.05) continue;
    S.push({ size: [b - a, 0.35, 0.26], pos: [(a + b) / 2, 0.07, gz], color: pink });
    for (const y of [0.55, 1.0]) S.push({ size: [b - a, 0.06, 0.05], pos: [(a + b) / 2, y, gz + 0.06], color: white });
    const n = Math.max(1, Math.floor((b - a) / 0.22));
    for (let i = 0; i < n; i++) {
      const x = a + ((i + 0.5) * (b - a)) / n;
      S.push({ size: [0.1, 0.85, 0.04], pos: [x, 0.65, gz + 0.1], color: white });
      S.push({ size: [0.07, 0.07, 0.04], pos: [x, 1.08, gz + 0.1], rot: [0, 0, Math.PI / 4], color: white });
    }
  }
  for (const x of POSTS) {
    S.push({ size: [0.36, 1.5, 0.36], pos: [x, 0.65, gz], color: pink });
    S.push({ size: [0.44, 0.1, 0.44], pos: [x, 1.42, gz], color: white });
    if (x !== px0 && x !== px1) t.homeWins.push({ x, y: 1.58, z: gz + 0.19, w: 0.2, h: 0.14 });
  }
  for (const x of [gx0, gx1]) heart(S, x, 0.9, gz + 0.19, 0.3, deep);
  footGate(S, white, 1.05);
  slidingGate(S, white, 1.1);
  // the rose arch over the garden gate: a white trellis hoop covered in leaves and roses
  const ax = (px0 + px1) / 2, R = (px1 - px0) / 2, ay = 2.2, ROSES = [deep, "#f472b6", "#fda4af"];
  for (const x of [px0, px1]) S.push({ size: [0.1, ay, 0.1], pos: [x, ay / 2 - 0.05, gz], color: white });
  for (let k = 0; k <= 6; k++) {
    const a = (Math.PI * k) / 6;
    S.push({ size: [0.3, 0.1, 0.12], pos: [ax + R * Math.cos(a), ay + R * Math.sin(a), gz], rot: [0, 0, a + Math.PI / 2], color: white });
  }
  for (let k = 0; k <= 8; k++) {
    const a = (Math.PI * k) / 8;
    S.push({ size: [0.24, 0.2, 0.22], pos: [ax + R * Math.cos(a), ay + R * Math.sin(a), gz], rot: [0, 0, a], color: leaf });
    S.push({ size: [0.13, 0.13, 0.13], pos: [ax + (R + 0.08) * Math.cos(a), ay + (R + 0.08) * Math.sin(a), gz + 0.1], color: ROSES[k % 3] });
  }
  for (const y of [1.65, 1.95]) for (const x of [px0, px1]) {
    S.push({ size: [0.22, 0.24, 0.24], pos: [x, y, gz], color: leaf });
    S.push({ size: [0.13, 0.13, 0.13], pos: [x, y + 0.05, gz + 0.13], color: ROSES[(Math.round(y * 10) + Math.round(x)) % 3] });
  }
  // the pink letterbox inside the gate
  S.push({ size: [0.07, 1.0, 0.07], pos: [px1 + 0.5, 0.4, gz - 0.4], color: white });
  S.push({ size: [0.3, 0.26, 0.42], pos: [px1 + 0.5, 0.98, gz - 0.4], color: deep });
}

/* ------------------------------------------------------------------ bahay na bato */

/**
 * Bahay na bato, the Filipino colonial house: a ground floor of adobe stone with an arched wooden zaguan door
 * and small grilled windows; a wooden upper floor that overhangs the front on carved brackets, with a row of
 * sliding capiz windows (half slid open) over ventanillas with balusters; a dark tiled hip roof. A stone wall
 * capped with tiles and bougainvillea, a mango tree, santan bushes, clay jars by the door and a cart wheel.
 */
function heritage(t: Town): void {
  const S = t.solid, M = MANSION, F = M.front, gz = M.gateZ;
  const { hx0, hx1, hcx, hw, d, cz, doorX, gcx, gw, gd, gcz } = K;
  const stone = "#cdb998", stoneLt = "#ddd0b4", stoneDk = "#ad9878", wood = "#a86c40", woodDk = "#73472b", baluster = "#d6b88c";
  const capiz = "#f3ead6", roof = "#b06a58", roofDk = "#8f5444", iron = "#2a2a2a";
  grounds(S, "#7fa36a", "#b9ab92", "#c8b89c");
  const G = 2.6, base = G - 0.1;
  // the stone ground floor (the "bato"), its blocks picked out lighter and darker, on a darker plinth
  S.push({ size: [hw, G, d], pos: [hcx, G / 2 - 0.1, cz], color: stone });
  S.push({ size: [hw + 0.06, 0.32, d + 0.06], pos: [hcx, 0.06, cz], color: stoneDk });
  const r = rnd(41);
  for (let row = 0; row < 5; row++) for (let col = 0; col < 14; col++) {
    const x = hx0 + 0.35 + col * 0.68 + (row % 2) * 0.34;
    if (r() < 0.55 || x > hx1 - 0.35) continue;
    S.push({ size: [0.6, 0.34, 0.03], pos: [x, 0.45 + row * 0.42, F + 0.015], color: r() < 0.5 ? stoneLt : stoneDk });
  }
  // the zaguan: an arched double door of dark wood in a pale stone surround with a keystone
  S.push({ size: [1.6, 1.5, 0.03], pos: [doorX, 0.65, F + 0.03], color: stoneLt });
  S.push({ shape: "cyl", size: [0.8, 0.03, 18], pos: [doorX, 1.4, F + 0.03], rot: [Math.PI / 2, 0, 0], color: stoneLt });
  S.push({ size: [1.3, 1.5, 0.06], pos: [doorX, 0.65, F + 0.05], color: wood });
  S.push({ shape: "cyl", size: [0.65, 0.06, 18], pos: [doorX, 1.4, F + 0.05], rot: [Math.PI / 2, 0, 0], color: wood });
  S.push({ size: [0.04, 2.1, 0.07], pos: [doorX, 0.95, F + 0.07], color: woodDk });
  S.push({ size: [0.26, 0.3, 0.06], pos: [doorX, 2.18, F + 0.05], color: stoneDk });
  for (const dx of [-0.35, 0.35]) for (const y of [0.4, 0.9, 1.4]) S.push({ size: [0.06, 0.06, 0.04], pos: [doorX + dx, y, F + 0.09], color: iron });
  // small windows below, each behind an iron grill with a stone sill and lintel
  for (const x of [hx0 + 5.0, hx0 + 7.8]) {
    t.homeWins.push({ x, y: 1.3, z: F + 0.04, w: 1.0, h: 0.9 });
    grid(S, x, 1.3, F + 0.08, 1.0, 0.9, 5, 2, iron, 0.03);
    S.push({ size: [1.3, 0.1, 0.14], pos: [x, 0.8, F + 0.07], color: stoneLt }, { size: [1.3, 0.14, 0.08], pos: [x, 1.82, F + 0.05], color: stoneLt });
  }
  // the farol by the door, clay jars either side of it
  S.push({ size: [0.04, 0.04, 0.25], pos: [doorX + 1.0, 2.05, F + 0.12], color: iron });
  t.homeWins.push({ x: doorX + 1.0, y: 1.85, z: F + 0.25, w: 0.2, h: 0.28 });
  for (const dx of [-1.1, 1.25]) {
    S.push({ shape: "cyl", size: [0.2, 0.45, 9], pos: [doorX + dx, 0.12, F + 0.3], color: "#a0522d" });
    S.push({ shape: "cyl", size: [0.13, 0.08, 9], pos: [doorX + dx, 0.38, F + 0.3], color: "#8b4513" });
  }

  // the wooden upper floor (the "bahay"): overhangs the front 0.9 m on a beam and carved brackets
  const U = 2.5, ub = base + 0.22, uF = F + 0.9, ucz = cz + 0.45;
  S.push({ size: [hw + 0.3, 0.22, d + 1.0], pos: [hcx, base + 0.11, ucz], color: woodDk });
  S.push({ size: [hw + 0.2, U, d + 0.9], pos: [hcx, ub + U / 2, ucz], color: wood });
  S.push({ size: [hw + 0.24, 0.14, d + 0.94], pos: [hcx, ub + U - 0.07, ucz], color: woodDk });
  for (const x of [hx0 + 0.35, hx0 + 3.5, hx0 + 6.4, hx1 - 0.35]) S.push({ size: [0.14, 0.97, 0.14], pos: [x, 2.2, F + 0.4], rot: [0.97, 0, 0], color: woodDk });
  // capiz windows: a frame each, one half slid shut (pale shell panes in a wooden grid), the other open
  const ww = 1.8, wh = 1.25, wy = ub + 1.45;
  for (let i = 0; i < 4; i++) {
    const x = hx0 + 1.3 + (i * (hw - 2.6)) / 3, side = i % 2 ? 1 : -1;
    const xo = x + (side * ww) / 4, xc = x - (side * ww) / 4;
    frame(S, x, wy, uF + 0.03, ww, wh, woodDk, 0.09);
    t.homeWins.push({ x: xo, y: wy, z: uF + 0.02, w: ww / 2, h: wh });
    S.push({ size: [ww / 2, wh, 0.04], pos: [xc, wy, uF + 0.03], color: capiz });
    grid(S, xc, wy, uF + 0.06, ww / 2, wh, 3, 4, woodDk, 0.03);
    // the ventanilla below: a dark opening behind turned balusters
    S.push({ size: [ww, 0.45, 0.04], pos: [x, ub + 0.5, uF + 0.02], color: woodDk });
    for (let k = 0; k < 6; k++) S.push({ size: [0.05, 0.4, 0.05], pos: [x - ww / 2 + 0.15 + (k * (ww - 0.3)) / 5, ub + 0.5, uF + 0.05], color: baluster });
  }
  // a capiz window on the +x side too
  const sx = hx1 + 0.1;
  t.homeWins.push({ x: sx + 0.02, y: wy, z: ucz + 0.9, w: 0.9, h: wh, face: "x" });
  S.push({ size: [0.04, wh, 0.9], pos: [sx + 0.03, wy, ucz], color: capiz });
  for (const dz of [-0.15, 0.15]) S.push({ size: [0.03, wh, 0.03], pos: [sx + 0.06, wy, ucz + dz], color: woodDk });
  for (const dy of [-0.31, 0, 0.31]) S.push({ size: [0.03, 0.03, 0.9], pos: [sx + 0.06, wy + dy, ucz], color: woodDk });
  // the hip roof of dark clay tiles
  const ry = ub + U, rw = hw + 1.6, rd = d + 2.3;
  S.push({ shape: "hip", size: [rw, 1.25, rd], pos: [hcx, ry, ucz], color: roof });
  S.push({ size: [rw + 0.02, 0.1, rd + 0.02], pos: [hcx, ry - 0.02, ucz], color: woodDk });
  S.push({ size: [rw - rd + 0.05, 0.08, 0.14], pos: [hcx, ry + 1.25, ucz], color: roofDk });
  tileRows(S, hcx, ry, ucz, rw, 1.25, rd, 4, roofDk);

  // the garage: stone, a heavy timber lintel, a little hip roof of its own
  garage(t, { wall: stone, header: woodDk, slab: woodDk, floor: "#8a7d6a", h: 2.7 });
  S.push({ shape: "hip", size: [gd + 0.6, 0.9, gw + 0.6], pos: [gcx, 2.68, gcz], rotY: Math.PI / 2, color: roof });

  // the stone wall with a tiled coping, finials, lamps, wrought-iron gates, bougainvillea spilling over
  streetWall(t, { h: 1.6, wall: stone, pillar: stoneDk, cap: roof, thick: 0.3 });
  for (const [a, b] of RUNS) if (b - a > 0.05) S.push({ size: [b - a, 0.1, 0.42], pos: [(a + b) / 2, 1.53, gz], color: roof });
  for (const x of POSTS) {
    S.push({ shape: "cyl", size: [0.13, 0.28, 8], pos: [x, 1.95, gz], color: stoneLt });
    t.homeWins.push({ x, y: 1.2, z: gz + 0.21, w: 0.16, h: 0.22 });
  }
  footGate(S, iron, 1.5);
  slidingGate(S, iron, 1.3);
  const BOUG = ["#d946ef", "#ec4899", "#db2777"];
  for (let k = 0; k < 7; k++) {
    const x = K.px1 + 0.6 + k * 0.95;
    S.push({ size: [0.45, 0.24, 0.36], pos: [x, 1.7, gz - 0.05], rotY: k * 0.5, color: k % 3 ? BOUG[k % 3] : "#3f7d4a" });
    if (k % 2) S.push({ size: [0.35, 0.35, 0.12], pos: [x + 0.2, 1.35, gz + 0.2], color: BOUG[(k + 1) % 3] });
  }
  // a mango tree, santan bushes along the front, a carabao-cart wheel leaning on the wall
  bushyTree(S, M.x0 + 0.9, gz - 1.1, 2.0, 1.05, ["#2f6b3a", "#3c7d45", "#2a5e34"]);
  for (let k = 0; k < 5; k++) shrub(S, hx0 + 3.8 + k * 1.3, F + 0.35, 0.3, "#3f7d4a", "#f05a28");
  const wx = 16.3, wy0 = 0.5, wz = gz - 0.3;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    S.push({ size: [0.28, 0.07, 0.07], pos: [wx + Math.cos(a) * 0.52, wy0 + Math.sin(a) * 0.52, wz], rot: [0, 0, a + Math.PI / 2], color: woodDk });
  }
  for (let k = 0; k < 4; k++) S.push({ size: [1.0, 0.05, 0.05], pos: [wx, wy0, wz], rot: [0, 0, (k * Math.PI) / 4], color: wood });
  S.push({ shape: "cyl", size: [0.1, 0.14, 8], pos: [wx, wy0, wz], rot: [Math.PI / 2, 0, 0], color: woodDk });
}

/* ------------------------------------------------------------------ mediterranean */

/**
 * Mediterranean villa: white stucco under a terracotta hip roof with rows of tiles and a chimney, an arcade of
 * four arches across the front carrying a roof terrace, arched French windows and a blue arched door behind
 * it; upstairs tall windows with blue shutters and red geraniums. A white wall with a
 * tiled coping and an arched garden gate, olive trees, cypresses, lavender in terracotta pots, bougainvillea.
 */
function mediterranean(t: Town): void {
  const S = t.solid, M = MANSION, F = M.front, gz = M.gateZ;
  const { hx0, hx1, hcx, hw, d, cz, px0, px1, doorX, gcx, gw, gd, gcz, gFront } = K;
  const white = "#f6f2ea", terra = "#e3956a", terraDk = "#c97a52", blue = "#1f5fa8", sky = "#4f8fd1", iron = "#2b2f33";
  const OLIVE = ["#8c9a63", "#9aa874", "#7d8b56"];
  grounds(S, "#9cb070", "#e6d6b8", "#d8c29b");
  const G = 2.9, U = 2.6, base = G - 0.1, top = base + U;
  S.push({ size: [hw, G + U, d], pos: [hcx, (G + U) / 2 - 0.1, cz], color: white });
  S.push({ size: [hw + 0.1, 0.14, d + 0.1], pos: [hcx, base, cz], color: white });
  S.push({ size: [hw + 0.04, 0.12, d + 0.04], pos: [hcx, base - 0.18, cz], color: sky });
  // the arcade: five piers, a beam, arches, a roof terrace over it with a parapet, a tiled floor
  const az = F + 1.0, ax0 = hx0 + 1.2, ax1 = hx1 - 0.2, n = 4, pier = 0.4;
  const span = (ax1 - ax0 - pier) / n;
  for (let k = 0; k <= n; k++) S.push({ size: [pier, 2.4, pier], pos: [ax0 + pier / 2 + k * span, 1.1, az], color: white });
  S.push({ size: [ax1 - ax0, 0.5, pier], pos: [(ax0 + ax1) / 2, 2.55, az], color: white });
  for (let k = 0; k < n; k++) arch(S, ax0 + pier / 2 + (k + 0.5) * span, (span - pier) / 2, 1.7, 0.6, az, pier, white);
  S.push({ size: [ax1 - ax0, 0.12, 1.2], pos: [(ax0 + ax1) / 2, 2.84, F + 0.6], color: white });
  S.push({ size: [ax1 - ax0, 0.5, 0.14], pos: [(ax0 + ax1) / 2, 3.15, az + 0.13], color: white });
  S.push({ size: [ax1 - ax0 + 0.04, 0.07, 0.2], pos: [(ax0 + ax1) / 2, 3.43, az + 0.13], color: terra });
  for (const dx of [0.4, ax1 - ax0 - 0.4]) S.push({ size: [0.18, 0.5, 0.14], pos: [ax0 + dx, 3.15, az + 0.03], color: sky });
  S.push({ size: [ax1 - ax0, 0.05, 1.2], pos: [(ax0 + ax1) / 2, -0.06, F + 0.55], color: "#d98b5f" });
  // behind it: the blue arched door and arched French windows (arch fillers over the glow)
  S.push({ size: [1.0, 1.8, 0.06], pos: [doorX, 0.8, F + 0.04], color: blue });
  S.push({ shape: "cyl", size: [0.5, 0.06, 16], pos: [doorX, 1.7, F + 0.04], rot: [Math.PI / 2, 0, 0], color: blue });
  S.push({ size: [0.06, 0.06, 0.08], pos: [doorX + 0.35, 1.0, F + 0.08], color: "#d4a017" });
  for (let k = 1; k < n; k++) {
    const x = ax0 + pier / 2 + (k + 0.5) * span;
    t.homeWins.push({ x, y: 1.05, z: F + 0.04, w: 1.0, h: 2.2 });
    arch(S, x, 0.5, 1.65, 0.5, F + 0.05, 0.04, white, 3);
    S.push({ size: [0.04, 2.1, 0.05], pos: [x, 1.0, F + 0.06], color: white });
  }
  // lavender in terracotta pots in front of the piers
  for (let k = 1; k < n; k++) {
    const x = ax0 + pier / 2 + k * span;
    S.push({ shape: "cyl", size: [0.2, 0.35, 9], pos: [x, 0.08, az + 0.45], color: terra });
    S.push({ shape: "cyl", size: [0.22, 0.28, 8], pos: [x, 0.38, az + 0.45], color: "#8b6fc6" });
  }
  // upstairs: tall windows with blue shutters onto the terrace, geraniums on the parapet and the sills
  const uy = base + 1.35;
  for (let k = 0; k < 4; k++) {
    const x = hx0 + 1.3 + k * ((hw - 2.6) / 3);
    t.homeWins.push({ x, y: uy, z: F + 0.04, w: 0.9, h: 1.3 });
    shutters(S, x, uy, F + 0.05, 0.9, 1.3, blue);
    S.push({ size: [1.1, 0.08, 0.14], pos: [x, uy - 0.69, F + 0.07], color: white });
    S.push({ size: [1.0, 0.18, 0.22], pos: [x, uy - 0.6, F + 0.15], color: terra });
    for (let j = 0; j < 4; j++) S.push({ size: [0.16, 0.14, 0.16], pos: [x - 0.36 + j * 0.24, uy - 0.45, F + 0.15], color: j % 2 ? "#dc2626" : "#3f7d4a" });
    if (k > 0) {
      S.push({ shape: "cyl", size: [0.16, 0.26, 8], pos: [x, 3.6, az + 0.13], color: terra });
      S.push({ shape: "cyl", size: [0.2, 0.2, 8], pos: [x, 3.8, az + 0.13], color: k % 2 ? "#dc2626" : "#ec4899" });
    }
  }
  t.homeWins.push({ x: hx1 + 0.04, y: uy, z: cz, w: 1.0, h: 1.3, face: "x" });
  for (const dz of [-0.71, 0.71]) S.push({ size: [0.05, 1.3, 0.42], pos: [hx1 + 0.05, uy, cz + dz], color: blue });
  // the terracotta hip roof, its tile rows, ridge, a white cornice and the chimney
  const rw = hw + 0.8, rd = d + 0.8;
  S.push({ size: [rw + 0.04, 0.12, rd + 0.04], pos: [hcx, top - 0.02, cz], color: white });
  S.push({ shape: "hip", size: [rw, 1.0, rd], pos: [hcx, top, cz], color: terra });
  S.push({ size: [rw - rd + 0.05, 0.08, 0.14], pos: [hcx, top + 1.0, cz], color: terraDk });
  tileRows(S, hcx, top, cz, rw, 1.0, rd, 4, terraDk);
  S.push({ size: [0.5, 0.9, 0.5], pos: [hx0 + 2.0, top + 0.55, cz - 1.2], color: white });
  S.push({ size: [0.65, 0.1, 0.65], pos: [hx0 + 2.0, top + 1.05, cz - 1.2], color: terraDk });

  // the garage: white, a segmental arch over the opening (high above the car), a terracotta hip roof
  garage(t, { wall: white, header: white, slab: white, floor: "#b8a68e", h: 2.9 });
  arch(S, gcx, (gw - 0.4) / 2, 1.95, 0.35, gFront - 0.1, 0.3, white, 3);
  S.push({ shape: "hip", size: [gd + 0.5, 0.8, gw + 0.5], pos: [gcx, 2.9, gcz], rotY: Math.PI / 2, color: terra });

  // the white wall: terracotta coping, an arched gate with a blue door, blue-and-white tile number
  streetWall(t, { h: 1.15, wall: white, pillar: white, cap: terra, lamps: true });
  for (const [a, b] of RUNS) if (b - a > 0.05) S.push({ size: [b - a, 0.09, 0.34], pos: [(a + b) / 2, 1.09, gz], color: terra });
  const gcx2 = (px0 + px1) / 2;
  for (const x of [px0, px1]) S.push({ size: [0.4, 2.6, 0.4], pos: [x, 1.2, gz], color: white });
  S.push({ size: [px1 - px0 + 0.4, 0.35, 0.36], pos: [gcx2, 2.45, gz], color: white });
  S.push({ size: [px1 - px0 + 0.5, 0.1, 0.44], pos: [gcx2, 2.66, gz], color: terra });
  arch(S, gcx2, (px1 - px0 - 0.4) / 2, 1.95, 0.3, gz, 0.3, white, 3);
  footGate(S, blue, 1.4);
  slidingGate(S, iron, 1.0);
  S.push({ size: [0.45, 0.3, 0.03], pos: [px1 + 0.6, 1.0, gz + 0.13], color: white }, { size: [0.37, 0.22, 0.02], pos: [px1 + 0.6, 1.0, gz + 0.15], color: sky });
  for (let k = 0; k < 5; k++) S.push({ size: [0.5, 0.28, 0.4], pos: [px1 + 1.4 + k * 1.2, 1.25, gz - 0.05], rotY: k * 0.6, color: k % 2 ? "#ec4899" : "#d946ef" });
  // olive trees (gnarled trunks, silvery canopies) and dark cypresses
  const olive = (x: number, z: number) => {
    S.push({ size: [0.16, 1.2, 0.16], pos: [x, 0.5, z], rot: [0, 0, 0.25], color: "#6b5b45" });
    S.push({ size: [0.11, 0.8, 0.11], pos: [x - 0.25, 1.15, z], rot: [0.2, 0, -0.45], color: "#6b5b45" });
    blob(S, x - 0.1, 1.7, z, 0.62, OLIVE);
  };
  olive(M.x0 + 0.8, gz - 1.0);
  olive(14.6, gz - 1.5);
  for (const [x, z] of [[16.6, gz - 0.6], [12.4, gz - 0.6]] as const) S.push({ shape: "cone", size: [0.34, 2.9, 7], pos: [x, 1.35, z], color: "#2f4a2a" });
}

/* ------------------------------------------------------------------ tropical resort */

/**
 * Tropical resort: a stone ground floor with a wall of glass and a pivoting timber door, a wooden upper floor
 * with slats and a long window, two tiers of big dark hip roofs with deep eaves on timber posts (the lower one
 * wraps the lanai). In the front lawn a small pool with a stone coping, two loungers and a parasol, tiki torches
 * and palms; a low stone-and-timber wall so the pool shows from the street.
 */
function tropical(t: Town): void {
  const S = t.solid, M = MANSION, F = M.front, B = M.back, gz = M.gateZ;
  const { hx0, hx1, hcx, hw, d, cz, doorX, gcx, gw, gd, gcz } = K;
  const stone = "#aaa396", stoneDk = "#8a8377", wood = "#b07a4a", woodDk = "#7a5232", woodLt = "#d2aa7a";
  const roof = "#a88458", roofLt = "#c29f74", cream = "#f5f0e6";
  grounds(S, "#6aa457", "#b8b0a3", "#cdbfa8");
  const G = 3.0, base = G - 0.1;
  // the stone ground floor with its plinth, the glass wall, the pivot door, a timber deck in front
  S.push({ size: [hw, G, d], pos: [hcx, G / 2 - 0.1, cz], color: stone });
  S.push({ size: [hw + 0.04, 0.35, d + 0.04], pos: [hcx, 0.07, cz], color: stoneDk });
  t.homeWins.push({ x: hcx + 1.2, y: 1.35, z: F + 0.04, w: hw - 3.8, h: 2.2 });
  for (let k = 0; k <= 4; k++) S.push({ size: [0.07, 2.3, 0.07], pos: [hcx + 1.2 - (hw - 3.8) / 2 + (k * (hw - 3.8)) / 4, 1.35, F + 0.05], color: woodDk });
  S.push({ size: [1.2, 2.5, 0.08], pos: [doorX, 1.15, F + 0.04], color: wood });
  for (const dx of [-0.3, 0, 0.3]) S.push({ size: [0.03, 2.4, 0.03], pos: [doorX + dx, 1.15, F + 0.09], color: woodDk });
  S.push({ size: [hw - 0.4, 0.12, 1.0], pos: [hcx, -0.02, F + 0.5], color: woodLt });
  // the lower roof: a wide hip over the lanai on timber posts with stone footings
  const lw = hw + 0.7, lcx = hcx - 0.2, ld = d + 2.0, lcz = cz + 0.5;
  S.push({ shape: "hip", size: [lw, 0.85, ld], pos: [lcx, base, lcz], color: roof });
  S.push({ size: [lw + 0.02, 0.1, ld + 0.02], pos: [lcx, base - 0.02, lcz], color: woodDk });
  tileRows(S, lcx, base, lcz, lw, 0.85, ld, 2, roofLt);
  for (const x of [hx0 + 0.15, 12.0, hx1 - 0.3]) {
    S.push({ size: [0.18, 2.9, 0.18], pos: [x, 1.35, F + 0.95], color: woodDk });
    S.push({ size: [0.32, 0.3, 0.32], pos: [x, 0.05, F + 0.95], color: stoneDk });
  }
  // the timber upper floor: slats on the left, a long window, its own big hip roof
  const ux0 = 9.4, ux1 = hx1 - 0.2, ucx = (ux0 + ux1) / 2, uz0 = B + 0.2, uz1 = F - 0.4, ucz = (uz0 + uz1) / 2, U = 2.3;
  S.push({ size: [ux1 - ux0, U, uz1 - uz0], pos: [ucx, base + U / 2, ucz], color: wood });
  for (let k = 0; k < 8; k++) S.push({ size: [0.05, U - 0.2, 0.04], pos: [ux0 + 0.15 + k * 0.24, base + U / 2, uz1 + 0.03], color: woodDk });
  const wx = (ux0 + 2.2 + ux1 - 0.3) / 2, ww = ux1 - 0.3 - (ux0 + 2.2);
  t.homeWins.push({ x: wx, y: base + 1.25, z: uz1 + 0.04, w: ww, h: 1.4 });
  for (let k = 1; k < 4; k++) S.push({ size: [0.06, 1.45, 0.06], pos: [wx - ww / 2 + (k * ww) / 4, base + 1.25, uz1 + 0.05], color: woodDk });
  t.homeWins.push({ x: ux1 + 0.04, y: base + 1.2, z: ucz, w: 2.4, h: 1.2, face: "x" });
  const rw = ux1 - ux0 + 2.6, rd = 6.6, rz = cz + 0.2, ry = base + U;
  S.push({ shape: "hip", size: [rw, 1.2, rd], pos: [ucx, ry, rz], color: roof });
  S.push({ size: [rw + 0.02, 0.1, rd + 0.02], pos: [ucx, ry - 0.02, rz], color: woodDk });
  S.push({ size: [rw - rd + 0.05, 0.1, 0.16], pos: [ucx, ry + 1.2, rz], color: roofLt });
  tileRows(S, ucx, ry, rz, rw, 1.2, rd, 3, roofLt);

  // the pool in the front lawn: stone coping, blue water with a shimmer, two loungers and a parasol
  const pcx = 14.5, pcz = gz - 1.15;
  S.push({ size: [4.4, 0.1, 1.4], pos: [pcx, -0.05, pcz], color: "#e8e1d2" });
  S.push({ size: [4.0, 0.03, 1.0], pos: [pcx, 0.015, pcz], color: "#4cc6e6" });
  for (const [dx, dz, w] of [[-1.0, -0.25, 1.2], [0.6, 0.1, 1.5], [-0.2, 0.3, 0.8]] as const) S.push({ size: [w, 0.01, 0.05], pos: [pcx + dx, 0.035, pcz + dz], color: "#9be3f5" });
  for (const x of [10.85, 11.7]) {
    S.push({ size: [0.62, 0.12, 1.7], pos: [x, 0.15, gz - 1.05], color: woodLt });
    S.push({ size: [0.56, 0.06, 1.1], pos: [x, 0.24, gz - 0.8], color: cream });
    S.push({ size: [0.56, 0.08, 0.6], pos: [x, 0.42, gz - 1.72], rot: [0.6, 0, 0], color: cream });
  }
  S.push({ size: [0.05, 2.1, 0.05], pos: [11.28, 0.95, gz - 0.45], color: woodDk });
  S.push({ shape: "cone", size: [0.75, 0.3, 8], pos: [11.28, 2.1, gz - 0.45], color: cream });
  // tiki torches at the pool's corners, palms, big-leaf plants by the house
  for (const z of [gz - 0.42, gz - 1.85]) {
    S.push({ size: [0.06, 1.3, 0.06], pos: [12.1, 0.55, z], color: woodDk });
    t.homeWins.push({ x: 12.1, y: 1.32, z: z + 0.04, w: 0.12, h: 0.2 });
  }
  palm(S, M.x0 + 0.55, gz - 0.75, 3.7, 0.12);
  palm(S, 16.95, gz - 0.45, 3.3, 0.16);
  for (const x of [hx0 + 0.6, doorX + 1.0]) shrub(S, x, F + 0.35, 0.38, "#2f6b3a");

  // the garage: stone, a timber lintel, its own overhanging hip roof
  garage(t, { wall: stone, header: woodDk, slab: woodDk, floor: "#7a746a", h: 2.8 });
  S.push({ shape: "hip", size: [gd + 0.9, 0.8, gw + 0.7], pos: [gcx, 2.8, gcz + 0.2], rotY: Math.PI / 2, color: roof });

  // the wall, kept low so the pool shows: a stone base, one timber rail, stone pillars with lamps, timber gates
  for (const [a, b] of RUNS) {
    if (b - a < 0.05) continue;
    S.push({ size: [b - a, 0.6, 0.3], pos: [(a + b) / 2, 0.2, gz], color: stoneDk });
    S.push({ size: [b - a, 0.1, 0.1], pos: [(a + b) / 2, 0.85, gz], color: woodDk });
    for (let x = a + 0.4; x < b - 0.2; x += 0.8) S.push({ size: [0.08, 0.35, 0.08], pos: [x, 0.65, gz], color: woodDk });
  }
  for (const x of POSTS) {
    S.push({ size: [0.42, 1.2, 0.42], pos: [x, 0.5, gz], color: stone });
    S.push({ size: [0.5, 0.08, 0.5], pos: [x, 1.13, gz], color: stoneDk });
    t.homeWins.push({ x, y: 1.28, z: gz + 0.19, w: 0.2, h: 0.16 });
  }
  footGate(S, wood, 0.95);
  slidingGate(S, woodDk, 0.95);
}

/* ------------------------------------------------------------------ japandi */

/**
 * Japandi: a long low house in charred dark timber under a shallow gable with deep eaves over a light-wood
 * engawa, a wall of shoji-gridded glass, a light-wood door with a navy noren, a slatted screen; a smaller
 * light-wood upper volume at the back under its own low roof. In front a raked gravel garden with three rocks
 * on moss in raked rings, a stone lantern and a red maple; stepping stones to the door, bamboo by the wall.
 */
function japandi(t: Town): void {
  const S = t.solid, M = MANSION, F = M.front, B = M.back, gz = M.gateZ;
  const { hx0, hx1, hcx, hw, d, cz, doorX, gcx, gw, gd, gcz, gFront, px1 } = K;
  const char = "#625d56", char2 = "#77716a", wood = "#e8cfa8", woodMid = "#c9a674", roof = "#a9a69f";
  const gravel = "#e3dfd5", rake = "#c9c2b3", rock = "#5b5853", rock2 = "#7b776f", moss = "#5f7f45";
  grounds(S, "#7f9c69", "#8f8b84", "#a9a39a");
  const G = 3.0, base = G - 0.1;
  S.push({ size: [hw, G, d], pos: [hcx, G / 2 - 0.1, cz], color: char });
  // the glass wall with a shoji grid of light wood, the door with its noren, a slatted screen on the left
  const gx = (hx0 + 3.2 + hx1 - 0.4) / 2, gwid = hx1 - 0.4 - (hx0 + 3.2);
  t.homeWins.push({ x: gx, y: 1.25, z: F + 0.04, w: gwid, h: 2.1 });
  frame(S, gx, 1.25, F + 0.05, gwid, 2.1, wood, 0.08);
  grid(S, gx, 1.25, F + 0.06, gwid, 2.1, 8, 3, wood, 0.05);
  S.push({ size: [1.0, 2.2, 0.07], pos: [doorX, 1.0, F + 0.04], color: wood });
  for (const dx of [-0.255, 0.255]) S.push({ size: [0.48, 0.55, 0.02], pos: [doorX + dx, 1.85, F + 0.3], color: "#24324a" });
  S.push({ size: [1.1, 0.03, 0.03], pos: [doorX, 2.13, F + 0.3], color: woodMid });
  for (let k = 0; k < 9; k++) S.push({ size: [0.05, 2.8, 0.06], pos: [hx0 + 0.15 + k * 0.16, 1.3, F + 0.05], color: wood });
  // the engawa (a light-wood veranda), a stone step, slim posts under the deep eave
  S.push({ size: [hw - 0.2, 0.22, 1.0], pos: [hcx, 0.0, F + 0.5], color: wood });
  S.push({ size: [1.2, 0.12, 0.5], pos: [doorX, -0.05, F + 1.25], color: rock2 });
  for (const x of [hx0 + 0.1, hcx + 1.0, hx1 - 0.1]) S.push({ size: [0.1, 2.9, 0.1], pos: [x, 1.35, F + 1.15], color: char2 });
  // the low roof
  const rd = d + 2.0, rcz = cz + 0.3;
  S.push({ size: [hw + 1.42, 0.1, rd + 0.02], pos: [hcx, base - 0.02, rcz], color: char2 });
  S.push({ shape: "gable", size: [hw + 1.4, 0.65, rd], pos: [hcx, base, rcz], color: roof });
  S.push({ size: [hw + 1.42, 0.06, 0.12], pos: [hcx, base + 0.65, rcz], color: char2 });
  // the upper volume at the back: light timber with darker slats, a window band, its own low roof
  const ux0 = 12.0, ux1 = hx1, ucx = (ux0 + ux1) / 2, uz0 = B + 0.3, uz1 = B + 3.9, ucz = (uz0 + uz1) / 2, U = 2.3;
  S.push({ size: [ux1 - ux0, U, uz1 - uz0], pos: [ucx, base + U / 2, ucz], color: wood });
  for (let k = 0; k < 14; k++) S.push({ size: [0.04, U - 0.1, 0.04], pos: [ux0 + 0.15 + (k * (ux1 - ux0 - 0.3)) / 13, base + U / 2, uz1 + 0.02], color: woodMid });
  t.homeWins.push({ x: ucx, y: base + 1.3, z: uz1 + 0.05, w: 3.6, h: 1.0 });
  frame(S, ucx, base + 1.3, uz1 + 0.06, 3.6, 1.0, char, 0.08);
  t.homeWins.push({ x: ux1 + 0.04, y: base + 1.3, z: ucz, w: 2.0, h: 1.0, face: "x" });
  S.push({ shape: "gable", size: [ux1 - ux0 + 1.0, 0.55, uz1 - uz0 + 1.0], pos: [ucx, base + U, ucz], color: roof });
  S.push({ size: [ux1 - ux0 + 1.02, 0.08, uz1 - uz0 + 1.02], pos: [ucx, base + U - 0.02, ucz], color: char2 });

  // the zen garden: raked gravel, three rocks on moss in raked rings, a stone lantern, a red maple
  const zx0 = 11.1, zx1 = hx1 - 0.5, zz0 = gz - 2.45, zz1 = gz - 0.35;
  S.push({ size: [zx1 - zx0, 0.04, zz1 - zz0], pos: [(zx0 + zx1) / 2, -0.075, (zz0 + zz1) / 2], color: gravel });
  for (let k = 0; k < 7; k++) S.push({ size: [zx1 - zx0 - 0.2, 0.012, 0.04], pos: [(zx0 + zx1) / 2, -0.05, zz0 + 0.15 + k * 0.3], color: rake });
  for (const [x, z, s, ry] of [[12.6, gz - 1.6, 1.0, 0.5], [14.9, gz - 0.95, 0.75, 1.3], [15.5, gz - 1.95, 0.6, 2.2]] as const) {
    S.push({ shape: "cyl", size: [0.58 * s + 0.1, 0.014, 18], pos: [x, -0.048, z], color: rake });
    S.push({ shape: "cyl", size: [0.5 * s + 0.1, 0.016, 18], pos: [x, -0.046, z], color: gravel });
    S.push({ shape: "cyl", size: [0.4 * s + 0.05, 0.018, 16], pos: [x, -0.045, z], color: rake });
    S.push({ shape: "cyl", size: [0.34 * s + 0.05, 0.02, 16], pos: [x, -0.044, z], color: gravel });
    S.push({ shape: "cyl", size: [0.3 * s, 0.03, 9], pos: [x, -0.03, z], color: moss });
    S.push({ size: [0.5 * s, 0.36 * s, 0.4 * s], pos: [x, 0.06, z], rot: [0.1, ry, 0.06], color: s > 0.7 ? rock : rock2 });
  }
  const lx = 11.6, lz = gz - 0.85;
  S.push({ size: [0.4, 0.12, 0.4], pos: [lx, -0.04, lz], color: rock2 });
  S.push({ size: [0.16, 0.6, 0.16], pos: [lx, 0.3, lz], color: rock2 });
  S.push({ size: [0.36, 0.08, 0.36], pos: [lx, 0.64, lz], color: rock2 });
  S.push({ size: [0.26, 0.24, 0.26], pos: [lx, 0.8, lz], color: rock2 });
  t.homeWins.push({ x: lx, y: 0.8, z: lz + 0.135, w: 0.14, h: 0.14 });
  S.push({ shape: "hip", size: [0.5, 0.2, 0.5], pos: [lx, 0.92, lz], color: rock });
  const mx = 16.15, mz = gz - 2.1;
  S.push({ size: [0.1, 1.3, 0.1], pos: [mx, 0.5, mz], rot: [0, 0, 0.18], color: "#4a3a2e" });
  S.push({ size: [0.07, 0.8, 0.07], pos: [mx + 0.05, 1.1, mz], rot: [0.3, 0, -0.5], color: "#4a3a2e" });
  blob(S, mx + 0.05, 1.6, mz, 0.6, ["#b3261e", "#d9452b", "#c2361f", "#e0603a"]);
  // stepping stones to the door; bamboo along the wall in the corner
  [0.5, 1.1, 1.7].forEach((dz, i) => S.push({ shape: "cyl", size: [0.28, 0.06, 9], pos: [doorX + (i === 1 ? 0.12 : -0.08), -0.06, gz - dz], color: rock2 }));
  for (let k = 0; k < 6; k++) {
    const x = M.x0 + 0.2 + k * 0.13, z = gz - 0.35 - (k % 2) * 0.22, h = 2.3 + (k % 3) * 0.3;
    S.push({ shape: "cyl", size: [0.035, h, 6], pos: [x, h / 2 - 0.1, z], color: "#7a9a4a" });
    S.push({ size: [0.45, 0.3, 0.3], pos: [x, h - 0.25, z], rotY: k, color: k % 2 ? "#5e8a3c" : "#6f9c46" });
  }

  // the garage: charred timber, a light-wood slatted lintel, a thin flat roof with an overhang
  garage(t, { wall: char, header: wood, slab: char2, floor: "#77736b", h: 2.8 });
  for (let k = 0; k < 12; k++) S.push({ size: [0.05, 0.5, 0.04], pos: [M.garage.x0 + 0.3 + (k * (gw - 0.6)) / 11, 2.43, gFront + 0.07], color: woodMid });
  S.push({ size: [gw + 0.6, 0.12, gd + 0.8], pos: [gcx, 2.86, gcz + 0.2], color: roof });

  // the wall: charred timber, a light slatted screen by the gate, low lamps, a slatted gate
  // (low, so the garden shows over it)
  streetWall(t, { h: 0.9, wall: char, pillar: char2, cap: char2 });
  for (let x = px1 + 0.3; x < px1 + 2.2; x += 0.16) S.push({ size: [0.06, 1.5, 0.05], pos: [x, 0.65, gz + 0.04], color: wood });
  for (const x of POSTS) t.homeWins.push({ x, y: 0.6, z: gz + 0.21, w: 0.1, h: 0.25 });
  footGate(S, wood, 1.0);
  slidingGate(S, char2, 0.95);
}

const STYLES: Record<HouseStyle, (t: Town) => void> = { modern, pastel, heritage, mediterranean, tropical, japandi };
