import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { MorningSummaryCard } from "@/components/wb/MorningSummaryCard";
import { CollapsibleCard } from "@/components/wb/CollapsibleCard";
import { NewsBriefCard } from "@/components/wb/NewsBriefCard";
import { useApp } from "@/lib/weather/AppContext";
import { describeCode, fmtTemp, outfitFor, rainWindow } from "@/lib/weather/weatherUtils";
import { buildRoadBriefing } from "@/lib/weather/trafficUtils";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <PageShell>
      <MorningSummaryCard />
      <RainCollapsible />
      <OutfitCollapsible />
      <NextDaysCollapsible />
      <RoadsCollapsible />
      <NewsBriefCard />
    </PageShell>
  );
}

function RainCollapsible() {
  const { forecast } = useApp();
  if (!forecast) return null;
  const { today, hourly, alerts } = forecast;
  const window = rainWindow(hourly);
  const summary = `${today.rainChance}% rain · ${window ?? "no rain expected"}`;
  return (
    <CollapsibleCard id="home:rain" title="Rain & Alerts" icon="🌧️" summary={summary}>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[11px] text-muted-foreground">Rain chance</div>
          <div className="text-xl font-semibold mt-0.5">{today.rainChance}%</div>
        </div>
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="text-[11px] text-muted-foreground">Most likely</div>
          <div className="text-sm font-medium mt-1">{window ?? "No rain expected"}</div>
        </div>
      </div>
      <div className="mt-3">
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">✅ No major weather alerts.</p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a, i) => (
              <li key={i} className="text-xs text-destructive flex gap-2">
                <span>⚠️</span><span>{a}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CollapsibleCard>
  );
}

function OutfitCollapsible() {
  const { forecast } = useApp();
  if (!forecast) return null;
  const { today } = forecast;
  const outfit = outfitFor(today.high, today.rainChance);
  const summary = outfit.extra ? `${outfit.main} + umbrella` : outfit.main;
  return (
    <CollapsibleCard id="home:outfit" title="What to Wear" icon="👕" summary={summary}>
      <p className="text-base">{outfit.main}.</p>
      <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
        {describeCode(today.weatherCode).label === "Clear" && <li>• Sunglasses recommended.</li>}
        {outfit.extra && <li>• {outfit.extra}.</li>}
        {!outfit.extra && today.rainChance < 20 && <li>• Umbrella probably not needed.</li>}
      </ul>
    </CollapsibleCard>
  );
}

function NextDaysCollapsible() {
  const { forecast, units } = useApp();
  if (!forecast) return null;
  const days = forecast.daily.slice(1, 4);
  const summary = days
    .map((d) => {
      const day = new Date(d.date).toLocaleDateString(undefined, { weekday: "short" });
      return `${day} ${describeCode(d.weatherCode).emoji} ${Math.round(d.high)}°`;
    })
    .join(" · ");
  return (
    <CollapsibleCard id="home:next3" title="Next 3 Days" icon="📅" summary={summary} defaultOpen>
      <div className="grid grid-cols-3 gap-2">
        {days.map((d) => {
          const desc = describeCode(d.weatherCode);
          const day = new Date(d.date).toLocaleDateString(undefined, { weekday: "short" });
          return (
            <div key={d.date} className="rounded-xl bg-secondary/60 p-2.5 text-center">
              <div className="text-[11px] font-medium text-muted-foreground">{day}</div>
              <div className="text-2xl mt-0.5">{desc.emoji}</div>
              <div className="mt-0.5 text-sm font-semibold">{fmtTemp(d.high, units)}</div>
              <div className="text-[10px] text-muted-foreground">{fmtTemp(d.low, units)}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">💧 {d.rainChance}%</div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-right">
        <Link to="/week" className="text-xs text-primary font-medium">See full week →</Link>
      </div>
    </CollapsibleCard>
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
