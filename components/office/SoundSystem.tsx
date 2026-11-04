"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { wooferLevel } from "@/lib/ambience";
import type { Palette } from "./palette";

/**
 * The office sound system under the big TV: two tower speakers either side of it and a subwoofer on the
 * floor. When sound is on and the office music is playing, the woofer cones pump on every kick and the
 * power LEDs glow. Everything still (and the LEDs off) when muted or with reduced motion.
 */

const CAB = "#1b1d21", GRILLE = "#2a2d33", CONE = "#111214", RING = "#3a3e45";

function Driver({ r, z, coneRef }: { r: number; z: number; coneRef?: React.RefObject<THREE.Group | null> }) {
  return (
    <group position={[0, 0, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 1.12, r * 1.12, 0.012, 24]} />
        <meshStandardMaterial color={RING} metalness={0.5} roughness={0.4} />
      </mesh>
      <group ref={coneRef}>
        <mesh position={[0, 0, 0.004]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[r, r * 0.35, 24, 1, true]} />
          <meshStandardMaterial color={CONE} side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <circleGeometry args={[r * 0.3, 16]} />
          <meshStandardMaterial color="#26282c" metalness={0.3} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function Tower({ position, shadows, cone, led }: { position: [number, number, number]; shadows: boolean; cone: React.RefObject<THREE.Group | null>; led: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  const H = 1.1, W = 0.26, D = 0.3;
  return (
    <group position={position}>
      <RoundedBox args={[W, H, D]} radius={0.02} smoothness={2} position={[0, H / 2 + 0.03, 0]} castShadow={shadows}>
        <meshStandardMaterial color={CAB} roughness={0.6} />
      </RoundedBox>
      {/* feet */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.09, 0.015, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.03, 10]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <group position={[0, 0, D / 2 + 0.002]}>
        {/* tweeter, two mids and the woofer down low */}
        <group position={[0, H - 0.1, 0]}><Driver r={0.035} z={0} /></group>
        <group position={[0, H - 0.3, 0]}><Driver r={0.075} z={0} /></group>
        <group position={[0, H - 0.52, 0]}><Driver r={0.075} z={0} /></group>
        <group position={[0, 0.3, 0]}><Driver r={0.1} z={0} coneRef={cone} /></group>
        <mesh position={[0, 0.1, 0.002]}>
          <circleGeometry args={[0.008, 8]} />
          <meshStandardMaterial ref={led} color="#1e293b" emissive="#38bdf8" emissiveIntensity={0} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

export function SoundSystem({ pal, shadows, reducedMotion, x0, x1 }: { pal: Palette; shadows: boolean; reducedMotion: boolean; x0: number; x1: number }) {
  const sub = useRef<THREE.Group>(null);
  const towerL = useRef<THREE.Group>(null);
  const towerR = useRef<THREE.Group>(null);
  const ledSub = useRef<THREE.MeshStandardMaterial>(null);
  const ledL = useRef<THREE.MeshStandardMaterial>(null);
  const ledR = useRef<THREE.MeshStandardMaterial>(null);
  const port = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const raw = wooferLevel();
    const k = reducedMotion ? 0 : raw;
    // the cones push out on each kick (the sub the most), the LEDs glow while the music plays
    if (sub.current) { sub.current.position.z = k * 0.03; sub.current.scale.setScalar(1 + k * 0.05); }
    for (const t of [towerL, towerR]) if (t.current) t.current.position.z = k * 0.012;
    const on = raw > 0 || ledOn();
    for (const l of [ledSub, ledL, ledR]) if (l.current) l.current.emissiveIntensity = on ? 1.4 : 0;
    if (port.current) port.current.emissiveIntensity = k * 0.8;
  });

  const S = 0.5; // subwoofer cube
  return (
    <group position={[0, 0, 0.22]}>
      <Tower position={[x0, 0, 0]} shadows={shadows} cone={towerL} led={ledL} />
      <Tower position={[x1, 0, 0]} shadows={shadows} cone={towerR} led={ledR} />
      {/* the subwoofer: a heavy cube on the floor beside the left tower, a big 12" cone and a bass port */}
      <group position={[x0 - 0.5, 0, 0.05]}>
        <RoundedBox args={[S, S, S]} radius={0.025} smoothness={2} position={[0, S / 2 + 0.02, 0]} castShadow={shadows}>
          <meshStandardMaterial color={CAB} roughness={0.55} />
        </RoundedBox>
        <group position={[0, S / 2 + 0.04, S / 2 + 0.002]}>
          <Driver r={0.17} z={0} coneRef={sub} />
          <mesh position={[0.17, -0.17, 0.002]}>
            <circleGeometry args={[0.035, 16]} />
            <meshStandardMaterial ref={port} color="#050506" emissive="#38bdf8" emissiveIntensity={0} toneMapped={false} />
          </mesh>
          <mesh position={[-0.19, -0.2, 0.003]}>
            <circleGeometry args={[0.009, 8]} />
            <meshStandardMaterial ref={ledSub} color="#1e293b" emissive="#38bdf8" emissiveIntensity={0} toneMapped={false} />
          </mesh>
        </group>
        {/* a strip of grille cloth along the top edge, in the room's accent wood */}
        <mesh position={[0, S + 0.03, 0]}>
          <boxGeometry args={[S - 0.04, 0.012, S - 0.04]} />
          <meshStandardMaterial color={pal.slatDark || GRILLE} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

/** The LEDs stay on between kicks while music plays: true when the woofer has moved in the last couple of seconds. */
let lastKickAt = 0;
function ledOn(): boolean {
  const now = performance.now();
  if (wooferLevel() > 0.05) lastKickAt = now;
  return now - lastKickAt < 2500;
}
