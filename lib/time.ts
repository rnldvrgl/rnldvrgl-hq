/** Manila is UTC+8 all year (no daylight saving), so plain offset math is safe. */
export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export type Schedule =
  | { kind: "always" }
  | { kind: "manual" }
  | { kind: "times"; days: number[]; times: string[] }; // days: 0=Sun..6=Sat (Manila), times "HH:MM" Manila

/** Manila calendar parts for an instant. */
export function manilaParts(d: Date) {
  const m = new Date(d.getTime() + MANILA_OFFSET_MS);
  return {
    year: m.getUTCFullYear(),
    month: m.getUTCMonth(),
    day: m.getUTCDate(),
    weekday: m.getUTCDay(),
    hour: m.getUTCHours(),
    minute: m.getUTCMinutes(),
    isoDate: m.toISOString().slice(0, 10),
  };
}

/** The UTC instant of HH:MM Manila on the given Manila date. */
export function manilaInstant(year: number, month: number, day: number, hhmm: string): Date {
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(year, month, day, h, min) - MANILA_OFFSET_MS);
}

/**
 * The most recent scheduled slot that has passed today and has not run yet, or null.
 * Slots older than `graceHours` are skipped so a late tick never fires a stale morning brief at night.
 */
export function dueSlot(schedule: Schedule, lastRunAt: Date | null, now = new Date(), graceHours = 3): Date | null {
  if (schedule.kind === "always") return now;
  if (schedule.kind === "manual") return null;
  const p = manilaParts(now);
  if (!schedule.days.includes(p.weekday)) return null;
  const passed = schedule.times
    .map((t) => manilaInstant(p.year, p.month, p.day, t))
    .filter((slot) => slot <= now && now.getTime() - slot.getTime() <= graceHours * 3600_000)
    .sort((a, b) => b.getTime() - a.getTime());
  const slot = passed[0];
  if (!slot) return null;
  if (lastRunAt && lastRunAt >= slot) return null;
  return slot;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeSchedule(s: Schedule): string {
  if (s.kind === "always") return "Checks every 5 minutes";
  if (s.kind === "manual") return "When you ask";
  const days =
    s.days.length === 7 ? "Daily" :
    s.days.join() === "1,2,3,4,5" ? "Weekdays" :
    s.days.map((d) => DAY_NAMES[d]).join(", ");
  return `${days} at ${s.times.join(", ")}`;
}

export function formatManila(iso: string | null | undefined): string {
  if (!iso) return "never";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}
