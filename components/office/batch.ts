import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Static scenery merged into as few meshes as possible. Every box / roof / cylinder of the neighbourhood is
 * baked into one geometry with per-vertex colours, so a whole street of buildings costs one draw call per
 * material instead of one per part. Built once (useMemo) and never touched again.
 */

export type Shape = "box" | "gable" | "cyl";
export type Part = {
  shape?: Shape;
  /** Box: [w, h, d]. Gable roof: [w along x, ridge height, d] (ridge runs along x). Cylinder: [radius, h, segments]. */
  size: readonly [number, number, number];
  /** Centre of a box / cylinder; for a gable roof, the centre of its base. */
  pos: readonly [number, number, number];
  rotY?: number;
  /** Full rotation [x, y, z] (overrides rotY). */
  rot?: readonly [number, number, number];
  color: string;
};

const tmpColor = new THREE.Color();
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);

function gable(w: number, h: number, d: number): THREE.BufferGeometry {
  // triangle in the z/y plane, extruded along x
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  // shape x → world z, extrude z → world x
  g.rotateY(Math.PI / 2);
  g.translate(-w / 2, 0, 0);
  return g;
}

function partGeometry(p: Part): THREE.BufferGeometry {
  const [a, b, c] = p.size;
  let g: THREE.BufferGeometry;
  if (p.shape === "gable") g = gable(a, b, c);
  else if (p.shape === "cyl") g = new THREE.CylinderGeometry(a, a, b, Math.max(3, Math.round(c)));
  else g = new THREE.BoxGeometry(a, b, c);
  const flat = g.index ? g.toNonIndexed() : g;
  if (flat !== g) g.dispose();
  flat.deleteAttribute("uv");
  if (p.rot) q.setFromEuler(new THREE.Euler(p.rot[0], p.rot[1], p.rot[2]));
  else q.setFromAxisAngle(up, p.rotY ?? 0);
  m4.compose(new THREE.Vector3(...p.pos), q, new THREE.Vector3(1, 1, 1));
  flat.applyMatrix4(m4);
  tmpColor.set(p.color).convertSRGBToLinear();
  const n = flat.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = tmpColor.r; colors[i * 3 + 1] = tmpColor.g; colors[i * 3 + 2] = tmpColor.b; }
  flat.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return flat;
}

/** Merge parts into one vertex-coloured geometry (null when there are none). */
export function mergeParts(parts: readonly Part[]): THREE.BufferGeometry | null {
  if (!parts.length) return null;
  const geoms = parts.map(partGeometry);
  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  if (merged) merged.computeBoundingSphere();
  return merged;
}

/** Merge ready-made geometries that keep their uv (signs, glow planes), each placed by its matrix. */
export function mergePlaced(items: readonly { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[]): THREE.BufferGeometry | null {
  if (!items.length) return null;
  const geoms = items.map(({ geometry, matrix }) => {
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
    return g;
  });
  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  if (merged) merged.computeBoundingSphere();
  return merged;
}

/** Position + rotation (+ optional scale) as a matrix. */
export function placed(pos: readonly [number, number, number], rot: readonly [number, number, number] = [0, 0, 0], scale: readonly [number, number, number] = [1, 1, 1]): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
}

/** A canvas drawn once, as an sRGB texture. */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Merged parts, moved as one piece (a parked tricycle turned to face the street). Same attributes as mergeParts. */
export function partsAt(parts: readonly Part[], pos: readonly [number, number, number], rotY = 0): THREE.BufferGeometry | null {
  const g = mergeParts(parts);
  g?.applyMatrix4(placed(pos, [0, rotY, 0]));
  return g;
}

/** Join geometries built by mergeParts / partsAt into one (they share position, normal and color). */
export function joinGeometries(list: readonly (THREE.BufferGeometry | null)[]): THREE.BufferGeometry | null {
  const ok = list.filter((g): g is THREE.BufferGeometry => !!g);
  if (!ok.length) return null;
  const merged = mergeGeometries(ok, false);
  ok.forEach((g) => g.dispose());
  if (merged) merged.computeBoundingSphere();
  return merged;
}
