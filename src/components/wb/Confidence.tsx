import type { Confidence } from "@/lib/weather/types";

const MAP: Record<Confidence, { emoji: string; label: string; tip: string; cls: string }> = {
  high: {
    emoji: "✅",
    label: "Forecast confidence: High",
    tip: "Weather sources strongly agree.",
    cls: "bg-[color:var(--confidence-high)]/15 text-[color:var(--confidence-high)]",
  },
  moderate: {
    emoji: "⚠️",
    label: "Forecast confidence: Moderate",
    tip: "Minor differences between forecasts.",
    cls: "bg-[color:var(--confidence-mid)]/20 text-[color:oklch(0.45_0.12_70)]",
  },
  low: {
    emoji: "❓",
    label: "Forecast confidence: Low",
    tip: "Forecasts vary significantly today.",
    cls: "bg-[color:var(--confidence-low)]/15 text-[color:var(--confidence-low)]",
  },
};

export function ConfidenceBadge({ level, sources }: { level: Confidence; sources?: string[] }) {
  const m = MAP[level];
  return (
    <div className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium " + m.cls} title={m.tip}>
      <span>{m.emoji}</span>
      <span>{m.label}</span>
      {sources && sources.length > 0 && (
        <span className="opacity-70 hidden sm:inline">· {sources.join(" + ")}</span>
      )}
    </div>
  );
}

export function VerifiedBadge({ sources }: { sources: string[] }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <span>🔎</span>
      <span>Verified across {sources.length} source{sources.length === 1 ? "" : "s"}</span>
    </span>
  );
}