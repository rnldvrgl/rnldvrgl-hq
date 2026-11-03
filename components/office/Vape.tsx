"use client";

import { Suspense } from "react";
import { Text } from "@react-three/drei";
import { SCENE_FONT, VAPE, type Palette } from "./palette";
import { Plant } from "./Furniture";

const DECK = { w: 2.0, d: 3.0 } as const;

/**
 * The vaping patio past the parked car: timber deck, a slatted pergola, a round standing table in the middle
 * (the team stands around it at the 4 PM break), a lidded vape-disposal bin and two planters.
 */
export function VapeArea({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const { x, z } = VAPE;
  return (
    <group position={[x, 0, z]}>
      {/* deck */}
      <mesh position={[0, 0.02, 0]} receiveShadow={shadows}>
        <boxGeometry args={[DECK.w, 0.04, DECK.d]} />
        <meshStandardMaterial color="#9a7452" roughness={0.9} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0, 0.041, -DECK.d / 2 + 0.17 + i * 0.33]}>
          <boxGeometry args={[DECK.w, 0.002, 0.015]} />
          <meshBasicMaterial color="#7a5a3e" />
        </mesh>
      ))}

      {/* pergola: four posts, two beams, slats */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * (DECK.w / 2 - 0.1), 1.2, sz * (DECK.d / 2 - 0.1)]} castShadow={shadows}>
          <boxGeometry args={[0.09, 2.4, 0.09]} />
          <meshStandardMaterial color="#2b2f33" />
        </mesh>
      ))}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (DECK.w / 2 - 0.1), 2.42, 0]}>
          <boxGeometry args={[0.1, 0.1, DECK.d]} />
          <meshStandardMaterial color="#2b2f33" />
        </mesh>
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[0, 2.5, -DECK.d / 2 + 0.15 + i * 0.3]} castShadow={shadows}>
          <boxGeometry args={[DECK.w + 0.1, 0.05, 0.08]} />
          <meshStandardMaterial color="#b88a5e" />
        </mesh>
      ))}

      {/* standing table */}
      <mesh position={[0, 1.05, 0]} castShadow={shadows}>
        <cylinderGeometry args={[0.32, 0.32, 0.04, 24]} />
        <meshStandardMaterial color="#e9e6df" />
      </mesh>
      <mesh position={[0, 0.53, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 1.02, 10]} />
        <meshStandardMaterial color="#2b2f33" />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.22, 0.24, 0.04, 18]} />
        <meshStandardMaterial color="#2b2f33" />
      </mesh>

      {/* vape disposal bin by the corner post */}
      <group position={[DECK.w / 2 - 0.35, 0, -DECK.d / 2 + 0.35]}>
        <mesh position={[0, 0.42, 0]} castShadow={shadows}>
          <cylinderGeometry args={[0.15, 0.15, 0.84, 16]} />
          <meshStandardMaterial color="#9aa1a7" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.86, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.04, 16]} />
          <meshStandardMaterial color="#3a4046" />
        </mesh>
      </group>

      <Plant pal={pal} shadows={shadows} position={[-DECK.w / 2 + 0.3, 0.04, DECK.d / 2 - 0.3]} scale={0.7} />
      <Plant pal={pal} shadows={shadows} position={[DECK.w / 2 - 0.3, 0.04, DECK.d / 2 - 0.3]} scale={0.6} />

      {/* sign on the front post */}
      <group position={[-DECK.w / 2 + 0.1, 1.85, -DECK.d / 2 + 0.16]}>
        <mesh>
          <boxGeometry args={[0.7, 0.2, 0.02]} />
          <meshStandardMaterial color="#1b1f23" />
        </mesh>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0, 0.012]} fontSize={0.075} color="#f2f2ee" anchorX="center" anchorY="middle" letterSpacing={0.14}>
            VAPE AREA
          </Text>
        </Suspense>
      </group>
    </group>
  );
}
