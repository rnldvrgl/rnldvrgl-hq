"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneNow } from "@/lib/store";
import { ROOM } from "./palette";
import { FAR_WALK, SIDE_STREETS } from "./world";
import { PROCESSION, processionState, processionX } from "./procession";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { mergeParts, mergePlaced, placed, type Part } from "./batch";
import { bannerTexture, person } from "./holiday-kit";

/**
 * The May fiesta (Flores de Mayo), on top of the banderitas across the street and along the shops (Festive.tsx):
 *   an arko (an arch of bamboo covered in flowers, "Maligayang Piyesta!" across it) at the mouth of each side
 *   street, lit with bulbs at night;
 *   the Santacruzan walking slowly down the far lane: the Santa Cruz carried in front, then the sagala in their
 *   gowns, each under her own arch of flowers carried by two escorts in barong, Reyna Elena and the little
 *   Constantino last under the biggest one; the cars in that lane crawl behind (procession.ts);
 *   and the perya on the barangay court across the street: a small Ferris wheel turning with its rim of
 *   coloured bulbs, a colour-game stall and a ticket booth.
 * Draw calls: arches 3 (solid, bulbs, signs), procession 2, Ferris wheel 3 (frame, wheel, gondolas), wheel
 * bulbs 1, halos 1.
 */

const FLOWERS = ["#f472b6", "#f8fafc", "#facc15", "#ef4444", "#fb923c", "#c084fc"];
const BULBS = ["#ff5a5a", "#ffd23f", "#5ad1ff", "#7dff6a", "#ff6ad5"];
const LANE_Z = PROCESSION.z;

/** The basketball court across the street (Neighbourhood.tsx): the perya goes up on it. */
const COURT = { x0: -3.6, x1: 11.8, z0: FAR_WALK.z1 + 1.4, z1: FAR_WALK.z1 + 9.2 } as const;
const WHEEL = { x: COURT.x0 + 5.2, y: 3.9, z: COURT.z0 + 4.6, r: 3.0, cars: 8 } as const;

/** Flowers along an arc (centre cx, cy in the plane z, radius r, from angle a0 to a1), with leaves between. */
function flowerArc(P: Part[], bulbs: Part[], cx: number, cy: number, z: number, r: number, a0: number, a1: number, step: number, seed: number, bulbEvery = 3) {
  const n = Math.max(2, Math.round(Math.abs(a1 - a0) / step));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    P.push({ size: [0.14, 0.14, 0.14], pos: [x, y, z], rot: [0, 0, a], color: FLOWERS[(i + seed) % FLOWERS.length] });
    P.push({ size: [0.1, 0.06, 0.18], pos: [x + Math.cos(a) * 0.08, y + Math.sin(a) * 0.08, z], rot: [0, 0, a], color: "#16a34a" });
    if (i % bulbEvery === 0) bulbs.push({ size: [0.05, 0.05, 0.05], pos: [x - Math.cos(a) * 0.09, y - Math.sin(a) * 0.09, z + 0.08], color: BULBS[(i / bulbEvery + seed) % BULBS.length | 0] });
  }
}

/** A flowered arch carried in the procession: two bamboo poles at z ±w, the arch over the top. In the unit's frame. */
function carriedArch(P: Part[], bulbs: Part[], x: number, w: number, h: number, seed: number) {
  for (const s of [-1, 1]) P.push({ shape: "cyl", size: [0.025, h, 6], pos: [x, h / 2 + 0.6, s * w], color: "#c8a463" });
  // the arch runs across the lane (in the y–z plane), so build it in x–y and turn it
  const arc: Part[] = [], lit: Part[] = [];
  flowerArc(arc, lit, 0, 0, 0, w, 0, Math.PI, 0.2, seed, 2);
  const turn = (p: Part): Part => ({ ...p, pos: [x + p.pos[2], h + 0.6 + p.pos[1], -p.pos[0]], rot: [0, Math.PI / 2, p.rot?.[2] ?? 0] });
  P.push(...arc.map(turn));
  bulbs.push(...lit.map((p) => ({ ...p, pos: [x + 0.1, h + 0.6 + p.pos[1], -p.pos[0]] as const })));
}

/** The Santacruzan, front to back along +x from the head of the column, facing −x. */
function santacruzan(): { solid: Part[]; bulbs: Part[] } {
  const P: Part[] = [], B: Part[] = [];
  const face = (parts: Part[], dx: number, dz: number): Part[] =>
    // people are built facing +x: turn them round to face −x (the way the procession walks)
    parts.map((p) => ({ ...p, pos: [dx - p.pos[0], p.pos[1], dz - p.pos[2]], rot: p.rot ? [p.rot[0], (p.rot[1] ?? 0) + Math.PI, p.rot[2]] : [0, Math.PI, 0] }));
  // the Santa Cruz: a man carrying a wooden cross wound with flowers, a boy with a lantern beside him
  P.push(...face(person({ top: "#f5f0e1", bottom: "#111827", skin: 2 }), 0, 0));
  P.push({ size: [0.05, 1.3, 0.05], pos: [-0.25, 1.4, 0.15], color: "#6b4a33" }, { size: [0.05, 0.05, 0.5], pos: [-0.25, 1.75, 0.15], color: "#6b4a33" });
  for (let k = 0; k < 4; k++) P.push({ size: [0.08, 0.08, 0.08], pos: [-0.25, 1.2 + k * 0.22, 0.15 + (k % 2 ? 0.05 : -0.05)], color: FLOWERS[k] });
  P.push(...face(person({ top: "#f5f0e1", bottom: "#1f2937", skin: 1, scale: 0.6 }), 0.2, -0.5));
  P.push({ shape: "cyl", size: [0.07, 0.14, 8], pos: [-0.05, 0.62, -0.62], color: "#fde68a" });
  B.push({ size: [0.05, 0.05, 0.05], pos: [-0.05, 0.62, -0.7], color: "#ffd27a" });

  const queens = [
    { gown: "#fbcfe8", skin: 1 }, { gown: "#bfdbfe", skin: 3 }, { gown: "#fde68a", skin: 0 }, { gown: "#e9d5ff", skin: 1 }, { gown: "#f8fafc", skin: 3 },
  ];
  queens.forEach((q, i) => {
    const x = 1.9 + i * 1.9, last = i === queens.length - 1;
    // the sagala in her gown, a crown and a bouquet
    P.push(...face(person({ top: q.gown, bottom: q.gown, dress: true, skin: q.skin, hair: "#2a1d17" }), x, 0));
    P.push({ shape: "cyl", size: [0.3, 0.06, 14], pos: [x, 0.04, 0], color: q.gown });
    P.push({ shape: "cone", size: [last ? 0.12 : 0.09, last ? 0.16 : 0.1, 8], pos: [x, 1.7, 0], color: "#facc15" });
    P.push({ size: [0.14, 0.14, 0.14], pos: [x - 0.2, 1.0, 0.1], color: FLOWERS[i] }, { size: [0.1, 0.1, 0.1], pos: [x - 0.24, 1.08, 0.04], color: "#f8fafc" });
    if (last) {
      // Reyna Elena carries the little cross; Constantino walks at her side
      P.push({ size: [0.03, 0.4, 0.03], pos: [x - 0.22, 1.15, -0.1], color: "#facc15" }, { size: [0.03, 0.03, 0.18], pos: [x - 0.22, 1.25, -0.1], color: "#facc15" });
      P.push(...face(person({ top: "#f5f0e1", bottom: "#1f2937", skin: 2, scale: 0.58 }), x + 0.1, -0.38));
      P.push({ shape: "cone", size: [0.06, 0.08, 8], pos: [x + 0.1, 1.0, -0.38], color: "#facc15" });
    }
    // the two escorts in barong carrying her arch
    for (const s of [-1, 1]) P.push(...face(person({ top: "#f5f0e1", bottom: "#111827", skin: (i + s + 4) % 5 }), x, s * 0.62));
    carriedArch(P, B, x - 0.22, last ? 0.68 : 0.62, last ? 1.65 : 1.45, i * 2);
  });
  return { solid: P, bulbs: B };
}

export function Fiesta({ frozen, lowPower }: { frozen: boolean; lowPower: boolean }) {
  const glowTex = useMemo(() => getGlowTexture(), []);
  const bulbMat = useRef<THREE.MeshBasicMaterial>(null);
  const wheelBulbMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const signMat = useRef<THREE.MeshBasicMaterial>(null);
  const paradeBulbMat = useRef<THREE.MeshBasicMaterial>(null);
  const procession = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const cars = useRef<THREE.InstancedMesh>(null);
  useEffect(() => { processionState.active = true; return () => { processionState.active = false; }; }, []);

  const arches = useMemo(() => {
    const P: Part[] = [], B: Part[] = [], halos: { x: number; y: number; z: number }[] = [];
    const tex = bannerTexture(["MALIGAYANG PIYESTA!"], { bg: "#fef3c7", ink: "#be123c", border: "#16a34a", w: 1024, h: 160 });
    const plane = new THREE.PlaneGeometry(1, 1);
    const signs: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    SIDE_STREETS.forEach((st, si) => {
      const z = ROOM.D - 0.5, x0 = st.x0 - 0.25, x1 = st.x1 + 0.25, cx = (x0 + x1) / 2, r = (x1 - x0) / 2, h = 2.6;
      // bamboo posts wrapped in leaves and flowers
      for (const x of [x0, x1]) {
        P.push({ shape: "cyl", size: [0.08, h, 8], pos: [x, h / 2, z], color: "#c8a463" });
        for (let k = 0; k < 9; k++) {
          P.push({ size: [0.2, 0.12, 0.2], pos: [x, 0.25 + k * 0.28, z], rotY: k * 0.7, color: k % 2 ? "#16a34a" : FLOWERS[(k + si) % FLOWERS.length] });
          if (k % 2 === 0) B.push({ size: [0.05, 0.05, 0.05], pos: [x, 0.3 + k * 0.28, z + 0.13], color: BULBS[k % BULBS.length] });
        }
      }
      // the arch over the top: two rows of flowers
      flowerArc(P, B, cx, h, z, r, 0, Math.PI, 0.13, si);
      flowerArc(P, B, cx, h, z - 0.16, r - 0.05, 0, Math.PI, 0.16, si + 3, 99);
      P.push({ size: [x1 - x0, 0.08, 0.08], pos: [cx, h - 0.05, z], color: "#c8a463" });
      signs.push({ geometry: plane, matrix: placed([cx, h + 0.35, z + 0.06], [0, 0, 0], [Math.min(2.6, r * 1.5), 0.4, 1]) });
      halos.push({ x: cx, y: h + r * 0.6, z: z + 0.2 });
    });
    const signGeo = mergePlaced(signs);
    plane.dispose();
    return { solid: mergeParts(P), bulbs: B, tex, signGeo, halos };
  }, []);

  const parade = useMemo(() => {
    const s = santacruzan();
    return { solid: mergeParts(s.solid), bulbs: mergeParts(s.bulbs) };
  }, []);

  const perya = useMemo(() => {
    const { x, y, z, r, cars: n } = WHEEL;
    const frame: Part[] = [], rim: Part[] = [], lights: Part[] = [];
    // the A-frame legs on both sides of the wheel, and the axle
    for (const s of [-1, 1]) {
      for (const dx of [-1.7, 1.7]) {
        const len = Math.hypot(dx, y), a = Math.atan2(dx, y);
        frame.push({ size: [0.1, len, 0.1], pos: [x + dx / 2, y / 2, z + s * 0.55], rot: [0, 0, a], color: "#e5e7eb" });
      }
      frame.push({ size: [3.6, 0.12, 0.12], pos: [x, 0.06, z + s * 0.55], color: "#9ca3af" });
    }
    frame.push({ shape: "cyl", size: [0.1, 1.3, 10], pos: [x, y, z], rot: [Math.PI / 2, 0, 0], color: "#6b7280" });
    // the ticket booth and the colour-game stall beside the wheel, a bench for the queue
    const bx = COURT.x0 + 9.6, bz = COURT.z0 + 1.6;
    frame.push({ size: [1.1, 1.9, 0.9], pos: [bx, 0.95, bz], color: "#fde68a" }, { size: [1.3, 0.1, 1.1], pos: [bx, 1.95, bz], color: "#dc2626" }, { size: [0.7, 0.45, 0.02], pos: [bx, 1.25, bz + 0.46], color: "#1f2937" });
    const gx = COURT.x0 + 11.6, gz = COURT.z0 + 3.2;
    for (const dx of [-1.1, 1.1]) for (const dz of [-0.7, 0.7]) frame.push({ size: [0.06, 2.1, 0.06], pos: [gx + dx, 1.05, gz + dz], color: "#9ca3af" });
    for (let k = 0; k < 6; k++) frame.push({ shape: "gable", size: [0.37, 0.5, 1.6], pos: [gx - 1.1 + 0.185 + k * 0.37, 2.1, gz], color: k % 2 ? "#f8fafc" : "#dc2626" });
    frame.push({ size: [2.0, 0.08, 1.2], pos: [gx, 0.8, gz], color: "#8a6a4a" });
    ["#ef4444", "#facc15", "#3b82f6", "#22c55e", "#ec4899", "#f8fafc"].forEach((c, k) => frame.push({ size: [0.55, 0.02, 0.45], pos: [gx - 0.62 + (k % 3) * 0.62, 0.85, gz - 0.25 + Math.floor(k / 3) * 0.5], color: c }));
    for (let k = 0; k < 10; k++) lights.push({ size: [0.06, 0.06, 0.06], pos: [gx - 1.1 + k * 0.244, 2.05, gz + 0.82], color: BULBS[k % BULBS.length] });

    // the wheel (in its own frame, turning about z): two rims, spokes, bulbs on the rims
    const segs = 28;
    for (const s of [-1, 1]) {
      for (let k = 0; k < segs; k++) {
        const a = (k / segs) * Math.PI * 2, len = 2 * Math.PI * r / segs;
        rim.push({ size: [len * 1.02, 0.08, 0.08], pos: [Math.cos(a + Math.PI / segs) * r, Math.sin(a + Math.PI / segs) * r, s * 0.4], rot: [0, 0, a + Math.PI / segs + Math.PI / 2], color: "#f8fafc" });
      }
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        rim.push({ size: [r, 0.05, 0.05], pos: [Math.cos(a) * r / 2, Math.sin(a) * r / 2, s * 0.4], rot: [0, 0, a], color: "#cbd5e1" });
      }
    }
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      rim.push({ size: [0.05, 0.05, 0.9], pos: [Math.cos(a) * r, Math.sin(a) * r, 0], color: "#9ca3af" });
    }
    const wheelBulbs: Part[] = [];
    for (const s of [-1, 1]) for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      wheelBulbs.push({ size: [0.07, 0.07, 0.07], pos: [Math.cos(a) * (r + 0.06), Math.sin(a) * (r + 0.06), s * 0.46], color: BULBS[k % BULBS.length] });
      if (k % 2 === 0) wheelBulbs.push({ size: [0.05, 0.05, 0.05], pos: [Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, s * 0.43], color: BULBS[(k + 2) % BULBS.length] });
    }
    // a gondola: an open bucket seat with a little roof, hung from its pivot at the top
    const car: Part[] = [
      { size: [0.02, 0.4, 0.02], pos: [0, -0.2, -0.32], color: "#9ca3af" }, { size: [0.02, 0.4, 0.02], pos: [0, -0.2, 0.32], color: "#9ca3af" },
      { size: [0.55, 0.32, 0.62], pos: [0, -0.6, 0], color: "#ffffff" },
      { size: [0.62, 0.05, 0.7], pos: [0, -0.02, 0], color: "#ffffff" },
    ];
    return { frame: mergeParts(frame), rim: mergeParts(rim), lights: mergeParts([...lights, ...arches.bulbs]), wheelBulbs: mergeParts(wheelBulbs), car: mergeParts(car) };
  }, [arches]);

  useLayoutEffect(() => {
    const m = cars.current;
    if (!m) return;
    const c = new THREE.Color();
    for (let i = 0; i < WHEEL.cars; i++) m.setColorAt(i, c.set(["#ef4444", "#3b82f6", "#facc15", "#22c55e"][i % 4]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  const halos = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const g = mergePlaced([
      ...arches.halos.map((h) => ({ geometry: plane, matrix: placed([h.x, h.y, h.z], [0, 0, 0], [3.2, 2.6, 1]) })),
      { geometry: plane, matrix: placed([WHEEL.x, WHEEL.y, WHEEL.z + 0.6], [0, 0, 0], [WHEEL.r * 3, WHEEL.r * 3, 1]) },
    ]);
    plane.dispose();
    return g;
  }, [arches]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }), []);
  useFrame(({ clock }) => {
    const t = frozen ? 0 : clock.elapsedTime, k = streetLightLevel();
    for (const m of [bulbMat.current, paradeBulbMat.current]) if (m) m.color.setScalar(0.5 + 0.9 * k);
    if (wheelBulbMat.current) wheelBulbMat.current.color.setScalar((0.5 + 0.9 * k) * (frozen ? 1 : 0.8 + 0.2 * Math.sin(t * 5)));
    if (haloMat.current) haloMat.current.opacity = k * 0.35;
    if (signMat.current) signMat.current.color.setScalar(0.85 + 0.2 * k);
    const x = processionX(sceneNow().getTime() / 1000);
    if (procession.current) procession.current.position.set(x, frozen ? 0 : Math.abs(Math.sin(t * 2.2)) * 0.012, LANE_Z);
    const a = t * (lowPower ? 0.1 : 0.14);
    if (wheel.current) wheel.current.rotation.z = a;
    const cm = cars.current;
    if (cm) {
      for (let i = 0; i < WHEEL.cars; i++) {
        const ca = a + (i / WHEEL.cars) * Math.PI * 2;
        // each gondola hangs straight down from its pivot whatever the wheel's angle
        tmp.v.set(WHEEL.x + Math.cos(ca) * WHEEL.r, WHEEL.y + Math.sin(ca) * WHEEL.r, WHEEL.z);
        cm.setMatrixAt(i, tmp.m.compose(tmp.v, tmp.q.identity(), tmp.s));
      }
      cm.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {arches.solid && <mesh geometry={arches.solid} castShadow><meshStandardMaterial vertexColors roughness={0.8} /></mesh>}
      {arches.signGeo && <mesh geometry={arches.signGeo}><meshBasicMaterial ref={signMat} map={arches.tex} side={THREE.DoubleSide} toneMapped={false} /></mesh>}
      {perya.lights && <mesh geometry={perya.lights}><meshBasicMaterial ref={bulbMat} vertexColors toneMapped={false} /></mesh>}
      {halos && (
        <mesh geometry={halos}>
          <meshBasicMaterial ref={haloMat} map={glowTex} color="#ffd9a0" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
      <group ref={procession} position={[PROCESSION.x1, 0, LANE_Z]}>
        {parade.solid && <mesh geometry={parade.solid} castShadow><meshStandardMaterial vertexColors roughness={0.75} /></mesh>}
        {parade.bulbs && <mesh geometry={parade.bulbs}><meshBasicMaterial ref={paradeBulbMat} vertexColors toneMapped={false} /></mesh>}
      </group>
      {perya.frame && <mesh geometry={perya.frame} castShadow><meshStandardMaterial vertexColors roughness={0.6} metalness={0.2} /></mesh>}
      <group ref={wheel} position={[WHEEL.x, WHEEL.y, WHEEL.z]}>
        {perya.rim && <mesh geometry={perya.rim} castShadow><meshStandardMaterial vertexColors roughness={0.5} metalness={0.3} /></mesh>}
        {perya.wheelBulbs && <mesh geometry={perya.wheelBulbs}><meshBasicMaterial ref={wheelBulbMat} vertexColors toneMapped={false} /></mesh>}
      </group>
      {perya.car && (
        <instancedMesh ref={cars} args={[perya.car, undefined, WHEEL.cars]} frustumCulled={false} castShadow>
          <meshStandardMaterial vertexColors roughness={0.6} />
        </instancedMesh>
      )}
    </group>
  );
}
