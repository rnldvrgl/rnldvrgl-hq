import { HQ, possessive } from "@/hq.config";
import { TEAM, type EmployeeId } from "@/lib/team";

/**
 * What people are called: the boss and the eight employees. The defaults come from hq.config.ts; renames are
 * saved in the database (Settings → Names, table office_names) and applied everywhere: the 3D office, the
 * panels and the AI's briefs and emails. `applyNames` updates the shared TEAM entries in place and the boss's
 * name, so code reading `meta.name` or `ownerName()` sees the new names.
 */

export type NameKey = "owner" | EmployeeId;
export type Names = Partial<Record<NameKey, string>>;

/** The hq.config.ts names, before any rename. */
export const BASE_NAMES: Record<NameKey, string> = {
  owner: HQ.owner.name,
  ...(Object.fromEntries(TEAM.map((m) => [m.id, m.name])) as Record<EmployeeId, string>),
};
export const NAME_KEYS = Object.keys(BASE_NAMES) as NameKey[];
export const NAME_MAX = 24;

let owner: string = HQ.owner.name;
let applied = "";

/**
 * On the server, names come from the request's HQ (each HQ has its own), not from the shared module state:
 * names-server.ts registers this. In the browser it stays null and the applied names are used.
 */
let resolver: (() => Partial<Record<NameKey, string>> | null) | null = null;
export const registerNameResolver = (fn: typeof resolver): void => { resolver = fn; };

/** The boss's first name ("Ronald"), and with the possessive ("Ronald's"). */
export const ownerName = (): string => resolver?.()?.owner ?? owner;
export const ownersName = (): string => possessive(ownerName());
/** An employee's name now (the server: this HQ's). */
export const nameOf = (id: EmployeeId): string => resolver?.()?.[id] ?? TEAM.find((m) => m.id === id)!.name;

/** A usable name, or null: trimmed, 1–24 characters, letters, spaces, dots, hyphens and apostrophes. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s || s.length > NAME_MAX || !/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(s)) return null;
  return s;
}

/** Use these names (missing or invalid ones fall back to the defaults). True when anything changed. */
export function applyNames(n: Names | undefined | null): boolean {
  const next: Record<NameKey, string> = { ...BASE_NAMES };
  for (const k of NAME_KEYS) { const c = cleanName(n?.[k]); if (c) next[k] = c; }
  const key = JSON.stringify(next);
  if (key === applied) return false;
  applied = key;
  owner = next.owner;
  for (const m of TEAM) m.name = next[m.id];
  return true;
}

/** The names in use now. */
export const currentNames = (): Record<NameKey, string> => ({ owner, ...(Object.fromEntries(TEAM.map((m) => [m.id, m.name])) as Record<EmployeeId, string>) });
