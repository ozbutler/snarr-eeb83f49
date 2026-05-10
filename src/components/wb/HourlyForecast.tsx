import { useApp } from "@/lib/weather/AppContext";
import { describeCode, fmtTemp } from "@/lib/weather/weatherUtils";

// Vertical 12-hour forecast list. Each row: time · icon · temp · feels · rain%.
export function HourlyForecast() {
  const { forecast, units } = useApp();
  if (!forecast || forecast.hourly.length === 0) return null;
  const next = forecast.hourly.slice(0, 12);
  if (next.length === 0) return null;

  return (
    <ul className="divide-y divide-border/60">
      {next.map((h, i) => {
        const d = new Date(h.time);
        const desc = describeCode(h.weatherCode, true);
        const time = i === 0 ? "Now" : d.toLocaleTimeString([], { hour: "numeric" });
        return (
          <li key={h.time} className="flex items-center gap-3 py-2.5">
            <div className="w-12 text-[12px] text-muted-foreground font-medium">{time}</div>
            <div className="text-xl w-7 text-center" title={desc.label}>{desc.emoji}</div>
            <div className="flex-1">
              <div className="text-[14px] font-medium leading-tight">{fmtTemp(h.temp, units)}</div>
              <div className="text-[11px] text-muted-foreground leading-tight">
                Feels {fmtTemp(h.feelsLike, units)}
              </div>
            </div>
            <div className="text-[12px] text-foreground/80 tabular-nums w-12 text-right">
              💧 {h.rainChance}%
            </div>
          </li>
        );
      })}
    </ul>
  );
}