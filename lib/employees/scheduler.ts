import "server-only";
import { listEvents, type CalEvent } from "@/lib/google";
import { emailMe } from "@/lib/email";
import { manilaParts, manilaInstant, formatManila } from "@/lib/time";
import type { WorkResult } from "./types";

const WORK_START = "09:00";
const WORK_END = "18:00";

function span(e: CalEvent): [Date, Date] | null {
  if (!e.start.dateTime || !e.end.dateTime) return null; // all-day events don't block slots
  return [new Date(e.start.dateTime), new Date(e.end.dateTime)];
}

/** Previews tomorrow: clashes and free blocks of 30+ minutes inside working hours. */
export async function scheduler(): Promise<WorkResult> {
  const t = new Date(Date.now() + 86400_000);
  const p = manilaParts(t);
  const dayStart = manilaInstant(p.year, p.month, p.day, "00:00");
  const workStart = manilaInstant(p.year, p.month, p.day, WORK_START);
  const workEnd = manilaInstant(p.year, p.month, p.day, WORK_END);
  const events = await listEvents(dayStart, new Date(dayStart.getTime() + 86400_000));

  const timed = events.map((e) => ({ e, s: span(e) })).filter((x): x is { e: CalEvent; s: [Date, Date] } => !!x.s)
    .sort((a, b) => a.s[0].getTime() - b.s[0].getTime());

  const clashes: string[] = [];
  for (let i = 1; i < timed.length; i++) {
    const prev = timed[i - 1], cur = timed[i];
    if (cur.s[0] < prev.s[1]) clashes.push(`${prev.e.summary ?? "Event"} overlaps ${cur.e.summary ?? "Event"}`);
  }

  const free: string[] = [];
  let cursor = workStart;
  for (const { s: [start, end] } of timed) {
    if (start > cursor && start.getTime() - cursor.getTime() >= 30 * 60_000 && cursor < workEnd) {
      free.push(`${formatManila(cursor.toISOString())} – ${formatManila(new Date(Math.min(start.getTime(), workEnd.getTime())).toISOString())}`);
    }
    if (end > cursor) cursor = end;
  }
  if (workEnd.getTime() - cursor.getTime() >= 30 * 60_000) {
    free.push(`${formatManila(cursor.toISOString())} – ${formatManila(workEnd.toISOString())}`);
  }

  const output = [
    `Tomorrow (${p.isoDate}): ${events.length} event${events.length === 1 ? "" : "s"}`,
    ...events.map((e) => `• ${e.start.dateTime ? formatManila(e.start.dateTime) : "All day"} — ${e.summary ?? "(no title)"}`),
    "",
    clashes.length ? `Clashes:\n${clashes.map((c) => `• ${c}`).join("\n")}` : "No clashes.",
    "",
    free.length ? `Free blocks (9 AM–6 PM):\n${free.map((f) => `• ${f}`).join("\n")}` : "No free 30-minute blocks during working hours.",
  ].join("\n");

  if (clashes.length) await emailMe(`Scheduler: ${clashes.length} clash${clashes.length === 1 ? "" : "es"} tomorrow`, output);
  return {
    status: clashes.length ? "needs_you" : "done",
    summary: clashes.length ? `${clashes.length} clash tomorrow` : `${events.length} events tomorrow, ${free.length} free blocks`,
    output,
  };
}
