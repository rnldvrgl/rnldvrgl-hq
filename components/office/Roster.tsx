"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useOffice } from "@/lib/store";
import { TEAM, teamById } from "@/lib/team";
import { cn } from "@/lib/utils";
import { ICONS, LAMP, type LampKey } from "./icons";
import { SHIRTS } from "./palette";

gsap.registerPlugin(useGSAP);

/** The team list: a second way into every desk, and the main one on small phones. */
export function Roster() {
  const employees = useOffice((s) => s.data.employees);
  const select = useOffice((s) => s.select);
  const hover = useOffice((s) => s.hover);
  const scope = useRef<HTMLDivElement>(null);
  const waiting = employees.filter((e) => e.status === "needs_you" || e.status === "error");

  useGSAP(() => {
    gsap.from("li", { x: -12, autoAlpha: 0, duration: 0.35, stagger: 0.04, ease: "power2.out", clearProps: "all" });
  }, { scope });

  return (
    <div ref={scope} className="grid gap-3">
      <div>
        <h2 className="text-xl font-semibold">Team</h2>
        <p className="text-sm text-muted-foreground">Pick a desk or a name to see reports, run someone now, or pause them.</p>
      </div>
      <ul className="grid gap-1">
        {TEAM.map((m) => {
          const e = employees.find((x) => x.id === m.id);
          const Icon = ICONS[m.icon];
          const lamp: LampKey = !e?.enabled ? "off" : e.status;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => select(m.id)}
                onMouseEnter={() => hover(m.id)}
                onMouseLeave={() => hover(null)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: SHIRTS[m.color - 1] }}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span><b className="font-semibold">{m.name}</b> <span className="text-sm text-muted-foreground">{m.title}</span></span>
                  <span className="truncate text-sm text-muted-foreground">{!e?.enabled ? "Paused" : e.summary ?? "Hasn't started yet"}</span>
                </span>
                <span className={cn("size-2.5 shrink-0 rounded-full", LAMP[lamp])} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {waiting.length > 0 && (
        <p className="text-sm text-needs">
          {waiting.map((w) => teamById[w.id].name).join(", ")} {waiting.length === 1 ? "is" : "are"} waiting for you.
        </p>
      )}
    </div>
  );
}
