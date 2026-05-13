// Multi-source weather fetching with confidence scoring.
// Primary: Open-Meteo (no key). Secondary: National Weather Service (US only, no key).
// We compare today's high/low/rain to compute a confidence rating.

import type {
  ForecastBundle,
  DailyForecast,
  HourlyPoint,
  CurrentWeather,
  Confidence,
  DayPeriods,
  PeriodSummary,
} from "./types";
import { fetchPirateWeather, type PirateNormalized } from "./pirate.functions";
import { forecastDateLocalKey, localDateKey, parseForecastDateLocal } from "./weatherUtils";

// ---- Open-Meteo (primary) -------------------------------------------------

async function fetchOpenMeteo(lat: number, lon: number) {
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "auto";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,is_day` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=${encodeURIComponent(deviceTimeZone)}&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Open-Meteo failed");
  const j = await res.json();

  const current: CurrentWeather = {
    temp: j.current.temperature_2m,
    feelsLike: j.current.apparent_temperature,
    weatherCode: j.current.weather_code,
    isDay: j.current.is_day === 1,
  };

  const daily: DailyForecast[] = j.daily.time.map((d: string, i: number) => ({
    date: d,
    high: j.daily.temperature_2m_max[i],
    low: j.daily.temperature_2m_min[i],
    feelsHigh: j.daily.apparent_temperature_max[i],
    rainChance: j.daily.precipitation_probability_max[i] ?? 0,
    weatherCode: j.daily.weather_code[i],
  }));

  // Full hourly array for the 7-day window (used for period calculations).
  const fullHourly: HourlyPoint[] = (j.hourly.time as string[]).map((t, i) => ({
    time: t,
    rainChance: j.hourly.precipitation_probability?.[i] ?? 0,
    temp: j.hourly.temperature_2m?.[i],
    feelsLike: j.hourly.apparent_temperature?.[i],
    weatherCode: j.hourly.weather_code?.[i],
    uvIndex: j.hourly.uv_index?.[i],
  }));

  return { current, daily, fullHourly };
}

// ---- National Weather Service (secondary, US only) ------------------------

interface NwsSummary {
  highF?: number;
  lowF?: number;
  rainPct?: number;
  alerts: string[];
}

async function fetchNws(lat: number, lon: number): Promise<NwsSummary | null> {
  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: { Accept: "application/geo+json" },
    });
    if (!pointRes.ok) return null;
    const point = await pointRes.json();
    const forecastUrl: string | undefined = point?.properties?.forecast;
    if (!forecastUrl) return null;
    const fcRes = await fetch(forecastUrl, { headers: { Accept: "application/geo+json" } });
    if (!fcRes.ok) return null;
    const fc = await fcRes.json();
    const periods: Array<{
      isDaytime: boolean;
      temperature: number;
      probabilityOfPrecipitation?: { value: number | null };
      shortForecast: string;
    }> = fc?.properties?.periods ?? [];

    // Today: first daytime period high, first nighttime low (next 36h roughly).
    const today = periods[0];
    const dayPeriod = periods.find((p) => p.isDaytime);
    const nightPeriod = periods.find((p) => !p.isDaytime);
    const highF = dayPeriod?.temperature ?? today?.temperature;
    const lowF = nightPeriod?.temperature;
    const rainPct = (dayPeriod ?? today)?.probabilityOfPrecipitation?.value ?? undefined;

    // Severe alerts.
    let alerts: string[] = [];
    try {
      const aRes = await fetch(
        `https://api.weather.gov/alerts/active?point=${lat},${lon}`,
        { headers: { Accept: "application/geo+json" } },
      );
      if (aRes.ok) {
        const aj = await aRes.json();
        alerts = (aj?.features ?? [])
          .map((f: any) => f?.properties?.headline as string)
          .filter(Boolean)
          .slice(0, 3);
      }
    } catch { /* ignore */ }

    return { highF, lowF, rainPct: rainPct ?? undefined, alerts };
  } catch {
    return null;
  }
}

// ---- Confidence calculation -----------------------------------------------

function scoreConfidence(
  primary: { high: number; low: number; rain: number },
  secondary: { highF?: number; lowF?: number; rainPct?: number } | null,
): Confidence {
  if (!secondary) return "moderate"; // only one source available
  const tempDiff = Math.max(
    secondary.highF !== undefined ? Math.abs(primary.high - secondary.highF) : 0,
    secondary.lowF !== undefined ? Math.abs(primary.low - secondary.lowF) : 0,
  );
  const rainDiff =
    secondary.rainPct !== undefined ? Math.abs(primary.rain - secondary.rainPct) : 0;
  if (tempDiff <= 3 && rainDiff <= 15) return "high";
  if (tempDiff <= 7 && rainDiff <= 30) return "moderate";
  return "low";
}

// ---- Public API -----------------------------------------------------------

export async function fetchForecast(lat: number, lon: number): Promise<ForecastBundle> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  // Run all providers in parallel; Pirate Weather and NWS are tolerated to fail.
  const [omRes, nws, pirateRes] = await Promise.all([
    fetchOpenMeteo(lat, lon).catch(() => null),
    fetchNws(lat, lon),
    fetchPirateWeather({ data: { lat, lon, tz } }).catch(() => null as PirateNormalized | null),
  ]);

  // Open-Meteo is primary; if it fails, fall back to Pirate Weather as primary.
  let current: CurrentWeather;
  let daily: DailyForecast[];
  let fullHourly: HourlyPoint[];
  const sources: string[] = [];

  if (omRes) {
    current = omRes.current;
    daily = omRes.daily;
    fullHourly = omRes.fullHourly;
    sources.push("Open-Meteo");
  } else if (pirateRes && pirateRes.current && pirateRes.daily.length) {
    current = {
      temp: pirateRes.current.temp,
      feelsLike: pirateRes.current.feelsLike,
      weatherCode: pirateRes.current.weatherCode,
      isDay: pirateRes.current.isDay,
    };
    daily = pirateRes.daily.map((d) => ({
      date: d.date,
      high: d.high,
      low: d.low,
      feelsHigh: d.feelsHigh,
      rainChance: d.rainChance,
      weatherCode: 1,
    }));
    fullHourly = pirateRes.hourly.map((h) => ({
      time: h.time,
      rainChance: h.rainChance,
      temp: h.temp,
      feelsLike: h.feelsLike,
      uvIndex: h.uvIndex,
    }));
  } else {
    throw new Error("All forecast providers failed");
  }
  if (nws) sources.push("Weather.gov");
  const pirateUsable =
    !!pirateRes && (pirateRes.daily.length > 0 || pirateRes.hourly.length > 0);
  if (pirateUsable && omRes) sources.push("Pirate Weather");

  // Confidence: compare today's high/low/rain across whatever providers responded.
  const todayBase = daily[0];
  const todayPirate = pirateRes?.daily[0];
  const confidence: Confidence = computeConfidence(
    { high: todayBase.high, low: todayBase.low, rain: todayBase.rainChance },
    nws,
    todayPirate ?? null,
    sources.length,
  );

  // Blend NWS into today's daily when available (US only).
  const blendedDaily = daily.map((d, i) => {
    if (i !== 0 || !nws) return d;
    return {
      ...d,
      high: nws.highF !== undefined ? Math.round((d.high + nws.highF) / 2) : d.high,
      low: nws.lowF !== undefined ? Math.round((d.low + nws.lowF) / 2) : d.low,
      rainChance:
        nws.rainPct !== undefined ? Math.round((d.rainChance + nws.rainPct) / 2) : d.rainChance,
    };
  });

  // Fill any missing-day hourly gaps from Pirate Weather, then compute periods.
  const mergedHourly = mergeHourly(fullHourly, pirateRes?.hourly ?? []);
  const dailyWithPeriods = blendedDaily.map((d) => ({
    ...d,
    periods: computePeriods(d.date, mergedHourly),
  }));

  // Trim hourly to next ~24h for the existing HourlyForecast component.
  const now = Date.now();
  const hourly = mergedHourly.filter((h) => {
    const t = new Date(h.time).getTime();
    return t >= now - 30 * 60 * 1000 && t <= now + 24 * 3600 * 1000;
  });

  return {
    current,
    today: dailyWithPeriods[0],
    daily: dailyWithPeriods,
    hourly,
    alerts: nws?.alerts ?? [],
    confidence,
    sources,
    updatedAt: Date.now(),
  };
}

// ---- Confidence (multi-provider) -----------------------------------------

function computeConfidence(
  primary: { high: number; low: number; rain: number },
  nws: NwsSummary | null,
  pirate: { high: number; low: number; rainChance: number } | null,
  sourceCount: number,
): Confidence {
  if (sourceCount < 2) return "moderate";
  const tempDiffs: number[] = [];
  const rainDiffs: number[] = [];
  if (nws) {
    if (nws.highF !== undefined) tempDiffs.push(Math.abs(primary.high - nws.highF));
    if (nws.lowF !== undefined) tempDiffs.push(Math.abs(primary.low - nws.lowF));
    if (nws.rainPct !== undefined) rainDiffs.push(Math.abs(primary.rain - nws.rainPct));
  }
  if (pirate) {
    tempDiffs.push(Math.abs(primary.high - pirate.high));
    tempDiffs.push(Math.abs(primary.low - pirate.low));
    rainDiffs.push(Math.abs(primary.rain - pirate.rainChance));
  }
  const tempDiff = tempDiffs.length ? Math.max(...tempDiffs) : 0;
  const rainDiff = rainDiffs.length ? Math.max(...rainDiffs) : 0;
  if (tempDiff <= 3 && rainDiff <= 15) return "high";
  if (tempDiff <= 7 && rainDiff <= 30) return "moderate";
  return "low";
}

// ---- Hourly merge + period computation -----------------------------------

function mergeHourly(primary: HourlyPoint[], pirate: PirateNormalized["hourly"]): HourlyPoint[] {
  if (!pirate.length) return primary;
  const byTime = new Map<string, HourlyPoint>();
  for (const h of primary) byTime.set(h.time, h);
  for (const p of pirate) {
    const existing = byTime.get(p.time);
    if (existing) {
      // Fill missing fields only.
      if (existing.temp === undefined && p.temp !== undefined) existing.temp = p.temp;
      if (existing.feelsLike === undefined && p.feelsLike !== undefined)
        existing.feelsLike = p.feelsLike;
      if (existing.uvIndex === undefined && p.uvIndex !== undefined)
        existing.uvIndex = p.uvIndex;
    } else {
      byTime.set(p.time, {
        time: p.time,
        rainChance: p.rainChance,
        temp: p.temp,
        feelsLike: p.feelsLike,
        uvIndex: p.uvIndex,
      });
    }
  }
  return Array.from(byTime.values()).sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );
}

function periodForHour(h: number): "morning" | "afternoon" | "evening" | null {
  if (h >= 6 && h <= 11) return "morning";
  if (h >= 12 && h <= 17) return "afternoon";
  if (h >= 18 && h <= 23) return "evening";
  return null;
}

function computePeriods(dateValue: string, hourly: HourlyPoint[]): DayPeriods {
  const targetKey = forecastDateLocalKey(dateValue);
  const isToday = targetKey === localDateKey(new Date());
  const nowH = new Date().getHours();

  const buckets: Record<"morning" | "afternoon" | "evening", HourlyPoint[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const h of hourly) {
    const d = new Date(h.time);
    if (localDateKey(d) !== targetKey) continue;
    const hr = d.getHours();
    const p = periodForHour(hr);
    if (!p) continue;
    // For "today", only include hours from now onward.
    if (isToday && hr < nowH) continue;
    buckets[p].push(h);
  }

  return {
    morning: summarize(buckets.morning),
    afternoon: summarize(buckets.afternoon),
    evening: summarize(buckets.evening),
  };
}

function summarize(points: HourlyPoint[]): PeriodSummary {
  if (!points.length) return {};
  const temps = points.map((p) => p.temp).filter((v): v is number => v !== undefined);
  const feels = points.map((p) => p.feelsLike).filter((v): v is number => v !== undefined);
  const uvs = points.map((p) => p.uvIndex).filter((v): v is number => v !== undefined);
  const rains = points.map((p) => p.rainChance).filter((v): v is number => v !== undefined);
  return {
    tempMin: temps.length ? Math.round(Math.min(...temps)) : undefined,
    tempMax: temps.length ? Math.round(Math.max(...temps)) : undefined,
    feelsMin: feels.length ? Math.round(Math.min(...feels)) : undefined,
    feelsMax: feels.length ? Math.round(Math.max(...feels)) : undefined,
    rainPct: rains.length ? Math.max(...rains) : undefined,
    uvMin: uvs.length ? Math.round(Math.min(...uvs)) : undefined,
    uvMax: uvs.length ? Math.round(Math.max(...uvs)) : undefined,
  };
}

// ---- Geocoding (Open-Meteo) -----------------------------------------------

export interface GeocodeResult {
  name: string;        // formatted "City, Region"
  city: string;
  region?: string;     // state / admin1
  country?: string;
  lat: number;
  lon: number;
}

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const list = await searchLocations(query, 1);
  return list[0] ?? null;
}

export async function searchLocations(query: string, count = 6): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${count}&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const j = await res.json();
  const results: any[] = j?.results ?? [];
  return results.map((r) => {
    const region = r.admin1 ?? undefined;
    const name = region ? `${r.name}, ${region}` : r.country ? `${r.name}, ${r.country}` : r.name;
    return {
      name,
      city: r.name,
      region,
      country: r.country,
      lat: r.latitude,
      lon: r.longitude,
    };
  });
}

// ---- Reverse geocoding (BigDataCloud, no key) -----------------------------

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    const city = j.city || j.locality || j.principalSubdivision;
    const region = j.principalSubdivisionCode?.split("-")?.[1] || j.principalSubdivision || j.countryCode;
    if (!city) return null;
    return region && region !== city ? `${city}, ${region}` : city;
  } catch {
    return null;
  }
}