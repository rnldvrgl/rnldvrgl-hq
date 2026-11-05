"use client";

import { create } from "zustand";
import { TEAM, type EmployeeId } from "@/lib/team";
import { appNameOf, DEFAULT_ICON, iconKey, type AppIcon, type Prefs, type PrefsState } from "@/lib/prefs";
import { syncedOf, useSettings } from "@/lib/settings";
import { applyStyle, applyTheme, readStyle, readTheme, type StyleName, type ThemeChoice } from "@/lib/theme";

/**
 * The browser side of an HQ's synced preferences (lib/prefs.ts). The server's copy comes in with every
 * /api/state; a change made here is applied at once and saved a moment later. A copy saved by another device
 * is applied when it's newer than ours and we have nothing waiting to be saved, so a change you just made is
 * never undone by an older poll.
 */

type PrefsStore = {
  prefs: Prefs;
  at: string | null;
  /** The handle when none has been chosen (yours: hq.config.ts; a friend's: their first name). */
  baseHandle: string;
  /** Bumped when the team changes, so the office redraws with the right desks. */
  teamVersion: number;
  set: (patch: Partial<Prefs>) => void;
};

export const usePrefs = create<PrefsStore>()((set, get) => ({
  prefs: {},
  at: null,
  baseHandle: "HQ",
  teamVersion: 0,
  set: (patch) => {
    const before = get().prefs.team?.join();
    set({ prefs: { ...get().prefs, ...patch } });
    if (patch.team && patch.team.join() !== before) set({ teamVersion: get().teamVersion + 1 });
    // a field set to undefined is removed on the server too (back to its default)
    queue(Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? null : v])));
  },
}));

// ---- saving: changes are merged and sent ~0.8 s after the last one --------------------------------------

let pending: Record<string, unknown> = {};
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
/** While applying the server's copy, don't send it straight back. */
let applying = false;
let ready = false;

function queue(patch: Record<string, unknown>): void {
  if (applying || !ready) return;
  pending = { ...pending, ...patch };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void flush(); }, 800);
}

async function flush(): Promise<void> {
  if (inFlight || !Object.keys(pending).length) return;
  const patch = pending;
  pending = {};
  inFlight = true;
  try {
    const res = await fetch("/api/prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ patch }) });
    if (res.ok) {
      const body = (await res.json()) as PrefsState;
      usePrefs.setState({ at: body.at });
    } else if (res.status >= 500) {
      // the table isn't there yet (multi-hq.sql), or the database is down: keep it on this device only
      console.warn("[prefs] not saved:", (await res.json().catch(() => null))?.error ?? res.status);
    }
  } catch {
    pending = { ...patch, ...pending }; // offline: try again with the next change or refresh
  } finally {
    inFlight = false;
    if (Object.keys(pending).length) timer = setTimeout(() => { timer = null; void flush(); }, 800);
  }
}

// the office settings and the colour style/theme are kept in their own stores: send them when they change
if (typeof window !== "undefined") {
  let last = JSON.stringify(syncedOf(useSettings.getState()));
  useSettings.subscribe((s) => {
    const now = JSON.stringify(syncedOf(s));
    if (now === last) return;
    last = now;
    queue({ office: JSON.parse(now) });
  });
  window.addEventListener("hq:style", () => queue({ style: readStyle() }));
  window.addEventListener("hq:theme", () => queue({ theme: readTheme() }));
}

/** Take the server's copy (every /api/state). `baseHandle` is the HQ's default name. */
export function applyServerPrefs(state: PrefsState | undefined, baseHandle: string | undefined): void {
  if (baseHandle && baseHandle !== usePrefs.getState().baseHandle) usePrefs.setState({ baseHandle });
  if (!state) { ready = true; return; }
  const mine = usePrefs.getState();
  const first = !ready;
  ready = true;
  if (!state.at) {
    // nothing saved for this HQ yet: this device's settings become the HQ's
    if (first) queue({ office: syncedOf(useSettings.getState()), style: readStyle(), theme: readTheme() });
    return;
  }
  if (Object.keys(pending).length || inFlight) return;
  if (mine.at && state.at <= mine.at) return;
  applying = true;
  try {
    const p = state.prefs;
    const teamChanged = (p.team?.join() ?? "") !== (mine.prefs.team?.join() ?? "");
    usePrefs.setState({ prefs: p, at: state.at, ...(teamChanged ? { teamVersion: mine.teamVersion + 1 } : {}) });
    if (p.office) useSettings.getState().applySynced(p.office);
    if (p.style && p.style !== readStyle()) applyStyle(p.style as StyleName);
    if (p.theme && p.theme !== readTheme()) applyTheme(p.theme as ThemeChoice);
  } finally {
    applying = false;
  }
  syncHead();
}

// ---- reading -------------------------------------------------------------------------------------------

/** The employees on this HQ's team, in office order. */
export const teamIds = (p: Prefs = usePrefs.getState().prefs): EmployeeId[] => TEAM.map((m) => m.id).filter((id) => !p.team || p.team.includes(id));
export const useTeamIds = (): EmployeeId[] => {
  const team = usePrefs((s) => s.prefs.team);
  return TEAM.map((m) => m.id).filter((id) => !team || team.includes(id));
};
export const isOnTeam = (id: EmployeeId): boolean => { const t = usePrefs.getState().prefs.team; return !t || t.includes(id); };

export const useHandle = (): string => usePrefs((s) => s.prefs.handle ?? s.baseHandle);
export const handleNow = (): string => { const s = usePrefs.getState(); return s.prefs.handle ?? s.baseHandle; };
export const useAppIcon = (): AppIcon => usePrefs((s) => s.prefs.icon ?? DEFAULT_ICON);

/** Point the tab title and the favicon / Home Screen icon at this HQ's name and icon. */
export function syncHead(): void {
  if (typeof document === "undefined") return;
  const s = usePrefs.getState();
  const name = appNameOf(s.prefs.handle ?? s.baseHandle);
  if (document.title !== name) document.title = name;
  const key = iconKey(s.prefs.icon ?? DEFAULT_ICON);
  const set = (rel: string, href: string, type?: string) => {
    let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-hq]`);
    if (!el) {
      document.head.querySelectorAll(`link[rel="${rel}"]`).forEach((n) => n.remove());
      el = document.createElement("link");
      el.rel = rel;
      el.dataset.hq = "";
      document.head.appendChild(el);
    }
    if (type) el.type = type;
    if (el.getAttribute("href") !== href) el.href = href;
  };
  set("icon", `/hq-icon/${key}/64`, "image/png");
  set("apple-touch-icon", `/hq-icon/${key}/180`);
}
usePrefs.subscribe(() => syncHead());
