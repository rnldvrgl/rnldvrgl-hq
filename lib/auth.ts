import "server-only";
import { sessionClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

/** Returns the signed-in owner's email, or null when the visitor is not you. */
export async function currentOwner(): Promise<string | null> {
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email || email !== env("OWNER_EMAIL").toLowerCase()) return null;
  return email;
}

/** Constant-time-ish check that the request carries `Bearer <value of secretEnv>`. */
function hasBearer(req: Request, secretEnv: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env(secretEnv)}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** For the scheduler tick (Supabase pg_cron). */
export function isCronRequest(req: Request): boolean {
  return hasBearer(req, "CRON_SECRET");
}

/** For the iPhone Shortcut that syncs Apple Reminders. */
export function isShortcutRequest(req: Request): boolean {
  return hasBearer(req, "SHORTCUTS_TOKEN");
}
