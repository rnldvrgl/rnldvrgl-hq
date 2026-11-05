"use client";

import { useEffect } from "react";
import { BatteryLow, Gauge, SlidersHorizontal, Sparkles } from "lucide-react";
import { useOffice } from "@/lib/store";
import { DEFAULT_SETTINGS, LIGHT_SHOW, SHOW_LABELS, WALKERS_MAX, useSettings, type Motion } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { Card, Group, Segmented, SwitchRow } from "./kit";

/** How hard this device works: a preset, the rendering switches, and which layers of the town are drawn. */
export function PerformancePage() {
    return (
        <>
            <Performance />
            <Group title="Show in the office" hint="Turn layers off to draw less.">
                <ShowList />
            </Group>
        </>
    );
}

type Preset = "full" | "balanced" | "saver" | "custom";
/** The last mix of performance settings that matched no preset, for the Custom card. */
const CUSTOM_KEY = "hq:customPerf";

function Performance() {
    const lowPower = useOffice((s) => s.lowPower);
    const setLowPower = useOffice((s) => s.setLowPower);
    const motion = useSettings((s) => s.motion);
    const show = useSettings((s) => s.show);
    const setMotion = useSettings((s) => s.setMotion);
    const setAllShow = useSettings((s) => s.setAllShow);
    const autoSaver = useSettings((s) => s.autoSaver);
    const setAutoSaver = useSettings((s) => s.setAutoSaver);
    const walkers = useSettings((s) => s.walkers);
    const setWalkers = useSettings((s) => s.setWalkers);

    const snapshot = () => ({ lowPower, motion, show, walkers });
    // remember the last mix that isn't a preset, so "Custom" can bring it back
    useEffect(() => {
        if (current !== "custom") return;
        try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(snapshot())); } catch { /* not remembered */ }
    });
    const apply = (p: Preset) => {
        if (p === "custom") {
            try {
                const c = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "null") as ReturnType<typeof snapshot> | null;
                if (c) { setLowPower(!!c.lowPower); setMotion(c.motion === "minimal" ? "minimal" : "full"); setAllShow({ ...DEFAULT_SETTINGS.show, ...c.show }); setWalkers(Number(c.walkers) || 0); }
            } catch { /* nothing saved */ }
            return;
        }
        if (p === "full") { setLowPower(false); setMotion("full"); setAllShow(DEFAULT_SETTINGS.show); setWalkers(DEFAULT_SETTINGS.walkers); }
        if (p === "balanced") { setLowPower(true); setMotion("full"); setAllShow({ ...DEFAULT_SETTINGS.show, neighbourhood: true, traffic: false, vendors: false, trees: true, smoke: false }); setWalkers(6); }
        if (p === "saver") { setLowPower(true); setMotion("minimal"); setAllShow(LIGHT_SHOW); setWalkers(0); }
    };
    const same = (a: typeof show, b: typeof show) => (Object.keys(a) as (keyof typeof show)[]).every((k) => a[k] === b[k]);
    const BALANCED_SHOW = { ...DEFAULT_SETTINGS.show, neighbourhood: true, traffic: false, vendors: false, trees: true, smoke: false };
    // a preset only lights up when everything matches it exactly; any other mix is Custom
    const current: Preset =
        !lowPower && motion === "full" && same(show, DEFAULT_SETTINGS.show) && walkers === DEFAULT_SETTINGS.walkers ? "full"
            : lowPower && motion === "minimal" && same(show, LIGHT_SHOW) && walkers === 0 ? "saver"
                : lowPower && motion === "full" && same(show, BALANCED_SHOW) && walkers === 6 ? "balanced" : "custom";

    // each preset has its own colour: green for full, blue for balanced, amber for saving battery
    const PRESETS: { id: Preset; label: string; hint: string; icon: typeof Gauge; tone: { on: string; icon: string } }[] = [
        {
            id: "full", label: "Full", hint: "Everything, shadows, 60 fps", icon: Sparkles,
            tone: { on: "border-emerald-500 bg-emerald-500/12 ring-1 ring-emerald-500", icon: "text-emerald-600 dark:text-emerald-400" }
        },
        {
            id: "balanced", label: "Balanced", hint: "No shadows or traffic, 30 fps", icon: Gauge,
            tone: { on: "border-sky-500 bg-sky-500/12 ring-1 ring-sky-500", icon: "text-sky-600 dark:text-sky-400" }
        },
        {
            id: "saver", label: "Battery saver", hint: "Office only, minimal motion", icon: BatteryLow,
            tone: { on: "border-amber-500 bg-amber-500/14 ring-1 ring-amber-500", icon: "text-amber-600 dark:text-amber-400" }
        },
        {
            id: "custom", label: "Custom", hint: "Your own mix of the settings below", icon: SlidersHorizontal,
            tone: { on: "border-violet-500 bg-violet-500/12 ring-1 ring-violet-500", icon: "text-violet-600 dark:text-violet-400" }
        },
    ];

    return (
        <>
        <Group title="Preset" hint="Pick one, or fine-tune below: any change of your own makes it Custom.">
            <div className="grid grid-cols-2 gap-2">
                {PRESETS.map(({ id, label, hint, icon: Icon, tone }) => (
                    <button
                        key={id}
                        type="button"
                        aria-pressed={current === id}
                        onClick={() => apply(id)}
                        className={cn(
                            "relative grid content-start gap-1 rounded-2xl border bg-card/40 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                            current === id ? tone.on : "border-border",
                        )}
                    >
                        <Icon className={cn("size-4", tone.icon, current !== id && "opacity-70")} aria-hidden />
                        {current === id && <span className={cn("absolute top-2.5 right-2.5 size-2 rounded-full bg-current", tone.icon)} aria-hidden />}
                        <span className="text-sm font-semibold leading-tight">{label}</span>
                        <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>
                    </button>
                ))}
            </div>
            </Group>
            <Group title="Rendering" hint="How hard this device works to draw the office.">
            <Card>
            <SwitchRow label="Low-power rendering" hint="No shadows, 1× resolution, 30 fps" checked={lowPower} onChange={setLowPower} />
            <SwitchRow label="Auto battery saver" hint="Turn on low-power rendering by itself when the office keeps running slow" checked={autoSaver} onChange={setAutoSaver} />
            <div className="grid gap-1.5 px-3.5 py-3">
                <label htmlFor="walkers" className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">People walking outside</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{walkers === 0 ? "None" : `up to ${walkers}`}</span>
                </label>
                <input
                    id="walkers" type="range" min={0} max={WALKERS_MAX} step={1} value={walkers}
                    onChange={(e) => setWalkers(Number(e.target.value))}
                    className="h-1.5 w-full min-w-0 cursor-pointer accent-primary"
                />
                <p className="text-xs text-muted-foreground">Students, office workers, joggers… at the busiest hour; fewer at night. Lower it on slow phones (0 turns them off).</p>
            </div>
            <div className="grid gap-1.5 px-3.5 py-3">
                <span className="text-sm font-medium">Animation</span>
                <Segmented<Motion>
                    label="Animation"
                    value={motion}
                    onChange={setMotion}
                    options={[{ id: "full", label: "Full" }, { id: "minimal", label: "Minimal" }]}
                />
                <p className="text-xs text-muted-foreground">Minimal: people still move around, but without idle animation, traffic, smoke or rain, at 12 fps.</p>
            </div>
            </Card>
        </Group>
        </>
    );
}

function ShowList() {
    const show = useSettings((s) => s.show);
    const setShow = useSettings((s) => s.setShow);
    return (
        <Card>
            {SHOW_LABELS.filter((l) => l.key !== "holidays").map(({ key, label, hint }) => (
                <SwitchRow key={key} label={label} hint={hint} checked={show[key]} onChange={(on) => setShow(key, on)} />
            ))}
        </Card>
    );
}

