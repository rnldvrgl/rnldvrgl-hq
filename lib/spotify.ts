"use client";

import { create } from "zustand";
import { HQ } from "@/hq.config";

/**
 * Spotify in the office: connect your account (Authorization Code + PKCE, all in the browser, no client secret),
 * see what's playing on any of your devices, and control it. With Spotify Premium the HQ tab itself becomes a
 * Spotify Connect device ("<app> office", via the Web Playback SDK), so music can play from the office.
 * Free accounts still see what's playing; Spotify only allows playback control on Premium.
 *
 * Connect once from any device: the server keeps the sign-in (Supabase, table spotify_auth) and hands every
 * signed-in device short-lived access tokens, so your phone, laptop and the office TV all just work.
 * Set NEXT_PUBLIC_SPOTIFY_CLIENT_ID to enable it.
 */

export const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
export const spotifyConfigured = (): boolean => SPOTIFY_CLIENT_ID.length > 0;

const SCOPES = [
  "streaming", "user-read-email", "user-read-private", "user-read-playback-state",
  "user-modify-playback-state", "user-read-currently-playing", "playlist-read-private",
].join(" ");
/** Where a browser kept its own tokens before they were shared (moved to the server on first load). */
const LEGACY_KEY = "hq:spotify";
const VERIFIER_KEY = "hq:spotify:verifier";
const API = "https://api.spotify.com/v1";
const POLL_MS = 5000;

export type SpotifyTrack = { id: string; title: string; artist: string; album: string; art: string | null; durationMs: number; progressMs: number; playing: boolean };
/** A Spotify Connect device you can play on: a phone, speaker, TV, computer, or an HQ tab. */
export type SpotifyDevice = { id: string; name: string; type: string; active: boolean; restricted: boolean; volume: number | null };
/** `tracks` is the song count, or null when Spotify didn't send one (it only does for some playlists now). */
export type SpotifyPlaylist = { id: string; uri: string; name: string; image: string | null; tracks: number | null; owner: string | null; mine: boolean };
/** A song (or podcast episode) in a list: search results, a playlist's songs. */
export type SpotifySong = {
  key: string; uri: string; title: string; artist: string; art: string | null; durationMs: number; playable: boolean;
  /** Its place in the playlist it was listed from (0-based), for playing it there. */
  position?: number;
};
/** One page of a list from Spotify, with where the next page starts (null at the end). */
export type SpotifyPage<T> = { items: T[]; total: number | null; nextOffset: number | null };

type SpotifyState = {
  status: "off" | "connecting" | "ready" | "error";
  track: SpotifyTrack | null;
  /** This tab's Web Playback SDK device, once registered (Premium only). */
  deviceId: string | null;
  /** The device Spotify is playing on right now (could be your phone). */
  activeDevice: string | null;
  /** Spotify's id of the device that's playing (to tick it in the device list). */
  activeDeviceId: string | null;
  /** Where Spotify could play, from the last fetchDevices(). */
  devices: SpotifyDevice[];
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
  /** Play one song: inside a playlist (`context`, so the rest of it follows), or on its own. */
  playSong: (song: SpotifySong, context?: { uri: string; position: number }) => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  fetchPlaylists: () => Promise<void>;
  fetchDevices: () => Promise<void>;
  /** Move the music to another device (like the Spotify app's device picker). */
  playOn: (deviceId: string) => Promise<void>;
};

/* ------------------------------------------------------------------ tokens (shared by every device, kept on the server) */

/** The access token this tab is using, from /api/spotify. The refresh token never leaves the server. */
let cached: { access: string; expiresAt: number } | null = null;

const redirectUri = () => `${location.origin}/spotify/callback`;

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type TokenReply = { connected: boolean; access?: string; expiresAt?: number; error?: string };

async function tokenCall(init?: RequestInit): Promise<TokenReply> {
  const res = await fetch("/api/spotify", { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = (await res.json().catch(() => ({}))) as TokenReply;
  if (!res.ok) throw new Error(data.error ?? `Couldn't reach Spotify (${res.status}).`);
  cached = data.connected && data.access ? { access: data.access, expiresAt: data.expiresAt ?? Date.now() + 3_000_000 } : null;
  return data;
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

/** Step 2 (on /spotify/callback): the server trades the code for tokens and keeps them for every device. */
export async function finishSpotifyLogin(code: string): Promise<void> {
  let verifier: string | null = null;
  try { verifier = sessionStorage.getItem(VERIFIER_KEY); sessionStorage.removeItem(VERIFIER_KEY); } catch { /* ignore */ }
  if (!verifier) throw new Error("The sign-in expired. Try connecting again.");
  await tokenCall({ method: "POST", body: JSON.stringify({ code, verifier, redirectUri: redirectUri() }) });
}

/**
 * Before tokens were shared, each browser kept its own in localStorage ("hq:spotify"). Hand that one to the
 * server once, so the device that was already connected connects every other device too.
 */
async function adoptLocalTokens(): Promise<boolean> {
  let refresh: string | undefined;
  try { refresh = (JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null") as { refresh?: string } | null)?.refresh; } catch { /* ignore */ }
  if (!refresh) return false;
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  const r = await tokenCall({ method: "POST", body: JSON.stringify({ refresh }) }).catch(() => null);
  return !!r?.connected;
}

let refreshing: Promise<string | null> | null = null;
/** A valid access token (refreshed by the server a minute before it expires). null when not connected. */
async function accessToken(): Promise<string | null> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.access;
  refreshing ??= tokenCall()
    .then(() => cached?.access ?? null)
    .catch(() => null)
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
  /** iOS / Safari: unlock audio from a tap, so the tab can start playing. */
  activateElement?: () => Promise<void>;
};
type SpotifyWindow = Window & {
  Spotify?: { Player: new (o: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume: number }) => SdkPlayer };
  onSpotifyWebPlaybackSDKReady?: () => void;
};

let player: SdkPlayer | null = null;
/** The signed-in Spotify user's id (to tell your own playlists from ones you follow). */
let meId: string | null = null;

/** "iPhone", "iPad", "Mac", "Windows PC"…: each device's office tab shows up in Spotify Connect under its own name. */
function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/CrOS/.test(ua)) return "Chromebook";
  return "office";
}
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
    name: `${HQ.appName} · ${deviceName()}`,
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
  device?: { id: string | null; name: string; volume_percent: number | null };
  item?: { id?: string; name: string; duration_ms: number; artists?: { name: string }[]; album?: { name: string; images?: { url: string }[] }; show?: { name: string }; images?: { url: string }[] } | null;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
/**
 * After you move the volume slider, polls ignore Spotify's volume for a few seconds: Spotify takes a moment
 * to apply it, and reading the old value back made the slider jump back and then forward again.
 */
let volumeHeldUntil = 0;
let volumeTimer: ReturnType<typeof setTimeout> | null = null;
let volumeSentAt = 0;
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
      activeDeviceId: r?.device?.id ?? null,
      ...(r?.device?.volume_percent != null && performance.now() > volumeHeldUntil ? { volume: r.device.volume_percent / 100 } : {}),
      track: item ? {
        id: item.id ?? `${item.name}|${item.duration_ms}`,
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

/* ------------------------------------------------------------------ playlists, their songs, search */

/**
 * A playlist as Spotify sends it. Spotify's February 2026 Web API changes renamed the playlist's
 * `tracks` ({ href, total }) to `items`, and only fill it in for playlists you own; older responses still
 * use `tracks`. Read both, and keep "unknown" as null (never a made-up 0).
 */
type RawPlaylist = {
  id: string; uri: string; name: string; images?: { url: string }[] | null;
  items?: { total?: number } | null; tracks?: { total?: number } | null;
  owner?: { id?: string; display_name?: string | null } | null;
};
const toPlaylist = (p: RawPlaylist): SpotifyPlaylist => ({
  id: p.id, uri: p.uri, name: p.name, image: p.images?.[0]?.url ?? null,
  tracks: p.items?.total ?? p.tracks?.total ?? null,
  owner: p.owner?.display_name ?? p.owner?.id ?? null,
  mine: !!meId && p.owner?.id === meId,
});
/** Learn the signed-in user's id once (to tell your own playlists from ones you follow). */
async function knowMe(): Promise<void> {
  if (meId) return;
  meId = (await api<{ id?: string }>("/me").catch(() => null))?.id ?? null;
}

type RawSong = {
  id?: string | null; uri?: string; name?: string; duration_ms?: number; is_playable?: boolean;
  artists?: { name: string }[]; album?: { images?: { url: string }[] }; show?: { name: string; images?: { url: string }[] }; images?: { url: string }[];
};
function toSong(t: RawSong | null | undefined, key: string, local = false): SpotifySong | null {
  if (!t?.uri || !t.name) return null;
  return {
    key, uri: t.uri, title: t.name,
    artist: t.artists?.map((a) => a.name).filter(Boolean).join(", ") || t.show?.name || "",
    art: t.album?.images?.at(-1)?.url ?? t.images?.at(-1)?.url ?? t.show?.images?.at(-1)?.url ?? null,
    durationMs: t.duration_ms ?? 0,
    playable: !local && t.is_playable !== false,
  };
}

/** Spotify allows at most 10 search results per request since February 2026 (it was 50). */
export const SEARCH_PAGE = 10;
export type SpotifySearch = { songs: SpotifyPage<SpotifySong>; playlists: SpotifyPlaylist[] };
/** Search Spotify for songs (and playlists on the first page). */
export async function searchSpotify(query: string, offset = 0, signal?: AbortSignal): Promise<SpotifySearch> {
  type Paging<T> = { items?: (T | null)[]; total?: number; next?: string | null };
  const types = offset === 0 ? "track,playlist" : "track";
  const q = new URLSearchParams({ q: query, type: types, limit: String(SEARCH_PAGE), offset: String(offset), market: "from_token" });
  const [r] = await Promise.all([
    api<{ tracks?: Paging<RawSong>; playlists?: Paging<RawPlaylist> }>(`/search?${q}`, { signal }),
    knowMe(),
  ]);
  const raw = r?.tracks?.items ?? [];
  return {
    songs: {
      items: raw.map((t, i) => toSong(t, t?.id ?? `${offset + i}`)).filter((s): s is SpotifySong => !!s),
      total: r?.tracks?.total ?? null,
      nextOffset: r?.tracks?.next ? offset + raw.length : null,
    },
    playlists: (r?.playlists?.items ?? []).filter((p): p is RawPlaylist => !!p?.id).map(toPlaylist),
  };
}

export const useSpotify = create<SpotifyState>((set, get) => ({
  status: "off",
  track: null,
  deviceId: null,
  activeDevice: null,
  activeDeviceId: null,
  devices: [],
  isPremium: null,
  volume: 0.6,
  error: null,
  playlists: [],

  connect: async () => {
    if (!spotifyConfigured()) return;
    set({ status: "connecting", error: null });
    try {
      // already connected (from this or any other device)? then no Spotify sign-in is needed here
      const shared = await tokenCall();
      if (!shared.connected && !(await adoptLocalTokens())) { await beginLogin(); return; }
      const me = await api<{ product?: string; id?: string }>("/me");
      meId = me?.id ?? null;
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
    cached = null;
    meId = null;
    void fetch("/api/spotify", { method: "DELETE" }).catch(() => {});
    set({ status: "off", track: null, deviceId: null, activeDevice: null, activeDeviceId: null, devices: [], isPremium: null, playlists: [], error: null });
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

  playSong: (song, context) => control(() => {
    // inside a playlist, start at the song's place in it (exact even when a song is in it twice), so the rest follows
    const body = context ? { context_uri: context.uri, offset: { position: context.position } } : { uris: [song.uri] };
    return api(`/me/player/play${deviceQuery()}`, { method: "PUT", body: JSON.stringify(body) });
  }),

  setVolume: async (v) => {
    const vol = Math.max(0, Math.min(1, v));
    set({ volume: vol });
    volumeHeldUntil = performance.now() + 4000;
    // this tab is the device: set it locally (instant); otherwise ask Spotify to change the playing device
    if (player && !get().activeDevice) { await player.setVolume(vol).catch(() => {}); return; }
    // while dragging, send at most ~4 changes a second, always ending on where the slider stopped
    if (volumeTimer) clearTimeout(volumeTimer);
    const send = () => {
      volumeTimer = null;
      volumeSentAt = performance.now();
      volumeHeldUntil = performance.now() + 4000;
      const pct = Math.round(get().volume * 100);
      void api(`/me/player/volume?volume_percent=${pct}`, { method: "PUT" })
        .then(() => set({ error: null }))
        .catch((e: unknown) => set({ error: e instanceof Error ? e.message : "Spotify didn't respond." }));
    };
    const wait = Math.max(0, 250 - (performance.now() - volumeSentAt));
    volumeTimer = setTimeout(send, wait);
  },

  fetchDevices: async () => {
    try {
      const r = await api<{ devices: { id: string | null; name: string; type: string; is_active: boolean; is_restricted: boolean; volume_percent: number | null }[] }>("/me/player/devices");
      const devices = (r?.devices ?? [])
        .filter((d): d is typeof d & { id: string } => !!d.id)
        .map((d) => ({ id: d.id, name: d.name, type: d.type, active: d.is_active, restricted: d.is_restricted, volume: d.volume_percent }));
      // this tab's own player always shows up, even before Spotify lists it
      const own = get().deviceId;
      if (own && !devices.some((d) => d.id === own)) devices.push({ id: own, name: `${HQ.appName} · ${deviceName()}`, type: "Computer", active: false, restricted: false, volume: null });
      set({ devices });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Couldn't load your Spotify devices." });
    }
  },

  playOn: async (id) => {
    if (id === get().activeDeviceId) return;
    // playing here: unlock audio while we're still inside the tap (iOS needs that)
    if (id === get().deviceId) await player?.activateElement?.().catch(() => {});
    await control(() => api("/me/player", { method: "PUT", body: JSON.stringify({ device_ids: [id], play: true }) }));
    set({ activeDeviceId: id, devices: get().devices.map((d) => ({ ...d, active: d.id === id })) });
    setTimeout(() => { void get().fetchDevices(); }, 1200);
  },

  fetchPlaylists: async () => {
    try {
      const [r] = await Promise.all([api<{ items: (RawPlaylist | null)[] }>("/me/playlists?limit=50"), knowMe()]);
      set({ playlists: (r?.items ?? []).filter((p): p is RawPlaylist => !!p?.id).map(toPlaylist) });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Couldn't load your playlists." });
    }
  },
}));

/**
 * On load: pick up Spotify if it's connected on the server (from any device), or adopt this browser's old
 * local sign-in. Never starts a Spotify sign-in by itself.
 */
let resuming = false;
export function resumeSpotify(): void {
  if (resuming || !spotifyConfigured() || useSpotify.getState().status !== "off") return;
  resuming = true;
  void (async () => {
    const shared = await tokenCall().catch(() => null);
    if (shared?.connected || (await adoptLocalTokens())) await useSpotify.getState().connect();
  })().finally(() => { resuming = false; });
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
