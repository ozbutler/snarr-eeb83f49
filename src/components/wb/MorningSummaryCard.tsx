import { useApp } from "@/lib/weather/AppContext";
import { describeCode, fmtTemp, morningBrief } from "@/lib/weather/weatherUtils";
import { ConfidenceBadge, VerifiedBadge } from "./Confidence";

export function MorningSummaryCard() {
  const { forecast, selected, units } = useApp();
  if (!forecast) return null;
  const { current, today, confidence, sources } = forecast;
  const desc = describeCode(today.weatherCode, current.isDay);

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-6 text-foreground shadow-[var(--shadow-soft)]"
      style={{ background: "var(--gradient-sky)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {selected.label}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="text-5xl leading-none drop-shadow-sm">{desc.emoji}</div>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <div className="text-6xl font-semibold tracking-tight">{fmtTemp(current.temp, units)}</div>
        <div className="pb-2 text-sm text-muted-foreground">
          <div>H {fmtTemp(today.high, units)} · L {fmtTemp(today.low, units)}</div>
          <div>Feels {fmtTemp(current.feelsLike, units)}</div>
        </div>
      </div>

      <p className="mt-3 text-sm text-foreground/85">
        {morningBrief(today.high, today.low, today.rainChance, today.weatherCode)}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <ConfidenceBadge level={confidence} />
        <VerifiedBadge sources={sources} />
      </div>
    </section>
  );
}