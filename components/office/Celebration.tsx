"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useOffice } from "@/lib/store";
import type { DayTally } from "@/lib/team";
import { DINING } from "./palette";

/** Days in a row, ending today, that the team finished at least one report (today still counts while it's early). */
export function teamStreak(week: readonly DayTally[] | undefined): number {
  if (!week?.length) return 0;
  const days = [...week];
  if (days.at(-1)?.done === 0) days.pop(); // today has just started: count from yesterday
  let n = 0;
  for (let i = days.length - 1; i >= 0 && days[i].done > 0; i--) n++;
  return n;
}

const TOP_Y = 0.765;

/**
 * A birthday-style cake on the dining table when the team has finished reports every day for a whole week:
 * two tiers, white frosting, a candle per day with flickering flames.
 */
export function Celebration({ shadows }: { shadows: boolean }) {
  const streak = useOffice((s) => teamStreak(s.data.week));
  const flames = useRef<THREE.MeshStandardMaterial>(new THREE.MeshStandardMaterial({ color: "#fde68a", emissive: "#f59e0b", emissiveIntensity: 2, toneMapped: false }));
  useFrame(({ clock }) => {
    flames.current.emissiveIntensity = 2 + Math.sin(clock.elapsedTime * 17) * 0.4 + Math.sin(clock.elapsedTime * 7.3) * 0.3;
  });
  if (streak < 7) return null;
  const x = DINING.x - 0.65, z = DINING.z;
  return (
    <group position={[x, TOP_Y, z]}>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.015, 24]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.3} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.08, 0]} castShadow={shadows}>
        <cylinderGeometry args={[0.19, 0.19, 0.12, 24]} />
        <meshStandardMaterial color="#7c4a2d" />
      </mesh>
      <mesh position={[0, 0.145, 0]}>
        <cylinderGeometry args={[0.195, 0.195, 0.02, 24]} />
        <meshStandardMaterial color="#fdf2f8" />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow={shadows}>
        <cylinderGeometry args={[0.12, 0.12, 0.09, 20]} />
        <meshStandardMaterial color="#fdf2f8" />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2, r = 0.08;
        return (
          <group key={i} position={[Math.cos(a) * r, 0.245, Math.sin(a) * r]}>
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.06, 6]} />
              <meshStandardMaterial color={["#f472b6", "#60a5fa", "#facc15", "#34d399"][i % 4]} />
            </mesh>
            <mesh position={[0, 0.07, 0]} scale={[1, 1.8, 1]} material={flames.current}>
              <sphereGeometry args={[0.009, 8, 6]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
