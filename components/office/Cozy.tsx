"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FRONT_Z, ROOM, SHIRTS, type Palette } from "./palette";
import { light } from "./Lighting";
import { mergeParts, type Part } from "./batch";

/**
 * The cozy touches on the team floor:
 *   - warm fairy lights strung along the top of the back and left walls (soft by day, glowing in the evening)
 *   - a wall of team polaroids (one per desk, in each person's shirt colour) on the left wall, pegged to a string
 *   - two macramé planters hanging on the left wall, with trailing vines
 * Everything static is merged into one mesh; the bulbs share one material, so this costs three draw calls.
 */
export function Cozy({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const bulbs = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    // a slow, gentle twinkle; brighter once the room lamps come on
    if (bulbs.current) bulbs.current.emissiveIntensity = 0.7 + light.lamps * 1.6 + Math.sin(clock.elapsedTime * 1.3) * 0.08;
  });

  const { wire, bulbGeo } = useMemo(() => {
    const bulbsAt: THREE.Vector3[] = [];
    const mat = new THREE.LineBasicMaterial({ color: "#3b3127" });
    const group = new THREE.Group();
    // one run of lights: it droops between hooks about a metre apart, a bulb every quarter of a swag
    const run = (from: THREE.Vector3, to: THREE.Vector3, hooks: number) => {
      const pts: THREE.Vector3[] = [];
      for (let h = 0; h < hooks; h++) {
        const a = from.clone().lerp(to, h / hooks), b = from.clone().lerp(to, (h + 1) / hooks);
        for (let k = 0; k <= 8; k++) {
          const t = k / 8, p = a.clone().lerp(b, t);
          p.y -= Math.sin(t * Math.PI) * 0.16;
          pts.push(p);
          if (k % 2 === 1) bulbsAt.push(p.clone().setY(p.y - 0.035));
        }
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    };
    const y = ROOM.H - 0.12;
    run(new THREE.Vector3(0.25, y, 0.05), new THREE.Vector3(10.5, y, 0.05), 10);
    run(new THREE.Vector3(0.05, y, 0.25), new THREE.Vector3(0.05, y, FRONT_Z - 0.2), 8);
    const parts: Part[] = bulbsAt.map((p) => ({ size: [0.035, 0.06, 0.035], pos: [p.x, p.y, p.z], color: "#fff1c2" }));
    return { wire: group, bulbGeo: mergeParts(parts) };
  }, []);

  const decor = useMemo(() => {
    const p: Part[] = [];
    // polaroids on the left wall: a string with pegged photos of the team, each in their shirt colour
    const z0 = 2.95, cols = 4, rows = 2;
    for (let r = 0; r < rows; r++) {
      const sy = 1.95 - r * 0.42;
      p.push({ size: [0.004, 0.004, cols * 0.36 + 0.1], pos: [0.012, sy + 0.02, z0 + (cols * 0.36) / 2 - 0.18], color: "#8a6a4a" });
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const shirt = SHIRTS[i % SHIRTS.length];
        const z = z0 + c * 0.36, yy = sy - 0.17, tilt = ((i * 37) % 9 - 4) * 0.03;
        p.push({ size: [0.006, 0.3, 0.25], pos: [0.012, yy, z], rot: [tilt, 0, 0], color: "#fbfaf7" });
        p.push({ size: [0.004, 0.2, 0.21], pos: [0.017, yy + 0.03, z], rot: [tilt, 0, 0], color: "#cfe3ee" });
        p.push({ size: [0.004, 0.08, 0.15], pos: [0.02, yy - 0.03, z], rot: [tilt, 0, 0], color: shirt });
        p.push({ shape: "cyl", size: [0.035, 0.004, 10], pos: [0.021, yy + 0.05, z], rot: [0, 0, Math.PI / 2], color: pal.skin[i % pal.skin.length] });
        p.push({ size: [0.012, 0.05, 0.018], pos: [0.02, sy + 0.0, z], color: "#c9a77c" });
      }
    }
    // macramé planters: a ring of cord from a wall hook, a terracotta pot, and vines trailing down
    for (const [z, y] of [[5.1, 2.0], [7.6, 2.05]] as const) {
      p.push({ size: [0.12, 0.02, 0.02], pos: [0.06, y + 0.5, z], color: "#3a4650" });
      for (const a of [0, 2.1, 4.2]) p.push({ size: [0.008, 0.48, 0.008], pos: [0.24 + Math.cos(a) * 0.09, y + 0.26, z + Math.sin(a) * 0.09], color: "#efe3c8" });
      p.push({ shape: "cyl", size: [0.12, 0.16, 12], pos: [0.24, y, z], color: "#c46a3e" });
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2, len = 0.18 + ((k * 7) % 5) * 0.07;
        p.push({ size: [0.05, len, 0.04], pos: [0.24 + Math.cos(a) * 0.12, y - len / 2 + 0.02, z + Math.sin(a) * 0.12], color: k % 2 ? pal.leafA : pal.leafB });
      }
      p.push({ shape: "cyl", size: [0.15, 0.08, 10], pos: [0.24, y + 0.1, z], color: pal.leafC });
    }
    return mergeParts(p);
  }, [pal.leafA, pal.leafB, pal.leafC, pal.skin]);

  return (
    <group>
      <primitive object={wire} />
      {bulbGeo && (
        <mesh geometry={bulbGeo}>
          <meshStandardMaterial ref={bulbs} color="#fff1c2" emissive="#ffc46b" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      )}
      {decor && (
        <mesh geometry={decor} castShadow={shadows}>
          <meshStandardMaterial vertexColors roughness={0.85} />
        </mesh>
      )}
    </group>
  );
}
