// Multi-source weather fetching with confidence scoring.
// Primary: Open-Meteo (no key). Secondary: National Weather Service (US only, no key).
// We compare today's high/low/rain to compute a confidence rating.

import type {
  ForecastBundle,
  DailyForecast,
  HourlyPoint,
  CurrentWeather,
  Confidence,
} from "./types";

// ---- Open-Meteo (primary) -------------------------------------------------

async function fetchOpenMeteo(lat: number, lon: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,is_day` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7`;
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

  // Trim hourly to next 24h from "now".
  const now = Date.now();
  const hourly: HourlyPoint[] = (j.hourly.time as string[])
    .map((t, i) => ({
      time: t,
      rainChance: j.hourly.precipitation_probability?.[i] ?? 0,
      temp: j.hourly.temperature_2m?.[i],
      feelsLike: j.hourly.apparent_temperature?.[i],
      weatherCode: j.hourly.weather_code?.[i],
    }))
    .filter((h) => {
      const t = new Date(h.time).getTime();
      return t >= now - 30 * 60 * 1000 && t <= now + 24 * 3600 * 1000;
    });

  return { current, daily, hourly };
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
  // Run both sources in parallel; tolerate failure of secondary.
  const [om, nws] = await Promise.all([
    fetchOpenMeteo(lat, lon),
    fetchNws(lat, lon),
  ]);

  const today = om.daily[0];
  const sources = ["Open-Meteo"];
  if (nws) sources.push("NWS");

  const confidence = scoreConfidence(
    { high: today.high, low: today.low, rain: today.rainChance },
    nws,
  );

  // Blend high/low slightly toward NWS when available (averaged forecast).
  const blendedDaily = om.daily.map((d, i) => {
    if (i !== 0 || !nws) return d;
    return {
      ...d,
      high: nws.highF !== undefined ? Math.round((d.high + nws.highF) / 2) : d.high,
      low: nws.lowF !== undefined ? Math.round((d.low + nws.lowF) / 2) : d.low,
      rainChance:
        nws.rainPct !== undefined ? Math.round((d.rainChance + nws.rainPct) / 2) : d.rainChance,
    };
  });

  return {
    current: om.current,
    today: blendedDaily[0],
    daily: blendedDaily,
    hourly: om.hourly,
    alerts: nws?.alerts ?? [],
    confidence,
    sources,
    updatedAt: Date.now(),
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