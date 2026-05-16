import { createServerFn } from "@tanstack/react-start";

export type PublicSourceCheckStatus = "success" | "warning" | "error";

export interface PublicSourceCheckResult {
  sourceName: string;
  status: PublicSourceCheckStatus;
  message: string;
  lastUpdated: number;
  isFallbackData?: boolean;
}

export const checkMetNorwayForecast = createServerFn({ method: "POST" })
  .inputValidator((data: { lat?: number; lon?: number }) => data)
  .handler(async ({ data }): Promise<PublicSourceCheckResult> => {
    const lat = Number.isFinite(data.lat) ? Number(data.lat) : 39.9526;
    const lon = Number.isFinite(data.lon) ? Number(data.lon) : -75.1652;
    const checkedAt = Date.now();

    try {
      const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Snarr weather app source checker",
        },
      });

      if (!res.ok) {
        return {
          sourceName: "MET Norway",
          status: "error",
          message: `MET Norway returned HTTP ${res.status}.`,
          lastUpdated: checkedAt,
          isFallbackData: true,
        };
      }

      const json = await res.json();
      const timeseries = json?.properties?.timeseries;

      if (!Array.isArray(timeseries) || timeseries.length === 0) {
        return {
          sourceName: "MET Norway",
          status: "warning",
          message: "MET Norway responded but returned no usable forecast points.",
          lastUpdated: checkedAt,
          isFallbackData: true,
        };
      }

      return {
        sourceName: "MET Norway",
        status: "success",
        message: `MET Norway forecast source is available with ${timeseries.length} forecast points.`,
        lastUpdated: checkedAt,
      };
    } catch (e) {
      return {
        sourceName: "MET Norway",
        status: "error",
        message: e instanceof Error ? `MET Norway check failed: ${e.message}` : "MET Norway check failed.",
        lastUpdated: checkedAt,
        isFallbackData: true,
      };
    }
  });

export const checkNoaaAlertsSource = createServerFn({ method: "POST" })
  .inputValidator((data: { lat?: number; lon?: number }) => data)
  .handler(async ({ data }): Promise<PublicSourceCheckResult> => {
    const lat = Number.isFinite(data.lat) ? Number(data.lat) : 39.9526;
    const lon = Number.isFinite(data.lon) ? Number(data.lon) : -75.1652;
    const checkedAt = Date.now();

    try {
      const res = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, {
        headers: {
          Accept: "application/geo+json",
          "User-Agent": "Snarr weather app source checker",
        },
      });

      if (!res.ok) {
        return {
          sourceName: "NOAA Alerts",
          status: "warning",
          message: `NOAA alerts are unavailable for this location or returned HTTP ${res.status}.`,
          lastUpdated: checkedAt,
          isFallbackData: true,
        };
      }

      const json = await res.json();
      const alerts = Array.isArray(json?.features) ? json.features : [];

      return {
        sourceName: "NOAA Alerts",
        status: "success",
        message: alerts.length
          ? `NOAA alerts loaded successfully with ${alerts.length} active alert${alerts.length === 1 ? "" : "s"}.`
          : "NOAA alerts loaded successfully with no active alerts.",
        lastUpdated: checkedAt,
      };
    } catch (e) {
      return {
        sourceName: "NOAA Alerts",
        status: "error",
        message: e instanceof Error ? `NOAA alerts check failed: ${e.message}` : "NOAA alerts check failed.",
        lastUpdated: checkedAt,
        isFallbackData: true,
      };
    }
  });

export const checkPublicTrafficFeeds = createServerFn({ method: "POST" })
  .inputValidator((data: { lat?: number; lon?: number }) => data)
  .handler(async ({ data }): Promise<PublicSourceCheckResult> => {
    const checkedAt = Date.now();

    // Many 511 feeds are state-specific and do not share one national schema.
    // This check confirms the no-key public traffic-feed layer is available as
    // an optional incident/closure layer without treating unsupported locations
    // as app-breaking failures.
    const lat = Number.isFinite(data.lat) ? Number(data.lat) : undefined;
    const lon = Number.isFinite(data.lon) ? Number(data.lon) : undefined;
    const locationLabel = lat !== undefined && lon !== undefined
      ? `${lat.toFixed(2)}, ${lon.toFixed(2)}`
      : "selected location";

    return {
      sourceName: "511 Traffic Feeds",
      status: "warning",
      message: `Public 511 traffic feeds are optional and location-specific. No universal no-key feed is configured yet for ${locationLabel}.`,
      lastUpdated: checkedAt,
      isFallbackData: true,
    };
  });
