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

/** Every day at 5:40 PM, today's trash-duty employee collects every bin and takes it out. */
export const TRASH_AT = hm("17:40");

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
  { id: "morning", label: "9:00 AM · Morning", at: "09:00" },
  { id: "boss", label: "10:30 AM · Ronald walks around", at: "10:30" },
  { id: "lunch", label: "12:15 PM · Lunch", at: "12:15" },
  { id: "afternoon", label: "3:30 PM · Afternoon", at: "15:30" },
  { id: "trash", label: "5:40 PM · Trash run", at: "17:40" },
  { id: "night", label: "9:00 PM · Night", at: "21:00" },
];
