"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { mergeParts, type Part } from "./batch";
import { FAR_WALK, SIDEWALK } from "./world";
import { JUNCTIONS, mainLamp, signalClock, walkLamp, type Junction, type Lamp } from "./signals";

/**
 * The traffic lights at the two junctions (timing in signals.ts). Each junction has:
 *   - a light for the near lane, on the near corner, facing the cars coming from the west
 *   - one for the far lane, on the far sidewalk, facing the cars coming from the east
 *   - one for the side street, at its mouth, facing up the side street
 *   - a walk signal on both ends of the zebra (green walking light / red standing light)
 * Poles and housings are one merged mesh; every lamp is one instance of a single InstancedMesh whose
 * colours are rewritten when a light changes. Two draw calls for all of it.
 */

type Head = { x: number; z: number; y: number; face: "-x" | "+x" | "-z" | "+z"; walk?: boolean; junction: Junction; of: "main" | "walk" };

const LAMP_ON: Record<Lamp, string> = { red: "#ff3b30", amber: "#ffb800", green: "#2ee86f" };
const LAMP_OFF: Record<Lamp, string> = { red: "#3b1512", amber: "#3a2c0c", green: "#123220" };
const ORDER: readonly Lamp[] = ["red", "amber", "green"];

function heads(): Head[] {
  const list: Head[] = [];
  for (const j of JUNCTIONS) {
    const nearCurb = SIDEWALK.z0 + 0.3, farCurb = FAR_WALK.z0 + 0.3;
    list.push({ x: j.stopNear - 0.4, z: nearCurb, y: 2.7, face: "-x", junction: j, of: "main" });
    list.push({ x: j.stopFar + 0.4, z: farCurb, y: 2.7, face: "+x", junction: j, of: "main" });
    list.push({ x: j.x1 + 0.35, z: SIDEWALK.z0 - 0.4, y: 2.7, face: "-z", junction: j, of: "walk" }); // the side street goes with the walk phase
    // walk signals, facing across the zebra
    list.push({ x: j.crossX - j.crossW / 2 - 0.2, z: nearCurb, y: 2.0, face: "+z", walk: true, junction: j, of: "walk" });
    list.push({ x: j.crossX + j.crossW / 2 + 0.2, z: farCurb, y: 2.0, face: "-z", walk: true, junction: j, of: "walk" });
  }
  return list;
}

/** Unit offset toward where a head faces. */
const FACE: Record<Head["face"], [number, number]> = { "-x": [-1, 0], "+x": [1, 0], "-z": [0, -1], "+z": [0, 1] };

export function TrafficLights() {
  const lamps = useRef<THREE.InstancedMesh>(null);
  const list = useMemo(heads, []);
  /** Each lamp instance: which head, which colour it shows when on. */
  const slots = useMemo(() => list.flatMap((h, hi) => (h.walk ? (["red", "green"] as Lamp[]) : ORDER).map((c, k) => ({ h, hi, c, k }))), [list]);

  const poles = useMemo(() => {
    const p: Part[] = [];
    const steel = "#3b4148", box = "#1f2328";
    // one pole per corner (heads on the same corner share it)
    const seen = new Set<string>();
    for (const h of list) {
      const key = `${h.x.toFixed(1)},${h.z.toFixed(1)}`;
      if (!seen.has(key)) {
        seen.add(key);
        p.push({ shape: "cyl", size: [0.06, 3.1, 8], pos: [h.x, 1.55, h.z], color: steel });
      }
      const [fx, fz] = FACE[h.face];
      const along = h.face.endsWith("x");
      const n = h.walk ? 2 : 3;
      const hgt = n * 0.2 + 0.08;
      p.push({ size: along ? [0.14, hgt, 0.26] : [0.26, hgt, 0.14], pos: [h.x + fx * 0.1, h.y, h.z + fz * 0.1], color: box });
      // little visors over each lamp
      for (let k = 0; k < n; k++) {
        const y = h.y + hgt / 2 - 0.14 - k * 0.2;
        p.push({ size: along ? [0.12, 0.02, 0.22] : [0.22, 0.02, 0.12], pos: [h.x + fx * 0.22, y + 0.1, h.z + fz * 0.22], color: box });
      }
    }
    return mergeParts(p);
  }, [list]);

  // lamp positions are fixed: set the matrices once
  useLayoutEffect(() => {
    const im = lamps.current;
    if (!im) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    slots.forEach(({ h, k }, i) => {
      const [fx, fz] = FACE[h.face];
      const n = h.walk ? 2 : 3;
      const hgt = n * 0.2 + 0.08;
      const y = h.y + hgt / 2 - 0.14 - k * 0.2;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.face.endsWith("x") ? Math.PI / 2 : 0);
      im.setMatrixAt(i, m.compose(v.set(h.x + fx * 0.175, y, h.z + fz * 0.175), q, s));
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }, [slots]);

  const color = useMemo(() => new THREE.Color(), []);
  const last = useRef("");
  useFrame(() => {
    const im = lamps.current;
    if (!im) return;
    const t = signalClock();
    const states = JUNCTIONS.map((j) => [mainLamp(j, t), walkLamp(j, t)] as const);
    // the walk signal's last seconds flash
    const flash = Math.floor(t * 2) % 2 === 0;
    const key = states.map((s) => s.join()).join("|") + flash;
    if (key === last.current) return;
    last.current = key;
    slots.forEach(({ h, c }, i) => {
      const ji = JUNCTIONS.indexOf(h.junction);
      const lamp = h.of === "main" ? states[ji][0] : states[ji][1];
      let on: boolean;
      if (h.walk) on = c === "green" ? lamp === "green" || (lamp === "amber" && flash) : lamp === "red";
      else on = c === lamp;
      color.set(on ? LAMP_ON[c] : LAMP_OFF[c]);
      if (on) color.multiplyScalar(1.6);
      im.setColorAt(i, color);
    });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {poles && (
        <mesh geometry={poles}>
          <meshStandardMaterial vertexColors roughness={0.6} metalness={0.3} />
        </mesh>
      )}
      <instancedMesh ref={lamps} args={[undefined, undefined, slots.length]} frustumCulled={false}>
        <boxGeometry args={[0.15, 0.15, 0.04]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
