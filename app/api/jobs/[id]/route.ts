import { NextResponse } from "next/server";
import { z } from "zod";
import { currentOwner } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { manilaParts } from "@/lib/time";

export const dynamic = "force-dynamic";

const Patch = z.object({ status: z.enum(["saved", "applied", "interview", "offer", "closed"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { id } = await params;
  const body = Patch.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pick a valid status." }, { status: 400 });

  const update: Record<string, unknown> = { status: body.data.status };
  if (body.data.status === "applied") update.date_applied = manilaParts(new Date()).isoDate;
  const { error } = await db().from("jobs").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
