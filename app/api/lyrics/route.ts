import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/auth";
import { HQ } from "@/hq.config";

/**
 * Lyrics for the song playing on Spotify. Spotify's API has no lyrics, so they come from LRCLIB (lrclib.net),
 * a free, open lyrics database with time-synced lines for most songs. Looked up by title, artist, album
 * and length; cached for a day, since lyrics don't change.
 *
 *   GET ?track=&artist=&album=&duration=(seconds)
 *   → { synced: [{ t: ms, line }] | null, plain: string | null, instrumental: boolean }
 */

type Lrclib = { syncedLyrics?: string | null; plainLyrics?: string | null; instrumental?: boolean; duration?: number };
export type LyricsReply = { synced: { t: number; line: string }[] | null; plain: string | null; instrumental: boolean };

const HEADERS = { "User-Agent": `${HQ.appName} (personal dashboard)`, Accept: "application/json" };
const DAY = 86_400;

/** "[01:23.45] words" lines → [{ t: 83450, line: "words" }], in order. */
function parseLrc(lrc: string): { t: number; line: string }[] {
  const out: { t: number; line: string }[] = [];
  for (const row of lrc.split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const line = row.replace(/\[[^\]]*\]/g, "").trim();
    for (const m of stamps) out.push({ t: Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000), line });
  }
  return out.sort((a, b) => a.t - b.t);
}

async function lookup(params: URLSearchParams): Promise<Lrclib | null> {
  const res = await fetch(`https://lrclib.net/api/get?${params}`, { headers: HEADERS, next: { revalidate: DAY } });
  if (res.ok) return (await res.json()) as Lrclib;
  if (res.status !== 404) throw new Error(`Lyrics service error ${res.status}.`);
  // no exact match (different album name, a remaster…): search by title and artist, closest length first
  const q = new URLSearchParams({ track_name: params.get("track_name") ?? "", artist_name: params.get("artist_name") ?? "" });
  const s = await fetch(`https://lrclib.net/api/search?${q}`, { headers: HEADERS, next: { revalidate: DAY } });
  if (!s.ok) return null;
  const list = (await s.json()) as Lrclib[];
  const want = Number(params.get("duration") ?? 0);
  return list
    .filter((r) => r.syncedLyrics || r.plainLyrics || r.instrumental)
    .sort((a, b) => Math.abs((a.duration ?? 0) - want) - Math.abs((b.duration ?? 0) - want) || Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics))[0] ?? null;
}

export async function GET(req: Request) {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const u = new URL(req.url);
  const track = u.searchParams.get("track")?.trim();
  const artist = u.searchParams.get("artist")?.split(",")[0]?.trim();
  if (!track || !artist) return NextResponse.json({ error: "Send track and artist." }, { status: 400 });

  const params = new URLSearchParams({ track_name: track, artist_name: artist });
  const album = u.searchParams.get("album")?.trim();
  if (album) params.set("album_name", album);
  const duration = Number(u.searchParams.get("duration"));
  if (duration > 0) params.set("duration", String(Math.round(duration)));

  try {
    const r = await lookup(params);
    const reply: LyricsReply = {
      synced: r?.syncedLyrics ? parseLrc(r.syncedLyrics) : null,
      plain: r?.plainLyrics?.trim() || null,
      instrumental: !!r?.instrumental,
    };
    return NextResponse.json(reply, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load lyrics." }, { status: 502 });
  }
}
