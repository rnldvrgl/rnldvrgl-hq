"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Coffee, Crown, Footprints, LogIn, LogOut, Megaphone, ShoppingBag, Sparkles, Wind, type LucideIcon } from "lucide-react";
import { sceneNow, useOffice, type BossErrandKind, type BossErrandState } from "@/lib/store";
import { clockLabel, useSettings, workHours } from "@/lib/settings";
import { isWeekday, manilaDay, manilaMinutes } from "@/lib/office-clock";
import { TEAM } from "@/lib/team";
import { DESK, PAL, ROOM, type Palette } from "./palette";
import { Person, applyPose, REST, type Look, type Pose, type PersonRig } from "./Person";
import { Bubble } from "./Bubble";
import { OWNER_CHAIR, WET_SIGN, bossErrandRoute, janitorAt, ownerStandupAt, ownerTourAt, sample, type Route } from "./routes";
import { VaporPuffs, vapePose } from "./Employee3D";
import { bossDay } from "./bossCommute";
import { useSceneNow } from "./scene-clock-ui";
import { HQ, type BossLook } from "@/hq.config";

const STRIDE = 4.8;
export const OWNER_NAME = HQ.owner.name;

/** Who Ronald is standing behind, if he's at someone's desk. */
function nearestEmployee(x: number, z: number): string | null {
  let best: string | null = null, bestD = 1.2;
  for (const m of TEAM) {
    const d = Math.hypot(m.desk.x + DESK.W / 2 - x, m.desk.y + DESK.D + 1.05 - z);
    if (d < bestD) { bestD = d; best = m.name; }
  }
  return best;
}

type Outing = { route: Route; t: number; coffee: boolean; standup: boolean; errand: BossErrandKind | null; commute?: "leaving" | "arriving" };

/** A finished errand stays "finished" (back at the desk) until the next one is sent. */
function errandAt(e: BossErrandState | null): Outing | null {
  if (!e) return null;
  const route = bossErrandRoute(e.kind, e.seed);
  const t = (Date.now() - e.since) / 1000;
  return t <= route.duration ? { route, t, coffee: e.kind === "coffee", standup: false, errand: e.kind } : null;
}

/**
 * Where the boss is: on an errand you sent them on, walking home or in, at home ("home"), leading the
 * stand-up, on a walk, or (null) at the desk.
 */
function ownerOuting(now: Date): Outing | "home" | null {
  const { routine, boss } = useSettings.getState();
  const min = manilaMinutes(now);
  // the commute by car: walking to or from it, in it (not drawn: Car.tsx drives), or home for the night
  const day = routine.commute ? bossDay(min, workHours("boss")) : null;
  if (day && (day.kind === "home" || day.kind === "car")) return "home";
  if (day?.kind === "walk") return { route: day.route, t: day.t, coffee: false, standup: false, errand: null, commute: day.reverse ? "arriving" : "leaving" };
  const errand = errandAt(useOffice.getState().bossErrand);
  if (errand) return errand;
  const lead = routine.standup ? ownerStandupAt(isWeekday(now), min) : null;
  if (lead) return { ...lead, coffee: false, standup: true, errand: null };
  const tour = boss.wanders ? ownerTourAt(manilaDay(now), min) : null;
  return tour ? { ...tour, standup: false, errand: null } : null;
}

/** Is the boss away from the office right now (driving, or at home for the night)? */
export const ownerIsHome = (now: Date): boolean => ownerOuting(now) === "home";

/** The boss's two looks (Settings → Boss, default in hq.config.ts). */
export function bossLook(look: BossLook): Look {
  return look === "her"
    // soft-girl street style: oatmeal cropped cardigan over a cream top, a pleated midi skirt, white sneakers; long wavy hair
    ? { shirt: "#e9d5c6", pants: "#2f2a32", skin: PAL.skin[3], hair: "#2a1a16", hairStyle: "wavy", shoes: "#f4f4f1", outfit: "skirt", accent: "#f9a8d4", skirt: "#b98aa0" }
    // Japanese street style: oversized charcoal hoodie, beige wide cargo pants, chunky white sneakers; Korean medium cut
    : { shirt: "#2b2e34", pants: "#bba98b", skin: PAL.skin[0], hair: "#1c1714", hairStyle: "korean", shoes: "#f4f4f1", outfit: "street", accent: "#f97316" };
}

/**
 * The boss: at the desk in the corner office, typing in bursts. Now and then gets up and walks the floor
 * (hands clasped behind the back, stopping behind people to look at their screens with an approving nod),
 * sometimes via the pantry for a coffee. The Boss menu sends them on errands: a vape break on the patio,
 * a walk down the street, a snack run to the sari-sari store, a coffee, a round of the office. At the end of
 * the day (Settings → Office hours) they walk out to the car and drive home (bossCommute.ts), and back in the morning.
 */
export function Owner({ shadows, reducedMotion }: { pal: Palette; shadows: boolean; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const rig = useRef<PersonRig | null>(null);
  const mug = useRef<THREE.Group>(null);
  const vapor = useRef<THREE.Group>(null);
  const pose = useRef<Pose>({ ...REST });
  const lookKind = useSettings((s) => s.boss.look);
  const look = useMemo(() => bossLook(lookKind), [lookKind]);
  // re-render the bubble when an errand starts or a setting changes
  useOffice((s) => s.bossErrand);
  useSettings((s) => s.boss.wanders);
  useSettings((s) => s.hours);
  useSettings((s) => s.routine.commute);

  useFrame(({ clock }) => {
    const g = group.current, r = rig.current;
    if (!g || !r) return;
    const now = sceneNow();
    const out = ownerOuting(now);
    g.visible = out !== "home";
    const tour = out === "home" ? null : out;
    const p = pose.current;
    Object.assign(p, REST);
    p.time = reducedMotion ? 0 : clock.elapsedTime;
    let holdingMug = false;
    if (vapor.current) vapor.current.visible = false;

    if (!tour) {
      g.position.set(OWNER_CHAIR.x, 0, OWNER_CHAIR.z);
      g.rotation.y = 0;
      p.sit = 1;
      // types in bursts, then leans back to think
      p.typing = Math.max(0, Math.sin(p.time * 0.35)) > 0.3 ? 1 : 0.1;
    } else {
      const back = tour.commute === "arriving";
      const s0 = sample(tour.route, tour.t);
      // coming in: the walk home played backwards
      const s = back ? { ...s0, heading: s0.moving ? s0.heading + Math.PI : s0.heading, dist: tour.route.length - s0.dist } : s0;
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.heading;
      p.walk = s.moving ? 1 : 0;
      p.stride = reducedMotion ? 0 : s.dist * STRIDE * 0.9;
      if (s.act === "rise") p.sit = back ? s.actT : 1 - s.actT;
      if (s.act === "sit") p.sit = s.actT;
      // after the coffee machine (or the sari-sari store) the boss carries it back
      const pickAct = tour.errand === "snack" ? "inspect" : "coffee";
      const pickEnd = tour.route.entries.find((e) => e.kind === "wait" && e.act === pickAct)?.t1;
      holdingMug = (tour.coffee || tour.errand === "snack") && pickEnd !== undefined && tour.t >= pickEnd - 1.5 && s.act !== "sit";
      if (holdingMug) p.mug = 1;
      else if (s.act !== "rise" && s.act !== "sit" && s.act !== "coffee" && s.act !== "vape") p.armsBehind = 1;
      if (s.act === "coffee") p.bend = Math.sin(s.actT * Math.PI) * 0.3;
      if (s.act === "inspect") p.nod = s.actT > 0.3 && s.actT < 0.8 ? 1 : 0;
      if (s.act === "look") p.nod = Math.sin(p.time * 0.5) > 0.9 ? 1 : 0;
      if (s.act === "vape") vapePose(p, vapor.current, reducedMotion || !useSettings.getState().show.smoke);
      if (s.act === "lead") {
        // talking the team through the day: hands out of the back, gesturing now and then
        p.armsBehind = Math.sin(p.time * 0.5) > 0.2 ? 1 : 0;
        p.typing = p.armsBehind ? 0 : 0.6;
        p.nod = Math.sin(p.time * 1.3) > 0.5 ? 1 : 0;
      }
    }
    if (mug.current) mug.current.visible = holdingMug;
    applyPose(r, p);
  });

  // Bubble: once a second.
  const now = useSceneNow(1000);
  const out = ownerOuting(now);
  const tour = out === "home" ? null : out;
  const { hours } = useSettings.getState();
  let status = "Boss", detail = "Main office", Icon: LucideIcon = Crown;
  if (tour?.commute) {
    if (tour.commute === "leaving") { status = "Heading home"; detail = `To the car · back ${clockLabel(hours.bossIn)}`; Icon = LogOut; }
    else { status = "Clocking in"; detail = "Good morning, team"; Icon = LogIn; }
  } else if (tour) {
    const s = sample(tour.route, tour.t);
    const inside = s.x < ROOM.W && s.z < ROOM.D;
    if (tour.standup) { status = "Stand-up"; detail = s.act === "lead" ? "Leading the 9 AM stand-up" : "Heading to stand-up"; Icon = Megaphone; }
    else if (tour.errand === "vape") { status = "Vape break"; detail = s.act === "vape" ? "On the patio" : inside ? "Heading out" : "Patio"; Icon = Wind; }
    else if (tour.errand === "walk") { status = "Out for a walk"; detail = s.act === "look" ? "Watching the street" : "Getting some air"; Icon = Footprints; }
    else if (tour.errand === "snack") { status = "Snack run"; detail = s.act === "inspect" ? "Buying at the sari-sari store" : "To the sari-sari store"; Icon = ShoppingBag; }
    else if (s.act === "coffee") { status = "Coffee"; detail = "Making a cup"; Icon = Coffee; }
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
      <VaporPuffs ref={vapor} />
      <Bubble
        id="owner"
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
  const janitorOn = useSettings((st) => st.routine.janitor);
  const onShift = janitorOn && janitorAt(manilaMinutes(now)) !== null;
  const look: Look = useMemo(() => ({
    shirt: pal.janitor, pants: "#1f3a52", skin: PAL.skin[2], hair: pal.hair, hairStyle: "cap", cap: pal.janitorCap, shoes: "#1c2228",
  }), [pal]);

  useFrame(({ clock }) => {
    const rt = root.current, g = group.current, r = rig.current;
    if (!rt || !g || !r) return;
    const min = manilaMinutes(sceneNow());
    const round = useSettings.getState().routine.janitor ? janitorAt(min) : null;
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
          {onShift && <Bubble id="janitor" position={[0, 2.3, 0]} icon={Sparkles} tone="staff" name={HQ.janitorName} status="Janitor" detail="Mopping the floor" zIndex={18} />}
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
