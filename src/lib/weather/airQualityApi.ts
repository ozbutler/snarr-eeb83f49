// Open-Meteo Air Quality API. No key required.
// Returns U.S. AQI, PM2.5, UV index, and (when available) pollen levels.

export interface OutdoorConditions {
  usAqi?: number;
  pm25?: number;
  uvIndex?: number;
  pollen?: { label: string; value: number }[]; // dominant pollens with grains/m³
}

const POLLEN_KEYS = [
  ["alder_pollen", "Alder"],
  ["birch_pollen", "Birch"],
  ["grass_pollen", "Grass"],
  ["mugwort_pollen", "Mugwort"],
  ["olive_pollen", "Olive"],
  ["ragweed_pollen", "Ragweed"],
] as const;

export async function fetchOutdoorConditions(
  lat: number,
  lon: number,
): Promise<OutdoorConditions> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "auto";
  const pollenParams = POLLEN_KEYS.map(([k]) => k).join(",");
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=us_aqi,pm2_5,uv_index` +
    `&hourly=${pollenParams}` +
    `&timezone=${encodeURIComponent(tz)}&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Air quality fetch failed");
  const j = await res.json();

  const cur = j?.current ?? {};
  const result: OutdoorConditions = {
    usAqi: typeof cur.us_aqi === "number" ? cur.us_aqi : undefined,
    pm25: typeof cur.pm2_5 === "number" ? cur.pm2_5 : undefined,
    uvIndex: typeof cur.uv_index === "number" ? cur.uv_index : undefined,
  };

  // Pollen: average today's available hourly readings; outside Europe these arrays are all null.
  const hourly = j?.hourly ?? {};
  const pollen: { label: string; value: number }[] = [];
  for (const [key, label] of POLLEN_KEYS) {
    const arr: (number | null)[] | undefined = hourly[key];
    if (!Array.isArray(arr)) continue;
    const nums = arr.filter((v): v is number => typeof v === "number");
    if (!nums.length) continue;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    if (avg > 0.1) pollen.push({ label, value: Math.round(avg * 10) / 10 });
  }
  if (pollen.length) {
    pollen.sort((a, b) => b.value - a.value);
    result.pollen = pollen.slice(0, 3);
  }
  return result;
}

export function aqiCategory(aqi?: number): { label: string; emoji: string } {
  if (aqi === undefined) return { label: "—", emoji: "❓" };
  if (aqi <= 50) return { label: "Good", emoji: "🟢" };
  if (aqi <= 100) return { label: "Moderate", emoji: "🟡" };
  if (aqi <= 150) return { label: "Unhealthy for sensitive", emoji: "🟠" };
  if (aqi <= 200) return { label: "Unhealthy", emoji: "🔴" };
  if (aqi <= 300) return { label: "Very unhealthy", emoji: "🟣" };
  return { label: "Hazardous", emoji: "🟤" };
}

export function uvCategory(uv?: number): { label: string; emoji: string } {
  if (uv === undefined) return { label: "—", emoji: "❓" };
  if (uv < 3) return { label: "Low", emoji: "🟢" };
  if (uv < 6) return { label: "Moderate", emoji: "🟡" };
  if (uv < 8) return { label: "High", emoji: "🟠" };
  if (uv < 11) return { label: "Very high", emoji: "🔴" };
  return { label: "Extreme", emoji: "🟣" };
}

export function outdoorRecommendation(c: OutdoorConditions): { emoji: string; text: string } {
  const aqi = c.usAqi;
  const uv = c.uvIndex;
  if (aqi !== undefined && aqi > 150) return { emoji: "🚫", text: "Limit outdoor activity" };
  if (uv !== undefined && uv >= 8) return { emoji: "🧴", text: "Use sunscreen — UV is high" };
  if (aqi !== undefined && aqi > 100) return { emoji: "😷", text: "Okay outside, but watch air quality" };
  if (uv !== undefined && uv >= 6) return { emoji: "🧴", text: "Use sunscreen" };
  return { emoji: "🌤️", text: "Great day to be outside" };
}