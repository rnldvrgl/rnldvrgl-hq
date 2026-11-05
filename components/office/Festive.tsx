"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Decor } from "@/lib/holidays";
import { ROOM } from "./palette";
import { FAR_WALK, SIDEWALK, SIDE_STREETS } from "./world";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { joinGeometries, mergeParts, mergePlaced, placed, type Part } from "./batch";
import { at, houseSpots, shopSpots, tinted, type Spot, type Strand } from "./Holidays";

/**
 * The town dressed up for a holiday other than Christmas (lib/holidays.ts says which and how):
 *   ornaments at every shop front and house gate (red lanterns, hearts, Philippine flags, jack-o'-lanterns,
 *   candles), banderitas (triangle bunting) along the shops and gates and, for fiestas, across the street.
 * All of it is merged: lit parts (1 draw call), glowing parts (1), their halos at night (1), bunting (1).
 */

const OFFICE_FRONT: Spot = { x: 7.4, y: 1.95, z: ROOM.D - 0.08, R: 0.5 };

/* ------------------------------------------------------------------ bunting */

/** Triangle flags hanging from a sagging string from a to b, the colours taking turns. Vertex-coloured. */
function buntingGeometry(lines: { a: THREE.Vector3; b: THREE.Vector3; sag: number }[], colors: readonly string[]): THREE.BufferGeometry | null {
  const pos: number[] = [], col: number[] = [];
  const c = new THREE.Color();
  const p = new THREE.Vector3(), l = new THREE.Vector3(), r = new THREE.Vector3();
  const along = (ln: { a: THREE.Vector3; b: THREE.Vector3; sag: number }, t: number, out: THREE.Vector3) =>
    out.lerpVectors(ln.a, ln.b, t).setY(out.y - Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * ln.sag);
  let k = 0;
  for (const ln of lines) {
    const len = ln.a.distanceTo(ln.b);
    const n = Math.max(2, Math.floor(len / 0.4));
    const half = 0.16 / len;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      along(ln, t - half, l); along(ln, t + half, r); along(ln, t, p);
      const tip = p.clone().setY(p.y - 0.34);
      pos.push(l.x, l.y, l.z, r.x, r.y, r.z, tip.x, tip.y, tip.z);
      c.set(colors[k++ % colors.length]).convertSRGBToLinear();
      for (let v = 0; v < 3; v++) col.push(c.r, c.g, c.b);
    }
    // the string itself: a thin dark ribbon
    for (let i = 0; i < n; i++) {
      along(ln, i / n, l); along(ln, (i + 1) / n, r);
      pos.push(l.x, l.y + 0.012, l.z, r.x, r.y + 0.012, r.z, r.x, r.y - 0.012, r.z, l.x, l.y + 0.012, l.z, r.x, r.y - 0.012, r.z, l.x, l.y - 0.012, l.z);
      c.set("#3f3a33").convertSRGBToLinear();
      for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const strandLine = (s: Strand, lift: number) => ({ a: new THREE.Vector3(s.x0, s.y + lift, s.z), b: new THREE.Vector3(s.x1, s.y + lift, s.z), sag: s.sag + 0.06 });

/** Strings across the main street every 7 m through the middle of town, tied to bamboo poles on both sides. */
export function acrossStreet(): { lines: { a: THREE.Vector3; b: THREE.Vector3; sag: number }[]; poles: Part[] } {
  const lines: { a: THREE.Vector3; b: THREE.Vector3; sag: number }[] = [], poles: Part[] = [];
  const zNear = SIDEWALK.z0 + 0.35, zFar = FAR_WALK.z1 - 0.35, top = 3.6;
  for (let x = -24; x <= 48; x += 7) {
    if (SIDE_STREETS.some((s) => x > s.x0 - 0.5 && x < s.x1 + 0.5)) continue;
    // zig-zag: each string crosses at a slant, like a real fiesta street
    const x2 = x + 3.5;
    lines.push({ a: new THREE.Vector3(x, top, zNear), b: new THREE.Vector3(x2, top, zFar), sag: 0.55 });
    for (const [px, pz] of [[x, zNear], [x2, zFar]] as const) poles.push({ shape: "cyl", size: [0.04, top + 0.1, 6], pos: [px, (top + 0.1) / 2, pz], color: "#c8a463" });
  }
  return { lines, poles };
}

/* ------------------------------------------------------------------ ornaments */

type Built = { lit: Part[]; litGeo: THREE.BufferGeometry[]; glow: Part[]; glowGeo: THREE.BufferGeometry[]; halos: Spot[] };

export function heartShape(s: number): THREE.Shape {
  const h = new THREE.Shape();
  h.moveTo(0, -s);
  h.bezierCurveTo(s * 1.2, -s * 0.2, s * 1.1, s * 0.9, 0, s * 0.45);
  h.bezierCurveTo(-s * 1.1, s * 0.9, -s * 1.2, -s * 0.2, 0, -s);
  return h;
}

function ornament(kind: NonNullable<Decor["ornament"]>, s: Spot, i: number, out: Built, ground: number) {
  const { x, y, z, R } = s;
  switch (kind) {
    case "lantern": {
      // a red paper lantern: body, gold caps, a tassel, hanging on a short cord
      out.glow.push({ shape: "cyl", size: [R * 0.85, R * 1.25, 10], pos: [x, y, z], color: "#e11d1d" });
      out.lit.push(
        { shape: "cyl", size: [R * 0.5, R * 0.12, 10], pos: [x, y + R * 0.68, z], color: "#d4a017" },
        { shape: "cyl", size: [R * 0.5, R * 0.12, 10], pos: [x, y - R * 0.68, z], color: "#d4a017" },
        { size: [0.015, R * 0.6, 0.015], pos: [x, y + R * 1.05, z], color: "#3f3a33" },
        { size: [R * 0.12, R * 0.55, R * 0.12], pos: [x, y - R * 1.0, z], color: "#facc15" },
      );
      out.halos.push(s);
      break;
    }
    case "heart": {
      const color = i % 2 ? "#ef4444" : "#ec4899";
      out.glowGeo.push(tinted(new THREE.ShapeGeometry(heartShape(R * 0.8)), color, at(x, y, z + 0.01)));
      out.halos.push({ ...s, R: R * 0.7 });
      break;
    }
    case "flag": {
      // the Philippine flag on a short pole: blue over red, a white triangle at the hoist with the gold sun
      const w = R * 2.2, h = w / 2, fx = x + 0.04 + w / 2, fy = y + 0.1;
      out.lit.push({ shape: "cyl", size: [0.015, h + 0.55, 6], pos: [x, fy - 0.25 + h / 2 - 0.02, z], color: "#d6d3d1" });
      out.litGeo.push(
        tinted(new THREE.PlaneGeometry(w, h / 2), "#1d4ed8", at(fx, fy + h / 4, z)),
        tinted(new THREE.PlaneGeometry(w, h / 2), "#dc2626", at(fx, fy - h / 4, z)),
      );
      const tri = new THREE.Shape();
      tri.moveTo(0, h / 2); tri.lineTo(h * 0.87, 0); tri.lineTo(0, -h / 2); tri.closePath();
      out.litGeo.push(tinted(new THREE.ShapeGeometry(tri), "#f8fafc", at(x + 0.04, fy, z + 0.004)));
      out.litGeo.push(tinted(new THREE.CircleGeometry(h * 0.12, 10), "#facc15", at(x + 0.04 + h * 0.3, fy, z + 0.008)));
      break;
    }
    case "pumpkin": {
      // a jack-o'-lantern on the ground by the gate, glowing at night
      const px = x + (i % 2 ? 0.55 : -0.55), pz = z + 0.25, r = 0.16;
      out.glowGeo.push(tinted(new THREE.SphereGeometry(r, 10, 7).scale(1, 0.78, 1), "#f97316", at(px, ground + r * 0.78, pz)));
      out.lit.push({ size: [0.03, 0.08, 0.03], pos: [px, ground + r * 1.6, pz], color: "#3f6212" });
      out.halos.push({ x: px, y: ground + r, z: pz + 0.05, R: 0.18 });
      break;
    }
    case "candle": {
      // three candles by the gate (All Saints' / Holy Week)
      for (let k = 0; k < 3; k++) {
        const cx = x - 0.12 + k * 0.12, cz = z + 0.3, hgt = 0.1 + (k % 2) * 0.05;
        out.lit.push({ shape: "cyl", size: [0.025, hgt, 6], pos: [cx, ground + hgt / 2, cz], color: "#f5f5f4" });
        out.glow.push({ size: [0.018, 0.04, 0.018], pos: [cx, ground + hgt + 0.025, cz], color: "#fbbf24" });
      }
      out.halos.push({ x, y: ground + 0.2, z: z + 0.32, R: 0.12 });
      break;
    }
  }
}

/* ------------------------------------------------------------------ the decor */

export function Festive({ decor }: { decor: Decor }) {
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowTex = useMemo(() => getGlowTexture(), []);

  const built = useMemo(() => {
    const h = houseSpots(), s = shopSpots();
    const out: Built = { lit: [], litGeo: [], glow: [], glowGeo: [], halos: [] };
    if (decor.ornament) {
      const onGround = decor.ornament === "pumpkin" || decor.ornament === "candle";
      // ground ornaments go at the gates (one per gate), hanging ones where the parols go
      const spots = onGround ? h.parols.map((p) => ({ ...p, z: p.z + 0.15 })).concat(s.parols.filter((_, i) => i % 2 === 0)) : [...h.parols, ...s.parols];
      spots.forEach((p, i) => ornament(decor.ornament!, p, i, out, 0.02));
      if (!onGround) ornament(decor.ornament, OFFICE_FRONT, 1, out, 0.02);
      else ornament(decor.ornament, { x: 15.3 + 0.6, y: 0, z: ROOM.D - 0.1, R: 0.3 }, 0, out, 0.02); // by the office door
    }
    let bunting: THREE.BufferGeometry | null = null;
    let poles: THREE.BufferGeometry | null = null;
    if (decor.bunting) {
      const lines = [...s.strands.map((st) => strandLine(st, 0.12)), ...h.strands.map((st) => strandLine(st, 0.55))];
      if (decor.acrossStreet) {
        const across = acrossStreet();
        lines.push(...across.lines);
        poles = mergeParts(across.poles);
      }
      bunting = buntingGeometry(lines, decor.bunting);
    }
    const plane = new THREE.PlaneGeometry(1, 1);
    const halos = out.halos.length
      ? mergePlaced(out.halos.map((p) => ({ geometry: plane, matrix: placed([p.x, p.y, p.z + 0.03], [0, 0, 0], [p.R * 5, p.R * 5, 1]) })))
      : null;
    plane.dispose();
    return {
      lit: joinGeometries([mergeParts(out.lit), ...out.litGeo, poles]),
      glow: joinGeometries([mergeParts(out.glow), ...out.glowGeo]),
      halos,
      bunting,
    };
  }, [decor]);

  useFrame(() => {
    const k = streetLightLevel();
    if (glowMat.current) glowMat.current.color.setScalar(0.75 + 0.55 * k);
    if (haloMat.current) haloMat.current.opacity = k * 0.45;
  });

  return (
    <group>
      {built.lit && (
        <mesh geometry={built.lit}>
          <meshStandardMaterial vertexColors roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
      {built.glow && (
        <mesh geometry={built.glow}>
          <meshBasicMaterial ref={glowMat} vertexColors side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
      {built.halos && (
        <mesh geometry={built.halos}>
          <meshBasicMaterial ref={haloMat} map={glowTex} color="#ffcf8a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {built.bunting && (
        <mesh geometry={built.bunting}>
          <meshStandardMaterial vertexColors roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
