import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { MorningSummaryCard } from "@/components/wb/MorningSummaryCard";
import { CollapsibleCard } from "@/components/wb/CollapsibleCard";
import { NewsBriefCard } from "@/components/wb/NewsBriefCard";
import { OutdoorConditionsCard } from "@/components/wb/OutdoorConditions";
import { useApp } from "@/lib/weather/AppContext";
import { describeCode, fmtTemp, parseForecastDateLocal } from "@/lib/weather/weatherUtils";
import { buildRoadBriefing } from "@/lib/weather/trafficUtils";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <PageShell>
      <MorningSummaryCard />
      <NextDaysCard />
      <OutdoorConditionsCard />
      <RoadsCollapsible />
      <NewsBriefCard />
    </PageShell>
  );
}

function NextDaysCard() {
  const { forecast, units } = useApp();
  if (!forecast) return null;
  const days = forecast.daily.slice(1, 4);
  return (
    <section className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold text-foreground">Next 3 Days</h2>
        <Link to="/weather" search={{ tab: "week" }} className="text-[11px] text-primary font-medium">Full week →</Link>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {days.map((d) => {
          const desc = describeCode(d.weatherCode);
          const day = parseForecastDateLocal(d.date).toLocaleDateString(undefined, { weekday: "short" });
          return (
            <div key={d.date} className="rounded-xl bg-secondary/50 px-2 py-2 text-center">
              <div className="text-[10px] font-medium text-muted-foreground">{day}</div>
              <div className="text-xl leading-none mt-1">{desc.emoji}</div>
              <div className="mt-1 text-[12px] font-semibold">{fmtTemp(d.high, units)}</div>
              <div className="text-[10px] text-muted-foreground">{fmtTemp(d.low, units)} · 💧{d.rainChance}%</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RoadsCollapsible() {
  const { forecast } = useApp();
  if (!forecast) return null;
  const brief = buildRoadBriefing(forecast.today.weatherCode, forecast.today.rainChance);
  const summary = `${brief.emoji} ${brief.level[0].toUpperCase()}${brief.level.slice(1)} traffic · ${brief.roadLabel.toLowerCase()} roads`;
  return (
    <CollapsibleCard id="home:roads" title="Roads & Traffic" icon="🛣️" summary={summary}>
      <div className="flex items-center gap-2 text-sm">
        <span>{brief.emoji}</span>
        <span className="font-medium capitalize">{brief.level} traffic</span>
        <span className="text-muted-foreground">·</span>
        <span>{brief.roadEmoji}</span>
        <span>{brief.roadLabel} roads</span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{brief.summary}</p>
      <p className="mt-1 text-xs text-foreground/70">{brief.recommendation}</p>
      <div className="mt-2 text-right">
        <Link to="/roads" className="text-xs text-primary font-medium">Roads details →</Link>
      </div>
    </CollapsibleCard>
  );
}
