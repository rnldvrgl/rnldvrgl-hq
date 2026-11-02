import "server-only";
import { db } from "@/lib/supabase/admin";
import { TEAM, type OfficeState, type RunView } from "@/lib/team";
import { activeProvider, backupAllowsPrivate } from "@/lib/ai";

export async function loadOfficeState(): Promise<OfficeState> {
  const [employees, runs, jobs, reminders, inbox] = await Promise.all([
    db().from("employees").select("id, enabled, status, summary, last_run_at"),
    db().from("runs").select("id, employee_id, status, output, error, started_at, trigger").order("started_at", { ascending: false }).limit(80),
    db().from("jobs").select("id, role, company, link, salary_text, fit_score, fit_reason, status, date_found").order("date_found", { ascending: false }).order("fit_score", { ascending: false }).limit(100),
    db().from("reminders").select("id, title, due_at, repeat").is("sent_at", null).order("due_at").limit(30),
    db().from("inbox_items").select("message_id, sender, subject, category, summary, draft_id").eq("handled", false).order("created_at", { ascending: false }).limit(30),
  ]);

  const rowById = new Map((employees.data ?? []).map((e) => [e.id, e]));
  const runsByEmployee = new Map<string, RunView[]>();
  for (const { employee_id, ...run } of runs.data ?? []) {
    const list = runsByEmployee.get(employee_id) ?? [];
    if (list.length < 5) list.push(run);
    runsByEmployee.set(employee_id, list);
  }
  return {
    ai: { provider: activeProvider(), backupAllowsPrivate: backupAllowsPrivate() },
    employees: TEAM.map((t) => {
      const row = rowById.get(t.id);
      return {
        id: t.id,
        enabled: row?.enabled ?? true,
        status: row?.status ?? "idle",
        summary: row?.summary ?? null,
        last_run_at: row?.last_run_at ?? null,
        runs: runsByEmployee.get(t.id) ?? [],
      };
    }),
    jobs: jobs.data ?? [],
    reminders: reminders.data ?? [],
    inbox: inbox.data ?? [],
  };
}
