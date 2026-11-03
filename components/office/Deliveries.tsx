"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { create } from "zustand";
import { OWNER_CHAIR, type Pt } from "./routes";

/**
 * When a report finishes, a sheet of paper flies in an arc from that desk to Ronald's in-tray.
 * Flights are launched on the status change the browser sees, so they play live (not when previewing other times).
 */
type Kind = "done" | "needs" | "error";
type Flight = { id: number; from: Pt; kind: Kind; start: number };

const useFlights = create<{ flights: Flight[] }>(() => ({ flights: [] }));
let nextId = 1;
const DURATION = 2.4;

export function launchDelivery(from: Pt, kind: Kind): void {
  const start = performance.now() / 1000;
  useFlights.setState((s) => ({ flights: [...s.flights.slice(-7), { id: nextId++, from, kind, start }] }));
}

/** Ronald's in-tray, on the left of his desk. */
export const IN_TRAY = { x: OWNER_CHAIR.x - 0.98, y: 0.84, z: 0.95 } as const;
const COLORS: Record<Kind, string> = { done: "#ffffff", needs: "#fde68a", error: "#fecaca" };

function Paper({ flight }: { flight: Flight }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const k = (performance.now() / 1000 - flight.start) / DURATION;
    if (k >= 1) {
      useFlights.setState((s) => ({ flights: s.flights.filter((f) => f.id !== flight.id) }));
      return;
    }
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in-out
    const x = flight.from.x + (IN_TRAY.x - flight.from.x) * e;
    const z = flight.from.z + (IN_TRAY.z - flight.from.z) * e;
    const y = 1.35 + (IN_TRAY.y - 1.35) * e + Math.sin(Math.PI * e) * 2.4;
    g.position.set(x, y, z);
    g.rotation.set(Math.sin(k * 9) * 0.5, k * 8, Math.cos(k * 7) * 0.4);
    g.scale.setScalar(k < 0.1 ? k * 10 : 1);
  });
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[0.24, 0.005, 0.32]} />
        <meshStandardMaterial color={COLORS[flight.kind]} emissive={COLORS[flight.kind]} emissiveIntensity={0.35} />
      </mesh>
      {[-0.08, -0.03, 0.02, 0.07].map((z) => (
        <mesh key={z} position={[0, 0.004, z]}>
          <boxGeometry args={[0.16, 0.001, 0.012]} />
          <meshBasicMaterial color="#94a3b8" />
        </mesh>
      ))}
    </group>
  );
}

/** Mount once in the Canvas: the flying papers, plus Ronald's in-tray they land in. */
export function Deliveries() {
  const flights = useFlights((s) => s.flights);
  return (
    <group>
      <group position={[IN_TRAY.x, IN_TRAY.y - 0.03, IN_TRAY.z]}>
        <mesh>
          <boxGeometry args={[0.36, 0.05, 0.42]} />
          <meshStandardMaterial color="#2b3640" />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.26, 0.03, 0.34]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      </group>
      {flights.map((f) => <Paper key={f.id} flight={f} />)}
    </group>
  );
}
