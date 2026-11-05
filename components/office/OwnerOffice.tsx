"use client";

import { handleNow } from "@/lib/prefs-client";

import { ownerName, ownersName } from "@/lib/names";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import { OFFICE, ROOM, type Palette, SCENE_FONT } from "./palette";
import { OfficeChair, Plant, TallPlant, type Vec3 } from "./Furniture";
import { AirCon, officeAcOn } from "./Amenities";
import { light } from "./Lighting";
import { useGameScreen } from "./GameScreen";
import { mergeParts, type Part } from "./batch";
import { useOfficeStyle, type OfficeStyle } from "@/lib/settings";

const { x0: X0, x1: X1, z1: Z1 } = OFFICE;
/** Middle of the office along x: the executive desk, monitors and chair line up on it. */
const MX = (X0 + X1) / 2;
/** Glass partition height (the room walls are ROOM.H). */
const GH = 2.35;
const DOOR_W = 1.0;
const DESK_H = 0.76;
const CHAIR_Z = 1.62;

/* ------------------------------------------------------------------ styles */

type Style = Exclude<OfficeStyle, "auto">;

/**
 * Everything that changes between the office styles (Settings → Boss → Office style). Shapes stay the same;
 * colours, the feature wall and a few extras change:
 *   executive  walnut slats, leather, a warm cove light (the original office)
 *   gaming     dark walls, glowing hex acoustic panels, neon light cycling through the colours, a red racing chair
 *   cozy       blush walls with a plaster arch, white oak desk, fairy lights, a rattan pendant, lots of plants
 *   minimal    white oak slats, white desk, grey sofa, one big plant and a line drawing
 *   studio     a creator's studio: charcoal acoustic foam, a ring light and a camera, a boom mic, a red ON AIR sign
 *   heritage   Filipino heritage: narra wood, capiz shell window panels, a banig rug, rattan, a salakot on the wall
 */
type Theme = {
  floor: string; rug: string; desk: string; deskSide: string; chair: string;
  /** Under-desk strip and cove: "rgb" cycles through the colours. */
  strip: string | "rgb"; cove: string | "rgb";
  wall: "slats" | "panel" | "arch" | "foam" | "capiz";
  slat: string; slatAlt: string; wallBase: string;
  signPlate: string; signInk: string; halo: string; haloOpacity: number;
  shelf: string; sofa: string; cushion: string; pillow: string; loungeRug: string;
  credenza: string; credenzaDoor: string; art: readonly [string, string, string];
  shade: string;
};

function themeOf(style: Style, pal: Palette): Theme {
  switch (style) {
    case "gaming":
      return {
        floor: "#2a2833", rug: "#1b1a22", desk: "#17171c", deskSide: "#0f0f13", chair: "#b91c1c",
        strip: "rgb", cove: "rgb", wall: "panel", slat: "#232131", slatAlt: "#2c2940", wallBase: "#16141f",
        signPlate: "#0b0b10", signInk: "#22d3ee", halo: "#d946ef", haloOpacity: 0.45,
        shelf: "#1f1d29", sofa: "#1f1d29", cushion: "#312e45", pillow: "#22d3ee", loungeRug: "#2a2638",
        credenza: "#1f1d29", credenzaDoor: "#151320", art: ["#0b0b10", "#d946ef", "#22d3ee"], shade: "#1f1d29",
      };
    case "cozy":
      return {
        floor: "#c9a98b", rug: "#f1e4dc", desk: "#f3efe9", deskSide: "#e2d8cc", chair: "#e9cdd2",
        strip: "#ffc9d6", cove: "#ffd9c2", wall: "arch", slat: "#efd3d6", slatAlt: "#e8c2c7", wallBase: "#f2dadc",
        signPlate: "#fff7f5", signInk: "#b0577f", halo: "#ffd1dc", haloOpacity: 0.4,
        shelf: "#d8b98f", sofa: "#e7c2c6", cushion: "#f6e3e5", pillow: "#c97b8f", loungeRug: "#f7efe9",
        credenza: "#d8b98f", credenzaDoor: "#c9a77a", art: ["#fbe8e6", "#e8a0a8", "#9cae8f"], shade: "#f6e7d8",
      };
    case "minimal":
      return {
        floor: "#cbb593", rug: "#e7e2d8", desk: "#eeebe5", deskSide: "#d9d3c8", chair: "#2b2d31",
        strip: "#f8fafc", cove: "#fff4e0", wall: "slats", slat: "#d9c2a0", slatAlt: "#ccb28c", wallBase: "#c3a882",
        signPlate: "#f8fafc", signInk: "#111827", halo: "#ffffff", haloOpacity: 0,
        shelf: "#d9c2a0", sofa: "#9ca3af", cushion: "#b8bdc4", pillow: "#e5e7eb", loungeRug: "#ebe7df",
        credenza: "#d9c2a0", credenzaDoor: "#ccb28c", art: ["#f8f6f1", "#111827", "#9ca3af"], shade: "#f4f1ea",
      };
    case "studio":
      return {
        floor: "#3a3633", rug: "#24211f", desk: "#2a2725", deskSide: "#1c1a19", chair: "#1f1f22",
        strip: "#ff8a3d", cove: "#ffb27a", wall: "foam", slat: "#2f2c2b", slatAlt: "#3b3735", wallBase: "#242120",
        signPlate: "#151313", signInk: "#ffb27a", halo: "#ff8a3d", haloOpacity: 0.35,
        shelf: "#4a3f37", sofa: "#3f3a37", cushion: "#56504c", pillow: "#ff8a3d", loungeRug: "#4a4440",
        credenza: "#2f2b29", credenzaDoor: "#24211f", art: ["#151313", "#ff8a3d", "#f5f0e8"], shade: "#2f2c2b",
      };
    case "heritage":
      return {
        floor: "#6e4429", rug: "#d9b77a", desk: "#7a4a2a", deskSide: "#5b351d", chair: "#c49a5a",
        strip: "#ffd59a", cove: "#ffd59a", wall: "capiz", slat: "#7a4a2a", slatAlt: "#5b351d", wallBase: "#5b351d",
        signPlate: "#f6ecd8", signInk: "#5b351d", halo: "#ffe2b0", haloOpacity: 0.3,
        shelf: "#7a4a2a", sofa: "#c49a5a", cushion: "#f1e3c6", pillow: "#b91c1c", loungeRug: "#e3c58e",
        credenza: "#7a4a2a", credenzaDoor: "#5b351d", art: ["#f6ecd8", "#1d4ed8", "#b91c1c"], shade: "#f2e6cf",
      };
    default:
      return {
        floor: pal.officeFloor, rug: "#3a3d42", desk: pal.execDesk, deskSide: pal.execDeskSide, chair: pal.execChair,
        strip: "rgb", cove: "#ffd9a8", wall: "slats", slat: WALNUT, slatAlt: WALNUT_DARK, wallBase: WALNUT_DARK,
        signPlate: "#111315", signInk: "#f5f5f0", halo: "#ffcf8a", haloOpacity: 0.35,
        shelf: WALNUT, sofa: "#2f3338", cushion: "#4a4f57", pillow: "#c2410c", loungeRug: "#cfccc4",
        credenza: WALNUT, credenzaDoor: WALNUT_DARK, art: ["#f3f0e8", "#d97757", "#1f2937"], shade: "#f4f1ea",
      };
  }
}

/** One straight glass partition, centred on `position`, running along local x, turned by `rotY`. */
function Glass({ pal, position, length, rotY = 0 }: { pal: Palette; position: Vec3; length: number; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, GH / 2, 0]}>
        <planeGeometry args={[length, GH]} />
        <meshStandardMaterial color={pal.glass} transparent opacity={pal.glassOpacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* frosted privacy band */}
      <mesh position={[0, 1.1, 0]}>
        <planeGeometry args={[length, 0.22]} />
        <meshStandardMaterial color={pal.frost} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* rails and end posts */}
      {[0.025, GH].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[length, 0.05, 0.05]} />
          <meshStandardMaterial color={pal.glassFrame} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * length) / 2, GH / 2, 0]}>
          <boxGeometry args={[0.05, GH, 0.05]} />
          <meshStandardMaterial color={pal.glassFrame} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The owner's glass corner office in the back-right of the room: L-shaped executive desk,
 * a curved ultrawide plus a side monitor, a PC tower with a slow RGB glow, and the boss at the desk.
 * Its interior follows the office style chosen in Settings → Boss (see themeOf).
 */
export function OwnerOffice({ pal, shadows, reducedMotion }: { pal: Palette; shadows: boolean; reducedMotion: boolean }) {
  const style = useOfficeStyle();
  const th = useMemo(() => themeOf(style, pal), [style, pal]);
  const ceiling = useRef<THREE.PointLight>(null);
  const game = useGameScreen();
  /** One material for every RGB strip in the office, cycling slowly (held still for reduced motion). */
  const rgb = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5fd0d8", emissive: "#5fd0d8", emissiveIntensity: 1.3, toneMapped: false }), []);
  const strip = useMemo(() => th.strip === "rgb" ? rgb
    : new THREE.MeshStandardMaterial({ color: th.strip, emissive: th.strip, emissiveIntensity: 1.1, toneMapped: false }), [th.strip, rgb]);

  useFrame(({ clock }) => {
    const dim = style === "gaming" || style === "studio";
    if (ceiling.current) ceiling.current.intensity = (dim ? 0.45 : 0.8) + light.lamps * (dim ? 2.8 : 4.5);
    if (reducedMotion) return;
    const hue = (clock.elapsedTime * 0.06) % 1;
    rgb.color.setHSL(hue, 0.9, 0.55);
    rgb.emissive.setHSL(hue, 0.9, 0.55);
  });

  // Curved ultrawide: an open cylinder slice whose axis sits in front of the screen, toward the chair.
  const UW_R = 1.6, UW_W = 1.26, UW_H = 0.42, UW_Z = 0.42, UW_Y = DESK_H + 0.43;
  const uwArc = UW_W / UW_R;

  const ow = X1 - X0;
  return (
    <group>
      {/* wooden floor and a round rug */}
      <mesh position={[X0 + ow / 2, 0.004, Z1 / 2]} receiveShadow={shadows}>
        <boxGeometry args={[ow, 0.004, Z1]} />
        <meshStandardMaterial color={th.floor} />
      </mesh>
      <mesh position={[MX + 0.05, 0.008, 1.55]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows}>
        <planeGeometry args={[2.8, 1.9]} />
        <meshStandardMaterial color={th.rug} roughness={1} />
      </mesh>

      {/* glass: left side, front (door gap at its left end), right side */}
      <Glass pal={pal} position={[X0, 0, Z1 / 2]} length={Z1} rotY={Math.PI / 2} />
      <Glass pal={pal} position={[(X0 + DOOR_W + X1) / 2, 0, Z1]} length={X1 - X0 - DOOR_W} />
      <Glass pal={pal} position={[X1, 0, Z1 / 2]} length={Z1} rotY={Math.PI / 2} />
      <mesh position={[X0 + DOOR_W / 2, GH, Z1]}>
        <boxGeometry args={[DOOR_W, 0.05, 0.05]} />
        <meshStandardMaterial color={pal.glassFrame} />
      </mesh>
      {/* glass door, swung open into the office */}
      <group position={[X0 + DOOR_W, 0, Z1]} rotation={[0, -1.5, 0]}>
        <mesh position={[-0.45, GH / 2 - 0.05, 0]}>
          <planeGeometry args={[0.88, GH - 0.12]} />
          <meshStandardMaterial color={pal.glass} transparent opacity={pal.glassOpacity + 0.06} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[-0.8, 1.05, 0.03]}>
          <boxGeometry args={[0.025, 0.4, 0.025]} />
          <meshStandardMaterial color={pal.glassFrame} />
        </mesh>
      </group>

      {/* nameplate on the front glass, and the HQ sign on the back wall */}
      <group position={[X0 + DOOR_W + 0.5, 1.5, Z1 + 0.03]}>
        <mesh>
          <boxGeometry args={[0.66, 0.22, 0.012]} />
          <meshStandardMaterial color={pal.sign} />
        </mesh>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0.035, 0.008]} fontSize={0.075} color={pal.signInk} anchorX="center" anchorY="middle" letterSpacing={0.08}>
            {ownerName().toUpperCase()}
          </Text>
          <Text font={SCENE_FONT} position={[0, -0.055, 0.008]} fontSize={0.04} color={pal.signAccent} anchorX="center" anchorY="middle" letterSpacing={0.12}>
            MAIN OFFICE
          </Text>
        </Suspense>
      </group>
      {/* L-shaped executive desk: main top along the back wall, return wing on the right */}
      <RoundedBox args={[2.4, 0.06, 0.9]} radius={0.025} smoothness={2} position={[MX, DESK_H, 0.75]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial color={th.desk} />
      </RoundedBox>
      <RoundedBox args={[0.56, 0.06, 1.0]} radius={0.025} smoothness={2} position={[MX + 0.92, DESK_H, 1.7]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial color={th.desk} />
      </RoundedBox>
      <mesh position={[MX - 1.17, (DESK_H - 0.03) / 2, 0.75]} castShadow={shadows}>
        <boxGeometry args={[0.05, DESK_H - 0.03, 0.84]} />
        <meshStandardMaterial color={th.deskSide} />
      </mesh>
      <mesh position={[MX, DESK_H - 0.26, 0.34]}>
        <boxGeometry args={[2.3, 0.44, 0.03]} />
        <meshStandardMaterial color={th.deskSide} />
      </mesh>
      <mesh position={[MX + 0.92, 0.32, 1.65]} castShadow={shadows}>
        <boxGeometry args={[0.5, 0.64, 0.86]} />
        <meshStandardMaterial color={th.deskSide} />
      </mesh>
      {/* RGB strip under the front edge */}
      <mesh position={[MX - 0.25, DESK_H - 0.04, 1.205]} material={strip}>
        <boxGeometry args={[1.85, 0.012, 0.012]} />
      </mesh>

      {/* curved ultrawide on a stand */}
      <mesh position={[MX, DESK_H + 0.04, UW_Z + 0.02]}>
        <boxGeometry args={[0.36, 0.015, 0.2]} />
        <meshStandardMaterial color={pal.bezel} />
      </mesh>
      <mesh position={[MX, DESK_H + 0.2, UW_Z - 0.03]}>
        <boxGeometry args={[0.05, 0.3, 0.04]} />
        <meshStandardMaterial color={pal.bezel} />
      </mesh>
      <mesh position={[MX, UW_Y, UW_Z + UW_R]}>
        <cylinderGeometry args={[UW_R + 0.015, UW_R + 0.015, UW_H + 0.04, 24, 1, true, Math.PI - (uwArc + 0.03) / 2, uwArc + 0.03]} />
        <meshStandardMaterial color={pal.bezel} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[MX, UW_Y, UW_Z + UW_R]}>
        <cylinderGeometry args={[UW_R, UW_R, UW_H, 24, 1, true, Math.PI - uwArc / 2, uwArc]} />
        {/* a battle-royale match on screen (see GameScreen.ts) */}
        <meshStandardMaterial map={game} emissiveMap={game} color="#ffffff" emissive="#ffffff" emissiveIntensity={0.85} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <pointLight position={[MX, UW_Y, UW_Z + 0.5]} color="#f4a259" intensity={1.2} distance={2.4} />

      {/* side monitor on the right, angled toward the chair */}
      <group position={[MX + 1.05, DESK_H, 0.72]} rotation={[0, -0.8, 0]}>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.24, 0.015, 0.16]} />
          <meshStandardMaterial color={pal.bezel} />
        </mesh>
        <mesh position={[0, 0.17, -0.03]}>
          <boxGeometry args={[0.04, 0.26, 0.03]} />
          <meshStandardMaterial color={pal.bezel} />
        </mesh>
        <RoundedBox args={[0.62, 0.38, 0.025]} radius={0.01} smoothness={2} position={[0, 0.38, 0]}>
          <meshStandardMaterial color={pal.bezel} />
        </RoundedBox>
        <mesh position={[0, 0.38, 0.014]}>
          <planeGeometry args={[0.59, 0.35]} />
          <meshStandardMaterial color={pal.sideScreen} emissive={pal.sideScreen} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      </group>

      {/* keyboard, mouse, mug, desk plant */}
      <RoundedBox args={[0.5, 0.022, 0.16]} radius={0.006} smoothness={1} position={[MX, DESK_H + 0.042, 1.06]}>
        <meshStandardMaterial color={pal.bezel} />
      </RoundedBox>
      <mesh position={[MX + 0.42, DESK_H + 0.033, 1.06]}>
        <boxGeometry args={[0.26, 0.004, 0.22]} />
        <meshStandardMaterial color={pal.mousepad} />
      </mesh>
      <mesh position={[MX + 0.42, DESK_H + 0.046, 1.08]} scale={[0.034, 0.019, 0.052]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={pal.bezel} />
      </mesh>
      <mesh position={[MX - 0.6, DESK_H + 0.09, 1.12]} castShadow={shadows}>
        <cylinderGeometry args={[0.05, 0.045, 0.11, 12]} />
        <meshStandardMaterial color={pal.ownerShirt} />
      </mesh>

      {/* PC tower on the floor beside the wing: glowing fans and strip on the front, lit side panel */}
      <group position={[X1 - 0.42, 0, 1.3]}>
        <RoundedBox args={[0.24, 0.52, 0.48]} radius={0.015} smoothness={2} position={[0, 0.28, 0]} castShadow={shadows}>
          <meshStandardMaterial color={pal.pcCase} />
        </RoundedBox>
        {[0.4, 0.2].map((y) => (
          <mesh key={y} position={[0, y, 0.242]}>
            <torusGeometry args={[0.065, 0.009, 6, 20]} />
            <meshStandardMaterial color="#5fd0d8" emissive="#5fd0d8" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0.121, 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshStandardMaterial color={pal.sideScreen} emissive={pal.sideScreen} emissiveIntensity={0.5} transparent opacity={0.7} toneMapped={false} />
        </mesh>
        <mesh position={[-0.08, 0.28, 0.243]}>
          <boxGeometry args={[0.012, 0.44, 0.006]} />
          <meshStandardMaterial color={pal.ultrawide} emissive={pal.ultrawide} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>

      <OfficeChair pal={pal} shadows={shadows} position={[MX, 0, CHAIR_Z]} color={th.chair} executive />

      <BossDecor pal={pal} shadows={shadows} th={th} style={style} rgb={rgb} reducedMotion={reducedMotion} />
      {/* a warm ceiling light and the office's split AC */}
      <pointLight ref={ceiling} position={[MX, ROOM.H - 0.2, 2.0]} color={style === "gaming" ? "#c4b5fd" : style === "cozy" ? "#ffd6c2" : style === "studio" ? "#ffc8a0" : "#ffe2b8"} intensity={1.6} distance={6} decay={1.6} />
      <AirCon pal={pal} shadows={shadows} position={[X1 - 0.75, 2.3, 0.12]} on={officeAcOn} />

    </group>
  );
}

/* ------------------------------------------------------------------ the office's furnishing */

const WALNUT = "#4a3324", WALNUT_DARK = "#2e1f16", LEATHER = "#6b3f2a", CHROME = "#c9ced3";

/**
 * The corner office's furnishing: a walnut slat feature wall behind the desk with a backlit "rnldvrgl" sign
 * and a warm cove light, a tall bookcase, a lounge corner (sofa, stone table, floor lamp), creator gear on the desk, a low credenza along the front glass, framed art, and a few things on the desk.
 */
function BossDecor({ pal, shadows, th, style, rgb, reducedMotion }: { pal: Palette; shadows: boolean; th: Theme; style: Style; rgb: THREE.Material; reducedMotion: boolean }) {
  const cove = useRef<THREE.MeshStandardMaterial>(null);
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const bar = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (bar.current) bar.current.emissiveIntensity = 0.3 + light.lamps * 0.6;
    if (cove.current) cove.current.emissiveIntensity = 0.6 + light.lamps * 1.4;
    if (lamp.current) lamp.current.emissiveIntensity = 0.3 + light.lamps * 1.5;
  });
  const coveMat = useMemo(() => (th.cove === "rgb" ? rgb : null), [th.cove, rgb]);
  const slatX0 = X0 + 1.05, slatX1 = X1 - 1.3;
  const slats = Math.floor((slatX1 - slatX0) / 0.08);
  const BOOKS = ["#1f2937", "#9ca3af", "#b45309", "#e5e7eb", "#374151", "#7c2d12", "#d1d5db"];

  return (
    <group>
      {/* the feature wall behind the desk (slats, a dark panel wall or a painted arch) and its cove light */}
      <mesh position={[(slatX0 + slatX1) / 2, ROOM.H / 2, 0.006]}>
        <planeGeometry args={[slatX1 - slatX0, ROOM.H]} />
        <meshStandardMaterial color={th.wallBase} />
      </mesh>
      {th.wall === "slats" && Array.from({ length: slats }, (_, i) => (
        <mesh key={i} position={[slatX0 + 0.04 + i * 0.08, ROOM.H / 2, 0.02]}>
          <boxGeometry args={[0.045, ROOM.H - 0.04, 0.025]} />
          <meshStandardMaterial color={i % 3 === 0 ? th.slatAlt : th.slat} />
        </mesh>
      ))}
      {th.wall === "panel" && <HexPanels x0={slatX0} x1={slatX1} th={th} rgb={rgb} />}
      {th.wall === "arch" && <Arch th={th} />}
      {th.wall === "foam" && <FoamWall x0={slatX0} x1={slatX1} th={th} />}
      {th.wall === "capiz" && <CapizWall x0={slatX0} x1={slatX1} th={th} />}
      {coveMat ? (
        <mesh position={[(slatX0 + slatX1) / 2, ROOM.H - 0.06, 0.05]} material={coveMat}>
          <boxGeometry args={[slatX1 - slatX0, 0.025, 0.02]} />
        </mesh>
      ) : (
        <mesh position={[(slatX0 + slatX1) / 2, ROOM.H - 0.06, 0.05]}>
          <boxGeometry args={[slatX1 - slatX0, 0.025, 0.02]} />
          <meshStandardMaterial ref={cove} color={th.cove} emissive={th.cove} emissiveIntensity={1} toneMapped={false} />
        </mesh>
      )}
      {/* backlit sign: a plate with a soft halo behind it */}
      <group position={[MX, 1.98, 0.06]}>
        <mesh position={[0, 0, -0.01]} visible={th.haloOpacity > 0}>
          <planeGeometry args={[1.35, 0.48]} />
          <meshBasicMaterial color={th.halo} transparent opacity={th.haloOpacity} toneMapped={false} />
        </mesh>
        <RoundedBox args={[1.2, 0.34, 0.03]} radius={0.01} smoothness={2}>
          <meshStandardMaterial color={th.signPlate} />
        </RoundedBox>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0, 0.02]} fontSize={0.16} color={th.signInk} anchorX="center" anchorY="middle" letterSpacing={0.14}>
            {handleNow()}
          </Text>
        </Suspense>
      </group>

      {/* tall bookcase in the back-left corner */}
      <group position={[X0 + 0.48, 0, 0.22]}>
        {[0, 1].map((s) => (
          <mesh key={s} position={[s ? 0.36 : -0.36, 0.95, 0]} castShadow={shadows}>
            <boxGeometry args={[0.04, 1.9, 0.36]} />
            <meshStandardMaterial color={th.shelf} />
          </mesh>
        ))}
        {[0.04, 0.5, 0.95, 1.4, 1.88].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[0.76, 0.035, 0.36]} />
            <meshStandardMaterial color={th.shelf} />
          </mesh>
        ))}
        {[0.5, 0.95, 1.4].flatMap((y, row) => BOOKS.slice(row, row + 5).map((c, i) => (
          <mesh key={`${y}${i}`} position={[-0.28 + i * 0.07 + row * 0.04, y + 0.15, 0.02]} rotation={[0, 0, i === 4 ? -0.3 : 0]}>
            <boxGeometry args={[0.055, 0.26 - (i % 2) * 0.04, 0.24]} />
            <meshStandardMaterial color={c} />
          </mesh>
        )))}
        <mesh position={[0.2, 1.08, 0.02]}>
          <cylinderGeometry args={[0.035, 0.06, 0.22, 10]} />
          <meshStandardMaterial color="#d4a017" metalness={0.7} roughness={0.3} />
        </mesh>
        <Plant pal={pal} shadows={shadows} position={[0.18, 0.52, 0.02]} scale={0.3} />
        <Plant pal={pal} shadows={shadows} position={[-0.1, 1.9, 0.02]} scale={0.28} />
      </group>

      {/* lounge corner, front-right: a two-seat sofa against the glass, a stone coffee table, a floor lamp */}
      <group position={[X1 - 0.95, 0, 3.2]}>
        <mesh position={[-0.1, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.7, 1.6]} />
          <meshStandardMaterial color={th.loungeRug} roughness={1} />
        </mesh>
        <group position={[0.55, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <RoundedBox args={[1.45, 0.28, 0.78]} radius={0.06} smoothness={2} position={[0, 0.22, 0]} castShadow={shadows}>
            <meshStandardMaterial color={th.sofa} roughness={0.8} />
          </RoundedBox>
          {[-0.34, 0.34].map((x) => (
            <RoundedBox key={x} args={[0.66, 0.14, 0.62]} radius={0.05} smoothness={2} position={[x, 0.42, -0.04]} castShadow={shadows}>
              <meshStandardMaterial color={th.cushion} roughness={0.9} />
            </RoundedBox>
          ))}
          <RoundedBox args={[1.45, 0.42, 0.18]} radius={0.06} smoothness={2} position={[0, 0.55, 0.3]} castShadow={shadows}>
            <meshStandardMaterial color={th.sofa} roughness={0.8} />
          </RoundedBox>
          {[-0.68, 0.68].map((x) => (
            <RoundedBox key={x} args={[0.12, 0.42, 0.78]} radius={0.05} smoothness={2} position={[x, 0.38, 0]} castShadow={shadows}>
              <meshStandardMaterial color={th.sofa} roughness={0.8} />
            </RoundedBox>
          ))}
          <RoundedBox args={[0.34, 0.3, 0.1]} radius={0.04} smoothness={2} position={[-0.42, 0.6, 0.18]} rotation={[0.2, 0, 0.1]}>
            <meshStandardMaterial color={th.pillow} />
          </RoundedBox>
        </group>
        {/* stone coffee table on a solid plinth */}
        <RoundedBox args={[0.8, 0.06, 0.5]} radius={0.02} smoothness={2} position={[-0.45, 0.36, 0]} castShadow={shadows}>
          <meshStandardMaterial color="#ecebe6" roughness={0.25} />
        </RoundedBox>
        <mesh position={[-0.45, 0.17, 0]}>
          <boxGeometry args={[0.5, 0.32, 0.28]} />
          <meshStandardMaterial color="#3a3d42" />
        </mesh>
        <mesh position={[-0.35, 0.4, 0.05]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.22, 0.03, 0.16]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        {/* game controller on the table */}
        <mesh position={[-0.62, 0.405, -0.08]} scale={[1, 0.4, 0.65]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
        {/* floor lamp: weighted base, straight stem, drum shade */}
        <group position={[0.55, 0, -0.95]}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.15, 0.16, 0.04, 18]} />
            <meshStandardMaterial color="#1f2328" />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 1.4, 8]} />
            <meshStandardMaterial color={CHROME} metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.17, 0.2, 0.26, 20, 1, true]} />
            <meshStandardMaterial ref={lamp} color={th.shade} emissive="#ffd59a" emissiveIntensity={0.4} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* low credenza along the front glass, with a vase and books */}
      <group position={[X0 + 2.15, 0, Z1 - 0.28]}>
        <RoundedBox args={[1.4, 0.5, 0.4]} radius={0.02} smoothness={2} position={[0, 0.27, 0]} castShadow={shadows}>
          <meshStandardMaterial color={th.credenza} />
        </RoundedBox>
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} position={[x, 0.27, 0.201]}>
            <planeGeometry args={[0.66, 0.42]} />
            <meshStandardMaterial color={th.credenzaDoor} />
          </mesh>
        ))}
        <mesh position={[-0.4, 0.66, 0]}>
          <cylinderGeometry args={[0.06, 0.09, 0.28, 14]} />
          <meshStandardMaterial color="#e5e7eb" roughness={0.3} />
        </mesh>
        <mesh position={[0.3, 0.56, 0]}>
          <boxGeometry args={[0.32, 0.06, 0.22]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <Plant pal={pal} shadows={shadows} position={[0.05, 0.52, 0]} scale={0.3} />
      </group>

      {/* framed art under the AC */}
      <group position={[X1 - 0.75, 1.35, 0.03]}>
        <mesh>
          <boxGeometry args={[0.78, 0.56, 0.03]} />
          <meshStandardMaterial color="#111315" />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.68, 0.46]} />
          <meshStandardMaterial color={th.art[0]} />
        </mesh>
        <mesh position={[-0.1, 0.03, 0.019]}>
          <circleGeometry args={[0.13, 24]} />
          <meshStandardMaterial color={th.art[1]} emissive={style === "gaming" ? th.art[1] : "#000000"} emissiveIntensity={0.6} toneMapped={style !== "gaming"} />
        </mesh>
        <mesh position={[0.12, -0.08, 0.02]}>
          <planeGeometry args={[0.3, 0.12]} />
          <meshStandardMaterial color={th.art[2]} emissive={style === "gaming" ? th.art[2] : "#000000"} emissiveIntensity={0.6} toneMapped={style !== "gaming"} />
        </mesh>
      </group>

      {/* creator / gaming gear: studio monitors, boom-arm mic, webcam + light bar, stream pad, headphones on a stand */}
      {[-1, 1].map((side) => (
        <group key={side} position={[MX + side * 0.8, DESK_H + 0.03, 0.42]} rotation={[0, -side * 0.25, 0]}>
          <RoundedBox args={[0.16, 0.26, 0.18]} radius={0.015} smoothness={2} position={[0, 0.13, 0]} castShadow={shadows}>
            <meshStandardMaterial color="#16181b" />
          </RoundedBox>
          <mesh position={[0, 0.09, 0.091]}>
            <circleGeometry args={[0.055, 18]} />
            <meshStandardMaterial color="#2c3036" />
          </mesh>
          <mesh position={[0, 0.2, 0.091]}>
            <circleGeometry args={[0.022, 12]} />
            <meshStandardMaterial color="#6b7280" />
          </mesh>
        </group>
      ))}
      <group position={[MX - 0.55, DESK_H + 0.03, 0.36]}>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.05, 0.06, 0.05]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
        <mesh position={[0.02, 0.26, 0.12]} rotation={[0.55, 0, -0.15]}>
          <cylinderGeometry args={[0.01, 0.01, 0.5, 6]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
        <mesh position={[0.1, 0.42, 0.34]} rotation={[-0.9, 0, -0.4]}>
          <cylinderGeometry args={[0.01, 0.01, 0.32, 6]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
        <mesh position={[0.16, 0.32, 0.46]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.03, 0.14, 12]} />
          <meshStandardMaterial color="#2b2f34" metalness={0.4} roughness={0.4} />
        </mesh>
      </group>
      <mesh position={[MX, DESK_H + 0.67, 0.44]}>
        <boxGeometry args={[0.12, 0.04, 0.05]} />
        <meshStandardMaterial color="#16181b" />
      </mesh>
      <mesh position={[MX, DESK_H + 0.7, 0.43]}>
        <boxGeometry args={[0.9, 0.018, 0.03]} />
        <meshStandardMaterial ref={bar} color="#e2e8f0" emissive="#f8fafc" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      <group position={[MX + 0.32, DESK_H + 0.035, 0.82]} rotation={[-0.2, 0, 0]}>
        <RoundedBox args={[0.2, 0.03, 0.13]} radius={0.01} smoothness={1}>
          <meshStandardMaterial color="#16181b" />
        </RoundedBox>
        {[0, 1, 2].flatMap((r) => [0, 1, 2, 3, 4].map((c) => (
          <mesh key={`${r}${c}`} position={[-0.07 + c * 0.035, 0.017, -0.035 + r * 0.035]}>
            <boxGeometry args={[0.025, 0.006, 0.025]} />
            <meshBasicMaterial color={["#f97316", "#22d3ee", "#a78bfa", "#4ade80", "#f43f5e"][(r + c) % 5]} toneMapped={false} />
          </mesh>
        )))}
      </group>
      <group position={[MX + 0.98, DESK_H + 0.03, 1.45]}>
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.02, 14]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.09, 0.018, 8, 18, Math.PI]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, 0.22, s * 0.09]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.04, 14]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
        ))}
      </group>
      {/* small home-lab server next to the PC */}
      <group position={[X1 - 0.42, 0, 2.0]}>
        <RoundedBox args={[0.24, 0.34, 0.36]} radius={0.015} smoothness={2} position={[0, 0.17, 0]} castShadow={shadows}>
          <meshStandardMaterial color="#1a1d21" />
        </RoundedBox>
        {[0.1, 0.17, 0.24].map((y) => (
          <mesh key={y} position={[-0.121, y, 0.1]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.05, 0.012]} />
            <meshBasicMaterial color="#34d399" toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* on the desk: leather mat, architect lamp on the wing */}
      <mesh position={[MX - 0.05, DESK_H + 0.033, 1.0]}>
        <boxGeometry args={[0.95, 0.006, 0.42]} />
        <meshStandardMaterial color="#2a1f1a" roughness={0.7} />
      </mesh>
      <group position={[MX + 0.98, DESK_H + 0.03, 2.0]}>
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.08, 0.09, 0.03, 14]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
        <mesh position={[0, 0.22, -0.05]} rotation={[-0.3, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.42, 8]} />
          <meshStandardMaterial color="#1f2328" />
        </mesh>
        <mesh position={[0, 0.4, -0.22]} rotation={[0.9, 0, 0]}>
          <coneGeometry args={[0.07, 0.12, 14, 1, true]} />
          <meshStandardMaterial color="#1f2328" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {style === "gaming" && <GamingExtras rgb={rgb} />}
      {style === "cozy" && <CozyExtras pal={pal} shadows={shadows} reducedMotion={reducedMotion} />}
      {style === "minimal" && <MinimalExtras pal={pal} shadows={shadows} />}
      {style === "studio" && <StudioExtras reducedMotion={reducedMotion} />}
      {style === "heritage" && <HeritageExtras pal={pal} shadows={shadows} />}
    </group>
  );
}

/* ------------------------------------------------------------------ style extras */

/** Gaming: hexagon acoustic panels on the feature wall, a few lit with the RGB colour. */
function HexPanels({ x0, x1, th, rgb }: { x0: number; x1: number; th: Theme; rgb: THREE.Material }) {
  const R = 0.2, cx = (x0 + x1) / 2;
  // a honeycomb cluster either side of the sign
  const cells: [number, number][] = [];
  for (const side of [-1, 1]) {
    const bx = cx + side * 0.95;
    for (const [dx, dy] of [[0, 0], [0.36, 0.21], [0, 0.42], [-0.36, 0.21], [0.36, -0.21], [0, -0.42], [-0.36, -0.21]] as const) cells.push([bx + dx * side, 1.3 + dy]);
  }
  return (
    <group>
      {cells.map(([x, y], i) => (
        <group key={i} position={[x, y, 0.03]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[R, R, 0.04, 6]} />
            <meshStandardMaterial color={i % 3 ? th.slat : th.slatAlt} roughness={0.95} />
          </mesh>
          {i % 4 === 1 && (
            <mesh position={[0, 0, 0.022]} material={rgb}>
              <circleGeometry args={[R * 0.82, 6]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** Gaming: neon tubes along the top of the glass, and a glowing "GG" over the lounge. */
function GamingExtras({ rgb }: { rgb: THREE.Material }) {
  return (
    <group>
      <mesh position={[MX, GH - 0.04, Z1 - 0.04]} material={rgb}>
        <boxGeometry args={[X1 - X0 - 0.1, 0.02, 0.02]} />
      </mesh>
      <mesh position={[X1 - 0.04, GH - 0.04, Z1 / 2]} material={rgb}>
        <boxGeometry args={[0.02, 0.02, Z1 - 0.1]} />
      </mesh>
      <mesh position={[X0 + 0.04, GH - 0.04, Z1 / 2]} material={rgb}>
        <boxGeometry args={[0.02, 0.02, Z1 - 0.1]} />
      </mesh>
      <Suspense fallback={null}>
        <Text font={SCENE_FONT} position={[X1 - 0.08, 1.75, 3.2]} rotation={[0, Math.PI / 2, 0]} fontSize={0.34} color="#f0abfc" anchorX="center" anchorY="middle" letterSpacing={0.1}>
          GG
        </Text>
      </Suspense>
    </group>
  );
}

/** Cozy: a plaster arch behind the sign. */
function Arch({ th }: { th: Theme }) {
  const w = 1.7, h = 1.5, y0 = 0.6;
  return (
    <group position={[MX, 0, 0.012]}>
      <mesh position={[0, y0 + h / 2, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={th.slatAlt} />
      </mesh>
      <mesh position={[0, y0 + h, 0]}>
        <circleGeometry args={[w / 2, 32, 0, Math.PI]} />
        <meshStandardMaterial color={th.slatAlt} />
      </mesh>
    </group>
  );
}

/** Cozy: fairy lights draped across the back wall, a rattan pendant over the lounge, plants everywhere. */
function CozyExtras({ pal, shadows, reducedMotion }: { pal: Palette; shadows: boolean; reducedMotion: boolean }) {
  const bulbs = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fff3d6", emissive: "#ffd48a", emissiveIntensity: 1, toneMapped: false }), []);
  useFrame(({ clock }) => {
    const twinkle = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2.2) * 0.25;
    bulbs.emissiveIntensity = 0.9 + light.lamps * 1.6 + twinkle;
  });
  const x0 = X0 + 1.1, x1 = X1 - 1.35, n = 16;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    // two sagging swags
    const sag = Math.sin(((t * 2) % 1) * Math.PI) * 0.16;
    return [x0 + t * (x1 - x0), ROOM.H - 0.2 - sag] as const;
  });
  return (
    <group>
      {pts.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.06]} material={bulbs}>
          <sphereGeometry args={[0.022, 8, 6]} />
        </mesh>
      ))}
      {/* rattan pendant over the lounge */}
      <group position={[X1 - 1.3, ROOM.H - 0.55, 3.2]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.55, 4]} />
          <meshStandardMaterial color="#6b4a33" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial color="#c8a26b" side={THREE.DoubleSide} roughness={1} emissive="#ffcf9a" emissiveIntensity={0.25} />
        </mesh>
      </group>
      <TallPlant pal={pal} shadows={shadows} position={[X0 + 1.1, 0, 0.35]} scale={0.75} />
      <TallPlant pal={pal} shadows={shadows} position={[X1 - 0.35, 0, Z1 - 0.35]} scale={0.7} />
      <Plant pal={pal} shadows={shadows} position={[MX - 0.95, DESK_H + 0.03, 0.55]} scale={0.32} />
    </group>
  );
}

/** Minimal: one big plant in the corner and a single-line drawing over the credenza. */
function MinimalExtras({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  return (
    <group>
      <TallPlant pal={pal} shadows={shadows} position={[X1 - 0.35, 0, Z1 - 0.4]} scale={0.95} />
      <group position={[X0 + 0.03, 1.5, 2.6]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[0.7, 0.9]} />
          <meshStandardMaterial color="#f8f6f1" />
        </mesh>
        <mesh position={[0, 0.05, 0.003]}>
          <torusGeometry args={[0.16, 0.006, 4, 40, Math.PI * 1.6]} />
          <meshBasicMaterial color="#111827" />
        </mesh>
      </group>
    </group>
  );
}

/** Studio: a grid of pyramid acoustic foam tiles in two tones. */
function FoamWall({ x0, x1, th }: { x0: number; x1: number; th: Theme }) {
  const geo = useMemo(() => {
    const parts: Part[] = [];
    const S = 0.3, cols = Math.floor((x1 - x0 - 0.1) / S), rows = 6;
    const ox = (x0 + x1) / 2 - (cols * S) / 2 + S / 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      // leave a gap around the sign (it hangs at y ≈ 2, 1.35 m wide with its halo)
      const cx = ox + c * S, y = 0.75 + r * S;
      if (Math.abs(cx - MX) < 0.85 && y > 1.55) continue;
      const color = (r + c) % 2 ? th.slat : th.slatAlt;
      parts.push({ size: [S - 0.02, S - 0.02, 0.03], pos: [cx, y, 0.03], color });
      parts.push({ shape: "cyl", size: [S * 0.42, 0.06, 4], pos: [cx, y, 0.075], rot: [Math.PI / 2, Math.PI / 4, 0], color });
    }
    return mergeParts(parts);
  }, [x0, x1, th.slat, th.slatAlt]);
  return geo ? <mesh geometry={geo}><meshStandardMaterial vertexColors roughness={1} /></mesh> : null;
}

/** Studio: a ring light and a camera on tripods facing the desk, a boom mic on the desk, and the ON AIR sign. */
function StudioExtras({ reducedMotion }: { reducedMotion: boolean }) {
  const onAir = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7f1d1d", emissive: "#ef4444", emissiveIntensity: 1.6, toneMapped: false }), []);
  const ring = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fff7ed", emissive: "#fff1dc", emissiveIntensity: 1.4, toneMapped: false }), []);
  useFrame(({ clock }) => {
    // ON AIR while the boss is at the desk in office hours; a slow breathe on the sign
    const min = light.min;
    const live = min >= 540 && min < 1080;
    onAir.emissiveIntensity = live ? 1.5 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2) * 0.25) : 0.08;
    ring.emissiveIntensity = live ? 1.4 : 0.1;
  });
  const tripod = (x: number, z: number, h: number) => (
    <group position={[x, 0, z]}>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.16, h / 2 - 0.05, Math.sin(a) * 0.16]} rotation={[Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18]}>
          <cylinderGeometry args={[0.012, 0.012, h, 5]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
    </group>
  );
  return (
    <group>
      {/* ring light beside the desk, facing the chair */}
      {tripod(MX - 1.05, CHAIR_Z + 0.75, 1.45)}
      <group position={[MX - 1.05, 1.62, CHAIR_Z + 0.75]} rotation={[0, -0.55, 0]}>
        <mesh material={ring}>
          <torusGeometry args={[0.22, 0.025, 8, 32]} />
        </mesh>
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[0.07, 0.13, 0.01]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      </group>
      {/* camera on the other side */}
      {tripod(MX + 1.05, CHAIR_Z + 0.75, 1.35)}
      <group position={[MX + 1.05, 1.42, CHAIR_Z + 0.75]} rotation={[0, 0.6, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 0.11, 0.1]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0, 0, -0.09]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.09, 14]} />
          <meshStandardMaterial color="#0b0b0c" />
        </mesh>
      </group>
      {/* boom arm mic clamped to the desk */}
      <group position={[MX + 0.62, DESK_H, 0.5]}>
        <mesh position={[0, 0.25, 0]} rotation={[0, 0, 0.25]}>
          <cylinderGeometry args={[0.01, 0.01, 0.5, 6]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[-0.16, 0.5, 0.2]} rotation={[0.9, 0, 0.6]}>
          <cylinderGeometry args={[0.01, 0.01, 0.42, 6]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[-0.28, 0.45, 0.42]} rotation={[0.4, 0, 0]}>
          <capsuleGeometry args={[0.03, 0.09, 4, 10]} />
          <meshStandardMaterial color="#27272a" metalness={0.4} roughness={0.4} />
        </mesh>
      </group>
      {/* ON AIR sign on the left glass, readable from the camera */}
      <group position={[X0 + 0.04, 2.05, 1.4]} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={onAir}>
          <boxGeometry args={[0.62, 0.2, 0.04]} />
        </mesh>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0, 0.022]} fontSize={0.1} color="#fff1f2" anchorX="center" anchorY="middle" letterSpacing={0.16}>
            ON AIR
          </Text>
        </Suspense>
      </group>
    </group>
  );
}

/** Heritage: capiz shell window panels (a lattice of pearly squares in narra frames) across the feature wall. */
function CapizWall({ x0, x1, th }: { x0: number; x1: number; th: Theme }) {
  const { frame, shells } = useMemo(() => {
    const f: Part[] = [], sh: Part[] = [];
    const panels = 3, pw = (x1 - x0 - 0.2) / panels, top = 2.35, bottom = 0.75, cell = 0.13;
    for (let p = 0; p < panels; p++) {
      const px0 = x0 + 0.1 + p * pw, cx = px0 + pw / 2;
      if (p === 1) continue; // the middle stays clear for the sign
      f.push({ size: [pw - 0.06, 0.05, 0.04], pos: [cx, top, 0.03], color: th.slatAlt });
      f.push({ size: [pw - 0.06, 0.05, 0.04], pos: [cx, bottom, 0.03], color: th.slatAlt });
      for (const sx of [px0 + 0.05, px0 + pw - 0.05]) f.push({ size: [0.05, top - bottom, 0.04], pos: [sx, (top + bottom) / 2, 0.03], color: th.slatAlt });
      const cols = Math.floor((pw - 0.16) / cell), rows = Math.floor((top - bottom - 0.08) / cell);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        sh.push({ size: [cell - 0.016, cell - 0.016, 0.01], pos: [px0 + 0.08 + cell / 2 + c * cell, bottom + 0.06 + cell / 2 + r * cell, 0.025], color: (r * 7 + c * 3) % 5 ? "#f6efe2" : "#efe4cf" });
      }
    }
    return { frame: mergeParts(f), shells: mergeParts(sh) };
  }, [x0, x1, th.slatAlt]);
  return (
    <group>
      {frame && <mesh geometry={frame}><meshStandardMaterial vertexColors roughness={0.6} /></mesh>}
      {/* the shells glow a little, like light coming through them */}
      {shells && <mesh geometry={shells}><meshStandardMaterial vertexColors roughness={0.3} emissive="#fff1d6" emissiveIntensity={0.25} /></mesh>}
    </group>
  );
}

/** Heritage: a banig (woven mat) under the lounge, a salakot on the wall, a capiz lamp and plants. */
function HeritageExtras({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const banig = useMemo(() => {
    const parts: Part[] = [];
    const cx = X1 - 1.3, cz = 3.0, w = 1.8, d = 1.3, n = 9;
    parts.push({ size: [w, 0.006, d], pos: [cx, 0.006, cz], color: "#e3c58e" });
    const stripes = ["#b91c1c", "#15803d", "#1d4ed8", "#ca8a04"];
    for (let i = 0; i < n; i++) {
      const z = cz - d / 2 + 0.1 + (i * (d - 0.2)) / (n - 1);
      parts.push({ size: [w - 0.1, 0.002, 0.04], pos: [cx, 0.0105, z], color: stripes[i % stripes.length] });
    }
    for (let i = 0; i < 6; i++) parts.push({ size: [0.03, 0.002, d - 0.1], pos: [cx - w / 2 + 0.15 + i * 0.3, 0.011, cz], color: "#a16207" });
    return mergeParts(parts);
  }, []);
  return (
    <group>
      {banig && <mesh geometry={banig} receiveShadow={shadows}><meshStandardMaterial vertexColors roughness={1} /></mesh>}
      {/* salakot (woven hat) on the left glass's frame post */}
      <group position={[X0 + 0.08, 1.9, 2.5]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh>
          <coneGeometry args={[0.24, 0.12, 20, 1, true]} />
          <meshStandardMaterial color="#c49a5a" side={THREE.DoubleSide} roughness={1} />
        </mesh>
      </group>
      {/* capiz pendant over the desk */}
      <group position={[MX, ROOM.H - 0.6, 0.9]}>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.5, 4]} />
          <meshStandardMaterial color="#5b351d" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.16, 0.2, 0.22, 12, 1, true]} />
          <meshStandardMaterial color="#f6efe2" side={THREE.DoubleSide} emissive="#ffe2b0" emissiveIntensity={0.6} />
        </mesh>
      </group>
      <TallPlant pal={pal} shadows={shadows} position={[X1 - 0.35, 0, Z1 - 0.4]} scale={0.85} />
      <Plant pal={pal} shadows={shadows} position={[X0 + 1.1, 0, 0.35]} scale={0.7} />
    </group>
  );
}
