import { TEAM, type EmployeeId } from "@/lib/team";
import type { StyleName } from "@/hq.config";

/**
 * An HQ's preferences, saved in the database (table hq_prefs) so every device of that HQ's owner gets the
 * same office: its name, the app icon, which employees it has, the colour style, and the office settings
 * that aren't about the device (the boss, routine, hours, music). Per device (localStorage) stay only the
 * things that depend on the phone or computer: performance, what's drawn, and the volumes.
 *
 * Isomorphic: the server validates with it, the browser applies it.
 */

export const APP_GLYPHS = ["cube", "house", "rocket", "coffee", "heart", "star", "paw", "leaf", "bolt", "crown", "moon", "game"] as const;
export type AppGlyph = (typeof APP_GLYPHS)[number];
export const APP_COLORS = {
  navy: ["#1f3a52", "#2c5677"], rose: ["#9d3a5e", "#d06a8e"], sunset: ["#b9461f", "#e8843f"], forest: ["#1d5c40", "#3c8a5f"],
  violet: ["#4b3a9c", "#7a63d6"], graphite: ["#26272b", "#46484f"], sky: ["#1f6fb8", "#4fa6e8"], blush: ["#e7a3b8", "#f6d0dc"],
} as const satisfies Record<string, readonly [string, string]>;
export type AppColor = keyof typeof APP_COLORS;
export type AppIcon = { glyph: AppGlyph; color: AppColor };
export const DEFAULT_ICON: AppIcon = { glyph: "cube", color: "navy" };

export const HANDLE_MAX = 20;

export type Prefs = {
  /** The short name over "HQ" in the header and the tab ("rnldvrgl" → "rnldvrgl HQ"). */
  handle?: string;
  icon?: AppIcon;
  /** The employees this HQ has (desks, homes and runs). Missing = all of them. */
  team?: EmployeeId[];
  style?: StyleName;
  theme?: "light" | "dark" | "system";
  /** The synced part of lib/settings.ts (boss, routine, hours, music, musicStyle, chimes). Validated there. */
  office?: Record<string, unknown>;
};

/** Saved prefs plus when they were last saved (to tell a newer copy from another device). */
export type PrefsState = { prefs: Prefs; at: string | null };

const STYLE_IDS: readonly StyleName[] = ["ocean", "rose", "sunset", "forest", "lavender", "graphite"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** "rnldvrgl": letters, digits, dots, dashes and underscores, 1–20. */
export function cleanHandle(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, "");
  return s && s.length <= HANDLE_MAX && /^[\p{L}\p{N}._-]+$/u.test(s) ? s : null;
}

export function cleanIcon(v: unknown): AppIcon | null {
  if (!isObj(v)) return null;
  const glyph = APP_GLYPHS.find((g) => g === v.glyph);
  const color = (Object.keys(APP_COLORS) as AppColor[]).find((c) => c === v.color);
  return glyph && color ? { glyph, color } : null;
}

/** Only known fields with valid values; anything else is dropped. */
export function cleanPrefs(v: unknown): Prefs {
  if (!isObj(v)) return {};
  const out: Prefs = {};
  const handle = cleanHandle(v.handle);
  if (handle) out.handle = handle;
  const icon = cleanIcon(v.icon);
  if (icon) out.icon = icon;
  if (Array.isArray(v.team)) {
    const ids = TEAM.map((m) => m.id).filter((id) => (v.team as unknown[]).includes(id));
    out.team = ids;
  }
  if (STYLE_IDS.some((s) => s === v.style)) out.style = v.style as StyleName;
  if (v.theme === "light" || v.theme === "dark" || v.theme === "system") out.theme = v.theme;
  if (isObj(v.office) && JSON.stringify(v.office).length < 8000) out.office = v.office;
  return out;
}

/** Is this employee on this HQ's team? */
export const onTeam = (prefs: Prefs | undefined | null, id: EmployeeId): boolean => !prefs?.team || prefs.team.includes(id);

/** "rnldvrgl HQ" */
export const appNameOf = (handle: string): string => `${handle} HQ`;

/** The URL-safe key of an icon ("cube-navy"), for the icon routes. */
export const iconKey = (i: AppIcon): string => `${i.glyph}-${i.color}`;
export function iconFromKey(key: string): AppIcon | null {
  const [glyph, color] = key.split("-");
  return cleanIcon({ glyph, color });
}
