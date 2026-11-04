"use client";

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { CARPORT, SCENE_FONT } from "./palette";
import { PARKING } from "./Car";
import { vehicle } from "./Traffic";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { joinGeometries, mergeParts, partsAt, type Part } from "./batch";
import { HQ } from "@/hq.config";

const STEEL = "#4b5560", GUTTER = "#d6d3cc", PAINT = "#f1f2ee", YELLOW = "#facc15";

/** Roof height at a given x: a lean-to falling from the wall to the outer edge. */
const roofAt = (x: number) => CARPORT.yWall + ((x - CARPORT.x0) / (CARPORT.x1 - CARPORT.x0)) * (CARPORT.yEdge - CARPORT.yWall);
/** The second bay, right of the boss's car: the team's scooters and a bike. */
const BAY2 = { x0: PARKING.x + 1.15, x1: CARPORT.x1 - 0.2 } as const;

/**
 * The carport off the building's side wall: a polycarbonate lean-to on steel posts over the boss's bay, a
 * second bay with the team's scooters and a bicycle, and the walkway from the entrance to the street.
 * Rain stops at the roof (ROOFS in world.ts), so people walking out to the street or their car stay dry.
 * At dusk two LED panels under the roof light both bays.
 */
export function Carport({ shadows }: { shadows: boolean }) {
  const { x0, x1, z0, z1 } = CARPORT;
  const panels = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const pools = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const glow = useMemo(() => getGlowTexture(), []);

  useFrame(() => {
    const k = streetLightLevel();
    panels.current.forEach((m) => { if (m) m.emissiveIntensity = 0.1 + k * 2.4; });
    pools.current.forEach((m) => { if (m) m.opacity = k * 0.6; });
  });

  const frame = useMemo(() => {
    const p: Part[] = [];
    const postX = x1 - 0.08;
    const postZ = [z0 + 0.1, (z0 + z1) / 2, z1 - 0.12];
    // posts along the outer edge, and one at the front between the bays
    for (const pz of postZ) p.push({ size: [0.1, CARPORT.yEdge, 0.1], pos: [postX, CARPORT.yEdge / 2, pz], color: STEEL });
    const midX = BAY2.x0 - 0.12, midH = roofAt(midX);
    p.push({ size: [0.1, midH, 0.1], pos: [midX, midH / 2, z1 - 0.12], color: STEEL });
    for (const pz of postZ) p.push({ size: [0.3, 0.05, 0.3], pos: [postX, 0.025, pz], color: "#9aa1a7" });
    // the ledger on the wall and the beam along the outer edge
    p.push({ size: [0.1, 0.14, z1 - z0], pos: [x0 + 0.06, CARPORT.yWall - 0.07, (z0 + z1) / 2], color: STEEL });
    p.push({ size: [0.1, 0.14, z1 - z0], pos: [postX, CARPORT.yEdge - 0.07, (z0 + z1) / 2], color: STEEL });
    // rafters, falling from the wall to the edge
    const span = x1 - x0, slope = Math.atan2(CARPORT.yWall - CARPORT.yEdge, span);
    for (let i = 0; i <= 4; i++) {
      const rz = z0 + 0.05 + (i * (z1 - z0 - 0.1)) / 4;
      p.push({ size: [Math.hypot(span, CARPORT.yWall - CARPORT.yEdge), 0.07, 0.045], pos: [(x0 + x1) / 2, (CARPORT.yWall + CARPORT.yEdge) / 2 - 0.05, rz], rot: [0, 0, -slope], color: STEEL });
    }
    // gutter on the outer edge, and its downpipe down the back post
    p.push({ size: [0.12, 0.09, z1 - z0 + 0.1], pos: [x1 + 0.06, CARPORT.yEdge - 0.02, (z0 + z1) / 2], color: GUTTER });
    p.push({ shape: "cyl", size: [0.035, CARPORT.yEdge, 8], pos: [x1 + 0.08, CARPORT.yEdge / 2, z0 + 0.25], color: GUTTER });
    // the LED panels' housings
    for (const lx of [PARKING.x, (BAY2.x0 + BAY2.x1) / 2]) p.push({ size: [0.6, 0.04, 0.6], pos: [lx, roofAt(lx) - 0.16, PARKING.z], color: "#e5e7eb" });

    // floor paint: the second bay's lines, wheel stops, the walkway and a yellow kerb by the door
    p.push({ size: [0.06, 0.004, z1 - z0 - 0.7], pos: [BAY2.x1, 0.004, PARKING.z], color: PAINT });
    for (const wx of [PARKING.x - 0.55, PARKING.x + 0.55]) p.push({ size: [0.5, 0.1, 0.14], pos: [wx, 0.05, z0 + 0.32], color: YELLOW });
    for (let i = 0; i < 9; i++) p.push({ size: [0.3, 0.004, 0.16], pos: [x0 + 0.45, 0.004, z0 + 0.9 + i * 0.5], color: PAINT });
    // a scooter stand: a low steel rail the scooters lean against
    p.push({ size: [BAY2.x1 - BAY2.x0 - 0.3, 0.05, 0.05], pos: [(BAY2.x0 + BAY2.x1) / 2, 0.45, z0 + 0.6], color: "#9aa1a7" });
    for (const sx of [BAY2.x0 + 0.2, BAY2.x1 - 0.2]) p.push({ size: [0.05, 0.45, 0.05], pos: [sx, 0.225, z0 + 0.6], color: "#9aa1a7" });

    const body = mergeParts(p);
    // the team's scooters, nose to the rail, and a bicycle
    const scooters = [["#dc2626", 0.45], ["#1d4ed8", 1.25]] as const;
    const motos = scooters.map(([c, dx]) => partsAt(vehicle("moto", c, c, false).body, [BAY2.x0 + dx, 0, z0 + 1.55], Math.PI / 2));
    const bike = partsAt(bicycle(), [BAY2.x0 + 2.0, 0, z0 + 1.6], Math.PI / 2);
    return joinGeometries([body, ...motos, bike]);
  }, [x0, x1, z0, z1]);

  const roofLen = Math.hypot(x1 - x0 + 0.2, CARPORT.yWall - CARPORT.yEdge);
  const roofY = (CARPORT.yWall + CARPORT.yEdge) / 2 + 0.03;
  const tilt = Math.atan2(CARPORT.yWall - CARPORT.yEdge, x1 - x0);

  return (
    <group>
      {frame && (
        <mesh geometry={frame} castShadow={shadows} receiveShadow={shadows}>
          <meshStandardMaterial vertexColors roughness={0.75} />
        </mesh>
      )}
      {/* clear polycarbonate, so the car and people under it still show */}
      <group position={[(x0 + x1) / 2 + 0.1, roofY, (z0 + z1) / 2]} rotation={[0, 0, -tilt]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[roofLen, z1 - z0 + 0.1]} />
          <meshStandardMaterial color="#d7e6ee" transparent opacity={0.16} roughness={0.2} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      {/* the two LED panels and their light on the floor */}
      {[PARKING.x, (BAY2.x0 + BAY2.x1) / 2].map((lx, i) => (
        <group key={lx}>
          <mesh position={[lx, roofAt(lx) - 0.185, PARKING.z]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.52, 0.52]} />
            <meshStandardMaterial ref={(m) => { panels.current[i] = m; }} color="#f8fafc" emissive="#fff4d6" emissiveIntensity={0.1} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[lx, 0.012, PARKING.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.6, 4.6]} />
            <meshBasicMaterial ref={(m) => { pools.current[i] = m; }} map={glow} color="#fff1cf" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
      <Suspense fallback={null}>
        {/* "reserved" plate on the wall by the boss's bay */}
        <group position={[x0 + 0.03, 1.55, PARKING.z + 0.6]} rotation={[0, Math.PI / 2, 0]}>
          <mesh>
            <boxGeometry args={[0.9, 0.36, 0.02]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          <Text font={SCENE_FONT} position={[0, 0.07, 0.012]} fontSize={0.085} color="#b91c1c" anchorX="center" anchorY="middle" letterSpacing={0.12}>
            RESERVED
          </Text>
          <Text font={SCENE_FONT} position={[0, -0.08, 0.012]} fontSize={0.07} color="#1f2937" anchorX="center" anchorY="middle" letterSpacing={0.08}>
            {HQ.owner.name.toUpperCase()}
          </Text>
        </group>
        {/* the sign on the front beam */}
        <group position={[(BAY2.x0 + BAY2.x1) / 2, roofAt((BAY2.x0 + BAY2.x1) / 2) - 0.3, z1 - 0.04]}>
          <mesh>
            <boxGeometry args={[1.2, 0.24, 0.03]} />
            <meshStandardMaterial color="#1d4ed8" />
          </mesh>
          <Text font={SCENE_FONT} position={[0, 0, 0.018]} fontSize={0.1} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.14}>
            P · STAFF
          </Text>
        </group>
      </Suspense>
    </group>
  );
}

/** A plain bicycle along x: two wheels (thin boxes are cheap and read fine at this size), frame, seat, bars. */
function bicycle(): Part[] {
  const p: Part[] = [];
  for (const x of [-0.5, 0.5]) p.push({ shape: "cyl", size: [0.3, 0.04, 14], pos: [x, 0.3, 0], rot: [Math.PI / 2, 0, 0], color: "#111417" });
  p.push({ size: [0.95, 0.04, 0.04], pos: [0, 0.48, 0], rot: [0, 0, 0.15], color: "#059669" });
  p.push({ size: [0.04, 0.4, 0.04], pos: [-0.2, 0.6, 0], color: "#059669" });
  p.push({ size: [0.24, 0.05, 0.1], pos: [-0.2, 0.82, 0], color: "#111417" });
  p.push({ size: [0.04, 0.45, 0.04], pos: [0.45, 0.62, 0], color: "#374151" });
  p.push({ size: [0.04, 0.04, 0.5], pos: [0.45, 0.86, 0], color: "#374151" });
  return p;
}
