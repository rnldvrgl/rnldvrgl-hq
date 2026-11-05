"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { DEN, ROOM, type Palette } from "./palette";
import { getGlowTexture, light } from "./Lighting";
import { mergeParts, mergePlaced, placed, type Part } from "./batch";

/**
 * The Den: the cozy wing on the office's left (DEN.x0 … 0), through the passage in the bookcase divider.
 *   along its outer wall   floor-to-ceiling library shelves with a rolling ladder, an electric fireplace with a
 *                          stone surround and a mantel, more shelves
 *   in the middle          a big rug, an L-shaped sofa facing the fire, a round coffee table, pendant globes
 *   at the back            a reading nook (armchair, floor lamp, side table) and a hanging egg chair by a fig tree
 *   at the front           bean bags round a low table with a board game, and a hammock under the window
 * Plus warm globe pendants over both rows of desks in the main room. Static parts are one vertex-coloured
 * mesh; everything that glows is one more; the fire flickers; halos come on in the evening.
 */

const X0 = DEN.x0, H = ROOM.H;
const BOOKS = ["#9a3412", "#1e3a5f", "#d4a017", "#2f6f63", "#6d4c9a", "#efe6d6", "#9f1239", "#3f6212", "#78350f", "#0f766e"];

/** A bookcase against the outer wall from z0 to z1: carcass, shelves, books (varied heights, the odd leaning one). */
function library(p: Part[], z0: number, z1: number, wood: string): void {
  const d = 0.36, x = X0 + d / 2, len = z1 - z0, cz = (z0 + z1) / 2, top = H - 0.1;
  p.push({ size: [d, top, 0.05], pos: [x, top / 2, z0], color: wood }, { size: [d, top, 0.05], pos: [x, top / 2, z1], color: wood });
  p.push({ size: [0.03, top, len], pos: [X0 + 0.015, top / 2, cz], color: "#5b4030" });
  const levels = 5;
  for (let l = 0; l <= levels; l++) {
    const y = 0.08 + l * ((top - 0.1) / levels);
    p.push({ size: [d, 0.04, len], pos: [x, y, cz], color: wood });
    if (l === levels) break;
    let z = z0 + 0.06, k = l * 7;
    while (z < z1 - 0.12) {
      const w = 0.045 + ((k * 13) % 5) * 0.008, h = 0.24 + ((k * 7) % 6) * 0.025;
      if ((k * 11) % 9 === 0) { z += 0.12; k++; continue; } // a gap, a little ornament would go here
      p.push({ size: [0.24, h, w], pos: [X0 + 0.19, y + 0.02 + h / 2, z + w / 2], rot: (k * 5) % 17 === 0 ? [0.25, 0, 0] : undefined, color: BOOKS[k % BOOKS.length] });
      z += w + 0.006; k++;
    }
  }
  // a rolling ladder leaning on the rail
  const lz = z0 + len * 0.62;
  p.push({ size: [0.03, 0.03, len], pos: [X0 + 0.42, top - 0.25, cz], color: "#3f3a33" });
  for (const dz of [-0.22, 0.22]) p.push({ size: [0.04, top - 0.1, 0.04], pos: [X0 + 0.75, (top - 0.1) / 2, lz + dz], rot: [0, 0, 0.16], color: "#6b4430" });
  for (let r = 0; r < 7; r++) p.push({ size: [0.04, 0.03, 0.44], pos: [X0 + 0.92 - r * 0.055, 0.25 + r * 0.32, lz], color: "#6b4430" });
}

function denParts(pal: Palette): { solid: Part[]; glow: Part[]; fire: Part[]; halos: [number, number, number, number][] } {
  const S: Part[] = [], G: Part[] = [], F: Part[] = [], halos: [number, number, number, number][] = [];
  const wood = "#a0714b", walnut = "#6b4430", cream = "#f3ece0";

  // the big rug: border and field, under the sofa group
  S.push({ size: [4.6, 0.012, 4.4], pos: [-3.25, 0.006, 5.9], color: cream });
  S.push({ size: [4.3, 0.014, 4.1], pos: [-3.25, 0.008, 5.9], color: "#b5654a" });
  for (let k = 0; k < 4; k++) S.push({ size: [3.9 - k * 0.8, 0.016, 0.06], pos: [-3.25, 0.01, 4.3 + k * 1.05], color: "#e7c9a0" });

  // libraries either side of the fireplace
  library(S, 0.3, 4.4, wood);
  library(S, 7.4, 10.9, wood);

  // the fireplace: stone surround, black firebox, timber mantel, a framed print over it
  const fz = 5.9;
  S.push({ size: [0.5, 1.15, 2.1], pos: [X0 + 0.25, 0.575, fz], color: "#78716c" });
  for (let k = 0; k < 10; k++) S.push({ size: [0.52, 0.1, 0.36], pos: [X0 + 0.25, 0.1 + (k % 5) * 0.22, fz - 0.85 + Math.floor(k / 5) * 1.7], color: k % 2 ? "#a8a29e" : "#8a837d" });
  S.push({ size: [0.52, 0.62, 1.2], pos: [X0 + 0.26, 0.5, fz], color: "#1c1917" });
  S.push({ size: [0.62, 0.1, 2.3], pos: [X0 + 0.3, 1.2, fz], color: walnut });
  S.push({ size: [0.04, 0.8, 1.3], pos: [X0 + 0.03, 1.85, fz], color: "#1f2937" });
  S.push({ size: [0.05, 0.7, 1.2], pos: [X0 + 0.05, 1.85, fz], color: "#e7d8c0" });
  S.push({ size: [0.06, 0.3, 0.9], pos: [X0 + 0.07, 1.8, fz], color: "#b45309" }, { size: [0.06, 0.18, 0.9], pos: [X0 + 0.071, 2.02, fz], color: "#15803d" });
  for (const dz of [-0.85, 0.85]) S.push({ shape: "cyl", size: [0.07, 0.18, 10], pos: [X0 + 0.3, 1.34, fz + dz], color: "#e7e5e4" }, { shape: "cyl", size: [0.14, 0.2, 8], pos: [X0 + 0.3, 1.5, fz + dz], color: "#3f7d4a" });
  // the fire itself: logs and flames (flames flicker in the frame loop)
  S.push({ shape: "cyl", size: [0.05, 0.7, 8], pos: [X0 + 0.32, 0.26, fz], rot: [Math.PI / 2, 0, 0.1], color: "#57381f" });
  for (let k = 0; k < 5; k++) F.push({ size: [0.06, 0.16 + (k % 3) * 0.06, 0.12], pos: [X0 + 0.33, 0.38 + (k % 3) * 0.03, fz - 0.4 + k * 0.2], color: k % 2 ? "#fb923c" : "#fde047" });
  halos.push([X0 + 0.55, 0.45, fz, 1.6]);
  // a basket of firewood and a cat bed by the hearth
  S.push({ shape: "cyl", size: [0.2, 0.28, 10], pos: [X0 + 0.45, 0.14, fz + 1.4], color: "#a16207" }, { shape: "cyl", size: [0.26, 0.12, 14], pos: [X0 + 0.55, 0.06, fz - 1.45], color: "#e7e5e4" });

  // the L-shaped sofa facing the fire: oatmeal fabric, sage cushions
  const sofa = "#d6c7b0", cush = "#7c8f6a";
  S.push({ size: [0.9, 0.42, 3.2], pos: [-1.35, 0.21, 5.8], color: sofa });
  S.push({ size: [0.25, 0.85, 3.2], pos: [-0.9, 0.43, 5.8], color: sofa });
  S.push({ size: [2.7, 0.42, 0.9], pos: [-2.9, 0.21, 7.85], color: sofa });
  S.push({ size: [2.7, 0.85, 0.25], pos: [-2.8, 0.43, 8.3], color: sofa });
  for (let k = 0; k < 3; k++) S.push({ size: [0.7, 0.14, 0.95], pos: [-1.4, 0.49, 4.65 + k * 1.0], color: "#e7dcc8" });
  for (let k = 0; k < 4; k++) S.push({ size: [0.16, 0.36, 0.42], pos: [-1.08, 0.72, 4.5 + k * 0.85], rot: [0, 0, -0.2], color: k % 2 ? cush : "#c2855f" });
  for (let k = 0; k < 3; k++) S.push({ size: [0.42, 0.34, 0.16], pos: [-3.9 + k * 0.85, 0.7, 8.12], rot: [0.2, 0, 0], color: k % 2 ? "#c2855f" : cush });
  S.push({ size: [0.9, 0.05, 0.7], pos: [-2.2, 0.66, 7.85], rot: [0, 0.4, 0], color: "#e5d3b3" }); // a throw
  // round coffee table with books, a mug, a candle; two poufs
  S.push({ shape: "cyl", size: [0.6, 0.06, 20], pos: [-3.5, 0.42, 5.8], color: walnut }, { shape: "cyl", size: [0.08, 0.4, 8], pos: [-3.5, 0.2, 5.8], color: walnut });
  S.push({ size: [0.32, 0.06, 0.24], pos: [-3.6, 0.48, 5.65], color: "#1e3a5f" }, { size: [0.28, 0.05, 0.22], pos: [-3.6, 0.535, 5.66], rot: [0, 0.3, 0], color: "#d4a017" });
  S.push({ shape: "cyl", size: [0.04, 0.08, 10], pos: [-3.25, 0.49, 5.95], color: "#f5f5f4" });
  G.push({ size: [0.03, 0.05, 0.03], pos: [-3.7, 0.53, 6.05], color: "#fde68a" });
  halos.push([-3.7, 0.6, 6.05, 0.5]);
  for (const [x, z, c] of [[-4.6, 4.6, "#d97757"], [-4.7, 7.0, "#e7dcc8"]] as const) S.push({ shape: "cyl", size: [0.28, 0.36, 14], pos: [x, 0.18, z], color: c });

  // three globe pendants over the coffee table, on long cords
  for (const [x, z] of [[-3.1, 5.2], [-3.6, 5.9], [-3.1, 6.6]] as const) {
    S.push({ size: [0.012, 0.6, 0.012], pos: [x, H - 0.3, z], color: "#1c1917" });
    G.push({ shape: "cyl", size: [0.16, 0.26, 14], pos: [x, H - 0.72, z], color: "#ffe4b5" });
    halos.push([x, H - 0.72, z, 1.1]);
  }

  // the reading nook at the back: an armchair, a floor lamp with a linen shade, a side table with a plant
  const ax = -4.7, az = 1.5;
  S.push({ size: [0.85, 0.42, 0.85], pos: [ax, 0.21, az], color: "#b45309" }, { size: [0.85, 0.75, 0.2], pos: [ax, 0.55, az - 0.4], color: "#b45309" });
  for (const dx of [-0.4, 0.4]) S.push({ size: [0.15, 0.6, 0.85], pos: [ax + dx, 0.42, az], color: "#9a4a0c" });
  S.push({ size: [0.6, 0.12, 0.6], pos: [ax, 0.48, az + 0.02], color: "#f3ece0" });
  S.push({ shape: "cyl", size: [0.15, 0.03, 10], pos: [ax + 1.0, 0.02, az - 0.3], color: "#1c1917" }, { size: [0.025, 1.5, 0.025], pos: [ax + 1.0, 0.76, az - 0.3], color: "#1c1917" });
  G.push({ shape: "cyl", size: [0.22, 0.3, 14], pos: [ax + 1.0, 1.55, az - 0.3], color: "#fff1d6" });
  halos.push([ax + 1.0, 1.5, az - 0.3, 1.3]);
  S.push({ shape: "cyl", size: [0.22, 0.5, 12], pos: [ax - 0.85, 0.25, az + 0.1], color: walnut }, { shape: "cyl", size: [0.12, 0.16, 8], pos: [ax - 0.85, 0.58, az + 0.1], color: "#e7e5e4" }, { shape: "cyl", size: [0.18, 0.22, 8], pos: [ax - 0.85, 0.75, az + 0.1], color: "#4a7f50" });

  // the hanging egg chair by the fig tree, near the divider
  const ex = -1.6, ez = 1.6;
  S.push({ size: [0.02, 0.9, 0.02], pos: [ex, H - 0.45, ez], color: "#a8a29e" });
  S.push({ shape: "cyl", size: [0.45, 0.95, 14], pos: [ex, 1.0, ez], color: "#c8a46a" });
  S.push({ shape: "cyl", size: [0.36, 0.2, 14], pos: [ex + 0.08, 0.7, ez + 0.08], color: "#f3ece0" });
  S.push({ shape: "cyl", size: [0.22, 0.45, 12], pos: [-0.75, 0.22, 0.7], color: "#e7e5e4" }, { shape: "cyl", size: [0.05, 1.3, 6], pos: [-0.75, 1.0, 0.7], color: "#6b4430" });
  for (let k = 0; k < 7; k++) S.push({ shape: "cyl", size: [0.3 - (k % 3) * 0.05, 0.4, 7], pos: [-0.75 + Math.cos(k * 1.9) * 0.25, 1.6 + (k % 4) * 0.18, 0.7 + Math.sin(k * 1.9) * 0.25], color: k % 2 ? "#3f7d4a" : "#2f6b3c" });

  // the front corner: bean bags round a low table with a board game, a hammock under the window
  for (const [x, z, c] of [[-4.6, 9.3, "#c2410c"], [-3.3, 9.0, "#0f766e"], [-2.0, 9.4, "#d4a017"]] as const) {
    S.push({ shape: "cyl", size: [0.42, 0.42, 12], pos: [x, 0.21, z], color: c });
    S.push({ shape: "cyl", size: [0.3, 0.22, 12], pos: [x - 0.05, 0.42, z - 0.08], rot: [0.3, 0, 0], color: c });
  }
  S.push({ size: [1.0, 0.24, 0.6], pos: [-3.3, 0.12, 9.9], color: walnut }, { size: [0.5, 0.02, 0.4], pos: [-3.3, 0.25, 9.9], color: "#16a34a" });
  for (let k = 0; k < 6; k++) S.push({ size: [0.04, 0.05, 0.04], pos: [-3.45 + (k % 3) * 0.14, 0.28, 9.8 + Math.floor(k / 3) * 0.18], color: k % 2 ? "#dc2626" : "#f8fafc" });
  for (const x of [-5.8, -2.6]) S.push({ size: [0.1, 1.7, 0.1], pos: [x, 0.85, 10.75], color: walnut });
  S.push({ size: [3.0, 0.03, 0.03], pos: [-4.2, 1.35, 10.75], color: "#d6d3d1" });
  // the hammock: a sagging cloth, stripes
  for (let k = 0; k < 9; k++) {
    const t = k / 8, x = -5.6 + t * 2.8, y = 1.25 - Math.sin(Math.PI * t) * 0.55;
    S.push({ size: [0.36, 0.03, 0.8], pos: [x, y, 10.75], rot: [0, 0, (t - 0.5) * -1.0], color: k % 2 ? "#f97316" : "#fde68a" });
  }

  // plants: a big monstera by the passage, a snake plant, trailing pothos from the ceiling along the back wall
  S.push({ shape: "cyl", size: [0.26, 0.45, 12], pos: [-0.9, 0.22, 9.0], color: "#1c1917" });
  for (let k = 0; k < 6; k++) S.push({ size: [0.5, 0.04, 0.34], pos: [-0.9 + Math.cos(k) * 0.3, 0.75 + (k % 3) * 0.2, 9.0 + Math.sin(k) * 0.3], rot: [0.3, k, 0.4], color: "#166534" });
  for (const x of [-5.6, -3.4, -1.2]) {
    S.push({ size: [0.01, 0.4, 0.01], pos: [x, H - 0.2, 0.35], color: "#a8a29e" }, { shape: "cyl", size: [0.16, 0.16, 10], pos: [x, H - 0.45, 0.35], color: "#e7e5e4" });
    for (let k = 0; k < 4; k++) S.push({ size: [0.05, 0.5 + k * 0.12, 0.05], pos: [x - 0.1 + k * 0.07, H - 0.75 - k * 0.06, 0.35], color: "#3f7d4a" });
  }
  // a gallery of frames on the back wall
  for (const [x, y, w, h, c] of [[-5.0, 1.75, 0.6, 0.8, "#b45309"], [-4.2, 1.95, 0.5, 0.5, "#0f766e"], [-4.2, 1.35, 0.5, 0.4, "#be123c"], [-3.3, 1.7, 0.7, 0.9, "#1e3a5f"]] as const) {
    S.push({ size: [w, h, 0.03], pos: [x, y, 0.03], color: "#1c1917" }, { size: [w - 0.08, h - 0.08, 0.035], pos: [x, y, 0.035], color: c });
  }

  // the main room: warm globe pendants over both rows of desks
  for (const z of [2.4, 6.2]) for (let k = 0; k < 4; k++) {
    const x = 1.85 + k * 2.4;
    S.push({ size: [0.01, 0.5, 0.01], pos: [x, H - 0.25, z], color: "#1c1917" });
    G.push({ shape: "cyl", size: [0.13, 0.2, 12], pos: [x, H - 0.6, z], color: "#ffe4b5" });
    halos.push([x, H - 0.6, z, 0.9]);
  }
  return { solid: S, glow: G, fire: F, halos };
}

export function Den({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const fireMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => getGlowTexture(), []);
  const geo = useMemo(() => {
    const d = denParts(pal);
    const plane = new THREE.PlaneGeometry(1, 1);
    const halos = mergePlaced(d.halos.map(([x, y, z, r]) => ({ geometry: plane, matrix: placed([x, y, z], [-0.5, Math.PI / 4, 0], [r, r, 1]) })));
    plane.dispose();
    return { solid: mergeParts(d.solid), glow: mergeParts(d.glow), fire: mergeParts(d.fire), halos };
  }, [pal]);

  useFrame(({ clock }) => {
    // the lamps are on all day (it's cozy), brighter in the evening; the fire flickers
    const eve = Math.max(light.night, light.lamps);
    if (glowMat.current) glowMat.current.color.setScalar(0.85 + eve * 0.5);
    const t = clock.elapsedTime;
    if (fireMat.current) fireMat.current.color.setScalar(1 + Math.sin(t * 11) * 0.15 + Math.sin(t * 23) * 0.1);
    if (haloMat.current) haloMat.current.opacity = 0.18 + eve * 0.4 + Math.sin(t * 9) * 0.02;
  });

  return (
    <group>
      {geo.solid && <mesh geometry={geo.solid} castShadow={shadows} receiveShadow={shadows}><meshStandardMaterial vertexColors roughness={0.85} /></mesh>}
      {geo.glow && <mesh geometry={geo.glow}><meshBasicMaterial ref={glowMat} vertexColors toneMapped={false} /></mesh>}
      {geo.fire && <mesh geometry={geo.fire}><meshBasicMaterial ref={fireMat} vertexColors toneMapped={false} /></mesh>}
      {geo.halos && (
        <mesh geometry={geo.halos} renderOrder={3}>
          <meshBasicMaterial ref={haloMat} map={tex} color="#ffcf8a" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
