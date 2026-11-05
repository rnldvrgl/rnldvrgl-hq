/**
 * Job posting links. The AI's web search sometimes returns a link it made up or masked ("…/job/???",
 * "…/job/12345678", a board's home page), which opens a 404. These helpers spot those and fall back to a
 * search for that exact job, which always works. Shared by the Job Hunter (server) and the desk (browser).
 */

/** Strip what doesn't identify a page: hash, tracking query, trailing slash, "www.". */
export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|ref|source|tracking|gclid|fbclid)/i.test(k)) url.searchParams.delete(k);
    const host = url.hostname.replace(/^www\./, "");
    return `${host}${url.pathname.replace(/\/+$/, "")}${url.search}`.toLowerCase();
  } catch {
    return u.trim().toLowerCase();
  }
}

/** A link that can't be a real posting: placeholders, masked ids, or just a board's front page. */
export function looksFake(u: string | null | undefined): boolean {
  if (!u) return true;
  let url: URL;
  try { url = new URL(u); } catch { return true; }
  if (!/^https?:$/.test(url.protocol)) return true;
  const path = decodeURIComponent(url.pathname + url.search);
  if (/\?\?|\{|\}|<|>|x{4,}|\.\.\.|…|placeholder|example|your-?job|job-?id|\bid\b=?$/i.test(path)) return true;
  if (/\/(job|jobs|viewjob|view|postings?)\/?$/i.test(url.pathname)) return true; // the id is missing
  if (url.pathname === "/" || url.pathname === "") return true; // the board's home page
  if (/\b(123456|1234567|12345678|00000)\b/.test(path)) return true; // obviously made-up ids
  return false;
}

/** A search for this job that always opens (Google, limited to the board when we know it). */
export function jobSearchUrl(job: { role: string; company: string; link?: string | null; source?: string | null }): string {
  let site = "";
  try { if (job.link) site = new URL(job.link).hostname.replace(/^www\./, ""); } catch { /* unknown board */ }
  const q = `${job.role} ${job.company}${site ? ` site:${site}` : job.source ? ` ${job.source}` : ""}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** The link to open for a job: its own page when it looks real, otherwise the search. */
export function jobHref(job: { role: string; company: string; link?: string | null; source?: string | null }): { href: string; real: boolean } {
  return job.link && !looksFake(job.link) ? { href: job.link, real: true } : { href: jobSearchUrl(job), real: false };
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

/**
 * Check a link the AI gave against the pages its searches really returned. Exact match: keep it. Otherwise
 * the returned page on the same site that best matches the role and company, if any. null = no real page.
 */
export function verifyJobLink(job: { role: string; company: string; link: string }, sources: string[]): string | null {
  if (sources.length === 0) return looksFake(job.link) ? null : job.link; // no search record (backup AI): best effort
  const want = normalizeUrl(job.link);
  const exact = sources.find((s) => normalizeUrl(s) === want);
  if (exact && !looksFake(exact)) return exact;
  let host = "";
  try { host = new URL(job.link).hostname.replace(/^www\./, ""); } catch { /* keep empty */ }
  const keys = [...new Set([...words(job.role), ...words(job.company)])];
  let best: { url: string; score: number } | null = null;
  for (const s of sources) {
    if (looksFake(s)) continue;
    let h = "";
    try { h = new URL(s).hostname.replace(/^www\./, ""); } catch { continue; }
    if (host && h !== host) continue;
    const slug = decodeURIComponent(s).toLowerCase();
    const score = keys.filter((k) => slug.includes(k)).length;
    if (score >= 2 && (!best || score > best.score)) best = { url: s, score };
  }
  return best?.url ?? null;
}
