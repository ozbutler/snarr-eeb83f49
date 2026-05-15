import type { ForecastSourceDetails, WeatherMetric } from './types';

export const CONFLICT_THRESHOLDS = {
  temperature: 7,
  rainChance: 30,
  uvIndex: 3,
} as const;

function isUsable(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function buildMetric({
  metricName,
  values,
  conflictThreshold,
}: {
  metricName: string;
  values: Record<string, number | null | undefined>;
  conflictThreshold: number;
}): WeatherMetric {
  const rawValues = Object.fromEntries(
    Object.entries(values).filter(([, value]) => isUsable(value)),
  ) as Record<string, number>;

  const sources = Object.keys(rawValues);
  const numericValues = Object.values(rawValues);

  const value = numericValues.length
    ? Math.round(numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length)
    : null;

  const spread = numericValues.length > 1
    ? Math.max(...numericValues) - Math.min(...numericValues)
    : 0;

  return {
    metricName,
    value,
    sources,
    sourceCount: sources.length,
    hasConflict: spread > conflictThreshold,
    rawValues,
  };
}

export function buildSourceDetails({
  providersResponded,
  metrics,
  alertsSource,
}: {
  providersResponded: string[];
  metrics: Record<string, WeatherMetric>;
  alertsSource?: string;
}): ForecastSourceDetails {
  return {
    providersResponded: Array.from(new Set(providersResponded)),
    metrics,
    averagedMetrics: Object.values(metrics)
      .filter((metric) => metric.sourceCount > 1)
      .map((metric) => metric.metricName),
    varyingMetrics: Object.values(metrics)
      .filter((metric) => metric.hasConflict)
      .map((metric) => metric.metricName),
    alertsSource,
  };
}

export function getSourceBadge(details?: ForecastSourceDetails): string {
  if (!details) return '1 source';

  if (details.varyingMetrics.length > 0) {
    return '⚖️ Sources vary';
  }

  const maxSources = Math.max(
    0,
    ...Object.values(details.metrics).map((metric) => metric.sourceCount),
  );

  if (maxSources >= 3) return `🔎 ${maxSources} sources`;
  if (maxSources >= 2) return '📊 Multiple sources';

  return '1 source';
}
