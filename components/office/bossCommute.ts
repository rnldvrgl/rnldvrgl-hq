import * as THREE from "three";
import { PARKING } from "./palette";
import { BACK_LANE, LANE, SIDE_STREET, SIDEWALK } from "./world";
import { MANSION } from "./homes";
import { headingOf, ownerToCar, type Route } from "./routes";

/**
 * The boss's day, by car: at the go-home time they walk out to the car under the carport, get in, back out
 * onto the main road, drive down it, up the side street, along the street behind the office and into the
 * garage of their house. In the morning the car backs out of the garage and drives the other way round
 * (down the side street, along the near lane) into the carport, and they walk in to sit down on the hour.
 * Like everything else, a pure function of the clock (Staff.tsx moves the boss, Car.tsx the car).
 */

type Seg = { curve: THREE.Curve<THREE.Vector3>; len: number; speed: number; reverse: boolean };
type Drive = { segs: Seg[]; duration: number };

const V = (x: number, z: number) => new THREE.Vector3(x, 0, z);
const line = (a: THREE.Vector3, b: THREE.Vector3, speed: number, reverse = false): Seg => {
  const curve = new THREE.LineCurve3(a, b);
  return { curve, len: a.distanceTo(b), speed, reverse };
};
const turn = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, speed: number, reverse = false): Seg => {
  const curve = new THREE.QuadraticBezierCurve3(a, c, b);
  return { curve, len: curve.getLength(), speed, reverse };
};
const drive = (segs: Seg[]): Drive => ({ segs, duration: segs.reduce((s, g) => s + g.len / g.speed, 0) });

const FAST = 5.5, CORNER = 3, BACKING = 1.3;
/** Keep right: up the side street on its east half, down it on its west half. */
const SX = (SIDE_STREET.x0 + SIDE_STREET.x1) / 2, UP_X = SX + 0.7, DOWN_X = SX - 0.7;
const BL = BACK_LANE[0];
const P0 = V(PARKING.x, PARKING.z);
const G = V(MANSION.park.x, MANSION.park.z);
const DX = MANSION.driveX;

/** Office → home: reverse out of the carport swinging the tail toward +x so the nose points down the far lane. */
const HOME = drive([
  turn(P0, V(PARKING.x, LANE.far), V(PARKING.x + 3.4, LANE.far), BACKING, true),
  line(V(PARKING.x + 3.4, LANE.far), V(UP_X + 3, LANE.far), FAST),
  turn(V(UP_X + 3, LANE.far), V(UP_X, LANE.far), V(UP_X, SIDEWALK.z0 - 0.6), CORNER),
  line(V(UP_X, SIDEWALK.z0 - 0.6), V(UP_X, BL + 2.4), FAST),
  turn(V(UP_X, BL + 2.4), V(UP_X, BL), V(UP_X + 2.4, BL), CORNER),
  line(V(UP_X + 2.4, BL), V(DX - 2.6, BL), FAST * 0.7),
  turn(V(DX - 2.6, BL), V(DX, BL), V(DX, BL - 2.6), CORNER * 0.7),
  line(V(DX, BL - 2.6), G, 1.6),
]);

/** Home → office: back out of the garage (tail toward +x), down the side street, along the near lane, into the carport nose first. */
const WORK = drive([
  line(G, V(DX, MANSION.gateZ + 0.2), BACKING, true),
  turn(V(DX, MANSION.gateZ + 0.2), V(DX, BL), V(DX + 2.6, BL), BACKING, true),
  line(V(DX + 2.6, BL), V(DOWN_X + 2.4, BL), FAST * 0.7),
  turn(V(DOWN_X + 2.4, BL), V(DOWN_X, BL), V(DOWN_X, BL + 2.4), CORNER),
  line(V(DOWN_X, BL + 2.4), V(DOWN_X, LANE.near - 2.4), FAST),
  turn(V(DOWN_X, LANE.near - 2.4), V(DOWN_X, LANE.near), V(DOWN_X + 2.4, LANE.near), CORNER),
  line(V(DOWN_X + 2.4, LANE.near), V(PARKING.x - 3.2, LANE.near), FAST),
  turn(V(PARKING.x - 3.2, LANE.near), V(PARKING.x, LANE.near), V(PARKING.x, SIDEWALK.z0 - 0.3), CORNER * 0.8),
  line(V(PARKING.x, SIDEWALK.z0 - 0.3), P0, 1.8),
]);

export type CarPose = { x: number; z: number; heading: number; moving: boolean; reversing: boolean; engine: boolean };

const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3();
function poseOn(d: Drive, t: number): CarPose {
  let left = Math.max(0, Math.min(t, d.duration));
  for (const s of d.segs) {
    const dur = s.len / s.speed;
    if (left <= dur || s === d.segs[d.segs.length - 1]) {
      const u = Math.min(1, dur > 0 ? left / dur : 1);
      s.curve.getPointAt(u, tmpP);
      s.curve.getTangentAt(u, tmpT);
      // the car's nose: along the tangent going forward, against it when backing up
      const fx = s.reverse ? -tmpT.x : tmpT.x, fz = s.reverse ? -tmpT.z : tmpT.z;
      return { x: tmpP.x, z: tmpP.z, heading: headingOf(fx, fz), moving: t > 0 && t < d.duration, reversing: s.reverse, engine: true };
    }
    left -= dur;
  }
  return { x: G.x, z: G.z, heading: 0, moving: false, reversing: false, engine: false };
}

export const PARKED_OFFICE: CarPose = { x: PARKING.x, z: PARKING.z, heading: 0, moving: false, reversing: false, engine: false };
export const PARKED_HOME: CarPose = { x: G.x, z: G.z, heading: 0, moving: false, reversing: false, engine: false };

/** Seconds to get in (engine on, then off) or out of the car. */
const GET_IN = 2.5;

export type BossDay =
  /** In the office as usual (desk, errands, tours); the car in the carport. */
  | { kind: "office" }
  /** Walking between the desk and the car (`reverse`: coming in). The car in the carport. */
  | { kind: "walk"; route: Route; t: number; reverse: boolean }
  /** In the car: getting in or out, or driving. The boss isn't drawn. */
  | { kind: "car"; car: CarPose; leg: "home" | "work" }
  /** At home for the night, the car in the garage. */
  | { kind: "home" };

/** `t` seconds into going home: walk out, get in, drive to the garage; then home. */
function leaving(t: number): BossDay {
  const walk = ownerToCar("car"), W = walk.duration;
  if (t < W) return { kind: "walk", route: walk, t, reverse: false };
  if (t < W + GET_IN) return { kind: "car", car: { ...PARKED_OFFICE, engine: t - W > 1 }, leg: "home" };
  const d = t - W - GET_IN;
  if (d < HOME.duration) return { kind: "car", car: poseOn(HOME, d), leg: "home" };
  return { kind: "home" };
}

/** `t` seconds into coming in: drive from the garage, get out, walk in to the desk; then at the office. */
function arriving(t: number): BossDay {
  const walk = ownerToCar("car"), W = walk.duration;
  if (t < WORK.duration) return { kind: "car", car: poseOn(WORK, t), leg: "work" };
  const g = t - WORK.duration;
  if (g < GET_IN) return { kind: "car", car: { ...PARKED_OFFICE, engine: g < 1 }, leg: "work" };
  const w = g - GET_IN;
  if (w < W) return { kind: "walk", route: walk, t: W - w, reverse: true };
  return { kind: "office" };
}

/** Seconds the whole drive in takes (to start it so the boss sits down on the hour). */
const ARRIVE_S = () => WORK.duration + GET_IN + ownerToCar("car").duration;
const LEAVE_S = () => ownerToCar("car").duration + GET_IN + HOME.duration;

/**
 * Where the boss and the car are at `min` (Manila minutes), given arriving at `back` and leaving at `from`.
 * `override`: sent home or called in by hand (commuteOverride.ts), `t` seconds ago.
 */
export function bossDay(min: number, hours: { back: number; from: number }, override?: { mode: "home" | "office"; t: number } | null): BossDay {
  if (override) {
    if (override.mode === "home") return leaving(override.t);
    return arriving(override.t);
  }
  const T = min * 60;
  const out = hours.from * 60, a0 = hours.back * 60 - ARRIVE_S();
  if (T >= out && T < out + LEAVE_S()) return leaving(T - out);
  if (T >= a0 && T < hours.back * 60) return arriving(T - a0);
  return T >= out || T < a0 ? { kind: "home" } : { kind: "office" };
}

/** Where the car is for a given day state. */
export function carPoseOf(day: BossDay): CarPose {
  return day.kind === "car" ? day.car : day.kind === "home" ? PARKED_HOME : PARKED_OFFICE;
}
