import { hqId } from "@/lib/hq-context";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { hqRoute } from "@/lib/hq";
import { db } from "@/lib/supabase/admin";
import { isEmployeeId } from "@/lib/team";
import { runEmployee } from "@/lib/employees";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** "Run now": answers immediately, then does the work after the response so the desk can show "working". */
export const POST = hqRoute(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!isEmployeeId(id)) return NextResponse.json({ error: "No such employee." }, { status: 404 });
  after(() => runEmployee(id, "manual"));
  return NextResponse.json({ ok: true });
});

const Patch = z.object({
  enabled: z.boolean().optional(),
  acknowledge: z.literal(true).optional(),
});

/** Pause/resume an employee, or clear the amber "needs you" lamp after you've read the report. */
export const PATCH = hqRoute(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!isEmployeeId(id)) return NextResponse.json({ error: "No such employee." }, { status: 404 });
  const body = Patch.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Send { enabled } or { acknowledge: true }." }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = body.data.acknowledge
    ? await db().from("employees").update({ status: "idle", updated_at: now }).eq("id", id).eq("hq_id", hqId()).in("status", ["needs_you", "error"])
    : await db().from("employees").update({ enabled: body.data.enabled, updated_at: now }).eq("id", id).eq("hq_id", hqId());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
