"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { applyStyle, applyTheme, readStyle, readTheme, STYLE_KEY, THEMES, type StyleName, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ICON: Record<ThemeChoice, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

/** The saved theme choice, kept in sync across toggles (and tabs, via the storage event). */
function useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    setChoice(readTheme());
    const onTheme = () => setChoice(readTheme());
    window.addEventListener("hq:theme", onTheme);
    window.addEventListener("storage", onTheme);
    return () => {
      window.removeEventListener("hq:theme", onTheme);
      window.removeEventListener("storage", onTheme);
    };
  }, []);
  return [choice, (c) => { applyTheme(c); setChoice(c); }];
}

/**
 * Keeps the theme applied after hydration: follows the OS when the choice is System, picks up a change
 * made in another tab, and sets the browser's theme-color. Mount once (app/layout.tsx).
 */
export function ThemeSync() {
  useEffect(() => {
    applyStyle(readStyle(), false);
    applyTheme(readTheme(), false);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onOs = () => { if (readTheme() === "system") applyTheme("system", false); };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "hq:theme") applyTheme(readTheme(), false);
      if (e.key === STYLE_KEY) applyStyle(readStyle(), false);
    };
    media.addEventListener("change", onOs);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onOs);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}

/** The saved colour style (Slate / Blush), kept in sync across tabs. */
export function useStyleChoice(): [StyleName, (s: StyleName) => void] {
  const [style, setStyle] = useState<StyleName>("slate");
  useEffect(() => {
    setStyle(readStyle());
    const on = () => setStyle(readStyle());
    window.addEventListener("hq:style", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("hq:style", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return [style, (s) => { applyStyle(s); setStyle(s); }];
}

function subscribeMode(cb: () => void): () => void {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  return () => o.disconnect();
}
/** "light" or "dark" for the active theme (for libraries that need it as a prop, e.g. sonner). */
export function useThemeMode(): "light" | "dark" {
  return useSyncExternalStore(
    subscribeMode,
    () => (document.documentElement.dataset.mode === "dark" ? "dark" : "light"),
    () => "light",
  );
}

/**
 * Theme toggle. Full: a glass segmented control (Light / Dark / System).
 * Compact (phones): one round button that cycles Light → Dark → System, showing the current one.
 */
export function ThemePicker({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [choice, choose] = useThemeChoice();

  if (compact) {
    const i = THEMES.findIndex((t) => t.id === choice);
    const next = THEMES[(i + 1) % THEMES.length];
    const Icon = ICON[choice];
    const label = THEMES[i]?.label ?? "System";
    return (
      <button
        type="button"
        onClick={() => choose(next.id)}
        aria-label={`Theme: ${label}. Switch to ${next.label}`}
        title={`Theme: ${label}`}
        className={cn(
          "glass grid size-9 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
          className,
        )}
      >
        <Icon className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("glass flex h-9 shrink-0 items-center gap-0.5 rounded-full p-1", className)}>
      {THEMES.map((t) => {
        const Icon = ICON[t.id];
        const active = t.id === choice;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t.label}
            title={t.label}
            onClick={() => choose(t.id)}
            className={cn(
              "grid size-7 place-items-center rounded-full transition-all focus-visible:outline-2 focus-visible:outline-ring",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
