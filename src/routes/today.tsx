import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/weather/AppContext";
import { PageShell } from "@/components/wb/PageShell";
import { describeCode, fmtTemp, outfitFor, rainWindow } from "@/lib/weather/weatherUtils";
import { ConfidenceBadge, VerifiedBadge } from "@/components/wb/Confidence";
import { AlertsCard } from "@/components/wb/AlertsCard";

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
        className="rounded-3xl p-6 shadow-[var(--shadow-soft)]"
        style={{ background: "var(--gradient-sky)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{selected.label}</p>
            <p className="text-xs text-muted-foreground">{dateLine}</p>
          </div>
          <div className="text-6xl leading-none">{desc.emoji}</div>
        </div>
        <div className="mt-2 text-7xl font-semibold tracking-tight">{fmtTemp(current.temp, units)}</div>
        <p className="text-sm text-muted-foreground">{desc.label} · feels {fmtTemp(current.feelsLike, units)}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card/70 p-3">
            <div className="text-[10px] text-muted-foreground uppercase">High</div>
            <div className="text-base font-semibold">{fmtTemp(today.high, units)}</div>
          </div>
          <div className="rounded-xl bg-card/70 p-3">
            <div className="text-[10px] text-muted-foreground uppercase">Low</div>
            <div className="text-base font-semibold">{fmtTemp(today.low, units)}</div>
          </div>
          <div className="rounded-xl bg-card/70 p-3">
            <div className="text-[10px] text-muted-foreground uppercase">Rain</div>
            <div className="text-base font-semibold">💧 {today.rainChance}%</div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <ConfidenceBadge level={confidence} />
          <VerifiedBadge sources={sources} />
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h3 className="text-sm font-semibold">Rain timing</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {window
            ? `Rain most likely between ${window}.`
            : "No notable rain expected in the next 24 hours."}
        </p>
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h3 className="text-sm font-semibold">What to wear</h3>
        <p className="mt-1 text-base">{outfit.main}.</p>
        {outfit.extra && <p className="text-sm text-muted-foreground">{outfit.extra}.</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          “High {Math.round(today.high)}°F / Low {Math.round(today.low)}°F. {today.rainChance < 30 ? "Low" : today.rainChance < 60 ? "Moderate" : "High"} rain chance. {outfit.main} should be fine.”
        </p>
      </section>

      <AlertsCard alerts={alerts} />

      <p className="text-center text-[11px] text-muted-foreground">
        Last updated {new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </p>
    </>
  );
}