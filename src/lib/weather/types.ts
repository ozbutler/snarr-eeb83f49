// Shared types used across the weather app.

export type Units = "F" | "C";

export interface LocationOption {
  id: string;
  label: string;        // "Philadelphia, PA"
  lat: number;
  lon: number;
  custom?: boolean;     // true if user-added (removable)
  current?: boolean;    // true for the dynamic "Current Location" entry
}

export interface DailyForecast {
  date: string;         // ISO date
  high: number;         // °F
  low: number;          // °F
  feelsHigh: number;    // °F apparent max
  rainChance: number;   // 0-100
  weatherCode: number;  // WMO
}

export interface HourlyPoint {
  time: string;         // ISO
  temp: number;         // °F
  feelsLike: number;    // °F
  rainChance: number;   // 0-100
  weatherCode: number;  // WMO
}

export interface CurrentWeather {
  temp: number;         // °F
  feelsLike: number;    // °F
  weatherCode: number;
  isDay: boolean;
}

export type Confidence = "high" | "moderate" | "low";

export interface ForecastBundle {
  current: CurrentWeather;
  today: DailyForecast;
  daily: DailyForecast[];        // 7 days incl today
  hourly: HourlyPoint[];         // next ~24h
  alerts: string[];              // severe alert headlines (NWS for US)
  confidence: Confidence;        // multi-source agreement
  sources: string[];             // names of sources that responded
  updatedAt: number;             // epoch ms
}