import type { Schedule } from "@/lib/time";
import type { EmployeeStatus, Tables } from "@/lib/supabase/database.types";
import { HQ } from "@/hq.config";

export type { EmployeeStatus } from "@/lib/supabase/database.types";

export type EmployeeId =
  | "chief-of-staff" | "inbox-triage" | "job-hunter" | "reminder-bot"
  | "scheduler" | "researcher" | "dev-assistant" | "weekly-reviewer";

export type IconName = "sun" | "inbox" | "briefcase" | "bell" | "calendar" | "book" | "code" | "clipboard";

export type EmployeeMeta = {
  id: EmployeeId;
  name: string;
  title: string;
  job: string;
  icon: IconName;
  /** Shirt colour token index, 1–8 (see --c1..--c8 in globals.css). */
  color: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Desk position on the floor grid (isometric tile units). */
  desk: { x: number; y: number };
  schedule: Schedule;
  /** Reads private data (email, calendar, private repos). Waits for Claude instead of using the free backup. */
  private?: boolean;
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Rename people in hq.config.ts (teamNames); move desks or change hours here. Times are Manila time. */
const DEFAULT_TEAM: EmployeeMeta[] = [
  { id: "chief-of-staff", private: true, name: "Maya", title: "Chief of Staff", icon: "sun", color: 1,
    job: "Emails you a morning brief: today's calendar, unread mail, reminders and your job pipeline.",
    desk: { x: 1, y: 1.6 }, schedule: { kind: "times", days: WEEKDAYS, times: ["07:30"] } },
  { id: "inbox-triage", private: true, name: "Iggy", title: "Inbox Triage", icon: "inbox", color: 2,
    job: "Sorts new Gmail into reply / FYI / ignore / interview, and saves reply drafts for you to send.",
    desk: { x: 3.4, y: 1.6 }, schedule: { kind: "times", days: WEEKDAYS, times: ["09:00", "13:00", "17:00"] } },
  { id: "job-hunter", name: "Hunter", title: "Job Hunter", icon: "briefcase", color: 3,
    job: "Searches 13 job boards for remote mid-level React/Next.js roles paying ₱40k+, scores them against your profile.",
    desk: { x: 5.8, y: 1.6 }, schedule: { kind: "times", days: WEEKDAYS, times: ["07:45"] } },
  { id: "reminder-bot", name: "Ring", title: "Reminder Bot", icon: "bell", color: 4,
    job: "Emails you each reminder on time, and repeats daily, weekday or weekly ones.",
    desk: { x: 8.2, y: 1.6 }, schedule: { kind: "always" } },
  { id: "scheduler", name: "Cal", title: "Scheduler", icon: "calendar", color: 5,
    job: "Every evening, previews tomorrow's calendar, flags clashes and tells you your free blocks.",
    desk: { x: 1, y: 5.4 }, schedule: { kind: "times", days: EVERY_DAY, times: ["18:00"] } },
  { id: "researcher", name: "Rhea", title: "Researcher", icon: "book", color: 6,
    job: "Monday digest on Next.js, React, GSAP and the remote frontend job market.",
    desk: { x: 3.4, y: 5.4 }, schedule: { kind: "times", days: [1], times: ["08:00"] } },
  { id: "dev-assistant", private: true, name: "Dex", title: "Dev Assistant", icon: "code", color: 7,
    job: "Summarises your open GitHub pull requests and issues, and what needs you first.",
    desk: { x: 5.8, y: 5.4 }, schedule: { kind: "times", days: WEEKDAYS, times: ["10:00"] } },
  { id: "weekly-reviewer", name: "Rev", title: "Weekly Reviewer", icon: "clipboard", color: 8,
    job: "Friday recap: what the team did, applications sent, interviews ahead, next week's priorities.",
    desk: { x: 8.2, y: 5.4 }, schedule: { kind: "times", days: [5], times: ["17:00"] } },
];

export const TEAM: EmployeeMeta[] = DEFAULT_TEAM.map((e) => ({ ...e, name: HQ.teamNames[e.id] ?? e.name }));

export const teamById = Object.fromEntries(TEAM.map((e) => [e.id, e])) as Record<EmployeeId, EmployeeMeta>;

export function isEmployeeId(id: string): id is EmployeeId {
  return Object.hasOwn(teamById, id);
}

/** Shape the office UI receives from /api/state. */
export type AiProvider = "claude" | "groq" | "gemini" | "none";

export type RunView = Pick<Tables<"runs">, "id" | "status" | "output" | "error" | "started_at" | "finished_at" | "trigger">;
export type JobView = Pick<Tables<"jobs">, "id" | "role" | "company" | "link" | "salary_text" | "fit_score" | "fit_reason" | "status" | "date_found">;
export type ReminderView = Pick<Tables<"reminders">, "id" | "title" | "due_at" | "repeat" | "source">;
export type InboxView = Pick<Tables<"inbox_items">, "message_id" | "sender" | "subject" | "category" | "summary" | "draft_id">;

export type EmployeeView = {
  id: EmployeeId;
  enabled: boolean;
  status: EmployeeStatus;
  summary: string | null;
  last_run_at: string | null;
  runs: RunView[];
};

export type OfficeState = {
  /** Which AI the office is running on right now, and whether private desks may use the backup. */
  ai: { provider: AiProvider; backupAllowsPrivate: boolean };
  employees: EmployeeView[];
  jobs: JobView[];
  reminders: ReminderView[];
  inbox: InboxView[];
  /** Finished runs per Manila day for the last 7 days, oldest first (today last), for the TV's chart. */
  week?: DayTally[];
};

export type DayTally = { date: string; done: number; failed: number };
