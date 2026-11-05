import { manilaMinutes } from "@/lib/office-clock";

/**
 * When the neighbourhood's roosters crow: every half minute or so from 4 to 9 AM (the whole street hears it,
 * one answering the other), now and then through the day, never at night. A pure function of the scene clock, so the birds in the 3D yards
 * (Roosters.tsx) throw their heads back on the same beat the sound engine (lib/ambience.ts) plays the crow.
 */

export const ROOSTER_COUNT = 3;
/** How long one "cock-a-doodle-doo" lasts, seconds: the recorded crows (public/sounds/rooster-*.mp3) run 1.7–2.2 s. */
export const CROW_S = 2.1;

/** Seconds into rooster k's crow at `now`, or null when it isn't crowing. */
export function crowing(now: Date, k: number): number | null {
  const min = manilaMinutes(now);
  const dawn = min >= 240 && min < 540;
  const day = min >= 540 && min < 1050;
  const period = dawn ? 26 + k * 9 : day ? 180 + k * 61 : 0;
  if (!period) return null;
  const t = (now.getTime() / 1000 + k * 23) % period;
  return t < CROW_S ? t : null;
}
