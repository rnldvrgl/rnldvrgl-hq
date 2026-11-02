"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { WifiOff, Brain, Building2, Users, Bell, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useOffice } from "@/lib/store";
import { teamById, type AiProvider, type OfficeState } from "@/lib/team";
import { useIsDesktop } from "@/hooks/use-media";
import { cn } from "@/lib/utils";
import { formatManilaClock } from "@/lib/time";
import { OfficeScene } from "./OfficeScene";
import { DeskPanel, Reminders } from "./DeskPanel";
import { Roster } from "./Roster";

gsap.registerPlugin(useGSAP);

/** Ticks every 30 seconds, for the header clock. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

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

function useCounts(): { working: number; waiting: number; provider: AiProvider } {
  const employees = useOffice((s) => s.data.employees);
  const provider = useOffice((s) => s.data.ai.provider);
  return {
    working: employees.filter((e) => e.status === "working").length,
    waiting: employees.filter((e) => e.status === "needs_you" || e.status === "error").length,
    provider,
  };
}

function AiBadge({ provider }: { provider: AiProvider }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 bg-card py-1", provider === "gemini" && "border-needs/60", provider === "none" && "border-error/60")}
      title={provider === "gemini" ? "Running on the free Gemini backup until ANTHROPIC_API_KEY is added." : undefined}
    >
      <Brain className="size-3.5" aria-hidden />
      {provider === "claude" ? "Claude" : provider === "gemini" ? "Gemini backup" : "No AI key"}
    </Badge>
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
    <div data-head>
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-primary">rnldvrgl</p>
      <h1 className="text-3xl font-bold leading-none lg:text-4xl">HQ</h1>
    </div>
  );
}

/** Bottom sheet with the selected desk (phones and tablets). */
function DeskSheet() {
  const selected = useOffice((s) => s.selected);
  const select = useOffice((s) => s.select);
  return (
    <Sheet open={!!selected} onOpenChange={(open) => { if (!open) select(null); }}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))]">
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

function DesktopOffice() {
  const selected = useOffice((s) => s.selected);
  const select = useOffice((s) => s.select);
  const { working, waiting, provider } = useCounts();
  const now = useNow();
  const header = useRef<HTMLElement>(null);

  useGSAP(() => {
    gsap.from("[data-head]", { y: -10, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: "power2.out", clearProps: "all" });
  }, { scope: header });

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 px-[max(16px,env(safe-area-inset-left,0px))] py-6">
      <header ref={header} className="flex flex-wrap items-end justify-between gap-3">
        <Brand />
        <div data-head className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-2 bg-card py-1"><span className="size-2 rounded-full bg-working" />{working} working</Badge>
          <Badge variant="outline" className="gap-2 bg-card py-1"><span className="size-2 rounded-full bg-needs" />{waiting} need you</Badge>
          <Badge variant="outline" className="bg-card py-1 font-mono tabular-nums">{formatManilaClock(now)} · Manila</Badge>
          <AiBadge provider={provider} />
        </div>
      </header>

      <OfflineNotice />

      <main className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="overflow-hidden p-0">
          <div className="h-[min(72vh,760px)] w-full">
            <OfficeScene />
          </div>
        </Card>
        <Card className="sticky top-6">
          <CardContent>
            {selected ? <DeskPanel id={selected} onClose={() => select(null)} /> : <Roster />}
          </CardContent>
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
  const { working, waiting, provider } = useCounts();
  const reminders = useOffice((s) => s.data.reminders.length);
  const now = useNow();

  const badgeFor = (id: Tab): number => (id === "team" ? waiting : id === "reminders" ? reminders : 0);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex items-end justify-between gap-3 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top,0px))]">
        <Brand />
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="font-mono text-sm tabular-nums">{formatManilaClock(now)}</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-working" />{working}</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-needs" />{waiting}</span>
            <AiBadge provider={provider} />
          </span>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        {/* The 3D office stays mounted while you look at other tabs, so it doesn't reload. */}
        <section className={cn("absolute inset-0 px-2", tab !== "office" && "invisible")} aria-hidden={tab !== "office"}>
          <div className="flex h-full flex-col gap-2">
            <OfflineNotice />
            <Card className="min-h-0 flex-1 overflow-hidden p-0"><OfficeScene /></Card>
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
    <section className="absolute inset-0 overflow-y-auto overscroll-contain px-4 pb-4">
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
