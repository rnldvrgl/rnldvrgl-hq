"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { toast } from "sonner";
import { Clapperboard, Play, Square, Users, X } from "lucide-react";
import { parseSource, positionNow, useWatch, type WatchState } from "@/lib/watch";
import { usePresence } from "@/lib/presence";
import { cn } from "@/lib/utils";

/**
 * Movie night in the Friends tab: start something (a YouTube link or a video file on your own server),
 * see what's on and who's watching, and open the synced player.
 */
export function MovieNightCard() {
  const now = useWatch((s) => s.now);
  const viewers = useWatch((s) => s.viewers);
  const watching = useWatch((s) => s.watching);
  const friends = usePresence((s) => s.friends);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const src = parseSource(url);
  const by = now ? friends.find((f) => f.id === now.by)?.owner ?? "A friend" : null;
  return (
    <div className="grid gap-2.5 rounded-2xl border border-border bg-card/60 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-600 text-white" aria-hidden><Clapperboard className="size-5" /></span>
        <span className="grid min-w-0 flex-1 leading-tight">
          <span className="font-semibold">Movie night</span>
          <span className="truncate text-xs text-muted-foreground">
            {now ? `${now.title} · started by ${by}` : "Watch together, in sync"}
          </span>
        </span>
        {now && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-label={`${viewers} watching`}>
            <Users className="size-3.5" aria-hidden /> {viewers}
          </span>
        )}
      </div>
      {now ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => useWatch.getState().setWatching(true)}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 text-sm font-semibold text-white">
            <Play className="size-4" aria-hidden /> {watching ? "Open the player" : "Join"}
          </button>
          <button type="button" onClick={() => useWatch.getState().stop()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
            <Square className="size-3.5" aria-hidden /> End
          </button>
        </div>
      ) : (
        <form className="grid gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (!src) { toast.error("Paste a YouTube link, or an https link to an .mp4 or .webm file."); return; }
          useWatch.getState().start(src, title.trim().slice(0, 80) || (src.kind === "youtube" ? "YouTube video" : decodeURIComponent(src.url.split("/").pop() ?? "Video")));
          setUrl(""); setTitle("");
        }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube link, or https://…/movie.mp4" aria-label="Video link" inputMode="url"
            className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40" />
          <div className="flex gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={80} aria-label="Title"
              className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40" />
            <button type="submit" disabled={!src} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-sm font-semibold text-white disabled:opacity-50">
              <Play className="size-4" aria-hidden /> Start
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">Everyone&apos;s browser loads the video itself: a file on your own server needs to allow it (a public https link).</p>
        </form>
      )}
    </div>
  );
}

/** The player, over everything while you're watching. Mounted once with the office. */
export function MoviePlayer() {
  const watching = useWatch((s) => s.watching);
  const now = useWatch((s) => s.now);
  if (!watching || !now) return null;
  return (
    <Dialog.Root open onOpenChange={(v) => { if (!v) useWatch.getState().setWatching(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 grid w-[min(70rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 gap-2 outline-none">
          <div className="flex items-center gap-2 text-white">
            <Dialog.Title className="min-w-0 flex-1 truncate font-semibold">{now.title}</Dialog.Title>
            <span className="inline-flex items-center gap-1 text-xs text-white/70"><Users className="size-3.5" aria-hidden /> {useWatch.getState().viewers}</span>
            <Dialog.Close aria-label="Close the player (keeps playing for the others)" className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
            {now.src.kind === "youtube" ? <YouTubePlayer key={now.src.id} state={now} /> : <FilePlayer key={now.src.url} state={now} />}
          </div>
          <p className="text-center text-xs text-white/60">Play, pause or skip: everyone watching follows. Closing this only closes it for you.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** How far off (seconds) before we jump to where the others are. */
const DRIFT = 1.5;

function FilePlayer({ state }: { state: WatchState }) {
  const v = useRef<HTMLVideoElement>(null);
  const applying = useRef(false);
  // follow the others
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    applying.current = true;
    const want = positionNow(state);
    if (Math.abs(el.currentTime - want) > DRIFT) el.currentTime = want;
    if (state.playing && el.paused) void el.play().catch(() => { /* needs a tap */ });
    if (!state.playing && !el.paused) el.pause();
    const t = setTimeout(() => { applying.current = false; }, 600);
    return () => clearTimeout(t);
  }, [state]);
  const tell = () => { const el = v.current; if (el && !applying.current) useWatch.getState().report(!el.paused, el.currentTime); };
  return (
    <video ref={v} src={state.src.url} controls playsInline preload="auto" className="size-full"
      onPlay={tell} onPause={tell} onSeeked={tell} onError={() => toast.error("This video file can't be played here (check the link allows other sites).")} />
  );
}

/* ---- YouTube, through its IFrame API (loaded once, only when someone watches) ---- */

type YTPlayer = { playVideo(): void; pauseVideo(): void; seekTo(s: number, allow: boolean): void; getCurrentTime(): number; getPlayerState(): number; destroy(): void };
type YTNamespace = { Player: new (el: HTMLElement, o: Record<string, unknown>) => YTPlayer; PlayerState: { PLAYING: number; PAUSED: number } };
declare global { interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void } }

let ytReady: Promise<YTNamespace> | null = null;
function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytReady ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return ytReady;
}

function YouTubePlayer({ state }: { state: WatchState }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const applying = useRef(false);
  const latest = useRef(state);
  latest.current = state;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    void loadYouTube().then((YT) => {
      if (dead || !host.current) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player.current = new YT.Player(el, {
        videoId: state.src.kind === "youtube" ? state.src.id : "",
        width: "100%", height: "100%",
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(positionNow(state)) },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e: { data: number }) => {
            if (applying.current) return;
            if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.PAUSED) {
              useWatch.getState().report(e.data === YT.PlayerState.PLAYING, player.current!.getCurrentTime());
            }
          },
        },
      });
    });
    return () => { dead = true; player.current?.destroy(); player.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // follow the others (and check for drift every few seconds)
  useEffect(() => {
    if (!ready) return;
    const apply = () => {
      const p = player.current, s = latest.current;
      if (!p) return;
      applying.current = true;
      const want = positionNow(s);
      if (Math.abs(p.getCurrentTime() - want) > DRIFT) p.seekTo(want, true);
      const playing = p.getPlayerState() === 1;
      if (s.playing && !playing) p.playVideo();
      if (!s.playing && playing) p.pauseVideo();
      setTimeout(() => { applying.current = false; }, 800);
    };
    apply();
    const t = setInterval(apply, 5000);
    return () => clearInterval(t);
  }, [ready, state]);

  return <div ref={host} className={cn("size-full [&>iframe]:size-full")} />;
}
