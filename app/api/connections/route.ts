import { NextResponse } from "next/server";
import { hqRoute, setSecret } from "@/lib/hq";
import { hqCtx } from "@/lib/hq-context";
import { optionalHqEnv, type HqKey } from "@/lib/env";
import { have, hint } from "@/lib/connections";

export const dynamic = "force-dynamic";

/** Keys you can paste in Settings → Connections (Google connects through its own sign-in instead). */
const PASTE: readonly HqKey[] = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "GITHUB_TOKEN", "GITHUB_USERNAME"];

/** What this HQ has connected. Never returns the keys themselves, only their last 4 characters. */
export const GET = hqRoute(async () => {
  const c = hqCtx();
  const keys = Object.fromEntries(PASTE.map((k) => [k, k === "GITHUB_USERNAME" ? optionalHqEnv(k) ?? null : hint(optionalHqEnv(k))]));
  return NextResponse.json({
    founder: c.founder,
    email: c.email,
    have: have(),
    keys,
    google: { connected: !!optionalHqEnv("GOOGLE_REFRESH_TOKEN"), available: !!process.env.GOOGLE_CLIENT_ID },
    // keys can only be saved once the app has its encryption key
    canSave: !!process.env.HQ_SECRET_KEY,
  });
});

/** Save or clear one key: `{ key, value }` (an empty value removes it). Google: `{ key: "GOOGLE_REFRESH_TOKEN", value: "" }` disconnects. */
export const POST = hqRoute(async (req: Request) => {
  const body: unknown = await req.json().catch(() => null);
  const key = typeof body === "object" && body && "key" in body ? String(body.key) : "";
  const value = typeof body === "object" && body && "value" in body ? String(body.value ?? "") : "";
  if (![...PASTE, "GOOGLE_REFRESH_TOKEN"].includes(key)) return NextResponse.json({ error: "Unknown key." }, { status: 400 });
  if (key === "GOOGLE_REFRESH_TOKEN" && value) return NextResponse.json({ error: "Connect Google with its sign-in button." }, { status: 400 });
  if (value.length > 400) return NextResponse.json({ error: "That's too long for a key." }, { status: 400 });
  if (!process.env.HQ_SECRET_KEY) return NextResponse.json({ error: "Add HQ_SECRET_KEY to the app's environment first (see README → Friends)." }, { status: 500 });
  try {
    await setSecret(hqCtx().id, key as HqKey, value);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save it." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
});
