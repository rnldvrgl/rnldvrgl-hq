import { LANE } from "./world";

/**
 * Where the Holy Week procession is (Penitensya.tsx draws it): walking the far lane of the main road toward
 * −x at a solemn pace, on the scene clock, looping. Traffic.tsx reads it while it's out, so the cars in that
 * lane crawl along behind it, the way they do behind a real procession.
 */

export const PROCESSION = { speed: 0.4, x0: -42, x1: 80, z: LANE.far, length: 12 } as const;
/** Set while the procession is on screen (mounted). */
export const processionState = { active: false };

/** x of the carroza at the head of the column, at scene time `sec` (seconds). */
export function processionX(sec: number): number {
  const loop = PROCESSION.x1 - PROCESSION.x0 + PROCESSION.length + 2;
  return PROCESSION.x1 - ((sec * PROCESSION.speed) % loop);
}

/** The back of the column (the last devotee): what a car coming up behind it in the far lane must stop for. */
export const processionRearX = (sec: number): number => processionX(sec) + PROCESSION.length;
