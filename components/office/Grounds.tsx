"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useOffice } from "@/lib/store";
import { OUTSIDE, ROOM, SCENE, type Palette } from "./palette";
import { getGlowTexture, light } from "./Lighting";

/**
 * Everything around the building, so the diorama sits in a neighbourhood instead of a void:
 * a lawn that fades softly at its edges, a street along the front (sidewalk, curb, lane markings),
 * trees and hedges, street lamps that come on at night, and a jeepney driving past now and then.
 */

const CX = (SCENE.x0 + SCENE.x1) / 2, CZ = ROOM.D / 2;
const GROUND = { w: 64, d: 56 } as const;
const SIDEWALK = { z0: ROOM.D + 0.05, z1: ROOM.D + 1.4 } as const;
const ROAD = { z0: SIDEWALK.z1, z1: SIDEWALK.z1 + 6.2 } as const;
const ROAD_X = { x0: -10, x1: OUTSIDE.x1 + 12 } as const;

/** Radial alpha (opaque centre → clear edge), for the island edge. */
function useEdgeFade(): THREE.CanvasTexture {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    if (g) {
      const r = g.createRadialGradient(128, 128, 60, 128, 128, 128);
      r.addColorStop(0, "#ffffff");
      r.addColorStop(0.75, "#ffffff");
      r.addColorStop(1, "#000000");
      g.fillStyle = r;
      g.fillRect(0, 0, 256, 256);
    }
    return new THREE.CanvasTexture(c);
  }, []);
}

/** Horizontal alpha (clear ends → opaque middle), so the road fades out instead of stopping. */
function useEndFade(): THREE.CanvasTexture {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 4;
    const g = c.getContext("2d");
    if (g) {
      const l = g.createLinearGradient(0, 0, 256, 0);
      l.addColorStop(0, "#000000");
      l.addColorStop(0.18, "#ffffff");
      l.addColorStop(0.82, "#ffffff");
      l.addColorStop(1, "#000000");
      g.fillStyle = l;
      g.fillRect(0, 0, 256, 4);
    }
    return new THREE.CanvasTexture(c);
  }, []);
}

const TREES: readonly (readonly [number, number, number])[] = [
  // along the front sidewalk
  [1.5, SIDEWALK.z0 + 0.7, 1], [6.5, SIDEWALK.z0 + 0.7, 0.9], [11.5, SIDEWALK.z0 + 0.7, 1.05],
  // the lawn to the right of the patio
  [OUTSIDE.x1 + 1.6, 2.2, 1.2], [OUTSIDE.x1 + 3.2, 5.6, 0.95], [OUTSIDE.x1 + 1.8, 9.2, 1.1], [OUTSIDE.x1 + 4.6, 1.0, 0.8],
  // behind and left of the building
  [-2.2, 1.5, 1.15], [-2.6, 6.5, 1], [3.0, -2.4, 1.1], [9.5, -2.6, 0.95], [15.5, -2.2, 1.2], [-2.4, 10.5, 0.85],
];

function Tree({ position, scale, shadows }: { position: [number, number, number]; scale: number; shadows: boolean }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.7, 0]} castShadow={shadows}>
        <cylinderGeometry args={[0.08, 0.12, 1.4, 7]} />
        <meshStandardMaterial color="#6b4a33" />
      </mesh>
      <mesh position={[0, 1.75, 0]} castShadow={shadows}>
        <icosahedronGeometry args={[0.75, 0]} />
        <meshStandardMaterial color="#4f8a55" flatShading />
      </mesh>
      <mesh position={[0.3, 2.25, 0.1]} castShadow={shadows}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#5f9c62" flatShading />
      </mesh>
    </group>
  );
}

/** A passenger jeepney: chrome hood, long colourful body, roof rack. Drives along the street every so often. */
function Jeepney({ shadows }: { shadows: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const lowPower = useOffice((s) => s.lowPower);
  const lane = ROAD.z0 + 4.3; // the far lane, driving toward -x
  const span = ROAD_X.x1 - ROAD_X.x0 + 8;
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const cycle = 46; // seconds between passes
    const t = (clock.elapsedTime % cycle) / 11; // ~11 s to cross
    g.visible = t < 1;
    g.position.set(ROAD_X.x1 + 4 - t * span, lowPower ? 0 : Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.015, lane);
  });
  const stripes = ["#e11d48", "#f59e0b", "#2563eb"];
  return (
    <group ref={ref} visible={false} rotation={[0, Math.PI / 2, 0]}>
      {/* body along local z (front = -z), turned to drive along -x */}
      <RoundedBox args={[1.7, 1.25, 4.6]} radius={0.08} smoothness={2} position={[0, 1.05, 0.4]} castShadow={shadows}>
        <meshStandardMaterial color="#f3f0e6" />
      </RoundedBox>
      {stripes.map((c, i) => (
        <mesh key={c} position={[0, 0.62 + i * 0.09, 0.4]}>
          <boxGeometry args={[1.72, 0.05, 4.62]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      <mesh position={[0, 1.25, 0.4]}>
        <boxGeometry args={[1.72, 0.38, 4.3]} />
        <meshStandardMaterial color="#1f2937" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 1.72, 0.4]}>
        <boxGeometry args={[1.8, 0.06, 4.7]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.3} />
      </mesh>
      <RoundedBox args={[1.5, 0.6, 1.0]} radius={0.08} smoothness={2} position={[0, 0.7, -2.3]} castShadow={shadows}>
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
      </RoundedBox>
      {[[-0.62, -2.0], [0.62, -2.0], [-0.62, 1.9], [0.62, 1.9]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x * 1.25, 0.32, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 16]} />
          <meshStandardMaterial color="#111417" />
        </mesh>
      ))}
    </group>
  );
}

export function Grounds({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const edge = useEdgeFade();
  const ends = useEndFade();
  const glow = useMemo(() => getGlowTexture(), []);
  const lamps = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const pools = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame(() => {
    lamps.current.forEach((m) => { if (m) m.emissiveIntensity = 0.1 + light.lamps * 2.2; });
    pools.current.forEach((m) => { if (m) m.opacity = light.lamps * 0.4; });
  });
  const lampXs = [0, 8, 16, OUTSIDE.x1 + 3];
  const roadW = ROAD_X.x1 - ROAD_X.x0, roadCx = (ROAD_X.x0 + ROAD_X.x1) / 2;

  return (
    <group>
      {/* lawn under everything, fading at the edges */}
      <mesh position={[CX, -0.13, CZ + 3]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows}>
        <planeGeometry args={[GROUND.w, GROUND.d]} />
        <meshStandardMaterial color="#9bb48a" roughness={1} transparent alphaMap={edge} depthWrite={false} />
      </mesh>

      {/* sidewalk and curb along the front */}
      <mesh position={[roadCx, -0.05, (SIDEWALK.z0 + SIDEWALK.z1) / 2]} receiveShadow={shadows}>
        <boxGeometry args={[roadW, 0.1, SIDEWALK.z1 - SIDEWALK.z0]} />
        <meshStandardMaterial color={pal.concrete} roughness={0.95} />
      </mesh>
      {Array.from({ length: Math.floor(roadW / 1.5) }, (_, i) => (
        <mesh key={i} position={[ROAD_X.x0 + 0.75 + i * 1.5, 0.002, (SIDEWALK.z0 + SIDEWALK.z1) / 2]}>
          <boxGeometry args={[0.02, 0.002, SIDEWALK.z1 - SIDEWALK.z0]} />
          <meshBasicMaterial color={pal.concreteSeam} />
        </mesh>
      ))}
      <mesh position={[roadCx, -0.03, SIDEWALK.z1]}>
        <boxGeometry args={[roadW, 0.08, 0.12]} />
        <meshStandardMaterial color="#d6d3cc" />
      </mesh>

      {/* the street: asphalt with a dashed centre line, fading out at both ends */}
      <mesh position={[roadCx, -0.11, (ROAD.z0 + ROAD.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows}>
        <planeGeometry args={[roadW, ROAD.z1 - ROAD.z0]} />
        <meshStandardMaterial color="#4b5057" roughness={0.9} transparent alphaMap={ends} depthWrite={false} />
      </mesh>
      {Array.from({ length: Math.floor(roadW / 2.4) }, (_, i) => (
        <mesh key={i} position={[ROAD_X.x0 + 3 + i * 2.4, -0.105, (ROAD.z0 + ROAD.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.1, 0.12]} />
          <meshBasicMaterial color="#f5f0dc" transparent opacity={i < 2 || i > Math.floor(roadW / 2.4) - 3 ? 0.25 : 0.85} />
        </mesh>
      ))}
      <Jeepney shadows={shadows} />

      {/* street lamps along the sidewalk */}
      {lampXs.map((x, i) => (
        <group key={x} position={[x, 0, SIDEWALK.z1 - 0.25]}>
          <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 2.8, 8]} />
            <meshStandardMaterial color="#2b3238" />
          </mesh>
          <mesh position={[0, 2.78, 0.25]}>
            <boxGeometry args={[0.16, 0.06, 0.6]} />
            <meshStandardMaterial color="#2b3238" />
          </mesh>
          <mesh position={[0, 2.74, 0.45]}>
            <boxGeometry args={[0.13, 0.03, 0.24]} />
            <meshStandardMaterial ref={(m) => { lamps.current[i] = m; }} color="#fff3d6" emissive="#ffd28a" emissiveIntensity={0.1} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.1, 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3, 3]} />
            <meshBasicMaterial ref={(m) => { pools.current[i] = m; }} map={glow} color="#ffcf8a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* trees and a low hedge line along the back */}
      {TREES.map(([x, z, s]) => <Tree key={`${x}${z}`} position={[x, -0.12, z]} scale={s} shadows={shadows} />)}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[-0.9, 0.12, 0.6 + i * 1.2]} castShadow={shadows}>
          <icosahedronGeometry args={[0.38, 0]} />
          <meshStandardMaterial color="#4a7f50" flatShading />
        </mesh>
      ))}
    </group>
  );
}
