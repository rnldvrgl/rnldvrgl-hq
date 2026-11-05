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

export type ShowKey = "neighbourhood" | "traffic" | "vendors" | "pets" | "weather" | "streetLights" | "smoke" | "bubbles" | "trees" | "holidays" | "homeNames";
export type RoutineKey =
  | "standup" | "meeting" | "lunch" | "trashDrop" | "trashRun" | "commute" | "janitor" | "idleBreaks" | "errorHelp";
export type Motion = "full" | "minimal";

export type Settings = {
  show: Record<ShowKey, boolean>;
  motion: Motion;
  routine: Record<RoutineKey, boolean>;
  boss: { look: BossLook; wanders: boolean; office: OfficeStyle; car: CarChoice };
  /** The office sound system's music, during office hours (only heard when sound is on). */
  music: boolean;
  /** Which music the sound system plays (all generated live, no audio files). */
  musicStyle: MusicStyle;
  /** The sound mixer: each kind of sound's volume, 0–150 (%), 100 = as designed. */
  volumes: Record<MixKey, number>;
  /** A short chime, different for each employee, when someone starts needing you (only with sound on). */
  chimes: boolean;
  /** Switch to Battery saver by itself when the 3D view keeps running slow. */
  autoSaver: boolean;
  /** At most this many people walking outside at the busiest hour (0 = none). Fewer is lighter on slow phones. */
  walkers: number;
  /** Office hours, "HH:MM" Manila time: when the team and the boss arrive and walk home (with Commute on). */
  hours: Hours;
};
export type Hours = { teamIn: string; teamOut: string; bossIn: string; bossOut: string };
export const DEFAULT_HOURS: Hours = { teamIn: "07:00", teamOut: "19:00", bossIn: "08:00", bossOut: "20:00" };
/** The times you can pick: arrivals 5–10 AM, going home 3–11:30 PM, on the half hour. */
const halfHours = (from: number, to: number) => Array.from({ length: (to - from) * 2 + 1 }, (_, i) => {
  const m = from * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});
export const ARRIVE_TIMES = halfHours(5, 10);
export const LEAVE_TIMES = halfHours(15, 23).concat("23:30");
const pickTime = (v: unknown, list: readonly string[], d: string) => (typeof v === "string" && list.includes(v) ? v : d);
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
/** Minutes since Manila midnight that `who` arrives (`back`) and goes home (`from`). Reads the live settings. */
export function workHours(who: "team" | "boss"): { back: number; from: number } {
  const h = useSettings.getState().hours;
  return who === "team" ? { back: toMin(h.teamIn), from: toMin(h.teamOut) } : { back: toMin(h.bossIn), from: toMin(h.bossOut) };
}
/** "7:00 AM" from "07:00". */
export function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
export const WALKERS_MAX = 40;

/** The office sound system's music styles (see lib/ambience.ts for how each one is played). */
export type MusicStyle = "lofi" | "jazz" | "bossa" | "piano" | "synthwave" | "chiptune";
export const MUSIC_STYLES: readonly { id: MusicStyle; label: string; hint: string }[] = [
  { id: "lofi", label: "Cozy lo-fi", hint: "Dusty keys, soft kicks, 78 BPM" },
  { id: "jazz", label: "Café jazz", hint: "Walking bass, brushes and piano" },
  { id: "bossa", label: "Bossa nova", hint: "Nylon guitar, rim clicks, shaker" },
  { id: "piano", label: "Calm piano", hint: "Slow arpeggios, no drums" },
  { id: "synthwave", label: "Night drive", hint: "Synthwave pads and bass" },
  { id: "chiptune", label: "8-bit arcade", hint: "Square-wave chiptune" },
];
const isMusicStyle = (v: unknown): v is MusicStyle => MUSIC_STYLES.some((m) => m.id === v);

/** The sound mixer's channels (lib/ambience.ts routes every sound through one of them). */
export type MixKey = "all" | "music" | "room" | "typing" | "weather" | "street" | "alerts";
export const MIX_CHANNELS: readonly { key: MixKey; label: string; hint: string }[] = [
  { key: "all", label: "All office sound", hint: "Everything below together" },
  { key: "music", label: "Office radio", hint: "The sound system's music" },
  { key: "room", label: "Office hum", hint: "Room tone and the aircon" },
  { key: "typing", label: "Keyboards", hint: "Typing at the desks you zoom in on" },
  { key: "weather", label: "Rain & thunder", hint: "Rain on the roof, storms" },
  { key: "street", label: "Street & nature", hint: "Birds, roosters, crickets, traffic, vendors, the car" },
  { key: "alerts", label: "Alerts", hint: "The chime when someone needs you" },
];
export const MIX_MAX = 150;
const DEFAULT_VOLUMES: Record<MixKey, number> = { all: 100, music: 100, room: 100, typing: 100, weather: 100, street: 100, alerts: 100 };
const clampVol = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(MIX_MAX, Math.round(v))) : d);

/** The boss's car (components/office/Car.tsx). "auto" follows the boss's look. */
export type CarModel = "typer" | "mini" | "suv" | "pickup" | "sports" | "ev";
export type CarChoice = "auto" | CarModel;
export const CAR_MODELS: readonly { id: CarChoice; label: string; hint: string }[] = [
  { id: "auto", label: "Match the boss", hint: "Type R for him, the pink mini for her" },
  { id: "typer", label: "Hot hatch", hint: "White, big wing, red trim (Civic Type R style)" },
  { id: "mini", label: "Pink mini", hint: "Rosé two-tone retro hatch, white roof" },
  { id: "suv", label: "Big SUV", hint: "Black seven-seater, roof rails" },
  { id: "pickup", label: "Pickup", hint: "Grey double-cab with the bed out back" },
  { id: "sports", label: "Sports coupé", hint: "Red, low and wide" },
  { id: "ev", label: "Electric", hint: "Pearl white, glass roof, light bar" },
];
const isCarChoice = (v: unknown): v is CarChoice => CAR_MODELS.some((c) => c.id === v);
/** The car actually shown. */
export const carModelOf = (boss: Settings["boss"]): CarModel => boss.car === "auto" ? (boss.look === "her" ? "mini" : "typer") : boss.car;

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
  { key: "pets", label: "Pets", hint: "The dog, the cat, and the roosters and hens next door" },
  { key: "weather", label: "Weather effects", hint: "Rain, splashes and cloud shadows" },
  { key: "streetLights", label: "Street lights", hint: "Lamp posts and their glow at night" },
  { key: "smoke", label: "Vape smoke", hint: "Smoke clouds on breaks" },
  { key: "bubbles", label: "Name bubbles", hint: "Status bubbles over people" },
  { key: "homeNames", label: "House name badges", hint: "Whose house is whose, floating over each home" },
];

export const ROUTINE_LABELS: readonly { key: RoutineKey; label: string; hint: string }[] = [
  { key: "standup", label: "Stand-up", hint: "Weekdays 9:00 AM" },
  { key: "meeting", label: "Team sync", hint: "Weekdays 2:00 PM, meeting room" },
  { key: "lunch", label: "Lunch", hint: "12:00–12:55 PM at the dining table" },
  { key: "trashDrop", label: "Binning trash", hint: "5:30 PM, everyone to the main bin" },
  { key: "trashRun", label: "Trash run", hint: "5:40 PM, one person takes it out" },
  { key: "commute", label: "Commute", hint: "Walk to and from their houses at office hours (below)" },
  { key: "janitor", label: "Janitor rounds", hint: "Mopping at 7 AM, 12 PM and 6 PM" },
  { key: "idleBreaks", label: "Breaks when idle", hint: "Idle people hang out on the patio" },
  { key: "errorHelp", label: "Ask the boss for help", hint: "On an error, wait in the boss's office" },
];

const KEY = "hq:settings";

export const DEFAULT_SETTINGS: Settings = {
  show: { neighbourhood: true, traffic: true, vendors: true, pets: true, weather: true, streetLights: true, smoke: true, bubbles: true, trees: true, holidays: true, homeNames: true },
  motion: "full",
  routine: { standup: true, meeting: true, lunch: true, trashDrop: true, trashRun: true, commute: true, janitor: true, idleBreaks: true, errorHelp: true },
  boss: { look: HQ.owner.look, wanders: true, office: HQ.owner.office, car: "auto" },
  music: true,
  musicStyle: "lofi",
  volumes: DEFAULT_VOLUMES,
  chimes: true,
  autoSaver: true,
  walkers: 16,
  hours: DEFAULT_HOURS,
};

/** Light settings for weak phones: what "Battery saver" switches to in one tap. */
export const LIGHT_SHOW: Settings["show"] = {
  neighbourhood: false, traffic: false, vendors: false, pets: false, weather: false, streetLights: false, smoke: false, bubbles: true, trees: false, holidays: false, homeNames: false,
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
      boss: { ...DEFAULT_SETTINGS.boss, ...v.boss, car: isCarChoice(v.boss?.car) ? v.boss.car : DEFAULT_SETTINGS.boss.car },
      music: v.music ?? DEFAULT_SETTINGS.music,
      musicStyle: isMusicStyle(v.musicStyle) ? v.musicStyle : DEFAULT_SETTINGS.musicStyle,
      volumes: Object.fromEntries(
        (Object.keys(DEFAULT_VOLUMES) as MixKey[]).map((k) => [k, clampVol(v.volumes?.[k], DEFAULT_VOLUMES[k])]),
      ) as Record<MixKey, number>,
      chimes: v.chimes ?? DEFAULT_SETTINGS.chimes,
      autoSaver: v.autoSaver ?? DEFAULT_SETTINGS.autoSaver,
      walkers: typeof v.walkers === "number" && Number.isFinite(v.walkers) ? Math.max(0, Math.min(WALKERS_MAX, Math.round(v.walkers))) : DEFAULT_SETTINGS.walkers,
      hours: {
        teamIn: pickTime(v.hours?.teamIn, ARRIVE_TIMES, DEFAULT_HOURS.teamIn),
        teamOut: pickTime(v.hours?.teamOut, LEAVE_TIMES, DEFAULT_HOURS.teamOut),
        bossIn: pickTime(v.hours?.bossIn, ARRIVE_TIMES, DEFAULT_HOURS.bossIn),
        bossOut: pickTime(v.hours?.bossOut, LEAVE_TIMES, DEFAULT_HOURS.bossOut),
      },
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
  setMusicStyle: (style: MusicStyle) => void;
  setVolume: (key: MixKey, v: number) => void;
  resetVolumes: () => void;
  setChimes: (on: boolean) => void;
  setAutoSaver: (on: boolean) => void;
  setWalkers: (n: number) => void;
  setHours: (patch: Partial<Hours>) => void;
  reset: () => void;
};

export const useSettings = create<SettingsStore>()((set, get) => {
  const commit = (patch: Partial<Settings>) => {
    set(patch);
    const { show, motion, routine, boss, music, musicStyle, volumes, chimes, autoSaver, walkers, hours } = get();
    save({ show, motion, routine, boss, music, musicStyle, volumes, chimes, autoSaver, walkers, hours });
  };
  return {
    ...(typeof window === "undefined" ? DEFAULT_SETTINGS : read()),
    setShow: (key, on) => commit({ show: { ...get().show, [key]: on } }),
    setAllShow: (show) => commit({ show }),
    setMotion: (motion) => commit({ motion }),
    setRoutine: (key, on) => commit({ routine: { ...get().routine, [key]: on } }),
    setBoss: (patch) => commit({ boss: { ...get().boss, ...patch } }),
    setMusic: (music) => commit({ music }),
    setMusicStyle: (musicStyle) => commit({ musicStyle }),
    setVolume: (key, v) => commit({ volumes: { ...get().volumes, [key]: clampVol(v, DEFAULT_VOLUMES[key]) } }),
    resetVolumes: () => commit({ volumes: DEFAULT_VOLUMES }),
    setChimes: (chimes) => commit({ chimes }),
    setAutoSaver: (autoSaver) => commit({ autoSaver }),
    setWalkers: (n) => commit({ walkers: Math.max(0, Math.min(WALKERS_MAX, Math.round(n))) }),
    setHours: (patch) => commit({ hours: { ...get().hours, ...patch } }),
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
