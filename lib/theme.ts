import { HQ, type StyleName } from "@/hq.config";

export type { StyleName } from "@/hq.config";

/**
 * Three colour styles (Slate: cool grey-blue glass; Blush: rosé and plum glass; Mango: ripe mango and kapeng
 * barako), each in Light and Dark. The style is saved as "hq:style" and applied as <html data-style="slate|blush|mango">; its default is hq.config.ts → style.
 *
 * Two theme designs, Light and Dark, both mid-tone glass (never stark white or pure black), plus System,
 * which follows the OS. The choice is saved in localStorage ("hq:theme") and applied as
 * <html data-theme="light|dark" data-mode="light|dark">. The same logic runs before paint in app/layout.tsx.
 */
export type ThemeName = "light" | "dark";
export type ThemeChoice = ThemeName | "system";

export const THEME_KEY = "hq:theme";
export const DEFAULT_THEME: ThemeChoice = "system";

export const THEMES: readonly { id: ThemeChoice; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

/** Browser UI colour (status bar, tab strip) per style and theme: its background. */
const BAR: Record<StyleName, Record<ThemeName, string>> = {
  slate: { light: "#dfe3ea", dark: "#232a36" },
  blush: { light: "#efe2e6", dark: "#2e2230" },
  mango: { light: "#f1e8d6", dark: "#2a241c" },
};

export const STYLE_KEY = "hq:style";
export const STYLES: readonly { id: StyleName; label: string; hint: string; swatch: [string, string, string] }[] = [
  { id: "slate", label: "Slate", hint: "Cool grey-blue glass", swatch: ["#dfe3ea", "#7c8ae0", "#262d3d"] },
  { id: "blush", label: "Blush", hint: "Rosé and plum glass", swatch: ["#efe2e6", "#d0799f", "#8a3f62"] },
  { id: "mango", label: "Mango", hint: "Ripe mango and coffee glass", swatch: ["#f1e8d6", "#e8a33a", "#8a4b12"] },
];
const isStyle = (v: string | null): v is StyleName => v === "slate" || v === "blush" || v === "mango";

export function readStyle(): StyleName {
  try {
    const v = window.localStorage.getItem(STYLE_KEY);
    return isStyle(v) ? v : HQ.style;
  } catch {
    return HQ.style;
  }
}

/** Apply a colour style to <html> and remember it. */
export function applyStyle(style: StyleName, save = true): void {
  document.documentElement.dataset.style = style;
  if (save) {
    try { window.localStorage.setItem(STYLE_KEY, style); } catch { /* private mode: not remembered */ }
  }
  applyTheme(readTheme(), false); // refresh the browser bar colour
  window.dispatchEvent(new CustomEvent("hq:style", { detail: style }));
}

/** Earlier rounds had five themes; map whatever was saved onto the two that remain. */
const LEGACY: Record<string, ThemeChoice> = {
  graphite: "light", porcelain: "light", onyx: "dark", slate: "dark", auto: "system",
};

export function isThemeChoice(v: string | null): v is ThemeChoice {
  return v === "light" || v === "dark" || v === "system";
}

export function readTheme(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (isThemeChoice(v)) return v;
    return (v && LEGACY[v]) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function resolveTheme(choice: ThemeChoice): ThemeName {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Apply a theme to <html> and the browser's theme-color, and remember it. */
export function applyTheme(choice: ThemeChoice, save = true): void {
  const name = resolveTheme(choice);
  const root = document.documentElement;
  root.dataset.theme = name;
  root.dataset.mode = name;
  root.style.colorScheme = name;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute("content", BAR[readStyle()][name]);
    m.removeAttribute("media");
  });
  if (save) {
    try { window.localStorage.setItem(THEME_KEY, choice); } catch { /* private mode: not remembered */ }
  }
  window.dispatchEvent(new CustomEvent("hq:theme", { detail: choice }));
}

/** Runs in <head> before first paint (kept tiny and dependency-free). Also migrates old theme names. */
export const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement;try{var s=localStorage.getItem("${STYLE_KEY}");d.dataset.style=(s==="slate"||s==="blush"||s==="mango")?s:"${HQ.style}";}catch(e){d.dataset.style="${HQ.style}";}})();(function(){var d=document.documentElement,o={graphite:"light",porcelain:"light",onyx:"dark",slate:"dark",auto:"system"};try{var c=localStorage.getItem("${THEME_KEY}");if(o[c]){c=o[c];localStorage.setItem("${THEME_KEY}",c);}if(c!=="light"&&c!=="dark"&&c!=="system")c="${DEFAULT_THEME}";var t=c==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;d.dataset.theme=t;d.dataset.mode=t;d.style.colorScheme=t;}catch(e){d.dataset.theme="light";d.dataset.mode="light";}})();`;
