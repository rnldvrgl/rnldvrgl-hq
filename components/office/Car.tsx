"use client";

import { Suspense, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import { SCENE_FONT } from "./palette";
import { create } from "zustand";
import { CarFront, KeyRound, Lightbulb, Lock, Power, X } from "lucide-react";
import { getGlowTexture, light } from "./Lighting";
import { Label } from "./Labels";
import { cn } from "@/lib/utils";
import { HQ, OWNERS } from "@/hq.config";
import { carSound } from "@/lib/ambience";
import { sceneNow } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { carModelOf, useSettings, workHours, type CarModel } from "@/lib/settings";
import { PARKING } from "./palette";
import { bossDay, carPoseOf, type BossDay } from "./bossCommute";
import { overrideAt } from "./commuteOverride";

export { PARKING } from "./palette";

const RED = "#d0121e";
const GLASS = "#18222c";
const TRIM = "#15191d";

/* ------------------------------------------------------------------ the models */

/**
 * The boss's car, one of six (Settings → Boss → Car). Every model faces −z in its own frame, wheels on the
 * ground. `cabin` is the glasshouse's side profile, [along the length (negative = toward the front), height],
 * extruded across the car `inset` narrower than the body; `roof` is a painted slab over part of it.
 */
type Spec = {
  name: string;
  length: number; width: number;
  paint: string; roofPaint?: string; accent: string;
  /** Lower body: its height and the height of its centre. */
  bodyH: number; bodyY: number;
  cabin: readonly (readonly [number, number])[];
  inset: number;
  roof?: { y: number; z0: number; z1: number };
  wheelR: number; axles: readonly [number, number];
  /** Heights of the head- and tail-lights. */
  headY: number; tailY: number;
  rails?: boolean; bed?: boolean; ducktail?: boolean; lightbar?: boolean;
};

export const CARS: Record<CarModel, Spec> = {
  typer: {
    name: "Civic Type R", length: 4.5, width: 1.78, paint: "#f1f1ec", accent: RED, bodyH: 0.48, bodyY: 0.51,
    cabin: [[-0.95, 0.74], [-0.3, 1.2], [0.5, 1.21], [1.15, 1.12], [1.7, 0.8], [1.7, 0.74]], inset: 0.3,
    roof: { y: 1.235, z0: -0.23, z1: 0.47 }, wheelR: 0.33, axles: [-1.42, 1.4], headY: 0.64, tailY: 0.7,
  },
  mini: {
    name: "Pink Mini", length: 3.85, width: 1.72, paint: "#f4a7b9", roofPaint: "#fafafa", accent: "#fafafa", bodyH: 0.56, bodyY: 0.56,
    cabin: [[-0.62, 0.84], [-0.2, 1.36], [1.5, 1.38], [1.74, 0.84]], inset: 0.22,
    roof: { y: 1.4, z0: -0.25, z1: 1.6 }, wheelR: 0.29, axles: [-1.25, 1.25], headY: 0.7, tailY: 0.72,
  },
  suv: {
    name: "Seven-seater SUV", length: 4.8, width: 1.9, paint: "#121518", accent: "#9ca3af", bodyH: 0.74, bodyY: 0.76,
    cabin: [[-0.9, 1.13], [-0.25, 1.76], [2.2, 1.78], [2.36, 1.13]], inset: 0.18,
    roof: { y: 1.8, z0: -0.2, z1: 2.25 }, wheelR: 0.38, axles: [-1.5, 1.45], headY: 0.95, tailY: 1.0, rails: true,
  },
  pickup: {
    name: "Double-cab pickup", length: 5.3, width: 1.86, paint: "#6b7280", accent: "#111827", bodyH: 0.7, bodyY: 0.76,
    cabin: [[-1.1, 1.1], [-0.5, 1.72], [0.78, 1.73], [0.88, 1.1]], inset: 0.16,
    roof: { y: 1.75, z0: -0.45, z1: 0.8 }, wheelR: 0.39, axles: [-1.65, 1.6], headY: 0.95, tailY: 0.95, bed: true,
  },
  sports: {
    name: "Sports coupé", length: 4.5, width: 1.95, paint: "#dc2626", accent: "#111827", bodyH: 0.42, bodyY: 0.43,
    cabin: [[-0.55, 0.63], [0.05, 1.08], [0.7, 1.1], [1.75, 0.68], [1.8, 0.63]], inset: 0.36,
    wheelR: 0.33, axles: [-1.4, 1.35], headY: 0.5, tailY: 0.56, ducktail: true,
  },
  ev: {
    name: "Electric saloon", length: 4.7, width: 1.88, paint: "#eef1f4", accent: "#1f2937", bodyH: 0.55, bodyY: 0.56,
    cabin: [[-1.0, 0.83], [-0.2, 1.42], [0.9, 1.44], [2.2, 0.96], [2.3, 0.83]], inset: 0.26,
    wheelR: 0.34, axles: [-1.45, 1.45], headY: 0.68, tailY: 0.78, lightbar: true,
  },
};

/** One wheel: tyre, rim and hub, turned so it rolls along the car's length. */
function Wheel({ position, r, shadows, caliper }: { position: [number, number, number]; r: number; shadows: boolean; caliper?: string }) {
  const side = Math.sign(position[0]);
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow={shadows}>
        <cylinderGeometry args={[r, r, 0.24, 22]} />
        <meshStandardMaterial color="#111417" roughness={0.9} />
      </mesh>
      <mesh position={[0, side * 0.121, 0]}>
        <cylinderGeometry args={[r * 0.72, r * 0.72, 0.01, 22]} />
        <meshStandardMaterial color="#1e2226" metalness={0.5} roughness={0.55} />
      </mesh>
      {caliper && (
        <mesh position={[0.09, side * 0.1, -0.08]}>
          <boxGeometry args={[0.12, 0.03, 0.16]} />
          <meshStandardMaterial color={caliper} />
        </mesh>
      )}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, side * 0.126, 0]} rotation={[0, (i / 5) * Math.PI * 2, 0]}>
          <boxGeometry args={[0.035, 0.006, r * 1.2]} />
          <meshStandardMaterial color="#0d0f11" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** The lights every model has: what the frame loop animates. */
type Rig = {
  heads: MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
  hazards: MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
  tail: MutableRefObject<THREE.MeshStandardMaterial | null>;
  beams: MutableRefObject<THREE.Group | null>;
  exhaust: MutableRefObject<THREE.Group | null>;
};

/** Headlights and their beams, tail light bar, hazards, exhaust and plate, sized to the model. */
function Lights({ spec, rig, glow }: { spec: Spec; rig: Rig; glow: THREE.Texture }) {
  const L = spec.length, W = spec.width;
  return (
    <>
      {[-1, 1].map((s, i) => (
        <mesh key={s} position={[s * (W / 2 - 0.27), spec.headY, -L / 2 + 0.01]}>
          <boxGeometry args={[spec.lightbar ? 0.5 : 0.38, 0.06, 0.04]} />
          <meshStandardMaterial ref={(m) => { rig.heads.current[i] = m; }} color="#e8eef5" emissive="#eef4ff" emissiveIntensity={0.25} toneMapped={false} />
        </mesh>
      ))}
      {spec.lightbar && (
        <mesh position={[0, spec.headY + 0.02, -L / 2 + 0.005]}>
          <boxGeometry args={[W - 0.5, 0.025, 0.03]} />
          <meshStandardMaterial ref={(m) => { rig.heads.current[2] = m; }} color="#e8eef5" emissive="#eef4ff" emissiveIntensity={0.25} toneMapped={false} />
        </mesh>
      )}
      <group ref={rig.beams} visible={false}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (W / 2 - 0.27), spec.headY - 0.13, -L / 2 - 1.1]} rotation={[Math.PI / 2 - 0.12, 0, 0]}>
            <coneGeometry args={[0.6, 2.2, 20, 1, true]} />
            <meshBasicMaterial color="#fff6dc" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.012, -L / 2 - 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.6, 2.4]} />
          <meshBasicMaterial map={glow} color="#fff1c8" transparent opacity={0.65} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      </group>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (W / 2 - 0.08), (spec.headY + spec.tailY) / 2 - 0.05, sz * (L / 2 + 0.005)]}>
          <boxGeometry args={[0.12, 0.05, 0.03]} />
          <meshStandardMaterial ref={(m) => { rig.hazards.current[i] = m; }} color="#7c4a03" emissive="#ffae00" emissiveIntensity={0} toneMapped={false} />
        </mesh>
      ))}
      <group ref={rig.exhaust} visible={false} position={[0, 0.3, L / 2 + 0.12]}>
        {[0, 1, 2, 3, 4].map((j) => (
          <mesh key={j}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#c9ced4" transparent opacity={0.4} depthWrite={false} roughness={1} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, spec.tailY, L / 2 + 0.005]}>
        <boxGeometry args={[W - 0.23, 0.06, 0.04]} />
        <meshStandardMaterial ref={rig.tail} color="#7a0a12" emissive="#ff2a3a" emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      <group position={[0, spec.tailY - 0.2, L / 2 + 0.03]}>
        <mesh>
          <boxGeometry args={[0.52, 0.14, 0.01]} />
          <meshStandardMaterial color="#f4f5f2" />
        </mesh>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0, 0.008]} fontSize={0.075} color="#1b2733" anchorX="center" anchorY="middle" letterSpacing={0.08}>
            {HQ.car.plate}
          </Text>
        </Suspense>
      </group>
    </>
  );
}

/** The body of any model: lower body, glasshouse, painted roof and pillars, grille, mirrors, wheels, and its extras. */
function Body({ spec, shadows }: { spec: Spec; shadows: boolean }) {
  const L = spec.length, W = spec.width;
  const cabin = useMemo(() => {
    const shape = new THREE.Shape();
    spec.cabin.forEach(([l, h], i) => (i ? shape.lineTo(l, h) : shape.moveTo(l, h)));
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: W - spec.inset, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  }, [spec, W]);
  const paint = <meshStandardMaterial color={spec.paint} metalness={0.15} roughness={0.28} />;
  const top = spec.bodyY + spec.bodyH / 2;
  const typeR = spec === CARS.typer;
  return (
    <>
      <RoundedBox args={[W, spec.bodyH, L]} radius={Math.min(0.16, spec.bodyH / 3)} smoothness={3} position={[0, spec.bodyY, 0]} castShadow={shadows} receiveShadow={shadows}>
        {paint}
      </RoundedBox>
      <mesh geometry={cabin} position={[(W - spec.inset) / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow={shadows}>
        <meshStandardMaterial color={GLASS} metalness={0.6} roughness={0.12} />
      </mesh>
      {spec.roof && (
        <RoundedBox args={[W - spec.inset - 0.15, 0.06, spec.roof.z1 - spec.roof.z0]} radius={0.02} smoothness={2} position={[0, spec.roof.y, (spec.roof.z0 + spec.roof.z1) / 2]}>
          <meshStandardMaterial color={spec.roofPaint ?? spec.paint} metalness={0.15} roughness={0.3} />
        </RoundedBox>
      )}
      {/* B-pillars */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * ((W - spec.inset) / 2 + 0.045), (top + (spec.roof?.y ?? top + 0.4)) / 2, (spec.roof ? (spec.roof.z0 + spec.roof.z1) / 2 : 0.35)]}>
          <boxGeometry args={[0.02, Math.max(0.1, (spec.roof?.y ?? top + 0.4) - top - 0.05), 0.08]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
      ))}
      {/* grille, bumpers, side skirts */}
      <mesh position={[0, spec.headY - 0.16, -L / 2 - 0.005]}>
        <boxGeometry args={[W - 0.5, 0.14, 0.04]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      <mesh position={[0, spec.bodyY - spec.bodyH / 2 + 0.06, L / 2 + 0.02]}>
        <boxGeometry args={[W - 0.4, 0.1, 0.05]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (W / 2 + 0.01), spec.bodyY - spec.bodyH / 2 + 0.06, 0]}>
            <boxGeometry args={[0.05, 0.08, L - spec.wheelR * 4]} />
            <meshStandardMaterial color={TRIM} />
          </mesh>
          <mesh position={[s * (W / 2 + 0.06), top + 0.1, spec.cabin[0][0] + 0.25]} castShadow={shadows}>
            <boxGeometry args={[0.14, 0.09, 0.16]} />
            <meshStandardMaterial color={spec.roofPaint ?? spec.paint} metalness={0.15} roughness={0.28} />
          </mesh>
          {[-0.25, 0.75].map((z) => (
            <mesh key={z} position={[s * (W / 2 + 0.005), top - 0.1, z]}>
              <boxGeometry args={[0.01, 0.03, 0.16]} />
              <meshStandardMaterial color={TRIM} />
            </mesh>
          ))}
        </group>
      ))}

      {typeR && <TypeRKit spec={spec} shadows={shadows} />}
      {spec === CARS.mini && (
        // twin bonnet stripes and chrome round headlamp rings
        [-0.18, 0.18].map((x) => (
          <mesh key={x} position={[x, top + 0.005, -L / 2 + 0.55]}>
            <boxGeometry args={[0.12, 0.01, 1.0]} />
            <meshStandardMaterial color="#fafafa" />
          </mesh>
        ))
      )}
      {spec.rails && [-1, 1].map((s) => (
        <mesh key={s} position={[s * ((W - spec.inset) / 2 - 0.12), spec.roof!.y + 0.07, (spec.roof!.z0 + spec.roof!.z1) / 2]}>
          <boxGeometry args={[0.05, 0.05, spec.roof!.z1 - spec.roof!.z0]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {spec.bed && (
        // the open bed behind the cab: side walls, tailgate, a roll bar
        <group>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (W / 2 - 0.05), top + 0.22, 1.75]}>
              <boxGeometry args={[0.08, 0.44, 1.7]} />
              {paint}
            </mesh>
          ))}
          <mesh position={[0, top + 0.22, L / 2 - 0.05]}>
            <boxGeometry args={[W - 0.1, 0.44, 0.08]} />
            {paint}
          </mesh>
          <mesh position={[0, top + 0.01, 1.75]}>
            <boxGeometry args={[W - 0.2, 0.02, 1.7]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, top + 0.55, 1.0]}>
            <boxGeometry args={[W - 0.2, 0.06, 0.06]} />
            <meshStandardMaterial color="#111827" metalness={0.5} />
          </mesh>
        </group>
      )}
      {spec.ducktail && (
        <mesh position={[0, top + 0.06, L / 2 - 0.22]} rotation={[-0.25, 0, 0]}>
          <boxGeometry args={[W - 0.3, 0.04, 0.3]} />
          {paint}
        </mesh>
      )}

      {([[-1, spec.axles[0]], [1, spec.axles[0]], [-1, spec.axles[1]], [1, spec.axles[1]]] as const).map(([s, z], i) => (
        <Wheel key={i} position={[s * (W / 2 - 0.08), spec.wheelR, z]} r={spec.wheelR} shadows={shadows} caliper={typeR ? RED : undefined} />
      ))}
    </>
  );
}

/** The Type R's kit: front lip with a red line, red pinstriped skirts, hood vent, triple exhaust, the wing, the badge. */
function TypeRKit({ spec, shadows }: { spec: Spec; shadows: boolean }) {
  const L = spec.length, W = spec.width;
  return (
    <>
      <mesh position={[0, 0.27, -L / 2 + 0.05]}>
        <boxGeometry args={[W - 0.05, 0.05, 0.2]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      <mesh position={[0, 0.275, -L / 2 - 0.02]}>
        <boxGeometry args={[W - 0.25, 0.012, 0.02]} />
        <meshStandardMaterial color={RED} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 + 0.037), 0.33, 0]}>
          <boxGeometry args={[0.004, 0.012, L - 1.4]} />
          <meshStandardMaterial color={RED} />
        </mesh>
      ))}
      <mesh position={[0, 0.785, -1.35]}>
        <boxGeometry args={[0.5, 0.03, 0.32]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      {[-0.13, 0, 0.13].map((x) => (
        <mesh key={x} position={[x, 0.3, L / 2 + 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[x === 0 ? 0.045 : 0.055, x === 0 ? 0.045 : 0.055, 0.06, 14]} />
          <meshStandardMaterial color="#9aa1a7" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.93, L / 2 - 0.3]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.05, 0.24, 0.1]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
      ))}
      <RoundedBox args={[W - 0.12, 0.035, 0.3]} radius={0.012} smoothness={2} position={[0, 1.06, L / 2 - 0.25]} rotation={[-0.08, 0, 0]} castShadow={shadows}>
        <meshStandardMaterial color={TRIM} roughness={0.5} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.08), 1.05, L / 2 - 0.25]}>
          <boxGeometry args={[0.02, 0.1, 0.32]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        <Text font={SCENE_FONT} position={[0.5, 0.84, L / 2 - 0.02]} rotation={[0.06, 0, 0]} fontSize={0.065} color={RED} anchorX="center" anchorY="middle" letterSpacing={0.18}>
          {HQ.car.badge}
        </Text>
      </Suspense>
    </>
  );
}

/* ------------------------------------------------------------------ the car */

/** The boss's day as far as the car's concerned (off with Settings → Daily routine → Commute). */
function dayNow(): BossDay {
  const { routine } = useSettings.getState();
  const now = sceneNow();
  const manual = overrideAt("owner", now.getTime());
  return routine.commute || manual ? bossDay(manilaMinutes(now), workHours("boss"), manual) : { kind: "office" };
}

/**
 * The boss's car. By day it's parked in the carport, front facing −z (toward the building's side), so the
 * default view sees its right side and the rear lights; tap it to work the lights and engine. At the boss's
 * go-home time it drives them home to the garage (bossCommute.ts), and back in the morning: engine on,
 * headlights on after dark, exhaust while it runs.
 */
export function Car({ shadows }: { shadows: boolean }) {
  const model = useSettings((s) => carModelOf(s.boss));
  const spec = CARS[model];
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const rig: Rig = {
    heads: useRef<(THREE.MeshStandardMaterial | null)[]>([]),
    hazards: useRef<(THREE.MeshStandardMaterial | null)[]>([]),
    tail: useRef<THREE.MeshStandardMaterial | null>(null),
    beams: useRef<THREE.Group | null>(null),
    exhaust: useRef<THREE.Group | null>(null),
  };
  const glow = useMemo(() => getGlowTexture(), []);
  const toggle = useCar((st) => st.toggle);
  const wasRunning = useRef<boolean | null>(null);

  useFrame(({ clock }) => {
    const day = dayNow();
    const pose = carPoseOf(day);
    const g = root.current;
    if (g) { g.position.set(pose.x, 0, pose.z); g.rotation.y = pose.heading; }
    const st = useCar.getState();
    if (day.kind !== "office" && day.kind !== "walk" && st.open) st.close();
    // the commute's engine: start and stop sounds on the change (not on the first frame)
    if (wasRunning.current !== null && wasRunning.current !== pose.engine) carSound(pose.engine ? "start" : "stop");
    wasRunning.current = pose.engine;

    const engine = st.engine || pose.engine;
    const dark = light.lamps > 0.5 || light.night > 0.4 || light.cloud > 0.85;
    const on = st.lights === "on" || (st.lights === "auto" && (dark || engine));
    const since = performance.now() / 1000 - st.flashAt;
    const flash = since >= 0 && since < 1.6 && Math.floor(since / 0.4) % 2 === 0;
    rig.heads.current.forEach((m) => { if (m) m.emissiveIntensity = on ? 2.2 : flash ? 1.6 : engine ? 0.9 : 0.25; });
    rig.hazards.current.forEach((m) => { if (m) m.emissiveIntensity = flash ? 2.4 : 0; });
    if (rig.beams.current) rig.beams.current.visible = on;
    if (rig.tail.current) rig.tail.current.emissiveIntensity = (engine || on ? 1.3 : 0.35) + light.lamps * 0.6 + (pose.reversing ? 0.8 : 0);
    if (body.current) body.current.position.y = engine && !pose.moving ? Math.sin(clock.elapsedTime * 38) * 0.004 : 0;
    const ex = rig.exhaust.current;
    if (ex) {
      ex.visible = engine && model !== "ev";
      if (ex.visible) ex.children.forEach((c, j) => {
        const e = (clock.elapsedTime * 0.7 + j / 5) % 1;
        c.position.set(Math.sin(j * 1.7) * 0.06, e * 0.35, e * 0.6);
        c.scale.setScalar(0.04 + e * 0.16);
        const mat = c instanceof THREE.Mesh ? c.material : null;
        if (mat instanceof THREE.MeshStandardMaterial) mat.opacity = 0.4 * (1 - e);
      });
    }
  });

  return (
    <>
      {/* the carport bay's lines stay put when the car's out */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[PARKING.x + s * (1.78 / 2 + 0.25), 0.004, PARKING.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 4.5 + 0.6]} />
          <meshBasicMaterial color="#f1f2ee" />
        </mesh>
      ))}
      <group
        ref={root}
        position={[PARKING.x, 0, PARKING.z]}
        onClick={(e) => { e.stopPropagation(); if (e.delta <= 6 && dayNow().kind !== "car") toggle(); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = ""; }}
      >
        <CarPanel name={spec.name} />
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, spec.length / spec.width, 1]}>
          <circleGeometry args={[spec.width / 2 + 0.1, 32]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
        </mesh>
        <group ref={body} key={model}>
          <Body spec={spec} shadows={shadows} />
          <Lights spec={spec} rig={rig} glow={glow} />
        </group>
      </group>
    </>
  );
}

/* ------------------------------------------------------------------ interaction */

type Lights = "auto" | "on" | "off";
type CarState = {
  open: boolean;
  lights: Lights;
  engine: boolean;
  /** Clock time (s) of the last lock, for the hazard blink. */
  flashAt: number;
  toggle: () => void;
  close: () => void;
  setLights: (l: Lights) => void;
  setEngine: (on: boolean) => void;
  lock: () => void;
};

const now = () => performance.now() / 1000;
// The lock blink is timed with performance.now() (seconds), both here and in the frame loop.
export const useCar = create<CarState>((set) => ({
  open: false,
  lights: "auto",
  engine: false,
  flashAt: -10,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
  setLights: (lights) => { carSound("lights"); set({ lights }); },
  setEngine: (engine) => set((s) => {
    if (engine !== s.engine) carSound(engine ? "start" : "stop");
    return { engine };
  }),
  lock: () => { carSound("lock"); set({ engine: false, flashAt: now() }); },
}));

/** The card over the car (in the label layer): headlights, engine, lock. */
function CarPanel({ name }: { name: string }) {
  const open = useCar((s) => s.open);
  if (!open) return null;
  return <Label id="car" position={[0, 1.9, 0]} spec={{ layer: 30, interactive: true, render: () => <CarCard name={name} /> }} />;
}

function CarCard({ name }: { name: string }) {
  const { lights, engine, setLights, setEngine, lock, close } = useCar();
  const seg = (l: Lights, label: string) => (
    <button
      type="button"
      onClick={() => setLights(l)}
      aria-pressed={lights === l}
      className={cn("rounded-md px-2 py-1 text-[11px] font-medium transition-colors", lights === l ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}
    >
      {label}
    </button>
  );
  return (
    <div
      className="mb-2 w-60 rounded-2xl border border-white/40 bg-popover/95 p-3 text-card-foreground shadow-xl backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-red-500/15 text-red-600"><CarFront className="size-4" aria-hidden /></span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-[11px] text-muted-foreground">{OWNERS} car · {engine ? "engine running" : "parked"}</p>
          </div>
        </div>
        <button type="button" onClick={close} aria-label="Close" className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted">
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs"><Lightbulb className="size-3.5" aria-hidden /> Headlights</span>
        <span className="flex rounded-lg bg-muted/70 p-0.5">{seg("auto", "Auto")}{seg("on", "On")}{seg("off", "Off")}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setEngine(!engine)}
          className={cn("flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors",
            engine ? "bg-red-600 text-white hover:bg-red-700" : "bg-foreground text-background hover:opacity-90")}
        >
          {engine ? <Power className="size-3.5" aria-hidden /> : <KeyRound className="size-3.5" aria-hidden />}
          {engine ? "Stop engine" : "Start engine"}
        </button>
        <button type="button" onClick={lock} className="flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold hover:bg-muted">
          <Lock className="size-3.5" aria-hidden /> Lock
        </button>
      </div>
    </div>
  );
}
