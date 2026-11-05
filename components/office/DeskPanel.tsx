"use client";

import { NEED_LABEL } from "@/lib/hiring";
import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { toast } from "sonner";
import { Play, Pause, CheckCheck, X, ShieldCheck, Loader2, House, Building2, UserPlus, PlugZap } from "lucide-react";
import { openSettings } from "@/lib/settings-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOffice, useEmployee } from "@/lib/store";
import { TEAM, teamById, type EmployeeId } from "@/lib/team";
import { isWeekday, manilaMinutes } from "@/lib/office-clock";
import { activityOf } from "./Employee3D";
import { sendCommute, useCommute } from "./commuteOverride";
import { useSceneNow } from "./scene-clock-ui";
import { describeSchedule, formatManila } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ICONS, LAMP, STATUS_LABEL, type LampKey } from "./icons";
import { SHIRTS } from "./palette";
import { ReportCard, History } from "./panel/Report";
import { RunTimeline } from "./panel/RunTimeline";
import { Pipeline } from "./panel/Pipeline";
import { InboxWaiting } from "./panel/Inbox";
import { Reminders } from "./panel/Reminders";

export { Reminders };

gsap.registerPlugin(useGSAP);

/** A stable empty list (a fresh [] in a store selector would re-render forever). */
const NO_NEEDS: readonly never[] = [];
const fail = (e: unknown, fallback: string) => toast.error(e instanceof Error ? e.message : fallback);

/** Send this employee home now, or call them in to the office (until the schedule catches up). */
function CommuteButton({ id }: { id: EmployeeId }) {
  const meta = teamById[id];
  const emp = useEmployee(id);
  useCommute((s) => s.overrides[id]);
  const now = useSceneNow(1000);
  if (!emp?.enabled) return null;
  const index = TEAM.findIndex((m) => m.id === id);
  const a = activityOf(manilaMinutes(now), isWeekday(now), meta, index, emp.status, emp.enabled, null);
  const away = a.kind === "away" || (a.kind === "route" && a.purpose === "leaving");
  return (
    <Button variant="outline" onClick={() => {
      sendCommute(id, away ? "office" : "home");
      toast.success(away ? `${meta.name} is heading to the office.` : `${meta.name} is heading home.`);
    }}>
      {away ? <><Building2 aria-hidden /> Call to the office</> : <><House aria-hidden /> Send home</>}
    </Button>
  );
}

/** Everything about one employee. Used inside the desktop side card and the phone bottom sheet. */
export function DeskPanel({ id, onClose }: { id: EmployeeId; onClose?: () => void }) {
  const meta = teamById[id];
  const emp = useEmployee(id);
  const ai = useOffice((s) => s.data.ai);
  const lacking = useOffice((s) => s.data.hiring?.[id] ?? NO_NEEDS);
  const { runNow, setEnabled, acknowledge } = useOffice.getState();
  const [busy, setBusy] = useState(false);
  const scope = useRef<HTMLDivElement>(null);

  // Stagger the panel in whenever a different desk is opened.
  useGSAP(() => {
    gsap.from("[data-anim]", { y: 14, autoAlpha: 0, duration: 0.4, stagger: 0.05, ease: "power2.out", clearProps: "all" });
  }, { scope, dependencies: [id] });

  if (!emp) return null;
  const Icon = ICONS[meta.icon];
  const lampKey: LampKey = !emp.enabled || lacking.length > 0 ? "off" : emp.status;
  const latest = emp.runs.at(0);
  const hired = lacking.length === 0;
  const extraTab = id === "job-hunter" ? "Pipeline" : id === "reminder-bot" ? "Reminders" : id === "inbox-triage" ? "Inbox" : null;

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast.success(ok); } catch (e) { fail(e, "Something went wrong. Try again."); } finally { setBusy(false); }
  }

  return (
    <div ref={scope} className="flex min-w-0 flex-col gap-4">
      <header data-anim className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: SHIRTS[meta.color - 1] }}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold leading-tight">{meta.name}</h2>
          <p className="text-sm text-muted-foreground">{meta.title}</p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <span className={cn("size-2 rounded-full", LAMP[lampKey])} aria-hidden />
          {lacking.length > 0 ? "Not hired" : STATUS_LABEL[lampKey]}
        </Badge>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close desk">
            <X />
          </Button>
        )}
      </header>

      <p data-anim className="text-sm text-muted-foreground">{meta.job}</p>

      {hired && meta.private && ai.provider !== "claude" && !ai.backupAllowsPrivate && (
        <p data-anim className="flex gap-2 rounded-lg border border-needs/50 bg-needs/10 px-3 py-2 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-needs" aria-hidden />
          {meta.name} reads your private {meta.id === "dev-assistant" ? "repos" : "email and calendar"}, so they wait for Claude instead of using the free backup. They start working as soon as you add ANTHROPIC_API_KEY.
        </p>
      )}

      <dl data-anim className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-muted px-3 py-2">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{hired ? "Hours" : "Will work"}</dt>
          <dd>{describeSchedule(meta.schedule)}</dd>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{hired ? "Last run" : "Status"}</dt>
          <dd>{hired ? formatManila(emp.last_run_at) : "Not hired yet"}</dd>
        </div>
      </dl>

      {hired ? (
        <>
          <div data-anim><RunTimeline runs={emp.runs} /></div>

          <div data-anim className="flex flex-wrap gap-2">
            <Button disabled={busy || emp.status === "working"} onClick={() => act(() => runNow(id), `${meta.name} is on it.`)}>
              {emp.status === "working" ? <><Loader2 className="animate-spin" aria-hidden /> Working…</> : <><Play /> Run now</>}
            </Button>
            <Button variant="outline" disabled={busy}
              onClick={() => act(() => setEnabled(id, !emp.enabled), emp.enabled ? `${meta.name} is paused.` : `${meta.name} is back at the desk.`)}>
              <Pause /> {emp.enabled ? "Pause" : "Resume"}
            </Button>
            <CommuteButton id={id} />
            {(emp.status === "needs_you" || emp.status === "error") && (
              <Button variant="outline" disabled={busy} onClick={() => act(() => acknowledge(id), "Marked as read.")}>
                <CheckCheck /> Mark read
              </Button>
            )}
          </div>
        </>
      ) : (
        // not hired: no buttons, reports or history (there's no work of theirs to show), just what to connect
        <div data-anim className="grid gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-sm">
          <p className="flex items-center gap-1.5 font-semibold"><UserPlus className="size-4" aria-hidden /> Not hired yet</p>
          <p className="text-muted-foreground">
            {meta.name} starts working once this HQ has {lacking.map((n) => NEED_LABEL[n]).join(" and ")}. Until then the desk stays empty and nothing runs.
          </p>
          <ul className="grid gap-1">
            {lacking.map((n) => (
              <li key={n} className="flex items-center gap-2 text-[13px]"><span className="size-1.5 rounded-full bg-amber-500" aria-hidden />{NEED_LABEL[n]}</li>
            ))}
          </ul>
          <Button className="justify-self-start" onClick={() => { onClose?.(); openSettings("connections"); }}>
            <PlugZap aria-hidden /> Connect in Settings
          </Button>
        </div>
      )}

      {hired && <Separator data-anim />}

      {hired && <Tabs data-anim defaultValue={extraTab ?? "report"} key={id} className="min-w-0">
        <TabsList className="w-full">
          {extraTab && <TabsTrigger value={extraTab}>{extraTab}</TabsTrigger>}
          <TabsTrigger value="report">Latest report</TabsTrigger>
          <TabsTrigger value="history" disabled={emp.runs.length < 2}>
            History{emp.runs.length > 1 && <span className="ml-1 rounded-full bg-muted-foreground/15 px-1.5 text-[10px] tabular-nums">{emp.runs.length - 1}</span>}
          </TabsTrigger>
        </TabsList>

        {extraTab === "Pipeline" && <TabsContent value="Pipeline" className="mt-2"><Pipeline /></TabsContent>}
        {extraTab === "Reminders" && <TabsContent value="Reminders" className="mt-2"><Reminders /></TabsContent>}
        {extraTab === "Inbox" && <TabsContent value="Inbox" className="mt-2"><InboxWaiting /></TabsContent>}

        <TabsContent value="report" className="mt-2">
          <ReportCard run={latest} name={meta.name} />
        </TabsContent>

        <TabsContent value="history" className="mt-2">
          <History runs={emp.runs.slice(1)} />
        </TabsContent>
      </Tabs>}
    </div>
  );
}
