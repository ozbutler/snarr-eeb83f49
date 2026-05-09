import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { useApp } from "@/lib/weather/AppContext";
import { buildRoadBriefing } from "@/lib/weather/trafficUtils";

export const Route = createFileRoute("/roads")({
  head: () => ({
    meta: [
      { title: "Roads — Weather Brief" },
      { name: "description", content: "Daily road conditions and traffic briefing based on time, day, and weather." },
      { property: "og:title", content: "Roads — Weather Brief" },
      { property: "og:description", content: "Daily road conditions and traffic briefing." },
    ],
  }),
  component: RoadsPage,
});

function RoadsPage() {
  return (
    <PageShell>
      <Content />
    </PageShell>
  );
}

function Content() {
  const { forecast, selected } = useApp();
  if (!forecast) return null;
  const brief = buildRoadBriefing(forecast.today.weatherCode, forecast.today.rainChance);
  const levelTone =
    brief.level === "low" ? "var(--confidence-high)" :
    brief.level === "moderate" ? "var(--confidence-mid)" :
    "var(--confidence-low)";

  return (
    <>
      <section className="rounded-3xl p-6 shadow-[var(--shadow-soft)]" style={{ background: "var(--gradient-sky)" }}>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{selected.label}</p>
        <div className="mt-1 flex items-center gap-3">
          <div className="text-5xl">{brief.icon}</div>
          <div>
            <h2 className="text-xl font-semibold">{brief.emoji} {brief.level[0].toUpperCase() + brief.level.slice(1)} traffic</h2>
            <p className="text-sm text-muted-foreground">{brief.summary}</p>
          </div>
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
             style={{ backgroundColor: `color-mix(in oklab, ${levelTone} 18%, transparent)`, color: levelTone }}>
          Traffic level · {brief.level}
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h3 className="text-sm font-semibold">Weather impact on roads</h3>
        <p className="mt-1 text-sm text-muted-foreground">{brief.weatherImpact}</p>
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h3 className="text-sm font-semibold">Driving recommendation</h3>
        <p className="mt-1 text-sm text-foreground">{brief.recommendation}</p>
      </section>

      {brief.alerts.length > 0 && (
        <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2"><span>⚠️</span>Road alerts</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {brief.alerts.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        </section>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Traffic estimated from time of day, day of week, and current weather.
      </p>
    </>
  );
}