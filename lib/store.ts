"use client";

import { create } from "zustand";
import type { EmployeeId, EmployeeView, OfficeState } from "@/lib/team";
import type { JobStatus, ReminderRepeat } from "@/lib/supabase/database.types";
import { manilaInstant, manilaParts, to12Hour } from "@/lib/time";
import { trashDuty } from "@/lib/office-clock";

export type NewReminder = { title: string; local: string; repeat: ReminderRepeat | null };

/** The scene is showing another time of day: `at` (real ms) was the scene clock when `since` (real ms) was now. */
export type TimeTravel = { at: number; since: number; label: string };

type OfficeStore = {
  data: OfficeState;
  selected: EmployeeId | null;
  hovered: EmployeeId | null;
  offline: boolean;
  timeTravel: TimeTravel | null;

  hydrate: (data: OfficeState) => void;
  select: (id: EmployeeId | null) => void;
  hover: (id: EmployeeId | null) => void;
  /** Jump the 3D office to "HH:MM" Manila today (it keeps ticking from there), or back to live with null. */
  previewTime: (hhmm: string | null, label?: string) => void;

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

  hydrate: (data) => set({ data }),
  select: (id) => set({ selected: id }),
  hover: (id) => set({ hovered: id }),
  previewTime: (hhmm, label) => {
    if (!hhmm) return set({ timeTravel: null });
    const p = manilaParts(new Date());
    const at = manilaInstant(p.year, p.month, p.day, hhmm).getTime();
    set({ timeTravel: { at, since: Date.now(), label: label ?? to12Hour(hhmm) } });
  },

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
