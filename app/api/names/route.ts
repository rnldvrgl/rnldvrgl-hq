import { NextResponse } from "next/server";
import { hqRoute } from "@/lib/hq";
import { BASE_NAMES, cleanName, NAME_KEYS } from "@/lib/names";
import { saveNames } from "@/lib/names-server";

export const dynamic = "force-dynamic";

/** Save renames of the boss and the employees: `{ names: { owner?: string, "<employee id>"?: string } }`. Blank = back to the default. */
export const POST = hqRoute(async (req: Request) => {
  const body: unknown = await req.json().catch(() => null);
  const names = typeof body === "object" && body && "names" in body && typeof body.names === "object" && body.names ? (body.names as Record<string, unknown>) : null;
  if (!names) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  for (const k of Object.keys(names)) {
    if (!(NAME_KEYS as string[]).includes(k)) return NextResponse.json({ error: `Unknown person: ${k}` }, { status: 400 });
    const v = names[k];
    if (typeof v === "string" && v.trim() && !cleanName(v)) return NextResponse.json({ error: `"${v}" isn't a usable name (letters, up to 24).` }, { status: 400 });
  }
  try {
    await saveNames(names, BASE_NAMES);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save the names." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
});
