"use client";

import { useEffect, useState } from "react";
import {
  Check, ChevronDown, Disc3, Gamepad2, Laptop, ListMusic, Loader2, MicVocal, Monitor, Music, Pause, Play, Radio, RefreshCw, SkipBack, SkipForward,
  SlidersHorizontal, Smartphone, Speaker, Tablet, Tv, Unplug, Volume1, type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { liveProgressMs, resumeSpotify, spotifyConfigured, useSpotify, type SpotifyDevice, type SpotifyTrack } from "@/lib/spotify";
import { useIsPhone } from "@/hooks/use-media";
import { cn } from "@/lib/utils";
import { MUSIC_STYLES, useSettings } from "@/lib/settings";
import { LyricsView } from "./Lyrics";
import { SoundMixer } from "./SoundMixer";
import { Library } from "./SpotifyLibrary";

const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const roundBtn =
  "grid size-10 place-items-center rounded-full transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-ring";

/**
 * The office's Spotify remote (top-right controls): connect your account, see what's playing, skip, pause,
 * change the volume, or start one of your playlists. With Premium the HQ tab is a Spotify device of its own.
 */
type Tab = "playing" | "lyrics" | "library" | "sound";
const TABS: readonly { id: Tab; label: string; icon: LucideIcon; spotify: boolean }[] = [
  { id: "playing", label: "Playing", icon: Disc3, spotify: false },
  { id: "lyrics", label: "Lyrics", icon: MicVocal, spotify: true },
  { id: "library", label: "Library", icon: ListMusic, spotify: true },
  { id: "sound", label: "Sound", icon: SlidersHorizontal, spotify: false },
];

/**
 * The office's music (top-right controls), in four tabs so nothing scrolls inside anything else:
 *   Playing  Spotify: connect, what's playing, play / skip, volume, the device it plays on
 *   Lyrics   the song's lyrics, scrolling along
 *   Library  search songs, your playlists
 *   Sound    the office radio's style and the office sound's volumes
 */
export function MusicPanel({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("playing");
  const playing = useSpotify((s) => s.track?.playing ?? false);
  const ready = useSpotify((s) => s.status === "ready");
  const hasTrack = useSpotify((s) => !!s.track);
  const phone = useIsPhone();

  // pick up the shared connection on load, and when coming back to the tab (connected from another device meanwhile)
  useEffect(() => {
    resumeSpotify();
    const onVisible = () => { if (document.visibilityState === "visible") resumeSpotify(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const tabs = TABS.filter((t) => !t.spotify || ready);
  const current = tabs.some((t) => t.id === tab) ? tab : "playing";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={playing ? "Music (playing)" : "Music"} title="Music" className={cn("relative", className)}>
          <Music className="size-4" aria-hidden />
          {playing && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-emerald-500" aria-hidden />}
        </button>
      </PopoverTrigger>
      {/* phones: drop down under the buttons at nearly full width (to the left there's no room) */}
      <PopoverContent
        align="end" side={phone ? "bottom" : "left"} collisionPadding={12}
        className={cn("glass flex flex-col gap-0 overflow-hidden bg-popover/95 p-0", phone ? "w-[calc(100vw-1.5rem)]" : "w-[22rem]")}
        style={{ maxHeight: "min(80dvh, 42rem, calc(var(--radix-popover-content-available-height) - 0.5rem))" }}
      >
        <div role="tablist" aria-label="Music" className="m-2 mb-0 grid shrink-0 auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted/70 p-1">
          {tabs.map((t) => (
            <button
              key={t.id} type="button" role="tab" aria-selected={current === t.id} onClick={() => setTab(t.id)}
              disabled={t.id === "lyrics" && !hasTrack}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40",
                current === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-3.5" aria-hidden /> {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className={cn("min-h-0 flex-1 p-3 pr-1.5", current === "lyrics" || current === "library" ? "flex flex-col" : "scroll-thin")}>
          {current === "playing" && <Body open={open} />}
          {current === "lyrics" && <LyricsTab />}
          {current === "library" && <Library open={open} />}
          {current === "sound" && (
            <div className="space-y-4 pr-1.5">
              <OfficeRadio />
              <section className="space-y-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><SlidersHorizontal className="size-3.5" aria-hidden /> Office sound volumes</p>
                <SoundMixer compact />
              </section>
            </div>
          )}
        </div>
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
      <div className="space-y-1.5 pr-1.5 text-sm">
        <p className="font-medium">Spotify isn&apos;t set up</p>
        <p className="text-xs text-muted-foreground">
          Add <code className="rounded bg-muted px-1">NEXT_PUBLIC_SPOTIFY_CLIENT_ID</code> to your environment (see README → Spotify), then reload.
          The office radio still plays: see the Sound tab.
        </p>
      </div>
    );
  }
  if (status === "off" || status === "error") {
    return (
      <div className="space-y-3 pr-1.5 text-sm">
        <div>
          <p className="font-medium">Office music from Spotify</p>
          <p className="text-xs text-muted-foreground">Connect once and every device you sign in on has it. Controls need Spotify Premium.</p>
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <button type="button" onClick={() => void connect()} className="h-10 w-full rounded-full bg-[#1db954] text-sm font-semibold text-black transition-opacity hover:opacity-90">
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
  const { track, isPremium, error, volume, activeDevice, deviceId } = useSpotify();
  const { toggle, next, prev, setVolume, disconnect } = useSpotify.getState();
  const canControl = isPremium !== false;
  void open;

  return (
    <div className="space-y-4 pr-1.5 text-sm">
      <NowPlaying track={track} />

      <div className="flex items-center justify-center gap-3" role="group" aria-label="Playback">
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

      <label className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
        <Volume1 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">Spotify volume</span>
        <input
          type="range" min={0} max={100} step={1} value={Math.round(volume * 100)} disabled={!canControl}
          onChange={(e) => void setVolume(Number(e.target.value) / 100)}
          className="h-1.5 w-full cursor-pointer accent-[#1db954] disabled:cursor-not-allowed"
        />
        <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{Math.round(volume * 100)}%</span>
      </label>

      <Devices activeDevice={activeDevice} deviceId={deviceId} canControl={canControl} />

      {!canControl && <p className="text-xs text-muted-foreground">Your account is Spotify Free: you can see what&apos;s playing, but Spotify only allows changing it with Premium.</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <button type="button" onClick={disconnect} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Unplug className="size-3.5" aria-hidden /> Disconnect Spotify on all devices
      </button>
    </div>
  );
}

/** The lyrics fill the tab: the only scrolling box in it. */
function LyricsTab() {
  const track = useSpotify((s) => s.track);
  if (!track) return <p className="text-xs text-muted-foreground">Nothing playing.</p>;
  return (
    <>
      <p className="mb-1 shrink-0 truncate pr-1.5 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{track.title}</span> · {track.artist}</p>
      <LyricsView track={track} className="scroll-thin h-[min(56dvh,26rem)] max-h-none min-h-0 flex-1" />
    </>
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

const DEVICE_ICON: Record<string, LucideIcon> = {
  computer: Laptop, smartphone: Smartphone, tablet: Tablet, speaker: Speaker, tv: Tv, avr: Speaker, stb: Tv,
  audiodongle: Speaker, castvideo: Tv, castaudio: Speaker, game_console: Gamepad2, automobile: Speaker,
};
const deviceIcon = (d: SpotifyDevice): LucideIcon => DEVICE_ICON[d.type.toLowerCase()] ?? Monitor;

/**
 * Where the music plays, like the Spotify app's device picker: this HQ tab, your phone, a speaker or TV with
 * Spotify Connect… Only devices that are on and have Spotify open (or awake) show up; that's Spotify's rule.
 */
function Devices({ activeDevice, deviceId, canControl }: { activeDevice: string | null; deviceId: string | null; canControl: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const devices = useSpotify((s) => s.devices);
  const activeId = useSpotify((s) => s.activeDeviceId);
  const { fetchDevices, playOn } = useSpotify.getState();
  const refresh = async () => { setBusy(true); await fetchDevices(); setBusy(false); };
  useEffect(() => { if (open) void refresh(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = activeDevice ? `Playing on ${activeDevice}` : deviceId ? "Nothing playing · press play to start here" : "Nothing playing right now";
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} disabled={!canControl}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs disabled:opacity-70"
      >
        <Speaker className={cn("size-4 shrink-0", activeDevice ? "text-[#1db954]" : "text-muted-foreground")} aria-hidden />
        <span className="min-w-0 flex-1 truncate" aria-live="polite">{summary}</span>
        {canControl && <span className="shrink-0 font-medium text-muted-foreground">Device</span>}
        {canControl && <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />}
      </button>
      {open && (
        <div className="border-t border-border p-1">
          <ul className="grid gap-0.5" aria-label="Play on">
            {devices.map((d) => {
              const Icon = deviceIcon(d);
              const active = d.id === activeId || (!activeId && d.active);
              return (
                <li key={d.id}>
                  <button
                    type="button" disabled={d.restricted} onClick={() => void playOn(d.id)} aria-pressed={active}
                    className={cn("flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors hover:bg-muted disabled:opacity-50", active && "text-[#1db954]")}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-xs font-medium">{d.name}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {d.id === deviceId ? "This device" : d.restricted ? "Can't be controlled from here" : d.type}
                      </span>
                    </span>
                    {active && <Check className="size-4 shrink-0" aria-hidden />}
                  </button>
                </li>
              );
            })}
            {devices.length === 0 && !busy && (
              <li className="px-2 py-2 text-[11px] text-muted-foreground">No devices found. Open Spotify on your phone, computer or speaker, then refresh.</li>
            )}
          </ul>
          <button type="button" onClick={() => void refresh()} disabled={busy} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn("size-3", busy && "animate-spin")} aria-hidden /> {busy ? "Looking for devices…" : "Refresh"}
          </button>
        </div>
      )}
    </div>
  );
}

/** The office sound system's own music (no Spotify needed): on/off and the style. */
function OfficeRadio() {
  const music = useSettings((s) => s.music);
  const style = useSettings((s) => s.musicStyle);
  const { setMusic, setMusicStyle } = useSettings.getState();
  const spotifyPlaying = useSpotify((s) => s.track?.playing ?? false);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Radio className="size-3.5" aria-hidden /> Office radio</p>
        <button
          type="button" role="switch" aria-checked={music} onClick={() => setMusic(!music)} aria-label="Office radio"
          className={cn("relative h-5 w-9 rounded-full transition-colors", music ? "bg-primary" : "bg-muted-foreground/30")}
        >
          <span className={cn("absolute top-0.5 size-4 rounded-full bg-background shadow transition-[left]", music ? "left-[1.125rem]" : "left-0.5")} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Office radio style">
        {MUSIC_STYLES.map((m) => (
          <button
            key={m.id} type="button" role="radio" aria-checked={style === m.id} onClick={() => setMusicStyle(m.id)}
            className={cn("rounded-lg border px-2 py-1.5 text-left leading-tight transition-colors hover:bg-muted", style === m.id ? "border-ring bg-accent" : "border-border")}
          >
            <span className="block text-xs font-semibold">{m.label}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{m.hint}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {spotifyPlaying ? "Paused while Spotify plays." : "Plays 8 AM – 7 PM with the office sound on (speaker button)."}
      </p>
    </div>
  );
}
