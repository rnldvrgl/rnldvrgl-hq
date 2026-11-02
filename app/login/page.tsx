"use client";

import { Suspense, useEffect, useState, type SubmitEvent } from "react";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<string, string> = {
  owner: "HQ only opens for its owner. Sign in with the owner's email.",
  link: "That sign-in link didn't work. Type the 6-digit code from the email instead.",
};

/** Turn Supabase's error codes into plain sentences. */
function friendly(message: string): string {
  if (/expired|invalid/i.test(message)) return "That code is wrong or has expired. Check the newest email, or send a new code.";
  if (/email rate limit/i.test(message)) return "Supabase's free email service only sends 2 emails an hour. Sign in with your password instead, or try a code again in an hour.";
  if (/only request this after|security purposes/i.test(message)) return "Wait 60 seconds before asking for another code.";
  if (/rate limit|too many/i.test(message)) return "Too many tries. Wait a few minutes and try again.";
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/signups not allowed/i.test(message)) return "That email isn't registered. Use the owner's email.";
  return message;
}

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"password" | "email" | "code">("password");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(() => {
    const reason = params.get("reason");
    const base = ERRORS[params.get("error") ?? ""] ?? "";
    return reason ? `${base} (${reason})` : base;
  });

  // Supabase sometimes reports link errors in the URL hash, which the server never sees.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const desc = hash.get("error_description");
    if (desc) {
      setErr(`${ERRORS.link} (${desc.replace(/\+/g, " ")})`);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function sendCode(e?: SubmitEvent<HTMLFormElement>) {
    e?.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    setStep("code");
  }

  async function signInWithPassword(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await browserClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    window.location.assign("/");
  }

  async function verify(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await browserClient().auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    window.location.assign("/"); // full reload so the server sees the new session cookie
  }

  return (
    <main className="grid min-h-dvh place-items-center px-[max(16px,env(safe-area-inset-left,0px))]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-primary">rnldvrgl</p>
          <CardTitle className="text-2xl">HQ</CardTitle>
          <CardDescription>
            {step === "password" ? "Sign in with your email and password." : step === "email" ? "We'll email you a 6-digit code instead." : `We sent a code to ${email}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "password" ? (
            <form onSubmit={signInWithPassword} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
              <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setStep("email"); setErr(""); }}>
                Email me a code instead
              </button>
            </form>
          ) : step === "email" ? (
            <form onSubmit={sendCode} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</Button>
              <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setStep("password"); setErr(""); }}>
                Use my password instead
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="grid gap-3">
              <p className="flex gap-2 text-sm text-muted-foreground">
                <MailCheck className="size-5 shrink-0 text-primary" aria-hidden />
                Type the code from the email. It works in any browser, so you don&apos;t need to click the link.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10}
                  placeholder="123456" required autoFocus value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="font-mono text-lg tracking-[0.3em]"
                />
              </div>
              <Button type="submit" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</Button>
              <div className="flex justify-between text-sm">
                <button type="button" className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setStep("email"); setCode(""); setErr(""); }}>
                  Use a different email
                </button>
                <button type="button" className="text-primary underline-offset-4 hover:underline" disabled={busy} onClick={() => sendCode()}>
                  Send a new code
                </button>
              </div>
            </form>
          )}
          <p className="mt-3 min-h-5 text-sm text-destructive" aria-live="polite">{err}</p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
