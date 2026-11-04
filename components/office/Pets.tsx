"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { OUTSIDE, ROOM } from "./palette";
import { compile, sample, type Waypoint } from "./routes";

/**
 * The office pets, outside: a golden dog that trots a loop around the lawn by the patio, sniffs around
 * and naps at its doghouse, and a gray tabby cat that strolls the front sidewalk and sits to watch the street.
 * Both are simple original low-poly animals, timed off the render clock (they don't follow the scene clock).
 */

type Look = { fur: string; belly: string; dark: string; ears: "floppy" | "pointed"; size: number };

type Rig = {
  legs: (THREE.Group | null)[];
  tail: THREE.Group | null;
  head: THREE.Group | null;
  body: THREE.Group | null;
};

/** A four-legged animal facing -z: body, head with ears and snout, legs on hip joints, a tail. */
function Quadruped({ look, rig, collar }: { look: Look; rig: React.RefObject<Rig>; collar?: string }) {
  const s = look.size;
  const legX = 0.09 * s, legZ = 0.2 * s, legH = 0.22 * s;
  return (
    <group scale={1}>
      <group ref={(g) => { rig.current.body = g; }}>
        {/* body */}
        <mesh position={[0, legH + 0.08 * s, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.1 * s, 0.32 * s, 6, 12]} />
          <meshStandardMaterial color={look.fur} />
        </mesh>
        <mesh position={[0, legH + 0.04 * s, -0.02 * s]} rotation={[Math.PI / 2, 0, 0]} scale={[0.8, 1, 0.6]}>
          <capsuleGeometry args={[0.085 * s, 0.26 * s, 4, 10]} />
          <meshStandardMaterial color={look.belly} />
        </mesh>
        {/* head */}
        <group ref={(g) => { rig.current.head = g; }} position={[0, legH + 0.2 * s, -0.3 * s]}>
          <mesh castShadow>
            <sphereGeometry args={[0.1 * s, 14, 10]} />
            <meshStandardMaterial color={look.fur} />
          </mesh>
          <mesh position={[0, -0.025 * s, -0.09 * s]} scale={look.ears === "floppy" ? [0.8, 0.7, 1.1] : [0.6, 0.5, 0.6]}>
            <sphereGeometry args={[0.065 * s, 10, 8]} />
            <meshStandardMaterial color={look.belly} />
          </mesh>
          <mesh position={[0, -0.005 * s, -0.16 * s]}>
            <sphereGeometry args={[0.018 * s, 8, 6]} />
            <meshStandardMaterial color="#1b1b1b" />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * 0.045 * s, 0.025 * s, -0.085 * s]}>
                <sphereGeometry args={[0.014 * s, 8, 6]} />
                <meshBasicMaterial color="#141414" />
              </mesh>
              {look.ears === "floppy" ? (
                <mesh position={[side * 0.085 * s, 0.0, 0.01 * s]} rotation={[0, 0, side * 0.35]} scale={[0.45, 1, 0.8]}>
                  <sphereGeometry args={[0.065 * s, 10, 8]} />
                  <meshStandardMaterial color={look.dark} />
                </mesh>
              ) : (
                <mesh position={[side * 0.055 * s, 0.1 * s, 0.01 * s]} rotation={[0, 0, side * -0.25]}>
                  <coneGeometry args={[0.035 * s, 0.07 * s, 4]} />
                  <meshStandardMaterial color={look.fur} />
                </mesh>
              )}
            </group>
          ))}
          {collar && (
            <mesh position={[0, -0.07 * s, 0.06 * s]} rotation={[Math.PI / 2 - 0.3, 0, 0]}>
              <torusGeometry args={[0.07 * s, 0.012 * s, 6, 16]} />
              <meshStandardMaterial color={collar} />
            </mesh>
          )}
        </group>
        {/* tail */}
        <group ref={(g) => { rig.current.tail = g; }} position={[0, legH + 0.12 * s, 0.24 * s]}>
          <mesh position={[0, 0.08 * s, 0.05 * s]} rotation={[0.6, 0, 0]}>
            <capsuleGeometry args={[look.ears === "pointed" ? 0.018 * s : 0.025 * s, 0.18 * s, 4, 8]} />
            <meshStandardMaterial color={look.dark} />
          </mesh>
        </group>
      </group>
      {/* legs: front left, front right, back left, back right */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <group key={i} ref={(g) => { rig.current.legs[i] = g; }} position={[sx * legX, legH, sz * legZ]}>
          <mesh position={[0, -legH / 2, 0]} castShadow>
            <capsuleGeometry args={[0.028 * s, legH - 0.04 * s, 4, 8]} />
            <meshStandardMaterial color={i < 2 ? look.fur : look.dark} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Animate a quadruped: legs swing with distance walked, tail and head idle, `lie` lowers it onto its belly. */
function pose(rig: Rig, t: number, walk: number, dist: number, tailSpeed: number, lie: number, sniff: number) {
  const stride = dist * 14;
  rig.legs.forEach((g, i) => {
    if (!g) return;
    const phase = i === 0 || i === 3 ? 0 : Math.PI;
    g.rotation.x = Math.sin(stride + phase) * 0.55 * walk * (1 - lie) + lie * (i < 2 ? -1.3 : 1.3);
  });
  if (rig.body) rig.body.position.y = -lie * 0.13 + Math.abs(Math.sin(stride)) * 0.012 * walk;
  if (rig.tail) {
    rig.tail.rotation.y = Math.sin(t * tailSpeed) * 0.6;
    rig.tail.rotation.x = -0.2 + Math.sin(t * 1.3) * 0.1;
  }
  if (rig.head) {
    rig.head.rotation.x = sniff * (0.45 + Math.sin(t * 9) * 0.08);
    rig.head.rotation.y = Math.sin(t * 0.6) * 0.35 * (1 - walk);
  }
}

/* ------------------------------------------------------------------ the dog */

const DOGHOUSE = { x: OUTSIDE.x1 + 3.6, z: 6.9 } as const;
const DOG_ROUTE = compile([
  { x: DOGHOUSE.x - 0.7, z: DOGHOUSE.z, wait: 14, act: "look", face: Math.PI / 2 },
  { x: OUTSIDE.x1 + 1.1, z: 7.6 },
  { x: OUTSIDE.x1 + 1.0, z: 5.6, wait: 3, act: "inspect" },
  { x: OUTSIDE.x1 + 2.5, z: 3.4 },
  { x: OUTSIDE.x1 + 4.6, z: 4.4, wait: 3, act: "inspect" },
  { x: OUTSIDE.x1 + 4.8, z: 8.6 },
  { x: OUTSIDE.x1 + 3.2, z: 9.9, wait: 2.5, act: "inspect" },
  { x: DOGHOUSE.x - 0.7, z: DOGHOUSE.z },
] satisfies Waypoint[], 1.1);

function Dog({ frozen }: { frozen: boolean }) {
  const group = useRef<THREE.Group>(null);
  const rig = useRef<Rig>({ legs: [], tail: null, head: null, body: null });
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = frozen ? 7 : clock.elapsedTime; // minimal motion: napping by the doghouse
    const s = sample(DOG_ROUTE, t % DOG_ROUTE.duration);
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.heading;
    const resting = s.act === "look";
    const lie = resting ? Math.min(1, s.actT * 6, (1 - s.actT) * 6) : 0;
    pose(rig.current, t, s.moving ? 1 : 0, s.dist, resting ? 3 : 12, lie, s.act === "inspect" ? 1 : 0);
  });
  return (
    <group ref={group}>
      <Quadruped look={{ fur: "#d39a4f", belly: "#f1d3a3", dark: "#a8702f", ears: "floppy", size: 1.35 }} rig={rig} collar="#dc2626" />
    </group>
  );
}

function Doghouse() {
  return (
    <group position={[DOGHOUSE.x, 0, DOGHOUSE.z]} rotation={[0, -Math.PI / 2, 0]}>
      <RoundedBox args={[0.8, 0.6, 0.9]} radius={0.03} smoothness={2} position={[0, 0.3, 0]} castShadow>
        <meshStandardMaterial color="#c2410c" />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.24, 0.72, 0]} rotation={[0, 0, side * -0.75]} castShadow>
          <boxGeometry args={[0.62, 0.05, 1.0]} />
          <meshStandardMaterial color="#3f3f46" />
        </mesh>
      ))}
      <mesh position={[0, 0.25, -0.452]}>
        <circleGeometry args={[0.17, 18, 0, Math.PI]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>
      <mesh position={[0, 0.17, -0.452]}>
        <planeGeometry args={[0.34, 0.16]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>
      {/* food bowl */}
      <mesh position={[0.5, 0.04, -0.55]}>
        <cylinderGeometry args={[0.1, 0.08, 0.07, 16]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ the cat */

// just in front of the glass, clear of the sidewalk trees and lamp posts
const WALK_Z = ROOM.D + 0.45;
const CAT_ROUTE = compile([
  { x: 2.6, z: WALK_Z, wait: 18, act: "look", face: Math.PI },
  { x: 4.9, z: WALK_Z, wait: 2, act: "inspect" },
  { x: 9.6, z: WALK_Z, wait: 22, act: "look", face: Math.PI },
  { x: 7.4, z: WALK_Z },
  { x: 2.6, z: WALK_Z },
] satisfies Waypoint[], 0.45);

function Cat({ frozen }: { frozen: boolean }) {
  const group = useRef<THREE.Group>(null);
  const rig = useRef<Rig>({ legs: [], tail: null, head: null, body: null });
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = frozen ? 9 : clock.elapsedTime + 11;
    const s = sample(CAT_ROUTE, t % CAT_ROUTE.duration);
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.heading;
    const sitting = s.act === "look";
    // sitting: back legs folded, front legs straight (a lighter "lie")
    const lie = sitting ? 0.45 * Math.min(1, s.actT * 8, (1 - s.actT) * 8) : 0;
    pose(rig.current, t, s.moving ? 1 : 0, s.dist * 1.6, 1.4, lie, s.act === "inspect" ? 0.6 : 0);
    if (sitting && rig.current.body) rig.current.body.rotation.x = 0.35 * lie / 0.45;
    else if (rig.current.body) rig.current.body.rotation.x = 0;
  });
  return (
    <group ref={group}>
      <Quadruped look={{ fur: "#8b8f97", belly: "#d4d6da", dark: "#5b5f66", ears: "pointed", size: 0.85 }} rig={rig} />
    </group>
  );
}

export function Pets({ frozen = false }: { frozen?: boolean }) {
  return (
    <group>
      <Doghouse />
      <Dog frozen={frozen} />
      <Cat frozen={frozen} />
    </group>
  );
}
