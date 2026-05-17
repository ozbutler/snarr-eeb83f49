import type { ForecastSourceDetails, WeatherMetric } from './types';

export const CONFLICT_THRESHOLDS = {
  temperature: 7,
  rainChance: 30,
  uvIndex: 3,
} as const;

type AggregationStrategy = 'auto' | 'average' | 'median' | 'max';

function isUsable(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  return sorted[midpoint];
}

function aggregate(values: number[], strategy: AggregationStrategy) {
  if (!values.length) return null;

  if (strategy === 'max') return Math.max(...values);
  if (strategy === 'average') return average(values);
  if (strategy === 'median') return median(values);

  // Auto uses a median once 3+ providers contribute. This keeps one bad
  // provider from skewing temperature-style metrics while preserving the
  // existing average behavior when only two providers respond.
  return values.length >= 3 ? median(values) : average(values);
}

export function buildMetric({
  metricName,
  values,
  conflictThreshold,
  aggregation = 'auto',
}: {
  metricName: string;
  values: Record<string, number | null | undefined>;
  conflictThreshold: number;
  aggregation?: AggregationStrategy;
}): WeatherMetric {
  const rawValues = Object.fromEntries(
    Object.entries(values).filter(([, value]) => isUsable(value)),
  ) as Record<string, number>;

  const sources = Object.keys(rawValues);
  const numericValues = Object.values(rawValues);
  const aggregatedValue = aggregate(numericValues, aggregation);

  const spread = numericValues.length > 1
    ? Math.max(...numericValues) - Math.min(...numericValues)
    : 0;

  return {
    metricName,
    value: aggregatedValue === null ? null : Math.round(aggregatedValue),
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
    providersResponded: Array.from(new Set(providersResponded)).filter(Boolean),
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
  const sourceCount = details?.providersResponded?.length ?? 1;
  return `${sourceCount} source${sourceCount === 1 ? '' : 's'}`;
}
