// Public weather/geocoding helpers used by the client. Multi-source forecast
// fetching now lives in forecast.functions.ts (server function) so API keys
// remain server-side. This file keeps keyless geocoding helpers callable
// from the browser.

import type { ForecastBundle } from "./types";
import { fetchForecastFn } from "./forecast.functions";

export async function fetchForecast(lat: number, lon: number): Promise<ForecastBundle> {
  return fetchForecastFn({ data: { lat, lon } });
}

// ---- Geocoding (Open-Meteo) -----------------------------------------------

export async function geocode(query: string): Promise<{ name: string; lat: number; lon: number } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  const r = j?.results?.[0];
  if (!r) return null;
  const region = r.admin1 ? `, ${r.admin1}` : r.country ? `, ${r.country}` : "";
  return { name: `${r.name}${region}`, lat: r.latitude, lon: r.longitude };
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