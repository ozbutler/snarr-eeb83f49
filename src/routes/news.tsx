import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { CollapsibleCard } from "@/components/wb/CollapsibleCard";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "News — Snarr" },
      {
        name: "description",
        content: "Daily news briefing.",
      },
      { property: "og:title", content: "News — Snarr" },
      {
        property: "og:description",
        content: "A clean daily personal news briefing experience.",
      },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  return (
    <PageShell>
      <section
        className="rounded-3xl p-5 shadow-[var(--shadow-soft)]"
        style={{ background: "var(--gradient-sky)" }}
      >
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Daily Briefing
        </p>

        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          News Briefing
        </h1>

        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
          The news module is being repaired. The rest of the app should load normally now.
        </p>
      </section>

      <CollapsibleCard
        id="news:repair"
        title="News temporarily unavailable"
        icon="📰"
        summary="Repair needed"
      >
        <div className="rounded-2xl border border-border/50 bg-secondary/25 p-3 text-sm text-muted-foreground">
          The News page was crashing because src/lib/news/rssNews.ts was overwritten and no longer exports the functions used by this route. This temporary page removes that broken import so the app can load again.
        </div>
      </CollapsibleCard>
    </PageShell>
  );
}
