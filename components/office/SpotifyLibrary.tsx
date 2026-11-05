"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Music, Play, Search, X } from "lucide-react";
import { searchSpotify, useSpotify, type SpotifyPlaylist, type SpotifySong } from "@/lib/spotify";
import { cn } from "@/lib/utils";

/**
 * The Music panel's Library tab: search Spotify for songs, and your playlists.
 * The list is the tab's only scrolling box, under a search field that stays put.
 */

const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const row = "flex min-h-12 w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-ring";
const moreBtn = "flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground max-sm:h-11";

/** "24 songs", or who made it when Spotify doesn't say how many songs (it only counts your own playlists now). */
export function playlistMeta(p: SpotifyPlaylist): string {
  if (p.tracks != null) return `${p.tracks} ${p.tracks === 1 ? "song" : "songs"}`;
  return p.mine || !p.owner ? "Playlist" : `Playlist · ${p.owner}`;
}

export function Library({ open }: { open: boolean }) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <SearchField value={query} onChange={setQuery} />
      <div className="scroll-thin h-[min(52dvh,24rem)] min-h-0 flex-1 pr-1.5">
        {q ? <SearchResults query={q} /> : <Playlists open={open} />}
      </div>
    </div>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="relative mr-1.5 shrink-0">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={input} type="search" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Search songs or playlists" aria-label="Search Spotify" enterKeyHint="search" autoComplete="off"
        onKeyDown={(e) => { if (e.key === "Escape" && value) { e.stopPropagation(); onChange(""); } }}
        className="h-10 w-full rounded-xl border border-border bg-background/60 pr-10 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring max-sm:h-11 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button" onClick={() => { onChange(""); input.current?.focus(); }} aria-label="Clear search"
          className="absolute top-0 right-0 grid h-full w-10 place-items-center rounded-r-xl text-muted-foreground hover:text-foreground max-sm:w-11"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

type Results = { songs: SpotifySong[]; playlists: SpotifyPlaylist[]; nextOffset: number | null };

/** Songs (and a few playlists) for what you typed: searched 350 ms after you stop typing. */
function SearchResults({ query }: { query: string }) {
  const [res, setRes] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    setBusy(true);
    setError(null);
    const t = setTimeout(() => {
      abort.current?.abort();
      const ac = (abort.current = new AbortController());
      searchSpotify(query, 0, ac.signal)
        .then((r) => { if (!ac.signal.aborted) setRes({ songs: r.songs.items, playlists: r.playlists, nextOffset: r.songs.nextOffset }); })
        .catch((e: unknown) => { if (!ac.signal.aborted) { setRes(null); setError(e instanceof Error ? e.message : "Search didn't work."); } })
        .finally(() => { if (!ac.signal.aborted) setBusy(false); });
    }, 350);
    return () => { clearTimeout(t); abort.current?.abort(); };
  }, [query]);

  const more = async () => {
    if (!res || res.nextOffset == null) return;
    setBusy(true);
    const ac = (abort.current = new AbortController());
    try {
      const r = await searchSpotify(query, res.nextOffset, ac.signal);
      if (!ac.signal.aborted) setRes({ ...res, songs: [...res.songs, ...r.songs.items], nextOffset: r.songs.nextOffset });
    } catch (e) {
      if (!ac.signal.aborted) setError(e instanceof Error ? e.message : "Search didn't work.");
    } finally {
      if (!ac.signal.aborted) setBusy(false);
    }
  };

  if (!res) {
    return error
      ? <p role="alert" className="py-2 text-xs text-destructive">{error}</p>
      : <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Searching…</p>;
  }
  return (
    <div className="space-y-3" aria-busy={busy}>
      <section aria-label="Songs">
        <p className="px-1.5 pb-1 text-[11px] font-medium text-muted-foreground">Songs</p>
        {res.songs.length === 0 && <p className="px-1.5 py-1 text-xs text-muted-foreground">No songs found for “{query}”.</p>}
        <ul className="space-y-0.5">
          {res.songs.map((s) => <li key={s.key}><SongRow song={s} /></li>)}
        </ul>
        {res.nextOffset != null && (
          <button type="button" onClick={() => void more()} disabled={busy} className={moreBtn}>
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} More songs
          </button>
        )}
      </section>
      {res.playlists.length > 0 && (
        <section aria-label="Playlists">
          <p className="px-1.5 pb-1 text-[11px] font-medium text-muted-foreground">Playlists</p>
          <ul className="space-y-0.5">
            {res.playlists.map((p) => <li key={p.id}><PlaylistRow playlist={p} /></li>)}
          </ul>
        </section>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Playlists({ open }: { open: boolean }) {
  const playlists = useSpotify((s) => s.playlists);
  const fetchPlaylists = useSpotify((s) => s.fetchPlaylists);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (open && playlists.length === 0) void fetchPlaylists().finally(() => setLoaded(true));
    else setLoaded(true);
  }, [open, playlists.length, fetchPlaylists]);
  return (
    <ul className="space-y-0.5" aria-label="Your playlists">
      {playlists.length === 0 && (
        <li className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          {loaded ? "No playlists yet." : <><Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading your playlists…</>}
        </li>
      )}
      {playlists.map((p) => <li key={p.id}><PlaylistRow playlist={p} /></li>)}
    </ul>
  );
}

function Cover({ src }: { src: string | null }) {
  return src
    ? <img src={src} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
    : <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted"><Music className="size-4" aria-hidden /></span>;
}

function PlaylistRow({ playlist: p }: { playlist: SpotifyPlaylist }) {
  const canControl = useSpotify((s) => s.isPremium !== false);
  return (
    <button type="button" disabled={!canControl} onClick={() => void useSpotify.getState().playPlaylist(p.uri)} className={row} aria-label={`Play ${p.name}`}>
      <Cover src={p.image} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{p.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{playlistMeta(p)}</span>
      </span>
      <Play className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

/** One song: tap to play it (inside its playlist when `context` is given, so the rest of it follows). */
export function SongRow({ song, context, index }: { song: SpotifySong; context?: string; index?: number }) {
  const canControl = useSpotify((s) => s.isPremium !== false);
  const current = useSpotify((s) => !!s.track && song.uri.endsWith(`:${s.track.id}`));
  const play = () => void useSpotify.getState().playSong(song, context && song.position != null ? { uri: context, position: song.position } : undefined);
  return (
    <button
      type="button" disabled={!canControl || !song.playable} onClick={play} aria-current={current ? "true" : undefined}
      aria-label={`Play ${song.title} by ${song.artist}${song.playable ? "" : " (not available)"}`}
      className={row}
    >
      {index != null && <span className="w-5 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground" aria-hidden>{index}</span>}
      <Cover src={song.art} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", current && "text-[#1db954]")}>{song.title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{song.artist}</span>
      </span>
      {song.durationMs > 0 && <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground" aria-hidden>{fmt(song.durationMs)}</span>}
    </button>
  );
}
