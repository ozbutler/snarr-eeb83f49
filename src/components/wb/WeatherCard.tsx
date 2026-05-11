import { useApp } from "@/lib/weather/AppContext";
import type { DailyForecast } from "@/lib/weather/types";
import { describeCode, fmtTemp, parseForecastDateLocal } from "@/lib/weather/weatherUtils";
import { outfitChips } from "@/lib/weather/trafficUtils";

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
    <article className="rounded-2xl bg-card p-3.5 shadow-[var(--shadow-card)] flex items-center gap-3 min-h-[88px]">
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
    </article>
  );
}