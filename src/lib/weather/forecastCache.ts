import type { ForecastBundle } from "./types";
import { fetchForecast } from "./weatherApi";

type CacheEntry = {
  expiresAt: number;
  data: ForecastBundle;
};

const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const forecastCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<ForecastBundle>>();

function cacheKey(lat: number, lon: number) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export async function fetchCachedForecast(
  lat: number,
  lon: number,
  options?: { force?: boolean },
): Promise<ForecastBundle> {
  const key = cacheKey(lat, lon);
  const cached = forecastCache.get(key);

  if (!options?.force && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (!options?.force) {
    const pending = inFlight.get(key);
    if (pending) return pending;
  }

  const request = fetchForecast(lat, lon)
    .then((data) => {
      forecastCache.set(key, {
        data,
        expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
      });
      return data;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}
