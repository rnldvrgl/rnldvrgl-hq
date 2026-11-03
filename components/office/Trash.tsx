"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { sceneNow } from "@/lib/store";
import { hm, manilaMinutes, TRASH_AT, TRASH_DROP_AT } from "@/lib/office-clock";
import { TEAM, type EmployeeId } from "@/lib/team";
import { MAIN_BIN, type Palette } from "./palette";
import { BINS, OWNER_BIN, actWindows, dropTimes, trashRoute } from "./routes";

type Common = { pal: Palette; shadows: boolean };

function SmallBin({ pal, shadows, position, paperRef }: Common & { position: [number, number, number]; paperRef?: (g: THREE.Group | null) => void }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.17, 0]} castShadow={shadows}>
        <cylinderGeometry args={[0.13, 0.11, 0.34, 16, 1, true]} />
        <meshStandardMaterial color={pal.bin} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.02, 16]} />
        <meshStandardMaterial color={pal.bin} />
      </mesh>
      <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.13, 0.012, 6, 20]} />
        <meshStandardMaterial color={pal.binLid} />
      </mesh>
      <group ref={paperRef} position={[0, 0.3, 0]}>
        {[[0.03, 0, 0.02], [-0.04, 0.03, -0.02], [0.01, 0.07, 0.03]].map(([x, y, z], k) => (
          <mesh key={k} position={[x, y, z]} visible={paperRef === undefined && k === 0}>
            <icosahedronGeometry args={[0.06, 0]} />
            <meshStandardMaterial color={pal.paper} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * The bins. Desk bins fill with crumpled paper through the day. At 5:30 PM everyone empties theirs
 * into the main bin by the entrance (bags pile up in it); at 5:40 PM the collector takes that one bag out.
 */
export function TrashBins({ pal, shadows, assignee }: Common & { assignee: EmployeeId | null }) {
  const papers = useRef<(THREE.Group | null)[]>([]);
  const bags = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const drops = useMemo(() => TEAM.map((m) => dropTimes(m.id)), []);
  /** When the collector lifts the bag out of the main bin (seconds after 5:40 PM). */
  const collected = useMemo(() => (assignee ? (actWindows(trashRoute(assignee), "pickup")[0]?.[0] ?? 0) + 1.3 : null), [assignee]);

  useFrame((_, dt) => {
    const min = manilaMinutes(sceneNow());
    const sinceDrop = (min - TRASH_DROP_AT) * 60;
    BINS.forEach((_, i) => {
      const g = papers.current[i];
      if (!g) return;
      const emptied = sinceDrop >= drops[i].emptied;
      // from 8 AM, one more ball of paper every couple of hours, up to three
      const fill = emptied ? 0 : Math.max(0, Math.min(3, Math.floor((min - hm("08:00")) / 140) + 1 + (i % 2)));
      g.children.forEach((c, k) => { c.visible = k < fill; });
    });
    // main bin: one bag per drop, gone once the collector has lifted them out
    const taken = collected !== null && (min - TRASH_AT) * 60 >= collected;
    let count = 0;
    if (!taken) for (const d of drops) if (sinceDrop >= d.dropped) count++;
    if (bags.current) bags.current.children.forEach((c, k) => { c.visible = k < count; });
    if (lid.current) {
      // the flip lid opens while someone is at the bin
      const busy = drops.some((d) => sinceDrop >= d.dropped - 1.6 && sinceDrop <= d.dropped + 0.6)
        || (collected !== null && Math.abs((min - TRASH_AT) * 60 - collected + 0.6) < 1.4);
      const target = busy ? -1.3 : 0;
      lid.current.rotation.x += (target - lid.current.rotation.x) * Math.min(1, dt * 7);
    }
  });

  return (
    <group>
      {BINS.map((bin, i) => (
        <SmallBin key={bin.id} pal={pal} shadows={shadows} position={[bin.x, 0, bin.z]} paperRef={(g) => { papers.current[i] = g; }} />
      ))}
      <SmallBin pal={pal} shadows={shadows} position={[OWNER_BIN.x, 0, OWNER_BIN.z]} />

      {/* the main bin by the entrance */}
      <group position={[MAIN_BIN.x, 0, MAIN_BIN.z]}>
        <RoundedBox args={[0.55, 0.85, 0.55]} radius={0.04} smoothness={2} position={[0, 0.425, 0]} castShadow={shadows}>
          <meshStandardMaterial color="#2f6d4f" />
        </RoundedBox>
        <mesh position={[0, 0.5, 0.278]}>
          <planeGeometry args={[0.3, 0.22]} />
          <meshBasicMaterial color="#e8f5ee" />
        </mesh>
        <mesh position={[0, 0.5, 0.279]} rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.08, 0.08]} />
          <meshBasicMaterial color="#2f6d4f" />
        </mesh>
        <group ref={bags} position={[0, 0.78, 0]}>
          {TEAM.map((_, k) => (
            <mesh key={k} position={[((k % 3) - 1) * 0.14, Math.floor(k / 3) * 0.08, ((k * 7) % 3 - 1) * 0.1]} visible={false} scale={[1, 0.8, 1]}>
              <sphereGeometry args={[0.09, 10, 8]} />
              <meshStandardMaterial color={pal.bag} roughness={0.4} />
            </mesh>
          ))}
        </group>
        {/* lid hinged at the back */}
        <group ref={lid} position={[0, 0.86, -0.28]}>
          <mesh position={[0, 0.02, 0.28]} castShadow={shadows}>
            <boxGeometry args={[0.6, 0.04, 0.58]} />
            <meshStandardMaterial color="#245a40" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
