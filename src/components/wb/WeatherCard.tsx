import { useApp } from "@/lib/weather/AppContext";
import type { DailyForecast, PeriodSummary } from "@/lib/weather/types";
import { describeCode, fmtTemp, parseForecastDateLocal } from "@/lib/weather/weatherUtils";
import { toUnit } from "@/lib/weather/weatherUtils";
import { outfitChips } from "@/lib/weather/trafficUtils";
import type { Units } from "@/lib/weather/types";

export function WeatherCard({ day, isToday }: { day: DailyForecast; isToday?: boolean }) {
  const { units } = useApp();
  const desc = describeCode(day.weatherCode);
  const chips = outfitChips(day.high, day.rainChance);
  const displayDate = parseForecastDateLocal(day.date);
  const dayName = isToday
    ? "Today"
    : displayDate.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = displayDate.toLocaleDateString(undefined, {
    ...(isToday ? { weekday: "long" as const } : {}),
    month: "short",
    day: "numeric",
  });

  return (
    <article className="rounded-2xl bg-card p-3.5 shadow-[var(--shadow-card)] min-h-[88px]">
      <div className="flex items-center gap-3">
        <div className="text-3xl w-10 text-center shrink-0">{desc.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h4 className="text-sm font-semibold text-foreground">{dayName}</h4>
            <span className="text-[11px] text-muted-foreground">{dateStr}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{desc.label} · 💧 {day.rainChance}%</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {chips.map((c) => (
              <span
                key={c.text}
                className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] text-foreground/80"
              >
                <span>{c.icon}</span>
                <span>{c.text}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-semibold leading-tight">{fmtTemp(day.high, units)}</div>
          <div className="text-xs text-muted-foreground leading-tight">{fmtTemp(day.low, units)}</div>
          <div className="text-[10px] text-muted-foreground/80 mt-0.5">feels {fmtTemp(day.feelsHigh, units)}</div>
        </div>
      </div>
      {day.periods && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <PeriodPill icon="🌅" label="Morning" p={day.periods.morning} units={units} />
          <PeriodPill icon="☀️" label="Afternoon" p={day.periods.afternoon} units={units} />
          <PeriodPill icon="🌙" label="Evening" p={day.periods.evening} units={units} />
        </div>
      )}
    </article>
  );
}

function PeriodPill({
  icon,
  label,
  p,
  units,
}: {
  icon: string;
  label: string;
  p: PeriodSummary;
  units: Units;
}) {
  const tempRange = formatRange(p.tempMin, p.tempMax, units, true);
  const feelsRange = formatRange(p.feelsMin, p.feelsMax, units, true);
  const rain = p.rainPct !== undefined ? `${p.rainPct}%` : "--";
  const uv =
    p.uvMin !== undefined && p.uvMax !== undefined
      ? p.uvMin === p.uvMax
        ? `${p.uvMin}`
        : `${p.uvMin}–${p.uvMax}`
      : "--";
  return (
    <div className="rounded-xl bg-secondary/50 border border-border/60 px-2 py-1.5 min-w-0">
      <div className="flex items-center gap-1 text-[10px] font-medium text-foreground/80">
        <span>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 text-[10.5px] font-semibold text-foreground leading-tight truncate">
        {tempRange}
      </div>
      <div className="text-[9.5px] text-muted-foreground leading-tight truncate">
        feels {feelsRange}
      </div>
      <div className="text-[9.5px] text-muted-foreground leading-tight truncate">
        💧 {rain} · UV {uv}
      </div>
    </div>
  );
}

function formatRange(min: number | undefined, max: number | undefined, units: Units, deg = false): string {
  if (min === undefined || max === undefined) return "--";
  const lo = Math.round(toUnit(min, units));
  const hi = Math.round(toUnit(max, units));
  const suf = deg ? "°" : "";
  return lo === hi ? `${lo}${suf}` : `${lo}–${hi}${suf}`;
}