"use client";

import { create } from "zustand";
import { HQ } from "@/hq.config";

/**
 * Spotify in the office: connect your account (Authorization Code + PKCE, all in the browser, no client secret),
 * see what's playing on any of your devices, and control it. With Spotify Premium the HQ tab itself becomes a
 * Spotify Connect device ("<app> office", via the Web Playback SDK), so music can play from the office.
 * Free accounts still see what's playing; Spotify only allows playback control on Premium.
 *
 * Tokens live in this browser only (localStorage "hq:spotify"). Set NEXT_PUBLIC_SPOTIFY_CLIENT_ID to enable it.
 */

export const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
export const spotifyConfigured = (): boolean => SPOTIFY_CLIENT_ID.length > 0;

const SCOPES = [
  "streaming", "user-read-email", "user-read-private", "user-read-playback-state",
  "user-modify-playback-state", "user-read-currently-playing", "playlist-read-private",
].join(" ");
const KEY = "hq:spotify";
const VERIFIER_KEY = "hq:spotify:verifier";
const API = "https://api.spotify.com/v1";
const POLL_MS = 5000;

export type SpotifyTrack = { title: string; artist: string; album: string; art: string | null; durationMs: number; progressMs: number; playing: boolean };
export type SpotifyPlaylist = { id: string; uri: string; name: string; image: string | null; tracks: number };
type Tokens = { access: string; refresh: string; expiresAt: number };

type SpotifyState = {
  status: "off" | "connecting" | "ready" | "error";
  track: SpotifyTrack | null;
  /** This tab's Web Playback SDK device, once registered (Premium only). */
  deviceId: string | null;
  /** The device Spotify is playing on right now (could be your phone). */
  activeDevice: string | null;
  isPremium: boolean | null;
  volume: number;
  error: string | null;
  playlists: SpotifyPlaylist[];
  connect: () => Promise<void>;
  disconnect: () => void;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  playPlaylist: (uri: string) => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  fetchPlaylists: () => Promise<void>;
};

/* ------------------------------------------------------------------ token storage */

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as Partial<Tokens>;
    return t.access && t.refresh && typeof t.expiresAt === "number" ? (t as Tokens) : null;
  } catch { return null; }
}
function writeTokens(t: Tokens | null): void {
  try { if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

const redirectUri = () => `${location.origin}/spotify/callback`;

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...body }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(data.error_description ?? `Spotify sign-in failed (${res.status}).`);
  return {
    access: data.access_token,
    // a refresh may not return a new refresh token: keep the old one
    refresh: data.refresh_token ?? body.refresh_token ?? "",
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

/** Step 1 of sign-in: send the browser to Spotify with a fresh PKCE challenge. */
async function beginLogin(): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  try { sessionStorage.setItem(VERIFIER_KEY, verifier); } catch { /* ignore */ }
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID, response_type: "code", redirect_uri: redirectUri(),
    code_challenge_method: "S256", code_challenge: challenge, scope: SCOPES,
  }).toString();
  location.assign(url.toString());
}

/** Step 2 (on /spotify/callback): trade the code for tokens. */
export async function finishSpotifyLogin(code: string): Promise<void> {
  let verifier: string | null = null;
  try { verifier = sessionStorage.getItem(VERIFIER_KEY); sessionStorage.removeItem(VERIFIER_KEY); } catch { /* ignore */ }
  if (!verifier) throw new Error("The sign-in expired. Try connecting again.");
  writeTokens(await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier }));
}

let refreshing: Promise<string | null> | null = null;
/** A valid access token, refreshed a minute before it expires. null when not connected. */
async function accessToken(): Promise<string | null> {
  const t = readTokens();
  if (!t) return null;
  if (Date.now() < t.expiresAt - 60_000) return t.access;
  refreshing ??= tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh })
    .then((n) => { writeTokens(n); return n.access; })
    .catch(() => { writeTokens(null); return null; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

class SpotifyError extends Error { constructor(message: string, readonly status: number) { super(message); } }

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T | null> {
  const token = await accessToken();
  if (!token) throw new SpotifyError("Not connected to Spotify.", 401);
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  if (res.status === 204 || res.status === 202) return null;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T & { error?: { message?: string; reason?: string } }) : null;
  if (!res.ok) {
    const reason = data?.error?.reason === "PREMIUM_REQUIRED" ? "Controlling playback needs Spotify Premium." : data?.error?.message;
    throw new SpotifyError(reason ?? `Spotify error ${res.status}.`, res.status);
  }
  return data;
}

/* ------------------------------------------------------------------ the Web Playback SDK (Premium) */

type SdkPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (ev: string, cb: (arg: { device_id?: string; message?: string }) => void) => void;
  setVolume: (v: number) => Promise<void>;
};
type SpotifyWindow = Window & {
  Spotify?: { Player: new (o: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume: number }) => SdkPlayer };
  onSpotifyWebPlaybackSDKReady?: () => void;
};

let player: SdkPlayer | null = null;
let sdkLoading: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  const w = window as SpotifyWindow;
  if (w.Spotify) return Promise.resolve();
  sdkLoading ??= new Promise<void>((resolve, reject) => {
    w.onSpotifyWebPlaybackSDKReady = () => resolve();
    const s = document.createElement("script");
    s.src = "https://sdk.scdn.co/spotify-player.js";
    s.async = true;
    s.onerror = () => { sdkLoading = null; reject(new Error("Couldn't load the Spotify player.")); };
    document.head.appendChild(s);
  });
  return sdkLoading;
}

async function startPlayer(): Promise<void> {
  if (player) return;
  await loadSdk();
  const w = window as SpotifyWindow;
  if (!w.Spotify) return;
  const p = new w.Spotify.Player({
    name: `${HQ.appName} office`,
    getOAuthToken: (cb) => { void accessToken().then((t) => { if (t) cb(t); }); },
    volume: useSpotify.getState().volume,
  });
  p.addListener("ready", ({ device_id }) => { useSpotify.setState({ deviceId: device_id ?? null }); });
  p.addListener("not_ready", () => { useSpotify.setState({ deviceId: null }); });
  p.addListener("account_error", () => { useSpotify.setState({ isPremium: false }); });
  p.addListener("authentication_error", ({ message }) => { useSpotify.setState({ error: message ?? "Spotify sign-in problem." }); });
  p.addListener("player_state_changed", () => { void poll(); });
  player = p;
  await p.connect();
}

/* ------------------------------------------------------------------ polling what's playing */

type PlayerResponse = {
  is_playing: boolean;
  progress_ms: number | null;
  device?: { name: string; volume_percent: number | null };
  item?: { name: string; duration_ms: number; artists?: { name: string }[]; album?: { name: string; images?: { url: string }[] }; show?: { name: string }; images?: { url: string }[] } | null;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
/** When the last poll's progress was read, so the progress bar can run between polls. */
let polledAt = 0;

async function poll(): Promise<void> {
  try {
    const r = await api<PlayerResponse>("/me/player?additional_types=episode");
    const item = r?.item;
    polledAt = performance.now();
    useSpotify.setState({
      status: "ready",
      error: null,
      activeDevice: r?.device?.name ?? null,
      ...(r?.device?.volume_percent != null ? { volume: r.device.volume_percent / 100 } : {}),
      track: item ? {
        title: item.name,
        artist: item.artists?.map((a) => a.name).join(", ") ?? item.show?.name ?? "",
        album: item.album?.name ?? item.show?.name ?? "",
        art: item.album?.images?.[0]?.url ?? item.images?.[0]?.url ?? null,
        durationMs: item.duration_ms,
        progressMs: r?.progress_ms ?? 0,
        playing: r?.is_playing ?? false,
      } : null,
    });
  } catch (e) {
    if (e instanceof SpotifyError && e.status === 401) { stopPolling(); useSpotify.setState({ status: "off", track: null }); }
  }
}

function startPolling(): void {
  if (pollTimer) return;
  void poll();
  pollTimer = setInterval(() => { if (document.visibilityState === "visible") void poll(); }, POLL_MS);
}
function stopPolling(): void { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

/** The current progress, advanced since the last poll while playing (for a smooth progress bar). */
export function liveProgressMs(t: SpotifyTrack): number {
  return t.playing ? Math.min(t.durationMs, t.progressMs + (performance.now() - polledAt)) : t.progressMs;
}

/* ------------------------------------------------------------------ the store */

/** Run a control call; afterwards re-read the player so the panel and the TV show the result. */
async function control(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    useSpotify.setState({ error: null });
  } catch (e) {
    useSpotify.setState({ error: e instanceof Error ? e.message : "Spotify didn't respond." });
  }
  setTimeout(() => { void poll(); }, 350);
}

/** Where to send commands: the device that's playing, or this tab's player when nothing is. */
function deviceQuery(): string {
  const { activeDevice, deviceId } = useSpotify.getState();
  return !activeDevice && deviceId ? `?device_id=${deviceId}` : "";
}

export const useSpotify = create<SpotifyState>((set, get) => ({
  status: "off",
  track: null,
  deviceId: null,
  activeDevice: null,
  isPremium: null,
  volume: 0.6,
  error: null,
  playlists: [],

  connect: async () => {
    if (!spotifyConfigured()) return;
    if (!readTokens()) { await beginLogin(); return; }
    set({ status: "connecting", error: null });
    try {
      const me = await api<{ product?: string }>("/me");
      const premium = me?.product === "premium";
      set({ isPremium: premium, status: "ready" });
      startPolling();
      if (premium) await startPlayer().catch((e: unknown) => set({ error: e instanceof Error ? e.message : String(e) }));
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : "Couldn't reach Spotify." });
    }
  },

  disconnect: () => {
    stopPolling();
    player?.disconnect();
    player = null;
    writeTokens(null);
    set({ status: "off", track: null, deviceId: null, activeDevice: null, isPremium: null, playlists: [], error: null });
  },

  toggle: () => control(async () => {
    const playing = get().track?.playing;
    // nothing active: start (resume) on this tab's player
    if (!get().activeDevice && get().deviceId) {
      await api(`/me/player`, { method: "PUT", body: JSON.stringify({ device_ids: [get().deviceId], play: true }) });
      return;
    }
    await api(`/me/player/${playing ? "pause" : "play"}${deviceQuery()}`, { method: "PUT" });
    const t = get().track;
    if (t) set({ track: { ...t, playing: !playing } });
  }),

  next: () => control(() => api(`/me/player/next${deviceQuery()}`, { method: "POST" })),
  prev: () => control(() => api(`/me/player/previous${deviceQuery()}`, { method: "POST" })),

  playPlaylist: (uri) => control(() => api(`/me/player/play${deviceQuery()}`, { method: "PUT", body: JSON.stringify({ context_uri: uri }) })),

  setVolume: async (v) => {
    const vol = Math.max(0, Math.min(1, v));
    set({ volume: vol });
    // this tab is the device: set it locally (instant); otherwise ask Spotify to change the playing device
    if (player && !get().activeDevice) { await player.setVolume(vol).catch(() => {}); return; }
    await control(() => api(`/me/player/volume?volume_percent=${Math.round(vol * 100)}`, { method: "PUT" }));
  },

  fetchPlaylists: async () => {
    try {
      const r = await api<{ items: { id: string; uri: string; name: string; images?: { url: string }[] | null; tracks?: { total: number } }[] }>("/me/playlists?limit=50");
      set({
        playlists: (r?.items ?? []).filter(Boolean).map((p) => ({ id: p.id, uri: p.uri, name: p.name, image: p.images?.[0]?.url ?? null, tracks: p.tracks?.total ?? 0 })),
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Couldn't load your playlists." });
    }
  },
}));

/** Reconnect on load when this browser already has Spotify tokens. */
export function resumeSpotify(): void {
  if (spotifyConfigured() && readTokens() && useSpotify.getState().status === "off") void useSpotify.getState().connect();
}

/* ------------------------------------------------------------------ a beat for the subwoofer */

const BEAT_S = 60 / 100;
/**
 * 0–1: a kick pulse at about 100 BPM while Spotify is playing (Spotify gives no audio analysis to new apps,
 * so the woofer keeps a steady beat instead of the song's own), with the same quick decay as the lo-fi kicks.
 */
export function spotifyBeat(): number {
  if (!useSpotify.getState().track?.playing) return 0;
  const dt = (performance.now() / 1000) % BEAT_S;
  return Math.exp(-dt * 11);
}
