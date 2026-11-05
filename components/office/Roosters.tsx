"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneNow } from "@/lib/store";
import { CROW_S, crowing } from "@/lib/rooster";
import { mergeParts, type Part } from "./batch";
import { HOUSE_SLOTS } from "./homes";

/**
 * The manok on the street behind the office: three roosters (one strutting on a fence, two out front of their
 * houses by the road, one of them by its A-frame coop) and a few hens pecking around them. At dawn the roosters stretch up, flap and crow,
 * on the same schedule the sound plays (lib/rooster.ts). Each bird is two merged meshes: its body (with legs,
 * wings and tail) and its head, which bobs to peck and lifts to crow.
 */

type Bird = {
  rooster: number | null; // which rooster in the crow schedule, or null for a hen
  x: number; z: number; y: number;
  /** Wandering: half-length of the line it paces along x, and its heading at rest. */
  roam: number; face: number;
  seed: number;
};

const yard = (lotX: number) => {
  const s = HOUSE_SLOTS.find((h) => h.row === 0 && Math.abs(h.x - lotX) < 0.01)!;
  return { x: s.x, gateZ: s.gateZ };
};

const BIRDS: readonly Bird[] = (() => {
  const a = yard(-15.6), b = yard(45.2 - 7.6 * 1), c = yard(-0.4);
  return [
    // on the front fence of the house left of Maya's, looking at the street
    { rooster: 0, x: c.x + 4.2, z: c.gateZ, y: 1.17, roam: 0.5, face: -Math.PI / 2, seed: 1 },
    // out front of the fence by the street, where the fighting cocks are tied by their A-frame coop
    { rooster: 1, x: a.x + 3.6, z: a.gateZ + 0.3, y: 0, roam: 0.6, face: -0.4, seed: 2 },
    { rooster: null, x: a.x + 2.4, z: a.gateZ + 0.25, y: 0, roam: 0.5, face: -1.2, seed: 3 },
    { rooster: null, x: a.x + 4.4, z: a.gateZ + 0.35, y: 0, roam: 0.4, face: -2.2, seed: 4 },
    // in front of another house further along
    { rooster: 2, x: b.x + 3.6, z: b.gateZ + 0.3, y: 0, roam: 0.7, face: -0.6, seed: 5 },
    { rooster: null, x: b.x + 4.8, z: b.gateZ + 0.3, y: 0, roam: 0.5, face: -1.6, seed: 6 },
  ];
})();
/** The A-frame coop (kulungan) in the first yard. */
const COOP = (() => { const a = yard(-15.6); return { x: a.x + 1.0, z: a.gateZ + 0.05 }; })();

/** A bird in its own frame, facing +x, feet at 0. */
function bodyParts(rooster: boolean): Part[] {
  const body = rooster ? "#c2410c" : "#c08a3e";
  const wing = rooster ? "#9a3412" : "#a16207";
  const s = rooster ? 1 : 0.85;
  const p: Part[] = [
    { size: [0.3 * s, 0.2 * s, 0.18 * s], pos: [0, 0.24 * s, 0], color: body },
    { size: [0.2 * s, 0.12 * s, 0.14 * s], pos: [0.04 * s, 0.17 * s, 0], color: body },
    { size: [0.2 * s, 0.13 * s, 0.03], pos: [-0.01, 0.25 * s, 0.1 * s], color: wing },
    { size: [0.2 * s, 0.13 * s, 0.03], pos: [-0.01, 0.25 * s, -0.1 * s], color: wing },
    // the neck: golden hackles on a rooster
    { size: [0.1 * s, 0.16 * s, 0.11 * s], pos: [0.12 * s, 0.35 * s, 0], color: rooster ? "#f59e0b" : body },
    // legs
    { size: [0.02, 0.14, 0.02], pos: [0.01, 0.07, 0.04], color: "#eab308" },
    { size: [0.02, 0.14, 0.02], pos: [0.01, 0.07, -0.04], color: "#eab308" },
    { size: [0.07, 0.01, 0.05], pos: [0.03, 0.005, 0.04], color: "#eab308" },
    { size: [0.07, 0.01, 0.05], pos: [0.03, 0.005, -0.04], color: "#eab308" },
  ];
  if (rooster) {
    // the sickle tail: long dark-green feathers arching up and back
    const tail = ["#15803d", "#1f2937", "#16a34a", "#14532d"];
    tail.forEach((c, k) => p.push({ size: [0.04, 0.34 - k * 0.04, 0.02], pos: [-0.17 - k * 0.025, 0.42 - k * 0.03, (k - 1.5) * 0.025], rot: [0, 0, 0.55 + k * 0.15], color: c }));
  } else {
    p.push({ size: [0.08, 0.12, 0.1], pos: [-0.15 * s, 0.32 * s, 0], rot: [0, 0, 0.5], color: wing });
  }
  return p;
}

/** The head, its pivot at the top of the neck: comb, wattle, beak, eyes. */
function headParts(rooster: boolean): Part[] {
  const s = rooster ? 1 : 0.85;
  const p: Part[] = [
    { size: [0.09 * s, 0.09 * s, 0.08 * s], pos: [0.03, 0.03, 0], color: rooster ? "#f59e0b" : "#c08a3e" },
    { size: [0.05, 0.02, 0.025], pos: [0.095 * s, 0.025, 0], color: "#f59e0b" },
    { size: [0.02, 0.02, 0.085 * s], pos: [0.06 * s, 0.045, 0], color: "#111827" },
    { size: [0.025, rooster ? 0.06 : 0.03, 0.02], pos: [0.075 * s, -0.025, 0], color: "#dc2626" },
  ];
  // the comb: three red points on a rooster, one small one on a hen
  const n = rooster ? 3 : 1;
  for (let k = 0; k < n; k++) p.push({ size: [0.03, rooster ? 0.07 - Math.abs(k - 1) * 0.015 : 0.03, 0.02], pos: [0.06 - k * 0.03, 0.09, 0], color: "#dc2626" });
  return p;
}

function coopParts(): Part[] {
  const wood = "#8a6a4a", slat = "#a16207";
  // a little A-frame of bamboo slats against the fence (0.5 m deep, so it fits between the fence and the street)
  const p: Part[] = [{ size: [0.9, 0.03, 0.42], pos: [COOP.x, -0.08, COOP.z + 0.21], color: "#6b4a33" }];
  for (const side of [-1, 1]) p.push({ size: [0.9, 0.03, 0.34], pos: [COOP.x, 0.22, COOP.z + 0.21 + side * 0.11], rot: [side * 0.95, 0, 0], color: wood });
  for (let k = 0; k < 6; k++) p.push({ size: [0.02, 0.4, 0.02], pos: [COOP.x - 0.4 + k * 0.16, 0.16, COOP.z + 0.36], rot: [0.75, 0, 0], color: slat });
  return p;
}

export function Roosters() {
  const geo = useMemo(() => ({
    body: [mergeParts(bodyParts(true)), mergeParts(bodyParts(false))],
    head: [mergeParts(headParts(true)), mergeParts(headParts(false))],
    coop: mergeParts(coopParts()),
  }), []);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const heads = useRef<(THREE.Group | null)[]>([]);
  const bodies = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }) => {
    const now = sceneNow();
    const t = clock.elapsedTime;
    BIRDS.forEach((b, i) => {
      const g = groups.current[i], h = heads.current[i], body = bodies.current[i];
      if (!g || !h || !body) return;
      const crow = b.rooster !== null ? crowing(now, b.rooster) : null;
      // pace up and down a little, stopping to peck
      const cycle = (t * 0.12 + b.seed * 0.37) % 1;
      const walking = crow === null && cycle < 0.35;
      const along = Math.sin(((t * 0.12 + b.seed * 0.37) | 0) + b.seed) * b.roam;
      const k = walking ? cycle / 0.35 : 1;
      const prev = Math.sin((((t * 0.12 + b.seed * 0.37) | 0) - 1) + b.seed) * b.roam;
      const x = b.x + prev + (along - prev) * k;
      g.position.set(x, b.y + (walking ? Math.abs(Math.sin(t * 14)) * 0.012 : 0), b.z);
      g.rotation.y = walking ? (along >= prev ? 0 : Math.PI) : b.face;
      if (crow !== null) {
        // stretch up tall, head back, beak to the sky, wings beating
        const e = Math.sin(Math.min(1, crow / CROW_S) * Math.PI);
        h.rotation.z = 0.9 * e;
        h.position.y = 0.42 + 0.06 * e;
        body.rotation.z = 0.3 * e;
        body.scale.set(1, 1 + 0.08 * e, 1 + Math.abs(Math.sin(t * 22)) * 0.25 * e);
      } else {
        // peck, peck, look about
        const peck = !walking && Math.sin(t * 5 + b.seed * 3) > 0.55;
        h.rotation.z = peck ? -1.0 : Math.sin(t * 0.8 + b.seed) * 0.15;
        h.position.y = peck ? 0.3 : 0.42;
        body.rotation.z = peck ? -0.25 : 0;
        body.scale.set(1, 1, 1);
      }
    });
  });

  return (
    <group>
      {geo.coop && <mesh geometry={geo.coop}><meshStandardMaterial vertexColors roughness={0.9} /></mesh>}
      {BIRDS.map((b, i) => {
        const kind = b.rooster !== null ? 0 : 1;
        const s = kind === 0 ? 1 : 0.85;
        return (
          <group key={i} ref={(g) => { groups.current[i] = g; }} position={[b.x, b.y, b.z]} rotation={[0, b.face, 0]}>
            <group ref={(g) => { bodies.current[i] = g; }}>
              {geo.body[kind] && <mesh geometry={geo.body[kind]!}><meshStandardMaterial vertexColors roughness={0.8} /></mesh>}
              <group ref={(g) => { heads.current[i] = g; }} position={[0.14 * s, 0.42, 0]}>
                {geo.head[kind] && <mesh geometry={geo.head[kind]!}><meshStandardMaterial vertexColors roughness={0.7} /></mesh>}
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
}
