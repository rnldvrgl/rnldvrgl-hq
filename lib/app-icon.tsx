import type { ReactElement } from "react";
import { APP_COLORS, DEFAULT_ICON, type AppGlyph, type AppIcon } from "@/lib/prefs";

/**
 * The app icons you can pick in Settings → Appearance: a glyph on a colour. Plain filled SVG (no strokes,
 * no fonts) so the same drawing works in the header, the picker and next/og's ImageResponse for the
 * favicon and Home Screen icons.
 */

const INK = "#fbf3e4", SHADE = "#f0c25e", DEEP = "#d39a35";

/** Each glyph in a 64×64 box, centred on (32, 32), about 40 wide. */
export function Glyph({ glyph, size }: { glyph: AppGlyph; size: number }): ReactElement {
  const box = { width: size, height: size, viewBox: "0 0 64 64", xmlns: "http://www.w3.org/2000/svg" } as const;
  switch (glyph) {
    case "cube":
      return (
        <svg {...box}>
          <polygon points="32,12 52,22 32,32 12,22" fill="#e7b04a" />
          <polygon points="12,22 32,32 32,52 12,42" fill="#c98f2c" />
          <polygon points="52,22 32,32 32,52 52,42" fill="#a8761f" />
        </svg>
      );
    case "house":
      return (
        <svg {...box}>
          <polygon points="32,11 54,30 48,30 48,52 16,52 16,30 10,30" fill={INK} />
          <rect x="27" y="37" width="10" height="15" rx="1.5" fill={SHADE} />
          <rect x="40" y="14" width="5" height="10" fill={INK} />
        </svg>
      );
    case "rocket":
      return (
        <svg {...box}>
          <path d="M32 8c9 7 13 17 12 30H20C19 25 23 15 32 8z" fill={INK} />
          <circle cx="32" cy="26" r="5" fill={SHADE} />
          <path d="M20 34l-8 10 9-1zM44 34l8 10-9-1z" fill={DEEP} />
          <path d="M26 40h12l-6 15z" fill={SHADE} />
        </svg>
      );
    case "coffee":
      return (
        <svg {...box}>
          <path d="M12 26h34v10c0 9-7 16-17 16S12 45 12 36z" fill={INK} />
          <path d="M46 29h3a7 7 0 010 14h-4v-4h4a3 3 0 000-6h-3z" fill={INK} />
          <path d="M22 12c-3 3 3 5 0 9M30 10c-3 3 3 6 0 11M38 12c-3 3 3 5 0 9" stroke={SHADE} strokeWidth="3" strokeLinecap="round" fill="none" />
          <rect x="10" y="53" width="40" height="3" rx="1.5" fill={SHADE} />
        </svg>
      );
    case "heart":
      return (
        <svg {...box}>
          <path d="M32 54C14 41 8 32 8 23c0-7 6-12 12-12 5 0 9 3 12 7 3-4 7-7 12-7 6 0 12 5 12 12 0 9-6 18-24 31z" fill={INK} />
          <path d="M19 19c-3 0-5 2-5 5" stroke={SHADE} strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "star":
      return (
        <svg {...box}>
          <polygon points="32,8 39,24 56,25 43,36 47,53 32,44 17,53 21,36 8,25 25,24" fill={INK} />
          <polygon points="32,18 36,28 46,28 38,35 40,45 32,40" fill={SHADE} />
        </svg>
      );
    case "paw":
      return (
        <svg {...box}>
          <ellipse cx="32" cy="42" rx="13" ry="11" fill={INK} />
          <ellipse cx="17" cy="28" rx="5" ry="6.5" fill={INK} />
          <ellipse cx="26" cy="18" rx="5" ry="6.5" fill={INK} />
          <ellipse cx="38" cy="18" rx="5" ry="6.5" fill={INK} />
          <ellipse cx="47" cy="28" rx="5" ry="6.5" fill={INK} />
        </svg>
      );
    case "leaf":
      return (
        <svg {...box}>
          <path d="M52 10C26 10 12 22 12 40c0 5 2 9 4 12 18 0 36-12 36-42z" fill={INK} />
          <path d="M16 52C24 40 32 32 44 22" stroke={DEEP} strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...box}>
          <polygon points="37,6 14,36 29,36 25,58 50,26 35,26" fill={INK} />
          <polygon points="37,6 30,26 35,26" fill={SHADE} />
        </svg>
      );
    case "crown":
      return (
        <svg {...box}>
          <polygon points="10,22 22,34 32,14 42,34 54,22 50,48 14,48" fill={INK} />
          <rect x="14" y="50" width="36" height="5" rx="2" fill={SHADE} />
          <circle cx="32" cy="38" r="4" fill={DEEP} />
        </svg>
      );
    case "moon":
      return (
        <svg {...box}>
          <path d="M40 10a23 23 0 1014 38A19 19 0 0140 10z" fill={INK} />
          <circle cx="47" cy="16" r="2.5" fill={SHADE} />
          <circle cx="53" cy="28" r="1.8" fill={SHADE} />
        </svg>
      );
    case "game":
      return (
        <svg {...box}>
          <path d="M18 20h28c7 0 11 6 12 14l1 9c1 6-6 9-10 4l-5-6H20l-5 6c-4 5-11 2-10-4l1-9c1-8 5-14 12-14z" fill={INK} />
          <rect x="16" y="28" width="10" height="3.5" rx="1" fill={DEEP} />
          <rect x="19.25" y="24.75" width="3.5" height="10" rx="1" fill={DEEP} />
          <circle cx="42" cy="27" r="2.6" fill={SHADE} />
          <circle cx="48" cy="32" r="2.6" fill={DEEP} />
        </svg>
      );
  }
}

/** The icon as a full-bleed square (Home Screen icons must be opaque and unrounded: the OS masks them). */
export function AppIconSquare({ icon = DEFAULT_ICON, size, inset = 0.16 }: { icon?: AppIcon; size: number; inset?: number }): ReactElement {
  const [a, b] = APP_COLORS[icon.color];
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(145deg, ${a}, ${b})` }}>
      <Glyph glyph={icon.glyph} size={Math.round(size * (1 - inset * 2))} />
    </div>
  );
}

/** The icon's two colours, for a CSS gradient. */
export const iconGradient = (icon: AppIcon): string => { const [a, b] = APP_COLORS[icon.color]; return `linear-gradient(145deg, ${a}, ${b})`; };
