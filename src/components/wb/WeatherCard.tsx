import { useApp } from "@/lib/weather/AppContext";
import type { DailyForecast } from "@/lib/weather/types";
import { describeCode, fmtTemp, outfitFor } from "@/lib/weather/weatherUtils";

export function WeatherCard({ day, isToday }: { day: DailyForecast; isToday?: boolean }) {
  const { units } = useApp();
  const desc = describeCode(day.weatherCode);
  const outfit = outfitFor(day.high, day.rainChance);
  const dayName = isToday
    ? "Today"
    : new Date(day.date).toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = new Date(day.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <article className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] flex items-center gap-4">
      <div className="text-4xl w-12 text-center">{desc.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h4 className="text-sm font-semibold text-foreground">{dayName}</h4>
          <span className="text-[11px] text-muted-foreground">{dateStr}</span>
        </div>
        <p className="text-xs text-muted-foreground">{desc.label} · 💧 {day.rainChance}%</p>
        <p className="mt-1 text-[11px] text-foreground/70 truncate">
          👕 {outfit.main}{outfit.extra ? ` · ☂️ ${outfit.extra}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-base font-semibold">{fmtTemp(day.high, units)}</div>
        <div className="text-xs text-muted-foreground">{fmtTemp(day.low, units)}</div>
        <div className="text-[10px] text-muted-foreground">feels {fmtTemp(day.feelsHigh, units)}</div>
      </div>
    </article>
  );
}