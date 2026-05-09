import { useApp } from "@/lib/weather/AppContext";
import { rainWindow } from "@/lib/weather/weatherUtils";

export function RainAlertsCard() {
  const { forecast } = useApp();
  if (!forecast) return null;
  const { today, hourly, alerts } = forecast;
  const window = rainWindow(hourly);

  return (
    <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Rain & Alerts</h3>
        <span className="text-xl">🌧️</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-xs text-muted-foreground">Rain chance</div>
          <div className="text-2xl font-semibold">{today.rainChance}%</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-xs text-muted-foreground">Most likely</div>
          <div className="text-base font-medium mt-1">{window ?? "No rain expected"}</div>
        </div>
      </div>

      <div className="mt-3">
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">✅ No major weather alerts.</p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a, i) => (
              <li key={i} className="text-xs text-destructive flex gap-2">
                <span>⚠️</span><span>{a}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}