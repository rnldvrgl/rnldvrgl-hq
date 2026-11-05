"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneNow } from "@/lib/store";
import { PAL } from "./palette";
import { FAR_WALK } from "./world";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { mergeParts, type Part } from "./batch";

/**
 * Holy Week, Kapampangan style: the penitensya walking slowly down the far side of the main street, as in
 * the towns around Angeles and San Fernando. In front, the carroza (a float on wheels) carrying the Santo
 * Entierro under white flowers and candles, pushed by two men; behind it, magdarame (penitents with their
 * faces covered by a cloth and a crown of vines, beating their backs with bundles of bamboo strips) and
 * cross-bearers in maroon robes dragging heavy wooden crosses; at the end, women in black holding candles.
 * And a pabasa (the Passion chanted all day and night) under a tent by the barangay hall.
 *
 * The procession walks a loop down the street on the scene clock. Each figure is two merged meshes (its body
 * and its moving arm), the candles one glowing mesh with halos.
 */

type Role = "pusher" | "flagellant" | "cross" | "devotee";
type Fig = { role: Role; dx: number; dz: number; seed: number };

/** The column, front to back: offsets from the carroza (dx behind it, dz across the sidewalk). */
const COLUMN: readonly Fig[] = [
  { role: "pusher", dx: 1.25, dz: -0.3, seed: 0 }, { role: "pusher", dx: 1.25, dz: 0.3, seed: 1 },
  { role: "flagellant", dx: 2.6, dz: -0.25, seed: 2 }, { role: "flagellant", dx: 3.5, dz: 0.25, seed: 3 },
  { role: "cross", dx: 4.9, dz: 0, seed: 4 },
  { role: "flagellant", dx: 6.4, dz: -0.25, seed: 5 }, { role: "flagellant", dx: 7.3, dz: 0.25, seed: 6 },
  { role: "cross", dx: 8.8, dz: 0, seed: 7 },
  { role: "devotee", dx: 10.3, dz: -0.3, seed: 8 }, { role: "devotee", dx: 10.5, dz: 0.3, seed: 9 }, { role: "devotee", dx: 11.4, dz: 0, seed: 10 },
];

const SPEED = 0.4; // a slow, solemn walk
const RANGE = { x0: -42, x1: 80 } as const;
const LANE_Z = (FAR_WALK.z0 + FAR_WALK.z1) / 2;

/** One person in their own frame, facing -x (the way the procession walks), feet at 0. */
function figure(role: Role, seed: number): { body: Part[]; arm: Part[] } {
  const skin = PAL.skin[seed % PAL.skin.length];
  const B: Part[] = [], A: Part[] = [];
  const robe = role === "cross" ? "#6b1d1d" : role === "devotee" ? "#18181b" : role === "pusher" ? "#f5f5f4" : null;
  if (robe) {
    // a long robe to the ground
    B.push({ shape: "cyl", size: [0.2, 1.05, 8], pos: [0, 0.52, 0], color: robe });
    B.push({ size: [0.24, 0.38, 0.4], pos: [0, 1.22, 0], color: robe });
  } else {
    // bare-backed, dark trousers, a cloth tied round the waist
    B.push({ size: [0.16, 0.86, 0.32], pos: [0, 0.43, 0], color: "#1f2937" });
    B.push({ size: [0.2, 0.12, 0.36], pos: [0, 0.9, 0], color: "#f5f5f4" });
    B.push({ size: [0.2, 0.42, 0.36], pos: [0, 1.17, 0], color: skin });
  }
  // the head: covered with a cloth for the penitents (a crown of vines on top), a black veil for the women
  const hood = role === "flagellant" ? "#e7e5e4" : role === "cross" ? "#6b1d1d" : role === "devotee" ? "#27272a" : null;
  B.push({ size: [0.2, 0.22, 0.2], pos: [0, 1.53, 0], color: hood ?? skin });
  if (hood && role !== "devotee") {
    B.push({ size: [0.24, 0.16, 0.26], pos: [0.04, 1.4, 0], color: hood }); // the cloth falling over the shoulders
    B.push({ shape: "cyl", size: [0.13, 0.05, 8], pos: [0, 1.66, 0], color: "#3f6212" }); // crown of vines
  }
  if (!hood) B.push({ size: [0.21, 0.07, 0.21], pos: [0, 1.66, 0], color: "#1f1a17" });
  // the still arm
  B.push({ size: [0.08, 0.42, 0.08], pos: [0, 1.15, 0.22], color: robe ?? skin });

  // the moving arm, hung from its shoulder at (0, 1.36, -0.22)
  A.push({ size: [0.08, 0.42, 0.08], pos: [0, -0.2, 0], color: robe ?? skin });
  if (role === "flagellant") {
    // the bundle of bamboo strips on a cord
    for (let k = 0; k < 4; k++) A.push({ size: [0.015, 0.32, 0.015], pos: [(k - 1.5) * 0.015, -0.55, (k % 2) * 0.015], color: "#a16207" });
  }
  // the candle in her hand, turned so it stands upright while the arm is held out (rotation -1.25)
  if (role === "devotee") A.push({ shape: "cyl", size: [0.018, 0.2, 6], pos: [-0.047, -0.404, 0], rot: [0, 0, 1.25], color: "#f5f5f4" });
  return { body: B, arm: A };
}

/** A wooden cross on the shoulder, its foot dragging behind. In the cross-bearer's frame. */
const CROSS: Part[] = [
  { size: [2.3, 0.12, 0.12], pos: [0.55, 0.85, -0.15], rot: [0, 0, -0.62], color: "#5b3a22" },
  { size: [0.12, 0.12, 1.1], pos: [0.23, 1.07, -0.15], rot: [0, 0, -0.62], color: "#5b3a22" },
];

/** The carroza: a gilded wheeled float, white flowers, the Santo Entierro lying in state under a canopy, four candles. */
function carroza(): { solid: Part[]; flames: [number, number, number][] } {
  const gold = "#c9a227", S: Part[] = [];
  S.push({ size: [1.9, 0.5, 1.0], pos: [0, 0.55, 0], color: gold });
  S.push({ size: [1.95, 0.08, 1.05], pos: [0, 0.82, 0], color: "#7c5a10" });
  for (const x of [-0.7, 0.7]) for (const z of [-0.5, 0.5]) S.push({ shape: "cyl", size: [0.16, 0.06, 10], pos: [x, 0.16, z], rot: [Math.PI / 2, 0, 0], color: "#1f2937" });
  // flowers all round the edge
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    S.push({ size: [0.16, 0.12, 0.16], pos: [Math.cos(a) * 0.85, 0.92, Math.sin(a) * 0.42], color: k % 3 ? "#f8fafc" : "#fde68a" });
  }
  // the glass bier and the figure lying in it, a white shroud with a purple cloth
  S.push({ size: [1.3, 0.04, 0.5], pos: [0, 0.9, 0], color: "#f5f5f4" });
  S.push({ size: [1.1, 0.14, 0.28], pos: [0, 0.99, 0], color: "#f8fafc" });
  S.push({ size: [0.6, 0.05, 0.3], pos: [0.15, 1.08, 0], color: "#6d28d9" });
  S.push({ size: [0.16, 0.14, 0.18], pos: [-0.55, 1.02, 0], color: PAL.skin[2] });
  // four posts, the canopy
  for (const x of [-0.75, 0.75]) for (const z of [-0.38, 0.38]) S.push({ size: [0.04, 1.0, 0.04], pos: [x, 1.35, z], color: gold });
  S.push({ size: [1.7, 0.06, 0.9], pos: [0, 1.86, 0], color: "#6d28d9" });
  S.push({ size: [1.74, 0.12, 0.94], pos: [0, 1.93, 0], color: gold });
  const flames: [number, number, number][] = [];
  for (const x of [-0.82, 0.82]) for (const z of [-0.4, 0.4]) {
    S.push({ shape: "cyl", size: [0.03, 0.22, 6], pos: [x, 0.97, z], color: "#f5f5f4" });
    flames.push([x, 1.12, z]);
  }
  return { solid: S, flames };
}

/** The pabasa: a tent by the barangay hall, a table with the book, benches, chanters, a lamp. */
function pabasa(): Part[] {
  const x = 42.6, z = FAR_WALK.z1 + 3.2, S: Part[] = [];
  for (const dx of [-1.3, 1.3]) for (const dz of [-1, 1]) S.push({ size: [0.06, 2.2, 0.06], pos: [x + dx, 1.0, z + dz], color: "#9ca3af" });
  S.push({ shape: "gable", size: [3.0, 0.6, 2.4], pos: [x, 2.1, z], color: "#f5f5f4" });
  S.push({ size: [1.4, 0.06, 0.7], pos: [x, 0.72, z], color: "#6b4a33" });
  S.push({ size: [1.5, 0.05, 0.75], pos: [x, 0.76, z], color: "#6d28d9" });
  S.push({ size: [0.3, 0.05, 0.22], pos: [x, 0.8, z], color: "#f8fafc" });
  for (const dz of [-0.75, 0.75]) S.push({ size: [1.8, 0.35, 0.3], pos: [x, 0.12, z + dz], color: "#8a6a4a" });
  // two chanters seated on each side
  for (const dz of [-0.75, 0.75]) for (const dx of [-0.4, 0.4]) {
    S.push({ size: [0.3, 0.5, 0.26], pos: [x + dx, 0.55, z + dz], color: "#18181b" });
    S.push({ size: [0.18, 0.2, 0.18], pos: [x + dx, 0.92, z + dz], color: PAL.skin[(dx > 0 ? 1 : 3)] });
  }
  return S;
}

export function Penitensya({ frozen }: { frozen: boolean }) {
  const root = useRef<THREE.Group>(null);
  const figs = useRef<(THREE.Group | null)[]>([]);
  const arms = useRef<(THREE.Group | null)[]>([]);
  const flameMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowTex = useMemo(() => getGlowTexture(), []);

  const geo = useMemo(() => {
    const c = carroza();
    // the devotees' candle flames, in their arm frames, plus the float's
    const flamesCar = mergeParts(c.flames.map((p) => ({ size: [0.03, 0.06, 0.03], pos: p, color: "#fbbf24" })));
    const halosCar = c.flames;
    return {
      people: COLUMN.map((f) => { const g = figure(f.role, f.seed); return { body: mergeParts(g.body), arm: mergeParts(g.arm) }; }),
      cross: mergeParts(CROSS),
      carroza: mergeParts(c.solid),
      flamesCar, halosCar,
      pabasa: mergeParts(pabasa()),
      flame: new THREE.BoxGeometry(0.03, 0.06, 0.03),
      halo: new THREE.PlaneGeometry(0.45, 0.45),
    };
  }, []);

  useFrame(({ clock }) => {
    const t = frozen ? 0 : clock.elapsedTime;
    const sec = sceneNow().getTime() / 1000;
    const len = RANGE.x1 - RANGE.x0 + 14;
    const x = RANGE.x1 - ((sec * SPEED) % len);
    if (root.current) root.current.position.set(x, 0, LANE_Z);
    COLUMN.forEach((f, i) => {
      const g = figs.current[i], a = arms.current[i];
      if (!g || !a) return;
      const step = t * 2.4 + f.seed;
      g.position.set(f.dx, Math.abs(Math.sin(step)) * 0.02, f.dz);
      if (f.role === "flagellant") {
        // up over the shoulder and down onto the back, again and again
        const k = (t * 0.9 + f.seed * 0.37) % 1;
        a.rotation.z = k < 0.6 ? 2.6 * (k / 0.6) : 2.6 - 2.6 * ((k - 0.6) / 0.4);
      } else if (f.role === "devotee") {
        a.rotation.z = -1.25; // the candle held up in front
      } else if (f.role === "pusher") {
        a.rotation.z = -1.4; // hands on the float
      } else {
        a.rotation.z = -2.2 + Math.sin(step) * 0.05; // steadying the cross on the shoulder
      }
    });
    const k = streetLightLevel();
    if (flameMat.current) flameMat.current.color.setScalar(0.8 + 0.6 * k + (frozen ? 0 : Math.sin(t * 13) * 0.08));
    if (haloMat.current) haloMat.current.opacity = 0.1 + k * 0.6;
  });

  return (
    <group>
      {geo.pabasa && <mesh geometry={geo.pabasa}><meshStandardMaterial vertexColors roughness={0.85} /></mesh>}
      <group ref={root} position={[RANGE.x1, 0, LANE_Z]}>
        {geo.carroza && <mesh geometry={geo.carroza}><meshStandardMaterial vertexColors roughness={0.5} metalness={0.25} /></mesh>}
        {geo.flamesCar && <mesh geometry={geo.flamesCar}><meshBasicMaterial ref={flameMat} color="#ffd27a" toneMapped={false} /></mesh>}
        {geo.halosCar.map((p, i) => (
          <mesh key={i} geometry={geo.halo} position={[p[0], p[1], p[2] + 0.05]} rotation={[0, Math.PI / 4, 0]}>
            <meshBasicMaterial ref={i === 0 ? haloMat : undefined} map={glowTex} color="#ffcf8a" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        ))}
        {COLUMN.map((f, i) => (
          <group key={i} ref={(g) => { figs.current[i] = g; }} position={[f.dx, 0, f.dz]}>
            {geo.people[i].body && <mesh geometry={geo.people[i].body!}><meshStandardMaterial vertexColors roughness={0.85} /></mesh>}
            <group ref={(g) => { arms.current[i] = g; }} position={[0, 1.36, -0.22]}>
              {geo.people[i].arm && <mesh geometry={geo.people[i].arm!}><meshStandardMaterial vertexColors roughness={0.85} /></mesh>}
              {f.role === "devotee" && (
                <>
                  <mesh geometry={geo.flame} position={[-0.114 - 0.03, -0.382 + 0.01, 0]} rotation={[0, 0, 1.25]}><meshBasicMaterial color="#ffd27a" toneMapped={false} /></mesh>
                  <mesh geometry={geo.halo} position={[-0.15, -0.37, 0.04]} rotation={[0, Math.PI / 4, 0]}>
                    <meshBasicMaterial map={glowTex} color="#ffcf8a" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                  </mesh>
                </>
              )}
            </group>
            {f.role === "cross" && geo.cross && <mesh geometry={geo.cross}><meshStandardMaterial vertexColors roughness={0.9} /></mesh>}
          </group>
        ))}
      </group>
    </group>
  );
}
