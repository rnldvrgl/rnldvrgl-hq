"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useOffice } from "@/lib/store";
import { OUTSIDE, ROOM } from "./palette";
import { getGlowTexture, light } from "./Lighting";
import { ROAD, ROAD_X, SIDEWALK } from "./Grounds";

/**
 * Weather outdoors (the windows get their own streaks in the sky shader):
 *   rain over the whole neighbourhood — lawn, street, sidewalk, pavement — but never inside the building,
 *   splash rings where drops land, a wet sheen on the hard ground, and slow cloud shadows drifting
 *   across everything on overcast days. Strength follows the eased cloud / rain levels from <Lighting>.
 */

/** Where rain falls: a box around the building. */
const AREA = { x0: -7, x1: OUTSIDE.x1 + 9, z0: -5, z1: ROAD.z1 + 1 } as const;
/** Inside the walls (plus a little overhang) stays dry. */
const indoors = (x: number, z: number) => x > -0.15 && x < ROOM.W + 0.15 && z > -0.15 && z < ROOM.D + 0.15;

function randomOutdoor(): [number, number] {
  for (;;) {
    const x = AREA.x0 + Math.random() * (AREA.x1 - AREA.x0);
    const z = AREA.z0 + Math.random() * (AREA.z1 - AREA.z0);
    if (!indoors(x, z)) return [x, z];
  }
}

export function Rain() {
  const lowPower = useOffice((s) => s.lowPower);
  const count = lowPower ? 250 : 900;
  const SPLASHES = lowPower ? 16 : 40;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const wet = useRef<THREE.MeshStandardMaterial[]>([]);
  const shadows = useRef<THREE.Group>(null);
  const shadowMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const glow = useMemo(() => getGlowTexture(), []);
  const drops = useMemo(() => Array.from({ length: count }, () => {
    const [x, z] = randomOutdoor();
    return { x, z, y: Math.random() * 5, v: 7 + Math.random() * 3 };
  }), [count]);
  const splash = useMemo(() => Array.from({ length: SPLASHES }, () => {
    const [x, z] = randomOutdoor();
    return { x, z, t: Math.random() };
  }), [SPLASHES]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, dt) => {
    const step = Math.min(dt, 0.05);
    // falling drops
    const im = mesh.current;
    if (im) {
      const shown = Math.round(count * light.rain);
      im.count = shown;
      im.visible = shown > 0;
      for (let i = 0; i < shown; i++) {
        const d = drops[i];
        d.y -= d.v * step;
        if (d.y < 0) { d.y += 5; [d.x, d.z] = randomOutdoor(); }
        m.makeTranslation(d.x, d.y, d.z);
        im.setMatrixAt(i, m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
    // splash rings: each grows and fades, then jumps somewhere else
    const rm = rings.current;
    if (rm) {
      const shown = light.rain > 0.05 ? SPLASHES : 0;
      rm.count = shown;
      rm.visible = shown > 0;
      for (let i = 0; i < shown; i++) {
        const sp = splash[i];
        sp.t += step * 2.2;
        if (sp.t > 1) { sp.t = 0; [sp.x, sp.z] = randomOutdoor(); }
        v.set(sp.x, 0.02, sp.z);
        sc.setScalar(0.04 + sp.t * 0.16);
        m.compose(v, q, sc);
        rm.setMatrixAt(i, m);
      }
      rm.instanceMatrix.needsUpdate = true;
      const mat = rm.material;
      if (mat instanceof THREE.MeshBasicMaterial) mat.opacity = 0.5 * light.rain;
    }
    // wet sheen on the street, sidewalk, pavement and lawn
    wet.current.forEach((w, i) => { w.opacity = light.rain * (i === 3 ? 0.18 : 0.35); });
    // cloud shadows drift slowly across the whole scene when it's overcast
    if (shadows.current) {
      const k = Math.max(0, light.cloud - 0.15) * (1 - light.night);
      shadows.current.visible = k > 0.02;
      shadows.current.children.forEach((c, i) => {
        const span = AREA.x1 - AREA.x0 + 12;
        const x = AREA.x0 - 6 + ((clock.elapsedTime * (0.35 + i * 0.07) + i * 9) % span);
        c.position.set(x, 0.03, AREA.z0 + 3 + ((i * 7.3) % (AREA.z1 - AREA.z0 - 4)));
      });
      shadowMats.current.forEach((mat) => { if (mat) mat.opacity = 0.5 * k; });
    }
  });

  const roadW = ROAD_X.x1 - ROAD_X.x0, roadCx = (ROAD_X.x0 + ROAD_X.x1) / 2;
  const wetPlanes: [number, number, number, number, number][] = [
    // [x, y, z, w, d]
    [roadCx, -0.1, (ROAD.z0 + ROAD.z1) / 2, roadW, ROAD.z1 - ROAD.z0],
    [roadCx, 0.004, (SIDEWALK.z0 + SIDEWALK.z1) / 2, roadW, SIDEWALK.z1 - SIDEWALK.z0],
    [(OUTSIDE.x0 + OUTSIDE.x1) / 2, 0.006, (OUTSIDE.z0 + OUTSIDE.z1) / 2, OUTSIDE.x1 - OUTSIDE.x0 - 0.45, OUTSIDE.z1 - OUTSIDE.z0],
    [(AREA.x0 + AREA.x1) / 2, -0.12, (AREA.z0 + AREA.z1) / 2, AREA.x1 - AREA.x0, AREA.z1 - AREA.z0],
  ];

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[0.012, 0.3, 0.012]} />
        <meshBasicMaterial color="#c7d7e6" transparent opacity={0.6} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={rings} args={[undefined, undefined, SPLASHES]} frustumCulled={false}>
        <ringGeometry args={[0.8, 1, 18]} />
        <meshBasicMaterial color="#dbe7f1" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </instancedMesh>
      {wetPlanes.map(([x, y, z, w, d], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial
            ref={(mat) => { if (mat) wet.current[i] = mat; }}
            color={i === 3 ? "#3f5a46" : "#4f6274"} roughness={0.06} metalness={0.35} transparent opacity={0} depthWrite={false}
          />
        </mesh>
      ))}
      <group ref={shadows} visible={false}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} scale={[1.6 + (i % 3) * 0.5, 1, 1]}>
            <planeGeometry args={[9, 7]} />
            <meshBasicMaterial ref={(mat) => { shadowMats.current[i] = mat; }} map={glow} color="#1c2530" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
