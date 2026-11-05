"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MicVocal, Music, Pause, Play, Radio, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { useSpotify } from "@/lib/spotify";
import { musicStyleLabel, useRadio } from "@/lib/ambience";
import { MUSIC_STYLES, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { LyricsView, useCurrentLine, useLiveProgress } from "./Lyrics";
import { usePlaceOpen } from "./Places";

/**
 * A floating "now playing" card over the bottom-left of the office. It sits small (cover, title, a little
 * equalizer) and grows for a few seconds whenever the music changes, so you can see what just came on,
 * then shrinks back. Tap it to keep it open: controls, volume, progress and the lyrics, scrolling along.
 * Shows the Spotify track, or the office sound system's style when that's what's playing.
 */

const AUTO_MS = 7000;
/** Phones get 44 px touch targets. */
const btn = "grid size-8 place-items-center rounded-full transition-colors hover:bg-foreground/10 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ring max-sm:size-11";

export function NowPlayingFloat() {
  const track = useSpotify((s) => s.track);
  const isPremium = useSpotify((s) => s.isPremium);
  const radio = useRadio();
  const placeOpen = usePlaceOpen();
  const [pinned, setPinned] = useState(false);
  const [auto, setAuto] = useState(false);
  const [lyricsOn, setLyricsOn] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovering = useRef(false);

  const source: "spotify" | "radio" | null = track ? "spotify" : radio.on ? "radio" : null;
  const key = track ? track.id : radio.on ? `radio:${radio.style}` : null;

  // grow when the music changes (a new song, or the office radio switching style), shrink after a few seconds
  const armCollapse = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (!hovering.current) setAuto(false); }, AUTO_MS);
  };
  useEffect(() => {
    if (!key) return;
    setAuto(true);
    armCollapse();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const expanded = pinned || auto;
  // the small card shows the line being sung; the big one the whole lyrics
  const line = useCurrentLine(source === "spotify" ? track : null, lyricsOn && source === "spotify" && !expanded);
  const ms = useLiveProgress(source === "spotify" ? track : null, 1000);

  if (!source || placeOpen) return null;
  const canControl = isPremium !== false;
  const title = source === "spotify" ? track!.title : musicStyleLabel(radio.style);
  const sub = source === "spotify" ? track!.artist : "Office radio";
  const playing = source === "spotify" ? track!.playing : true;
  const pct = source === "spotify" && track!.durationMs ? Math.min(100, (ms / track!.durationMs) * 100) : 0;

  return (
    <div
      role="region"
      aria-label="Now playing"
      onMouseEnter={() => { hovering.current = true; }}
      onMouseLeave={() => { hovering.current = false; if (auto && !pinned) armCollapse(); }}
      className={cn(
        "glass absolute bottom-3 left-3 z-30 max-h-[calc(100%-1.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:thin] bg-popover/85 shadow-lg transition-[width,border-radius,box-shadow] duration-500 ease-out motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in",
        // just changed: a soft glow in the music's colour while it's big
        auto && !pinned && (source === "spotify" ? "ring-2 ring-[#1db954]/40" : "ring-2 ring-primary/30"),
        expanded ? "w-[min(19rem,calc(100%-5.5rem))] rounded-2xl" : "w-[min(14rem,calc(100%-5.5rem))] rounded-[1.4rem]",
      )}
    >
      <button
        type="button"
        onClick={() => { if (expanded) { setPinned(false); setAuto(false); } else setPinned(true); }}
        aria-expanded={expanded}
        aria-label={expanded ? "Shrink the music card" : `Now playing: ${title}, ${sub}. Show more`}
        className="flex w-full items-center gap-2.5 p-1.5 pr-3 text-left"
      >
        <Cover art={source === "spotify" ? track!.art : null} big={expanded} radio={source === "radio"} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className={cn("block truncate font-semibold transition-[font-size] duration-500", expanded ? "text-sm" : "text-xs")}>{title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {!expanded && line && lyricsOn ? line.now : sub}
          </span>
        </span>
        {expanded
          ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          : <Eq on={playing} spotify={source === "spotify"} />}
      </button>

      {/* the part that grows */}
      <div className={cn("grid transition-[grid-template-rows] duration-500 ease-out", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 px-3 pb-3">
            {source === "spotify" ? (
              <>
                {lyricsOn && (
                  // the whole lyrics, wrapped and scrolling along with the song, sized to the screen so they are never cut off
                  <LyricsView track={track!} className="scroll-thin max-h-[min(10rem,24dvh)] text-pretty sm:max-h-[min(15rem,34dvh)]" />
                )}
                <div className="h-1 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                  <div className="h-full rounded-full bg-[#1db954] transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <button type="button" className={cn(btn, lyricsOn && "text-[#1db954]")} onClick={() => setLyricsOn((v) => !v)} aria-pressed={lyricsOn} aria-label="Lyrics" title="Lyrics">
                    <MicVocal className="size-4" aria-hidden />
                  </button>
                  <div className="flex items-center gap-1" role="group" aria-label="Playback">
                    <button type="button" className={btn} disabled={!canControl} onClick={() => void useSpotify.getState().prev()} aria-label="Previous track"><SkipBack className="size-4" aria-hidden /></button>
                    <button type="button" className={cn(btn, "size-9 bg-foreground text-background hover:bg-foreground/85 max-sm:size-11")} disabled={!canControl} onClick={() => void useSpotify.getState().toggle()} aria-label={playing ? "Pause" : "Play"}>
                      {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                    </button>
                    <button type="button" className={btn} disabled={!canControl} onClick={() => void useSpotify.getState().next()} aria-label="Next track"><SkipForward className="size-4" aria-hidden /></button>
                  </div>
                  <span className="w-8 max-sm:w-11" aria-hidden />
                </div>
                <VolumeRow disabled={!canControl} />
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">{MUSIC_STYLES.find((m) => m.id === radio.style)?.hint}</p>
                <button
                  type="button"
                  className={cn(btn, "w-auto gap-1.5 px-2.5 text-xs font-medium")}
                  onClick={() => {
                    const i = MUSIC_STYLES.findIndex((m) => m.id === radio.style);
                    useSettings.getState().setMusicStyle(MUSIC_STYLES[(i + 1) % MUSIC_STYLES.length].id);
                  }}
                >
                  <Shuffle className="size-3.5" aria-hidden /> Next style
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Spotify's volume, through the store's setVolume (which sends at most one change per 250 ms while you drag
 * and keeps polls from moving the slider back for 4 s). The speaker button mutes and un-mutes.
 */
function VolumeRow({ disabled }: { disabled: boolean }) {
  const volume = useSpotify((s) => s.volume);
  const before = useRef(0.6);
  const pct = Math.round(volume * 100);
  const Icon = pct === 0 ? VolumeX : pct < 50 ? Volume1 : Volume2;
  const set = (v: number) => void useSpotify.getState().setVolume(v);
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button" className={cn(btn, "shrink-0 text-muted-foreground")} disabled={disabled}
        onClick={() => { if (volume > 0) { before.current = volume; set(0); } else set(before.current || 0.6); }}
        aria-label={pct === 0 ? "Unmute Spotify" : "Mute Spotify"} title={pct === 0 ? "Unmute" : "Mute"}
      >
        <Icon className="size-4" aria-hidden />
      </button>
      <input
        type="range" min={0} max={100} step={1} value={pct} disabled={disabled} aria-label="Spotify volume" aria-valuetext={`${pct}%`}
        onChange={(e) => set(Number(e.target.value) / 100)}
        className="h-6 w-0 min-w-0 flex-1 cursor-pointer accent-[#1db954] disabled:cursor-not-allowed max-sm:h-11"
      />
      <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground" aria-hidden>{pct}%</span>
    </div>
  );
}

function Cover({ art, big, radio }: { art: string | null; big: boolean; radio: boolean }) {
  const size = cn("shrink-0 rounded-xl object-cover shadow-sm transition-[width,height] duration-500 ease-out", big ? "size-14" : "size-9");
  if (art) return <img src={art} alt="" className={size} />;
  return (
    <span className={cn(size, "grid place-items-center", radio ? "bg-primary/15 text-primary" : "bg-[#1db954]/15 text-[#1db954]")}>
      {radio ? <Radio className="size-4" aria-hidden /> : <Music className="size-4" aria-hidden />}
    </span>
  );
}

/** Three bouncing bars while music plays (still when paused). */
function Eq({ on, spotify }: { on: boolean; spotify: boolean }) {
  return (
    <span className="flex h-4 shrink-0 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full", spotify ? "bg-[#1db954]" : "bg-primary", on ? "eq-bar h-full" : "h-1.5")}
        />
      ))}
    </span>
  );
}
