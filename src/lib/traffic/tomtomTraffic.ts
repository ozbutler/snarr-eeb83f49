import { createServerFn } from "@tanstack/react-start";
import type { LiveTrafficBriefing, LiveTrafficLevel, TrafficIncident } from "./types";

type CacheEntry = {
  until: number;
  data: LiveTrafficBriefing | null;
};

const CACHE_MS = 5 * 60 * 1000;
const trafficCache = new Map<string, CacheEntry>();
const inFlightTraffic = new Map<string, Promise<LiveTrafficBriefing | null>>();

function trafficCacheKey(lat: number, lon: number) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function toMph(kph?: number) {
  return typeof kph === "number" && Number.isFinite(kph)
    ? Math.round(kph * 0.621371)
    : undefined;
}

function levelFromCongestion(value: number): LiveTrafficLevel {
  if (value >= 70) return "severe";
  if (value >= 45) return "heavy";
  if (value >= 20) return "moderate";
  return "light";
}

function levelFromMagnitude(value?: number): LiveTrafficLevel {
  if (!value || value <= 1) return "light";
  if (value === 2) return "moderate";
  if (value === 3) return "heavy";
  return "severe";
}

function maxLevel(a: LiveTrafficLevel, b: LiveTrafficLevel): LiveTrafficLevel {
  const rank = { light: 1, moderate: 2, heavy: 3, severe: 4 };
  return rank[b] > rank[a] ? b : a;
}

function recommendation(level: LiveTrafficLevel, closure: boolean) {
  if (closure || level === "severe") return "Avoid unnecessary driving.";
  if (level === "heavy") return "Expect delays.";
  if (level === "moderate") return "Leave a few minutes early.";
  return "Normal drive expected.";
}

function summary(level: LiveTrafficLevel, incidents: TrafficIncident[]) {
  const count = incidents.length;
  const incidentText = count ? `${count} nearby incident${count === 1 ? "" : "s"}` : "no major nearby incidents";
  if (level === "severe") return `Severe traffic nearby with ${incidentText}.`;
  if (level === "heavy") return `Heavy traffic nearby with ${incidentText}.`;
  if (level === "moderate") return `Moderate traffic nearby with ${incidentText}.`;
  return `Light traffic nearby with ${incidentText}.`;
}

async function fetchFlow(lat: number, lon: number, key: string) {
  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&unit=KMPH&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json())?.flowSegmentData;
  if (!data) return null;

  const current = typeof data.currentSpeed === "number" ? data.currentSpeed : undefined;
  const free = typeof data.freeFlowSpeed === "number" ? data.freeFlowSpeed : undefined;
  const congestionPercent = current !== undefined && free && free > 0
    ? Math.max(0, Math.min(100, Math.round((1 - current / free) * 100)))
    : 0;

  return {
    congestionPercent,
    currentSpeedMph: toMph(current),
    freeFlowSpeedMph: toMph(free),
    roadClosure: data.roadClosure === true,
  };
}

async function fetchIncidents(lat: number, lon: number, key: string): Promise<TrafficIncident[]> {
  const d = 0.08;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const fields = "{incidents{type,properties{id,iconCategory,magnitudeOfDelay,events{description},from,to,delay,roadNumbers}}}";
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields=${encodeURIComponent(fields)}&language=en-US&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const list = (await res.json())?.incidents;
  if (!Array.isArray(list)) return [];

  return list.slice(0, 5).map((item: any, index: number) => {
    const props = item?.properties ?? {};
    const event = Array.isArray(props.events) ? props.events[0] : undefined;
    const description = event?.description || props.from || props.roadNumbers?.[0] || "Nearby traffic incident";
    const isClosure = props.iconCategory === 8 || /closed|closure/i.test(description);
    return {
      id: String(props.id ?? `incident-${index}`),
      description,
      severity: isClosure ? "severe" : levelFromMagnitude(props.magnitudeOfDelay),
      roadName: props.roadNumbers?.[0] || props.from || undefined,
      delaySeconds: typeof props.delay === "number" ? props.delay : undefined,
      isClosure,
    };
  });
}

async function requestTomTomTraffic(lat: number, lon: number, key: string, cacheKey: string) {
  try {
    const [flow, incidents] = await Promise.all([
      fetchFlow(lat, lon, key),
      fetchIncidents(lat, lon, key),
    ]);

    if (!flow && incidents.length === 0) {
      trafficCache.set(cacheKey, { until: Date.now() + CACHE_MS, data: null });
      return null;
    }

    const closure = Boolean(flow?.roadClosure || incidents.some((i) => i.isClosure));
    const flowLevel = levelFromCongestion(flow?.congestionPercent ?? 0);
    const level = incidents.reduce((acc, incident) => maxLevel(acc, incident.severity), closure ? "severe" : flowLevel);
    const congestionPercent = flow?.congestionPercent ?? (level === "light" ? 0 : level === "moderate" ? 30 : level === "heavy" ? 55 : 80);

    const briefing: LiveTrafficBriefing = {
      provider: "TomTom",
      sourceLabel: "Live traffic from TomTom",
      level,
      congestionPercent,
      currentSpeedMph: flow?.currentSpeedMph,
      freeFlowSpeedMph: flow?.freeFlowSpeedMph,
      roadClosureAware: closure,
      incidents,
      summary: summary(level, incidents),
      recommendation: recommendation(level, closure),
      updatedAt: Date.now(),
    };

    trafficCache.set(cacheKey, { until: Date.now() + CACHE_MS, data: briefing });
    return briefing;
  } catch {
    trafficCache.set(cacheKey, { until: Date.now() + CACHE_MS, data: null });
    return null;
  } finally {
    inFlightTraffic.delete(cacheKey);
  }
}

export const fetchTomTomTraffic = createServerFn({ method: "POST" })
  .inputValidator((d: { lat?: number; lon?: number }) => d)
  .handler(async ({ data }): Promise<LiveTrafficBriefing | null> => {
    const key = process.env.TOMTOM_API_KEY;
    if (!key) return null;

    const lat = Number.isFinite(data.lat) ? Number(data.lat) : 39.9526;
    const lon = Number.isFinite(data.lon) ? Number(data.lon) : -75.1652;
    const cacheKey = trafficCacheKey(lat, lon);
    const cached = trafficCache.get(cacheKey);

    if (cached && cached.until > Date.now()) return cached.data;

    const pending = inFlightTraffic.get(cacheKey);
    if (pending) return pending;

    const request = requestTomTomTraffic(lat, lon, key, cacheKey);
    inFlightTraffic.set(cacheKey, request);
    return request;
  });
