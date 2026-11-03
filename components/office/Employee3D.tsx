"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BellRing, House, Pause, Trash2, TriangleAlert, LogIn, LogOut } from "lucide-react";
import { useOffice, useEmployee, sceneNow } from "@/lib/store";
import { isAfterHours, manilaMinutes } from "@/lib/office-clock";
import { formatManilaSoon, nextSlot } from "@/lib/time";
import type { EmployeeId, EmployeeMeta, EmployeeStatus } from "@/lib/team";
import { PAL, SHIRTS, type Palette } from "./palette";
import { Person, applyPose, REST, type Look, type HairStyle, type Pose, type PersonRig } from "./Person";
import { Bubble, type Tone } from "./Bubble";
import { ICONS } from "./icons";
import { BINS, chairOf, commuteAt, pickupTimes, sample, trashRoute, trashRunT, type Route, type Sample } from "./routes";
import { useSceneNow } from "./scene-clock-ui";

const HAIR: readonly HairStyle[] = ["bun", "short", "short", "long", "neat", "long", "short", "bun"];
const PANTS = ["#2f3a4a", "#3b3f46", "#4b5563", "#1f2937"] as const;

/** Radians of stride per metre walked. */
const STRIDE = 4.8;

type Activity =
  | { kind: "seat" }
  | { kind: "away"; why: "home" | "paused" }
  | { kind: "route"; route: Route; t: number; reverse: boolean; purpose: "trash" | "leaving" | "arriving" };

function activityOf(min: number, meta: EmployeeMeta, index: number, status: EmployeeStatus, enabled: boolean, duty: EmployeeId | null): Activity {
  if (!enabled) return { kind: "away", why: "paused" };
  if (duty === meta.id) {
    const t = trashRunT(min, meta.id);
    if (t !== null) return { kind: "route", route: trashRoute(meta.id), t, reverse: false, purpose: "trash" };
  }
  if (status === "idle") {
    const c = commuteAt(min, meta, index);
    if (c) return { kind: "route", route: c.route, t: c.t, reverse: c.reverse, purpose: c.reverse ? "arriving" : "leaving" };
    if (isAfterHours(min)) return { kind: "away", why: "home" };
  }
  return { kind: "seat" };
}

/** Sample a route, walking it backwards for `reverse` (arriving in the morning). */
function sampleActivity(a: Extract<Activity, { kind: "route" }>): Sample {
  const s = sample(a.route, a.t);
  if (!a.reverse) return s;
  return { ...s, heading: s.moving ? s.heading + Math.PI : s.heading, dist: a.route.length - s.dist };
}

type Props = { meta: EmployeeMeta; index: number; pal: Palette; shadows: boolean; reducedMotion: boolean; duty: EmployeeId | null };

/** An employee: sits at their desk, gets up for the trash run, goes home at night. */
export function Employee3D({ meta, index, pal, shadows, reducedMotion, duty }: Props) {
  const emp = useEmployee(meta.id);
  const select = useOffice((s) => s.select);
  const selected = useOffice((s) => s.selected === meta.id);
  const enabled = emp?.enabled ?? true;
  const status: EmployeeStatus = emp?.status ?? "idle";
  const shirt = SHIRTS[meta.color - 1];

  const look: Look = useMemo(() => ({
    shirt, pants: PANTS[index % PANTS.length], skin: PAL.skin[index % PAL.skin.length], hair: pal.hair,
    hairStyle: HAIR[index % HAIR.length], shoes: pal.shoes,
  }), [shirt, index, pal]);

  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const bag = useRef<THREE.Group>(null);
  const rig = useRef<PersonRig | null>(null);
  const pose = useRef<Pose>({ ...REST });
  const live = useRef({ status, enabled, duty });
  live.current = { status, enabled, duty };
  const hop = useRef({ prev: status, at: -10 });
  const chair = chairOf(meta);
  const pickups = useMemo(() => (duty === meta.id ? [...pickupTimes(trashRoute(meta.id)).values()].sort((a, b) => a - b) : []), [duty, meta.id]);

  useFrame(({ clock }) => {
    const g = group.current, r = rig.current, b = body.current;
    if (!g || !r || !b) return;
    const { status: st, enabled: en, duty: d } = live.current;
    const min = manilaMinutes(sceneNow());
    const a = activityOf(min, meta, index, st, en, d);
    const p = pose.current;
    Object.assign(p, REST);
    p.time = reducedMotion ? 0 : clock.elapsedTime + index * 1.7;

    if (hop.current.prev === "working" && st !== "working") hop.current.at = clock.elapsedTime;
    hop.current.prev = st;
    const hopK = (clock.elapsedTime - hop.current.at) / 0.55;
    if (hopK >= 0 && hopK <= 1 && !reducedMotion) p.hop = hopK;

    b.visible = a.kind !== "away";
    if (bag.current) bag.current.visible = false;

    if (a.kind === "seat" || a.kind === "away") {
      g.position.set(chair.x, 0, chair.z);
      g.rotation.y = 0;
      p.sit = 1;
      if (a.kind === "seat") {
        if (st === "working") p.typing = 1;
        else if (st === "needs_you") p.wave = reducedMotion ? 0.6 : 1;
        else p.typing = 0.15 + Math.max(0, Math.sin(p.time * 0.5)) * 0.25; // the occasional idle keystroke
      }
    } else {
      const s = sampleActivity(a);
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.heading;
      p.walk = s.moving ? 1 : 0;
      p.stride = reducedMotion ? 0 : s.dist * STRIDE;
      if (s.act === "rise") p.sit = a.reverse ? s.actT : 1 - s.actT;
      if (s.act === "sit") p.sit = a.reverse ? 1 - s.actT : s.actT;
      if (a.purpose === "trash") {
        const done = pickups.filter((t) => t <= a.t).length;
        const tossing = s.act === "toss";
        if (s.act === "pickup") p.bend = Math.sin(s.actT * Math.PI);
        if (tossing) p.toss = s.actT;
        // the bag appears at the first bin, grows with each one, and goes into the dumpster mid-throw
        if (bag.current && done > 0 && !passedToss(a.route, a.t)) {
          bag.current.visible = true;
          bag.current.scale.setScalar(0.55 + (done / BINS.length) * 0.65);
          if (!tossing && s.act !== "pickup") p.carry = 1;
        }
      }
    }
    applyPose(r, p);
  });

  // Bubble text: re-rendered once a second from the scene clock.
  const now = useSceneNow(1000);
  const min = manilaMinutes(now);
  const activity = activityOf(min, meta, index, status, enabled, duty);
  const seated = activity.kind === "seat";
  let tone: Tone = "idle", label = "Idle", detail: string | undefined, Icon = ICONS[meta.icon], busy = false, attention = false, chip: string | undefined = shirt;

  if (activity.kind === "away") {
    chip = undefined;
    if (activity.why === "paused") { tone = "off"; label = "Paused"; Icon = Pause; detail = "Resume from the desk panel"; }
    else { tone = "off"; label = "Home"; Icon = House; detail = "Back 7:00 AM"; }
  } else if (activity.kind === "route") {
    chip = undefined;
    if (activity.purpose === "trash") {
      const done = pickups.filter((t) => t <= activity.t).length;
      tone = "duty"; label = "Trash run"; Icon = Trash2;
      detail = passedToss(activity.route, activity.t) ? "All taken out · heading back" : `${done}/${BINS.length} bins collected`;
    } else if (activity.purpose === "leaving") { tone = "off"; label = "Heading home"; Icon = LogOut; detail = "See you at 7 AM"; }
    else { tone = "idle"; label = "Clocking in"; Icon = LogIn; detail = "Good morning"; }
  } else if (status === "working") {
    tone = "working"; label = "Working"; busy = !reducedMotion; detail = meta.title;
  } else if (status === "needs_you") {
    tone = "needs"; label = "Needs you"; attention = !reducedMotion; Icon = BellRing; chip = undefined;
    detail = clip(emp?.summary) ?? "Tap to review";
  } else if (status === "error") {
    tone = "error"; label = "Error"; Icon = TriangleAlert; chip = undefined; detail = "Tap to see what happened";
  } else {
    const next = nextSlot(meta.schedule, now);
    detail = meta.schedule.kind === "always" ? "Checks every 5 minutes" : next ? `Next ${formatManilaSoon(next, now)}` : meta.title;
  }
  if (duty === meta.id && activity.kind === "seat" && min < 17 * 60 + 40) detail = `${detail ?? ""}${detail ? " · " : ""}trash duty 5:40 PM`;

  return (
    <group ref={group} position={[chair.x, 0, chair.z]}>
      <group
        ref={body}
        onClick={(e) => { e.stopPropagation(); if (e.delta <= 6) select(meta.id); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = ""; }}
      >
        <Person
          look={look}
          shadows={shadows}
          rig={rig}
          rightHand={
            <group ref={bag} visible={false} position={[0, -0.12, 0]}>
              <mesh scale={[1, 1.25, 1]}>
                <sphereGeometry args={[0.16, 12, 10]} />
                <meshStandardMaterial color={pal.bag} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.2, 0]}>
                <coneGeometry args={[0.05, 0.1, 8]} />
                <meshStandardMaterial color={pal.bag} roughness={0.35} />
              </mesh>
            </group>
          }
        />
      </group>
      <Bubble
        position={[0, seated || activity.kind === "away" ? 1.95 : 2.3, 0]}
        icon={Icon}
        tone={tone}
        chip={chip}
        name={meta.name}
        status={label}
        detail={detail}
        busy={busy}
        attention={attention}
        expanded={selected}
        onClick={() => select(meta.id)}
      />
    </group>
  );
}

/** Has the trash already gone into the dumpster on this run? */
function passedToss(route: Route, t: number): boolean {
  for (const e of route.entries) if (e.kind === "wait" && e.act === "toss") return t >= e.t0 + (e.t1 - e.t0) * 0.55;
  return false;
}

function clip(s: string | null | undefined, n = 34): string | null {
  if (!s) return null;
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

