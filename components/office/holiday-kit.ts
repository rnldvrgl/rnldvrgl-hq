import * as THREE from "three";
import { PAL } from "./palette";
import { FAR_WALK, SIDEWALK } from "./world";
import { ARM, LAMPS, POLE_H } from "./Grounds";
import { canvasTexture, type Part } from "./batch";

/**
 * Bits the holiday layers share (Halloween.tsx, NewYear.tsx, Lunar.tsx, Fiesta.tsx, Kalayaan.tsx): simple
 * people built from boxes, the main road's lamp posts, bulbs along a sagging string, a walk that loops down
 * the street with stops, and text drawn on a canvas.
 */

/* ------------------------------------------------------------------ people */

export type Look = {
  /** Shirt / top colour. */
  top: string;
  /** Trousers, or the skirt / gown when `dress`. */
  bottom: string;
  /** A long skirt or gown to the ground (sagala, lola), or a short one (`"short"`). */
  dress?: boolean | "short";
  hair?: string;
  skin?: number;
  /** 1 = an adult (about 1.65 m), 0.62 for a child. */
  scale?: number;
};

/**
 * Someone standing, feet at the origin, facing +x (the way they walk). Arms down at their sides; anything they
 * carry is added by the caller in the same frame. Parts scaled by `scale`.
 */
export function person(l: Look, at: readonly [number, number, number] = [0, 0, 0]): Part[] {
  const s = l.scale ?? 1, skin = PAL.skin[(l.skin ?? 0) % PAL.skin.length], hair = l.hair ?? "#1f1a17";
  const P: Part[] = [];
  const add = (size: [number, number, number], pos: [number, number, number], color: string, shape?: Part["shape"]) =>
    P.push({ shape, size: shape === "cyl" || shape === "cone" ? [size[0] * s, size[1] * s, size[2]] : [size[0] * s, size[1] * s, size[2] * s], pos: [at[0] + pos[0] * s, at[1] + pos[1] * s, at[2] + pos[2] * s], color });
  if (l.dress === true) {
    add([0.24, 0.9, 10], [0, 0.45, 0], l.bottom, "cone");
    add([0.2, 0.9, 10], [0, 0.45, 0], l.bottom, "cyl");
  } else if (l.dress === "short") {
    add([0.12, 0.45, 0.28], [0, 0.23, 0], skin);
    add([0.22, 0.4, 10], [0, 0.62, 0], l.bottom, "cone");
  } else {
    add([0.16, 0.82, 0.3], [0, 0.41, 0], l.bottom);
  }
  add([0.2, 0.46, 0.36], [0, 1.1, 0], l.top);
  add([0.08, 0.44, 0.08], [0, 1.1, 0.22], l.top);
  add([0.08, 0.44, 0.08], [0, 1.1, -0.22], l.top);
  add([0.2, 0.22, 0.2], [0, 1.47, 0], skin);
  add([0.22, 0.08, 0.22], [-0.01, 1.6, 0], hair);
  add([0.06, 0.16, 0.22], [-0.09, 1.5, 0], hair);
  return P;
}

/* ------------------------------------------------------------------ the main road's lamps */

/** Where the main road's lamp posts stand (both sidewalks), and which way their arm reaches (+1 over the road from the near side). */
export function mainLamps(): { x: number; z: number; dir: 1 | -1; headX: number; headZ: number; h: number }[] {
  return LAMPS.filter((l) => l.ax === 0 && (Math.abs(l.z - (SIDEWALK.z1 - 0.25)) < 0.01 || Math.abs(l.z - (FAR_WALK.z0 + 0.25)) < 0.01))
    .map((l) => ({ x: l.x, z: l.z, dir: (l.az > 0 ? 1 : -1) as 1 | -1, headX: l.x, headZ: l.z + l.az * (l.arm ?? ARM), h: l.h ?? POLE_H }));
}

/* ------------------------------------------------------------------ strings */

export type Line = { a: THREE.Vector3; b: THREE.Vector3; sag: number };

/** A point `t` (0–1) of the way along a sagging string. */
export function alongLine(ln: Line, t: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.lerpVectors(ln.a, ln.b, t).setY(out.y - Math.sin(Math.PI * t) * ln.sag);
}

/** The string itself as thin boxes, one per `step` metres. */
export function linePieces(ln: Line, color: string, step = 0.6, w = 0.015): Part[] {
  const len = ln.a.distanceTo(ln.b), n = Math.max(2, Math.round(len / step)), out: Part[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    alongLine(ln, i / n, a); alongLine(ln, (i + 1) / n, b);
    const d = b.clone().sub(a), horiz = Math.hypot(d.x, d.z);
    out.push({ size: [d.length(), w, w], pos: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2], rot: [0, Math.atan2(-d.z, d.x), Math.atan2(d.y, horiz)], color });
  }
  return out;
}

/* ------------------------------------------------------------------ walking */

/**
 * Where a group walking down the street is at scene time `sec`: from x0 to x1 at `speed` m/s, stopping for
 * `pause` seconds every `every` metres (trick-or-treating at each door), then looping. dir −1 walks x1 → x0.
 * Also says whether they're stopped right now (for the bob of their steps).
 */
export function walkX(sec: number, o: { x0: number; x1: number; speed: number; every?: number; pause?: number; dir?: 1 | -1; offset?: number }): { x: number; stopped: boolean } {
  const span = o.x1 - o.x0, every = o.every ?? span, pause = o.pause ?? 0;
  const leg = every / o.speed + pause, legs = Math.ceil(span / every);
  const loop = legs * leg;
  const t = (((sec + (o.offset ?? 0)) % loop) + loop) % loop;
  const n = Math.floor(t / leg), tin = t - n * leg;
  const walking = tin < every / o.speed;
  const d = Math.min(span, n * every + (walking ? tin * o.speed : every));
  return { x: (o.dir ?? 1) > 0 ? o.x0 + d : o.x1 - d, stopped: !walking };
}

/* ------------------------------------------------------------------ text */

/** A banner: `text` in big letters on a coloured cloth with a border (sRGB canvas texture). */
export function bannerTexture(lines: readonly string[], o: { bg: string; ink: string; border: string; w?: number; h?: number; font?: string }): THREE.CanvasTexture {
  const W = o.w ?? 1024, H = o.h ?? 192;
  return canvasTexture(W, H, (g) => {
    g.fillStyle = o.bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = o.border; g.lineWidth = H * 0.07; g.strokeRect(H * 0.06, H * 0.06, W - H * 0.12, H - H * 0.12);
    g.fillStyle = o.ink; g.textAlign = "center"; g.textBaseline = "middle";
    const lh = (H * 0.78) / lines.length;
    lines.forEach((t, i) => {
      let size = lh * 0.8;
      g.font = `bold ${size}px ${o.font ?? "Georgia, 'Times New Roman', serif"}`;
      const wmax = W * 0.9;
      const w = g.measureText(t).width;
      if (w > wmax) { size *= wmax / w; g.font = `bold ${size}px ${o.font ?? "Georgia, 'Times New Roman', serif"}`; }
      g.fillText(t, W / 2, H * 0.11 + lh * (i + 0.5));
    });
  });
}

/** Deterministic 0–1. */
export function seeded(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) * 9301 + 49297) % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
