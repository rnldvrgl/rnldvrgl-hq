"use client";

import { useState } from "react";
import { LogOut, Loader2, RotateCcw } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import { useOffice } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Passkeys } from "../Passkeys";
import { Group } from "./kit";

export function AccountPage() {
    return (
        <>
            <Group title="Sign-in" hint="Passkeys sign you in without a password or an email code.">
                <div className="grid gap-2 rounded-2xl border border-border bg-card/60 p-3">
                    <Passkeys />
                </div>
            </Group>
            <Group title="Notifications" hint="Get a push when someone needs you.">
                <div className="grid gap-2 rounded-2xl border border-border bg-card/60 p-3">
                    <NotificationSettings />
                </div>
            </Group>
            <Group title="This device" hint="Sign out here (other devices stay signed in), or put this device's settings back to how they started.">
                <div className="grid gap-2">
                    <SignOut />
                    <ResetAll />
                </div>
            </Group>
        </>
    );
}

/** Sign out on this device (other devices stay signed in). */
function SignOut() {
    const [busy, setBusy] = useState(false);
    return (
        <button
            type="button"
            disabled={busy}
            onClick={async () => {
                setBusy(true);
                try { window.sessionStorage.removeItem("hq:unlocked"); } catch { /* fine */ }
                await browserClient().auth.signOut({ scope: "local" }).catch(() => { });
                window.location.assign("/login");
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
        >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />} Sign out
        </button>
    );
}

function ResetAll() {
    const reset = useSettings((s) => s.reset);
    const setLowPower = useOffice((s) => s.setLowPower);
    return (
        <button
            type="button"
            onClick={() => { reset(); setLowPower(false); }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
            <RotateCcw className="size-4" aria-hidden /> Reset this device's settings
        </button>
    );
}
