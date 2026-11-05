import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/auth";
import { tick } from "@/lib/employees";
import { ensureDesks, hqById, inHq, listHqIds } from "@/lib/hq";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Every 5 minutes (Supabase pg_cron → here, with CRON_SECRET).
 *   no ?hq   fans out: calls itself once per HQ, all at once, so each HQ's work gets its own function and
 *            time limit (a slow run in one HQ never starves the others)
 *   ?hq=<id> does that one HQ's turn: the Reminder Bot, then at most one due employee
 */
async function handle(req: Request) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const one = url.searchParams.get("hq");

  if (one) {
    const hq = await hqById(one);
    if (!hq) return NextResponse.json({ error: "no such HQ" }, { status: 404 });
    await ensureDesks(hq.id);
    const ran = await inHq(hq, () => tick());
    return NextResponse.json({ ok: true, hq: one, ran });
  }

  const ids = await listHqIds();
  const results = await Promise.allSettled(ids.map(async (id) => {
    const res = await fetch(`${url.origin}/api/tick?hq=${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { authorization: req.headers.get("authorization") ?? "" },
      signal: AbortSignal.timeout(290_000),
    });
    const body = (await res.json().catch(() => null)) as { ran?: string[] } | null;
    return { id, ran: body?.ran ?? [], status: res.status };
  }));
  return NextResponse.json({
    ok: true,
    hqs: results.map((r, i) => (r.status === "fulfilled" ? r.value : { id: ids[i], error: String(r.reason) })),
  });
}

export const GET = handle;
export const POST = handle;
