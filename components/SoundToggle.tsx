"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { Ambience } from "@/lib/ambience";
import { cn } from "@/lib/utils";

const KEY = "hq:sound";

function readSaved(): boolean {
  try { return window.localStorage.getItem(KEY) === "on"; } catch { return false; }
}
function save(on: boolean) {
  try { window.localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode: not remembered */ }
}

/**
 * Mute / unmute the office ambience. Starts muted; the choice is remembered on this device.
 * Browsers only allow audio after a tap, so a remembered "on" resumes at your first tap anywhere on the page.
 */
export function SoundToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [on, setOn] = useState(false);
  const engine = useRef<Ambience | null>(null);

  const ensure = async (): Promise<Ambience> => {
    if (!engine.current) {
      const { Ambience } = await import("@/lib/ambience");
      engine.current = new Ambience();
    }
    return engine.current;
  };

  // remembered "on": start at the first tap or key press (the browser needs a gesture before playing audio)
  useEffect(() => {
    if (!readSaved()) return;
    setOn(true);
    const go = () => { void ensure().then((a) => a.start()); };
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);

  useEffect(() => () => { void engine.current?.stop(); }, []);

  const toggle = async () => {
    const next = !on;
    setOn(next);
    save(next);
    const a = await ensure();
    if (next) await a.start();
    else await a.stop();
  };

  const label = on ? "Mute office sounds" : "Play office sounds";
  return (
    <button
      type="button"
      onClick={() => { void toggle(); }}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border/70 bg-card/75 text-xs font-medium shadow-sm backdrop-blur-xl transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-ring",
        compact ? "w-9" : "px-3",
        on && "text-foreground",
        !on && "text-muted-foreground",
        className,
      )}
    >
      {on ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
      {!compact && <span className="hidden xl:inline">{on ? "Sound on" : "Muted"}</span>}
      {on && <span className="sr-only">(playing)</span>}
    </button>
  );
}
