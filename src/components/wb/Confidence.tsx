import type { Confidence } from "@/lib/weather/types";

const MAP: Record<Confidence, { emoji: string; label: string; short: string; tip: string; cls: string }> = {
  high: {
    emoji: "✅",
    label: "Forecast confidence: High",
    short: "High",
    tip: "Weather sources strongly agree.",
    cls: "bg-[color:var(--confidence-high)]/15 text-[color:var(--confidence-high)]",
  },
  moderate: {
    emoji: "⚠️",
    label: "Forecast confidence: Moderate",
    short: "Moderate",
    tip: "Minor differences between forecasts.",
    cls: "bg-[color:var(--confidence-mid)]/20 text-[color:oklch(0.45_0.12_70)]",
  },
  low: {
    emoji: "❓",
    label: "Forecast confidence: Low",
    short: "Low",
    tip: "Forecasts vary significantly today.",
    cls: "bg-[color:var(--confidence-low)]/15 text-[color:var(--confidence-low)]",
  },
};

export function ConfidenceBadge({ level, sources, compact = false }: { level: Confidence; sources?: string[]; compact?: boolean }) {
  const m = MAP[level];
  const text = compact ? `Confidence · ${m.short}` : m.label;
  return (
    <div className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium " + m.cls} title={m.tip}>
      <span>{m.emoji}</span>
      <span>{text}</span>
      {sources && sources.length > 0 && (
        <span className="opacity-70 hidden sm:inline">· {sources.join(" + ")}</span>
      )}
    </div>
  );
}

export function VerifiedBadge({ sources }: { sources: string[] }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/80">
      <span className="opacity-70">🔎</span>
      <span>Verified · {sources.length} source{sources.length === 1 ? "" : "s"}</span>
    </span>
  );
}