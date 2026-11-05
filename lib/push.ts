import "server-only";
import { hqId } from "@/lib/hq-context";
import webpush, { WebPushError } from "web-push";
import { db } from "@/lib/supabase/admin";
import { optionalEnv } from "@/lib/env";

/** What the service worker (public/sw.js) shows. `tag` replaces an older notification with the same tag. */
export type PushPayload = { title: string; body: string; url: string; tag: string };

let configured: boolean | null = null;

/** Sets the VAPID keys once. False (with a warning) when they aren't configured. */
function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = optionalEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = optionalEnv("VAPID_PRIVATE_KEY");
  const subject = optionalEnv("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) {
    console.warn("Push notifications are off: set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.");
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export const pushConfigured = (): boolean => configure();

/**
 * Sends a notification to every subscribed device. Never throws: a push failing must not break
 * whatever triggered it. Subscriptions the push service says are gone (404/410) are deleted.
 * Returns how many devices accepted it.
 */
export async function pushToOwner(payload: PushPayload): Promise<number> {
  try {
    if (!configure()) return 0;
    const { data: subs, error } = await db().from("push_subscriptions").select("endpoint, p256dh, auth").eq("hq_id", hqId());
    if (error || !subs?.length) return 0;
    const body = JSON.stringify(payload);
    const results = await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 12, urgency: "high" });
        return true;
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          await db().from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        } else {
          console.warn("Push failed:", err instanceof Error ? err.message : err);
        }
        return false;
      }
    }));
    return results.filter(Boolean).length;
  } catch (err) {
    console.warn("Push failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}
