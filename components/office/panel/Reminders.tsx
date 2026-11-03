"use client";

import { useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { BellPlus, BellRing, Loader2, Repeat, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateTimePicker } from "@/components/DateTimePicker";
import { useOffice } from "@/lib/store";
import { REMINDER_REPEATS, type ReminderRepeat } from "@/lib/supabase/database.types";
import type { ReminderView } from "@/lib/team";
import { manilaParts } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Empty } from "./Report";

const fail = (e: unknown, fallback: string) => toast.error(e instanceof Error ? e.message : fallback);

type RepeatChoice = "once" | ReminderRepeat;
const isRepeatChoice = (v: string): v is RepeatChoice => v === "once" || REMINDER_REPEATS.some((r) => r === v);
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

/** Add and list reminders, grouped by when they're due. Also the Reminders tab of the phone layout. */
export function Reminders() {
  const reminders = useOffice((s) => s.data.reminders);
  const { addReminder } = useOffice.getState();
  const [title, setTitle] = useState("");
  const [local, setLocal] = useState("");
  const [repeat, setRepeat] = useState<RepeatChoice>("once");
  const [adding, setAdding] = useState(false);
  const now = new Date();

  async function add(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!local) return toast.error("Pick a date for the reminder.");
    setAdding(true);
    try {
      await addReminder({ title, local, repeat: repeat === "once" ? null : repeat });
      setTitle(""); setLocal(""); setRepeat("once");
      toast.success("Reminder added.", { description: title });
    } catch (err) { fail(err, "Couldn't add the reminder."); }
    finally { setAdding(false); }
  }

  const grouped = GROUPS.map((g) => ({ g, items: reminders.filter((r) => groupOf(r, now) === g) })).filter((x) => x.items.length);

  return (
    <div className="grid gap-5">
      <form onSubmit={add} className="grid gap-3 rounded-xl border bg-muted/30 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><BellPlus className="size-4 text-primary" aria-hidden /> New reminder</p>
        <div className="grid gap-1.5">
          <Label htmlFor="rem-title">What</Label>
          <Input id="rem-title" placeholder="Pay the internet bill" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rem-when">When (PH time)</Label>
          <DateTimePicker id="rem-when" value={local} onChange={setLocal} />
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
        <Button type="submit" disabled={adding}>
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
