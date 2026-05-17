import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocation } from "@tanstack/react-router";
import { useApp } from "@/lib/weather/AppContext";
import { SourceStatus, type SourceStatusItem, type SourceStatusState } from "./SourceStatus";
import { refreshNewsBriefing } from "@/lib/news/rssNews";
import { fetchTomTomTraffic } from "@/lib/traffic/tomtomTraffic";
import {
  checkMetNorwayForecast,
  checkNoaaAlertsSource,
  checkPublicTrafficFeeds,
} from "@/lib/sources/publicSourceChecks";

type OverallStatus = "operational" | "partial" | "major";
type PageGroup = "home" | "weather" | "roads" | "news";
type SourceKey =
  | "weatherSummary"
  | "roadSummary"
  | "newsSummary"
  | "openMeteo"
  | "weatherGov"
  | "pirateWeather"
  | "metNorway"
  | "noaaAlerts"
  | "tomTom"
  | "traffic511"
  | "weatherTrafficFallback"
  | "rssNews"
  | "location"
  | "deviceTime";

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

function getPageGroup(pathname: string): PageGroup {
  if (pathname.startsWith("/weather")) return "weather";
  if (pathname.startsWith("/roads")) return "roads";
  if (pathname.startsWith("/news")) return "news";
  return "home";
}

function getDropdownTitle(group: PageGroup) {
  if (group === "weather") return "Weather Status";
  if (group === "roads") return "Road Status";
  if (group === "news") return "News Status";
  return "System Status";
}

function getPillLabel(group: PageGroup) {
  if (group === "weather") return "Weather";
  if (group === "roads") return "Roads";
  if (group === "news") return "News";
  return "Status";
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
  const { pathname } = useLocation();
  const pageGroup = getPageGroup(pathname);
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<CheckState>({});
  const [refreshing, setRefreshing] = useState<RefreshingState>({});

  async function runCheck(key: SourceKey) {
    if (refreshing[key]) return;

    setRefreshing((prev) => ({ ...prev, [key]: true }));

    try {
      let result: CheckResult;

      if (["weatherSummary", "openMeteo", "weatherGov", "pirateWeather", "weatherTrafficFallback"].includes(key)) {
        refresh();
        result = {
          status: "warning",
          message: "Weather refresh requested. This source will update when the forecast responds.",
          lastUpdated: Date.now(),
        };
      } else if (key === "metNorway") {
        result = await checkMetNorwayForecast({ data: { lat: selected.lat, lon: selected.lon } });
      } else if (key === "noaaAlerts") {
        result = await checkNoaaAlertsSource({ data: { lat: selected.lat, lon: selected.lon } });
      } else if (key === "tomTom" || key === "roadSummary") {
        const liveTraffic = await fetchTomTomTraffic({ data: { lat: selected.lat, lon: selected.lon } });
        result = liveTraffic
          ? {
              status: "success",
              message: "TomTom traffic responded successfully.",
              lastUpdated: liveTraffic.updatedAt ?? Date.now(),
            }
          : {
              status: "error",
              message: "TomTom traffic did not return live data. The app can still use weather-based road estimates.",
              lastUpdated: Date.now(),
              isFallbackData: true,
            };
      } else if (key === "traffic511") {
        result = await checkPublicTrafficFeeds({ data: { lat: selected.lat, lon: selected.lon } });
      } else if (key === "rssNews" || key === "newsSummary") {
        const news = await refreshNewsBriefing();
        const storyCount = Object.values(news.sections).reduce((total, articles) => total + articles.length, 0);
        result = storyCount > 0
          ? {
              status: news.sourceStatus.status,
              message: `RSS news feeds loaded with ${storyCount} stor${storyCount === 1 ? "y" : "ies"}.`,
              lastUpdated: news.updatedAt ?? Date.now(),
              isFallbackData: news.sourceStatus.status === "warning",
            }
          : {
              status: "error",
              message: "RSS news feeds returned zero usable stories.",
              lastUpdated: news.updatedAt ?? Date.now(),
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
      } else {
        const now = new Date();
        result = {
          status: Number.isNaN(now.getTime()) ? "error" : "success",
          message: Number.isNaN(now.getTime())
            ? "Device time could not be read."
            : `Device time loaded successfully: ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
          lastUpdated: Date.now(),
        };
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
    const responded = forecast?.sources ?? [];
    const hasSource = (name: string) => responded.includes(name);
    const liveLocationWarning = selected.current && locationPermission !== "granted";

    const locationSource: SourceStatusItem = {
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
    };

    const deviceTimeSource: SourceStatusItem = {
      sourceName: "Device Time",
      status: "success",
      message: "Device time loaded successfully.",
    };

    const allSources: Record<SourceKey, SourceStatusItem> = {
      weatherSummary: {
        sourceName: "Weather Sources",
        status: error ? "error" : loading && !forecast ? "warning" : forecast ? "success" : "warning",
        lastUpdated: forecast?.updatedAt,
        message: forecast
          ? `${responded.length || 1} weather source${responded.length === 1 ? "" : "s"} active.`
          : error
            ? "Weather sources failed to load."
            : "Weather data is still loading.",
      },
      roadSummary: {
        sourceName: "Road/Traffic Sources",
        status: "warning",
        message: "Roads use TomTom traffic, 511 feed checks, and weather-based fallback estimates.",
      },
      newsSummary: {
        sourceName: "RSS News Sources",
        status: "warning",
        message: "Tap to refresh RSS news feeds.",
      },
      openMeteo: {
        sourceName: "Open-Meteo",
        status: hasSource("Open-Meteo") ? "success" : loading ? "warning" : "error",
        lastUpdated: forecast?.updatedAt,
        message: hasSource("Open-Meteo")
          ? "Open-Meteo forecast loaded successfully."
          : "Open-Meteo is not currently contributing forecast data.",
        isFallbackData: !hasSource("Open-Meteo"),
      },
      weatherGov: {
        sourceName: "Weather.gov",
        status: hasSource("Weather.gov") ? "success" : "warning",
        lastUpdated: forecast?.updatedAt,
        message: hasSource("Weather.gov")
          ? "Weather.gov forecast and alerts are available for this location."
          : "Weather.gov is US-only and may not be available for every location.",
        isFallbackData: !hasSource("Weather.gov"),
      },
      pirateWeather: {
        sourceName: "Pirate Weather",
        status: hasSource("Pirate Weather") ? "success" : "warning",
        lastUpdated: forecast?.updatedAt,
        message: hasSource("Pirate Weather")
          ? "Pirate Weather comparison data loaded successfully."
          : "Pirate Weather is not currently contributing comparison data.",
        isFallbackData: !hasSource("Pirate Weather"),
      },
      metNorway: {
        sourceName: "MET Norway",
        status: hasSource("MET Norway") ? "success" : "warning",
        lastUpdated: forecast?.updatedAt,
        message: hasSource("MET Norway")
          ? "MET Norway comparison forecast loaded successfully."
          : "Tap to check MET Norway comparison forecast.",
        isFallbackData: !hasSource("MET Norway"),
      },
      noaaAlerts: {
        sourceName: "NOAA Alerts",
        status: forecast?.alerts?.length ? "success" : "success",
        lastUpdated: forecast?.updatedAt,
        message: forecast?.alerts?.length
          ? `NOAA alerts loaded with ${forecast.alerts.length} active alert${forecast.alerts.length === 1 ? "" : "s"}.`
          : "NOAA alerts loaded with no active alerts.",
      },
      tomTom: {
        sourceName: "TomTom Traffic",
        status: "warning",
        message: "Tap to check live TomTom traffic.",
      },
      traffic511: {
        sourceName: "511 Traffic Feeds",
        status: "warning",
        message: "511 traffic feeds are location-specific. Tap to check availability for this location.",
        isFallbackData: true,
      },
      weatherTrafficFallback: {
        sourceName: "Weather-Based Traffic Fallback",
        status: forecast ? "success" : "warning",
        lastUpdated: forecast?.updatedAt,
        message: forecast
          ? "Weather-based road estimates are available if live traffic is unavailable."
          : "Waiting for weather data to support road estimates.",
      },
      rssNews: {
        sourceName: "RSS News Sources",
        status: "warning",
        message: "Tap to refresh RSS news feeds.",
      },
      location: locationSource,
      deviceTime: deviceTimeSource,
    };

    const groupKeys: Record<PageGroup, SourceKey[]> = {
      home: ["weatherSummary", "roadSummary", "newsSummary", "location", "deviceTime"],
      weather: ["openMeteo", "weatherGov", "pirateWeather", "metNorway", "noaaAlerts", "location", "deviceTime"],
      roads: ["tomTom", "traffic511", "weatherTrafficFallback", "location", "deviceTime"],
      news: ["rssNews"],
    };

    return groupKeys[pageGroup].map((key) => {
      const checked = checks[key];
      return {
        ...allSources[key],
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
  }, [checks, error, forecast, loading, locationPermission, pageGroup, refreshing, selected.current, selected.lat, selected.lon]);

  const overall = getOverallStatus(sources);
  const meta = getStatusMeta(overall);
  const pillLabel = getPillLabel(pageGroup);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium shadow-sm transition-all hover:scale-[1.02] ${meta.className}`}
        aria-expanded={open}
        aria-label="View source status"
      >
        <span>{meta.emoji}</span>
        <span className="hidden xs:inline">{pillLabel}</span>
        <span className="xs:hidden">Status</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close source status"
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
              title={getDropdownTitle(pageGroup)}
              sources={sources}
              compact={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
