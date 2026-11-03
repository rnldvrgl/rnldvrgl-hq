import { MANILA_OFFSET_MS } from "@/lib/time";
import { TEAM, type EmployeeId } from "@/lib/team";

/**
 * Office life in Manila time: the light of day, when idle employees go home, the janitor's rounds
 * and the 5:40 PM trash run. Everything here is a pure function of the clock, so every device
 * shows the same scene at the same moment.
 */

export type Phase = "morning" | "lunch" | "afternoon" | "night";

/** Minutes since Manila midnight, with seconds as a fraction. */
export function manilaMinutes(d: Date): number {
  const ms = (d.getTime() + MANILA_OFFSET_MS) % 86_400_000;
  return ms / 60_000;
}

/** "HH:MM" → minutes since midnight. */
export const hm = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const PHASES: readonly { id: Phase; label: string; from: string; to: string }[] = [
  { id: "morning", label: "Morning", from: "06:00", to: "11:30" },
  { id: "lunch", label: "Lunch", from: "11:30", to: "13:00" },
  { id: "afternoon", label: "Afternoon", from: "13:00", to: "18:00" },
  { id: "night", label: "Night", from: "18:00", to: "06:00" },
];

export function phaseAt(min: number): Phase {
  if (min >= hm("06:00") && min < hm("11:30")) return "morning";
  if (min >= hm("11:30") && min < hm("13:00")) return "lunch";
  if (min >= hm("13:00") && min < hm("18:00")) return "afternoon";
  return "night";
}

/** Idle employees leave at 7 PM and are back at their desks at 7 AM. Anyone with work to show stays. */
export const HOME_FROM = hm("19:00");
export const BACK_AT = hm("07:00");
export const isAfterHours = (min: number): boolean => min >= HOME_FROM || min < BACK_AT;

/** The janitor mops during these windows, [start, end) in minutes. */
export const JANITOR_ROUNDS: readonly (readonly [number, number])[] = [
  [hm("07:00"), hm("08:00")],
  [hm("12:00"), hm("13:00")],
  [hm("18:00"), hm("19:00")],
];

/** 5:30 PM: everyone empties their desk bin into the main bin by the entrance. */
export const TRASH_DROP_AT = hm("17:30");
/** 5:40 PM: today's trash-duty employee takes the main bin's bag out to the dumpster. */
export const TRASH_AT = hm("17:40");

/** Weekday stand-up in the front zone (Ronald leads; Maya's morning brief is on screen). */
export const STANDUP_FROM = hm("09:00");
export const STANDUP_TO = hm("09:06");
/** Weekday team sync in the glass meeting room, for anyone who isn't busy. */
export const MEETING_FROM = hm("14:00");
export const MEETING_TO = hm("14:15");
/** Lunch at the dining table for anyone who isn't busy. */
export const LUNCH_FROM = hm("12:00");
export const LUNCH_TO = hm("12:55");

/** Afternoon vape break on the patio outside, for anyone who isn't busy. */
export const VAPE_FROM = hm("16:00");
export const VAPE_TO = hm("16:30");

/** Manila weekday 0 (Sun)–6 (Sat). */
export const manilaWeekday = (d: Date): number => new Date(d.getTime() + MANILA_OFFSET_MS).getUTCDay();
export const isWeekday = (d: Date): boolean => { const w = manilaWeekday(d); return w >= 1 && w <= 5; };

/** Days since 1970-01-01 in Manila: the rotation counter. */
export const manilaDay = (d: Date): number => Math.floor((d.getTime() + MANILA_OFFSET_MS) / 86_400_000);

/**
 * Who takes the trash out on the given day: the team takes turns in desk order, one per day.
 * A paused employee's turn passes to the next one.
 */
export function trashDuty(d: Date, isEnabled: (id: EmployeeId) => boolean): EmployeeId | null {
  const start = manilaDay(d) % TEAM.length;
  for (let i = 0; i < TEAM.length; i++) {
    const m = TEAM[(start + i) % TEAM.length];
    if (isEnabled(m.id)) return m.id;
  }
  return null;
}

/** Points in time the scene can jump to, to preview each part of the day. */
export const PREVIEWS: readonly { id: string; label: string; at: string }[] = [
  { id: "janitor-am", label: "7:15 AM · Janitor mops", at: "07:15" },
  { id: "morning", label: "8:15 AM · Morning", at: "08:15" },
  { id: "standup", label: "9:00 AM · Stand-up", at: "09:00" },
  { id: "boss", label: "10:30 AM · Ronald walks around", at: "10:30" },
  { id: "lunch", label: "12:00 PM · Lunch break", at: "12:00" },
  { id: "meeting", label: "2:00 PM · Team sync (meeting room)", at: "14:00" },
  { id: "afternoon", label: "3:30 PM · Afternoon", at: "15:30" },
  { id: "trash-drop", label: "5:30 PM · Everyone bins their trash", at: "17:30" },
  { id: "trash", label: "5:40 PM · Trash goes out", at: "17:40" },
  { id: "night", label: "9:00 PM · Night", at: "21:00" },
];
