"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getGlowTexture, light } from "./Lighting";

/** 0 (day) … 1 (full night), with a gentle switch-on at dusk and on dark overcast days. */
export function streetLightLevel(): number {
  const level = Math.max(light.lamps, light.night, light.cloud > 0.8 ? 0.55 : 0);
  return Math.min(1, Math.max(0, (level - 0.25) / 0.5));
}

/**
 * A street lamp: pole, arm, an LED head that glows with a soft halo, a cone of light down to the ground
 * and a bright pool where it lands. It switches on as it gets dark. The arm points along local +z.
 * No real light source (each one costs on phones); the glow is emissive and additive.
 */
export function StreetLamp({ position, rotY = 0, ground = 0 }: { position: [number, number, number]; rotY?: number; ground?: number }) {
  const head = useRef<THREE.MeshStandardMaterial>(null);
  const halo = useRef<THREE.SpriteMaterial>(null);
  const cone = useRef<THREE.MeshBasicMaterial>(null);
  const pool = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useMemo(() => getGlowTexture(), []);
  const H = 2.8, ARM = 0.55;

  useFrame(() => {
    const k = streetLightLevel();
    if (head.current) head.current.emissiveIntensity = 0.1 + k * 3.2;
    if (halo.current) halo.current.opacity = k * 0.75;
    if (cone.current) cone.current.opacity = k * 0.1;
    if (pool.current) pool.current.opacity = k * 0.7;
  });

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, H / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.06, H, 8]} />
        <meshStandardMaterial color="#2b3238" />
      </mesh>
      <mesh position={[0, H - 0.02, ARM / 2]}>
        <boxGeometry args={[0.06, 0.05, ARM]} />
        <meshStandardMaterial color="#2b3238" />
      </mesh>
      <mesh position={[0, H - 0.05, ARM]}>
        <boxGeometry args={[0.18, 0.05, 0.3]} />
        <meshStandardMaterial color="#2b3238" />
      </mesh>
      <mesh position={[0, H - 0.08, ARM]}>
        <boxGeometry args={[0.14, 0.015, 0.24]} />
        <meshStandardMaterial ref={head} color="#fff6e0" emissive="#ffd9a0" emissiveIntensity={0.1} toneMapped={false} />
      </mesh>
      <sprite position={[0, H - 0.12, ARM]} scale={[0.9, 0.9, 1]}>
        <spriteMaterial ref={halo} map={glow} color="#ffd9a0" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* cone of light: tip at the head, wide at the ground */}
      <mesh position={[0, (H - 0.1 + ground) / 2, ARM]}>
        <coneGeometry args={[1.2, H - 0.1 - ground, 24, 1, true]} />
        <meshBasicMaterial ref={cone} color="#ffe2b0" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, ground + 0.012, ARM]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 3.4]} />
        <meshBasicMaterial ref={pool} map={glow} color="#ffcf8a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}
