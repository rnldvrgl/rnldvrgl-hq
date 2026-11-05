"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import {
  ChevronLeft, ChevronRight, Crown, Gauge, Palette, PartyPopper, PlugZap, Search, UserPlus, UserRound, Users, Volume2, X, type LucideIcon,
} from "lucide-react";
import { useIsDesktop } from "@/hooks/use-media";
import { useSettingsNav, type SettingsPage } from "@/lib/settings-nav";
import { useHandle, useTeamIds } from "@/lib/prefs-client";
import { appNameOf } from "@/lib/prefs";
import { ownerName } from "@/lib/names";
import { TEAM } from "@/lib/team";
import { cn } from "@/lib/utils";
import { Connections } from "./Connections";
import { Friends } from "./Friends";
import { Scope } from "./settings/kit";
import { AppearancePage } from "./settings/AppearancePage";
import { TeamPage } from "./settings/TeamPage";
import { BossPage } from "./settings/BossPage";
import { PerformancePage } from "./settings/PerformancePage";
import { SoundPage } from "./settings/SoundPage";
import { HolidaysPage } from "./settings/HolidaysPage";
import { AccountPage } from "./settings/AccountPage";

/**
 * Settings, in one place: a list of pages down the side (a search box on top), the open page beside it.
 * On a phone the list fills the sheet and a page slides in over it, with a back button. Each page says
 * where its settings are kept: with your HQ (every device) or on this device only.
 */

type PageDef = {
  id: SettingsPage;
  label: string;
  icon: LucideIcon;
  /** One line under the label in the list. */
  blurb: string;
  /** Words people might search for. */
  keywords: string;
  synced: boolean;
  group: "Your HQ" | "This device" | "Accounts";
  /** The page's colour in the list. */
  tint: string;
};

const PAGES: readonly PageDef[] = [
  { id: "appearance", label: "Appearance", icon: Palette, blurb: "HQ name, app icon, colours", keywords: "theme dark light colour color style icon logo name title home screen", synced: true, group: "Your HQ", tint: "#8b5cf6" },
  { id: "team", label: "Team", icon: Users, blurb: "Who works here, names, hours, routine", keywords: "employees desks hire names rename hours commute lunch standup routine schedule", synced: true, group: "Your HQ", tint: "#0ea5e9" },
  { id: "boss", label: "Boss", icon: Crown, blurb: "Look, house, office, car", keywords: "boss look him her house mansion home office interior car vehicle wander", synced: true, group: "Your HQ", tint: "#f59e0b" },
  { id: "holidays", label: "Holidays", icon: PartyPopper, blurb: "Decorations and previews", keywords: "christmas halloween new year valentine fiesta decorations fireworks preview", synced: false, group: "This device", tint: "#ec4899" },
  { id: "office", label: "Performance", icon: Gauge, blurb: "Presets, what's drawn, animation", keywords: "battery saver fps fast slow quality shadows traffic trees weather walkers animation motion layers", synced: false, group: "This device", tint: "#10b981" },
  { id: "sound", label: "Sound", icon: Volume2, blurb: "Music, chimes, volume", keywords: "music radio volume mixer chime alert audio fireworks", synced: false, group: "This device", tint: "#f97316" },
  { id: "connections", label: "Connections", icon: PlugZap, blurb: "AI keys, Google, GitHub, your CV", keywords: "ai key gemini groq claude google gmail calendar github cv resume profile connect", synced: true, group: "Accounts", tint: "#6366f1" },
  { id: "friends", label: "Friends", icon: UserPlus, blurb: "Invite links, who's joined", keywords: "invite friend link share join", synced: true, group: "Accounts", tint: "#14b8a6" },
  { id: "account", label: "Account", icon: UserRound, blurb: "Passkeys, notifications, sign out", keywords: "passkey sign out logout notifications push reset defaults", synced: false, group: "Accounts", tint: "#64748b" },
];
const GROUPS = ["Your HQ", "This device", "Accounts"] as const;

export function SettingsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const isDesktop = useIsDesktop();
  const page = useSettingsNav((s) => s.page);
  const go = useSettingsNav((s) => s.go);
  const [query, setQuery] = useState("");
  // the desktop always has a page open beside the list
  const current = page ?? (isDesktop ? "appearance" : null);
  const def = PAGES.find((p) => p.id === current) ?? null;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQuery(""); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex overflow-hidden border border-border bg-background text-foreground shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in",
            isDesktop
              ? "top-1/2 left-1/2 h-[min(44rem,calc(100dvh-3rem))] w-[min(60rem,calc(100vw-3rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl data-[state=open]:zoom-in-95"
              : "inset-x-0 bottom-0 h-[92dvh] flex-col rounded-t-3xl data-[state=open]:slide-in-from-bottom",
          )}
        >
          <Dialog.Title className="sr-only">Settings{def ? `: ${def.label}` : ""}</Dialog.Title>
          {isDesktop ? (
            <>
              <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-muted/30">
                <div className="px-4 pt-5 pb-3">
                  <p className="text-lg font-semibold tracking-tight">Settings</p>
                  <SearchBox value={query} onChange={setQuery} />
                </div>
                <nav aria-label="Settings pages" className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
                  <PageList query={query} current={current} onPick={(id) => { go(id); setQuery(""); }} compact />
                </nav>
              </aside>
              <main className="flex min-w-0 flex-1 flex-col">
                {def && <PageHeader def={def} />}
                <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-6 px-6 pt-2 pb-10 [&>*]:min-w-0">
                    {def && <PageBody id={def.id} onClose={() => onOpenChange(false)} />}
                  </div>
                </div>
              </main>
              <CloseButton />
            </>
          ) : def ? (
            <>
              <div className="flex items-center gap-1 border-b border-border px-2 pt-3 pb-2">
                <button type="button" onClick={() => go(null)} className="flex min-h-11 items-center gap-0.5 rounded-xl pr-3 pl-1.5 text-sm font-medium text-primary hover:bg-muted">
                  <ChevronLeft className="size-5" aria-hidden /> Settings
                </button>
                <span className="ml-auto" />
                <CloseButton inline />
              </div>
              <PageHeader def={def} />
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="grid grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-1 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] [&>*]:min-w-0">
                  <PageBody id={def.id} onClose={() => onOpenChange(false)} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
              <div className="flex items-center justify-between px-4 pt-2">
                <p className="text-xl font-semibold tracking-tight">Settings</p>
                <CloseButton inline />
              </div>
              <div className="px-4 pb-2"><SearchBox value={query} onChange={setQuery} /></div>
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
                <HqSummary onPick={go} />
                <PageList query={query} current={null} onPick={(id) => { go(id); setQuery(""); }} />
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative mt-3 block">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search settings"
        aria-label="Search settings"
        className="h-10 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />
    </label>
  );
}

/** The pages, in their groups; with a search, just the ones that match. */
function PageList({ query, current, onPick, compact = false }: { query: string; current: SettingsPage | null; onPick: (id: SettingsPage) => void; compact?: boolean }) {
  const q = query.trim().toLowerCase();
  const hits = useMemo(() => PAGES.filter((p) => !q || `${p.label} ${p.blurb} ${p.keywords}`.toLowerCase().includes(q)), [q]);
  if (!hits.length) return <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</p>;
  return (
    <div className="grid gap-4">
      {GROUPS.map((g) => {
        const list = hits.filter((p) => p.group === g);
        if (!list.length) return null;
        return (
          <div key={g} className="grid gap-1">
            <p className="px-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g}</p>
            <ul className={cn("grid", !compact && "overflow-hidden rounded-2xl border border-border bg-card/60 divide-y divide-border/70")}>
              {list.map((p) => {
                const on = current === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button" onClick={() => onPick(p.id)} aria-current={on ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                        compact ? "min-h-11 rounded-xl px-2.5 py-1.5" : "min-h-14 px-3 py-2",
                        on ? "bg-accent text-accent-foreground" : "hover:bg-muted/70",
                      )}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-[0.6rem] text-white shadow-sm" style={{ background: p.tint }} aria-hidden>
                        <p.icon className="size-[18px]" />
                      </span>
                      <span className="grid min-w-0 flex-1 leading-tight">
                        <span className="truncate text-sm font-medium">{p.label}</span>
                        <span className="truncate text-xs text-muted-foreground">{p.blurb}</span>
                      </span>
                      {!compact && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** On the phone's main list: this HQ at a glance, tapping through to Appearance or Team. */
function HqSummary({ onPick }: { onPick: (id: SettingsPage) => void }) {
  const handle = useHandle();
  const team = useTeamIds();
  return (
    <button type="button" onClick={() => onPick("appearance")} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-card/60 p-3 text-left hover:bg-muted/60">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground" aria-hidden>
        {ownerName().slice(0, 1).toUpperCase()}
      </span>
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate font-semibold">{appNameOf(handle)}</span>
        <span className="truncate text-xs text-muted-foreground">{ownerName()} · {team.length} of {TEAM.length} employees</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function PageHeader({ def }: { def: PageDef }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
      <h2 className="text-xl font-semibold tracking-tight">{def.label}</h2>
      <Scope synced={def.synced} />
      <p className="w-full text-sm text-muted-foreground">{def.blurb}.</p>
    </header>
  );
}

function PageBody({ id, onClose }: { id: SettingsPage; onClose: () => void }): ReactNode {
  switch (id) {
    case "appearance": return <AppearancePage />;
    case "team": return <TeamPage />;
    case "boss": return <BossPage />;
    case "office": return <PerformancePage />;
    case "sound": return <SoundPage />;
    case "holidays": return <HolidaysPage onPreview={onClose} />;
    case "connections": return <Connections />;
    case "friends": return <Friends />;
    case "account": return <AccountPage />;
  }
}

function CloseButton({ inline = false }: { inline?: boolean }) {
  return (
    <Dialog.Close
      aria-label="Close settings"
      className={cn("grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        !inline && "absolute top-3 right-3")}
    >
      <X className="size-5" aria-hidden />
    </Dialog.Close>
  );
}
