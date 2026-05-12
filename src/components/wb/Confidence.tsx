import type { Confidence } from "@/lib/weather/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MAP: Record<Confidence, { emoji: string; label: string; short: string; tip: string; cls: string; explain: string }> = {
  high: {
    emoji: "✅",
    label: "Forecast confidence: High",
    short: "High",
    tip: "Weather sources strongly agree.",
    cls: "bg-[color:var(--confidence-high)]/15 text-[color:var(--confidence-high)]",
    explain: "Forecast sources closely agree on temperatures and precipitation.",
  },
  moderate: {
    emoji: "⚠️",
    label: "Forecast confidence: Moderate",
    short: "Moderate",
    tip: "Minor differences between forecasts.",
    cls: "bg-[color:var(--confidence-mid)]/20 text-[color:oklch(0.45_0.12_70)]",
    explain: "Forecast sources show some variation in expected conditions.",
  },
  low: {
    emoji: "❓",
    label: "Forecast confidence: Low",
    short: "Low",
    tip: "Forecasts vary significantly today.",
    cls: "bg-[color:var(--confidence-low)]/15 text-[color:var(--confidence-low)]",
    explain: "Forecast providers significantly disagree. Conditions may change.",
  },
};

export function ConfidenceBadge({ level, sources, compact = false }: { level: Confidence; sources?: string[]; compact?: boolean }) {
  const m = MAP[level];
  const text = compact ? `Confidence · ${m.short}` : m.label;
  const singleSource = !sources || sources.length <= 1;
  // When only one source responded, confidence is forced to moderate upstream,
  // so we tailor the moderate explanation to that case for consistency.
  const explanation =
    level === "moderate" && singleSource
      ? `Only one source was available${sources && sources[0] ? ` (${sources[0]})` : ""}, so confidence defaults to moderate.`
      : m.explain;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:opacity-90 transition " + m.cls}
          aria-label={`${m.label}. Tap for details.`}
        >
          <span>{m.emoji}</span>
          <span>{text}</span>
          {sources && sources.length > 0 && (
            <span className="opacity-70 hidden sm:inline">· {sources.join(" + ")}</span>
          )}
          <span className="opacity-60 ml-0.5">ⓘ</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-sm">
          <span>{m.emoji}</span>
          <span>{m.short} confidence</span>
        </div>
        <p className="text-muted-foreground leading-relaxed">{explanation}</p>
        {!singleSource && sources && (
          <p className="text-muted-foreground leading-relaxed">
            Compared sources: {sources.join(" and ")}.
          </p>
        )}
        <p className="text-muted-foreground leading-relaxed pt-1 border-t border-border/50">
          Confidence is estimated by comparing forecast agreement across available weather providers.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function VerifiedBadge({ sources }: { sources: string[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80">
      <span className="opacity-70">🔎</span>
      <span>Verified · {sources.length} source{sources.length === 1 ? "" : "s"}</span>
    </span>
  );
}