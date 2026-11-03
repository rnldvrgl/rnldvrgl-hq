"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { WifiOff, Brain, Building2, Users, Bell, History, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useOffice } from "@/lib/store";
import { teamById, type AiProvider, type OfficeState } from "@/lib/team";
import { useIsDesktop } from "@/hooks/use-media";
import { cn } from "@/lib/utils";
import { formatManilaClock } from "@/lib/time";
import { OfficeScene } from "./OfficeScene";
import { DeskPanel, Reminders } from "./DeskPanel";
import { PHASE_ICON, PHASE_LABEL, phaseOf, useSceneNow } from "./scene-clock-ui";
import { Roster } from "./Roster";

gsap.registerPlugin(useGSAP);

export default function Office({ initial }: { initial: OfficeState }) {
  // Seed the store once with the server-loaded data (this component only ever renders in the browser).
  useState(() => useOffice.getState().hydrate(initial));

  const isDesktop = useIsDesktop();
  const select = useOffice((s) => s.select);
  const refresh = useOffice((s) => s.refresh);
  const working = useOffice((s) => s.data.employees.filter((e) => e.status === "working").length);

  // Poll faster while anyone is working, so the desk lights up and settles on time.
  useEffect(() => {
    const t = setInterval(refresh, working ? 3000 : 15000);
    return () => clearInterval(t);
  }, [refresh, working]);
  // Coming back to the installed app (or the tab) shows fresh data right away instead of after the next poll.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);
  // Esc closes the open desk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") select(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  return isDesktop ? <DesktopOffice /> : <PhoneOffice />;
}

/* ------------------------------------------------------------------ shared pieces */

function useCounts(): { working: number; waiting: number; reminders: number; provider: AiProvider } {
  const employees = useOffice((s) => s.data.employees);
  const provider = useOffice((s) => s.data.ai.provider);
  const reminders = useOffice((s) => s.data.reminders.length);
  return {
    working: employees.filter((e) => e.status === "working").length,
    waiting: employees.filter((e) => e.status === "needs_you" || e.status === "error").length,
    reminders,
    provider,
  };
}

function AiBadge({ provider, compact = false, className }: { provider: AiProvider; compact?: boolean; className?: string }) {
  const label = provider === "claude" ? "Claude" : provider === "gemini" ? (compact ? "Backup" : "Gemini backup") : (compact ? "No AI" : "No AI key");
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 gap-1.5 bg-card py-1", provider === "gemini" && "border-needs/60", provider === "none" && "border-error/60", className)}
      title={provider === "gemini" ? "Running on the free Gemini backup until ANTHROPIC_API_KEY is added." : undefined}
    >
      <Brain className="size-3.5" aria-hidden />
      {label}
    </Badge>
  );
}

const TIME_ONLY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });

/** Manila clock with the time-of-day icon (follows the scene clock, so a preview shows here too). */
function ClockBadge({ short = false, className }: { short?: boolean; className?: string }) {
  const now = useSceneNow(5000);
  const phase = phaseOf(now);
  const Icon = PHASE_ICON[phase];
  return (
    <Badge variant="outline" className={cn("shrink-0 gap-1.5 bg-card py-1 font-mono tabular-nums", className)} title={PHASE_LABEL[phase]}>
      <Icon className="size-3.5" aria-hidden />
      {short ? TIME_ONLY.format(now) : formatManilaClock(now)}
      <span className="hidden font-sans text-muted-foreground xl:inline">· Manila</span>
    </Badge>
  );
}

/** Shown while the 3D office is previewing another time of day. */
function TimeTravelChip({ compact = false }: { compact?: boolean }) {
  const timeTravel = useOffice((s) => s.timeTravel);
  const previewTime = useOffice((s) => s.previewTime);
  if (!timeTravel) return null;
  return (
    <span className={cn(
      "flex shrink-0 items-center gap-1 rounded-full border border-primary/60 bg-accent text-accent-foreground",
      compact ? "py-0.5 pl-2.5 pr-0.5 text-xs" : "py-0.5 pl-3 pr-1 text-xs font-medium",
    )}>
      <History className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{compact ? "Preview" : `Previewing ${timeTravel.label}`}</span>
      <button
        type="button"
        onClick={() => previewTime(null)}
        className={cn(
          "rounded-full bg-primary font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring",
          compact ? "px-2 py-1" : "px-2.5 py-0.5",
        )}
      >
        {compact ? "Live" : "Back to live"}
      </button>
    </span>
  );
}

function OfflineNotice() {
  const offline = useOffice((s) => s.offline);
  if (!offline) return null;
  return (
    <p className="flex items-center gap-2 rounded-lg border border-needs/50 bg-card px-3 py-2 text-sm">
      <WifiOff className="size-4 shrink-0" aria-hidden /> Can&apos;t reach the office right now. Showing the last update.
    </p>
  );
}

function Brand() {
  return (
    <div data-head className="flex shrink-0 items-baseline gap-1.5">
      <span className="font-mono text-xs uppercase tracking-[0.08em] text-primary">rnldvrgl</span>
      <h1 className="text-2xl font-bold leading-none">HQ</h1>
    </div>
  );
}

function StatChip({ dot, children, className }: { dot: string; children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("shrink-0 gap-2 bg-card py-1", className)}>
      <span className={cn("size-2 rounded-full", dot)} aria-hidden />
      {children}
    </Badge>
  );
}

/** Bottom sheet with the selected desk (phones and tablets). */
function DeskSheet() {
  const selected = useOffice((s) => s.selected);
  const select = useOffice((s) => s.select);
  return (
    <Sheet open={!!selected} onOpenChange={(open) => { if (!open) select(null); }}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto overflow-x-hidden rounded-t-2xl px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))]">
        <SheetHeader className="sr-only">
          <SheetTitle>{selected ? teamById[selected].name : "Desk"}</SheetTitle>
          <SheetDescription>{selected ? teamById[selected].title : ""}</SheetDescription>
        </SheetHeader>
        {selected && <div className="pt-4"><DeskPanel id={selected} /></div>}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ desktop (≥1024px) */

/**
 * Full-viewport app shell: a one-line header, the 3D office filling the rest, and a side panel
 * that's exactly as tall as the office and scrolls inside itself, so nothing spills past the scene.
 */
function DesktopOffice() {
  const selected = useOffice((s) => s.selected);
  const select = useOffice((s) => s.select);
  const { working, waiting, reminders, provider } = useCounts();
  const header = useRef<HTMLElement>(null);
  const [tab, setTab] = useState("team");

  useGSAP(() => {
    gsap.from("[data-head]", { y: -10, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: "power2.out", clearProps: "all" });
  }, { scope: header });

  return (
    <div className="flex h-dvh flex-col gap-3 overflow-hidden px-4 pb-4 xl:px-6 xl:pb-6">
      <header ref={header} className="flex h-14 shrink-0 items-center justify-between gap-4 pt-2">
        <Brand />
        <div data-head className="flex min-w-0 items-center justify-end gap-2">
          <TimeTravelChip />
          <StatChip dot="bg-working">{working} working</StatChip>
          <StatChip dot="bg-needs">{waiting} need you</StatChip>
          <Badge variant="outline" className="hidden shrink-0 gap-1.5 bg-card py-1 xl:inline-flex">
            <Bell className="size-3.5" aria-hidden />{reminders} reminder{reminders === 1 ? "" : "s"}
          </Badge>
          <ClockBadge />
          <AiBadge provider={provider} />
        </div>
      </header>

      <OfflineNotice />

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="relative min-h-0 gap-0 overflow-hidden p-0">
          <div className="absolute inset-0">
            <OfficeScene />
          </div>
        </Card>

        <Card className="min-h-0 gap-0 overflow-hidden p-0">
          {selected ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-5">
              <DeskPanel id={selected} onClose={() => select(null)} />
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
              <div className="shrink-0 border-b px-5 pt-4 pb-3">
                <TabsList className="w-full">
                  <TabsTrigger value="team"><Users aria-hidden /> Team</TabsTrigger>
                  <TabsTrigger value="reminders">
                    <Bell aria-hidden /> Reminders
                    {reminders > 0 && <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[11px] tabular-nums">{reminders}</span>}
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="team" className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-5">
                <Roster heading={false} />
              </TabsContent>
              <TabsContent value="reminders" className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-5">
                <div className="grid gap-4">
                  <p className="text-sm text-muted-foreground">Ring emails you on time. Reminders from your iPhone show up here too.</p>
                  <Reminders />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </Card>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ phone / tablet (<1024px) */

type Tab = "office" | "team" | "reminders";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "office", label: "Office", icon: Building2 },
  { id: "team", label: "Team", icon: Users },
  { id: "reminders", label: "Reminders", icon: Bell },
];

/**
 * App-style layout for the iPhone (and the installed Home Screen app): a compact header,
 * one full-height view at a time, and a tab bar at the bottom above the home indicator.
 */
function PhoneOffice() {
  const [tab, setTab] = useState<Tab>("office");
  const { working, waiting, reminders, provider } = useCounts();

  const badgeFor = (id: Tab): number => (id === "team" ? waiting : id === "reminders" ? reminders : 0);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-[max(10px,env(safe-area-inset-top,0px))]">
        <Brand />
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground" aria-label={`${working} working, ${waiting} need you`}>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-working" aria-hidden />{working}</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-needs" aria-hidden />{waiting}</span>
          </span>
          <ClockBadge short className="px-1.5" />
          <AiBadge provider={provider} compact className="px-1.5 max-[359px]:hidden" />
        </div>
      </header>
      <div className="flex shrink-0 justify-center px-4 empty:hidden [&:has(>*)]:pb-2">
        <TimeTravelChip compact />
      </div>

      <main className="relative min-h-0 flex-1">
        {/* The 3D office stays mounted while you look at other tabs, so it doesn't reload. */}
        <section className={cn("absolute inset-0 px-2 pb-2", tab !== "office" && "invisible")} aria-hidden={tab !== "office"}>
          <div className="flex h-full flex-col gap-2">
            <OfflineNotice />
            <Card className="relative min-h-0 flex-1 gap-0 overflow-hidden p-0"><div className="absolute inset-0"><OfficeScene /></div></Card>
          </div>
        </section>
        {tab === "team" && <Scroll><OfflineNotice /><Roster /></Scroll>}
        {tab === "reminders" && (
          <Scroll>
            <div>
              <h2 className="text-xl font-semibold">Reminders</h2>
              <p className="text-sm text-muted-foreground">Ring emails you on time. Reminders from your iPhone show up here too.</p>
            </div>
            <Reminders />
          </Scroll>
        )}
      </main>

      <nav
        className="grid grid-cols-3 border-t bg-card/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur"
        aria-label="Sections"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = badgeFor(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                tab === id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <Icon className="size-5" aria-hidden />
                {count > 0 && (
                  <span className={cn(
                    "absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                    id === "team" ? "bg-needs text-white" : "bg-muted-foreground/20 text-foreground",
                  )}>
                    {count}
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </nav>

      <DeskSheet />
    </div>
  );
}

function Scroll({ children }: { children: ReactNode }) {
  return (
    <section className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4">
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
