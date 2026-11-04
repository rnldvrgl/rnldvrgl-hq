"use client";

import type { RunView } from "@/lib/team";
import { cn } from "@/lib/utils";

/** Runs are cut off after 4 minutes (RUN_DEADLINE_MS in lib/employees). Past 3 the bar turns amber: close to the limit. */
const DEADLINE_S = 240, SLOW_S = 180;

const TIME = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function seconds(r: RunView): number | null {
  if (!r.finished_at) return null;
  return Math.max(0, (new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000);
}

const fmt = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} m ${Math.round(s % 60)} s`);

/**
 * The employee's recent runs as a compact timeline: one row each with when it started, a bar for how long it
 * took (against the 4-minute limit), and why it failed. Slow runs and failures stand out, so a desk that is
 * drifting toward getting stuck shows up before it does.
 */
export function RunTimeline({ runs }: { runs: RunView[] }) {
  if (!runs.length) return null;
  const timed = runs.map(seconds).filter((s): s is number => s !== null);
  const avg = timed.length ? timed.reduce((a, b) => a + b, 0) / timed.length : null;
  const failed = runs.filter((r) => r.status === "error").length;

  return (
    <section className="flex flex-col gap-2" aria-label="Recent runs">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Recent runs</h3>
        <p className="text-xs text-muted-foreground">
          {avg !== null && <>avg {fmt(avg)}</>}
          {failed > 0 && <span className="text-destructive"> · {failed} failed</span>}
        </p>
      </div>
      <ol className="flex flex-col gap-1.5">
        {runs.map((r) => {
          const s = seconds(r);
          const running = r.status === "running";
          const pct = running ? 100 : Math.min(100, ((s ?? 0) / DEADLINE_S) * 100);
          const tone = r.status === "error" ? "bg-destructive" : running ? "bg-primary/60 animate-pulse" : (s ?? 0) > SLOW_S ? "bg-needs" : r.status === "needs_you" ? "bg-needs/70" : "bg-primary";
          return (
            <li key={r.id} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-xs">
              <span className="truncate text-muted-foreground tabular-nums">{TIME.format(new Date(r.started_at))}</span>
              <span className="relative h-2 overflow-hidden rounded-full bg-muted" title={r.error ?? undefined}>
                <span className={cn("absolute inset-y-0 left-0 rounded-full", tone)} style={{ width: `${Math.max(3, pct)}%` }} />
              </span>
              <span className={cn("text-right tabular-nums", r.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                {running ? "running" : r.status === "error" ? "failed" : s !== null ? fmt(s) : "—"}
              </span>
              {r.status === "error" && r.error && (
                <span className="col-span-3 -mt-0.5 line-clamp-2 pl-[7rem] text-[11px] text-destructive/90">{r.error}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
