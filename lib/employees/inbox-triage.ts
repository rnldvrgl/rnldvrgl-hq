import "server-only";
import { z } from "zod";
import { ask, extractJson, UNTRUSTED_NOTE } from "@/lib/ai";
import { db } from "@/lib/supabase/admin";
import { listMail, createReplyDraft, createTentativeEvent } from "@/lib/google";
import profile from "@/data/master-profile.json";
import type { WorkResult } from "./types";

const Triage = z.array(z.object({
  id: z.string(),
  category: z.enum(["reply", "fyi", "ignore", "interview"]),
  summary: z.string(),
  reply_draft: z.string().nullable(),
  interview: z.object({
    company: z.string(),
    starts_at_iso: z.string(),
    minutes: z.number().int().min(10).max(240).default(60),
  }).nullable(),
}));

export async function inboxTriage(): Promise<WorkResult> {
  const mail = await listMail("is:unread category:primary newer_than:1d", 20);
  const { data: seen } = await db().from("inbox_items").select("message_id").in("message_id", mail.map((m) => m.id));
  const seenIds = new Set((seen ?? []).map((s) => s.message_id));
  const fresh = mail.filter((m) => !seenIds.has(m.id));
  if (!fresh.length) return { status: "done", summary: "Inbox clear", output: "No new unread mail since the last check." };

  const reply = await ask({
    private: true,
    maxTokens: 4000,
    system: `You triage email for ${profile.name}, a developer in Manila (UTC+8). ${UNTRUSTED_NOTE} Never promise anything on his behalf; drafts are short, polite, and leave decisions to him.`,
    prompt: [
      "Classify each email:",
      "- reply: a real person expects an answer → write reply_draft (under 120 words, sign as Ronald)",
      "- interview: an interview or assessment invite with a specific time → fill interview (starts_at_iso in UTC ISO 8601) and a reply_draft confirming availability",
      "- fyi: worth knowing, no reply needed",
      "- ignore: newsletters, promos, notifications",
      "Return ONLY a JSON array: {id, category, summary (one line), reply_draft (string or null), interview ({company, starts_at_iso, minutes} or null)}.",
      "",
      JSON.stringify(fresh.map((m) => ({ id: m.id, from: m.from, subject: m.subject, date: m.date, snippet: m.snippet }))),
    ].join("\n"),
  });

  const items = Triage.parse(extractJson(reply));
  const byId = new Map(fresh.map((m) => [m.id, m]));
  let drafts = 0, interviews = 0;
  const lines: string[] = [];

  for (const it of items) {
    const m = byId.get(it.id);
    if (!m) continue;
    let draftId: string | null = null;
    if (it.reply_draft && (it.category === "reply" || it.category === "interview")) {
      draftId = await createReplyDraft(m.from, m.subject, it.reply_draft, m.threadId);
      drafts++;
    }
    if (it.category === "interview" && it.interview) {
      const start = new Date(it.interview.starts_at_iso);
      if (!Number.isNaN(start.getTime())) {
        const eventId = await createTentativeEvent(`Interview: ${it.interview.company}`, start, it.interview.minutes, `From: ${m.from}\nSubject: ${m.subject}`);
        const { data: job } = await db().from("jobs").select("id").ilike("company", `%${it.interview.company}%`).limit(1).maybeSingle();
        if (job) await db().from("jobs").update({ status: "interview" }).eq("id", job.id);
        await db().from("interviews").insert({ job_id: job?.id ?? null, company: it.interview.company, starts_at: start.toISOString(), calendar_event_id: eventId });
        interviews++;
      }
    }
    await db().from("inbox_items").upsert({
      message_id: m.id, thread_id: m.threadId, sender: m.from, subject: m.subject,
      category: it.category, summary: it.summary, draft_id: draftId,
      handled: it.category === "ignore" || it.category === "fyi",
      received_at: m.date ? new Date(m.date).toISOString() : null,
    });
    lines.push(`[${it.category.toUpperCase()}] ${m.subject}\n   ${it.summary}${draftId ? "\n   → reply draft saved in Gmail" : ""}`);
  }

  const parts = [`${drafts} draft${drafts === 1 ? "" : "s"}`];
  if (interviews) parts.push(`${interviews} interview${interviews === 1 ? "" : "s"} added (tentative)`);
  return {
    status: drafts || interviews ? "needs_you" : "done",
    summary: `${items.length} sorted · ${parts.join(" · ")}`,
    output: `${lines.join("\n\n")}\n\nDrafts are in Gmail → Drafts. Nothing was sent.`,
  };
}
