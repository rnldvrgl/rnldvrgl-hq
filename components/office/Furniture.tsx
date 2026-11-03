"use client";

import { RoundedBox } from "@react-three/drei";
import type { Palette } from "./palette";

export type Vec3 = readonly [number, number, number];

/** Leaves as [x, y, z, radius], relative to the top of the pot. */
const LEAVES: readonly (readonly [number, number, number, number])[] = [
  [0, 0.22, 0, 0.26], [0.14, 0.42, 0.05, 0.2], [-0.12, 0.38, -0.04, 0.2], [0.02, 0.58, -0.02, 0.17],
];

/** Low-poly potted plant. `scale` 1 is the floor plant; ~0.3 fits on a desk. */
export function Plant({ pal, shadows, position, scale = 1 }: { pal: Palette; shadows: boolean; position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.2, 0]} castShadow={shadows}>
        <cylinderGeometry args={[0.2, 0.16, 0.4, 16]} />
        <meshStandardMaterial color={pal.pot} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.39, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
        <meshStandardMaterial color="#5a4632" />
      </mesh>
      {LEAVES.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, 0.4 + y, z]} castShadow={shadows}>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color={i % 2 ? pal.leafA : pal.leafB} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Big leaves of a fiddle-leaf fig as [x, y, z, size, tilt]. */
const FIG: readonly (readonly [number, number, number, number, number])[] = [
  [0.16, 1.0, 0.04, 0.2, 0.5], [-0.14, 1.12, 0.06, 0.22, -0.6], [0.05, 1.3, -0.12, 0.2, 0.2], [-0.08, 1.45, 0.1, 0.19, -0.3],
  [0.15, 1.55, -0.02, 0.18, 0.7], [-0.02, 1.68, 0.0, 0.17, 0.0], [0.2, 1.25, 0.12, 0.17, 0.9], [-0.18, 1.35, -0.1, 0.18, -0.9],
];

/** Tall floor plant in a ceramic planter (a fiddle-leaf fig), about 1.8 m. */
export function TallPlant({ pal, shadows, position, scale = 1 }: { pal: Palette; shadows: boolean; position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow={shadows}>
        <cylinderGeometry args={[0.24, 0.2, 0.5, 18]} />
        <meshStandardMaterial color={pal.potDark} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.8, 6]} />
        <meshStandardMaterial color={pal.woodDark} />
      </mesh>
      {FIG.map(([x, y, z, r, tilt], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[tilt * 0.4, i * 1.3, tilt]} scale={[1, 1.35, 0.35]} castShadow={shadows}>
          <sphereGeometry args={[r, 7, 5]} />
          <meshStandardMaterial color={i % 3 === 0 ? pal.leafC : i % 2 ? pal.leafA : pal.leafB} flatShading />
        </mesh>
      ))}
    </group>
  );
}

type ChairProps = {
  pal: Palette;
  shadows: boolean;
  position: Vec3;
  /** Seat and back colour. */
  color: string;
  /** Executive chair: wider, taller back. */
  executive?: boolean;
};

/**
 * Office chair facing -z (toward the desk), so its back is toward the camera.
 * Seat, tilted back, armrests, gas lift and a five-star base on casters.
 */
export function OfficeChair({ pal, shadows, position, color, executive = false }: ChairProps) {
  const seatW = executive ? 0.6 : 0.5;
  const backH = executive ? 0.74 : 0.52;
  const seatY = executive ? 0.5 : 0.48;
  return (
    <group position={position}>
      <RoundedBox args={[seatW, 0.09, executive ? 0.56 : 0.48]} radius={0.035} smoothness={2} position={[0, seatY, 0]} castShadow={shadows}>
        <meshStandardMaterial color={color} />
      </RoundedBox>
      {/* back, tilted slightly away from the desk */}
      <RoundedBox args={[seatW - 0.02, backH, 0.07]} radius={0.03} smoothness={2}
        position={[0, seatY + 0.12 + backH / 2, 0.27]} rotation={[0.1, 0, 0]} castShadow={shadows}>
        <meshStandardMaterial color={color} />
      </RoundedBox>
      <mesh position={[0, seatY + 0.1, 0.26]}>
        <boxGeometry args={[0.05, 0.22, 0.03]} />
        <meshStandardMaterial color={pal.chairLeg} />
      </mesh>
      {/* armrests */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (seatW / 2 + 0.03), seatY, 0.04]}>
          <mesh position={[0, 0.09, 0]}>
            <boxGeometry args={[0.03, 0.18, 0.03]} />
            <meshStandardMaterial color={pal.chairLeg} />
          </mesh>
          <mesh position={[0, 0.19, -0.02]}>
            <boxGeometry args={[0.06, 0.025, 0.26]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      ))}
      {/* gas lift */}
      <mesh position={[0, seatY / 2 + 0.04, 0]}>
        <cylinderGeometry args={[0.025, 0.03, seatY - 0.04, 8]} />
        <meshStandardMaterial color={pal.chairLeg} />
      </mesh>
      {/* five-star base with casters */}
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation={[0, (i / 5) * Math.PI * 2, 0]}>
          <mesh position={[0, 0.07, 0.14]}>
            <boxGeometry args={[0.03, 0.03, 0.28]} />
            <meshStandardMaterial color={pal.chairLeg} />
          </mesh>
          <mesh position={[0, 0.03, 0.27]}>
            <sphereGeometry args={[0.028, 8, 6]} />
            <meshStandardMaterial color={pal.bezel} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
