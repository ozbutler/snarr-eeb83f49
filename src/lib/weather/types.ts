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
  periods?: DayPeriods;
}

export interface HourlyPoint {
  time: string;         // ISO
  rainChance: number;   // 0-100
  temp?: number;        // °F
  feelsLike?: number;   // °F
  weatherCode?: number; // WMO
  uvIndex?: number;
}

export interface PeriodSummary {
  tempMin?: number;
  tempMax?: number;
  feelsMin?: number;
  feelsMax?: number;
  rainPct?: number;
  uvMin?: number;
  uvMax?: number;
}

export interface DayPeriods {
  morning: PeriodSummary;
  afternoon: PeriodSummary;
  evening: PeriodSummary;
}

export interface CurrentWeather {
  temp: number;         // °F
  feelsLike: number;    // °F
  weatherCode: number;
  isDay: boolean;
}

export type Confidence = "high" | "moderate" | "low";

export interface WeatherMetric {
  metricName: string;
  value: number | null;
  sources: string[];
  sourceCount: number;
  hasConflict: boolean;
  rawValues?: Record<string, number>;
}

export interface ForecastSourceDetails {
  providersResponded: string[];
  metrics: Record<string, WeatherMetric>;
  averagedMetrics: string[];
  varyingMetrics: string[];
  alertsSource?: string;
}

export interface ForecastBundle {
  current: CurrentWeather;
  today: DailyForecast;
  daily: DailyForecast[];        // 7 days incl today
  hourly: HourlyPoint[];         // next ~24h
  alerts: string[];              // severe alert headlines (NWS for US)
  confidence: Confidence;        // legacy field kept for compatibility
  sources: string[];             // names of sources that responded
  sourceDetails?: ForecastSourceDetails;
  updatedAt: number;             // epoch ms
}