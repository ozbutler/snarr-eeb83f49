import type { ForecastSourceDetails } from "@/lib/weather/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSourceBadge } from "@/lib/weather/sourceTransparency";

export function SourceBadge({ details }: { details?: ForecastSourceDetails }) {
  const label = getSourceBadge(details);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground cursor-pointer hover:opacity-90 transition"
          aria-label="Weather source details"
        >
          <span>{label}</span>
          <span className="opacity-60 ml-0.5">ⓘ</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72 text-xs space-y-2">
        <div className="font-medium text-sm">Weather source details</div>
        <p className="text-muted-foreground leading-relaxed">
          Snarr compared available weather providers for temperature, rain chance, and feels-like conditions.
          Some metrics may use fewer sources depending on provider availability.
        </p>
        {details?.providersResponded?.length ? (
          <p className="text-muted-foreground leading-relaxed">
            Providers used: {details.providersResponded.join(" and ")}.
          </p>
        ) : null}
        {details?.averagedMetrics?.length ? (
          <p className="text-muted-foreground leading-relaxed">
            Averaged metrics: {details.averagedMetrics.join(", ")}.
          </p>
        ) : null}
        {details?.varyingMetrics?.length ? (
          <p className="text-muted-foreground leading-relaxed">
            Sources vary for: {details.varyingMetrics.join(", ")}.
          </p>
        ) : null}
        {details?.alertsSource ? (
          <p className="text-muted-foreground leading-relaxed pt-1 border-t border-border/50">
            Weather alerts come from {details.alertsSource}.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function CompactSourceCount({ sources }: { sources: string[] }) {
  if (!sources.length) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
      <span>{sources.length} source{sources.length === 1 ? "" : "s"}</span>
    </span>
  );
}
