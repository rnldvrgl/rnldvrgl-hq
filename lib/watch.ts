"use client";

import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Movie night: watch the same thing together, in sync. A YouTube video, or a video file from your own server
 * (an https link to an .mp4 / .webm). Nothing is uploaded or streamed through HQ: each viewer's browser loads
 * the video itself, and Supabase Realtime (private channel "hq:watch") only carries what's playing and
 * play / pause / where, so it costs nothing. Anyone watching can pause or skip, like sitting on one couch.
 *
 * Newcomers ask "what's on?" and whoever's watching answers with the current state.
 */

export type Source = { kind: "youtube"; id: string; url: string } | { kind: "file"; url: string };
/** What's playing: at real time `at` (ms), the video was at `pos` seconds, playing or paused. */
export type WatchState = { src: Source; title: string; playing: boolean; pos: number; at: number; by: string };

type WatchStore = {
  /** What's on in the circle (heard on the channel), even when you're not watching. */
  now: WatchState | null;
  /** Watching it: the player is open. */
  watching: boolean;
  viewers: number;
  connected: boolean;
  connect: (me: string) => void;
  disconnect: () => void;
  start: (src: Source, title: string) => void;
  /** You played, paused or skipped: tell everyone. */
  report: (playing: boolean, pos: number) => void;
  stop: () => void;
  setWatching: (on: boolean) => void;
};

let channel: RealtimeChannel | null = null;
let key = "";

/** A YouTube or video-file link, or null when it's neither. */
export function parseSource(input: string): Source | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "music.youtube.com") {
    id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? null;
  }
  if (id && /^[\w-]{11}$/.test(id)) return { kind: "youtube", id, url: `https://youtu.be/${id}` };
  if (/\.(mp4|webm|m4v|mov|ogv)$/i.test(u.pathname)) return { kind: "file", url: u.toString() };
  return null;
}

/** Where the video should be now. */
export const positionNow = (s: WatchState): number => s.pos + (s.playing ? (Date.now() - s.at) / 1000 : 0);

export const useWatch = create<WatchStore>()((set, get) => ({
  now: null,
  watching: false,
  viewers: 0,
  connected: false,

  connect: (me) => {
    if (channel) return;
    const supabase = browserClient();
    key = `${me}:${Math.random().toString(36).slice(2, 8)}`;
    void supabase.realtime.setAuth().then(() => {
      channel = supabase.channel("hq:watch", { config: { private: true, presence: { key }, broadcast: { self: false } } });
      channel
        .on("broadcast", { event: "state" }, ({ payload }) => {
          const s = payload as WatchState | null;
          set({ now: s && s.src ? s : null, ...(s ? {} : { watching: false }) });
        })
        .on("broadcast", { event: "hello" }, () => {
          // someone just opened HQ: tell them what's on, if we're watching it
          const s = get().now;
          if (s && get().watching) void channel?.send({ type: "broadcast", event: "state", payload: { ...s, pos: positionNow(s), at: Date.now() } });
        })
        .on("presence", { event: "sync" }, () => {
          const st = channel!.presenceState<{ watching: boolean }>();
          set({ viewers: Object.values(st).filter((m) => m[0]?.watching).length });
        })
        .subscribe(async (s) => {
          if (s !== "SUBSCRIBED") return;
          set({ connected: true });
          await channel!.track({ watching: get().watching });
          void channel!.send({ type: "broadcast", event: "hello", payload: {} });
        });
    });
  },
  disconnect: () => {
    if (channel) void browserClient().removeChannel(channel);
    channel = null;
    set({ connected: false });
  },

  start: (src, title) => {
    const s: WatchState = { src, title, playing: true, pos: 0, at: Date.now(), by: key.split(":")[0] };
    set({ now: s, watching: true });
    void channel?.send({ type: "broadcast", event: "state", payload: s });
    void channel?.track({ watching: true });
  },
  report: (playing, pos) => {
    const cur = get().now;
    if (!cur) return;
    const s = { ...cur, playing, pos, at: Date.now() };
    set({ now: s });
    void channel?.send({ type: "broadcast", event: "state", payload: s });
  },
  stop: () => {
    set({ now: null, watching: false });
    void channel?.send({ type: "broadcast", event: "state", payload: null });
    void channel?.track({ watching: false });
  },
  setWatching: (on) => {
    set({ watching: on });
    void channel?.track({ watching: on });
  },
}));
