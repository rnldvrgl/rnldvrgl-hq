"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { create } from "zustand";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vec3 } from "./Furniture";

/**
 * Speech-bubble status above people's heads. Zoomed out (few pixels per metre) they shrink
 * to a coloured dot with an icon, so a phone-sized view doesn't drown in labels.
 */

/**
 * How much a bubble shows, by zoom (pixels per metre): a dot when the whole office is tiny,
 * name and status at the normal view, and the detail line once you zoom in (or hover a bubble).
 */
export type BubbleMode = "dot" | "line" | "full";
const DOT_BELOW = 42;
const FULL_FROM = 95;

export const useBubbleMode = create<{ mode: BubbleMode }>(() => ({ mode: "line" }));

/** Watches the orthographic zoom and sets the bubble mode. Mount once in the Canvas. */
export function BubbleZoomWatcher() {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const mode: BubbleMode = camera.zoom < DOT_BELOW ? "dot" : camera.zoom >= FULL_FROM ? "full" : "line";
    if (useBubbleMode.getState().mode !== mode) useBubbleMode.setState({ mode });
  });
  return null;
}

export type Tone = "idle" | "working" | "needs" | "error" | "off" | "owner" | "staff" | "duty";

const TONE: Record<Tone, string> = {
  idle: "bg-idle text-white",
  working: "bg-working text-white",
  needs: "bg-needs text-white",
  error: "bg-error text-white",
  off: "bg-off text-foreground",
  owner: "bg-primary text-primary-foreground",
  staff: "bg-amber-500 text-white",
  duty: "bg-emerald-600 text-white",
};

type Props = {
  position: Vec3;
  icon: LucideIcon;
  tone: Tone;
  name: string;
  /** Short status, e.g. "Working". */
  status: string;
  /** Second line, e.g. "Next 7:30 AM". */
  detail?: string;
  /** Pulse to draw the eye (needs you). */
  attention?: boolean;
  /** Animated typing dots after the status. */
  busy?: boolean;
  onClick?: () => void;
  /** Lower z for background characters so employees' bubbles win overlaps. */
  zIndex?: number;
  /** Colour chip behind the icon (the employee's shirt colour), otherwise the tone colour. */
  chip?: string;
  /** Always show the detail line (the selected employee). */
  expanded?: boolean;
};

export function Bubble({ position, icon: Icon, tone, name, status, detail, attention, busy, onClick, zIndex = 20, chip, expanded }: Props) {
  const mode = useBubbleMode((s) => s.mode);
  const compact = mode === "dot";
  const showDetail = mode === "full" || expanded;
  const Tag = onClick ? "button" : "div";
  return (
    <Html position={position} center zIndexRange={[zIndex, 0]} style={{ pointerEvents: onClick ? "auto" : "none" }}>
      <Tag
        {...(onClick ? { type: "button" as const, onClick } : {})}
        aria-label={`${name}: ${status}${detail ? `, ${detail}` : ""}`}
        className={cn(
          "group relative flex -translate-y-1/2 select-none items-center whitespace-nowrap rounded-full border bg-card/95 text-left text-card-foreground shadow-md backdrop-blur transition-[padding,transform] duration-200",
          onClick && "cursor-pointer hover:scale-105 focus-visible:outline-2 focus-visible:outline-ring",
          compact ? "gap-0 p-0.5" : "gap-1.5 py-0.5 pl-0.5 pr-2.5",
          attention && "motion-safe:animate-bounce border-needs",
        )}
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span
          className={cn("grid size-5 shrink-0 place-items-center rounded-full", !chip && TONE[tone])}
          style={chip ? { background: chip, color: "#fff" } : undefined}
        >
          <Icon className="size-3" aria-hidden />
        </span>
        {!compact && (
          <span className="grid leading-tight">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              {name}
              <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide", TONE[tone])}>
                {status}
                {busy && <BusyDots />}
              </span>
            </span>
            {detail && (
              <span className={cn("text-[11px] text-muted-foreground", !showDetail && "hidden group-hover:block group-focus-visible:block")}>{detail}</span>
            )}
          </span>
        )}
        {compact && (
          <span className={cn("absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card", TONE[tone])} aria-hidden />
        )}
        {/* tail */}
        <span className="absolute left-1/2 top-full -mt-px size-2 -translate-x-1/2 -translate-y-1 rotate-45 border-r border-b bg-card/95" aria-hidden />
      </Tag>
    </Html>
  );
}

function BusyDots() {
  return (
    <span className="ml-0.5 inline-flex gap-px align-middle" aria-hidden>
      {[0, 150, 300].map((d) => (
        <span key={d} className="inline-block size-[3px] rounded-full bg-current motion-safe:animate-pulse" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}
