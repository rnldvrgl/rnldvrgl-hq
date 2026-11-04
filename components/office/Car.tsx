"use client";

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import { OUTSIDE, SCENE_FONT } from "./palette";
import { create } from "zustand";
import { CarFront, KeyRound, Lightbulb, Lock, Power, X } from "lucide-react";
import { getGlowTexture, light } from "./Lighting";
import { Label } from "./Labels";
import { cn } from "@/lib/utils";
import { HQ, OWNERS } from "@/hq.config";
import { carSound } from "@/lib/ambience";

/** Where the car is parked: along the pavement, nose toward the building's side. */
export const PARKING = { x: OUTSIDE.x0 + 1.95, z: OUTSIDE.z1 - 2.45 } as const;

const PAINT = "#f1f1ec"; // Championship White
const RED = "#d0121e";
const GLASS = "#18222c";
const TRIM = "#15191d";
const LENGTH = 4.5, WIDTH = 1.78;
/** The cabin is this much narrower than the body (the shoulders show around it). */
const CABIN_INSET = 0.3;

/** One wheel: tyre, alloy rim and hub, turned so it rolls along the car's length. */
function Wheel({ position, shadows }: { position: [number, number, number]; shadows: boolean }) {
  const side = Math.sign(position[0]);
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow={shadows}>
        <cylinderGeometry args={[0.33, 0.33, 0.24, 22]} />
        <meshStandardMaterial color="#111417" roughness={0.9} />
      </mesh>
      <mesh position={[0, side * 0.121, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.01, 22]} />
        <meshStandardMaterial color="#1e2226" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* red Brembo-style caliper peeking through the spokes */}
      <mesh position={[0.09, side * 0.1, -0.08]}>
        <boxGeometry args={[0.12, 0.03, 0.16]} />
        <meshStandardMaterial color={RED} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, side * 0.126, 0]} rotation={[0, (i / 5) * Math.PI * 2, 0]}>
          <boxGeometry args={[0.035, 0.006, 0.4]} />
          <meshStandardMaterial color="#0d0f11" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A white Civic Type R parked outside (no maker logo): low fastback body with a black front lip and side skirts,
 * hood vent, the big rear wing, three centre exhausts, red calipers and badge.
 * Parked outside. Parked with the front facing -z (toward the side of the building),
 * so from the default view you see its right side and the rear lights. Headlights are off; the light bar
 * glows faintly at night like a parked car's reflectors.
 */
export function Car({ shadows }: { shadows: boolean }) {
  const tail = useRef<THREE.MeshStandardMaterial>(null);
  const cabin = useMemo(() => {
    // side profile in (length, height); negative length = toward the front (-z)
    const shape = new THREE.Shape();
    shape.moveTo(-0.95, 0.74);
    shape.lineTo(-0.3, 1.2);
    shape.lineTo(0.5, 1.21);
    shape.quadraticCurveTo(1.15, 1.12, 1.7, 0.8);
    shape.lineTo(1.7, 0.74);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: WIDTH - CABIN_INSET, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  }, []);
  const heads = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const hazards = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const beams = useRef<THREE.Group>(null);
  const exhaust = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const glow = useMemo(() => getGlowTexture(), []);
  const toggle = useCar((st) => st.toggle);

  useFrame(({ clock }) => {
    const { lights, engine, flashAt } = useCar.getState();
    const dark = light.lamps > 0.5 || light.night > 0.4 || light.cloud > 0.85;
    const on = lights === "on" || (lights === "auto" && (dark || engine));
    // lock flash: hazards (and headlights) blink twice
    const since = performance.now() / 1000 - flashAt;
    const flash = since >= 0 && since < 1.6 && Math.floor(since / 0.4) % 2 === 0;
    heads.current.forEach((m) => { if (m) m.emissiveIntensity = on ? 2.2 : flash ? 1.6 : engine ? 0.9 : 0.25; });
    hazards.current.forEach((m) => { if (m) m.emissiveIntensity = flash ? 2.4 : 0; });
    if (beams.current) beams.current.visible = on;
    if (tail.current) tail.current.emissiveIntensity = (engine || on ? 1.3 : 0.35) + light.lamps * 0.6;
    // engine idle: a faint shake and exhaust puffs from the tailpipes
    if (body.current) body.current.position.y = engine ? Math.sin(clock.elapsedTime * 38) * 0.004 : 0;
    if (exhaust.current) {
      exhaust.current.visible = engine;
      if (engine) exhaust.current.children.forEach((c, j) => {
        const e = (clock.elapsedTime * 0.7 + j / 5) % 1;
        c.position.set(Math.sin(j * 1.7) * 0.06, e * 0.35, e * 0.6);
        c.scale.setScalar(0.04 + e * 0.16);
        const mat = c instanceof THREE.Mesh ? c.material : null;
        if (mat instanceof THREE.MeshStandardMaterial) mat.opacity = 0.4 * (1 - e);
      });
    }
  });

  return (
    <group
      position={[PARKING.x, 0, PARKING.z]}
      onClick={(e) => { e.stopPropagation(); if (e.delta <= 6) toggle(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <CarPanel />
      <group ref={body}>
      {/* parking bay lines and a soft contact shadow */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (WIDTH / 2 + 0.25), 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, LENGTH + 0.6]} />
          <meshBasicMaterial color="#f1f2ee" />
        </mesh>
      ))}
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, LENGTH / WIDTH, 1]}>
        <circleGeometry args={[WIDTH / 2 + 0.1, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {/* lower body: long and low */}
      <RoundedBox args={[WIDTH, 0.48, LENGTH]} radius={0.16} smoothness={3} position={[0, 0.51, 0]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial color={PAINT} metalness={0.12} roughness={0.28} />
      </RoundedBox>
      {/* greenhouse: raked windshield, short roof, long fastback, as one extruded side profile */}
      <mesh geometry={cabin} position={[(WIDTH - CABIN_INSET) / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow={shadows}>
        <meshStandardMaterial color={GLASS} metalness={0.6} roughness={0.12} />
      </mesh>
      {/* painted roof and A/C-pillar line over the glass */}
      <RoundedBox args={[WIDTH - 0.5, 0.05, 0.7]} radius={0.02} smoothness={2} position={[0, 1.235, 0.12]}>
        <meshStandardMaterial color={PAINT} metalness={0.12} roughness={0.28} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (WIDTH - CABIN_INSET) / 2 + s * 0.045, 0.97, 0.12]}>
          <boxGeometry args={[0.02, 0.36, 0.08]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
      ))}

      {/* front: black grille band and slim LED headlights */}
      <mesh position={[0, 0.48, -LENGTH / 2 - 0.005]}>
        <boxGeometry args={[1.3, 0.14, 0.04]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      {[-1, 1].map((s, i) => (
        <mesh key={s} position={[s * 0.62, 0.64, -LENGTH / 2 + 0.01]}>
          <boxGeometry args={[0.42, 0.06, 0.04]} />
          <meshStandardMaterial ref={(m) => { heads.current[i] = m; }} color="#e8eef5" emissive="#eef4ff" emissiveIntensity={0.25} toneMapped={false} />
        </mesh>
      ))}
      {/* headlight beams: soft cones and pools of light on the pavement ahead (no real lights, so it stays cheap) */}
      <group ref={beams} visible={false}>
        {[-1, 1].map((s) => (
          // the cone's tip (narrow end) sits at the headlight, its wide end 2.2 m ahead, dipping toward the road
          <mesh key={s} position={[s * 0.62, 0.51, -LENGTH / 2 - 1.1]} rotation={[Math.PI / 2 - 0.12, 0, 0]}>
            <coneGeometry args={[0.6, 2.2, 20, 1, true]} />
            <meshBasicMaterial color="#fff6dc" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.012, -LENGTH / 2 - 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.6, 2.4]} />
          <meshBasicMaterial map={glow} color="#fff1c8" transparent opacity={0.65} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      </group>
      {/* amber hazard lights at the four corners */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (WIDTH / 2 - 0.08), 0.6, sz * (LENGTH / 2 + 0.005)]}>
          <boxGeometry args={[0.12, 0.05, 0.03]} />
          <meshStandardMaterial ref={(m) => { hazards.current[i] = m; }} color="#7c4a03" emissive="#ffae00" emissiveIntensity={0} toneMapped={false} />
        </mesh>
      ))}
      {/* exhaust while the engine runs */}
      <group ref={exhaust} visible={false} position={[0, 0.3, LENGTH / 2 + 0.12]}>
        {[0, 1, 2, 3, 4].map((j) => (
          <mesh key={j}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#c9ced4" transparent opacity={0.4} depthWrite={false} roughness={1} />
          </mesh>
        ))}
      </group>

      {/* rear: full-width light bar, plate, bumper diffuser */}
      <mesh position={[0, 0.7, LENGTH / 2 + 0.005]}>
        <boxGeometry args={[1.55, 0.06, 0.04]} />
        <meshStandardMaterial ref={tail} color="#7a0a12" emissive="#ff2a3a" emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.3, LENGTH / 2 + 0.01]}>
        <boxGeometry args={[1.4, 0.1, 0.04]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      <group position={[0, 0.5, LENGTH / 2 + 0.03]}>
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
      <Suspense fallback={null}>
        <Text font={SCENE_FONT} position={[0.5, 0.84, LENGTH / 2 - 0.02]} rotation={[0.06, 0, 0]} fontSize={0.065} color={RED} anchorX="center" anchorY="middle" letterSpacing={0.18}>
          {HQ.car.badge}
        </Text>
      </Suspense>

      {/* side mirrors and door handles (both sides) */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (WIDTH / 2 + 0.06), 0.9, -0.72]} castShadow={shadows}>
            <boxGeometry args={[0.14, 0.09, 0.16]} />
            <meshStandardMaterial color={PAINT} metalness={0.12} roughness={0.28} />
          </mesh>
          {[-0.25, 0.85].map((z) => (
            <mesh key={z} position={[s * (WIDTH / 2 + 0.005), 0.66, z]}>
              <boxGeometry args={[0.01, 0.03, 0.16]} />
              <meshStandardMaterial color={TRIM} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Type R kit: front lip, side skirts with red pinstripe, hood vent, rear diffuser, triple exhaust, wing */}
      <mesh position={[0, 0.27, -LENGTH / 2 + 0.05]}>
        <boxGeometry args={[WIDTH - 0.05, 0.05, 0.2]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      <mesh position={[0, 0.275, -LENGTH / 2 - 0.02]}>
        <boxGeometry args={[WIDTH - 0.25, 0.012, 0.02]} />
        <meshStandardMaterial color={RED} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (WIDTH / 2 + 0.01), 0.3, 0]}>
            <boxGeometry args={[0.05, 0.08, LENGTH - 1.3]} />
            <meshStandardMaterial color={TRIM} />
          </mesh>
          <mesh position={[s * (WIDTH / 2 + 0.037), 0.33, 0]}>
            <boxGeometry args={[0.004, 0.012, LENGTH - 1.4]} />
            <meshStandardMaterial color={RED} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.785, -1.35]}>
        <boxGeometry args={[0.5, 0.03, 0.32]} />
        <meshStandardMaterial color={TRIM} />
      </mesh>
      <mesh position={[0, 0.3, LENGTH / 2 + 0.03]}>
        <boxGeometry args={[1.2, 0.08, 0.06]} />
        <meshStandardMaterial color="#0f1113" />
      </mesh>
      {[-0.13, 0, 0.13].map((x) => (
        <mesh key={x} position={[x, 0.3, LENGTH / 2 + 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[x === 0 ? 0.045 : 0.055, x === 0 ? 0.045 : 0.055, 0.06, 14]} />
          <meshStandardMaterial color="#9aa1a7" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
      {/* the wing: two black uprights and a wide blade over the trunk */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.93, LENGTH / 2 - 0.3]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.05, 0.24, 0.1]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
      ))}
      <RoundedBox args={[WIDTH - 0.12, 0.035, 0.3]} radius={0.012} smoothness={2} position={[0, 1.06, LENGTH / 2 - 0.25]} rotation={[-0.08, 0, 0]} castShadow={shadows}>
        <meshStandardMaterial color={TRIM} roughness={0.5} />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (WIDTH / 2 - 0.08), 1.05, LENGTH / 2 - 0.25]}>
          <boxGeometry args={[0.02, 0.1, 0.32]} />
          <meshStandardMaterial color={TRIM} />
        </mesh>
      ))}

      <Wheel position={[-(WIDTH / 2 - 0.08), 0.33, -1.42]} shadows={shadows} />
      <Wheel position={[WIDTH / 2 - 0.08, 0.33, -1.42]} shadows={shadows} />
      <Wheel position={[-(WIDTH / 2 - 0.08), 0.33, 1.4]} shadows={shadows} />
      <Wheel position={[WIDTH / 2 - 0.08, 0.33, 1.4]} shadows={shadows} />
      </group>
    </group>
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
function CarPanel() {
  const open = useCar((s) => s.open);
  if (!open) return null;
  return <Label id="car" position={[0, 1.9, 0]} spec={{ layer: 30, interactive: true, render: () => <CarCard /> }} />;
}

function CarCard() {
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
            <p className="text-sm font-semibold">Civic Type R</p>
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
