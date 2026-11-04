"use client";

import { create } from "zustand";
import type { EmployeeId, EmployeeView, OfficeState } from "@/lib/team";
import type { JobStatus, ReminderRepeat } from "@/lib/supabase/database.types";
import { manilaInstant, manilaParts, to12Hour } from "@/lib/time";
import { trashDuty } from "@/lib/office-clock";

export type NewReminder = { title: string; local: string; repeat: ReminderRepeat | null };

export type WeatherKind = "clear" | "partly" | "cloudy" | "rain" | "storm";
export const WEATHER_KINDS: readonly WeatherKind[] = ["clear", "partly", "cloudy", "rain", "storm"];
/** From /api/weather: what the office shows, plus the exact condition ("Partly cloudy") and temperatures. */
export type Weather = { kind: WeatherKind; label?: string; tempC: number | null; feelsC?: number | null; at?: string | null };

const LOW_POWER_KEY = "hq:low-power";
function readLowPower(): boolean {
  try { return window.localStorage.getItem(LOW_POWER_KEY) === "1"; } catch { return false; }
}

/** Something you sent the boss to do from the Boss menu (see bossErrandRoute in components/office/routes.ts). */
export type BossErrandKind = "vape" | "walk" | "snack" | "coffee" | "rounds";
export type BossErrandState = { kind: BossErrandKind; /** Date.now() when it started. */ since: number; seed: number };

/** The scene is showing another time of day: `at` (real ms) was the scene clock when `since` (real ms) was now. */
export type TimeTravel = { at: number; since: number; label: string };

type OfficeStore = {
  data: OfficeState;
  selected: EmployeeId | null;
  hovered: EmployeeId | null;
  offline: boolean;
  timeTravel: TimeTravel | null;
  /** Live Manila weather from /api/weather, and a preview override. */
  weather: Weather | null;
  weatherOverride: WeatherKind | null;
  /** Fewer effects, no shadows, 30 fps: for older phones and battery. Remembered on this device. */
  lowPower: boolean;
  /** The boss is out on an errand you sent them on (real time, not the scene clock). */
  bossErrand: BossErrandState | null;

  hydrate: (data: OfficeState) => void;
  select: (id: EmployeeId | null) => void;
  hover: (id: EmployeeId | null) => void;
  /** Jump the 3D office to "HH:MM" Manila today (it keeps ticking from there), or back to live with null. */
  previewTime: (hhmm: string | null, label?: string) => void;
  loadWeather: () => Promise<void>;
  previewWeather: (kind: WeatherKind | null) => void;
  setLowPower: (on: boolean) => void;
  sendBoss: (kind: BossErrandKind | null) => void;

  refresh: () => Promise<void>;
  runNow: (id: EmployeeId) => Promise<void>;
  setEnabled: (id: EmployeeId, enabled: boolean) => Promise<void>;
  acknowledge: (id: EmployeeId) => Promise<void>;
  setJobStatus: (jobId: string, status: JobStatus) => Promise<void>;
  draftCoverLetter: (jobId: string) => Promise<string>;
  addReminder: (input: NewReminder) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;
};

const EMPTY: OfficeState = { ai: { provider: "none", backupAllowsPrivate: false }, employees: [], jobs: [], reminders: [], inbox: [] };

/** Pulls `{ error: string }` out of an API error body, whatever shape it actually came back in. */
function errorMessage(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") return body.error;
  return null;
}

/** Fetches one of our own API routes. `T` is the success shape that route returns. */
async function call<T = { ok: true }>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body) ?? `Request failed (${res.status})`);
  return body as T;
}

/**
 * One browser-only store for the whole office. The office is rendered client-side only
 * (see OfficeLoader), so this module-level store never leaks between server requests.
 */
export const useOffice = create<OfficeStore>()((set, get) => ({
  data: EMPTY,
  selected: null,
  hovered: null,
  offline: false,
  timeTravel: null,
  weather: null,
  weatherOverride: null,
  lowPower: typeof window === "undefined" ? false : readLowPower(),
  bossErrand: null,

  hydrate: (data) => set({ data }),
  select: (id) => set({ selected: id }),
  hover: (id) => set({ hovered: id }),
  previewTime: (hhmm, label) => {
    if (!hhmm) return set({ timeTravel: null });
    const p = manilaParts(new Date());
    const at = manilaInstant(p.year, p.month, p.day, hhmm).getTime();
    set({ timeTravel: { at, since: Date.now(), label: label ?? to12Hour(hhmm) } });
  },

  loadWeather: async () => {
    try {
      set({ weather: await call<Weather>("/api/weather", { cache: "no-store" }) });
    } catch {
      // keep the last weather; the office just shows clear skies until it loads
    }
  },
  previewWeather: (kind) => set({ weatherOverride: kind }),
  setLowPower: (on) => {
    try { window.localStorage.setItem(LOW_POWER_KEY, on ? "1" : "0"); } catch { /* private mode: not remembered */ }
    set({ lowPower: on });
  },

  sendBoss: (kind) => set({ bossErrand: kind ? { kind, since: Date.now(), seed: Math.floor(Math.random() * 1e6) } : null }),

  refresh: async () => {
    try {
      const data = await call<OfficeState>("/api/state", { cache: "no-store" });
      set({ data, offline: false });
    } catch {
      set({ offline: true });
    }
  },

  runNow: async (id) => {
    // Optimistic: light the desk up immediately, the next refresh confirms it.
    set((s) => ({ data: { ...s.data, employees: s.data.employees.map((e) => (e.id === id ? { ...e, status: "working" } : e)) } }));
    try {
      await call(`/api/employees/${id}`, { method: "POST" });
    } finally {
      await get().refresh();
    }
  },

  setEnabled: async (id, enabled) => {
    await call(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
    await get().refresh();
  },

  acknowledge: async (id) => {
    await call(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify({ acknowledge: true }) });
    await get().refresh();
  },

  setJobStatus: async (jobId, status) => {
    const before = get().data;
    set((s) => ({ data: { ...s.data, jobs: s.data.jobs.map((j) => (j.id === jobId ? { ...j, status } : j)) } }));
    try {
      await call(`/api/jobs/${jobId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    } catch (e) {
      set({ data: before });
      throw e;
    }
  },

  draftCoverLetter: async (jobId) => {
    const r = await call<{ letter: string }>(`/api/jobs/${jobId}/cover-letter`, { method: "POST" });
    return r.letter;
  },

  addReminder: async (input) => {
    await call("/api/reminders", { method: "POST", body: JSON.stringify(input) });
    await get().refresh();
  },

  removeReminder: async (id) => {
    await call(`/api/reminders?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await get().refresh();
  },
}));

/** Convenience selectors */
export const useEmployee = (id: EmployeeId | null): EmployeeView | null =>
  useOffice((s) => (id ? s.data.employees.find((e) => e.id === id) ?? null : null));

/** The 3D office's clock: real time, or the previewed time of day while time travel is on. */
export function sceneNow(): Date {
  const tt = useOffice.getState().timeTravel;
  return tt ? new Date(tt.at + (Date.now() - tt.since)) : new Date();
}

/** Who has trash duty today (by the scene clock), skipping paused employees. */
export function useTrashDuty(): EmployeeId | null {
  const employees = useOffice((s) => s.data.employees);
  useOffice((s) => s.timeTravel); // re-run when the previewed day changes
  return trashDuty(sceneNow(), (id) => employees.find((e) => e.id === id)?.enabled ?? true);
}

/** The weather the 3D office shows: the preview override, else live Manila weather, else clear. */
export function sceneWeather(): WeatherKind {
  const s = useOffice.getState();
  return s.weatherOverride ?? s.weather?.kind ?? "clear";
}
