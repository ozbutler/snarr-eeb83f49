import { useApp } from "@/lib/weather/AppContext";
import { describeCode, fmtTemp, morningBrief, outfitFor, rainWindow } from "@/lib/weather/weatherUtils";
import { ConfidenceBadge, VerifiedBadge } from "./Confidence";

export function MorningSummaryCard() {
  const { forecast, selected, units } = useApp();
  if (!forecast) return null;
  const { current, today, hourly, confidence, sources } = forecast;
  const desc = describeCode(today.weatherCode, current.isDay);
  const window = rainWindow(hourly);
  const outfit = outfitFor(today.high, today.rainChance);
  const outfitLine = outfit.extra ? `${outfit.main}, ${outfit.extra.toLowerCase()}.` : `${outfit.main}.`;

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-5 text-foreground shadow-[var(--shadow-soft)]"
      style={{ background: "var(--gradient-sky)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {selected.label}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="text-4xl leading-none drop-shadow-sm">{desc.emoji}</div>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <div className="text-[56px] leading-none font-semibold tracking-tight">{fmtTemp(current.temp, units)}</div>
        <div className="pb-1 text-[12px] text-muted-foreground space-y-0.5">
          <div>H {fmtTemp(today.high, units)} · L {fmtTemp(today.low, units)}</div>
          <div>Feels {fmtTemp(current.feelsLike, units)} · 💧 {today.rainChance}%</div>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-foreground/85">
        {morningBrief(today.high, today.low, today.rainChance, today.weatherCode)}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-background/40 backdrop-blur-sm p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Rain</div>
          <div className="text-sm font-medium mt-0.5">
            {today.rainChance}% · {window ?? "none expected"}
          </div>
        </div>
        <div className="rounded-xl bg-background/40 backdrop-blur-sm p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">What to wear</div>
          <div className="text-sm font-medium mt-0.5">👕 {outfit.main}</div>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-foreground/70">{outfitLine}</p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <ConfidenceBadge level={confidence} sources={sources} compact />
        <VerifiedBadge sources={sources} />
      </div>
    </section>
  );
}