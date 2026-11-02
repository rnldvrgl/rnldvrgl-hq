"use client";

import { useRef, useState, type SubmitEvent } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { toast } from "sonner";
import { Play, Pause, CheckCheck, X, Copy, ExternalLink, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOffice, useEmployee } from "@/lib/store";
import { JOB_STATUSES, REMINDER_REPEATS, type JobStatus, type ReminderRepeat } from "@/lib/supabase/database.types";
import { teamById, type EmployeeId } from "@/lib/team";
import { describeSchedule, formatManila } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ICONS, LAMP, STATUS_LABEL, type LampKey } from "./icons";
import { SHIRTS } from "./palette";

gsap.registerPlugin(useGSAP);

const fail = (e: unknown, fallback: string) => toast.error(e instanceof Error ? e.message : fallback);

/** Everything about one employee. Used inside the desktop side card and the phone bottom sheet. */
export function DeskPanel({ id, onClose }: { id: EmployeeId; onClose?: () => void }) {
  const meta = teamById[id];
  const emp = useEmployee(id);
  const ai = useOffice((s) => s.data.ai);
  const { runNow, setEnabled, acknowledge } = useOffice.getState();
  const [busy, setBusy] = useState(false);
  const scope = useRef<HTMLDivElement>(null);

  // Stagger the panel in whenever a different desk is opened.
  useGSAP(() => {
    gsap.from("[data-anim]", { y: 14, autoAlpha: 0, duration: 0.4, stagger: 0.05, ease: "power2.out", clearProps: "all" });
  }, { scope, dependencies: [id] });

  if (!emp) return null;
  const Icon = ICONS[meta.icon];
  const lampKey: LampKey = !emp.enabled ? "off" : emp.status;
  const latest = emp.runs.at(0);
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
          {STATUS_LABEL[lampKey]}
        </Badge>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close desk">
            <X />
          </Button>
        )}
      </header>

      <p data-anim className="text-sm text-muted-foreground">{meta.job}</p>

      {meta.private && ai.provider !== "claude" && !ai.backupAllowsPrivate && (
        <p data-anim className="flex gap-2 rounded-lg border border-needs/50 bg-needs/10 px-3 py-2 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-needs" aria-hidden />
          {meta.name} reads your private {meta.id === "dev-assistant" ? "repos" : "email and calendar"}, so they wait for Claude instead of using the free backup. They start working as soon as you add ANTHROPIC_API_KEY.
        </p>
      )}

      <dl data-anim className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-muted px-3 py-2">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Hours</dt>
          <dd>{describeSchedule(meta.schedule)}</dd>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Last run</dt>
          <dd>{formatManila(emp.last_run_at)}</dd>
        </div>
      </dl>

      <div data-anim className="flex flex-wrap gap-2">
        <Button disabled={busy || emp.status === "working"} onClick={() => act(() => runNow(id), `${meta.name} is on it.`)}>
          <Play /> {emp.status === "working" ? "Working…" : "Run now"}
        </Button>
        <Button variant="outline" disabled={busy}
          onClick={() => act(() => setEnabled(id, !emp.enabled), emp.enabled ? `${meta.name} is paused.` : `${meta.name} is back at the desk.`)}>
          <Pause /> {emp.enabled ? "Pause" : "Resume"}
        </Button>
        {(emp.status === "needs_you" || emp.status === "error") && (
          <Button variant="outline" disabled={busy} onClick={() => act(() => acknowledge(id), "Marked as read.")}>
            <CheckCheck /> Mark read
          </Button>
        )}
      </div>

      <Separator data-anim />

      <Tabs data-anim defaultValue={extraTab ?? "report"} key={id} className="min-w-0">
        <TabsList>
          {extraTab && <TabsTrigger value={extraTab}>{extraTab}</TabsTrigger>}
          <TabsTrigger value="report">Latest report</TabsTrigger>
          <TabsTrigger value="history" disabled={emp.runs.length < 2}>History</TabsTrigger>
        </TabsList>

        {extraTab === "Pipeline" && <TabsContent value="Pipeline"><Pipeline /></TabsContent>}
        {extraTab === "Reminders" && <TabsContent value="Reminders"><Reminders /></TabsContent>}
        {extraTab === "Inbox" && <TabsContent value="Inbox"><InboxWaiting /></TabsContent>}

        <TabsContent value="report">
          {latest ? (
            <div className="grid gap-2">
              <p className="font-mono text-xs text-muted-foreground">
                {formatManila(latest.started_at)} · {latest.trigger === "manual" ? "you asked" : "on schedule"}
              </p>
              {latest.error
                ? <p className="text-sm text-destructive">{latest.error}</p>
                : <Report text={latest.output ?? "Still working…"} />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No reports yet. Press Run now to see {meta.name} work.</p>
          )}
        </TabsContent>

        <TabsContent value="history" className="grid gap-4">
          {emp.runs.slice(1).map((r) => (
            <div key={r.id} className="grid gap-1.5">
              <p className="font-mono text-xs text-muted-foreground">{formatManila(r.started_at)} · {r.status}</p>
              <Report text={r.error ?? r.output ?? ""} />
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Report({ text }: { text: string }) {
  return (
    <ScrollArea className="max-h-80 rounded-lg bg-muted">
      <pre className="whitespace-pre-wrap break-words p-3 font-sans text-sm leading-relaxed">{text}</pre>
    </ScrollArea>
  );
}

const isJobStatus = (v: string): v is JobStatus => JOB_STATUSES.some((s) => s === v);

type RepeatChoice = "once" | ReminderRepeat;
const isRepeatChoice = (v: string): v is RepeatChoice => v === "once" || REMINDER_REPEATS.some((r) => r === v);

function Pipeline() {
  const jobs = useOffice((s) => s.data.jobs);
  const { setJobStatus, draftCoverLetter } = useOffice.getState();
  const [letter, setLetter] = useState<{ id: string; text: string } | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const open = jobs.filter((j) => j.status !== "closed").slice(0, 25);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        {JOB_STATUSES.map((s) => (
          <Badge key={s} variant="outline" className="font-normal">
            <b className="tabular-nums">{jobs.filter((j) => j.status === s).length}</b>&nbsp;{s}
          </Badge>
        ))}
      </div>
      {open.length === 0 && <p className="text-sm text-muted-foreground">No jobs yet. Hunter searches weekdays at 7:45 AM.</p>}
      <ul className="grid gap-3">
        {open.map((j) => (
          <li key={j.id} className="grid gap-2 rounded-lg border p-3">
            <div className="grid min-w-0 gap-0.5">
              {j.link
                ? <a href={j.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline [overflow-wrap:anywhere]">{j.role} <ExternalLink className="inline size-3" aria-hidden /></a>
                : <span className="font-semibold">{j.role}</span>}
              <span className="text-sm text-muted-foreground">
                {j.company} · {j.salary_text || "pay not listed"}{j.fit_score != null && ` · fit ${j.fit_score}/100`}
              </span>
              {j.fit_reason && <span className="text-sm">{j.fit_reason}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={j.status} onValueChange={(v) => { if (isJobStatus(v)) setJobStatus(j.id, v).catch((e: unknown) => fail(e, "Couldn't save the status.")); }}>
                <SelectTrigger size="sm" className="w-32" aria-label={`Status for ${j.role}`}><SelectValue /></SelectTrigger>
                <SelectContent>{JOB_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={drafting === j.id}
                onClick={async () => {
                  setDrafting(j.id);
                  try { setLetter({ id: j.id, text: await draftCoverLetter(j.id) }); }
                  catch (e) { fail(e, "Couldn't draft the letter."); }
                  finally { setDrafting(null); }
                }}>
                {drafting === j.id ? "Drafting…" : "Cover letter"}
              </Button>
            </div>
            {letter?.id === j.id && (
              <div className="grid gap-2">
                <Report text={letter.text} />
                <Button size="sm" variant="secondary" className="justify-self-start"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(letter.text); toast.success("Copied. Paste it into the application."); }
                    catch { toast.error("Select the text and copy it manually."); }
                  }}>
                  <Copy /> Copy
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Reminders() {
  const reminders = useOffice((s) => s.data.reminders);
  const { addReminder, removeReminder } = useOffice.getState();
  const [title, setTitle] = useState("");
  const [local, setLocal] = useState("");
  const [repeat, setRepeat] = useState<RepeatChoice>("once");

  async function add(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await addReminder({ title, local, repeat: repeat === "once" ? null : repeat });
      setTitle(""); setLocal(""); setRepeat("once");
      toast.success("Reminder added.");
    } catch (err) { fail(err, "Couldn't add the reminder."); }
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={add} className="grid grid-cols-2 gap-2">
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="rem-title">Reminder</Label>
          <Input id="rem-title" placeholder="Pay the internet bill" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rem-when">When (Manila)</Label>
          <Input id="rem-when" type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rem-repeat">Repeat</Label>
          <Select value={repeat} onValueChange={(v) => { if (isRepeatChoice(v)) setRepeat(v); }}>
            <SelectTrigger id="rem-repeat" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="once">Once</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekdays">Weekdays</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="col-span-2">Add reminder</Button>
      </form>
      {reminders.length === 0 && <p className="text-sm text-muted-foreground">Nothing coming up.</p>}
      <ul className="grid gap-2">
        {reminders.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <div className="grid min-w-0 flex-1">
              <span className="font-semibold [overflow-wrap:anywhere]">{r.title}</span>
              <span className="text-sm text-muted-foreground">{formatManila(r.due_at)}{r.repeat && ` · ${r.repeat}`}</span>
            </div>
            <Button variant="ghost" size="icon" aria-label={`Remove ${r.title}`}
              onClick={() => removeReminder(r.id).then(() => toast.success("Removed.")).catch((e: unknown) => fail(e, "Couldn't remove it."))}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InboxWaiting() {
  const inbox = useOffice((s) => s.data.inbox);
  const items = inbox.filter((i) => i.category === "reply" || i.category === "interview");
  return (
    <div className="grid gap-3">
      {items.length === 0 && <p className="text-sm text-muted-foreground">No replies waiting.</p>}
      <ul className="grid gap-2">
        {items.map((i) => (
          <li key={i.message_id} className="grid gap-0.5 rounded-lg border px-3 py-2">
            <span className="font-semibold [overflow-wrap:anywhere]">{i.subject}</span>
            <span className="text-sm text-muted-foreground">{i.sender} · {i.category}{i.draft_id && " · draft saved"}</span>
            {i.summary && <span className="text-sm">{i.summary}</span>}
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" size="sm" className="justify-self-start">
        <a href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noopener noreferrer">Open Gmail drafts <ExternalLink /></a>
      </Button>
    </div>
  );
}
