import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useApp } from "@/lib/weather/AppContext";
import { SourceStatus, type SourceStatusItem, type SourceStatusState } from "./SourceStatus";
import { fetchNewsBriefing } from "@/lib/news/newsApi";
import { fetchTomTomTraffic } from "@/lib/traffic/tomtomTraffic";

type OverallStatus = "operational" | "partial" | "major";
type SourceKey = "weather" | "radar" | "traffic" | "news" | "location" | "deviceTime";

type CheckResult = {
  status: SourceStatusState;
  message: string;
  lastUpdated: number;
  isFallbackData?: boolean;
};

type CheckState = Partial<Record<SourceKey, CheckResult>>;
type RefreshingState = Partial<Record<SourceKey, boolean>>;

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

async function checkRadarSource(): Promise<CheckResult> {
  // The radar is rendered by Windy in an iframe/map layer. The best lightweight
  // check here is browser network availability, because iframe providers often
  // block direct fetch probes with CORS.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      status: "error",
      message: "Device appears offline, radar may not load.",
      lastUpdated: Date.now(),
      isFallbackData: true,
    };
  }

  return {
    status: "success",
    message: "Radar source check passed. Open the radar page to verify the live map layer visually.",
    lastUpdated: Date.now(),
  };
}

export function GlobalSystemStatus() {
  const {
    forecast,
    loading,
    error,
    selected,
    locationPermission,
    refresh,
    requestCurrentLocation,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<CheckState>({});
  const [refreshing, setRefreshing] = useState<RefreshingState>({});

  async function runCheck(key: SourceKey) {
    if (refreshing[key]) return;

    setRefreshing((prev) => ({ ...prev, [key]: true }));

    try {
      let result: CheckResult;

      if (key === "weather") {
        refresh();
        result = {
          status: "warning",
          message: "Weather refresh requested. The forecast will update when the API responds.",
          lastUpdated: Date.now(),
        };
      } else if (key === "traffic") {
        const liveTraffic = await fetchTomTomTraffic({ data: { lat: selected.lat, lon: selected.lon } });
        result = liveTraffic
          ? {
              status: "success",
              message: "Traffic API responded successfully.",
              lastUpdated: liveTraffic.updatedAt ?? Date.now(),
            }
          : {
              status: "error",
              message: "Traffic API did not return live data. The app should use weather-based traffic estimates.",
              lastUpdated: Date.now(),
              isFallbackData: true,
            };
      } else if (key === "news") {
        const news = await fetchNewsBriefing();
        const storyCount = news
          ? Object.values(news.sections).reduce((total, articles) => total + articles.length, 0)
          : 0;

        result = storyCount > 0
          ? {
              status: "success",
              message: `News API responded successfully with ${storyCount} stor${storyCount === 1 ? "y" : "ies"}.`,
              lastUpdated: news.updatedAt ?? Date.now(),
            }
          : {
              status: "error",
              message: "News API responded but did not return stories. Check the API key, quota, or source response.",
              lastUpdated: news?.updatedAt ?? Date.now(),
              isFallbackData: true,
            };
      } else if (key === "location") {
        if (selected.current) {
          requestCurrentLocation();
          result = {
            status: locationPermission === "denied" ? "error" : "warning",
            message: "Requested a fresh current-location check. Your browser may ask for permission.",
            lastUpdated: Date.now(),
            isFallbackData: locationPermission !== "granted",
          };
        } else {
          result = {
            status: "success",
            message: "Saved selected location is available.",
            lastUpdated: Date.now(),
          };
        }
      } else if (key === "deviceTime") {
        const now = new Date();
        result = {
          status: Number.isNaN(now.getTime()) ? "error" : "success",
          message: Number.isNaN(now.getTime())
            ? "Device time could not be read."
            : `Device time loaded successfully: ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
          lastUpdated: Date.now(),
        };
      } else {
        result = await checkRadarSource();
      }

      setChecks((prev) => ({ ...prev, [key]: result }));
    } catch (e) {
      setChecks((prev) => ({
        ...prev,
        [key]: {
          status: "error",
          message: e instanceof Error ? e.message : "Source check failed.",
          lastUpdated: Date.now(),
          isFallbackData: true,
        },
      }));
    } finally {
      setRefreshing((prev) => ({ ...prev, [key]: false }));
    }
  }

  const sources = useMemo<SourceStatusItem[]>(() => {
    const weatherSources = forecast?.sources?.length ? forecast.sources : ["Weather API"];
    const liveLocationWarning = selected.current && locationPermission !== "granted";

    const baseSources: Record<SourceKey, SourceStatusItem> = {
      weather: {
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
      radar: {
        sourceName: "Radar Source",
        status: "success",
        message: "Radar source is available on the radar page.",
      },
      traffic: {
        sourceName: "Traffic API",
        status: "warning",
        message: "Tap to check TomTom traffic now. If it fails, the app uses weather-based road estimates.",
        isFallbackData: false,
      },
      news: {
        sourceName: "News API",
        status: "warning",
        message: "Tap to check the News API now instead of waiting until the News page opens.",
        isFallbackData: false,
      },
      location: {
        sourceName: "Location Services",
        status: liveLocationWarning
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
        isFallbackData: liveLocationWarning,
      },
      deviceTime: {
        sourceName: "Device Time",
        status: "success",
        message: "Device time loaded successfully.",
      },
    };

    return (Object.keys(baseSources) as SourceKey[]).map((key) => {
      const checked = checks[key];
      return {
        ...baseSources[key],
        ...(checked
          ? {
              status: checked.status,
              message: checked.message,
              lastUpdated: checked.lastUpdated,
              isFallbackData: checked.isFallbackData,
            }
          : {}),
        isRefreshing: refreshing[key],
        onRefresh: () => runCheck(key),
      };
    });
  }, [checks, error, forecast, loading, locationPermission, refreshing, selected.current, selected.lat, selected.lon]);

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
