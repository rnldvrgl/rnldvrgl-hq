"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const TIPS = ["Turning on the lights…", "Brewing coffee…", "Waking up the team…", "Dusting the monitors…"] as const;

/**
 * Loading state for the office: a little isometric building whose floors stack up, a shimmering
 * progress bar, and rotating tips. Motion is dropped for prefers-reduced-motion.
 */
export function LoadingScreen({ label, compact = false, className }: { label?: string; compact?: boolean; className?: string }) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "grid place-items-center",
        compact ? "size-full min-h-48 p-4" : "min-h-dvh p-6",
        className,
      )}
    >
      <div className={cn("flex flex-col items-center", compact ? "gap-3" : "gap-5")}>
        <IsoBuilding size={compact ? 64 : 96} />
        <div className="grid justify-items-center gap-2">
          {label && <p className={cn("font-semibold", compact ? "text-sm" : "text-base")}>{label}</p>}
          <div className="hq-shimmer relative h-1.5 w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="hq-progress absolute inset-y-0 left-0 rounded-full bg-primary" />
          </div>
          <p key={tip} className="hq-tip h-4 text-xs text-muted-foreground">{TIPS[tip]}</p>
        </div>
      </div>
    </div>
  );
}

/** Lit windows on the right face of a floor, as parallelograms that follow the isometric slope. */
const WINDOWS: readonly string[] = [0.15, 0.45, 0.75].map((t) => {
  const x1 = 50 + 30 * t, x2 = 50 + 30 * (t + 0.14);
  const y1 = 50 - 15 * t, y2 = 50 - 15 * (t + 0.14);
  return `M${x1} ${y1 + 3} L${x2} ${y2 + 3} L${x2} ${y2 + 8} L${x1} ${y1 + 8} Z`;
});

/** Three isometric floors that drop into place one after another, then the windows light up. */
function IsoBuilding({ size }: { size: number }) {
  // One floor: top rhombus + left and right faces, 40 wide, 10 tall faces.
  const floor = (y: number, i: number) => (
    // The SVG transform sits on an outer group: the CSS animation's transform would replace it otherwise.
    <g key={i} transform={`translate(0 ${y})`}>
      <g className="hq-floor" style={{ animationDelay: `${i * 0.22}s` }}>
      <path d="M50 20 L80 35 L50 50 L20 35 Z" fill="var(--logo-a)" opacity="0.55" />
      <path d="M20 35 L50 50 L50 62 L20 47 Z" fill="var(--logo-b)" />
      <path d="M80 35 L50 50 L50 62 L80 47 Z" fill="var(--logo-a)" />
      {WINDOWS.map((d, w) => (
        <path key={w} d={d} className="hq-window" style={{ animationDelay: `${0.7 + i * 0.22 + w * 0.08}s` }} fill="#ffd27a" />
      ))}
      </g>
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="overflow-visible">
      <ellipse cx="50" cy="88" rx="30" ry="6" className="fill-foreground/10" />
      {[24, 12, 0].map((y, i) => floor(y, i))}
    </svg>
  );
}
