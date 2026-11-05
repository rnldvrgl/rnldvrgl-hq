"use client";

import { RotateCcw, Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { MIX_CHANNELS, MIX_MAX, useSettings, type MixKey } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * The office sound's mixer: a volume slider for each kind of sound (music, hum, keyboards, rain, street,
 * alerts) and one for everything. 0–150 %, 100 % is how it was designed; tap a channel's icon to mute it.
 * Saved on this device (Settings), applied live by lib/ambience.ts.
 */
export function SoundMixer({ compact = false, className }: { compact?: boolean; className?: string }) {
  const volumes = useSettings((s) => s.volumes);
  const { setVolume, resetVolumes } = useSettings.getState();
  const changed = MIX_CHANNELS.some((c) => volumes[c.key] !== 100);
  return (
    <div className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)]", compact ? "gap-2" : "gap-3", className)}>
      {MIX_CHANNELS.map((c) => (
        <Channel key={c.key} k={c.key} label={c.label} hint={compact ? undefined : c.hint} value={volumes[c.key]} onChange={(v) => setVolume(c.key, v)} strong={c.key === "all"} />
      ))}
      {changed && (
        <button type="button" onClick={resetVolumes} className="flex items-center gap-1.5 justify-self-start text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="size-3.5" aria-hidden /> Reset volumes
        </button>
      )}
    </div>
  );
}

/** Remembers the level before a mute, so unmuting goes back to it. */
const beforeMute = new Map<MixKey, number>();

function Channel({ k, label, hint, value, onChange, strong }: { k: MixKey; label: string; hint?: string; value: number; onChange: (v: number) => void; strong?: boolean }) {
  const Icon = value === 0 ? VolumeX : value < 50 ? Volume : value <= 100 ? Volume1 : Volume2;
  const id = `mix-${k}`;
  return (
    <div className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1", strong && "border-b border-border pb-2")}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={cn("block min-w-0 flex-1 truncate text-xs", strong ? "font-semibold" : "font-medium")}>
          {label}
          {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
        </label>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{value}%</span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (value === 0) onChange(beforeMute.get(k) || 100);
            else { beforeMute.set(k, value); onChange(0); }
          }}
          aria-label={value === 0 ? `Unmute ${label}` : `Mute ${label}`}
          aria-pressed={value === 0}
          className="-m-1.5 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icon className="size-4" aria-hidden />
        </button>
        <input
          id={id}
          type="range" min={0} max={MIX_MAX} step={5} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={`${value} percent`}
          className="h-1.5 w-full min-w-0 flex-1 cursor-pointer accent-primary"
        />
      </div>
    </div>
  );
}
