import { useState } from "react";
import { useApp } from "@/lib/weather/AppContext";
import { geocode } from "@/lib/weather/weatherApi";

export function AddLocationModal({ onClose }: { onClose: () => void }) {
  const { addLocation } = useApp();
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const q = region.trim() ? `${city.trim()}, ${region.trim()}` : city.trim();
      const result = await geocode(q);
      if (!result) {
        setErr("Couldn't find that location. Try a different spelling.");
        return;
      }
      addLocation({ label: result.name, lat: result.lat, lon: result.lon });
      onClose();
    } catch {
      setErr("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl animate-in fade-in slide-in-from-bottom-4"
      >
        <h3 className="text-base font-semibold text-foreground">Add a location</h3>
        <p className="mt-1 text-xs text-muted-foreground">We'll look it up using Open-Meteo geocoding.</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">City</label>
            <input
              autoFocus
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Austin"
              className="mt-1 w-full h-10 px-3 rounded-xl bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">State or country</label>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. TX or Japan"
              className="mt-1 w-full h-10 px-3 rounded-xl bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 h-9 rounded-full text-sm bg-secondary text-secondary-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 h-9 rounded-full text-sm bg-primary text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add location"}
          </button>
        </div>
      </form>
    </div>
  );
}