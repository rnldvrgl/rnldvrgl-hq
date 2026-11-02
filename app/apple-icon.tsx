import { ImageResponse } from "next/og";
import { BrandIcon } from "@/lib/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The iPhone Home Screen icon (iOS ignores SVG icons and the manifest's icons). */
export default function AppleIcon(): ImageResponse {
  return new ImageResponse(<BrandIcon size={size.width} />, size);
}
