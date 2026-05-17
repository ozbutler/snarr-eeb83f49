import type { Confidence, ForecastSourceDetails, WeatherMetric } from "@/lib/weather/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { compatibilitySourceLabel } from "@/components/wb/ConfidenceSourceBadge";

const MAP: Record<Confidence, { cls: string }> = {
  high: {
    cls: "bg-[color:var(--confidence-high)]/15 text-[color:var(--confidence-high)]",
  },
  moderate: {
    cls: "bg-[color:var(--confidence-mid)]/20 text-[color:oklch(0.45_0.12_70)]",
  },
  low: {
    cls: "bg-[color:var(--confidence-low)]/15 text-[color:var(--confidence-low)]",
  },
};

export function formatProviderList(sources?: string[]) {
  if (!sources || sources.length === 0) return "no providers";
  if (sources.length === 1) return sources[0];
  if (sources.length === 2) return `${sources[0]} and ${sources[1]}`;
  return `${sources.slice(0, -1).join(", ")}, and ${sources[sources.length - 1]}`;
}

function metricRange(metric?: WeatherMetric, suffix = "") {
  const values = Object.values(metric?.rawValues ?? {}).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  const min = Math.round(Math.min(...values));
  const max = Math.round(Math.max(...values));
  if (min === max) return `${min}${suffix}`;
  return `${min}${suffix} to ${max}${suffix}`;
}

function getLargestSpreadMetric(details?: ForecastSourceDetails) {
  if (!details?.metrics) return null;

  return Object.values(details.metrics)
    .map((metric) => {
      const values = Object.values(metric.rawValues ?? {}).filter((value) => Number.isFinite(value));
      const spread = values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
      return { metric, spread };
    })
    .filter(({ spread }) => spread > 0)
    .sort((a, b) => b.spread - a.spread)[0]?.metric ?? null;
}

export function getConfidenceExplanation(level: Confidence, details?: ForecastSourceDetails) {
  const sourceCount = details?.providersResponded?.length ?? 0;
  const providerText = `${sourceCount || 1} forecast provider${sourceCount === 1 ? "" : "s"} compared.`;
  const tempRange = metricRange(details?.metrics.currentTemp, "°F");
  const highRange = metricRange(details?.metrics.dailyHigh, "°F");
  const rainRange = metricRange(details?.metrics.rainChance, "%");
  const largest = getLargestSpreadMetric(details);

  const agreement = level === "high"
    ? "Providers are closely aligned on the main forecast."
    : level === "moderate"
      ? "Providers mostly agree, with some small differences."
      : largest
        ? `Providers differ most on ${largest.metricName.toLowerCase()}.`
        : "Providers differ on one or more forecast details.";

  const ranges = [
    highRange ? `High: ${highRange}` : null,
    tempRange ? `Current: ${tempRange}` : null,
    rainRange ? `Rain: ${rainRange}` : null,
  ].filter(Boolean).join(" · ");

  return {
    providerText,
    agreement,
    ranges,
  };
}

export function ConfidenceBadge({
  level,
  sources,
  details,
}: {
  level: Confidence;
  sources?: string[];
  details?: ForecastSourceDetails;
  compact?: boolean;
}) {
  const m = MAP[level];
  const label = compatibilitySourceLabel(level, sources);
  const explanation = getConfidenceExplanation(level, details);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-90 transition " + m.cls}
          aria-label="Weather source details. Tap for details."
        >
          <span>{label}</span>
          <span className="opacity-60 ml-0.5">ⓘ</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72 text-xs space-y-2">
        <div className="font-medium text-sm">Weather source details</div>
        <p className="text-muted-foreground leading-relaxed">
          {explanation.providerText} {explanation.agreement}
        </p>
        {explanation.ranges ? (
          <p className="text-muted-foreground leading-relaxed">
            {explanation.ranges}.
          </p>
        ) : null}
        {sources && sources.length > 0 && (
          <p className="text-muted-foreground leading-relaxed">
            Providers used: {formatProviderList(sources)}.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function VerifiedBadge({ sources }: { sources: string[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80">
      <span>{sources.length} source{sources.length === 1 ? "" : "s"}</span>
    </span>
  );
}
