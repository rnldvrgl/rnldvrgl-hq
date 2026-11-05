import { NextResponse } from "next/server";
import { hqRoute } from "@/lib/hq";
import { hqId } from "@/lib/hq-context";
import { db } from "@/lib/supabase/admin";
import { canUse, isRoom, MESSAGE_MAX, otherOf } from "@/lib/chat";

export const dynamic = "force-dynamic";

const notAllowed = () => NextResponse.json({ error: "Not your room." }, { status: 403 });

/**
 * GET ?room=lounge|dm:<a>:<b>[&after=<iso>]: the last 60 messages (or the ones after `after`), oldest first.
 * GET ?rooms=1: your rooms with their newest message's time, for unread dots.
 */
export const GET = hqRoute(async (req: Request) => {
  const url = new URL(req.url);
  const me = hqId();
  if (url.searchParams.get("rooms")) {
    const { data, error } = await db().from("hq_messages").select("room, created_at, from_hq")
      .or(`room.eq.lounge,room.like.*${me}*`).order("created_at", { ascending: false }).limit(300);
    if (error) return NextResponse.json({ rooms: {} });
    const rooms: Record<string, { at: string; from: string }> = {};
    for (const r of data ?? []) if (!rooms[r.room] && canUse(r.room, me)) rooms[r.room] = { at: r.created_at, from: r.from_hq };
    return NextResponse.json({ rooms });
  }
  const room = url.searchParams.get("room");
  if (!isRoom(room)) return NextResponse.json({ error: "Unknown room." }, { status: 400 });
  if (!canUse(room, me)) return notAllowed();
  const after = url.searchParams.get("after");
  let q = db().from("hq_messages").select("id, room, from_hq, body, created_at").eq("room", room);
  if (after && !Number.isNaN(Date.parse(after))) q = q.gt("created_at", after);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(60);
  if (error) return NextResponse.json({ error: error.message.includes("hq_messages") ? "Run supabase/multi-hq.sql first (it adds chat)." : error.message }, { status: 500 });
  return NextResponse.json({ messages: (data ?? []).reverse() });
});

/** POST { room, body }: send a message. At most 20 a minute per HQ. */
export const POST = hqRoute(async (req: Request) => {
  const input = (await req.json().catch(() => null)) as { room?: unknown; body?: unknown } | null;
  const room = input?.room;
  const body = typeof input?.body === "string" ? input.body.replace(/\s+$/g, "").replace(/^\s+/g, "") : "";
  if (!isRoom(room)) return NextResponse.json({ error: "Unknown room." }, { status: 400 });
  const me = hqId();
  if (!canUse(room, me)) return notAllowed();
  if (!body || body.length > MESSAGE_MAX) return NextResponse.json({ error: `Messages are 1–${MESSAGE_MAX} characters.` }, { status: 400 });
  // a DM only to an HQ that exists
  const other = otherOf(room, me);
  if (other) {
    const { data } = await db().from("hqs").select("id").eq("id", other).maybeSingle();
    if (!data) return notAllowed();
  }
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db().from("hq_messages").select("id", { count: "exact", head: true }).eq("from_hq", me).gte("created_at", since);
  if ((count ?? 0) >= 20) return NextResponse.json({ error: "Slow down a little: 20 messages a minute." }, { status: 429 });
  const { data, error } = await db().from("hq_messages").insert({ room, from_hq: me, body }).select("id, room, from_hq, body, created_at").single();
  if (error) return NextResponse.json({ error: error.message.includes("hq_messages") ? "Run supabase/multi-hq.sql first (it adds chat)." : "Couldn't send it." }, { status: 500 });
  return NextResponse.json({ message: data });
});
