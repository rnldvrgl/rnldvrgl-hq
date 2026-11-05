"use client";

import { create } from "zustand";
import { manilaParts } from "@/lib/time";

/**
 * The town's holidays: when each one is on (Manila date) and how the town dresses up for it. The 3D side is
 * components/office/Holidays.tsx (Christmas, fireworks) and Festive.tsx (everything else). Settings →
 * Holidays lists them and can preview any one of them now.
 */

export type HolidayId =
  | "newyear" | "lunar" | "valentines" | "holyweek" | "fiesta" | "flags" | "undas" | "christmas";

/** What goes up around town (see Festive.tsx). */
export type Decor = {
  /** Hung at every shop front and house gate. */
  ornament: "lantern" | "heart" | "flag" | "pumpkin" | "candle" | null;
  /** Triangle bunting (banderitas): colours that take turns. Along the shop fronts and gates. */
  bunting: readonly string[] | null;
  /** Bunting strung across the main street too, fiesta style. */
  acrossStreet: boolean;
  /** Fireworks over the town in the evening (hours, Manila). */
  fireworks: readonly [number, number] | null;
  /**
   * Something more for this one: heart balloons and garlands (Valentine's), the penitensya procession (Holy
   * Week), ghosts, bats and trick-or-treaters (Halloween), the banner and the fruit table (New Year), the
   * dragon dance (Chinese New Year), the flower arches, the Santacruzan and the perya (the fiesta), big flags
   * on the lamp posts (Independence Day).
   */
  extras?: "valentine" | "penitensya" | "halloween" | "newyear" | "lunar" | "fiesta" | "kalayaan";
};

export type Holiday = {
  id: HolidayId;
  name: string;
  /** When it is, in words (shown in Settings). */
  when: string;
  /** What you'll see. */
  looks: string;
  /** Three colours for its swatch in Settings. */
  swatch: readonly [string, string, string];
  /** The time the preview jumps to, so it's seen at its best (lights at night, flags by day). */
  previewAt: string;
  /** Is it on at this Manila date? */
  on: (p: ReturnType<typeof manilaParts>) => boolean;
  /** Its first day in a year (month 0–11, day), for "next: …" in Settings. */
  first: (year: number) => [number, number] | null;
  decor: Decor | null;
};

/** Lunar New Year (Chinese New Year) dates: a lunar calendar, so a table. */
const LUNAR: Record<number, [number, number]> = {
  2025: [0, 29], 2026: [1, 17], 2027: [1, 6], 2028: [0, 26], 2029: [1, 13], 2030: [1, 3], 2031: [0, 23], 2032: [1, 11],
};
/** Easter Sunday; Holy Week is the Thursday and Friday before it (the PH holidays). */
const EASTER: Record<number, [number, number]> = {
  2025: [3, 20], 2026: [3, 5], 2027: [2, 28], 2028: [3, 16], 2029: [3, 1], 2030: [3, 21], 2031: [3, 13], 2032: [2, 28],
};

const dayNo = (y: number, m: number, d: number) => Date.UTC(y, m, d) / 86_400_000;
/** Within `before` days before and `after` days after the date. */
const near = (p: ReturnType<typeof manilaParts>, md: [number, number] | undefined, before: number, after: number) => {
  if (!md) return false;
  const diff = dayNo(p.year, p.month, p.day) - dayNo(p.year, md[0], md[1]);
  return diff >= -before && diff <= after;
};

export const HOLIDAYS: readonly Holiday[] = [
  {
    id: "newyear", name: "New Year", when: "Dec 31 – Jan 1",
    looks: "A big Happy New Year banner across the street, gold and silver bunting and globe lanterns, the media noche table out front with twelve round fruits and torotot, a fruit stand at the sari-sari, confetti and fireworks over the town, a big barrage at midnight",
    swatch: ["#facc15", "#e5e7eb", "#f97316"], previewAt: "23:58",
    on: (p) => (p.month === 11 && p.day === 31) || (p.month === 0 && p.day === 1),
    first: () => [11, 31],
    decor: { ornament: null, bunting: ["#facc15", "#e5e7eb", "#f59e0b"], acrossStreet: true, fireworks: null /* Holidays.tsx runs the midnight show */, extras: "newyear" },
  },
  {
    id: "lunar", name: "Chinese New Year", when: "Lunar New Year (Jan–Feb)",
    looks: "Strings of big red lanterns across the street, red lanterns and gold 福 diamonds at every shop and gate, red and gold bunting, a dragon dance winding down the street with its drum and cymbals, fireworks at night",
    swatch: ["#dc2626", "#facc15", "#991b1b"], previewAt: "19:30",
    on: (p) => near(p, LUNAR[p.year], 1, 1),
    first: (y) => LUNAR[y] ?? null,
    decor: { ornament: "lantern", bunting: ["#dc2626", "#facc15"], acrossStreet: false /* Lunar.tsx strings lanterns there */, fireworks: [19, 22], extras: "lunar" },
  },
  {
    id: "valentines", name: "Valentine's Day", when: "Feb 14",
    looks: "Hearts at every shop and gate, heart garlands across the street, heart balloons bobbing out front, a lit heart frame in the park",
    swatch: ["#ec4899", "#ef4444", "#fbcfe8"], previewAt: "17:30",
    on: (p) => p.month === 1 && p.day >= 13 && p.day <= 14,
    first: () => [1, 13],
    decor: { ornament: "heart", bunting: ["#ec4899", "#ef4444", "#fbcfe8"], acrossStreet: false, fireworks: null, extras: "valentine" },
  },
  {
    id: "holyweek", name: "Holy Week", when: "Maundy Thursday – Easter Sunday",
    looks: "The penitensya: hooded penitents with whips and wooden crosses walking behind the carroza of the Santo Entierro, devotees with candles, purple and white bunting, a pabasa by the hall",
    swatch: ["#7c3aed", "#f5f5f4", "#facc15"], previewAt: "17:40",
    on: (p) => near(p, EASTER[p.year], 3, 0),
    first: (y) => { const e = EASTER[y]; if (!e) return null; const d = new Date(Date.UTC(y, e[0], e[1] - 3)); return [d.getUTCMonth(), d.getUTCDate()]; },
    decor: { ornament: "candle", bunting: ["#7c3aed", "#f5f5f4"], acrossStreet: false, fireworks: null, extras: "penitensya" },
  },
  {
    id: "fiesta", name: "Flores de Mayo fiesta", when: "May",
    looks: "Colourful banderitas across the street and along every shop, the barangay fiesta",
    swatch: ["#22c55e", "#3b82f6", "#f43f5e"], previewAt: "10:30",
    on: (p) => p.month === 4 && p.day < 28,
    first: () => [4, 1],
    decor: { ornament: null, bunting: ["#ef4444", "#facc15", "#22c55e", "#3b82f6", "#ec4899", "#f97316"], acrossStreet: true, fireworks: null },
  },
  {
    id: "flags", name: "Independence Day", when: "Flag days May 28 – June 30, Araw ng Kalayaan June 12",
    looks: "Philippine flags at every shop and gate, blue, red and yellow bunting, fireworks on the 12th",
    swatch: ["#1d4ed8", "#dc2626", "#facc15"], previewAt: "19:45",
    on: (p) => (p.month === 4 && p.day >= 28) || p.month === 5,
    first: () => [4, 28],
    decor: { ornament: "flag", bunting: ["#1d4ed8", "#f8fafc", "#dc2626", "#facc15"], acrossStreet: true, fireworks: [19, 21] },
  },
  {
    id: "undas", name: "Halloween and Undas", when: "Oct 31 – Nov 2",
    looks: "Carved jack-o'-lanterns glowing at every gate, on the shop steps and along the office front, orange and purple string lights, cobwebs in the corners, sheet ghosts floating over the yards, bats round the street lamps after dark, kids in costume trick-or-treating shop to shop; for Undas, candles and chrysanthemums at the gates, a flower and candle stall, a family walking to the cemetery with flowers",
    swatch: ["#f97316", "#7c3aed", "#facc15"], previewAt: "19:30",
    on: (p) => (p.month === 9 && p.day === 31) || (p.month === 10 && p.day <= 2),
    first: () => [9, 31],
    decor: { ornament: "pumpkin", bunting: null, acrossStreet: false, fireworks: null, extras: "halloween" },
  },
  {
    id: "christmas", name: "Pasko (Christmas season)", when: "The ber months: Sept 16 – Jan 6",
    looks: "Parols at every gate and shop, chasing Christmas lights, a tree in the lounge",
    swatch: ["#ef4444", "#22c55e", "#facc15"], previewAt: "19:30",
    on: (p) => (p.month === 8 && p.day >= 16) || p.month === 9 || p.month === 10 || p.month === 11 || (p.month === 0 && p.day <= 6),
    first: () => [8, 16],
    decor: null, // Holidays.tsx draws Christmas
  },
];

export const holidayById = (id: HolidayId): Holiday => HOLIDAYS.find((h) => h.id === id)!;

/** The holidays on at this moment (Christmas can overlap another one, e.g. Undas). */
export function holidaysOn(d: Date): Holiday[] {
  const p = manilaParts(d);
  return HOLIDAYS.filter((h) => h.on(p));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Today", or the next first day, e.g. "Feb 17". */
export function nextLabel(h: Holiday, now: Date): string {
  const p = manilaParts(now);
  if (h.on(p)) return "On now";
  const today = dayNo(p.year, p.month, p.day);
  for (const y of [p.year, p.year + 1]) {
    const f = h.first(y);
    if (f && dayNo(y, f[0], f[1]) >= today) return `${MONTHS[f[0]]} ${f[1]}${y !== p.year ? `, ${y}` : ""}`;
  }
  return "";
}

/** Preview a holiday's look right now (Settings → Holidays). Not saved: a reload goes back to the calendar. */
export const useHolidayPreview = create<{ id: HolidayId | null }>(() => ({ id: null }));

/** The holidays to draw: the previewed one, or what the calendar says. */
export function activeHolidays(d: Date, preview: HolidayId | null): Holiday[] {
  return preview ? [holidayById(preview)] : holidaysOn(d);
}
