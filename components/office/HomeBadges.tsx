"use client";
import { isOnTeam } from "@/lib/prefs-client";

import { useMemo } from "react";
import { House, Pause, Footprints, Briefcase } from "lucide-react";
import { useOffice } from "@/lib/store";
import { isWeekday, manilaMinutes } from "@/lib/office-clock";
import { TEAM } from "@/lib/team";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Label } from "./Labels";
import { useBubbleMode } from "./Bubble";
import { activityOf } from "./Employee3D";
import { HOMES, type Home } from "./homes";
import { useSceneNow } from "./scene-clock-ui";

/**
 * A name badge floating over each employee's house on the street behind the office ("Maya's house"),
 * in their colour, saying whether they're home, on the way, or at work. Settings → Show → House name badges.
 */

type Where = "home" | "away" | "work" | "paused";

const WHERE: Record<Where, { label: string; icon: typeof House }> = {
  home: { label: "Home", icon: House },
  away: { label: "On the way", icon: Footprints },
  work: { label: "At work", icon: Briefcase },
  paused: { label: "Day off", icon: Pause },
};

export function HomeBadges() {
  const now = useSceneNow(5000);
  const employees = useOffice((s) => s.data.employees);
  useSettings((s) => s.hours);
  useSettings((s) => s.routine.commute);
  const min = manilaMinutes(now);
  const weekday = isWeekday(now);
  return (
    <>
      {HOMES.filter((h) => h.who !== "owner" && isOnTeam(h.who)).map((h) => {
        let where: Where;
        {
          const index = TEAM.findIndex((m) => m.id === h.who);
          const e = employees.find((x) => x.id === h.who);
          const a = activityOf(min, weekday, TEAM[index], index, e?.status ?? "idle", e?.enabled ?? true, null);
          where = a.kind === "away" ? (a.why === "paused" ? "paused" : "home") : a.kind === "route" && (a.purpose === "leaving" || a.purpose === "arriving") ? "away" : "work";
        }
        return <Badge key={h.who} home={h} where={where} />;
      })}
    </>
  );
}

function Badge({ home, where }: { home: Home; where: Where }) {
  const spec = useMemo(() => ({ render: () => <BadgeCard home={home} where={where} />, layer: 5 }), [home, where]);
  return <Label id={`home-${home.who}`} position={home.badge} spec={spec} />;
}

function BadgeCard({ home, where }: { home: Home; where: Where }) {
  const mode = useBubbleMode((s) => s.mode);
  const { label, icon: Icon } = WHERE[where];
  const Mark = House;
  const lit = where === "home";
  if (mode === "dot") {
    return (
      <span className="grid size-5 place-items-center rounded-full border-2 border-card shadow-md" style={{ background: home.color, color: "#fff" }} aria-label={`${home.name}'s house`}>
        <Mark className="size-3" aria-hidden />
      </span>
    );
  }
  return (
    <div
      className={cn("flex select-none items-center gap-1.5 whitespace-nowrap rounded-xl border bg-card/90 py-0.5 pl-0.5 pr-2 text-card-foreground shadow-md backdrop-blur transition-opacity", !lit && "opacity-80")}
      style={{ borderColor: home.color, fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif" }}
      aria-label={`${home.name}'s house: ${label}`}
    >
      <span className="grid size-5 place-items-center rounded-lg" style={{ background: home.color, color: "#fff" }}>
        <Mark className="size-3" aria-hidden />
      </span>
      <span className="text-xs font-semibold">{home.name}&rsquo;s house</span>
      <span className={cn("flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide", lit ? "bg-amber-400/90 text-amber-950" : "bg-muted text-muted-foreground")}>
        <Icon className="size-2.5" aria-hidden />
        {label}
      </span>
    </div>
  );
}
