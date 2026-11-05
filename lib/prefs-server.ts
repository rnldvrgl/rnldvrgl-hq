import "server-only";
import { db } from "@/lib/supabase/admin";
import { hqCtx, hqId } from "@/lib/hq-context";
import { cleanPrefs, type Prefs, type PrefsState } from "@/lib/prefs";
import type { Json } from "@/lib/supabase/database.types";

/** This HQ's saved preferences (table hq_prefs). Empty before multi-hq.sql has run, or when nothing's saved yet. */
export async function loadPrefs(): Promise<PrefsState> {
  const { data, error } = await db().from("hq_prefs").select("data, updated_at").eq("hq_id", hqId()).maybeSingle();
  if (error || !data) return { prefs: {}, at: null };
  return { prefs: cleanPrefs(data.data), at: data.updated_at };
}

/** Merge a change into this HQ's preferences (top-level fields replace; null removes one). */
export async function savePrefs(patch: Record<string, unknown>): Promise<PrefsState> {
  const { prefs } = await loadPrefs();
  const merged: Record<string, unknown> = { ...prefs };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete merged[k]; else merged[k] = v;
  }
  const clean = cleanPrefs(merged);
  const at = new Date().toISOString();
  const { error } = await db().from("hq_prefs").upsert({ hq_id: hqId(), data: clean as Json, updated_at: at });
  if (error) {
    throw new Error(error.message.includes("hq_prefs") ? "Run supabase/multi-hq.sql in Supabase first (it adds the hq_prefs table)." : error.message);
  }
  return { prefs: clean, at };
}

/** The default handle: yours from hq.config.ts; a friend's from their first name. */
export function defaultHandle(ownerFirstName: string, configHandle: string): string {
  if (hqCtx().founder) return configHandle;
  return ownerFirstName.toLowerCase().replace(/[^\p{L}\p{N}._-]+/gu, "") || "my";
}

export type { Prefs };
