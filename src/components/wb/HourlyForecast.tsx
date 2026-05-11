import { useApp } from "@/lib/weather/AppContext";
import { describeCode, fmtTemp } from "@/lib/weather/weatherUtils";
import type { HourlyPoint } from "@/lib/weather/types";

function clothingEmoji(temp: number | undefined, rain: number, code: number | undefined): string {
  if (rain >= 50) return "☔";
  if (temp === undefined) return "👕";
  if (temp >= 85) return "🩳";
  if (temp >= 70) {
    // Sunny + warm
    if (code !== undefined && [0, 1].includes(code)) return "🧢";
    return "👕";
  }
  if (temp >= 55) return "👕";
  return "🧥";
}

export function HourlyForecast() {
  const { forecast, units } = useApp();
  if (!forecast) return null;
  const hours: HourlyPoint[] = forecast.hourly.slice(0, 24);
  if (hours.length === 0) return null;

  const nowH = new Date().getHours();

  return (
    <section className="rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <span>⏰</span> Hourly Forecast
        </h3>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Next 24h</span>
      </div>
      <div
        className="flex gap-2 overflow-x-auto px-3 pb-3.5 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none" }}
      >
        {hours.map((h, i) => {
          const d = new Date(h.time);
          const isCurrent = d.getHours() === nowH && i < 2;
          const desc = describeCode(h.weatherCode ?? 0, d.getHours() >= 6 && d.getHours() < 19);
          const timeLabel = isCurrent
            ? "Now"
            : d.toLocaleTimeString([], { hour: "numeric" }).replace(" ", "").toLowerCase();
          const cloth = clothingEmoji(h.temp, h.rainChance, h.weatherCode);
          return (
            <div
              key={h.time}
              className={
                "snap-start shrink-0 w-[68px] rounded-xl px-2 py-2.5 flex flex-col items-center gap-1 transition " +
                (isCurrent
                  ? "bg-primary/10 border-2 border-primary/40 shadow-[var(--shadow-card)] text-foreground"
                  : "bg-secondary/50 border border-border/60 text-foreground/90")
              }
            >
              <div className={"text-[10px] uppercase tracking-wide " + (isCurrent ? "font-semibold text-primary" : "text-muted-foreground")}>
                {timeLabel}
              </div>
              <div className="text-xl leading-none">{desc.emoji}</div>
              <div className={"text-[13px] " + (isCurrent ? "font-bold" : "font-semibold")}>
                {h.temp !== undefined ? fmtTemp(h.temp, units) : "—"}
              </div>
              {h.feelsLike !== undefined && (
                <div className="text-[9.5px] text-muted-foreground leading-none">
                  feels {fmtTemp(h.feelsLike, units)}
                </div>
              )}
              <div className="text-[10px] text-blue-500/90 dark:text-blue-300/90 leading-none">
                💧 {h.rainChance}%
              </div>
              <div className="text-sm leading-none">{cloth}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}