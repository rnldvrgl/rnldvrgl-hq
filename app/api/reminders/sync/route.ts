import { founderHq, inHq } from "@/lib/hq";
import { hqId } from "@/lib/hq-context";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isShortcutRequest } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import type { TablesInsert } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

/**
 * Two-way sync with the iPhone Reminders app, called by an iOS Shortcut (see README → iPhone Reminders).
 *
 * The Shortcut POSTs a snapshot of the iPhone's open reminders that have a due date. Then:
 *   - reminders new on the iPhone are added to HQ (source "iphone")
 *   - iPhone reminders that left the snapshot (completed or deleted there) are removed from HQ
 *   - one-off HQ reminders already handed to the iPhone that left the snapshot are marked done
 *   - HQ reminders the iPhone doesn't have yet come back in `to_add`, and the Shortcut creates them
 *
 * Reminders are matched by title + due minute, because Shortcuts can't read a reminder's ID.
 */

/** Accepts the easy-to-build Shortcuts format (one "ISO-due|title" per line) or a JSON array. */
const Body = z.object({
  items: z.union([
    z.string().max(200_000),
    z.array(z.object({ title: z.string(), due: z.string() })).max(1000),
  ]),
});

type Item = { title: string; dueIso: string };

function parseItems(items: z.infer<typeof Body>["items"]): Item[] {
  const raw = typeof items === "string"
    ? items.split(/\r?\n/).map((line) => {
        const at = line.indexOf("|");
        return at === -1 ? null : { due: line.slice(0, at), title: line.slice(at + 1) };
      })
    : items;
  const out: Item[] = [];
  for (const r of raw) {
    if (!r) continue;
    const title = r.title.trim().slice(0, 200);
    const t = Date.parse(r.due.trim());
    if (!title || Number.isNaN(t)) continue; // no due date: HQ can't schedule it
    out.push({ title, dueIso: new Date(t).toISOString() });
  }
  return out;
}

const keyOf = (title: string, dueIso: string): string =>
  `${title.trim().toLowerCase()}|${new Date(dueIso).toISOString().slice(0, 16)}`;

/** Shortcuts' "Get Dates from Input" reads this reliably, e.g. "November 3, 2026 at 7:30 PM". */
const SHORTCUT_DATE = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", dateStyle: "long", timeStyle: "short" });

export async function POST(req: Request) {
  if (!isShortcutRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // the Shortcut is yours: it syncs your HQ's reminders
  return inHq(await founderHq(), () => sync(req));
}

async function sync(req: Request): Promise<Response> {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Send { "items": "ISO-due|title" lines }.' }, { status: 400 });

  const incoming = new Map<string, Item>();
  for (const item of parseItems(body.data.items)) incoming.set(keyOf(item.title, item.dueIso), item);

  const { data: open, error } = await db()
    .from("reminders")
    .select("id, title, due_at, repeat, source, pushed_at").eq("hq_id", hqId())
    .is("sent_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date().toISOString();
  const matched = new Set<string>();
  const removeIds: string[] = [];
  const completeIds: string[] = [];
  const pushIds: string[] = [];
  const toAdd: { title: string; due_iso: string; due_text: string }[] = [];

  for (const r of open ?? []) {
    const key = keyOf(r.title, r.due_at);
    if (incoming.has(key)) {
      matched.add(key);
      continue;
    }
    if (r.source === "iphone") removeIds.push(r.id);
    else if (r.pushed_at && !r.repeat) completeIds.push(r.id);
    else if (!r.pushed_at) {
      pushIds.push(r.id);
      toAdd.push({ title: r.title, due_iso: r.due_at, due_text: SHORTCUT_DATE.format(new Date(r.due_at)) });
    }
  }

  const inserts: TablesInsert<"reminders">[] = [...incoming]
    .filter(([key]) => !matched.has(key))
    .map(([, item]) => ({ hq_id: hqId(), title: item.title, due_at: item.dueIso, source: "iphone", pushed_at: now }));

  const results = await Promise.all([
    inserts.length ? db().from("reminders").insert(inserts) : null,
    removeIds.length ? db().from("reminders").delete().in("id", removeIds).eq("hq_id", hqId()) : null,
    completeIds.length ? db().from("reminders").update({ sent_at: now }).in("id", completeIds).eq("hq_id", hqId()) : null,
    pushIds.length ? db().from("reminders").update({ pushed_at: now }).in("id", pushIds).eq("hq_id", hqId()) : null,
  ]);
  const failed = results.find((r) => r?.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    added: inserts.length,
    removed: removeIds.length,
    completed: completeIds.length,
    to_add: toAdd,
  });
}
