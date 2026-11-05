import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { hqRoute } from "@/lib/hq";
import { GOOGLE_SCOPES } from "@/lib/hiring";

export const dynamic = "force-dynamic";


/** Start connecting Google: off to Google's consent screen, back to /api/connect/google/callback. */
export const GET = hqRoute(async (req: Request) => {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) return NextResponse.json({ error: "The app has no Google client yet (GOOGLE_CLIENT_ID)." }, { status: 500 });
  const origin = new URL(req.url).origin;
  const state = randomBytes(16).toString("base64url");
  (await cookies()).set("hq_google_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/connect/google", maxAge: 600 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: id,
    redirect_uri: `${origin}/api/connect/google/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // always hand back a refresh token
    state,
  }).toString();
  return NextResponse.redirect(url);
});
