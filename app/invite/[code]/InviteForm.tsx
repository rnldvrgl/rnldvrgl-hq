"use client";

import { useState, type SubmitEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { browserClient } from "@/lib/supabase/browser";

/** Your email → your HQ is made → a 6-digit sign-in code is emailed, and the sign-in page takes it from there. */
export function InviteForm({ code, lockedEmail }: { code: string; lockedEmail: string | null }) {
  const [email, setEmail] = useState(lockedEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function accept(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await fetch("/api/invites/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, email }) });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "Couldn't use the invite.");
      const { error } = await browserClient().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw new Error(`Your HQ is ready, but the sign-in email didn't send (${error.message}). Sign in from the sign-in page.`);
      window.location.assign(`/login?note=invited&step=code&email=${encodeURIComponent(email)}`);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Couldn't use the invite.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={accept} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="inv-email">Your email</Label>
        <Input id="inv-email" type="email" autoComplete="email" required value={email} readOnly={!!lockedEmail}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11 text-base sm:text-sm" />
        {lockedEmail && <p className="text-xs text-muted-foreground">This invite is for this email.</p>}
      </div>
      {err && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
      <Button type="submit" disabled={busy} className="h-11">
        {busy ? <><Loader2 className="animate-spin" aria-hidden /> Making your HQ…</> : "Get my HQ"}
      </Button>
      <p className="text-xs text-muted-foreground">We&rsquo;ll email you a 6-digit code to sign in. No password needed.</p>
    </form>
  );
}
