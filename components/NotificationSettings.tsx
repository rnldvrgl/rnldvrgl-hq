"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Turn phone/desktop push notifications on or off for this device.
 * On iPhone, web push only works in the app added to the Home Screen (iOS 16.4+), so Safari gets a hint instead.
 */

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/** Safari's own flag for "opened from the Home Screen", plus the standard display-mode query. */
function isStandalone(): boolean {
  const nav: Navigator & { standalone?: boolean } = navigator;
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

/** The VAPID public key (URL-safe base64) as the bytes PushManager.subscribe wants. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function api(method: "POST" | "DELETE", url: string, body?: unknown): Promise<void> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.ok) return;
  const data: unknown = await res.json().catch(() => null);
  const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
  throw new Error(message);
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function NotificationSettings() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !isStandalone() ? "install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (!cancelled) setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => { if (!cancelled) setState("unsupported"); });
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    if (!VAPID_KEY) return toast.error("Push isn't set up yet: add NEXT_PUBLIC_VAPID_PUBLIC_KEY and redeploy.");
    setBusy(true);
    try {
      // Must be asked straight from the tap (Safari ignores it otherwise).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY) }));
      await api("POST", "/api/push/subscribe", sub.toJSON());
      setState("on");
      toast.success("Notifications on. The team will ping you when they need you.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't turn notifications on.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await api("DELETE", "/api/push/subscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Notifications off on this device.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't turn notifications off.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      await api("POST", "/api/push/test");
      toast.success("Test sent. It should arrive in a few seconds.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the test.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  const hint: Record<Exclude<State, "loading">, string> = {
    on: "You'll get a notification when someone needs you or hits an error.",
    off: "Get a notification when someone needs you.",
    denied: "Notifications are blocked. Allow them in Settings for this app, then reload.",
    install: "On iPhone: Share → Add to Home Screen, open HQ from the icon, then turn these on.",
    unsupported: "This browser can't receive push notifications.",
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-muted px-3 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
        {state === "on" ? <Bell className="size-4 text-primary" aria-hidden /> : <BellOff className="size-4 text-muted-foreground" aria-hidden />}
      </span>
      <div className="grid min-w-0 flex-1 basis-40">
        <span className="flex items-center gap-2 text-sm font-semibold">
          Notifications
          <Badge variant={state === "on" ? "default" : "outline"} className="px-1.5 py-0 text-[10px] uppercase">
            {state === "on" ? "On" : state === "off" ? "Off" : state === "install" ? "Install first" : state === "denied" ? "Blocked" : "Unavailable"}
          </Badge>
        </span>
        <span className="text-xs text-muted-foreground">{hint[state]}</span>
      </div>
      {(state === "off" || state === "on") && (
        <div className="flex gap-1.5">
          {state === "on" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={test} aria-label="Send a test notification">
              <Send /> Test
            </Button>
          )}
          <Button size="sm" variant={state === "on" ? "ghost" : "default"} disabled={busy} onClick={state === "on" ? disable : enable}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {state === "on" ? "Turn off" : "Enable"}
          </Button>
        </div>
      )}
    </div>
  );
}
