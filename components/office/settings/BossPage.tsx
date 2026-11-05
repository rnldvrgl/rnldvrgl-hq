"use client";

import {
  Armchair, Briefcase, Building2, CarFront, Castle, Crown, Flower2, Gamepad2, Leaf, Mic, Mountain, Sparkles, Sun, Truck, TreePalm,
  Zap, Gem, Feather, Flame, type LucideIcon,
} from "lucide-react";
import { ownerName } from "@/lib/names";
import {
  CAR_MODELS, HOUSE_STYLES, OFFICE_STYLES, useSettings, type CarChoice, type HouseChoice, type OfficeStyle,
} from "@/lib/settings";
import { Card, ChoiceGrid, Group, Segmented, SwitchRow, tile, type Choice } from "./kit";

/** An icon and two colours for each option, so the cards show what they are at a glance. */
const OFFICE_LOOK: Record<OfficeStyle, [LucideIcon, string, string]> = {
  auto: [Sparkles, "#64748b", "#94a3b8"], executive: [Briefcase, "#5b3a24", "#a0714a"], gaming: [Gamepad2, "#6d28d9", "#ec4899"],
  cozy: [Armchair, "#e58fa8", "#f6c6d3"], minimal: [Feather, "#a8a29e", "#d6d3d1"], studio: [Mic, "#1f2937", "#ef4444"], heritage: [Leaf, "#7c4a1e", "#d4a24c"],
};
const CAR_LOOK: Record<CarChoice, [LucideIcon, string, string]> = {
  auto: [Sparkles, "#64748b", "#94a3b8"], typer: [Flame, "#b91c1c", "#f87171"], mini: [Gem, "#e58fa8", "#f9c8d6"], suv: [CarFront, "#111827", "#4b5563"],
  pickup: [Truck, "#57534e", "#a8a29e"], sports: [Zap, "#dc2626", "#fb923c"], ev: [Zap, "#0ea5e9", "#a5f3fc"],
};
const HOUSE_LOOK: Record<HouseChoice, [LucideIcon, string, string]> = {
  auto: [Sparkles, "#64748b", "#94a3b8"], modern: [Building2, "#334155", "#a0714a"], pastel: [Flower2, "#ec4899", "#fbcfe8"],
  heritage: [Castle, "#78350f", "#d6a35c"], mediterranean: [Sun, "#c2410c", "#38bdf8"], tropical: [TreePalm, "#047857", "#facc15"], japandi: [Mountain, "#27272a", "#a8a29e"],
};

const withLook = <T extends string>(list: readonly { id: T; label: string; hint: string }[], look: Record<T, [LucideIcon, string, string]>): Choice<T>[] =>
  list.map((o) => ({ ...o, icon: look[o.id][0], tile: tile(look[o.id][1], look[o.id][2]) }));

export function BossPage() {
  const boss = useSettings((s) => s.boss);
  const setBoss = useSettings((s) => s.setBoss);
  return (
    <>
      <Group title="Look" hint={`How ${ownerName()} looks in the 3D office. "Match the boss" below follows this.`}>
        <Segmented label="Boss look" value={boss.look} onChange={(look) => setBoss({ look })}
          options={[{ id: "him", label: "Him · street style", icon: Crown }, { id: "her", label: "Her · soft street", icon: Flower2 }]} />
        <Card><SwitchRow label="Walks around on their own" hint="Office rounds and coffee runs through the day" checked={boss.wanders} onChange={(wanders) => setBoss({ wanders })} /></Card>
      </Group>
      <Group title="House" hint={`${ownerName()}'s home on the double lot behind the office.`}>
        <ChoiceGrid label="House style" value={boss.house} onChange={(house) => setBoss({ house })} options={withLook(HOUSE_STYLES, HOUSE_LOOK)} />
      </Group>
      <Group title="Office" hint="The corner office's interior.">
        <ChoiceGrid label="Office style" value={boss.office} onChange={(office) => setBoss({ office })} options={withLook(OFFICE_STYLES, OFFICE_LOOK)} />
      </Group>
      <Group title="Car" hint={`Parked in the carport; drives ${ownerName()} home at the end of the day.`}>
        <ChoiceGrid label="Boss's car" value={boss.car} onChange={(car) => setBoss({ car })} options={withLook(CAR_MODELS, CAR_LOOK)} />
      </Group>
    </>
  );
}
