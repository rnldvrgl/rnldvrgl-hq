import { hqId } from "@/lib/hq-context";
import { NextResponse } from "next/server";
import { hqRoute } from "@/lib/hq";
import { db } from "@/lib/supabase/admin";
import { ask, UNTRUSTED_NOTE } from "@/lib/ai";
import { currentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Drafts a cover letter from the master profile. You paste it into the application yourself. */
export const POST = hqRoute(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { data: job } = await db().from("jobs").select("role, company, link, fit_reason").eq("id", id).eq("hq_id", hqId()).maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const profile = currentProfile();
  if (!profile) return NextResponse.json({ error: "Fill in About you in Settings → Connections first." }, { status: 400 });

  const letter = await ask({
    maxTokens: 900,
    webSearch: job.link ? { maxUses: 2 } : undefined,
    system: `You write sincere, specific cover letters. ${UNTRUSTED_NOTE} No clichés like "I am writing to express". Under 200 words.`,
    prompt: `Write a cover letter for ${profile.name} applying to "${job.role}" at ${job.company}.${job.link ? ` Read the posting first: ${job.link}` : ""}\nName the two most relevant projects with their links, match the posting's stack, and close with availability for a call. Plain text.\n\nProfile: ${JSON.stringify(profile)}`,
  });
  return NextResponse.json({ letter });
});
