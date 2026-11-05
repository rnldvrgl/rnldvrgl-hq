import "server-only";
import { hqCtx } from "@/lib/hq-context";

/** Read a required server env var, failing loudly with the variable's name. */
export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. Add it to .env.local and to Vercel.`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

/**
 * Keys and connections that belong to an HQ, not to the app: each friend's HQ has its own (Settings →
 * Connections, stored encrypted in hq_secrets); yours falls back to the environment as before.
 */
export const HQ_KEYS = [
  "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "BACKUP_ALLOW_PRIVATE",
  "GOOGLE_REFRESH_TOKEN", "GITHUB_TOKEN", "GITHUB_USERNAME", "EMAIL_TO",
] as const;
export type HqKey = (typeof HQ_KEYS)[number];

/** The current HQ's value for `name`, or undefined. */
export function optionalHqEnv(name: HqKey): string | undefined {
  const c = hqCtx();
  if (c.secrets[name]) return c.secrets[name];
  if (name === "EMAIL_TO" && !c.founder) return c.email;
  return c.founder ? optionalEnv(name) : undefined;
}

/** The current HQ's value for `name`; fails with where to set it. */
export function hqEnv(name: HqKey): string {
  const v = optionalHqEnv(name);
  if (v) return v;
  throw new Error(hqCtx().founder
    ? `Missing ${name}. Add it in Settings → Connections, or to .env.local and Vercel.`
    : `Missing ${name}. Add it in Settings → Connections.`);
}
