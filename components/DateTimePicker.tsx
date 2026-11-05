"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { manilaParts } from "@/lib/time";
import { cn } from "@/lib/utils";

type Period = "AM" | "PM";
type Time = { hour: number; minute: number; period: Period }; // hour is 1–12

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
/** Every minute, 00–59. */
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n: number): string => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:MM" (24-hour, Manila) → its parts, or null when it isn't one. */
function parseLocal(value: string): { date: string; time: Time } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h24 = Number(m[2]);
  return { date: m[1], time: { hour: h24 % 12 || 12, minute: Number(m[3]), period: h24 < 12 ? "AM" : "PM" } };
}

function toLocal(date: string, t: Time): string {
  const h24 = (t.hour % 12) + (t.period === "PM" ? 12 : 0);
  return `${date}T${pad(h24)}:${pad(t.minute)}`;
}

/** The next full hour in Manila, as the starting time. */
function defaultTime(): Time {
  const h24 = (manilaParts(new Date()).hour + 1) % 24;
  return { hour: h24 % 12 || 12, minute: 0, period: h24 < 12 ? "AM" : "PM" };
}

/** A calendar day (whose local Y-M-D is what the user picked) ↔ "YYYY-MM-DD". */
const dayToIso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function isoToDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const isPeriod = (v: string): v is Period => v === "AM" || v === "PM";

/** Hour : minute AM/PM, three selects. */
function TimeSelects({ time, onChange }: { time: Time; onChange: (next: Partial<Time>) => void }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-1.5" role="group" aria-label="Time (Philippine time)">
      <Select value={String(time.hour)} onValueChange={(v) => onChange({ hour: Number(v) })}>
        <SelectTrigger className="w-full font-mono tabular-nums" aria-label="Hour"><SelectValue /></SelectTrigger>
        <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)}>{h}</SelectItem>)}</SelectContent>
      </Select>
      <span className="text-muted-foreground" aria-hidden>:</span>
      <Select value={String(time.minute)} onValueChange={(v) => onChange({ minute: Number(v) })}>
        <SelectTrigger className="w-full font-mono tabular-nums" aria-label="Minute"><SelectValue /></SelectTrigger>
        {/* Opens on the current minute (item-aligned) and scrolls; typing "4" "2" jumps to :42. */}
        <SelectContent className="max-h-64 font-mono tabular-nums">
          {MINUTES.map((m) => <SelectItem key={m} value={String(m)}>{pad(m)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={time.period} onValueChange={(v) => { if (isPeriod(v)) onChange({ period: v }); }}>
        <SelectTrigger className="w-full" aria-label="AM or PM"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

const to24 = (t: Time): string => `${pad((t.hour % 12) + (t.period === "PM" ? 12 : 0))}:${pad(t.minute)}`;
const from24 = (hhmm: string): Time | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  return { hour: h % 12 || 12, minute: Number(m[2]), period: h < 12 ? "AM" : "PM" };
};

/** Just a time of day in Manila: `value` / `onChange` are "HH:MM" (24-hour). Starts at the next full hour. */
export function TimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const time = from24(value) ?? defaultTime();
  return <TimeSelects time={time} onChange={(next) => onChange(to24({ ...time, ...next }))} />;
}

/** The next full hour in Manila, "HH:MM". */
export const nextHour = (): string => to24(defaultTime());

/**
 * Date + 12-hour time picker in Manila time. `value` and `onChange` use "YYYY-MM-DDTHH:MM" (24-hour),
 * the same format the reminders API reads, and "" while no date is picked.
 */
export function DateTimePicker({ id, value, onChange, className }: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const parsed = parseLocal(value);
  const [time, setTime] = useState<Time>(() => parsed?.time ?? defaultTime());
  const [open, setOpen] = useState(false);
  const date = parsed?.date ?? "";
  const today = isoToDay(manilaParts(new Date()).isoDate);

  const setPart = (next: Partial<Time>) => {
    const t = { ...time, ...next };
    setTime(t);
    if (date) onChange(toLocal(date, t));
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className={cn("w-full justify-start font-normal", !date && "text-muted-foreground")}>
            <CalendarDays aria-hidden />
            {date ? format(isoToDay(date), "EEE, MMM d, yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date ? isoToDay(date) : undefined}
            defaultMonth={date ? isoToDay(date) : today}
            disabled={{ before: today }}
            onSelect={(d) => {
              if (!d) return;
              onChange(toLocal(dayToIso(d), time));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {/* quick picks for the day */}
      <div className="flex gap-1.5">
        {[["Today", 0], ["Tomorrow", 1]].map(([label, add]) => {
          const d = new Date(today); d.setDate(d.getDate() + Number(add));
          const iso = dayToIso(d);
          return (
            <button key={label} type="button" onClick={() => onChange(toLocal(iso, time))} aria-pressed={date === iso}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", date === iso ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {label}
            </button>
          );
        })}
      </div>
      <TimeSelects time={time} onChange={setPart} />
    </div>
  );
}
