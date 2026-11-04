import "server-only";
import { ask } from "@/lib/ai";
import { db } from "@/lib/supabase/admin";
import { emailMe } from "@/lib/email";
import { teamById, isEmployeeId } from "@/lib/team";
import { formatManila } from "@/lib/time";
import type { WorkResult } from "./types";
import { OWNERS } from "@/hq.config";

export async function weeklyReviewer(): Promise<WorkResult> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [runs, newJobs, applied, interviews] = await Promise.all([
    db().from("runs").select("employee_id, status").gte("started_at", since),
    db().from("jobs").select("id", { count: "exact", head: true }).gte("created_at", since),
    db().from("jobs").select("role, company").gte("date_applied", since.slice(0, 10)),
    db().from("interviews").select("company, starts_at").gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
  ]);

  const perEmployee: Record<string, { done: number; errors: number }> = {};
  for (const r of runs.data ?? []) {
    const k = isEmployeeId(r.employee_id) ? teamById[r.employee_id].name : r.employee_id;
    perEmployee[k] ??= { done: 0, errors: 0 };
    if (r.status === "error") perEmployee[k].errors++; else perEmployee[k].done++;
  }

  const facts = [
    `Team activity: ${Object.entries(perEmployee).map(([n, c]) => `${n} ${c.done} runs${c.errors ? `, ${c.errors} errors` : ""}`).join("; ") || "no runs"}`,
    `New jobs found: ${newJobs.count ?? 0}`,
    `Applications sent: ${(applied.data ?? []).map((j) => `${j.role} at ${j.company}`).join("; ") || "none"}`,
    `Interviews ahead: ${(interviews.data ?? []).map((i) => `${i.company} ${formatManila(i.starts_at)}`).join("; ") || "none"}`,
  ].join("\n");

  const recap = await ask({
    maxTokens: 800,
    system: "You write a short, encouraging but honest Friday recap. Plain text, under 170 words.",
    prompt: `Write ${OWNERS} weekly recap from these facts: what got done, what slipped (name any employee with errors), and three priorities for next week.\n\n${facts}`,
  });
  await emailMe("Weekly recap", recap);
  return { status: "done", summary: "Friday recap sent", output: recap };
}
