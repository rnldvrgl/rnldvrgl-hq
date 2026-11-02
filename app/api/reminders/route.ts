import { NextResponse } from "next/server";
import { z } from "zod";
import { currentOwner } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { MANILA_OFFSET_MS } from "@/lib/time";

export const dynamic = "force-dynamic";

const NewReminder = z.object({
  title: z.string().trim().min(1).max(200),
  /** "YYYY-MM-DDTHH:MM" as typed in a datetime-local input, read as Manila time. */
  local: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  repeat: z.enum(["daily", "weekdays", "weekly"]).nullable(),
});

export async function POST(req: Request) {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const body = NewReminder.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Add a title and a date and time." }, { status: 400 });
  const due = new Date(Date.parse(`${body.data.local}:00Z`) - MANILA_OFFSET_MS);
  const { error } = await db().from("reminders").insert({ title: body.data.title, due_at: due.toISOString(), repeat: body.data.repeat });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const { error } = await db().from("reminders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
