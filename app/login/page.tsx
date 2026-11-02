"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<string, string> = {
  link: "That sign-in link expired or was already used. Send a new one.",
  owner: "HQ only opens for its owner. Sign in with the owner's email.",
};

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(ERRORS[params.get("error") ?? ""] ?? "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(""); setSending(true);
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <main className="grid min-h-dvh place-items-center px-[max(16px,env(safe-area-inset-left,0px))]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-primary">rnldvrgl</p>
          <CardTitle className="text-2xl">HQ</CardTitle>
          <CardDescription>Sign in with your email. We&apos;ll send a one-time link.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="flex gap-2 text-sm"><MailCheck className="size-5 shrink-0 text-primary" aria-hidden /> Check {email} for the link. It opens the office on this device.</p>
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Email me a sign-in link"}</Button>
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
