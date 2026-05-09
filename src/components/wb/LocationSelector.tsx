import { useState } from "react";
import { useApp } from "@/lib/weather/AppContext";
import { AddLocationModal } from "./AddLocationModal";
import { MapPin } from "lucide-react";

export function LocationSelector() {
  const {
    locations, selected, setSelected, removeLocation,
    locationPermission, requestCurrentLocation, currentLocationCoords,
  } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const canRemove = selected.custom === true;
  const current = locations.find((l) => l.current);
  const defaults = locations.filter((l) => !l.current && !l.custom);
  const customs = locations.filter((l) => l.custom);

  return (
    <div className="space-y-1.5">
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        <select
          value={selected.id}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full appearance-none h-9 pl-3.5 pr-8 rounded-full bg-card text-foreground text-[13px] font-medium border border-border shadow-[var(--shadow-card)] focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {current && (
            <optgroup label="Live">
              <option value={current.id}>{current.label}</option>
            </optgroup>
          )}
          <optgroup label="Saved cities">
            {defaults.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </optgroup>
          {customs.length > 0 && (
            <optgroup label="Custom">
              {customs.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </optgroup>
          )}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▾</span>
      </div>

      <button
        onClick={() => {
          requestCurrentLocation();
          if (currentLocationCoords) setSelected("current");
        }}
        title="Use current location"
        aria-label="Use current location"
        className={
          "h-9 w-9 rounded-full transition flex items-center justify-center " +
          (selected.current
            ? "bg-primary/15 text-primary"
            : "bg-secondary text-secondary-foreground hover:bg-accent")
        }
      >
        <MapPin className="h-4 w-4" />
      </button>

      <button
        onClick={() => setShowAdd(true)}
        className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition flex items-center justify-center text-sm"
        aria-label="Add location"
      >
        +
      </button>

      {canRemove && (
        <button
          onClick={() => setConfirmRemove(true)}
          className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition flex items-center justify-center text-xs"
          aria-label="Remove location"
        >
          🗑️
        </button>
      )}
    </div>

    {locationPermission === "denied" && (
      <p className="text-[10.5px] text-muted-foreground/90 px-1">
        Location access denied — using default city. Enable in browser settings to use live location.
      </p>
    )}
    {locationPermission === "unsupported" && (
      <p className="text-[10.5px] text-muted-foreground/90 px-1">
        Live location not supported on this device.
      </p>
    )}

      {showAdd && <AddLocationModal onClose={() => setShowAdd(false)} />}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">Remove location?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Remove <span className="font-medium text-foreground">{selected.label}</span> from your saved locations?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmRemove(false)}
                className="px-3 h-9 rounded-full text-sm bg-secondary text-secondary-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => { removeLocation(selected.id); setConfirmRemove(false); }}
                className="px-3 h-9 rounded-full text-sm bg-destructive text-destructive-foreground"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}