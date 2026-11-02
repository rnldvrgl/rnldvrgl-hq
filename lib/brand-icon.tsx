import type { ReactElement } from "react";

export const BRAND_BG = "#1f3a52";

/**
 * The HQ cube logo (same as app/icon.svg) as a full-bleed square for ImageResponse.
 * Home-screen icons must be opaque and unrounded: iOS and Android apply their own mask.
 * `inset` shrinks the cube so it survives Android's circular "maskable" crop.
 */
export function BrandIcon({ size, inset = 0.16 }: { size: number; inset?: number }): ReactElement {
  const cube = Math.round(size * (1 - inset * 2));
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND_BG }}>
      <svg width={cube} height={cube} viewBox="12 12 40 40" xmlns="http://www.w3.org/2000/svg">
        <polygon points="32,14 52,24 32,34 12,24" fill="#e7b04a" />
        <polygon points="12,24 32,34 32,48 12,38" fill="#c98f2c" />
        <polygon points="52,24 32,34 32,48 52,38" fill="#a8761f" />
      </svg>
    </div>
  );
}
