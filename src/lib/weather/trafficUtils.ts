// Lightweight simulated traffic + road-impact heuristics.
// We don't have a free traffic API by default, so we estimate from
// time-of-day, day-of-week, and current weather code.

import { describeCode } from "./weatherUtils";

export type TrafficLevel = "low" | "moderate" | "heavy";
export type RoadCondition = "clear" | "wet" | "reduced-visibility" | "hazardous";

export interface RoadBriefing {
  level: TrafficLevel;
  emoji: string;              // 🟢🟡🔴 (traffic-only)
  icon: string;               // road/car icon
  trafficSummary: string;     // sentence about traffic only
  road: RoadCondition;
  roadLabel: string;          // "Clear" | "Wet" | ...
  roadEmoji: string;          // separate from traffic
  weatherImpact: string;      // road impact from weather
  summary: string;            // combined commute summary (traffic + roads)
  recommendation: string;     // driving recommendation
  alerts: string[];           // optional alerts
}

export function buildRoadBriefing(weatherCode: number, rainChance: number, now = new Date()): RoadBriefing {
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const rushHour = !isWeekend && ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18));

  const isStorm = [95, 96, 99].includes(weatherCode);
  const isSnow = [71, 73, 75, 77, 85, 86].includes(weatherCode);
  const isRain = [51,53,55,61,63,65,66,67,80,81,82].includes(weatherCode) || rainChance >= 50;
  const isFog = [45, 48].includes(weatherCode);
  const wetLikely = rainChance > 40 || isRain;

  let level: TrafficLevel = "low";
  if (rushHour) level = "moderate";
  if (rushHour && (wetLikely || isSnow || isStorm)) level = "heavy";
  if (isStorm || isSnow) level = level === "low" ? "moderate" : "heavy";

  const emoji = level === "low" ? "🟢" : level === "moderate" ? "🟡" : "🔴";
  let icon = "🛣️";
  if (level === "moderate") icon = "🚗";
  if (level === "heavy") icon = "🚙";

  // Road condition (independent of traffic level).
  let road: RoadCondition = "clear";
  let roadEmoji = "🛣️";
  if (isStorm || isSnow) { road = "hazardous"; roadEmoji = "⚠️"; }
  else if (isFog) { road = "reduced-visibility"; roadEmoji = "🌫️"; }
  else if (wetLikely) { road = "wet"; roadEmoji = "💧"; }
  const roadLabel =
    road === "clear" ? "Clear" :
    road === "wet" ? "Wet" :
    road === "reduced-visibility" ? "Reduced visibility" :
    "Hazardous";

  const trafficSummary =
    level === "low" ? "Light traffic on main routes." :
    level === "moderate" ? "Moderate traffic on main routes." :
    "Heavy congestion — expect delays.";

  const summary =
    road === "clear"
      ? trafficSummary
      : `${trafficSummary.replace(/\.$/, "")}, but ${roadLabel.toLowerCase()} roads may slow travel.`;

  const weatherImpact =
    isStorm ? "Drive carefully during storms." :
    isSnow ? "Potential hazardous driving conditions." :
    wetLikely ? "Roads may be slick from rain." :
    isFog ? "Reduced visibility possible." :
    "Road conditions look good.";

  let recommendation = "Conditions are good for normal travel.";
  if (level === "heavy") recommendation = "Leave 10–15 minutes early.";
  else if (level === "moderate") recommendation = "Leave a few minutes early.";
  if (wetLikely || isSnow || isStorm) recommendation = "Drive carefully and allow extra time.";
  if (describeCode(weatherCode).label === "Clear" && hour >= 6 && hour <= 9)
    recommendation = "Bring sunglasses for bright morning conditions.";

  const alerts: string[] = [];
  if (isStorm) alerts.push("Thunderstorms in the area — watch for sudden downpours.");
  if (isSnow) alerts.push("Winter weather — roads may be icy.");

  return {
    level, emoji, icon, trafficSummary,
    road, roadLabel, roadEmoji,
    weatherImpact, summary, recommendation, alerts,
  };
}

// Compact chip-style outfit for week list.
export function outfitChips(highF: number, rainChance: number): { icon: string; text: string }[] {
  const chips: { icon: string; text: string }[] = [];
  if (highF >= 80) chips.push({ icon: "👕", text: "T-shirt" });
  else if (highF >= 65) chips.push({ icon: "👕", text: "Light shirt" });
  else if (highF >= 50) chips.push({ icon: "🧥", text: "Jacket" });
  else chips.push({ icon: "🥶", text: "Warm jacket" });
  if (rainChance > 40) chips.push({ icon: "☂️", text: "Umbrella" });
  return chips;
}