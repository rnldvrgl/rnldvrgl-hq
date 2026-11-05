import { currentProfile, profileFromInput, type Profile, type ProfileInput } from "@/lib/profile";
import { NextResponse } from "next/server";
import { hqRoute, setSecret } from "@/lib/hq";
import { hqCtx } from "@/lib/hq-context";
import { optionalHqEnv, type HqKey } from "@/lib/env";
import { have, hint } from "@/lib/connections";

export const dynamic = "force-dynamic";

/** Keys you can paste in Settings → Connections (Google connects through its own sign-in instead). */
const PASTE: readonly HqKey[] = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "GITHUB_TOKEN", "GITHUB_USERNAME", "BACKUP_ALLOW_PRIVATE"];

/** A saved profile back into the form's fields. */
function toInput(p: Profile): ProfileInput {
  return {
    name: p.name, roles: p.target.roles.join(", "), level: p.target.level, minSalary: p.target.min_salary_php_month, years: p.experience_years,
    skills: (Array.isArray(p.skills) ? p.skills : Object.values(p.skills).flat()).join(", "),
    projects: p.projects.map((x) => `${x.name}: ${x.stack.join(", ")}`).join("\n"), summary: p.summary ?? "",
  };
}

/** What this HQ has connected. Never returns the keys themselves, only their last 4 characters. */
export const GET = hqRoute(async () => {
  const c = hqCtx();
  const keys = Object.fromEntries(PASTE.map((k) => [k, k === "GITHUB_USERNAME" ? optionalHqEnv(k) ?? null : hint(optionalHqEnv(k))]));
  const profile = currentProfile();
  return NextResponse.json({
    founder: c.founder,
    email: c.email,
    have: have(),
    keys,
    allowPrivate: optionalHqEnv("BACKUP_ALLOW_PRIVATE") === "true",
    // yours comes from data/master-profile.json; a friend's is what they filled in
    profile: c.founder ? { fromFile: true, name: profile?.name ?? null } : profile ? { fromFile: false, ...toInput(profile) } : null,
    google: {
      connected: !!optionalHqEnv("GOOGLE_REFRESH_TOKEN"),
      // saved here (can disconnect) or from the app's environment (yours, change it there)
      source: c.secrets.GOOGLE_REFRESH_TOKEN ? "saved" : optionalHqEnv("GOOGLE_REFRESH_TOKEN") ? "env" : null,
      available: !!process.env.GOOGLE_CLIENT_ID,
    },
    // keys can only be saved once the app has its encryption key
    canSave: !!process.env.HQ_SECRET_KEY,
  });
});

/** Save or clear one key: `{ key, value }` (an empty value removes it). Google: `{ key: "GOOGLE_REFRESH_TOKEN", value: "" }` disconnects. */
export const POST = hqRoute(async (req: Request) => {
  const body: unknown = await req.json().catch(() => null);
  if (!process.env.HQ_SECRET_KEY) return NextResponse.json({ error: "Add HQ_SECRET_KEY to the app's environment first (see README → Friends)." }, { status: 500 });
  // About you: `{ profile: ProfileInput }` (friends only: yours is data/master-profile.json)
  if (typeof body === "object" && body && "profile" in body) {
    if (hqCtx().founder) return NextResponse.json({ error: "Your profile is data/master-profile.json." }, { status: 400 });
    const p = profileFromInput(body.profile as ProfileInput);
    if (!p.name || !p.target.roles.length) return NextResponse.json({ error: "Add at least your name and the roles you want." }, { status: 400 });
    await setSecret(hqCtx().id, "PROFILE", JSON.stringify(p));
    return NextResponse.json({ ok: true });
  }
  const key = typeof body === "object" && body && "key" in body ? String(body.key) : "";
  const value = typeof body === "object" && body && "value" in body ? String(body.value ?? "") : "";
  if (![...PASTE, "GOOGLE_REFRESH_TOKEN"].includes(key)) return NextResponse.json({ error: "Unknown key." }, { status: 400 });
  if (key === "GOOGLE_REFRESH_TOKEN" && value) return NextResponse.json({ error: "Connect Google with its sign-in button." }, { status: 400 });
  if (value.length > 400) return NextResponse.json({ error: "That's too long for a key." }, { status: 400 });
  if (key === "BACKUP_ALLOW_PRIVATE" && value && value !== "true") return NextResponse.json({ error: "Use true or empty." }, { status: 400 });
  try {
    await setSecret(hqCtx().id, key as HqKey, value);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save it." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
});
