import { checkInvite } from "@/lib/invites";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

const WHY = {
  missing: "This invite link doesn't exist. Check you copied all of it.",
  used: "This invite was already used. If it was you, just sign in.",
  expired: "This invite has expired. Ask your friend for a new one.",
} as const;

/** Where an invite link lands: who it's from, and your email to get your own HQ. */
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const inv = await checkInvite(code).catch(() => ({ ok: false as const, why: "missing" as const }));
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="grid w-full max-w-sm gap-5 rounded-3xl border border-border bg-card p-6 shadow-xl">
        <div className="grid gap-1.5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">HQ · invite</p>
          <h1 className="text-balance text-2xl font-semibold tracking-tight">
            {inv.ok ? "You're invited to get your own HQ" : "This invite can't be used"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {inv.ok
              ? `${inv.from} invited you. You get your own 3D office with its own AI team, and you can chat and talk with the other HQs.`
              : WHY[inv.why]}
          </p>
        </div>
        {inv.ok ? <InviteForm code={code} lockedEmail={inv.email} /> : <a href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Go to sign in</a>}
      </div>
    </main>
  );
}
