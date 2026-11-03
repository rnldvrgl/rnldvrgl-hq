"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
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
import { Lighting } from "./Lighting";
import { BubbleZoomWatcher } from "./Bubble";
import { SceneControls } from "./SceneControls";
import { PAL, DESK, ROOM, SCENE, OFFICE } from "./palette";

const { ACTION } = CameraControlsImpl;
const DEG = Math.PI / 180;

/** Default view: a true isometric angle, camera along the (1,1,1) diagonal from the target. */
const DEFAULT_AZIMUTH = 45 * DEG;
/** Portrait phones look down the length of the room instead, so it fills the tall screen. */
const PORTRAIT_AZIMUTH = 72 * DEG;
const DEFAULT_POLAR = Math.acos(1 / Math.sqrt(3)); // ≈ 54.7°
const DISTANCE = 34;

/** How far the view may turn: always from the open front-right, so the two back walls never block the room. */
const AZIMUTH_RANGE = [12 * DEG, 78 * DEG] as const;
const POLAR_RANGE = [32 * DEG, 72 * DEG] as const;

type Box = { x0: number; x1: number; z0: number; z1: number };
/** Everything: room plus the pavement outside. */
const WHOLE: Box = { x0: SCENE.x0, x1: SCENE.x1, z0: SCENE.z0, z1: SCENE.z1 };
/** Portrait screens start on the team's floor (they can pan to the rest). */
const TEAM_FLOOR: Box = { x0: 0, x1: OFFICE.x0 + 0.4, z0: 0, z1: ROOM.D };

/** The camera target can't leave the diorama. */
const BOUNDS = new THREE.Box3(new THREE.Vector3(WHOLE.x0, 0, WHOLE.z0), new THREE.Vector3(WHOLE.x1, ROOM.H, WHOLE.z1));

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
    c.minZoom = wholeZoom * 0.8;
    c.maxZoom = Math.max(frameZoom, wholeZoom) * 5;
    c.setBoundary(BOUNDS);
    if (!moved.current && !useOffice.getState().selected) frameView(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wholeZoom, frameZoom, azimuth]);

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

const manilaDate = (ms: number): string => new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);

export default function Scene3D() {
  const isDesktop = useIsDesktop();
  const reducedMotion = usePrefersReducedMotion();
  const select = useOffice((s) => s.select);
  const employees = useOffice((s) => s.data.employees);
  const duty = useTrashDuty();
  const rig = useRef<CameraRigHandle | null>(null);
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const pal = PAL;
  const shadows = isDesktop;

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
        dpr={isDesktop ? [1, 2] : [1, 1.75]}
        camera={{ position: defaultEye(centerOf(WHOLE).x, ROOM.H / 2, centerOf(WHOLE).z), zoom: 30, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={(e) => {
          // A drag that pans the camera also ends in a "click" on empty floor; only a real click deselects.
          const from = pressAt.current;
          if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > DRAG_PX) return;
          select(null);
        }}
        aria-label="rnldvrgl HQ in 3D. Drag to move around, pinch or scroll to zoom. Select a person or desk to open it."
        role="img"
      >
        <AdaptiveDpr pixelated={false} />
        <Lighting shadows={shadows} />
        <BubbleZoomWatcher />
        <Room pal={pal} shadows={shadows} done={done} waiting={waiting} trashName={duty ? teamById[duty].name : null} />
        <OwnerOffice pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
        <Amenities pal={pal} shadows={shadows} assignee={duty} />
        {TEAM.map((meta, i) => (
          <Desk3D key={meta.id} meta={meta} index={i} pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
        ))}
        {TEAM.map((meta, i) => (
          <Employee3D key={meta.id} meta={meta} index={i} pal={pal} shadows={shadows} reducedMotion={reducedMotion} duty={duty} />
        ))}
        <Owner pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
        <Janitor pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
        <CameraRig reducedMotion={reducedMotion} handle={rig} />
      </Canvas>

      <SceneControls
        onReset={() => { select(null); rig.current?.reset(); }}
        onZoom={(dir) => rig.current?.zoom(dir)}
      />
    </div>
  );
}
