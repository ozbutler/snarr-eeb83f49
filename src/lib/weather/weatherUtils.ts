// Helpers: weather codes -> emoji + label, unit conversion, outfit logic.

import type { Units } from "./types";

// Parse forecast dates in the device's local timezone. Date-only strings
// (YYYY-MM-DD) must not go through new Date(value), because browsers treat
// them as UTC midnight and can shift them to the previous local day.
export function parseForecastDateLocal(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
}

export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function forecastDateLocalKey(value: string): string {
  return localDateKey(parseForecastDateLocal(value));
}

// WMO weather code -> friendly emoji + short label.
export function describeCode(code: number, isDay = true): { emoji: string; label: string; tone: string } {
  // tone is a CSS variable name on --color-* tokens
  if ([0].includes(code)) return { emoji: isDay ? "☀️" : "🌙", label: "Clear", tone: "sunny" };
  if ([1].includes(code)) return { emoji: "🌤️", label: "Mostly sunny", tone: "sunny" };
  if ([2].includes(code)) return { emoji: "⛅", label: "Partly cloudy", tone: "cloudy" };
  if ([3].includes(code)) return { emoji: "☁️", label: "Cloudy", tone: "cloudy" };
  if ([45, 48].includes(code)) return { emoji: "🌫️", label: "Fog", tone: "cloudy" };
  if ([51, 53, 55, 56, 57].includes(code)) return { emoji: "🌦️", label: "Drizzle", tone: "rainy" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { emoji: "🌧️", label: "Rain", tone: "rainy" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { emoji: "❄️", label: "Snow", tone: "snow" };
  if ([95, 96, 99].includes(code)) return { emoji: "⛈️", label: "Thunderstorm", tone: "stormy" };
  return { emoji: "🌡️", label: "Weather", tone: "cloudy" };
}

// Convert a Fahrenheit value to the active unit for display.
export function toUnit(tempF: number, units: Units): number {
  return units === "F" ? tempF : ((tempF - 32) * 5) / 9;
}

// Format a temperature value with degree + unit.
export function fmtTemp(tempF: number, units: Units): string {
  return `${Math.round(toUnit(tempF, units))}°${units}`;
}

// Outfit/clothing recommendation from a high-temp + rain chance.
export function outfitFor(highF: number, rainChance: number): { main: string; extra?: string } {
  let main: string;
  if (highF >= 80) main = "Shorts and a t-shirt";
  else if (highF >= 65) main = "Light shirt or polo";
  else if (highF >= 50) main = "Light jacket or sweatshirt";
  else main = "Warm jacket";
  const extra = rainChance > 40 ? "Bring an umbrella or rain jacket" : undefined;
  return { main, extra };
}

// One-sentence morning-brief style summary.
export function morningBrief(highF: number, lowF: number, rainChance: number, code: number): string {
  const { label } = describeCode(code);
  const tempFeel =
    highF >= 85 ? "Hot" :
    highF >= 72 ? "Warm" :
    highF >= 58 ? "Mild" :
    highF >= 45 ? "Cool" : "Cold";
  const rain =
    rainChance >= 60 ? "with rain likely" :
    rainChance >= 30 ? "with a chance of rain" :
    "and mostly dry";
  const comfort =
    highF >= 60 && highF <= 82 && rainChance < 30 ? " Comfortable conditions overall." :
    rainChance >= 60 ? " Plan for wet weather." :
    highF >= 88 ? " Stay hydrated." :
    highF <= 40 ? " Bundle up before heading out." : "";
  return `${tempFeel} today (${Math.round(highF)}°/${Math.round(lowF)}°) ${rain}. ${label}.${comfort}`.trim();
}

// Given hourly precip points, find the most likely rain window.
export function rainWindow(hourly: { time: string; rainChance: number }[]): string | null {
  const rainy = hourly.filter((h) => h.rainChance >= 40);
  if (rainy.length === 0) return null;
  const start = new Date(rainy[0].time);
  const end = new Date(rainy[rainy.length - 1].time);
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "numeric" }).toLowerCase().replace(" ", "");
  return `${fmt(start)}–${fmt(end)}`;
}