"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Fingerprint, Loader2, Trash2 } from "lucide-react";
import type { PasskeyListItem } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { browserClient } from "@/lib/supabase/browser";

const DATE = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

/**
 * Settings → Account: passkeys for signing in with Face ID, Touch ID, Windows Hello or a security key instead of
 * a password or an email code (which the free Supabase plan limits to a few an hour). Each device adds its own.
 * Needs passkeys turned on in the Supabase project (Authentication → Sign In / Providers → Passkeys).
 */
export function Passkeys() {
  const [list, setList] = useState<PasskeyListItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== "undefined" && "PublicKeyCredential" in window;

  const load = useCallback(async () => {
    const { data, error } = await browserClient().auth.passkey.list();
    setList(error ? [] : data ?? []);
  }, []);
  useEffect(() => { if (supported) void load(); }, [load, supported]);

  async function add() {
    setBusy(true);
    const { error } = await browserClient().auth.registerPasskey();
    setBusy(false);
    if (error) {
      if (/abort|cancel|NotAllowedError|not allowed/i.test(error.message)) return;
      toast.error(/disabled|not enabled|webauthn/i.test(error.message) ? "Passkeys are off in the Supabase project. Turn them on under Authentication → Providers." : error.message);
      return;
    }
    toast.success("Passkey added. Next time, sign in with it.");
    void load();
  }

  async function remove(id: string) {
    const { error } = await browserClient().auth.passkey.delete({ passkeyId: id });
    if (error) return toast.error(error.message);
    void load();
  }

  if (!supported) return <p className="px-2.5 text-xs text-muted-foreground">This browser doesn&apos;t support passkeys.</p>;
  return (
    <div className="grid gap-2 px-2.5">
      {list === null ? (
        <p className="text-xs text-muted-foreground">Loading passkeys…</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-muted-foreground">No passkeys yet. Add one to sign in with Face ID or a fingerprint.</p>
      ) : (
        <ul className="grid gap-1.5">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <Fingerprint className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{p.friendly_name || "Passkey"}</span>
                <span className="block text-[11px] text-muted-foreground">
                  Added {DATE.format(new Date(p.created_at))}{p.last_used_at ? ` · last used ${DATE.format(new Date(p.last_used_at))}` : ""}
                </span>
              </span>
              <button type="button" onClick={() => void remove(p.id)} aria-label={`Remove ${p.friendly_name || "passkey"}`} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-destructive">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" className="justify-self-start" disabled={busy} onClick={add}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Fingerprint aria-hidden />} Add a passkey on this device
      </Button>
    </div>
  );
}
