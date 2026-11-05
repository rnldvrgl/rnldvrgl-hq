"use client";

import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { HQ } from "@/hq.config";

/**
 * "Ask me to sign in again" (hq.config → login.askAgain). Supabase keeps you signed in for weeks; with this,
 * closing the app or the tab ends it: the next open goes back to the sign-in page (handy for a passkey).
 *
 * How: signing in marks this tab in sessionStorage, which the browser forgets when the tab or the
 * installed app is closed. Opening HQ without the mark signs out on this device and goes to /login.
 * It's a convenience lock on top of the real sign-in, not a security boundary.
 */

const KEY = "hq:unlocked";

/** Call right after a successful sign-in, before leaving the sign-in page. */
export function unlock(): void {
  try { window.sessionStorage.setItem(KEY, "1"); } catch { /* storage blocked: the lock lets you in anyway */ }
}

const isPhone = () => window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;

export function SessionLock() {
  const [state, setState] = useState<"checking" | "open" | "leaving">("checking");

  useEffect(() => {
    const mode = HQ.login.askAgain;
    const applies = mode === "always" || (mode === "phones" && isPhone());
    const url = new URL(window.location.href);
    // just back from an emailed sign-in link
    if (url.searchParams.has("signedin")) {
      unlock();
      url.searchParams.delete("signedin");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    let marked = true;
    try { marked = window.sessionStorage.getItem(KEY) === "1"; } catch { /* storage blocked: don't lock out */ }
    if (!applies || marked) {
      // keep the mark for the rest of this tab even if the setting changes later
      if (!marked) unlock();
      setState("open");
      return;
    }
    setState("leaving");
    void browserClient().auth.signOut({ scope: "local" }).finally(() => window.location.replace("/login?note=again"));
  }, []);

  if (state === "open" || HQ.login.askAgain === "never") return null;
  // Cover the office while checking, on phones only (pointer-coarse), so a desktop never sees a flash.
  return (
    <div
      aria-hidden={state === "checking"}
      className={state === "leaving" ? "fixed inset-0 z-[200] bg-background" : "fixed inset-0 z-[200] hidden bg-background pointer-coarse:block"}
    />
  );
}
