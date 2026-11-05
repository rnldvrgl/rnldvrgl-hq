import type { EmployeeId } from "@/lib/team";

/**
 * What each employee needs before they can work. In an HQ that doesn't have it yet, the desk shows
 * "Not hired yet" with what's missing and a way to connect it (Settings → Connections), instead of the
 * employee running and failing. Isomorphic: the server decides, the browser shows it.
 *
 *   ai         any AI key (Claude, or the free Gemini / Groq): writes, sorts, scores and searches
 *   privateAi  for desks that read private data (mail, calendar, private repos): Claude, or the HQ's explicit
 *              permission for the free AI to read it (Settings → Connections)
 *   google     your Gmail and Calendar
 *   github     your GitHub
 *   profile    your CV ("About you"), for job searching and cover letters
 */
export type Need = "ai" | "privateAi" | "google" | "github" | "profile";

export const NEEDS: Record<EmployeeId, readonly Need[]> = {
  "chief-of-staff": ["privateAi", "google"],
  "inbox-triage": ["privateAi", "google"],
  "job-hunter": ["ai", "profile"],
  "reminder-bot": [],
  scheduler: ["ai", "google"],
  researcher: ["ai"],
  "dev-assistant": ["privateAi", "github"],
  "weekly-reviewer": ["ai"],
};

export const NEED_LABEL: Record<Need, string> = {
  ai: "an AI key",
  privateAi: "Claude (or letting the free AI read private data)",
  google: "Google (Gmail & Calendar)",
  github: "GitHub",
  profile: "About you (your CV)",
};

export type Have = Record<Need, boolean>;
/** What an employee is still missing in an HQ that has `have`. Empty = hired. */
export const missing = (id: EmployeeId, have: Have): Need[] => NEEDS[id].filter((n) => !have[n]);

/** The Google scopes the employees use (README → Google), asked for when an HQ connects Google. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
];
