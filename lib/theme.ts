/**
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

/** Browser UI colour (status bar, tab strip) per theme: its background. */
const BAR: Record<ThemeName, string> = { light: "#dfe3ea", dark: "#232a36" };

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
    m.setAttribute("content", BAR[name]);
    m.removeAttribute("media");
  });
  if (save) {
    try { window.localStorage.setItem(THEME_KEY, choice); } catch { /* private mode: not remembered */ }
  }
  window.dispatchEvent(new CustomEvent("hq:theme", { detail: choice }));
}

/** Runs in <head> before first paint (kept tiny and dependency-free). Also migrates old theme names. */
export const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement,o={graphite:"light",porcelain:"light",onyx:"dark",slate:"dark",auto:"system"};try{var c=localStorage.getItem("${THEME_KEY}");if(o[c]){c=o[c];localStorage.setItem("${THEME_KEY}",c);}if(c!=="light"&&c!=="dark"&&c!=="system")c="${DEFAULT_THEME}";var t=c==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;d.dataset.theme=t;d.dataset.mode=t;d.style.colorScheme=t;}catch(e){d.dataset.theme="light";d.dataset.mode="light";}})();`;
