import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { useApp } from "@/lib/weather/AppContext";
import { buildRoadBriefing } from "@/lib/weather/trafficUtils";
import { CollapsibleCard } from "@/components/wb/CollapsibleCard";

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
      <section className="rounded-3xl p-5 shadow-[var(--shadow-soft)]" style={{ background: "var(--gradient-sky)" }}>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{selected.label}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="text-4xl">{brief.icon}</div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-1.5">
              <span>{brief.emoji}</span>
              <span>{brief.level[0].toUpperCase() + brief.level.slice(1)} traffic</span>
            </h2>
            <p className="text-[13px] text-muted-foreground">{brief.summary}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `color-mix(in oklab, ${levelTone} 18%, transparent)`, color: levelTone }}
          >
            Traffic · {brief.level}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-foreground/80">
            <span>{brief.roadEmoji}</span>
            <span>Roads · {brief.roadLabel}</span>
          </span>
        </div>
      </section>

      <CollapsibleCard
        id="roads:impact"
        title="Weather impact on roads"
        icon={brief.roadEmoji}
        defaultOpen
        summary={brief.weatherImpact}
      >
        <p className="text-sm text-muted-foreground">{brief.weatherImpact}</p>
      </CollapsibleCard>

      <CollapsibleCard
        id="roads:recommendation"
        title="Driving recommendation"
        icon="🧭"
        defaultOpen
        summary={brief.recommendation}
      >
        <p className="text-sm text-foreground">{brief.recommendation}</p>
      </CollapsibleCard>

      {brief.alerts.length > 0 && (
        <CollapsibleCard
          id="roads:alerts"
          title="Road alerts"
          icon="⚠️"
          tone="alert"
          defaultOpen
          summary={`${brief.alerts.length} alert${brief.alerts.length === 1 ? "" : "s"}`}
        >
          <ul className="space-y-1 text-sm">
            {brief.alerts.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        </CollapsibleCard>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Traffic estimated from time of day, day of week, and current weather.
      </p>
    </>
  );
}