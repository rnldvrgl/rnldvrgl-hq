"use client";

import { Church, Eye, Flag, Flower2, Ghost, Heart, PartyPopper, Square, Sparkles, TreePine, type LucideIcon } from "lucide-react";
import { HOLIDAYS, nextLabel, useHolidayPreview, type Holiday, type HolidayId } from "@/lib/holidays";
import { useOffice } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Card, Group, SwitchRow } from "./kit";

/** A symbol for each holiday, drawn on a tile in its own colours. */
const ICON: Record<HolidayId, LucideIcon> = {
  newyear: PartyPopper, lunar: Sparkles, valentines: Heart, holyweek: Church, fiesta: Flower2, flags: Flag, undas: Ghost, christmas: TreePine,
};

/** Every holiday the town dresses up for, when it is, and a button to see its look now. */
export function HolidaysPage({ onPreview }: { onPreview: () => void }) {
  const previewing = useHolidayPreview((s) => s.id);
  const previewTime = useOffice((s) => s.previewTime);
  const on = useSettings((s) => s.show.holidays);
  const setShow = useSettings((s) => s.setShow);
  const now = new Date();
  const start = (h: Holiday) => {
    useHolidayPreview.setState({ id: h.id });
    previewTime(h.previewAt, `${h.name} preview`);
    onPreview();
  };
  const stop = () => { useHolidayPreview.setState({ id: null }); previewTime(null); };
  return (
    <>
      <Card>
        <SwitchRow label="Decorate for holidays" hint="The town dresses up by itself on these dates (Manila time)" checked={on} onChange={(v) => setShow("holidays", v)} />
      </Card>
      <Group title="The calendar" hint="Preview shows a holiday's look now, at its best hour.">
        <ul className="grid gap-2 min-[460px]:grid-cols-2">
          {HOLIDAYS.map((h) => {
            const active = previewing === h.id;
            const next = nextLabel(h, now);
            const Icon = ICON[h.id];
            const [a, b, c] = h.swatch;
            return (
              <li key={h.id} className={cn("grid overflow-hidden rounded-2xl border bg-card/50", active ? "border-ring ring-1 ring-ring" : "border-border")}>
                {/* the picture: the holiday's colours, its symbol, and a sprinkle of its confetti */}
                <div className="relative grid h-20 place-items-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} aria-hidden>
                  {[0, 1, 2, 3, 4, 5].map((k) => (
                    <span key={k} className="absolute size-2 rounded-full opacity-80" style={{ background: k % 2 ? c : "#ffffff", left: `${10 + k * 15}%`, top: `${18 + ((k * 37) % 60)}%` }} />
                  ))}
                  <span className="grid size-12 place-items-center rounded-2xl bg-white/25 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] backdrop-blur-sm">
                    <Icon className="size-6 text-white drop-shadow" />
                  </span>
                  {next && (
                    <span className={cn("absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      next === "On now" ? "bg-emerald-500 text-white" : "bg-black/35 text-white")}>{next}</span>
                  )}
                </div>
                <div className="grid gap-2 p-3">
                  <span className="grid min-w-0 leading-tight">
                    <span className="truncate text-sm font-semibold">{h.name}</span>
                    <span className="text-[11.5px] text-muted-foreground">{h.when}</span>
                    <span className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground/90">{h.looks}</span>
                  </span>
                  <button
                    type="button" onClick={() => (active ? stop() : start(h))} aria-pressed={active}
                    className={cn("flex h-8 items-center justify-center gap-1.5 rounded-full border text-xs font-medium transition-colors",
                      active ? "border-ring bg-accent" : "border-border hover:bg-muted")}
                  >
                    {active ? <><Square className="size-3" aria-hidden /> Stop preview</> : <><Eye className="size-3.5" aria-hidden /> Preview</>}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Group>
    </>
  );
}
