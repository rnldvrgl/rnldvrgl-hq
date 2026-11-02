"use client";

import { useRef } from "react";
import * as THREE from "three";
import { Html, RoundedBox } from "@react-three/drei";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useOffice, useEmployee } from "@/lib/store";
import type { EmployeeMeta } from "@/lib/team";
import { cn } from "@/lib/utils";
import { DESK, SHIRTS, type Palette } from "./palette";
import { ICONS, LAMP, type LampKey } from "./icons";
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
 * One desk: furniture, monitor, the employee (seen from behind, facing their screen) and a floating name tag.
 * GSAP drives three animations: the drop-in on load, typing while working, and a little hop when a job finishes.
 */
export function Desk3D({ meta, index, pal, shadows, reducedMotion }: Props) {
  const emp = useEmployee(meta.id);
  const selected = useOffice((s) => s.selected === meta.id);
  const hovered = useOffice((s) => s.hovered === meta.id);
  const select = useOffice((s) => s.select);
  const hover = useOffice((s) => s.hover);

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  const pad = useRef<THREE.MeshBasicMaterial>(null);
  const prevStatus = useRef(emp?.status);

  const enabled = emp?.enabled ?? true;
  const status = emp?.status ?? "idle";
  const working = enabled && status === "working";
  const lampKey: LampKey = !enabled ? "off" : status;
  const shirt = SHIRTS[meta.color - 1];
  const Icon = ICONS[meta.icon];
  const { W, D, H } = DESK;
  const screenColor = !enabled ? pal.screenOff : status === "error" ? pal.screenError : working ? pal.screenOn : pal.screenIdle;

  // 1. Drop in on first load, staggered by desk.
  useGSAP(() => {
    if (!root.current || reducedMotion) return;
    gsap.from(root.current.position, { y: 2.2, duration: 0.9, delay: 0.15 + index * 0.07, ease: "bounce.out" });
    gsap.from(root.current.scale, { x: 0.85, y: 0.85, z: 0.85, duration: 0.6, delay: 0.15 + index * 0.07, ease: "back.out(2)" });
  }, []);

  // 2. Typing loop while working: head bob, arms tapping, screen flicker.
  useGSAP(() => {
    if (!head.current || !armL.current || !armR.current || !screen.current) return;
    if (!working || reducedMotion) {
      gsap.to(head.current.position, { y: 1.36, duration: 0.3 });
      gsap.to([armL.current.rotation, armR.current.rotation], { x: 1.05, duration: 0.3 });
      screen.current.emissiveIntensity = working ? 0.9 : 0.25;
      return;
    }
    const tl = gsap.timeline({ repeat: -1 });
    tl.to(armL.current.rotation, { x: 1.25, duration: 0.12, yoyo: true, repeat: 1, ease: "sine.inOut" })
      .to(armR.current.rotation, { x: 1.25, duration: 0.12, yoyo: true, repeat: 1, ease: "sine.inOut" }, "<0.12");
    gsap.to(head.current.position, { y: 1.39, duration: 0.45, yoyo: true, repeat: -1, ease: "sine.inOut" });
    gsap.fromTo(screen.current, { emissiveIntensity: 0.7 }, { emissiveIntensity: 1.15, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut" });
  }, { dependencies: [working, reducedMotion], revertOnUpdate: true });

  // 3. Little hop when a run finishes.
  useGSAP(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (was === "working" && status !== "working" && body.current && !reducedMotion) {
      gsap.timeline()
        .to(body.current.position, { y: 0.18, duration: 0.18, ease: "power2.out" })
        .to(body.current.position, { y: 0, duration: 0.45, ease: "bounce.out" });
    }
  }, { dependencies: [status, reducedMotion] });

  // 4. Highlight under the desk on hover / select.
  useGSAP(() => {
    if (!pad.current) return;
    gsap.to(pad.current, { opacity: selected ? 0.3 : hovered ? 0.14 : 0, duration: 0.25 });
  }, { dependencies: [selected, hovered] });

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
      <mesh position={[W / 2, 0.006, D / 2 + 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 0.6, D + 1.4]} />
        <meshBasicMaterial ref={pad} color={pal.selected} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* desk: rounded top, drawer pedestal on the left, metal T-leg on the right, modesty panel */}
      <RoundedBox args={[W, 0.05, D]} radius={0.02} smoothness={2} position={[W / 2, H, D / 2]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial color={pal.deskTop} />
      </RoundedBox>
      <mesh position={[W / 2, H - 0.035, D + 0.002]}>
        <boxGeometry args={[W - 0.1, 0.012, 0.012]} />
        <meshStandardMaterial color={shirt} emissive={shirt} emissiveIntensity={working ? 0.6 : 0.15} />
      </mesh>
      <mesh position={[0.26, (H - 0.025) / 2, D / 2 + 0.02]} castShadow={shadows}>
        <boxGeometry args={[0.42, H - 0.025, D - 0.12]} />
        <meshStandardMaterial color={pal.deskSide} />
      </mesh>
      {DRAWERS.map(([y, h]) => (
        <group key={y} position={[0.26, y, D - 0.035]}>
          <mesh>
            <boxGeometry args={[0.38, h, 0.012]} />
            <meshStandardMaterial color={pal.drawer} />
          </mesh>
          <mesh position={[0, h / 2 - 0.035, 0.012]}>
            <boxGeometry args={[0.12, 0.015, 0.015]} />
            <meshStandardMaterial color={pal.handle} />
          </mesh>
        </group>
      ))}
      <mesh position={[W - 0.1, (H - 0.025) / 2, D / 2]} castShadow={shadows}>
        <boxGeometry args={[0.05, H - 0.025, 0.05]} />
        <meshStandardMaterial color={pal.deskMetal} />
      </mesh>
      <mesh position={[W - 0.1, 0.015, D / 2]}>
        <boxGeometry args={[0.06, 0.03, D - 0.1]} />
        <meshStandardMaterial color={pal.deskMetal} />
      </mesh>
      <mesh position={[(W + 0.34) / 2, H - 0.22, 0.05]}>
        <boxGeometry args={[W - 0.58, 0.36, 0.025]} />
        <meshStandardMaterial color={pal.deskSide} />
      </mesh>

      {/* monitor: base, neck, slim panel, screen with a few "code" lines, cable down the back */}
      <mesh position={[W / 2, H + 0.033, 0.2]}>
        <boxGeometry args={[0.28, 0.015, 0.18]} />
        <meshStandardMaterial color={pal.bezel} />
      </mesh>
      <mesh position={[W / 2, H + 0.17, 0.16]}>
        <boxGeometry args={[0.045, 0.28, 0.03]} />
        <meshStandardMaterial color={pal.bezel} />
      </mesh>
      <RoundedBox args={[0.86, 0.5, 0.025]} radius={0.01} smoothness={2} position={[W / 2, H + 0.42, 0.2]} castShadow={shadows}>
        <meshStandardMaterial color={pal.bezel} />
      </RoundedBox>
      <mesh position={[W / 2, H + 0.42, 0.214]}>
        <planeGeometry args={[0.83, 0.47]} />
        <meshStandardMaterial ref={screen} color={screenColor} emissive={screenColor} emissiveIntensity={0.25} toneMapped={false} />
      </mesh>
      {enabled && status !== "error" && CODE_LINES.map(([x, y, w], i) => (
        <mesh key={i} position={[W / 2 - 0.36 + x + w / 2, H + 0.42 + y, 0.2155]}>
          <planeGeometry args={[w, 0.018]} />
          <meshBasicMaterial color={pal.screenLine} transparent opacity={working ? 0.85 : 0.3} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[W / 2 + 0.06, (H + 0.15) / 2, 0.1]}>
        <boxGeometry args={[0.012, H + 0.15, 0.012]} />
        <meshStandardMaterial color={pal.bezel} />
      </mesh>
      {working && <pointLight position={[W / 2, H + 0.4, 0.5]} color={pal.screenOn} intensity={0.8} distance={1.6} />}

      {/* keyboard, mouse on a pad, mug */}
      <RoundedBox args={[0.46, 0.022, 0.15]} radius={0.006} smoothness={1} position={[W / 2, H + 0.036, 0.58]}>
        <meshStandardMaterial color={pal.bezel} />
      </RoundedBox>
      <mesh position={[W / 2, H + 0.049, 0.58]}>
        <boxGeometry args={[0.42, 0.004, 0.12]} />
        <meshStandardMaterial color={pal.keycap} />
      </mesh>
      <mesh position={[W / 2 + 0.42, H + 0.027, 0.6]}>
        <boxGeometry args={[0.24, 0.004, 0.2]} />
        <meshStandardMaterial color={pal.mousepad} />
      </mesh>
      <mesh position={[W / 2 + 0.42, H + 0.04, 0.62]} scale={[0.032, 0.018, 0.05]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={pal.bezel} />
      </mesh>
      <mesh position={[W - 0.18, H + 0.08, 0.3]} castShadow={shadows}>
        <cylinderGeometry args={[0.05, 0.045, 0.11, 12]} />
        <meshStandardMaterial color={shirt} />
      </mesh>

      {/* desk lamp on even desks, a little plant on odd ones */}
      {index % 2 === 0 ? (
        <group position={[0.16, H + 0.025, 0.5]}>
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.02, 12]} />
            <meshStandardMaterial color={pal.bezel} />
          </mesh>
          <mesh position={[0, 0.19, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.36, 6]} />
            <meshStandardMaterial color={pal.deskMetal} />
          </mesh>
          <mesh position={[0.09, 0.37, 0]}>
            <boxGeometry args={[0.2, 0.018, 0.018]} />
            <meshStandardMaterial color={pal.deskMetal} />
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
        <Plant pal={pal} shadows={shadows} position={[0.2, H + 0.025, 0.45]} scale={0.3} />
      )}

      {/* the employee, seated with their back to us */}
      {enabled && (
        <group ref={body}>
          <mesh position={[W / 2, 0.88, D + 0.42]} castShadow={shadows}>
            <capsuleGeometry args={[0.2, 0.28, 6, 16]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
          <mesh ref={head} position={[W / 2, 1.36, D + 0.4]} castShadow={shadows}>
            <sphereGeometry args={[0.17, 24, 16]} />
            <meshStandardMaterial color={pal.hair} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[W / 2 + side * 0.17, 1.34, D + 0.42]}>
              <sphereGeometry args={[0.04, 12, 8]} />
              <meshStandardMaterial color={pal.skin} />
            </mesh>
          ))}
          {/* arms reach forward to the keyboard; GSAP taps them while working */}
          <group ref={armL} position={[W / 2 - 0.22, 1.02, D + 0.38]} rotation={[1.05, 0, 0.12]}>
            <mesh position={[0, -0.18, 0]}>
              <capsuleGeometry args={[0.055, 0.3, 4, 10]} />
              <meshStandardMaterial color={shirt} />
            </mesh>
          </group>
          <group ref={armR} position={[W / 2 + 0.22, 1.02, D + 0.38]} rotation={[1.05, 0, -0.12]}>
            <mesh position={[0, -0.18, 0]}>
              <capsuleGeometry args={[0.055, 0.3, 4, 10]} />
              <meshStandardMaterial color={shirt} />
            </mesh>
          </group>
        </group>
      )}

      <OfficeChair pal={pal} shadows={shadows} position={[W / 2, 0, D + 0.45]} color={pal.chair} />

      {/* floating name tag */}
      <Html position={[W / 2, H + 1.05, 0.25]} center zIndexRange={[20, 0]}>
        <button
          type="button"
          onClick={() => select(meta.id)}
          onMouseEnter={() => hover(meta.id)}
          onMouseLeave={() => hover(null)}
          aria-label={`${meta.name}, ${meta.title}`}
          aria-pressed={selected}
          className={cn(
            "flex items-center gap-2 whitespace-nowrap rounded-full border bg-card/95 py-1 pl-1 pr-3 text-sm font-semibold shadow-sm backdrop-blur transition-transform select-none",
            "hover:scale-105 focus-visible:outline-2 focus-visible:outline-ring",
            selected ? "border-primary ring-2 ring-primary/30" : "border-border",
            !enabled && "opacity-60",
          )}
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="grid size-6 place-items-center rounded-full text-white" style={{ background: shirt }}>
            <Icon className="size-3.5" aria-hidden />
          </span>
          {meta.name}
          <span className={cn("size-2 rounded-full", LAMP[lampKey])} aria-hidden />
        </button>
      </Html>
    </group>
  );
}
