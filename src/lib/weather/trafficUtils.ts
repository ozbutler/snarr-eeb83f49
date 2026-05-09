// Lightweight simulated traffic + road-impact heuristics.
// We don't have a free traffic API by default, so we estimate from
// time-of-day, day-of-week, and current weather code.

import { describeCode } from "./weatherUtils";

export type TrafficLevel = "low" | "moderate" | "heavy";

export interface RoadBriefing {
  level: TrafficLevel;
  emoji: string;            // 🟢🟡🔴
  icon: string;             // road/car icon
  summary: string;          // commute summary sentence
  weatherImpact: string;    // road impact from weather
  recommendation: string;   // driving recommendation
  alerts: string[];         // optional alerts
}

export function buildRoadBriefing(weatherCode: number, rainChance: number, now = new Date()): RoadBriefing {
  const hour = now.getHours();
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const isWeekend = day === 0 || day === 6;
  const rushHour = !isWeekend && ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18));

  // Severity bumps from weather.
  const isStorm = [95, 96, 99].includes(weatherCode);
  const isSnow = [71, 73, 75, 77, 85, 86].includes(weatherCode);
  const isRain = [51,53,55,61,63,65,66,67,80,81,82].includes(weatherCode) || rainChance >= 50;
  const isFog = [45, 48].includes(weatherCode);

  let level: TrafficLevel = "low";
  if (rushHour) level = "moderate";
  if (rushHour && (isRain || isSnow || isStorm)) level = "heavy";
  if (isStorm || isSnow) level = level === "low" ? "moderate" : "heavy";

  const emoji = level === "low" ? "🟢" : level === "moderate" ? "🟡" : "🔴";
  let icon = "🛣️";
  if (level === "moderate") icon = "🚗";
  if (level === "heavy") icon = "🚙";
  if (isStorm || isSnow) icon = "⚠️";
  else if (isRain) icon = "🌧️";
  else if (isFog) icon = "🌫️";

  const summary =
    level === "low" ? "Roads are mostly clear with light traffic." :
    level === "moderate" ? "Moderate traffic on main routes." :
    "Heavy congestion likely — expect delays.";

  const weatherImpact =
    isStorm ? "Drive carefully during storms." :
    isSnow ? "Potential hazardous driving conditions." :
    isRain ? "Roads may be slick from rain." :
    isFog ? "Reduced visibility possible." :
    "Road conditions look good.";

  let recommendation = "Conditions are good for normal travel.";
  if (level === "heavy") recommendation = "Leave 10–15 minutes early.";
  else if (level === "moderate") recommendation = "Leave a few minutes early.";
  if (isRain || isSnow || isStorm) recommendation = "Drive carefully and allow extra time.";
  if (describeCode(weatherCode).label === "Clear" && hour >= 6 && hour <= 9)
    recommendation = "Bring sunglasses for bright morning conditions.";

  const alerts: string[] = [];
  if (isStorm) alerts.push("Thunderstorms in the area — watch for sudden downpours.");
  if (isSnow) alerts.push("Winter weather — roads may be icy.");

  return { level, emoji, icon, summary, weatherImpact, recommendation, alerts };
}