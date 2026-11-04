"use client";

import { useEffect, useState } from "react";
import type { SpotifyTrack } from "@/lib/spotify";

/** Lyrics for a Spotify track, from /api/lyrics (LRCLIB). Synced lines carry their start time in ms. */
export type Lyrics = { synced: { t: number; line: string }[] | null; plain: string | null; instrumental: boolean };
type Entry = { state: "loading" } | { state: "ready"; lyrics: Lyrics } | { state: "error"; message: string };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function load(t: SpotifyTrack): Promise<void> {
  const key = t.id;
  if (cache.has(key) && cache.get(key)!.state !== "error") return Promise.resolve();
  let p = inflight.get(key);
  if (p) return p;
  cache.set(key, { state: "loading" });
  const q = new URLSearchParams({ track: t.title, artist: t.artist, album: t.album, duration: String(Math.round(t.durationMs / 1000)) });
  p = fetch(`/api/lyrics?${q}`)
    .then(async (r) => {
      const data = (await r.json().catch(() => ({}))) as Lyrics & { error?: string };
      cache.set(key, r.ok ? { state: "ready", lyrics: data } : { state: "error", message: data.error ?? "Couldn't load lyrics." });
    })
    .catch(() => { cache.set(key, { state: "error", message: "Couldn't load lyrics." }); })
    .finally(() => { inflight.delete(key); listeners.forEach((f) => f()); });
  inflight.set(key, p);
  return p;
}

/** The lyrics for `track` (fetched once per song and shared by every view), or null while there's no track. */
export function useLyrics(track: SpotifyTrack | null, enabled = true): Entry | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  useEffect(() => { if (track && enabled) void load(track); }, [track?.id, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!track || !enabled) return null;
  return cache.get(track.id) ?? { state: "loading" };
}

/** Which synced line is being sung at `ms` (-1 before the first line). */
export function lineAt(lines: readonly { t: number }[], ms: number): number {
  let lo = 0, hi = lines.length - 1, at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= ms) { at = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return at;
}
