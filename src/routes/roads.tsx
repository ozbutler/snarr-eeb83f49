import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { useApp } from "@/lib/weather/AppContext";
import { buildRoadBriefing } from "@/lib/weather/trafficUtils";
import { CollapsibleCard } from "@/components/wb/CollapsibleCard";
import { fetchTomTomTraffic } from "@/lib/traffic/tomtomTraffic";
import { trafficEmoji, trafficLabel } from "@/lib/traffic/types";
import { Suspense, lazy, useEffect, useState } from "react";
import type { LiveTrafficBriefing } from "@/lib/traffic/types";

const TrafficMap = lazy(() => import("@/components/wb/TrafficMap").then((module) => ({ default: module.TrafficMap })));

type Tab = "status" | "map";

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
  const [tab, setTab] = useState<Tab>("status");

  return (
    <PageShell>
      <SubTabs value={tab} onChange={setTab} />
      {tab === "status" ? <Content /> : <TrafficMapPanel />}
    </PageShell>
  );
}

function SubTabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: "status", label: "Status" },
    { id: "map", label: "Map" },
  ];

  return (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary/60 p-0.5 text-[12px]">
      {items.map((it) => {
        const active = value === it.id;

        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={
              "rounded-full py-1.5 font-medium transition-all " +
              (active
                ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                : "text-muted-foreground/80 hover:text-foreground")
            }
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function TrafficMapPanel() {
  const { selected } = useApp();

  return (
    <>
      <section
        className="rounded-3xl p-5 shadow-[var(--shadow-soft)]"
        style={{ background: "var(--gradient-sky)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              {selected.label}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              Live traffic map
            </h2>
          </div>

          <div className="text-4xl leading-none">🚦</div>
        </div>

        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Live traffic flow and incidents update automatically for your selected location.
        </p>
      </section>

      <Suspense
        fallback={
          <div className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Loading traffic map…
          </div>
        }
      >
        <TrafficMap
          lat={selected.lat}
          lon={selected.lon}
          label={selected.label}
        />
      </Suspense>

      <p className="text-center text-[11px] text-muted-foreground">
        Live traffic overlays powered by TomTom.
      </p>
    </>
  );
}

function Content() {
  const { forecast, selected } = useApp();
  const [liveTraffic, setLiveTraffic] = useState<LiveTrafficBriefing | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setTrafficLoading(true);

    fetchTomTomTraffic({ data: { lat: selected?.lat, lon: selected?.lon } })
      .then((result) => {
        if (!cancelled) setLiveTraffic(result ?? null);
      })
      .catch(() => {
        if (!cancelled) setLiveTraffic(null);
      })
      .finally(() => {
        if (!cancelled) setTrafficLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.lat, selected?.lon]);

  if (!forecast) return null;

  const brief = buildRoadBriefing(forecast.today.weatherCode, forecast.today.rainChance);

  const trafficLevel = liveTraffic?.level ?? (brief.level === "high" ? "heavy" : brief.level);
  const trafficLabelText = trafficLabel(trafficLevel as any);
  const trafficIcon = trafficEmoji(trafficLevel as any);

  const sourceText = liveTraffic
    ? "Live traffic from TomTom"
    : trafficLoading
      ? "Checking live traffic..."
      : "Estimated from weather and time of day";

  const drivingRecommendation = liveTraffic?.recommendation ?? brief.recommendation;
  const trafficSummary = liveTraffic?.summary ?? brief.summary;
  const congestion = liveTraffic?.congestionPercent;

  const levelTone =
    trafficLevel === "light" ? "var(--confidence-high)" :
    trafficLevel === "moderate" ? "var(--confidence-mid)" :
    "var(--confidence-low)";

  return (
    <>
      <section className="rounded-3xl p-5 shadow-[var(--shadow-soft)]" style={{ background: "var(--gradient-sky)" }}>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{selected.label}</p>

        <div className="mt-1.5 flex items-center gap-3">
          <div className="text-4xl">{trafficIcon}</div>

          <div>
            <h2 className="text-lg font-semibold flex items-center gap-1.5">
              <span>{trafficIcon}</span>
              <span>{trafficLabelText} traffic</span>
            </h2>

            <p className="text-[13px] text-muted-foreground">{trafficSummary}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: `color-mix(in oklab, ${levelTone} 18%, transparent)`, color: levelTone }}
          >
            Traffic · {trafficLabelText}
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-foreground/80">
            <span>{brief.roadEmoji}</span>
            <span>Roads · {brief.roadLabel}</span>
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-card/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {sourceText}
          </span>
        </div>
      </section>

      <CollapsibleCard
        id="roads:traffic-status"
        title="Traffic Status"
        icon={trafficIcon}
        summary={trafficLoading ? "Loading live traffic..." : congestion !== undefined ? `${congestion}% congestion` : trafficLabelText}
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{trafficSummary}</p>

          {liveTraffic?.currentSpeedMph && liveTraffic?.freeFlowSpeedMph ? (
            <p>
              Current speed around {liveTraffic.currentSpeedMph} mph compared to normal free-flow speed of {liveTraffic.freeFlowSpeedMph} mph.
            </p>
          ) : null}

          {congestion !== undefined ? (
            <p>Estimated congestion level: {congestion}%.</p>
          ) : null}
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        id="roads:impact"
        title="Road Conditions"
        icon={brief.roadEmoji}
        summary={brief.weatherImpact}
      >
        <p className="text-sm text-muted-foreground">{brief.weatherImpact}</p>
      </CollapsibleCard>

      <CollapsibleCard
        id="roads:recommendation"
        title="Driving Recommendation"
        icon="🧭"
        summary={drivingRecommendation}
      >
        <p className="text-sm text-foreground">{drivingRecommendation}</p>
      </CollapsibleCard>

      <CollapsibleCard
        id="roads:incidents"
        title="Nearby Incidents"
        icon="🚧"
        summary={liveTraffic?.incidents?.length ? `${liveTraffic.incidents.length} nearby` : "No major incidents"}
      >
        {trafficLoading ? (
          <p className="text-sm text-muted-foreground">Checking live incidents...</p>
        ) : liveTraffic?.incidents?.length ? (
          <div className="space-y-2">
            {liveTraffic.incidents.map((incident) => (
              <div key={incident.id} className="rounded-2xl bg-secondary/40 p-3 text-sm">
                <div className="font-medium text-foreground">{incident.description}</div>

                <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-2">
                  <span>{trafficLabel(incident.severity)}</span>
                  {incident.roadName ? <span>{incident.roadName}</span> : null}
                  {incident.delaySeconds ? <span>{Math.round(incident.delaySeconds / 60)} min delay</span> : null}
                  {incident.isClosure ? <span>Road closure</span> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No major nearby incidents.</p>
        )}
      </CollapsibleCard>

      <CollapsibleCard
        id="roads:weather-impact"
        title="Weather Impact"
        icon="🌧️"
        summary={brief.weatherImpact}
      >
        <p className="text-sm text-muted-foreground">{brief.weatherImpact}</p>
      </CollapsibleCard>

      <p className="text-center text-[11px] text-muted-foreground">
        {sourceText}
      </p>
    </>
  );
}
