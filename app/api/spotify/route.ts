import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Spotify, connected once for every device. The owner's refresh token lives in Supabase (table spotify_auth,
 * server-only); each browser asks here for a short-lived access token instead of keeping its own sign-in.
 *
 *   GET     { connected: false } or { connected: true, access, expiresAt }, refreshed a minute before expiry
 *   POST    { code, verifier, redirectUri }: finish a sign-in (PKCE) and save it for all devices
 *           { refresh }: adopt a refresh token a browser saved before tokens were shared
 *   DELETE  disconnect Spotify everywhere
 *
 * The app is a PKCE public client, so no client secret is needed for the code exchange or refreshes.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const ROW = 1;

type Saved = { refresh_token: string; access_token: string | null; expires_at: string | null };
type Fresh = { access: string; refresh: string; expiresAt: number };

async function spotifyToken(body: Record<string, string>): Promise<Fresh> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    const err = new Error(data.error_description ?? `Spotify sign-in failed (${res.status}).`);
    (err as Error & { revoked?: boolean }).revoked = data.error === "invalid_grant";
    throw err;
  }
  return {
    access: data.access_token,
    // a refresh doesn't always rotate the refresh token: keep the old one then
    refresh: data.refresh_token ?? body.refresh_token ?? "",
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

async function save(t: Fresh): Promise<void> {
  const { error } = await db().from("spotify_auth").upsert({
    id: ROW, refresh_token: t.refresh, access_token: t.access,
    expires_at: new Date(t.expiresAt).toISOString(), updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(tableHint(error.message));
}

const tableHint = (msg: string) =>
  /spotify_auth/.test(msg) && /exist|schema cache/i.test(msg)
    ? "Run the spotify_auth block of supabase/schema.sql in Supabase → SQL Editor first."
    : msg;

const fail = (e: unknown, status = 500) => NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });

export async function GET() {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  if (!CLIENT_ID) return NextResponse.json({ connected: false });

  const { data, error } = await db().from("spotify_auth").select("refresh_token, access_token, expires_at").eq("id", ROW).maybeSingle<Saved>();
  if (error) return fail(new Error(tableHint(error.message)));
  if (!data) return NextResponse.json({ connected: false });

  const expiresAt = data.expires_at ? Date.parse(data.expires_at) : 0;
  if (data.access_token && Date.now() < expiresAt - 60_000) {
    return NextResponse.json({ connected: true, access: data.access_token, expiresAt });
  }

  try {
    const fresh = await spotifyToken({ grant_type: "refresh_token", refresh_token: data.refresh_token });
    // two devices can refresh at the same moment: only the first one's tokens are saved (the row still holds
    // the refresh token it started from), the other uses its own fresh access token without overwriting
    const { error: upErr } = await db().from("spotify_auth")
      .update({ refresh_token: fresh.refresh, access_token: fresh.access, expires_at: new Date(fresh.expiresAt).toISOString(), updated_at: new Date().toISOString() })
      .eq("id", ROW).eq("refresh_token", data.refresh_token);
    if (upErr) return fail(new Error(tableHint(upErr.message)));
    return NextResponse.json({ connected: true, access: fresh.access, expiresAt: fresh.expiresAt });
  } catch (e) {
    // the owner removed HQ from their Spotify account (or the token was revoked): forget it
    if ((e as { revoked?: boolean }).revoked) {
      await db().from("spotify_auth").delete().eq("id", ROW);
      return NextResponse.json({ connected: false, error: "Spotify access was removed. Connect again." });
    }
    return fail(e, 502);
  }
}

export async function POST(req: Request) {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  if (!CLIENT_ID) return fail(new Error("NEXT_PUBLIC_SPOTIFY_CLIENT_ID isn't set."), 400);
  const body = (await req.json().catch(() => ({}))) as { code?: string; verifier?: string; redirectUri?: string; refresh?: string };

  try {
    let fresh: Fresh;
    if (body.code && body.verifier && body.redirectUri) {
      // only our own callback page may be the redirect (Spotify checks it too, against the app's allow-list)
      const origin = new URL(req.url).origin;
      if (new URL(body.redirectUri).origin !== origin) return fail(new Error("Wrong redirect address."), 400);
      fresh = await spotifyToken({ grant_type: "authorization_code", code: body.code, redirect_uri: body.redirectUri, code_verifier: body.verifier });
    } else if (body.refresh) {
      fresh = await spotifyToken({ grant_type: "refresh_token", refresh_token: body.refresh });
    } else {
      return fail(new Error("Send a sign-in code or a refresh token."), 400);
    }
    await save(fresh);
    return NextResponse.json({ connected: true, access: fresh.access, expiresAt: fresh.expiresAt });
  } catch (e) {
    return fail(e, 502);
  }
}

export async function DELETE() {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { error } = await db().from("spotify_auth").delete().eq("id", ROW);
  if (error) return fail(new Error(tableHint(error.message)));
  return NextResponse.json({ connected: false });
}
