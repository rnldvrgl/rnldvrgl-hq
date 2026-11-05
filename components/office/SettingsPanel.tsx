"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { BatteryLow, Check, Eye, Gauge, LogOut, Loader2, Sparkles, Square } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { HOLIDAYS, nextLabel, useHolidayPreview, type Holiday } from "@/lib/holidays";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useOffice } from "@/lib/store";
import {
  DEFAULT_SETTINGS, LIGHT_SHOW, MUSIC_STYLES, WALKERS_MAX, OFFICE_STYLES, ROUTINE_LABELS, SHOW_LABELS, useSettings, type Motion,
} from "@/lib/settings";
import { STYLES } from "@/lib/theme";
import { Passkeys } from "./Passkeys";
import { SoundMixer } from "./SoundMixer";
import { ThemePicker, useStyleChoice } from "@/components/ThemePicker";
import { useIsDesktop } from "@/hooks/use-media";
import { HQ } from "@/hq.config";
import { cn } from "@/lib/utils";

/**
 * Settings for this device: how the app looks, how hard the 3D office works (presets, what's drawn, motion),
 * the team's daily routine and the boss. Everything applies instantly and is remembered in this browser.
 */
export function SettingsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const isDesktop = useIsDesktop();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={cn("scroll-thin gap-0 overflow-x-hidden", isDesktop ? "w-[420px] sm:max-w-[420px]" : "max-h-[88dvh] rounded-t-3xl pb-[max(16px,env(safe-area-inset-bottom,0px))]")}
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover/90 pb-3 backdrop-blur-md">
          <SheetTitle>Office settings</SheetTitle>
          <SheetDescription>Saved on this device only. Lower-end phones: try Battery saver.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pt-4 pb-6">
          <Appearance />
          <Performance />
          <Section title="Show in the office" hint="Turn layers off to draw less.">
            <ShowList />
          </Section>
          <Section title="Daily routine" hint="What the team does on the clock. Off = they stay at their desks.">
            <RoutineList />
          </Section>
          <Boss />
          <Sound />
          <Holidays onPreview={() => onOpenChange(false)} />
          <Section title="Account" hint="Passkeys sign you in without a password or an email code.">
            <Passkeys />
            <SignOut />
          </Section>
          <ResetAll />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** One card of settings: a heading, a line on what it does, then its controls. */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-card/50 p-3.5">
      <div className="px-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** An accessible on/off switch row. */
function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full border transition-colors", checked ? "border-primary bg-primary" : "border-border bg-muted")} aria-hidden>
        <span className={cn("absolute top-0.5 size-[18px] rounded-full shadow-sm transition-all", checked ? "left-[18px] bg-primary-foreground" : "left-0.5 bg-foreground/60")} />
      </span>
    </button>
  );
}

/** A row of mutually exclusive options. */
function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-border bg-muted/50 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-9 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            value === o.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Appearance() {
  const [style, setStyle] = useStyleChoice();
  return (
    <Section title="Appearance" hint="Colour style, and light or dark.">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Colour style">
        {STYLES.map((s) => {
          const on = style === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setStyle(s.id)}
              className={cn(
                "relative grid gap-2 rounded-xl border p-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                on ? "border-ring bg-accent ring-1 ring-ring" : "border-border",
              )}
            >
              {/* a tiny preview of the style: its background, a button in its colour, an accent dot */}
              <span className="flex h-9 items-end gap-1 rounded-lg p-1.5 shadow-inner" style={{ background: s.swatch[0] }} aria-hidden>
                <span className="h-2.5 w-7 rounded-full" style={{ background: s.swatch[1] }} />
                <span className="size-2.5 rounded-full" style={{ background: s.swatch[2] }} />
              </span>
              <span className="grid min-w-0 leading-tight">
                <span className="truncate text-[13px] font-semibold">{s.label}</span>
                <span className="truncate text-[10.5px] text-muted-foreground">{s.hint}</span>
              </span>
              {on && <Check className="absolute top-1 right-1 size-3.5 rounded-full bg-ring p-0.5 text-white" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">Light / Dark</span>
        <ThemePicker />
      </div>
    </Section>
  );
}

type Preset = "full" | "balanced" | "saver";

function Performance() {
  const lowPower = useOffice((s) => s.lowPower);
  const setLowPower = useOffice((s) => s.setLowPower);
  const motion = useSettings((s) => s.motion);
  const show = useSettings((s) => s.show);
  const setMotion = useSettings((s) => s.setMotion);
  const setAllShow = useSettings((s) => s.setAllShow);
  const autoSaver = useSettings((s) => s.autoSaver);
  const setAutoSaver = useSettings((s) => s.setAutoSaver);
  const walkers = useSettings((s) => s.walkers);
  const setWalkers = useSettings((s) => s.setWalkers);

  const apply = (p: Preset) => {
    if (p === "full") { setLowPower(false); setMotion("full"); setAllShow(DEFAULT_SETTINGS.show); setWalkers(DEFAULT_SETTINGS.walkers); }
    if (p === "balanced") { setLowPower(true); setMotion("full"); setAllShow({ ...DEFAULT_SETTINGS.show, neighbourhood: true, traffic: false, vendors: false, trees: true, smoke: false }); setWalkers(6); }
    if (p === "saver") { setLowPower(true); setMotion("minimal"); setAllShow(LIGHT_SHOW); setWalkers(0); }
  };
  const same = (a: typeof show, b: typeof show) => (Object.keys(a) as (keyof typeof show)[]).every((k) => a[k] === b[k]);
  const current: Preset | null =
    !lowPower && motion === "full" && same(show, DEFAULT_SETTINGS.show) ? "full"
    : lowPower && motion === "minimal" && same(show, LIGHT_SHOW) ? "saver"
    : lowPower && motion === "full" && !show.traffic && !show.smoke ? "balanced" : null;

  // each preset has its own colour: green for full, blue for balanced, amber for saving battery
  const PRESETS: { id: Preset; label: string; hint: string; icon: typeof Gauge; tone: { on: string; icon: string } }[] = [
    { id: "full", label: "Full", hint: "Everything, shadows, 60 fps", icon: Sparkles,
      tone: { on: "border-emerald-500 bg-emerald-500/12 ring-1 ring-emerald-500", icon: "text-emerald-600 dark:text-emerald-400" } },
    { id: "balanced", label: "Balanced", hint: "No shadows or traffic, 30 fps", icon: Gauge,
      tone: { on: "border-sky-500 bg-sky-500/12 ring-1 ring-sky-500", icon: "text-sky-600 dark:text-sky-400" } },
    { id: "saver", label: "Battery saver", hint: "Office only, minimal motion", icon: BatteryLow,
      tone: { on: "border-amber-500 bg-amber-500/14 ring-1 ring-amber-500", icon: "text-amber-600 dark:text-amber-400" } },
  ];

  return (
    <Section title="Performance" hint="Pick a preset, or fine-tune below.">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map(({ id, label, hint, icon: Icon, tone }) => (
          <button
            key={id}
            type="button"
            aria-pressed={current === id}
            onClick={() => apply(id)}
            className={cn(
              "relative grid content-start gap-1 rounded-xl border p-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
              current === id ? tone.on : "border-border",
            )}
          >
            <Icon className={cn("size-4", tone.icon, current !== id && "opacity-70")} aria-hidden />
            {current === id && <span className={cn("absolute top-2.5 right-2.5 size-2 rounded-full bg-current", tone.icon)} aria-hidden />}
            <span className="text-sm font-semibold leading-tight">{label}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>
      <SwitchRow label="Low-power rendering" hint="No shadows, 1× resolution, 30 fps" checked={lowPower} onChange={setLowPower} />
      <SwitchRow label="Auto battery saver" hint="Turn on low-power rendering by itself when the office keeps running slow" checked={autoSaver} onChange={setAutoSaver} />
      <div className="grid gap-1.5 px-2.5">
        <label htmlFor="walkers" className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">People walking outside</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{walkers === 0 ? "None" : `up to ${walkers}`}</span>
        </label>
        <input
          id="walkers" type="range" min={0} max={WALKERS_MAX} step={1} value={walkers}
          onChange={(e) => setWalkers(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer accent-primary"
        />
        <p className="text-xs text-muted-foreground">Students, office workers, joggers… at the busiest hour; fewer at night. Lower it on slow phones (0 turns them off).</p>
      </div>
      <div className="grid gap-1.5 px-2.5">
        <span className="text-sm font-medium">Animation</span>
        <Segmented<Motion>
          label="Animation"
          value={motion}
          onChange={setMotion}
          options={[{ id: "full", label: "Full" }, { id: "minimal", label: "Minimal" }]}
        />
        <p className="text-xs text-muted-foreground">Minimal: people still move around, but without idle animation, traffic, smoke or rain, at 12 fps.</p>
      </div>
    </Section>
  );
}

function ShowList() {
  const show = useSettings((s) => s.show);
  const setShow = useSettings((s) => s.setShow);
  return (
    <div className="grid">
      {SHOW_LABELS.map(({ key, label, hint }) => (
        <SwitchRow key={key} label={label} hint={hint} checked={show[key]} onChange={(on) => setShow(key, on)} />
      ))}
    </div>
  );
}

function RoutineList() {
  const routine = useSettings((s) => s.routine);
  const setRoutine = useSettings((s) => s.setRoutine);
  return (
    <div className="grid">
      {ROUTINE_LABELS.map(({ key, label, hint }) => (
        <SwitchRow key={key} label={label} hint={hint} checked={routine[key]} onChange={(on) => setRoutine(key, on)} />
      ))}
    </div>
  );
}

function Boss() {
  const boss = useSettings((s) => s.boss);
  const setBoss = useSettings((s) => s.setBoss);
  return (
    <Section title="Boss" hint={`${HQ.owner.name} in the 3D office.`}>
      <div className="grid gap-1.5 px-2.5">
        <span className="text-sm font-medium">Look</span>
        <Segmented
          label="Boss look"
          value={boss.look}
          onChange={(look) => setBoss({ look })}
          options={[{ id: "him", label: "Him · street style" }, { id: "her", label: "Her · soft street" }]}
        />
      </div>
      <div className="grid gap-1.5 px-2.5">
        <span className="text-sm font-medium">Office style</span>
        <div role="radiogroup" aria-label="Office style" className="grid grid-cols-2 gap-1.5">
          {OFFICE_STYLES.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={boss.office === o.id}
              onClick={() => setBoss({ office: o.id })}
              className={cn(
                "grid min-h-11 rounded-xl border px-2.5 py-1.5 text-left leading-tight transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                o.id === "auto" && "col-span-2",
                boss.office === o.id ? "border-ring bg-accent" : "border-border",
              )}
            >
              <span className="text-sm font-semibold">{o.label}</span>
              <span className="text-[11px] text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <SwitchRow label="Walks around on their own" hint="Office rounds and coffee runs through the day" checked={boss.wanders} onChange={(wanders) => setBoss({ wanders })} />
    </Section>
  );
}

function Sound() {
  const music = useSettings((s) => s.music);
  const setMusic = useSettings((s) => s.setMusic);
  const musicStyle = useSettings((s) => s.musicStyle);
  const setMusicStyle = useSettings((s) => s.setMusicStyle);
  const chimes = useSettings((s) => s.chimes);
  const setChimes = useSettings((s) => s.setChimes);
  return (
    <Section title="Sound" hint="Heard only when the office sound is on (the speaker button, top right).">
      <SwitchRow label="Office music" hint="Through the speakers and subwoofer, 8 AM – 7 PM" checked={music} onChange={setMusic} />
      {music && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Music style">
          {MUSIC_STYLES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={musicStyle === m.id}
              onClick={() => setMusicStyle(m.id)}
              className={cn(
                "grid min-h-11 rounded-xl border px-2.5 py-1.5 text-left leading-tight transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                musicStyle === m.id ? "border-ring bg-accent" : "border-border",
              )}
            >
              <span className="text-sm font-semibold">{m.label}</span>
              <span className="text-[11px] text-muted-foreground">{m.hint}</span>
            </button>
          ))}
        </div>
      )}
      <SwitchRow label="Who-needs-you chimes" hint="Each employee has their own little tune when they need you" checked={chimes} onChange={setChimes} />
      <div className="grid gap-2 px-2.5 pt-2">
        <p className="text-sm font-medium">Volume</p>
        <SoundMixer />
      </div>
    </Section>
  );
}

/** Every holiday the town dresses up for, when it is, and a button to see its look right now. */
function Holidays({ onPreview }: { onPreview: () => void }) {
  const previewing = useHolidayPreview((s) => s.id);
  const previewTime = useOffice((s) => s.previewTime);
  const now = new Date();
  const start = (h: Holiday) => {
    useHolidayPreview.setState({ id: h.id });
    previewTime(h.previewAt, `${h.name} preview`);
    onPreview();
  };
  const stop = () => { useHolidayPreview.setState({ id: null }); previewTime(null); };
  return (
    <Section title="Holidays" hint="The town decorates by itself on these dates (Manila time). Preview shows a look now, at its best hour.">
      <ul className="grid gap-1.5">
        {HOLIDAYS.map((h) => {
          const on = previewing === h.id;
          const next = nextLabel(h, now);
          return (
            <li key={h.id} className={cn("flex items-center gap-3 rounded-xl border px-2.5 py-2", on ? "border-ring bg-accent" : "border-border")}>
              <span className="flex shrink-0 -space-x-1" aria-hidden>
                {h.swatch.map((c) => <span key={c} className="size-3.5 rounded-full border border-white/70" style={{ background: c }} />)}
              </span>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-sm font-medium">{h.name}</span>
                  {next && <span className={cn("shrink-0 text-[10px] font-medium", next === "On now" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{next}</span>}
                </span>
                <span className="text-[11px] text-muted-foreground">{h.when}</span>
                <span className="text-[11px] text-muted-foreground/80">{h.looks}</span>
              </span>
              <button
                type="button" onClick={() => (on ? stop() : start(h))} aria-pressed={on}
                className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                {on ? <><Square className="size-3" aria-hidden /> Stop</> : <><Eye className="size-3.5" aria-hidden /> Preview</>}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Sign out on this device (other devices stay signed in). */
function SignOut() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try { window.sessionStorage.removeItem("hq:unlocked"); } catch { /* fine */ }
        await browserClient().auth.signOut({ scope: "local" }).catch(() => {});
        window.location.assign("/login");
      }}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />} Sign out
    </button>
  );
}

function ResetAll() {
  const reset = useSettings((s) => s.reset);
  const setLowPower = useOffice((s) => s.setLowPower);
  return (
    <button
      type="button"
      onClick={() => { reset(); setLowPower(false); }}
      className="justify-self-start rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      Reset to defaults
    </button>
  );
}
