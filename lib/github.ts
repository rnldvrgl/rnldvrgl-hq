import "server-only";
import { env } from "@/lib/env";

export type GhItem = { title: string; html_url: string; repository_url: string; pull_request?: unknown; updated_at: string; user: { login: string } };

/** Open issues and pull requests that involve you, updated in the last `days` days. */
export async function openWork(days = 7): Promise<GhItem[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const q = `is:open involves:${env("GITHUB_USERNAME")} updated:>=${since}`;
  const res = await fetch(`https://api.github.com/search/issues?${new URLSearchParams({ q, per_page: "30", sort: "updated" })}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env("GITHUB_TOKEN")}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { items: GhItem[] };
  return data.items;
}
