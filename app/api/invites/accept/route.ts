import { NextResponse } from "next/server";
import { acceptInvite } from "@/lib/invites";

export const dynamic = "force-dynamic";

/** Public (the friend isn't signed in yet): `{ code, email }` → their HQ is made; they then sign in with an emailed code. */
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const code = typeof body === "object" && body && "code" in body && typeof body.code === "string" ? body.code : "";
  const email = typeof body === "object" && body && "email" in body && typeof body.email === "string" ? body.email : "";
  if (!code || !email) return NextResponse.json({ error: "Missing the invite code or your email." }, { status: 400 });
  try {
    const r = await acceptInvite(code, email);
    return NextResponse.json({ ok: true, existing: r.existing });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't use the invite." }, { status: 400 });
  }
}
