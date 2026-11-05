import { NextResponse } from "next/server";
import { appNameOf, cleanHandle, iconFromKey, iconKey, DEFAULT_ICON } from "@/lib/prefs";
import { HQ } from "@/hq.config";

/**
 * The web app manifest for an HQ: /hq-manifest/<glyph>-<colour>?h=<handle>. Its name and icons are that
 * HQ's (Settings → Appearance), so installing it on a phone uses them. Public (browsers fetch manifests
 * without cookies), and it only echoes back what's in its own URL.
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const icon = iconFromKey(key) ?? DEFAULT_ICON;
  const handle = cleanHandle(new URL(req.url).searchParams.get("h")) ?? HQ.owner.handle;
  const k = iconKey(icon);
  return NextResponse.json({
    name: appNameOf(handle),
    short_name: "HQ",
    description: "A private headquarters of AI employees.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f151c",
    theme_color: "#1f3a52",
    icons: [
      { src: `/hq-icon/${k}/192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/hq-icon/${k}/512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/hq-icon/${k}/maskable-512`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }, { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } });
}
