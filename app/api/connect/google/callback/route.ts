import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { hqRoute, setSecret } from "@/lib/hq";
import { hqCtx } from "@/lib/hq-context";

export const dynamic = "force-dynamic";

/** Google sends you back here: swap the code for a refresh token and keep it (encrypted) for this HQ. */
export const GET = hqRoute(async (req: Request) => {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/?connections=${q}`, url.origin));
  const jar = await cookies();
  const state = jar.get("hq_google_state")?.value;
  jar.delete({ name: "hq_google_state", path: "/api/connect/google" });
  if (url.searchParams.get("error")) return back("google-cancelled");
  if (!state || state !== url.searchParams.get("state")) return back("google-failed");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: url.searchParams.get("code") ?? "",
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: `${url.origin}/api/connect/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json().catch(() => null)) as { refresh_token?: string } | null;
  if (!res.ok || !data?.refresh_token) return back("google-failed");
  try { await setSecret(hqCtx().id, "GOOGLE_REFRESH_TOKEN", data.refresh_token); } catch { return back("google-failed"); }
  return back("google-connected");
});
