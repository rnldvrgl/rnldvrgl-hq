import { createHash } from "node:crypto";
import "server-only";
import { hqId } from "@/lib/hq-context";
import { env, hqEnv } from "@/lib/env";

/** Access tokens per HQ (each HQ connects its own Google account). */
const tokens = new Map<string, { token: string; expires: number }>();

async function accessToken(): Promise<string> {
  // keyed by the HQ and its refresh token, so reconnecting (or disconnecting) takes effect on every server at once
  const refresh = hqEnv("GOOGLE_REFRESH_TOKEN");
  const key = `${hqId()}:${createHash("sha256").update(refresh).digest("base64url").slice(0, 16)}`;
  const cached = tokens.get(key);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}). Connect Google again in Settings → Connections.`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokens.set(key, { token: data.access_token, expires: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

async function g<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
  });
  if (!res.ok) throw new Error(`Google API ${res.status} on ${new URL(url).pathname}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary";

export type MailSummary = { id: string; threadId: string; from: string; subject: string; date: string; snippet: string };

export async function listMail(query: string, max = 20): Promise<MailSummary[]> {
  const list = await g<{ messages?: { id: string; threadId: string }[] }>(
    `${GMAIL}/messages?${new URLSearchParams({ q: query, maxResults: String(max) })}`,
  );
  const out: MailSummary[] = [];
  for (const m of list.messages ?? []) {
    const msg = await g<{ id: string; threadId: string; snippet: string; payload: { headers: { name: string; value: string }[] } }>(
      `${GMAIL}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    );
    const h = (n: string) => msg.payload.headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
    out.push({ id: msg.id, threadId: msg.threadId, from: h("From"), subject: h("Subject"), date: h("Date"), snippet: msg.snippet });
  }
  return out;
}

export async function countMail(query: string): Promise<number> {
  const r = await g<{ resultSizeEstimate?: number }>(`${GMAIL}/messages?${new URLSearchParams({ q: query, maxResults: "1" })}`);
  return r.resultSizeEstimate ?? 0;
}

/** Saves a reply as a Gmail DRAFT in the same thread. Nothing is sent. */
export async function createReplyDraft(to: string, subject: string, body: string, threadId: string): Promise<string> {
  const raw = [
    `To: ${to}`,
    `Subject: ${subject.startsWith("Re:") ? subject : `Re: ${subject}`}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");
  const encoded = Buffer.from(raw).toString("base64url");
  const r = await g<{ id: string }>(`${GMAIL}/drafts`, {
    method: "POST",
    body: JSON.stringify({ message: { raw: encoded, threadId } }),
  });
  return r.id;
}

export type CalEvent = { id: string; summary?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; hangoutLink?: string; location?: string };

export async function listEvents(timeMin: Date, timeMax: Date): Promise<CalEvent[]> {
  const r = await g<{ items?: CalEvent[] }>(
    `${CAL}/events?${new URLSearchParams({
      timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(),
      singleEvents: "true", orderBy: "startTime", maxResults: "50",
    })}`,
  );
  return r.items ?? [];
}

/** Adds a TENTATIVE event so you still confirm it yourself. */
export async function createTentativeEvent(summary: string, start: Date, minutes: number, description: string): Promise<string> {
  const end = new Date(start.getTime() + minutes * 60_000);
  const r = await g<{ id: string }>(`${CAL}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary, description, status: "tentative",
      start: { dateTime: start.toISOString(), timeZone: "Asia/Manila" },
      end: { dateTime: end.toISOString(), timeZone: "Asia/Manila" },
    }),
  });
  return r.id;
}
