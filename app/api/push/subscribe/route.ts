import { NextResponse } from "next/server";
import { z } from "zod";
import { currentOwner } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** The shape of PushSubscription.toJSON() from the browser. */
const Subscription = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Saves (or refreshes) this device's push subscription. */
export async function POST(req: Request) {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const body = Subscription.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "That isn't a push subscription." }, { status: 400 });
  const { error } = await db().from("push_subscriptions").upsert({
    endpoint: body.data.endpoint,
    p256dh: body.data.keys.p256dh,
    auth: body.data.keys.auth,
    user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const Remove = z.object({ endpoint: z.string().url().max(1000) });

/** Forgets this device (after it unsubscribed). */
export async function DELETE(req: Request) {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const body = Remove.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  const { error } = await db().from("push_subscriptions").delete().eq("endpoint", body.data.endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
