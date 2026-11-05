"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneNow, sceneWeather } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { PAL } from "./palette";
import { CROSS_Z, JUNCTIONS, signalClock, walkLamp, walkLeft, type Junction } from "./signals";
import { FAR_WALK, SCHOOL, SIDEWALK } from "./world";

/**
 * People out on the street: students in uniform with backpacks going to school and home again, office
 * workers with their bags, joggers at dawn, and neighbours out on errands. They follow the street rules:
 *   - they stay on the sidewalks, keeping to the right (two lanes per sidewalk, one each way)
 *   - they cross the main road only at the zebra, and only on the walk signal, when there's time to make it
 *     across (otherwise they wait at the kerb for the next one)
 *   - in the rain, out come the umbrellas
 *   - students go in through Republic Central Colleges' gate before class and pour out of it at lunch and after class
 * How many depends on the hour (busiest at the school and office rush), up to the number set in
 * Settings → Performance → People outside, so slower phones can keep it low.
 *
 * Drawn instanced: every body part is one InstancedMesh shared by all the walkers (9 draw calls for any
 * number of them), and the per-frame work is a little arithmetic per person.
 */

type Kind = "student" | "worker" | "jogger" | "local" | "elder";
type Mode = "walk" | "toCross" | "wait" | "cross" | "enter";

type Walker = {
  kind: Kind;
  /** 0 = near sidewalk, 1 = far sidewalk. */
  side: 0 | 1;
  x: number; z: number;
  dir: 1 | -1;
  speed: number;
  mode: Mode;
  junction: Junction | null;
  /** Walk-cycle phase. */
  phase: number;
  /** Off-street (waiting to come back on when the hour wants more people). */
  away: boolean;
  look: { shirt: string; pants: string; skin: string; hair: string; bag: string | null; umbrella: string };
  height: number;
};

const X_RANGE = { x0: -40, x1: 76 } as const;
/** The school gate (Republic Central Colleges, across the street): students go in there in the morning and come out after class. */
const GATE = { x: SCHOOL.gateX, z: FAR_WALK.z1 + 0.75 } as const;
const schoolIn = (h: number) => h >= 6 && h < 7.9;
const schoolOut = (h: number) => (h >= 11.9 && h < 12.4) || (h >= 15.5 && h < 17.5);
/** Sidewalk lanes: keep right. Walking +x on the near sidewalk you keep to the road side, and so on. */
const laneZ = (side: 0 | 1, dir: 1 | -1) => {
  const w = side === 0 ? SIDEWALK : FAR_WALK;
  const mid = (w.z0 + w.z1) / 2, off = (w.z1 - w.z0) * 0.22;
  // facing +x, your right is +z
  return mid + (dir > 0 ? off : -off);
};

/** Busy-ness by the hour (0–1), and who's out. */
function crowd(min: number): { level: number; weights: Record<Kind, number> } {
  const h = min / 60;
  const school = (h >= 6 && h < 7.75) || (h >= 15.5 && h < 17.5);
  const office = (h >= 6.5 && h < 9) || (h >= 17 && h < 19.5);
  const dawn = h >= 5 && h < 7;
  const level = h < 5 ? 0.08 : h < 6 ? 0.3 : school || office ? 1 : h < 12 ? 0.55 : h < 13.5 ? 0.85 : h < 20 ? 0.6 : h < 22 ? 0.35 : 0.12;
  return {
    level,
    weights: {
      student: school ? 5 : h >= 7.75 && h < 15.5 ? 0.2 : 0.4,
      worker: office ? 4 : h >= 11.5 && h < 13.5 ? 2 : 0.8,
      jogger: dawn ? 3 : h >= 17.5 && h < 19 ? 1 : 0.1,
      local: 2,
      elder: h >= 6 && h < 18 ? 1 : 0.2,
    },
  };
}

const SPEED: Record<Kind, number> = { student: 1.35, worker: 1.45, jogger: 2.6, local: 1.15, elder: 0.8 };
const UNIFORM_PANTS = ["#1e3a8a", "#1f2937", "#7f1d1d", "#14532d"];
const SHIRTS = ["#f97316", "#0ea5e9", "#22c55e", "#e11d48", "#a855f7", "#facc15", "#f8fafc", "#64748b", "#14b8a6"];
const UMBRELLAS = ["#1d4ed8", "#dc2626", "#16a34a", "#111827", "#f59e0b", "#db2777"];

function rand(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

function pickKind(weights: Record<Kind, number>, r: number): Kind {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let acc = 0;
  for (const k of Object.keys(weights) as Kind[]) { acc += weights[k] / total; if (r <= acc) return k; }
  return "local";
}

/** Dress someone for who they are. */
function dress(kind: Kind, r: () => number): Walker["look"] {
  const skin = PAL.skin[Math.floor(r() * PAL.skin.length)];
  const hair = r() < 0.15 && kind === "elder" ? "#d1d5db" : "#1f1a17";
  const umbrella = UMBRELLAS[Math.floor(r() * UMBRELLAS.length)];
  if (kind === "student") return { shirt: "#f8fafc", pants: UNIFORM_PANTS[Math.floor(r() * UNIFORM_PANTS.length)], skin, hair, bag: ["#2563eb", "#db2777", "#111827", "#16a34a"][Math.floor(r() * 4)], umbrella };
  if (kind === "worker") return { shirt: ["#dbeafe", "#f1f5f9", "#e0e7ff", "#fce7f3"][Math.floor(r() * 4)], pants: "#1f2937", skin, hair, bag: "#3f2a1e", umbrella };
  if (kind === "jogger") return { shirt: ["#f97316", "#22d3ee", "#a3e635"][Math.floor(r() * 3)], pants: "#111827", skin, hair, bag: null, umbrella };
  return { shirt: SHIRTS[Math.floor(r() * SHIRTS.length)], pants: ["#334155", "#78716c", "#1e3a8a", "#57534e"][Math.floor(r() * 4)], skin, hair, bag: kind === "local" && r() < 0.4 ? "#a16207" : null, umbrella };
}

/** Put someone at one end of a sidewalk, walking in (or, after class, a student out of the school gate). */
function spawn(w: Walker, kind: Kind, r: () => number, anywhere: boolean, hour = 12) {
  w.kind = kind;
  w.side = r() < 0.5 ? 0 : 1;
  w.dir = r() < 0.5 ? 1 : -1;
  w.x = anywhere ? X_RANGE.x0 + r() * (X_RANGE.x1 - X_RANGE.x0) : w.dir > 0 ? X_RANGE.x0 : X_RANGE.x1;
  if (kind === "student" && !anywhere && schoolOut(hour) && r() < 0.75) { w.side = 1; w.x = GATE.x + (r() - 0.5) * 2; }
  w.z = laneZ(w.side, w.dir);
  w.speed = SPEED[kind] * (0.85 + r() * 0.3);
  w.mode = "walk";
  w.junction = null;
  w.look = dress(kind, r);
  w.height = kind === "student" ? 0.82 + r() * 0.12 : kind === "elder" ? 0.92 : 0.95 + r() * 0.1;
}

/* ------------------------------------------------------------------ the parts */

/** Body parts in the walker's frame (feet at 0, facing +x), sized for a 1 m-tall scale (×height). */
const PARTS = {
  legL: { size: [0.1, 0.42, 0.1], hip: [0, 0.42, -0.06] },
  legR: { size: [0.1, 0.42, 0.1], hip: [0, 0.42, 0.06] },
  torso: { size: [0.16, 0.36, 0.26], at: [0, 0.6, 0] },
  armL: { size: [0.08, 0.34, 0.08], shoulder: [0, 0.76, -0.17] },
  armR: { size: [0.08, 0.34, 0.08], shoulder: [0, 0.76, 0.17] },
  head: { size: [0.2, 0.2, 0.2], at: [0, 0.9, 0] },
  hair: { size: [0.21, 0.07, 0.21], at: [0, 1.0, 0] },
  bag: { size: [0.1, 0.22, 0.2], at: [-0.13, 0.62, 0] },
  umbrella: { size: [0.75, 0.32, 0.75], at: [0.04, 1.2, 0.08] },
} as const;
type PartKey = keyof typeof PARTS;
const KEYS = Object.keys(PARTS) as PartKey[];

export function Walkers({ count }: { count: number }) {
  const meshes = useRef<Partial<Record<PartKey, THREE.InstancedMesh | null>>>({});
  const walkers = useMemo<Walker[]>(() => {
    const r = rand(7 + count);
    const { weights } = crowd(manilaMinutes(sceneNow()));
    return Array.from({ length: count }, () => {
      const w = { look: { shirt: "", pants: "", skin: "", hair: "", bag: null, umbrella: "" } } as unknown as Walker;
      spawn(w, pickKind(weights, r()), r, true);
      w.phase = r() * Math.PI * 2;
      w.away = false;
      return w;
    });
  }, [count]);
  const rng = useMemo(() => rand(99 + count), [count]);

  // colours change only when someone is re-dressed (on coming back on the street)
  const paint = useMemo(() => {
    const c = new THREE.Color();
    return (i: number) => {
      const w = walkers[i], L = w.look;
      const set = (k: PartKey, col: string) => { const m = meshes.current[k]; if (m) { m.setColorAt(i, c.set(col)); if (m.instanceColor) m.instanceColor.needsUpdate = true; } };
      set("legL", L.pants); set("legR", L.pants); set("torso", L.shirt); set("armL", L.shirt); set("armR", L.shirt);
      set("head", L.skin); set("hair", L.hair); set("bag", L.bag ?? L.shirt); set("umbrella", L.umbrella);
    };
  }, [walkers]);
  useLayoutEffect(() => { walkers.forEach((_, i) => paint(i)); }, [walkers, paint]);

  const tmp = useMemo(() => ({
    root: new THREE.Matrix4(), local: new THREE.Matrix4(), out: new THREE.Matrix4(), hide: new THREE.Matrix4().makeScale(0, 0, 0),
    q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), e: new THREE.Euler(), pivot: new THREE.Matrix4(),
  }), []);

  const frame = useRef(0);
  useFrame((_, delta) => {
    const dt = Math.min(0.1, delta);
    const t = signalClock();
    const min = manilaMinutes(sceneNow());
    const { level, weights } = crowd(min);
    const hour = min / 60;
    const wanted = Math.round(count * level);
    const rain = sceneWeather() === "rain" || sceneWeather() === "storm";
    let out = walkers.filter((w) => !w.away).length;

    walkers.forEach((w, i) => {
      // off the street: come back when the hour wants more people
      if (w.away) {
        if (out < wanted && rng() < dt * 0.5) { spawn(w, pickKind(weights, rng()), rng, false, hour); w.away = false; out++; paint(i); }
        else return hideAll(i);
      }
      const stepping = w.mode !== "wait";
      if (w.mode === "walk") {
        w.x += w.dir * w.speed * dt;
        // coming up to a zebra: some people cross here
        for (const j of JUNCTIONS) {
          const ahead = (j.crossX - w.x) * w.dir;
          if (ahead > 0 && ahead < w.speed * dt * 1.5 + 0.02 && w.kind !== "jogger" && rng() < 0.45) {
            // step onto the zebra (spread across its width, not all on one line)
            w.mode = "toCross"; w.junction = j; w.x = j.crossX + (rng() - 0.5) * (j.crossW - 0.5);
          }
        }
        // a student on the school's side, at its gate before class: in they go
        if (w.kind === "student" && w.side === 1 && schoolIn(hour) && Math.abs(w.x - GATE.x) < 1.6 && rng() < 0.7) w.mode = "enter";
        // walked off the end of the street: leave if there are too many people for the hour, or turn back in
        if (w.x < X_RANGE.x0 - 2 || w.x > X_RANGE.x1 + 2) {
          if (out > wanted) { w.away = true; out--; return hideAll(i); }
          spawn(w, pickKind(weights, rng()), rng, false, hour); paint(i);
        }
      }
      if (w.mode === "enter") {
        // through the gate and across the quadrangle, then inside (off the street)
        w.x += (GATE.x - w.x) * Math.min(1, dt * 2);
        w.z += w.speed * dt;
        if (w.z > GATE.z + 3) { w.away = true; out--; return hideAll(i); }
      }
      if (w.mode === "toCross") {
        // step to the kerb, then wait for the walk signal
        const kerbZ = w.side === 0 ? SIDEWALK.z1 - 0.2 : FAR_WALK.z0 + 0.2;
        const dz = kerbZ - w.z;
        if (Math.abs(dz) > 0.03) w.z += Math.sign(dz) * Math.min(Math.abs(dz), w.speed * dt);
        else w.mode = "wait";
      }
      if (w.mode === "wait" && w.junction) {
        const crossTime = (CROSS_Z.road1 - CROSS_Z.road0 + 0.8) / w.speed;
        if (walkLamp(w.junction, t) === "green" && walkLeft(w.junction, t) > crossTime) w.mode = "cross";
      }
      if (w.mode === "cross") {
        const toZ = w.side === 0 ? FAR_WALK.z0 + 0.3 : SIDEWALK.z1 - 0.3;
        const dz = toZ - w.z;
        // a little quicker if the signal has started flashing
        const hurry = w.junction && walkLamp(w.junction, t) !== "green" ? 1.5 : 1;
        if (Math.abs(dz) > 0.05) w.z += Math.sign(dz) * Math.min(Math.abs(dz), w.speed * hurry * dt);
        else {
          // over: carry on along the other sidewalk, either way
          w.side = w.side === 0 ? 1 : 0;
          w.dir = rng() < 0.5 ? 1 : -1;
          w.z = laneZ(w.side, w.dir);
          w.x += w.dir * 0.4;
          w.mode = "walk"; w.junction = null;
        }
      }

      // pose: legs and arms swing with the stride; heading follows where they're going
      if (stepping) w.phase += dt * w.speed * 5.2;
      const swing = stepping ? Math.sin(w.phase) * (w.kind === "jogger" ? 0.8 : 0.5) : 0;
      // facing +x is 0; across the road is +z from the near side (−π/2), −z from the far side (π/2)
      const heading = w.mode === "enter" ? -Math.PI / 2 : w.mode !== "walk" ? (w.side === 0 ? -Math.PI / 2 : Math.PI / 2) : w.dir > 0 ? 0 : Math.PI;
      const bob = stepping ? Math.abs(Math.cos(w.phase)) * 0.025 : 0;
      tmp.q.setFromAxisAngle(tmp.v.set(0, 1, 0), heading);
      tmp.root.compose(tmp.v.set(w.x, bob, w.z), tmp.q, tmp.s.setScalar(w.height * 1.7));
      place(i, "legL", swing, "hip"); place(i, "legR", -swing, "hip");
      place(i, "armL", -swing * 0.8, "shoulder"); place(i, "armR", rain ? -1.2 : swing * 0.8, "shoulder");
      place(i, "torso", 0); place(i, "head", 0); place(i, "hair", 0);
      if (w.look.bag) place(i, "bag", 0); else hide(i, "bag");
      if (rain) place(i, "umbrella", 0); else hide(i, "umbrella");
    });
    for (const k of KEYS) { const m = meshes.current[k]; if (m) m.instanceMatrix.needsUpdate = true; }
    frame.current++;

    function hide(i: number, k: PartKey) { meshes.current[k]?.setMatrixAt(i, tmp.hide); }
    function hideAll(i: number) { for (const k of KEYS) hide(i, k); }
    /** Place part k of walker i: hung from its pivot (hip / shoulder) and swung, or just positioned. */
    function place(i: number, k: PartKey, angle: number, pivot?: "hip" | "shoulder") {
      const p = PARTS[k] as { size: readonly number[]; at?: readonly number[]; hip?: readonly number[]; shoulder?: readonly number[] };
      const m = meshes.current[k];
      if (!m) return;
      if (pivot) {
        const pv = p[pivot]!;
        tmp.e.set(0, 0, angle);
        tmp.q.setFromEuler(tmp.e);
        // pivot at the joint, the limb hanging below it
        tmp.local.compose(tmp.v.set(pv[0], pv[1], pv[2]), tmp.q, tmp.s.set(1, 1, 1));
        tmp.pivot.makeTranslation(0, -p.size[1] / 2, 0);
        tmp.local.multiply(tmp.pivot);
      } else {
        const a = p.at!;
        tmp.local.makeTranslation(a[0], a[1], a[2]);
      }
      tmp.out.multiplyMatrices(tmp.root, tmp.local);
      tmp.out.multiply(tmp.pivot.makeScale(p.size[0], p.size[1], p.size[2]));
      m.setMatrixAt(i, tmp.out);
    }
  });

  return (
    <group>
      {KEYS.map((k) => (
        <instancedMesh
          key={k}
          ref={(m) => { meshes.current[k] = m; }}
          args={[undefined, undefined, Math.max(1, count)]}
          frustumCulled={false}
        >
          {k === "umbrella" ? <coneGeometry args={[0.5, 0.6, 8]} /> : <boxGeometry args={[1, 1, 1]} />}
          <meshStandardMaterial roughness={0.8} />
        </instancedMesh>
      ))}
    </group>
  );
}
