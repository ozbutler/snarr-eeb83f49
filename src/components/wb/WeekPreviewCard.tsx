import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/weather/AppContext";
import { describeCode, fmtTemp } from "@/lib/weather/weatherUtils";

export function WeekPreviewCard() {
  const { forecast, units } = useApp();
  if (!forecast) return null;
  const days = forecast.daily.slice(1, 4);

  return (
    <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Next 3 Days</h3>
        <Link to="/week" className="text-xs text-primary font-medium">See week →</Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {days.map((d) => {
          const desc = describeCode(d.weatherCode);
          const day = new Date(d.date).toLocaleDateString(undefined, { weekday: "short" });
          return (
            <div key={d.date} className="rounded-xl bg-secondary/50 p-3 text-center">
              <div className="text-xs font-medium text-muted-foreground">{day}</div>
              <div className="text-2xl mt-1">{desc.emoji}</div>
              <div className="mt-1 text-sm font-medium">{fmtTemp(d.high, units)}</div>
              <div className="text-[11px] text-muted-foreground">{fmtTemp(d.low, units)}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">💧 {d.rainChance}%</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}