import { hqId } from "@/lib/hq-context";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hqRoute } from "@/lib/hq";
import { db } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** The shape of PushSubscription.toJSON() from the browser. */
const Subscription = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Saves (or refreshes) this device's push subscription. */
export const POST = hqRoute(async (req: Request) => {
  const body = Subscription.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "That isn't a push subscription." }, { status: 400 });
  const { error } = await db().from("push_subscriptions").upsert({
    hq_id: hqId(), endpoint: body.data.endpoint,
    p256dh: body.data.keys.p256dh,
    auth: body.data.keys.auth,
    user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

const Remove = z.object({ endpoint: z.string().url().max(1000) });

/** Forgets this device (after it unsubscribed). */
export const DELETE = hqRoute(async (req: Request) => {
  const body = Remove.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  const { error } = await db().from("push_subscriptions").delete().eq("endpoint", body.data.endpoint).eq("hq_id", hqId());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
