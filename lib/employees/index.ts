import "server-only";
import { db } from "@/lib/supabase/admin";
import { TEAM, teamById, type EmployeeId } from "@/lib/team";
import { activeProvider, backupAllowsPrivate } from "@/lib/ai";
import { dueSlot } from "@/lib/time";
import type { Employee } from "./types";
import { chiefOfStaff } from "./chief-of-staff";
import { inboxTriage } from "./inbox-triage";
import { jobHunter } from "./job-hunter";
import { reminderBot, NOTHING_DUE } from "./reminder-bot";
import { scheduler } from "./scheduler";
import { researcher } from "./researcher";
import { devAssistant } from "./dev-assistant";
import { weeklyReviewer } from "./weekly-reviewer";

const WORK: Record<EmployeeId, Employee> = {
  "chief-of-staff": chiefOfStaff,
  "inbox-triage": inboxTriage,
  "job-hunter": jobHunter,
  "reminder-bot": reminderBot,
  scheduler,
  researcher,
  "dev-assistant": devAssistant,
  "weekly-reviewer": weeklyReviewer,
};

/** A run that started more than this long ago is treated as crashed, so the desk never sticks on "working". */
const STALE_MS = 10 * 60_000;

/**
 * Runs one employee end to end: claims the desk, does the work, records the run.
 * Returns false if the employee was already busy.
 */
export async function runEmployee(id: EmployeeId, trigger: "schedule" | "manual"): Promise<boolean> {
  const now = new Date();

  // Private desks don't touch your mail or calendar while only the free backup is available.
  // Their slot still counts as used, so they don't block the other employees every 5 minutes.
  if (teamById[id].private && activeProvider() !== "claude" && !backupAllowsPrivate()) {
    await db().from("employees").update({
      status: "idle", summary: "Waiting for your Claude key (reads private data)",
      last_run_at: now.toISOString(), updated_at: now.toISOString(),
    }).eq("id", id);
    return true;
  }
  const staleBefore = new Date(now.getTime() - STALE_MS).toISOString();

  // Claim the desk atomically: only flips to "working" if nobody else holds it (or the holder went stale).
  const { data: claimed } = await db()
    .from("employees")
    .update({ status: "working", updated_at: now.toISOString() })
    .eq("id", id)
    .or(`status.neq.working,updated_at.lt.${staleBefore}`)
    .select("id");
  if (!claimed?.length) return false;

  const { data: run } = await db()
    .from("runs")
    .insert({ employee_id: id, trigger, status: "running" })
    .select("id")
    .single();

  try {
    const result = await WORK[id]();
    const finished = new Date().toISOString();
    const brain = activeProvider() === "gemini" ? "\n\n— done by the free Gemini backup" : "";
    await db().from("runs").update({ status: result.status, output: result.output + brain, finished_at: finished }).eq("id", run!.id);
    await db().from("employees").update({
      status: result.status === "needs_you" ? "needs_you" : "idle",
      summary: result.summary, last_run_at: now.toISOString(), updated_at: finished,
    }).eq("id", id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finished = new Date().toISOString();
    await db().from("runs").update({ status: "error", error: message, finished_at: finished }).eq("id", run!.id);
    // last_run_at still advances so a broken employee doesn't retry every 5 minutes; use "Run now" after fixing.
    await db().from("employees").update({
      status: "error", summary: message.slice(0, 140), last_run_at: now.toISOString(), updated_at: finished,
    }).eq("id", id);
  }
  return true;
}

/**
 * Called every 5 minutes. Always lets the Reminder Bot check, then runs at most ONE other
 * employee whose slot is due (the most overdue), so each tick stays inside the function time limit.
 */
export async function tick(): Promise<string[]> {
  const ran: string[] = [];
  const { data: rows } = await db().from("employees").select("id, enabled, last_run_at");
  const state = new Map((rows ?? []).map((r) => [r.id as string, r]));

  if (state.get("reminder-bot")?.enabled !== false) {
    // Checked every tick, but only logged when something was sent, so the run history stays readable.
    try {
      const r = await reminderBot();
      if (r.summary !== NOTHING_DUE) {
        const at = new Date().toISOString();
        await db().from("runs").insert({ employee_id: "reminder-bot", trigger: "schedule", status: "done", output: r.output, finished_at: at });
        await db().from("employees").update({ status: "idle", summary: r.summary, last_run_at: at, updated_at: at }).eq("id", "reminder-bot");
        ran.push("reminder-bot");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db().from("employees").update({ status: "error", summary: message.slice(0, 140), updated_at: new Date().toISOString() }).eq("id", "reminder-bot");
    }
  }

  const now = new Date();
  const due = TEAM
    .filter((e) => e.schedule.kind === "times" && state.get(e.id)?.enabled !== false)
    .map((e) => {
      const last = state.get(e.id)?.last_run_at;
      return { e, slot: dueSlot(e.schedule, last ? new Date(last) : null, now) };
    })
    .filter((x): x is { e: (typeof TEAM)[number]; slot: Date } => x.slot !== null)
    .sort((a, b) => a.slot.getTime() - b.slot.getTime());

  const next = due.at(0);
  if (next && (await runEmployee(next.e.id, "schedule"))) ran.push(next.e.id);
  return ran;
}
