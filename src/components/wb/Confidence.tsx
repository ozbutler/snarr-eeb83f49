import type { Confidence } from "@/lib/weather/types";
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

export function ConfidenceBadge({ level, sources }: { level: Confidence; sources?: string[]; compact?: boolean }) {
  const m = MAP[level];
  const label = compatibilitySourceLabel(level, sources);

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
          Snarr compares available weather providers for temperature, rain chance, and feels-like conditions.
          Some metrics may use fewer sources depending on provider availability.
        </p>
        {sources && sources.length > 0 && (
          <p className="text-muted-foreground leading-relaxed">
            Providers used: {sources.join(" and ")}.
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
