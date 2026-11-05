import "server-only";
import { hqId } from "@/lib/hq-context";
import { ask } from "@/lib/ai";
import { db } from "@/lib/supabase/admin";
import { listEvents, countMail } from "@/lib/google";
import { emailMe } from "@/lib/email";
import { manilaParts, manilaInstant, formatManila } from "@/lib/time";
import type { WorkResult } from "./types";
import { ownerName, ownersName } from "@/lib/names";

function eventTime(e: { start: { dateTime?: string; date?: string } }) {
  return e.start.dateTime ? formatManila(e.start.dateTime) : "All day";
}

export async function chiefOfStaff(): Promise<WorkResult> {
  const now = new Date();
  const p = manilaParts(now);
  const dayStart = manilaInstant(p.year, p.month, p.day, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 86400_000);

  const [events, unread, reminders, pipeline, interviews] = await Promise.all([
    listEvents(dayStart, dayEnd),
    countMail("is:unread category:primary"),
    db().from("reminders").select("title, due_at").eq("hq_id", hqId()).is("sent_at", null).gte("due_at", dayStart.toISOString()).lt("due_at", dayEnd.toISOString()).order("due_at"),
    db().from("jobs").select("status").eq("hq_id", hqId()),
    db().from("interviews").select("company, starts_at").eq("hq_id", hqId()).gte("starts_at", now.toISOString()).order("starts_at").limit(5),
  ]);

  const counts = (pipeline.data ?? []).reduce<Record<string, number>>((acc, j) => ({ ...acc, [j.status]: (acc[j.status] ?? 0) + 1 }), {});
  const facts = [
    `Date: ${p.isoDate} (Manila)`,
    `Calendar today: ${events.length ? events.map((e) => `${eventTime(e)} ${e.summary ?? "(no title)"}`).join("; ") : "nothing scheduled"}`,
    `Unread primary emails: ${unread}`,
    `Reminders today: ${(reminders.data ?? []).map((r) => `${formatManila(r.due_at)} ${r.title}`).join("; ") || "none"}`,
    `Job pipeline: saved ${counts.saved ?? 0}, applied ${counts.applied ?? 0}, interview ${counts.interview ?? 0}, offer ${counts.offer ?? 0}`,
    `Upcoming interviews: ${(interviews.data ?? []).map((i) => `${i.company} ${formatManila(i.starts_at)}`).join("; ") || "none"}`,
  ].join("\n");

  const brief = await ask({
    private: true,
    maxTokens: 700,
    system: "You are a calm, concise chief of staff. Plain text, no markdown headers, under 150 words.",
    prompt: `Write today's morning brief for ${ownerName()} from these facts. Start with the one thing that matters most today, then a short list of the rest. End with one suggested focus for the day.\n\n${facts}`,
  });

  await emailMe(`Morning brief · ${p.isoDate}`, brief);
  return { status: "done", summary: `Brief sent · ${events.length} events, ${unread} unread`, output: brief };
}
