import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/config";

/**
 * Keeps the Supabase session fresh and sends anyone without a session to /login.
 * The owner-email check happens again on the server for every page and API call.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient<Database>(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          // Responses that refresh auth cookies must never be cached by a CDN.
          Object.entries(headers).forEach(([key, value]) => res.headers.set(key, value));
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth") || path === "/api/tick" || path === "/api/reminders/sync";
  if (!data.user && !isPublic) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  // The PWA manifest and icons must load without a session: iOS fetches them when you add HQ to the Home Screen.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|manifest.webmanifest|pwa-icon|fonts/).*)"],
};
