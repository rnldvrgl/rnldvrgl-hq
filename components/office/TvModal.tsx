"use client";

import { create } from "zustand";
import { Dialog } from "radix-ui";
import { Music, Trash2, X } from "lucide-react";
import { useOffice } from "@/lib/store";
import { useSpotify } from "@/lib/spotify";
import { TEAM, type EmployeeStatus } from "@/lib/team";
import { HQ } from "@/hq.config";
import { cn } from "@/lib/utils";
import { teamStreak } from "./Celebration";
import { ICONS } from "./icons";
import { useSceneNow } from "./scene-clock-ui";

/**
 * Tap the TV on the office wall: the same screen, big and readable, in a TV frame. Today's numbers,
 * the last 7 days, what each employee is doing (with their latest summary), trash duty and the music.
 * Tap an employee to open their desk.
 */

export const useTv = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

const WORD: Record<EmployeeStatus | "off", string> = { idle: "Idle", working: "Working", needs_you: "Needs you", error: "Error", off: "Paused" };
const DOT: Record<EmployeeStatus | "off", string> = {
  idle: "bg-[#3c5566]", working: "bg-[#5fd0d8] shadow-[0_0_8px_#5fd0d8]", needs_you: "bg-[#f2b23a] shadow-[0_0_8px_#f2b23a]",
  error: "bg-[#e07a7a] shadow-[0_0_8px_#e07a7a]", off: "bg-[#2a3a46]",
};
const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });
const CLOCK = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });
const DATE = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric" });
const AGO = (iso: string | null, now: number) => {
  if (!iso) return "never run";
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export function TvModal({ done, waiting, trashName }: { done: number; waiting: number; trashName: string | null }) {
  const open = useTv((s) => s.open);
  const setOpen = useTv((s) => s.setOpen);
  const employees = useOffice((s) => s.data.employees);
  const week = useOffice((s) => s.data.week);
  const select = useOffice((s) => s.select);
  const track = useSpotify((s) => s.track);
  const now = useSceneNow(30_000);

  const days = week?.length ? week : [];
  const max = Math.max(1, ...days.map((d) => d.done + d.failed));
  const weekDone = days.reduce((n, d) => n + d.done, 0);
  const weekFailed = days.reduce((n, d) => n + d.failed, 0);
  const streak = teamStreak(week);
  const working = employees.filter((e) => e.enabled && e.status === "working").length;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[min(92dvh,760px)] w-[min(960px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          aria-describedby={undefined}
        >
          {/* the bezel */}
          <div className="relative flex min-h-0 flex-1 flex-col rounded-[22px] bg-gradient-to-b from-[#1b2127] to-[#0b0e11] p-2.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-black/60 sm:p-3.5">
            {/* the screen */}
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] bg-[#0f1a22] font-mono text-[#d8e8f0] ring-1 ring-white/5">
              {/* glass: a soft glare and faint scan lines */}
              <div aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(255,255,255,0.07),transparent_55%)]" />
              <div aria-hidden className="pointer-events-none absolute inset-0 z-10 opacity-[0.06] [background:repeating-linear-gradient(0deg,#fff_0_1px,transparent_1px_3px)]" />

              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-6">
                <Dialog.Title className="text-xs font-medium tracking-[0.2em] text-[#5fd0d8] sm:text-sm">
                  {HQ.shortName} · OFFICE BOARD
                </Dialog.Title>
                <div className="flex items-center gap-3">
                  <span className="hidden text-xs text-[#d8e8f0]/60 sm:inline">{DATE.format(now)}</span>
                  <span className="text-sm tabular-nums">{CLOCK.format(now)}</span>
                  <Dialog.Close className="grid size-8 place-items-center rounded-full text-[#d8e8f0]/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#5fd0d8]" aria-label="Close">
                    <X className="size-4" aria-hidden />
                  </Dialog.Close>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
                <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
                  {/* left: today and the week */}
                  <section className="grid content-start gap-5">
                    <div>
                      <p className="mb-2 text-[11px] tracking-[0.2em] text-[#5fd0d8]">TODAY</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Tile value={done} label={done === 1 ? "report done" : "reports done"} />
                        <Tile value={waiting} label="waiting for you" tone={waiting ? "needs" : undefined} />
                        <Tile value={working} label="working now" tone={working ? "accent" : undefined} />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <p className="text-[11px] tracking-[0.2em] text-[#5fd0d8]">{streak >= 7 ? "7-DAY STREAK!" : "LAST 7 DAYS"}</p>
                        <p className="text-[11px] text-[#d8e8f0]/60">{weekDone} done{weekFailed ? ` · ${weekFailed} failed` : ""}</p>
                      </div>
                      {days.length ? (
                        <div className="flex h-36 items-end gap-2 rounded-xl bg-white/[0.03] p-3" role="img" aria-label={`Last 7 days: ${days.map((d) => `${DAY.format(new Date(`${d.date}T12:00:00Z`))} ${d.done} done${d.failed ? `, ${d.failed} failed` : ""}`).join("; ")}`}>
                          {days.map((d, i) => {
                            const today = i === days.length - 1;
                            return (
                              <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                                <span className="text-[10px] tabular-nums text-[#d8e8f0]/70">{d.done + d.failed || ""}</span>
                                <div className="flex w-full max-w-8 flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: `${((d.done + d.failed) / max) * 100}%`, minHeight: 3 }}>
                                  <div className={today ? "bg-[#5fd0d8]" : "bg-[#4a6a7e]"} style={{ flexGrow: d.done || (d.failed ? 0 : 1) }} />
                                  {d.failed > 0 && <div className="bg-[#e07a7a]" style={{ flexGrow: d.failed }} />}
                                </div>
                                <span className={cn("text-[10px]", today ? "text-[#5fd0d8]" : "text-[#d8e8f0]/60")}>{DAY.format(new Date(`${d.date}T12:00:00Z`)).slice(0, 2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="rounded-xl bg-white/[0.03] p-3 text-xs text-[#d8e8f0]/60">No runs yet this week.</p>
                      )}
                    </div>

                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <p className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
                        <Trash2 className="size-4 shrink-0 text-[#5fd0d8]" aria-hidden />
                        <span className="min-w-0"><span className="block text-[10px] tracking-[0.15em] text-[#d8e8f0]/60">TRASH DUTY · 5:40</span>{trashName ?? "Nobody today"}</span>
                      </p>
                      <p className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
                        {track?.art
                          ? <img src={track.art} alt="" className="size-8 shrink-0 rounded object-cover" />
                          : <Music className="size-4 shrink-0 text-[#1ed760]" aria-hidden />}
                        <span className="min-w-0">
                          <span className="block text-[10px] tracking-[0.15em] text-[#1ed760]">{track?.playing ? "NOW PLAYING" : "SPOTIFY"}</span>
                          <span className="block truncate">{track ? `${track.title} — ${track.artist}` : "Nothing playing"}</span>
                        </span>
                      </p>
                    </div>
                  </section>

                  {/* right: the team */}
                  <section>
                    <p className="mb-2 text-[11px] tracking-[0.2em] text-[#5fd0d8]">THE TEAM</p>
                    <ul className="grid gap-1.5">
                      {TEAM.map((m) => {
                        const e = employees.find((v) => v.id === m.id);
                        const st: EmployeeStatus | "off" = !e ? "idle" : !e.enabled ? "off" : e.status;
                        const Icon = ICONS[m.icon];
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => { setOpen(false); select(m.id); }}
                              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[#5fd0d8]"
                            >
                              <span className="relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06]">
                                <Icon className="size-4 text-[#d8e8f0]/80" aria-hidden />
                                <span className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-[#0f1a22]", DOT[st])} aria-hidden />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                  <span className="truncate text-sm font-medium">{m.name} <span className="text-[11px] font-normal text-[#d8e8f0]/50">{m.title}</span></span>
                                  <span className={cn("shrink-0 text-[11px]", st === "needs_you" ? "text-[#f2b23a]" : st === "error" ? "text-[#e07a7a]" : st === "working" ? "text-[#5fd0d8]" : "text-[#d8e8f0]/50")}>{WORD[st]}</span>
                                </span>
                                <span className="line-clamp-2 text-[11px] leading-relaxed text-[#d8e8f0]/60">
                                  {e?.summary ?? "No report yet."} · {AGO(e?.last_run_at ?? null, now.getTime())}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </div>
              </div>
            </div>
            {/* the power light */}
            <span aria-hidden className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[#5fd0d8] shadow-[0_0_6px_#5fd0d8] sm:bottom-1.5" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Tile({ value, label, tone }: { value: number; label: string; tone?: "needs" | "accent" }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-3">
      <p className={cn("text-3xl font-medium tabular-nums sm:text-4xl", tone === "needs" ? "text-[#f2b23a]" : tone === "accent" ? "text-[#5fd0d8]" : "text-[#d8e8f0]")}>{value}</p>
      <p className="mt-1 text-[10px] leading-tight tracking-[0.08em] text-[#d8e8f0]/70 uppercase">{label}</p>
    </div>
  );
}
