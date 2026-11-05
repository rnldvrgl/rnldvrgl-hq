"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneNow } from "@/lib/store";
import { ROOM } from "./palette";
import { FAR_WALK, SIDEWALK } from "./world";
import { EST } from "./Neighbourhood";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { joinGeometries, mergeParts, mergePlaced, placed, type Part } from "./batch";
import { jackOLantern } from "./Festive";
import { at, houseSpots, shopSpots, tinted } from "./Holidays";
import { mainLamps, person, walkX } from "./holiday-kit";

/**
 * Halloween and Undas (Oct 31 – Nov 2), on top of the jack-o'-lanterns at every gate (Festive.tsx):
 *   Halloween: more jack-o'-lanterns stacked on the shop steps, orange and purple string lights along the
 *   shops and the gates, cobwebs in the shop corners and on the gate posts, sheet ghosts floating and bobbing
 *   over the yards and the street, bats flitting round the main road's lamps after dark, and a band of kids
 *   in costume (a ghost, a witch, a pumpkin, a little vampire) trick-or-treating shop to shop with a tita.
 *   Undas: candles and pots of yellow and white chrysanthemums at the gates for the souls, a flower and candle
 *   stall on the far sidewalk, and a family walking to the cemetery with flowers and candles.
 * Draw calls: solid parts 1, glowing parts 1, halos 1, two bulb colours 2, cobwebs 1, ghosts 1, bats 1, and
 * one per walker (8).
 */

const ORANGE = "#ff8a1f", PURPLE = "#a855f7";

/* ------------------------------------------------------------------ cobwebs */

/** A web in a corner: threads fanning out from (x, y, z) over a quarter turn, `sx` / `sy` the directions it spreads (±1), `R` its size. */
function web(pos: number[], x: number, y: number, z: number, sx: number, sy: number, R: number) {
  const spokes = 5, rings = 4;
  const pt = (k: number, r: number) => { const a = (k / (spokes - 1)) * (Math.PI / 2); return [x + sx * Math.cos(a) * r, y + sy * Math.sin(a) * r, z]; };
  for (let k = 0; k < spokes; k++) pos.push(x, y, z, ...pt(k, R));
  for (let ring = 1; ring <= rings; ring++) {
    const r = (ring / rings) * R * 0.95;
    // each ring sags a little between the spokes
    for (let k = 0; k < spokes - 1; k++) {
      const a = pt(k, r), b = pt(k + 1, r), mid = pt(k + 0.5, r * 0.86);
      pos.push(...a, ...mid, ...mid, ...b);
    }
  }
}

/* ------------------------------------------------------------------ the walkers */

type Walker = { parts: Part[]; dx: number; dz: number; seed: number };

/** The trick-or-treaters, in their own frame (walking +x): kids in costume with their buckets, and a tita. */
function trickOrTreaters(): Walker[] {
  const bucket = (dx: number, s = 0.62): Part[] => [
    { shape: "cyl", size: [0.09, 0.1, 10], pos: [dx, 0.62 * s + 0.12, 0.22 * s + 0.08], color: "#f97316" },
    { size: [0.01, 0.12, 0.16], pos: [dx, 0.62 * s + 0.24, 0.22 * s + 0.08], color: "#1f2937" },
  ];
  const k = 0.62;
  // a ghost: a white sheet over a child, two black eyes
  const ghost: Part[] = [
    { shape: "cone", size: [0.26, 1.05, 12], pos: [0, 0.52, 0], color: "#f8fafc" },
    { shape: "cyl", size: [0.15, 0.3, 12], pos: [0, 0.82, 0], color: "#f8fafc" },
    { size: [0.02, 0.05, 0.035], pos: [0.13, 0.86, 0.05], color: "#111827" },
    { size: [0.02, 0.05, 0.035], pos: [0.13, 0.86, -0.05], color: "#111827" },
    ...bucket(0.05, 0.9),
  ];
  // a witch: black dress, a purple sash, a broom and a tall pointed hat
  const witch: Part[] = [
    ...person({ top: "#18181b", bottom: "#18181b", dress: "short", skin: 1, scale: k }),
    { size: [0.13, 0.04, 0.24], pos: [0, 0.6, 0], color: "#7c3aed" },
    { shape: "cyl", size: [0.2, 0.02, 14], pos: [0, 1.04, 0], color: "#111827" },
    { shape: "cone", size: [0.1, 0.3, 10], pos: [-0.02, 1.2, 0], rot: [0, 0, 0.15], color: "#111827" },
    { size: [0.02, 0.9, 0.02], pos: [-0.05, 0.5, -0.17], rot: [0, 0, 0.5], color: "#92400e" },
    { shape: "cone", size: [0.08, 0.22, 8], pos: [-0.27, 0.12, -0.17], rot: [0, 0, 0.5], color: "#d6b26b" },
    ...bucket(0.04),
  ];
  // a pumpkin: a round orange suit and a green stem cap
  const pumpkin: Part[] = [
    ...person({ top: "#ea580c", bottom: "#14532d", skin: 3, scale: k }),
    { shape: "cyl", size: [0.24, 0.36, 12], pos: [0, 0.66, 0], color: "#f97316" },
    { shape: "cyl", size: [0.2, 0.06, 12], pos: [0, 0.86, 0], color: "#ea580c" },
    { shape: "cyl", size: [0.05, 0.08, 6], pos: [0, 1.06, 0], color: "#3f6212" },
    ...bucket(0.04),
  ];
  // a little vampire: black suit, white face, a cape with a red lining and a high collar
  const vampire: Part[] = [
    ...person({ top: "#111827", bottom: "#111827", skin: 3, scale: k, hair: "#0b0b0b" }),
    { size: [0.04, 0.62, 0.36], pos: [-0.09, 0.62, 0], color: "#111827" },
    { size: [0.02, 0.58, 0.32], pos: [-0.065, 0.62, 0], color: "#b91c1c" },
    { size: [0.04, 0.16, 0.36], pos: [-0.08, 0.9, 0], rot: [0, 0, -0.25], color: "#111827" },
    ...bucket(0.04),
  ];
  // the tita minding them, with her phone out
  const tita: Part[] = [
    ...person({ top: "#7c3aed", bottom: "#374151", skin: 1 }),
    { size: [0.06, 0.12, 0.02], pos: [0.18, 1.0, 0.18], color: "#111827" },
  ];
  return [
    { parts: ghost, dx: 0, dz: 0.15, seed: 0 },
    { parts: witch, dx: 0.55, dz: -0.2, seed: 1 },
    { parts: pumpkin, dx: -0.45, dz: -0.25, seed: 2 },
    { parts: vampire, dx: -0.6, dz: 0.3, seed: 3 },
    { parts: tita, dx: -1.4, dz: 0, seed: 4 },
  ];
}

/** A family going to the cemetery (walking −x in their frame turned round): flowers and candles in hand. */
function flowerBearers(): Walker[] {
  const bouquet = (y: number, c: string): Part[] => [
    { shape: "cone", size: [0.09, 0.2, 8], pos: [0.18, y, 0.2], rot: [Math.PI, 0, 0], color: "#16a34a" },
    { size: [0.13, 0.1, 0.13], pos: [0.18, y + 0.13, 0.2], color: c },
    { size: [0.07, 0.07, 0.07], pos: [0.22, y + 0.2, 0.17], color: "#f8fafc" },
  ];
  return [
    { parts: [...person({ top: "#f8fafc", bottom: "#1f2937", skin: 2 }), ...bouquet(0.95, "#facc15")], dx: 0, dz: 0.15, seed: 10 },
    { parts: [...person({ top: "#f5f5f4", bottom: "#111827", dress: true, skin: 0, hair: "#3f3a33" }), ...bouquet(0.92, "#f8fafc")], dx: -0.7, dz: -0.2, seed: 11 },
    { parts: [...person({ top: "#e5e7eb", bottom: "#1f2937", skin: 3, scale: 0.7 }), { shape: "cyl", size: [0.025, 0.2, 6], pos: [0.13, 0.78, 0.15], color: "#f5f5f4" }], dx: -1.3, dz: 0.2, seed: 12 },
  ];
}

/* ------------------------------------------------------------------ ghosts and bats */

function ghostGeometry(): THREE.BufferGeometry {
  // a sheet: a round head flowing down into a wider, open hem
  const prof = [[0, 0.62], [0.12, 0.6], [0.19, 0.52], [0.21, 0.4], [0.22, 0.26], [0.27, 0.1], [0.31, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const sheet = new THREE.LatheGeometry(prof, 14);
  const parts = [tinted(sheet, "#f8fafc", new THREE.Matrix4())];
  // little arms held out
  for (const s of [-1, 1]) parts.push(tinted(new THREE.SphereGeometry(0.06, 6, 4).scale(1, 0.7, 1.6), "#f8fafc", new THREE.Matrix4().makeTranslation(0, 0.3, s * 0.24)));
  // eyes and a round "oooh" mouth, on its +x side (turned to the camera by its instance)
  for (const s of [-1, 1]) parts.push(tinted(new THREE.SphereGeometry(0.032, 6, 4).scale(0.5, 1.4, 1), "#111827", new THREE.Matrix4().makeTranslation(0.185, 0.47, s * 0.06)));
  parts.push(tinted(new THREE.SphereGeometry(0.03, 6, 4).scale(0.5, 1.3, 1), "#111827", new THREE.Matrix4().makeTranslation(0.2, 0.36, 0)));
  return joinGeometries(parts)!;
}

function batGeometry(): THREE.BufferGeometry {
  // one wing reaching out along +z from the body, scalloped trailing edge; the body is a dark lump at the root
  const w = new THREE.Shape();
  w.moveTo(0.03, 0); w.lineTo(0.06, 0.1); w.lineTo(0.02, 0.22); w.lineTo(-0.02, 0.16); w.lineTo(-0.05, 0.17); w.lineTo(-0.05, 0.1); w.lineTo(-0.08, 0.07); w.lineTo(-0.04, 0);
  w.closePath();
  const wing = new THREE.ShapeGeometry(w);
  wing.rotateX(Math.PI / 2); // shape y → world z
  const parts = [tinted(wing, "#18181b", new THREE.Matrix4()), tinted(new THREE.SphereGeometry(0.035, 6, 4).scale(1.6, 1, 1), "#111827", new THREE.Matrix4())];
  return joinGeometries(parts)!;
}

/* ------------------------------------------------------------------ the layer */

export function Halloween({ frozen, lowPower }: { frozen: boolean; lowPower: boolean }) {
  const glowTex = useMemo(() => getGlowTexture(), []);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const bulbMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const ghostMat = useRef<THREE.MeshBasicMaterial>(null);
  const ghosts = useRef<THREE.InstancedMesh>(null);
  const bats = useRef<THREE.InstancedMesh>(null);
  const kids = useRef<THREE.Group>(null);
  const family = useRef<THREE.Group>(null);
  const kidRefs = useRef<(THREE.Group | null)[]>([]);
  const famRefs = useRef<(THREE.Group | null)[]>([]);

  const built = useMemo(() => {
    const h = houseSpots(), s = shopSpots();
    const solid: Part[] = [], glow: THREE.BufferGeometry[] = [], halos: { x: number; y: number; z: number; R: number }[] = [];
    const flame = (x: number, y: number, z: number) => { glow.push(tinted(new THREE.BoxGeometry(0.02, 0.045, 0.02), "#fbbf24", at(x, y, z))); };
    const candle = (x: number, z: number, hgt: number) => { solid.push({ shape: "cyl", size: [0.026, hgt, 6], pos: [x, hgt / 2, z], color: "#f5f5f4" }); flame(x, hgt + 0.03, z); };
    const mums = (x: number, z: number, c: string) => {
      solid.push({ shape: "cyl", size: [0.11, 0.16, 8], pos: [x, 0.08, z], color: "#9a3412" });
      for (let k = 0; k < 6; k++) { const a = k * 1.05; solid.push({ size: [0.08, 0.07, 0.08], pos: [x + Math.cos(a) * 0.08, 0.22 + (k % 2) * 0.04, z + Math.sin(a) * 0.08], color: k % 3 ? c : "#f8fafc" }); }
      solid.push({ size: [0.1, 0.06, 0.1], pos: [x, 0.27, z], color: "#16a34a" });
    };

    // Undas at the gates: a row of candles and a pot of chrysanthemums on the other side from the jack-o'-lantern
    h.parols.forEach((p, i) => {
      const side = i % 2 ? -1 : 1, gz = p.z + 0.15 + 0.3;
      for (let k = 0; k < 3; k++) candle(p.x + side * (0.4 + k * 0.09), gz + (k % 2) * 0.06, 0.1 + ((i + k) % 3) * 0.04);
      halos.push({ x: p.x + side * 0.49, y: 0.2, z: gz + 0.05, R: 0.12 });
      mums(p.x + side * 0.85, gz - 0.05, i % 3 ? "#facc15" : "#f59e0b");
    });
    // the shops: two jack-o'-lanterns stacked on the step by the door, a few candles
    s.parols.forEach((p, i) => {
      if (i % 2 === 0) return;
      const jx = p.x, jz = p.z + 0.32;
      const a = jackOLantern(jx, 0.02, jz, 0.19, i), b = jackOLantern(jx + 0.05, 0.02 + 0.28, jz - 0.02, 0.13, i + 1);
      glow.push(...a.glow, ...b.glow); solid.push(...a.lit, ...b.lit);
      halos.push({ x: jx, y: 0.3, z: jz + 0.08, R: 0.24 });
      for (let k = 0; k < 2; k++) candle(jx - 0.32 - k * 0.1, jz + 0.04, 0.12 + k * 0.04);
    });
    // the office: a row of carved pumpkins along its front
    for (let k = 0; k < 3; k++) {
      const j = jackOLantern(ROOM.W - 0.8 - k * 0.5, 0.02, ROOM.D + 0.3, 0.16 + (k % 2) * 0.04, k);
      glow.push(...j.glow); solid.push(...j.lit);
      halos.push({ x: ROOM.W - 0.8 - k * 0.5, y: 0.2, z: ROOM.D + 0.38, R: 0.2 });
    }

    // the flower and candle stall on the far sidewalk: a table under a tarp, buckets of mums, boxes of candles
    const fx = 23.2, fz = FAR_WALK.z0 + 0.75;
    for (const dx of [-0.9, 0.9]) for (const dz of [-0.45, 0.45]) solid.push({ size: [0.04, 2.0, 0.04], pos: [fx + dx, 1.0, fz + dz], color: "#6b7280" });
    solid.push({ size: [2.0, 0.04, 1.1], pos: [fx, 2.0, fz], rot: [0.08, 0, 0], color: "#2563eb" });
    solid.push({ size: [1.6, 0.06, 0.6], pos: [fx, 0.72, fz], color: "#8a6a4a" });
    for (let k = 0; k < 5; k++) {
      const bx = fx - 0.64 + k * 0.32;
      solid.push({ shape: "cyl", size: [0.11, 0.2, 8], pos: [bx, 0.85, fz - 0.1], color: "#64748b" });
      for (let f = 0; f < 4; f++) solid.push({ size: [0.07, 0.07, 0.07], pos: [bx + (f % 2 ? 0.04 : -0.04), 1.0 + (f >> 1) * 0.06, fz - 0.1 + (f % 2 ? -0.03 : 0.03)], color: ["#facc15", "#f8fafc", "#f97316", "#f43f5e", "#a855f7"][(k + f) % 5] });
    }
    for (let k = 0; k < 6; k++) { const cx = fx - 0.5 + k * 0.2; solid.push({ shape: "cyl", size: [0.025, 0.14, 6], pos: [cx, 0.82, fz + 0.18], color: k % 2 ? "#f5f5f4" : "#fca5a5" }); flame(cx, 0.92, fz + 0.18); }
    halos.push({ x: fx, y: 0.95, z: fz + 0.25, R: 0.35 });
    // a vendor sitting behind it
    solid.push(...person({ top: "#f59e0b", bottom: "#1f2937", skin: 4 }).map((p) => ({ ...p, pos: [p.pos[0] + fx + 0.1, p.pos[1] - 0.25, p.pos[2] + fz - 0.55] as const })));

    // cobwebs: the top corners of every shop front, and both posts of every other gate
    const webs: number[] = [];
    for (const e of EST) {
      web(webs, e.x0 + 0.04, 2.55, ROOM.D + 0.05, 1, -1, 0.55);
      web(webs, e.x1 - 0.04, 2.55, ROOM.D + 0.05, -1, -1, 0.45);
    }
    h.strands.forEach((st, i) => { if (i % 2 === 0) { web(webs, st.x0 + 0.3, 1.3, st.z + 0.04, 1, -1, 0.4); web(webs, st.x1 - 0.3, 1.3, st.z + 0.04, -1, -1, 0.35); } });
    const webGeo = new THREE.BufferGeometry();
    webGeo.setAttribute("position", new THREE.Float32BufferAttribute(webs, 3));
    webGeo.computeBoundingSphere();

    // orange and purple bulbs along the shops and the gates, just under where Christmas lights would go
    const bulbs: Part[][] = [[], []];
    let n = 0;
    for (const st of [...s.strands, ...h.strands]) {
      const len = st.x1 - st.x0, count = Math.max(2, Math.round(len / 0.26));
      for (let k = 0; k <= count; k++) {
        const t = k / count, sw = ((t * len) % 1.3) / 1.3;
        bulbs[n++ % 2].push({ size: [0.055, 0.075, 0.055], pos: [st.x0 + t * len, st.y - 0.14 - Math.sin(sw * Math.PI) * (st.sag + 0.04), st.z + 0.02], color: "#ffffff" });
      }
    }

    const plane = new THREE.PlaneGeometry(1, 1);
    const haloGeo = mergePlaced(halos.map((p) => ({ geometry: plane, matrix: placed([p.x, p.y, p.z], [0, Math.PI / 4, 0], [p.R * 5, p.R * 5, 1]) })));
    plane.dispose();
    return { solid: mergeParts(solid), glow: joinGeometries(glow), halos: haloGeo, webGeo, bulbGeos: bulbs.map((b) => mergeParts(b)) };
  }, []);

  const walkers = useMemo(() => ({
    kids: trickOrTreaters().map((w) => ({ ...w, geo: mergeParts(w.parts) })),
    family: flowerBearers().map((w) => ({ ...w, geo: mergeParts(w.parts) })),
  }), []);

  // ghosts: over the yards behind the gates, by the shops, over the street
  const ghostList = useMemo(() => {
    const h = houseSpots().parols, out: { x: number; y: number; z: number; seed: number }[] = [];
    h.forEach((p, i) => { if (i % 4 === 1) out.push({ x: p.x + 1.2, y: 1.9, z: p.z - 1.6, seed: i }); });
    EST.forEach((e, i) => { if (i % 3 === 0) out.push({ x: e.x1 + 0.4, y: 2.2, z: ROOM.D + 0.9, seed: 40 + i }); });
    out.push({ x: ROOM.W + 1.5, y: 2.4, z: ROOM.D + 1.0, seed: 60 }, { x: 34, y: 2.6, z: FAR_WALK.z1 + 3.5, seed: 61 }, { x: 8, y: 3.2, z: (SIDEWALK.z1 + FAR_WALK.z0) / 2, seed: 62 });
    return out.slice(0, lowPower ? 7 : 16);
  }, [lowPower]);
  const ghostGeo = useMemo(() => ghostGeometry(), []);

  // bats: a couple round each main-road lamp in town
  const batList = useMemo(() => {
    const out: { x: number; y: number; z: number; r: number; w: number; ph: number }[] = [];
    mainLamps().filter((l) => l.x > -32 && l.x < 64).forEach((l, i) => {
      for (let k = 0; k < (lowPower ? 1 : 2); k++) out.push({ x: l.headX, y: l.h + 0.25, z: l.headZ, r: 0.7 + ((i + k) % 3) * 0.25, w: (1.6 + ((i * 3 + k) % 4) * 0.35) * (k % 2 ? -1 : 1), ph: i * 1.7 + k * 3.1 });
    });
    return out;
  }, [lowPower]);
  const batGeo = useMemo(() => batGeometry(), []);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), m2: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3() }), []);

  useFrame(({ clock }) => {
    const t = frozen ? 0 : clock.elapsedTime;
    const k = streetLightLevel();
    const sec = sceneNow().getTime() / 1000;

    if (glowMat.current) glowMat.current.color.setScalar(0.7 + 0.6 * k);
    if (haloMat.current) haloMat.current.opacity = k * 0.55;
    bulbMats.current.forEach((m, i) => {
      if (!m) return;
      const tw = frozen ? 1 : 0.6 + 0.4 * Math.max(0, Math.sin(t * 1.4 + i * Math.PI));
      m.color.set(i ? PURPLE : ORANGE).multiplyScalar((0.45 + 0.8 * k) * tw);
    });
    // ghosts glow a pale green after dark
    if (ghostMat.current) ghostMat.current.color.setRGB(0.92 - 0.12 * k, 0.92 + 0.08 * k, 0.94 - 0.06 * k);

    const g = ghosts.current;
    if (g) {
      ghostList.forEach((p, i) => {
        const a = t * 0.35 + p.seed;
        tmp.v.set(p.x + Math.cos(a) * 0.5, p.y + Math.sin(t * 1.3 + p.seed) * 0.14, p.z + Math.sin(a) * 0.35);
        tmp.e.set(Math.sin(t * 0.9 + p.seed) * 0.08, -Math.PI / 4 + Math.sin(t * 0.5 + p.seed) * 0.4, Math.sin(t * 1.1 + p.seed) * 0.06);
        g.setMatrixAt(i, tmp.m.compose(tmp.v, tmp.q.setFromEuler(tmp.e), tmp.s.setScalar(1)));
      });
      g.instanceMatrix.needsUpdate = true;
    }

    // bats only come out once it's dark
    const b = bats.current;
    if (b) {
      if (k < 0.15) b.count = 0;
      else {
        batList.forEach((p, i) => {
          const a = t * p.w + p.ph;
          tmp.v.set(p.x + Math.cos(a) * p.r, p.y + Math.sin(a * 2.3) * 0.25, p.z + Math.sin(a) * p.r * 0.8);
          const sg = Math.sign(p.w), yaw = Math.atan2(-Math.cos(a) * sg * 0.8, -Math.sin(a) * sg); // along its circle
          const flap = Math.sin(t * 18 + p.ph * 5) * 0.75;
          for (const side of [1, -1]) {
            tmp.e.set(side * flap, yaw, 0, "YXZ");
            tmp.q.setFromEuler(tmp.e);
            b.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), tmp.m.compose(tmp.v, tmp.q, tmp.s.set(1, 1, side)));
          }
        });
        b.count = batList.length * 2;
        b.instanceMatrix.needsUpdate = true;
      }
    }

    // the trick-or-treaters go shop to shop down the near sidewalk; the family walks the far one the other way
    const kw = walkX(sec, { x0: -44, x1: 62, speed: 0.55, every: 6.5, pause: 6 });
    if (kids.current) kids.current.position.set(kw.x, 0, SIDEWALK.z0 + 0.5);
    walkers.kids.forEach((w, i) => {
      const r = kidRefs.current[i];
      if (!r) return;
      const step = t * 6 + w.seed;
      r.position.set(w.dx, kw.stopped || frozen ? 0 : Math.abs(Math.sin(step)) * 0.03, w.dz);
      r.rotation.y = kw.stopped ? 1.2 + Math.sin(t * 0.7 + w.seed) * 0.2 : 0; // stopped: turned to the shop door
    });
    const fw = walkX(sec, { x0: -42, x1: 66, speed: 0.75, dir: -1, offset: 40 });
    if (family.current) family.current.position.set(fw.x, 0, FAR_WALK.z0 + 0.75);
    walkers.family.forEach((w, i) => {
      const r = famRefs.current[i];
      if (r) r.position.set(w.dx, frozen ? 0 : Math.abs(Math.sin(t * 5 + w.seed)) * 0.025, w.dz);
    });
  });

  return (
    <group>
      {built.solid && <mesh geometry={built.solid} castShadow><meshStandardMaterial vertexColors roughness={0.8} /></mesh>}
      {built.glow && <mesh geometry={built.glow}><meshBasicMaterial ref={glowMat} vertexColors side={THREE.DoubleSide} toneMapped={false} /></mesh>}
      {built.halos && (
        <mesh geometry={built.halos}>
          <meshBasicMaterial ref={haloMat} map={glowTex} color="#ffb060" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
      {built.bulbGeos.map((geo, i) => geo && (
        <mesh key={i} geometry={geo}><meshBasicMaterial ref={(m) => { bulbMats.current[i] = m; }} color={i ? PURPLE : ORANGE} toneMapped={false} /></mesh>
      ))}
      <lineSegments geometry={built.webGeo}><lineBasicMaterial color="#e7e5e4" transparent opacity={0.75} /></lineSegments>
      <instancedMesh ref={ghosts} args={[ghostGeo, undefined, ghostList.length]} frustumCulled={false}>
        <meshBasicMaterial ref={ghostMat} vertexColors transparent opacity={0.88} side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={bats} args={[batGeo, undefined, batList.length * 2]} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
      </instancedMesh>
      <group ref={kids}>
        {walkers.kids.map((w, i) => w.geo && (
          <group key={i} ref={(r) => { kidRefs.current[i] = r; }}><mesh geometry={w.geo} castShadow><meshStandardMaterial vertexColors roughness={0.85} /></mesh></group>
        ))}
      </group>
      <group ref={family} rotation={[0, Math.PI, 0]}>
        {walkers.family.map((w, i) => w.geo && (
          <group key={i} ref={(r) => { famRefs.current[i] = r; }}><mesh geometry={w.geo} castShadow><meshStandardMaterial vertexColors roughness={0.85} /></mesh></group>
        ))}
      </group>
    </group>
  );
}
