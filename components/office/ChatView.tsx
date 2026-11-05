"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useChat } from "@/lib/chat-client";
import { usePresence } from "@/lib/presence";
import { MESSAGE_MAX, type ChatMessage } from "@/lib/chat";
import { Glyph, iconGradient } from "@/lib/app-icon";
import { DEFAULT_ICON } from "@/lib/prefs";
import { cn } from "@/lib/utils";

const TIME = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });
const NO_MESSAGES: readonly ChatMessage[] = [];

/** One chat room: the messages (yours on the right), and a box to write in. Enter sends, Shift+Enter is a new line. */
export function ChatView({ room, title, sub, onBack }: { room: string; title: string; sub?: string; onBack: () => void }) {
  const messages = useChat((s) => s.messages[room] ?? NO_MESSAGES);
  const me = usePresence((s) => s.me);
  const friends = usePresence((s) => s.friends);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useChat.getState().setOpen(room);
    setLoading(true);
    useChat.getState().load(room).catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't load the chat.")).finally(() => setLoading(false));
    // a slow safety net in case a ping is missed (phone asleep, connection dropped)
    const t = setInterval(() => void useChat.getState().load(room).catch(() => {}), 30_000);
    return () => { clearInterval(t); if (useChat.getState().open === room) useChat.getState().setOpen(null); };
  }, [room]);
  useLayoutEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try { await useChat.getState().send(room, body); setDraft(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't send it."); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex h-full min-h-[26rem] flex-col">
      <div className="flex items-center gap-2 pb-2">
        <button type="button" onClick={onBack} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-muted" aria-label="Back to friends">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="grid min-w-0 leading-tight">
          <span className="truncate font-semibold">{title}</span>
          {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
        </div>
      </div>
      <div ref={list} className="scroll-thin min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card/40 p-3" aria-live="polite">
        {loading && !messages.length ? (
          <p className="grid h-full place-items-center text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" aria-label="Loading" /></p>
        ) : !messages.length ? (
          <p className="grid h-full place-items-center text-center text-sm text-muted-foreground">No messages yet. Say hi!</p>
        ) : (
          <ol className="grid gap-1.5">
            {messages.map((m, i) => {
              const mine = m.from_hq === me;
              const prev = messages[i - 1];
              const newDay = !prev || DAY.format(new Date(prev.created_at)) !== DAY.format(new Date(m.created_at));
              const grouped = !newDay && prev?.from_hq === m.from_hq && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000;
              const who = friends.find((f) => f.id === m.from_hq);
              return (
                <li key={m.id} className="grid gap-1.5">
                  {newDay && <span className="justify-self-center rounded-full bg-muted px-2.5 py-0.5 text-[10.5px] text-muted-foreground">{DAY.format(new Date(m.created_at))}</span>}
                  <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                    {!mine && (
                      <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg [&>svg]:size-[66%]", grouped && "invisible")} style={{ background: iconGradient(who?.icon ?? DEFAULT_ICON) }} aria-hidden>
                        <Glyph glyph={(who?.icon ?? DEFAULT_ICON).glyph} size={20} />
                      </span>
                    )}
                    <div className={cn("grid max-w-[78%] gap-0.5", mine && "justify-items-end")}>
                      {!mine && !grouped && <span className="px-1 text-[11px] font-medium text-muted-foreground">{who?.owner ?? "Friend"}</span>}
                      <p className={cn("rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap",
                        mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted")}>{m.body}</p>
                      {!grouped && <span className="px-1 text-[10px] text-muted-foreground">{TIME.format(new Date(m.created_at))}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <form className="flex items-end gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea
          value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MESSAGE_MAX} rows={1} placeholder="Write a message"
          aria-label="Message"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none field-sizing-content focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <button type="submit" disabled={!draft.trim() || busy} aria-label="Send"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <SendHorizontal className="size-4" aria-hidden />}
        </button>
      </form>
    </div>
  );
}
