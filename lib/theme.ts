import { HQ, type StyleName } from "@/hq.config";

export type { StyleName } from "@/hq.config";

/**
 * Six colour styles (Ocean, Rosé, Sunset, Forest, Lavender, Graphite), each in Light and Dark. The style is
 * saved as "hq:style" and applied as <html data-style="…">; its default is hq.config.ts → style.
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
  ocean: { light: "#dde6f0", dark: "#16202e" },
  rose: { light: "#f2e4e7", dark: "#2b1d25" },
  sunset: { light: "#f4e6da", dark: "#2a1d18" },
  forest: { light: "#dfe9e2", dark: "#16241d" },
  lavender: { light: "#e6e2f2", dark: "#1f1b2e" },
  graphite: { light: "#e4e4e7", dark: "#1c1c20" },
};

export const STYLE_KEY = "hq:style";
export const STYLES: readonly { id: StyleName; label: string; hint: string; swatch: [string, string, string] }[] = [
  { id: "ocean", label: "Ocean", hint: "Deep-sea blue, aqua", swatch: ["#dde6f0", "#1f5fd1", "#7fd0e0"] },
  { id: "rose", label: "Rosé", hint: "Dusty rose, wine", swatch: ["#f2e4e7", "#b8456f", "#f4a6c3"] },
  { id: "sunset", label: "Sunset", hint: "Coral, amber", swatch: ["#f4e6da", "#d2502a", "#ffc47a"] },
  { id: "forest", label: "Forest", hint: "Emerald, moss", swatch: ["#dfe9e2", "#1f7a52", "#a9d68a"] },
  { id: "lavender", label: "Lavender", hint: "Violet, periwinkle", swatch: ["#e6e2f2", "#6a4fd1", "#a8c2f5"] },
  { id: "graphite", label: "Graphite", hint: "Neutral, no tint", swatch: ["#e4e4e7", "#18181b", "#a1a1aa"] },
];
export const STYLE_IDS = STYLES.map((s) => s.id);
/** Styles from before the six: carried over to their nearest new one. */
const OLD_STYLES: Record<string, StyleName> = { slate: "ocean", blush: "rose", mango: "sunset" };
const isStyle = (v: string | null): v is StyleName => STYLE_IDS.some((id) => id === v);

export function readStyle(): StyleName {
  try {
    const v = window.localStorage.getItem(STYLE_KEY);
    return isStyle(v) ? v : (v && OLD_STYLES[v]) || HQ.style;
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
export const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement;try{var s=localStorage.getItem("${STYLE_KEY}");var o=${JSON.stringify(OLD_STYLES)};if(o[s])s=o[s];d.dataset.style=${JSON.stringify(STYLE_IDS)}.indexOf(s)>=0?s:"${HQ.style}";}catch(e){d.dataset.style="${HQ.style}";}})();(function(){var d=document.documentElement,o={graphite:"light",porcelain:"light",onyx:"dark",slate:"dark",auto:"system"};try{var c=localStorage.getItem("${THEME_KEY}");if(o[c]){c=o[c];localStorage.setItem("${THEME_KEY}",c);}if(c!=="light"&&c!=="dark"&&c!=="system")c="${DEFAULT_THEME}";var t=c==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;d.dataset.theme=t;d.dataset.mode=t;d.style.colorScheme=t;}catch(e){d.dataset.theme="light";d.dataset.mode="light";}})();`;
