import { NextResponse } from "next/server";
import { hqRoute } from "@/lib/hq";
import { savePrefs } from "@/lib/prefs-server";

export const dynamic = "force-dynamic";

/** Save part of this HQ's preferences: `{ patch: { handle?, icon?, team?, style?, theme?, office? } }` (null removes a field). */
export const POST = hqRoute(async (req: Request) => {
  const body: unknown = await req.json().catch(() => null);
  const patch = typeof body === "object" && body && "patch" in body && typeof body.patch === "object" && body.patch && !Array.isArray(body.patch)
    ? (body.patch as Record<string, unknown>) : null;
  if (!patch) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const allowed = ["handle", "icon", "team", "style", "theme", "office"];
  const bad = Object.keys(patch).find((k) => !allowed.includes(k));
  if (bad) return NextResponse.json({ error: `Unknown setting: ${bad}` }, { status: 400 });
  if (Array.isArray(patch.team) && patch.team.length === 0) return NextResponse.json({ error: "Keep at least one employee." }, { status: 400 });
  try {
    return NextResponse.json(await savePrefs(patch));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save the settings." }, { status: 500 });
  }
});
