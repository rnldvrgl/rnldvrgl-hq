import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/admin";
import { hqRoute } from "@/lib/hq";
import { hqId } from "@/lib/hq-context";
import { isEmail, newInviteCode } from "@/lib/invites";
import { hqCtx } from "@/lib/hq-context";

export const dynamic = "force-dynamic";

/** Your invites (open and used) and the friends who joined through them. */
export const GET = hqRoute(async () => {
  const [{ data: invites, error }, { data: friends }] = await Promise.all([
    db().from("hq_invites").select("code, email, created_at, expires_at, used_at, used_by").eq("hq_id", hqId()).order("created_at", { ascending: false }).limit(30),
    db().from("hqs").select("id, owner_email, name, created_at").eq("invited_by", hqId()).order("created_at"),
  ]);
  if (error) return NextResponse.json({ error: /hq_invites/.test(error.message) ? "Run supabase/multi-hq.sql in Supabase first." : error.message }, { status: 500 });
  return NextResponse.json({ invites: invites ?? [], friends: friends ?? [], canInvite: hqCtx().founder });
});

/** Make an invite link, optionally only for one email: `{ email?: string }`. */
export const POST = hqRoute(async (req: Request) => {
  const body: unknown = await req.json().catch(() => ({}));
  const raw = typeof body === "object" && body && "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!hqCtx().founder) return NextResponse.json({ error: "Only the founder HQ can invite people for now." }, { status: 403 });
  if (raw && !isEmail(raw)) return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  const code = newInviteCode();
  const { error } = await db().from("hq_invites").insert({ code, hq_id: hqId(), email: raw || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ code });
});

/** Cancel an unused invite: `?code=`. */
export const DELETE = hqRoute(async (req: Request) => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code." }, { status: 400 });
  const { error } = await db().from("hq_invites").delete().eq("code", code).eq("hq_id", hqId()).is("used_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
