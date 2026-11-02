import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase/server";

/** Magic-link landing: swaps the one-time code for a session cookie, then opens the office. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await sessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
