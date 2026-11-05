"use client";

import { useEffect, useState } from "react";
import { ChevronRight, MessagesSquare, UserPlus, WifiOff } from "lucide-react";
import { unreadRooms, useChat } from "@/lib/chat-client";
import { dmRoom, LOUNGE } from "@/lib/chat";
import { ChatView } from "./ChatView";
import { VoiceCard } from "./Voice";
import { usePresence, type Friend } from "@/lib/presence";
import { useOffice } from "@/lib/store";
import { openSettings } from "@/lib/settings-nav";
import { appNameOf } from "@/lib/prefs";
import { Glyph, iconGradient } from "@/lib/app-icon";
import { cn } from "@/lib/utils";

/**
 * Your circle: every friend's HQ, online first. A green dot is online now, amber is away (their app is open
 * in the background), grey is offline. Tap someone to message them, or the Lounge to talk to everyone.
 */
export function FriendsPanel() {
  const me = usePresence((s) => s.me);
  const friends = usePresence((s) => s.friends);
  const here = usePresence((s) => s.here);
  const link = usePresence((s) => s.link);
  const founder = useOffice((s) => s.data.hq?.founder ?? false);
  const others = friends.filter((f) => f.id !== me);
  const rank = (f: Friend) => (here[f.id]?.status === "online" ? 0 : here[f.id] ? 1 : 2);
  const sorted = [...others].sort((a, b) => rank(a) - rank(b) || a.owner.localeCompare(b.owner));
  const online = others.filter((f) => here[f.id]?.status === "online").length;
  const [room, setRoom] = useState<string | null>(null);
  // joined into one string so the selector returns the same value until it really changes
  const unread = useChat((s) => unreadRooms(s, me).join(" ")).split(" ");
  useEffect(() => { void useChat.getState().loadRooms(); }, []);

  if (room && me) {
    const other = room === LOUNGE ? null : friends.find((f) => room === dmRoom(me, f.id));
    return (
      <ChatView
        room={room}
        title={other ? other.owner : "Lounge"}
        sub={other ? `${appNameOf(other.handle)} · ${here[other.id]?.status === "online" ? "online" : here[other.id] ? "away" : "offline"}` : `Everyone in the circle · ${online} online`}
        onBack={() => setRoom(null)}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {others.length === 0 ? "No friends here yet." : `${online} of ${others.length} online`}
        </p>
        {founder && (
          <button type="button" onClick={() => openSettings("friends")} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted">
            <UserPlus className="size-3.5" aria-hidden /> Invite
          </button>
        )}
      </div>
      {link === "off" && (
        <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          <WifiOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Can&apos;t see who&apos;s online right now (Realtime isn&apos;t reachable or isn&apos;t set up yet: run supabase/multi-hq.sql).
        </p>
      )}
      {me && others.length > 0 && <VoiceCard />}
      {me && others.length > 0 && (
        <button type="button" onClick={() => setRoom(LOUNGE)}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-2.5 text-left transition-colors hover:bg-muted/60">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground" aria-hidden><MessagesSquare className="size-5" /></span>
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="font-semibold">Lounge</span>
            <span className="truncate text-xs text-muted-foreground">Group chat with everyone</span>
          </span>
          {unread.includes(LOUNGE) && <span className="size-2.5 rounded-full bg-primary" aria-label="New messages" />}
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}
      {others.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-8 text-center">
          <UserPlus className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Your circle is empty</p>
          <p className="max-w-64 text-xs text-muted-foreground">
            {founder ? "Make an invite link in Settings → Friends. Each friend gets their own HQ." : "Friends of this circle show up here."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-1">
          {sorted.map((f) => {
            const h = here[f.id];
            return (
              <li key={f.id}>
                <button type="button" onClick={() => me && setRoom(dmRoom(me, f.id))} aria-label={`Message ${f.owner}`}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted/60">
                <span className="relative shrink-0">
                  <span className="grid size-10 place-items-center rounded-xl [&>svg]:size-[66%]" style={{ background: iconGradient(f.icon) }} aria-hidden>
                    <Glyph glyph={f.icon.glyph} size={28} />
                  </span>
                  <span className={cn("absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-card",
                    h?.status === "online" ? "bg-emerald-500" : h ? "bg-amber-400" : "bg-muted-foreground/40")} aria-hidden />
                </span>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate font-semibold">{f.owner}</span>
                  <span className="truncate text-xs text-muted-foreground">{appNameOf(f.handle)}{f.founder ? " · host" : ""}</span>
                </span>
                <span className={cn("shrink-0 text-xs", h?.status === "online" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                  {h?.status === "online" ? "Online" : h ? "Away" : "Offline"}
                </span>
                {me && unread.includes(dmRoom(me, f.id)) && <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label="New messages" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
