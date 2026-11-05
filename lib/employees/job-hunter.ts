import "server-only";
import { hqId } from "@/lib/hq-context";
import { z } from "zod";
import { askWithSources, extractJson, UNTRUSTED_NOTE } from "@/lib/ai";
import { jobSearchUrl, verifyJobLink } from "@/lib/job-links";
import { db } from "@/lib/supabase/admin";
import { emailMe } from "@/lib/email";
import { needProfile } from "@/lib/profile";
import type { WorkResult } from "./types";

/** Boards beyond Indeed and LinkedIn: PH boards first, then remote-first boards. */
export const JOB_BOARDS = [
  "ph.jobstreet.com", "kalibrr.com", "onlinejobs.ph", "bossjob.ph",
  "remotive.com", "weworkremotely.com", "himalayas.app", "remoteok.com",
  "wellfound.com", "arc.dev", "workingnomads.com",
  "ph.indeed.com", "linkedin.com",
];

const Job = z.object({
  role: z.string().min(2),
  company: z.string().min(1),
  link: z.string().url(),
  source: z.string(),
  salary_text: z.string().nullable(),
  salary_min_php: z.number().int().nullable(),
  fit_score: z.number().int().min(0).max(100),
  fit_reason: z.string(),
});

export async function jobHunter(): Promise<WorkResult> {
  const profile = needProfile(); // this HQ's own CV (a friend's "About you", never yours)
  const { data: known } = await db().from("jobs").select("link, company, role").eq("hq_id", hqId());
  const skip = (known ?? []).map((j) => `${j.company} — ${j.role}`).slice(-150);

  const { text: reply, sources } = await askWithSources({
    maxTokens: 4000,
    webSearch: { maxUses: 10, allowedDomains: JOB_BOARDS },
    system: `You are a job researcher for one Filipino developer. ${UNTRUSTED_NOTE}`,
    prompt: [
      "Find job postings from the last 3 days that match ALL of these:",
      `- Role: ${profile.target.roles.join(" / ")}`,
      `- Level: ${profile.target.level} (skip intern, OJT, junior-only, and lead/principal roles)`,
      "- Fully remote and open to applicants in the Philippines",
      `- Pay at least PHP ${profile.target.min_salary_php_month}/month (convert USD at today's rate). Keep posts with no listed pay but say so.`,
      "Search several different boards, not just one.",
      `Skip anything already tracked: ${skip.join("; ") || "none yet"}`,
      `Score each 0-100 against this profile: ${JSON.stringify({ skills: profile.skills, experience_years: profile.experience_years, projects: profile.projects.map((p) => p.name + ": " + p.stack.join(", ")) })}`,
      "Return ONLY a JSON array (max 8, best first) of objects with keys:",
      "role, company, link (the posting's exact URL, copied from a search result; never guess, shorten or mask an id), source (board name), salary_text (as listed or null), salary_min_php (number or null), fit_score, fit_reason (one sentence).",
    ].join("\n"),
  });

  const parsed = z.array(Job).safeParse(extractJson(reply));
  if (!parsed.success) throw new Error("Job list came back in the wrong shape: " + parsed.error.issues[0]?.message);
  const jobs = parsed.data
    .filter((j) => j.salary_min_php === null || j.salary_min_php >= profile.target.min_salary_php_month)
    // only links the searches really returned; a made-up one ("…/job/???") becomes a search for that job
    .map((j) => ({ ...j, link: verifyJobLink(j, sources) ?? jobSearchUrl(j) }));

  const { data: inserted, error } = await db()
    .from("jobs")
    .upsert(jobs.map((j) => ({ ...j, hq_id: hqId() })), { onConflict: "hq_id,link", ignoreDuplicates: true })
    .select("role, company, salary_text, fit_score, fit_reason, link");
  if (error) throw new Error(error.message);
  const added = inserted ?? [];

  if (added.length === 0) {
    return { status: "done", summary: "No new matches today", output: "Searched the boards; nothing new cleared your filters." };
  }

  const lines = added
    .sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0))
    .map((j, i) => `${i + 1}. ${j.role} — ${j.company}\n   ${j.salary_text ?? "Pay not listed"} · fit ${j.fit_score}/100\n   ${j.fit_reason}\n   ${j.link}`);
  const output = `${added.length} new job${added.length === 1 ? "" : "s"} for you:\n\n${lines.join("\n\n")}\n\nOpen the Job Hunter desk to update statuses. Apply on the job site yourself.`;
  await emailMe(`Job Hunter: ${added.length} new remote React/Next.js job${added.length === 1 ? "" : "s"}`, output);
  return { status: "needs_you", summary: `${added.length} new match${added.length === 1 ? "" : "es"} to review`, output };
}
