"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr, CameraControls, CameraControlsImpl } from "@react-three/drei";
import { LocateFixed } from "lucide-react";
import { useOffice } from "@/lib/store";
import { TEAM, teamById } from "@/lib/team";
import { useIsDesktop, usePrefersDark, usePrefersReducedMotion } from "@/hooks/use-media";
import { Room } from "./Room";
import { Desk3D, DRAG_PX } from "./Desk3D";
import { OwnerOffice } from "./OwnerOffice";
import { DAY, NIGHT, DESK, CENTER, ROOM } from "./palette";

const { ACTION } = CameraControlsImpl;
const DEG = Math.PI / 180;

/** Default view: a true isometric angle, camera along the (1,1,1) diagonal from the room centre. */
const DEFAULT_AZIMUTH = 45 * DEG;
const DEFAULT_POLAR = Math.acos(1 / Math.sqrt(3)); // ≈ 54.7°
const DISTANCE = 30;

/** How far the view may turn: always from the open front-right, so the two back walls never block the room. */
const AZIMUTH_RANGE = [12 * DEG, 78 * DEG] as const;
const POLAR_RANGE = [32 * DEG, 72 * DEG] as const;

/** The camera target can't leave the room. */
const BOUNDS = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(ROOM.W, ROOM.H, ROOM.D));

const ROOM_CORNERS: THREE.Vector3[] = [0, 1].flatMap((i) =>
  [0, 1].flatMap((j) => [0, 1].map((k) => new THREE.Vector3(i * ROOM.W, j * ROOM.H, k * ROOM.D))),
);

/** Orthographic zoom that fits the whole room on screen, seen from the given angles around CENTER. */
function fitZoom(width: number, height: number, azimuth: number, polar: number): number {
  const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
  const up = new THREE.Vector3(-Math.cos(polar) * Math.sin(azimuth), Math.sin(polar), -Math.cos(polar) * Math.cos(azimuth));
  const center = new THREE.Vector3(CENTER.x, CENTER.y, CENTER.z);
  let maxX = 0, maxY = 0;
  for (const c of ROOM_CORNERS) {
    const d = c.clone().sub(center);
    maxX = Math.max(maxX, Math.abs(d.dot(right)));
    maxY = Math.max(maxY, Math.abs(d.dot(up)));
  }
  const pad = 1.06;
  return Math.max(1, Math.min(width / (2 * maxX * pad), height / (2 * maxY * pad)));
}

/** Camera position for the default view of a target. */
function defaultEye(x: number, y: number, z: number): [number, number, number] {
  return [
    x + DISTANCE * Math.sin(DEFAULT_POLAR) * Math.sin(DEFAULT_AZIMUTH),
    y + DISTANCE * Math.cos(DEFAULT_POLAR),
    z + DISTANCE * Math.sin(DEFAULT_POLAR) * Math.cos(DEFAULT_AZIMUTH),
  ];
}

export type CameraRigHandle = { reset: () => void };

/**
 * Pan / zoom / turn the office (drei CameraControls), within limits.
 * Mouse: left-drag pans, right-drag turns, wheel zooms. Touch: one finger pans, two pinch-zoom and pan, three turn.
 * Selecting a desk glides to it; deselecting or "Reset view" goes back to the whole room.
 */
function CameraRig({ reducedMotion, handle }: { reducedMotion: boolean; handle: RefObject<CameraRigHandle | null> }) {
  const controls = useRef<CameraControlsImpl>(null);
  const size = useThree((s) => s.size);
  const selected = useOffice((s) => s.selected);
  const baseZoom = fitZoom(size.width, size.height, DEFAULT_AZIMUTH, DEFAULT_POLAR);
  const baseZoomRef = useRef(baseZoom);
  baseZoomRef.current = baseZoom;
  /** The user moved the camera themselves since the last reset, so a resize shouldn't snap it back. */
  const moved = useRef(false);
  const first = useRef(true);

  const frameRoom = (animate: boolean) => {
    const c = controls.current;
    if (!c) return;
    void c.setLookAt(...defaultEye(CENTER.x, CENTER.y, CENTER.z), CENTER.x, CENTER.y, CENTER.z, animate);
    void c.zoomTo(baseZoomRef.current, animate);
  };

  // Limits that depend on the canvas size; refit while the user hasn't taken over.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.minZoom = baseZoom * 0.75;
    c.maxZoom = baseZoom * 5;
    c.setBoundary(BOUNDS);
    if (!moved.current && !useOffice.getState().selected) frameRoom(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseZoom]);

  // Glide to the selected desk, or back to the whole room.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const animate = !reducedMotion && !first.current;
    first.current = false;
    if (!selected) {
      moved.current = false;
      frameRoom(animate);
      return;
    }
    const meta = teamById[selected];
    void c.moveTo(meta.desk.x + DESK.W / 2, 0.7, meta.desk.y + DESK.D / 2 + 0.3, animate);
    void c.zoomTo(baseZoomRef.current * 2.2, animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    handle.current = {
      reset: () => {
        moved.current = false;
        frameRoom(!reducedMotion);
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
      verticalDragToForward
      dollyToCursor
      smoothTime={reducedMotion ? 0 : 0.3}
      draggingSmoothTime={reducedMotion ? 0 : 0.12}
      mouseButtons={{ left: ACTION.TRUCK, middle: ACTION.ZOOM, right: ACTION.ROTATE, wheel: ACTION.ZOOM }}
      touches={{ one: ACTION.TOUCH_TRUCK, two: ACTION.TOUCH_ZOOM_TRUCK, three: ACTION.TOUCH_ROTATE }}
      onControlStart={() => { moved.current = true; }}
    />
  );
}

export default function Scene3D() {
  const isDesktop = useIsDesktop();
  const dark = usePrefersDark();
  const reducedMotion = usePrefersReducedMotion();
  const select = useOffice((s) => s.select);
  const employees = useOffice((s) => s.data.employees);
  const rig = useRef<CameraRigHandle | null>(null);
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const pal = dark ? NIGHT : DAY;
  const shadows = isDesktop;

  const todayKey = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const done = employees.flatMap((e) => e.runs).filter((r) =>
    r.status !== "error" && r.status !== "running" &&
    new Date(new Date(r.started_at).getTime() + 8 * 3600_000).toISOString().slice(0, 10) === todayKey).length;
  const waiting = employees.filter((e) => e.status === "needs_you").length;

  return (
    <div
      className="relative size-full"
      onPointerDownCapture={(e) => { pressAt.current = { x: e.clientX, y: e.clientY }; }}
    >
      <Canvas
        orthographic
        shadows={shadows}
        dpr={isDesktop ? [1, 2] : [1, 1.5]}
        camera={{ position: defaultEye(CENTER.x, CENTER.y, CENTER.z), zoom: 30, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={(e) => {
          // A drag that pans the camera also ends in a "click" on empty floor; only a real click deselects.
          const from = pressAt.current;
          if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > DRAG_PX) return;
          select(null);
        }}
        aria-label="rnldvrgl HQ in 3D. Drag to move around, pinch or scroll to zoom. Select a name tag to open that desk."
        role="img"
      >
        <AdaptiveDpr pixelated={false} />
        <ambientLight intensity={pal.ambient} />
        <hemisphereLight args={["#ffffff", pal.floor, 0.35]} />
        <directionalLight
          position={[CENTER.x + 6, 14, CENTER.z + 4]}
          intensity={pal.sun}
          color={pal.sunColor}
          castShadow={shadows}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0005}
        />
        <Room pal={pal} shadows={shadows} done={done} waiting={waiting} />
        <OwnerOffice pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
        {TEAM.map((meta, i) => (
          <Desk3D key={meta.id} meta={meta} index={i} pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
        ))}
        <CameraRig reducedMotion={reducedMotion} handle={rig} />
      </Canvas>

      <button
        type="button"
        onClick={() => { select(null); rig.current?.reset(); }}
        className="absolute right-3 bottom-3 z-30 flex items-center gap-1.5 rounded-full border bg-card/90 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        aria-label="Reset the office view"
      >
        <LocateFixed className="size-3.5" aria-hidden /> Reset view
      </button>
    </div>
  );
}
