"use client";

import { create } from "zustand";
import { toast } from "sonner";
import { canUse, otherOf, type ChatMessage } from "@/lib/chat";
import { sendChatPing, setChatPingListener, usePresence } from "@/lib/presence";

/**
 * Chat in the browser: messages per room, what you've read (remembered on this device), and the live part:
 * a sent message pings the lobby channel, and everyone in that room fetches what's new. A ping for a room
 * you're not looking at shows a toast and an unread dot instead.
 */

type Latest = { at: string; from: string };
type ChatStore = {
  messages: Record<string, ChatMessage[]>;
  latest: Record<string, Latest>;
  read: Record<string, string>;
  /** The room on screen, if any. */
  open: string | null;
  setOpen: (room: string | null) => void;
  load: (room: string) => Promise<void>;
  loadRooms: () => Promise<void>;
  send: (room: string, body: string) => Promise<void>;
};

const READ_KEY = "hq:chat-read";
const readSaved = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(READ_KEY) ?? "{}") as Record<string, string>; } catch { return {}; } };
const saveRead = (r: Record<string, string>) => { try { localStorage.setItem(READ_KEY, JSON.stringify(r)); } catch { /* not remembered */ } };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json" }, cache: "no-store" });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? "Chat isn't reachable right now.");
  return body;
}

export const useChat = create<ChatStore>()((set, get) => ({
  messages: {},
  latest: {},
  read: typeof window === "undefined" ? {} : readSaved(),
  open: null,
  setOpen: (room) => {
    set({ open: room });
    if (room) { markRead(room); void get().load(room).catch(() => { /* ChatView shows the error */ }); }
  },
  load: async (room) => {
    const have = get().messages[room];
    const after = have?.at(-1)?.created_at;
    const { messages } = await api<{ messages: ChatMessage[] }>(`/api/chat?room=${encodeURIComponent(room)}${after ? `&after=${encodeURIComponent(after)}` : ""}`);
    const merged = [...(have ?? []), ...messages.filter((m) => !have?.some((h) => h.id === m.id))];
    const last = merged.at(-1);
    set({ messages: { ...get().messages, [room]: merged.slice(-200) }, ...(last ? { latest: { ...get().latest, [room]: { at: last.created_at, from: last.from_hq } } } : {}) });
    if (get().open === room) markRead(room);
  },
  loadRooms: async () => {
    try {
      const { rooms } = await api<{ rooms: Record<string, Latest> }>("/api/chat?rooms=1");
      set({ latest: { ...rooms, ...get().latest } });
    } catch { /* chat not set up yet */ }
  },
  send: async (room, body) => {
    const { message } = await api<{ message: ChatMessage }>("/api/chat", { method: "POST", body: JSON.stringify({ room, body }) });
    const list = get().messages[room] ?? [];
    set({ messages: { ...get().messages, [room]: [...list, message] }, latest: { ...get().latest, [room]: { at: message.created_at, from: message.from_hq } } });
    markRead(room);
    sendChatPing(room, message.from_hq);
  },
}));

function markRead(room: string): void {
  const at = useChat.getState().latest[room]?.at ?? new Date().toISOString();
  const read = { ...useChat.getState().read, [room]: at };
  useChat.setState({ read });
  saveRead(read);
}

/** Rooms with something you haven't read. */
export const unreadRooms = (s: ChatStore, me: string | null): string[] =>
  Object.entries(s.latest).filter(([room, l]) => l.from !== me && (!s.read[room] || l.at > s.read[room]) && s.open !== room).map(([room]) => room);
export const useUnread = (): number => {
  const me = usePresence((s) => s.me);
  return useChat((s) => unreadRooms(s, me).length);
};

// someone wrote: fetch it if it's for us; a toast when that room isn't open
setChatPingListener(({ room, from }) => {
  const me = usePresence.getState().me;
  if (!me || from === me || !canUse(room, me)) return;
  const chat = useChat.getState();
  void chat.load(room).then(() => {
    if (useChat.getState().open === room) return;
    const msg = useChat.getState().messages[room]?.at(-1);
    const who = usePresence.getState().friends.find((f) => f.id === from)?.owner ?? "A friend";
    if (msg) toast(`${who}${otherOf(room, me) ? "" : " in the Lounge"}`, { description: msg.body.slice(0, 120) });
  }).catch(() => { /* ignore */ });
});
