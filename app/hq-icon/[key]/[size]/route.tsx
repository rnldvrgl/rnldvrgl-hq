import { ImageResponse } from "next/og";
import { AppIconSquare } from "@/lib/app-icon";
import { iconFromKey } from "@/lib/prefs";

const SIZES = { "64": 64, "180": 180, "192": 192, "512": 512, "maskable-512": 512 } as const;
type SizeKey = keyof typeof SIZES;
const isSizeKey = (v: string): v is SizeKey => Object.hasOwn(SIZES, v);

/**
 * An HQ's chosen app icon as a PNG: /hq-icon/<glyph>-<colour>/<size> (64 for the tab, 180 for iPhone,
 * 192 / 512 / maskable-512 for the manifest). Public and cached for a year: the URL says what it draws.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string; size: string }> }) {
  const { key, size } = await params;
  const icon = iconFromKey(key);
  if (!icon || !isSizeKey(size)) return new Response("Not found", { status: 404 });
  const px = SIZES[size];
  return new ImageResponse(<AppIconSquare icon={icon} size={px} inset={size.startsWith("maskable") ? 0.24 : size === "64" ? 0.1 : 0.16} />, {
    width: px, height: px, headers: { "cache-control": "public, max-age=31536000, immutable" },
  });
}
