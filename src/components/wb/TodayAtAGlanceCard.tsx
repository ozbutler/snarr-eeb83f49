import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/weather/AppContext";
import { buildRoadBriefing } from "@/lib/weather/trafficUtils";
import { describeCode, fmtTemp } from "@/lib/weather/weatherUtils";

function label(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}

export function TodayAtAGlanceCard() {
  const { forecast, units } = useApp();
  if (!forecast) return null;

  const desc = describeCode(forecast.today.weatherCode, forecast.current.isDay);
  const road = buildRoadBriefing(forecast.today.weatherCode, forecast.today.rainChance);

  const rows = [
    {
      icon: desc.emoji,
      title: "Weather",
      summary: `${desc.label} · H ${fmtTemp(forecast.today.high, units)} · 💧 ${forecast.today.rainChance}%`,
      to: "/weather" as const,
      link: "Details",
    },
    {
      icon: road.emoji,
      title: "Roads",
      summary: `${label(road.level)} traffic · ${road.recommendation}`,
      to: "/roads" as const,
      link: "Roads",
    },
    {
      icon: "📰",
      title: "News",
      summary: "Daily briefing ready",
      to: "/news" as const,
      link: "Briefing",
    },
  ];

  return (
    <section className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold text-foreground">Today at a Glance</h2>
        <span className="text-[11px] text-muted-foreground">Weather · Roads · News</span>
      </div>

      <div className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <Link
            key={row.title}
            to={row.to}
            className="flex items-center gap-3 rounded-xl bg-secondary/45 px-3 py-2.5 hover:bg-secondary/60 transition-colors"
          >
            <span className="text-xl shrink-0">{row.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-foreground">{row.title}</span>
              <span className="block text-[11px] text-muted-foreground truncate">{row.summary}</span>
            </span>
            <span className="text-[11px] text-primary font-medium shrink-0">{row.link} →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
