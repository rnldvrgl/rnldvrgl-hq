"use client";

import { Suspense, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import { Sun } from "lucide-react";
import { sceneNow, useEmployee } from "@/lib/store";
import { isWeekday, LUNCH_FROM, LUNCH_TO, manilaMinutes, MEETING_FROM, MEETING_TO, STANDUP_FROM, STANDUP_TO } from "@/lib/office-clock";
import { DINING, FRONT_Z, HUDDLE, LOUNGE, MEETING, ROOM, SCENE_FONT, type Palette } from "./palette";
import { OfficeChair, Plant, TallPlant } from "./Furniture";
import { light } from "./Lighting";
import { DINING_SEATS, MEETING_SEATS, STANDUP_SCREEN } from "./routes";
import { useBubbleMode } from "./Bubble";
import { Label } from "./Labels";
import { useSceneNow } from "./scene-clock-ui";
import { HQ } from "@/hq.config";

type Common = { pal: Palette; shadows: boolean };

/**
 * The front of the office (z > FRONT_Z): a glass meeting room on the left, the stand-up circle
 * in the middle (with a screen showing Maya's morning brief during the 9 AM stand-up), and the lounge on the right.
 */
export function FrontZone({ pal, shadows }: Common) {
  return (
    <group>
      {/* a slim floor strip marking the front zone */}
      <mesh position={[ROOM.W / 2, 0.004, FRONT_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM.W, 0.04]} />
        <meshBasicMaterial color={pal.floorSeam} />
      </mesh>
      <MeetingRoom pal={pal} shadows={shadows} />
      <Huddle pal={pal} shadows={shadows} />
      <Lounge pal={pal} shadows={shadows} />
    </group>
  );
}

/* ------------------------------------------------------------------ meeting room */

const GLASS_H = 2.3;

function GlassPane({ pal, from, to }: { pal: Palette; from: [number, number]; to: [number, number] }) {
  const [x0, z0] = from, [x1, z1] = to;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const rotY = -Math.atan2(z1 - z0, x1 - x0);
  return (
    <group position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} rotation={[0, rotY, 0]}>
      <mesh position={[0, GLASS_H / 2, 0]}>
        <planeGeometry args={[len, GLASS_H]} />
        <meshStandardMaterial color={pal.glass} transparent opacity={pal.glassOpacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <planeGeometry args={[len, 0.2]} />
        <meshStandardMaterial color={pal.frost} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {[0.025, GLASS_H].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[len, 0.045, 0.045]} />
          <meshStandardMaterial color={pal.glassFrame} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * len) / 2, GLASS_H / 2, 0]}>
          <boxGeometry args={[0.045, GLASS_H, 0.045]} />
          <meshStandardMaterial color={pal.glassFrame} />
        </mesh>
      ))}
    </group>
  );
}

/** Glass meeting room in the front-left corner: table for six, a wall screen, a whiteboard rail. */
function MeetingRoom({ pal, shadows }: Common) {
  const now = useSceneNow(1000);
  const min = manilaMinutes(now);
  const syncing = isWeekday(now) && min >= MEETING_FROM && min < MEETING_TO;
  const { x1, z0 } = MEETING;
  const D = ROOM.D;
  const cx = x1 / 2, cz = (z0 + D) / 2;
  return (
    <group>
      <mesh position={[cx + 0.05, 0.006, cz - 0.05]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows}>
        <planeGeometry args={[x1 - 0.3, D - z0 - 0.35]} />
        <meshStandardMaterial color="#c9ced3" roughness={1} />
      </mesh>
      {/* back pane (door gap on the right end) and side pane */}
      <GlassPane pal={pal} from={[0, z0]} to={[x1 - 1.0, z0]} />
      <GlassPane pal={pal} from={[x1, z0 + 0.0]} to={[x1, D]} />
      <Suspense fallback={null}>
        <Text font={SCENE_FONT} position={[x1 - 1.6, 1.55, z0 + 0.03]} fontSize={0.09} color={pal.clockInk} anchorX="center" anchorY="middle" letterSpacing={0.12}>
          MEETING ROOM
        </Text>
      </Suspense>
      {/* table and chairs */}
      <RoundedBox args={[2.3, 0.05, 1.05]} radius={0.03} smoothness={2} position={[cx + 0.15, 0.74, cz]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial color={pal.wood} />
      </RoundedBox>
      {[-0.7, 0.7].map((dx) => (
        <mesh key={dx} position={[cx + 0.15 + dx, 0.36, cz]}>
          <boxGeometry args={[0.08, 0.72, 0.7]} />
          <meshStandardMaterial color={pal.trim} />
        </mesh>
      ))}
      {MEETING_SEATS.map((seat, i) => (
        <group key={i} position={[seat.x, 0, seat.z]} rotation={[0, seat.face ?? 0, 0]}>
          <OfficeChair pal={pal} shadows={shadows} position={[0, 0, 0]} color="#3b4c5c" />
        </group>
      ))}
      {/* wall screen on the left wall */}
      <group position={[0.04, 1.45, cz]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBox args={[1.5, 0.86, 0.04]} radius={0.012} smoothness={2}>
          <meshStandardMaterial color={pal.bezel} />
        </RoundedBox>
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[1.42, 0.78]} />
          <meshStandardMaterial color="#1e3a5f" emissive="#1e3a5f" emissiveIntensity={0.5} />
        </mesh>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0.05, 0.03]} fontSize={0.09} color="#dbeafe" anchorX="center" anchorY="middle">
            {syncing ? "TEAM SYNC" : "Q4 ROADMAP"}
          </Text>
          <Text font={SCENE_FONT} position={[0, -0.12, 0.03]} fontSize={0.05} color="#93c5fd" anchorX="center" anchorY="middle">
            {`${HQ.owner.handle} ${HQ.shortName}`}
          </Text>
        </Suspense>
      </group>
      <TallPlant pal={pal} shadows={shadows} position={[0.42, 0, D - 0.42]} scale={0.8} />
    </group>
  );
}

/* ------------------------------------------------------------------ stand-up circle */

/** Maya's morning brief, first few lines, for the stand-up screen. */
function useBriefLines(): string[] {
  const maya = useEmployee("chief-of-staff");
  const text = maya?.runs.find((r) => r.status !== "error" && r.output)?.output ?? maya?.summary ?? "";
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[#>*\-\s]+/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .slice(0, 4);
}

/** Rug, a screen on a stand, and (during the weekday 9 AM stand-up) Maya's brief popping up over it. */
function Huddle({ pal, shadows }: Common) {
  const now = useSceneNow(1000);
  const min = manilaMinutes(now);
  const on = isWeekday(now) && min >= STANDUP_FROM - 0.5 && min < STANDUP_TO;
  const lines = useBriefLines();
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (screen.current) screen.current.emissiveIntensity = on ? 0.9 + Math.sin(clock.elapsedTime * 2) * 0.1 : 0.25;
  });
  const sx = STANDUP_SCREEN.x, sz = STANDUP_SCREEN.z;

  return (
    <group>
      <mesh position={[HUDDLE.x, 0.007, HUDDLE.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows}>
        <circleGeometry args={[HUDDLE.r + 0.25, 48]} />
        <meshStandardMaterial color="#d6e4e0" roughness={1} />
      </mesh>
      <mesh position={[HUDDLE.x, 0.009, HUDDLE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[HUDDLE.r + 0.15, HUDDLE.r + 0.21, 48]} />
        <meshBasicMaterial color={pal.selected} />
      </mesh>
      {/* screen on a stand, facing the circle */}
      <group position={[sx, 0, sz]} rotation={[0, Math.PI / 2 - 0.35, 0]}>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.6, 0.05, 0.4]} />
          <meshStandardMaterial color={pal.trim} />
        </mesh>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[0.06, 1.25, 0.06]} />
          <meshStandardMaterial color={pal.trim} />
        </mesh>
        <RoundedBox args={[1.25, 0.74, 0.05]} radius={0.015} smoothness={2} position={[0, 1.45, 0.03]} castShadow={shadows}>
          <meshStandardMaterial color={pal.bezel} />
        </RoundedBox>
        <mesh position={[0, 1.45, 0.058]}>
          <planeGeometry args={[1.17, 0.66]} />
          <meshStandardMaterial ref={screen} color="#0f2a3a" emissive="#0f2a3a" emissiveIntensity={0.25} />
        </mesh>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 1.58, 0.062]} fontSize={0.075} color={pal.boardAccent} anchorX="center" anchorY="middle" letterSpacing={0.1}>
            STAND-UP
          </Text>
          <Text font={SCENE_FONT} position={[0, 1.4, 0.062]} fontSize={0.11} color="#e6f6fa" anchorX="center" anchorY="middle">
            9:00 AM
          </Text>
          <Text font={SCENE_FONT} position={[0, 1.26, 0.062]} fontSize={0.04} color="#8fb3c4" anchorX="center" anchorY="middle" letterSpacing={0.1}>
            WEEKDAYS
          </Text>
        </Suspense>
        {on && <Label id="standup-brief" position={[0, 2.25, 0]} spec={{ layer: 25, render: () => <BriefCard lines={lines} /> }} />}
      </group>
    </group>
  );
}

/** Maya's brief over the stand-up screen. Zoomed out (e.g. a phone showing the whole office) it shrinks to two lines. */
function BriefCard({ lines }: { lines: string[] }) {
  const compact = useBubbleMode((s) => s.mode === "dot");
  const shown = compact ? lines.slice(0, 2) : lines;
  return (
            <div className={`${compact ? "w-44 p-2" : "w-64 p-3"} rounded-xl border bg-card/95 text-card-foreground shadow-lg backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95`}>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600">
                <Sun className="size-3.5" aria-hidden /> Morning brief · Maya
              </p>
              {shown.length ? (
                <ul className="mt-1.5 grid gap-1 text-xs leading-snug">
                  {shown.map((l, i) => <li key={i} className="line-clamp-2">{l}</li>)}
                </ul>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">No brief yet today. Maya sends it at 7:30 AM.</p>
              )}
            </div>
  );
}

/* ------------------------------------------------------------------ lounge */

/** Lounge in the front-right: rug, sofa (its back to you), coffee table, two armchairs, an arc floor lamp. */
function Lounge({ pal, shadows }: Common) {
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => { if (lamp.current) lamp.current.emissiveIntensity = 0.2 + light.lamps * 1.6; });
  const lx = LOUNGE.x, lz = LOUNGE.z, sz = ROOM.D - 0.5;
  return (
    <group>
      <mesh position={[lx, 0.008, lz - 0.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows}>
        <planeGeometry args={[3.2, 1.9]} />
        <meshStandardMaterial color={pal.rugLounge} roughness={1} />
      </mesh>
      <group position={[lx, 0, sz]}>
        <RoundedBox args={[2.4, 0.26, 0.8]} radius={0.06} smoothness={2} position={[0, 0.25, -0.02]} castShadow={shadows}>
          <meshStandardMaterial color={pal.sofaDark} />
        </RoundedBox>
        {[-0.58, 0.58].map((x) => (
          <RoundedBox key={x} args={[1.12, 0.14, 0.62]} radius={0.05} smoothness={2} position={[x, 0.44, -0.08]} castShadow={shadows}>
            <meshStandardMaterial color={pal.sofa} />
          </RoundedBox>
        ))}
        <RoundedBox args={[2.4, 0.5, 0.2]} radius={0.07} smoothness={2} position={[0, 0.55, 0.3]} castShadow={shadows}>
          <meshStandardMaterial color={pal.sofaDark} />
        </RoundedBox>
        {[-1.15, 1.15].map((x) => (
          <RoundedBox key={x} args={[0.16, 0.5, 0.8]} radius={0.06} smoothness={2} position={[x, 0.38, 0]} castShadow={shadows}>
            <meshStandardMaterial color={pal.sofaDark} />
          </RoundedBox>
        ))}
        <RoundedBox args={[0.34, 0.3, 0.12]} radius={0.05} smoothness={2} position={[-0.75, 0.62, 0.14]} rotation={[0.2, 0, 0.1]}>
          <meshStandardMaterial color="#e0a43a" />
        </RoundedBox>
      </group>
      <group position={[lx, 0, lz - 0.25]}>
        <mesh position={[0, 0.4, 0]} castShadow={shadows} receiveShadow={shadows}>
          <cylinderGeometry args={[0.45, 0.45, 0.04, 28]} />
          <meshStandardMaterial color={pal.wood} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.05, 0.16, 0.38, 12]} />
          <meshStandardMaterial color={pal.trim} />
        </mesh>
        <mesh position={[0.1, 0.43, 0.05]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.26, 0.015, 0.2]} />
          <meshStandardMaterial color="#1f3a52" />
        </mesh>
        <Plant pal={pal} shadows={shadows} position={[-0.2, 0.42, -0.08]} scale={0.22} />
      </group>
      {[-1, 1].map((side) => (
        <group key={side} position={[lx + side * 1.45, 0, lz - 0.1]} rotation={[0, side * -1.25, 0]}>
          <RoundedBox args={[0.78, 0.36, 0.74]} radius={0.06} smoothness={2} position={[0, 0.26, 0]} castShadow={shadows}>
            <meshStandardMaterial color="#c9a77c" />
          </RoundedBox>
          <RoundedBox args={[0.78, 0.46, 0.16]} radius={0.06} smoothness={2} position={[0, 0.55, 0.3]} castShadow={shadows}>
            <meshStandardMaterial color="#b8936a" />
          </RoundedBox>
        </group>
      ))}
      <group position={[ROOM.W - 0.35, 0, ROOM.D - 0.35]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.04, 16]} />
          <meshStandardMaterial color={pal.trim} />
        </mesh>
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.6, 8]} />
          <meshStandardMaterial color={pal.trim} />
        </mesh>
        <mesh position={[-0.25, 1.62, -0.25]} rotation={[-0.7, 0, -0.7]}>
          <cylinderGeometry args={[0.012, 0.012, 0.75, 8]} />
          <meshStandardMaterial color={pal.trim} />
        </mesh>
        <mesh position={[-0.5, 1.55, -0.5]}>
          <sphereGeometry args={[0.16, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial ref={lamp} color="#fff4dc" emissive="#ffd59a" emissiveIntensity={0.3} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ dining table */

/** Dining table in front of the pantry: eight chairs, and plates with lunch from 12:00 to 12:55. */
export function Dining({ pal, shadows }: Common) {
  const food = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!food.current) return;
    const min = manilaMinutes(sceneNow());
    food.current.visible = min >= LUNCH_FROM && min < LUNCH_TO;
  });
  return (
    <group>
      <RoundedBox args={[DINING.w, 0.05, DINING.d]} radius={0.025} smoothness={2} position={[DINING.x, 0.74, DINING.z]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial color={pal.wood} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[DINING.x + side * (DINING.w / 2 - 0.2), 0.36, DINING.z]}>
          <boxGeometry args={[0.06, 0.72, DINING.d - 0.2]} />
          <meshStandardMaterial color={pal.trim} />
        </mesh>
      ))}
      {DINING_SEATS.map((seat, i) => (
        <group key={i} position={[seat.x, 0, seat.z]} rotation={[0, seat.face ?? 0, 0]}>
          {/* simple dining chair: seat, back toward the outside, four legs */}
          <RoundedBox args={[0.44, 0.05, 0.42]} radius={0.02} smoothness={2} position={[0, 0.47, 0]} castShadow={shadows}>
            <meshStandardMaterial color="#e7e1d6" />
          </RoundedBox>
          <RoundedBox args={[0.44, 0.38, 0.04]} radius={0.02} smoothness={2} position={[0, 0.69, 0.2]} castShadow={shadows}>
            <meshStandardMaterial color="#e7e1d6" />
          </RoundedBox>
          {[[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]].map(([x, z]) => (
            <mesh key={`${x}${z}`} position={[x, 0.23, z]}>
              <cylinderGeometry args={[0.015, 0.015, 0.46, 6]} />
              <meshStandardMaterial color={pal.trim} />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={food} visible={false}>
        {DINING_SEATS.map((seat, i) => {
          const towardTable = seat.z < DINING.z ? 0.42 : -0.42;
          return (
            <group key={i} position={[seat.x, 0.775, seat.z + towardTable]}>
              <mesh>
                <cylinderGeometry args={[0.13, 0.11, 0.015, 18]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0.02, 0.025, 0]} scale={[1, 0.45, 1]}>
                <sphereGeometry args={[0.07, 10, 8]} />
                <meshStandardMaterial color={["#f5f0e1", "#e0a43a", "#84cc16", "#d97757"][i % 4]} />
              </mesh>
              <mesh position={[0.16, 0.04, 0]}>
                <cylinderGeometry args={[0.035, 0.03, 0.08, 10]} />
                <meshStandardMaterial color="#bfdbfe" transparent opacity={0.7} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}
