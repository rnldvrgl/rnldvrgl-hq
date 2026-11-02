"use client";

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useOffice } from "@/lib/store";
import { TEAM, teamById } from "@/lib/team";
import { useIsDesktop, usePrefersDark, usePrefersReducedMotion } from "@/hooks/use-media";
import { Room } from "./Room";
import { Desk3D } from "./Desk3D";
import { DAY, NIGHT, DESK, CENTER } from "./palette";

gsap.registerPlugin(useGSAP);

/** Camera sits along the (1,1,1) diagonal: a true isometric view of the room. */
const OFFSET = 20;

/** Keeps the room framed, and glides to a desk when you pick one. */
function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const selected = useOffice((s) => s.selected);
  const target = useRef(new THREE.Vector3(CENTER.x, 0, CENTER.z));
  const first = useRef(true);

  // Zoom that fits the whole room in the canvas, whatever its size.
  const baseZoom = Math.min(size.width / 15.5, size.height / 10.5);

  const place = () => {
    const t = target.current;
    camera.position.set(t.x + OFFSET, t.y + OFFSET, t.z + OFFSET);
    camera.lookAt(t);
  };

  useLayoutEffect(() => {
    if (!first.current) return;
    place();
    camera.zoom = baseZoom;
    camera.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useGSAP(() => {
    const meta = selected ? teamById[selected] : null;
    const to = meta
      ? { x: meta.desk.x + DESK.W / 2, y: 0.7, z: meta.desk.y + DESK.D / 2 + 0.3 }
      : { x: CENTER.x, y: 0, z: CENTER.z };
    const zoom = meta ? baseZoom * 1.8 : baseZoom;
    const duration = first.current || reducedMotion ? 0 : 1.1;
    first.current = false;

    gsap.to(target.current, { ...to, duration, ease: "power3.inOut", overwrite: "auto", onUpdate: place });
    gsap.to(camera, { zoom, duration, ease: "power3.inOut", overwrite: "auto", onUpdate: () => camera.updateProjectionMatrix() });
  }, { dependencies: [selected, baseZoom, reducedMotion] });

  return null;
}

export default function Scene3D() {
  const isDesktop = useIsDesktop();
  const dark = usePrefersDark();
  const reducedMotion = usePrefersReducedMotion();
  const select = useOffice((s) => s.select);
  const employees = useOffice((s) => s.data.employees);
  const pal = dark ? NIGHT : DAY;
  const shadows = isDesktop;

  const todayKey = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const done = employees.flatMap((e) => e.runs).filter((r) =>
    r.status !== "error" && r.status !== "running" &&
    new Date(new Date(r.started_at).getTime() + 8 * 3600_000).toISOString().slice(0, 10) === todayKey).length;
  const waiting = employees.filter((e) => e.status === "needs_you").length;

  return (
    <Canvas
      orthographic
      shadows={shadows}
      dpr={isDesktop ? [1, 2] : [1, 1.5]}
      camera={{ position: [CENTER.x + OFFSET, OFFSET, CENTER.z + OFFSET], zoom: 40, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => select(null)}
      aria-label="rnldvrgl HQ in 3D. Select a name tag to open that desk."
      role="img"
    >
      <AdaptiveDpr pixelated={false} />
      <ambientLight intensity={pal.ambient} />
      <hemisphereLight args={["#ffffff", pal.floor, 0.35]} />
      <directionalLight
        position={[CENTER.x + 6, 12, CENTER.z + 3]}
        intensity={pal.sun}
        color={pal.sunColor}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0005}
      />
      <Room pal={pal} shadows={shadows} done={done} waiting={waiting} />
      {TEAM.map((meta, i) => (
        <Desk3D key={meta.id} meta={meta} index={i} pal={pal} shadows={shadows} reducedMotion={reducedMotion} />
      ))}
      <CameraRig reducedMotion={reducedMotion} />
    </Canvas>
  );
}
