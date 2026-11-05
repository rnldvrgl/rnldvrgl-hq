import "server-only";
import { ask, UNTRUSTED_NOTE } from "@/lib/ai";
import { openWork } from "@/lib/github";
import type { WorkResult } from "./types";
import { ownerName, ownersName } from "@/lib/names";

export async function devAssistant(): Promise<WorkResult> {
  const items = await openWork(7);
  if (!items.length) return { status: "done", summary: "No open PRs or issues", output: "Nothing open on GitHub involves you this week." };

  const list = items.map((i) => ({
    kind: i.pull_request ? "PR" : "issue",
    repo: i.repository_url.split("/").slice(-2).join("/"),
    title: i.title,
    by: i.user.login,
    updated: i.updated_at,
    url: i.html_url,
  }));
  const summary = await ask({
    private: true,
    maxTokens: 900,
    system: `You are a pragmatic dev lead. ${UNTRUSTED_NOTE} Plain text, under 180 words.`,
    prompt: `Here are open GitHub items involving ${ownerName()}. Group by repo, flag anything waiting on ${ownerName()} (review requests, PRs by others), and end with "Do first:" naming one item with its link.\n\n${JSON.stringify(list)}`,
  });
  const waiting = list.filter((i) => i.kind === "PR" && i.by.toLowerCase() !== (process.env.GITHUB_USERNAME ?? "").toLowerCase()).length;
  return {
    status: waiting ? "needs_you" : "done",
    summary: `${list.length} open item${list.length === 1 ? "" : "s"}${waiting ? ` · ${waiting} PR${waiting === 1 ? "" : "s"} to review` : ""}`,
    output: summary,
  };
}
