import { useState } from "react";
import { useApp } from "@/lib/weather/AppContext";
import { AddLocationModal } from "./AddLocationModal";

export function LocationSelector() {
  const { locations, selected, setSelected, removeLocation } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const canRemove = selected.custom === true;

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        <select
          value={selected.id}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full appearance-none h-9 pl-3.5 pr-8 rounded-full bg-card text-foreground text-[13px] font-medium border border-border shadow-[var(--shadow-card)] focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.current ? "📍 " : ""}{l.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">▾</span>
      </div>

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