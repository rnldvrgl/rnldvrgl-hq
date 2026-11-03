"use client";

import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { RoundedBox, Text } from "@react-three/drei";
import { ROOM, OFFICE, FRONT_Z, PAL, SCENE_FONT, type Palette } from "./palette";
import { Plant, TallPlant } from "./Furniture";
import { useSkyMaterial } from "./Lighting";
import { useSceneNow } from "./scene-clock-ui";

const TAU = Math.PI * 2;
const WALL_T = 0.16;
/** Window band on the walls: sill and head height. */
const SILL = 0.75, HEAD = 2.3;
/** Back-wall windows as [x from, x to]. */
const BACK_WINDOWS: readonly (readonly [number, number])[] = [[0.45, 3.85], [7.45, 10.45]];
/** The wood-slat feature wall with the TV, between the windows. */
const FEATURE = { x0: 4.05, x1: 7.25 } as const;

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
        g.fillStyle = `rgb(${Math.round(217 * tone)}, ${Math.round(194 * tone)}, ${Math.round(160 * tone)})`;
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
 * The building shell: oak floor, tiled pantry, two walls with tall windows onto the city
 * (the sky changes with the time of day), a slatted feature wall with the team dashboard, shelves and the clock.
 */
export function Room({ pal, shadows, done, waiting, trashName }: RoomProps) {
  const { W, D, H } = ROOM;
  const planks = usePlankTexture(W, D);
  const tileW = W - OFFICE.x0, tileD = FRONT_Z - OFFICE.z1;
  const tiles = useTileTexture(tileW, tileD);
  const sky = useSkyMaterial();

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

      <BackWall pal={pal} shadows={shadows} sky={sky} />
      <FrontWall pal={pal} />
      <LeftWall pal={pal} shadows={shadows} />

      <Dashboard pal={pal} done={done} waiting={waiting} trashName={trashName} />
      <Clock pal={pal} />

      {/* floating shelves on the left wall: books, a plant, a trophy */}
      <Shelf pal={pal} shadows={shadows} z={1.35} y={1.45} />
      <Shelf pal={pal} shadows={shadows} z={6.0} y={1.45} plantFirst />

      {/* tall plants in the corners and by the windows */}
      <TallPlant pal={pal} shadows={shadows} position={[0.42, 0, 0.42]} />
      <TallPlant pal={pal} shadows={shadows} position={[0.42, 0, FRONT_Z - 0.3]} scale={0.85} />
      <Plant pal={pal} shadows={shadows} position={[10.4, 0, 0.32]} scale={0.8} />
    </group>
  );
}

/** The back wall (z = 0), built around two window openings. */
function BackWall({ pal, shadows, sky }: { pal: Palette; shadows: boolean; sky: THREE.Material }) {
  const { W, H } = ROOM;
  const z = -WALL_T / 2;
  // solid stretches between and beside the windows
  const solids: [number, number][] = [];
  let from = -WALL_T;
  for (const [a, b] of BACK_WINDOWS) { solids.push([from, a]); from = b; }
  solids.push([from, W + WALL_T]);

  return (
    <group>
      {solids.map(([a, b]) => (
        <mesh key={a} position={[(a + b) / 2, H / 2, z]} receiveShadow={shadows}>
          <boxGeometry args={[b - a, H, WALL_T]} />
          <meshStandardMaterial color={pal.wall} />
        </mesh>
      ))}
      {BACK_WINDOWS.map(([a, b]) => (
        <group key={a}>
          <mesh position={[(a + b) / 2, SILL / 2, z]} receiveShadow={shadows}>
            <boxGeometry args={[b - a, SILL, WALL_T]} />
            <meshStandardMaterial color={pal.wall} />
          </mesh>
          <mesh position={[(a + b) / 2, (HEAD + H) / 2, z]}>
            <boxGeometry args={[b - a, H - HEAD, WALL_T]} />
            <meshStandardMaterial color={pal.wall} />
          </mesh>
          <Window pal={pal} sky={sky} length={b - a} position={[(a + b) / 2, 0, 0]} />
        </group>
      ))}
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

/** A window opening along local x, sky inside, black aluminium frame with mullions and a white sill. */
function Window({ pal, sky, length, position, rotY = 0 }: {
  pal: Palette; sky: THREE.Material; length: number; position: [number, number, number]; rotY?: number;
}) {
  const h = HEAD - SILL;
  const panes = Math.max(2, Math.round(length / 1.1));
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, SILL + h / 2, -WALL_T + 0.02]} material={sky}>
        <planeGeometry args={[length, h]} />
      </mesh>
      {/* frame */}
      {[SILL + 0.02, HEAD - 0.02].map((y) => (
        <mesh key={y} position={[0, y, -0.03]}>
          <boxGeometry args={[length, 0.04, 0.05]} />
          <meshStandardMaterial color={pal.windowFrame} />
        </mesh>
      ))}
      {Array.from({ length: panes + 1 }, (_, i) => (
        <mesh key={i} position={[-length / 2 + (i * length) / panes, SILL + h / 2, -0.03]}>
          <boxGeometry args={[0.04, h, 0.05]} />
          <meshStandardMaterial color={pal.windowFrame} />
        </mesh>
      ))}
      <mesh position={[0, SILL + 0.62, -0.03]}>
        <boxGeometry args={[length, 0.025, 0.04]} />
        <meshStandardMaterial color={pal.windowFrame} />
      </mesh>
      <mesh position={[0, SILL - 0.01, 0.04]}>
        <boxGeometry args={[length + 0.08, 0.03, 0.12]} />
        <meshStandardMaterial color={pal.sill} />
      </mesh>
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

/** The main TV: nearly the full width of the slat wall, so the numbers read from across the room. */
const TV = { w: 2.95, h: 1.45, y: 1.45 } as const;

/** Wall-mounted screen on the feature wall: today's tally in big numbers, and who's on trash duty. */
function Dashboard({ pal, done, waiting, trashName }: { pal: Palette; done: number; waiting: number; trashName: string | null }) {
  const x = (FEATURE.x0 + FEATURE.x1) / 2;
  const L = -TV.w / 2 + 0.16; // left text margin
  return (
    <group position={[x, TV.y, 0.05]}>
      <RoundedBox args={[TV.w + 0.08, TV.h + 0.08, 0.06]} radius={0.02} smoothness={2}>
        <meshStandardMaterial color={pal.bezel} />
      </RoundedBox>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[TV.w, TV.h]} />
        <meshStandardMaterial color={pal.board} emissive={pal.board} emissiveIntensity={0.6} />
      </mesh>
      <Suspense fallback={null}>
        <Text font={SCENE_FONT} position={[L, TV.h / 2 - 0.14, 0.035]} fontSize={0.1} color={pal.boardAccent} anchorX="left" anchorY="middle" letterSpacing={0.14}>
          TODAY
        </Text>
        {/* two big tiles: reports done, waiting for you */}
        <Text font={SCENE_FONT} position={[L, 0.08, 0.035]} fontSize={0.46} color={pal.boardInk} anchorX="left" anchorY="middle">
          {String(done)}
        </Text>
        <Text font={SCENE_FONT} position={[L, -0.27, 0.035]} fontSize={0.1} color={pal.boardInk} fillOpacity={0.85} anchorX="left" anchorY="middle" letterSpacing={0.04}>
          {done === 1 ? "REPORT DONE" : "REPORTS DONE"}
        </Text>
        <Text font={SCENE_FONT} position={[0.05, 0.08, 0.035]} fontSize={0.46} color={waiting ? pal.needsInk : pal.boardInk} anchorX="left" anchorY="middle">
          {String(waiting)}
        </Text>
        <Text font={SCENE_FONT} position={[0.05, -0.27, 0.035]} fontSize={0.1} color={waiting ? pal.needsInk : pal.boardInk} fillOpacity={0.85} anchorX="left" anchorY="middle" letterSpacing={0.04}>
          WAITING FOR YOU
        </Text>
        <Text font={SCENE_FONT} position={[L, -TV.h / 2 + 0.14, 0.035]} fontSize={0.085} color={pal.boardInk} fillOpacity={0.75} anchorX="left" anchorY="middle" letterSpacing={0.06}>
          {trashName ? `TRASH DUTY  ${trashName.toUpperCase()} · 5:40 PM` : "TRASH DUTY  —"}
        </Text>
      </Suspense>
      {/* divider between the tiles, and a bar chart in the top-right corner (clear of the labels) */}
      <mesh position={[-0.05, -0.05, 0.034]}>
        <planeGeometry args={[0.008, 0.75]} />
        <meshBasicMaterial color="#3c5566" toneMapped={false} />
      </mesh>
      {[0.22, 0.4, 0.3, 0.52, 0.36].map((h, i) => (
        <mesh key={i} position={[TV.w / 2 - 0.66 + i * 0.11, 0.22 + (h * 0.8) / 2, 0.034]} scale={[1, 0.8, 1]}>
          <planeGeometry args={[0.07, h]} />
          <meshBasicMaterial color={i === 3 ? pal.boardAccent : "#3c5566"} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

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
            MABALACAT
          </Text>
        </Suspense>
      </group>
    </group>
  );
}
