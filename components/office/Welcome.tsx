"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { toast } from "sonner";
import { ArrowRight, Check, Crown, Flower2, Loader2, PlugZap } from "lucide-react";
import { useOffice } from "@/lib/store";
import { usePrefs, useHandle } from "@/lib/prefs-client";
import { appNameOf, cleanHandle, HANDLE_MAX } from "@/lib/prefs";
import { cleanName, currentNames, NAME_MAX } from "@/lib/names";
import { useSettings } from "@/lib/settings";
import { openSettings } from "@/lib/settings-nav";
import { cn } from "@/lib/utils";
import { AppIconPicker } from "./settings/AppearancePage";
import { WhoWorksHere } from "./settings/TeamPage";
import { Segmented, ghostBtn, inputCls, primaryBtn } from "./settings/kit";

/**
 * The first time a friend opens their new HQ: three short steps (you and your HQ's name, its look, the team),
 * then straight to Connections to hire them. Shown once; "Skip" counts too. Everything can be changed
 * later in Settings.
 */
export function Welcome() {
  const founder = useOffice((s) => s.data.hq?.founder ?? true);
  const done = usePrefs((s) => !!s.prefs.setup);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  if (founder || done || !open) return null;
  const finish = (connect: boolean) => {
    usePrefs.getState().set({ setup: true });
    setOpen(false);
    if (connect) openSettings("connections");
  };
  const STEPS = ["You", "Look", "Team"];
  return (
    <Dialog.Root open onOpenChange={(v) => { if (!v) finish(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl outline-none"
        >
          <div className="flex items-center gap-2 px-5 pt-5">
            {STEPS.map((s, i) => (
              <span key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} aria-hidden />
            ))}
          </div>
          <div className="px-5 pt-4">
            <Dialog.Title className="text-xl font-semibold tracking-tight">
              {step === 0 ? "Welcome to your HQ" : step === 1 ? "Make it yours" : "Pick your team"}
            </Dialog.Title>
            <p className="text-sm text-muted-foreground">
              {step === 0 ? "Your own office of AI employees. First, what should we call you?"
                : step === 1 ? "How you look in the office, and your app's icon."
                  : "Only the ones you pick get a desk. Not using GitHub or Google? Leave those out."}
            </p>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {step === 0 ? <StepYou onNext={() => setStep(1)} /> : step === 1 ? <StepLook /> : <WhoWorksHere />}
          </div>
          {step > 0 && (
            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              <button type="button" className={ghostBtn} onClick={() => setStep(step - 1)}>Back</button>
              <span className="flex-1" />
              {step === 1 ? (
                <button type="button" className={primaryBtn} onClick={() => setStep(2)}>Next <ArrowRight className="size-4" aria-hidden /></button>
              ) : (
                <>
                  <button type="button" className={ghostBtn} onClick={() => finish(false)}>Done</button>
                  <button type="button" className={primaryBtn} onClick={() => finish(true)}><PlugZap className="size-4" aria-hidden /> Connect accounts</button>
                </>
              )}
            </div>
          )}
          {step === 0 && (
            <button type="button" onClick={() => finish(false)} className="mx-5 mb-4 self-start text-xs text-muted-foreground underline-offset-2 hover:underline">
              Skip for now (it's all in Settings)
            </button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StepYou({ onNext }: { onNext: () => void }) {
  const saveNames = useOffice((s) => s.saveNames);
  const handle = useHandle();
  const [name, setName] = useState(() => currentNames().owner);
  const [hq, setHq] = useState(handle);
  const [busy, setBusy] = useState(false);
  const okName = cleanName(name), okHq = cleanHandle(hq);
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!okName || !okHq) return;
        setBusy(true);
        try {
          if (okName !== currentNames().owner) await saveNames({ ...currentNames(), owner: okName });
          if (okHq !== handle) usePrefs.getState().set({ handle: okHq });
          onNext();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't save that."); }
        finally { setBusy(false); }
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Your first name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} className={inputCls} autoFocus aria-invalid={!okName} />
        <span className="text-xs text-muted-foreground">The team calls you this, in the office and in their emails.</span>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Your HQ&apos;s name</span>
        <span className="flex items-center gap-2">
          <input value={hq} onChange={(e) => setHq(e.target.value)} maxLength={HANDLE_MAX} className={cn(inputCls, "font-mono")} aria-invalid={!okHq} />
          <span className="font-semibold">HQ</span>
        </span>
        <span className="text-xs text-muted-foreground">{okHq ? `Shown as “${appNameOf(okHq)}”.` : "Letters, numbers, dots or dashes, no spaces."}</span>
      </label>
      <button type="submit" className={primaryBtn} disabled={!okName || !okHq || busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} Continue
      </button>
    </form>
  );
}

function StepLook() {
  const look = useSettings((s) => s.boss.look);
  const setBoss = useSettings((s) => s.setBoss);
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">You in the office</span>
        <Segmented label="Your look" value={look} onChange={(v) => setBoss({ look: v })}
          options={[{ id: "him", label: "Him", icon: Crown }, { id: "her", label: "Her", icon: Flower2 }]} />
        <span className="text-xs text-muted-foreground">Your house, office and car follow this until you pick your own in Settings → Boss.</span>
      </div>
      <AppIconPicker />
    </div>
  );
}
