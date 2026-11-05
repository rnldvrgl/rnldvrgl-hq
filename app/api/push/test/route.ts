import { NextResponse } from "next/server";
import { hqRoute } from "@/lib/hq";
import { pushConfigured, pushToOwner } from "@/lib/push";
import { HQ } from "@/hq.config";

export const dynamic = "force-dynamic";

/** Sends a test notification to every subscribed device. */
export const POST = hqRoute(async () => {
  if (!pushConfigured()) return NextResponse.json({ error: "Push isn't set up on the server yet (VAPID keys missing)." }, { status: 503 });
  const sent = await pushToOwner({ title: HQ.appName, body: "Notifications are working. You'll hear from the team here.", url: "/", tag: "test" });
  if (!sent) return NextResponse.json({ error: "No device accepted it. Try turning notifications off and on again." }, { status: 404 });
  return NextResponse.json({ ok: true, sent });
});
