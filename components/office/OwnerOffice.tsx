"use client";

import { Suspense, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox, Text } from "@react-three/drei";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Crown } from "lucide-react";
import { OFFICE, ROOM, type Palette, SCENE_FONT } from "./palette";
import { OfficeChair, Plant, type Vec3 } from "./Furniture";

gsap.registerPlugin(useGSAP);

const OWNER_NAME = "Ronald";

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

/** Ronald, seated with his back to the camera, typing now and then. */
function Owner({ pal, shadows, reducedMotion }: { pal: Palette; shadows: boolean; reducedMotion: boolean }) {
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Mesh>(null);

  useGSAP(() => {
    if (reducedMotion || !armL.current || !armR.current || !head.current) return;
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });
    for (let i = 0; i < 4; i++) {
      tl.to(armL.current.rotation, { x: 1.22, duration: 0.12, yoyo: true, repeat: 1, ease: "sine.inOut" })
        .to(armR.current.rotation, { x: 1.22, duration: 0.12, yoyo: true, repeat: 1, ease: "sine.inOut" }, "<0.12");
    }
    gsap.to(head.current.position, { y: 1.43, duration: 0.6, yoyo: true, repeat: -1, repeatDelay: 1.4, ease: "sine.inOut" });
  }, { dependencies: [reducedMotion], revertOnUpdate: true });

  const shirt = pal.ownerShirt;
  return (
    <group position={[MX, 0, CHAIR_Z]}>
      <mesh position={[0, 0.92, -0.03]} castShadow={shadows}>
        <capsuleGeometry args={[0.21, 0.3, 6, 16]} />
        <meshStandardMaterial color={shirt} />
      </mesh>
      <mesh ref={head} position={[0, 1.4, -0.05]} castShadow={shadows}>
        <sphereGeometry args={[0.175, 24, 16]} />
        <meshStandardMaterial color={pal.hair} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.175, 1.38, -0.03]}>
          <sphereGeometry args={[0.04, 12, 8]} />
          <meshStandardMaterial color={pal.skin} />
        </mesh>
      ))}
      <group ref={armL} position={[-0.23, 1.06, -0.07]} rotation={[1.05, 0, 0.12]}>
        <mesh position={[0, -0.19, 0]}>
          <capsuleGeometry args={[0.058, 0.32, 4, 10]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
      </group>
      <group ref={armR} position={[0.23, 1.06, -0.07]} rotation={[1.05, 0, -0.12]}>
        <mesh position={[0, -0.19, 0]}>
          <capsuleGeometry args={[0.058, 0.32, 4, 10]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The owner's glass corner office in the back-right of the room: L-shaped executive desk,
 * a curved ultrawide plus a side monitor, a PC tower with a slow RGB glow, and Ronald at the desk.
 */
export function OwnerOffice({ pal, shadows, reducedMotion }: { pal: Palette; shadows: boolean; reducedMotion: boolean }) {
  const rgb = useRef<THREE.MeshStandardMaterial>(null);

  // RGB accents cycle slowly; held still for reduced motion.
  useFrame(({ clock }) => {
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
      <mesh position={[MX, 0.009, CHAIR_Z + 0.1]} receiveShadow={shadows}>
        <cylinderGeometry args={[1.05, 1.05, 0.006, 32]} />
        <meshStandardMaterial color={pal.rug} />
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
      <group position={[X0 + DOOR_W, 0, Z1]} rotation={[0, -1.1, 0]}>
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
      <group position={[MX, 2.0, 0.02]}>
        <mesh>
          <boxGeometry args={[1.5, 0.34, 0.03]} />
          <meshStandardMaterial color={pal.sign} />
        </mesh>
        <Suspense fallback={null}>
          <Text font={SCENE_FONT} position={[0, 0, 0.02]} fontSize={0.15} color={pal.signAccent} anchorX="center" anchorY="middle" letterSpacing={0.06}>
            rnldvrgl HQ
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
        <meshStandardMaterial color={pal.ultrawide} emissive={pal.ultrawide} emissiveIntensity={0.75} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <pointLight position={[MX, UW_Y, UW_Z + 0.5]} color={pal.ultrawide} intensity={1.2} distance={2.4} />

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
      <mesh position={[MX - 0.75, DESK_H + 0.09, 0.95]} castShadow={shadows}>
        <cylinderGeometry args={[0.05, 0.045, 0.11, 12]} />
        <meshStandardMaterial color={pal.ownerShirt} />
      </mesh>
      <Plant pal={pal} shadows={shadows} position={[MX - 1.0, DESK_H + 0.03, 0.55]} scale={0.32} />

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
      <Owner pal={pal} shadows={shadows} reducedMotion={reducedMotion} />

      {/* corner floor plant, and a warm ceiling light */}
      <Plant pal={pal} shadows={shadows} position={[X0 + 0.45, 0, Z1 - 0.5]} scale={0.85} />
      <pointLight position={[MX, ROOM.H - 0.2, 2.0]} color={pal.officeLight} intensity={1.6} distance={4.5} />

      {/* floating name tag: not interactive, Ronald isn't one of the employees */}
      <Html position={[MX, 2.25, CHAIR_Z - 0.05]} center zIndexRange={[19, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="flex items-center gap-2 whitespace-nowrap rounded-full border border-primary bg-primary py-1 pl-1 pr-3 text-sm font-semibold text-primary-foreground shadow-md select-none"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="grid size-6 place-items-center rounded-full bg-primary-foreground/20">
            <Crown className="size-3.5" aria-hidden />
          </span>
          {OWNER_NAME}
          <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-medium uppercase tracking-wider">Main office</span>
        </div>
      </Html>
    </group>
  );
}
