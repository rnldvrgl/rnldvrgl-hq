import "server-only";
import { db } from "@/lib/supabase/admin";
import { FOUNDER_HQ, hqId } from "@/lib/hq-context";
import { cleanName } from "@/lib/names";
import { cleanPrefs, DEFAULT_ICON, type AppIcon } from "@/lib/prefs";
import { HQ } from "@/hq.config";

/**
 * Everyone in the circle: HQ is invite-only, so every HQ on this site is a friend (yours and each one you
 * invited). Names and icons only; no emails, keys or anything else of theirs.
 */
export type Friend = { id: string; handle: string; owner: string; icon: AppIcon; founder: boolean; joined: string };

/** A first name from an email ("maria.cruz@…" → "Maria"), as their HQ does until they rename themselves. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim().split(" ")[0] ?? "";
  return cleanName(local.charAt(0).toUpperCase() + local.slice(1)) ?? "Friend";
}

export async function listFriends(): Promise<{ me: string; friends: Friend[] }> {
  const [hqs, prefs, owners] = await Promise.all([
    db().from("hqs").select("id, owner_email, created_at").order("created_at"),
    db().from("hq_prefs").select("hq_id, data"),
    db().from("office_names").select("hq_id, name").eq("id", "owner"),
  ]);
  if (hqs.error) return { me: hqId(), friends: [] }; // before multi-hq.sql: no friends yet
  const prefOf = new Map((prefs.data ?? []).map((r) => [r.hq_id, cleanPrefs(r.data)]));
  const ownerOf = new Map((owners.data ?? []).map((r) => [r.hq_id, r.name]));
  const friends = (hqs.data ?? []).map((h): Friend => {
    const founder = h.id === FOUNDER_HQ;
    const p = prefOf.get(h.id) ?? {};
    const owner = ownerOf.get(h.id) ?? (founder ? HQ.owner.name : nameFromEmail(h.owner_email ?? ""));
    return {
      id: h.id, founder, owner, joined: h.created_at,
      handle: p.handle ?? (founder ? HQ.owner.handle : owner.toLowerCase().replace(/[^\p{L}\p{N}._-]+/gu, "") || "friend"),
      icon: p.icon ?? DEFAULT_ICON,
    };
  });
  return { me: hqId(), friends };
}
