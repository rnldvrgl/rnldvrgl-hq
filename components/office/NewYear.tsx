"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ROOM } from "./palette";
import { FAR_WALK, SIDEWALK } from "./world";
import { EST } from "./Neighbourhood";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { joinGeometries, mergeParts, mergePlaced, placed, type Part } from "./batch";
import { acrossStreet } from "./Festive";
import { tinted, at } from "./Holidays";
import { alongLine, bannerTexture, person } from "./holiday-kit";

/**
 * Bagong Taon, on top of the gold and silver bunting (Festive.tsx) and the midnight fireworks (Holidays.tsx):
 *   a big "Happy New Year <year>" banner strung across the main street by the office, lit at night;
 *   gold and silver globe lanterns hanging from the strings across the street;
 *   the media noche table out front of the office: twelve round fruits for luck, a bowl of coins, torotot
 *   (paper party horns), and two kids tooting theirs;
 *   a fruit stand at the sari-sari store piled with round fruit for sale;
 *   and confetti drifting down in front of the office around midnight.
 * Draw calls: banner 1, solid 1, lanterns 1, halos 1, kids 2, confetti 1.
 */

/** The banner: across the street just past the office, facing up and down the road. */
const BANNER = { x: ROOM.W + 4, y: 4.3, h: 1.3, z0: SIDEWALK.z0 + 0.3, z1: FAR_WALK.z1 - 0.3 } as const;
/** The media noche table, on the sidewalk in front of the office. */
const TABLE = { x: ROOM.W - 2.6, z: SIDEWALK.z0 + 0.55 } as const;

const FRUIT = ["#f97316", "#84cc16", "#7c3aed", "#facc15", "#ef4444", "#16a34a", "#fb923c", "#a3e635", "#9333ea", "#fde047", "#dc2626", "#65a30d"];
const TOROTOT = ["#ef4444", "#facc15", "#3b82f6", "#22c55e", "#ec4899"];

/** A torotot: a long paper cone, striped, in its own frame pointing +x from the mouthpiece. */
function torotot(x: number, y: number, z: number, rotY: number, rotZ: number, c: string): Part[] {
  return [
    { shape: "cone", size: [0.05, 0.36, 8], pos: [x + Math.cos(rotY) * 0.18, y + Math.sin(rotZ) * 0.18, z - Math.sin(rotY) * 0.18], rot: [0, rotY, rotZ + Math.PI / 2], color: c },
    { shape: "cyl", size: [0.052, 0.04, 8], pos: [x + Math.cos(rotY) * 0.33, y + Math.sin(rotZ) * 0.33, z - Math.sin(rotY) * 0.33], rot: [0, rotY, rotZ + Math.PI / 2], color: "#fde047" },
  ];
}

export function NewYear({ year, party, frozen, lowPower }: { year: number; party: boolean; frozen: boolean; lowPower: boolean }) {
  const glowTex = useMemo(() => getGlowTexture(), []);
  const bannerMat = useRef<THREE.MeshBasicMaterial>(null);
  const lanternMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const kidRefs = useRef<(THREE.Group | null)[]>([]);
  const confetti = useRef<THREE.InstancedMesh>(null);

  const banner = useMemo(() => {
    const len = BANNER.z1 - BANNER.z0, cz = (BANNER.z0 + BANNER.z1) / 2;
    const tex = bannerTexture([`HAPPY NEW YEAR ${year}!`, "Manigong Bagong Taon!"], { bg: "#7f1d1d", ink: "#fde68a", border: "#facc15", w: 2048, h: Math.round((2048 * BANNER.h) / len) });
    const plane = new THREE.PlaneGeometry(len, BANNER.h);
    // one face toward +x (the camera's side), one toward −x, so it reads from both ends of the street
    const geo = mergePlaced([
      { geometry: plane, matrix: placed([BANNER.x + 0.02, BANNER.y, cz], [0, Math.PI / 2, 0]) },
      { geometry: plane, matrix: placed([BANNER.x - 0.02, BANNER.y, cz], [0, -Math.PI / 2, 0]) },
    ]);
    plane.dispose();
    return { tex, geo };
  }, [year]);

  const built = useMemo(() => {
    const solid: Part[] = [], lanterns: THREE.BufferGeometry[] = [], halos: { x: number; y: number; z: number; r: number }[] = [];
    // the banner's poles, the rope, a gold fringe along the bottom
    const top = BANNER.y + BANNER.h / 2 + 0.2;
    for (const z of [BANNER.z0, BANNER.z1]) solid.push({ shape: "cyl", size: [0.06, top + 0.1, 8], pos: [BANNER.x, (top + 0.1) / 2 - 0.1, z], color: "#9ca3af" });
    solid.push({ size: [0.02, 0.02, BANNER.z1 - BANNER.z0], pos: [BANNER.x, top - 0.05, (BANNER.z0 + BANNER.z1) / 2], color: "#3f3a33" });
    solid.push({ size: [0.05, 0.08, BANNER.z1 - BANNER.z0 - 0.4], pos: [BANNER.x, BANNER.y - BANNER.h / 2 - 0.04, (BANNER.z0 + BANNER.z1) / 2], color: "#d4a017" });

    // gold and silver globe lanterns hanging from the strings across the street
    let k = 0;
    for (const ln of acrossStreet().lines) {
      const len = ln.a.distanceTo(ln.b), n = Math.max(2, Math.floor(len / 1.4));
      for (let i = 1; i < n; i++) {
        const p = alongLine(ln, i / n);
        const c = k++ % 2 ? "#e5e7eb" : "#fbbf24", r = 0.13 + (i % 3 === 1 ? 0.05 : 0);
        solid.push({ size: [0.012, 0.22, 0.012], pos: [p.x, p.y - 0.11, p.z], color: "#3f3a33" });
        lanterns.push(tinted(new THREE.SphereGeometry(r, 10, 8), c, at(p.x, p.y - 0.22 - r, p.z)));
        lanterns.push(tinted(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.05, 8), "#b45309", at(p.x, p.y - 0.22, p.z)));
        // a tassel of streamers below
        solid.push({ size: [0.02, 0.24, 0.05], pos: [p.x, p.y - 0.36 - r * 2, p.z], color: c === "#fbbf24" ? "#f59e0b" : "#cbd5e1" });
        halos.push({ x: p.x, y: p.y - 0.22 - r, z: p.z, r: r * 4.5 });
      }
    }

    // the media noche table: a red tablecloth, twelve round fruits in a ring and a pile, coins, torotot
    const { x: tx, z: tz } = TABLE;
    solid.push({ size: [1.5, 0.06, 0.75], pos: [tx, 0.74, tz], color: "#b91c1c" });
    solid.push({ size: [1.52, 0.18, 0.77], pos: [tx, 0.64, tz], color: "#dc2626" });
    for (const dx of [-0.65, 0.65]) for (const dz of [-0.3, 0.3]) solid.push({ size: [0.05, 0.55, 0.05], pos: [tx + dx, 0.28, tz + dz], color: "#6b4a33" });
    solid.push({ shape: "cyl", size: [0.3, 0.06, 16], pos: [tx - 0.15, 0.8, tz], color: "#e7e5e4" });
    FRUIT.forEach((c, i) => {
      const a = (i / 9) * Math.PI * 2, ring = i < 9;
      const r = i % 4 === 1 ? 0.07 : i % 4 === 3 ? 0.055 : 0.06;
      const fx = ring ? tx - 0.15 + Math.cos(a) * 0.2 : tx - 0.15 + (i - 10) * 0.06, fz = ring ? tz + Math.sin(a) * 0.2 : tz;
      solid.push({ shape: "cyl", size: [r, r * 1.6, 10], pos: [fx, 0.83 + r * 0.8 + (ring ? 0 : 0.1), fz], color: c });
    });
    // a pineapple-sized melon and a bunch of grapes beside the plate
    solid.push({ shape: "cyl", size: [0.12, 0.2, 12], pos: [tx + 0.42, 0.87, tz - 0.12], color: "#a3e635" });
    for (let g = 0; g < 7; g++) solid.push({ size: [0.045, 0.045, 0.045], pos: [tx + 0.42 + (g % 3) * 0.04 - 0.04, 0.8 + 0.03 + (g >> 2) * 0.04, tz + 0.18 + (g % 2) * 0.03], color: "#6d28d9" });
    // coins in a bowl, for a prosperous year
    solid.push({ shape: "cyl", size: [0.08, 0.05, 10], pos: [tx + 0.15, 0.8, tz + 0.22], color: "#f8fafc" });
    solid.push({ shape: "cyl", size: [0.065, 0.02, 10], pos: [tx + 0.15, 0.83, tz + 0.22], color: "#d4a017" });
    for (let i = 0; i < 3; i++) solid.push(...torotot(tx + 0.25 + i * 0.1, 0.79, tz - 0.25 + i * 0.05, 0.3 + i * 0.2, 0, TOROTOT[i]));

    // the fruit stand at the sari-sari store: crates piled with oranges, melons and grapes
    const sari = EST.find((e) => e.sign === "sari") ?? EST[0];
    const sx = sari.x1 - 1.2, sz = ROOM.D + 0.55;
    solid.push({ size: [1.6, 0.06, 0.7], pos: [sx, 0.7, sz], color: "#8a6a4a" });
    for (const dx of [-0.7, 0.7]) solid.push({ size: [0.06, 0.7, 0.6], pos: [sx + dx, 0.35, sz], color: "#6b4a33" });
    for (let c = 0; c < 3; c++) {
      const cx = sx - 0.5 + c * 0.5, col = ["#f97316", "#a3e635", "#7c3aed"][c];
      solid.push({ size: [0.45, 0.16, 0.5], pos: [cx, 0.81, sz], color: "#c8a463" });
      for (let i = 0; i < 9; i++) solid.push({ shape: "cyl", size: [0.055, 0.09, 8], pos: [cx - 0.13 + (i % 3) * 0.13, 0.93 + (i % 2) * 0.02, sz - 0.15 + Math.floor(i / 3) * 0.15], color: col });
    }
    solid.push({ size: [0.5, 0.3, 0.02], pos: [sx, 1.25, sz + 0.3], color: "#fde68a" });

    const plane = new THREE.PlaneGeometry(1, 1);
    const haloGeo = mergePlaced(halos.map((h) => ({ geometry: plane, matrix: placed([h.x, h.y, h.z + 0.02], [0, Math.PI / 4, 0], [h.r, h.r, 1]) })));
    plane.dispose();
    return { solid: mergeParts(solid), lanterns: joinGeometries(lanterns), halos: haloGeo };
  }, []);

  // two kids by the table, tooting their torotot
  const kids = useMemo(() => [
    { x: TABLE.x + 1.15, z: TABLE.z + 0.15, rot: Math.PI * 0.85, seed: 0, look: { top: "#facc15", bottom: "#1d4ed8", skin: 1, scale: 0.62 } },
    { x: TABLE.x - 1.1, z: TABLE.z + 0.25, rot: 0.2, seed: 1, look: { top: "#ec4899", bottom: "#f8fafc", dress: "short" as const, skin: 3, scale: 0.6 } },
  ].map((kd) => ({ ...kd, geo: mergeParts([...person(kd.look), ...torotot(0.12, 0.9, 0.0, 0, 0.15, TOROTOT[kd.seed + 3])]) })), []);

  // confetti: little paper squares drifting down over the office front and the banner
  const count = lowPower ? 120 : 320;
  const bits = useMemo(() => Array.from({ length: count }, (_, i) => {
    const r = (n: number) => { const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
    return { x: -2 + r(1) * (BANNER.x - -2 + 4), z: ROOM.D - 1 + r(2) * (FAR_WALK.z1 - ROOM.D + 1), h: 5 + r(3) * 2, speed: 0.35 + r(4) * 0.3, ph: r(5) * 10, spin: 2 + r(6) * 4 };
  }), [count]);
  useLayoutEffect(() => {
    const m = confetti.current;
    if (!m) return;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) m.setColorAt(i, c.set(TOROTOT[i % TOROTOT.length]).offsetHSL(0, 0, 0.05));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }), []);
  useFrame(({ clock }) => {
    const t = frozen ? 0 : clock.elapsedTime, k = streetLightLevel();
    if (bannerMat.current) bannerMat.current.color.setScalar(0.85 + 0.25 * k);
    if (lanternMat.current) lanternMat.current.color.setScalar(0.75 + 0.6 * k);
    if (haloMat.current) haloMat.current.opacity = k * 0.5;
    kids.forEach((kd, i) => {
      const g = kidRefs.current[i];
      if (!g) return;
      // a little hop, and the horn lifted for a toot now and then
      const toot = Math.max(0, Math.sin(t * 1.7 + kd.seed * 2));
      g.position.set(kd.x, frozen ? 0 : toot * 0.04, kd.z);
      g.rotation.set(0, kd.rot, frozen ? 0 : toot * 0.1);
    });
    const cm = confetti.current;
    if (cm) {
      cm.visible = party;
      if (party) {
        bits.forEach((b, i) => {
          const fall = (t * b.speed + b.ph) % b.h;
          tmp.v.set(b.x + Math.sin(t * 0.8 + b.ph) * 0.4, b.h - fall, b.z + Math.cos(t * 0.6 + b.ph) * 0.3);
          tmp.e.set(t * b.spin + b.ph, t * b.spin * 0.7, b.ph);
          cm.setMatrixAt(i, tmp.m.compose(tmp.v, tmp.q.setFromEuler(tmp.e), tmp.s));
        });
        cm.instanceMatrix.needsUpdate = true;
      }
    }
  });

  return (
    <group>
      {banner.geo && <mesh geometry={banner.geo}><meshBasicMaterial ref={bannerMat} map={banner.tex} toneMapped={false} /></mesh>}
      {built.solid && <mesh geometry={built.solid} castShadow><meshStandardMaterial vertexColors roughness={0.7} side={THREE.DoubleSide} /></mesh>}
      {built.lanterns && <mesh geometry={built.lanterns}><meshBasicMaterial ref={lanternMat} vertexColors toneMapped={false} /></mesh>}
      {built.halos && (
        <mesh geometry={built.halos}>
          <meshBasicMaterial ref={haloMat} map={glowTex} color="#ffe2a0" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
      {kids.map((kd, i) => kd.geo && (
        <group key={i} ref={(g) => { kidRefs.current[i] = g; }} position={[kd.x, 0, kd.z]} rotation={[0, kd.rot, 0]}>
          <mesh geometry={kd.geo} castShadow><meshStandardMaterial vertexColors roughness={0.85} /></mesh>
        </group>
      ))}
      <instancedMesh ref={confetti} args={[undefined, undefined, count]} frustumCulled={false}>
        <planeGeometry args={[0.06, 0.04]} />
        <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
