import { syncNames } from "@/lib/names-server";
import { nameOf } from "@/lib/names";
import { have } from "@/lib/connections";
import { missing, NEED_LABEL } from "@/lib/hiring";
import { onTeam } from "@/lib/prefs";
import { loadPrefs } from "@/lib/prefs-server";
import { hqId } from "@/lib/hq-context";
import "server-only";
import { db } from "@/lib/supabase/admin";
import { TEAM, teamById, type EmployeeId, type EmployeeMeta } from "@/lib/team";
import type { RunTrigger } from "@/lib/supabase/database.types";
import { activeProvider, backupAllowsPrivate } from "@/lib/ai";
import { dueSlot } from "@/lib/time";
import { pushToOwner } from "@/lib/push";
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

/**
 * How long one run may take. Past this the run is stopped and recorded as an error, so the employee goes to
 * your office for help instead of sitting on "working" forever (a stuck AI call, a hung web search…).
 * It stays under the function limit (maxDuration = 300 s on the routes that run employees).
 */
export const RUN_DEADLINE_MS = 240_000;
/**
 * A run still marked "working" this long after it started never finished: the server was stopped mid-run
 * (function time limit, a redeploy). lib/state.ts marks it as an error the next time the office loads.
 */
export const STALE_MS = RUN_DEADLINE_MS + 90_000;

class RunTimeoutError extends Error {}

/** Rejects if `work` hasn't settled within `ms`. */
function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RunTimeoutError(
      `Stopped after ${Math.round(ms / 60_000)} minutes without finishing (the AI or a website didn't answer). Try "Run now" again later.`,
    )), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Runs one employee end to end: claims the desk, does the work, records the run.
 * Returns false if the employee was already busy.
 */
export async function runEmployee(id: EmployeeId, trigger: RunTrigger): Promise<boolean> {
  await syncNames(); // briefs and emails use the names set in Settings → Names
  const now = new Date();

  // not hired yet in this HQ: it hasn't connected what this employee needs (Settings → Connections)
  // not on this HQ's team (Settings → Team): nothing to do
  if (!onTeam((await loadPrefs()).prefs, id)) return true;

  const lacking = missing(id, have());
  if (lacking.length) {
    await db().from("employees").update({
      status: "idle", summary: `Not hired yet · needs ${lacking.map((n) => NEED_LABEL[n]).join(" and ")}`,
      last_run_at: now.toISOString(), updated_at: now.toISOString(),
    }).eq("id", id).eq("hq_id", hqId());
    return true;
  }

  // Private desks don't touch your mail or calendar while only the free backup is available.
  // Their slot still counts as used, so they don't block the other employees every 5 minutes.
  if (teamById[id].private && activeProvider() !== "claude" && !backupAllowsPrivate()) {
    await db().from("employees").update({
      status: "idle", summary: "Waiting for your Claude key (reads private data)",
      last_run_at: now.toISOString(), updated_at: now.toISOString(),
    }).eq("id", id).eq("hq_id", hqId());
    return true;
  }
  const staleBefore = new Date(now.getTime() - STALE_MS).toISOString();

  // Claim the desk atomically: only flips to "working" if nobody else holds it (or the holder went stale).
  // last_run_at moves now, not at the end: if this run dies mid-way, the same slot isn't retried every 5 minutes.
  const { data: claimed } = await db()
    .from("employees")
    .update({ status: "working", last_run_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("id", id).eq("hq_id", hqId())
    .or(`status.neq.working,updated_at.lt.${staleBefore}`)
    .select("id");
  if (!claimed?.length) return false;

  const { data: run, error: runError } = await db()
    .from("runs")
    .insert({ hq_id: hqId(), employee_id: id, trigger, status: "running" })
    .select("id")
    .single();
  if (runError) {
    // Couldn't record the run: release the desk instead of leaving it stuck on "working".
    await db().from("employees").update({
      status: "error", summary: `Couldn't log the run: ${runError.message}`.slice(0, 140), updated_at: new Date().toISOString(),
    }).eq("id", id).eq("hq_id", hqId());
    return true;
  }

  try {
    const result = await withDeadline(WORK[id](), RUN_DEADLINE_MS);
    const finished = new Date().toISOString();
    const provider = activeProvider();
    const brain = provider === "gemini" || provider === "groq" ? `\n\n— done by the free ${provider === "groq" ? "Groq" : "Gemini"} backup` : "";
    await db().from("runs").update({ status: result.status, output: result.output + brain, finished_at: finished }).eq("id", run.id).eq("hq_id", hqId());
    await db().from("employees").update({
      status: result.status === "needs_you" ? "needs_you" : "idle",
      summary: result.summary, last_run_at: now.toISOString(), updated_at: finished,
    }).eq("id", id).eq("hq_id", hqId());
    if (result.status === "needs_you") await notify(id, "needs you", result.summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const finished = new Date().toISOString();
    await db().from("runs").update({ status: "error", error: message, finished_at: finished }).eq("id", run.id).eq("hq_id", hqId());
    // last_run_at still advances so a broken employee doesn't retry every 5 minutes; use "Run now" after fixing.
    await db().from("employees").update({
      status: "error", summary: message.slice(0, 140), last_run_at: now.toISOString(), updated_at: finished,
    }).eq("id", id).eq("hq_id", hqId());
    await notify(id, "hit an error", message);
  }
  return true;
}

/** Push to your phone when a desk needs you. Never throws (pushToOwner swallows its own failures). */
async function notify(id: EmployeeId, what: string, detail: string | null): Promise<void> {
  const meta = teamById[id];
  await pushToOwner({
    title: `${nameOf(id)} ${what}`,
    body: (detail || meta.title).slice(0, 180),
    url: `/?desk=${id}`,
    tag: `desk-${id}`,
  });
}

/**
 * Called every 5 minutes. Always lets the Reminder Bot check, then runs at most ONE other
 * employee whose slot is due (the most overdue), so each tick stays inside the function time limit.
 */
export async function tick(): Promise<string[]> {
  const ran: string[] = [];
  const { data: rows } = await db().from("employees").select("id, enabled, last_run_at").eq("hq_id", hqId());
  const state = new Map((rows ?? []).map((r) => [r.id, r]));
  const { prefs } = await loadPrefs();

  if (state.get("reminder-bot")?.enabled !== false && onTeam(prefs, "reminder-bot")) {
    // Checked every tick, but only logged when something was sent, so the run history stays readable.
    try {
      const r = await reminderBot();
      if (r.summary !== NOTHING_DUE) {
        const at = new Date().toISOString();
        await db().from("runs").insert({ hq_id: hqId(), employee_id: "reminder-bot", trigger: "schedule", status: "done", output: r.output, finished_at: at });
        await db().from("employees").update({ status: "idle", summary: r.summary, last_run_at: at, updated_at: at }).eq("id", "reminder-bot").eq("hq_id", hqId());
        ran.push("reminder-bot");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db().from("employees").update({ status: "error", summary: message.slice(0, 140), updated_at: new Date().toISOString() }).eq("id", "reminder-bot").eq("hq_id", hqId());
    }
  }

  const now = new Date();
  const due = TEAM
    .filter((e) => e.schedule.kind === "times" && state.get(e.id)?.enabled !== false && onTeam(prefs, e.id))
    .map((e) => {
      const last = state.get(e.id)?.last_run_at;
      return { e, slot: dueSlot(e.schedule, last ? new Date(last) : null, now) };
    })
    .filter((x): x is { e: EmployeeMeta; slot: Date } => x.slot !== null)
    .sort((a, b) => a.slot.getTime() - b.slot.getTime());

  const next = due.at(0);
  if (next && (await runEmployee(next.e.id, "schedule"))) ran.push(next.e.id);
  return ran;
}
