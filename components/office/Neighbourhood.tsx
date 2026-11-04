"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneNow } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { HQ } from "@/hq.config";
import { ROOM } from "./palette";
import { light, getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { canvasTexture, joinGeometries, mergeParts, mergePlaced, partsAt, placed, type Part } from "./batch";
import { vehicle, type Kind as VehicleKind } from "./Traffic";
import { BACK_STREETS, FAR_WALK, SIDE_STREETS, SIDEWALK, YARD_X1 } from "./world";

/**
 * The town around the office, Filipino style:
 *
 *   along the street   shophouses (store below, home above, roll-up shutters, GI awnings, a water tank on the
 *                      roof), a sari-sari store, a panaderia and a carinderia, and the chains: Jollibee,
 *                      McDonald's, Mercury Drug and 7-Eleven (open 24 hours, lit all night)
 *   behind             two residential streets of houses facing them: painted hollow-block walls, GI roofs,
 *                      window grills, a gated concrete fence, carports with a parked tricycle, water tanks on
 *                      stands, clotheslines, potted plants, a basketball hoop on the street
 *   across the street  a Shell and a Petron station, the tricycle terminal (TODA) and its shed, the barangay
 *                      court with floodlights, a parking lot, a park and the barangay hall
 *
 * Brand names come from HQ.town.realBrands (generic names when it's off).
 *
 * Built for speed: every wall, roof, awning and fence is merged into ONE vertex-coloured mesh; windows are
 * three meshes (shops that close at 10 PM, places open 24 hours, homes lit in the evening); all signs share
 * one texture atlas; the pools of light on the ground at night are one additive mesh. About 7 draw calls
 * for the whole town, and nothing moves, so per frame only five material values change.
 */

const FRONT = ROOM.D; // shop fronts line up with the office front
const REAL = HQ.town.realBrands;
const brand = (real: string, generic: string) => (REAL ? real : generic);

/* ------------------------------------------------------------------ signs */

type SignStyle = "plain" | "jollibee" | "mcdo" | "seven" | "mercury" | "shell" | "petron" | "hall";
type SignSpec = { text: string; sub: string; bg: string; ink: string; style?: SignStyle };

export const SIGN = {
  sari: { text: "SARI-SARI STORE", sub: "Aling Nena's · load · yelo", bg: "#1d4ed8", ink: "#ffffff" },
  jollibee: { text: brand("Jollibee", "Bida Bee"), sub: brand("Chickenjoy · Yumburger · 24 hrs", "fried chicken · burgers · 24 hrs"), bg: "#e31837", ink: "#ffc522", style: "jollibee" },
  mercury: { text: brand("Mercury Drug", "Botika ng Bayan"), sub: "pharmacy · open 24 hours", bg: "#ffffff", ink: "#e4002b", style: "mercury" },
  labada: { text: "LABADA", sub: "wash · dry · fold", bg: "#0c4a6e", ink: "#e0f2fe" },
  seven: { text: brand("7-ELEVEN", "KWIK MART"), sub: "open 24 hours", bg: "#ffffff", ink: "#008163", style: "seven" },
  kapihan: { text: "KAPIHAN", sub: "kapeng barako", bg: "#3b2a20", ink: "#f8e7c8" },
  panaderia: { text: "PANADERIA", sub: "pandesal · ensaymada · monay", bg: "#78350f", ink: "#fde68a" },
  carinderia: { text: "CARINDERIA", sub: "lutong bahay · sinigang · adobo", bg: "#9a3412", ink: "#ffedd5" },
  mcdo: { text: brand("McDonald's", "Burger Ko"), sub: "open 24 hours · drive-thru", bg: "#da291c", ink: "#ffffff", style: "mcdo" },
  hardware: { text: "HARDWARE", sub: "construction supply · paint", bg: "#27272a", ink: "#fca5a5" },
  shell: { text: brand("Shell", "SeaFuel"), sub: "", bg: "#fbce07", ink: "#dd1d21", style: "shell" },
  petron: { text: brand("PETRON", "PETRO"), sub: "", bg: "#ffffff", ink: "#0033a0", style: "petron" },
  toda: { text: "TODA", sub: "tricycle terminal", bg: "#15803d", ink: "#ffffff" },
  hall: { text: "BARANGAY HALL", sub: HQ.town.barangay, bg: "#1e3a8a", ink: "#ffffff", style: "hall" },
  sariHome: { text: "SARI-SARI", sub: "Coke · yelo · load", bg: "#b91c1c", ink: "#ffffff" },
} as const satisfies Record<string, SignSpec>;
type SignId = keyof typeof SIGN;
const SIGN_IDS = Object.keys(SIGN) as SignId[];
const cellOf = (id: SignId) => SIGN_IDS.indexOf(id);

const CELL_W = 512, CELL_H = 128, COLS = 2;

function drawSign(g: CanvasRenderingContext2D, s: SignSpec, x: number, y: number): void {
  const W = CELL_W, H = CELL_H, cx = x + W / 2;
  g.save();
  g.beginPath(); g.rect(x, y, W, H); g.clip();
  g.fillStyle = s.bg; g.fillRect(x, y, W, H);
  g.textAlign = "center"; g.textBaseline = "middle";
  const sans = "ui-sans-serif, system-ui, 'Segoe UI', Arial, sans-serif";
  switch (s.style) {
    case "jollibee": {
      // a round red face with a yellow ring on the left, the name in fat rounded letters
      g.fillStyle = "#ffc522"; g.beginPath(); g.arc(x + 62, y + 64, 46, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#e31837"; g.beginPath(); g.arc(x + 62, y + 64, 38, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 50, y + 58, 7, 0, Math.PI * 2); g.arc(x + 74, y + 58, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#ffffff"; g.lineWidth = 5; g.beginPath(); g.arc(x + 62, y + 70, 16, 0.2, Math.PI - 0.2); g.stroke();
      g.font = `italic 900 70px 'Arial Rounded MT Bold', ${sans}`;
      g.lineWidth = 10; g.strokeStyle = "#ffffff"; g.lineJoin = "round";
      g.strokeText(s.text, cx + 50, y + 54, W - 150);
      g.fillStyle = s.ink; g.fillText(s.text, cx + 50, y + 54, W - 150);
      g.fillStyle = "#ffffff"; g.font = `700 21px ${sans}`; g.fillText(s.sub, cx + 50, y + 106, W - 150);
      break;
    }
    case "mcdo": {
      // golden arches on red
      g.strokeStyle = "#ffc72c"; g.lineWidth = 13; g.lineCap = "round";
      g.beginPath();
      g.moveTo(x + 24, y + 108);
      g.bezierCurveTo(x + 28, y + 6, x + 62, y + 6, x + 66, y + 70);
      g.bezierCurveTo(x + 70, y + 6, x + 104, y + 6, x + 108, y + 108);
      g.stroke();
      g.fillStyle = s.ink; g.font = `800 62px ${sans}`;
      g.fillText(s.text, cx + 55, y + 54, W - 160);
      g.fillStyle = "#ffc72c"; g.font = `700 21px ${sans}`; g.fillText(s.sub, cx + 55, y + 104, W - 160);
      break;
    }
    case "seven": {
      for (const [c, k] of [["#f47920", 0], ["#008163", 1], ["#ee1c25", 2]] as const) { g.fillStyle = c; g.fillRect(x, y + 96 + k * 11, W, 9); }
      g.fillStyle = "#f47920"; g.font = `900 80px ${sans}`; g.fillText(REAL ? "7" : "K", x + 70, y + 50);
      g.fillStyle = s.ink; g.font = `900 52px ${sans}`; g.fillText(REAL ? "ELEVEN" : "WIK MART", cx + 40, y + 52, W - 170);
      break;
    }
    case "mercury": {
      g.fillStyle = "#1d4ed8"; g.fillRect(x, y + 92, W, 36);
      g.fillStyle = s.ink; g.font = `italic 900 60px ${sans}`; g.fillText(s.text, cx, y + 48, W - 40);
      g.fillStyle = "#ffffff"; g.font = `700 20px ${sans}`; g.fillText(s.sub.toUpperCase(), cx, y + 110, W - 40);
      break;
    }
    case "shell": {
      // a red scallop shell on yellow, the name in red
      g.fillStyle = "#dd1d21";
      g.beginPath(); g.moveTo(x + 64, y + 108); g.arc(x + 64, y + 72, 46, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
      g.strokeStyle = "#fbce07"; g.lineWidth = 4;
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + 64, y + 106); g.lineTo(x + 64 + k * 18, y + 34 + Math.abs(k) * 6); g.stroke(); }
      g.fillStyle = s.ink; g.font = `900 78px ${sans}`; g.fillText(s.text, cx + 50, y + 64, W - 160);
      break;
    }
    case "petron": {
      g.fillStyle = "#e4002b"; g.fillRect(x, y + 100, W, 14);
      g.fillStyle = "#0033a0"; g.fillRect(x, y + 114, W, 14);
      g.fillStyle = s.ink; g.font = `italic 900 80px ${sans}`; g.fillText(s.text, cx, y + 54, W - 40);
      break;
    }
    case "hall": {
      g.fillStyle = "#fcd116"; g.fillRect(x, y, W, 8); g.fillStyle = "#ce1126"; g.fillRect(x, y + H - 8, W, 8);
      g.fillStyle = s.ink; g.font = `800 54px ${sans}`; g.fillText(s.text, cx, y + 52, W - 40);
      g.fillStyle = "#fcd116"; g.font = `700 24px ${sans}`; g.fillText(s.sub, cx, y + 100, W - 40);
      break;
    }
    default: {
      g.fillStyle = s.ink; g.font = `800 60px ${sans}`;
      g.fillText(s.text, cx, y + (s.sub ? 52 : 64), W - 30);
      if (s.sub) {
        g.globalAlpha = 0.9; g.font = `600 24px ${sans}`;
        g.fillText(s.sub, cx, y + 104, W - 40);
        g.globalAlpha = 1;
      }
    }
  }
  g.restore();
}

function signAtlas(): THREE.CanvasTexture {
  const rows = Math.ceil(SIGN_IDS.length / COLS);
  return canvasTexture(CELL_W * COLS, CELL_H * rows, (g) => {
    SIGN_IDS.forEach((id, i) => drawSign(g, SIGN[id], (i % COLS) * CELL_W, Math.floor(i / COLS) * CELL_H));
  });
}

/** A sign plane whose uv points at one cell of the atlas (a hair inside it, so neighbours never bleed in). */
function signPlane(w: number, h: number, cell: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const rows = Math.ceil(SIGN_IDS.length / COLS);
  const pad = 0.002;
  const u0 = (cell % COLS) / COLS + pad, u1 = u0 + 1 / COLS - pad * 2;
  const v1 = 1 - Math.floor(cell / COLS) / rows - pad, v0 = v1 - 1 / rows + pad * 2;
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) > 0.5 ? u1 : u0, uv.getY(i) > 0.5 ? v1 : v0);
  return g;
}

/* ------------------------------------------------------------------ collectors */

/** A lit window or light panel: a plane facing +z (default) or +x. */
type Win = { x: number; y: number; z: number; w: number; h: number; face?: "x" };
/** A sign; `back` turns it to face -z (the road side of buildings across the street). */
type SignAt = { id: SignId; x: number; y: number; z: number; w: number; h: number; back?: boolean; sideX?: boolean };
/** A pool of light on the ground at night, [x, z, w, d]. */
type Pool = readonly [number, number, number, number];

type Town = {
  solid: Part[];
  extra: (THREE.BufferGeometry | null)[];
  shopWins: Win[];
  nightWins: Win[];
  homeWins: Win[];
  signs: SignAt[];
  pools: Pool[];
};

const newTown = (): Town => ({ solid: [], extra: [], shopWins: [], nightWins: [], homeWins: [], signs: [], pools: [] });

/** Window grills: a few bars each way, the way almost every Filipino window has them, and a sill. */
function grill(t: Town, x: number, y: number, z: number, w: number, h: number, color = "#2b3036"): void {
  const n = Math.max(2, Math.round(w / 0.45));
  for (let i = 1; i < n; i++) t.solid.push({ size: [0.035, h, 0.035], pos: [x - w / 2 + (i * w) / n, y, z], color });
  t.solid.push({ size: [w, 0.035, 0.035], pos: [x, y, z], color });
  t.solid.push({ size: [w + 0.08, 0.06, 0.08], pos: [x, y - h / 2 - 0.03, z - 0.02], color: "#d6d3cc" });
}

/** A blue plastic water tank on the roof, or on a steel stand in the yard. */
function waterTank(t: Town, x: number, y: number, z: number, stand = false): void {
  if (stand) {
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) t.solid.push({ size: [0.06, 2.4, 0.06], pos: [x + dx, y + 1.1, z + dz], color: "#4b5563" });
    t.solid.push({ size: [0.9, 0.06, 0.9], pos: [x, y + 2.3, z], color: "#4b5563" });
    y += 2.33;
  }
  t.solid.push({ shape: "cyl", size: [0.42, 0.95, 10], pos: [x, y + 0.48, z], color: "#1d4ed8" });
  t.solid.push({ shape: "cyl", size: [0.2, 0.1, 8], pos: [x, y + 1.0, z], color: "#1e40af" });
}

/** A parked vehicle (no driver), merged into the town mesh. rotY π/2 faces -z (toward the main road). */
function parked(t: Town, kind: VehicleKind, color: string, pos: [number, number, number], rotY: number, accent = "#f8fafc"): void {
  t.extra.push(partsAt(vehicle(kind, color, accent, false).body, pos, rotY));
}

/* ------------------------------------------------------------------ establishments along the street */

type EstKind = "row" | "sari" | "food" | "mart";
type Est = {
  x0: number; x1: number; depth: number; h: number; floors: 1 | 2; kind: EstKind;
  wall: string; trim: string; awning: string; upper?: string; sign: SignId; allNight?: boolean;
};

export const EST: readonly Est[] = [
  // left of the side street, going away from the office
  { x0: -12.0, x1: -7.2, depth: 5.5, h: 3.2, floors: 2, kind: "sari", wall: "#f1d9a8", trim: "#7c4a2d", awning: "#2563eb", upper: "#e9e2cf", sign: "sari" },
  { x0: -22.8, x1: -12.8, depth: 8, h: 3.9, floors: 1, kind: "food", wall: "#f8fafc", trim: "#e31837", awning: "#ffc522", sign: "jollibee", allNight: true },
  { x0: -29.4, x1: -23.6, depth: 6, h: 3.4, floors: 1, kind: "mart", wall: "#f8fafc", trim: "#1d4ed8", awning: "#e4002b", sign: "mercury", allNight: true },
  { x0: -35.0, x1: -30.2, depth: 5.5, h: 3.2, floors: 2, kind: "row", wall: "#d7e6f3", trim: "#3f6b8f", awning: "#0ea5e9", upper: "#cfe0ef", sign: "labada" },
  { x0: -41.2, x1: -35.8, depth: 6, h: 3.3, floors: 1, kind: "mart", wall: "#f8fafc", trim: "#008163", awning: "#f47920", sign: "seven", allNight: true },
  { x0: -46.8, x1: -42.0, depth: 5.5, h: 3.2, floors: 2, kind: "row", wall: "#efe4d2", trim: "#6b4a33", awning: "#c2410c", upper: "#e6d9c3", sign: "kapihan" },
  // right of the office yard
  { x0: YARD_X1 + 0.8, x1: YARD_X1 + 6.4, depth: 6, h: 3.2, floors: 2, kind: "row", wall: "#f6dfa8", trim: "#92400e", awning: "#d97706", upper: "#f1e7cf", sign: "panaderia" },
  { x0: YARD_X1 + 7.0, x1: YARD_X1 + 12.6, depth: 6, h: 3.3, floors: 1, kind: "row", wall: "#f4c9a8", trim: "#9a3412", awning: "#ea580c", sign: "carinderia" },
  { x0: YARD_X1 + 13.4, x1: SIDE_STREETS[1].x0 - 0.8, depth: 8.5, h: 3.9, floors: 1, kind: "food", wall: "#e7e5e4", trim: "#da291c", awning: "#ffc72c", sign: "mcdo", allNight: true },
  { x0: SIDE_STREETS[1].x1 + 0.8, x1: SIDE_STREETS[1].x1 + 7.2, depth: 6.5, h: 3.2, floors: 2, kind: "row", wall: "#d4d4d8", trim: "#3f3f46", awning: "#dc2626", upper: "#e4e4e7", sign: "hardware" },
];

function establishment(t: Town, e: Est): void {
  const w = e.x1 - e.x0, cx = (e.x0 + e.x1) / 2, back = FRONT - e.depth, cz = FRONT - e.depth / 2;
  const S = t.solid;
  const wins = e.allNight ? t.nightWins : t.shopWins;
  const fz = FRONT + 0.04; // just in front of the facade
  // ground floor (the whole building for one-storey places)
  S.push({ size: [w, e.h, e.depth], pos: [cx, e.h / 2 - 0.1, cz], color: e.wall });
  S.push({ size: [w + 0.04, 0.3, 0.06], pos: [cx, 0.05, FRONT + 0.02], color: e.trim });
  // the light it throws on the sidewalk at night
  t.pools.push([cx, SIDEWALK.z0 + 0.6, Math.min(w, 6), 2.6]);
  let top = e.h - 0.1;

  if (e.kind === "food") {
    // fast food: a glass front, a coloured top band carrying the sign, a canopy over the door, roof units
    const bandY = 2.75;
    wins.push({ x: cx, y: 1.45, z: fz, w: w - 0.8, h: 2.2 });
    S.push({ size: [1.5, 2.25, 0.07], pos: [e.x0 + 1.6, 1.0, FRONT + 0.06], color: "#d1d5db" });
    S.push({ size: [1.3, 2.1, 0.08], pos: [e.x0 + 1.6, 1.0, FRONT + 0.07], color: "#2b3640" });
    for (let i = 1; i < 5; i++) S.push({ size: [0.06, 2.3, 0.06], pos: [e.x0 + 0.4 + (i * (w - 0.8)) / 5, 1.45, FRONT + 0.07], color: "#4b5563" });
    S.push({ size: [w + 0.06, e.h - bandY + 0.2, 0.12], pos: [cx, (bandY + e.h) / 2, FRONT + 0.05], color: e.trim });
    S.push({ size: [w + 0.08, 0.14, 0.14], pos: [cx, bandY - 0.04, FRONT + 0.06], color: e.awning });
    S.push({ size: [2.6, 0.12, 1.6], pos: [e.x0 + 1.6, 2.5, FRONT + 0.8], color: e.awning });
    t.signs.push({ id: e.sign, x: cx, y: (bandY + e.h) / 2 + 0.02, z: FRONT + 0.12, w: Math.min(w - 1, 5.4), h: 0.95 });
    // the side wall (+x, seen from the camera): a big window and the brand colour along the top
    wins.push({ x: e.x1 + 0.04, y: 1.5, z: cz + 0.6, w: e.depth - 2.6, h: 1.6, face: "x" });
    S.push({ size: [0.08, 0.5, e.depth], pos: [e.x1 + 0.02, e.h - 0.35, cz], color: e.trim });
    // roof: parapet and aircon units
    S.push({ size: [w + 0.12, 0.2, e.depth + 0.12], pos: [cx, top, cz], color: e.trim });
    S.push({ size: [w - 0.4, 0.04, e.depth - 0.4], pos: [cx, top + 0.11, cz], color: "#9ca3af" });
    for (const dx of [-1.6, 1.4]) S.push({ size: [1.1, 0.7, 0.8], pos: [cx + dx, top + 0.45, back + 1.4], color: "#cbd5e1" });
    if (e.sign === "jollibee") {
      // the round, smiling red-and-yellow face on the roof
      const jx = e.x1 - 1.6, jz = FRONT - 1.2, jy = top + 1.9;
      S.push({ shape: "cyl", size: [1.15, 0.16, 20], pos: [jx, jy, jz], rot: [Math.PI / 2, 0, 0], color: "#ffc522" });
      S.push({ shape: "cyl", size: [0.98, 0.2, 20], pos: [jx, jy, jz + 0.02], rot: [Math.PI / 2, 0, 0], color: "#e31837" });
      for (const dx of [-0.32, 0.32]) S.push({ shape: "cyl", size: [0.15, 0.22, 10], pos: [jx + dx, jy + 0.15, jz + 0.14], rot: [Math.PI / 2, 0, 0], color: "#ffffff" });
      S.push({ size: [0.6, 0.1, 0.1], pos: [jx, jy - 0.3, jz + 0.14], color: "#ffffff" });
      S.push({ size: [0.16, 1.2, 0.16], pos: [jx, top + 0.6, jz - 0.1], color: "#6b7280" });
      t.nightWins.push({ x: jx, y: jy - 1.2, z: jz + 0.12, w: 1.4, h: 0.05 });
    } else {
      // the tall pylon by the corner with the sign on top
      const px = e.x1 - 0.6, pz = FRONT + 0.6;
      S.push({ size: [0.3, 6.2, 0.3], pos: [px, 3.0, pz], color: "#6b7280" });
      S.push({ size: [2.3, 0.75, 0.24], pos: [px, 6.3, pz], color: e.trim });
      t.signs.push({ id: e.sign, x: px, y: 6.3, z: pz + 0.13, w: 2.2, h: 0.55 });
      t.nightWins.push({ x: px, y: 5.85, z: pz + 0.13, w: 2.2, h: 0.06 });
    }
    return;
  }

  if (e.kind === "mart") {
    // convenience store / drugstore: glass front, a stripe of the brand colour, the sign on the fascia
    wins.push({ x: cx + 0.6, y: 1.3, z: fz, w: w - 2.2, h: 1.9 });
    S.push({ size: [1.2, 2.2, 0.07], pos: [e.x0 + 0.9, 1.0, FRONT + 0.05], color: "#d1d5db" });
    S.push({ size: [1.0, 2.05, 0.08], pos: [e.x0 + 0.9, 1.0, FRONT + 0.06], color: "#2b3640" });
    S.push({ size: [w + 0.06, 0.16, 0.1], pos: [cx, 2.4, FRONT + 0.05], color: e.awning });
    S.push({ size: [w + 0.06, e.h - 2.5, 0.1], pos: [cx, (2.5 + e.h) / 2 - 0.05, FRONT + 0.04], color: e.trim });
    t.signs.push({ id: e.sign, x: cx, y: (2.5 + e.h) / 2 - 0.05, z: FRONT + 0.1, w: Math.min(w - 0.4, 4.2), h: Math.min(0.85, e.h - 2.6) });
    wins.push({ x: e.x1 + 0.04, y: 1.4, z: cz, w: e.depth - 2, h: 1.0, face: "x" });
    S.push({ size: [w + 0.12, 0.18, e.depth + 0.12], pos: [cx, top, cz], color: e.trim });
    S.push({ size: [1.0, 0.6, 0.7], pos: [cx, top + 0.38, back + 1.2], color: "#cbd5e1" });
    return;
  }

  // shophouses: the store downstairs, a sloping GI awning, the sign above it
  if (e.kind === "sari") {
    // the sari-sari window: a wide counter opening behind a grill, snacks hanging in strips
    wins.push({ x: cx + 0.5, y: 1.35, z: fz, w: w - 2.2, h: 1.1 });
    grill(t, cx + 0.5, 1.35, FRONT + 0.08, w - 2.2, 1.1, "#1f2937");
    S.push({ size: [w - 2.0, 0.08, 0.5], pos: [cx + 0.5, 0.78, FRONT + 0.25], color: "#8a6a4a" });
    const snacks = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#eab308"];
    for (let i = 0; i < 9; i++) S.push({ size: [0.14, 0.5, 0.03], pos: [e.x0 + 1.75 + i * ((w - 2.6) / 8), 1.62, FRONT + 0.12], color: snacks[i % snacks.length] });
    S.push({ size: [0.95, 2.0, 0.07], pos: [e.x0 + 0.75, 0.9, FRONT + 0.04], color: "#6b4a33" });
    // the wooden bench outside, the one everyone sits on
    S.push({ size: [1.8, 0.08, 0.4], pos: [cx + 0.5, 0.38, FRONT + 0.9], color: "#8a6a4a" });
    for (const dx of [-0.75, 0.75]) S.push({ size: [0.08, 0.4, 0.36], pos: [cx + 0.5 + dx, 0.18, FRONT + 0.9], color: "#6b4a33" });
  } else {
    wins.push({ x: (e.x0 + 2 + e.x1 - 0.4) / 2, y: 1.1, z: fz, w: w - 2.6, h: 1.25 });
    S.push({ size: [1.4, 2.0, 0.06], pos: [e.x0 + 1.1, 0.9, FRONT + 0.03], color: "#2b3640" });
    // the steel roll-up shutter, rolled half up: a ribbed grey band over the shop front
    S.push({ size: [w - 0.3, 0.36, 0.1], pos: [cx, 2.0, FRONT + 0.06], color: "#9ca3af" });
    for (let k = 0; k < 3; k++) S.push({ size: [w - 0.3, 0.02, 0.11], pos: [cx, 1.88 + k * 0.1, FRONT + 0.07], color: "#6b7280" });
  }
  // GI awning, sloping down toward the street
  S.push({ size: [w - 0.1, 0.05, 1.25], pos: [cx, 2.38, FRONT + 0.58], rot: [0.28, 0, 0], color: e.awning });
  S.push({ size: [w - 0.1, 0.03, 1.25], pos: [cx, 2.35, FRONT + 0.58], rot: [0.28, 0, 0], color: "#d1d5db" });
  t.signs.push({ id: e.sign, x: cx, y: 2.76, z: fz + 0.02, w: Math.min(w - 0.5, 4.4), h: 0.55 });
  // side window on the +x wall (the camera sees that side too)
  wins.push({ x: e.x1 + 0.04, y: 1.45, z: cz, w: Math.min(2.2, e.depth - 1.6), h: 0.9, face: "x" });

  if (e.floors === 2) {
    // the family's home upstairs: painted, two grilled windows, a narrow balcony with the laundry out
    const upH = 2.4, base = e.h - 0.1, uy = base + upH / 2;
    S.push({ size: [w + 0.1, 0.14, e.depth], pos: [cx, base, cz], color: e.trim });
    S.push({ size: [w, upH, e.depth - 0.4], pos: [cx, uy, cz - 0.2], color: e.upper ?? e.wall });
    for (const k of [0.27, 0.73]) {
      const x = e.x0 + w * k;
      t.homeWins.push({ x, y: uy + 0.15, z: FRONT - 0.36, w: 1.2, h: 1.0 });
      grill(t, x, uy + 0.15, FRONT - 0.33, 1.2, 1.0);
    }
    S.push({ size: [w - 0.6, 0.06, 0.7], pos: [cx, base + 0.1, FRONT - 0.05], color: "#d6d3cc" });
    S.push({ size: [w - 0.6, 0.05, 0.04], pos: [cx, base + 1.0, FRONT + 0.27], color: "#2b3036" });
    for (let i = 0; i <= 6; i++) S.push({ size: [0.03, 0.9, 0.03], pos: [e.x0 + 0.3 + (i * (w - 0.6)) / 6, base + 0.55, FRONT + 0.27], color: "#2b3036" });
    const clothes = ["#f8fafc", "#f472b6", "#60a5fa", "#facc15"];
    for (let i = 0; i < 4; i++) S.push({ size: [0.4, 0.5, 0.02], pos: [e.x0 + 0.9 + i * 0.55, base + 0.72, FRONT + 0.29], color: clothes[i] });
    top = base + upH;
  }
  // flat concrete roof with a parapet and the water tank (every Filipino rooftop)
  S.push({ size: [w + 0.12, 0.2, e.depth + 0.12], pos: [cx, top, cz], color: e.trim });
  S.push({ size: [w - 0.4, 0.04, e.depth - 0.4], pos: [cx, top + 0.11, cz], color: "#9ca3af" });
  waterTank(t, e.x1 - 0.9, top + 0.1, back + 0.9);
}

/* ------------------------------------------------------------------ houses */

const WALLS = ["#f1e3c8", "#dfe8d0", "#f3d5c8", "#d6e2ec", "#efe7d6", "#e2d6ea", "#fde7b0", "#cfe7e1"];
const ROOFS = ["#9b3b2a", "#2f5d8a", "#3f6b4a", "#8a4b2a", "#6b7280", "#b45309"];
const GATES = ["#1f2937", "#14532d", "#7f1d1d", "#1e3a8a", "#3f3f46"];
const FENCES = ["#e7e2d6", "#d6d3cc", "#f0e6d2", "#dbe4e8"];

function rnd(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 2147483647;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** One Filipino house on a residential street: front faces +z, its fence and gate on the street edge (gateZ). */
function house(t: Town, x: number, gateZ: number, i: number, sari: boolean): void {
  const r = rnd(i + 3);
  const S = t.solid;
  const w = 5.4 + Math.round(r() * 2) * 0.4;
  const d = 5.2;
  const front = gateZ - 1.9;
  const cx = x + w / 2, cz = front - d / 2;
  const two = r() < 0.45;
  const flat = !two && r() < 0.3;
  const wall = WALLS[i % WALLS.length];
  const roof = ROOFS[(i * 5) % ROOFS.length];
  const lowH = 2.6;

  // concrete yard slab, then the house: painted hollow block downstairs
  S.push({ size: [w + 0.6, 0.04, gateZ - front + 0.2], pos: [cx, -0.1, (front + gateZ) / 2], color: "#c9c6bf" });
  S.push({ size: [w, lowH, d], pos: [cx, lowH / 2 - 0.1, cz], color: wall });
  S.push({ size: [0.95, 2.0, 0.06], pos: [x + 1.0, 0.9, front + 0.03], color: "#7c4a2d" });
  const win1x = x + w - 1.5;
  t.homeWins.push({ x: win1x, y: 1.3, z: front + 0.04, w: 1.5, h: 1.0 });
  grill(t, win1x, 1.3, front + 0.08, 1.5, 1.0, i % 3 ? "#2b3036" : "#f8fafc");
  // the porch light by the door, and the side window on the +x wall
  t.homeWins.push({ x: x + 1.75, y: 2.05, z: front + 0.05, w: 0.18, h: 0.18 });
  t.homeWins.push({ x: x + w + 0.04, y: 1.3, z: cz, w: 1.3, h: 0.9, face: "x" });
  let top = lowH - 0.1;

  if (two) {
    // upstairs overhangs the front a little (a nod to the bahay na bato): wood or paint, its own windows
    const upper = r() < 0.5 ? "#a16207" : wall;
    S.push({ size: [w + 0.2, 0.14, d + 0.6], pos: [cx, top + 0.02, cz + 0.3], color: "#d6d3cc" });
    S.push({ size: [w + 0.2, 2.3, d + 0.6], pos: [cx, top + 1.2, cz + 0.3], color: upper });
    for (const k of [0.25, 0.72]) {
      const wx = x + w * k;
      t.homeWins.push({ x: wx, y: top + 1.25, z: front + 0.65, w: 1.3, h: 0.9 });
      grill(t, wx, top + 1.25, front + 0.69, 1.3, 0.9, "#f8fafc");
    }
    top += 2.35;
  }
  if (flat) {
    // a concrete roof deck with a parapet and the water tank
    S.push({ size: [w + 0.1, 0.45, d + 0.1], pos: [cx, top + 0.12, cz], color: wall });
    S.push({ size: [w - 0.3, 0.04, d - 0.3], pos: [cx, top + 0.36, cz], color: "#9ca3af" });
    waterTank(t, x + w - 0.9, top + 0.34, cz - 1);
  } else {
    // GI sheet gable roof with its ridge cap
    const dz = two ? 0.3 : 0;
    S.push({ shape: "gable", size: [w + 0.5, 1.15, d + 0.9 + dz * 2], pos: [cx, top, cz + dz], color: roof });
    S.push({ size: [w + 0.52, 0.06, 0.16], pos: [cx, top + 1.14, cz + dz], color: "#9ca3af" });
  }

  // the perimeter fence: painted hollow block with pillars, and a steel gate wide enough for the tricycle
  const fence = FENCES[i % FENCES.length], gate = GATES[i % GATES.length];
  const gx0 = x + 0.2, gx1 = gx0 + 2.6;
  const FH = 1.25;
  const fenceRun = (a: number, b: number) => { if (b - a > 0.05) S.push({ size: [b - a, FH, 0.16], pos: [(a + b) / 2, FH / 2 - 0.1, gateZ], color: fence }); };
  fenceRun(x - 0.3, gx0);
  fenceRun(gx1, x + w + 0.3);
  for (const px of [x - 0.3, gx0, gx1, x + w + 0.3]) {
    S.push({ size: [0.3, FH + 0.3, 0.3], pos: [px, (FH + 0.3) / 2 - 0.1, gateZ], color: fence });
    S.push({ size: [0.36, 0.08, 0.36], pos: [px, FH + 0.24, gateZ], color: "#d6d3cc" });
  }
  S.push({ size: [gx1 - gx0 - 0.3, 1.35, 0.05], pos: [(gx0 + gx1) / 2, 0.62, gateZ], color: gate });
  for (let k = 1; k < 8; k++) S.push({ size: [0.03, 1.2, 0.07], pos: [gx0 + 0.15 + (k * (gx1 - gx0 - 0.3)) / 8, 0.62, gateZ + 0.02], color: "#9ca3af" });

  // potted plants along the fence
  for (const px of [gx1 + 0.6, x + w - 0.4]) {
    S.push({ shape: "cyl", size: [0.16, 0.3, 8], pos: [px, 0.05, gateZ - 0.35], color: "#b45309" });
    S.push({ shape: "cyl", size: [0.26, 0.4, 7], pos: [px, 0.4, gateZ - 0.35], color: "#3f7d4a" });
  }

  if (r() < 0.45) {
    // a carport roof by the gate, often with the family's tricycle or motorbike under it
    for (const px of [gx0 + 0.15, gx1 - 0.15]) S.push({ size: [0.08, 2.3, 0.08], pos: [px, 1.05, gateZ - 0.3], color: "#6b7280" });
    S.push({ size: [gx1 - gx0 + 0.2, 0.05, gateZ - front + 0.1], pos: [(gx0 + gx1) / 2, 2.25, (front + gateZ) / 2], rot: [-0.08, 0, 0], color: "#9ca3af" });
    if (r() < 0.65) parked(t, r() < 0.55 ? "tricycle" : "moto", ["#0284c7", "#dc2626", "#16a34a", "#f59e0b"][i % 4], [(gx0 + gx1) / 2, 0, (front + gateZ) / 2], Math.PI / 2);
  } else if (r() < 0.6) {
    // a clothesline in the yard
    const lx0 = gx1 + 0.3, lx1 = Math.min(x + w, lx0 + 2.4), lz = front + 0.9;
    for (const px of [lx0, lx1]) S.push({ size: [0.05, 1.7, 0.05], pos: [px, 0.75, lz], color: "#6b7280" });
    S.push({ size: [lx1 - lx0, 0.015, 0.015], pos: [(lx0 + lx1) / 2, 1.55, lz], color: "#e5e7eb" });
    const cloth = ["#f8fafc", "#60a5fa", "#f472b6", "#facc15", "#34d399"];
    for (let k = 0; k < 4; k++) S.push({ size: [0.38, 0.5, 0.02], pos: [lx0 + 0.35 + k * ((lx1 - lx0 - 0.7) / 3), 1.28, lz], color: cloth[(i + k) % cloth.length] });
  }
  if (!flat && r() < 0.5) waterTank(t, x + w + 0.65, -0.1, cz - 1.2, true);

  if (sari) {
    // a sari-sari window cut into the fence, with its sign
    S.push({ size: [1.3, 0.9, 0.2], pos: [x + w - 0.9, 0.95, gateZ + 0.02], color: "#2b3640" });
    grill(t, x + w - 0.9, 0.95, gateZ + 0.14, 1.3, 0.9, "#1f2937");
    t.signs.push({ id: "sariHome", x: x + w - 0.9, y: 1.75, z: gateZ + 0.14, w: 1.6, h: 0.4 });
    t.homeWins.push({ x: x + w - 0.9, y: 0.95, z: gateZ + 0.125, w: 1.2, h: 0.8 });
  }
}

function houses(t: Town): void {
  let i = 0;
  BACK_STREETS.forEach((b, row) => {
    const gateZ = b.z0 - 0.45;
    for (let x = -46 + row * 3.4; x < 66; x += 7.6) {
      if (SIDE_STREETS.some((st) => x + 7 > st.x0 - 0.3 && x - 0.5 < st.x1 + 0.3)) continue; // keep the side streets clear
      house(t, x, gateZ, i, i === 4 || i === 13);
      i++;
    }
  });
  // a basketball hoop on the residential street (a plywood board nailed to a post)
  const hx = 21.5, hz = BACK_STREETS[0].z1 + 0.35;
  t.solid.push({ size: [0.12, 3.2, 0.12], pos: [hx, 1.5, hz], color: "#6b4a33" });
  t.solid.push({ size: [1.4, 0.95, 0.05], pos: [hx, 3.15, hz - 0.12], color: "#f3f1ec" });
  t.solid.push({ size: [0.5, 0.35, 0.06], pos: [hx, 3.0, hz - 0.15], color: "#dc2626" });
  t.solid.push({ shape: "cyl", size: [0.22, 0.03, 12], pos: [hx, 2.78, hz - 0.42], color: "#f97316" });
}

/* ------------------------------------------------------------------ across the street */

type Station = { x0: number; x1: number; sign: SignId; canopy: string; band: string; pump: string; kiosk: string };

/** A gas station: concrete apron, a canopy on four posts with the brand on its fascia, pumps, the shop behind. */
function gasStation(t: Town, s: Station, z0: number): void {
  const S = t.solid;
  const { x0, x1 } = s;
  const cx = (x0 + x1) / 2, w = x1 - x0;
  S.push({ size: [w, 0.04, 9.8], pos: [cx, -0.1, z0 + 4.9], color: "#b9bcb8" });
  for (const [x, z] of [[x0 + 1.5, z0 + 1.6], [x1 - 1.5, z0 + 1.6], [x0 + 1.5, z0 + 5.4], [x1 - 1.5, z0 + 5.4]]) {
    S.push({ size: [0.24, 3.2, 0.24], pos: [x, 1.5, z], color: s.canopy });
  }
  const cw = w - 1.2, cd = 5.2, ccz = z0 + 3.5, CH = 0.72;
  S.push({ size: [cw, CH, cd], pos: [cx, 3.3, ccz], color: s.canopy });
  S.push({ size: [cw + 0.04, 0.14, cd + 0.04], pos: [cx, 3.3 - CH / 2 - 0.02, ccz], color: s.band });
  // the brand on the fascia (camera side, road side and the +x end); a lit strip along its lower edge
  t.signs.push({ id: s.sign, x: cx, y: 3.33, z: ccz + cd / 2 + 0.03, w: 2.8, h: 0.56 });
  t.signs.push({ id: s.sign, x: cx, y: 3.33, z: ccz - cd / 2 - 0.03, w: 2.8, h: 0.56, back: true });
  t.signs.push({ id: s.sign, x: cx + cw / 2 + 0.03, y: 3.33, z: ccz, w: 2.6, h: 0.52, sideX: true });
  t.nightWins.push({ x: cx, y: 3.3 - CH / 2 - 0.11, z: ccz + cd / 2 + 0.04, w: cw, h: 0.07 });
  t.nightWins.push({ x: cx + cw / 2 + 0.04, y: 3.3 - CH / 2 - 0.11, z: ccz, w: cd, h: 0.07, face: "x" });
  t.pools.push([cx, ccz, cw + 4, cd + 5]);
  // islands and pumps
  for (const x of [x0 + 3.4, x1 - 3.4]) {
    S.push({ size: [0.9, 0.15, 2.6], pos: [x, -0.04, ccz], color: "#e5e7eb" });
    S.push({ size: [0.6, 1.4, 0.45], pos: [x, 0.65, ccz], color: s.pump });
    S.push({ size: [0.5, 0.35, 0.47], pos: [x, 1.05, ccz], color: "#111827" });
    S.push({ size: [0.62, 0.12, 0.47], pos: [x, 1.4, ccz], color: s.band });
  }
  // the convenience shop at the back: windows on the +x side and the camera side
  const kx = x0 + 2.6, kz = z0 + 8.4;
  S.push({ size: [4.4, 2.8, 2.4], pos: [kx, 1.3, kz], color: s.kiosk });
  S.push({ size: [4.5, 0.25, 2.5], pos: [kx, 2.75, kz], color: s.band });
  t.nightWins.push({ x: kx + 2.24, y: 1.3, z: kz, w: 1.6, h: 1.2, face: "x" });
  t.nightWins.push({ x: kx, y: 1.4, z: kz + 1.24, w: 2.6, h: 0.9 });
  // the price pylon by the road
  S.push({ size: [0.95, 3.6, 0.28], pos: [x1 + 0.3, 1.7, z0 + 0.4], color: s.canopy });
  S.push({ size: [0.8, 1.6, 0.3], pos: [x1 + 0.3, 1.4, z0 + 0.4], color: "#111827" });
  for (let k = 0; k < 3; k++) t.nightWins.push({ x: x1 + 0.3, y: 0.85 + k * 0.5, z: z0 + 0.56, w: 0.55, h: 0.16 });
  t.signs.push({ id: s.sign, x: x1 + 0.3, y: 3.15, z: z0 + 0.56, w: 0.9, h: 0.3 });
}

function across(t: Town): void {
  const z0 = FAR_WALK.z1 + 0.6;
  const S = t.solid;
  gasStation(t, { x0: -40, x1: -29.5, sign: "shell", canopy: "#fbce07", band: "#dd1d21", pump: "#dd1d21", kiosk: "#fff7d6" }, z0);
  gasStation(t, { x0: -17, x1: -6.5, sign: "petron", canopy: "#f8fafc", band: "#0033a0", pump: "#e4002b", kiosk: "#f1f5f9" }, z0);

  // the tricycle terminal (TODA): a shed with a bench, and tricycles lined up waiting for passengers
  const tx0 = -27.4, tx1 = -20.4, tcx = (tx0 + tx1) / 2;
  S.push({ size: [tx1 - tx0, 0.04, 7.6], pos: [tcx, -0.1, z0 + 3.8], color: "#9ca3af" });
  for (const x of [tx0 + 0.4, tx1 - 0.4]) for (const z of [z0 + 0.9, z0 + 2.7]) S.push({ size: [0.1, 2.5, 0.1], pos: [x, 1.15, z], color: "#4b5563" });
  S.push({ size: [tx1 - tx0, 0.06, 2.4], pos: [tcx, 2.42, z0 + 1.8], rot: [0.1, 0, 0], color: "#15803d" });
  S.push({ size: [tx1 - tx0 - 1.6, 0.08, 0.4], pos: [tcx, 0.42, z0 + 2.4], color: "#8a6a4a" });
  t.signs.push({ id: "toda", x: tcx, y: 2.75, z: z0 + 3.0, w: 1.8, h: 0.42 });
  t.signs.push({ id: "toda", x: tcx, y: 2.75, z: z0 + 0.6, w: 1.8, h: 0.42, back: true });
  t.pools.push([tcx, z0 + 2.2, tx1 - tx0, 4]);
  t.nightWins.push({ x: tcx, y: 2.3, z: z0 + 3.02, w: 2.2, h: 0.05 });
  ["#0284c7", "#dc2626", "#16a34a", "#7c3aed"].forEach((c, k) => parked(t, "tricycle", c, [tx0 + 1.1 + k * 1.75, 0, z0 + 5.6], Math.PI / 2));

  // barangay court: green surface, white lines, two hoops, floodlights on poles
  const bx0 = -3.6, bx1 = 11.8, bz0 = z0 + 0.8, bz1 = z0 + 8.6;
  const bcx = (bx0 + bx1) / 2, bcz = (bz0 + bz1) / 2;
  S.push({ size: [bx1 - bx0 + 1.2, 0.04, bz1 - bz0 + 1.2], pos: [bcx, -0.1, bcz], color: "#c9c6bf" });
  S.push({ size: [bx1 - bx0, 0.05, bz1 - bz0], pos: [bcx, -0.085, bcz], color: "#2f7d6b" });
  const line = (w: number, d: number, x: number, z: number): Part => ({ size: [w, 0.012, d], pos: [x, -0.055, z], color: "#f8fafc" });
  S.push(line(bx1 - bx0, 0.06, bcx, bz0), line(bx1 - bx0, 0.06, bcx, bz1), line(0.06, bz1 - bz0, bx0, bcz), line(0.06, bz1 - bz0, bx1, bcz), line(0.06, bz1 - bz0, bcx, bcz));
  S.push({ shape: "cyl", size: [1.0, 0.014, 24], pos: [bcx, -0.054, bcz], color: "#f8fafc" });
  S.push({ shape: "cyl", size: [0.94, 0.016, 24], pos: [bcx, -0.052, bcz], color: "#2f7d6b" });
  for (const [x, dir] of [[bx0 - 0.3, 1], [bx1 + 0.3, -1]] as const) {
    S.push({ size: [0.14, 3.0, 0.14], pos: [x, 1.4, bcz], color: "#374151" });
    S.push({ size: [0.9, 0.08, 0.1], pos: [x + dir * 0.45, 2.85, bcz], color: "#374151" });
    S.push({ size: [0.06, 1.05, 1.8], pos: [x + dir * 0.9, 3.05, bcz], color: "#f8fafc" });
    S.push({ size: [0.36, 0.03, 0.36], pos: [x + dir * 1.12, 2.72, bcz], color: "#f97316" });
  }
  for (const x of [bcx - 3.5, bcx + 3.5]) S.push({ size: [2.2, 0.4, 0.45], pos: [x, 0.12, bz1 + 0.9], color: "#8a6a4a" });
  for (const [x, z] of [[bx0 - 0.6, bz1 + 0.4], [bx1 + 0.6, bz0 - 0.4]]) {
    S.push({ size: [0.14, 5.2, 0.14], pos: [x, 2.5, z], color: "#4b5563" });
    S.push({ size: [0.7, 0.3, 0.3], pos: [x, 5.1, z], color: "#374151" });
    t.nightWins.push({ x, y: 4.98, z: z + 0.16, w: 0.6, h: 0.12 });
  }
  t.pools.push([bcx, bcz, bx1 - bx0 + 1, bz1 - bz0 + 1]);

  // parking lot with stall lines and three parked cars (engines off, lights off)
  const px0 = 14.2, px1 = 27.2, pz0 = z0 + 0.6, pz1 = z0 + 7.4;
  S.push({ size: [px1 - px0, 0.03, pz1 - pz0], pos: [(px0 + px1) / 2, -0.1, (pz0 + pz1) / 2], color: "#5b6166" });
  for (let x = px0 + 0.4; x <= px1; x += 2.6) S.push({ size: [0.07, 0.012, 4.6], pos: [x, -0.08, pz0 + 2.9], color: "#f8fafc" });
  parked(t, "sedan", "#991b1b", [px0 + 1.7, 0, pz0 + 2.9], Math.PI / 2);
  parked(t, "suv", "#e5e7eb", [px0 + 6.9, 0, pz0 + 2.9], Math.PI / 2);
  parked(t, "van", "#1e3a8a", [px0 + 9.5, 0, pz0 + 2.9], Math.PI / 2);
  t.pools.push([(px0 + px1) / 2, (pz0 + pz1) / 2, 9, 6]);

  // the park: a path, benches and a small gazebo (the trees are in Grounds' instanced trees)
  S.push({ size: [12.5, 0.02, 1.2], pos: [35.2, -0.105, z0 + 5.3], color: "#d6c7a1" });
  S.push({ size: [8, 0.02, 1.2], pos: [35.2, -0.105, z0 + 5.3], rot: [0, Math.PI / 2, 0], color: "#d6c7a1" });
  for (const x of [31.2, 39.2]) S.push({ size: [1.8, 0.4, 0.45], pos: [x, 0.12, z0 + 4.4], color: "#8a6a4a" });
  S.push({ shape: "cyl", size: [1.8, 0.12, 8], pos: [35.2, 0.0, z0 + 5.3], color: "#c9c6bf" });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    S.push({ size: [0.12, 2.4, 0.12], pos: [35.2 + Math.cos(a) * 1.55, 1.2, z0 + 5.3 + Math.sin(a) * 1.55], color: "#f3f1ec" });
  }
  S.push({ shape: "cyl", size: [2.1, 0.12, 8], pos: [35.2, 2.45, z0 + 5.3], color: "#7c2d12" });
  t.pools.push([35.2, z0 + 5.3, 5, 5]);

  // the barangay hall: two storeys, the flag out front, its name on both faces of the parapet
  const hx0 = 44, hx1 = 54, hcx = (hx0 + hx1) / 2, hz0 = z0 + 2.4, hz1 = z0 + 8.4, hcz = (hz0 + hz1) / 2;
  S.push({ size: [hx1 - hx0 + 2, 0.04, hz1 - z0 + 0.4], pos: [hcx, -0.1, (z0 + hz1) / 2], color: "#c9c6bf" });
  S.push({ size: [hx1 - hx0, 5.2, hz1 - hz0], pos: [hcx, 2.5, hcz], color: "#f5f0e1" });
  S.push({ size: [hx1 - hx0 + 0.1, 0.16, hz1 - hz0 + 0.1], pos: [hcx, 2.6, hcz], color: "#1e3a8a" });
  S.push({ size: [hx1 - hx0 + 0.14, 0.8, hz1 - hz0 + 0.14], pos: [hcx, 5.4, hcz], color: "#1e3a8a" });
  t.signs.push({ id: "hall", x: hcx, y: 5.4, z: hz1 + 0.09, w: 3.6, h: 0.7 });
  t.signs.push({ id: "hall", x: hcx, y: 5.4, z: hz0 - 0.09, w: 3.6, h: 0.7, back: true });
  for (const fy of [1.4, 3.9]) for (let k = 0; k < 4; k++) t.shopWins.push({ x: hx0 + 1.4 + k * 2.4, y: fy, z: hz1 + 0.04, w: 1.4, h: 1.0 });
  for (const fy of [1.4, 3.9]) t.shopWins.push({ x: hx1 + 0.04, y: fy, z: hcz, w: 3, h: 1, face: "x" });
  const fx = hcx, fz = z0 + 1.0;
  S.push({ shape: "cyl", size: [0.05, 6.4, 8], pos: [fx, 3.1, fz], color: "#e5e7eb" });
  S.push({ size: [1.4, 0.35, 0.02], pos: [fx + 0.72, 5.9, fz], color: "#0038a8" });
  S.push({ size: [1.4, 0.35, 0.02], pos: [fx + 0.72, 5.55, fz], color: "#ce1126" });
  S.push({ size: [0.42, 0.7, 0.03], pos: [fx + 0.23, 5.72, fz], color: "#ffffff" });
  S.push({ size: [0.12, 0.12, 0.04], pos: [fx + 0.2, 5.72, fz], color: "#fcd116" });
  t.pools.push([hcx, hz1 + 1.5, 10, 3]);
}

/* ------------------------------------------------------------------ meshes */

function planes(wins: readonly Win[]): THREE.BufferGeometry | null {
  const plane = new THREE.PlaneGeometry(1, 1);
  const g = mergePlaced(wins.map((w) => ({ geometry: plane, matrix: placed([w.x, w.y, w.z], w.face === "x" ? [0, Math.PI / 2, 0] : [0, 0, 0], [w.w, w.h, 1]) })));
  plane.dispose();
  return g;
}

function build() {
  const t = newTown();
  EST.forEach((e) => establishment(t, e));
  houses(t);
  across(t);
  const signGeo = mergePlaced(t.signs.map((s) => ({ geometry: signPlane(s.w, s.h, cellOf(s.id)), matrix: placed([s.x, s.y, s.z], [0, s.back ? Math.PI : s.sideX ? Math.PI / 2 : 0, 0]) })));
  const poolPlane = new THREE.PlaneGeometry(1, 1);
  const pools = mergePlaced(t.pools.map(([x, z, w, d]) => ({ geometry: poolPlane, matrix: placed([x, 0.015, z], [-Math.PI / 2, 0, 0], [w, d, 1]) })));
  poolPlane.dispose();
  return {
    solid: joinGeometries([mergeParts(t.solid), ...t.extra]),
    shopWins: planes(t.shopWins),
    nightWins: planes(t.nightWins),
    homeWins: planes(t.homeWins),
    signs: signGeo,
    pools,
    atlas: signAtlas(),
  };
}

/** Shops are open 6 AM – 10 PM; homes light up in the evening and mostly go dark after midnight. */
function shopsOpen(min: number): number { return min >= 360 && min < 1320 ? 1 : 0; }
function homesLit(min: number): number { return min >= 1050 || min < 30 ? 1 : min < 360 && min >= 300 ? 0.6 : 0.15; }

export function Neighbourhood() {
  const shopWin = useRef<THREE.MeshStandardMaterial>(null);
  const nightWin = useRef<THREE.MeshStandardMaterial>(null);
  const homeWin = useRef<THREE.MeshStandardMaterial>(null);
  const signMat = useRef<THREE.MeshStandardMaterial>(null);
  const poolMat = useRef<THREE.MeshBasicMaterial>(null);
  const built = useMemo(build, []);
  const glow = useMemo(() => getGlowTexture(), []);

  useFrame(() => {
    const min = manilaMinutes(sceneNow());
    // how dark it is outside: night, dusk (the lamps' level) and heavy overcast
    const k = streetLightLevel();
    const dark = Math.max(light.night, light.lamps * 0.8, light.cloud > 0.8 ? 0.4 : 0, k);
    if (shopWin.current) shopWin.current.emissiveIntensity = 0.05 + dark * shopsOpen(min) * 1.7;
    if (nightWin.current) nightWin.current.emissiveIntensity = 0.1 + dark * 2.0;
    if (homeWin.current) homeWin.current.emissiveIntensity = 0.02 + dark * homesLit(min) * 1.3;
    // signs stay lit all night (as they do)
    if (signMat.current) signMat.current.emissiveIntensity = 0.15 + dark * 1.0;
    if (poolMat.current) poolMat.current.opacity = k * 0.5;
  });

  return (
    <group>
      {built.solid && <mesh geometry={built.solid}><meshStandardMaterial vertexColors roughness={0.9} /></mesh>}
      {built.shopWins && (
        <mesh geometry={built.shopWins}>
          <meshStandardMaterial ref={shopWin} color="#38506a" emissive="#ffe2a8" emissiveIntensity={0.05} roughness={0.2} metalness={0.3} />
        </mesh>
      )}
      {built.nightWins && (
        <mesh geometry={built.nightWins}>
          <meshStandardMaterial ref={nightWin} color="#3d5670" emissive="#fff1d0" emissiveIntensity={0.1} roughness={0.2} metalness={0.3} />
        </mesh>
      )}
      {built.homeWins && (
        <mesh geometry={built.homeWins}>
          <meshStandardMaterial ref={homeWin} color="#3b4f63" emissive="#ffd28a" emissiveIntensity={0.02} roughness={0.25} metalness={0.25} />
        </mesh>
      )}
      {built.signs && (
        <mesh geometry={built.signs}>
          <meshStandardMaterial ref={signMat} map={built.atlas} emissiveMap={built.atlas} emissive="#ffffff" emissiveIntensity={0.15} roughness={0.6} />
        </mesh>
      )}
      {built.pools && (
        <mesh geometry={built.pools} renderOrder={2}>
          <meshBasicMaterial ref={poolMat} map={glow} color="#ffd9a0" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
