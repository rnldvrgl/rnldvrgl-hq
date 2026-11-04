"use client";

import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { RoundedBox, Text } from "@react-three/drei";
import { ROOM, OFFICE, FRONT_Z, PAL, SCENE_FONT, type Palette } from "./palette";
import { Plant, TallPlant } from "./Furniture";
import { Cozy } from "./Cozy";
import { teamStreak } from "./Celebration";
import { useSceneNow } from "./scene-clock-ui";
import { HQ } from "@/hq.config";
import { useOffice } from "@/lib/store";
import { useSpotify } from "@/lib/spotify";
import { TEAM, type EmployeeStatus } from "@/lib/team";

const TAU = Math.PI * 2;
const WALL_T = 0.16;
/** The wood-slat feature wall with the TV, in the middle of the (solid) back wall. */
const FEATURE = { x0: 2.95, x1: 8.35 } as const;

/* ------------------------------------------------------------------ procedural textures */

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

/** Light oak planks running left–right, 20 cm wide. One tile of texture covers 2 × 2 m. */
function usePlankTexture(w: number, d: number): THREE.CanvasTexture {
  return useMemo(() => canvasTexture(512, (g) => {
    const rows = 10, rowH = 512 / rows;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * 300;
      while (x < 512) {
        const len = 180 + rnd() * 260;
        const tone = 0.93 + rnd() * 0.12;
        g.fillStyle = `rgb(${Math.round(214 * tone)}, ${Math.round(182 * tone)}, ${Math.round(142 * tone)})`;
        g.fillRect(x, r * rowH, len, rowH);
        // grain
        g.strokeStyle = "rgba(120, 84, 48, 0.08)";
        for (let k = 0; k < 4; k++) {
          const y = r * rowH + 4 + rnd() * (rowH - 8);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (rnd() - 0.5) * 4); g.stroke();
        }
        g.fillStyle = "rgba(110, 78, 44, 0.35)";
        g.fillRect(x, r * rowH, 2, rowH);
        x += len;
      }
      g.fillStyle = "rgba(110, 78, 44, 0.3)";
      g.fillRect(0, r * rowH, 512, 1.5);
    }
  }, [w / 2, d / 2]), [w, d]);
}

/** 60 cm porcelain tiles for the pantry and entrance. One texture tile = 1.2 m. */
function useTileTexture(w: number, d: number): THREE.CanvasTexture {
  return useMemo(() => canvasTexture(256, (g) => {
    g.fillStyle = PAL.tile; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "rgba(0,0,0,0.035)"; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128);
    g.fillStyle = PAL.tileSeam;
    g.fillRect(0, 0, 256, 2); g.fillRect(0, 127, 256, 2); g.fillRect(0, 0, 2, 256); g.fillRect(127, 0, 2, 256);
  }, [w / 1.2, d / 1.2]), [w, d]);
}

/* ------------------------------------------------------------------ room */

type RoomProps = { pal: Palette; shadows: boolean; done: number; waiting: number; trashName: string | null };

/**
 * The building shell: oak floor, tiled pantry, a solid back wall with framed prints either side of the
 * slatted feature wall and its team dashboard, shelves and the clock.
 */
export function Room({ pal, shadows, done, waiting, trashName }: RoomProps) {
  const { W, D, H } = ROOM;
  const planks = usePlankTexture(W, D);
  const tileW = W - OFFICE.x0, tileD = FRONT_Z - OFFICE.z1;
  const tiles = useTileTexture(tileW, tileD);

  return (
    <group>
      {/* floor slab with the plank texture, and a tiled pantry/entrance area */}
      <mesh position={[W / 2, -0.06, D / 2]} receiveShadow={shadows}>
        <boxGeometry args={[W, 0.12, D]} />
        <meshStandardMaterial attach="material-0" color={pal.trim} />
        <meshStandardMaterial attach="material-1" color={pal.trim} />
        <meshStandardMaterial attach="material-2" map={planks} roughness={0.75} />
        <meshStandardMaterial attach="material-3" color={pal.trim} />
        <meshStandardMaterial attach="material-4" color={pal.trim} />
        <meshStandardMaterial attach="material-5" color={pal.trim} />
      </mesh>
      <mesh position={[OFFICE.x0 + tileW / 2, 0.003, OFFICE.z1 + tileD / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows}>
        <planeGeometry args={[tileW, tileD]} />
        <meshStandardMaterial map={tiles} roughness={0.45} />
      </mesh>

      <BackWall pal={pal} shadows={shadows} />
      <FrontWall pal={pal} />
      <LeftWall pal={pal} shadows={shadows} />
      <Corners pal={pal} shadows={shadows} />

      <Dashboard pal={pal} done={done} waiting={waiting} trashName={trashName} />
      <Clock pal={pal} />

      {/* floating shelves on the left wall: books, a plant, a trophy */}
      <Shelf pal={pal} shadows={shadows} z={1.35} y={1.45} />
      <Shelf pal={pal} shadows={shadows} z={6.0} y={1.45} plantFirst />

      {/* tall plants in the corners and by the windows */}
      <TallPlant pal={pal} shadows={shadows} position={[0.42, 0, 0.42]} />
      <TallPlant pal={pal} shadows={shadows} position={[0.42, 0, FRONT_Z - 0.3]} scale={0.85} />
      <Plant pal={pal} shadows={shadows} position={[10.4, 0, 0.32]} scale={0.8} />

      <Cozy pal={pal} shadows={shadows} />
    </group>
  );
}

/**
 * The back wall (z = 0): solid, with a framed print either side of the TV wall (there used to be windows
 * here, but the town behind is houses now, not open sky, so a window would show the wrong view).
 */
function BackWall({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const { W, H } = ROOM;
  const z = -WALL_T / 2;
  return (
    <group>
      <mesh position={[W / 2, H / 2, z]} receiveShadow={shadows}>
        <boxGeometry args={[W + WALL_T * 2, H, WALL_T]} />
        <meshStandardMaterial color={pal.wall} />
      </mesh>
      <Print pal={pal} x={1.75} w={1.5} h={1.05} art={["#e11d48", "#f59e0b", "#2563eb"]} />
      <Print pal={pal} x={9.5} w={1.3} h={0.95} art={["#0f766e", "#facc15", "#f97316"]} />
      {/* top cap: the cut line of the diorama */}
      <mesh position={[W / 2, H + 0.025, z]}>
        <boxGeometry args={[W + WALL_T * 2, 0.05, WALL_T + 0.02]} />
        <meshStandardMaterial color={pal.trim} />
      </mesh>
      {/* baseboard */}
      <mesh position={[W / 2, 0.05, 0.008]}>
        <boxGeometry args={[W, 0.1, 0.016]} />
        <meshStandardMaterial color={pal.baseboard} />
      </mesh>
      {/* wood slat feature wall behind the dashboard */}
      <group position={[0, 0, 0.01]}>
        {Array.from({ length: Math.floor((FEATURE.x1 - FEATURE.x0) / 0.09) }, (_, i) => (
          <mesh key={i} position={[FEATURE.x0 + 0.045 + i * 0.09, H / 2, 0.012]}>
            <boxGeometry args={[0.055, H - 0.02, 0.024]} />
            <meshStandardMaterial color={i % 2 ? pal.slat : pal.slatDark} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * A framed print on the back wall: a thin black frame, a white mat and three bands of colour (a jeepney
 * stripe, a sunset, the mountains), at eye level.
 */
function Print({ pal, x, w, h, art }: { pal: Palette; x: number; w: number; h: number; art: readonly [string, string, string] }) {
  const y = 1.6;
  const iw = w - 0.24, ih = h - 0.24;
  return (
    <group position={[x, y, 0.02]}>
      <mesh>
        <boxGeometry args={[w, h, 0.035]} />
        <meshStandardMaterial color={pal.windowFrame} />
      </mesh>
      <mesh position={[0, 0, 0.019]}>
        <planeGeometry args={[w - 0.06, h - 0.06]} />
        <meshStandardMaterial color="#f8f6f1" />
      </mesh>
      {art.map((c, i) => (
        <mesh key={c} position={[0, -ih / 2 + ih / 6 + (i * ih) / 3, 0.021]}>
          <planeGeometry args={[iw, ih / 3]} />
          <meshStandardMaterial color={c} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The front wall (z = ROOM.D), as a glass storefront so the office stays visible from the camera side:
 * a low base wall, floor-to-ceiling panes with slim black mullions, and a top rail.
 */
function FrontWall({ pal }: { pal: Palette }) {
  const { W, D, H } = ROOM;
  const BASE = 0.32;
  const panes = Math.round(W / 1.55);
  return (
    <group>
      <mesh position={[W / 2, BASE / 2, D + 0.04]}>
        <boxGeometry args={[W + 0.08, BASE, 0.1]} />
        <meshStandardMaterial color={pal.wallSide} />
      </mesh>
      <mesh position={[W / 2, (H + BASE) / 2, D + 0.04]}>
        <planeGeometry args={[W, H - BASE]} />
        <meshStandardMaterial color={pal.glass} transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} roughness={0.05} />
      </mesh>
      {Array.from({ length: panes + 1 }, (_, i) => (
        <mesh key={i} position={[(i * W) / panes, (H + BASE) / 2, D + 0.04]}>
          <boxGeometry args={[0.045, H - BASE, 0.05]} />
          <meshStandardMaterial color={pal.windowFrame} />
        </mesh>
      ))}
      <mesh position={[W / 2, H + 0.025, D + 0.04]}>
        <boxGeometry args={[W + 0.08, 0.05, 0.1]} />
        <meshStandardMaterial color={pal.trim} />
      </mesh>
      <mesh position={[W / 2, BASE + 0.015, D + 0.04]}>
        <boxGeometry args={[W, 0.03, 0.07]} />
        <meshStandardMaterial color={pal.windowFrame} />
      </mesh>
    </group>
  );
}

/**
 * Square corner columns at all four corners, full height, so the building's outline reads as one clean
 * rectangle from every angle (the glass front and side walls otherwise make the corners disappear).
 */
function Corners({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const { W, D, H } = ROOM;
  const C = 0.2;
  const at: [number, number][] = [[-WALL_T / 2, -WALL_T / 2], [W + WALL_T / 2 - 0.04, -WALL_T / 2], [-WALL_T / 2, D + 0.04], [W + 0.02, D + 0.04]];
  return (
    <group>
      {at.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, H / 2 + 0.01, z]} castShadow={shadows}>
          <boxGeometry args={[C, H + 0.06, C]} />
          <meshStandardMaterial color={pal.trim} />
        </mesh>
      ))}
    </group>
  );
}

/** The left wall (x = 0): deep green accent paint, baseboard and top cap. */
function LeftWall({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const { D, H } = ROOM;
  return (
    <group>
      <mesh position={[-WALL_T / 2, H / 2, D / 2]} receiveShadow={shadows}>
        <boxGeometry args={[WALL_T, H, D]} />
        <meshStandardMaterial color={pal.wallSide} />
      </mesh>
      <mesh position={[0.004, H / 2, D / 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow={shadows}>
        <planeGeometry args={[D - 0.3, H]} />
        <meshStandardMaterial color={pal.accentWall} roughness={0.95} />
      </mesh>
      <mesh position={[-WALL_T / 2, H + 0.025, D / 2]}>
        <boxGeometry args={[WALL_T + 0.02, 0.05, D]} />
        <meshStandardMaterial color={pal.trim} />
      </mesh>
      <mesh position={[0.012, 0.05, D / 2]}>
        <boxGeometry args={[0.016, 0.1, D]} />
        <meshStandardMaterial color={pal.baseboard} />
      </mesh>
    </group>
  );
}

/** Floating wall shelf on the left wall, with books, a small plant and a trophy. */
function Shelf({ pal, shadows, z, y, plantFirst = false }: { pal: Palette; shadows: boolean; z: number; y: number; plantFirst?: boolean }) {
  const BOOKS = ["#c2410c", "#1f3a52", "#e0a43a", "#2f9e8f", "#8a6fd1", "#f4f1ea"];
  return (
    <group position={[0, y, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, 0.13]} castShadow={shadows}>
        <boxGeometry args={[1.3, 0.04, 0.24]} />
        <meshStandardMaterial color={pal.wood} />
      </mesh>
      {BOOKS.map((c, i) => (
        <mesh key={c} position={[(plantFirst ? 0.05 : -0.55) + i * 0.065, 0.13 + (i % 3) * 0.012, 0.13]} rotation={[0, 0, i === 5 ? -0.25 : 0]}>
          <boxGeometry args={[0.05, 0.22 + (i % 3) * 0.025, 0.17]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      <Plant pal={pal} shadows={shadows} position={[plantFirst ? -0.45 : 0.42, 0.02, 0.13]} scale={0.28} />
      <mesh position={[plantFirst ? -0.15 : 0.12, 0.09, 0.13]}>
        <cylinderGeometry args={[0.03, 0.05, 0.14, 10]} />
        <meshStandardMaterial color="#d4a017" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * The main TV: a big 100-inch-class screen across the slat wall, so the numbers read from anywhere in the room.
 * Its contents are laid out at the original 2.95 m size and scaled up as one piece.
 */
const TV = { w: 2.95, h: 1.45, y: 1.55, scale: 1.45 } as const;

const STATUS_WORD: Record<EmployeeStatus, string> = { idle: "idle", working: "working", needs_you: "needs you", error: "error" };
const DAY_LETTER = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "narrow" });

/**
 * Wall-mounted screen on the feature wall:
 *   left   today's tally in big numbers (reports done, waiting for you)
 *   right  the last 7 days as a bar chart (real runs; failed runs stacked in red), and who is doing what right now
 *   bottom who's on trash duty, and what's playing on Spotify
 * Everything is laid out at the original 2.95 m size and scaled up as one piece.
 */
function Dashboard({ pal, done, waiting, trashName }: { pal: Palette; done: number; waiting: number; trashName: string | null }) {
  const x = (FEATURE.x0 + FEATURE.x1) / 2;
  const L = -TV.w / 2 + 0.16; // left text margin
  const R = 0.08; // right half
  const week = useOffice((s) => s.data.week);
  const employees = useOffice((s) => s.data.employees);
  const track = useSpotify((s) => s.track);
  const days = week?.length ? week : null;
  const max = Math.max(1, ...(days ?? []).map((d) => d.done + d.failed));
  const weekTotal = (days ?? []).reduce((n, d) => n + d.done, 0);
  const BAR = { x0: R + 0.06, step: 0.17, w: 0.1, y0: 0.13, h: 0.34 };
  const rows = TEAM.map((m) => {
    const e = employees.find((v) => v.id === m.id);
    const st: EmployeeStatus = e?.status ?? "idle";
    return { name: m.name, st, word: e && !e.enabled ? "off" : STATUS_WORD[st] };
  });
  const half = Math.ceil(rows.length / 2);
  const cols = [rows.slice(0, half), rows.slice(half)];
  const dot = (st: EmployeeStatus) => st === "working" ? pal.boardAccent : st === "needs_you" ? pal.needsInk : st === "error" ? pal.screenError : "#3c5566";
  const playing = track ? `NOW PLAYING  ${clip(`${track.title} — ${track.artist}`, 34)}` : null;

  return (
    <group position={[x, TV.y, 0.05]} scale={[TV.scale, TV.scale, 1]}>
      <RoundedBox args={[TV.w + 0.08, TV.h + 0.08, 0.06]} radius={0.02} smoothness={2}>
        <meshStandardMaterial color={pal.bezel} />
      </RoundedBox>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[TV.w, TV.h]} />
        <meshStandardMaterial color={pal.board} emissive={pal.board} emissiveIntensity={0.6} />
      </mesh>
      <Suspense fallback={null}>
        <Text font={SCENE_FONT} position={[L, TV.h / 2 - 0.13, 0.035]} fontSize={0.085} color={pal.boardAccent} anchorX="left" anchorY="middle" letterSpacing={0.14}>
          TODAY
        </Text>
        {/* two big tiles: reports done, waiting for you */}
        <Text font={SCENE_FONT} position={[L, 0.14, 0.035]} fontSize={0.4} color={pal.boardInk} anchorX="left" anchorY="middle">
          {String(done)}
        </Text>
        <Text font={SCENE_FONT} position={[L, -0.14, 0.035]} fontSize={0.075} color={pal.boardInk} fillOpacity={0.85} anchorX="left" anchorY="middle" letterSpacing={0.04}>
          {done === 1 ? "REPORT DONE" : "REPORTS DONE"}
        </Text>
        <Text font={SCENE_FONT} position={[-0.66, 0.14, 0.035]} fontSize={0.4} color={waiting ? pal.needsInk : pal.boardInk} anchorX="left" anchorY="middle">
          {String(waiting)}
        </Text>
        <Text font={SCENE_FONT} position={[-0.66, -0.14, 0.035]} fontSize={0.075} color={waiting ? pal.needsInk : pal.boardInk} fillOpacity={0.85} anchorX="left" anchorY="middle" letterSpacing={0.04}>
          WAITING FOR YOU
        </Text>

        {/* the week */}
        <Text font={SCENE_FONT} position={[R, TV.h / 2 - 0.13, 0.035]} fontSize={0.06} color={pal.boardAccent} anchorX="left" anchorY="middle" letterSpacing={0.12}>
          {!days ? "LAST 7 DAYS" : teamStreak(days) >= 7 ? `7-DAY STREAK! · ${weekTotal} DONE` : `LAST 7 DAYS · ${weekTotal} DONE`}
        </Text>
        {days && (
          // monospace: each letter's advance is 0.6 em, so letter spacing lines them up under the bars
          <Text font={SCENE_FONT} position={[BAR.x0 - 0.018, BAR.y0 - 0.06, 0.035]} fontSize={0.055} color={pal.boardInk} fillOpacity={0.6} anchorX="left" anchorY="middle" letterSpacing={BAR.step / 0.055 - 0.6}>
            {days.map((d) => DAY_LETTER.format(new Date(`${d.date}T12:00:00Z`))).join("")}
          </Text>
        )}

        {/* who's doing what, in two columns */}
        {cols.map((col, c) => (
          <Text key={c} font={SCENE_FONT} position={[R + 0.06 + c * 0.66, -0.12, 0.035]} fontSize={0.056} lineHeight={1.75} color={pal.boardInk} fillOpacity={0.9} anchorX="left" anchorY="top">
            {col.map((r) => `${clip(r.name, 8).padEnd(9)}${r.word}`).join("\n")}
          </Text>
        ))}

        <Text font={SCENE_FONT} position={[L, -TV.h / 2 + 0.11, 0.035]} fontSize={0.06} color={pal.boardInk} fillOpacity={0.75} anchorX="left" anchorY="middle" letterSpacing={0.05}>
          {trashName ? `TRASH DUTY  ${trashName.toUpperCase()} · 5:40 PM` : "TRASH DUTY  —"}
        </Text>
        {playing && (
          <Text font={SCENE_FONT} position={[R, -TV.h / 2 + 0.11, 0.035]} fontSize={0.055} color="#1ed760" anchorX="left" anchorY="middle" letterSpacing={0.03}>
            {playing}
          </Text>
        )}
      </Suspense>
      {/* dividers: between the tiles, and between the tiles and the right half */}
      <mesh position={[-0.71, 0.02, 0.034]}>
        <planeGeometry args={[0.006, 0.6]} />
        <meshBasicMaterial color="#3c5566" toneMapped={false} />
      </mesh>
      <mesh position={[R - 0.06, 0, 0.034]}>
        <planeGeometry args={[0.006, TV.h - 0.3]} />
        <meshBasicMaterial color="#3c5566" toneMapped={false} />
      </mesh>
      {/* the bars: done in grey (today in the accent colour), failed stacked on top in red */}
      {(days ?? []).map((d, i) => {
        const hd = (d.done / max) * BAR.h, hf = (d.failed / max) * BAR.h;
        const bx = BAR.x0 + i * BAR.step + BAR.w / 2;
        return (
          <group key={d.date}>
            <mesh position={[bx, BAR.y0 + Math.max(hd, 0.008) / 2, 0.034]}>
              <planeGeometry args={[BAR.w, Math.max(hd, 0.008)]} />
              <meshBasicMaterial color={i === days!.length - 1 ? pal.boardAccent : "#4a6a7e"} toneMapped={false} />
            </mesh>
            {hf > 0 && (
              <mesh position={[bx, BAR.y0 + hd + hf / 2, 0.034]}>
                <planeGeometry args={[BAR.w, hf]} />
                <meshBasicMaterial color={pal.screenError} toneMapped={false} />
              </mesh>
            )}
          </group>
        );
      })}
      {/* status dots beside the names */}
      {cols.flatMap((col, c) => col.map((r, j) => (
        <mesh key={`${c}${j}`} position={[R + 0.03 + c * 0.66, -0.12 - 0.056 * 1.75 * (j + 0.5), 0.034]}>
          <circleGeometry args={[0.014, 10]} />
          <meshBasicMaterial color={dot(r.st)} toneMapped={false} />
        </mesh>
      )))}
    </group>
  );
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const DIGITAL = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });
const MANILA_OFFSET_MS = 8 * 3600_000;

/** Numerals 1–12 as [label, x, y] on the clock face. */
const NUMERALS: readonly (readonly [string, number, number])[] = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const a = (n / 12) * TAU;
  return [String(n), Math.sin(a) * 0.255, Math.cos(a) * 0.255] as const;
});

/**
 * Wall clock on the left wall showing Philippine time (Mabalacat, Pampanga) (or the previewed time), with numerals, a second hand,
 * and a digital 12-hour readout (e.g. "7:42 PM") on an LED panel underneath.
 */
function Clock({ pal }: { pal: Palette }) {
  const now = useSceneNow(1000);
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS);
  const h = manila.getUTCHours() % 12, m = manila.getUTCMinutes(), s = manila.getUTCSeconds();
  const second = -(s / 60) * TAU;
  const minute = -((m + s / 60) / 60) * TAU;
  const hour = -((h + m / 60) / 12) * TAU;

  return (
    <group position={[0.02, 1.95, 4.25]} rotation={[0, Math.PI / 2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.05, 40]} />
        <meshStandardMaterial color={pal.trim} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[0.32, 40]} />
        <meshStandardMaterial color={pal.clockFace} />
      </mesh>
      {Array.from({ length: 60 }, (_, i) => (
        <mesh key={i} position={[Math.sin((i / 60) * TAU) * 0.3, Math.cos((i / 60) * TAU) * 0.3, 0.032]} rotation={[0, 0, -(i / 60) * TAU]}>
          <planeGeometry args={[i % 5 ? 0.004 : 0.01, i % 5 ? 0.014 : 0.03]} />
          <meshBasicMaterial color={pal.clockInk} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        {NUMERALS.map(([label, x, y]) => (
          <Text font={SCENE_FONT} key={label} position={[x, y, 0.034]} fontSize={0.062} color={pal.clockInk} anchorX="center" anchorY="middle">
            {label}
          </Text>
        ))}
      </Suspense>
      <group position={[0, 0, 0.04]} rotation={[0, 0, hour]}>
        <mesh position={[0, 0.075, 0]}>
          <boxGeometry args={[0.03, 0.15, 0.01]} />
          <meshBasicMaterial color={pal.clockInk} />
        </mesh>
      </group>
      <group position={[0, 0, 0.045]} rotation={[0, 0, minute]}>
        <mesh position={[0, 0.11, 0]}>
          <boxGeometry args={[0.018, 0.22, 0.01]} />
          <meshBasicMaterial color={pal.clockInk} />
        </mesh>
      </group>
      <group position={[0, 0, 0.05]} rotation={[0, 0, second]}>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.006, 0.26, 0.005]} />
          <meshBasicMaterial color={pal.clockSecond} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.056]}>
        <circleGeometry args={[0.016, 16]} />
        <meshBasicMaterial color={pal.clockSecond} />
      </mesh>

      {/* digital clock below */}
      <group position={[0, -0.58, 0]}>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.7, 0.24, 0.04]} />
          <meshStandardMaterial color={pal.ledPanel} />
        </mesh>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0.025, 0.042]} fontSize={0.12} color={pal.led} anchorX="center" anchorY="middle" letterSpacing={0.04}>
            {DIGITAL.format(now)}
          </Text>
          <Text font={SCENE_FONT} position={[0, -0.08, 0.042]} fontSize={0.035} color={pal.ledDim} anchorX="center" anchorY="middle" letterSpacing={0.2}>
            {HQ.city.clockLabel}
          </Text>
        </Suspense>
      </group>
    </group>
  );
}
