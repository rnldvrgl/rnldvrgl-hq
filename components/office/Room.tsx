"use client";

import { Suspense, useEffect, useState } from "react";
import { Text } from "@react-three/drei";
import { MANILA_OFFSET_MS } from "@/lib/time";
import { ROOM, type Palette, SCENE_FONT } from "./palette";
import { Plant } from "./Furniture";

const TAU = Math.PI * 2;

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
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[-1.06, 0.34, 0.03]} fontSize={0.13} color={pal.boardInk} anchorX="left" anchorY="middle" letterSpacing={0.08}>
            TODAY
          </Text>
          <Text font={SCENE_FONT} position={[-1.06, 0.08, 0.03]} fontSize={0.12} color={pal.boardInk} anchorX="left" anchorY="middle">
            {`${done} report${done === 1 ? "" : "s"} done`}
          </Text>
          <Text font={SCENE_FONT} position={[-1.06, -0.14, 0.03]} fontSize={0.12} color={waiting ? pal.needsInk : pal.boardInk} anchorX="left" anchorY="middle">
            {`${waiting} waiting for you`}
          </Text>
        </Suspense>
      </group>

      <Clock pal={pal} />

      {/* plant in the corner */}
      <Plant pal={pal} shadows={shadows} position={[0.45, 0, 0.45]} />
    </group>
  );
}

const DIGITAL = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });

/** Numerals 1–12 as [label, x, y] on the clock face. */
const NUMERALS: readonly (readonly [string, number, number])[] = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const a = (n / 12) * TAU;
  return [String(n), Math.sin(a) * 0.255, Math.cos(a) * 0.255] as const;
});

/**
 * Wall clock on the left wall showing Manila time, with numerals, a second hand,
 * and a digital 12-hour readout (e.g. "7:42 PM") on an LED panel underneath.
 * Local +x on the wall reads left-to-right from the camera.
 */
function Clock({ pal }: { pal: Palette }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS);
  const h = manila.getUTCHours() % 12, m = manila.getUTCMinutes(), s = manila.getUTCSeconds();
  const second = -(s / 60) * TAU;
  const minute = -((m + s / 60) / 60) * TAU;
  const hour = -((h + m / 60) / 12) * TAU;

  return (
    <group position={[0.02, 1.9, 4.6]} rotation={[0, Math.PI / 2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.05, 40]} />
        <meshStandardMaterial color={pal.trim} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[0.32, 40]} />
        <meshStandardMaterial color={pal.clockFace} />
      </mesh>
      {Array.from({ length: 60 }, (_, i) => (
        <mesh key={i} position={[Math.sin((i / 60) * TAU) * 0.3, Math.cos((i / 60) * TAU) * 0.3, 0.032]} rotation={[0, 0, -(i / 60) * TAU]}>
          <planeGeometry args={[i % 5 ? 0.004 : 0.01, i % 5 ? 0.014 : 0.03]} />
          <meshBasicMaterial color={pal.clockInk} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        {NUMERALS.map(([label, x, y]) => (
          <Text font={SCENE_FONT} key={label} position={[x, y, 0.034]} fontSize={0.062} color={pal.clockInk} anchorX="center" anchorY="middle">
            {label}
          </Text>
        ))}
      </Suspense>
      <group position={[0, 0, 0.04]} rotation={[0, 0, hour]}>
        <mesh position={[0, 0.075, 0]}>
          <boxGeometry args={[0.03, 0.15, 0.01]} />
          <meshBasicMaterial color={pal.clockInk} />
        </mesh>
      </group>
      <group position={[0, 0, 0.045]} rotation={[0, 0, minute]}>
        <mesh position={[0, 0.11, 0]}>
          <boxGeometry args={[0.018, 0.22, 0.01]} />
          <meshBasicMaterial color={pal.clockInk} />
        </mesh>
      </group>
      <group position={[0, 0, 0.05]} rotation={[0, 0, second]}>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.006, 0.26, 0.005]} />
          <meshBasicMaterial color={pal.clockSecond} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.056]}>
        <circleGeometry args={[0.016, 16]} />
        <meshBasicMaterial color={pal.clockSecond} />
      </mesh>

      {/* digital clock below */}
      <group position={[0, -0.58, 0]}>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.7, 0.24, 0.04]} />
          <meshStandardMaterial color={pal.ledPanel} />
        </mesh>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0.025, 0.042]} fontSize={0.12} color={pal.led} anchorX="center" anchorY="middle" letterSpacing={0.04}>
            {DIGITAL.format(now)}
          </Text>
          <Text font={SCENE_FONT} position={[0, -0.08, 0.042]} fontSize={0.035} color={pal.ledDim} anchorX="center" anchorY="middle" letterSpacing={0.2}>
            MANILA
          </Text>
        </Suspense>
      </group>
    </group>
  );
}
