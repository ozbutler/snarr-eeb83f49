import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { useApp } from "@/lib/weather/AppContext";
import { WeatherCard } from "@/components/wb/WeatherCard";
import { ConfidenceBadge, VerifiedBadge } from "@/components/wb/Confidence";

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
  return (
    <>
      <section className="rounded-3xl p-5 shadow-[var(--shadow-soft)]" style={{ background: "var(--gradient-sky)" }}>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{selected.label}</p>
        <h2 className="text-lg font-semibold mt-0.5">7-day outlook</h2>
        <div className="mt-2.5 flex items-center justify-between">
          <ConfidenceBadge level={forecast.confidence} compact />
          <VerifiedBadge sources={forecast.sources} />
        </div>
      </section>
      <div className="space-y-2">
        {forecast.daily.map((d, i) => (
          <WeatherCard key={d.date} day={d} isToday={i === 0} />
        ))}
      </div>
    </>
  );
}