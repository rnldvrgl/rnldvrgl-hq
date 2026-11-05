"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Copy, Link2, Loader2, UserRound, X } from "lucide-react";

type Invite = { code: string; email: string | null; created_at: string; expires_at: string; used_at: string | null };
type Friend = { id: string; owner_email: string | null; name: string | null; created_at: string };

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** Settings → Friends: make an invite link (optionally for one email), see who's joined, cancel unused links. */
export function Friends() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [canInvite, setCanInvite] = useState(false);
  const link = (code: string) => `${window.location.origin}/invite/${code}`;

  const load = useCallback(async () => {
    const res = await fetch("/api/invites", { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { invites?: Invite[]; friends?: Friend[]; canInvite?: boolean; error?: string } | null;
    if (!res.ok) return setErr(body?.error ?? "Couldn't load invites.");
    setCanInvite(!!body?.canInvite);
    setInvites(body?.invites ?? []); setFriends(body?.friends ?? []); setErr("");
  }, []);
  useEffect(() => { void load(); }, [load]);

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(link(code)); toast.success("Invite link copied."); } catch { toast.message(link(code)); }
  };

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const body = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
      if (!res.ok || !body?.code) throw new Error(body?.error ?? "Couldn't make an invite.");
      setEmail("");
      await load();
      await copy(body.code);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't make an invite."); }
    finally { setBusy(false); }
  }

  const open = invites.filter((i) => !i.used_at && new Date(i.expires_at) > new Date());
  return (
    <div className="grid gap-3">
      {err && <p className="px-1.5 text-sm text-destructive">{err}</p>}
      {!canInvite && <p className="px-1.5 text-xs text-muted-foreground">Only the HQ that invited you can make invite links for now.</p>}
      <div className={cn("grid gap-1.5 px-1.5", !canInvite && "hidden")}>
        <label htmlFor="inv-for" className="text-xs font-medium">Invite a friend <span className="font-normal text-muted-foreground">· the link works once, for 7 days</span></label>
        <div className="flex min-w-0 gap-1.5">
          <input id="inv-for" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email (optional)"
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40" />
          <button type="button" onClick={create} disabled={busy}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Link2 className="size-4" aria-hidden />} Make link
          </button>
        </div>
      </div>
      {open.length > 0 && (
        <ul className="grid gap-1.5">
          {open.map((i) => (
            <li key={i.code} className="flex min-w-0 items-center gap-2 rounded-xl border border-border px-2.5 py-2">
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-medium">{i.email ?? "Anyone with the link"}</span>
                <span className="text-[11px] text-muted-foreground">Until {DAY.format(new Date(i.expires_at))}</span>
              </span>
              <button type="button" onClick={() => copy(i.code)} aria-label="Copy invite link" className="grid size-9 place-items-center rounded-lg hover:bg-muted"><Copy className="size-4" aria-hidden /></button>
              <button type="button" aria-label="Cancel invite" onClick={async () => { await fetch(`/api/invites?code=${encodeURIComponent(i.code)}`, { method: "DELETE" }); await load(); }}
                className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"><X className="size-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-1.5 px-1.5">
        <span className="text-xs font-medium">Friends with an HQ ({friends.length})</span>
        {friends.length === 0 ? <p className="text-xs text-muted-foreground">Nobody yet. Send someone a link.</p> : (
          <ul className="grid gap-1">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-sm">
                <UserRound className="size-4 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{f.name ?? f.owner_email}</span>
                <span className="text-[11px] text-muted-foreground">since {DAY.format(new Date(f.created_at))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
