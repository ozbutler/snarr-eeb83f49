import { useEffect, useState } from "react";
import { useApp } from "@/lib/weather/AppContext";
import {
  aqiCategory,
  fetchOutdoorConditions,
  outdoorRecommendation,
  uvCategory,
  type OutdoorConditions as OC,
} from "@/lib/weather/airQualityApi";
import { CollapsibleCard } from "./CollapsibleCard";

function useOutdoor() {
  const { selected } = useApp();
  const [data, setData] = useState<OC | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    fetchOutdoorConditions(selected.lat, selected.lon)
      .then((d) => { if (!cancel) setData(d); })
      .catch(() => { if (!cancel) setError("Outdoor conditions unavailable"); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [selected.lat, selected.lon]);
  return { data, error, loading };
}

function Stat({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-secondary/50 px-2 py-2 text-center">
      <div className="text-lg leading-none">{emoji}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function OutdoorConditionsCard() {
  const { data, error, loading } = useOutdoor();

  if (loading) {
    return (
      <CollapsibleCard id="home:outdoor" title="Outdoor Conditions" icon="🌳" summary="Loading…">
        <p className="text-sm text-muted-foreground">Loading outdoor conditions…</p>
      </CollapsibleCard>
    );
  }
  if (error || !data) {
    return (
      <CollapsibleCard id="home:outdoor" title="Outdoor Conditions" icon="🌳" summary="Unavailable">
        <p className="text-sm text-muted-foreground">Outdoor conditions unavailable.</p>
      </CollapsibleCard>
    );
  }
  const aqi = aqiCategory(data.usAqi);
  const uv = uvCategory(data.uvIndex);
  const rec = outdoorRecommendation(data);
  const summary = `${rec.emoji} ${rec.text}`;

  return (
    <CollapsibleCard id="home:outdoor" title="Outdoor Conditions" icon="🌳" summary={summary}>
      <div className="grid grid-cols-3 gap-1.5">
        <Stat
          emoji={aqi.emoji}
          label="AQI"
          value={data.usAqi !== undefined ? String(Math.round(data.usAqi)) : "—"}
          sub={aqi.label}
        />
        <Stat
          emoji="🌫️"
          label="PM2.5"
          value={data.pm25 !== undefined ? `${Math.round(data.pm25)}` : "—"}
          sub="µg/m³"
        />
        <Stat
          emoji={uv.emoji}
          label="UV"
          value={data.uvIndex !== undefined ? String(Math.round(data.uvIndex)) : "—"}
          sub={uv.label}
        />
      </div>
      {data.pollen && data.pollen.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          🌱 Pollen: {data.pollen.map((p) => `${p.label} ${p.value}`).join(" · ")}
        </div>
      )}
      <p className="mt-2 text-xs text-foreground/80">{rec.emoji} {rec.text}.</p>
    </CollapsibleCard>
  );
}

export function OutdoorConditionsDetailed() {
  const { data, error, loading } = useOutdoor();

  if (loading) {
    return (
      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold">🌳 Outdoor Conditions</h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading outdoor conditions…</p>
      </section>
    );
  }
  if (error || !data) {
    return (
      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold">🌳 Outdoor Conditions</h2>
        <p className="mt-2 text-sm text-muted-foreground">Outdoor conditions unavailable.</p>
      </section>
    );
  }
  const aqi = aqiCategory(data.usAqi);
  const uv = uvCategory(data.uvIndex);
  const rec = outdoorRecommendation(data);

  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">🌳 Outdoor Conditions</h2>
        <span className="text-xs text-muted-foreground">{rec.emoji} {rec.text}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat
          emoji={aqi.emoji}
          label="U.S. AQI"
          value={data.usAqi !== undefined ? String(Math.round(data.usAqi)) : "—"}
          sub={aqi.label}
        />
        <Stat
          emoji="🌫️"
          label="PM2.5"
          value={data.pm25 !== undefined ? `${Math.round(data.pm25)}` : "—"}
          sub="µg/m³"
        />
        <Stat
          emoji={uv.emoji}
          label="UV Index"
          value={data.uvIndex !== undefined ? String(Math.round(data.uvIndex)) : "—"}
          sub={uv.label}
        />
      </div>

      {data.pollen && data.pollen.length > 0 ? (
        <div className="mt-3 rounded-xl bg-secondary/50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">🌱 Pollen (avg today)</div>
          <div className="mt-1 text-sm">
            {data.pollen.map((p) => `${p.label} ${p.value} grains/m³`).join(" · ")}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-muted-foreground">Pollen data not available for this region.</p>
      )}

      <p className="mt-3 text-sm">{rec.emoji} {rec.text}.</p>
    </section>
  );
}