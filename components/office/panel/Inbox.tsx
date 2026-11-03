"use client";

import { ExternalLink, FilePenLine, Inbox as InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOffice } from "@/lib/store";
import type { InboxCategory } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { Empty } from "./Report";

const CATEGORY: Record<InboxCategory, { label: string; cls: string }> = {
  reply: { label: "Reply", cls: "bg-working/12 text-working" },
  interview: { label: "Interview", cls: "bg-needs/15 text-needs" },
  fyi: { label: "FYI", cls: "bg-muted text-muted-foreground" },
  ignore: { label: "Ignore", cls: "bg-muted text-muted-foreground" },
};

/** "Ana Cruz <ana@x.com>" → "Ana Cruz". */
const senderName = (s: string | null): string => (s ?? "Unknown").replace(/<[^>]*>/g, "").replace(/"/g, "").trim() || (s ?? "Unknown");

/** Emails waiting for a reply or about an interview, from Iggy's triage. */
export function InboxWaiting() {
  const inbox = useOffice((s) => s.data.inbox);
  const items = inbox.filter((i) => i.category === "reply" || i.category === "interview");
  return (
    <div className="grid gap-3">
      {items.length === 0 ? (
        <Empty icon={InboxIcon} title="Inbox zero" body="No replies waiting. Iggy checks at 9 AM, 1 PM and 5 PM." />
      ) : (
        <ul className="grid gap-2">
          {items.map((i) => {
            const name = senderName(i.sender);
            const cat = i.category ? CATEGORY[i.category] : null;
            return (
              <li key={i.message_id} className="flex gap-3 rounded-xl border bg-card p-3 shadow-xs">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground" aria-hidden>
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
                    {cat && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", cat.cls)}>{cat.label}</span>}
                  </div>
                  <p className="text-sm leading-snug [overflow-wrap:anywhere]">{i.subject || "(no subject)"}</p>
                  {i.summary && <p className="text-xs leading-relaxed text-muted-foreground">{i.summary}</p>}
                  {i.draft_id && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <FilePenLine className="size-3.5" aria-hidden /> Reply draft saved in Gmail
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Button asChild variant="outline" size="sm" className="justify-self-start">
        <a href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noopener noreferrer">Open Gmail drafts <ExternalLink /></a>
      </Button>
    </div>
  );
}
