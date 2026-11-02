import type { Schedule } from "@/lib/time";

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

/** Rename people, move desks or change hours here. Times are Manila time. */
export const TEAM: EmployeeMeta[] = [
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

export const teamById = Object.fromEntries(TEAM.map((e) => [e.id, e])) as Record<EmployeeId, EmployeeMeta>;

export function isEmployeeId(id: string): id is EmployeeId {
  return id in teamById;
}

export type EmployeeStatus = "idle" | "working" | "needs_you" | "error";

/** Shape the office UI receives from /api/state. */
export type AiProvider = "claude" | "gemini" | "none";

export type OfficeState = {
  /** Which AI the office is running on right now, and whether private desks may use the backup. */
  ai: { provider: AiProvider; backupAllowsPrivate: boolean };
  employees: {
    id: EmployeeId;
    enabled: boolean;
    status: EmployeeStatus;
    summary: string | null;
    last_run_at: string | null;
    runs: { id: string; status: string; output: string | null; error: string | null; started_at: string; trigger: string }[];
  }[];
  jobs: { id: string; role: string; company: string; link: string | null; salary_text: string | null; fit_score: number | null; fit_reason: string | null; status: string; date_found: string }[];
  reminders: { id: string; title: string; due_at: string; repeat: string | null }[];
  inbox: { message_id: string; sender: string | null; subject: string | null; category: string | null; summary: string | null; draft_id: string | null }[];
};
