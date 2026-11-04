"use client";

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { SCENE_FONT, VAPE, VAPE_DECK, type Palette } from "./palette";
import { Plant } from "./Furniture";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { mergeParts, type Part } from "./batch";

const STEEL = "#2b2f33", TIMBER = "#9a7452", TIMBER_DARK = "#7a5a3e", BENCH = "#b88a5e";
/** Roof height at the front and back edges (it falls toward the back, where the gutter is). */
const ROOF_FRONT = 2.62, ROOF_BACK = 2.42;

/**
 * The vape gazebo at the back of the lot: a timber deck under a smoked polycarbonate roof on steel posts (rain
 * runs off the back into a gutter and downpipe), a lattice screen with a climbing plant behind, a long bench,
 * the round standing table in the middle (the team stands around it at the 4 PM break), a vape-disposal bin and
 * a pendant lamp that comes on at dusk. People under it stay dry: the rain stops at the roof (see ROOFS in world.ts).
 */
export function VapeArea({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const { x, z } = VAPE;
  const { w, d } = VAPE_DECK;
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  const pool = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const glow = useMemo(() => getGlowTexture(), []);

  useFrame(() => {
    const k = streetLightLevel();
    if (bulb.current) bulb.current.emissiveIntensity = 0.15 + k * 2.6;
    if (pool.current) pool.current.opacity = k * 0.55;
    if (halo.current) halo.current.opacity = k * 0.6;
  });

  // the static frame, deck boards, bench and lattice, merged into one mesh
  const frame = useMemo(() => {
    const p: Part[] = [];
    const px = w / 2 - 0.08, pz = d / 2 - 0.08;
    // deck and its boards
    p.push({ size: [w, 0.06, d], pos: [0, 0.03, 0], color: TIMBER });
    for (let i = 0; i < 10; i++) p.push({ size: [w, 0.004, 0.014], pos: [0, 0.062, -d / 2 + 0.16 + i * 0.33], color: TIMBER_DARK });
    // posts: the front ones are taller (the roof falls toward the back)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const h = sz > 0 ? ROOF_FRONT : ROOF_BACK;
      p.push({ size: [0.09, h, 0.09], pos: [sx * px, h / 2, sz * pz], color: STEEL });
    }
    // ring beams under the roof, and purlins across it
    p.push({ size: [w + 0.06, 0.1, 0.08], pos: [0, ROOF_FRONT - 0.05, pz], color: STEEL });
    p.push({ size: [w + 0.06, 0.1, 0.08], pos: [0, ROOF_BACK - 0.05, -pz], color: STEEL });
    const slope = Math.atan2(ROOF_FRONT - ROOF_BACK, 2 * pz);
    for (const sx of [-1, 1]) p.push({ size: [0.08, 0.1, 2 * pz + 0.1], pos: [sx * px, (ROOF_FRONT + ROOF_BACK) / 2 - 0.05, 0], rot: [-slope, 0, 0], color: STEEL });
    for (let i = 1; i < 5; i++) {
      const t = i / 5, zz = -pz + t * 2 * pz;
      p.push({ size: [w + 0.2, 0.04, 0.05], pos: [0, ROOF_BACK + (ROOF_FRONT - ROOF_BACK) * t + 0.02, zz], color: "#3a4046" });
    }
    // gutter along the back and a downpipe at the back-right post
    p.push({ size: [w + 0.3, 0.08, 0.1], pos: [0, ROOF_BACK - 0.02, -d / 2 - 0.12], color: "#d6d3cc" });
    p.push({ shape: "cyl", size: [0.035, ROOF_BACK, 8], pos: [w / 2 + 0.1, ROOF_BACK / 2, -d / 2 - 0.12], color: "#d6d3cc" });
    // the lattice screen along the back, between the back posts
    const lh = 1.6, ly = 0.35 + lh / 2;
    for (let i = 0; i <= 8; i++) p.push({ size: [0.03, lh, 0.025], pos: [-px + (i * 2 * px) / 8, ly, -pz], color: BENCH });
    for (let j = 0; j <= 5; j++) p.push({ size: [2 * px, 0.03, 0.025], pos: [0, 0.35 + (j * lh) / 5, -pz], color: BENCH });
    // a long bench along the back, in front of the lattice
    const seatY = 0.44;
    p.push({ size: [w - 0.3, 0.05, 0.4], pos: [0, seatY, -d / 2 + 0.33], color: BENCH });
    p.push({ size: [w - 0.3, 0.05, 0.06], pos: [0, seatY + 0.3, -d / 2 + 0.15], color: BENCH });
    for (const bx of [-w / 2 + 0.3, 0, w / 2 - 0.3]) p.push({ size: [0.06, seatY, 0.34], pos: [bx, seatY / 2, -d / 2 + 0.33], color: STEEL });
    // standing table: top, column, foot
    p.push({ shape: "cyl", size: [0.32, 0.04, 24], pos: [0, 1.05, 0], color: "#e9e6df" });
    p.push({ shape: "cyl", size: [0.035, 1.0, 10], pos: [0, 0.55, 0], color: STEEL });
    p.push({ shape: "cyl", size: [0.23, 0.04, 18], pos: [0, 0.08, 0], color: STEEL });
    // the disposal bin by the front-right post
    p.push({ shape: "cyl", size: [0.15, 0.8, 16], pos: [w / 2 - 0.28, 0.46, d / 2 - 0.3], color: "#9aa1a7" });
    p.push({ shape: "cyl", size: [0.16, 0.04, 16], pos: [w / 2 - 0.28, 0.88, d / 2 - 0.3], color: "#3a4046" });
    // the pendant's cord and shade
    p.push({ shape: "cyl", size: [0.006, 0.42, 4], pos: [0, (ROOF_FRONT + ROOF_BACK) / 2 - 0.25, 0], color: "#111" });
    p.push({ shape: "cyl", size: [0.13, 0.1, 14], pos: [0, (ROOF_FRONT + ROOF_BACK) / 2 - 0.5, 0], color: "#1f2328" });
    // climbing vine on the lattice
    for (let i = 0; i < 14; i++) {
      const vx = -px + 0.1 + ((i * 0.37) % (2 * px - 0.2)), vy = 0.5 + ((i * 0.53) % 1.4);
      p.push({ size: [0.2, 0.16, 0.06], pos: [vx, vy, -pz + 0.03], rotY: i, color: i % 3 ? pal.leafA : pal.leafC });
    }
    return mergeParts(p);
  }, [w, d, pal.leafA, pal.leafC]);

  const roofY = (ROOF_FRONT + ROOF_BACK) / 2 + 0.05;
  const roofLen = Math.hypot(d + 0.3, ROOF_FRONT - ROOF_BACK);
  const lampY = (ROOF_FRONT + ROOF_BACK) / 2 - 0.56;

  return (
    <group position={[x, 0, z]}>
      {frame && (
        <mesh geometry={frame} castShadow={shadows} receiveShadow={shadows}>
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
      )}
      {/* smoked polycarbonate roof: see-through enough to watch the people under it */}
      <mesh position={[0, roofY, 0]} rotation={[-Math.PI / 2 - Math.atan2(ROOF_FRONT - ROOF_BACK, d), 0, 0]}>
        <planeGeometry args={[w + 0.3, roofLen]} />
        <meshStandardMaterial color="#8a9aa6" transparent opacity={0.26} roughness={0.2} metalness={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* pendant bulb, its halo, and the warm pool of light on the deck */}
      <mesh position={[0, lampY, 0]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial ref={bulb} color="#fff1c2" emissive="#ffcf7a" emissiveIntensity={0.15} toneMapped={false} />
      </mesh>
      <sprite position={[0, lampY, 0]} scale={[0.9, 0.9, 1]}>
        <spriteMaterial ref={halo} map={glow} color="#ffcf7a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh position={[0, 0.066, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 1.2, d * 0.95]} />
        <meshBasicMaterial ref={pool} map={glow} color="#ffcf7a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <Plant pal={pal} shadows={shadows} position={[-w / 2 + 0.22, 0.06, d / 2 - 0.25]} scale={0.6} />
      <Plant pal={pal} shadows={shadows} position={[-w / 2 + 0.28, 0.06, -d / 2 + 0.75]} scale={0.55} />

      {/* sign hanging from the front beam */}
      <group position={[-w / 4, ROOF_FRONT - 0.28, d / 2 - 0.06]}>
        <mesh>
          <boxGeometry args={[0.8, 0.22, 0.02]} />
          <meshStandardMaterial color="#1b1f23" />
        </mesh>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0, 0.012]} fontSize={0.08} color="#f2f2ee" anchorX="center" anchorY="middle" letterSpacing={0.14}>
            VAPE AREA
          </Text>
        </Suspense>
      </group>
    </group>
  );
}
