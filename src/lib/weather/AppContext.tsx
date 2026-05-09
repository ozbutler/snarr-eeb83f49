// Centralized app state: location list, selected location, units,
// and the active forecast bundle (loading + error states).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LocationOption, Units, ForecastBundle } from "./types";
import { fetchForecast } from "./weatherApi";

const DEFAULT_LOCATIONS: LocationOption[] = [
  { id: "phl", label: "Philadelphia, PA", lat: 39.9526, lon: -75.1652 },
  { id: "nyc", label: "New York, NY", lat: 40.7128, lon: -74.006 },
  { id: "boca", label: "Boca Raton, FL", lat: 26.3683, lon: -80.1289 },
  { id: "nola", label: "New Orleans, LA", lat: 29.9511, lon: -90.0715 },
  { id: "mia", label: "Miami, FL", lat: 25.7617, lon: -80.1918 },
];

const LS_KEY_LOCATIONS = "wb.customLocations";
const LS_KEY_SELECTED = "wb.selectedLocation";
const LS_KEY_UNITS = "wb.units";

interface AppContextValue {
  locations: LocationOption[];
  selected: LocationOption;
  setSelected: (id: string) => void;
  addLocation: (loc: Omit<LocationOption, "id" | "custom">) => void;
  removeLocation: (id: string) => void;
  units: Units;
  toggleUnits: () => void;
  forecast: ForecastBundle | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  currentLocationCoords: { lat: number; lon: number } | null;
  setCurrentLocationCoords: (c: { lat: number; lon: number } | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Custom (user-added) locations.
  const [customLocations, setCustomLocations] = useState<LocationOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("phl");
  const [units, setUnits] = useState<Units>("F");
  const [currentLocationCoords, setCurrentLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [forecast, setForecast] = useState<ForecastBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const c = localStorage.getItem(LS_KEY_LOCATIONS);
      if (c) setCustomLocations(JSON.parse(c));
      const s = localStorage.getItem(LS_KEY_SELECTED);
      if (s) setSelectedId(s);
      const u = localStorage.getItem(LS_KEY_UNITS) as Units | null;
      if (u === "F" || u === "C") setUnits(u);
    } catch { /* ignore */ }
  }, []);

  // Ask for geolocation once on first mount.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCurrentLocationCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setCurrentLocationCoords(null),
      { timeout: 8000 },
    );
  }, []);

  // Persist when things change.
  useEffect(() => {
    localStorage.setItem(LS_KEY_LOCATIONS, JSON.stringify(customLocations));
  }, [customLocations]);
  useEffect(() => {
    localStorage.setItem(LS_KEY_SELECTED, selectedId);
  }, [selectedId]);
  useEffect(() => {
    localStorage.setItem(LS_KEY_UNITS, units);
  }, [units]);

  // Build the full location list, including the dynamic "Current Location".
  const locations = useMemo<LocationOption[]>(() => {
    const current: LocationOption | null = currentLocationCoords
      ? { id: "current", label: "Current Location", lat: currentLocationCoords.lat, lon: currentLocationCoords.lon, current: true }
      : null;
    const list = [
      ...(current ? [current] : []),
      ...DEFAULT_LOCATIONS,
      ...customLocations,
    ];
    return list;
  }, [currentLocationCoords, customLocations]);

  // Resolve selected, falling back to Philadelphia if missing.
  const selected = useMemo<LocationOption>(() => {
    return locations.find((l) => l.id === selectedId) ?? DEFAULT_LOCATIONS[0];
  }, [locations, selectedId]);

  // Fetch forecast whenever selected location or refresh changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchForecast(selected.lat, selected.lon)
      .then((f) => { if (!cancelled) setForecast(f); })
      .catch((e) => { if (!cancelled) setError(e?.message ?? "Failed to load forecast"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected.lat, selected.lon, refreshKey]);

  const setSelected = useCallback((id: string) => setSelectedId(id), []);

  const addLocation = useCallback((loc: Omit<LocationOption, "id" | "custom">) => {
    const id = `custom-${Date.now()}`;
    setCustomLocations((prev) => [...prev, { ...loc, id, custom: true }]);
    setSelectedId(id);
  }, []);

  const removeLocation = useCallback((id: string) => {
    setCustomLocations((prev) => prev.filter((l) => l.id !== id));
    setSelectedId((cur) => (cur === id ? "phl" : cur));
  }, []);

  const toggleUnits = useCallback(() => {
    setUnits((u) => (u === "F" ? "C" : "F"));
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const value: AppContextValue = {
    locations, selected, setSelected,
    addLocation, removeLocation,
    units, toggleUnits,
    forecast, loading, error, refresh,
    currentLocationCoords, setCurrentLocationCoords,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}