import { useMemo, useState } from "react";

export function RadarMap({
  lat,
  lon,
  label,
}: {
  lat: number;
  lon: number;
  label: string;
}) {
  const [failed, setFailed] = useState(false);

  const radarUrl = useMemo(() => {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      detailLat: String(lat),
      detailLon: String(lon),
      zoom: "7",
      level: "surface",
      overlay: "radar",
      product: "radar",
      menu: "",
      message: "true",
      marker: "true",
      calendar: "now",
      pressure: "",
      type: "map",
      location: "coordinates",
      detail: "true",
      metricWind: "mph",
      metricTemp: "°F",
      radarRange: "-1",
    });

    return `https://embed.windy.com/embed2.html?${params.toString()}`;
  }, [lat, lon]);

  if (failed) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-3xl bg-secondary/50 text-center">
        <div className="px-6">
          <div className="text-4xl">📡</div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">Radar temporarily unavailable.</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Try refreshing Snarr in a few minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border/50 bg-secondary/40 shadow-[var(--shadow-card)]">
      <iframe
        title={`Live precipitation radar for ${label}`}
        src={radarUrl}
        loading="lazy"
        className="h-[360px] w-full border-0"
        onError={() => setFailed(true)}
        allowFullScreen
      />
    </div>
  );
}
