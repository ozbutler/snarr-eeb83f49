import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useApp } from "@/lib/weather/AppContext";
import { SourceStatus, type SourceStatusItem } from "./SourceStatus";

type OverallStatus = "operational" | "partial" | "major";

function getOverallStatus(sources: SourceStatusItem[]): OverallStatus {
  const hasError = sources.some((source) => source.status === "error");
  const hasWarning = sources.some((source) => source.status === "warning" || source.isFallbackData);

  if (hasError) return "major";
  if (hasWarning) return "partial";
  return "operational";
}

function getStatusMeta(status: OverallStatus) {
  if (status === "operational") {
    return {
      emoji: "🟢",
      label: "Operational",
      className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    };
  }

  if (status === "partial") {
    return {
      emoji: "🟡",
      label: "Partial Issues",
      className: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    };
  }

  return {
    emoji: "🔴",
    label: "Major Issues",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  };
}

export function GlobalSystemStatus() {
  const { forecast, loading, error, selected, locationPermission } = useApp();
  const [open, setOpen] = useState(false);

  const sources = useMemo<SourceStatusItem[]>(() => {
    const weatherSources = forecast?.sources?.length ? forecast.sources : ["Weather API"];

    return [
      {
        sourceName: weatherSources.length > 1 ? "Weather APIs" : weatherSources[0],
        status: error ? "error" : loading && !forecast ? "warning" : forecast ? "success" : "warning",
        lastUpdated: forecast?.updatedAt,
        message: error
          ? "Weather source failed to load."
          : loading && !forecast
            ? "Weather data is still loading."
            : forecast
              ? "Weather API operational."
              : "Waiting for weather data.",
        isFallbackData: false,
      },
      {
        sourceName: "Radar Source",
        status: "success",
        message: "Radar source is available on the radar page.",
      },
      {
        sourceName: "Traffic API",
        status: "warning",
        message: "Traffic status is checked on the Roads page and falls back to weather-based estimates if unavailable.",
        isFallbackData: false,
      },
      {
        sourceName: "News API",
        status: "warning",
        message: "News status is checked on the News page when the briefing loads.",
        isFallbackData: false,
      },
      {
        sourceName: "Location Services",
        status:
          selected.current && locationPermission !== "granted"
            ? "warning"
            : locationPermission === "denied" && selected.current
              ? "error"
              : "success",
        message: selected.current
          ? locationPermission === "granted"
            ? "Current device location loaded successfully."
            : locationPermission === "denied"
              ? "Location permission denied, using saved location data when available."
              : "Current location is waiting for permission."
          : "Using selected saved location.",
        isFallbackData: selected.current && locationPermission !== "granted",
      },
      {
        sourceName: "Device Time",
        status: "success",
        message: "Device time loaded successfully.",
      },
    ];
  }, [error, forecast, loading, locationPermission, selected.current]);

  const overall = getOverallStatus(sources);
  const meta = getStatusMeta(overall);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium shadow-sm transition-all hover:scale-[1.02] ${meta.className}`}
        aria-expanded={open}
        aria-label="View system source status"
      >
        <span>{meta.emoji}</span>
        <span className="hidden xs:inline">{meta.label}</span>
        <span className="xs:hidden">Status</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close system source status"
            className="fixed inset-0 z-30 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed left-4 right-4 z-40 mx-auto max-w-md animate-fade-in overflow-y-auto overscroll-contain rounded-3xl shadow-[var(--shadow-soft)]"
            style={{
              top: "calc(env(safe-area-inset-top) + 5.25rem)",
              maxHeight: "calc(100vh - env(safe-area-inset-top) - 6.5rem)",
            }}
          >
            <SourceStatus
              title="System Status"
              sources={sources}
              compact={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
