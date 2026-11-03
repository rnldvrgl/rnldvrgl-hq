"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CalendarClock, Check, ChevronDown, CircleAlert, CircleCheck, Copy, FileText, Hand, Loader2, Timer, User,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RunView } from "@/lib/team";
import type { RunStatus } from "@/lib/supabase/database.types";
import { formatManila } from "@/lib/time";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ tiny, safe markdown-ish renderer */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g;

/** Bold, `code`, [links](https://…) and bare URLs, as React elements (never raw HTML). */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(INLINE)) {
    const tok = m[0], at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key} className="rounded bg-background px-1 py-px font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else {
      const link = /^\[([^\]]+)\]\((.+)\)$/.exec(tok);
      const href = link ? link[2] : tok;
      out.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline [overflow-wrap:anywhere]">
          {link ? link[1] : tok}
        </a>,
      );
    }
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; lines: string[] }
  | { kind: "hr" };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  const push = (b: Block) => blocks.push(b);
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const prev = blocks[blocks.length - 1];
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) { push({ kind: "p", lines: [] }); continue; }
    if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) { push({ kind: "hr" }); continue; }
    if (h) { push({ kind: "h", level: h[1].length === 1 ? 1 : h[1].length === 2 ? 2 : 3, text: h[2] }); continue; }
    if (ul) { if (prev?.kind === "ul") prev.items.push(ul[1]); else push({ kind: "ul", items: [ul[1]] }); continue; }
    if (ol) { if (prev?.kind === "ol") prev.items.push(ol[1]); else push({ kind: "ol", items: [ol[1]] }); continue; }
    // A line ending in ":" on its own reads as a small heading ("Today's calendar:")
    if (/^[^\s].{0,60}:$/.test(line) && (!prev || prev.kind !== "p" || prev.lines.length === 0)) {
      push({ kind: "h", level: 3, text: line.slice(0, -1) });
      continue;
    }
    if (prev?.kind === "p" && prev.lines.length) prev.lines.push(line);
    else push({ kind: "p", lines: [line] });
  }
  return blocks.filter((b) => b.kind !== "p" || b.lines.length > 0);
}

export function FormattedText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("grid gap-2 text-sm leading-relaxed text-foreground/90 [overflow-wrap:anywhere]", className)}>
      {parse(text).map((b, i) => {
        const k = `b${i}`;
        if (b.kind === "hr") return <hr key={k} className="border-border" />;
        if (b.kind === "h") {
          const cls = b.level === 1 ? "text-base font-semibold" : b.level === 2 ? "text-[15px] font-semibold" : "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
          return <p key={k} className={cn("mt-1 text-foreground", cls)}>{inline(b.text, k)}</p>;
        }
        if (b.kind === "ul" || b.kind === "ol") {
          const List = b.kind === "ul" ? "ul" : "ol";
          return (
            <List key={k} className={cn("grid gap-1 pl-5", b.kind === "ul" ? "list-disc marker:text-primary" : "list-decimal marker:text-muted-foreground")}>
              {b.items.map((it, j) => <li key={j} className="pl-0.5">{inline(it, `${k}-${j}`)}</li>)}
            </List>
          );
        }
        return (
          <p key={k}>
            {b.lines.map((l, j) => (
              <span key={j}>{j > 0 && <br />}{inline(l, `${k}-${j}`)}</span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ run metadata */

const RUN: Record<RunStatus, { label: string; icon: LucideIcon; pill: string; dot: string }> = {
  running: { label: "Running", icon: Loader2, pill: "bg-working/12 text-working", dot: "bg-working" },
  done: { label: "Done", icon: CircleCheck, pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  needs_you: { label: "Needs you", icon: Hand, pill: "bg-needs/15 text-needs", dot: "bg-needs" },
  error: { label: "Error", icon: CircleAlert, pill: "bg-error/12 text-error", dot: "bg-error" },
};

export function durationOf(run: Pick<RunView, "started_at" | "finished_at">): string | null {
  if (!run.finished_at) return null;
  const s = Math.max(0, Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function StatusPill({ status }: { status: RunStatus }) {
  const r = RUN[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", r.pill)}>
      <r.icon className={cn("size-3", status === "running" && "animate-spin")} aria-hidden />
      {r.label}
    </span>
  );
}

function Meta({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Icon className="size-3" aria-hidden />
      {children}
    </span>
  );
}

function RunMeta({ run }: { run: RunView }) {
  const d = durationOf(run);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <Meta icon={CalendarClock}>{formatManila(run.started_at)}</Meta>
      <Meta icon={run.trigger === "manual" ? User : Timer}>{run.trigger === "manual" ? "You asked" : "On schedule"}</Meta>
      {d && <Meta icon={Timer}>{d}</Meta>}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { toast.error("Couldn't copy. Select the text instead."); }
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/** Long reports start folded to about this many characters. */
const FOLD_AT = 700;

/** The latest run as a card: status, time, trigger, duration, then the formatted report. */
export function ReportCard({ run, name }: { run: RunView | undefined; name: string }) {
  const [open, setOpen] = useState(false);
  if (!run) {
    return (
      <Empty icon={FileText} title="No reports yet" body={`Press Run now to see ${name} work.`} />
    );
  }
  const text = run.error ?? run.output ?? "";
  const long = text.length > FOLD_AT;
  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <StatusPill status={run.status} />
        {text && <CopyButton text={text} />}
        <div className="w-full"><RunMeta run={run} /></div>
      </header>
      <div className="relative px-3 py-3">
        {run.status === "running" && !text ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> {name} is still working…</p>
        ) : run.error ? (
          <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error [overflow-wrap:anywhere]">{run.error}</p>
        ) : (
          <div className={cn(long && !open && "max-h-72 overflow-hidden")}>
            <FormattedText text={text || "No output."} />
          </div>
        )}
        {long && !open && !run.error && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" aria-hidden />
        )}
      </div>
      {long && !run.error && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-center gap-1 border-t py-2 text-xs font-medium text-primary hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
          aria-expanded={open}
        >
          {open ? "Show less" : "Show the full report"}
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      )}
    </article>
  );
}

const excerpt = (run: RunView): string => {
  const t = (run.error ?? run.output ?? "").replace(/[#*`>_-]/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 90 ? `${t.slice(0, 89)}…` : t || "No output.";
};

/** Earlier runs as a vertical timeline; each one opens to the full report. */
export function History({ runs }: { runs: RunView[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!runs.length) return <Empty icon={CalendarClock} title="No earlier runs" body="Older reports show up here." />;
  return (
    <ol className="relative grid gap-1 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-border">
      {runs.map((r) => {
        const isOpen = open === r.id;
        const meta = RUN[r.status];
        const d = durationOf(r);
        return (
          <li key={r.id} className="relative">
            <span className={cn("absolute top-3 -left-6 grid size-[19px] place-items-center rounded-full text-white ring-4 ring-card", meta.dot)} aria-hidden>
              <meta.icon className={cn("size-3", r.status === "running" && "animate-spin")} />
            </span>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : r.id)}
              aria-expanded={isOpen}
              className={cn(
                "grid w-full gap-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring",
                isOpen && "bg-muted/60",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{formatManila(r.started_at)}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden />
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className={cn("font-semibold", r.status === "error" ? "text-error" : r.status === "needs_you" ? "text-needs" : "")}>{meta.label}</span>
                <span aria-hidden>·</span>
                {r.trigger === "manual" ? "You asked" : "On schedule"}
                {d && <><span aria-hidden>·</span>{d}</>}
              </span>
              {!isOpen && <span className="line-clamp-1 text-xs text-muted-foreground/90">{excerpt(r)}</span>}
            </button>
            {isOpen && (
              <div className="mx-3 mt-1 mb-2 rounded-lg border bg-muted/30 p-3">
                {r.error
                  ? <p className="text-sm text-error [overflow-wrap:anywhere]">{r.error}</p>
                  : <FormattedText text={r.output ?? "No output."} />}
                {(r.error ?? r.output) && <div className="mt-2 flex justify-end"><CopyButton text={r.error ?? r.output ?? ""} /></div>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Empty({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-1.5 rounded-xl border border-dashed px-4 py-8 text-center">
      <span className="mb-1 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="size-5" aria-hidden /></span>
      <p className="text-sm font-semibold">{title}</p>
      {body && <p className="max-w-64 text-sm text-muted-foreground">{body}</p>}
      {children}
    </div>
  );
}
