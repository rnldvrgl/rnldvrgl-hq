"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useOffice } from "@/lib/store";
import { OUTSIDE } from "./palette";
import { light } from "./Lighting";

/**
 * Rain falling on the pavement outside (the windows get their own streaks in the sky shader).
 * Drops are one instanced mesh; how many show follows the eased rain level from <Lighting>.
 */
export function Rain() {
  const lowPower = useOffice((s) => s.lowPower);
  const count = lowPower ? 90 : 260;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const splash = useRef<THREE.MeshStandardMaterial>(null);
  const drops = useMemo(() => Array.from({ length: count }, () => ({
    x: OUTSIDE.x0 + Math.random() * (OUTSIDE.x1 - OUTSIDE.x0),
    z: OUTSIDE.z0 + Math.random() * (OUTSIDE.z1 - OUTSIDE.z0),
    y: Math.random() * 4,
    v: 6 + Math.random() * 3,
  })), [count]);
  const m = useMemo(() => new THREE.Matrix4(), []);

  useFrame((_, dt) => {
    const im = mesh.current;
    if (!im) return;
    const shown = Math.round(count * light.rain);
    im.count = shown;
    im.visible = shown > 0;
    for (let i = 0; i < shown; i++) {
      const d = drops[i];
      d.y -= d.v * Math.min(dt, 0.05);
      if (d.y < 0) d.y += 4;
      m.makeTranslation(d.x, d.y, d.z);
      im.setMatrixAt(i, m);
    }
    im.instanceMatrix.needsUpdate = true;
    if (splash.current) splash.current.opacity = light.rain * 0.35;
  });

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[0.012, 0.28, 0.012]} />
        <meshBasicMaterial color="#c7d7e6" transparent opacity={0.6} depthWrite={false} />
      </instancedMesh>
      {/* wet sheen on the pavement */}
      <mesh position={[(OUTSIDE.x0 + OUTSIDE.x1) / 2, 0.006, (OUTSIDE.z0 + OUTSIDE.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[OUTSIDE.x1 - OUTSIDE.x0 - 0.45, OUTSIDE.z1 - OUTSIDE.z0]} />
        <meshStandardMaterial ref={splash} color="#5f7488" roughness={0.08} metalness={0.3} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
