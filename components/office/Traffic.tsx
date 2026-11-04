"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useOffice } from "@/lib/store";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { mergeParts, mergePlaced, placed, type Part } from "./batch";
import { BACK_LANE, LANE } from "./world";

/**
 * Traffic: jeepneys, tricycles, cars and a van on the main street, and tricycles and motorbikes on the two
 * residential streets behind the office. Every vehicle has headlights and tail lights that come on at dusk
 * (with a glow and a pool of light on the road ahead), so nothing ever drives in the dark unlit.
 *
 * Cheap to draw: each vehicle is one merged vertex-coloured body, one lights mesh and one glow mesh, all
 * sharing three materials; the only per-frame work is moving a dozen groups along a line.
 */

export type Kind = "sedan" | "hatch" | "van" | "tricycle" | "jeepney" | "suv" | "moto";
type Road = "near" | "far" | "back0" | "back1";
type Spec = { kind: Kind; color: string; road: Road; offset: number; accent?: string };

const HEAD = "#fff7df", TAIL = "#ff2a2a";

/**
 * Local frame: front toward +x, ground at y = 0, centred. Returns body parts, light parts and the front x.
 * `accent` is the second livery colour (jeepney stripes, tricycle sidecar trim).
 */
export function vehicle(kind: Kind, color: string, accent = "#facc15", driver = true): { body: Part[]; lights: Part[]; front: number; rear: number } {
  const body: Part[] = [], lights: Part[] = [];
  const wheel = (x: number, z: number, r = 0.32): Part => ({ shape: "cyl", size: [r, 0.22, 12], pos: [x, r, z], rot: [Math.PI / 2, 0, 0], color: "#111417" });
  const head = (x: number, y: number, z: number, s = 0.16): Part => ({ size: [0.04, 0.1, s * 1.4], pos: [x, y, z], color: HEAD });
  const tail = (x: number, y: number, z: number): Part => ({ size: [0.04, 0.1, 0.24], pos: [x, y, z], color: TAIL });
  const glass = "#1f2a36", chrome = "#d9dde2", dark = "#1f2937";
  if (kind === "moto") {
    body.push({ size: [1.5, 0.3, 0.26], pos: [0, 0.55, 0], color });
    body.push({ size: [0.7, 0.12, 0.3], pos: [-0.2, 0.78, 0], color: dark });
    body.push(wheel(0.62, 0, 0.3), wheel(-0.6, 0, 0.3));
    // the rider: jacket, legs, helmet
    if (driver) {
      body.push({ size: [0.34, 0.6, 0.42], pos: [-0.15, 1.15, 0], color: accent });
      body.push({ size: [0.5, 0.2, 0.36], pos: [0.05, 0.85, 0], color: "#1f3a52" });
      body.push({ shape: "cyl", size: [0.15, 0.26, 10], pos: [-0.1, 1.6, 0], color: "#111827" });
    }
    body.push({ size: [0.1, 0.1, 0.55], pos: [0.45, 1.05, 0], color: dark });
    lights.push(head(0.78, 0.75, 0, 0.1), tail(-0.78, 0.7, 0));
    return { body, lights, front: 0.8, rear: -0.8 };
  }
  if (kind === "tricycle") {
    // a motorcycle with a boxy sidecar on its right; one roof covers the driver and the sidecar (PH style)
    body.push({ size: [1.6, 0.35, 0.3], pos: [0, 0.55, -0.4], color: dark });
    body.push({ size: [0.5, 0.25, 0.28], pos: [0.1, 0.85, -0.4], color });
    body.push({ size: [1.7, 1.0, 1.05], pos: [-0.05, 0.85, 0.42], color });
    body.push({ size: [1.72, 0.12, 1.07], pos: [-0.05, 0.62, 0.42], color: accent });
    body.push({ size: [1.72, 0.06, 1.07], pos: [-0.05, 1.3, 0.42], color: accent });
    body.push({ size: [2.0, 0.08, 1.75], pos: [-0.1, 1.72, 0.12], color });
    body.push({ size: [2.02, 0.12, 1.77], pos: [-0.1, 1.65, 0.12], color: accent });
    body.push({ size: [0.06, 0.95, 0.06], pos: [-0.85, 1.2, -0.62], color: chrome });
    body.push({ size: [0.9, 0.5, 0.04], pos: [0.1, 1.15, 0.95], color: glass });
    body.push({ size: [0.05, 0.6, 1.0], pos: [0.82, 1.2, 0.42], color: glass });
    // the driver
    if (driver) {
      body.push({ size: [0.34, 0.55, 0.4], pos: [-0.25, 1.12, -0.4], color: "#334155" });
      body.push({ shape: "cyl", size: [0.13, 0.22, 10], pos: [-0.2, 1.5, -0.4], color: "#7c5a43" });
    }
    body.push(wheel(0.7, -0.4, 0.28), wheel(-0.6, -0.4, 0.28), wheel(-0.3, 0.85, 0.26));
    lights.push(head(0.83, 0.85, -0.4, 0.12), tail(-0.82, 0.75, -0.4), tail(-0.92, 0.6, 0.6));
    return { body, lights, front: 0.85, rear: -0.95 };
  }
  if (kind === "jeepney") {
    // the jeepney: long white-and-chrome body painted with stripes, a visor over the windshield with a route
    // sign, a chrome grille and hood with the horse ornaments, open side windows and the back entrance step
    const L = 5.6, x0 = -2.9;
    const cx = x0 + (L - 1.3) / 2; // passenger body centre (the hood takes the front 1.3 m)
    const bodyL = L - 1.3;
    body.push({ size: [bodyL, 0.75, 1.8], pos: [cx, 0.8, 0], color });
    body.push({ size: [bodyL, 0.12, 1.82], pos: [cx, 0.55, 0], color: accent });
    body.push({ size: [bodyL, 0.07, 1.82], pos: [cx, 1.12, 0], color: "#e11d48" });
    body.push({ size: [bodyL, 0.07, 1.82], pos: [cx, 1.2, 0], color: "#2563eb" });
    // open windows: a dark band with posts
    body.push({ size: [bodyL - 0.2, 0.42, 1.78], pos: [cx, 1.45, 0], color: "#2b3138" });
    for (let i = 0; i < 6; i++) body.push({ size: [0.06, 0.42, 1.84], pos: [x0 + 0.15 + i * (bodyL - 0.3) / 5, 1.45, 0], color: chrome });
    body.push({ size: [bodyL, 0.1, 1.84], pos: [cx, 1.71, 0], color: color });
    // roof with a chrome rail and the visor reaching over the windshield
    body.push({ size: [bodyL + 0.3, 0.08, 1.9], pos: [cx + 0.15, 1.8, 0], color: chrome });
    body.push({ size: [0.5, 0.06, 1.95], pos: [x0 + bodyL + 0.4, 1.78, 0], rot: [0, 0, -0.18], color });
    body.push({ size: [0.06, 0.22, 1.2], pos: [x0 + bodyL + 0.05, 1.98, 0], color: "#f8fafc" }); // route sign
    // windshield, hood, grille, bumper, the two horses on the hood
    body.push({ size: [0.06, 0.55, 1.6], pos: [x0 + bodyL, 1.35, 0], color: glass });
    body.push({ size: [1.3, 0.5, 1.5], pos: [x0 + bodyL + 0.65, 0.78, 0], color: chrome });
    body.push({ size: [1.25, 0.06, 1.45], pos: [x0 + bodyL + 0.65, 1.05, 0], color });
    body.push({ size: [0.06, 0.4, 1.2], pos: [x0 + L + 0.02, 0.75, 0], color: "#9ca3af" });
    body.push({ size: [0.14, 0.14, 1.9], pos: [x0 + L + 0.1, 0.42, 0], color: chrome });
    for (const z of [-0.45, 0.45]) body.push({ size: [0.24, 0.26, 0.06], pos: [x0 + L - 0.25, 1.22, z], color: chrome });
    for (const z of [-1.0, 1.0]) body.push({ size: [0.04, 0.22, 0.14], pos: [x0 + bodyL + 0.2, 1.4, z], color: dark }); // mirrors
    // back: entrance step and the rail
    body.push({ size: [0.35, 0.08, 1.2], pos: [x0 - 0.12, 0.42, 0], color: chrome });
    body.push({ size: [0.05, 0.9, 0.05], pos: [x0 - 0.02, 1.25, 0.6], color: chrome });
    body.push(wheel(x0 + L - 0.75, -0.82), wheel(x0 + L - 0.75, 0.82), wheel(x0 + 0.9, -0.82), wheel(x0 + 0.9, 0.82));
    lights.push(head(x0 + L + 0.05, 0.78, -0.62), head(x0 + L + 0.05, 0.78, 0.62), tail(x0 - 0.02, 0.75, -0.8), tail(x0 - 0.02, 0.75, 0.8));
    lights.push({ size: [0.05, 0.05, 1.5], pos: [x0 + bodyL + 0.62, 1.74, 0], color: HEAD }); // visor marker lights
    return { body, lights, front: x0 + L + 0.1, rear: x0 - 0.1 };
  }
  const L = kind === "van" ? 4.6 : kind === "hatch" ? 3.7 : kind === "suv" ? 4.5 : 4.3;
  const W = kind === "van" || kind === "suv" ? 1.85 : 1.75;
  const lowH = kind === "van" ? 1.0 : kind === "suv" ? 0.8 : 0.6;
  body.push({ size: [L, lowH, W], pos: [0, 0.3 + lowH / 2, 0], color });
  if (kind === "van") {
    body.push({ size: [L - 0.9, 0.9, W - 0.06], pos: [-0.45, 0.3 + lowH + 0.45, 0], color });
    body.push({ size: [0.06, 0.7, W - 0.2], pos: [L / 2 - 0.92, 0.3 + lowH + 0.45, 0], color: glass });
    body.push({ size: [L - 1.4, 0.5, W - 0.02], pos: [-0.7, 0.3 + lowH + 0.5, 0], color: glass });
  } else {
    const cabin = kind === "hatch" ? 2.1 : kind === "suv" ? 2.6 : 2.2;
    const cabinX = kind === "hatch" ? -0.45 : kind === "suv" ? -0.4 : -0.2;
    const cabinH = kind === "suv" ? 0.62 : 0.5;
    body.push({ size: [cabin, cabinH, W - 0.16], pos: [cabinX, 0.3 + lowH + cabinH / 2, 0], color: glass });
    body.push({ size: [cabin - 0.2, 0.05, W - 0.2], pos: [cabinX, 0.3 + lowH + cabinH + 0.02, 0], color });
  }
  const wx = L / 2 - 0.75;
  body.push(wheel(wx, -W / 2 + 0.05), wheel(wx, W / 2 - 0.05), wheel(-wx, -W / 2 + 0.05), wheel(-wx, W / 2 - 0.05));
  const ly = 0.3 + lowH * 0.65;
  lights.push(head(L / 2 + 0.01, ly, -W / 2 + 0.28), head(L / 2 + 0.01, ly, W / 2 - 0.28), tail(-L / 2 - 0.01, ly, -W / 2 + 0.25), tail(-L / 2 - 0.01, ly, W / 2 - 0.25));
  return { body, lights, front: L / 2, rear: -L / 2 };
}

/** Each road's lane: where it runs, which way, how fast, and the stretch it loops over (wider than the view). */
const ROADS: Record<Road, { z: number; dir: 1 | -1; speed: number; x0: number; x1: number }> = {
  near: { z: LANE.near, dir: 1, speed: 4.4, x0: -75, x1: 95 },
  far: { z: LANE.far, dir: -1, speed: 3.7, x0: -75, x1: 95 },
  back0: { z: BACK_LANE[0], dir: 1, speed: 2.4, x0: -50, x1: 70 },
  back1: { z: BACK_LANE[1], dir: -1, speed: 2.1, x0: -50, x1: 70 },
};

const FULL: readonly Spec[] = [
  { kind: "jeepney", color: "#f3f0e6", accent: "#f59e0b", road: "near", offset: 0 },
  { kind: "tricycle", color: "#0284c7", accent: "#f8fafc", road: "near", offset: 24 },
  { kind: "sedan", color: "#e5e7eb", road: "near", offset: 52 },
  { kind: "tricycle", color: "#dc2626", accent: "#facc15", road: "near", offset: 78 },
  { kind: "jeepney", color: "#e0f2fe", accent: "#16a34a", road: "near", offset: 106 },
  { kind: "van", color: "#f8fafc", road: "near", offset: 140 },
  { kind: "jeepney", color: "#fef3c7", accent: "#dc2626", road: "far", offset: 10 },
  { kind: "tricycle", color: "#16a34a", accent: "#f8fafc", road: "far", offset: 40 },
  { kind: "suv", color: "#9ca3af", road: "far", offset: 66 },
  { kind: "moto", color: "#b91c1c", accent: "#1d4ed8", road: "far", offset: 92 },
  { kind: "tricycle", color: "#7c3aed", accent: "#fde68a", road: "far", offset: 118 },
  { kind: "hatch", color: "#dc2626", road: "far", offset: 146 },
  { kind: "tricycle", color: "#f59e0b", accent: "#1f2937", road: "back0", offset: 0 },
  { kind: "moto", color: "#111827", accent: "#ef4444", road: "back0", offset: 60 },
  { kind: "tricycle", color: "#0891b2", accent: "#f8fafc", road: "back1", offset: 30 },
];

type Mats = { body: THREE.Material; lights: THREE.Material; glow: THREE.Material };

function Vehicle({ spec, mats, glowGeo }: { spec: Spec; mats: Mats; glowGeo: (front: number, small: boolean) => THREE.BufferGeometry | null }) {
  const ref = useRef<THREE.Group>(null);
  const built = useMemo(() => {
    const v = vehicle(spec.kind, spec.color, spec.accent);
    return { body: mergeParts(v.body), lights: mergeParts(v.lights), glow: glowGeo(v.front, spec.kind === "moto" || spec.kind === "tricycle") };
  }, [spec, glowGeo]);
  const road = ROADS[spec.road];
  const span = road.x1 - road.x0;

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const along = (clock.elapsedTime * road.speed + spec.offset) % span;
    g.position.set(road.dir > 0 ? road.x0 + along : road.x1 - along, 0, road.z);
  });

  return (
    <group ref={ref} rotation={[0, road.dir > 0 ? 0 : Math.PI, 0]} position={[0, 0, road.z]}>
      {built.body && <mesh geometry={built.body} material={mats.body} />}
      {built.lights && <mesh geometry={built.lights} material={mats.lights} />}
      {built.glow && <mesh geometry={built.glow} material={mats.glow} />}
    </group>
  );
}

export function Traffic() {
  const lowPower = useOffice((s) => s.lowPower);
  const specs = useMemo(() => (lowPower ? FULL.filter((_, i) => i % 2 === 0) : FULL), [lowPower]);
  const glow = useMemo(() => getGlowTexture(), []);
  const mats = useMemo<Mats>(() => ({
    body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 }),
    // head and tail lenses in one mesh: vertex colours, scaled brighter as it gets dark
    lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    glow: new THREE.MeshBasicMaterial({ map: glow, color: "#ffe6b8", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }),
  }), [glow]);
  /** Headlight pool on the road ahead, plus a soft flare at the lamps. */
  const glowGeo = useMemo(() => {
    const cache = new Map<number, THREE.BufferGeometry | null>();
    const pool = new THREE.PlaneGeometry(1, 1);
    return (front: number, small: boolean) => {
      const key = front + (small ? 1000 : 0);
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const k = small ? 0.6 : 1;
      const g = mergePlaced([
        { geometry: pool, matrix: placed([front + 3.0 * k, 0.02, small ? -0.4 : 0], [-Math.PI / 2, 0, 0], [6.0 * k, 3.0 * k, 1]) },
        { geometry: pool, matrix: placed([front + 0.15, 0.7, small ? -0.4 : 0], [-0.62, Math.PI / 4, 0], [2.0 * k, 1.2 * k, 1]) },
      ]);
      cache.set(key, g);
      return g;
    };
  }, []);

  useFrame(() => {
    const k = streetLightLevel();
    // lenses read as lit by day too (they're bright plastic), and blaze at night
    (mats.lights as THREE.MeshBasicMaterial).color.setScalar(0.75 + k * 1.6);
    (mats.glow as THREE.MeshBasicMaterial).opacity = k * 0.85;
  });

  return (
    <group>
      {specs.map((s, i) => <Vehicle key={`${s.kind}${i}`} spec={s} mats={mats} glowGeo={glowGeo} />)}
    </group>
  );
}
