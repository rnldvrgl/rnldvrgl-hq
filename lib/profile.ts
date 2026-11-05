import "server-only";
import founderProfile from "@/data/master-profile.json";
import { optionalHqEnv } from "@/lib/env";
import { hqCtx } from "@/lib/hq-context";

/**
 * Whose CV the Job Hunter searches with and cover letters are written from: yours is data/master-profile.json;
 * a friend's is the "About you" they fill in (Settings → Connections), stored with their HQ's keys. A friend's
 * HQ never sees yours.
 */

export type Profile = {
  name: string;
  experience_years: number;
  target: { roles: string[]; level: string; min_salary_php_month: number };
  skills: Record<string, string[]> | string[];
  projects: { name: string; stack: string[]; url?: string; pitch?: string }[];
  summary?: string;
};

/** What a friend saves (Settings → Connections → About you). */
export type ProfileInput = {
  name: string; roles: string; level: string; minSalary: number; years: number; skills: string; projects: string; summary?: string;
};

const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 30);

export function profileFromInput(p: ProfileInput): Profile {
  return {
    name: p.name.trim().slice(0, 60),
    experience_years: Math.max(0, Math.min(50, Number(p.years) || 0)),
    target: { roles: list(p.roles).slice(0, 6), level: p.level.trim().slice(0, 30) || "mid-level", min_salary_php_month: Math.max(0, Math.round(Number(p.minSalary) || 0)) },
    skills: list(p.skills),
    projects: p.projects.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8).map((l) => {
      const [name, stack = ""] = l.split(":");
      return { name: name.trim().slice(0, 60), stack: list(stack).slice(0, 10) };
    }),
    summary: p.summary?.trim().slice(0, 600) || undefined,
  };
}

/** This HQ's profile, or null when a friend hasn't filled it in yet. */
export function currentProfile(): Profile | null {
  if (hqCtx().founder) return founderProfile as unknown as Profile;
  const raw = optionalHqEnv("PROFILE");
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Profile;
    return p?.name && p.target?.roles?.length ? p : null;
  } catch {
    return null;
  }
}

/** The profile or a clear error (for the desks that can't work without one). */
export function needProfile(): Profile {
  const p = currentProfile();
  if (!p) throw new Error("Fill in About you in Settings → Connections first.");
  return p;
}
