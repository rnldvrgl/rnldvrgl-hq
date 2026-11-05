"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useOffice } from "@/lib/store";
import { OUTSIDE, DEN, ROOM } from "./palette";
import { getGlowTexture, light } from "./Lighting";
import { BACK_STREETS, BACK_X, FAR_WALK, GROUND, ROAD, ROAD_X, SIDE_STREETS, SIDEWALK, underRoof } from "./world";
import { useSettings } from "@/lib/settings";

/**
 * Weather outdoors (the windows get their own streaks in the sky shader): rain wherever you're looking
 * (the drops live in a box around the point the camera looks at, so zoomed out over the town it rains on
 * all of it), never inside the office or under the carport and vape gazebo roofs, slanting in strong wind; splash rings
 * where drops land; a wet sheen on the streets, the patio and the lawn, and puddles, both drying slowly after the rain; slow cloud shadows drifting across on overcast days. Strength follows the eased cloud / rain
 * levels from <Lighting>. Settings → "Weather effects" off, or minimal motion, keeps only the wet sheen.
 */

/** Puddles where water collects: [x, z, width, depth, rotation] on the sidewalks, the street edges and the lot. */
const PUDDLES: readonly (readonly [number, number, number, number, number])[] = [
  [3.2, SIDEWALK.z0 + 0.5, 1.1, 0.5, 0.2], [9.8, SIDEWALK.z1 - 0.4, 0.8, 0.4, -0.3], [-1.5, ROAD.z0 + 0.5, 1.6, 0.6, 0.1],
  [7.5, ROAD.z0 + 0.45, 1.3, 0.5, -0.1], [13.5, ROAD.z1 - 0.5, 1.8, 0.7, 0.05], [21.5, ROAD.z1 - 0.4, 1.2, 0.5, -0.2],
  [-8.5, ROAD.z1 - 0.6, 1.5, 0.6, 0.3], [27, ROAD.z0 + 0.5, 1.4, 0.5, 0], [17.8, 5.6, 1.0, 0.6, 0.4], [22.6, 9.2, 1.3, 0.7, -0.2],
  [2.5, FAR_WALK.z0 + 0.6, 0.9, 0.45, 0.1], [16, FAR_WALK.z1 - 0.5, 1.1, 0.5, -0.3], [-4.8, -12, 1.2, 0.6, 0.2], [12, BACK_STREETS[0].z0 + 0.5, 1.6, 0.6, 0],
  [30, BACK_STREETS[0].z1 - 0.5, 1.3, 0.5, 0.2], [5, BACK_STREETS[1].z1 - 0.6, 1.5, 0.6, -0.1], [-20, ROAD.z0 + 0.6, 1.4, 0.5, 0.15], [38, ROAD.z1 - 0.5, 1.5, 0.6, -0.1],
];

/** Streets sit 10 cm below the sidewalks. */
const puddleY = (z: number) => (z > ROAD.z0 && z < ROAD.z1) || BACK_STREETS.some((b) => z > b.z0 && z < b.z1) || z < -8 ? -0.092 : 0.009;

/** The rain box around the view centre, updated every frame. */
const AREA = { x0: -7, x1: OUTSIDE.x1 + 9, z0: -5, z1: ROAD.z1 + 1 };
/** Inside the walls (plus a little overhang) stays dry. */
const indoors = (x: number, z: number) => x > DEN.x0 - 0.15 && x < ROOM.W + 0.15 && z > -0.15 && z < ROOM.D + 0.15;
const outside = (x: number, z: number) => x < AREA.x0 || x > AREA.x1 || z < AREA.z0 || z > AREA.z1;

function randomOutdoor(): [number, number] {
  for (let i = 0; i < 40; i++) {
    const x = AREA.x0 + Math.random() * (AREA.x1 - AREA.x0);
    const z = AREA.z0 + Math.random() * (AREA.z1 - AREA.z0);
    if (!indoors(x, z)) return [x, z];
  }
  return [AREA.x0, AREA.z0];
}

const camDir = new THREE.Vector3();
/** Centre the rain box on where the camera looks at the ground, sized to what's on screen. */
function followView(camera: THREE.Camera, width: number, height: number): void {
  camera.getWorldDirection(camDir);
  if (Math.abs(camDir.y) < 1e-3) return;
  const t = -camera.position.y / camDir.y;
  const cx = camera.position.x + camDir.x * t, cz = camera.position.z + camDir.z * t;
  const zoom = camera instanceof THREE.OrthographicCamera ? camera.zoom : 40;
  const r = Math.min(70, (Math.max(width, height) / zoom) * 0.62 + 2);
  AREA.x0 = cx - r; AREA.x1 = cx + r; AREA.z0 = cz - r; AREA.z1 = cz + r;
}

export function Rain() {
  const lowPower = useOffice((s) => s.lowPower);
  const particles = useSettings((s) => s.show.weather && s.motion === "full");
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

  const puddles = useRef<THREE.InstancedMesh>(null);
  const puddleScale = useRef(0);
  const pq = useMemo(() => new THREE.Quaternion(), []);
  const pe = useMemo(() => new THREE.Euler(), []);
  const tilt = useMemo(() => new THREE.Quaternion(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);

  useFrame(({ clock, camera, size }, dt) => {
    const step = Math.min(dt, 0.05);
    tilt.setFromAxisAngle(zAxis, -light.wind * 0.6);
    followView(camera, size.width, size.height);
    // falling drops
    const im = mesh.current;
    if (im) {
      const shown = particles ? Math.round(count * light.rain) : 0;
      im.count = shown;
      im.visible = shown > 0;
      for (let i = 0; i < shown; i++) {
        const d = drops[i];
        d.y -= d.v * step;
        // a drop over the carport or the gazebo ends on its roof
        if (outside(d.x, d.z)) { d.y = Math.random() * 5; [d.x, d.z] = randomOutdoor(); }
        else if (d.y < (underRoof(d.x, d.z)?.y ?? 0)) { d.y += 5; [d.x, d.z] = randomOutdoor(); }
        // the wind blows the drops along -x and tilts them (a typhoon rains sideways)
        d.x -= light.wind * 6 * step;
        m.compose(v.set(d.x, d.y, d.z), tilt, one);
        im.setMatrixAt(i, m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
    // splash rings: each grows and fades, then jumps somewhere else
    const rm = rings.current;
    if (rm) {
      const shown = particles && light.rain > 0.05 ? SPLASHES : 0;
      rm.count = shown;
      rm.visible = shown > 0;
      for (let i = 0; i < shown; i++) {
        const sp = splash[i];
        sp.t += step * 2.2;
        if (sp.t > 1 || outside(sp.x, sp.z)) { sp.t = 0; [sp.x, sp.z] = randomOutdoor(); if (underRoof(sp.x, sp.z)) sp.t = 1; }
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
    wet.current.forEach((w, i) => { w.opacity = light.wet * (i === LAWN ? 0.18 : 0.35); });
    // puddles linger after the rain, shrinking as the ground dries
    const pm = puddles.current;
    if (pm) {
      pm.visible = light.wet > 0.03;
      const mat = pm.material;
      if (mat instanceof THREE.MeshStandardMaterial) mat.opacity = Math.min(0.6, light.wet * 0.75);
      const k = 0.4 + 0.6 * Math.min(1, light.wet * 1.4);
      if (pm.visible && Math.abs(k - puddleScale.current) > 0.01) {
        puddleScale.current = k;
        PUDDLES.forEach(([x, z, w, d, r], i) => { m.compose(v.set(x, puddleY(z), z), pq.setFromEuler(pe.set(-Math.PI / 2, 0, r)), sc.set(w * k, d * k, 1)); pm.setMatrixAt(i, m); });
        pm.instanceMatrix.needsUpdate = true;
      }
    }
    // cloud shadows drift slowly across the whole scene when it's overcast
    if (shadows.current) {
      const k = Math.max(0, light.cloud - 0.15) * (1 - light.night);
      shadows.current.visible = k > 0.02 && particles;
      // they drift across a fixed stretch of town (not the moving rain box), so panning doesn't drag them along
      shadows.current.children.forEach((c, i) => {
        const span = 90;
        const x = -35 + ((clock.elapsedTime * (0.35 + i * 0.07) + i * 19) % span);
        c.position.set(x, 0.03, -6 + ((i * 7.3) % 30));
      });
      shadowMats.current.forEach((mat) => { if (mat) mat.opacity = 0.5 * k; });
    }
  });

  const roadW = ROAD_X.x1 - ROAD_X.x0, roadCx = (ROAD_X.x0 + ROAD_X.x1) / 2;
  const wetPlanes: [number, number, number, number, number][] = [
    // [x, y, z, w, d]: the street, both sidewalks, the patio, and (last) the whole lawn
    [roadCx, -0.1, (ROAD.z0 + ROAD.z1) / 2, roadW, ROAD.z1 - ROAD.z0],
    [roadCx, 0.004, (SIDEWALK.z0 + SIDEWALK.z1) / 2, roadW, SIDEWALK.z1 - SIDEWALK.z0],
    [roadCx, 0.004, (FAR_WALK.z0 + FAR_WALK.z1) / 2, roadW, FAR_WALK.z1 - FAR_WALK.z0],
    [(OUTSIDE.x0 + OUTSIDE.x1) / 2, 0.006, (OUTSIDE.z0 + OUTSIDE.z1) / 2, OUTSIDE.x1 - OUTSIDE.x0 - 0.45, OUTSIDE.z1 - OUTSIDE.z0],
    ...BACK_STREETS.map((b): [number, number, number, number, number] => [(BACK_X.x0 + BACK_X.x1) / 2, -0.098, (b.z0 + b.z1) / 2, BACK_X.x1 - BACK_X.x0, b.z1 - b.z0]),
    ...SIDE_STREETS.map((st): [number, number, number, number, number] => [(st.x0 + st.x1) / 2, -0.096, (st.z0 + SIDEWALK.z0) / 2, st.x1 - st.x0, SIDEWALK.z0 - st.z0]),
    [GROUND.cx, -0.12, GROUND.cz, GROUND.size, GROUND.size],
  ];
  const LAWN = wetPlanes.length - 1;

  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[0.012, 0.3, 0.012]} />
        <meshBasicMaterial color="#c7d7e6" transparent opacity={0.6} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={puddles} args={[undefined, undefined, PUDDLES.length]} visible={false} frustumCulled={false}>
        <circleGeometry args={[0.5, 20]} />
        <meshStandardMaterial color="#3a4a5a" roughness={0.02} metalness={0.6} transparent opacity={0} depthWrite={false} />
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
            color={i === LAWN ? "#3f5a46" : "#4f6274"} roughness={0.06} metalness={0.35} transparent opacity={0} depthWrite={false}
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
