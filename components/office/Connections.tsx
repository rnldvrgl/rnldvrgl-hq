"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, KeyRound, Loader2, Trash2 } from "lucide-react";
import { useOffice } from "@/lib/store";
import { cn } from "@/lib/utils";

type Info = {
  founder: boolean;
  email: string;
  have: { ai: boolean; google: boolean; github: boolean };
  keys: Record<string, string | null>;
  google: { connected: boolean; available: boolean };
  canSave: boolean;
};

const AI_KEYS: { key: string; label: string; hint: string; href: string }[] = [
  { key: "GEMINI_API_KEY", label: "Gemini", hint: "Free tier · Google AI Studio", href: "https://aistudio.google.com/apikey" },
  { key: "GROQ_API_KEY", label: "Groq", hint: "Free tier · very fast", href: "https://console.groq.com/keys" },
  { key: "ANTHROPIC_API_KEY", label: "Claude", hint: "Paid · best results, reads private mail", href: "https://console.anthropic.com/settings/keys" },
];

async function save(key: string, value: string) {
  const res = await fetch("/api/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, value }) });
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? "Couldn't save it.");
}

/**
 * Settings → Connections: this HQ's own AI keys, Google and GitHub. Employees are hired once what they need
 * is connected (lib/hiring.ts). Keys are stored encrypted and never shown again, only their last 4 characters.
 */
export function Connections() {
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState("");
  const refreshOffice = useOffice((s) => s.refresh);
  const load = useCallback(async () => {
    const res = await fetch("/api/connections", { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as (Info & { error?: string }) | null;
    if (!res.ok || !body) return setErr(body?.error ?? "Couldn't load connections.");
    setInfo(body);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const after = async () => { await load(); await refreshOffice(); };
  if (err) return <p className="px-1.5 text-sm text-destructive">{err}</p>;
  if (!info) return <p className="flex items-center gap-2 px-1.5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading…</p>;

  return (
    <div className="grid gap-3">
      {!info.canSave && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          Keys can&rsquo;t be saved until the app has <code className="font-mono">HQ_SECRET_KEY</code> in its environment (README → Friends).
        </p>
      )}
      <Group title="AI" done={info.have.ai} hint="Any one is enough. Gemini and Groq are free.">
        {AI_KEYS.map((k) => <KeyRow key={k.key} k={k.key} label={k.label} hint={k.hint} href={k.href} saved={info.keys[k.key]} disabled={!info.canSave} onDone={after} />)}
      </Group>
      <Group title="Google" done={info.have.google} hint="Gmail and Calendar, for the brief, the inbox and the schedule.">
        <div className="flex flex-wrap items-center gap-2 px-1.5">
          {info.google.connected ? (
            <>
              <span className="flex items-center gap-1.5 text-sm"><Check className="size-4 text-emerald-600" aria-hidden /> Connected</span>
              <button type="button" disabled={!info.canSave} onClick={async () => { try { await save("GOOGLE_REFRESH_TOKEN", ""); toast.success("Google disconnected."); await after(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't disconnect."); } }}
                className="ml-auto rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">Disconnect</button>
            </>
          ) : (
            <a href="/api/connect/google" aria-disabled={!info.google.available || !info.canSave}
              className={cn("inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground", (!info.google.available || !info.canSave) && "pointer-events-none opacity-50")}>
              Connect Google
            </a>
          )}
        </div>
        {!info.founder && <p className="px-1.5 text-[11px] text-muted-foreground">While HQ&rsquo;s Google app is in testing, the HQ owner who invited you has to add your Google account as a test user first.</p>}
      </Group>
      <Group title="GitHub" done={info.have.github} hint="Your pull requests and issues, for the Dev Assistant.">
        <KeyRow k="GITHUB_USERNAME" label="Username" hint="Your GitHub login" saved={info.keys.GITHUB_USERNAME} plain disabled={!info.canSave} onDone={after} />
        <KeyRow k="GITHUB_TOKEN" label="Token" hint="Fine-grained, read-only" href="https://github.com/settings/personal-access-tokens/new" saved={info.keys.GITHUB_TOKEN} disabled={!info.canSave} onDone={after} />
      </Group>
    </div>
  );
}

function Group({ title, done, hint, children }: { title: string; done: boolean; hint: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-2.5">
      <div className="flex items-baseline justify-between gap-2 px-1.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className={cn("rounded-full px-2 py-px text-[10px] font-semibold uppercase tracking-wide", done ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>{done ? "Connected" : "Not yet"}</span>
      </div>
      <p className="-mt-1 px-1.5 text-[11px] text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

function KeyRow({ k, label, hint, href, saved, plain, disabled, onDone }: { k: string; label: string; hint: string; href?: string; saved: string | null | undefined; plain?: boolean; disabled: boolean; onDone: () => Promise<void> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (v: string, msg: string) => {
    setBusy(true);
    try { await save(k, v); setValue(""); toast.success(msg); await onDone(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save it."); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-1 px-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{label} <span className="font-normal text-muted-foreground">· {hint}</span></span>
        {href && <a href={href} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-primary hover:underline">Get one <ExternalLink className="size-3" aria-hidden /></a>}
      </div>
      <div className="flex min-w-0 gap-1.5">
        <div className="relative min-w-0 flex-1">
          <KeyRound className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type={plain ? "text" : "password"} autoComplete="off" spellCheck={false} value={value} disabled={disabled || busy}
            onChange={(e) => setValue(e.target.value)} aria-label={`${label} ${plain ? "" : "key"}`}
            placeholder={saved ? (plain ? saved : `Saved ${saved}`) : plain ? "username" : "Paste the key"}
            className="h-10 w-full min-w-0 rounded-lg border border-border bg-background pr-2 pl-8 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          />
        </div>
        <button type="button" disabled={disabled || busy || !value.trim()} onClick={() => run(value, `${label} saved.`)}
          className="min-h-10 shrink-0 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Save"}
        </button>
        {saved && (
          <button type="button" disabled={disabled || busy} onClick={() => run("", `${label} removed.`)} aria-label={`Remove ${label}`}
            className="grid min-h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive disabled:opacity-50">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
