import "server-only";
import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/admin";
import { env, HQ_KEYS, type HqKey } from "@/lib/env";
import { FOUNDER_HQ, inHq, type HqCtx } from "@/lib/hq-context";
import { seal, unseal } from "@/lib/secret-box";
import { TEAM } from "@/lib/team";

export { FOUNDER_HQ, hqCtx, hqId, inHq, type HqCtx } from "@/lib/hq-context";

/**
 * HQs: yours (the founder, owned by OWNER_EMAIL) and one per invited friend. Every request finds its HQ from
 * the signed-in email and runs inside it (see hq-context.ts), so queries and keys are always that HQ's.
 */

const founderEmail = () => env("OWNER_EMAIL").toLowerCase();

/** An HQ's decrypted secrets. Undecryptable ones (HQ_SECRET_KEY changed) are skipped. */
async function loadSecrets(id: string): Promise<Record<string, string>> {
  const { data, error } = await db().from("hq_secrets").select("key, value").eq("hq_id", id);
  if (error) return {}; // before the migration runs, the founder still works from the environment
  const out: Record<string, string> = {};
  for (const r of data ?? []) { const v = unseal(r.value); if (v !== null) out[r.key] = v; }
  return out;
}

async function ctxFor(id: string, email: string): Promise<HqCtx> {
  return { id, email, founder: id === FOUNDER_HQ, secrets: await loadSecrets(id) };
}

/** The HQ owned by this email, if any. */
export async function hqForEmail(email: string): Promise<HqCtx | null> {
  const e = email.toLowerCase();
  if (e === founderEmail()) return ctxFor(FOUNDER_HQ, e);
  const { data } = await db().from("hqs").select("id").eq("owner_email", e).maybeSingle();
  return data ? ctxFor(data.id, e) : null;
}

/** Your HQ (for things only you use, like the iPhone Reminders Shortcut). */
export const founderHq = (): Promise<HqCtx> => ctxFor(FOUNDER_HQ, founderEmail());

/** The signed-in visitor's HQ, or null (not signed in, or signed in without an HQ). */
export async function currentHq(): Promise<HqCtx | null> {
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  return email ? hqForEmail(email) : null;
}

/**
 * An API route that needs a signed-in HQ owner: 403 otherwise, and the handler runs inside that HQ.
 * `export const POST = hqRoute(async (req) => { … })`
 */
export function hqRoute<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const hq = await currentHq();
    if (!hq) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    return inHq(hq, () => handler(...args));
  };
}

/** Every HQ's id, the founder first (just yours before multi-hq.sql has run). */
export async function listHqIds(): Promise<string[]> {
  const { data, error } = await db().from("hqs").select("id");
  const ids = error || !data?.length ? [FOUNDER_HQ] : data.map((r) => r.id);
  return ids.sort((a, b) => (a === FOUNDER_HQ ? -1 : b === FOUNDER_HQ ? 1 : 0));
}

/** One HQ's context by id (for the tick), with its desks made sure of. Null if there's no such HQ. */
export async function hqById(id: string): Promise<HqCtx | null> {
  if (id === FOUNDER_HQ) return ctxFor(FOUNDER_HQ, founderEmail());
  const { data } = await db().from("hqs").select("id, owner_email").eq("id", id).maybeSingle();
  return data?.owner_email ? ctxFor(data.id, data.owner_email) : null;
}

/** Make sure the current HQ has a desk row for every team member (new employees added to TEAM later included). */
export async function ensureDesks(id: string): Promise<void> {
  await db().from("employees").upsert(TEAM.map((m) => ({ hq_id: id, id: m.id })), { onConflict: "hq_id,id", ignoreDuplicates: true });
}

/** Save (or with an empty value, remove) one of the current HQ's keys, encrypted. */
export async function setSecret(hqIdValue: string, key: HqKey, value: string): Promise<void> {
  if (!(HQ_KEYS as readonly string[]).includes(key)) throw new Error(`Unknown key ${key}`);
  const v = value.trim();
  if (!v) {
    const { error } = await db().from("hq_secrets").delete().eq("hq_id", hqIdValue).eq("key", key);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await db().from("hq_secrets").upsert({ hq_id: hqIdValue, key, value: seal(v), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
