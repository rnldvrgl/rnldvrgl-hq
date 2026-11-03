"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { SEAT_Y } from "./palette";

/**
 * A stylised low-poly person (about 1.9 m with the big head), facing -z, feet at y = 0.
 * Joints are groups, so a pose is just a handful of rotations: see `applyPose`.
 * Nothing re-renders while they move; the parent's useFrame writes straight into the rig.
 */

export type HairStyle = "short" | "bun" | "long" | "cap" | "neat" | "korean";

export type Look = {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shoes: string;
  /**
   * "street": Japanese street style. An oversized hoodie (hood, kangaroo pocket, drawstrings, long sleeves),
   * wide-leg pants and chunky sneakers with a thick sole.
   */
  outfit?: "street";
  /** Drawstrings / small details on the street outfit. */
  accent?: string;
  /** Cap colour, for hairStyle "cap". */
  cap?: string;
};

export type PersonRig = {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  legL: THREE.Group; kneeL: THREE.Group;
  legR: THREE.Group; kneeR: THREE.Group;
  armL: THREE.Group; elbowL: THREE.Group;
  armR: THREE.Group; elbowR: THREE.Group;
};

export type Pose = {
  /** 0 standing … 1 seated on a chair. */
  sit: number;
  /** 0 still … 1 full walk; `stride` is the walk cycle angle. */
  walk: number;
  stride: number;
  /** 0–1: hands on the keyboard, and how hard they're typing. */
  typing: number;
  /** 0–1: boss stance, hands clasped behind the back. */
  armsBehind: number;
  /** 0–1: right arm down holding something (a trash bag). */
  carry: number;
  /** 0–1: both hands forward on a mop handle. */
  mop: number;
  /** 0–1: right hand up at the chest (holding a mug). */
  mug: number;
  /** 0–1: little nod (approving). */
  nod: number;
  /** Seconds, for idle motion. */
  time: number;
  /** 0–1: a hop of joy (a job just finished). */
  hop: number;
  /** 0–1: right hand up, waving (needs you). */
  wave: number;
  /** 0–1: bending down to pick something up. */
  bend: number;
  /** 0–1 through a two-handed throw (into the dumpster). */
  toss: number;
};

export const REST: Pose = {
  sit: 0, walk: 0, stride: 0, typing: 0, armsBehind: 0, carry: 0, mop: 0, mug: 0, nod: 0, time: 0, hop: 0, wave: 0, bend: 0, toss: 0,
};

const HIP_Y = 0.88;
const LEG = 0.44; // thigh and shin
const SHOULDER_Y = 0.56; // above the hips
const SHOULDER_X = 0.27;

const mix = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Writes a pose into the rig. Cheap: about twenty number assignments. */
export function applyPose(rig: PersonRig, p: Pose): void {
  const s = p.sit, w = p.walk;
  const swing = Math.sin(p.stride) * w;
  const lift = Math.abs(Math.sin(p.stride)) * w;

  // hips: lowered onto the seat when sitting, a small bob while walking, a hop on top
  rig.hips.position.y = mix(HIP_Y + lift * 0.035, SEAT_Y + 0.06, s) + Math.sin(p.hop * Math.PI) * 0.22;
  rig.hips.position.z = mix(0, 0.05, s);

  // legs: thighs forward when seated, swinging when walking
  rig.legL.rotation.x = mix(swing * 0.55, Math.PI / 2, s);
  rig.legR.rotation.x = mix(-swing * 0.55, Math.PI / 2, s);
  rig.kneeL.rotation.x = mix(-Math.max(0, -Math.sin(p.stride)) * 0.75 * w, -Math.PI / 2, s);
  rig.kneeR.rotation.x = mix(-Math.max(0, Math.sin(p.stride)) * 0.75 * w, -Math.PI / 2, s);

  // torso: leans a touch forward when typing, sways with the mop, puffs up (boss) with arms behind
  const breathe = Math.sin(p.time * 1.6) * 0.012;
  // (+x tips the top backward, since people face -z: forward leans are negative)
  rig.torso.rotation.x = -0.12 * p.typing + 0.06 * p.armsBehind + breathe - 0.6 * p.bend + Math.sin(p.toss * Math.PI) * 0.25;
  rig.torso.rotation.y = Math.sin(p.time * 2.4) * 0.28 * p.mop + swing * 0.08;

  // arms: walking swing → typing → hands behind back → carry → mop → mug, blended in that order
  const tap = p.typing > 0 ? Math.sin(p.time * 22) * 0.09 * p.typing : 0;
  let aLx = -swing * 0.5, aRx = swing * 0.5, eL = 0.25, eR = 0.25, aLz = 0.06, aRz = -0.06;
  aLx = mix(aLx, 0.62 + tap, p.typing); aRx = mix(aRx, 0.62 - tap, p.typing);
  eL = mix(eL, 0.75, p.typing); eR = mix(eR, 0.75, p.typing);
  aLx = mix(aLx, -0.42, p.armsBehind); aRx = mix(aRx, -0.42, p.armsBehind);
  aLz = mix(aLz, 0.12, p.armsBehind); aRz = mix(aRz, -0.12, p.armsBehind);
  eL = mix(eL, 0.95, p.armsBehind); eR = mix(eR, 0.95, p.armsBehind);
  aRx = mix(aRx, 0.05, p.carry); aRz = mix(aRz, -0.22, p.carry); eR = mix(eR, 0.1, p.carry);
  aLx = mix(aLx, 0.75, p.mop); aRx = mix(aRx, 0.95, p.mop); eL = mix(eL, 0.65, p.mop); eR = mix(eR, 0.4, p.mop);
  aRx = mix(aRx, 0.55, p.mug); aRz = mix(aRz, -0.05, p.mug); eR = mix(eR, 1.7, p.mug);
  aLx = mix(aLx, 0.9, p.bend); aRx = mix(aRx, 0.9, p.bend); eL = mix(eL, 0.2, p.bend); eR = mix(eR, 0.2, p.bend);
  // toss: both arms swing from low to high
  const throwA = -0.4 + p.toss * 3.0;
  aLx = mix(aLx, throwA, Math.sin(p.toss * Math.PI)); aRx = mix(aRx, throwA, Math.sin(p.toss * Math.PI));
  // wave: right arm up beside the head, forearm waggling
  aRx = mix(aRx, 2.75, p.wave); aRz = mix(aRz, -0.35, p.wave);
  eR = mix(eR, 0.35 + Math.sin(p.time * 9) * 0.35, p.wave);
  rig.armL.rotation.set(aLx, 0, aLz);
  rig.armR.rotation.set(aRx, 0, aRz);
  // behind the back the forearms fold inward; elsewhere they bend forward
  rig.elbowL.rotation.set(eL * (1 - p.armsBehind), 0, 1.35 * p.armsBehind);
  rig.elbowR.rotation.set(eR * (1 - p.armsBehind), 0, -1.35 * p.armsBehind);

  // head: looks down at the keyboard a little, nods, idles
  rig.head.rotation.x = -0.1 * p.typing + Math.sin(p.time * 7) * 0.13 * p.nod + Math.sin(p.time * 0.7) * 0.03;
  rig.head.rotation.y = Math.sin(p.time * 0.45) * 0.12 * (1 - p.typing) * (1 - w);
}

type Props = {
  look: Look;
  shadows: boolean;
  rig: RefObject<PersonRig | null>;
  /** Rendered in the right hand (y down the forearm, at the palm). */
  rightHand?: ReactNode;
  leftHand?: ReactNode;
  /** Rendered in the torso's frame (a mop, a lanyard…). */
  front?: ReactNode;
};

export function Person({ look, shadows, rig, rightHand, leftHand, front }: Props) {
  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null), kneeL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null), kneeR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null), elbowL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null), elbowR = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    if (!root.current || !hips.current || !torso.current || !head.current || !legL.current || !kneeL.current ||
      !legR.current || !kneeR.current || !armL.current || !elbowL.current || !armR.current || !elbowR.current) return;
    rig.current = {
      root: root.current, hips: hips.current, torso: torso.current, head: head.current,
      legL: legL.current, kneeL: kneeL.current, legR: legR.current, kneeR: kneeR.current,
      armL: armL.current, elbowL: elbowL.current, armR: armR.current, elbowR: elbowR.current,
    };
    applyPose(rig.current, REST);
    return () => { rig.current = null; };
  }, [rig]);

  const street = look.outfit === "street";
  const leg = (side: -1 | 1, hip: RefObject<THREE.Group | null>, knee: RefObject<THREE.Group | null>) => (
    <group ref={hip} position={[side * 0.11, 0, 0]}>
      <mesh position={[0, -LEG / 2 + 0.02, 0]} castShadow={shadows}>
        <capsuleGeometry args={[street ? 0.108 : 0.088, LEG - 0.12, 4, 10]} />
        <meshStandardMaterial color={look.pants} />
      </mesh>
      <group ref={knee} position={[0, -LEG, 0]}>
        <mesh position={[0, -LEG / 2 + 0.03, 0]} castShadow={shadows}>
          {/* wide-leg pants flare a little toward the ankle */}
          <cylinderGeometry args={street ? [0.1, 0.12, LEG - 0.04, 12] : [0.078, 0.078, LEG - 0.04, 10]} />
          <meshStandardMaterial color={look.pants} />
        </mesh>
        {street ? (
          <group position={[0, -LEG + 0.05, -0.05]}>
            <RoundedBox args={[0.15, 0.09, 0.28]} radius={0.03} smoothness={2} castShadow={shadows}>
              <meshStandardMaterial color={look.shoes} />
            </RoundedBox>
            <mesh position={[0, -0.05, -0.005]}>
              <boxGeometry args={[0.16, 0.035, 0.3]} />
              <meshStandardMaterial color="#d6d3cd" />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, -LEG + 0.04, -0.045]} castShadow={shadows}>
            <boxGeometry args={[0.13, 0.08, 0.25]} />
            <meshStandardMaterial color={look.shoes} />
          </mesh>
        )}
      </group>
    </group>
  );

  const arm = (side: -1 | 1, shoulder: RefObject<THREE.Group | null>, elbow: RefObject<THREE.Group | null>, held?: ReactNode) => (
    <group ref={shoulder} position={[side * SHOULDER_X, SHOULDER_Y, 0]}>
      <mesh position={[0, -0.14, 0]} castShadow={shadows}>
        <capsuleGeometry args={[street ? 0.088 : 0.07, 0.17, 4, 10]} />
        <meshStandardMaterial color={look.shirt} />
      </mesh>
      <group ref={elbow} position={[0, -0.29, 0]}>
        <mesh position={[0, -0.12, 0]} castShadow={shadows}>
          <capsuleGeometry args={[street ? 0.078 : 0.058, 0.16, 4, 10]} />
          <meshStandardMaterial color={street ? look.shirt : look.skin} />
        </mesh>
        <mesh position={[0, -0.27, 0]}>
          <sphereGeometry args={[0.066, 10, 8]} />
          <meshStandardMaterial color={look.skin} />
        </mesh>
        {held && <group position={[0, -0.3, 0]}>{held}</group>}
      </group>
    </group>
  );

  return (
    <group ref={root}>
      <group ref={hips} position={[0, HIP_Y, 0]}>
        {/* pelvis */}
        <mesh position={[0, 0.02, 0]} castShadow={shadows}>
          <capsuleGeometry args={[0.17, 0.12, 4, 12]} />
          <meshStandardMaterial color={look.pants} />
        </mesh>
        {leg(-1, legL, kneeL)}
        {leg(1, legR, kneeR)}

        <group ref={torso}>
          {/* chest, slightly flattened front to back */}
          <mesh position={[0, street ? 0.3 : 0.32, 0]} scale={street ? [1.2, 1.06, 0.92] : [1.08, 1, 0.8]} castShadow={shadows}>
            <capsuleGeometry args={[0.21, 0.3, 6, 16]} />
            <meshStandardMaterial color={look.shirt} roughness={street ? 0.95 : 1} />
          </mesh>
          {street && (
            <>
              {/* hood bunched behind the neck */}
              <mesh position={[0, 0.6, 0.11]} rotation={[0.35, 0, 0]} scale={[1.2, 0.8, 1]} castShadow={shadows}>
                <sphereGeometry args={[0.13, 14, 10]} />
                <meshStandardMaterial color={look.shirt} roughness={0.95} />
              </mesh>
              {/* kangaroo pocket and drawstrings on the front (-z) */}
              <mesh position={[0, 0.16, -0.19]}>
                <boxGeometry args={[0.26, 0.11, 0.02]} />
                <meshStandardMaterial color={look.shirt} roughness={1} />
              </mesh>
              {[-0.045, 0.045].map((x) => (
                <mesh key={x} position={[x, 0.46, -0.18]}>
                  <cylinderGeometry args={[0.007, 0.007, 0.14, 6]} />
                  <meshStandardMaterial color={look.accent ?? "#f5f5f0"} />
                </mesh>
              ))}
              {/* ribbed hem */}
              <mesh position={[0, 0.04, 0]} scale={[1.2, 1, 0.92]}>
                <cylinderGeometry args={[0.215, 0.215, 0.05, 16]} />
                <meshStandardMaterial color={look.shirt} roughness={1} />
              </mesh>
            </>
          )}
          {/* collar */}
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.1, 0.13, 0.06, 12]} />
            <meshStandardMaterial color={look.shirt} />
          </mesh>
          <mesh position={[0, 0.66, 0]}>
            <cylinderGeometry args={[0.065, 0.07, 0.1, 10]} />
            <meshStandardMaterial color={look.skin} />
          </mesh>
          {arm(-1, armL, elbowL, leftHand)}
          {arm(1, armR, elbowR, rightHand)}
          {front}

          <group ref={head} position={[0, 0.72, 0]}>
            <mesh position={[0, 0.17, 0]} castShadow={shadows}>
              <sphereGeometry args={[0.2, 20, 14]} />
              <meshStandardMaterial color={look.skin} />
            </mesh>
            {/* ears */}
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.198, 0.16, 0.01]} scale={[0.5, 1, 0.8]}>
                <sphereGeometry args={[0.045, 8, 6]} />
                <meshStandardMaterial color={look.skin} />
              </mesh>
            ))}
            {/* eyes, for when they walk toward you */}
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.068, 0.19, -0.185]}>
                <sphereGeometry args={[0.022, 8, 6]} />
                <meshBasicMaterial color="#1b1f24" />
              </mesh>
            ))}
            <Hair look={look} shadows={shadows} />
          </group>
        </group>
      </group>
    </group>
  );
}

function Hair({ look, shadows }: { look: Look; shadows: boolean }) {
  if (look.hairStyle === "cap") {
    return (
      <group position={[0, 0.17, 0]}>
        <mesh position={[0, 0.04, 0.01]} rotation={[0.2, 0, 0]} castShadow={shadows}>
          <sphereGeometry args={[0.212, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={look.cap ?? look.hair} />
        </mesh>
        <mesh position={[0, 0.05, -0.2]} rotation={[-0.15, 0, 0]}>
          <boxGeometry args={[0.3, 0.02, 0.16]} />
          <meshStandardMaterial color={look.cap ?? look.hair} />
        </mesh>
      </group>
    );
  }
  if (look.hairStyle === "korean") {
    // medium length: full crown, curtain bangs parted in the middle, sides over the ears, a soft nape
    return (
      <group position={[0, 0.17, 0]}>
        <mesh rotation={[0.3, 0, 0]} scale={[1.04, 1.02, 1.05]} castShadow={shadows}>
          <sphereGeometry args={[0.222, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshStandardMaterial color={look.hair} roughness={0.7} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.075, 0.1, -0.17]} rotation={[0.5, side * 0.35, side * 0.35]} scale={[1.25, 0.55, 0.6]} castShadow={shadows}>
            <sphereGeometry args={[0.09, 12, 8]} />
            <meshStandardMaterial color={look.hair} roughness={0.7} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={`s${side}`} position={[side * 0.2, 0.03, 0.02]} rotation={[0, 0, side * 0.12]} scale={[0.45, 1, 1]} castShadow={shadows}>
            <capsuleGeometry args={[0.07, 0.1, 4, 8]} />
            <meshStandardMaterial color={look.hair} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, -0.03, 0.15]} scale={[1.5, 1, 0.75]} castShadow={shadows}>
          <capsuleGeometry args={[0.1, 0.06, 4, 10]} />
          <meshStandardMaterial color={look.hair} roughness={0.7} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[0, 0.17, 0]}>
      {/* cap of hair tilted back, leaving the face clear */}
      <mesh rotation={[look.hairStyle === "neat" ? 0.62 : 0.5, 0, 0]} castShadow={shadows}>
        <sphereGeometry args={[0.216, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial color={look.hair} />
      </mesh>
      {look.hairStyle === "neat" && (
        // side part / quiff
        <mesh position={[0.05, 0.17, -0.1]} rotation={[0.4, 0, -0.3]} scale={[1.3, 0.5, 1]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color={look.hair} />
        </mesh>
      )}
      {look.hairStyle === "bun" && (
        <mesh position={[0, 0.17, 0.14]}>
          <sphereGeometry args={[0.09, 12, 10]} />
          <meshStandardMaterial color={look.hair} />
        </mesh>
      )}
      {look.hairStyle === "long" && (
        <mesh position={[0, -0.12, 0.12]} castShadow={shadows}>
          <boxGeometry args={[0.36, 0.34, 0.1]} />
          <meshStandardMaterial color={look.hair} />
        </mesh>
      )}
    </group>
  );
}
