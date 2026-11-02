import "server-only";
import { env } from "@/lib/env";

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** Plain-text-first email to yourself through Resend. */
export async function emailMe(subject: string, body: string): Promise<void> {
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;white-space:pre-wrap;max-width:640px">${escapeHtml(body)}</div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env("RESEND_API_KEY")}` },
    body: JSON.stringify({ from: env("EMAIL_FROM"), to: [env("EMAIL_TO")], subject, text: body, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
