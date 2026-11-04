"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useOffice } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { manilaParts } from "@/lib/time";
import { ROOM } from "./palette";
import { BACK_STREETS, SIDE_STREETS } from "./world";
import { EST } from "./Neighbourhood";
import { getGlowTexture } from "./Lighting";
import { streetLightLevel } from "./StreetLamp";
import { joinGeometries, mergeParts, mergePlaced, placed, type Part } from "./batch";
import { useSceneNow } from "./scene-clock-ui";

/**
 * Pasko and Bagong Taon in the town.
 *   - Christmas season, the "ber months" (Sept 16 – Jan 6, Manila date): parols (star lanterns) at every house
 *     gate and shop front and a big one in the office's front glass, strands of coloured bulbs along the fences
 *     and shop awnings, and a small tree in the lounge corner.
 *   - New Year's Eve: fireworks over the town from 11:30 PM to 12:30 AM, with a big burst at midnight.
 * Everything static is merged: parols (1 draw call), their halos (1), three bulb colours (3), the tree (1),
 * fireworks (1). Nothing is mounted out of season. Preview with ?holiday=xmas or ?holiday=newyear.
 */

type Override = "xmas" | "newyear" | null;
let override: Override | undefined;
function holidayOverride(): Override {
  if (override !== undefined) return override;
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("holiday");
  override = v === "xmas" || v === "newyear" ? v : null;
  return override;
}

/** Sept 16 – Jan 6 (Manila). */
export function isChristmasSeason(d: Date): boolean {
  const { month, day } = manilaParts(d);
  return (month === 8 && day >= 16) || month === 9 || month === 10 || month === 11 || (month === 0 && day <= 6);
}

/** Minutes from Manila midnight of Jan 1 (negative on Dec 31), or null outside the fireworks window. */
function newYearMinutes(d: Date): number | null {
  const { month, day, hour, minute } = manilaParts(d);
  if (month === 11 && day === 31 && hour === 23 && minute >= 30) return minute - 60;
  if (month === 0 && day === 1 && hour === 0 && minute < 30) return minute;
  return null;
}

/* ------------------------------------------------------------------ geometry */

/** A plain geometry, placed and painted one colour, ready to join with mergeParts output. */
function tinted(geo: THREE.BufferGeometry, color: string, m: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute("uv");
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  g.applyMatrix4(m);
  const c = new THREE.Color(color).convertSRGBToLinear();
  const n = g.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

const at = (x: number, y: number, z: number, rotY = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(s, s, s));

function starShape(R: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  return s;
}

const PAROL_FILL = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#facc15"];

/** One parol facing +z at (x, y, z): a glowing star, its bamboo-frame outline, a ring, and two paper tails. */
function parol(x: number, y: number, z: number, R: number, i: number, rotY = 0): THREE.BufferGeometry[] {
  const fill = PAROL_FILL[i % PAROL_FILL.length], frame = "#fff7d6";
  const out: THREE.BufferGeometry[] = [];
  const m = at(x, y, z, rotY);
  out.push(tinted(new THREE.ShapeGeometry(starShape(R, R * 0.45)), fill, m));
  out.push(tinted(new THREE.ShapeGeometry(starShape(R * 0.45, R * 0.2)), frame, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.005))));
  const p: Part[] = [];
  // outline: ten edges of the star
  for (let k = 0; k < 10; k++) {
    const a0 = Math.PI / 2 + (k * Math.PI) / 5, a1 = Math.PI / 2 + ((k + 1) * Math.PI) / 5;
    const r0 = k % 2 ? R * 0.45 : R, r1 = k % 2 ? R : R * 0.45;
    const x0 = Math.cos(a0) * r0, y0 = Math.sin(a0) * r0, x1 = Math.cos(a1) * r1, y1 = Math.sin(a1) * r1;
    p.push({ size: [Math.hypot(x1 - x0, y1 - y0), R * 0.06, R * 0.06], pos: [(x0 + x1) / 2, (y0 + y1) / 2, 0.01], rot: [0, 0, Math.atan2(y1 - y0, x1 - x0)], color: frame });
  }
  // the tails, hanging from the two lower points
  for (const s of [-1, 1]) {
    const a = Math.PI / 2 + (s < 0 ? 3 : 2) * ((2 * Math.PI) / 5);
    const tx = Math.cos(a) * R, ty = Math.sin(a) * R;
    p.push({ size: [R * 0.08, R * 1.1, R * 0.02], pos: [tx * 0.9, ty - R * 0.5, 0], rot: [0, 0, s * 0.12], color: fill });
    p.push({ size: [R * 0.08, R * 0.9, R * 0.02], pos: [tx * 0.6, ty - R * 0.4, 0.004], rot: [0, 0, -s * 0.1], color: frame });
  }
  const g = mergeParts(p);
  if (g) { g.applyMatrix4(m); out.push(g); }
  return out;
}

/* ------------------------------------------------------------------ layout */

/** Same seeded random as Neighbourhood's houses, so the parols line up with the gates. */
function rnd(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 2147483647;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

type Spot = { x: number; y: number; z: number; R: number };
type Strand = { x0: number; x1: number; y: number; z: number; sag: number };

/** The houses' gates (mirrors houses() in Neighbourhood.tsx: x, width and gate line). */
function houseSpots(): { parols: Spot[]; strands: Strand[] } {
  const parols: Spot[] = [], strands: Strand[] = [];
  let i = 0;
  BACK_STREETS.forEach((b, row) => {
    const gateZ = b.z0 - 0.45;
    for (let x = -46 + row * 3.4; x < 66; x += 7.6) {
      if (SIDE_STREETS.some((st) => x + 7 > st.x0 - 0.3 && x - 0.5 < st.x1 + 0.3)) continue;
      const w = 5.4 + Math.round(rnd(i + 3)() * 2) * 0.4;
      const gx0 = x + 0.2, gx1 = gx0 + 2.6;
      parols.push({ x: (gx0 + gx1) / 2, y: 2.0, z: gateZ + 0.12, R: 0.26 });
      strands.push({ x0: x - 0.3, x1: x + w + 0.3, y: 1.27, z: gateZ + 0.1, sag: 0.08 });
      i++;
    }
  });
  return { parols, strands };
}

function shopSpots(): { parols: Spot[]; strands: Strand[] } {
  const parols: Spot[] = [], strands: Strand[] = [];
  for (const e of EST) {
    const z = ROOM.D + 0.2;
    parols.push({ x: e.x0 + 0.7, y: 2.05, z, R: 0.28 }, { x: e.x1 - 0.7, y: 2.05, z, R: 0.28 });
    strands.push({ x0: e.x0 + 0.1, x1: e.x1 - 0.1, y: 2.62, z: ROOM.D + 0.16, sag: 0.12 });
  }
  return { parols, strands };
}

/** The lounge-corner tree, clear of the armchair, the floor lamp and the big bin. */
const TREE = { x: ROOM.W - 0.45, z: 9.2 } as const;
/** The office's own parol, in the front glass over the stand-up circle. */
const OFFICE_PAROL: Spot = { x: 7.4, y: 1.95, z: ROOM.D - 0.08, R: 0.5 };

const BULB_COLORS = ["#ff3b3b", "#22e06b", "#ffd23f"] as const;

/* ------------------------------------------------------------------ the season */

function Season() {
  const bulbMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const parolMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const minimal = useSettings((s) => s.motion === "minimal");
  const glow = useMemo(() => getGlowTexture(), []);

  const built = useMemo(() => {
    const h = houseSpots(), s = shopSpots();
    const parols = [...h.parols, ...s.parols, OFFICE_PAROL];
    const strands = [...h.strands, ...s.strands];

    const parolGeo = joinGeometries(parols.flatMap((p, i) => parol(p.x, p.y, p.z, p.R, i)));
    const plane = new THREE.PlaneGeometry(1, 1);
    const halos = mergePlaced(parols.map((p) => ({ geometry: plane, matrix: placed([p.x, p.y, p.z - 0.02], [0, 0, 0], [p.R * 5, p.R * 5, 1]) })));
    plane.dispose();

    // bulbs: every 0.22 m along each strand, the colours taking turns
    const bulbs: Part[][] = BULB_COLORS.map(() => []);
    let n = 0;
    for (const st of strands) {
      const len = st.x1 - st.x0, count = Math.max(2, Math.round(len / 0.22));
      for (let k = 0; k <= count; k++) {
        const t = k / count, sw = (t * len) % 1.1 / 1.1;
        const y = st.y - Math.sin(sw * Math.PI) * st.sag;
        bulbs[n++ % 3].push({ size: [0.05, 0.07, 0.05], pos: [st.x0 + t * len, y, st.z], color: "#ffffff" });
      }
    }

    // the tree: three stacked cones, a pot, a star on top, ornaments and lights wound round it
    const treeParts: THREE.BufferGeometry[] = [
      tinted(new THREE.CylinderGeometry(0.2, 0.16, 0.26, 12), "#9a3412", at(TREE.x, 0.13, TREE.z)),
      tinted(new THREE.ConeGeometry(0.42, 0.6, 10), "#166534", at(TREE.x, 0.55, TREE.z)),
      tinted(new THREE.ConeGeometry(0.34, 0.5, 10), "#15803d", at(TREE.x, 0.88, TREE.z, 0.3)),
      tinted(new THREE.ConeGeometry(0.24, 0.42, 10), "#16a34a", at(TREE.x, 1.16, TREE.z, 0.6)),
      tinted(new THREE.ShapeGeometry(starShape(0.1, 0.045)), "#facc15", at(TREE.x, 1.44, TREE.z, Math.PI / 4)),
    ];
    const gifts: Part[] = [
      { size: [0.24, 0.18, 0.22], pos: [TREE.x - 0.3, 0.09, TREE.z + 0.3], rotY: 0.4, color: "#dc2626" },
      { size: [0.2, 0.24, 0.2], pos: [TREE.x + 0.05, 0.12, TREE.z + 0.42], rotY: -0.2, color: "#2563eb" },
      { size: [0.26, 0.04, 0.05], pos: [TREE.x - 0.3, 0.19, TREE.z + 0.3], rotY: 0.4, color: "#facc15" },
    ];
    for (let k = 0; k < 12; k++) {
      const a = k * 2.4, yy = 0.38 + (k / 12) * 0.85, r = 0.4 - (k / 12) * 0.28;
      gifts.push({ shape: "cyl", size: [0.035, 0.05, 8], pos: [TREE.x + Math.cos(a) * r, yy, TREE.z + Math.sin(a) * r], color: ["#dc2626", "#f8fafc", "#f59e0b"][k % 3] });
    }
    for (let k = 0; k < 24; k++) {
      const a = k * 0.9, yy = 0.32 + (k / 24) * 0.95, r = 0.42 - (k / 24) * 0.3;
      bulbs[k % 3].push({ size: [0.03, 0.03, 0.03], pos: [TREE.x + Math.cos(a) * r, yy, TREE.z + Math.sin(a) * r], color: "#ffffff" });
    }
    const tree = joinGeometries([...treeParts, mergeParts(gifts)]);

    return { parolGeo, halos, bulbGeos: bulbs.map((b) => mergeParts(b)), tree };
  }, []);

  useFrame(({ clock }) => {
    const k = streetLightLevel();
    const t = minimal ? 0 : clock.elapsedTime;
    bulbMats.current.forEach((m, i) => {
      if (!m) return;
      // each colour fades in and out in turn, a slow chase
      const tw = minimal ? 1 : 0.55 + 0.45 * Math.max(0, Math.sin(t * 1.6 + (i * Math.PI * 2) / 3));
      m.color.set(BULB_COLORS[i]).multiplyScalar((0.45 + 0.75 * k) * tw);
    });
    if (parolMat.current) parolMat.current.color.setScalar(0.7 + 0.5 * k);
    if (haloMat.current) haloMat.current.opacity = 0.05 + k * 0.4;
  });

  return (
    <group>
      {built.parolGeo && (
        <mesh geometry={built.parolGeo}>
          <meshBasicMaterial ref={parolMat} vertexColors side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
      {built.halos && (
        <mesh geometry={built.halos}>
          <meshBasicMaterial ref={haloMat} map={glow} color="#ffd98a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {built.bulbGeos.map((g, i) => g && (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial ref={(m) => { bulbMats.current[i] = m; }} color={BULB_COLORS[i]} toneMapped={false} />
        </mesh>
      ))}
      {built.tree && (
        <mesh geometry={built.tree} castShadow>
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ fireworks */

const FW_COLORS = ["#ff4d4d", "#ffd23f", "#4dd2ff", "#7dff6a", "#ff6ad5", "#ffffff"];
const RISE = 0.9, LIFE = 2.4;

function Fireworks({ lowPower, peak, preview }: { lowPower: boolean; peak: () => boolean; preview: boolean }) {
  const shells = lowPower ? 6 : 12, per = lowPower ? 22 : 40;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => Array.from({ length: shells }, (_, i) => ({
    period: 3.2 + ((i * 1.37) % 2.6),
    offset: (i * 0.83) % 3.2,
    dirs: Array.from({ length: per }, () => new THREE.Vector3().randomDirection()),
    seed: i,
  })), [shells, per]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const faded = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const im = mesh.current;
    if (!im) return;
    const active = preview || peak() ? shells : Math.ceil(shells * 0.45);
    let n = 0;
    for (let s = 0; s < active; s++) {
      const d = data[s];
      const cycle = (clock.elapsedTime + d.offset) / d.period;
      const round = Math.floor(cycle), t = (cycle - round) * d.period;
      // each round launches from a new spot over the town
      const r = rnd(d.seed * 97 + round);
      const cx = -30 + r() * 80, cz = -16 + r() * 34, top = 16 + r() * 10, speed = 3.5 + r() * 2.5;
      col.set(FW_COLORS[Math.floor(r() * FW_COLORS.length)]);
      if (t < RISE) {
        // the rocket: one bright dot climbing
        v.set(cx, (t / RISE) * top, cz); sc.setScalar(0.18);
        m.compose(v, q, sc); im.setMatrixAt(n, m); im.setColorAt(n, col); n++;
        continue;
      }
      const e = t - RISE;
      if (e > LIFE) continue;
      const fade = 1 - e / LIFE;
      for (const dir of d.dirs) {
        v.set(cx + dir.x * speed * e, top + dir.y * speed * e - 0.9 * e * e, cz + dir.z * speed * e);
        sc.setScalar(0.22 * (0.4 + fade));
        m.compose(v, q, sc); im.setMatrixAt(n, m);
        im.setColorAt(n, faded.copy(col).multiplyScalar(fade)); n++;
      }
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, shells * per]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ mount */

export function Holidays() {
  const now = useSceneNow(30_000);
  const lowPower = useOffice((s) => s.lowPower);
  const minimal = useSettings((s) => s.motion === "minimal");
  const forced = holidayOverride();
  const season = forced !== null || isChristmasSeason(now);
  const ny = newYearMinutes(now);
  const fireworks = !minimal && (forced === "newyear" || ny !== null);
  // the big burst: the last two minutes of the year and the first five of the new one
  const peakRef = useRef(false);
  peakRef.current = ny !== null && ny >= -2 && ny < 5;

  if (!season && !fireworks) return null;
  return (
    <group>
      {season && <Season />}
      {fireworks && <Fireworks lowPower={lowPower} peak={() => peakRef.current} preview={forced === "newyear"} />}
    </group>
  );
}
