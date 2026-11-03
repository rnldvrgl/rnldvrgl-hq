"use client";

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useOffice, useEmployee, sceneNow } from "@/lib/store";
import { isAfterHours, manilaMinutes } from "@/lib/office-clock";
import type { EmployeeMeta } from "@/lib/team";
import { DESK, SHIRTS, SCENE_FONT, type Palette } from "./palette";
import { OfficeChair, Plant } from "./Furniture";

gsap.registerPlugin(useGSAP);

/** Pointer travel (px) above which a press is a camera drag rather than a click. */
export const DRAG_PX = 6;

/** Pedestal drawer fronts as [centre y, height]. */
const DRAWERS: readonly (readonly [number, number])[] = [[0.6, 0.15], [0.42, 0.18], [0.17, 0.28]];

/** "Code" lines on the monitor as [x from the left edge, y from centre, width]. */
const CODE_LINES: readonly (readonly [number, number, number])[] = [
  [0, 0.15, 0.32], [0.06, 0.1, 0.42], [0.06, 0.05, 0.24], [0, 0, 0.18], [0.06, -0.05, 0.46], [0.12, -0.1, 0.3], [0, -0.15, 0.2],
];

type Props = { meta: EmployeeMeta; index: number; pal: Palette; shadows: boolean; reducedMotion: boolean };

/**
 * One workstation: white desk with an oak edge, drawer pedestal, a waterfall side panel with the
 * employee's name on it, a fabric privacy divider, a monitor on an arm, and their chair.
 * The person sitting here is <Employee3D>, so they can get up and walk around.
 */
export function Desk3D({ meta, index, pal, shadows, reducedMotion }: Props) {
  const emp = useEmployee(meta.id);
  const selected = useOffice((s) => s.selected === meta.id);
  const hovered = useOffice((s) => s.hovered === meta.id);
  const select = useOffice((s) => s.select);
  const hover = useOffice((s) => s.hover);

  const root = useRef<THREE.Group>(null);
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  const lines = useRef<THREE.Group>(null);
  const pad = useRef<THREE.MeshBasicMaterial>(null);

  const enabled = emp?.enabled ?? true;
  const status = emp?.status ?? "idle";
  const shirt = SHIRTS[meta.color - 1];
  const { W, D, H } = DESK;
  const colors = useMemo(() => ({
    on: new THREE.Color(pal.screenOn), idle: new THREE.Color(pal.screenIdle), off: new THREE.Color(pal.screenOff),
    error: new THREE.Color(pal.screenError), needs: new THREE.Color(pal.screenNeeds),
  }), [pal]);

  // Drop in on first load, staggered by desk.
  useGSAP(() => {
    if (!root.current || reducedMotion) return;
    gsap.from(root.current.position, { y: 2.2, duration: 0.9, delay: 0.15 + index * 0.07, ease: "bounce.out" });
    gsap.from(root.current.scale, { x: 0.85, y: 0.85, z: 0.85, duration: 0.6, delay: 0.15 + index * 0.07, ease: "back.out(2)" });
  }, []);

  // Highlight under the desk on hover / select.
  useGSAP(() => {
    if (!pad.current) return;
    gsap.to(pad.current, { opacity: selected ? 0.3 : hovered ? 0.14 : 0, duration: 0.25 });
  }, { dependencies: [selected, hovered] });

  // The screen follows the status; it's switched off when they've gone home or are paused.
  useFrame(({ clock }) => {
    const m = screen.current;
    if (!m) return;
    const home = status === "idle" && isAfterHours(manilaMinutes(sceneNow()));
    const off = !enabled || home;
    const c = off ? colors.off : status === "working" ? colors.on : status === "error" ? colors.error : status === "needs_you" ? colors.needs : colors.idle;
    m.color.copy(c);
    m.emissive.copy(c);
    const flicker = status === "working" && !reducedMotion ? Math.sin(clock.elapsedTime * 4) * 0.15 : 0;
    m.emissiveIntensity = off ? 0.05 : status === "working" ? 1 + flicker : 0.55;
    if (lines.current) lines.current.visible = !off && status !== "error";
  });

  return (
    <group
      ref={root}
      position={[meta.desk.x, 0, meta.desk.y]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > DRAG_PX) return; // the end of a camera pan, not a click
        select(meta.id);
      }}
      onPointerOver={(e) => { e.stopPropagation(); hover(meta.id); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { hover(null); document.body.style.cursor = ""; }}
    >
      {/* selection pad */}
      <mesh position={[W / 2, 0.016, D / 2 + 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 0.5, D + 1.5]} />
        <meshBasicMaterial ref={pad} color={pal.selected} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* desktop: white top with an oak edge band */}
      <RoundedBox args={[W, 0.045, D]} radius={0.018} smoothness={2} position={[W / 2, H, D / 2]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial color={pal.deskTop} roughness={0.5} />
      </RoundedBox>
      <mesh position={[W / 2, H - 0.03, D / 2]}>
        <boxGeometry args={[W - 0.01, 0.018, D - 0.01]} />
        <meshStandardMaterial color={pal.deskEdge} />
      </mesh>
      {/* status strip in their colour under the front edge */}
      <mesh position={[W / 2 + 0.2, H - 0.04, D + 0.001]}>
        <boxGeometry args={[W - 0.6, 0.012, 0.01]} />
        <meshStandardMaterial color={shirt} emissive={shirt} emissiveIntensity={status === "working" ? 0.9 : 0.2} toneMapped={false} />
      </mesh>

      {/* drawer pedestal on the left */}
      <mesh position={[0.24, (H - 0.04) / 2, D / 2 + 0.02]} castShadow={shadows}>
        <boxGeometry args={[0.42, H - 0.04, D - 0.1]} />
        <meshStandardMaterial color={pal.drawer} />
      </mesh>
      {DRAWERS.map(([y, h]) => (
        <group key={y} position={[0.24, y, D - 0.028]}>
          <mesh>
            <boxGeometry args={[0.39, h - 0.01, 0.01]} />
            <meshStandardMaterial color={pal.deskTop} />
          </mesh>
          <mesh position={[0, h / 2 - 0.035, 0.01]}>
            <boxGeometry args={[0.14, 0.012, 0.012]} />
            <meshStandardMaterial color={pal.handle} />
          </mesh>
        </group>
      ))}

      {/* waterfall side panel on the right, with a stripe in their colour */}
      <mesh position={[W - 0.02, (H - 0.03) / 2, D / 2]} castShadow={shadows}>
        <boxGeometry args={[0.04, H - 0.03, D]} />
        <meshStandardMaterial color={pal.deskTop} />
      </mesh>
      <mesh position={[W + 0.002, 0.6, D / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D - 0.12, 0.03]} />
        <meshBasicMaterial color={shirt} toneMapped={false} />
      </mesh>

      {/* name plate: a tilted acrylic block on the front-right corner, facing you */}
      <group position={[W - 0.25, H + 0.025, D - 0.09]}>
        <mesh position={[0, 0.07, 0]} rotation={[-0.3, 0, 0]} castShadow={shadows}>
          <boxGeometry args={[0.44, 0.15, 0.02]} />
          <meshStandardMaterial color={pal.bezel} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.012, 0.01]}>
          <boxGeometry args={[0.46, 0.024, 0.08]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <group position={[0, 0.07, 0.012]} rotation={[-0.3, 0, 0]}>
          <Suspense fallback={null}>
            <Text font={SCENE_FONT} position={[0, 0.018, 0]} fontSize={0.075} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.03}>
              {meta.name}
            </Text>
            <Text font={SCENE_FONT} position={[0, -0.04, 0]} fontSize={0.03} color={shirt} anchorX="center" anchorY="middle" letterSpacing={0.08} maxWidth={0.42}>
              {meta.title.toUpperCase()}
            </Text>
          </Suspense>
        </group>
      </group>

      {/* fabric privacy divider along the back edge */}
      <RoundedBox args={[W, 0.4, 0.04]} radius={0.015} smoothness={2} position={[W / 2, H + 0.2, 0.02]} castShadow={shadows}>
        <meshStandardMaterial color={pal.divider} roughness={1} />
      </RoundedBox>

      {/* monitor on an arm clamped to the back edge */}
      <mesh position={[W / 2, H + 0.05, 0.07]}>
        <boxGeometry args={[0.07, 0.06, 0.07]} />
        <meshStandardMaterial color={pal.metal} />
      </mesh>
      <mesh position={[W / 2, H + 0.2, 0.08]}>
        <cylinderGeometry args={[0.016, 0.016, 0.28, 8]} />
        <meshStandardMaterial color={pal.metal} />
      </mesh>
      <mesh position={[W / 2, H + 0.36, 0.13]} rotation={[Math.PI / 2 - 0.4, 0, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.14, 8]} />
        <meshStandardMaterial color={pal.metal} />
      </mesh>
      <RoundedBox args={[0.9, 0.52, 0.024]} radius={0.01} smoothness={2} position={[W / 2, H + 0.44, 0.2]} castShadow={shadows}>
        <meshStandardMaterial color={pal.bezel} />
      </RoundedBox>
      <mesh position={[W / 2, H + 0.445, 0.213]}>
        <planeGeometry args={[0.87, 0.49]} />
        <meshStandardMaterial ref={screen} color={pal.screenIdle} emissive={pal.screenIdle} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <group ref={lines}>
        {CODE_LINES.map(([x, y, w], i) => (
          <mesh key={i} position={[W / 2 - 0.38 + x + w / 2, H + 0.445 + y, 0.2145]}>
            <planeGeometry args={[w, 0.018]} />
            <meshBasicMaterial color={pal.screenLine} transparent opacity={status === "working" ? 0.85 : 0.3} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* keyboard, mouse on a pad, notebook */}
      <RoundedBox args={[0.46, 0.022, 0.15]} radius={0.006} smoothness={1} position={[W / 2, H + 0.034, 0.58]}>
        <meshStandardMaterial color={pal.bezel} />
      </RoundedBox>
      <mesh position={[W / 2, H + 0.047, 0.58]}>
        <boxGeometry args={[0.42, 0.004, 0.12]} />
        <meshStandardMaterial color={pal.keycap} />
      </mesh>
      <mesh position={[W / 2 + 0.42, H + 0.025, 0.6]}>
        <boxGeometry args={[0.24, 0.004, 0.2]} />
        <meshStandardMaterial color={pal.mousepad} />
      </mesh>
      <mesh position={[W / 2 + 0.42, H + 0.038, 0.62]} scale={[0.032, 0.018, 0.05]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={pal.bezel} />
      </mesh>
      <mesh position={[W - 0.26, H + 0.028, 0.3]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.2, 0.012, 0.27]} />
        <meshStandardMaterial color={shirt} />
      </mesh>
      <mesh position={[W - 0.26, H + 0.035, 0.3]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.18, 0.004, 0.25]} />
        <meshStandardMaterial color="#f8f6f0" />
      </mesh>

      {/* desk lamp on even desks, a little plant and a mug on odd ones */}
      {index % 2 === 0 ? (
        <group position={[0.16, H + 0.022, 0.42]}>
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.02, 12]} />
            <meshStandardMaterial color={pal.bezel} />
          </mesh>
          <mesh position={[0, 0.19, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.36, 6]} />
            <meshStandardMaterial color={pal.metal} />
          </mesh>
          <mesh position={[0.09, 0.37, 0]}>
            <boxGeometry args={[0.2, 0.018, 0.018]} />
            <meshStandardMaterial color={pal.metal} />
          </mesh>
          <mesh position={[0.18, 0.33, 0]}>
            <coneGeometry args={[0.07, 0.1, 12, 1, true]} />
            <meshStandardMaterial color={pal.lampShade} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0.18, 0.3, 0]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshStandardMaterial color={pal.bulb} emissive={pal.bulb} emissiveIntensity={enabled ? 1 : 0} toneMapped={false} />
          </mesh>
        </group>
      ) : (
        <>
          <Plant pal={pal} shadows={shadows} position={[0.2, H + 0.022, 0.38]} scale={0.3} />
          <mesh position={[0.45, H + 0.075, 0.62]} castShadow={shadows}>
            <cylinderGeometry args={[0.045, 0.04, 0.1, 12]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
        </>
      )}

      <OfficeChair pal={pal} shadows={shadows} position={[W / 2, 0, D + 0.45]} color={pal.chair} />
    </group>
  );
}
