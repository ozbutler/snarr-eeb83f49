import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { NewsSection } from "@/components/wb/NewsSection";
import { fetchNewsBriefing, refreshNewsBriefing, type NewsBundle } from "@/lib/news/rssNews";
import { useApp } from "@/lib/weather/AppContext";

export const Route = createFileRoute("/news")({
  loader: async () => {
    try {
      return await fetchNewsBriefing({
        data: {
          label: "Philadelphia, PA",
        },
      });
    } catch {
      return null;
    }
  },
  head: () => ({
    meta: [
      { title: "News — Snarr" },
      {
        name: "description",
        content: "Daily news briefing with local stories, technology, business, world news, and sports.",
      },
      { property: "og:title", content: "News — Snarr" },
      {
        property: "og:description",
        content: "A personalized local-first daily news briefing experience.",
      },
    ],
  }),
  component: NewsPage,
});

function dispatchNewsSourceStatus(data: NewsBundle | null, refreshing: boolean) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("snarr:news-source-status", {
      detail: {
        rssSources: data?.rssSources ?? [],
        refreshing,
      },
    }),
  );
}

function NewsPage() {
  const initialData = Route.useLoaderData();
  const { selected } = useApp();

  const [data, setData] = useState<NewsBundle | null>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function refreshNews() {
    if (refreshing) return;

    setRefreshing(true);
    dispatchNewsSourceStatus(data, true);
    setRefreshError(null);

    try {
      const nextData = await refreshNewsBriefing({
        data: {
          label: selected.label,
          lat: selected.lat,
          lon: selected.lon,
        },
      });

      setData(nextData);
      dispatchNewsSourceStatus(nextData, false);
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : "Could not refresh RSS news feeds.");
      dispatchNewsSourceStatus(data, false);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refreshNews();
  }, [selected.id]);

  useEffect(() => {
    dispatchNewsSourceStatus(data, refreshing);
  }, [data, refreshing]);

  if (!data) {
    return (
      <PageShell>
        <section className="rounded-3xl bg-card p-8 shadow-[var(--shadow-card)] text-center">
          <div className="text-4xl">📰</div>
          <h2 className="mt-3 text-lg font-semibold">News temporarily unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Snarr could not load your daily briefing right now.
          </p>
          <button
            type="button"
            onClick={refreshNews}
            disabled={refreshing}
            className="mt-4 h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh News"}
          </button>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section
        className="rounded-3xl p-5 shadow-[var(--shadow-soft)]"
        style={{ background: "var(--gradient-sky)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Daily Briefing
            </p>

            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              Personalized News Briefing
            </h1>

            <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
              Local-first updates based on {selected.label} with balanced national and global coverage.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshNews}
            disabled={refreshing}
            className="shrink-0 rounded-full bg-card/80 px-3 py-1.5 text-[11px] font-medium text-foreground shadow-[var(--shadow-card)] disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {refreshError && (
          <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
            {refreshError}
          </p>
        )}
      </section>

      <NewsSection title="Top Stories" icon="📰" articles={data.sections.top} sources={data.sectionSources.top} />
      <NewsSection title="Local" icon="📍" articles={data.sections.local} sources={data.sectionSources.local} />
      <NewsSection title="Weather Alerts" icon="⛈️" articles={data.sections.weather} sources={data.sectionSources.weather} />
      <NewsSection title="U.S." icon="🇺🇸" articles={data.sections.us} sources={data.sectionSources.us} />
      <NewsSection title="World" icon="🌎" articles={data.sections.world} sources={data.sectionSources.world} />
      <NewsSection title="Technology & AI" icon="💻" articles={data.sections.technology} sources={data.sectionSources.technology} />
      <NewsSection title="Business" icon="📈" articles={data.sections.business} sources={data.sectionSources.business} />
      <NewsSection title="Sports" icon="🏈" articles={data.sections.sports} sources={data.sectionSources.sports} />
      <NewsSection title="Trending" icon="🔥" articles={data.sections.trending} sources={data.sectionSources.trending} />

      <p className="text-center text-[11px] text-muted-foreground">
        Updated {new Date(data.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </p>
    </PageShell>
  );
}
