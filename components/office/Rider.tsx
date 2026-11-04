"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneNow } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { Person, REST, applyPose, type Look, type Pose, type PersonRig } from "./Person";
import { vehicle } from "./Traffic";
import { mergeParts, type Part } from "./batch";
import { ENTRANCE, PAL, ROOM } from "./palette";
import { LANE, ROAD, SIDEWALK } from "./world";

/**
 * The lunch delivery, every day at 11:50 AM: a rider on a scooter comes down the near lane, pulls up at the
 * kerb by the office, walks the food bag up the covered walkway to the entrance, and rides off.
 * One scripted timeline (seconds after 11:50), so time-travel preview and scrubbing land on the right moment.
 */

const START = 11 * 60 + 50;
const GREEN = "#00a651";
const KERB = { x: ROOM.W + 0.9, z: ROAD.z0 + 0.55 };
const DOOR = { x: ROOM.W + 0.6, z: ENTRANCE.z };
/** The walk from the scooter to the door: onto the sidewalk, then up the walkway along the building. */
const WALK: readonly (readonly [number, number])[] = [
  [KERB.x - 0.6, KERB.z], [KERB.x - 0.6, SIDEWALK.z0 + 0.4], [DOOR.x, SIDEWALK.z0 - 0.3], [DOOR.x, DOOR.z + 0.5],
];
const RIDE_IN = 12, PARK = 2, WALK_S = 16, HAND_OVER = 8;
const T = { arrive: RIDE_IN, off: RIDE_IN + PARK, door: RIDE_IN + PARK + WALK_S, back: RIDE_IN + PARK + WALK_S + HAND_OVER } as const;
const T_MOUNT = T.back + WALK_S, T_GONE = T_MOUNT + PARK + RIDE_IN;
const RIDE_FROM = KERB.x - 45, RIDE_TO = KERB.x + 55;

const LOOK: Look = { shirt: GREEN, pants: "#1f2937", skin: PAL.skin[2], hair: "#1f1a17", hairStyle: "cap", cap: "#111827", shoes: "#111827" };

/** Where along a polyline you are at fraction k (0–1), and which way you're heading. */
function along(path: readonly (readonly [number, number])[], k: number): { x: number; z: number; dx: number; dz: number } {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(l); total += l; }
  let d = Math.min(1, Math.max(0, k)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? Math.min(1, d / seg[i]) : 0;
      const [x0, z0] = path[i], [x1, z1] = path[i + 1];
      return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, dx: x1 - x0, dz: z1 - z0 };
    }
    d -= seg[i];
  }
  const [x, z] = path[path.length - 1];
  return { x, z, dx: 0, dz: -1 };
}

const ease = (k: number) => k * k * (3 - 2 * k);

export function Rider({ shadows, frozen }: { shadows: boolean; frozen: boolean }) {
  const root = useRef<THREE.Group>(null);
  const bike = useRef<THREE.Group>(null);
  const seated = useRef<THREE.Mesh>(null);
  const walker = useRef<THREE.Group>(null);
  const bag = useRef<THREE.Group>(null);
  const rig = useRef<PersonRig | null>(null);
  const pose = useRef<Pose>({ ...REST });

  const { moto, rider } = useMemo(() => {
    // the insulated food box on the back rack
    const box: Part[] = [{ size: [0.42, 0.4, 0.42], pos: [-0.62, 1.0, 0], color: GREEN }, { size: [0.44, 0.04, 0.44], pos: [-0.62, 1.2, 0], color: "#f8fafc" }];
    // the rider while riding: jacket, legs and helmet, as Traffic draws its riders
    const seated: Part[] = [
      { size: [0.34, 0.6, 0.42], pos: [-0.15, 1.15, 0], color: GREEN },
      { size: [0.5, 0.2, 0.36], pos: [0.05, 0.85, 0], color: "#1f2937" },
      { shape: "cyl", size: [0.15, 0.26, 10], pos: [-0.1, 1.6, 0], color: GREEN },
    ];
    return { moto: mergeParts([...vehicle("moto", "#e5e7eb", GREEN, false).body, ...box]), rider: mergeParts(seated) };
  }, []);

  useFrame(({ clock }) => {
    const g = root.current, b = bike.current, w = walker.current, r = rig.current;
    if (!g || !b || !w) return;
    const t = (manilaMinutes(sceneNow()) - START) * 60;
    const on = t >= 0 && t < T_GONE;
    g.visible = on;
    if (!on) return;

    // the scooter: rides in along the near lane, angles to the kerb, waits, rides off
    let bx: number, bz = KERB.z;
    if (t < T.arrive) {
      const k = ease(t / T.arrive);
      bx = RIDE_FROM + (KERB.x - RIDE_FROM) * k;
      bz = LANE.near + (KERB.z - LANE.near) * Math.max(0, (k - 0.75) / 0.25);
    } else if (t < T_MOUNT + PARK) {
      bx = KERB.x;
    } else {
      const k = ease((t - T_MOUNT - PARK) / RIDE_IN);
      bx = KERB.x + (RIDE_TO - KERB.x) * k;
      bz = KERB.z + (LANE.near - KERB.z) * Math.min(1, k * 4);
    }
    b.position.set(bx, 0, bz);
    const riding = t < T.off || t >= T_MOUNT;
    if (seated.current) seated.current.visible = riding;

    // the rider on foot: to the door with the bag, a moment there, back without it
    w.visible = !riding;
    if (!riding && r) {
      const p = pose.current;
      Object.assign(p, REST);
      p.time = frozen ? 0 : clock.elapsedTime;
      let at: ReturnType<typeof along>, moving = true;
      if (t < T.door) at = along(WALK, (t - T.off) / WALK_S);
      else if (t < T.back) { at = along(WALK, 1); moving = false; }
      else { at = along([...WALK].reverse(), (t - T.back) / WALK_S); }
      w.position.set(at.x, 0, at.z);
      // walking: face the way you go (a person faces -z at rotY 0); at the door: face the wall (-x)
      w.rotation.y = moving ? Math.atan2(-at.dx, -at.dz) : Math.PI / 2;
      p.walk = moving && !frozen ? 0.6 : 0;
      p.stride = moving && !frozen ? clock.elapsedTime * 7 : 0;
      p.carry = t < T.door + HAND_OVER / 2 ? 1 : 0;
      p.wave = !moving ? Math.min(1, (t - T.door) / 2) * (t < T.back - 2 ? 1 : 0) : 0;
      applyPose(r, p);
      if (bag.current) bag.current.visible = t < T.door + HAND_OVER / 2;
    }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={bike}>
        {moto && (
          <mesh geometry={moto} castShadow={shadows}>
            <meshStandardMaterial vertexColors roughness={0.6} />
          </mesh>
        )}
        {rider && (
          <mesh ref={seated} geometry={rider}>
            <meshStandardMaterial vertexColors roughness={0.7} />
          </mesh>
        )}
      </group>
      <group ref={walker} visible={false}>
        <Person
          look={LOOK}
          shadows={shadows}
          rig={rig}
          rightHand={
            <group ref={bag} position={[0, -0.14, 0.04]}>
              <mesh>
                <boxGeometry args={[0.26, 0.3, 0.18]} />
                <meshStandardMaterial color="#f8fafc" />
              </mesh>
              <mesh position={[0, 0.02, 0.092]}>
                <planeGeometry args={[0.2, 0.12]} />
                <meshStandardMaterial color={GREEN} />
              </mesh>
            </group>
          }
        />
      </group>
    </group>
  );
}
