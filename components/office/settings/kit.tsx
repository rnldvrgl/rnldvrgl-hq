"use client";

import type { ReactNode } from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The building blocks every Settings page uses, so they all look and behave the same. */

/** A group on a page: a small heading, an optional line on what it does, then its controls. */
export function Group({ title, hint, action, children, className }: { title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 [&>*]:min-w-0", className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
          {hint && <p className="text-xs text-pretty text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A bordered card that holds rows (switches, selects). */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-card/60", className)}>{children}</div>;
}

/** An accessible on/off switch row. */
export function SwitchRow({ label, hint, checked, onChange, icon: Icon }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-pretty text-muted-foreground">{hint}</span>}
      </span>
      <Toggle on={checked} />
    </button>
  );
}

export function Toggle({ on }: { on: boolean }) {
  return (
    <span className={cn("relative h-6 w-10 shrink-0 rounded-full border transition-colors", on ? "border-primary bg-primary" : "border-border bg-muted")} aria-hidden>
      <span className={cn("absolute top-0.5 size-[18px] rounded-full shadow-sm transition-all", on ? "left-[18px] bg-primary-foreground" : "left-0.5 bg-foreground/60")} />
    </span>
  );
}

/** A row of mutually exclusive options. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: readonly { id: T; label: string; icon?: LucideIcon }[]; onChange: (v: T) => void; label: string;
}) {
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
            "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            value === o.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {o.icon && <o.icon className="size-4" aria-hidden />}
          <span className="truncate">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export type Choice<T extends string> = { id: T; label: string; hint?: string; icon?: LucideIcon; tile?: string };

/**
 * A grid of picture cards to choose one from: an icon on a coloured tile, a name and a line about it.
 * `tile` is a CSS background for the icon's square (a gradient in the option's colours).
 */
export function ChoiceGrid<T extends string>({ value, options, onChange, label, cols = 2 }: {
  value: T; options: readonly Choice<T>[]; onChange: (v: T) => void; label: string; cols?: 2 | 3;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 min-[420px]:grid-cols-2")}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative flex min-h-14 items-center gap-3 rounded-2xl border p-2.5 text-left transition-[background-color,border-color,box-shadow] hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
              on ? "border-ring bg-accent/70 ring-1 ring-ring" : "border-border bg-card/40",
            )}
          >
            {o.icon && (
              <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]" style={{ background: o.tile ?? "var(--primary)" }} aria-hidden>
                <o.icon className="size-5 drop-shadow-sm" />
              </span>
            )}
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-sm font-semibold">{o.label}</span>
              {o.hint && <span className="line-clamp-2 text-[11.5px] text-muted-foreground">{o.hint}</span>}
            </span>
            {on && <Check className="absolute top-1.5 right-1.5 size-4 rounded-full bg-ring p-0.5 text-white" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** "Saved to your HQ" (every device) or "This device": where a page's settings are kept. */
export function Scope({ synced }: { synced: boolean }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium",
      synced ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", synced ? "bg-emerald-500" : "bg-muted-foreground/60")} aria-hidden />
      {synced ? "All your devices" : "This device"}
    </span>
  );
}

/** Two colours to a soft gradient for an icon tile. */
export const tile = (a: string, b: string): string => `linear-gradient(140deg, ${a}, ${b})`;

export const inputCls = "h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
export const primaryBtn = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
export const ghostBtn = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-3.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50";
