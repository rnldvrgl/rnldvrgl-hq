"use client";

import { useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { BellPlus, BellRing, Loader2, Repeat, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker, TimePicker, nextHour } from "@/components/DateTimePicker";
import { useOffice } from "@/lib/store";
import type { ReminderRepeat } from "@/lib/supabase/database.types";
import type { ReminderView } from "@/lib/team";
import { MANILA_OFFSET_MS, manilaParts } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Empty } from "./Report";

const fail = (e: unknown, fallback: string) => toast.error(e instanceof Error ? e.message : fallback);

type RepeatChoice = "once" | ReminderRepeat;
const REPEAT_LABEL: Record<ReminderRepeat, string> = { daily: "Daily", weekdays: "Weekdays", weekly: "Weekly" };

const TIME = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });
const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" });
const DATE = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

type Group = "Overdue" | "Today" | "Tomorrow" | "This week" | "Later";
const GROUPS: Group[] = ["Overdue", "Today", "Tomorrow", "This week", "Later"];

/** Manila calendar days from today (0 = today). */
function dayOffset(iso: string, now: Date): number {
  const a = Date.parse(`${manilaParts(new Date(iso)).isoDate}T00:00:00Z`);
  const b = Date.parse(`${manilaParts(now).isoDate}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

function groupOf(r: ReminderView, now: Date): Group {
  if (new Date(r.due_at) < now) return "Overdue";
  const d = dayOffset(r.due_at, now);
  return d <= 0 ? "Today" : d === 1 ? "Tomorrow" : d < 7 ? "This week" : "Later";
}

function ReminderRow({ r, group }: { r: ReminderView; group: Group }) {
  const { removeReminder } = useOffice.getState();
  const [removing, setRemoving] = useState(false);
  const due = new Date(r.due_at);
  const day = group === "This week" ? WEEKDAY.format(due) : group === "Later" || group === "Overdue" ? DATE.format(due) : null;
  return (
    <li className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs">
      <span className={cn(
        "grid w-16 shrink-0 justify-items-center rounded-lg px-1 py-1 text-center leading-tight",
        group === "Overdue" ? "bg-error/10 text-error" : group === "Today" ? "bg-accent text-accent-foreground" : "bg-muted text-foreground",
      )}>
        {day && <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{day}</span>}
        <span className="font-mono text-xs font-semibold tabular-nums">{TIME.format(due)}</span>
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{r.title}</span>
        {(r.repeat || r.source === "iphone") && (
          <span className="flex flex-wrap gap-1.5">
            {r.repeat && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                <Repeat className="size-3" aria-hidden /> {REPEAT_LABEL[r.repeat]}
              </span>
            )}
            {r.source === "iphone" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                title="From your iPhone. Complete or delete it in the Reminders app.">
                <Smartphone className="size-3" aria-hidden /> iPhone
              </span>
            )}
          </span>
        )}
      </div>
      {r.source !== "iphone" && (
        // iPhone reminders are deleted on the phone; deleting here would come straight back on the next sync.
        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Remove ${r.title}`} disabled={removing}
          onClick={() => {
            setRemoving(true);
            removeReminder(r.id).then(() => toast.success("Reminder removed.")).catch((e: unknown) => fail(e, "Couldn't remove it.")).finally(() => setRemoving(false));
          }}>
          {removing ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
        </Button>
      )}
    </li>
  );
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const REPEATS: readonly { id: RepeatChoice; label: string; hint: string }[] = [
  { id: "once", label: "Once", hint: "On a date" },
  { id: "daily", label: "Daily", hint: "Every day" },
  { id: "weekdays", label: "Weekdays", hint: "Mon – Fri" },
  { id: "weekly", label: "Weekly", hint: "One day a week" },
];
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The first time a repeating reminder fires, as "YYYY-MM-DDTHH:MM" Manila (what the API reads): the next day
 * from today (today itself if the time hasn't passed) that fits the repeat.
 */
function firstOccurrence(repeat: ReminderRepeat, hhmm: string, dow: number, now: Date): string {
  const p = manilaParts(now);
  const [h, m] = hhmm.split(":").map(Number);
  const nowMin = p.hour * 60 + p.minute;
  for (let add = 0; add < 8; add++) {
    const d = new Date(Date.UTC(p.year, p.month, p.day + add));
    const wd = d.getUTCDay();
    if (add === 0 && h * 60 + m <= nowMin) continue;
    if (repeat === "weekdays" && (wd === 0 || wd === 6)) continue;
    if (repeat === "weekly" && wd !== dow) continue;
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${hhmm}`;
  }
  return "";
}

const WHEN = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
/** "Fri, Nov 6, 8:00 AM" from a Manila "YYYY-MM-DDTHH:MM". */
const describeLocal = (local: string) => (local ? WHEN.format(new Date(`${local}:00Z`)) : "");

/** Add and list reminders, grouped by when they're due. Also the Reminders tab of the phone layout. */
export function Reminders() {
  const reminders = useOffice((s) => s.data.reminders);
  const { addReminder } = useOffice.getState();
  const [title, setTitle] = useState("");
  const [local, setLocal] = useState("");
  const [repeat, setRepeat] = useState<RepeatChoice>("once");
  const [time, setTime] = useState(nextHour);
  const [dow, setDow] = useState(() => new Date(`${manilaParts(new Date()).isoDate}T00:00:00Z`).getUTCDay());
  const [adding, setAdding] = useState(false);
  const now = new Date();
  // once: the date and time picked; repeating: just a time (and a day for weekly), starting at the next one
  const due = repeat === "once" ? local : firstOccurrence(repeat, time, dow, now);

  async function add(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!due) return toast.error("Pick a date for the reminder.");
    if (repeat === "once" && new Date(`${due}:00Z`).getTime() - MANILA_OFFSET_MS < Date.now()) return toast.error("That time has already passed.");
    setAdding(true);
    try {
      await addReminder({ title, local: due, repeat: repeat === "once" ? null : repeat });
      setTitle(""); setLocal(""); setRepeat("once");
      toast.success("Reminder added.", { description: title });
    } catch (err) { fail(err, "Couldn't add the reminder."); }
    finally { setAdding(false); }
  }

  const summary = !due ? null
    : repeat === "once" ? `Reminds you ${describeLocal(due)}`
      : `${repeat === "daily" ? "Every day" : repeat === "weekdays" ? "Every weekday" : `Every ${DOW[dow]}`} · first one ${describeLocal(due)}`;

  const grouped = GROUPS.map((g) => ({ g, items: reminders.filter((r) => groupOf(r, now) === g) })).filter((x) => x.items.length);

  return (
    <div className="grid gap-5">
      <form onSubmit={add} className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-primary/12 text-primary"><BellPlus className="size-4" aria-hidden /></span>
          New reminder
        </p>
        <div className="grid gap-1.5">
          <Label htmlFor="rem-title">What</Label>
          <Input id="rem-title" placeholder="Pay the internet bill" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} className="h-11 text-base sm:text-sm" />
        </div>
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Repeat</legend>
          <div role="radiogroup" aria-label="Repeat" className="grid grid-cols-4 gap-1 rounded-xl border bg-muted/40 p-1">
            {REPEATS.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={repeat === r.id} onClick={() => setRepeat(r.id)}
                className={cn("grid min-h-11 content-center rounded-lg px-1 text-center leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  repeat === r.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <span className="text-sm font-semibold">{r.label}</span>
                <span className={cn("text-[10px]", repeat === r.id ? "opacity-80" : "opacity-70")}>{r.hint}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {repeat === "once" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="rem-when">When (PH time)</Label>
            <DateTimePicker id="rem-when" value={local} onChange={setLocal} />
          </div>
        ) : (
          <div className="grid gap-3">
            {repeat === "weekly" && (
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">On</span>
                <div role="radiogroup" aria-label="Day of the week" className="grid grid-cols-7 gap-1">
                  {DOW.map((d, i) => (
                    <button key={d} type="button" role="radio" aria-checked={dow === i} onClick={() => setDow(i)}
                      className={cn("min-h-10 rounded-lg border text-xs font-semibold transition-colors", dow === i ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">At (PH time)</span>
              <TimePicker value={time} onChange={setTime} />
            </div>
          </div>
        )}
        {summary && (
          <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {repeat === "once" ? <BellRing className="size-3.5 shrink-0" aria-hidden /> : <Repeat className="size-3.5 shrink-0" aria-hidden />}
            {summary}
          </p>
        )}
        <Button type="submit" disabled={adding} className="h-11">
          {adding ? <><Loader2 className="animate-spin" aria-hidden /> Adding…</> : "Add reminder"}
        </Button>
      </form>

      {grouped.length === 0 ? (
        <Empty icon={BellRing} title="Nothing coming up" body="Reminders you add here or on your iPhone show up in this list." />
      ) : (
        grouped.map(({ g, items }) => (
          <section key={g} className="grid gap-2">
            <h3 className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wider", g === "Overdue" ? "text-error" : "text-muted-foreground")}>
              {g}
              <span className="rounded-full bg-muted px-1.5 py-px text-[10px] tabular-nums text-muted-foreground">{items.length}</span>
            </h3>
            <ul className="grid gap-2">
              {items.map((r) => <ReminderRow key={r.id} r={r} group={g} />)}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
