import { NextResponse } from "next/server";
import { z } from "zod";
import { currentOwner } from "@/lib/auth";
import { HQ } from "@/hq.config";

/**
 * Current weather at the office (hq.config.ts → city; Mabalacat City, Pampanga by default), from Open-Meteo
 * (free, no key). Cached for 10 minutes, so every viewer shares one upstream request.
 *
 * Accuracy: the WMO "weather code" alone is a coarse model guess for the hour (it often says "overcast" or
 * "rain showers" when it's actually sunny, or misses a passing shower), so the kind of weather is decided from
 * the measured-style fields instead: precipitation over the last and current 15 minutes, cloud cover, and
 * thunderstorm codes. The label says exactly what was decided, e.g. "Partly cloudy · 31°C".
 */
export const dynamic = "force-dynamic";
const REVALIDATE_S = 600;

const Upstream = z.object({
  current: z.object({
    time: z.string().optional(),
    weather_code: z.number(),
    temperature_2m: z.number().nullable().optional(),
    apparent_temperature: z.number().nullable().optional(),
    precipitation: z.number().nullable().optional(),
    cloud_cover: z.number().nullable().optional(),
    is_day: z.number().nullable().optional(),
  }),
  minutely_15: z.object({
    time: z.array(z.string()),
    precipitation: z.array(z.number().nullable()),
  }).optional(),
});

type Kind = "clear" | "partly" | "cloudy" | "rain" | "storm";

/** Decide what the office shows from the current conditions. */
function decide(c: z.infer<typeof Upstream>["current"], recentRain: number): { kind: Kind; label: string } {
  const code = c.weather_code;
  const rain = Math.max(c.precipitation ?? 0, recentRain);
  const cloud = c.cloud_cover ?? (code >= 3 ? 90 : code === 2 ? 50 : code === 1 ? 20 : 5);
  if (code >= 95) return { kind: "storm", label: code >= 96 ? "Thunderstorm with hail" : "Thunderstorm" };
  if (rain >= 0.1) {
    if (rain >= 2.5) return { kind: "rain", label: "Heavy rain" };
    if (rain >= 0.6) return { kind: "rain", label: "Rain" };
    return { kind: "rain", label: code >= 51 && code <= 57 ? "Drizzle" : "Light rain" };
  }
  if (code === 45 || code === 48) return { kind: "cloudy", label: "Foggy" };
  if (cloud >= 80) return { kind: "cloudy", label: "Overcast" };
  if (cloud >= 55) return { kind: "cloudy", label: "Mostly cloudy" };
  if (cloud >= 25) return { kind: "partly", label: "Partly cloudy" };
  return { kind: "clear", label: c.is_day === 0 ? "Clear night" : cloud >= 10 ? "Mostly sunny" : "Sunny" };
}

/** Rain (mm) over the last 15 minutes and the current quarter-hour, from the 15-minute series. */
function recentPrecipitation(m: z.infer<typeof Upstream>["minutely_15"], nowIso: string | undefined): number {
  if (!m || !nowIso) return 0;
  const now = Date.parse(`${nowIso}:00+08:00`);
  let total = 0;
  m.time.forEach((t, i) => {
    const at = Date.parse(`${t}:00+08:00`);
    // the quarter-hour that just ended and the one in progress
    if (Number.isFinite(now) && at >= now - 15 * 60_000 && at <= now + 15 * 60_000) total = Math.max(total, m.precipitation[i] ?? 0);
  });
  return total;
}

export async function GET() {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const { lat, lon } = HQ.city;
  const url = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${lat}&longitude=${lon}&timezone=Asia%2FManila`
    + "&current=weather_code,temperature_2m,apparent_temperature,precipitation,cloud_cover,is_day"
    + "&minutely_15=precipitation&past_minutely_15=2&forecast_minutely_15=2";
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE_S }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const data = Upstream.parse(await res.json());
    const { kind, label } = decide(data.current, recentPrecipitation(data.minutely_15, data.current.time));
    return NextResponse.json({
      kind,
      label,
      tempC: data.current.temperature_2m ?? null,
      feelsC: data.current.apparent_temperature ?? null,
      cloud: data.current.cloud_cover ?? null,
      at: data.current.time ?? null,
    });
  } catch (e) {
    console.warn("weather:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Weather is unavailable right now." }, { status: 502 });
  }
}
