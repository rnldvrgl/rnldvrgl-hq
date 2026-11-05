"use client";

import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useOffice } from "@/lib/store";
import { useSettings, useShow } from "@/lib/settings";
import { OUTSIDE, ROOM, type Palette } from "./palette";
import { getGlowTexture, light } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { canvasTexture, mergeParts, mergePlaced, placed, type Part } from "./batch";
import { BACK_STREETS, BACK_X, FAR_WALK, GROUND, ROAD, ROAD_X, SIDE_STREETS, SIDEWALK, YARD_X1 } from "./world";
import { JUNCTIONS } from "./signals";

export { GROUND, SIDEWALK, ROAD, ROAD_X } from "./world";

/**
 * The ground the town stands on: one big lawn (big enough that you never see its edge), the main street
 * with sidewalks on both sides, two side streets leading to the residential streets behind the office,
 * concrete power poles with their wires along those streets, the office lot's curb, trees and hedges, and
 * street lamps (white crossing lights over every zebra). Everything static is batched: all streets are 1 draw call,
 * the lamps 11, the trees 3.
 */

const roadW = ROAD_X.x1 - ROAD_X.x0, roadCx = (ROAD_X.x0 + ROAD_X.x1) / 2;
const roadCz = (ROAD.z0 + ROAD.z1) / 2;

/* ------------------------------------------------------------------ trees (instanced) */

/** Deterministic 0–1 (so every device grows the same forest). */
function rng(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

type TreeSpot = readonly [number, number, number];
const NEAR_TREES: readonly TreeSpot[] = [
  // along the front sidewalk, between the lamps
  [1.5, SIDEWALK.z0 + 0.7, 1], [6.5, SIDEWALK.z0 + 0.7, 0.9], [11.5, SIDEWALK.z0 + 0.7, 1.05],
  // the office yard to the right of the patio
  [OUTSIDE.x1 + 1.4, 2.2, 1.1], [OUTSIDE.x1 + 2.6, 4.9, 0.9], [OUTSIDE.x1 + 1.5, 9.6, 1.0], [OUTSIDE.x1 + 4.4, 1.0, 0.8], [OUTSIDE.x1 + 4.7, 3.4, 0.95],
  // behind and left of the building
  [-2.2, 1.5, 1.15], [-2.4, 6.5, 1], [3.0, -2.4, 1.1], [9.5, -2.6, 0.95], [15.5, -2.2, 1.2], [-2.3, 10.2, 0.85], [21.5, -2.4, 1],
  // a strip of trees between the office lot and the houses behind it
  [0.5, -3.7, 1.05], [6.2, -3.9, 1.2], [12.6, -3.6, 1], [18.6, -4.0, 1.15], [25.2, -3.6, 1], [-10, -3.8, 1.1], [-17, -3.6, 0.95], [-24, -3.9, 1.1],
  [33, -3.8, 1.05], [40, -3.6, 1], [46.5, -3.9, 1.15],
  // backyards between the two residential streets
  [-30, -16.2, 1], [-12, -16.0, 1.1], [7, -16.3, 0.95], [22, -16.1, 1.1], [41, -16.2, 1], [60, -16.0, 1.05],
  // the far sidewalk
  [-19, FAR_WALK.z0 + 0.7, 1], [-1.5, FAR_WALK.z0 + 0.7, 0.95], [14.5, FAR_WALK.z0 + 0.7, 1.05], [29, FAR_WALK.z0 + 0.7, 0.9], [44, FAR_WALK.z0 + 0.7, 1],
  // the park across the street
  [30.5, 24.5, 1.25], [34.5, 23.2, 1.1], [38.5, 25.6, 1.3], [32.5, 28.3, 1], [37, 29.2, 1.15], [41, 23.6, 0.95],
];

/** Open fields around the town: a loose ring of trees out to where the camera can't reach. */
function fieldTrees(): TreeSpot[] {
  const r = rng(91);
  const out: TreeSpot[] = [];
  const builtUp = (x: number, z: number) => x > -50 && x < 82 && z > -36 && z < 36;
  const onRoad = (x: number, z: number) => (z > SIDEWALK.z0 - 1 && z < FAR_WALK.z1 + 1)
    || SIDE_STREETS.some((st) => x > st.x0 - 1 && x < st.x1 + 1 && z < SIDEWALK.z0)
    || BACK_STREETS.some((b) => z > b.z0 - 1 && z < b.z1 + 1);
  while (out.length < 150) {
    const x = -95 + r() * 205, z = -60 + r() * 130;
    if (builtUp(x, z) || onRoad(x, z)) continue;
    out.push([x, z, 0.8 + r() * 0.7]);
  }
  return out;
}

function Trees({ shadows }: { shadows: boolean }) {
  const lowPower = useOffice((s) => s.lowPower);
  const spots = useMemo(() => {
    const all = [...NEAR_TREES, ...fieldTrees()];
    return lowPower ? all.filter((_, i) => i < NEAR_TREES.length || i % 3 === 0) : all;
  }, [lowPower]);
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crownA = useRef<THREE.InstancedMesh>(null);
  const crownB = useRef<THREE.InstancedMesh>(null);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), lean: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3() }), []);
  const swaying = useRef(false);
  /** Place every tree; in wind the crowns lean and sway (the trunks stay put), each tree on its own phase. */
  const place = useCallback((t: number, wind: number) => {
    const { m, q, lean, e, v, s } = tmp;
    const up = new THREE.Vector3(0, 1, 0);
    spots.forEach(([x, z, k], i) => {
      const phase = x * 0.37 + z * 0.61;
      q.setFromAxisAngle(up, (x * 7.13 + z * 3.7) % (Math.PI * 2));
      s.setScalar(k);
      if (!swaying.current || wind === 0) trunk.current?.setMatrixAt(i, m.compose(v.set(x, -0.12 + 0.7 * k, z), q, s));
      const sway = wind * (0.18 + 0.1 * Math.sin(t * (1.6 + wind) + phase));
      lean.setFromEuler(e.set(0, 0, sway)).multiply(q);
      const dx = -Math.sin(sway) * 1.1 * k;
      crownA.current?.setMatrixAt(i, m.compose(v.set(x + dx, -0.12 + 1.75 * k, z), lean, s));
      crownB.current?.setMatrixAt(i, m.compose(v.set(x + 0.3 * k + dx * 1.4, -0.12 + 2.25 * k, z + 0.1 * k), lean, s));
    });
    for (const r of [trunk, crownA, crownB]) if (r.current) r.current.instanceMatrix.needsUpdate = true;
  }, [spots, tmp]);

  useLayoutEffect(() => {
    swaying.current = false;
    place(0, 0);
    for (const r of [trunk, crownA, crownB]) r.current?.computeBoundingSphere();
  }, [place]);

  useFrame(({ clock }) => {
    // only while it's windy (and once more to settle them back upright)
    const wind = useSettings.getState().motion === "full" ? light.wind : 0;
    if (wind > 0.02) { swaying.current = true; place(clock.elapsedTime, wind); }
    else if (swaying.current) { place(0, 0); swaying.current = false; }
  });

  return (
    <group>
      <instancedMesh key={`t${spots.length}`} ref={trunk} args={[undefined, undefined, spots.length]} castShadow={shadows}>
        <cylinderGeometry args={[0.08, 0.12, 1.4, 7]} />
        <meshStandardMaterial color="#6b4a33" />
      </instancedMesh>
      <instancedMesh key={`a${spots.length}`} ref={crownA} args={[undefined, undefined, spots.length]} castShadow={shadows}>
        <icosahedronGeometry args={[0.75, 0]} />
        <meshStandardMaterial color="#4f8a55" flatShading />
      </instancedMesh>
      <instancedMesh key={`b${spots.length}`} ref={crownB} args={[undefined, undefined, spots.length]} castShadow={shadows}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#5f9c62" flatShading />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------------------ street lamps (batched) */

const POLE_H = 2.8, ARM = 0.55;
/** A lamp: where its pole stands and which way its arm reaches (a unit step along x or z). */
type Lamp = { x: number; z: number; ax: number; az: number; h?: number; arm?: number };
const along = (z: number, dir: 1 | -1) => (x: number): Lamp => ({ x, z, ax: 0, az: dir });

/** The street lamps (warm sodium-ish LED): the main road, both residential streets, up both side streets. */
const LAMPS: readonly Lamp[] = [
  ...[-29, -20.5, -11.5, -1.2, 8, 16, OUTSIDE.x1 + 3, 31, 39.5, 48, 60, 72].map(along(SIDEWALK.z1 - 0.25, 1)),
  ...[-25, -13, 1, 12, 24, 36, 47, 61, 73].map(along(FAR_WALK.z0 + 0.25, -1)),
  // the residential streets: lamps on their +z side, reaching over the street
  ...[-34, -18, -1.5, 14, 30, 46, 62].map(along(BACK_STREETS[0].z1 + 0.25, -1)),
  ...[-26, -9, 8, 25, 42, 59].map(along(BACK_STREETS[1].z1 + 0.25, -1)),
  // up the side streets, on the edge across from the power poles, reaching over the street
  ...SIDE_STREETS.flatMap((st) => [-1.8, -12.6, -23.5, -33].map((z): Lamp => ({ x: st.x0 - 0.3, z, ax: 1, az: 0 }))),
];

/**
 * The pedestrian lanes: a taller, brighter white light on both kerbs of every zebra, reaching over the
 * crossing so people on it are lit at night (as the DPWH puts them up), with the blue crossing sign on the pole.
 */
const CROSSING_LAMPS: readonly Lamp[] = JUNCTIONS.flatMap((j) => [
  // beside the zebra (people wait on it at the kerb), on the side away from the walk signals' poles
  { x: j.crossX - j.crossW / 2 - 0.3, z: SIDEWALK.z1 - 0.2, ax: 0, az: 1, h: 3.4, arm: 1.3 },
  { x: j.crossX - j.crossW / 2 - 0.3, z: FAR_WALK.z0 + 0.2, ax: 0, az: -1, h: 3.4, arm: 1.3 },
]);

/** The blue pedestrian-crossing sign: a white triangle with someone walking on a zebra. */
function crossingSignTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = "#1d4ed8"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#ffffff"; g.fillRect(4, 4, 120, 4); g.fillRect(4, 120, 120, 4); g.fillRect(4, 4, 4, 120); g.fillRect(120, 4, 4, 120);
    g.beginPath(); g.moveTo(64, 16); g.lineTo(114, 108); g.lineTo(14, 108); g.closePath(); g.fill();
    g.fillStyle = "#111827";
    for (let k = 0; k < 4; k++) g.fillRect(34 + k * 16, 96, 9, 6);
    g.beginPath(); g.arc(66, 44, 7, 0, Math.PI * 2); g.fill();
    g.lineWidth = 7; g.lineCap = "round"; g.strokeStyle = "#111827";
    g.beginPath(); g.moveTo(64, 54); g.lineTo(60, 74); g.lineTo(50, 90); g.moveTo(60, 74); g.lineTo(72, 90); g.moveTo(52, 64); g.lineTo(64, 58); g.lineTo(76, 68); g.stroke();
  });
}

type Tint = { head: string; glow: string; pool: string; cone: string; bright: number };
const WARM: Tint = { head: "#fff6e0", glow: "#ffd9a0", pool: "#ffcf8a", cone: "#ffe2b0", bright: 1 };
const WHITE: Tint = { head: "#ffffff", glow: "#e6f0ff", pool: "#f1f6ff", cone: "#eef4ff", bright: 1.25 };

/**
 * A set of street lamps as five meshes: poles and arms (one vertex-coloured mesh), the LED heads (one emissive
 * mesh), and additive glow (halos, light cones and the pools on the ground). They come on at dusk.
 */
function LampSet({ lamps, tint, signs = false }: { lamps: readonly Lamp[]; tint: Tint; signs?: boolean }) {
  const head = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const cone = useRef<THREE.MeshBasicMaterial>(null);
  const pool = useRef<THREE.MeshBasicMaterial>(null);
  const sign = useRef<THREE.MeshStandardMaterial>(null);
  const glow = useMemo(() => getGlowTexture(), []);
  const signTex = useMemo(() => (signs ? crossingSignTexture() : null), [signs]);
  const geo = useMemo(() => {
    const poles: Part[] = [], heads: Part[] = [];
    const halos: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    const cones: typeof halos = [], pools: typeof halos = [], plates: typeof halos = [];
    const haloG = new THREE.PlaneGeometry(0.9, 0.9);
    const poolG = new THREE.PlaneGeometry(3.4, 3.4);
    const plateG = new THREE.PlaneGeometry(0.5, 0.5);
    const coneGs: THREE.BufferGeometry[] = [];
    for (const l of lamps) {
      const H = l.h ?? POLE_H, A = l.arm ?? ARM;
      const hx = l.x + l.ax * A, hz = l.z + l.az * A;
      const alongX = l.ax !== 0;
      poles.push({ shape: "cyl", size: [0.05, H, 8], pos: [l.x, H / 2 - 0.1, l.z], color: "#2b3238" });
      poles.push({ size: alongX ? [A, 0.05, 0.06] : [0.06, 0.05, A], pos: [l.x + (l.ax * A) / 2, H - 0.12, l.z + (l.az * A) / 2], color: "#2b3238" });
      poles.push({ size: alongX ? [0.3, 0.05, 0.18] : [0.18, 0.05, 0.3], pos: [hx, H - 0.15, hz], color: "#2b3238" });
      heads.push({ size: alongX ? [0.24, 0.015, 0.14] : [0.14, 0.015, 0.24], pos: [hx, H - 0.18, hz], color: tint.head });
      // halo faces the camera's usual direction (front-right, from above)
      halos.push({ geometry: haloG, matrix: placed([hx, H - 0.22, hz], [-0.62, Math.PI / 4, 0], [tint.bright, tint.bright, 1]) });
      const cg = new THREE.ConeGeometry(1.2 * tint.bright, H - 0.1, 20, 1, true);
      coneGs.push(cg);
      cones.push({ geometry: cg, matrix: placed([hx, (H - 0.3) / 2, hz]) });
      pools.push({ geometry: poolG, matrix: placed([hx, -0.086, hz], [-Math.PI / 2, 0, 0], [tint.bright, tint.bright, 1]) });
      // the crossing sign, on the pole facing the oncoming traffic of that lane (and a second facing the other way)
      if (signs) {
        for (const face of [Math.PI / 2, -Math.PI / 2]) plates.push({ geometry: plateG, matrix: placed([l.x + (face > 0 ? 0.04 : -0.04), 2.2, l.z], [0, face, 0]) });
      }
    }
    const out = { poles: mergeParts(poles), heads: mergeParts(heads), halos: mergePlaced(halos), cones: mergePlaced(cones), pools: mergePlaced(pools), plates: plates.length ? mergePlaced(plates) : null };
    haloG.dispose(); poolG.dispose(); plateG.dispose(); coneGs.forEach((g) => g.dispose());
    return out;
  }, [lamps, tint, signs]);

  useFrame(() => {
    const k = streetLightLevel();
    if (head.current) head.current.emissiveIntensity = 0.1 + k * 3.2 * tint.bright;
    if (halo.current) halo.current.opacity = k * 0.75;
    if (cone.current) cone.current.opacity = k * 0.09 * tint.bright;
    if (pool.current) pool.current.opacity = k * 0.7 * tint.bright;
    if (sign.current) sign.current.emissiveIntensity = 0.1 + k * 0.6;
  });

  return (
    <group>
      {geo.poles && <mesh geometry={geo.poles}><meshStandardMaterial vertexColors /></mesh>}
      {geo.heads && (
        <mesh geometry={geo.heads}>
          <meshStandardMaterial ref={head} vertexColors emissive={tint.glow} emissiveIntensity={0.1} toneMapped={false} />
        </mesh>
      )}
      {geo.plates && signTex && (
        <mesh geometry={geo.plates}>
          <meshStandardMaterial ref={sign} map={signTex} emissiveMap={signTex} emissive="#ffffff" emissiveIntensity={0.1} roughness={0.5} />
        </mesh>
      )}
      {geo.halos && (
        <mesh geometry={geo.halos} renderOrder={3}>
          <meshBasicMaterial ref={halo} map={glow} color={tint.glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {geo.cones && (
        <mesh geometry={geo.cones}>
          <meshBasicMaterial ref={cone} color={tint.cone} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
      {geo.pools && (
        <mesh geometry={geo.pools}>
          <meshBasicMaterial ref={pool} map={glow} color={tint.pool} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Every street lamp: the warm ones along the streets and the white ones over the pedestrian lanes. */
function StreetLights() {
  return (
    <>
      <LampSet lamps={LAMPS} tint={WARM} />
      <LampSet lamps={CROSSING_LAMPS} tint={WHITE} signs />
    </>
  );
}

/* ------------------------------------------------------------------ streets */

/** Lane dashes, sidewalk joints and the crossing stripes, as one instanced mesh of thin boxes. */
function Markings({ pal }: { pal: Palette }) {
  const dashes = useRef<THREE.InstancedMesh>(null);
  const joints = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const d: [number, number, number, number, number?][] = []; // x, z, length (x), width (z), y (road level by default)
    const atSide = (x: number, pad: number) => SIDE_STREETS.some((st) => x > st.x0 - pad && x < st.x1 + pad);
    const atBack = (z: number, pad: number) => BACK_STREETS.some((b) => z > b.z0 - pad && z < b.z1 + pad);
    for (let x = ROAD_X.x0 + 3; x < ROAD_X.x1 - 3; x += 2.4) {
      // the centre line breaks at each junction, where cars turn in and out of the side street, and at the zebras
      if (atSide(x, 0.6) || JUNCTIONS.some((j) => x > j.crossX - j.crossW / 2 - 0.8 && x < j.crossX + j.crossW / 2 + 0.8)) continue;
      d.push([x, roadCz, 1.1, 0.12]);
    }
    for (const st of SIDE_STREETS) {
      const cx = (st.x0 + st.x1) / 2;
      // the zebra crossing is where people actually walk: along the sidewalk, across the mouth of the side
      // street (stripes run along the side street, stepped across it), not out in the middle of the main road
      const n = 5, gap = (st.x1 - st.x0 - 0.3) / n;
      for (let i = 0; i < n; i++) d.push([st.x0 + 0.15 + gap * (i + 0.5), (SIDEWALK.z0 + SIDEWALK.z1) / 2, gap * 0.55, SIDEWALK.z1 - SIDEWALK.z0 - 0.2, 0.007]);
      // a stop line before the crossing, and the centre line, broken at the crossroads with the residential streets
      d.push([(st.x0 + cx) / 2, SIDEWALK.z0 - 0.35, (st.x1 - st.x0) / 2 - 0.15, 0.16]);
      for (let z = st.z0 + 2; z < SIDEWALK.z0 - 1.6; z += 2.4) if (!atBack(z, 0.8)) d.push([cx, z, 0.12, 1.1]);
    }
    // the signalised crossings over the main road (see signals.ts): bars along the traffic, stepped across the road,
    // and a stop line for each lane before them
    for (const j of JUNCTIONS) {
      for (let z = ROAD.z0 + 0.35; z < ROAD.z1 - 0.3; z += 0.6) d.push([j.crossX, z, j.crossW, 0.32, 0.007]);
      d.push([j.stopNear, (ROAD.z0 + roadCz) / 2, 0.18, roadCz - ROAD.z0 - 0.2, 0.007]);
      d.push([j.stopFar, (roadCz + ROAD.z1) / 2, 0.18, ROAD.z1 - roadCz - 0.2, 0.007]);
    }
    // residential streets: a centre line, broken at the side streets
    for (const b of BACK_STREETS) {
      for (let x = BACK_X.x0 + 2; x < BACK_X.x1 - 2; x += 2.4) if (!atSide(x, 0.8)) d.push([x, (b.z0 + b.z1) / 2, 1.1, 0.1]);
    }
    const j: [number, number][] = [];
    for (let x = -60; x < 80; x += 1.5) {
      if (!atSide(x, 0)) j.push([x, (SIDEWALK.z0 + SIDEWALK.z1) / 2]);
      j.push([x, (FAR_WALK.z0 + FAR_WALK.z1) / 2]);
    }
    return { d, j };
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    items.d.forEach(([x, z, l, w, y = -0.104], i) => dashes.current?.setMatrixAt(i, m.compose(v.set(x, y, z), q, s.set(l, 1, w))));
    items.j.forEach(([x, z], i) => joints.current?.setMatrixAt(i, m.compose(v.set(x, 0.002, z), q, s.set(1, 1, 1))));
    for (const r of [dashes, joints]) if (r.current) { r.current.instanceMatrix.needsUpdate = true; r.current.computeBoundingSphere(); }
  }, [items]);

  return (
    <group>
      <instancedMesh ref={dashes} args={[undefined, undefined, items.d.length]}>
        <boxGeometry args={[1, 0.004, 1]} />
        <meshBasicMaterial color="#f1ecd8" />
      </instancedMesh>
      <instancedMesh ref={joints} args={[undefined, undefined, items.j.length]}>
        <boxGeometry args={[0.02, 0.002, SIDEWALK.z1 - SIDEWALK.z0]} />
        <meshBasicMaterial color={pal.concreteSeam} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------------------ power lines (batched) */

const POST_H = 6.2;

/**
 * Concrete power poles with a crossarm, a transformer here and there, and the sagging bundle of wires
 * strung along the residential and side streets (so they never cross in front of the office).
 * One vertex-coloured mesh.
 */
function powerLineParts(): Part[] {
  const parts: Part[] = [];
  const wire = "#1b1f24";
  const pole = (x: number, z: number, along: "x" | "z", transformer: boolean) => {
    parts.push({ shape: "cyl", size: [0.11, POST_H, 7], pos: [x, POST_H / 2 - 0.12, z], color: "#a8a49b" });
    parts.push({ size: along === "x" ? [0.1, 0.1, 1.3] : [1.3, 0.1, 0.1], pos: [x, POST_H - 0.45, z], color: "#6b6f74" });
    if (transformer) parts.push({ shape: "cyl", size: [0.22, 0.6, 8], pos: along === "x" ? [x, POST_H - 1.3, z + 0.3] : [x + 0.3, POST_H - 1.3, z], color: "#7b8189" });
  };
  // the wires: three on the crossarm and one lower (telephone / cable), drawn as straight thin boxes per span
  const span = (ax: number, az: number, bx: number, bz: number, along: "x" | "z") => {
    const len = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    for (const [o, y] of [[-0.5, POST_H - 0.42], [0, POST_H - 0.42], [0.5, POST_H - 0.42], [0.15, POST_H - 1.7]] as const) {
      parts.push({
        size: along === "x" ? [len, 0.025, 0.025] : [0.025, 0.025, len],
        pos: along === "x" ? [mx, y - 0.12, mz + o] : [mx + o, y - 0.12, mz],
        color: wire,
      });
    }
  };
  for (const b of BACK_STREETS) {
    const z = b.z0 - 0.3; // on the houses' side, by their gates
    let prev: number | null = null, i = 0;
    for (let x = BACK_X.x0 + 4; x <= BACK_X.x1 - 4; x += 16) {
      if (SIDE_STREETS.some((st) => x > st.x0 - 0.6 && x < st.x1 + 0.6)) continue;
      pole(x, z, "x", i % 3 === 1);
      if (prev !== null) span(prev, z, x, z, "x");
      prev = x; i++;
    }
  }
  for (const st of SIDE_STREETS) {
    const x = st.x1 + 0.3;
    let prev: number | null = null;
    for (let z = SIDEWALK.z0 - 1.2; z > st.z0 + 4; z -= 14) {
      if (BACK_STREETS.some((b) => z > b.z0 - 0.6 && z < b.z1 + 0.6)) continue;
      pole(x, z, "z", false);
      if (prev !== null) span(x, prev, x, z, "z");
      prev = z;
    }
  }
  return parts;
}

export function Grounds({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const showTrees = useShow("trees");
  const showLamps = useShow("streetLights");
  /** Every street surface in one mesh: main road, side streets (and their dropped curbs), residential streets. */
  const asphalt = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const flat = (x: number, y: number, z: number, w: number, d: number) => ({ geometry: plane, matrix: placed([x, y, z], [-Math.PI / 2, 0, 0], [w, d, 1]) });
    const items = [flat(roadCx, -0.11, roadCz, roadW, ROAD.z1 - ROAD.z0)];
    for (const st of SIDE_STREETS) {
      const w = st.x1 - st.x0, cx = (st.x0 + st.x1) / 2, d = SIDEWALK.z1 - st.z0;
      items.push(flat(cx, -0.108, st.z0 + d / 2, w, d));
      // where it crosses the sidewalk: a dropped curb, asphalt on top
      items.push(flat(cx, 0.004, (SIDEWALK.z0 + SIDEWALK.z1) / 2, w, SIDEWALK.z1 - SIDEWALK.z0 + 0.02));
    }
    for (const b of BACK_STREETS) items.push(flat((BACK_X.x0 + BACK_X.x1) / 2, -0.106, (b.z0 + b.z1) / 2, BACK_X.x1 - BACK_X.x0, b.z1 - b.z0));
    const g = mergePlaced(items);
    plane.dispose();
    return g;
  }, []);
  const power = useMemo(() => mergeParts(powerLineParts()), []);
  const static_ = useMemo(() => mergeParts([
    // sidewalks and curbs on both sides of the street
    { size: [roadW, 0.1, SIDEWALK.z1 - SIDEWALK.z0], pos: [roadCx, -0.05, (SIDEWALK.z0 + SIDEWALK.z1) / 2], color: pal.concrete },
    { size: [roadW, 0.08, 0.12], pos: [roadCx, -0.03, SIDEWALK.z1], color: "#d6d3cc" },
    { size: [roadW, 0.1, FAR_WALK.z1 - FAR_WALK.z0], pos: [roadCx, -0.05, (FAR_WALK.z0 + FAR_WALK.z1) / 2], color: pal.concrete },
    { size: [roadW, 0.08, 0.12], pos: [roadCx, -0.03, FAR_WALK.z0], color: "#d6d3cc" },
    // the office lot: a low concrete curb around building + patio, so the property reads as one clean rectangle
    { size: [OUTSIDE.x1 + 0.5, 0.07, 0.18], pos: [(OUTSIDE.x1 - 0.5) / 2, -0.06, -0.34], color: "#c9c6bf" },
    { size: [0.18, 0.07, ROOM.D + 0.43], pos: [-0.34, -0.06, (ROOM.D - 0.43) / 2], color: "#c9c6bf" },
    { size: [0.18, 0.07, ROOM.D + 0.43], pos: [OUTSIDE.x1 + 0.09, -0.06, (ROOM.D - 0.43) / 2], color: "#c9c6bf" },
    // hedge line along the left of the building
    ...Array.from({ length: 9 }, (_, i): Part => ({ shape: "cyl", size: [0.36, 0.34, 7], pos: [-0.9, 0.08, 0.6 + i * 1.2], color: "#4a7f50" })),
    // the yard's low fence between the office and the next shop
    ...Array.from({ length: 12 }, (_, i): Part => ({ size: [0.06, 0.6, 0.06], pos: [YARD_X1, 0.18, 0.4 + i * 0.95], color: "#8a6a4a" })),
    { size: [0.04, 0.06, ROOM.D - 0.4], pos: [YARD_X1, 0.38, ROOM.D / 2 + 0.1], color: "#8a6a4a" },
    { size: [0.04, 0.06, ROOM.D - 0.4], pos: [YARD_X1, 0.18, ROOM.D / 2 + 0.1], color: "#8a6a4a" },
  ]), [pal]);

  return (
    <group>
      {/* the lawn: one huge plane */}
      <mesh position={[GROUND.cx, -0.13, GROUND.cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows}>
        <planeGeometry args={[GROUND.size, GROUND.size]} />
        <meshStandardMaterial color="#9bb48a" roughness={1} />
      </mesh>

      {/* every street */}
      {asphalt && (
        <mesh geometry={asphalt} receiveShadow={shadows}>
          <meshStandardMaterial color="#4b5057" roughness={0.9} />
        </mesh>
      )}
      <Markings pal={pal} />
      {power && <mesh geometry={power}><meshStandardMaterial vertexColors roughness={0.85} /></mesh>}

      {static_ && <mesh geometry={static_} receiveShadow={shadows}><meshStandardMaterial vertexColors roughness={0.95} /></mesh>}
      {showLamps && <StreetLights />}
      {showTrees && <Trees shadows={shadows} />}
    </group>
  );
}
