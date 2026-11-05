import { hqId } from "@/lib/hq-context";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hqRoute } from "@/lib/hq";
import { db } from "@/lib/supabase/admin";
import { manilaParts } from "@/lib/time";
import { JOB_STATUSES, type TablesUpdate } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const Patch = z.object({ status: z.enum(JOB_STATUSES) });

export const PATCH = hqRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = Patch.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pick a valid status." }, { status: 400 });

  const update: TablesUpdate<"jobs"> = { status: body.data.status };
  if (body.data.status === "applied") update.date_applied = manilaParts(new Date()).isoDate;
  const { error } = await db().from("jobs").update(update).eq("id", id).eq("hq_id", hqId());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
