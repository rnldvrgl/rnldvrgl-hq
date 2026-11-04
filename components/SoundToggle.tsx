"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { setSound } from "@/lib/ambience";
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
export function SoundToggle({ className, compact = false, bare = false }: { className?: string; compact?: boolean; /** Icon only, no pill of its own (inside the office's control group). */ bare?: boolean }) {
  const [on, setOn] = useState(false);

  // remembered "on": start at the first tap or key press (the browser needs a gesture before playing audio)
  useEffect(() => {
    if (!readSaved()) return;
    setOn(true);
    // if this first tap is the mute button itself, its click runs after this and turns it back off
    const go = () => { if (readSaved()) void setSound(true); };
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    save(next);
    void setSound(next);
  };

  const label = on ? "Mute office sounds" : "Play office sounds";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        bare
          ? "text-foreground"
          : "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border/70 bg-card/75 text-xs font-medium shadow-sm backdrop-blur-xl transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-ring",
        !bare && (compact ? "w-9" : "px-3"),
        !bare && (on ? "text-foreground" : "text-muted-foreground"),
        className,
      )}
    >
      {on ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className={cn("size-4", bare && "opacity-60")} aria-hidden />}
      {!compact && !bare && <span className="hidden xl:inline">{on ? "Sound on" : "Muted"}</span>}
      {on && <span className="sr-only">(playing)</span>}
    </button>
  );
}
