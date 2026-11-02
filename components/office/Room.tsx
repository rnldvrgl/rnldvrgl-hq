"use client";

import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import { ROOM, type Palette } from "./palette";

/** Plant leaves as [x, y, z, radius] inside the pot group. */
const LEAVES: readonly (readonly [number, number, number, number])[] = [
  [0, 0.62, 0, 0.26], [0.14, 0.82, 0.05, 0.2], [-0.12, 0.78, -0.04, 0.2], [0.02, 0.98, -0.02, 0.17],
];

/** Floor, two back walls with windows, a whiteboard with today's tally, a Manila clock and a plant. */
export function Room({ pal, shadows, done, waiting }: { pal: Palette; shadows: boolean; done: number; waiting: number }) {
  const { W, D, H } = ROOM;
  return (
    <group>
      {/* floor + tile lines */}
      <mesh position={[W / 2, -0.05, D / 2]} receiveShadow={shadows}>
        <boxGeometry args={[W, 0.1, D]} />
        <meshStandardMaterial color={pal.floor} />
      </mesh>
      {Array.from({ length: Math.floor(W) }, (_, i) => (
        <mesh key={`gx${i}`} position={[i + 1, 0.002, D / 2]}>
          <boxGeometry args={[0.015, 0.001, D]} />
          <meshBasicMaterial color={pal.floorLine} />
        </mesh>
      ))}
      {Array.from({ length: Math.floor(D) }, (_, i) => (
        <mesh key={`gz${i}`} position={[W / 2, 0.002, i + 1]}>
          <boxGeometry args={[W, 0.001, 0.015]} />
          <meshBasicMaterial color={pal.floorLine} />
        </mesh>
      ))}

      {/* back walls */}
      <mesh position={[-0.08, H / 2, D / 2]} receiveShadow={shadows}>
        <boxGeometry args={[0.16, H, D]} />
        <meshStandardMaterial color={pal.wallLeft} />
      </mesh>
      <mesh position={[W / 2, H / 2, -0.08]} receiveShadow={shadows}>
        <boxGeometry args={[W + 0.16, H, 0.16]} />
        <meshStandardMaterial color={pal.wallRight} />
      </mesh>
      <mesh position={[W / 2, H + 0.04, -0.08]}>
        <boxGeometry args={[W + 0.2, 0.08, 0.2]} />
        <meshStandardMaterial color={pal.trim} />
      </mesh>
      <mesh position={[-0.08, H + 0.04, D / 2]}>
        <boxGeometry args={[0.2, 0.08, D]} />
        <meshStandardMaterial color={pal.trim} />
      </mesh>

      {/* windows on the right wall */}
      {[2.3, 8.5].map((x) => (
        <group key={x} position={[x, 1.55, 0.005]}>
          <mesh>
            <boxGeometry args={[2.1, 1.25, 0.03]} />
            <meshStandardMaterial color={pal.trim} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[1.95, 1.1]} />
            <meshStandardMaterial color={pal.window} emissive={pal.window} emissiveIntensity={pal.windowGlow} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[0.04, 1.1, 0.01]} />
            <meshStandardMaterial color={pal.trim} />
          </mesh>
        </group>
      ))}

      {/* whiteboard */}
      <group position={[5.4, 1.45, 0.01]}>
        <mesh>
          <boxGeometry args={[2.5, 1.2, 0.04]} />
          <meshStandardMaterial color={pal.trim} />
        </mesh>
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[2.38, 1.08]} />
          <meshStandardMaterial color={pal.board} />
        </mesh>
        <Html transform position={[0, 0, 0.03]} distanceFactor={1.6} pointerEvents="none">
          <div style={{ width: 300, fontFamily: "var(--font-plex), monospace", color: pal.boardInk, lineHeight: 1.5 }}>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.08em" }}>TODAY</div>
            <div style={{ fontSize: 20 }}>{done} reports done</div>
            <div style={{ fontSize: 20, color: waiting ? "var(--st-needs)" : pal.boardInk }}>{waiting} waiting for you</div>
          </div>
        </Html>
      </group>

      <Clock pal={pal} />

      {/* plant in the corner */}
      <group position={[0.45, 0, 0.45]}>
        <mesh position={[0, 0.2, 0]} castShadow={shadows}>
          <cylinderGeometry args={[0.2, 0.16, 0.4, 20]} />
          <meshStandardMaterial color={pal.pot} />
        </mesh>
        {LEAVES.map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} castShadow={shadows}>
            <icosahedronGeometry args={[r, 1]} />
            <meshStandardMaterial color={i % 2 ? pal.leafA : pal.leafB} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Wall clock on the left wall, showing Manila time. */
function Clock({ pal }: { pal: Palette }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const manila = new Date(now.getTime() + 8 * 3600_000);
  const h = manila.getUTCHours() % 12, m = manila.getUTCMinutes();
  const minute = -(m / 60) * Math.PI * 2;
  const hour = -((h + m / 60) / 12) * Math.PI * 2;

  return (
    <group position={[0.02, 1.85, 4.6]} rotation={[0, Math.PI / 2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 40]} />
        <meshStandardMaterial color={pal.trim} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[0.28, 40]} />
        <meshStandardMaterial color={pal.clockFace} />
      </mesh>
      <group position={[0, 0, 0.04]} rotation={[0, 0, hour]}>
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.035, 0.16, 0.01]} />
          <meshBasicMaterial color={pal.clockInk} />
        </mesh>
      </group>
      <group position={[0, 0, 0.045]} rotation={[0, 0, minute]}>
        <mesh position={[0, 0.11, 0]}>
          <boxGeometry args={[0.02, 0.22, 0.01]} />
          <meshBasicMaterial color={pal.clockInk} />
        </mesh>
      </group>
    </group>
  );
}
