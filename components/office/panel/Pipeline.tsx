"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BriefcaseBusiness, Copy, ExternalLink, Loader2, PenLine, Search, X } from "lucide-react";
import { jobHref } from "@/lib/job-links";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOffice } from "@/lib/store";
import { JOB_STATUSES, type JobStatus } from "@/lib/supabase/database.types";
import type { JobView } from "@/lib/team";
import { cn } from "@/lib/utils";
import { Empty, FormattedText } from "./Report";

const fail = (e: unknown, fallback: string) => toast.error(e instanceof Error ? e.message : fallback);
const isJobStatus = (v: string): v is JobStatus => JOB_STATUSES.some((s) => s === v);

const STATUS_LABEL: Record<JobStatus, string> = { saved: "Saved", applied: "Applied", interview: "Interview", offer: "Offer", closed: "Closed" };
const STATUS_DOT: Record<JobStatus, string> = {
  saved: "bg-idle", applied: "bg-working", interview: "bg-needs", offer: "bg-emerald-500", closed: "bg-off",
};

type Filter = "open" | JobStatus;

/** Fit score as a small bar, green for strong matches through amber to red. */
function FitBar({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, score));
  const color = s >= 75 ? "bg-emerald-500" : s >= 55 ? "bg-needs" : "bg-error";
  const text = s >= 75 ? "text-emerald-700 dark:text-emerald-400" : s >= 55 ? "text-needs" : "text-error";
  return (
    <div className="flex items-center gap-2" title={`Fit ${s}/100`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s} aria-label="Fit score">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${s}%` }} />
      </div>
      <span className={cn("w-12 text-right font-mono text-xs font-semibold tabular-nums", text)}>{s}/100</span>
    </div>
  );
}

function JobCard({ job, onLetter, drafting }: { job: JobView; onLetter: () => void; drafting: boolean }) {
  const { setJobStatus } = useOffice.getState();
  const initial = job.company.trim().charAt(0).toUpperCase() || "?";
  const link = jobHref(job);
  return (
    <li className="grid gap-2.5 rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent font-semibold text-accent-foreground" aria-hidden>{initial}</span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          {/* a made-up link (".../job/???") opens a search for this job instead of a 404 */}
          <a
            href={link.href} target="_blank" rel="noopener noreferrer"
            title={link.real ? undefined : "The posting's exact link wasn't found, so this searches for it"}
            className="font-semibold leading-snug hover:text-primary hover:underline [overflow-wrap:anywhere]"
          >
            {job.role} {link.real
              ? <ExternalLink className="inline size-3 align-baseline opacity-60" aria-hidden />
              : <Search className="inline size-3 align-baseline opacity-60" aria-label="(search)" />}
          </a>
          <span className="truncate text-xs text-muted-foreground">{job.company} · {job.salary_text || "Pay not listed"}</span>
        </div>
      </div>
      {job.fit_score != null && <FitBar score={job.fit_score} />}
      {job.fit_reason && <p className="text-xs leading-relaxed text-muted-foreground">{job.fit_reason}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={job.status} onValueChange={(v) => { if (isJobStatus(v)) setJobStatus(job.id, v).catch((e: unknown) => fail(e, "Couldn't save the status.")); }}>
          <SelectTrigger size="sm" className="w-34" aria-label={`Status for ${job.role}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JOB_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <span className={cn("size-2 rounded-full", STATUS_DOT[s])} aria-hidden />{STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={drafting} onClick={onLetter}>
          {drafting ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />}
          {drafting ? "Drafting…" : "Cover letter"}
        </Button>
      </div>
    </li>
  );
}

/** Hunter's job pipeline: filter chips with counts, job cards, cover-letter drafts. */
export function Pipeline() {
  const jobs = useOffice((s) => s.data.jobs);
  const { draftCoverLetter } = useOffice.getState();
  const [filter, setFilter] = useState<Filter>("open");
  const [letter, setLetter] = useState<{ id: string; text: string } | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);

  const count = (f: Filter) => jobs.filter((j) => (f === "open" ? j.status !== "closed" : j.status === f)).length;
  const shown = jobs.filter((j) => (filter === "open" ? j.status !== "closed" : j.status === filter)).slice(0, 30);
  const filters: Filter[] = ["open", ...JOB_STATUSES];

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter jobs">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {f !== "open" && <span className={cn("size-1.5 rounded-full", STATUS_DOT[f])} aria-hidden />}
            {f === "open" ? "Open" : STATUS_LABEL[f]}
            <span className={cn("tabular-nums", filter === f ? "opacity-80" : "opacity-70")}>{count(f)}</span>
          </button>
        ))}
      </div>

      {letter && (
        <div className="grid gap-2 rounded-xl border border-ring/40 bg-accent p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Cover letter draft</p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(letter.text); toast.success("Copied. Paste it into the application."); }
                  catch { toast.error("Select the text and copy it manually."); }
                }}>
                <Copy aria-hidden /> Copy
              </Button>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Close the draft" onClick={() => setLetter(null)}><X aria-hidden /></Button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg bg-card p-3"><FormattedText text={letter.text} /></div>
        </div>
      )}

      {jobs.length === 0 ? (
        <Empty icon={BriefcaseBusiness} title="No jobs yet" body="Hunter searches 13 boards every weekday at 7:45 AM." />
      ) : shown.length === 0 ? (
        <Empty icon={BriefcaseBusiness} title={`Nothing ${filter === "open" ? "open" : `in ${STATUS_LABEL[filter].toLowerCase()}`}`} />
      ) : (
        <ul className="grid gap-2">
          {shown.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              drafting={drafting === j.id}
              onLetter={async () => {
                setDrafting(j.id);
                try { setLetter({ id: j.id, text: await draftCoverLetter(j.id) }); toast.success("Cover letter drafted."); }
                catch (e) { fail(e, "Couldn't draft the letter."); }
                finally { setDrafting(null); }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
