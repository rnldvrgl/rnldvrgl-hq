"use client";

import { create } from "zustand";
import { HQ, type BossLook, type BossOffice } from "@/hq.config";

/**
 * Per-device settings for the 3D office (Settings in the office's top-right corner), saved in localStorage.
 * Nothing here touches the server: what one phone renders doesn't change what another sees.
 *
 *   show      what gets drawn: turn off whole layers on slower devices (each one is fewer meshes to render)
 *   motion    "full", or "minimal": people still go where they need to, but without idle animation,
 *             passing traffic, smoke or rain particles, and the scene redraws at a low frame rate
 *   routine   which time-based things the team does (stand-up, lunch, trash…); off = they stay at their desks
 *   boss      the boss's look and whether he/she wanders around on their own
 */

export type ShowKey = "neighbourhood" | "traffic" | "vendors" | "pets" | "weather" | "streetLights" | "smoke" | "bubbles" | "trees" | "holidays";
export type RoutineKey =
  | "standup" | "meeting" | "lunch" | "trashDrop" | "trashRun" | "commute" | "janitor" | "idleBreaks" | "errorHelp";
export type Motion = "full" | "minimal";

export type Settings = {
  show: Record<ShowKey, boolean>;
  motion: Motion;
  routine: Record<RoutineKey, boolean>;
  boss: { look: BossLook; wanders: boolean; office: OfficeStyle };
  /** The office sound system's lo-fi music, during office hours (only heard when sound is on). */
  music: boolean;
  /** A short chime, different for each employee, when someone starts needing you (only with sound on). */
  chimes: boolean;
  /** Switch to Battery saver by itself when the 3D view keeps running slow. */
  autoSaver: boolean;
};

/** The corner office's interior. "auto" follows the boss's look: executive for him, cozy for her. */
export type OfficeStyle = BossOffice;
export const OFFICE_STYLES: readonly { id: OfficeStyle; label: string; hint: string }[] = [
  { id: "auto", label: "Match the boss", hint: "Executive for him, cozy for her" },
  { id: "executive", label: "Executive", hint: "Walnut, leather, warm light" },
  { id: "gaming", label: "Gaming", hint: "Neon RGB, acoustic panels" },
  { id: "cozy", label: "Cozy", hint: "Blush, arches, plants, fairy lights" },
  { id: "minimal", label: "Minimal", hint: "White oak, clean lines" },
  { id: "studio", label: "Creator studio", hint: "Foam panels, ring light, ON AIR sign" },
  { id: "heritage", label: "Filipino heritage", hint: "Narra wood, capiz windows, banig, rattan" },
];

export const SHOW_LABELS: readonly { key: ShowKey; label: string; hint: string }[] = [
  { key: "neighbourhood", label: "Neighbourhood", hint: "Shops, gas stations and houses around the office" },
  { key: "traffic", label: "Traffic", hint: "Jeepneys, tricycles and cars on the streets" },
  { key: "vendors", label: "Street vendors", hint: "Pandesal vendors on the sidewalks, 5 AM – 7 PM" },
  { key: "holidays", label: "Holidays", hint: "Parols and Christmas lights Sept 16 – Jan 6, fireworks at New Year" },
  { key: "trees", label: "Trees", hint: "Trees and hedges" },
  { key: "pets", label: "Pets", hint: "The dog and the cat" },
  { key: "weather", label: "Weather effects", hint: "Rain, splashes and cloud shadows" },
  { key: "streetLights", label: "Street lights", hint: "Lamp posts and their glow at night" },
  { key: "smoke", label: "Vape smoke", hint: "Smoke clouds on breaks" },
  { key: "bubbles", label: "Name bubbles", hint: "Status bubbles over people" },
];

export const ROUTINE_LABELS: readonly { key: RoutineKey; label: string; hint: string }[] = [
  { key: "standup", label: "Stand-up", hint: "Weekdays 9:00 AM" },
  { key: "meeting", label: "Team sync", hint: "Weekdays 2:00 PM, meeting room" },
  { key: "lunch", label: "Lunch", hint: "12:00–12:55 PM at the dining table" },
  { key: "trashDrop", label: "Binning trash", hint: "5:30 PM, everyone to the main bin" },
  { key: "trashRun", label: "Trash run", hint: "5:40 PM, one person takes it out" },
  { key: "commute", label: "Commute", hint: "Arrive 7 AM, go home 7 PM" },
  { key: "janitor", label: "Janitor rounds", hint: "Mopping at 7 AM, 12 PM and 6 PM" },
  { key: "idleBreaks", label: "Breaks when idle", hint: "Idle people hang out on the patio" },
  { key: "errorHelp", label: "Ask the boss for help", hint: "On an error, wait in the boss's office" },
];

const KEY = "hq:settings";

export const DEFAULT_SETTINGS: Settings = {
  show: { neighbourhood: true, traffic: true, vendors: true, pets: true, weather: true, streetLights: true, smoke: true, bubbles: true, trees: true, holidays: true },
  motion: "full",
  routine: { standup: true, meeting: true, lunch: true, trashDrop: true, trashRun: true, commute: true, janitor: true, idleBreaks: true, errorHelp: true },
  boss: { look: HQ.owner.look, wanders: true, office: HQ.owner.office },
  music: true,
  chimes: true,
  autoSaver: true,
};

/** Light settings for weak phones: what "Battery saver" switches to in one tap. */
export const LIGHT_SHOW: Settings["show"] = {
  neighbourhood: false, traffic: false, vendors: false, pets: false, weather: false, streetLights: false, smoke: false, bubbles: true, trees: false, holidays: false,
};

function read(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const v = JSON.parse(raw) as Partial<Settings>;
    // merge over the defaults, so settings added later start at their default
    return {
      show: { ...DEFAULT_SETTINGS.show, ...v.show },
      motion: v.motion === "minimal" ? "minimal" : "full",
      routine: { ...DEFAULT_SETTINGS.routine, ...v.routine },
      boss: { ...DEFAULT_SETTINGS.boss, ...v.boss },
      music: v.music ?? DEFAULT_SETTINGS.music,
      chimes: v.chimes ?? DEFAULT_SETTINGS.chimes,
      autoSaver: v.autoSaver ?? DEFAULT_SETTINGS.autoSaver,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(s: Settings): void {
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: not remembered */ }
}

type SettingsStore = Settings & {
  setShow: (key: ShowKey, on: boolean) => void;
  setAllShow: (show: Settings["show"]) => void;
  setMotion: (m: Motion) => void;
  setRoutine: (key: RoutineKey, on: boolean) => void;
  setBoss: (patch: Partial<Settings["boss"]>) => void;
  setMusic: (on: boolean) => void;
  setChimes: (on: boolean) => void;
  setAutoSaver: (on: boolean) => void;
  reset: () => void;
};

export const useSettings = create<SettingsStore>()((set, get) => {
  const commit = (patch: Partial<Settings>) => {
    set(patch);
    const { show, motion, routine, boss, music, chimes, autoSaver } = get();
    save({ show, motion, routine, boss, music, chimes, autoSaver });
  };
  return {
    ...(typeof window === "undefined" ? DEFAULT_SETTINGS : read()),
    setShow: (key, on) => commit({ show: { ...get().show, [key]: on } }),
    setAllShow: (show) => commit({ show }),
    setMotion: (motion) => commit({ motion }),
    setRoutine: (key, on) => commit({ routine: { ...get().routine, [key]: on } }),
    setBoss: (patch) => commit({ boss: { ...get().boss, ...patch } }),
    setMusic: (music) => commit({ music }),
    setChimes: (chimes) => commit({ chimes }),
    setAutoSaver: (autoSaver) => commit({ autoSaver }),
    reset: () => commit(DEFAULT_SETTINGS),
  };
});

/** Read a routine switch outside React (inside useFrame). */
export const routineOn = (key: RoutineKey): boolean => useSettings.getState().routine[key];
export const useShow = (key: ShowKey): boolean => useSettings((s) => s.show[key]);
export const useMinimalMotion = (): boolean => useSettings((s) => s.motion === "minimal");
/** The office style actually shown: "auto" resolved from the boss's look. */
export const useOfficeStyle = (): Exclude<OfficeStyle, "auto"> => useSettings((s) =>
  s.boss.office !== "auto" ? s.boss.office : s.boss.look === "her" ? "cozy" : "executive");
