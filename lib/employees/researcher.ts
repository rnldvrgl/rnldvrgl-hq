import "server-only";
import { ask, UNTRUSTED_NOTE } from "@/lib/ai";
import { emailMe } from "@/lib/email";
import type { WorkResult } from "./types";

/** Edit this list to change what Rhea follows. */
export const RESEARCH_TOPICS = [
  "Next.js releases and notable changes",
  "React releases and RFCs",
  "GSAP and web animation techniques",
  "Remote frontend hiring trends for Philippine developers",
];

export async function researcher(): Promise<WorkResult> {
  const digest = await ask({
    maxTokens: 2500,
    webSearch: { maxUses: 8 },
    system: `You write a weekly research digest for a mid-level React/Next.js developer. ${UNTRUSTED_NOTE} Paraphrase; never paste long quotes.`,
    prompt: `Cover what changed in the last 7 days for each topic below. For each: 2–4 bullet points, each with the source link. If nothing notable happened, say so in one line.\n\nTopics:\n${RESEARCH_TOPICS.map((t) => `- ${t}`).join("\n")}\n\nFinish with "Try this week:" and one small thing worth building or reading.`,
  });
  await emailMe("Research digest", digest);
  return { status: "done", summary: `Digest on ${RESEARCH_TOPICS.length} topics sent`, output: digest };
}
