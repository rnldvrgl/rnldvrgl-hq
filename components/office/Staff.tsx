"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Coffee, Crown, Footprints, Sparkles } from "lucide-react";
import { sceneNow } from "@/lib/store";
import { manilaDay, manilaMinutes } from "@/lib/office-clock";
import { TEAM } from "@/lib/team";
import { DESK, PAL, type Palette } from "./palette";
import { Person, applyPose, REST, type Look, type Pose, type PersonRig } from "./Person";
import { Bubble } from "./Bubble";
import { OWNER_CHAIR, WET_SIGN, janitorAt, ownerTourAt, sample } from "./routes";
import { useSceneNow } from "./scene-clock-ui";

const STRIDE = 4.8;
export const OWNER_NAME = "Ronald";

/** Who Ronald is standing behind, if he's at someone's desk. */
function nearestEmployee(x: number, z: number): string | null {
  let best: string | null = null, bestD = 1.2;
  for (const m of TEAM) {
    const d = Math.hypot(m.desk.x + DESK.W / 2 - x, m.desk.y + DESK.D + 1.05 - z);
    if (d < bestD) { bestD = d; best = m.name; }
  }
  return best;
}

/**
 * Ronald: at his desk in the corner office, typing in bursts. Now and then he gets up and walks
 * the floor like a boss — hands clasped behind his back, stopping behind people to look at their
 * screens with an approving nod — sometimes via the pantry for a coffee.
 */
export function Owner({ pal, shadows, reducedMotion }: { pal: Palette; shadows: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const rig = useRef<PersonRig | null>(null);
  const mug = useRef<THREE.Group>(null);
  const pose = useRef<Pose>({ ...REST });
  const look: Look = useMemo(() => ({
    shirt: pal.ownerShirt, pants: "#2a2f36", skin: PAL.skin[0], hair: pal.hair, hairStyle: "neat", shoes: "#3b2a1e",
  }), [pal]);

  useFrame(({ clock }) => {
    const g = group.current, r = rig.current;
    if (!g || !r) return;
    const now = sceneNow();
    const tour = ownerTourAt(manilaDay(now), manilaMinutes(now));
    const p = pose.current;
    Object.assign(p, REST);
    p.time = reducedMotion ? 0 : clock.elapsedTime;
    let holdingMug = false;

    if (!tour) {
      g.position.set(OWNER_CHAIR.x, 0, OWNER_CHAIR.z);
      g.rotation.y = 0;
      p.sit = 1;
      // types in bursts, then leans back to think
      p.typing = Math.max(0, Math.sin(p.time * 0.35)) > 0.3 ? 1 : 0.1;
    } else {
      const s = sample(tour.route, tour.t);
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.heading;
      p.walk = s.moving ? 1 : 0;
      p.stride = reducedMotion ? 0 : s.dist * STRIDE * 0.9;
      if (s.act === "rise") p.sit = 1 - s.actT;
      if (s.act === "sit") p.sit = s.actT;
      // after the coffee machine he carries his mug back
      const coffeeEnd = tour.route.entries.find((e) => e.kind === "wait" && e.act === "coffee")?.t1;
      holdingMug = tour.coffee && coffeeEnd !== undefined && tour.t >= coffeeEnd - 1.5 && s.act !== "sit";
      if (holdingMug) p.mug = 1;
      else if (s.act !== "rise" && s.act !== "sit" && s.act !== "coffee") p.armsBehind = 1;
      if (s.act === "coffee") p.bend = Math.sin(s.actT * Math.PI) * 0.3;
      if (s.act === "inspect") p.nod = s.actT > 0.3 && s.actT < 0.8 ? 1 : 0;
    }
    if (mug.current) mug.current.visible = holdingMug;
    applyPose(r, p);
  });

  // Bubble: once a second.
  const now = useSceneNow(1000);
  const tour = ownerTourAt(manilaDay(now), manilaMinutes(now));
  let status = "Boss", detail = "Main office", Icon = Crown;
  if (tour) {
    const s = sample(tour.route, tour.t);
    if (s.act === "coffee") { status = "Coffee"; detail = "Making a cup"; Icon = Coffee; }
    else if (s.act === "inspect") { status = "Checking in"; detail = `Looking over ${nearestEmployee(s.x, s.z) ?? "the team"}'s work`; Icon = Footprints; }
    else { status = "Walking around"; detail = tour.coffee ? "Coffee run" : "Making the rounds"; Icon = Footprints; }
  }

  return (
    <group ref={group} position={[OWNER_CHAIR.x, 0, OWNER_CHAIR.z]}>
      <Person
        look={look}
        shadows={shadows}
        rig={rig}
        rightHand={
          <group ref={mug} visible={false} position={[0, 0.02, -0.06]} rotation={[-1.7, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.05, 0.045, 0.11, 12]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 0.056, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.044, 12]} />
              <meshStandardMaterial color="#5b3a22" />
            </mesh>
          </group>
        }
      />
      <Bubble
        position={[0, tour ? 2.3 : 1.95, 0]}
        icon={Icon}
        tone="owner"
        name={OWNER_NAME}
        status={status}
        detail={detail}
        zIndex={19}
      />
    </group>
  );
}

/* ------------------------------------------------------------------ janitor */

const TRAIL = 9;

/**
 * Ben the janitor: comes in for three rounds a day (7–8 AM, 12–1 PM, 6–7 PM), puts out a wet-floor
 * sign and mops the aisles, pushing his yellow bucket. The floor behind him shines for a moment.
 */
export function Janitor({ pal, shadows, reducedMotion }: { pal: Palette; shadows: boolean; reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);
  const cart = useRef<THREE.Group>(null);
  const sign = useRef<THREE.Group>(null);
  const rig = useRef<PersonRig | null>(null);
  const trail = useRef<(THREE.Mesh | null)[]>([]);
  const pose = useRef<Pose>({ ...REST });
  const now = useSceneNow(1000);
  const onShift = janitorAt(manilaMinutes(now)) !== null;
  const look: Look = useMemo(() => ({
    shirt: pal.janitor, pants: "#1f3a52", skin: PAL.skin[2], hair: pal.hair, hairStyle: "cap", cap: pal.janitorCap, shoes: "#1c2228",
  }), [pal]);

  useFrame(({ clock }) => {
    const rt = root.current, g = group.current, r = rig.current;
    if (!rt || !g || !r) return;
    const min = manilaMinutes(sceneNow());
    const round = janitorAt(min);
    rt.visible = round !== null;
    if (sign.current) sign.current.visible = round !== null;
    if (!round) return;
    const s = sample(round.route, round.t);
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.heading;
    const p = pose.current;
    Object.assign(p, REST);
    p.time = reducedMotion ? 0 : clock.elapsedTime;
    p.walk = s.moving ? 0.6 : 0;
    p.stride = reducedMotion ? 0 : s.dist * STRIDE * 1.4;
    // mops once inside (not on the pavement)
    const inside = s.x < 15.2;
    p.mop = inside ? 1 : 0;
    applyPose(r, p);

    // the bucket trails a step behind him on the same path
    if (cart.current) {
      const c = sample(round.route, round.t - 3.2);
      cart.current.position.set(c.x, 0, c.z);
      cart.current.rotation.y = c.heading;
    }
    // wet shine: patches along the path behind him, fading with age
    trail.current.forEach((m, i) => {
      if (!m) return;
      const age = (i + 1) * 2.4;
      const q = sample(round.route, round.t - age);
      const mat = m.material;
      m.visible = inside && q.x < 15.2 && round.t > age;
      m.position.set(q.x, 0.012, q.z);
      if (mat instanceof THREE.MeshStandardMaterial) mat.opacity = 0.32 * (1 - i / TRAIL);
    });
  });

  return (
    <>
      <group ref={root} visible={false}>
        <group ref={group}>
          <Person
            look={look}
            shadows={shadows}
            rig={rig}
            front={
              // mop handle from his hands down to the floor ahead of him
              <group position={[0, 0.25, -0.32]} rotation={[0.55, 0, 0]}>
                <mesh position={[0, -0.55, 0]}>
                  <cylinderGeometry args={[0.018, 0.018, 1.5, 6]} />
                  <meshStandardMaterial color="#9aa5ae" />
                </mesh>
                <mesh position={[0, -1.28, 0]}>
                  <boxGeometry args={[0.36, 0.06, 0.12]} />
                  <meshStandardMaterial color={pal.mop} />
                </mesh>
              </group>
            }
          />
          {/* Html ignores `visible`, so the bubble is only rendered during a round */}
          {onShift && <Bubble position={[0, 2.3, 0]} icon={Sparkles} tone="staff" name="Ben" status="Janitor" detail="Mopping the floor" zIndex={18} />}
        </group>
        {/* mop bucket on wheels */}
        <group ref={cart}>
          <mesh position={[0, 0.2, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.2, 0.17, 0.32, 14]} />
            <meshStandardMaterial color={pal.bucket} />
          </mesh>
          <mesh position={[0, 0.355, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.01, 14]} />
            <meshStandardMaterial color="#7cc4e4" />
          </mesh>
          <mesh position={[0, 0.45, 0.17]}>
            <boxGeometry args={[0.3, 0.16, 0.08]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
          {[[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.03, z]}>
              <sphereGeometry args={[0.03, 6, 5]} />
              <meshStandardMaterial color="#1c2228" />
            </mesh>
          ))}
        </group>
        {Array.from({ length: TRAIL }, (_, i) => (
          <mesh key={i} ref={(m) => { trail.current[i] = m; }} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <circleGeometry args={[0.42, 18]} />
            <meshStandardMaterial color="#cfe9f7" transparent opacity={0} roughness={0.05} metalness={0.2} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {/* yellow wet-floor sign while he's in */}
      <group ref={sign} position={[WET_SIGN.x, 0, WET_SIGN.z]} rotation={[0, 0.6, 0]} visible={false}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0, 0.3, side * 0.07]} rotation={[side * 0.22, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[0.3, 0.6, 0.015]} />
            <meshStandardMaterial color="#facc15" />
          </mesh>
        ))}
        <mesh position={[0, 0.36, 0.142]} rotation={[0.22, 0, 0]}>
          <circleGeometry args={[0.07, 3]} />
          <meshBasicMaterial color="#1c2228" />
        </mesh>
      </group>
    </>
  );
}
