"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase/browser";
import type { AppIcon } from "@/lib/prefs";

/**
 * Who's online: every open HQ joins one Supabase Realtime presence channel ("hq:lobby", private, so only
 * signed-in people can join; see multi-hq.sql) and says it's here, or away when its tab is hidden.
 * The friends list (/api/friends) is everyone in the circle; this adds who's around right now.
 * Free: Realtime presence is included in Supabase's free plan, and nothing is stored.
 */

export type Friend = { id: string; handle: string; owner: string; icon: AppIcon; founder: boolean; joined: string };
export type Status = "online" | "away";
type Here = { status: Status; since: number };

type PresenceStore = {
  me: string | null;
  friends: Friend[];
  /** HQ id → how they're here (missing = offline). */
  here: Record<string, Here>;
  /** "connecting" until the channel is joined; "off" when Realtime isn't set up or can't be reached. */
  link: "connecting" | "live" | "off";
  loadFriends: () => Promise<void>;
};

export const usePresence = create<PresenceStore>()((set) => ({
  me: null,
  friends: [],
  here: {},
  link: "connecting",
  loadFriends: async () => {
    try {
      const res = await fetch("/api/friends", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { me: string; friends: Friend[] };
      set({ me: body.me, friends: body.friends });
    } catch { /* offline: keep the last list */ }
  },
}));

// the lobby also carries chat pings: "something new in room X" (no text: the text is fetched from the API,
// which checks you're allowed to read it)
let lobby: RealtimeChannel | null = null;
let onPing: ((p: { room: string; from: string }) => void) | null = null;
export const setChatPingListener = (fn: typeof onPing): void => { onPing = fn; };
export function sendChatPing(room: string, from: string): void {
  if (lobby) void lobby.send({ type: "broadcast", event: "chat", payload: { room, from } });
}

/** Join the lobby while the office is open (mount once). */
export function usePresenceLink(myHq: string | undefined): void {
  useEffect(() => {
    if (!myHq) return;
    void usePresence.getState().loadFriends();
    const refresh = setInterval(() => void usePresence.getState().loadFriends(), 5 * 60_000);
    const supabase = browserClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    const status = (): Status => (document.visibilityState === "visible" ? "online" : "away");
    const since = Date.now();

    void (async () => {
      await supabase.realtime.setAuth(); // private channels check the signed-in user's token
      if (cancelled) return;
      channel = supabase.channel("hq:lobby", { config: { private: true, presence: { key: myHq } } });
      lobby = channel;
      channel
        .on("broadcast", { event: "chat" }, ({ payload }) => {
          const p = payload as { room?: unknown; from?: unknown };
          if (typeof p.room === "string" && typeof p.from === "string") onPing?.({ room: p.room, from: p.from });
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<Here>();
          const here: Record<string, Here> = {};
          for (const [id, metas] of Object.entries(state)) {
            // the same HQ open on two devices: online if any of them is
            const m = metas.find((x) => x.status === "online") ?? metas[0];
            if (m) here[id] = { status: m.status, since: m.since };
          }
          usePresence.setState({ here });
          // someone new turned up: they may have just joined the circle
          if (Object.keys(here).some((id) => !usePresence.getState().friends.some((f) => f.id === id))) void usePresence.getState().loadFriends();
        })
        .subscribe(async (s) => {
          if (s === "SUBSCRIBED") {
            usePresence.setState({ link: "live" });
            await channel!.track({ status: status(), since });
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
            usePresence.setState({ link: "off" });
          }
        });
    })();

    const onVisible = () => { if (channel) void channel.track({ status: status(), since }); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(refresh);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
      lobby = null;
    };
  }, [myHq]);
}

/** How many friends (not you) are online now. */
export const useOnlineCount = (): number => usePresence((s) => Object.entries(s.here).filter(([id, h]) => id !== s.me && h.status === "online").length);
