"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { STYLES } from "@/lib/theme";
import { ThemePicker, useStyleChoice } from "@/components/ThemePicker";
import { APP_COLORS, APP_GLYPHS, appNameOf, cleanHandle, HANDLE_MAX, type AppColor } from "@/lib/prefs";
import { useAppIcon, useHandle, usePrefs } from "@/lib/prefs-client";
import { Glyph, iconGradient } from "@/lib/app-icon";
import { cn } from "@/lib/utils";
import { Group, inputCls, primaryBtn, ghostBtn } from "./kit";

const GLYPH_LABEL: Record<(typeof APP_GLYPHS)[number], string> = {
  cube: "HQ cube", house: "House", rocket: "Rocket", coffee: "Coffee", heart: "Heart", star: "Star",
  paw: "Paw", leaf: "Leaf", bolt: "Bolt", crown: "Crown", moon: "Moon", game: "Game pad",
};
const COLOR_LABEL: Record<AppColor, string> = {
  navy: "Navy", rose: "Rose", sunset: "Sunset", forest: "Forest", violet: "Violet", graphite: "Graphite", sky: "Sky", blush: "Blush",
};

export function AppearancePage() {
  return (
    <>
      <HqName />
      <AppIconPicker />
      <ColourStyle />
    </>
  );
}

/** The HQ's name: "<handle> HQ" in the header, the tab and the installed app. */
function HqName() {
  const handle = useHandle();
  const base = usePrefs((s) => s.baseHandle);
  const [draft, setDraft] = useState(handle);
  const clean = cleanHandle(draft);
  const changed = (clean ?? "") !== handle;
  const save = (v: string | null) => {
    usePrefs.getState().set({ handle: v ?? undefined });
    if (v === null) setDraft(base);
    toast.success(`Your HQ is now "${appNameOf(v ?? base)}".`);
  };
  return (
    <Group title="HQ name" hint="Shown in the header, the browser tab and the app on your Home Screen.">
      <div className="grid gap-2 rounded-2xl border border-border bg-card/60 p-3">
        <div className="flex items-center gap-2">
          <input
            value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={HANDLE_MAX} placeholder={base}
            aria-label="HQ name" aria-invalid={!!draft.trim() && !clean}
            className={cn(inputCls, "font-mono", draft.trim() && !clean && "border-destructive")}
          />
          <span className="shrink-0 font-semibold">HQ</span>
        </div>
        {draft.trim() && !clean && <p className="text-xs text-destructive">Letters, numbers, dots, dashes or underscores, no spaces (up to {HANDLE_MAX}).</p>}
        <div className="flex gap-2">
          <button type="button" className={cn(primaryBtn, "flex-1")} disabled={!clean || !changed} onClick={() => save(clean)}>
            <Check className="size-4" aria-hidden /> Save name
          </button>
          {handle !== base && <button type="button" className={ghostBtn} onClick={() => save(null)}>Use “{base}”</button>}
        </div>
      </div>
    </Group>
  );
}

/** The icon in the header, the browser tab and on the Home Screen. */
export function AppIconPicker() {
  const icon = useAppIcon();
  const handle = useHandle();
  const set = (patch: Partial<typeof icon>) => usePrefs.getState().set({ icon: { ...icon, ...patch } });
  return (
    <Group title="App icon" hint="Pick a symbol and a colour. Already installed on a phone? Remove it and add it to the Home Screen again to get the new icon.">
      <div className="grid gap-3 rounded-2xl border border-border bg-card/60 p-3">
        {/* the preview: how it looks on a Home Screen */}
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
          <span className="grid size-16 shrink-0 place-items-center rounded-[1.1rem] shadow-md [&>svg]:size-[66%]" style={{ background: iconGradient(icon) }} aria-hidden>
            <Glyph glyph={icon.glyph} size={44} />
          </span>
          <span className="grid min-w-0 leading-tight">
            <span className="truncate text-sm font-semibold">{appNameOf(handle)}</span>
            <span className="text-xs text-muted-foreground">{GLYPH_LABEL[icon.glyph]} on {COLOR_LABEL[icon.color].toLowerCase()}</span>
          </span>
        </div>
        <div role="radiogroup" aria-label="Icon symbol" className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {APP_GLYPHS.map((g) => (
            <button
              key={g} type="button" role="radio" aria-checked={icon.glyph === g} aria-label={GLYPH_LABEL[g]} title={GLYPH_LABEL[g]}
              onClick={() => set({ glyph: g })}
              className={cn("grid aspect-square place-items-center rounded-xl border transition-colors [&>svg]:size-[72%] focus-visible:outline-2 focus-visible:outline-ring",
                icon.glyph === g ? "border-ring ring-1 ring-ring" : "border-transparent hover:border-border")}
              style={{ background: iconGradient(icon) }}
            >
              <Glyph glyph={g} size={32} />
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Icon colour" className="flex flex-wrap gap-2">
          {(Object.keys(APP_COLORS) as AppColor[]).map((c) => (
            <button
              key={c} type="button" role="radio" aria-checked={icon.color === c} aria-label={COLOR_LABEL[c]} title={COLOR_LABEL[c]}
              onClick={() => set({ color: c })}
              className={cn("grid size-9 place-items-center rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-ring",
                icon.color === c ? "border-foreground" : "border-transparent")}
              style={{ background: `linear-gradient(145deg, ${APP_COLORS[c][0]}, ${APP_COLORS[c][1]})` }}
            >
              {icon.color === c && <Check className="size-4 text-white drop-shadow" aria-hidden />}
            </button>
          ))}
        </div>
      </div>
    </Group>
  );
}

function ColourStyle() {
  const [style, setStyle] = useStyleChoice();
  return (
    <Group title="Colour style" hint="The app's colours, and light or dark.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Colour style">
        {STYLES.map((s) => {
          const on = style === s.id;
          return (
            <button
              key={s.id} type="button" role="radio" aria-checked={on} onClick={() => setStyle(s.id)}
              className={cn("relative grid gap-2 rounded-2xl border p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
                on ? "border-ring bg-accent/70 ring-1 ring-ring" : "border-border bg-card/40")}
            >
              <span className="flex h-10 items-end gap-1 rounded-xl p-1.5 shadow-inner" style={{ background: s.swatch[0] }} aria-hidden>
                <span className="h-2.5 w-7 rounded-full" style={{ background: s.swatch[1] }} />
                <span className="size-2.5 rounded-full" style={{ background: s.swatch[2] }} />
              </span>
              <span className="grid min-w-0 px-0.5 leading-tight">
                <span className="truncate text-[13px] font-semibold">{s.label}</span>
                <span className="truncate text-[11px] text-muted-foreground">{s.hint}</span>
              </span>
              {on && <Check className="absolute top-1 right-1 size-4 rounded-full bg-ring p-0.5 text-white" aria-hidden />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-3.5 py-2.5">
        <span className="text-sm font-medium">Light / Dark</span>
        <ThemePicker />
      </div>
    </Group>
  );
}
