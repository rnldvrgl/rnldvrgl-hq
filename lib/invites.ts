import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase/admin";
import { FOUNDER_HQ, hqForEmail } from "@/lib/hq";
import { TEAM } from "@/lib/team";
import { HQ } from "@/hq.config";

/**
 * Invite links: you make one (Settings → Friends), the friend opens /invite/<code>, gives their email, and gets
 * their own HQ. One use each, 7 days. HQ is invite-only: nobody gets an HQ any other way.
 */

export const newInviteCode = (): string => randomBytes(12).toString("base64url");

/** A plain email address (strict: it goes into a query filter, so no commas, quotes or brackets). */
export const isEmail = (e: string): boolean => /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(e) && e.length <= 254;

export type InviteCheck =
  | { ok: true; code: string; email: string | null; from: string }
  | { ok: false; why: "missing" | "used" | "expired" };

/** Is this invite usable? With who it's from, for the invite page. */
export async function checkInvite(code: string): Promise<InviteCheck> {
  const { data } = await db().from("hq_invites").select("code, hq_id, email, expires_at, used_at").eq("code", code).maybeSingle();
  if (!data) return { ok: false, why: "missing" };
  if (data.used_at) return { ok: false, why: "used" };
  if (new Date(data.expires_at) < new Date()) return { ok: false, why: "expired" };
  let from = "A friend";
  if (data.hq_id === FOUNDER_HQ) {
    const { data: n } = await db().from("office_names").select("name").eq("hq_id", FOUNDER_HQ).eq("id", "owner").maybeSingle();
    from = n?.name ?? HQ.owner.name;
  } else {
    const { data: hq } = await db().from("hqs").select("name, owner_email").eq("id", data.hq_id).maybeSingle();
    from = hq?.name || hq?.owner_email || from;
  }
  return { ok: true, code: data.code, email: data.email, from };
}

/** The sign-in account for an email (sign-ups are closed to the public, so the server makes it). */
async function ensureUser(email: string): Promise<void> {
  const { error } = await db().auth.admin.createUser({ email, email_confirm: true });
  if (error && !/already|registered|exists/i.test(error.message)) throw new Error(error.message);
}

/** What the public endpoint says on any failure: no details about which invites or emails exist. */
export const INVITE_FAILED = "This invite can't be used. Ask your friend for a new one.";

/**
 * Use an invite. Someone whose email already has an HQ gets the same answer as a new one (and the invite
 * stays unused), so the endpoint doesn't reveal who has an HQ. Otherwise: claim the invite (one atomic,
 * conditional update), make the HQ and its desks in one transaction, then the sign-in account. If making
 * the HQ fails the invite is released again.
 */
export async function acceptInvite(code: string, emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (!isEmail(email)) throw new Error("That doesn't look like an email address.");

  if (await hqForEmail(email)) { await ensureUser(email); return; }

  const now = new Date().toISOString();
  const { data: claimed } = await db().from("hq_invites").update({ used_at: now })
    .eq("code", code).is("used_at", null).gt("expires_at", now).or(`email.is.null,email.eq.${email}`)
    .select("hq_id");
  const invite = claimed?.[0];
  if (!invite) throw new Error(INVITE_FAILED);

  const { data: hqIdValue, error } = await db().rpc("create_friend_hq", { p_email: email, p_invited_by: invite.hq_id, p_desks: TEAM.map((m) => m.id) });
  if (error || !hqIdValue) {
    await db().from("hq_invites").update({ used_at: null }).eq("code", code);
    console.warn("[invites] create_friend_hq failed:", error?.message);
    throw new Error(INVITE_FAILED);
  }
  await db().from("hq_invites").update({ used_by: hqIdValue }).eq("code", code);
  await ensureUser(email);
}
