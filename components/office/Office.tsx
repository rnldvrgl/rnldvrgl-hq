"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Activity, Bell, BellRing, Building2, History, Sparkles, Users, WifiOff, type LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useOffice } from "@/lib/store";
import { isEmployeeId, teamById, type AiProvider, type OfficeState } from "@/lib/team";
import { useIsDesktop } from "@/hooks/use-media";
import { cn } from "@/lib/utils";
import { ThemePicker } from "@/components/ThemePicker";
import { SoundToggle } from "@/components/SoundToggle";
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
  // A push notification opens /?desk=<id>: open that desk, then tidy the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    const desk = url.searchParams.get("desk");
    if (desk && isEmployeeId(desk)) select(desk);
    if (desk) {
      url.searchParams.delete("desk");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, [select]);
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

/* Surfaces: one look for every card and pill, so the shell reads as one product. */
/* Everything sits on frosted glass (the `glass` utility in globals.css): translucent, hairline light edge, soft shadow. */
const SURFACE = "glass rounded-3xl";
const GLASS = "glass";
const PILL = cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-full pl-1 pr-3 text-xs font-medium", GLASS);

type Tone = "working" | "needs" | "muted" | "primary" | "ok" | "warn";
const CHIP: Record<Tone, string> = {
  working: "bg-working/15 text-working",
  needs: "bg-needs/15 text-needs",
  muted: "bg-muted text-muted-foreground",
  primary: "bg-accent text-accent-foreground",
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warn: "bg-error/15 text-error",
};

/** Round icon chip used inside pills. */
function IconChip({ icon: Icon, tone, className }: { icon: LucideIcon; tone: Tone; className?: string }) {
  return (
    <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", CHIP[tone], className)}>
      <Icon className="size-3.5" aria-hidden />
    </span>
  );
}

function AiBadge({ provider, compact = false, className }: { provider: AiProvider; compact?: boolean; className?: string }) {
  const backup = provider === "gemini" || provider === "groq";
  const label = provider === "claude" ? "Claude" : backup ? (compact ? "Backup" : provider === "groq" ? "Groq backup" : "Gemini backup") : (compact ? "No AI" : "No AI key");
  const tone: Tone = provider === "claude" ? "ok" : backup ? "needs" : "warn";
  return (
    <span
      className={cn(PILL, className)}
      title={backup ? `Running on the free ${provider === "groq" ? "Groq" : "Gemini"} backup until ANTHROPIC_API_KEY is added.` : provider === "claude" ? "Running on Claude" : "No AI key set"}
    >
      <IconChip icon={Sparkles} tone={tone} />
      <span className="flex items-center gap-1.5">
        {label}
        <span className={cn("size-1.5 rounded-full", provider === "claude" ? "bg-emerald-500" : backup ? "bg-needs" : "bg-error")} aria-hidden />
      </span>
    </span>
  );
}

const TIME_ONLY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });
const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short" });

/** Philippine time (Mabalacat City) with the time-of-day icon (follows the scene clock, so a preview shows here too). */
function ClockBadge({ short = false, className }: { short?: boolean; className?: string }) {
  const now = useSceneNow(5000);
  const phase = phaseOf(now);
  const Icon = PHASE_ICON[phase];
  return (
    <span className={cn(PILL, className)} title={`${PHASE_LABEL[phase]} in Mabalacat City, Pampanga`}>
      <IconChip icon={Icon} tone="primary" />
      <span className="flex items-baseline gap-1.5">
        {!short && <span className="text-muted-foreground">{WEEKDAY.format(now)}</span>}
        <span className="font-mono text-[13px] font-semibold tabular-nums">{TIME_ONLY.format(now)}</span>
        {!short && <span className="hidden text-muted-foreground xl:inline">Mabalacat</span>}
      </span>
    </span>
  );
}

/** Shown while the 3D office is previewing another time of day. */
function TimeTravelChip({ compact = false }: { compact?: boolean }) {
  const timeTravel = useOffice((s) => s.timeTravel);
  const previewTime = useOffice((s) => s.previewTime);
  if (!timeTravel) return null;
  return (
    <span className={cn(PILL, "min-w-0 border-ring/40 bg-accent pr-1 text-accent-foreground")}>
      <IconChip icon={History} tone="primary" />
      <span className="truncate">{compact ? "Preview" : `Previewing ${timeTravel.label}`}</span>
      <button
        type="button"
        onClick={() => previewTime(null)}
        className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
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
    <p className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm", GLASS, "border-needs/50")}>
      <WifiOff className="size-4 shrink-0 text-needs" aria-hidden /> Can&apos;t reach the office right now. Showing the last update.
    </p>
  );
}

/** The HQ cube, as in the app icon. */
function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_6px_16px_-6px_rgb(0_0_0/0.55)]", className)}
      style={{ background: "linear-gradient(145deg, var(--logo-a), var(--logo-b))" }}
      aria-hidden
    >
      <svg viewBox="12 12 40 40" className="size-[62%]">
        <polygon points="32,14 52,24 32,34 12,24" fill="#e7b04a" />
        <polygon points="12,24 32,34 32,48 12,38" fill="#c98f2c" />
        <polygon points="52,24 32,34 32,48 52,38" fill="#a8761f" />
      </svg>
    </span>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div data-head className="flex shrink-0 items-center gap-2.5">
      <Logo className={compact ? "size-9" : "size-10"} />
      <div className="grid leading-none">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">rnldvrgl</span>
        <h1 className={cn("mt-1 font-bold tracking-tight", compact ? "text-lg" : "text-xl")}>
          HQ<span className="text-ring">.</span>
        </h1>
      </div>
    </div>
  );
}

/** One segmented pill with the office's numbers: working, need you, (reminders). */
function Metrics({ working, waiting, reminders, compact = false }: { working: number; waiting: number; reminders?: number; compact?: boolean }) {
  return (
    <div className={cn("flex h-9 shrink-0 items-center rounded-full p-1", GLASS)} role="group" aria-label="Office status">
      <Metric icon={Activity} tone="working" value={working} label="working" compact={compact} />
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
      <Metric icon={BellRing} tone="needs" value={waiting} label="need you" compact={compact} highlight={waiting > 0} />
      {reminders !== undefined && (
        <>
          <span className="mx-0.5 hidden h-4 w-px bg-border xl:block" aria-hidden />
          <Metric icon={Bell} tone="muted" value={reminders} label={reminders === 1 ? "reminder" : "reminders"} className="hidden xl:flex" />
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, tone, value, label, compact, highlight, className }: {
  icon: LucideIcon; tone: Tone; value: number; label: string; compact?: boolean; highlight?: boolean; className?: string;
}) {
  return (
    <span
      className={cn("flex h-7 items-center gap-1.5 rounded-full pr-2.5 pl-1 text-xs transition-colors", highlight && "bg-needs/10", className)}
      aria-label={`${value} ${label}`}
    >
      <span className={cn("grid size-5 place-items-center rounded-full", CHIP[tone])}><Icon className="size-3" aria-hidden /></span>
      <span className="font-semibold tabular-nums">{value}</span>
      {!compact && <span className="text-muted-foreground">{label}</span>}
    </span>
  );
}

/** Bottom sheet with the selected desk (phones and tablets). */
function DeskSheet() {
  const selected = useOffice((s) => s.selected);
  const select = useOffice((s) => s.select);
  return (
    <Sheet open={!!selected} onOpenChange={(open) => { if (!open) select(null); }}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto overflow-x-hidden rounded-t-3xl px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))]">
        <SheetHeader className="sr-only">
          <SheetTitle>{selected ? teamById[selected].name : "Desk"}</SheetTitle>
          <SheetDescription>{selected ? teamById[selected].title : ""}</SheetDescription>
        </SheetHeader>
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/25" aria-hidden />
        {selected && <div className="pt-3"><DeskPanel id={selected} /></div>}
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ desktop (≥1024px) */

/**
 * Full-viewport app shell: a floating glass header, the 3D office filling the rest, and a side panel
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
    <div className="flex h-dvh flex-col gap-4 overflow-hidden p-4 xl:gap-5 xl:p-5">
      <header ref={header} className={cn("flex h-16 shrink-0 items-center justify-between gap-4 rounded-2xl px-3", GLASS)}>
        <Brand />
        <div data-head className="flex min-w-0 items-center justify-end gap-2">
          <TimeTravelChip />
          <Metrics working={working} waiting={waiting} reminders={reminders} />
          <ClockBadge />
          <AiBadge provider={provider} />
          <SoundToggle />
          <ThemePicker />
        </div>
      </header>

      <OfflineNotice />

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-5">
        <section className={cn(SURFACE, "relative min-h-0 overflow-hidden scene-backdrop")} aria-label="The office">
          <div className="absolute inset-0">
            <OfficeScene />
          </div>
        </section>

        <aside className={cn(SURFACE, "flex min-h-0 flex-col overflow-hidden")}>
          {selected ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-5">
              <DeskPanel id={selected} onClose={() => select(null)} />
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
              <div className="shrink-0 px-4 pt-4 pb-3">
                <TabsList className="h-10 w-full rounded-xl p-1">
                  <TabsTrigger value="team" className="rounded-lg"><Users aria-hidden /> Team</TabsTrigger>
                  <TabsTrigger value="reminders" className="rounded-lg">
                    <Bell aria-hidden /> Reminders
                    {reminders > 0 && <span className="rounded-full bg-primary/12 px-1.5 text-[11px] font-semibold tabular-nums text-primary">{reminders}</span>}
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="team" className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-5">
                <Roster heading={false} />
              </TabsContent>
              <TabsContent value="reminders" className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-5">
                <div className="grid gap-4">
                  <p className="text-sm text-muted-foreground">Ring emails you on time. Reminders from your iPhone show up here too.</p>
                  <Reminders />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </aside>
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
 * App-style layout for the iPhone (and the installed Home Screen app): a compact glass header,
 * one full-height view at a time, and a floating tab bar above the home indicator.
 */
function PhoneOffice() {
  const [tab, setTab] = useState<Tab>("office");
  const { working, waiting, reminders, provider } = useCounts();

  const badgeFor = (id: Tab): number => (id === "team" ? waiting : id === "reminders" ? reminders : 0);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top,0px))]">
        <div className={cn("flex h-14 items-center justify-between gap-2 rounded-2xl pl-2 pr-1.5", GLASS)}>
          <Brand compact />
          <div className="flex min-w-0 items-center gap-1.5">
            <Metrics working={working} waiting={waiting} compact />
            <ClockBadge short className="max-[389px]:hidden" />
            <AiBadge provider={provider} compact className="hidden sm:inline-flex" />
            <SoundToggle compact />
            <ThemePicker compact />
          </div>
        </div>
      </header>
      <div className="flex shrink-0 justify-center px-4 empty:hidden [&:has(>*)]:pb-2">
        <TimeTravelChip compact />
      </div>

      <main className="relative min-h-0 flex-1">
        {/* The 3D office stays mounted while you look at other tabs, so it doesn't reload. */}
        <section className={cn("absolute inset-0 px-3 pb-2", tab !== "office" && "invisible")} aria-hidden={tab !== "office"}>
          <div className="flex h-full flex-col gap-2">
            <OfflineNotice />
            <div className={cn(SURFACE, "scene-backdrop relative min-h-0 flex-1 overflow-hidden")}><div className="absolute inset-0"><OfficeScene /></div></div>
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

      <div className="shrink-0 px-3 pt-1 pb-[max(10px,env(safe-area-inset-bottom,0px))]">
        <nav className={cn("grid grid-cols-3 gap-1 rounded-2xl p-1.5", GLASS)} aria-label="Sections">
          {TABS.map(({ id, label, icon: Icon }) => {
            const count = badgeFor(id);
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" aria-hidden />
                  {count > 0 && (
                    <span className={cn(
                      "absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold tabular-nums ring-2 ring-card",
                      id === "team" ? "bg-needs text-white" : "bg-primary text-primary-foreground",
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
      </div>

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
