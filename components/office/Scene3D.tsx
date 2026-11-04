"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useOffice, useTrashDuty } from "@/lib/store";
import { TEAM, teamById } from "@/lib/team";
import { MANILA_OFFSET_MS } from "@/lib/time";
import { useIsDesktop, usePrefersReducedMotion } from "@/hooks/use-media";
import { Room } from "./Room";
import { Desk3D, DRAG_PX } from "./Desk3D";
import { Employee3D } from "./Employee3D";
import { OwnerOffice } from "./OwnerOffice";
import { Owner, Janitor } from "./Staff";
import { Amenities } from "./Amenities";
import { Grounds } from "./Grounds";
import { Pets } from "./Pets";
import { Lighting } from "./Lighting";
import { BubbleZoomWatcher } from "./Bubble";
import { Deliveries } from "./Deliveries";
import { LabelLayer, LabelProjector } from "./Labels";
import { typingSources } from "@/lib/ambience";
import { chairOf, OWNER_CHAIR } from "./routes";
import { SceneControls } from "./SceneControls";
import { PAL, PAL_BLUSH, PAL_MANGO, DESK, ROOM, SCENE, OFFICE } from "./palette";
import { Neighbourhood } from "./Neighbourhood";
import { Traffic } from "./Traffic";
import { Vendors } from "./Vendors";
import { Holidays } from "./Holidays";
import { PlaceCard, PlaceHits } from "./Places";
import { TvModal } from "./TvModal";
import { NowPlayingFloat } from "./NowPlayingFloat";
import { SlowWatch } from "./SlowWatch";
import { Rider } from "./Rider";
import { Celebration } from "./Celebration";
import { SoundSystem } from "./SoundSystem";
import { TOWN } from "./world";
import { useSettings } from "@/lib/settings";
import { useStyleChoice } from "@/components/ThemePicker";
import { HQ } from "@/hq.config";

const { ACTION } = CameraControlsImpl;
const DEG = Math.PI / 180;

/** Default view: a true isometric angle, camera along the (1,1,1) diagonal from the target. */
const DEFAULT_AZIMUTH = 45 * DEG;
/** Portrait phones look down the length of the room instead, so it fills the tall screen. */
const PORTRAIT_AZIMUTH = 72 * DEG;
const DEFAULT_POLAR = Math.acos(1 / Math.sqrt(3)); // ≈ 54.7°
/** Far enough back that, zoomed all the way out at the flattest angle, the ground nearest the camera isn't clipped. */
const DISTANCE = 120;

/** How far the view may turn: always from the open front-right, so the two back walls never block the room. */
const AZIMUTH_RANGE = [12 * DEG, 78 * DEG] as const;
const POLAR_RANGE = [32 * DEG, 72 * DEG] as const;

type Box = { x0: number; x1: number; z0: number; z1: number };
/** Everything: room plus the pavement outside. */
const WHOLE: Box = { x0: SCENE.x0, x1: SCENE.x1, z0: SCENE.z0, z1: SCENE.z1 };
/** Portrait screens start on the team's floor (they can pan to the rest). */
const TEAM_FLOOR: Box = { x0: 0, x1: OFFICE.x0 + 0.4, z0: 0, z1: ROOM.D };

/** The camera target stays within the town (the ground and streets reach far past it, so no edge ever shows). */
const BOUNDS = new THREE.Box3(new THREE.Vector3(TOWN.x0, 0, TOWN.z0), new THREE.Vector3(TOWN.x1, ROOM.H, TOWN.z1));

const centerOf = (b: Box) => ({ x: (b.x0 + b.x1) / 2, y: ROOM.H / 2, z: (b.z0 + b.z1) / 2 });

/** Orthographic zoom (pixels per metre) that fits a box on screen, seen from the default angles. */
function fitZoom(width: number, height: number, box: Box, azimuth: number): number {
  const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
  const up = new THREE.Vector3(
    -Math.cos(DEFAULT_POLAR) * Math.sin(azimuth), Math.sin(DEFAULT_POLAR), -Math.cos(DEFAULT_POLAR) * Math.cos(azimuth),
  );
  const c = centerOf(box);
  const center = new THREE.Vector3(c.x, c.y, c.z);
  let maxX = 0, maxY = 0;
  for (const x of [box.x0, box.x1]) for (const y of [0, ROOM.H]) for (const z of [box.z0, box.z1]) {
    const d = new THREE.Vector3(x, y, z).sub(center);
    maxX = Math.max(maxX, Math.abs(d.dot(right)));
    maxY = Math.max(maxY, Math.abs(d.dot(up)));
  }
  const pad = 1.04;
  return Math.max(1, Math.min(width / (2 * maxX * pad), height / (2 * maxY * pad)));
}

/** Camera position for the default view of a target. */
function defaultEye(x: number, y: number, z: number, azimuth = DEFAULT_AZIMUTH): [number, number, number] {
  return [
    x + DISTANCE * Math.sin(DEFAULT_POLAR) * Math.sin(azimuth),
    y + DISTANCE * Math.cos(DEFAULT_POLAR),
    z + DISTANCE * Math.sin(DEFAULT_POLAR) * Math.cos(azimuth),
  ];
}

export type CameraRigHandle = { reset: () => void; zoom: (dir: 1 | -1) => void };

/**
 * Pan / zoom / turn the office (drei CameraControls), within limits.
 * Mouse: left-drag pans, right-drag turns, wheel zooms. Touch: one finger pans, two pinch-zoom and pan, three turn.
 * Selecting a desk glides to it; deselecting or "Reset view" goes back to the default framing.
 */
function CameraRig({ reducedMotion, handle }: { reducedMotion: boolean; handle: RefObject<CameraRigHandle | null> }) {
  const controls = useRef<CameraControlsImpl>(null);
  const size = useThree((s) => s.size);
  const selected = useOffice((s) => s.selected);
  const portrait = size.width / Math.max(1, size.height) < 0.95;
  const frame = portrait ? TEAM_FLOOR : WHOLE;
  const azimuth = portrait ? PORTRAIT_AZIMUTH : DEFAULT_AZIMUTH;
  const wholeZoom = fitZoom(size.width, size.height, WHOLE, azimuth);
  const frameZoom = fitZoom(size.width, size.height, frame, azimuth);
  const latest = useRef({ frame, frameZoom, wholeZoom, azimuth });
  latest.current = { frame, frameZoom, wholeZoom, azimuth };
  /** The user moved the camera themselves since the last reset, so a resize shouldn't snap it back. */
  const moved = useRef(false);
  const first = useRef(true);

  const frameView = (animate: boolean) => {
    const c = controls.current;
    if (!c) return;
    const t = centerOf(latest.current.frame);
    void c.setLookAt(...defaultEye(t.x, t.y, t.z, latest.current.azimuth), t.x, t.y, t.z, animate);
    void c.zoomTo(latest.current.frameZoom, animate);
  };

  // Limits that depend on the canvas size; refit while the user hasn't taken over.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    // zoom out far enough to see the neighbourhood, never so far that the ground's edge could show
    c.minZoom = Math.max(wholeZoom * 0.45, Math.max(size.width, size.height) / 150);
    c.maxZoom = Math.max(frameZoom, wholeZoom) * 5;
    c.setBoundary(BOUNDS);
    if (!moved.current && !useOffice.getState().selected) frameView(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wholeZoom, frameZoom, azimuth, size.width, size.height]);

  // Glide to the selected desk, or back to the default framing.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const animate = !reducedMotion && !first.current;
    first.current = false;
    if (!selected) {
      moved.current = false;
      frameView(animate);
      return;
    }
    const meta = teamById[selected];
    void c.moveTo(meta.desk.x + DESK.W / 2, 0.8, meta.desk.y + DESK.D / 2 + 0.4, animate);
    void c.zoomTo(Math.max(latest.current.frameZoom, latest.current.wholeZoom) * 2.2, animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    handle.current = {
      reset: () => {
        moved.current = false;
        frameView(!reducedMotion);
      },
      zoom: (dir) => {
        const c = controls.current;
        if (!c) return;
        moved.current = true;
        void c.zoomTo(c.camera.zoom * (dir > 0 ? 1.4 : 1 / 1.4), !reducedMotion);
      },
    };
    return () => { handle.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, reducedMotion]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minAzimuthAngle={AZIMUTH_RANGE[0]}
      maxAzimuthAngle={AZIMUTH_RANGE[1]}
      minPolarAngle={POLAR_RANGE[0]}
      maxPolarAngle={POLAR_RANGE[1]}
      dollyToCursor
      smoothTime={reducedMotion ? 0 : 0.3}
      draggingSmoothTime={reducedMotion ? 0 : 0.12}
      mouseButtons={{ left: ACTION.TRUCK, middle: ACTION.ZOOM, right: ACTION.ROTATE, wheel: ACTION.ZOOM }}
      touches={{ one: ACTION.TOUCH_TRUCK, two: ACTION.TOUCH_ZOOM_TRUCK, three: ACTION.TOUCH_ROTATE }}
      onControlStart={() => { moved.current = true; }}
    />
  );
}

/**
 * Low-power and minimal-motion modes render on demand: this asks for `fps` frames a second instead of
 * every display refresh (30 for low power, 12 for minimal motion, where little moves anyway).
 */
function FrameCap({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const t = setInterval(() => invalidate(), 1000 / fps);
    return () => clearInterval(t);
  }, [invalidate, fps]);
  useFrame(() => undefined);
  return null;
}

const ear = new THREE.Vector3();
const smooth = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/**
 * Feeds the ambience its typing sources: each working desk (and Ronald's) gets a loudness from how close
 * you're looking at it. Zoomed out on the whole office it's silent; zoomed in, desks near the middle of the
 * view are clear and ones toward the edge fade out. Stereo position follows where the desk is on screen.
 */
function SoundListener() {
  const employees = useOffice((s) => s.data.employees);
  const frame = useRef(0);
  useFrame(({ camera }) => {
    if (frame.current++ % 6) return; // ~10 times a second is plenty
    const zoomK = smooth(50, 120, camera.zoom); // px per metre: whole office ≈ 45–55, a selected desk ≈ 110+
    const place = (id: string, x: number, z: number, loud: boolean) => {
      if (!loud || zoomK <= 0) { typingSources.delete(id); return; }
      ear.set(x, 1.0, z).project(camera);
      const r2 = ear.x * ear.x + ear.y * ear.y;
      const inView = Math.abs(ear.x) < 1.1 && Math.abs(ear.y) < 1.1;
      const gain = inView ? zoomK * Math.max(0, 1 - r2 / 1.3) : 0;
      typingSources.set(id, { gain, pan: Math.max(-1, Math.min(1, ear.x)) * 0.8 });
    };
    for (const m of TEAM) {
      const e = employees.find((x) => x.id === m.id);
      const c = chairOf(m);
      place(m.id, c.x, c.z, !!e?.enabled && e.status === "working");
    }
    place("owner", OWNER_CHAIR.x, OWNER_CHAIR.z, true);
  });
  return null;
}

const manilaDate = (ms: number): string => new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);

export default function Scene3D() {
  const isDesktop = useIsDesktop();
  const prefersReduced = usePrefersReducedMotion();
  const minimal = useSettings((s) => s.motion === "minimal");
  const show = useSettings((s) => s.show);
  const [style] = useStyleChoice();
  /** Reduced motion (OS setting) or minimal motion (Settings): no idle animation, no camera glides. */
  const reducedMotion = prefersReduced || minimal;
  const select = useOffice((s) => s.select);
  const employees = useOffice((s) => s.data.employees);
  const duty = useTrashDuty();
  const rig = useRef<CameraRigHandle | null>(null);
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const lowPower = useOffice((s) => s.lowPower);
  const loadWeather = useOffice((s) => s.loadWeather);
  const pal = style === "blush" ? PAL_BLUSH : style === "mango" ? PAL_MANGO : PAL;
  const capped = lowPower || minimal;
  const shadows = isDesktop && !lowPower;

  // Live weather at the office, refreshed every 10 minutes (and when you come back to the tab).
  useEffect(() => {
    void loadWeather();
    const t = setInterval(() => void loadWeather(), 10 * 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void loadWeather(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [loadWeather]);

  const todayKey = manilaDate(Date.now());
  const done = employees.flatMap((e) => e.runs).filter((r) =>
    r.status !== "error" && r.status !== "running" && manilaDate(new Date(r.started_at).getTime()) === todayKey).length;
  const waiting = employees.filter((e) => e.status === "needs_you").length;

  return (
    <div
      className="relative size-full"
      onPointerDownCapture={(e) => { pressAt.current = { x: e.clientX, y: e.clientY }; }}
    >
      <Canvas
        orthographic
        shadows={shadows}
        dpr={lowPower ? 1 : isDesktop ? [1, 2] : [1, 1.75]}
        frameloop={capped ? "demand" : "always"}
        camera={{ position: defaultEye(centerOf(WHOLE).x, ROOM.H / 2, centerOf(WHOLE).z), zoom: 30, near: 0.1, far: 700 }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={(e) => {
          // A drag that pans the camera also ends in a "click" on empty floor; only a real click deselects.
          const from = pressAt.current;
          if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > DRAG_PX) return;
          select(null);
        }}
        aria-label={`${HQ.appName} in 3D. Drag to move around, pinch or scroll to zoom. Select a person or desk to open it.`}
        role="img"
      >
        <AdaptiveDpr pixelated={false} />
        {capped && <FrameCap fps={minimal ? 12 : 30} />}
        <SlowWatch />
        <Lighting shadows={shadows} />
        <BubbleZoomWatcher />
        <LabelProjector />
        <SoundListener />
        <Room pal={pal} shadows={shadows} done={done} waiting={waiting} trashName={duty ? teamById[duty].name : null} />
        <SoundSystem pal={pal} shadows={shadows} reducedMotion={reducedMotion} x0={3.2} x1={8.1} />
        <OwnerOffice pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
        <Grounds pal={pal} shadows={shadows} />
        {show.neighbourhood && <Neighbourhood />}
        {show.neighbourhood && <PlaceHits />}
        {show.traffic && !minimal && <Traffic />}
        {show.vendors && <Vendors shadows={shadows} frozen={minimal} />}
        <Rider shadows={shadows} frozen={minimal} />
        <Celebration shadows={shadows} />
        {show.holidays && <Holidays />}
        {show.pets && <Pets frozen={minimal} />}
        <Amenities pal={pal} shadows={shadows} assignee={duty} />
        {TEAM.map((meta, i) => (
          <Desk3D key={meta.id} meta={meta} index={i} pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
        ))}
        {TEAM.map((meta, i) => (
          <Employee3D key={meta.id} meta={meta} index={i} pal={pal} shadows={shadows} reducedMotion={reducedMotion} duty={duty} />
        ))}
        <Owner pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
        <Janitor pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
        <Deliveries />
        <CameraRig reducedMotion={reducedMotion} handle={rig} />
      </Canvas>

      <LabelLayer />
      <PlaceCard />
      <NowPlayingFloat />
      <TvModal done={done} waiting={waiting} trashName={duty ? teamById[duty].name : null} />

      <SceneControls
        onReset={() => { select(null); rig.current?.reset(); }}
        onZoom={(dir) => rig.current?.zoom(dir)}
      />
    </div>
  );
}
