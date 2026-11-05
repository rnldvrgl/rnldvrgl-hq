"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, PlugZap } from "lucide-react";
import { TEAM, type EmployeeId } from "@/lib/team";
import { NEEDS, NEED_LABEL, type Need } from "@/lib/hiring";
import { BASE_NAMES, NAME_KEYS, NAME_MAX, cleanName, currentNames, ownerName, type NameKey } from "@/lib/names";
import { useOffice } from "@/lib/store";
import { usePrefs, useTeamIds } from "@/lib/prefs-client";
import { useSettingsNav } from "@/lib/settings-nav";
import { ARRIVE_TIMES, LEAVE_TIMES, ROUTINE_LABELS, clockLabel, useSettings } from "@/lib/settings";
import { ICONS } from "../icons";
import { SHIRTS } from "../palette";
import { cn } from "@/lib/utils";
import { Card, Group, SwitchRow, ghostBtn, inputCls, primaryBtn } from "./kit";

/** A stable empty list (a fresh [] in a store selector would re-render forever). */
const NONE: readonly Need[] = [];
const NEED_SHORT: Record<Need, string> = { ai: "AI key", privateAi: "Claude", google: "Google", github: "GitHub", profile: "Your CV" };

export function TeamPage() {
  return (
    <>
      <WhoWorksHere />
      <NamesGroup />
      <HoursGroup />
      <RoutineGroup />
    </>
  );
}

/**
 * Pick the employees this HQ has. Each card says what they need; the office then only has desks, homes and
 * runs for the ones picked (the room keeps its size, the extra desks go).
 */
function WhoWorksHere() {
  const team = useTeamIds();
  const hiring = useOffice((s) => s.data.hiring);
  const go = useSettingsNav((s) => s.go);
  const setTeam = (ids: EmployeeId[]) => {
    if (!ids.length) { toast.error("Keep at least one employee."); return; }
    usePrefs.getState().set({ team: ids.length === TEAM.length ? undefined : TEAM.map((m) => m.id).filter((id) => ids.includes(id)) });
  };
  const toggle = (id: EmployeeId) => setTeam(team.includes(id) ? team.filter((x) => x !== id) : [...team, id]);
  const ready = TEAM.filter((m) => !(hiring?.[m.id]?.length)).map((m) => m.id);
  return (
    <Group
      title="Who works here"
      hint={`${team.length} of ${TEAM.length} on the team. Tap a card to add or remove someone: only they get a desk, a house and a schedule.`}
    >
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={cn(ghostBtn, "min-h-8 rounded-full px-3 text-xs")} onClick={() => setTeam(TEAM.map((m) => m.id))}>Everyone</button>
        {ready.length > 0 && ready.length < TEAM.length && (
          <button type="button" className={cn(ghostBtn, "min-h-8 rounded-full px-3 text-xs")} onClick={() => setTeam(ready)}>Only the ready ones ({ready.length})</button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Employees on the team">
        {TEAM.map((m) => {
          const on = team.includes(m.id);
          const lacking = hiring?.[m.id] ?? NONE;
          const Icon = ICONS[m.icon];
          return (
            <button
              key={m.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(m.id)}
              className={cn(
                "relative grid content-start gap-2 rounded-2xl border p-2.5 text-left sm:p-3 transition-[background-color,border-color,opacity] focus-visible:outline-2 focus-visible:outline-ring",
                on ? "border-ring bg-accent/60 ring-1 ring-ring" : "border-border bg-card/40 opacity-75 hover:opacity-100",
              )}
            >
              <span className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white sm:size-10" style={{ background: SHIRTS[m.color - 1] }} aria-hidden>
                  <Icon className="size-5" />
                </span>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate text-sm font-semibold">{m.name}</span>
                  <span className="truncate text-[11.5px] text-muted-foreground">{m.title}</span>
                </span>
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")} aria-hidden>
                  {on && <Check className="size-3.5" />}
                </span>
              </span>
              <span className="line-clamp-2 text-xs text-muted-foreground max-sm:hidden">{m.job}</span>
              <span className="flex flex-wrap gap-1">
                {NEEDS[m.id].length === 0 && <Chip tone="ok">Needs nothing</Chip>}
                {NEEDS[m.id].map((n) => (
                  <Chip key={n} tone={lacking.includes(n) ? "missing" : "ok"} title={NEED_LABEL[n]}>
                    {lacking.includes(n) ? "Needs " : ""}{NEED_SHORT[n]}
                  </Chip>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {TEAM.some((m) => team.includes(m.id) && hiring?.[m.id]?.length) && (
        <button type="button" onClick={() => go("connections")} className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-left text-xs text-foreground hover:bg-amber-500/15">
          <PlugZap className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          Some of them aren't hired yet: connect what they need in Connections.
        </button>
      )}
    </Group>
  );
}

function Chip({ tone, children, title }: { tone: "ok" | "missing"; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-medium",
      tone === "ok" ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-800 dark:text-amber-300")}>
      {children}
    </span>
  );
}

/** Rename the boss and the employees. Saved in the database: every device and the AI's emails use them. */
function NamesGroup() {
  const saveNames = useOffice((s) => s.saveNames);
  useOffice((s) => s.namesVersion);
  const team = useTeamIds();
  const [draft, setDraft] = useState<Record<string, string>>(() => currentNames());
  const [saving, setSaving] = useState(false);
  const rows: { key: NameKey; job: string; color: string }[] = [
    { key: "owner", job: "Boss (you)", color: "#f59e0b" },
    ...TEAM.filter((m) => team.includes(m.id)).map((m) => ({ key: m.id as NameKey, job: m.title, color: SHIRTS[m.color - 1] })),
  ];
  const changed = NAME_KEYS.some((k) => (draft[k] ?? "").trim() !== currentNames()[k]);
  const bad = NAME_KEYS.filter((k) => (draft[k] ?? "").trim() && !cleanName(draft[k]));
  return (
    <Group title="Names" hint="What everyone is called in the office, the panels and the AI's emails.">
      <Card>
        {rows.map(({ key, job, color }) => (
          <label key={key} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-2">
            <span className="grid size-8 place-items-center rounded-full text-xs font-bold text-white" style={{ background: color }} aria-hidden>
              {(draft[key] || BASE_NAMES[key]).slice(0, 1).toUpperCase()}
            </span>
            <span className="grid min-w-0 gap-0.5">
              <span className="text-[11px] text-muted-foreground">{job}</span>
              <input
                value={draft[key] ?? ""} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                placeholder={BASE_NAMES[key]} maxLength={NAME_MAX} aria-label={`${job} name`} aria-invalid={bad.includes(key)}
                className={cn(inputCls, "h-9", bad.includes(key) && "border-destructive")}
              />
            </span>
          </label>
        ))}
      </Card>
      {bad.length > 0 && <p className="text-xs text-destructive">Names can use letters, spaces, dots, hyphens and apostrophes (up to {NAME_MAX}).</p>}
      <div className="flex gap-2">
        <button
          type="button" disabled={!changed || bad.length > 0 || saving} className={cn(primaryBtn, "flex-1")}
          onClick={async () => {
            setSaving(true);
            try {
              await saveNames(Object.fromEntries(NAME_KEYS.map((k) => [k, (draft[k] ?? "").trim()])));
              toast.success("Names saved.");
            } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save the names."); }
            finally { setSaving(false); }
          }}
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} Save names
        </button>
        <button type="button" onClick={() => setDraft({ ...BASE_NAMES })} className={ghostBtn}>Use defaults</button>
      </div>
    </Group>
  );
}

/** When the team and the boss arrive and go home (the Commute routine must be on). */
function HoursGroup() {
  const hours = useSettings((s) => s.hours);
  const setHours = useSettings((s) => s.setHours);
  const rows = [
    { who: "Team", inKey: "teamIn", outKey: "teamOut" },
    { who: ownerName(), inKey: "bossIn", outKey: "bossOut" },
  ] as const;
  return (
    <Group title="Office hours" hint={`The team walks home, ${ownerName()} drives.`}>
      <Card>
        <div className="grid grid-cols-[minmax(0,5rem)_1fr_1fr] items-center gap-x-2 gap-y-2 p-3 text-xs">
          <span />
          <span className="text-muted-foreground">Arrive</span>
          <span className="text-muted-foreground">Go home</span>
          {rows.map((r) => (
            <div key={r.who} className="contents">
              <span className="truncate text-sm font-medium">{r.who}</span>
              <TimeSelect label={`${r.who} arrive`} value={hours[r.inKey]} options={ARRIVE_TIMES} onChange={(v) => setHours({ [r.inKey]: v })} />
              <TimeSelect label={`${r.who} go home`} value={hours[r.outKey]} options={LEAVE_TIMES} onChange={(v) => setHours({ [r.outKey]: v })} />
            </div>
          ))}
        </div>
      </Card>
    </Group>
  );
}

function TimeSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className="min-h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring">
      {options.map((t) => <option key={t} value={t}>{clockLabel(t)}</option>)}
    </select>
  );
}

function RoutineGroup() {
  const routine = useSettings((s) => s.routine);
  const setRoutine = useSettings((s) => s.setRoutine);
  return (
    <Group title="Daily routine" hint="What the team does on the clock. Off = they stay at their desks.">
      <Card>
        {ROUTINE_LABELS.map(({ key, label, hint }) => (
          <SwitchRow key={key} label={label} hint={hint} checked={routine[key]} onChange={(on) => setRoutine(key, on)} />
        ))}
      </Card>
    </Group>
  );
}
