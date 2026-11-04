"use client";

import { useEffect, useState } from "react";
import { ListMusic, Loader2, Music, Pause, Play, SkipBack, SkipForward, Unplug, Volume1 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { liveProgressMs, resumeSpotify, spotifyConfigured, useSpotify, type SpotifyTrack } from "@/lib/spotify";
import { cn } from "@/lib/utils";

const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const roundBtn =
  "grid size-10 place-items-center rounded-full transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-ring";

/**
 * The office's Spotify remote (top-right controls): connect your account, see what's playing, skip, pause,
 * change the volume, or start one of your playlists. With Premium the HQ tab is a Spotify device of its own.
 */
export function MusicPanel({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const playing = useSpotify((s) => s.track?.playing ?? false);

  // pick up an existing connection on load (tokens saved in this browser)
  useEffect(() => { resumeSpotify(); }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={playing ? "Music (playing)" : "Music"} title="Music" className={cn("relative", className)}>
          <Music className="size-4" aria-hidden />
          {playing && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-emerald-500" aria-hidden />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="left" className="glass w-[min(20rem,calc(100vw-2rem))] bg-popover/95 p-3">
        <Body open={open} />
      </PopoverContent>
    </Popover>
  );
}

function Body({ open }: { open: boolean }) {
  const status = useSpotify((s) => s.status);
  const error = useSpotify((s) => s.error);
  const connect = useSpotify((s) => s.connect);

  if (!spotifyConfigured()) {
    return (
      <div className="space-y-1.5 text-sm">
        <p className="font-medium">Spotify isn&apos;t set up</p>
        <p className="text-xs text-muted-foreground">
          Add <code className="rounded bg-muted px-1">NEXT_PUBLIC_SPOTIFY_CLIENT_ID</code> to your environment (see README → Spotify), then reload.
        </p>
      </div>
    );
  }
  if (status === "off" || status === "error") {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <p className="font-medium">Office music from Spotify</p>
          <p className="text-xs text-muted-foreground">See what&apos;s playing and change it from here. Controls need Spotify Premium.</p>
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <button type="button" onClick={() => void connect()} className="h-9 w-full rounded-full bg-[#1db954] text-sm font-semibold text-black transition-opacity hover:opacity-90">
          Connect Spotify
        </button>
      </div>
    );
  }
  if (status === "connecting") {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Connecting…</p>;
  }
  return <Connected open={open} />;
}

function Connected({ open }: { open: boolean }) {
  const { track, isPremium, error, volume, activeDevice, deviceId, playlists } = useSpotify();
  const { toggle, next, prev, setVolume, fetchPlaylists, playPlaylist, disconnect } = useSpotify.getState();
  const canControl = isPremium !== false;

  useEffect(() => { if (open && playlists.length === 0) void fetchPlaylists(); }, [open, playlists.length, fetchPlaylists]);

  return (
    <div className="space-y-3 text-sm">
      <NowPlaying track={track} />
      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        {activeDevice ? `Playing on ${activeDevice}` : deviceId ? "Nothing playing · press play to start here" : "Nothing playing right now"}
      </p>

      <div className="flex items-center justify-center gap-2" role="group" aria-label="Playback">
        <button type="button" className={roundBtn} onClick={() => void prev()} disabled={!canControl || !track} aria-label="Previous track"><SkipBack className="size-4" aria-hidden /></button>
        <button
          type="button"
          className={cn(roundBtn, "size-12 bg-foreground text-background hover:bg-foreground/85")}
          onClick={() => void toggle()}
          disabled={!canControl || (!track && !deviceId)}
          aria-label={track?.playing ? "Pause" : "Play"}
        >
          {track?.playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
        </button>
        <button type="button" className={roundBtn} onClick={() => void next()} disabled={!canControl || !track} aria-label="Next track"><SkipForward className="size-4" aria-hidden /></button>
      </div>

      <label className="flex items-center gap-2">
        <Volume1 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">Volume</span>
        <input
          type="range" min={0} max={100} step={1} value={Math.round(volume * 100)} disabled={!canControl}
          onChange={(e) => void setVolume(Number(e.target.value) / 100)}
          className="h-1.5 w-full cursor-pointer accent-[#1db954] disabled:cursor-not-allowed"
        />
      </label>

      {!canControl && <p className="text-xs text-muted-foreground">Your account is Spotify Free: you can see what&apos;s playing, but Spotify only allows changing it with Premium.</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ListMusic className="size-3.5" aria-hidden /> Your playlists</p>
        <ul className="max-h-48 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
          {playlists.length === 0 && <li className="py-2 text-xs text-muted-foreground">No playlists yet.</li>}
          {playlists.map((p) => (
            <li key={p.id}>
              <button
                type="button" disabled={!canControl} onClick={() => void playPlaylist(p.uri)}
                className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
                aria-label={`Play ${p.name}`}
              >
                {p.image
                  ? <img src={p.image} alt="" className="size-8 shrink-0 rounded object-cover" />
                  : <span className="grid size-8 shrink-0 place-items-center rounded bg-muted"><Music className="size-3.5" aria-hidden /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{p.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{p.tracks} tracks</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button type="button" onClick={disconnect} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Unplug className="size-3.5" aria-hidden /> Disconnect Spotify
      </button>
    </div>
  );
}

function NowPlaying({ track }: { track: SpotifyTrack | null }) {
  // tick once a second so the progress bar moves between polls
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!track?.playing) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [track?.playing]);

  if (!track) {
    return (
      <div className="flex items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-muted"><Music className="size-5 text-muted-foreground" aria-hidden /></span>
        <p className="text-xs text-muted-foreground">Start music on any Spotify device, or pick a playlist below.</p>
      </div>
    );
  }
  const progress = liveProgressMs(track);
  const pct = track.durationMs ? (progress / track.durationMs) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {track.art
          ? <img src={track.art} alt={`${track.album} cover`} className="size-14 shrink-0 rounded-lg object-cover shadow-sm" />
          : <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-muted"><Music className="size-5" aria-hidden /></span>}
        <div className="min-w-0">
          <p className="truncate font-semibold">{track.title}</p>
          <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
        </div>
      </div>
      <div>
        <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Track progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className="h-full rounded-full bg-[#1db954]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>{fmt(progress)}</span><span>{fmt(track.durationMs)}</span>
        </div>
      </div>
    </div>
  );
}
