import "server-only";
import { db } from "@/lib/supabase/admin";
import { applyNames, cleanName, NAME_KEYS, type Names } from "@/lib/names";

/** The saved renames (table office_names). Empty if the table isn't there yet. */
export async function loadNames(): Promise<Names> {
  const { data, error } = await db().from("office_names").select("id, name");
  if (error) return {};
  const out: Names = {};
  for (const r of data ?? []) if ((NAME_KEYS as string[]).includes(r.id)) out[r.id as keyof Names] = r.name;
  return out;
}

/** Load and apply the saved names before anything uses them (state, employee runs). */
export async function syncNames(): Promise<Names> {
  const names = await loadNames().catch(() => ({}));
  applyNames(names);
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
    const { error } = await db().from("office_names").upsert(keep.map((r) => ({ ...r, updated_at: new Date().toISOString() })));
    if (error) throw new Error(error.message.includes("office_names") ? "Run the office_names SQL from supabase/schema.sql in Supabase first." : error.message);
  }
  if (clear.length) await db().from("office_names").delete().in("id", clear);
}
