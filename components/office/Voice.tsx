"use client";

import { Headphones, HeadphoneOff, Loader2, Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { useVoice, type VoicePeer } from "@/lib/voice";
import { usePresence } from "@/lib/presence";
import { useOffice } from "@/lib/store";
import { Glyph, iconGradient } from "@/lib/app-icon";
import { DEFAULT_ICON } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/** The voice lounge in the Friends tab: who's in, and join / mute / deafen / leave. */
export function VoiceCard() {
  const v = useVoice();
  const myHq = useOffice((s) => s.data.hq?.id);
  const peers = Object.entries(v.peers);
  return (
    <div className="grid gap-2.5 rounded-2xl border border-border bg-card/60 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white" aria-hidden><Volume2 className="size-5" /></span>
        <span className="grid min-w-0 flex-1 leading-tight">
          <span className="font-semibold">Voice lounge</span>
          <span className="truncate text-xs text-muted-foreground">
            {v.joined ? `You${peers.length ? ` and ${peers.length} more` : ", waiting for friends"}` : "Talk with friends, straight from your HQ"}
          </span>
        </span>
        {!v.joined && (
          <button type="button" disabled={!myHq || v.joining} onClick={() => myHq && void v.join(myHq)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-sm font-semibold text-white disabled:opacity-50">
            {v.joining ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mic className="size-4" aria-hidden />} Join
          </button>
        )}
      </div>
      {v.error && <p className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{v.error}</p>}
      {v.joined && (
        <>
          <ul className="flex flex-wrap gap-2" aria-label="In the voice lounge">
            <Person hq={myHq ?? ""} you speaking={v.speaking} muted={v.muted} />
            {peers.map(([k, p]) => <Person key={k} hq={p.hq} speaking={p.speaking} muted={p.muted} state={p.state} />)}
          </ul>
          <Controls />
        </>
      )}
    </div>
  );
}

function Person({ hq, you, speaking, muted, state }: { hq: string; you?: boolean; speaking: boolean; muted: boolean; state?: VoicePeer["state"] }) {
  const f = usePresence((s) => s.friends.find((x) => x.id === hq));
  const icon = f?.icon ?? DEFAULT_ICON;
  const failed = state === "failed";
  return (
    <li className="grid w-16 justify-items-center gap-1 text-center" title={failed ? "Couldn't connect (a strict network on one side)" : undefined}>
      <span className={cn("relative grid size-11 place-items-center rounded-2xl transition-shadow [&>svg]:size-[64%]",
        speaking ? "ring-3 ring-emerald-500 ring-offset-2 ring-offset-card" : "", failed && "opacity-40")} style={{ background: iconGradient(icon) }}>
        <Glyph glyph={icon.glyph} size={28} />
        {muted && <MicOff className="absolute -right-1 -bottom-1 size-4 rounded-full bg-destructive p-0.5 text-white" aria-label="Muted" />}
      </span>
      <span className="w-full truncate text-[11px] font-medium">{you ? "You" : f?.owner ?? "Friend"}</span>
      {state && state !== "connected" && <span className="text-[9.5px] text-muted-foreground">{failed ? "No link" : "Connecting…"}</span>}
    </li>
  );
}

function Controls({ compact = false }: { compact?: boolean }) {
  const v = useVoice();
  const btn = cn("grid place-items-center rounded-full transition-colors", compact ? "size-9" : "size-10");
  return (
    <div className={cn("flex items-center gap-2", !compact && "justify-center")} role="group" aria-label="Voice controls">
      <button type="button" onClick={() => v.setMuted(!v.muted)} aria-pressed={v.muted} aria-label={v.muted ? "Unmute" : "Mute"} title={v.muted ? "Unmute" : "Mute"}
        className={cn(btn, v.muted ? "bg-destructive text-white" : "bg-muted hover:bg-muted/70")}>
        {v.muted ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
      </button>
      <button type="button" onClick={() => v.setDeafened(!v.deafened)} aria-pressed={v.deafened} aria-label={v.deafened ? "Undeafen" : "Deafen"} title={v.deafened ? "Hear again" : "Deafen"}
        className={cn(btn, v.deafened ? "bg-destructive text-white" : "bg-muted hover:bg-muted/70")}>
        {v.deafened ? <HeadphoneOff className="size-4" aria-hidden /> : <Headphones className="size-4" aria-hidden />}
      </button>
      <button type="button" onClick={v.leave} aria-label="Leave voice" title="Leave"
        className={cn(btn, "bg-destructive/90 text-white hover:bg-destructive", !compact && "w-auto gap-1.5 px-4 text-sm font-semibold")}>
        <PhoneOff className="size-4" aria-hidden />{!compact && " Leave"}
      </button>
    </div>
  );
}

/** While you're in voice: a small bar over the office, so you can mute or leave from anywhere. */
export function VoiceBar() {
  const joined = useVoice((s) => s.joined);
  const count = useVoice((s) => Object.keys(s.peers).length);
  const speaking = useVoice((s) => s.speaking || Object.values(s.peers).some((p) => p.speaking));
  if (!joined) return null;
  return (
    <div className="glass pointer-events-auto absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-popover/90 py-1.5 pr-1.5 pl-3.5 shadow-lg">
      <span className={cn("size-2.5 rounded-full", speaking ? "bg-emerald-500 motion-safe:animate-pulse" : "bg-emerald-500/50")} aria-hidden />
      <span className="text-xs font-medium whitespace-nowrap">Voice · {count + 1} in</span>
      <Controls compact />
    </div>
  );
}
