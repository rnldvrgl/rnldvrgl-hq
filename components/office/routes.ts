/**
 * Where people walk, as pure functions of time. A route is a list of waypoints (with optional stops),
 * compiled once into a timeline; sampling it at t seconds gives a position, a heading and what they're doing.
 * Because it's all derived from the clock, every screen shows the same people in the same places.
 */
import { TEAM, type EmployeeId, type EmployeeMeta } from "@/lib/team";
import {
  hm, JANITOR_ROUNDS, TRASH_AT, TRASH_DROP_AT, HOME_FROM, BACK_AT, LUNCH_FROM, LUNCH_TO, STANDUP_FROM, STANDUP_TO, VAPE_FROM, VAPE_TO,
} from "@/lib/office-clock";
import { DESK, DINING, DUMPSTER, ENTRANCE, HUDDLE, LANES, MAIN_BIN, OFFICE, ROOM, VAPE } from "./palette";

export type Pt = { readonly x: number; readonly z: number };
export type Act = "rise" | "sit" | "pickup" | "drop" | "toss" | "inspect" | "coffee" | "look" | "eat" | "listen" | "lead" | "vape";
export type Waypoint = Pt & { wait?: number; act?: Act; face?: number; bin?: number };

type Entry =
  | { kind: "move"; from: Pt; to: Pt; t0: number; t1: number; d0: number; heading: number }
  | { kind: "wait"; at: Pt; t0: number; t1: number; d0: number; heading: number; act: Act | null; bin: number | null };

export type Route = { entries: Entry[]; duration: number; length: number };

export type Sample = {
  x: number; z: number; heading: number;
  moving: boolean;
  /** Distance walked so far, for the stride cycle. */
  dist: number;
  act: Act | null;
  /** 0→1 through the current stop. */
  actT: number;
  done: boolean;
};

/** Heading (rotation about y) that turns a person facing -z toward (dx, dz). */
export const headingOf = (dx: number, dz: number): number => Math.atan2(-dx, -dz);

/** Facing the back wall (toward the desks / the screen in front of them). */
export const FACE_BACK = 0;
export const FACE_FRONT = Math.PI;

export function compile(points: readonly Waypoint[], speed: number): Route {
  const entries: Entry[] = [];
  let t = 0, d = 0, heading = FACE_BACK;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i > 0) {
      const prev = points[i - 1];
      const len = Math.hypot(p.x - prev.x, p.z - prev.z);
      if (len > 1e-4) {
        heading = headingOf(p.x - prev.x, p.z - prev.z);
        entries.push({ kind: "move", from: prev, to: p, t0: t, t1: t + len / speed, d0: d, heading });
        t += len / speed;
        d += len;
      }
    }
    if (p.wait) {
      if (p.face !== undefined) heading = p.face;
      entries.push({ kind: "wait", at: p, t0: t, t1: t + p.wait, d0: d, heading, act: p.act ?? null, bin: p.bin ?? null });
      t += p.wait;
    }
  }
  return { entries, duration: t, length: d };
}

export function sample(route: Route, t: number): Sample {
  const { entries } = route;
  const last = entries[entries.length - 1];
  if (!last) return { x: 0, z: 0, heading: 0, moving: false, dist: 0, act: null, actT: 0, done: true };
  const clamped = Math.min(Math.max(t, 0), route.duration);
  // binary search for the entry containing `clamped`
  let lo = 0, hi = entries.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (entries[mid].t1 < clamped) lo = mid + 1;
    else hi = mid;
  }
  const e = entries[lo];
  const k = e.t1 > e.t0 ? (clamped - e.t0) / (e.t1 - e.t0) : 1;
  const done = t >= route.duration;
  if (e.kind === "move") {
    const x = e.from.x + (e.to.x - e.from.x) * k;
    const z = e.from.z + (e.to.z - e.from.z) * k;
    const len = Math.hypot(e.to.x - e.from.x, e.to.z - e.from.z);
    return { x, z, heading: e.heading, moving: !done, dist: e.d0 + len * k, act: null, actT: 0, done };
  }
  return { x: e.at.x, z: e.at.z, heading: e.heading, moving: false, dist: e.d0, act: e.act, actT: k, done };
}

/** Seconds into the route at which each bin is picked up. */
export function pickupTimes(route: Route): Map<number, number> {
  const out = new Map<number, number>();
  for (const e of route.entries) if (e.kind === "wait" && e.act === "pickup" && e.bin !== null) out.set(e.bin, e.t1);
  return out;
}

/* ------------------------------------------------------------------ floor plan */

const P = (x: number, z: number): Pt => ({ x, z });

export const deskCenterX = (m: EmployeeMeta): number => m.desk.x + DESK.W / 2;
const isBackRow = (m: EmployeeMeta): boolean => m.desk.y < 3;

/** Where an employee's chair (and so their seated hips) is. */
export function chairOf(m: EmployeeMeta): Pt {
  return P(deskCenterX(m), m.desk.y + DESK.D + 0.45);
}

/** The lane an employee steps into from their chair. */
function laneZOf(m: EmployeeMeta): number {
  return isBackRow(m) ? LANES.mid : LANES.front;
}

/** Desk bins: one in the gap right of each desk, reached from that row's lane. */
export type Bin = Pt & { id: number; pickup: Pt; face: number; lane: number };
export const BINS: readonly Bin[] = TEAM.map((m, i): Bin => {
  const x = m.desk.x + DESK.W + 0.2;
  const z = m.desk.y + 0.22;
  return isBackRow(m)
    ? { id: i, x, z, pickup: P(x, m.desk.y + 0.75), face: FACE_BACK, lane: LANES.mid }
    : { id: i, x, z, pickup: P(x, m.desk.y + DESK.D + 0.1), face: FACE_BACK, lane: LANES.front };
});
/** Ronald's own wastebasket (just furniture: he empties it himself). */
export const OWNER_BIN: Pt = P(OFFICE.x0 + 0.92, 1.42);

const DOOR_IN = P(ROOM.W - 0.6, ENTRANCE.z);
const DOOR = P(ROOM.W, ENTRANCE.z);
const DOOR_OUT = P(ROOM.W + 0.7, ENTRANCE.z);
/** Where people walking home leave the scene: the front edge of the pavement, along the building (clear of the parked car). */
const STREET = P(ROOM.W + 0.55, ROOM.D - 0.3);
const PANTRY_L = P(12.0, LANES.pantry);
const PANTRY_R = P(DOOR_IN.x, LANES.pantry);
const OFFICE_DOOR_OUT = P(OFFICE.doorX, LANES.mid);
const OFFICE_DOOR_IN = P(OFFICE.doorX, OFFICE.z1 - 0.6);
/** Standing spot in front of the main bin. */
const MAIN_BIN_SPOT = P(MAIN_BIN.x - 0.6, LANES.lounge);
const MAIN_BIN_FACE = headingOf(MAIN_BIN.x - MAIN_BIN_SPOT.x, MAIN_BIN.z - MAIN_BIN_SPOT.z);

/** Lane-to-lane path from a point on the mid or front lane to the entrance (inside). */
function toEntrance(from: Pt): Pt[] {
  const start = from.z === LANES.front ? [P(LANES.right, LANES.front)] : [P(LANES.right, LANES.mid)];
  return [...start, P(LANES.right, LANES.pantry), PANTRY_L, PANTRY_R, DOOR_IN];
}

/** From an employee's chair to standing in their lane. */
function outOfChair(m: EmployeeMeta): Waypoint[] {
  const c = chairOf(m);
  const lane = laneZOf(m);
  return [{ ...c, wait: 0.9, act: "rise", face: FACE_BACK }, P(c.x, c.z + 0.55), P(c.x, lane)];
}

function intoChair(m: EmployeeMeta): Waypoint[] {
  const c = chairOf(m);
  return [P(c.x, laneZOf(m)), P(c.x, c.z + 0.55), { ...c, wait: 0.9, act: "sit", face: FACE_BACK }];
}

/** Out of the chair, along `path` to `stops`, back the same way, and into the chair again. */
function roundTrip(m: EmployeeMeta, path: readonly Pt[], stops: readonly Waypoint[]): Waypoint[] {
  return [...outOfChair(m), ...path, ...stops, ...[...path].reverse(), ...intoChair(m)];
}

/** Same, but the middle stop stretches so the whole trip lasts exactly `total` seconds. */
function timedTrip(m: EmployeeMeta, path: readonly Pt[], before: readonly Waypoint[], hold: Waypoint, after: readonly Waypoint[], total: number, speed: number): Route {
  const probe = compile(roundTrip(m, path, [...before, { ...hold, wait: 0.001 }, ...after]), speed);
  const wait = Math.max(1, total - probe.duration);
  return compile(roundTrip(m, path, [...before, { ...hold, wait }, ...after]), speed);
}

function memo<K, V>(build: (k: K) => V): (k: K) => V {
  const cache = new Map<K, V>();
  return (k) => {
    let v = cache.get(k);
    if (v === undefined) { v = build(k); cache.set(k, v); }
    return v;
  };
}

const metaOf = (id: EmployeeId): EmployeeMeta => {
  const m = TEAM.find((t) => t.id === id);
  if (!m) throw new Error(`unknown employee ${id}`);
  return m;
};
const indexOf = (id: EmployeeId): number => TEAM.findIndex((t) => t.id === id);

/* ------------------------------------------------------------------ 5:30 PM: everyone bins their trash */

const WALK = 1.0;
const DROP_STAGGER_S = 7;

/** Pick up the bag from your own desk bin, take it to the main bin by the entrance, come back. */
export const dropRoute = memo((id: EmployeeId): Route => {
  const m = metaOf(id);
  const bin = BINS[indexOf(id)];
  const lane = laneZOf(m);
  return compile([
    ...outOfChair(m),
    P(bin.x, lane), { ...bin.pickup, wait: 2.2, act: "pickup", face: bin.face, bin: bin.id }, P(bin.x, lane),
    P(LANES.right, lane), P(LANES.right, LANES.lounge),
    { ...MAIN_BIN_SPOT, wait: 2.2, act: "drop", face: MAIN_BIN_FACE },
    P(LANES.right, LANES.lounge), P(LANES.right, lane),
    ...intoChair(m),
  ], WALK);
});

/** Seconds into this employee's 5:30 PM drop-off, or null outside it. */
export function dropRunT(min: number, id: EmployeeId): number | null {
  const t = (min - TRASH_DROP_AT) * 60 - indexOf(id) * DROP_STAGGER_S;
  return t >= 0 && t <= dropRoute(id).duration ? t : null;
}

/** When (seconds after 5:30 PM) this desk's bin is emptied, and when its bag lands in the main bin. */
export function dropTimes(id: EmployeeId): { emptied: number; dropped: number } {
  const r = dropRoute(id);
  const offset = indexOf(id) * DROP_STAGGER_S;
  const pick = actWindows(r, "pickup")[0];
  const drop = actWindows(r, "drop")[0];
  return { emptied: offset + (pick ? pick[0] + 1 : 0), dropped: offset + (drop ? drop[0] + 1.2 : 0) };
}

/* ------------------------------------------------------------------ 5:40 PM: the bag goes out */

/** Today's collector takes the main bin's bag out to the dumpster and comes back. */
export const trashRoute = memo((id: EmployeeId): Route => {
  const m = metaOf(id);
  const lane = laneZOf(m);
  const nearDoor = P(MAIN_BIN_SPOT.x, ENTRANCE.z + 0.75);
  return compile([
    ...outOfChair(m),
    P(LANES.right, lane), P(LANES.right, LANES.lounge),
    { ...MAIN_BIN_SPOT, wait: 2.6, act: "pickup", face: MAIN_BIN_FACE },
    nearDoor, DOOR_IN, DOOR, DOOR_OUT,
    P(DUMPSTER.x, DOOR_OUT.z - 0.4),
    { x: DUMPSTER.x, z: DUMPSTER.z + 0.95, wait: 3.5, act: "toss", face: FACE_BACK },
    P(DUMPSTER.x, DOOR_OUT.z - 0.4), DOOR_OUT, DOOR, DOOR_IN, nearDoor, MAIN_BIN_SPOT,
    P(LANES.right, LANES.lounge), P(LANES.right, lane),
    ...intoChair(m),
  ], WALK);
});

/** Seconds into today's trash run, or null outside it. */
export function trashRunT(min: number, id: EmployeeId): number | null {
  const t = (min - TRASH_AT) * 60;
  return t >= 0 && t <= trashRoute(id).duration ? t : null;
}

/* ------------------------------------------------------------------ 12:00 lunch at the dining table */

const LUNCH_STAGGER_S = 5;
/** Dining chairs: four along each side. Index = desk order. */
export const DINING_SEATS: readonly Waypoint[] = [-0.975, -0.325, 0.325, 0.975].flatMap((dx) => [
  { x: DINING.x + dx, z: DINING.z - 0.68, face: FACE_FRONT },
  { x: DINING.x + dx, z: DINING.z + 0.68, face: FACE_BACK },
]);

export const lunchRoute = memo((id: EmployeeId): Route => {
  const m = metaOf(id);
  const i = indexOf(id);
  const seat = DINING_SEATS[i];
  const lane = laneZOf(m);
  const near = seat.z < DINING.z;
  const sideLane = near ? LANES.pantry : LANES.lounge;
  const behind = P(seat.x, seat.z + (near ? -0.5 : 0.5));
  const path = [P(LANES.right, lane), P(LANES.right, sideLane), P(seat.x, sideLane), behind];
  const face = seat.face ?? FACE_BACK;
  return timedTrip(m, path,
    [{ ...seat, wait: 0.9, act: "sit", face }],
    { ...seat, act: "eat", face },
    [{ ...seat, wait: 0.9, act: "rise", face }],
    (LUNCH_TO - LUNCH_FROM) * 60 - i * LUNCH_STAGGER_S, WALK);
});

export function lunchRunT(min: number, id: EmployeeId): number | null {
  const t = (min - LUNCH_FROM) * 60 - indexOf(id) * LUNCH_STAGGER_S;
  return t >= 0 && t <= lunchRoute(id).duration ? t : null;
}

/* ------------------------------------------------------------------ 4:00 PM vape break outside */

const VAPE_STAGGER_S = 6;
/** Pavement lane between the dumpster and the parked car. */
const OUTSIDE_LANE_Z = 5.75;
/** Places around the patio's standing table. Index = desk order. */
export const VAPE_SPOTS: readonly Waypoint[] = TEAM.map((_, i) => {
  const a = (i / TEAM.length) * Math.PI * 2 + 0.3;
  const x = VAPE.x + VAPE.r * Math.sin(a);
  const z = VAPE.z + VAPE.r * Math.cos(a);
  return { x, z, face: headingOf(VAPE.x - x, VAPE.z - z) };
});

export const vapeRoute = memo((id: EmployeeId): Route => {
  const m = metaOf(id);
  const i = indexOf(id);
  const spot = VAPE_SPOTS[i];
  const c = chairOf(m);
  const path = [
    ...toEntrance(P(c.x, laneZOf(m))), DOOR, DOOR_OUT,
    P(DOOR_OUT.x + 0.35, OUTSIDE_LANE_Z), P(VAPE.x - VAPE.r - 0.45, OUTSIDE_LANE_Z),
  ];
  return timedTrip(m, path, [], { ...spot, act: "vape", face: spot.face ?? FACE_BACK }, [],
    (VAPE_TO - VAPE_FROM) * 60 - i * VAPE_STAGGER_S, WALK);
});

export function vapeRunT(min: number, id: EmployeeId): number | null {
  const t = (min - VAPE_FROM) * 60 - indexOf(id) * VAPE_STAGGER_S;
  return t >= 0 && t <= vapeRoute(id).duration ? t : null;
}

/* ------------------------------------------------------------------ 9:00 stand-up */

const STANDUP_STAGGER_S = 3;
/** Places in the stand-up circle, open toward the screen on the left. Index = desk order. */
export const HUDDLE_SPOTS: readonly Waypoint[] = TEAM.map((_, i) => {
  const a = ((-150 + (i * 270) / (TEAM.length - 1)) * Math.PI) / 180;
  const x = HUDDLE.x + HUDDLE.r * Math.sin(a + Math.PI / 2);
  const z = HUDDLE.z + HUDDLE.r * Math.cos(a + Math.PI / 2);
  return { x, z, face: headingOf(HUDDLE.x - x, HUDDLE.z - z) };
});
/** Ronald leads from beside the screen. */
export const LEADER_SPOT: Waypoint = { x: HUDDLE.x - HUDDLE.r - 0.35, z: HUDDLE.z + 0.55, face: headingOf(1, -0.4) };
/** The stand-up screen, on a stand facing the circle. */
export const STANDUP_SCREEN: Pt = P(HUDDLE.x - HUDDLE.r - 0.75, HUDDLE.z - 0.35);

function toHuddle(m: EmployeeMeta, spot: Pt): Pt[] {
  if (!isBackRow(m)) return [P(deskCenterX(m), LANES.lounge), P(spot.x, LANES.lounge + 0.2)];
  const aisle = deskCenterX(m) < 5 ? LANES.left : LANES.right;
  return [P(aisle, LANES.mid), P(aisle, LANES.lounge), P(spot.x, LANES.lounge + 0.2)];
}

export const standupRoute = memo((id: EmployeeId): Route => {
  const m = metaOf(id);
  const i = indexOf(id);
  const spot = HUDDLE_SPOTS[i];
  return timedTrip(m, toHuddle(m, spot), [], { ...spot, act: "listen", face: spot.face ?? FACE_BACK }, [],
    (STANDUP_TO - STANDUP_FROM) * 60 - i * STANDUP_STAGGER_S, WALK);
});

export function standupRunT(min: number, id: EmployeeId): number | null {
  const t = (min - STANDUP_FROM) * 60 - indexOf(id) * STANDUP_STAGGER_S;
  return t >= 0 && t <= standupRoute(id).duration ? t : null;
}

/* ------------------------------------------------------------------ going home and coming back */

function buildCommute(m: EmployeeMeta): Route {
  const c = chairOf(m);
  return compile([...outOfChair(m), ...toEntrance(P(c.x, laneZOf(m))), DOOR, DOOR_OUT, STREET], WALK);
}

const commutes = new Map<EmployeeId, Route>();
function commute(m: EmployeeMeta): Route {
  let r = commutes.get(m.id);
  if (!r) { r = buildCommute(m); commutes.set(m.id, r); }
  return r;
}

/** Each employee leaves / arrives a few seconds apart, in desk order. */
const STAGGER_S = 9;

export type Commute = { route: Route; t: number; reverse: boolean };

/**
 * If this idle employee is mid-commute right now, where on the route they are.
 * `reverse` means arriving in the morning (the leave route walked backwards).
 */
export function commuteAt(min: number, m: EmployeeMeta, index: number): Commute | null {
  const route = commute(m);
  const leaveT = (min - HOME_FROM) * 60 - index * STAGGER_S;
  if (leaveT >= 0 && leaveT <= route.duration) return { route, t: leaveT, reverse: false };
  // arrive so that they sit down at BACK_AT minus their stagger
  const arriveEnd = BACK_AT * 60 - (TEAM.length - index) * STAGGER_S;
  const arriveT = min * 60 - (arriveEnd - route.duration);
  if (arriveT >= 0 && arriveT <= route.duration) return { route, t: route.duration - arriveT, reverse: true };
  return null;
}

/* ------------------------------------------------------------------ the janitor */

const JANITOR_SPEED = 0.32;
const LOOP: readonly Pt[] = [
  P(LANES.right, LANES.front), P(LANES.left, LANES.front), P(LANES.left, LANES.mid), P(LANES.right, LANES.mid),
  P(LANES.right, LANES.back), P(LANES.left, LANES.back), P(LANES.left, LANES.mid), P(LANES.right, LANES.mid),
];

function buildJanitorRoute(roundSeconds: number): Route {
  const enter: Pt[] = [STREET, DOOR_OUT, DOOR, DOOR_IN, PANTRY_R, PANTRY_L, P(LANES.right, LANES.pantry)];
  const loopLen = LOOP.reduce((s, p, i) => s + Math.hypot(p.x - LOOP[(i + 1) % LOOP.length].x, p.z - LOOP[(i + 1) % LOOP.length].z), 0);
  const loops = Math.max(1, Math.floor((roundSeconds * JANITOR_SPEED - 24) / loopLen));
  const pts: Pt[] = [...enter];
  for (let i = 0; i < loops; i++) pts.push(...LOOP);
  pts.push(P(LANES.right, LANES.front), P(LANES.right, LANES.pantry), PANTRY_L, PANTRY_R, DOOR_IN, DOOR, DOOR_OUT, STREET);
  // pick the speed that makes the round end exactly on time
  const len = compile(pts, 1).length;
  return compile(pts, len / roundSeconds);
}

const janitorRoutes = new Map<number, Route>();
/** Seconds into the current janitor round and its route, or null when the janitor isn't in. */
export function janitorAt(min: number): { route: Route; t: number } | null {
  for (const [from, to] of JANITOR_ROUNDS) {
    if (min < from || min >= to) continue;
    const secs = (to - from) * 60;
    let route = janitorRoutes.get(secs);
    if (!route) { route = buildJanitorRoute(secs); janitorRoutes.set(secs, route); }
    return { route, t: (min - from) * 60 };
  }
  return null;
}

/** Where the yellow wet-floor sign stands during a round. */
export const WET_SIGN: Pt = P(10.75, 7.95);

/* ------------------------------------------------------------------ Ronald walking around */

/** Ronald's chair and the spot he stands up into. */
export const OWNER_CHAIR = P((OFFICE.x0 + OFFICE.x1) / 2, 1.62);
const OWNER_STAND = P(OWNER_CHAIR.x - 0.75, OWNER_CHAIR.z + 0.75);
const COFFEE_SPOT = P(13.45, 5.15);
const OWNER_SPEED = 0.7;

/** Deterministic 0–1 from an integer seed (mulberry32). */
function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function buildTour(seed: number, coffee: boolean): Route {
  const pts: Waypoint[] = [
    { ...OWNER_CHAIR, wait: 1.1, act: "rise", face: FACE_BACK },
    OWNER_STAND, OFFICE_DOOR_IN, OFFICE_DOOR_OUT,
  ];
  if (coffee) {
    pts.push(PANTRY_L, P(COFFEE_SPOT.x, LANES.pantry), { ...COFFEE_SPOT, wait: 7, act: "coffee", face: FACE_BACK }, P(COFFEE_SPOT.x, LANES.pantry), PANTRY_L);
  }
  // look over the shoulders of three employees: two in the back row (from the mid lane), one in the front row
  const back = TEAM.filter((m) => isBackRow(m));
  const front = TEAM.filter((m) => !isBackRow(m));
  const a = back[Math.floor(rand(seed + 1) * back.length)];
  const b = back[Math.floor(rand(seed + 2) * back.length)];
  const c = front[Math.floor(rand(seed + 3) * front.length)];
  const visitsBack = [...new Set([a, b])].sort((p, q) => q.desk.x - p.desk.x); // walking right → left
  pts.push(P(LANES.right, LANES.mid));
  for (const m of visitsBack) {
    const x = deskCenterX(m);
    pts.push(P(x, LANES.mid), { x, z: chairOf(m).z + 0.6, wait: 6, act: "inspect", face: FACE_BACK }, P(x, LANES.mid));
  }
  pts.push(P(LANES.left, LANES.mid), P(LANES.left, LANES.front));
  const cx = deskCenterX(c);
  pts.push(P(cx, LANES.front), { x: cx, z: chairOf(c).z + 0.6, wait: 6, act: "inspect", face: FACE_BACK }, P(cx, LANES.front));
  pts.push(P(LANES.right, LANES.front), P(LANES.right, LANES.mid), OFFICE_DOOR_OUT, OFFICE_DOOR_IN, OWNER_STAND,
    { ...OWNER_CHAIR, wait: 1.1, act: "sit", face: FACE_BACK });
  return compile(pts, OWNER_SPEED);
}

const leadRoute = memo((_: "lead"): Route => {
  const out: Pt[] = [OWNER_STAND, OFFICE_DOOR_IN, OFFICE_DOOR_OUT, P(LANES.right, LANES.mid), P(LANES.right, LANES.lounge), P(LEADER_SPOT.x + 0.4, LANES.lounge)];
  const go = compile([{ ...OWNER_CHAIR, wait: 1.1, act: "rise", face: FACE_BACK }, ...out, { ...LEADER_SPOT, wait: 0.001 }], OWNER_SPEED);
  const back = compile([LEADER_SPOT, ...[...out].reverse(), { ...OWNER_CHAIR, wait: 1.1, act: "sit", face: FACE_BACK }], OWNER_SPEED);
  // he gets there first and leaves last
  const hold = (STANDUP_TO - STANDUP_FROM) * 60 + 10 - go.duration - back.duration;
  return compile([{ ...OWNER_CHAIR, wait: 1.1, act: "rise", face: FACE_BACK }, ...out,
    { ...LEADER_SPOT, wait: Math.max(1, hold), act: "lead", face: LEADER_SPOT.face },
    ...[...out].reverse(), { ...OWNER_CHAIR, wait: 1.1, act: "sit", face: FACE_BACK }], OWNER_SPEED);
});

/** Ronald leading the weekday stand-up, if it's on. He leaves his desk 20 s early. */
export function ownerStandupAt(weekday: boolean, min: number): { route: Route; t: number } | null {
  if (!weekday) return null;
  const route = leadRoute("lead");
  const t = (min - STANDUP_FROM) * 60 + 20;
  return t >= 0 && t <= route.duration ? { route, t } : null;
}

const tours = new Map<string, Route>();
/** 10-minute slots: a walk on every half hour 9:30 AM–4:30 PM, and now and then in between, 8 AM–7 PM. */
const SLOT = 10;

/**
 * Ronald's walk around the office, if he's on one at `min` of Manila day `day`.
 * Coffee runs happen on some walks (always at 12:30).
 */
export function ownerTourAt(day: number, min: number): { route: Route; t: number; coffee: boolean } | null {
  const slot = Math.floor(min / SLOT);
  const start = slot * SLOT;
  if (start < hm("08:00") || start >= hm("19:00")) return null;
  if (start >= hm("08:50") && start < hm("09:10")) return null; // stand-up time
  const seed = day * 1000 + slot;
  const halfHour = start % 60 === 30 && start >= hm("09:30") && start <= hm("16:30");
  if (!halfHour && rand(seed) > 0.3) return null;
  const coffee = start === hm("12:30") || rand(seed + 7) < 0.35;
  const key = `${seed}:${coffee}`;
  let route = tours.get(key);
  if (!route) { route = buildTour(seed, coffee); tours.set(key, route); }
  const t = (min - start) * 60 - 5;
  return t >= 0 && t <= route.duration ? { route, t, coffee } : null;
}

/** [start, end] seconds of every stop with the given act. */
export function actWindows(route: Route, act: Act): [number, number][] {
  const out: [number, number][] = [];
  for (const e of route.entries) if (e.kind === "wait" && e.act === act) out.push([e.t0, e.t1]);
  return out;
}
