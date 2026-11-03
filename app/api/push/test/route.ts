import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/auth";
import { pushConfigured, pushToOwner } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Sends a test notification to every subscribed device. */
export async function POST() {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  if (!pushConfigured()) return NextResponse.json({ error: "Push isn't set up on the server yet (VAPID keys missing)." }, { status: 503 });
  const sent = await pushToOwner({ title: "rnldvrgl HQ", body: "Notifications are working. You'll hear from the team here.", url: "/", tag: "test" });
  if (!sent) return NextResponse.json({ error: "No device accepted it. Try turning notifications off and on again." }, { status: 404 });
  return NextResponse.json({ ok: true, sent });
}
