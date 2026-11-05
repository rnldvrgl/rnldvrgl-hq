import { hqId } from "@/lib/hq-context";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hqRoute } from "@/lib/hq";
import { db } from "@/lib/supabase/admin";
import { MANILA_OFFSET_MS } from "@/lib/time";
import { REMINDER_REPEATS } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const NewReminder = z.object({
  title: z.string().trim().min(1).max(200),
  /** "YYYY-MM-DDTHH:MM" as typed in a datetime-local input, read as Manila time. */
  local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  repeat: z.enum(REMINDER_REPEATS).nullable(),
});

export const POST = hqRoute(async (req: Request) => {
  const body = NewReminder.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Add a title and a date and time." }, { status: 400 });
  const due = new Date(Date.parse(`${body.data.local}:00Z`) - MANILA_OFFSET_MS);
  const { error } = await db().from("reminders").insert({ hq_id: hqId(), title: body.data.title, due_at: due.toISOString(), repeat: body.data.repeat });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

export const DELETE = hqRoute(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const { error } = await db().from("reminders").delete().eq("id", id).eq("hq_id", hqId());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
