// Multi-source forecast aggregator — runs server-side so API keys stay private.
// Sources: Open-Meteo (no key), OpenWeatherMap, WeatherAPI, Weather.gov (NWS, US-only).

import { createServerFn } from "@tanstack/react-start";
import type {
  ForecastBundle,
  DailyForecast,
  HourlyPoint,
  CurrentWeather,
  Confidence,
} from "./types";

// ---------- shared mappings ----------

// Map OpenWeatherMap "id" code -> WMO-ish code our describeCode() understands.
function owmIdToWmo(id: number): number {
  if (id >= 200 && id < 300) return 95;          // thunderstorm
  if (id >= 300 && id < 400) return 51;          // drizzle
  if (id >= 500 && id < 600) return id >= 502 ? 65 : 61; // rain
  if (id >= 600 && id < 700) return 71;          // snow
  if (id >= 700 && id < 800) return 45;          // fog/mist
  if (id === 800) return 0;                      // clear
  if (id === 801) return 1;                      // few clouds
  if (id === 802) return 2;                      // scattered
  if (id >= 803) return 3;                       // cloudy
  return 3;
}

// Map WeatherAPI "code" -> WMO-ish.
function waCodeToWmo(code: number): number {
  if (code === 1000) return 0;
  if (code === 1003) return 2;
  if (code === 1006) return 3;
  if (code === 1009) return 3;
  if ([1030, 1135, 1147].includes(code)) return 45;
  if ([1150, 1153, 1168, 1171, 1180, 1183, 1198, 1240].includes(code)) return 51;
  if ([1186, 1189, 1192, 1195, 1243, 1246].includes(code)) return 65;
  if ([1066, 1069, 1072, 1114, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258, 1261, 1264].includes(code)) return 71;
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 95;
  return 3;
}

// ---------- Open-Meteo (no key) ----------

async function fetchOpenMeteo(lat: number, lon: number) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,is_day` +
      `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) return null;
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
    const now = Date.now();
    const hourly: HourlyPoint[] = (j.hourly.time as string[])
      .map((t, i) => ({
        time: t,
        temp: j.hourly.temperature_2m[i],
        feelsLike: j.hourly.apparent_temperature[i],
        rainChance: j.hourly.precipitation_probability[i] ?? 0,
        weatherCode: j.hourly.weather_code[i] ?? 3,
      }))
      .filter((h) => {
        const t = new Date(h.time).getTime();
        return t >= now - 30 * 60 * 1000 && t <= now + 24 * 3600 * 1000;
      });
    return { current, daily, hourly };
  } catch {
    return null;
  }
}

// ---------- OpenWeatherMap ----------

interface OwmSummary {
  highF?: number;
  lowF?: number;
  rainPct?: number;
  current?: CurrentWeather;
}

async function fetchOwm(lat: number, lon: number): Promise<OwmSummary | null> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  try {
    const [curRes, fcRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${key}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${key}`),
    ]);
    if (!curRes.ok && !fcRes.ok) return null;
    const cur = curRes.ok ? await curRes.json() : null;
    const fc = fcRes.ok ? await fcRes.json() : null;
    let current: CurrentWeather | undefined;
    if (cur) {
      current = {
        temp: cur.main?.temp,
        feelsLike: cur.main?.feels_like,
        weatherCode: owmIdToWmo(cur.weather?.[0]?.id ?? 800),
        isDay: (() => {
          const now = Date.now() / 1000;
          return cur.sys?.sunrise && cur.sys?.sunset
            ? now >= cur.sys.sunrise && now < cur.sys.sunset
            : true;
        })(),
      };
    }
    let highF: number | undefined;
    let lowF: number | undefined;
    let rainPct: number | undefined;
    if (fc?.list) {
      const today = new Date().toDateString();
      const todays = fc.list.filter((p: any) => new Date(p.dt * 1000).toDateString() === today);
      if (todays.length > 0) {
        highF = Math.max(...todays.map((p: any) => p.main.temp_max));
        lowF = Math.min(...todays.map((p: any) => p.main.temp_min));
        rainPct = Math.round(Math.max(...todays.map((p: any) => (p.pop ?? 0) * 100)));
      }
    }
    return { highF, lowF, rainPct, current };
  } catch {
    return null;
  }
}

// ---------- WeatherAPI ----------

interface WaSummary {
  highF?: number;
  lowF?: number;
  rainPct?: number;
  current?: CurrentWeather;
  alerts: string[];
}

async function fetchWeatherApi(lat: number, lon: number): Promise<WaSummary | null> {
  const key = process.env.WEATHERAPI_KEY;
  if (!key) return null;
  try {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${lat},${lon}&days=2&aqi=no&alerts=yes`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json();
    const cur = j.current;
    const day = j.forecast?.forecastday?.[0]?.day;
    const current: CurrentWeather | undefined = cur && {
      temp: cur.temp_f,
      feelsLike: cur.feelslike_f,
      weatherCode: waCodeToWmo(cur.condition?.code ?? 1003),
      isDay: cur.is_day === 1,
    };
    const alerts: string[] = (j.alerts?.alert ?? [])
      .map((a: any) => a.headline || a.event)
      .filter(Boolean)
      .slice(0, 3);
    return {
      highF: day?.maxtemp_f,
      lowF: day?.mintemp_f,
      rainPct: day?.daily_chance_of_rain,
      current,
      alerts,
    };
  } catch {
    return null;
  }
}

// ---------- National Weather Service (Weather.gov, US only, no key) ----------

interface NwsSummary {
  highF?: number;
  lowF?: number;
  rainPct?: number;
  alerts: string[];
}

async function fetchNws(lat: number, lon: number): Promise<NwsSummary | null> {
  try {
    const headers = { Accept: "application/geo+json", "User-Agent": "WeatherBrief (contact@weatherbrief.app)" };
    const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { headers });
    if (!pointRes.ok) return null;
    const point = await pointRes.json();
    const forecastUrl: string | undefined = point?.properties?.forecast;
    if (!forecastUrl) return null;
    const fcRes = await fetch(forecastUrl, { headers });
    if (!fcRes.ok) return null;
    const fc = await fcRes.json();
    const periods: Array<any> = fc?.properties?.periods ?? [];
    const dayP = periods.find((p) => p.isDaytime);
    const nightP = periods.find((p) => !p.isDaytime);
    const highF = dayP?.temperature;
    const lowF = nightP?.temperature;
    const rainPct = (dayP ?? periods[0])?.probabilityOfPrecipitation?.value ?? undefined;

    let alerts: string[] = [];
    try {
      const aRes = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, { headers });
      if (aRes.ok) {
        const aj = await aRes.json();
        alerts = (aj?.features ?? [])
          .map((f: any) => f?.properties?.headline as string)
          .filter(Boolean)
          .slice(0, 3);
      }
    } catch { /* ignore */ }

    return { highF, lowF, rainPct, alerts };
  } catch {
    return null;
  }
}

// ---------- confidence ----------

function scoreConfidence(values: Array<{ high?: number; low?: number; rain?: number }>): Confidence {
  const highs = values.map((v) => v.high).filter((n): n is number => typeof n === "number");
  const lows = values.map((v) => v.low).filter((n): n is number => typeof n === "number");
  const rains = values.map((v) => v.rain).filter((n): n is number => typeof n === "number");
  if (highs.length < 2 && lows.length < 2 && rains.length < 2) return "moderate";
  const spread = (arr: number[]) => (arr.length < 2 ? 0 : Math.max(...arr) - Math.min(...arr));
  const tempSpread = Math.max(spread(highs), spread(lows));
  const rainSpread = spread(rains);
  if (tempSpread <= 3 && rainSpread <= 15) return "high";
  if (tempSpread <= 7 && rainSpread <= 30) return "moderate";
  return "low";
}

function avg(nums: Array<number | undefined>): number | undefined {
  const xs = nums.filter((n): n is number => typeof n === "number");
  if (xs.length === 0) return undefined;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// ---------- aggregator ----------

export const fetchForecastFn = createServerFn({ method: "GET" })
  .inputValidator((data: { lat: number; lon: number }) => data)
  .handler(async ({ data }): Promise<ForecastBundle> => {
    const { lat, lon } = data;
    const [om, owm, wa, nws] = await Promise.all([
      fetchOpenMeteo(lat, lon),
      fetchOwm(lat, lon),
      fetchWeatherApi(lat, lon),
      fetchNws(lat, lon),
    ]);

    if (!om) {
      // Open-Meteo is the structural backbone (hourly, daily, codes). If it
      // fails entirely, fall back to a minimal bundle from the others.
      const fallbackCurrent: CurrentWeather = wa?.current ?? owm?.current ?? {
        temp: 70, feelsLike: 70, weatherCode: 3, isDay: true,
      };
      const today: DailyForecast = {
        date: new Date().toISOString().slice(0, 10),
        high: wa?.highF ?? owm?.highF ?? nws?.highF ?? 70,
        low: wa?.lowF ?? owm?.lowF ?? nws?.lowF ?? 60,
        feelsHigh: wa?.highF ?? owm?.highF ?? 70,
        rainChance: wa?.rainPct ?? owm?.rainPct ?? nws?.rainPct ?? 0,
        weatherCode: fallbackCurrent.weatherCode,
      };
      const sources: string[] = [];
      if (owm) sources.push("OpenWeatherMap");
      if (wa) sources.push("WeatherAPI");
      if (nws) sources.push("Weather.gov");
      return {
        current: fallbackCurrent,
        today,
        daily: [today],
        hourly: [],
        alerts: [...(wa?.alerts ?? []), ...(nws?.alerts ?? [])].slice(0, 3),
        confidence: scoreConfidence([
          { high: owm?.highF, low: owm?.lowF, rain: owm?.rainPct },
          { high: wa?.highF, low: wa?.lowF, rain: wa?.rainPct },
          { high: nws?.highF, low: nws?.lowF, rain: nws?.rainPct },
        ]),
        sources,
        updatedAt: Date.now(),
      };
    }

    const omToday = om.daily[0];
    const sources: string[] = ["Open-Meteo"];
    if (owm) sources.push("OpenWeatherMap");
    if (wa) sources.push("WeatherAPI");
    if (nws) sources.push("Weather.gov");

    const confidence = scoreConfidence([
      { high: omToday.high, low: omToday.low, rain: omToday.rainChance },
      { high: owm?.highF, low: owm?.lowF, rain: owm?.rainPct },
      { high: wa?.highF, low: wa?.lowF, rain: wa?.rainPct },
      { high: nws?.highF, low: nws?.lowF, rain: nws?.rainPct },
    ]);

    // Blend today's headline numbers across responding sources.
    const blendedHigh = avg([omToday.high, owm?.highF, wa?.highF, nws?.highF]) ?? omToday.high;
    const blendedLow = avg([omToday.low, owm?.lowF, wa?.lowF, nws?.lowF]) ?? omToday.low;
    const blendedRain = avg([omToday.rainChance, owm?.rainPct, wa?.rainPct, nws?.rainPct]) ?? omToday.rainChance;
    const blendedToday: DailyForecast = {
      ...omToday,
      high: Math.round(blendedHigh),
      low: Math.round(blendedLow),
      rainChance: Math.round(blendedRain),
    };
    const daily = [blendedToday, ...om.daily.slice(1)];

    // Blend current temp/feelsLike if multiple sources have a reading.
    const blendedCurrent: CurrentWeather = {
      ...om.current,
      temp: Math.round(avg([om.current.temp, owm?.current?.temp, wa?.current?.temp]) ?? om.current.temp),
      feelsLike: Math.round(avg([om.current.feelsLike, owm?.current?.feelsLike, wa?.current?.feelsLike]) ?? om.current.feelsLike),
    };

    return {
      current: blendedCurrent,
      today: blendedToday,
      daily,
      hourly: om.hourly,
      alerts: [...(wa?.alerts ?? []), ...(nws?.alerts ?? [])].slice(0, 3),
      confidence,
      sources,
      updatedAt: Date.now(),
    };
  });