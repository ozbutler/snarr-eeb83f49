import { createServerFn } from "@tanstack/react-start";

export interface PirateNormalized {
  current?: {
    temp: number;
    feelsLike: number;
    weatherCode: number;
    isDay: boolean;
  };
  hourly: Array<{
    time: string; // ISO local-equivalent (we use UTC iso, Date parses to local)
    temp?: number;
    feelsLike?: number;
    rainChance: number;
    uvIndex?: number;
  }>;
  daily: Array<{
    date: string; // YYYY-MM-DD (local)
    high: number;
    low: number;
    feelsHigh: number;
    rainChance: number;
  }>;
}

// Pirate Weather "icon" → rough WMO weather code (best-effort).
function iconToWmo(icon?: string): number {
  switch (icon) {
    case "clear-day":
    case "clear-night":
      return 0;
    case "partly-cloudy-day":
    case "partly-cloudy-night":
      return 2;
    case "cloudy":
      return 3;
    case "fog":
      return 45;
    case "rain":
      return 63;
    case "snow":
      return 73;
    case "sleet":
      return 67;
    case "wind":
      return 1;
    default:
      return 1;
  }
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const fetchPirateWeather = createServerFn({ method: "POST" })
  .inputValidator((d: { lat: number; lon: number; tz?: string }) => d)
  .handler(async ({ data }): Promise<PirateNormalized | null> => {
    const key = process.env.PIRATE_WEATHER_API_KEY;
    if (!key) return null;
    const tz = data.tz || "UTC";
    const url =
      `https://api.pirateweather.net/forecast/${key}/${data.lat},${data.lon}` +
      `?units=us&exclude=minutely,alerts`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const j: any = await res.json();

      const cur = j?.currently;
      const current = cur
        ? {
            temp: Number(cur.temperature),
            feelsLike: Number(cur.apparentTemperature ?? cur.temperature),
            weatherCode: iconToWmo(cur.icon),
            isDay: (() => {
              const h = new Date((cur.time ?? 0) * 1000).getUTCHours();
              // Coarse — caller may override with Open-Meteo when available.
              return h >= 6 && h < 19;
            })(),
          }
        : undefined;

      const hourly = Array.isArray(j?.hourly?.data)
        ? j.hourly.data.map((h: any) => ({
            time: new Date((h.time ?? 0) * 1000).toISOString(),
            temp: typeof h.temperature === "number" ? h.temperature : undefined,
            feelsLike:
              typeof h.apparentTemperature === "number" ? h.apparentTemperature : undefined,
            rainChance: Math.round(((h.precipProbability ?? 0) as number) * 100),
            uvIndex: typeof h.uvIndex === "number" ? h.uvIndex : undefined,
          }))
        : [];

      // Group daily entries by local date in the requested timezone.
      const daily = Array.isArray(j?.daily?.data)
        ? j.daily.data.map((d: any) => {
            const date = new Date((d.time ?? 0) * 1000);
            // Format date in requested timezone.
            let key: string;
            try {
              const parts = new Intl.DateTimeFormat("en-CA", {
                timeZone: tz,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(date);
              key = parts; // en-CA → YYYY-MM-DD
            } catch {
              key = localDateKey(date);
            }
            return {
              date: key,
              high: Math.round(Number(d.temperatureHigh ?? d.temperatureMax ?? 0)),
              low: Math.round(Number(d.temperatureLow ?? d.temperatureMin ?? 0)),
              feelsHigh: Math.round(
                Number(
                  d.apparentTemperatureHigh ??
                    d.apparentTemperatureMax ??
                    d.temperatureHigh ??
                    0,
                ),
              ),
              rainChance: Math.round(((d.precipProbability ?? 0) as number) * 100),
            };
          })
        : [];

      return { current, hourly, daily };
    } catch {
      return null;
    }
  });