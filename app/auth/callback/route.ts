import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sessionClient } from "@/lib/supabase/server";

const OTP_TYPES = ["email", "magiclink", "signup", "invite", "recovery", "email_change"] as const satisfies readonly EmailOtpType[];
const isOtpType = (v: string | null): v is (typeof OTP_TYPES)[number] => OTP_TYPES.some((t) => t === v);

/**
 * Where a clicked sign-in link lands. Handles both link styles Supabase can send:
 *   ?token_hash=…&type=email  works in any browser (recommended email template, see README)
 *   ?code=…                   only works in the same browser that asked for the link
 * On failure it passes Supabase's real reason to /login instead of a generic message.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=link&reason=${encodeURIComponent(reason)}`, url.origin));

  const linkError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (linkError) return fail(linkError);

  const supabase = await sessionClient();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");

  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Almost always: the link was opened in a different browser/profile than the one that asked for it.
      return fail(/verifier/i.test(error.message) ? "link opened in a different browser" : error.message);
    }
  } else {
    return fail("the link had no sign-in token");
  }
  // ?signedin tells the session lock (components/SessionLock.tsx) this tab just signed in
  return NextResponse.redirect(new URL("/?signedin=1", url.origin));
}
