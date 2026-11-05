"use client";

import { NEED_LABEL } from "@/lib/hiring";
import { ownerName, ownersName } from "@/lib/names";
import { useMemo, useRef, type Ref } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BellRing, UserPlus, House, Pause, Trash2, TriangleAlert, LogIn, LogOut, UtensilsCrossed, Users, Wind, Presentation } from "lucide-react";
import { useOffice, useEmployee, sceneNow } from "@/lib/store";
import { isAfterHours, isWeekday, manilaMinutes } from "@/lib/office-clock";
import { formatManilaSoon, nextSlot } from "@/lib/time";
import type { EmployeeId, EmployeeMeta, EmployeeStatus } from "@/lib/team";
import { PAL, SHIRTS, type Palette } from "./palette";
import { Person, applyPose, REST, type Look, type HairStyle, type Pose, type PersonRig } from "./Person";
import { Bubble, type Tone } from "./Bubble";
import { ICONS } from "./icons";
import {
  actWindows, chairOf, commute, commuteAt, deskCenterX, dropRoute, dropRunT, lunchRoute, lunchRunT, sample, standupRoute, standupRunT,
  trashRoute, trashRunT, meetingRoute, meetingRunT, placeRoute, placeSpot, sample as sampleRoute, type Place, type Route, type Sample,
} from "./routes";
import { launchDelivery } from "./Deliveries";
import { overrideAt, useCommute } from "./commuteOverride";
import { useSceneNow } from "./scene-clock-ui";
import { clockLabel, useSettings, workHours } from "@/lib/settings";

const HAIR: readonly HairStyle[] = ["bun", "short", "short", "long", "neat", "long", "short", "bun"];
const PANTS = ["#2f3a4a", "#3b3f46", "#4b5563", "#1f2937"] as const;

/** Radians of stride per metre walked. */
const STRIDE = 4.8;

type Purpose = "collect" | "drop" | "lunch" | "standup" | "meeting" | "vape" | "leaving" | "arriving";
type Activity =
  | { kind: "seat" }
  | { kind: "away"; why: "home" | "paused" | "unhired" }
  | { kind: "route"; route: Route; t: number; reverse: boolean; purpose: Purpose };

/**
 * What an employee is doing at `min` (Manila minutes), in priority order: paused → away; 5:40 PM trash
 * run (today's collector); 5:30 PM drop-off (everyone); then, only if idle, the weekday stand-up, lunch,
 * the commute and being home for the night. Anyone busy stays at their desk.
 */
export function activityOf(min: number, weekday: boolean, meta: EmployeeMeta, index: number, status: EmployeeStatus, enabled: boolean, duty: EmployeeId | null): Activity {
  if (!enabled) return { kind: "away", why: "paused" };
  // this HQ hasn't connected what they need yet (Settings → Connections)
  if (useOffice.getState().data.hiring?.[meta.id]?.length) return { kind: "away", why: "unhired" };
  // sent home or called in by hand (the desk panel): walk now, stay until the schedule catches up
  const o = overrideAt(meta.id, sceneNow().getTime());
  if (o) {
    const r = commute(meta);
    if (o.mode === "home") return o.t <= r.duration ? { kind: "route", route: r, t: o.t, reverse: false, purpose: "leaving" } : { kind: "away", why: "home" };
    if (o.t <= r.duration) return { kind: "route", route: r, t: r.duration - o.t, reverse: true, purpose: "arriving" };
    return { kind: "seat" };
  }
  const on = useSettings.getState().routine;
  const route = (purpose: Purpose, r: Route, t: number): Activity => ({ kind: "route", route: r, t, reverse: false, purpose });
  if (duty === meta.id && on.trashRun) {
    const t = trashRunT(min, meta.id);
    if (t !== null) return route("collect", trashRoute(meta.id), t);
  }
  const drop = on.trashDrop ? dropRunT(min, meta.id) : null;
  if (drop !== null) return route("drop", dropRoute(meta.id), drop);
  if (status === "idle") {
    if (weekday && on.standup) {
      const t = standupRunT(min, meta.id);
      if (t !== null) return route("standup", standupRoute(meta.id), t);
    }
    if (weekday && on.meeting) {
      const t = meetingRunT(min, meta.id);
      if (t !== null) return route("meeting", meetingRoute(meta.id), t);
    }
    const lunch = on.lunch ? lunchRunT(min, meta.id) : null;
    if (lunch !== null) return route("lunch", lunchRoute(meta.id), lunch);
    const hours = workHours("team");
    const c = on.commute ? commuteAt(min, meta, index, hours) : null;
    if (c) return { kind: "route", route: c.route, t: c.t, reverse: c.reverse, purpose: c.reverse ? "arriving" : "leaving" };
    if (isAfterHours(min, hours)) return { kind: "away", why: "home" };
  }
  return { kind: "seat" };
}

/** The vape cloud: puffs animated by vapePose. */
export function VaporPuffs({ ref }: { ref: Ref<THREE.Group> }) {
  return (
    <group ref={ref} visible={false}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => (
        <mesh key={j}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#ffffff" emissive="#eef2f6" emissiveIntensity={0.6} transparent opacity={0.6} depthWrite={false} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Vaping: a 7-second cycle (draw, exhale a cloud, chat), plus the cloud itself. */
export function vapePose(p: Pose, vapor: THREE.Group | null, reducedMotion: boolean): void {
  const k = (p.time % 7) / 7;
  p.mug = k < 0.2 ? 1 : 0;
  p.nod = k > 0.6 && k < 0.8 ? 1 : 0;
  if (!vapor) return;
  vapor.visible = !reducedMotion;
  if (reducedMotion) return;
  vapor.children.forEach((c, j) => {
    // puffs 0–5: the exhaled cloud (staggered, growing, drifting up and away); 6–7: a thin wisp in between
    const wisp = j >= 6;
    const e = wisp ? ((p.time * 0.5 + j * 0.5) % 1) : Math.min(1, Math.max(0, (k - 0.22 - j * 0.035) / 0.55));
    c.visible = e > 0 && e < 1;
    const drift = wisp ? 0.04 : 0.16;
    // the cloud billows forward, then rises up through and above the pergola roof (2.5 m) so it stays visible
    c.position.set(Math.sin(j * 2.1 + p.time * 0.6) * drift * (1 + e * 2), (wisp ? 1.3 : 1.72) + e * (wisp ? 0.45 : 1.45), (wisp ? -0.32 : -0.28) - Math.min(e, 0.4) * (wisp ? 0.1 : 0.7));
    c.scale.setScalar(wisp ? 0.03 + e * 0.07 : 0.09 + e * 0.5);
    const mat = c instanceof THREE.Mesh ? c.material : null;
    if (mat instanceof THREE.MeshStandardMaterial) mat.opacity = (wisp ? 0.45 : 0.9) * (1 - Math.pow(e, 1.6)) * (wisp && k < 0.2 ? 0 : 1);
  });
}

/** Where someone's status puts them between scheduled events. */
function wantPlace(status: EmployeeStatus): Place {
  const on = useSettings.getState().routine;
  if (status === "idle" && on.idleBreaks) return "vape";
  if (status === "error" && on.errorHelp) return "boss";
  return "desk";
}

type PlaceState = { init: boolean; at: Place; slot: number; to: Place; toSlot: number; route: Route | null; start: number };

/** Is `t` past the middle of the first stop with this act? */
function past(route: Route, act: "pickup" | "drop" | "toss", t: number): boolean {
  const w = actWindows(route, act)[0];
  return w !== undefined && t >= w[0] + (w[1] - w[0]) * 0.55;
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
  useSettings((s) => s.routine); // re-render the bubble when the daily routine changes
  useSettings((s) => s.hours);
  useCommute((s) => s.overrides[meta.id]);
  const status: EmployeeStatus = emp?.status ?? "idle";
  const shirt = SHIRTS[meta.color - 1];

  const look: Look = useMemo(() => ({
    shirt, pants: PANTS[index % PANTS.length], skin: PAL.skin[index % PAL.skin.length], hair: pal.hair,
    hairStyle: HAIR[index % HAIR.length], shoes: pal.shoes,
  }), [shirt, index, pal]);

  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const bag = useRef<THREE.Group>(null);
  const vapor = useRef<THREE.Group>(null);
  const rig = useRef<PersonRig | null>(null);
  const pose = useRef<Pose>({ ...REST });
  // spot in Ronald's office among everyone currently showing an error (desk order)
  const errorSlot = useOffice((s) => s.data.employees.filter((e) => e.enabled && e.status === "error").map((e) => e.id).indexOf(meta.id));
  const live = useRef({ status, enabled, duty, errorSlot });
  live.current = { status, enabled, duty, errorSlot };
  const place = useRef<PlaceState>({ init: false, at: "desk", slot: 0, to: "desk", toSlot: 0, route: null, start: 0 });
  const hop = useRef({ prev: status, at: -10 });
  const chair = chairOf(meta);

  useFrame(({ clock }) => {
    const g = group.current, r = rig.current, b = body.current;
    if (!g || !r || !b) return;
    const { status: st, enabled: en, duty: d, errorSlot: es } = live.current;
    const now = sceneNow();
    const min = manilaMinutes(now);
    const a = activityOf(min, isWeekday(now), meta, index, st, en, d);
    const p = pose.current;
    Object.assign(p, REST);
    p.time = reducedMotion ? 0 : clock.elapsedTime + index * 1.7;

    if (hop.current.prev === "working" && st !== "working") {
      hop.current.at = clock.elapsedTime;
      // the finished report flies over to Ronald's desk
      launchDelivery({ x: deskCenterX(meta), z: meta.desk.y + 0.3 }, st === "error" ? "error" : st === "needs_you" ? "needs" : "done");
    }
    hop.current.prev = st;
    const hopK = (clock.elapsedTime - hop.current.at) / 0.55;
    if (hopK >= 0 && hopK <= 1 && !reducedMotion) p.hop = hopK;

    b.visible = a.kind !== "away";
    if (vapor.current) vapor.current.visible = false;
    if (bag.current) bag.current.visible = false;

    const ps = place.current;
    const walkAlong = (smp: Sample, reverse: boolean) => {
      g.position.set(smp.x, 0, smp.z);
      g.rotation.y = smp.heading;
      p.walk = smp.moving ? 1 : 0;
      p.stride = reducedMotion ? 0 : smp.dist * STRIDE;
      if (smp.act === "rise") p.sit = reverse ? smp.actT : 1 - smp.actT;
      if (smp.act === "sit") p.sit = reverse ? 1 - smp.actT : smp.actT;
    };

    if (a.kind === "away") {
      ps.init = true; ps.at = "desk"; ps.route = null;
      g.position.set(chair.x, 0, chair.z);
      g.rotation.y = 0;
      p.sit = 1;
    } else if (a.kind === "seat") {
      // between scheduled events: go where the status says (idle → vape patio, error → Ronald's office, else desk)
      const nowS = performance.now() / 1000;
      const want = wantPlace(st);
      const slot = want === "boss" ? Math.max(0, es) : 0;
      if (!ps.init) { ps.init = true; ps.at = want; ps.slot = slot; } // first frame: already there
      if (ps.route && nowS - ps.start >= ps.route.duration) { ps.at = ps.to; ps.slot = ps.toSlot; ps.route = null; }
      if (!ps.route && (ps.at !== want || (want === "boss" && ps.slot !== slot))) {
        ps.route = placeRoute(meta.id, ps.at, want, ps.slot, slot);
        ps.to = want; ps.toSlot = slot; ps.start = nowS;
      }
      if (ps.route) {
        walkAlong(sampleRoute(ps.route, nowS - ps.start), false);
      } else if (ps.at === "desk") {
        g.position.set(chair.x, 0, chair.z);
        g.rotation.y = 0;
        p.sit = 1;
        if (st === "working") p.typing = 1;
        else if (st === "needs_you") p.wave = reducedMotion ? 0.6 : 1;
        else p.typing = 0.15 + Math.max(0, Math.sin(p.time * 0.5)) * 0.25; // the occasional idle keystroke
      } else {
        const spot = placeSpot(meta, ps.at, ps.slot);
        g.position.set(spot.x, 0, spot.z);
        g.rotation.y = spot.face ?? 0;
        if (spot.seated) p.sit = 1;
        if (ps.at === "vape") vapePose(p, vapor.current, reducedMotion || !useSettings.getState().show.smoke);
        else p.nod = Math.sin(p.time * 0.35) > 0.9 ? 1 : 0; // waiting for Ronald, the odd glance up
      }
    } else {
      ps.init = true; ps.at = "desk"; ps.route = null; // scheduled routes start and end at the desk

      const s = sampleActivity(a);
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.heading;
      p.walk = s.moving ? 1 : 0;
      p.stride = reducedMotion ? 0 : s.dist * STRIDE;
      if (s.act === "rise") p.sit = a.reverse ? s.actT : 1 - s.actT;
      if (s.act === "sit") p.sit = a.reverse ? 1 - s.actT : s.actT;
      if (s.act === "pickup" || s.act === "drop") p.bend = Math.sin(s.actT * Math.PI);
      if (s.act === "toss") p.toss = s.actT;
      if (s.act === "eat") {
        p.sit = 1;
        // a bite now and then, chatting in between
        p.mug = Math.max(0, Math.sin(p.time * 0.9)) > 0.75 ? 1 : 0;
        p.nod = Math.sin(p.time * 0.3) > 0.6 ? 1 : 0;
      }
      if (s.act === "vape") vapePose(p, vapor.current, reducedMotion || !useSettings.getState().show.smoke);
      if (s.act === "meet") {
        p.sit = 1;
        // taking notes, nodding along, the odd word
        p.typing = Math.sin(p.time * 0.45 + index) > 0.4 ? 0.45 : 0;
        p.nod = Math.sin(p.time * 0.6 + index * 2) > 0.85 ? 1 : 0;
      }
      if (s.act === "listen") p.nod = Math.sin(p.time * 0.4 + index) > 0.85 ? 1 : 0;
      // bags: a small one from your desk bin to the main bin; the collector's big one out to the dumpster
      if (bag.current && (a.purpose === "drop" || a.purpose === "collect")) {
        const from = past(a.route, "pickup", a.t);
        const until = a.purpose === "drop" ? past(a.route, "drop", a.t) : past(a.route, "toss", a.t);
        if (from && !until) {
          bag.current.visible = true;
          bag.current.scale.setScalar(a.purpose === "drop" ? 0.6 : 1.25);
          if (s.act !== "pickup" && s.act !== "drop" && s.act !== "toss") p.carry = 1;
        }
      }
    }
    applyPose(r, p);
  });

  // Bubble text: re-rendered once a second from the scene clock.
  const now = useSceneNow(1000);
  const min = manilaMinutes(now);
  const activity = activityOf(min, isWeekday(now), meta, index, status, enabled, duty);
  const meetingSeated = activity.kind === "route" && activity.purpose === "meeting" && sample(activity.route, activity.t).act === "meet";
  const seated = meetingSeated || (activity.kind === "seat" && !place.current.route && placeSpot(meta, place.current.at, place.current.slot).seated) || (activity.kind === "route" && activity.purpose === "lunch" && sample(activity.route, activity.t).act === "eat");
  let tone: Tone = "idle", label = "Idle", detail: string | undefined, Icon = ICONS[meta.icon], busy = false, attention = false, chip: string | undefined = shirt;

  if (activity.kind === "away") {
    chip = undefined;
    if (activity.why === "paused") { tone = "off"; label = "Paused"; Icon = Pause; detail = "Resume from the desk panel"; }
    else if (activity.why === "unhired") {
      tone = "off"; label = "Not hired yet"; Icon = UserPlus;
      detail = `Needs ${(useOffice.getState().data.hiring?.[meta.id] ?? []).map((n) => NEED_LABEL[n]).join(" and ")}`;
    }
    else { tone = "off"; label = "Home"; Icon = House; detail = `Back ${clockLabel(useSettings.getState().hours.teamIn)}`; }
  } else if (activity.kind === "route") {
    chip = undefined;
    if (activity.purpose === "collect") {
      tone = "duty"; label = "Trash run"; Icon = Trash2;
      detail = past(activity.route, "toss", activity.t) ? "Taken out · heading back" : past(activity.route, "pickup", activity.t) ? "Taking it outside" : "Getting the main bin";
    } else if (activity.purpose === "drop") {
      tone = "duty"; label = "Binning trash"; Icon = Trash2; detail = "To the main bin";
    } else if (activity.purpose === "lunch") {
      tone = "idle"; label = "Lunch"; Icon = UtensilsCrossed; detail = "Back 12:55 PM";
    } else if (activity.purpose === "vape") {
      tone = "idle"; label = "Vape break"; Icon = Wind; detail = "Outside · back 4:30 PM";
    } else if (activity.purpose === "meeting") {
      tone = "idle"; label = "Team sync"; Icon = Presentation; detail = "Meeting room · until 2:15 PM";
    } else if (activity.purpose === "standup") {
      tone = "idle"; label = "Stand-up"; Icon = Users; detail = "Daily 9:00 AM";
    } else if (activity.purpose === "leaving") { tone = "off"; label = "Heading home"; Icon = LogOut; detail = `See you at ${clockLabel(useSettings.getState().hours.teamIn)}`; }
    else { tone = "idle"; label = "Clocking in"; Icon = LogIn; detail = "Good morning"; }
  } else if (status === "working") {
    tone = "working"; label = "Working"; busy = !reducedMotion; detail = meta.title;
  } else if (status === "needs_you") {
    tone = "needs"; label = "Needs you"; attention = !reducedMotion; Icon = BellRing; chip = undefined;
    detail = clip(emp?.summary) ?? "Tap to review";
  } else if (status === "error") {
    tone = "error"; label = "Error"; Icon = TriangleAlert; chip = undefined;
    detail = place.current.route ? `Going to ${ownerName()} for help` : place.current.at === "boss" ? `Waiting in ${ownersName()} office` : "Tap to see what happened";
  } else {
    const next = nextSlot(meta.schedule, now);
    const nextText = meta.schedule.kind === "always" ? "Checks every 5 minutes" : next ? `Next ${formatManilaSoon(next, now)}` : meta.title;
    if (place.current.route && place.current.to === "vape") { label = "Break"; Icon = Wind; chip = undefined; detail = "Heading out for a vape"; }
    else if (place.current.at === "vape" && !place.current.route) { label = "On break"; Icon = Wind; chip = undefined; detail = `Vape area · ${nextText}`; }
    else detail = nextText;
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
      <VaporPuffs ref={vapor} />
      <Bubble
        id={meta.id}
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

function clip(s: string | null | undefined, n = 34): string | null {
  if (!s) return null;
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

