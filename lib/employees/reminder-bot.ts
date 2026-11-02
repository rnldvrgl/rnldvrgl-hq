import "server-only";
import { db } from "@/lib/supabase/admin";
import { emailMe } from "@/lib/email";
import { formatManila, manilaParts } from "@/lib/time";
import type { WorkResult } from "./types";

export const NOTHING_DUE = "Nothing due";

function nextDue(due: Date, repeat: string): Date {
  const d = new Date(due);
  if (repeat === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCDate(d.getUTCDate() + 1);
  if (repeat === "weekdays") {
    while ([0, 6].includes(manilaParts(d).weekday)) d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

export async function reminderBot(): Promise<WorkResult> {
  const now = new Date();
  const { data: due, error } = await db()
    .from("reminders")
    .select("id, title, due_at, repeat")
    .is("sent_at", null)
    .lte("due_at", now.toISOString())
    .order("due_at");
  if (error) throw new Error(error.message);
  if (!due?.length) return { status: "done", summary: NOTHING_DUE, output: "No reminders due right now." };

  const sent: string[] = [];
  for (const r of due) {
    await emailMe(`⏰ ${r.title}`, `Reminder: ${r.title}\nDue ${formatManila(r.due_at)} (Manila)`);
    if (r.repeat) {
      let next = nextDue(new Date(r.due_at), r.repeat);
      while (next <= now) next = nextDue(next, r.repeat); // skip missed repeats
      await db().from("reminders").update({ due_at: next.toISOString() }).eq("id", r.id);
    } else {
      await db().from("reminders").update({ sent_at: now.toISOString() }).eq("id", r.id);
    }
    sent.push(`• ${r.title}`);
  }
  return { status: "done", summary: `Sent ${sent.length} reminder${sent.length === 1 ? "" : "s"}`, output: sent.join("\n") };
}
