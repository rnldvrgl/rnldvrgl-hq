"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { finishSpotifyLogin } from "@/lib/spotify";

/**
 * Spotify sends you back here after you allow HQ (Authorization Code + PKCE). Trade the code for tokens in
 * this browser, then go back to the office. Signed-in only, like every page (see middleware.ts).
 */
function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const code = params.get("code");
    const denied = params.get("error");
    if (!code) { setError(denied === "access_denied" ? "You didn't allow Spotify access." : "Spotify didn't send a sign-in code."); return; }
    finishSpotifyLogin(code)
      .then(() => router.replace("/"))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't connect Spotify."));
  }, [params, router]);

  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <p className="text-sm font-medium">{error ? "Spotify isn't connected" : "Connecting Spotify…"}</p>
        {error && (
          <>
            <p role="alert" className="text-sm text-muted-foreground">{error}</p>
            <a href="/" className="inline-block text-sm font-medium underline underline-offset-4">Back to the office</a>
          </>
        )}
      </div>
    </main>
  );
}

export default function SpotifyCallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  );
}
