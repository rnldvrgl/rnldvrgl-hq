"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ROOM } from "./palette";
import { FAR_WALK, SIDEWALK } from "./world";
import { EST } from "./Neighbourhood";
import { light } from "./Lighting";
import { canvasTexture, joinGeometries, mergeParts, mergePlaced, placed, type Part } from "./batch";
import { at, houseSpots, tinted } from "./Holidays";
import { mainLamps } from "./holiday-kit";

/**
 * Independence Day (Araw ng Kalayaan) and the flag days around it, on top of the little flags at every shop
 * and gate and the blue, red and yellow bunting (Festive.tsx):
 *   a Philippine flag on a bracket on every lamp post along the main road;
 *   a tall flagpole with a big flag at the office's front corner;
 *   a giant flag hung across the main street on a cable;
 *   pleated half-moon fans in blue, white and red at the house gates and the shop fronts.
 * The flags ripple in the wind (a vertex wave in the shader, so it costs nothing on the CPU).
 * Draw calls: flags 1, poles and brackets 1, fans 1.
 */

/** The Philippine flag: blue over red, the white triangle at the hoist with the golden sun and three stars. */
function flagTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 256, (g) => {
    const W = 512, H = 256, tw = H * 0.866;
    g.fillStyle = "#0038a8"; g.fillRect(0, 0, W, H / 2);
    g.fillStyle = "#ce1126"; g.fillRect(0, H / 2, W, H / 2);
    g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(0, 0); g.lineTo(tw, H / 2); g.lineTo(0, H); g.closePath(); g.fill();
    g.fillStyle = "#fcd116";
    const star = (cx: number, cy: number, R: number) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.4 : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      g.closePath(); g.fill();
    };
    // the sun: a disc and eight rays (each a narrow triangle with two thinner beside it)
    const sx = tw * 0.36, sy = H / 2;
    g.beginPath(); g.arc(sx, sy, H * 0.075, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 8; k++) {
      for (const off of [-0.2, 0, 0.2]) {
        const a = (k * Math.PI) / 4 + off, len = off ? H * 0.15 : H * 0.18, wd = off ? 0.035 : 0.06;
        g.beginPath();
        g.moveTo(sx + Math.cos(a - wd) * H * 0.085, sy + Math.sin(a - wd) * H * 0.085);
        g.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        g.lineTo(sx + Math.cos(a + wd) * H * 0.085, sy + Math.sin(a + wd) * H * 0.085);
        g.closePath(); g.fill();
      }
    }
    star(H * 0.09, H * 0.1, H * 0.05);
    star(H * 0.09, H * 0.9, H * 0.05);
    star(tw * 0.83, H / 2, H * 0.05);
  });
}

/** The tall flagpole at the office's front corner. */
const POLE = { x: ROOM.W - 0.45, z: SIDEWALK.z0 + 0.3, h: 6.6, w: 2.3 } as const;
/** The giant flag across the street, just past the office (where the New Year banner hangs in its season). */
const ACROSS = { x: ROOM.W + 4, z0: SIDEWALK.z0 + 0.3, z1: FAR_WALK.z1 - 0.3, w: 5.2, top: 6.0 } as const;

export function Kalayaan({ frozen }: { frozen: boolean }) {
  const time = useMemo(() => ({ value: 0 }), []);

  const flags = useMemo(() => {
    const tex = flagTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false });
    // the wind: ripple each flag along its normal, more toward the fly end (uv.x = 1), none at the hoist
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = time;
      sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  float flyEnd = vMapUv.x;\n  transformed += normal * sin(vMapUv.x * 9.0 - uTime * 3.2 + position.x * 0.6 + position.z * 0.6) * 0.05 * flyEnd;",
      );
    };

    const items: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    const solid: Part[] = [];
    const seg = (w: number, h: number) => new THREE.PlaneGeometry(w, h, 10, 2);
    const small = seg(0.9, 0.45), big = seg(POLE.w, POLE.w / 2), giant = seg(ACROSS.w, ACROSS.w / 2);
    // on every lamp post along the main road: a bracket at the top, the flag hanging from it, flying along the street
    for (const l of mainLamps()) {
      if (l.x < -48 || l.x > 76) continue;
      const y = 2.15;
      items.push({ geometry: small, matrix: placed([l.x + 0.05 + 0.45, y, l.z], [0, 0, 0]) });
      solid.push({ size: [0.98, 0.025, 0.025], pos: [l.x + 0.49, y + 0.235, l.z], color: "#d6d3d1" });
      solid.push({ size: [0.04, 0.12, 0.04], pos: [l.x + 0.03, y + 0.2, l.z], color: "#9ca3af" });
    }
    // the tall pole at the office's corner, with a gold finial
    solid.push({ shape: "cyl", size: [0.06, POLE.h, 10], pos: [POLE.x, POLE.h / 2 - 0.1, POLE.z], color: "#e5e7eb" });
    solid.push({ shape: "cyl", size: [0.22, 0.2, 12], pos: [POLE.x, 0.0, POLE.z], color: "#9ca3af" });
    solid.push({ size: [0.12, 0.12, 0.12], pos: [POLE.x, POLE.h, POLE.z], color: "#d4a017" });
    items.push({ geometry: big, matrix: placed([POLE.x + 0.06 + POLE.w / 2, POLE.h - 0.25 - POLE.w / 4, POLE.z]) });
    // the giant one across the street, on a cable between two poles, readable from both ends
    const cz = (ACROSS.z0 + ACROSS.z1) / 2, fh = ACROSS.w / 2;
    items.push({ geometry: giant, matrix: placed([ACROSS.x + 0.02, ACROSS.top - fh / 2, cz], [0, Math.PI / 2, 0]) });
    for (const z of [ACROSS.z0, ACROSS.z1]) solid.push({ shape: "cyl", size: [0.06, ACROSS.top + 0.4, 8], pos: [ACROSS.x, (ACROSS.top + 0.4) / 2 - 0.1, z], color: "#9ca3af" });
    solid.push({ size: [0.02, 0.02, ACROSS.z1 - ACROSS.z0], pos: [ACROSS.x, ACROSS.top + 0.02, cz], color: "#3f3a33" });
    const geo = mergePlaced(items);
    small.dispose(); big.dispose(); giant.dispose();

    // pleated fans (a half-moon of blue, white and red bands, a gold sun at the centre), facing the street
    const fans: THREE.BufferGeometry[] = [];
    const fan = (x: number, y: number, z: number, r: number) => {
      const bands: [number, number, string][] = [[0.66, 1, "#1d4ed8"], [0.36, 0.66, "#f8fafc"], [0.14, 0.36, "#dc2626"]];
      for (const [a, b, c] of bands) fans.push(tinted(new THREE.RingGeometry(r * a, r * b, 16, 1, Math.PI, Math.PI), c, at(x, y, z)));
      fans.push(tinted(new THREE.CircleGeometry(r * 0.14, 12, Math.PI, Math.PI), "#facc15", at(x, y, z + 0.004)));
      // the pleats: thin darker spokes
      for (let k = 1; k < 8; k++) {
        const a = Math.PI + (k * Math.PI) / 8;
        fans.push(tinted(new THREE.PlaneGeometry(r * 0.86, 0.012), "#1e3a8a", at(x, y, z + 0.006).multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeTranslation(r * 0.57, 0, 0))));
      }
    };
    houseSpots().parols.forEach((p) => fan(p.x, 1.62, p.z + 0.02, 0.42));
    // at the two top corners of each shop front, clear of its sign
    for (const e of EST) for (const x of [e.x0 + 0.5, e.x1 - 0.5]) fan(x, e.h - 0.2, ROOM.D + 0.07, 0.42);
    return { geo, mat, solid: mergeParts(solid), fans: joinGeometries(fans) };
  }, [time]);

  useFrame(({ clock }) => {
    if (!frozen) time.value = clock.elapsedTime;
    // unlit, so dim them by night (the street lamps still catch them)
    flags.mat.color.setScalar(1 - 0.45 * light.night);
  });

  return (
    <group>
      {flags.geo && <mesh geometry={flags.geo} material={flags.mat} />}
      {flags.solid && <mesh geometry={flags.solid} castShadow><meshStandardMaterial vertexColors roughness={0.5} metalness={0.3} /></mesh>}
      {flags.fans && <mesh geometry={flags.fans}><meshStandardMaterial vertexColors roughness={0.85} side={THREE.DoubleSide} /></mesh>}
    </group>
  );
}
