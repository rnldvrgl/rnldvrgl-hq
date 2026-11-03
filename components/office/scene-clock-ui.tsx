"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Sunrise, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { sceneNow, useOffice } from "@/lib/store";
import { manilaMinutes, phaseAt, type Phase } from "@/lib/office-clock";

export const PHASE_ICON: Record<Phase, LucideIcon> = {
  morning: Sunrise,
  lunch: UtensilsCrossed,
  afternoon: Sun,
  night: Moon,
};

export const PHASE_LABEL: Record<Phase, string> = {
  morning: "Morning",
  lunch: "Lunch",
  afternoon: "Afternoon",
  night: "Night",
};

/** The scene clock (live, or the previewed time of day), re-rendering every `ms` and whenever time travel changes. */
export function useSceneNow(ms = 1000): Date {
  const timeTravel = useOffice((s) => s.timeTravel);
  const [now, setNow] = useState(() => sceneNow());
  useEffect(() => {
    setNow(sceneNow());
    const t = setInterval(() => setNow(sceneNow()), ms);
    return () => clearInterval(t);
  }, [ms, timeTravel]);
  return now;
}

export const phaseOf = (d: Date): Phase => phaseAt(manilaMinutes(d));
