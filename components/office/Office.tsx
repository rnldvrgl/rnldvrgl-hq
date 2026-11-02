"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { WifiOff, Brain } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useOffice } from "@/lib/store";
import { teamById, type OfficeState } from "@/lib/team";
import { useIsDesktop } from "@/hooks/use-media";
import { cn } from "@/lib/utils";
import { OfficeScene } from "./OfficeScene";
import { DeskPanel } from "./DeskPanel";
import { Roster } from "./Roster";

gsap.registerPlugin(useGSAP);

export default function Office({ initial }: { initial: OfficeState }) {
  // Seed the store once with the server-loaded data (this component only ever renders in the browser).
  useState(() => useOffice.getState().hydrate(initial));

  const isDesktop = useIsDesktop();
  const selected = useOffice((s) => s.selected);
  const select = useOffice((s) => s.select);
  const refresh = useOffice((s) => s.refresh);
  const offline = useOffice((s) => s.offline);
  const employees = useOffice((s) => s.data.employees);
  const provider = useOffice((s) => s.data.ai.provider);
  const [now, setNow] = useState(() => new Date());
  const header = useRef<HTMLElement>(null);

  const working = employees.filter((e) => e.status === "working").length;
  const waiting = employees.filter((e) => e.status === "needs_you" || e.status === "error").length;

  // Poll faster while anyone is working, so the desk lights up and settles on time.
  useEffect(() => {
    const t = setInterval(refresh, working ? 3000 : 15000);
    return () => clearInterval(t);
  }, [refresh, working]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  // Esc closes the open desk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") select(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  useGSAP(() => {
    gsap.from("[data-head]", { y: -10, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: "power2.out", clearProps: "all" });
  }, { scope: header });

  const clock = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", hour: "numeric", minute: "2-digit" }).format(now);

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 px-[max(16px,env(safe-area-inset-left,0px))] py-5 lg:py-6">
      <header ref={header} className="flex flex-wrap items-end justify-between gap-3">
        <div data-head>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-primary">rnldvrgl</p>
          <h1 className="text-3xl font-bold leading-none lg:text-4xl">HQ</h1>
        </div>
        <div data-head className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-2 bg-card py-1"><span className="size-2 rounded-full bg-working" />{working} working</Badge>
          <Badge variant="outline" className="gap-2 bg-card py-1"><span className="size-2 rounded-full bg-needs" />{waiting} need you</Badge>
          <Badge variant="outline" className="bg-card py-1 font-mono tabular-nums">{clock} · Manila</Badge>
          <Badge
            variant="outline"
            className={cn("gap-1.5 bg-card py-1", provider === "gemini" && "border-needs/60", provider === "none" && "border-error/60")}
            title={provider === "gemini" ? "Running on the free Gemini backup until ANTHROPIC_API_KEY is added." : undefined}
          >
            <Brain className="size-3.5" aria-hidden />
            {provider === "claude" ? "Claude" : provider === "gemini" ? "Gemini backup" : "No AI key"}
          </Badge>
        </div>
      </header>

      {offline && (
        <p className="flex items-center gap-2 rounded-lg border border-needs/50 bg-card px-3 py-2 text-sm">
          <WifiOff className="size-4" aria-hidden /> Can&apos;t reach the office right now. Showing the last update.
        </p>
      )}

      <main className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="overflow-hidden p-0">
          <div className="aspect-[4/3] w-full sm:aspect-[16/11] lg:aspect-auto lg:h-[min(72vh,760px)]">
            <OfficeScene />
          </div>
        </Card>

        {isDesktop ? (
          <Card className="lg:sticky lg:top-6">
            <CardContent>
              {selected ? <DeskPanel id={selected} onClose={() => select(null)} /> : <Roster />}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card><CardContent><Roster /></CardContent></Card>
            <Sheet open={!!selected} onOpenChange={(open) => { if (!open) select(null); }}>
              <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))]">
                <SheetHeader className="sr-only">
                  <SheetTitle>{selected ? teamById[selected].name : "Desk"}</SheetTitle>
                  <SheetDescription>{selected ? teamById[selected].title : ""}</SheetDescription>
                </SheetHeader>
                {selected && <div className="pt-4"><DeskPanel id={selected} /></div>}
              </SheetContent>
            </Sheet>
          </>
        )}
      </main>
    </div>
  );
}
