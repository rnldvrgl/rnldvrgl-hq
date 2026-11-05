"use client";

import { create } from "zustand";
import { sceneNow } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { workHours } from "@/lib/settings";
import type { Who } from "./homes";

/**
 * Sending someone home early or calling them in to the office by hand (the desk panel for employees, the Boss
 * menu for the boss). It starts the walk (or the drive) right away and holds until the schedule would have
 * done the same anyway: "home" until their next arrival time, "office" until their next go-home time.
 * Remembered on this device, timed on the scene clock (so it works in preview too).
 */

export type Override = { mode: "home" | "office"; /** Scene-clock ms when it was given. */ since: number; /** …and when it lapses. */ until: number };

const KEY = "hq:commute";

function read(): Partial<Record<Who, Override>> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<Who, Override>>; } catch { return {}; }
}

export const useCommute = create<{ overrides: Partial<Record<Who, Override>> }>(() => ({
  overrides: typeof window === "undefined" ? {} : read(),
}));

/** The next time the clock reads `minute` (Manila minutes) after `fromMs`. */
function nextAt(fromMs: number, minute: number): number {
  const m = manilaMinutes(new Date(fromMs));
  const delta = ((minute - m) % 1440 + 1440) % 1440 || 1440;
  return fromMs + delta * 60_000;
}

/** Send `who` home now, or call them in. */
export function sendCommute(who: Who, mode: Override["mode"]): void {
  const now = sceneNow().getTime();
  const h = workHours(who === "owner" ? "boss" : "team");
  const until = mode === "home" ? nextAt(now, h.back) : nextAt(now, h.from);
  const overrides = { ...useCommute.getState().overrides, [who]: { mode, since: now, until } };
  useCommute.setState({ overrides });
  try { localStorage.setItem(KEY, JSON.stringify(overrides)); } catch { /* not remembered */ }
}

/** The override in force for `who` at scene time `nowMs`, with seconds since it was given. */
export function overrideAt(who: Who, nowMs: number): (Override & { t: number }) | null {
  const o = useCommute.getState().overrides[who];
  if (!o || nowMs < o.since || nowMs >= o.until) return null;
  return { ...o, t: (nowMs - o.since) / 1000 };
}
