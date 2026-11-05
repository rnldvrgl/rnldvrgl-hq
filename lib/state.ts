import "server-only";
import { ensureDesks } from "@/lib/hq";
import { hqId } from "@/lib/hq-context";
import { syncNames } from "@/lib/names-server";
import { have } from "@/lib/connections";
import { missing } from "@/lib/hiring";
import { hqCtx } from "@/lib/hq-context";
import { db } from "@/lib/supabase/admin";
import { TEAM, type DayTally, type OfficeState, type RunView } from "@/lib/team";
import { activeProvider, backupAllowsPrivate } from "@/lib/ai";
import { STALE_MS } from "@/lib/employees";
import { defaultHandle, loadPrefs } from "@/lib/prefs-server";
import { HQ } from "@/hq.config";

const STUCK_SUMMARY = "Run never finished (stopped mid-way). Tap Run now to try again.";

/**
 * A desk still on "working" long after its run started was cut off mid-run (the server's time limit, a redeploy),
 * so nothing ever recorded the end. Close those runs as errors: the employee then goes to your office for help
 * instead of looking busy forever, and the next run can start.
 */
async function releaseStuckDesks(): Promise<void> {
  const before = new Date(Date.now() - STALE_MS).toISOString();
  const now = new Date().toISOString();
  const { data: stuck } = await db().from("employees").update({ status: "error", summary: STUCK_SUMMARY, updated_at: now }).eq("hq_id", hqId())
    .eq("status", "working").lt("updated_at", before).select("id");
  await db().from("runs").update({ status: "error", error: STUCK_SUMMARY, finished_at: now }).eq("hq_id", hqId())
    .eq("status", "running").lt("started_at", before);
  if (stuck?.length) console.warn(`[state] released stuck desks: ${stuck.map((r) => r.id).join(", ")}`);
}

export async function loadOfficeState(): Promise<OfficeState> {
  const names = await syncNames();
  await ensureDesks(hqCtx().id).catch(() => { /* before multi-hq.sql: nothing to add */ });
  await releaseStuckDesks().catch((e: unknown) => console.warn("[state] couldn't release stuck desks:", e instanceof Error ? e.message : e));
  const weekFrom = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [employees, runs, jobs, reminders, inbox, recent, prefs] = await Promise.all([
    db().from("employees").select("id, enabled, status, summary, last_run_at").eq("hq_id", hqId()),
    db().from("runs").select("id, employee_id, status, output, error, started_at, finished_at, trigger").eq("hq_id", hqId()).order("started_at", { ascending: false }).limit(160),
    db().from("jobs").select("id, role, company, link, salary_text, fit_score, fit_reason, status, date_found").eq("hq_id", hqId()).order("date_found", { ascending: false }).order("fit_score", { ascending: false }).limit(100),
    db().from("reminders").select("id, title, due_at, repeat, source").eq("hq_id", hqId()).is("sent_at", null).order("due_at").limit(30),
    db().from("inbox_items").select("message_id, sender, subject, category, summary, draft_id").eq("hq_id", hqId()).eq("handled", false).order("created_at", { ascending: false }).limit(30),
    db().from("runs").select("status, started_at").eq("hq_id", hqId()).gte("started_at", weekFrom).limit(3000),
    loadPrefs(),
  ]);

  const rowById = new Map((employees.data ?? []).map((e) => [e.id, e]));
  const runsByEmployee = new Map<string, RunView[]>();
  for (const { employee_id, ...run } of runs.data ?? []) {
    const list = runsByEmployee.get(employee_id) ?? [];
    if (list.length < 8) list.push(run);
    runsByEmployee.set(employee_id, list);
  }
  const has = have();
  return {
    names,
    hiring: Object.fromEntries(TEAM.map((t) => [t.id, missing(t.id, has)])) as OfficeState["hiring"],
    hq: { id: hqCtx().id, founder: hqCtx().founder, handle: defaultHandle(hqCtx().names?.owner ?? names.owner ?? HQ.owner.name, HQ.owner.handle) },
    prefs,
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
    week: tallyWeek(recent.data ?? []),
  };
}

const MANILA_MS = 8 * 3600_000;
const manilaDay = (ms: number) => new Date(ms + MANILA_MS).toISOString().slice(0, 10);

/** Done (incl. "needs you") and failed runs for each of the last 7 Manila days, oldest first. */
function tallyWeek(rows: { status: string; started_at: string }[]): DayTally[] {
  const days: DayTally[] = Array.from({ length: 7 }, (_, i) => ({ date: manilaDay(Date.now() - (6 - i) * 86_400_000), done: 0, failed: 0 }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const r of rows) {
    const d = byDate.get(manilaDay(new Date(r.started_at).getTime()));
    if (!d) continue;
    if (r.status === "error") d.failed++;
    else if (r.status !== "running") d.done++;
  }
  return days;
}
