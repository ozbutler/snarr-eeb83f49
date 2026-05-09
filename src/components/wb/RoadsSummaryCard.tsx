import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/weather/AppContext";
import { buildRoadBriefing } from "@/lib/weather/trafficUtils";

export function RoadsSummaryCard() {
  const { forecast } = useApp();
  if (!forecast) return null;
  const brief = buildRoadBriefing(forecast.today.weatherCode, forecast.today.rainChance);

  return (
    <Link to="/roads" className="block group">
      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] group-hover:shadow-[var(--shadow-soft)] transition-shadow">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Roads & Traffic</h3>
          <span className="text-xl">{brief.icon}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-base">{brief.emoji}</span>
          <span className="text-sm font-medium capitalize">{brief.level} traffic</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{brief.summary}</p>
        <p className="mt-1 text-xs text-foreground/70">{brief.recommendation}</p>
      </section>
    </Link>
  );
}