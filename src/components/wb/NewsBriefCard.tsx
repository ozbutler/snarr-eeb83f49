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
      summary="News briefing integration coming soon"
    >
      <p className="text-sm text-muted-foreground">
        News briefing integration coming soon.
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
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
    </CollapsibleCard>
  );
}