import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/weather/AppContext";
import { searchLocations, type GeocodeResult } from "@/lib/weather/weatherApi";
import { MapPin, Search, Trash2, ChevronDown, X } from "lucide-react";

export function LocationSelector() {
  const {
    locations, selected, setSelected, addLocation, removeLocation,
    locationPermission, requestCurrentLocation,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = locations.find((l) => l.current);
  const defaults = locations.filter((l) => !l.current && !l.custom);
  const customs = locations.filter((l) => l.custom);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchLocations(q, 6);
      setResults(r);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(""); setResults([]); }
  }, [open]);

  function pickExisting(id: string) {
    setSelected(id);
    setOpen(false);
  }
  function pickResult(r: GeocodeResult) {
    addLocation({ label: r.name, lat: r.lat, lon: r.lon });
    setOpen(false);
  }
  function pickCurrent() {
    if (current) {
      setSelected(current.id);
      setOpen(false);
    } else {
      requestCurrentLocation();
    }
  }

  const triggerLabel = useMemo(() => selected.label.replace(/^📍\s*/, ""), [selected.label]);
  const triggerIsCurrent = !!selected.current;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 h-9 pl-3.5 pr-3 rounded-full bg-card text-foreground text-[13px] font-medium border border-border shadow-[var(--shadow-card)] focus:outline-none focus:ring-2 focus:ring-ring"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <MapPin className={"h-3.5 w-3.5 " + (triggerIsCurrent ? "text-primary" : "text-muted-foreground")} />
        <span className="flex-1 text-left truncate">{triggerLabel}</span>
        <ChevronDown className={"h-3.5 w-3.5 text-muted-foreground transition-transform " + (open ? "rotate-180" : "")} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-2xl bg-card border border-border shadow-[var(--shadow-soft)] overflow-hidden"
        >
          {/* Search bar */}
          <div className="p-2.5 border-b border-border/70">
            <div className="flex items-center gap-2 h-9 px-3 rounded-full bg-secondary/70">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city, state, country"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                autoComplete="off"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div
            className="max-h-[60vh] overflow-y-auto overscroll-contain"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
          >
            {query.trim() ? (
              <div className="py-1">
                {searching && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">Searching…</p>
                )}
                {!searching && results.length === 0 && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">No matches found.</p>
                )}
                {results.map((r, i) => (
                  <button
                    key={`${r.lat}-${r.lon}-${i}`}
                    onClick={() => pickResult(r)}
                    className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex flex-col"
                  >
                    <span className="text-[13px] font-medium text-foreground">
                      {r.city}{r.region ? `, ${r.region}` : ""}
                    </span>
                    {r.country && (
                      <span className="text-[11px] text-muted-foreground">{r.country}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {/* Current location pinned */}
                <button
                  onClick={pickCurrent}
                  className={
                    "w-full text-left px-4 py-2.5 flex items-center gap-2.5 hover:bg-accent transition-colors " +
                    (selected.current ? "bg-primary/5" : "")
                  }
                >
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-foreground">Current Location</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {current
                        ? current.label.replace(/^📍\s*Current\s*·\s*/, "")
                        : locationPermission === "denied"
                        ? "Access denied — enable in browser settings"
                        : locationPermission === "unsupported"
                        ? "Not supported on this device"
                        : "Tap to detect"}
                    </div>
                  </div>
                </button>

                <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">Saved</div>
                {defaults.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => pickExisting(l.id)}
                    className={
                      "w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-center " +
                      (selected.id === l.id ? "bg-primary/5 font-medium" : "")
                    }
                  >
                    <span className="text-[13px] text-foreground">{l.label}</span>
                  </button>
                ))}

                {customs.length > 0 && (
                  <>
                    <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground/80">Custom</div>
                    {customs.map((l) => (
                      <div
                        key={l.id}
                        className={
                          "flex items-center gap-1 hover:bg-accent transition-colors " +
                          (selected.id === l.id ? "bg-primary/5" : "")
                        }
                      >
                        <button
                          onClick={() => pickExisting(l.id)}
                          className="flex-1 text-left px-4 py-2.5"
                        >
                          <span className={"text-[13px] text-foreground " + (selected.id === l.id ? "font-medium" : "")}>
                            {l.label}
                          </span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmRemoveId(l.id); }}
                          className="px-3 py-2.5 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${l.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {confirmRemoveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">Remove location?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Remove <span className="font-medium text-foreground">
                {locations.find((l) => l.id === confirmRemoveId)?.label}
              </span> from your saved locations?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmRemoveId(null)}
                className="px-3 h-9 rounded-full text-sm bg-secondary text-secondary-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => { removeLocation(confirmRemoveId); setConfirmRemoveId(null); }}
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