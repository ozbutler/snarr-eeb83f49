import { Link, useLocation } from "@tanstack/react-router";
import { LocationSelector } from "./LocationSelector";
import { useApp } from "@/lib/weather/AppContext";

const TABS = [
  { to: "/", label: "Home" },
  { to: "/today", label: "Today" },
  { to: "/week", label: "Week" },
  { to: "/roads", label: "Roads" },
] as const;

export function Header() {
  const { units, toggleUnits, refresh, loading, forecast } = useApp();
  const { pathname } = useLocation();
  const updatedLabel = forecast
    ? `Updated ${new Date(forecast.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : loading ? "Updating…" : "Your morning briefing";

  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/75 border-b border-border/70" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto max-w-md px-4 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight text-foreground leading-tight">
              Weather Brief
            </h1>
            <p className="text-[11px] text-muted-foreground/80 leading-tight">{updatedLabel}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleUnits}
              className="h-8 px-2.5 rounded-full text-[11px] font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
              aria-label="Toggle units"
            >
              °{units}
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="h-8 w-8 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors flex items-center justify-center disabled:opacity-60 text-xs"
              aria-label="Refresh"
            >
              <span className={loading ? "animate-spin inline-block" : "inline-block"}>🔄</span>
            </button>
          </div>
        </div>

        <div className="mt-2.5">
          <LocationSelector />
        </div>

        <nav className="mt-2.5 grid grid-cols-4 gap-1 p-0.5 bg-secondary/70 rounded-xl">
          {TABS.map((t) => {
            const active = pathname === t.to;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={
                  "text-center text-[13px] font-medium py-1.5 rounded-lg transition-all " +
                  (active
                    ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground/80 hover:text-foreground")
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}