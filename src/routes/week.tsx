import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { useApp } from "@/lib/weather/AppContext";
import { WeatherCard } from "@/components/wb/WeatherCard";
import { ConfidenceBadge, VerifiedBadge } from "@/components/wb/Confidence";
import type { DailyForecast } from "@/lib/weather/types";
import { forecastDateLocalKey, localDateKey } from "@/lib/weather/weatherUtils";

export const Route = createFileRoute("/week")({
  head: () => ({
    meta: [
      { title: "Week Ahead — Weather Brief" },
      { name: "description", content: "Compact 7-day forecast with clothing recommendations and rain chance." },
      { property: "og:title", content: "Week Ahead — Weather Brief" },
      { property: "og:description", content: "7-day weather outlook with clothing tips." },
    ],
  }),
  component: WeekPage,
});

function WeekPage() {
  return (
    <PageShell>
      <Content />
    </PageShell>
  );
}

function Content() {
  const { forecast, selected } = useApp();
  if (!forecast) return null;
  const week = buildSevenDayList(forecast.daily);
  return (
    <>
      <section className="rounded-3xl p-5 shadow-[var(--shadow-soft)]" style={{ background: "var(--gradient-sky)" }}>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{selected.label}</p>
        <h2 className="text-lg font-semibold mt-0.5">7-day outlook</h2>
        <div className="mt-2.5 flex items-center justify-between">
          <ConfidenceBadge level={forecast.confidence} sources={forecast.sources} compact />
          <VerifiedBadge sources={forecast.sources} />
        </div>
      </section>
      <div className="space-y-2">
        {week.map((d, i) => (
          <WeatherCard key={d.date} day={d} isToday={i === 0} />
        ))}
      </div>
    </>
  );
}

// Build exactly 7 cards starting at today's local date. Match forecast
// entries by local YYYY-MM-DD; fill any missing day with a neutral
// placeholder derived from the nearest available day so the order stays
// stable across refresh, location changes, and unit toggles.
function buildSevenDayList(daily: DailyForecast[]): DailyForecast[] {
  const byDate = new Map<string, DailyForecast>();
  for (const d of daily) {
    byDate.set(forecastDateLocalKey(d.date), d);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: DailyForecast[] = [];
  const fallback = daily[0];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + i);
    const key = localDateKey(dt);
    const match = byDate.get(key);
    if (match) {
      out.push(match);
    } else if (fallback) {
      out.push({ ...fallback, date: key });
    }
  }
  return out;
}