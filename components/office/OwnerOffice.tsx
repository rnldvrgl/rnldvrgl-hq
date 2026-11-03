"use client";

import { Suspense, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import { OFFICE, ROOM, type Palette, SCENE_FONT } from "./palette";
import { OfficeChair, Plant, type Vec3 } from "./Furniture";
import { AirCon, officeAcOn } from "./Amenities";
import { light } from "./Lighting";
import { useGameScreen } from "./GameScreen";
import { OWNER_NAME } from "./Staff";

const { x0: X0, x1: X1, z1: Z1 } = OFFICE;
/** Middle of the office along x: the executive desk, monitors and chair line up on it. */
const MX = (X0 + X1) / 2;
/** Glass partition height (the room walls are ROOM.H). */
const GH = 2.35;
const DOOR_W = 1.0;
const DESK_H = 0.76;
const CHAIR_Z = 1.62;

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
 * a curved ultrawide plus a side monitor, a PC tower with a slow RGB glow, and Ronald at the desk.
 */
export function OwnerOffice({ pal, shadows, reducedMotion }: { pal: Palette; shadows: boolean; reducedMotion: boolean }) {
  const rgb = useRef<THREE.MeshStandardMaterial>(null);
  const ceiling = useRef<THREE.PointLight>(null);
  const game = useGameScreen();

  // RGB accents cycle slowly; held still for reduced motion.
  useFrame(({ clock }) => {
    if (ceiling.current) ceiling.current.intensity = 0.8 + light.lamps * 4.5;
    if (!rgb.current || reducedMotion) return;
    const hue = (clock.elapsedTime * 0.06) % 1;
    rgb.current.color.setHSL(hue, 0.9, 0.55);
    rgb.current.emissive.setHSL(hue, 0.9, 0.55);
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
        <meshStandardMaterial color={pal.officeFloor} />
      </mesh>
      <mesh position={[MX + 0.05, 0.008, 1.55]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows}>
        <planeGeometry args={[2.8, 1.9]} />
        <meshStandardMaterial color="#3a3d42" roughness={1} />
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
            {OWNER_NAME.toUpperCase()}
          </Text>
          <Text font={SCENE_FONT} position={[0, -0.055, 0.008]} fontSize={0.04} color={pal.signAccent} anchorX="center" anchorY="middle" letterSpacing={0.12}>
            MAIN OFFICE
          </Text>
        </Suspense>
      </group>
      {/* L-shaped executive desk: main top along the back wall, return wing on the right */}
      <RoundedBox args={[2.4, 0.06, 0.9]} radius={0.025} smoothness={2} position={[MX, DESK_H, 0.75]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial color={pal.execDesk} />
      </RoundedBox>
      <RoundedBox args={[0.56, 0.06, 1.0]} radius={0.025} smoothness={2} position={[MX + 0.92, DESK_H, 1.7]} castShadow={shadows} receiveShadow={shadows}>
        <meshStandardMaterial color={pal.execDesk} />
      </RoundedBox>
      <mesh position={[MX - 1.17, (DESK_H - 0.03) / 2, 0.75]} castShadow={shadows}>
        <boxGeometry args={[0.05, DESK_H - 0.03, 0.84]} />
        <meshStandardMaterial color={pal.execDeskSide} />
      </mesh>
      <mesh position={[MX, DESK_H - 0.26, 0.34]}>
        <boxGeometry args={[2.3, 0.44, 0.03]} />
        <meshStandardMaterial color={pal.execDeskSide} />
      </mesh>
      <mesh position={[MX + 0.92, 0.32, 1.65]} castShadow={shadows}>
        <boxGeometry args={[0.5, 0.64, 0.86]} />
        <meshStandardMaterial color={pal.execDeskSide} />
      </mesh>
      {/* RGB strip under the front edge */}
      <mesh position={[MX - 0.25, DESK_H - 0.04, 1.205]}>
        <boxGeometry args={[1.85, 0.012, 0.012]} />
        <meshStandardMaterial ref={rgb} color="#5fd0d8" emissive="#5fd0d8" emissiveIntensity={1.2} toneMapped={false} />
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

      <OfficeChair pal={pal} shadows={shadows} position={[MX, 0, CHAIR_Z]} color={pal.execChair} executive />

      <BossDecor pal={pal} shadows={shadows} />
      {/* a warm ceiling light and the office's split AC */}
      <pointLight ref={ceiling} position={[MX, ROOM.H - 0.2, 2.0]} color="#ffe2b8" intensity={1.6} distance={6} decay={1.6} />
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
function BossDecor({ pal, shadows }: { pal: Palette; shadows: boolean }) {
  const cove = useRef<THREE.MeshStandardMaterial>(null);
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const bar = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (bar.current) bar.current.emissiveIntensity = 0.3 + light.lamps * 0.6;
    if (cove.current) cove.current.emissiveIntensity = 0.6 + light.lamps * 1.4;
    if (lamp.current) lamp.current.emissiveIntensity = 0.3 + light.lamps * 1.5;
  });
  const slatX0 = X0 + 1.05, slatX1 = X1 - 1.3;
  const slats = Math.floor((slatX1 - slatX0) / 0.08);
  const BOOKS = ["#1f2937", "#9ca3af", "#b45309", "#e5e7eb", "#374151", "#7c2d12", "#d1d5db"];

  return (
    <group>
      {/* walnut slat wall and cove light */}
      <mesh position={[(slatX0 + slatX1) / 2, ROOM.H / 2, 0.006]}>
        <planeGeometry args={[slatX1 - slatX0, ROOM.H]} />
        <meshStandardMaterial color={WALNUT_DARK} />
      </mesh>
      {Array.from({ length: slats }, (_, i) => (
        <mesh key={i} position={[slatX0 + 0.04 + i * 0.08, ROOM.H / 2, 0.02]}>
          <boxGeometry args={[0.045, ROOM.H - 0.04, 0.025]} />
          <meshStandardMaterial color={i % 3 === 0 ? WALNUT_DARK : WALNUT} />
        </mesh>
      ))}
      <mesh position={[(slatX0 + slatX1) / 2, ROOM.H - 0.06, 0.05]}>
        <boxGeometry args={[slatX1 - slatX0, 0.025, 0.02]} />
        <meshStandardMaterial ref={cove} color="#ffd9a8" emissive="#ffcf8a" emissiveIntensity={1} toneMapped={false} />
      </mesh>
      {/* backlit sign: dark plate with a warm halo behind it */}
      <group position={[MX, 1.98, 0.06]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[1.35, 0.48]} />
          <meshBasicMaterial color="#ffcf8a" transparent opacity={0.35} toneMapped={false} />
        </mesh>
        <RoundedBox args={[1.2, 0.34, 0.03]} radius={0.01} smoothness={2}>
          <meshStandardMaterial color="#111315" />
        </RoundedBox>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0, 0.02]} fontSize={0.16} color="#f5f5f0" anchorX="center" anchorY="middle" letterSpacing={0.14}>
            rnldvrgl
          </Text>
        </Suspense>
      </group>

      {/* tall bookcase in the back-left corner */}
      <group position={[X0 + 0.48, 0, 0.22]}>
        {[0, 1].map((s) => (
          <mesh key={s} position={[s ? 0.36 : -0.36, 0.95, 0]} castShadow={shadows}>
            <boxGeometry args={[0.04, 1.9, 0.36]} />
            <meshStandardMaterial color={WALNUT} />
          </mesh>
        ))}
        {[0.04, 0.5, 0.95, 1.4, 1.88].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[0.76, 0.035, 0.36]} />
            <meshStandardMaterial color={WALNUT} />
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
          <meshStandardMaterial color="#cfccc4" roughness={1} />
        </mesh>
        <group position={[0.55, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <RoundedBox args={[1.45, 0.28, 0.78]} radius={0.06} smoothness={2} position={[0, 0.22, 0]} castShadow={shadows}>
            <meshStandardMaterial color="#2f3338" roughness={0.8} />
          </RoundedBox>
          {[-0.34, 0.34].map((x) => (
            <RoundedBox key={x} args={[0.66, 0.14, 0.62]} radius={0.05} smoothness={2} position={[x, 0.42, -0.04]} castShadow={shadows}>
              <meshStandardMaterial color="#4a4f57" roughness={0.9} />
            </RoundedBox>
          ))}
          <RoundedBox args={[1.45, 0.42, 0.18]} radius={0.06} smoothness={2} position={[0, 0.55, 0.3]} castShadow={shadows}>
            <meshStandardMaterial color="#2f3338" roughness={0.8} />
          </RoundedBox>
          {[-0.68, 0.68].map((x) => (
            <RoundedBox key={x} args={[0.12, 0.42, 0.78]} radius={0.05} smoothness={2} position={[x, 0.38, 0]} castShadow={shadows}>
              <meshStandardMaterial color="#2f3338" roughness={0.8} />
            </RoundedBox>
          ))}
          <RoundedBox args={[0.34, 0.3, 0.1]} radius={0.04} smoothness={2} position={[-0.42, 0.6, 0.18]} rotation={[0.2, 0, 0.1]}>
            <meshStandardMaterial color="#c2410c" />
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
            <meshStandardMaterial ref={lamp} color="#f4f1ea" emissive="#ffd59a" emissiveIntensity={0.4} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* low credenza along the front glass, with a vase and books */}
      <group position={[X0 + 2.15, 0, Z1 - 0.28]}>
        <RoundedBox args={[1.4, 0.5, 0.4]} radius={0.02} smoothness={2} position={[0, 0.27, 0]} castShadow={shadows}>
          <meshStandardMaterial color={WALNUT} />
        </RoundedBox>
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} position={[x, 0.27, 0.201]}>
            <planeGeometry args={[0.66, 0.42]} />
            <meshStandardMaterial color={WALNUT_DARK} />
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
          <meshStandardMaterial color="#f3f0e8" />
        </mesh>
        <mesh position={[-0.1, 0.03, 0.019]}>
          <circleGeometry args={[0.13, 24]} />
          <meshStandardMaterial color="#d97757" />
        </mesh>
        <mesh position={[0.12, -0.08, 0.02]}>
          <planeGeometry args={[0.3, 0.12]} />
          <meshStandardMaterial color="#1f2937" />
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
    </group>
  );
}
