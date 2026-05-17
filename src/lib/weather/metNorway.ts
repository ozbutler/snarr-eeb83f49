import type { DailyForecast, HourlyPoint, CurrentWeather } from "./types";
import { localDateKey } from "./weatherUtils";

export interface MetNorwayNormalized {
  current?: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlyPoint[];
}

function cToF(value: number) {
  return value * 9 / 5 + 32;
}

function rainChanceFromAmount(amount?: number) {
  if (amount === undefined || amount <= 0) return 0;
  if (amount < 0.25) return 30;
  if (amount < 1) return 55;
  return 80;
}

function symbolToWeatherCode(symbol?: string) {
  if (!symbol) return 1;
  if (/clearsky/i.test(symbol)) return 0;
  if (/cloudy|fair|partlycloudy/i.test(symbol)) return 2;
  if (/rain|showers/i.test(symbol)) return 61;
  if (/snow|sleet/i.test(symbol)) return 71;
  if (/thunder/i.test(symbol)) return 95;
  if (/fog/i.test(symbol)) return 45;
  return 1;
}

function isDayFromTime(value: string) {
  const hour = new Date(value).getHours();
  return hour >= 6 && hour < 19;
}

export async function fetchMetNorwayForecast(lat: number, lon: number): Promise<MetNorwayNormalized | null> {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Snarr weather app forecast comparison",
      },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const timeseries: any[] = json?.properties?.timeseries;
    if (!Array.isArray(timeseries) || timeseries.length === 0) return null;

    const hourly: HourlyPoint[] = timeseries.slice(0, 72).map((point) => {
      const time = String(point?.time ?? "");
      const instant = point?.data?.instant?.details ?? {};
      const nextHour = point?.data?.next_1_hours;
      const tempC = typeof instant.air_temperature === "number" ? instant.air_temperature : undefined;
      const precipAmount = nextHour?.details?.precipitation_amount;
      const symbol = nextHour?.summary?.symbol_code;

      return {
        time,
        temp: tempC !== undefined ? cToF(tempC) : undefined,
        feelsLike: tempC !== undefined ? cToF(tempC) : undefined,
        rainChance: rainChanceFromAmount(precipAmount),
        weatherCode: symbolToWeatherCode(symbol),
      };
    }).filter((point) => point.time);

    const byDay = new Map<string, HourlyPoint[]>();
    for (const point of hourly) {
      const dayKey = localDateKey(new Date(point.time));
      const existing = byDay.get(dayKey) ?? [];
      existing.push(point);
      byDay.set(dayKey, existing);
    }

    const daily: DailyForecast[] = Array.from(byDay.entries()).slice(0, 7).map(([date, points]) => {
      const temps = points.map((point) => point.temp).filter((value): value is number => value !== undefined);
      const feels = points.map((point) => point.feelsLike).filter((value): value is number => value !== undefined);
      const rainChance = Math.max(...points.map((point) => point.rainChance ?? 0), 0);
      const weatherCode = points.find((point) => (point.rainChance ?? 0) === rainChance)?.weatherCode ?? points[0]?.weatherCode ?? 1;

      return {
        date,
        high: temps.length ? Math.max(...temps) : 0,
        low: temps.length ? Math.min(...temps) : 0,
        feelsHigh: feels.length ? Math.max(...feels) : temps.length ? Math.max(...temps) : 0,
        rainChance,
        weatherCode,
      };
    }).filter((day) => day.high !== 0 || day.low !== 0);

    const first = hourly[0];
    const current: CurrentWeather | undefined = first?.temp !== undefined
      ? {
          temp: first.temp,
          feelsLike: first.feelsLike ?? first.temp,
          weatherCode: first.weatherCode ?? 1,
          isDay: isDayFromTime(first.time),
        }
      : undefined;

    return {
      current,
      daily,
      hourly,
    };
  } catch {
    return null;
  }
}
