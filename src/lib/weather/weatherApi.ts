// Multi-source weather fetching with metric-level source transparency.
// Primary display source: Open-Meteo. Fallback display source: Pirate Weather.
// Metric values are averaged when multiple providers return usable data.

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
import { forecastDateLocalKey, localDateKey } from "./weatherUtils";
import {
  buildMetric,
  buildSourceDetails,
  CONFLICT_THRESHOLDS,
} from "./sourceTransparency";

const OPEN_METEO = "Open-Meteo";
const PIRATE = "Pirate Weather";
const WEATHER_GOV = "Weather.gov";

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

    const today = periods[0];
    const dayPeriod = periods.find((p) => p.isDaytime);
    const nightPeriod = periods.find((p) => !p.isDaytime);
    const highF = dayPeriod?.temperature ?? today?.temperature;
    const lowF = nightPeriod?.temperature;
    const rainPct = (dayPeriod ?? today)?.probabilityOfPrecipitation?.value ?? undefined;

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

// ---- Public API -----------------------------------------------------------

export async function fetchForecast(lat: number, lon: number): Promise<ForecastBundle> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [omRes, nws, pirateRes] = await Promise.all([
    fetchOpenMeteo(lat, lon).catch(() => null),
    fetchNws(lat, lon),
    fetchPirateWeather({ data: { lat, lon, tz } }).catch(() => null as PirateNormalized | null),
  ]);

  const pirateHasCurrent = !!pirateRes?.current;
  const pirateHasDaily = !!pirateRes?.daily?.length;
  const pirateHasHourly = !!pirateRes?.hourly?.length;
  const pirateUsable = pirateHasCurrent || pirateHasDaily || pirateHasHourly;

  let currentBase: CurrentWeather;
  let dailyBase: DailyForecast[];
  let fullHourlyBase: HourlyPoint[];

  if (omRes) {
    currentBase = omRes.current;
    dailyBase = omRes.daily;
    fullHourlyBase = omRes.fullHourly;
  } else if (pirateRes && pirateRes.current && pirateRes.daily.length) {
    currentBase = {
      temp: pirateRes.current.temp,
      feelsLike: pirateRes.current.feelsLike,
      weatherCode: pirateRes.current.weatherCode,
      isDay: pirateRes.current.isDay,
    };
    dailyBase = pirateRes.daily.map((d) => ({
      date: d.date,
      high: d.high,
      low: d.low,
      feelsHigh: d.feelsHigh,
      rainChance: d.rainChance,
      weatherCode: 1,
    }));
    fullHourlyBase = pirateRes.hourly.map((h) => ({
      time: h.time,
      rainChance: h.rainChance,
      temp: h.temp,
      feelsLike: h.feelsLike,
      uvIndex: h.uvIndex,
    }));
  } else {
    throw new Error("All forecast providers failed");
  }

  const todayBase = dailyBase[0];
  const todayPirate = pirateRes?.daily?.find(
    (d) => forecastDateLocalKey(d.date) === forecastDateLocalKey(todayBase.date),
  ) ?? pirateRes?.daily?.[0];

  const currentTempMetric = buildMetric({
    metricName: "Current temperature",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    values: {
      [OPEN_METEO]: omRes?.current.temp,
      [PIRATE]: pirateRes?.current?.temp,
    },
  });
  const feelsLikeMetric = buildMetric({
    metricName: "Feels-like temperature",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    values: {
      [OPEN_METEO]: omRes?.current.feelsLike,
      [PIRATE]: pirateRes?.current?.feelsLike,
    },
  });
  const dailyHighMetric = buildMetric({
    metricName: "Daily high",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    values: {
      [OPEN_METEO]: todayBase.high,
      [PIRATE]: todayPirate?.high,
      [WEATHER_GOV]: nws?.highF,
    },
  });
  const dailyLowMetric = buildMetric({
    metricName: "Daily low",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    values: {
      [OPEN_METEO]: todayBase.low,
      [PIRATE]: todayPirate?.low,
      [WEATHER_GOV]: nws?.lowF,
    },
  });
  const rainChanceMetric = buildMetric({
    metricName: "Rain chance",
    conflictThreshold: CONFLICT_THRESHOLDS.rainChance,
    values: {
      [OPEN_METEO]: todayBase.rainChance,
      [PIRATE]: todayPirate?.rainChance,
      [WEATHER_GOV]: nws?.rainPct,
    },
  });

  const mergedHourly = mergeHourly(fullHourlyBase, pirateRes?.hourly ?? [], !!omRes);
  const firstHourly = mergedHourly.find((h) => new Date(h.time).getTime() >= Date.now() - 30 * 60 * 1000);
  const hourlyOpen = omRes?.fullHourly.find((h) => h.time === firstHourly?.time);
  const hourlyPirate = pirateRes?.hourly.find((h) => h.time === firstHourly?.time);

  const hourlyTempMetric = buildMetric({
    metricName: "Hourly temperature",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    values: {
      [OPEN_METEO]: hourlyOpen?.temp,
      [PIRATE]: hourlyPirate?.temp,
    },
  });
  const hourlyFeelsLikeMetric = buildMetric({
    metricName: "Hourly feels-like temperature",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    values: {
      [OPEN_METEO]: hourlyOpen?.feelsLike,
      [PIRATE]: hourlyPirate?.feelsLike,
    },
  });
  const hourlyRainChanceMetric = buildMetric({
    metricName: "Hourly precipitation chance",
    conflictThreshold: CONFLICT_THRESHOLDS.rainChance,
    values: {
      [OPEN_METEO]: hourlyOpen?.rainChance,
      [PIRATE]: hourlyPirate?.rainChance,
    },
  });
  const uvIndexMetric = buildMetric({
    metricName: "UV index",
    conflictThreshold: CONFLICT_THRESHOLDS.uvIndex,
    values: {
      [OPEN_METEO]: firstHourly?.uvIndex,
      [PIRATE]: hourlyPirate?.uvIndex,
    },
  });
  const alertsMetric = buildMetric({
    metricName: "Weather alerts",
    conflictThreshold: 1,
    values: {
      [WEATHER_GOV]: nws ? (nws.alerts?.length ?? 0) : undefined,
    },
  });

  const sourceDetails = buildSourceDetails({
    providersResponded: [
      ...(omRes ? [OPEN_METEO] : []),
      ...(pirateUsable ? [PIRATE] : []),
      ...(nws ? [WEATHER_GOV] : []),
    ],
    metrics: {
      currentTemp: currentTempMetric,
      feelsLike: feelsLikeMetric,
      dailyHigh: dailyHighMetric,
      dailyLow: dailyLowMetric,
      rainChance: rainChanceMetric,
      hourlyTemperature: hourlyTempMetric,
      hourlyFeelsLike: hourlyFeelsLikeMetric,
      hourlyPrecipitationChance: hourlyRainChanceMetric,
      uvIndex: uvIndexMetric,
      weatherAlerts: alertsMetric,
    },
    alertsSource: nws ? WEATHER_GOV : undefined,
  });

  const current: CurrentWeather = {
    ...currentBase,
    temp: currentTempMetric.value ?? currentBase.temp,
    feelsLike: feelsLikeMetric.value ?? currentBase.feelsLike,
  };

  const blendedDaily = dailyBase.map((d, i) => {
    const pirateDay = pirateRes?.daily?.find(
      (p) => forecastDateLocalKey(p.date) === forecastDateLocalKey(d.date),
    );
    const highMetric = buildMetric({
      metricName: "Daily high",
      conflictThreshold: CONFLICT_THRESHOLDS.temperature,
      values: {
        [OPEN_METEO]: omRes ? d.high : undefined,
        [PIRATE]: pirateDay?.high,
        [WEATHER_GOV]: i === 0 ? nws?.highF : undefined,
      },
    });
    const lowMetric = buildMetric({
      metricName: "Daily low",
      conflictThreshold: CONFLICT_THRESHOLDS.temperature,
      values: {
        [OPEN_METEO]: omRes ? d.low : undefined,
        [PIRATE]: pirateDay?.low,
        [WEATHER_GOV]: i === 0 ? nws?.lowF : undefined,
      },
    });
    const feelsHighMetric = buildMetric({
      metricName: "Feels-like daily high",
      conflictThreshold: CONFLICT_THRESHOLDS.temperature,
      values: {
        [OPEN_METEO]: omRes ? d.feelsHigh : undefined,
        [PIRATE]: pirateDay?.feelsHigh,
      },
    });
    const rainMetric = buildMetric({
      metricName: "Rain chance",
      conflictThreshold: CONFLICT_THRESHOLDS.rainChance,
      values: {
        [OPEN_METEO]: omRes ? d.rainChance : undefined,
        [PIRATE]: pirateDay?.rainChance,
        [WEATHER_GOV]: i === 0 ? nws?.rainPct : undefined,
      },
    });

    return {
      ...d,
      high: highMetric.value ?? d.high,
      low: lowMetric.value ?? d.low,
      feelsHigh: feelsHighMetric.value ?? d.feelsHigh,
      rainChance: rainMetric.value ?? d.rainChance,
    };
  });

  const dailyWithPeriods = blendedDaily.map((d) => ({
    ...d,
    periods: computePeriods(d.date, mergedHourly),
  }));

  const now = Date.now();
  const hourly = mergedHourly.filter((h) => {
    const t = new Date(h.time).getTime();
    return t >= now - 30 * 60 * 1000 && t <= now + 24 * 3600 * 1000;
  });

  const sources = sourceDetails.providersResponded;
  const confidence = legacyConfidence(sourceDetails.varyingMetrics.length, sources.length);

  return {
    current,
    today: dailyWithPeriods[0],
    daily: dailyWithPeriods,
    hourly,
    alerts: nws?.alerts ?? [],
    confidence,
    sources,
    sourceDetails,
    updatedAt: Date.now(),
  };
}

function legacyConfidence(varyingMetricCount: number, sourceCount: number): Confidence {
  if (sourceCount < 2) return "moderate";
  return varyingMetricCount > 0 ? "low" : "high";
}

// ---- Hourly merge + period computation -----------------------------------

function mergeHourly(
  primary: HourlyPoint[],
  pirate: PirateNormalized["hourly"],
  primaryIsOpenMeteo: boolean,
): HourlyPoint[] {
  if (!pirate.length) return primary;
  const byTime = new Map<string, HourlyPoint>();
  for (const h of primary) byTime.set(h.time, h);
  for (const p of pirate) {
    const existing = byTime.get(p.time);
    if (existing) {
      const tempMetric = buildMetric({
        metricName: "Hourly temperature",
        conflictThreshold: CONFLICT_THRESHOLDS.temperature,
        values: {
          [OPEN_METEO]: primaryIsOpenMeteo ? existing.temp : undefined,
          [PIRATE]: p.temp,
        },
      });
      const feelsMetric = buildMetric({
        metricName: "Hourly feels-like temperature",
        conflictThreshold: CONFLICT_THRESHOLDS.temperature,
        values: {
          [OPEN_METEO]: primaryIsOpenMeteo ? existing.feelsLike : undefined,
          [PIRATE]: p.feelsLike,
        },
      });
      const rainMetric = buildMetric({
        metricName: "Hourly precipitation chance",
        conflictThreshold: CONFLICT_THRESHOLDS.rainChance,
        values: {
          [OPEN_METEO]: primaryIsOpenMeteo ? existing.rainChance : undefined,
          [PIRATE]: p.rainChance,
        },
      });
      const uvMetric = buildMetric({
        metricName: "UV index",
        conflictThreshold: CONFLICT_THRESHOLDS.uvIndex,
        values: {
          [OPEN_METEO]: primaryIsOpenMeteo ? existing.uvIndex : undefined,
          [PIRATE]: p.uvIndex,
        },
      });

      existing.temp = tempMetric.value ?? existing.temp ?? p.temp;
      existing.feelsLike = feelsMetric.value ?? existing.feelsLike ?? p.feelsLike;
      existing.rainChance = rainMetric.value ?? existing.rainChance ?? p.rainChance;
      existing.uvIndex = uvMetric.value ?? existing.uvIndex ?? p.uvIndex;
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
  name: string;
  city: string;
  region?: string;
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
