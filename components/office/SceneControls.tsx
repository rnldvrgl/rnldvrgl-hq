"use client";

import { useState } from "react";
import { BatteryLow, Check, ChevronDown, Cloud, CloudLightning, CloudRain, LocateFixed, Minus, Plus, Radio, Sun, Zap, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOffice, WEATHER_KINDS, type WeatherKind } from "@/lib/store";
import { PREVIEWS, hm, phaseAt } from "@/lib/office-clock";
import { cn } from "@/lib/utils";
import { PHASE_ICON, PHASE_LABEL, phaseOf, useSceneNow } from "./scene-clock-ui";

const CLOCK = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });

/** Frosted glass pills over the 3D view (the `glass` utility in globals.css). */
const pill = "glass";
const iconButton =
  "grid size-11 place-items-center text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:size-9";

/**
 * DOM overlay on the 3D office: zoom and reset view (bottom-right), and the time-of-day control
 * (top-left) to watch the office live or jump to morning, lunch, the trash run or night.
 */
export function SceneControls({ onReset, onZoom }: { onReset: () => void; onZoom: (dir: 1 | -1) => void }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex flex-wrap gap-2">
        <TimeControl />
        <WeatherControl />
      </div>
      <div className={cn("absolute right-3 bottom-3 z-30 flex flex-col overflow-hidden rounded-full", pill)} role="group" aria-label="View">
        <ControlButton icon={Plus} label="Zoom in" onClick={() => onZoom(1)} />
        <span className="mx-2 h-px bg-border" aria-hidden />
        <ControlButton icon={Minus} label="Zoom out" onClick={() => onZoom(-1)} />
        <span className="mx-2 h-px bg-border" aria-hidden />
        <ControlButton icon={LocateFixed} label="Reset view" onClick={onReset} />
        <span className="mx-2 h-px bg-border" aria-hidden />
        <LowPowerButton />
      </div>
    </>
  );
}

function ControlButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={iconButton}>
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function TimeControl() {
  const [open, setOpen] = useState(false);
  const timeTravel = useOffice((s) => s.timeTravel);
  const previewTime = useOffice((s) => s.previewTime);
  const now = useSceneNow(1000);
  const phase = phaseOf(now);
  const Icon = PHASE_ICON[phase];
  const live = !timeTravel;

  const choose = (at: string | null, label?: string) => {
    previewTime(at, label);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "pointer-events-auto flex h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:h-9",
            pill,
            !live && "border-ring/60 bg-accent text-accent-foreground",
          )}
          aria-label={`Time of day: ${PHASE_LABEL[phase]}, ${CLOCK.format(now)}${live ? ", live" : ", preview"}. Change`}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{live ? "Live" : "Preview"} ·</span>
          <span className="font-mono tabular-nums">{CLOCK.format(now)}</span>
          {live && <span className="size-1.5 rounded-full bg-working motion-safe:animate-pulse" aria-hidden />}
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <p className="px-2 pt-1 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Time of day</p>
        <ul className="grid gap-0.5">
          <li>
            <MenuItem icon={Radio} label="Live (Mabalacat now)" active={live} onClick={() => choose(null)} />
          </li>
          {PREVIEWS.map((p) => (
            <li key={p.id}>
              <MenuItem
                icon={PHASE_ICON[phaseAt(hm(p.at))]}
                label={p.label}
                active={timeTravel?.label === p.label}
                onClick={() => choose(p.at, p.label)}
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function MenuItem({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:min-h-8",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1">{label}</span>
      {active && <Check className="size-4" aria-hidden />}
    </button>
  );
}

/** Battery saver: no shadows, 1× resolution, 30 fps. Remembered on this device. */
function LowPowerButton() {
  const lowPower = useOffice((s) => s.lowPower);
  const setLowPower = useOffice((s) => s.setLowPower);
  const label = lowPower ? "Low-power mode is on (tap for full quality)" : "Full quality (tap for low-power mode)";
  return (
    <button
      type="button"
      onClick={() => setLowPower(!lowPower)}
      aria-pressed={lowPower}
      aria-label={label}
      title={label}
      className={cn(iconButton, lowPower && "bg-amber-500/15 text-amber-600")}
    >
      {lowPower ? <BatteryLow className="size-4" aria-hidden /> : <Zap className="size-4" aria-hidden />}
    </button>
  );
}

const WEATHER_ICON: Record<WeatherKind, LucideIcon> = { clear: Sun, cloudy: Cloud, rain: CloudRain, storm: CloudLightning };
const WEATHER_LABEL: Record<WeatherKind, string> = { clear: "Clear", cloudy: "Cloudy", rain: "Rain", storm: "Thunderstorm" };

/** Mabalacat weather in the windows: live, or preview a kind of weather. */
function WeatherControl() {
  const [open, setOpen] = useState(false);
  const live = useOffice((s) => s.weather);
  const override = useOffice((s) => s.weatherOverride);
  const previewWeather = useOffice((s) => s.previewWeather);
  const kind = override ?? live?.kind ?? "clear";
  const Icon = WEATHER_ICON[kind];
  const temp = !override && live?.tempC != null ? `${Math.round(live.tempC)}°` : null;
  const choose = (k: WeatherKind | null) => { previewWeather(k); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "pointer-events-auto flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:h-9",
            pill,
            override && "border-ring/60 bg-accent text-accent-foreground",
          )}
          aria-label={`Weather: ${WEATHER_LABEL[kind]}${temp ? `, ${temp}C` : ""}${override ? ", preview" : ", live in Mabalacat"}. Change`}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {temp && <span className="tabular-nums">{temp}</span>}
          <span className="hidden sm:inline">{override ? WEATHER_LABEL[kind] : temp ? "" : WEATHER_LABEL[kind]}</span>
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        <p className="px-2 pt-1 pb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Weather</p>
        <ul className="grid gap-0.5">
          <li>
            <MenuItem
              icon={Radio}
              label={live ? `Live: ${WEATHER_LABEL[live.kind]}${live.tempC != null ? ` · ${Math.round(live.tempC)}°C` : ""}` : "Live (loading…)"}
              active={!override}
              onClick={() => choose(null)}
            />
          </li>
          {WEATHER_KINDS.map((k) => (
            <li key={k}>
              <MenuItem icon={WEATHER_ICON[k]} label={WEATHER_LABEL[k]} active={override === k} onClick={() => choose(k)} />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
