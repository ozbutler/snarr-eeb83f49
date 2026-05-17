import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    tt?: any;
  }
}

let tomTomSdkPromise: Promise<void> | null = null;

function loadTomTomSdk() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.tt) return Promise.resolve();
  if (tomTomSdkPromise) return tomTomSdkPromise;

  tomTomSdkPromise = new Promise((resolve, reject) => {
    const existingCss = document.querySelector<HTMLLinkElement>("link[data-tomtom-maps-css]");
    if (!existingCss) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css";
      link.dataset.tomtomMapsCss = "true";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-tomtom-maps-sdk]");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("TomTom map SDK failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js";
    script.async = true;
    script.dataset.tomtomMapsSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("TomTom map SDK failed to load."));
    document.head.appendChild(script);
  });

  return tomTomSdkPromise;
}

export function TrafficMap({
  lat,
  lon,
  label,
}: {
  lat: number;
  lon: number;
  label: string;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);
  const [missingKey, setMissingKey] = useState(false);

  const apiKey = useMemo(() => {
    return import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!apiKey) {
      setMissingKey(true);
      return;
    }

    let cancelled = false;

    loadTomTomSdk()
      .then(() => {
        if (cancelled || !mapRef.current || !window.tt) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = window.tt.map({
          key: apiKey,
          container: mapRef.current,
          center: [lon, lat],
          zoom: 12,
          pitch: 0,
        });

        map.addControl(new window.tt.NavigationControl(), "top-right");
        map.addControl(new window.tt.FullscreenControl(), "top-right");

        map.on("load", () => {
          try {
            if (typeof map.showTrafficFlow === "function") map.showTrafficFlow();
            if (typeof map.showTrafficIncidents === "function") map.showTrafficIncidents();

            const marker = new window.tt.Marker()
              .setLngLat([lon, lat])
              .addTo(map);

            marker.setPopup(
              new window.tt.Popup({ offset: 24 }).setText(label),
            );
          } catch {
            // The base map is still useful even if traffic overlays fail.
          }
        });

        mapInstanceRef.current = map;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [apiKey, lat, lon, label]);

  if (missingKey) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-3xl bg-secondary/50 text-center">
        <div className="px-6">
          <div className="text-4xl">🗺️</div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">Traffic map setup needed.</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Add a browser-safe TomTom key named VITE_TOMTOM_API_KEY to enable the live traffic map.
          </p>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-3xl bg-secondary/50 text-center">
        <div className="px-6">
          <div className="text-4xl">🚦</div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">Traffic map temporarily unavailable.</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Try refreshing Snarr in a few minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border/50 bg-secondary/40 shadow-[var(--shadow-card)]">
      <div
        ref={mapRef}
        className="h-[360px] w-full"
        role="application"
        aria-label={`Live traffic map for ${label}`}
      />
    </div>
  );
}
