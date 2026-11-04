"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { lineAt, useLyrics } from "@/lib/lyrics";
import { liveProgressMs, type SpotifyTrack } from "@/lib/spotify";
import { cn } from "@/lib/utils";

/** The track's position in ms, re-read every `every` ms while it plays (Spotify is only polled every 5 s). */
export function useLiveProgress(track: SpotifyTrack | null, every = 250): number {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!track?.playing) return;
    const id = setInterval(() => tick((n) => n + 1), every);
    return () => clearInterval(id);
  }, [track?.playing, every]);
  return track ? liveProgressMs(track) : 0;
}

/**
 * The song's lyrics, karaoke style: synced lyrics scroll on their own with the line being sung lit up;
 * lyrics without timing are shown as plain text to scroll yourself.
 */
export function LyricsView({ track, className }: { track: SpotifyTrack; className?: string }) {
  const entry = useLyrics(track);
  const ms = useLiveProgress(track);
  const box = useRef<HTMLDivElement>(null);
  const synced = entry?.state === "ready" ? entry.lyrics.synced : null;
  const at = synced ? lineAt(synced, ms + 250) : -1;

  // keep the sung line in the upper middle of the box (unless the person is scrolling it themselves)
  const userScroll = useRef(0);
  useEffect(() => {
    const el = box.current;
    if (!el || at < 0 || performance.now() - userScroll.current < 4000) return;
    const row = el.querySelector<HTMLElement>(`[data-line="${at}"]`);
    if (row) el.scrollTo({ top: row.offsetTop - el.clientHeight * 0.35, behavior: "smooth" });
  }, [at]);

  if (!entry || entry.state === "loading") {
    return <p className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}><Loader2 className="size-3.5 animate-spin" aria-hidden /> Finding the lyrics…</p>;
  }
  if (entry.state === "error") return <p className={cn("text-xs text-muted-foreground", className)}>{entry.message}</p>;
  const { lyrics } = entry;
  if (lyrics.instrumental) return <p className={cn("text-xs text-muted-foreground", className)}>Instrumental, no lyrics. Enjoy the music.</p>;
  if (!lyrics.synced && !lyrics.plain) return <p className={cn("text-xs text-muted-foreground", className)}>No lyrics found for this song.</p>;

  return (
    <div
      ref={box}
      onWheel={() => { userScroll.current = performance.now(); }}
      onTouchMove={() => { userScroll.current = performance.now(); }}
      className={cn("relative max-h-56 overflow-y-auto overscroll-contain pr-1 [mask-image:linear-gradient(transparent,#000_12%,#000_85%,transparent)]", className)}
      aria-label={`Lyrics of ${track.title}`}
    >
      {synced ? (
        <ol className="space-y-1.5 py-6">
          {synced.map((l, i) => (
            <li
              key={`${l.t}-${i}`}
              data-line={i}
              aria-current={i === at ? "true" : undefined}
              className={cn(
                "text-sm font-semibold leading-snug transition-[color,opacity,transform] duration-300 motion-reduce:transition-none",
                i === at ? "text-foreground" : i < at ? "text-muted-foreground/60" : "text-muted-foreground",
                !l.line && "h-3",
              )}
            >
              {l.line || (i === at ? "♪" : "")}
            </li>
          ))}
        </ol>
      ) : (
        <p className="whitespace-pre-line py-4 text-sm leading-relaxed text-muted-foreground">{lyrics.plain}</p>
      )}
      <p className="pb-2 text-[10px] text-muted-foreground/70">Lyrics from LRCLIB</p>
    </div>
  );
}

/** Just the line being sung right now (and the next one), for the small floating player. null when there's none. */
export function useCurrentLine(track: SpotifyTrack | null, enabled: boolean): { now: string; next: string } | null {
  const entry = useLyrics(track, enabled);
  const ms = useLiveProgress(enabled ? track : null);
  const synced = entry?.state === "ready" ? entry.lyrics.synced : null;
  if (!synced) return null;
  const at = lineAt(synced, ms + 250);
  if (at < 0) return { now: "♪", next: synced[0]?.line ?? "" };
  const next = synced.slice(at + 1).find((l) => l.line)?.line ?? "";
  return { now: synced[at].line || "♪", next };
}
