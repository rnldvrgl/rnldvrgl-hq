import "server-only";
import { optionalHqEnv } from "@/lib/env";
import type { Have } from "@/lib/hiring";

/** What the current HQ has connected (for hiring, and for Settings → Connections). */
export function have(): Have {
  return {
    ai: !!(optionalHqEnv("ANTHROPIC_API_KEY") || optionalHqEnv("GEMINI_API_KEY") || optionalHqEnv("GROQ_API_KEY")),
    google: !!optionalHqEnv("GOOGLE_REFRESH_TOKEN"),
    github: !!(optionalHqEnv("GITHUB_TOKEN") && optionalHqEnv("GITHUB_USERNAME")),
  };
}

/** "…a1b2": the end of a saved key, so you can tell which one it is without showing it. */
export const hint = (v: string | undefined): string | null => (v ? `…${v.slice(-4)}` : null);
