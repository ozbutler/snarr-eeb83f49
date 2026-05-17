// Multi-source weather fetching with metric-level source transparency.
// Primary display source: Open-Meteo. Fallback display source: Pirate Weather or MET Norway.
// Metric values are aggregated when multiple providers return usable data.

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
import { fetchMetNorwayForecast, type MetNorwayNormalized } from "./metNorway";
import { forecastDateLocalKey, localDateKey } from "./weatherUtils";
import {
  buildMetric,
  buildSourceDetails,
  CONFLICT_THRESHOLDS,
} from "./sourceTransparency";

const OPEN_METEO = "Open-Meteo";
const PIRATE = "Pirate Weather";
const WEATHER_GOV = "Weather.gov";
const MET_NORWAY = "MET Norway";

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

// ---- Provider normalization helpers ---------------------------------------

function pirateCurrent(pirateRes: PirateNormalized | null): CurrentWeather | undefined {
  if (!pirateRes?.current) return undefined;
  return {
    temp: pirateRes.current.temp,
    feelsLike: pirateRes.current.feelsLike,
    weatherCode: pirateRes.current.weatherCode,
    isDay: pirateRes.current.isDay,
  };
}

function pirateDaily(pirateRes: PirateNormalized | null): DailyForecast[] {
  return pirateRes?.daily?.map((d) => ({
    date: d.date,
    high: d.high,
    low: d.low,
    feelsHigh: d.feelsHigh,
    rainChance: d.rainChance,
    weatherCode: 1,
  })) ?? [];
}

function pirateHourly(pirateRes: PirateNormalized | null): HourlyPoint[] {
  return pirateRes?.hourly?.map((h) => ({
    time: h.time,
    rainChance: h.rainChance,
    temp: h.temp,
    feelsLike: h.feelsLike,
    uvIndex: h.uvIndex,
  })) ?? [];
}

function getDailyForDate(days: DailyForecast[] | undefined, date: string) {
  return days?.find((d) => forecastDateLocalKey(d.date) === forecastDateLocalKey(date));
}

function getHourlyForTime(points: HourlyPoint[] | undefined, time?: string) {
  if (!time) return undefined;
  return points?.find((h) => h.time === time);
}

function hasUsableCurrent(current?: CurrentWeather) {
  return Boolean(
    current &&
    Number.isFinite(current.temp) &&
    Number.isFinite(current.feelsLike),
  );
}

function hasUsableDaily(daily?: DailyForecast[]) {
  return Boolean(daily?.some((d) => Number.isFinite(d.high) && Number.isFinite(d.low)));
}

function hasUsableHourly(hourly?: HourlyPoint[]) {
  return Boolean(hourly?.some((h) => Number.isFinite(h.temp) || Number.isFinite(h.rainChance)));
}

function weatherCodeFromProviders(...values: Array<number | undefined>) {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? 1;
}

function isDayFromCurrent(...values: Array<boolean | undefined>) {
  return values.find((value) => typeof value === "boolean") ?? true;
}

// ---- Public API -----------------------------------------------------------

export async function fetchForecast(lat: number, lon: number): Promise<ForecastBundle> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [omRes, nws, pirateRes, metRes] = await Promise.all([
    fetchOpenMeteo(lat, lon).catch(() => null),
    fetchNws(lat, lon),
    fetchPirateWeather({ data: { lat, lon, tz } }).catch(() => null as PirateNormalized | null),
    fetchMetNorwayForecast(lat, lon).catch(() => null as MetNorwayNormalized | null),
  ]);

  const pirateHasCurrent = !!pirateRes?.current;
  const pirateHasDaily = !!pirateRes?.daily?.length;
  const pirateHasHourly = !!pirateRes?.hourly?.length;
  const pirateUsable = pirateHasCurrent || pirateHasDaily || pirateHasHourly;

  const metHasCurrent = hasUsableCurrent(metRes?.current);
  const metHasDaily = hasUsableDaily(metRes?.daily);
  const metHasHourly = hasUsableHourly(metRes?.hourly);
  const metUsable = metHasCurrent || metHasDaily || metHasHourly;

  const providersUsed = [
    ...(omRes ? [OPEN_METEO] : []),
    ...(pirateUsable ? [PIRATE] : []),
    ...(nws ? [WEATHER_GOV] : []),
    ...(metUsable ? [MET_NORWAY] : []),
  ];

  const providersFailed = [
    ...(!omRes ? [OPEN_METEO] : []),
    ...(!pirateUsable ? [PIRATE] : []),
    ...(!nws ? [WEATHER_GOV] : []),
    ...(!metUsable ? [MET_NORWAY] : []),
  ];

  console.log("Weather providers used:", providersUsed);
  console.log("Weather providers failed:", providersFailed);

  const currentOptions = [
    omRes?.current,
    pirateCurrent(pirateRes),
    metRes?.current,
  ].filter(hasUsableCurrent);

  const dailyOptions = [
    omRes?.daily,
    pirateDaily(pirateRes),
    metRes?.daily,
  ].filter(hasUsableDaily);

  const hourlyOptions = [
    omRes?.fullHourly,
    pirateHourly(pirateRes),
    metRes?.hourly,
  ].filter(hasUsableHourly);

  if (!currentOptions.length || !dailyOptions.length || !hourlyOptions.length) {
    throw new Error("All forecast providers failed");
  }

  const currentBase = currentOptions[0];
  const dailyBase = dailyOptions[0];
  const todayBase = dailyBase[0];
  const todayPirate = getDailyForDate(pirateDaily(pirateRes), todayBase.date) ?? pirateDaily(pirateRes)[0];
  const todayMet = getDailyForDate(metRes?.daily, todayBase.date) ?? metRes?.daily?.[0];

  const currentTempMetric = buildMetric({
    metricName: "Current temperature",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    aggregation: "auto",
    values: {
      [OPEN_METEO]: omRes?.current.temp,
      [PIRATE]: pirateRes?.current?.temp,
      [MET_NORWAY]: metRes?.current?.temp,
    },
  });
  const feelsLikeMetric = buildMetric({
    metricName: "Feels-like temperature",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    aggregation: "auto",
    values: {
      [OPEN_METEO]: omRes?.current.feelsLike,
      [PIRATE]: pirateRes?.current?.feelsLike,
      [MET_NORWAY]: metRes?.current?.feelsLike,
    },
  });
  const dailyHighMetric = buildMetric({
    metricName: "Daily high",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    aggregation: "auto",
    values: {
      [OPEN_METEO]: getDailyForDate(omRes?.daily, todayBase.date)?.high,
      [PIRATE]: todayPirate?.high,
      [WEATHER_GOV]: nws?.highF,
      [MET_NORWAY]: todayMet?.high,
    },
  });
  const dailyLowMetric = buildMetric({
    metricName: "Daily low",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    aggregation: "auto",
    values: {
      [OPEN_METEO]: getDailyForDate(omRes?.daily, todayBase.date)?.low,
      [PIRATE]: todayPirate?.low,
      [WEATHER_GOV]: nws?.lowF,
      [MET_NORWAY]: todayMet?.low,
    },
  });
  const rainChanceMetric = buildMetric({
    metricName: "Rain chance",
    conflictThreshold: CONFLICT_THRESHOLDS.rainChance,
    aggregation: "max",
    values: {
      [OPEN_METEO]: getDailyForDate(omRes?.daily, todayBase.date)?.rainChance,
      [PIRATE]: todayPirate?.rainChance,
      [WEATHER_GOV]: nws?.rainPct,
      [MET_NORWAY]: todayMet?.rainChance,
    },
  });

  const mergedHourly = mergeHourly([
    { source: OPEN_METEO, hourly: omRes?.fullHourly ?? [] },
    { source: PIRATE, hourly: pirateHourly(pirateRes) },
    { source: MET_NORWAY, hourly: metRes?.hourly ?? [] },
  ]);

  const firstHourly = mergedHourly.find((h) => new Date(h.time).getTime() >= Date.now() - 30 * 60 * 1000);
  const hourlyOpen = getHourlyForTime(omRes?.fullHourly, firstHourly?.time);
  const hourlyPirate = getHourlyForTime(pirateHourly(pirateRes), firstHourly?.time);
  const hourlyMet = getHourlyForTime(metRes?.hourly, firstHourly?.time);

  const hourlyTempMetric = buildMetric({
    metricName: "Hourly temperature",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    aggregation: "auto",
    values: {
      [OPEN_METEO]: hourlyOpen?.temp,
      [PIRATE]: hourlyPirate?.temp,
      [MET_NORWAY]: hourlyMet?.temp,
    },
  });
  const hourlyFeelsLikeMetric = buildMetric({
    metricName: "Hourly feels-like temperature",
    conflictThreshold: CONFLICT_THRESHOLDS.temperature,
    aggregation: "auto",
    values: {
      [OPEN_METEO]: hourlyOpen?.feelsLike,
      [PIRATE]: hourlyPirate?.feelsLike,
      [MET_NORWAY]: hourlyMet?.feelsLike,
    },
  });
  const hourlyRainChanceMetric = buildMetric({
    metricName: "Hourly precipitation chance",
    conflictThreshold: CONFLICT_THRESHOLDS.rainChance,
    aggregation: "max",
    values: {
      [OPEN_METEO]: hourlyOpen?.rainChance,
      [PIRATE]: hourlyPirate?.rainChance,
      [MET_NORWAY]: hourlyMet?.rainChance,
    },
  });
  const uvIndexMetric = buildMetric({
    metricName: "UV index",
    conflictThreshold: CONFLICT_THRESHOLDS.uvIndex,
    aggregation: "max",
    values: {
      [OPEN_METEO]: hourlyOpen?.uvIndex,
      [PIRATE]: hourlyPirate?.uvIndex,
      [MET_NORWAY]: hourlyMet?.uvIndex,
    },
  });
  const alertsMetric = buildMetric({
    metricName: "Weather alerts",
    conflictThreshold: 1,
    aggregation: "max",
    values: {
      [WEATHER_GOV]: nws ? (nws.alerts?.length ?? 0) : undefined,
    },
  });

  const sourceDetails = buildSourceDetails({
    providersResponded: providersUsed,
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
    weatherCode: weatherCodeFromProviders(
      omRes?.current.weatherCode,
      pirateRes?.current?.weatherCode,
      metRes?.current?.weatherCode,
      currentBase.weatherCode,
    ),
    isDay: isDayFromCurrent(
      omRes?.current.isDay,
      pirateRes?.current?.isDay,
      metRes?.current?.isDay,
      currentBase.isDay,
    ),
  };

  const blendedDaily = dailyBase.map((d, i) => {
    const openDay = getDailyForDate(omRes?.daily, d.date);
    const pirateDay = getDailyForDate(pirateDaily(pirateRes), d.date);
    const metDay = getDailyForDate(metRes?.daily, d.date);

    const highMetric = buildMetric({
      metricName: "Daily high",
      conflictThreshold: CONFLICT_THRESHOLDS.temperature,
      aggregation: "auto",
      values: {
        [OPEN_METEO]: openDay?.high,
        [PIRATE]: pirateDay?.high,
        [WEATHER_GOV]: i === 0 ? nws?.highF : undefined,
        [MET_NORWAY]: metDay?.high,
      },
    });
    const lowMetric = buildMetric({
      metricName: "Daily low",
      conflictThreshold: CONFLICT_THRESHOLDS.temperature,
      aggregation: "auto",
      values: {
        [OPEN_METEO]: openDay?.low,
        [PIRATE]: pirateDay?.low,
        [WEATHER_GOV]: i === 0 ? nws?.lowF : undefined,
        [MET_NORWAY]: metDay?.low,
      },
    });
    const feelsHighMetric = buildMetric({
      metricName: "Feels-like daily high",
      conflictThreshold: CONFLICT_THRESHOLDS.temperature,
      aggregation: "auto",
      values: {
        [OPEN_METEO]: openDay?.feelsHigh,
        [PIRATE]: pirateDay?.feelsHigh,
        [MET_NORWAY]: metDay?.feelsHigh,
      },
    });
    const rainMetric = buildMetric({
      metricName: "Rain chance",
      conflictThreshold: CONFLICT_THRESHOLDS.rainChance,
      aggregation: "max",
      values: {
        [OPEN_METEO]: openDay?.rainChance,
        [PIRATE]: pirateDay?.rainChance,
        [WEATHER_GOV]: i === 0 ? nws?.rainPct : undefined,
        [MET_NORWAY]: metDay?.rainChance,
      },
    });

    return {
      ...d,
      high: highMetric.value ?? d.high,
      low: lowMetric.value ?? d.low,
      feelsHigh: feelsHighMetric.value ?? d.feelsHigh,
      rainChance: rainMetric.value ?? d.rainChance,
      weatherCode: weatherCodeFromProviders(
        openDay?.weatherCode,
        pirateDay?.weatherCode,
        metDay?.weatherCode,
        d.weatherCode,
      ),
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
  providers: Array<{ source: string; hourly: HourlyPoint[] }>,
): HourlyPoint[] {
  const byTime = new Map<string, Record<string, HourlyPoint>>();

  for (const provider of providers) {
    for (const point of provider.hourly) {
      if (!point.time) continue;
      const existing = byTime.get(point.time) ?? {};
      existing[provider.source] = point;
      byTime.set(point.time, existing);
    }
  }

  return Array.from(byTime.entries())
    .map(([time, sourcePoints]) => {
      const points = Object.values(sourcePoints);
      const first = points[0];

      const tempMetric = buildMetric({
        metricName: "Hourly temperature",
        conflictThreshold: CONFLICT_THRESHOLDS.temperature,
        aggregation: "auto",
        values: Object.fromEntries(
          Object.entries(sourcePoints).map(([source, point]) => [source, point.temp]),
        ),
      });
      const feelsMetric = buildMetric({
        metricName: "Hourly feels-like temperature",
        conflictThreshold: CONFLICT_THRESHOLDS.temperature,
        aggregation: "auto",
        values: Object.fromEntries(
          Object.entries(sourcePoints).map(([source, point]) => [source, point.feelsLike]),
        ),
      });
      const rainMetric = buildMetric({
        metricName: "Hourly precipitation chance",
        conflictThreshold: CONFLICT_THRESHOLDS.rainChance,
        aggregation: "max",
        values: Object.fromEntries(
          Object.entries(sourcePoints).map(([source, point]) => [source, point.rainChance]),
        ),
      });
      const uvMetric = buildMetric({
        metricName: "UV index",
        conflictThreshold: CONFLICT_THRESHOLDS.uvIndex,
        aggregation: "max",
        values: Object.fromEntries(
          Object.entries(sourcePoints).map(([source, point]) => [source, point.uvIndex]),
        ),
      });

      return {
        ...first,
        time,
        temp: tempMetric.value ?? first.temp,
        feelsLike: feelsMetric.value ?? first.feelsLike,
        rainChance: rainMetric.value ?? first.rainChance,
        uvIndex: uvMetric.value ?? first.uvIndex,
        weatherCode: weatherCodeFromProviders(
          sourcePoints[OPEN_METEO]?.weatherCode,
          sourcePoints[PIRATE]?.weatherCode,
          sourcePoints[MET_NORWAY]?.weatherCode,
          first.weatherCode,
        ),
      };
    })
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
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
