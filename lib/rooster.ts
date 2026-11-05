import { manilaMinutes } from "@/lib/office-clock";

/**
 * When the neighbourhood's roosters crow: often from 4:30 to 7:30 AM (the whole street hears it), now and then
 * through the day, never at night. A pure function of the scene clock, so the birds in the 3D yards
 * (Roosters.tsx) throw their heads back on the same beat the sound engine (lib/ambience.ts) plays the crow.
 */

export const ROOSTER_COUNT = 3;
/** How long one "cock-a-doodle-doo" lasts, seconds. */
export const CROW_S = 2.4;

/** Seconds into rooster k's crow at `now`, or null when it isn't crowing. */
export function crowing(now: Date, k: number): number | null {
  const min = manilaMinutes(now);
  const dawn = min >= 270 && min < 450;
  const day = min >= 450 && min < 1050;
  const period = dawn ? 38 + k * 11 : day ? 300 + k * 83 : 0;
  if (!period) return null;
  const t = (now.getTime() / 1000 + k * 23) % period;
  return t < CROW_S ? t : null;
}
