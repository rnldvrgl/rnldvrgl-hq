"use client";

import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient } from "@/lib/supabase/browser";

/**
 * The voice lounge: talk with friends, free. Everyone in it connects straight to everyone else (a WebRTC
 * mesh, fine for a handful of people); Supabase Realtime (private channel "hq:voice") only carries who's
 * in the room and the connection handshakes. Audio never goes through a server. Google's public STUN
 * server helps two people find each other; on some strict networks (no free relay) a pair can't connect,
 * and the panel says so.
 *
 * Each device is its own peer ("<hq id>:<random>"), so the same HQ on a phone and a laptop both work.
 */

export type VoicePeer = { hq: string; muted: boolean; speaking: boolean; state: RTCPeerConnectionState | "new" };

type VoiceStore = {
  joined: boolean;
  joining: boolean;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  /** Peer key → them (everyone else in the room). */
  peers: Record<string, VoicePeer>;
  error: string | null;
  join: (hq: string) => Promise<void>;
  leave: () => void;
  setMuted: (on: boolean) => void;
  setDeafened: (on: boolean) => void;
};

const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

let me = "";
let channel: RealtimeChannel | null = null;
let local: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let meter: ReturnType<typeof setInterval> | null = null;
const pcs = new Map<string, RTCPeerConnection>();
const audios = new Map<string, HTMLAudioElement>();
const analysers = new Map<string, AnalyserNode>();
const supabase = typeof window === "undefined" ? null : browserClient();

const hqOf = (key: string) => key.split(":")[0];

export const useVoice = create<VoiceStore>()((set, get) => ({
  joined: false,
  joining: false,
  muted: false,
  deafened: false,
  speaking: false,
  peers: {},
  error: null,

  join: async (hq) => {
    if (get().joined || get().joining || !supabase) return;
    set({ joining: true, error: null });
    try {
      local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      set({ joining: false, error: "HQ needs your microphone for voice. Allow it in the browser, then try again." });
      return;
    }
    me = `${hq}:${Math.random().toString(36).slice(2, 8)}`;
    audioCtx = new AudioContext();
    watch(me, local);
    await supabase.realtime.setAuth();
    channel = supabase.channel("hq:voice", { config: { private: true, presence: { key: me }, broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "signal" }, ({ payload }) => void onSignal(payload as Signal))
      .on("presence", { event: "sync" }, () => syncRoom())
      .subscribe(async (s) => {
        if (s === "SUBSCRIBED") {
          set({ joined: true, joining: false });
          await channel!.track({ muted: get().muted });
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          set({ error: "Can't reach the voice lounge right now." });
          get().leave();
        }
      });
    meter = setInterval(measure, 120);
    window.addEventListener("pagehide", get().leave, { once: true });
  },

  leave: () => {
    if (meter) clearInterval(meter);
    meter = null;
    for (const k of [...pcs.keys()]) drop(k);
    local?.getTracks().forEach((t) => t.stop());
    local = null;
    analysers.clear();
    void audioCtx?.close();
    audioCtx = null;
    if (channel && supabase) void supabase.removeChannel(channel);
    channel = null;
    set({ joined: false, joining: false, peers: {}, speaking: false });
  },

  setMuted: (muted) => {
    local?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    set({ muted });
    void channel?.track({ muted });
  },
  setDeafened: (deafened) => {
    for (const a of audios.values()) a.muted = deafened;
    set({ deafened });
    // deafened people can't hear, so they shouldn't talk either (like Discord)
    if (deafened && !get().muted) get().setMuted(true);
  },
}));

type Signal =
  | { to: string; from: string; kind: "offer" | "answer"; sdp: RTCSessionDescriptionInit }
  | { to: string; from: string; kind: "ice"; candidate: RTCIceCandidateInit };

const send = (s: Signal) => void channel?.send({ type: "broadcast", event: "signal", payload: s });

/** Who's in the room now: connect to newcomers (the lower key calls), drop who left. */
function syncRoom(): void {
  if (!channel) return;
  const state = channel.presenceState<{ muted: boolean }>();
  const keys = Object.keys(state).filter((k) => k !== me);
  for (const k of [...pcs.keys()]) if (!keys.includes(k)) drop(k);
  const peers: Record<string, VoicePeer> = {};
  for (const k of keys) {
    const was = useVoice.getState().peers[k];
    peers[k] = { hq: hqOf(k), muted: !!state[k][0]?.muted, speaking: was?.speaking ?? false, state: pcs.get(k)?.connectionState ?? "new" };
    if (!pcs.has(k) && me < k) void call(k);
  }
  useVoice.setState({ peers });
}

function connection(key: string): RTCPeerConnection {
  const existing = pcs.get(key);
  if (existing) return existing;
  const pc = new RTCPeerConnection(ICE);
  pcs.set(key, pc);
  local?.getTracks().forEach((t) => pc.addTrack(t, local!));
  pc.onicecandidate = (e) => { if (e.candidate) send({ to: key, from: me, kind: "ice", candidate: e.candidate.toJSON() }); };
  pc.ontrack = (e) => {
    const stream = e.streams[0];
    let a = audios.get(key);
    if (!a) { a = new Audio(); a.autoplay = true; audios.set(key, a); }
    a.srcObject = stream;
    a.muted = useVoice.getState().deafened;
    void a.play().catch(() => { /* needs a tap first on some phones: joining was one */ });
    watch(key, stream);
  };
  pc.onconnectionstatechange = () => {
    const p = useVoice.getState().peers[key];
    if (p) useVoice.setState({ peers: { ...useVoice.getState().peers, [key]: { ...p, state: pc.connectionState } } });
  };
  return pc;
}

async function call(key: string): Promise<void> {
  const pc = connection(key);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  send({ to: key, from: me, kind: "offer", sdp: offer });
}

async function onSignal(s: Signal): Promise<void> {
  if (s.to !== me || typeof s.from !== "string") return;
  try {
    if (s.kind === "offer") {
      const pc = connection(s.from);
      await pc.setRemoteDescription(s.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ to: s.from, from: me, kind: "answer", sdp: answer });
    } else if (s.kind === "answer") {
      await pcs.get(s.from)?.setRemoteDescription(s.sdp);
    } else if (s.kind === "ice") {
      await pcs.get(s.from)?.addIceCandidate(s.candidate);
    }
  } catch (e) {
    console.warn("[voice] signal failed:", e);
  }
}

function drop(key: string): void {
  pcs.get(key)?.close();
  pcs.delete(key);
  const a = audios.get(key);
  if (a) { a.srcObject = null; audios.delete(key); }
  analysers.delete(key);
}

/** A level meter on a stream, for the "speaking" glow. */
function watch(key: string, stream: MediaStream): void {
  if (!audioCtx) return;
  const src = audioCtx.createMediaStreamSource(stream);
  const an = audioCtx.createAnalyser();
  an.fftSize = 512;
  src.connect(an);
  analysers.set(key, an);
}

const buf = new Uint8Array(512);
function level(an: AnalyserNode): number {
  an.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < an.fftSize; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
  return Math.sqrt(sum / an.fftSize);
}

function measure(): void {
  const st = useVoice.getState();
  const mine = analysers.get(me);
  const speaking = !st.muted && !!mine && level(mine) > 0.04;
  let changed = speaking !== st.speaking;
  const peers = { ...st.peers };
  for (const [k, p] of Object.entries(peers)) {
    const an = analysers.get(k);
    const s = !p.muted && !!an && level(an) > 0.04;
    if (s !== p.speaking) { peers[k] = { ...p, speaking: s }; changed = true; }
  }
  if (changed) useVoice.setState({ speaking, peers });
}
