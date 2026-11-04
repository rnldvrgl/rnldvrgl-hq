"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneNow } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { Person, REST, applyPose, type Look, type Pose, type PersonRig } from "./Person";
import { PAL } from "./palette";
import { canvasTexture } from "./batch";
import { BACK_STREETS, FAR_WALK, SIDEWALK, YARD_X1 } from "./world";

/**
 * Pandesal vendors on the sidewalks, out from 5 AM until 7 PM:
 *   - one stands with his bicycle and its wooden bread box outside the panaderia
 *   - one walks up and down the far sidewalk with a box of pandesal, calling out
 *   - one waits by his kariton (push cart, with a big umbrella) on the residential street
 * Three people and a few props; with minimal motion they stand still.
 */

const STRIDE = 4.8;
const OUT = { from: 5 * 60, to: 19 * 60 } as const;
/** Person faces -z at rotY 0; these face the camera (+z) and walk along ±x. */
const FACE_CAMERA = Math.PI, WALK_PLUS_X = -Math.PI / 2, WALK_MINUS_X = Math.PI / 2;

function usePandesalTexture(): THREE.CanvasTexture {
  return useMemo(() => canvasTexture(256, 96, (g) => {
    g.fillStyle = "#7c4a2d"; g.fillRect(0, 0, 256, 96);
    g.fillStyle = "#fde68a"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "800 46px ui-sans-serif, system-ui, Arial, sans-serif";
    g.fillText("PANDESAL", 128, 42, 236);
    g.font = "600 18px ui-sans-serif, system-ui, Arial, sans-serif";
    g.fillText("mainit pa! · ₱3", 128, 78, 236);
  }), []);
}

const LOOKS: Look[] = [
  { shirt: "#f8fafc", pants: "#334155", skin: PAL.skin[2], hair: "#1f1a17", hairStyle: "cap", cap: "#b91c1c", shoes: "#1c2228" },
  { shirt: "#f59e0b", pants: "#1f3a52", skin: PAL.skin[3] ?? PAL.skin[2], hair: "#1f1a17", hairStyle: "short", shoes: "#3f3f46" },
  { shirt: "#16a34a", pants: "#3f3f46", skin: PAL.skin[1] ?? PAL.skin[2], hair: "#1f1a17", hairStyle: "cap", cap: "#f8fafc", shoes: "#1c2228" },
];

function BreadBox({ tex, w = 0.62, h = 0.4, d = 0.42 }: { tex: THREE.Texture; w?: number; h?: number; d?: number }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#a16207" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.004]}>
        <planeGeometry args={[w * 0.96, h * 0.8]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, -d / 2 - 0.004]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w * 0.96, h * 0.8]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Bicycle({ tex }: { tex: THREE.Texture }) {
  // along local x: two wheels, a frame, handlebars, and the bread box over the back wheel
  return (
    <group>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.33, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.31, 0.03, 6, 18]} />
          <meshStandardMaterial color="#111417" />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[1.1, 0.04, 0.04]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      <mesh position={[0.5, 0.75, 0]}>
        <boxGeometry args={[0.04, 0.5, 0.04]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.5, 1.0, 0]}>
        <boxGeometry args={[0.04, 0.04, 0.5]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <group position={[-0.5, 0.92, 0]}>
        <BreadBox tex={tex} w={0.55} h={0.38} d={0.5} />
      </group>
    </group>
  );
}

function Kariton({ tex }: { tex: THREE.Texture }) {
  // the push cart: a box on two wheels, handles, and a big striped umbrella
  return (
    <group>
      <group position={[0, 0.75, 0]}><BreadBox tex={tex} w={1.1} h={0.6} d={0.7} /></group>
      {[-0.4, 0.4].map((z) => (
        <mesh key={z} position={[0, 0.25, z]}>
          <torusGeometry args={[0.24, 0.04, 6, 16]} />
          <meshStandardMaterial color="#111417" />
        </mesh>
      ))}
      <mesh position={[0.75, 0.95, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.55]} />
        <meshStandardMaterial color="#6b4a33" />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
        <meshStandardMaterial color="#d6d3cc" />
      </mesh>
      <mesh position={[0, 2.22, 0]}>
        <coneGeometry args={[0.95, 0.35, 8, 1, true]} />
        <meshStandardMaterial color="#dc2626" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

type VendorProps = { look: Look; shadows: boolean; frozen: boolean; carry?: boolean; tex: THREE.Texture; walk?: { x0: number; x1: number; z: number; speed: number } };

function Vendor({ look, shadows, frozen, carry, tex, walk }: VendorProps) {
  const g = useRef<THREE.Group>(null);
  const rig = useRef<PersonRig | null>(null);
  const pose = useRef<Pose>({ ...REST });

  useFrame(({ clock }) => {
    const r = rig.current, grp = g.current;
    if (!r || !grp) return;
    const p = pose.current;
    Object.assign(p, REST);
    p.time = frozen ? 0 : clock.elapsedTime;
    p.carry = carry ? 1 : 0;
    if (walk) {
      const len = walk.x1 - walk.x0;
      const dist = frozen ? len / 2 : clock.elapsedTime * walk.speed;
      // there and back: a triangle wave along the sidewalk
      const ph = (dist % (len * 2)) / len;
      const forward = ph < 1;
      grp.position.x = walk.x0 + (forward ? ph : 2 - ph) * len;
      grp.position.z = walk.z;
      grp.rotation.y = frozen ? FACE_CAMERA : forward ? WALK_PLUS_X : WALK_MINUS_X;
      p.walk = frozen ? 0 : 0.55;
      p.stride = frozen ? 0 : dist * STRIDE;
    }
    applyPose(r, p);
  });

  return (
    <group ref={g}>
      <Person
        look={look}
        shadows={shadows}
        rig={rig}
        rightHand={carry ? <group position={[0, -0.12, 0.05]}><BreadBox tex={tex} w={0.45} h={0.28} d={0.32} /></group> : undefined}
      />
    </group>
  );
}

export function Vendors({ shadows, frozen }: { shadows: boolean; frozen: boolean }) {
  const root = useRef<THREE.Group>(null);
  const tex = usePandesalTexture();

  useFrame(() => {
    const min = manilaMinutes(sceneNow());
    if (root.current) root.current.visible = min >= OUT.from && min < OUT.to;
  });

  const nearZ = SIDEWALK.z1 - 0.45;
  const bikeX = YARD_X1 + 4.6;
  const cartX = 9.0, cartZ = BACK_STREETS[0].z1 + 0.9;

  return (
    <group ref={root}>
      {/* the bicycle vendor outside the panaderia */}
      <group position={[bikeX, 0, nearZ]} rotation={[0, FACE_CAMERA, 0]}>
        <Vendor look={LOOKS[0]} shadows={shadows} frozen={frozen} tex={tex} />
      </group>
      <group position={[bikeX + 0.95, 0, nearZ - 0.05]}>
        <Bicycle tex={tex} />
      </group>

      {/* the walking vendor on the far sidewalk */}
      <Vendor look={LOOKS[1]} shadows={shadows} frozen={frozen} carry tex={tex} walk={{ x0: -4, x1: 22, z: (FAR_WALK.z0 + FAR_WALK.z1) / 2, speed: 0.75 }} />

      {/* the kariton on the residential street */}
      <group position={[cartX, 0, cartZ]} rotation={[0, FACE_CAMERA, 0]}>
        <Vendor look={LOOKS[2]} shadows={shadows} frozen={frozen} tex={tex} />
      </group>
      <group position={[cartX + 1.1, 0, cartZ - 0.1]}>
        <Kariton tex={tex} />
      </group>
    </group>
  );
}
