import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageShell } from "@/components/wb/PageShell";
import { useApp } from "@/lib/weather/AppContext";
import { describeCode, fmtTemp, outfitFor, rainWindow, rainOutlook, forecastDateLocalKey, localDateKey } from "@/lib/weather/weatherUtils";
import { ConfidenceBadge, VerifiedBadge } from "@/components/wb/Confidence";
import { CollapsibleCard } from "@/components/wb/CollapsibleCard";
import { HourlyForecast } from "@/components/wb/HourlyForecast";
import { OutdoorConditionsDetailed } from "@/components/wb/OutdoorConditions";
import { WeatherCard } from "@/components/wb/WeatherCard";
import type { DailyForecast } from "@/lib/weather/types";

type Tab = "today" | "week" | "radar";

const searchSchema = z.object({
  tab: z.enum(["today", "week", "radar"]).optional(),
});

export const Route = createFileRoute("/weather")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Weather — Snarr" },
      { name: "description", content: "Today, 7-day forecast, and radar — verified across multiple sources." },
      { property: "og:title", content: "Weather — Snarr" },
      { property: "og:description", content: "Today, 7-day forecast, and radar in one view." },
    ],
  }),
  component: WeatherPage,
});

function WeatherPage() {
  const { tab: initial } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(initial ?? "today");

  return (
    <PageShell>
      <SubTabs value={tab} onChange={setTab} />
      {tab === "today" && <TodayPanel />}
      {tab === "week" && <WeekPanel />}
      {tab === "radar" && <RadarPanel />}
    </PageShell>
  );
}

function SubTabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week", label: "7 Day" },
    { id: "radar", label: "Radar" },
  ];
  return (
    <div className="grid grid-cols-3 gap-1 p-0.5 bg-secondary/60 rounded-full text-[12px]">
      {items.map((it) => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            className={
              "py-1.5 rounded-full font-medium transition-all " +
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

function TodayPanel() {
  const { forecast, selected, units } = useApp();
  if (!forecast) return null;
  const { current, today, hourly, alerts, confidence, sources, updatedAt } = forecast;
  const desc = describeCode(today.weatherCode, current.isDay);
  const outfit = outfitFor(today.high, today.rainChance);
  const window = rainWindow(hourly);
  const outlook = rainOutlook(hourly);
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
          <ConfidenceBadge level={confidence} sources={sources} compact />
          <VerifiedBadge sources={sources} />
        </div>
      </section>

      <HourlyForecast />

      <OutdoorConditionsDetailed />

      <CollapsibleCard
        id="today:rain"
        title="Rain Timing"
        icon="🌧️"
        summary={window ? `Most likely ${window}` : outlook}
      >
        <p className="text-sm text-muted-foreground">
          {window ? `Rain most likely ${window}.` : `${outlook}.`}
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
          <ConfidenceBadge level={confidence} sources={sources} compact />
          <VerifiedBadge sources={sources} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {sources.length > 1
            ? `Forecasts are compared across ${sources.join(" and ")} to estimate agreement.`
            : `Only ${sources[0]} responded; confidence defaults to moderate.`}
        </p>
      </CollapsibleCard>

      <p className="text-center text-[11px] text-muted-foreground">
        Last updated {new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </p>
    </>
  );
}

function WeekPanel() {
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

function RadarPanel() {
  return (
    <section className="rounded-3xl bg-card p-8 shadow-[var(--shadow-card)] text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-secondary/70 flex items-center justify-center text-3xl">
        📡
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">Radar coming soon</h2>
      <p className="mt-1.5 text-xs text-muted-foreground max-w-xs mx-auto">
        Live precipitation radar for your location is on the way. We're polishing
        the experience so it loads quickly and stays accurate.
      </p>
    </section>
  );
}

function buildSevenDayList(daily: DailyForecast[]): DailyForecast[] {
  const byDate = new Map<string, DailyForecast>();
  for (const d of daily) byDate.set(forecastDateLocalKey(d.date), d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: DailyForecast[] = [];
  const fallback = daily[0];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + i);
    const key = localDateKey(dt);
    const match = byDate.get(key);
    if (match) out.push(match);
    else if (fallback) out.push({ ...fallback, date: key });
  }
  return out;
}