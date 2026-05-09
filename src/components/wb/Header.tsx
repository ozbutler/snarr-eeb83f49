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
  const { units, toggleUnits, refresh, loading } = useApp();
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-border">
      <div className="mx-auto max-w-md px-4 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Daily Weather Brief
            </h1>
            <p className="text-xs text-muted-foreground">Your quick morning weather check</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleUnits}
              className="h-9 px-3 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
              aria-label="Toggle units"
            >
              °{units}
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground hover:bg-accent transition-colors flex items-center justify-center disabled:opacity-60"
              aria-label="Refresh"
            >
              <span className={loading ? "animate-spin inline-block" : "inline-block"}>🔄</span>
            </button>
          </div>
        </div>

        <div className="mt-3">
          <LocationSelector />
        </div>

        <nav className="mt-3 grid grid-cols-4 gap-1 p-1 bg-secondary rounded-2xl">
          {TABS.map((t) => {
            const active = pathname === t.to;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={
                  "text-center text-sm font-medium py-2 rounded-xl transition-all " +
                  (active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
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