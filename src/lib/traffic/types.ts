export type LiveTrafficLevel = "light" | "moderate" | "heavy" | "severe";

export interface TrafficIncident {
  id: string;
  description: string;
  severity: LiveTrafficLevel;
  roadName?: string;
  delaySeconds?: number;
  isClosure?: boolean;
}

export interface LiveTrafficBriefing {
  provider: "TomTom";
  sourceLabel: "Live traffic from TomTom";
  level: LiveTrafficLevel;
  congestionPercent: number;
  currentSpeedMph?: number;
  freeFlowSpeedMph?: number;
  roadClosureAware: boolean;
  incidents: TrafficIncident[];
  summary: string;
  recommendation: string;
  updatedAt: number;
}

export function trafficLabel(level: LiveTrafficLevel) {
  if (level === "light") return "Light";
  if (level === "moderate") return "Moderate";
  if (level === "heavy") return "Heavy";
  return "Severe";
}

export function trafficEmoji(level: LiveTrafficLevel) {
  if (level === "light") return "🟢";
  if (level === "moderate") return "🟡";
  if (level === "heavy") return "🔴";
  return "⚠️";
}
