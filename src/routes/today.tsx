import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/weather/AppContext";
import { PageShell } from "@/components/wb/PageShell";
import { describeCode, fmtTemp, outfitFor, rainWindow } from "@/lib/weather/weatherUtils";
import { ConfidenceBadge, VerifiedBadge } from "@/components/wb/Confidence";
import { CollapsibleCard } from "@/components/wb/CollapsibleCard";
import { HourlyForecast } from "@/components/wb/HourlyForecast";

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "Today — Weather Brief" },
      { name: "description", content: "Detailed daily weather: temperature, rain timing, alerts, and clothing tips." },
      { property: "og:title", content: "Today — Weather Brief" },
      { property: "og:description", content: "Detailed daily weather with multi-source confidence." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  return (
    <PageShell>
      <TodayContent />
    </PageShell>
  );
}

function TodayContent() {
  const { forecast, selected, units } = useApp();
  if (!forecast) return null;
  const { current, today, hourly, alerts, confidence, sources, updatedAt } = forecast;
  const desc = describeCode(today.weatherCode, current.isDay);
  const outfit = outfitFor(today.high, today.rainChance);
  const window = rainWindow(hourly);
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <section
        className="rounded-3xl p-5 shadow-[var(--shadow-soft)]"
        style={{ background: "var(--gradient-sky)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{selected.label}</p>
            <p className="text-[11px] text-muted-foreground/80">{dateLine}</p>
          </div>
          <div className="text-5xl leading-none">{desc.emoji}</div>
        </div>
        <div className="mt-2 text-[64px] leading-none font-semibold tracking-tight">{fmtTemp(current.temp, units)}</div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{desc.label} · feels {fmtTemp(current.feelsLike, units)}</p>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card/70 p-2.5">
            <div className="text-[10px] text-muted-foreground uppercase">High</div>
            <div className="text-sm font-semibold">{fmtTemp(today.high, units)}</div>
          </div>
          <div className="rounded-xl bg-card/70 p-2.5">
            <div className="text-[10px] text-muted-foreground uppercase">Low</div>
            <div className="text-sm font-semibold">{fmtTemp(today.low, units)}</div>
          </div>
          <div className="rounded-xl bg-card/70 p-2.5">
            <div className="text-[10px] text-muted-foreground uppercase">Rain</div>
            <div className="text-sm font-semibold">💧 {today.rainChance}%</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <ConfidenceBadge level={confidence} compact />
          <VerifiedBadge sources={sources} />
        </div>
      </section>

      <HourlyForecast />

      <CollapsibleCard
        id="today:rain"
        title="Rain Timing"
        icon="🌧️"

        summary={window ? `Most likely ${window}` : "No rain expected"}
      >
        <p className="text-sm text-muted-foreground">
          {window ? `Rain most likely between ${window}.` : "No notable rain expected in the next 24 hours."}
        </p>
      </CollapsibleCard>

      <CollapsibleCard
        id="today:wear"
        title="What to Wear"
        icon="👕"

        summary={outfit.extra ? `${outfit.main} + umbrella` : outfit.main}
      >
        <p className="text-base font-medium">{outfit.main}.</p>
        {outfit.extra && <p className="mt-1 text-xs text-muted-foreground">{outfit.extra}.</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">
          High {Math.round(today.high)}°F · Low {Math.round(today.low)}°F · {today.rainChance < 30 ? "low" : today.rainChance < 60 ? "moderate" : "high"} rain chance.
        </p>
      </CollapsibleCard>

      <CollapsibleCard
        id="today:alerts"
        title="Weather Alerts"
        icon={alerts.length === 0 ? "✅" : "⚠️"}
        tone={alerts.length === 0 ? "default" : "alert"}
        summary={alerts.length === 0 ? "No major alerts" : `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`}
      >
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No major weather alerts today.</p>
        ) : (
          <ul className="space-y-1.5 text-sm text-foreground">
            {alerts.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        )}
      </CollapsibleCard>

      <CollapsibleCard
        id="today:confidence"
        title="Forecast Confidence"
        icon="🔎"
        summary={`${confidence[0].toUpperCase()}${confidence.slice(1)} · ${sources.length} source${sources.length === 1 ? "" : "s"}`}
      >
        <div className="flex items-center gap-2">
          <ConfidenceBadge level={confidence} compact />
          <VerifiedBadge sources={sources} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Forecasts are compared across {sources.join(" and ")} to estimate agreement.
        </p>
      </CollapsibleCard>

      <p className="text-center text-[11px] text-muted-foreground">
        Last updated {new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </p>
    </>
  );
}