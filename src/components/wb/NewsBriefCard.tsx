import { Link } from "@tanstack/react-router";
import { CollapsibleCard } from "./CollapsibleCard";

const CATEGORIES = [
  { icon: "🇺🇸", label: "U.S." },
  { icon: "🌍", label: "World" },
  { icon: "💻", label: "Tech" },
  { icon: "🏆", label: "Sports" },
];

export function NewsBriefCard() {
  return (
    <CollapsibleCard
      id="home:news"
      title="Daily News Brief"
      icon="📰"
      summary="Your morning briefing is ready"
    >
      <div className="space-y-2">
        <div className="rounded-xl bg-secondary/50 p-3">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Daily Briefing
          </div>

          <div className="mt-1 text-sm font-medium text-foreground">
            Top stories across U.S., world, business, technology, and sports.
          </div>

          <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
            Open the News page for your full personalized morning briefing.
          </p>

          <div className="mt-2 text-right">
            <Link to="/news" className="text-[11px] text-primary font-medium">
              Open briefing →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((c) => (
            <div
              key={c.label}
              className="rounded-xl bg-secondary/60 px-2 py-3 flex flex-col items-center gap-1"
            >
              <span className="text-xl opacity-80">{c.icon}</span>
              <span className="text-[11px] text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </CollapsibleCard>
  );
}
