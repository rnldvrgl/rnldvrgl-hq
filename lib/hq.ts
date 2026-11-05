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

/** Run `fn` inside every HQ in turn (the 5-minute tick), the founder first. One HQ failing doesn't stop the rest. */
export async function forEachHq(fn: (hq: HqCtx) => Promise<void>): Promise<void> {
  const { data, error } = await db().from("hqs").select("id, owner_email");
  const list = error || !data?.length ? [{ id: FOUNDER_HQ, owner_email: null }] : data;
  list.sort((a, b) => (a.id === FOUNDER_HQ ? -1 : b.id === FOUNDER_HQ ? 1 : 0));
  for (const row of list) {
    try {
      const ctx = await ctxFor(row.id, row.owner_email ?? founderEmail());
      await inHq(ctx, () => fn(ctx));
    } catch (e) {
      console.warn(`[hq] ${row.id} failed:`, e instanceof Error ? e.message : e);
    }
  }
}

/** A new HQ for a friend who used an invite: the HQ row and its eight (empty) desks. */
export async function createHq(email: string, invitedBy: string): Promise<string> {
  const { data, error } = await db().from("hqs").insert({ owner_email: email.toLowerCase(), invited_by: invitedBy }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await db().from("employees").insert(TEAM.map((m) => ({ hq_id: data.id, id: m.id })));
  if (e2) throw new Error(e2.message);
  return data.id;
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
