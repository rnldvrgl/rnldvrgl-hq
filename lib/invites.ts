import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase/admin";
import { createHq, hqForEmail } from "@/lib/hq";

/**
 * Invite links: an HQ owner makes one (Settings → Friends), the friend opens /invite/<code>, gives their email,
 * and gets their own HQ. One use each, 7 days. HQ is invite-only: nobody gets an HQ any other way.
 */

export const newInviteCode = (): string => randomBytes(12).toString("base64url");

export type InviteCheck =
  | { ok: true; code: string; email: string | null; from: string }
  | { ok: false; why: "missing" | "used" | "expired" };

/** Is this invite usable? With who it's from (their HQ's name or email) for the invite page. */
export async function checkInvite(code: string): Promise<InviteCheck> {
  const { data } = await db().from("hq_invites").select("code, hq_id, email, expires_at, used_at").eq("code", code).maybeSingle();
  if (!data) return { ok: false, why: "missing" };
  if (data.used_at) return { ok: false, why: "used" };
  if (new Date(data.expires_at) < new Date()) return { ok: false, why: "expired" };
  const { data: hq } = await db().from("hqs").select("name, owner_email").eq("id", data.hq_id).maybeSingle();
  return { ok: true, code: data.code, email: data.email, from: hq?.name || hq?.owner_email || "a friend" };
}

/**
 * Use an invite: makes the friend's sign-in account (if new) and their HQ, and marks the invite used.
 * Returns the HQ id. Someone who already has an HQ just keeps it (the invite stays unused).
 */
export async function acceptInvite(code: string, emailRaw: string): Promise<{ hqId: string; existing: boolean }> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That doesn't look like an email address.");
  const inv = await checkInvite(code);
  if (!inv.ok) throw new Error(inv.why === "used" ? "This invite was already used." : inv.why === "expired" ? "This invite has expired. Ask for a new one." : "This invite link doesn't exist.");
  if (inv.email && inv.email !== email) throw new Error("This invite is for a different email address.");

  const have = await hqForEmail(email);
  if (have) return { hqId: have.id, existing: true };

  // the sign-in account: sign-ups are closed to the public, so the server makes it
  const { error: userErr } = await db().auth.admin.createUser({ email, email_confirm: true });
  if (userErr && !/already|registered|exists/i.test(userErr.message)) throw new Error(userErr.message);

  const { data: invite } = await db().from("hq_invites").select("hq_id").eq("code", code).single();
  // claim the invite first so two tabs can't both use it
  const { data: claimed } = await db().from("hq_invites").update({ used_at: new Date().toISOString() }).eq("code", code).is("used_at", null).select("code");
  if (!claimed?.length) throw new Error("This invite was already used.");
  const hqId = await createHq(email, invite!.hq_id);
  await db().from("hq_invites").update({ used_by: hqId }).eq("code", code);
  return { hqId, existing: false };
}
