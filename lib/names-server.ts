import "server-only";
import { hqId } from "@/lib/hq-context";
import { db } from "@/lib/supabase/admin";
import { BASE_NAMES, cleanName, NAME_KEYS, registerNameResolver, type Names } from "@/lib/names";
import { hqCtxOrNull } from "@/lib/hq-context";

/** The saved renames (table office_names). Empty if the table isn't there yet. */
export async function loadNames(): Promise<Names> {
  const { data, error } = await db().from("office_names").select("id, name").eq("hq_id", hqId());
  if (error) return {};
  const out: Names = {};
  for (const r of data ?? []) if ((NAME_KEYS as string[]).includes(r.id)) out[r.id as keyof Names] = r.name;
  return out;
}

// names on the server are per HQ: read from the request's HQ context
registerNameResolver(() => (hqCtxOrNull()?.names as Names | undefined) ?? null);

/** Load this HQ's names into its context before anything uses them (state, employee runs). */
export async function syncNames(): Promise<Names> {
  const names: Names = await loadNames().catch(() => ({}));
  const ctx = hqCtxOrNull();
  if (ctx) {
    const merged: Record<string, string> = { ...BASE_NAMES };
    for (const k of NAME_KEYS) { const c = cleanName(names[k]); if (c) merged[k] = c; }
    ctx.names = merged;
  }
  return names;
}

/** Save renames; a blank or default name clears the rename. */
export async function saveNames(input: Record<string, unknown>, defaults: Record<string, string>): Promise<void> {
  const keep: { id: string; name: string }[] = [], clear: string[] = [];
  for (const k of NAME_KEYS) {
    if (!(k in input)) continue;
    const c = cleanName(input[k]);
    if (!c || c === defaults[k]) clear.push(k); else keep.push({ id: k, name: c });
  }
  if (keep.length) {
    const { error } = await db().from("office_names").upsert(keep.map((r) => ({ ...r, hq_id: hqId(), updated_at: new Date().toISOString() })));
    if (error) throw new Error(error.message.includes("office_names") ? "Run the office_names SQL from supabase/schema.sql in Supabase first." : error.message);
  }
  if (clear.length) await db().from("office_names").delete().in("id", clear).eq("hq_id", hqId());
}
