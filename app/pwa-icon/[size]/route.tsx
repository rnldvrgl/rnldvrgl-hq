import { ImageResponse } from "next/og";
import { BrandIcon } from "@/lib/brand-icon";

const SIZES = { "192": 192, "512": 512, "maskable-512": 512 } as const;
type SizeKey = keyof typeof SIZES;
const isSizeKey = (v: string): v is SizeKey => Object.hasOwn(SIZES, v);

export const dynamic = "force-static";
export function generateStaticParams(): { size: SizeKey }[] {
  return Object.keys(SIZES).filter(isSizeKey).map((size) => ({ size }));
}

/** PNG icons for the web app manifest: /pwa-icon/192, /pwa-icon/512 and /pwa-icon/maskable-512. */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!isSizeKey(size)) return new Response("Not found", { status: 404 });
  const px = SIZES[size];
  return new ImageResponse(<BrandIcon size={px} inset={size.startsWith("maskable") ? 0.24 : 0.16} />, { width: px, height: px });
}
