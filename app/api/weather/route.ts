import { NextResponse } from "next/server";
import { z } from "zod";
import { currentOwner } from "@/lib/auth";

/**
 * Current weather in Mabalacat City, Pampanga for the office windows, from Open-Meteo (free, no key).
 * Cached for 15 minutes, so every viewer shares one upstream request.
 */
export const dynamic = "force-dynamic";
const REVALIDATE_S = 900;

/** Mabalacat City, Pampanga. */
const MABALACAT = { lat: 15.2228, lon: 120.5744 };
const Upstream = z.object({
  current: z.object({ weather_code: z.number(), temperature_2m: z.number().nullable().optional() }),
});

/** WMO weather code → what the windows show. */
function kindOf(code: number): "clear" | "cloudy" | "rain" | "storm" {
  if (code >= 95) return "storm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 2) return "cloudy";
  return "clear";
}

export async function GET() {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${MABALACAT.lat}&longitude=${MABALACAT.lon}&current=weather_code,temperature_2m&timezone=Asia%2FManila`;
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE_S } });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const data = Upstream.parse(await res.json());
    return NextResponse.json({ kind: kindOf(data.current.weather_code), tempC: data.current.temperature_2m ?? null });
  } catch (e) {
    console.warn("weather:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Weather is unavailable right now." }, { status: 502 });
  }
}
