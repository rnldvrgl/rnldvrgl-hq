"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneNow } from "@/lib/store";
import { ROOM } from "./palette";
import { PROCESSION, processionState, processionX } from "./procession";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { canvasTexture, joinGeometries, mergeParts, mergePlaced, placed, type Part } from "./batch";
import { acrossStreet } from "./Festive";
import { houseSpots, shopSpots } from "./Holidays";
import { alongLine, linePieces, person } from "./holiday-kit";

/**
 * Chinese New Year, on top of the red lanterns at every shop and gate and the red-and-gold bunting
 * (Festive.tsx): strings of big red lanterns across the main street, a gold 福 (fortune) diamond on every
 * gate and shop door, and a dragon dance winding slowly down the far lane, each part of the dragon on a pole
 * held up by a dancer, a drum and cymbals behind. The cars in that lane crawl along behind it (procession.ts).
 * Draw calls: lantern strings 3 (solid, glowing, halos), 福 signs 1, dragon head 1, body 1, dancers 1, poles 1, drum 1.
 */

const SEGS = 9, GAP = 0.82;
const LANE_Z = PROCESSION.z;

/** A red diamond with a gold border and 福 in gold. */
function fuTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    g.translate(64, 64); g.rotate(Math.PI / 4);
    g.fillStyle = "#c81e1e"; g.fillRect(-42, -42, 84, 84);
    g.strokeStyle = "#facc15"; g.lineWidth = 5; g.strokeRect(-37, -37, 74, 74);
    g.rotate(-Math.PI / 4);
    g.fillStyle = "#fcd34d"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 62px 'Noto Serif CJK SC', 'Noto Sans CJK SC', 'Songti SC', 'SimSun', 'Microsoft YaHei', serif";
    g.fillText("福", 0, 4);
  });
}

/** The dragon's head, facing −x (the way it dances down the street), its neck at the origin. */
function dragonHead(): Part[] {
  const red = "#dc2626", gold = "#facc15", P: Part[] = [];
  P.push({ size: [0.6, 0.36, 0.46], pos: [-0.15, 0, 0], color: red });
  P.push({ size: [0.4, 0.14, 0.4], pos: [-0.55, 0.06, 0], color: red });             // the snout
  P.push({ size: [0.42, 0.08, 0.38], pos: [-0.5, -0.2, 0], rot: [0, 0, 0.25], color: red }); // the open jaw
  P.push({ size: [0.36, 0.04, 0.3], pos: [-0.5, -0.12, 0], rot: [0, 0, 0.12], color: "#7f1d1d" });
  for (const s of [-1, 1]) {
    P.push({ size: [0.04, 0.05, 0.05], pos: [-0.72, -0.08, s * 0.14], color: "#f8fafc" }); // fangs
    P.push({ shape: "cyl", size: [0.08, 0.06, 10], pos: [-0.3, 0.17, s * 0.2], rot: [Math.PI / 2, 0, 0], color: "#f8fafc" }); // eyes
    P.push({ shape: "cyl", size: [0.045, 0.07, 8], pos: [-0.32, 0.17, s * 0.21], rot: [Math.PI / 2, 0, 0], color: "#111827" });
    P.push({ shape: "cone", size: [0.05, 0.36, 6], pos: [0.02, 0.36, s * 0.14], rot: [s * 0.3, 0, 0.6], color: gold }); // horns
    P.push({ size: [0.5, 0.02, 0.02], pos: [-0.85, 0.04, s * 0.18], rot: [0, s * 0.4, -0.3], color: gold }); // whiskers
  }
  P.push({ size: [0.62, 0.05, 0.48], pos: [-0.18, -0.18, 0], color: gold });
  // the mane: green and gold tufts along the back of the head
  for (let k = 0; k < 6; k++) P.push({ size: [0.1, 0.18, 0.5], pos: [0.12 - k * 0.07, 0.24 - (k % 2) * 0.04, 0], rot: [0, 0, 0.5], color: k % 2 ? "#16a34a" : gold });
  P.push({ size: [0.2, 0.2, 0.06], pos: [-0.7, -0.3, 0], color: "#f8fafc" }); // the beard
  return P;
}

/** One body segment (the tail ones are scaled down): a red hoop of cloth along x with a gold belly and a green-and-gold fin on top. */
function segment(): Part[] {
  const r = 0.24;
  return [
    { shape: "cyl", size: [r, GAP * 0.98, 10], pos: [0, 0, 0], rot: [0, 0, Math.PI / 2], color: "#dc2626" },
    { size: [GAP * 0.98, 0.04, r * 1.3], pos: [0, -r * 0.92, 0], color: "#facc15" },
    { size: [GAP * 0.6, 0.14, 0.03], pos: [0, r + 0.06, 0], color: "#16a34a" },
    { size: [GAP * 0.5, 0.06, 0.035], pos: [0, r + 0.15, 0], color: "#facc15" },
    { shape: "cyl", size: [r * 1.02, 0.05, 10], pos: [GAP * 0.45, 0, 0], rot: [0, 0, Math.PI / 2], color: "#facc15" },
  ];
}

export function Lunar({ frozen, lowPower }: { frozen: boolean; lowPower: boolean }) {
  const glowTex = useMemo(() => getGlowTexture(), []);
  const lanternMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const fuMat = useRef<THREE.MeshBasicMaterial>(null);
  const headMat = useRef<THREE.MeshStandardMaterial>(null);
  const bodyMat = useRef<THREE.MeshStandardMaterial>(null);
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const body = useRef<THREE.InstancedMesh>(null);
  const dancers = useRef<THREE.InstancedMesh>(null);
  const poles = useRef<THREE.InstancedMesh>(null);
  useEffect(() => { processionState.active = true; return () => { processionState.active = false; }; }, []);

  const strings = useMemo(() => {
    const { lines, poles: P } = acrossStreet();
    const solid: Part[] = [...P], glow: Part[] = [], halos: { x: number; y: number; z: number }[] = [];
    for (const ln of lines) {
      solid.push(...linePieces(ln, "#7f1d1d"));
      const len = ln.a.distanceTo(ln.b), n = Math.max(2, Math.floor(len / (lowPower ? 1.3 : 0.95)));
      for (let i = 1; i < n; i++) {
        const p = alongLine(ln, i / n), y = p.y - 0.36;
        glow.push({ shape: "cyl", size: [0.2, 0.3, 12], pos: [p.x, y, p.z], color: "#ef2b2b" });
        glow.push({ shape: "cyl", size: [0.17, 0.36, 12], pos: [p.x, y, p.z], color: "#f43f3f" });
        solid.push(
          { size: [0.012, 0.18, 0.012], pos: [p.x, p.y - 0.1, p.z], color: "#3f3a33" },
          { shape: "cyl", size: [0.12, 0.05, 10], pos: [p.x, y + 0.2, p.z], color: "#d4a017" },
          { shape: "cyl", size: [0.12, 0.05, 10], pos: [p.x, y - 0.2, p.z], color: "#d4a017" },
          { size: [0.04, 0.26, 0.04], pos: [p.x, y - 0.36, p.z], color: "#facc15" },
        );
        halos.push({ x: p.x, y, z: p.z });
      }
    }
    const plane = new THREE.PlaneGeometry(1.3, 1.3);
    const haloGeo = mergePlaced(halos.map((h) => ({ geometry: plane, matrix: placed([h.x, h.y, h.z + 0.05], [0, Math.PI / 4, 0]) })));
    plane.dispose();
    return { solid: mergeParts(solid), glow: mergeParts(glow), halos: haloGeo };
  }, [lowPower]);

  const fu = useMemo(() => {
    const tex = fuTexture();
    const plane = new THREE.PlaneGeometry(0.34, 0.34);
    const items: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    houseSpots().parols.forEach((p) => items.push({ geometry: plane, matrix: placed([p.x, 0.95, p.z + 0.03]) }));
    shopSpots().parols.forEach((p) => items.push({ geometry: plane, matrix: placed([p.x, 1.45, ROOM.D + 0.08], [0, 0, 0], [1.3, 1.3, 1]) }));
    items.push({ geometry: plane, matrix: placed([ROOM.W - 1.2, 1.5, ROOM.D + 0.08], [0, 0, 0], [1.6, 1.6, 1]) });
    const geo = mergePlaced(items);
    plane.dispose();
    return { tex, geo };
  }, []);

  const dragon = useMemo(() => {
    const segGeo = joinGeometries([mergeParts(segment())]);
    const dancer = mergeParts([
      ...person({ top: "#facc15", bottom: "#111827", skin: 2 }),
      { size: [0.22, 0.06, 0.38], pos: [0, 0.86, 0], color: "#dc2626" }, // a red sash
    ]);
    // the drum on its cart, a drummer and two with cymbals, following the tail
    const back = SEGS * GAP + 1.4;
    const drum: Part[] = [
      { size: [0.9, 0.08, 0.7], pos: [back, 0.45, 0], color: "#7f1d1d" },
      { shape: "cyl", size: [0.32, 0.4, 14], pos: [back, 0.72, 0], color: "#b91c1c" },
      { shape: "cyl", size: [0.33, 0.03, 14], pos: [back, 0.93, 0], color: "#f5e6c8" },
      ...[-0.35, 0.35].flatMap((dx) => [-0.3, 0.3].map((dz): Part => ({ shape: "cyl", size: [0.1, 0.05, 10], pos: [back + dx, 0.12, dz], rot: [Math.PI / 2, 0, 0], color: "#1f2937" }))),
      ...person({ top: "#dc2626", bottom: "#111827", skin: 1 }, [back + 0.7, 0, 0]),
      ...person({ top: "#dc2626", bottom: "#111827", skin: 3 }, [back + 1.4, 0, -0.35]),
      ...person({ top: "#dc2626", bottom: "#111827", skin: 0 }, [back + 1.4, 0, 0.35]),
      { shape: "cyl", size: [0.14, 0.02, 12], pos: [back + 1.25, 1.1, -0.35], rot: [0, 0, Math.PI / 2], color: "#d4a017" },
      { shape: "cyl", size: [0.14, 0.02, 12], pos: [back + 1.25, 1.1, 0.35], rot: [0, 0, Math.PI / 2], color: "#d4a017" },
    ];
    return { head: mergeParts(dragonHead()), segGeo, dancer, drum: mergeParts(drum) };
  }, []);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), p: Array.from({ length: SEGS + 2 }, () => new THREE.Vector3()) }), []);

  useFrame(({ clock }) => {
    const t = frozen ? 0 : clock.elapsedTime, k = streetLightLevel();
    if (lanternMat.current) lanternMat.current.color.setScalar(0.8 + 0.6 * k);
    if (haloMat.current) haloMat.current.opacity = 0.05 + k * 0.55;
    if (fuMat.current) fuMat.current.color.setScalar(0.85 + 0.25 * k);
    // lit up after dark, the way the dragon's LEDs glow at a night parade
    for (const m of [headMat.current, bodyMat.current]) if (m) m.emissiveIntensity = 0.08 + 0.4 * k;

    const x = processionX(sceneNow().getTime() / 1000);
    if (root.current) root.current.position.set(x, 0, LANE_Z);
    // the dragon's spine: a wave rolling back from the head, side to side and up and down
    for (let i = 0; i <= SEGS + 1; i++) {
      const ph = t * 2.2 - i * 0.62;
      tmp.p[i].set(i * GAP, 2.2 + Math.sin(ph) * 0.3, Math.sin(ph * 0.5) * 0.7);
    }
    const hd = head.current;
    if (hd) {
      hd.position.copy(tmp.p[0]);
      hd.rotation.set(0, Math.atan2(-(tmp.p[1].z - tmp.p[0].z), GAP), Math.sin(t * 2.2 + 1.2) * 0.25);
    }
    const bm = body.current, dm = dancers.current, pm = poles.current;
    if (!bm || !dm || !pm) return;
    const dancer = (i: number, x: number, z: number, top: number) => {
      const hop = frozen ? 0 : Math.max(0, Math.sin(t * 4.4 - i * 0.62)) * 0.08, hands = 1.15 + hop;
      tmp.e.set(0, Math.PI, 0, "XYZ");
      dm.setMatrixAt(i, tmp.m.compose(tmp.v.set(x, hop, z), tmp.q.setFromEuler(tmp.e), tmp.s.set(1, 1, 1)));
      // the pole from the dancer's hands up to the dragon
      pm.setMatrixAt(i, tmp.m.compose(tmp.v.set(x, (top + hands) / 2, z), tmp.q.identity(), tmp.s.set(1, Math.max(0.05, top - hands), 1)));
    };
    dancer(0, tmp.p[0].x + 0.05, tmp.p[0].z, tmp.p[0].y - 0.15);
    for (let i = 0; i < SEGS; i++) {
      // segment i hangs between spine points i and i+1, the last ones (the tail) thinner
      const a = tmp.p[i], b = tmp.p[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      tmp.e.set(0, Math.atan2(-dz, dx), Math.atan2(dy, Math.hypot(dx, dz)), "YZX");
      const thin = i === SEGS - 1 ? 0.7 : i === SEGS - 2 ? 0.85 : 1;
      bm.setMatrixAt(i, tmp.m.compose(tmp.v.lerpVectors(a, b, 0.5), tmp.q.setFromEuler(tmp.e), tmp.s.set(1, thin, thin)));
      dancer(i + 1, (a.x + b.x) / 2, (a.z + b.z) / 2, (a.y + b.y) / 2 - 0.2 * thin);
    }
    bm.instanceMatrix.needsUpdate = true;
    dm.instanceMatrix.needsUpdate = true;
    pm.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {strings.solid && <mesh geometry={strings.solid}><meshStandardMaterial vertexColors roughness={0.7} /></mesh>}
      {strings.glow && <mesh geometry={strings.glow}><meshBasicMaterial ref={lanternMat} vertexColors toneMapped={false} /></mesh>}
      {strings.halos && (
        <mesh geometry={strings.halos}>
          <meshBasicMaterial ref={haloMat} map={glowTex} color="#ff5a3a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
      {fu.geo && <mesh geometry={fu.geo}><meshBasicMaterial ref={fuMat} map={fu.tex} transparent alphaTest={0.4} side={THREE.DoubleSide} toneMapped={false} /></mesh>}
      <group ref={root} position={[PROCESSION.x1, 0, LANE_Z]}>
        <group ref={head}>{dragon.head && <mesh geometry={dragon.head} castShadow><meshStandardMaterial ref={headMat} vertexColors roughness={0.5} metalness={0.15} emissive="#ff3a1a" emissiveIntensity={0.1} /></mesh>}</group>
        {dragon.segGeo && (
          <instancedMesh ref={body} args={[dragon.segGeo, undefined, SEGS]} frustumCulled={false} castShadow>
            <meshStandardMaterial ref={bodyMat} vertexColors roughness={0.55} metalness={0.1} side={THREE.DoubleSide} emissive="#ff3a1a" emissiveIntensity={0.1} />
          </instancedMesh>
        )}
        {dragon.dancer && (
          <instancedMesh ref={dancers} args={[dragon.dancer, undefined, SEGS + 1]} frustumCulled={false} castShadow>
            <meshStandardMaterial vertexColors roughness={0.85} />
          </instancedMesh>
        )}
        <instancedMesh ref={poles} args={[undefined, undefined, SEGS + 1]} frustumCulled={false}>
          <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
          <meshStandardMaterial color="#a16207" roughness={0.8} />
        </instancedMesh>
        {dragon.drum && <mesh geometry={dragon.drum} castShadow><meshStandardMaterial vertexColors roughness={0.8} /></mesh>}
      </group>
    </group>
  );
}
