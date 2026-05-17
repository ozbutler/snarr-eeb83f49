import { Link, useLocation } from "@tanstack/react-router";
import { LocationSelector } from "./LocationSelector";
import { GlobalSystemStatus } from "./GlobalSystemStatus";
import { NotificationButton } from "./NotificationButton";
import { useApp } from "@/lib/weather/AppContext";
import homeLogo from "@/assets/logos/snarr-home-logo.png";
import weatherLogo from "@/assets/logos/snarr-weather-logo.png";
import roadsLogo from "@/assets/logos/snarr-roads-logo.png";

const TABS = [
  { to: "/", label: "Home" },
  { to: "/weather", label: "Weather" },
  { to: "/roads", label: "Roads" },
  { to: "/news", label: "News" },
] as const;

const LOGO_MAP: Record<string, { src: string; alt: string }> = {
  "/": { src: homeLogo, alt: "Snarr home logo" },
  "/weather": { src: weatherLogo, alt: "Snarr weather logo" },
  "/roads": { src: roadsLogo, alt: "Snarr roads logo" },
  "/news": { src: homeLogo, alt: "Snarr home logo" },
};

export function Header() {
  const { units, toggleUnits, refresh, loading, forecast } = useApp();
  const { pathname } = useLocation();
  const updatedLabel = forecast
    ? `Updated ${new Date(forecast.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : loading ? "Updating…" : "Your morning briefing";
  const logo = LOGO_MAP[pathname] ?? LOGO_MAP["/"];

  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/75 border-b border-border/70" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto max-w-md px-4 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={logo.src}
              alt={logo.alt}
              width={42}
              height={42}
              className="h-[42px] w-[42px] rounded-full object-cover shadow-sm bg-white shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold tracking-tight text-foreground leading-tight">
                Snarr
              </h1>
              <p className="text-[11px] text-muted-foreground/80 leading-tight truncate">{updatedLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <GlobalSystemStatus />
            <NotificationButton />
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
            const active =
              t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
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
