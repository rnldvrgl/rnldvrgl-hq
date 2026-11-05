"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ROOM } from "./palette";
import { FAR_WALK } from "./world";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { joinGeometries, mergeParts, mergePlaced, placed, type Part } from "./batch";
import { acrossStreet, heartShape } from "./Festive";
import { at, shopSpots, tinted } from "./Holidays";

/**
 * Valentine's Day, on top of the hearts at every gate (Festive.tsx): garlands of little hearts strung across
 * the main street, bunches of heart balloons tied out front of the office and the shops (they bob and sway),
 * and a big heart frame of warm bulbs in the park for photos. Four draw calls.
 */

const PINKS = ["#ef4444", "#ec4899", "#f9a8d4", "#be123c", "#fb7185"];

/** Bunches of balloons: where they're tied (x, z) and how many. */
function bunches(): { x: number; z: number; n: number }[] {
  const out = [{ x: ROOM.W + 0.6, z: ROOM.D + 0.1, n: 5 }, { x: ROOM.W - 0.6, z: ROOM.D + 0.1, n: 3 }];
  shopSpots().parols.forEach((p, i) => { if (i % 2 === 0) out.push({ x: p.x + 0.6, z: p.z + 0.35, n: 3 }); });
  return out;
}

/** The park's heart frame: centre and size. */
const FRAME = { x: 29.6, y: 1.7, z: FAR_WALK.z1 + 1.8, s: 1.05 };

export function Valentine({ frozen }: { frozen: boolean }) {
  const balloons = useRef<THREE.InstancedMesh>(null);
  const strings = useRef<THREE.InstancedMesh>(null);
  const bulbMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowTex = useMemo(() => getGlowTexture(), []);

  const list = useMemo(() => bunches().flatMap((b, bi) => Array.from({ length: b.n }, (_, k) => ({
    x: b.x, z: b.z, k, n: b.n, color: PINKS[(bi + k) % PINKS.length], seed: bi * 7 + k,
  }))), []);

  const balloonGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(heartShape(0.17), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 });
    g.center();
    return g;
  }, []);

  // garlands across the street, and the frame's stand
  const garland = useMemo(() => {
    const { lines, poles } = acrossStreet();
    const geos: THREE.BufferGeometry[] = [];
    let k = 0;
    const p = new THREE.Vector3();
    for (const ln of lines) {
      const len = ln.a.distanceTo(ln.b), n = Math.floor(len / 0.45);
      const rot = Math.atan2(-(ln.b.z - ln.a.z), ln.b.x - ln.a.x);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        p.lerpVectors(ln.a, ln.b, t);
        p.y -= Math.sin(Math.PI * t) * ln.sag + 0.16;
        geos.push(tinted(new THREE.ShapeGeometry(heartShape(0.13)), PINKS[k++ % PINKS.length], at(p.x, p.y, p.z, rot)));
      }
      // the string
      for (let i = 0; i < n; i++) {
        const a = new THREE.Vector3().lerpVectors(ln.a, ln.b, i / n), b = new THREE.Vector3().lerpVectors(ln.a, ln.b, (i + 1) / n);
        a.y -= Math.sin(Math.PI * (i / n)) * ln.sag; b.y -= Math.sin(Math.PI * ((i + 1) / n)) * ln.sag;
        const mid = a.clone().add(b).multiplyScalar(0.5), d = b.clone().sub(a);
        const box = new THREE.BoxGeometry(d.length(), 0.015, 0.015);
        const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), d, new THREE.Vector3(0, 1, 0)).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
        m.setPosition(mid);
        geos.push(tinted(box, "#7f1d1d", m));
      }
    }
    const stand: Part[] = [
      { size: [0.08, FRAME.y + FRAME.s * 0.2, 0.08], pos: [FRAME.x, (FRAME.y - FRAME.s * 0.9) / 2 + 0.1, FRAME.z - 0.05], color: "#7f1d1d" },
      { size: [1.6, 0.4, 0.45], pos: [FRAME.x, 0.12, FRAME.z + 0.9], color: "#be123c" },
    ];
    return joinGeometries([mergeParts([...poles, ...stand]), ...geos]);
  }, []);

  // the frame: warm bulbs along the heart's outline, and their halos
  const frame = useMemo(() => {
    const pts = heartShape(FRAME.s).getSpacedPoints(46);
    const bulb = new THREE.SphereGeometry(0.045, 8, 6), halo = new THREE.PlaneGeometry(0.5, 0.5);
    const bulbs = mergePlaced(pts.map((q) => ({ geometry: bulb, matrix: placed([FRAME.x + q.x, FRAME.y + q.y, FRAME.z]) })));
    const halos = mergePlaced(pts.filter((_, i) => i % 2 === 0).map((q) => ({ geometry: halo, matrix: placed([FRAME.x + q.x, FRAME.y + q.y, FRAME.z + 0.04]) })));
    bulb.dispose(); halo.dispose();
    return { bulbs, halos };
  }, []);

  useLayoutEffect(() => {
    const m = balloons.current;
    if (!m) return;
    const c = new THREE.Color();
    list.forEach((b, i) => m.setColorAt(i, c.set(b.color)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [list]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), a: new THREE.Vector3(), d: new THREE.Vector3() }), []);
  useFrame(({ clock }) => {
    const t = frozen ? 0 : clock.elapsedTime;
    const bm = balloons.current, sm = strings.current;
    if (bm && sm) {
      list.forEach((b, i) => {
        // spread in a little fan above the knot, bobbing and swaying on its own rhythm
        const spread = (b.k - (b.n - 1) / 2) * 0.22;
        const sway = Math.sin(t * 0.9 + b.seed) * 0.08;
        const top = tmp.v.set(b.x + spread + sway, 2.15 + (b.k % 2) * 0.22 + Math.sin(t * 1.3 + b.seed * 1.7) * 0.05, b.z + Math.cos(t * 0.7 + b.seed) * 0.06);
        tmp.e.set(0, Math.PI / 4 + Math.sin(t * 0.5 + b.seed) * 0.3, -sway * 1.5);
        tmp.q.setFromEuler(tmp.e);
        bm.setMatrixAt(i, tmp.m.compose(top, tmp.q, tmp.s.set(1, 1, 1)));
        // the string from the knot up to the balloon's tip
        const knot = tmp.a.set(b.x, 1.05, b.z);
        const tip = top.clone().setY(top.y - 0.2);
        tmp.d.subVectors(tip, knot);
        const len = tmp.d.length();
        tmp.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp.d.normalize());
        sm.setMatrixAt(i, tmp.m.compose(knot.clone().lerp(tip, 0.5), tmp.q, tmp.s.set(1, len, 1)));
      });
      bm.instanceMatrix.needsUpdate = true;
      sm.instanceMatrix.needsUpdate = true;
    }
    const k = streetLightLevel();
    if (bulbMat.current) bulbMat.current.color.setScalar(0.7 + 0.8 * k);
    if (haloMat.current) haloMat.current.opacity = 0.15 + k * 0.6;
  });

  return (
    <group>
      {garland && <mesh geometry={garland}><meshStandardMaterial vertexColors roughness={0.7} side={THREE.DoubleSide} /></mesh>}
      <instancedMesh ref={balloons} args={[balloonGeo, undefined, list.length]} frustumCulled={false}>
        <meshStandardMaterial roughness={0.25} metalness={0.15} />
      </instancedMesh>
      <instancedMesh ref={strings} args={[undefined, undefined, list.length]} frustumCulled={false}>
        <boxGeometry args={[0.008, 1, 0.008]} />
        <meshBasicMaterial color="#f5f5f4" />
      </instancedMesh>
      {frame.bulbs && <mesh geometry={frame.bulbs}><meshBasicMaterial ref={bulbMat} color="#ffd1dc" toneMapped={false} /></mesh>}
      {frame.halos && (
        <mesh geometry={frame.halos}>
          <meshBasicMaterial ref={haloMat} map={glowTex} color="#ff7aa2" transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
