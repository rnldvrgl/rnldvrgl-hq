import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Which HQ the current request (or tick) is working for. Set once at the entry point (an API route, the
 * page load, each HQ's turn in the 5-minute tick) with `inHq`; everything below reads it: `hqId()` for the
 * database's hq_id filter, `hqEnv()` (lib/env.ts) for that HQ's own keys and connections.
 */

/** Your HQ: the one that existed before friends. Its keys come from the environment (Vercel / .env.local). */
export const FOUNDER_HQ = "00000000-0000-4000-8000-000000000001";

export type HqCtx = {
  id: string;
  founder: boolean;
  /** The owner's sign-in email (the founder's is OWNER_EMAIL). */
  email: string;
  /** This HQ's decrypted secrets (AI keys, Google refresh token, GitHub token…). */
  secrets: Record<string, string>;
  /** This HQ's renames (Settings → Names), once loaded: the AI's briefs use them. */
  names?: Record<string, string>;
};

const store = new AsyncLocalStorage<HqCtx>();

export function inHq<T>(ctx: HqCtx, fn: () => T): T {
  return store.run(ctx, fn);
}

export function hqCtx(): HqCtx {
  const c = store.getStore();
  if (!c) throw new Error("No HQ selected for this request (internal: wrap the entry point in inHq).");
  return c;
}

/** The current HQ's id, for `.eq("hq_id", hqId())` and inserts. */
export const hqId = (): string => hqCtx().id;

/** The HQ for this request, or null outside one. */
export const hqCtxOrNull = (): HqCtx | null => store.getStore() ?? null;
