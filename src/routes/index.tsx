import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { CollapsibleCard } from "@/components/wb/CollapsibleCard";
import { useApp } from "@/lib/weather/AppContext";
import { describeCode, fmtTemp, outfitFor, parseForecastDateLocal, rainWindow } from "@/lib/weather/weatherUtils";
import { buildRoadBriefing } from "@/lib/weather/trafficUtils";
import { fetchNewsBriefing, refreshNewsBriefing, type NewsArticle, type NewsBundle } from "@/lib/news/rssNews";
import type { ForecastData } from "@/lib/weather/types";

export const Route = createFileRoute("/")({
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
      { title: "Morning Briefing — Snarr" },
      {
        name: "description",
        content: "Your daily weather, roads, and news briefing in one simple morning dashboard.",
      },
      { property: "og:title", content: "Morning Briefing — Snarr" },
      {
        property: "og:description",
        content: "A personalized morning briefing for weather, roads, and local-first news.",
      },
    ],
  }),
  component: Index,
});

type BriefingContext = NonNullable<ReturnType<typeof buildBriefingContext>>;

function Index() {
  const initialNews = Route.useLoaderData();
  const { selected, forecast, units } = useApp();
  const [news, setNews] = useState<NewsBundle | null>(initialNews);
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const refreshNews = useCallback(async () => {
    setNewsRefreshing(true);
    setNewsError(null);

    try {
      const nextNews = await refreshNewsBriefing({
        data: {
          label: selected.label,
          lat: selected.lat,
          lon: selected.lon,
        },
      });
      setNews(nextNews);
    } catch (e) {
      setNewsError(e instanceof Error ? e.message : "Could not refresh the news briefing.");
    } finally {
      setNewsRefreshing(false);
    }
  }, [selected.label, selected.lat, selected.lon]);

  useEffect(() => {
    void refreshNews();
  }, [selected.id, refreshNews]);

  const briefing = useMemo(
    () => buildBriefingContext(forecast, news),
    [forecast, news],
  );

  return (
    <PageShell>
      <MorningBriefingHero
        briefing={briefing}
        newsError={newsError}
        newsRefreshing={newsRefreshing}
        onRefreshNews={refreshNews}
        selectedLabel={selected.label}
        units={units}
      />

      {briefing && (
        <>
          <TodayTimelineCard briefing={briefing} units={units} />
          <NewsBriefingCard briefing={briefing} newsRefreshing={newsRefreshing} />
          <RoadsBriefCard briefing={briefing} />
          <NextDaysCard />
        </>
      )}
    </PageShell>
  );
}

function buildBriefingContext(forecast: ForecastData | null, news: NewsBundle | null) {
  if (!forecast) return null;

  const { current, today, hourly } = forecast;
  const weatherDescription = describeCode(today.weatherCode, current.isDay);
  const outfit = outfitFor(today.high, today.rainChance);
  const rain = rainWindow(hourly);
  const roads = buildRoadBriefing(today.weatherCode, today.rainChance);
  const articles = firstArticles(news, 3);
  const activeNewsSourceCount = news?.rssSources.filter(
    (source) => source.status === "success" && source.storyCount > 0,
  ).length ?? 0;

  return {
    forecast,
    current,
    today,
    hourly,
    weatherDescription,
    outfit,
    rain,
    roads,
    articles,
    activeNewsSourceCount,
    dateLine: new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    recommendation: buildRecommendation({
      rainChance: today.rainChance,
      high: today.high,
      roadLevel: roads.level,
      rainWindowText: rain,
      outfit: outfit.main,
    }),
  };
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstArticles(news: NewsBundle | null, limit = 3): NewsArticle[] {
  if (!news) return [];

  const sections = [
    ...(news.sections.local ?? []),
    ...(news.sections.weather ?? []),
    ...(news.sections.top ?? []),
  ];

  const seen = new Set<string>();
  return sections.filter((article) => {
    const key = article.id || `${article.headline}:${article.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function MorningBriefingHero({
  briefing,
  newsError,
  newsRefreshing,
  onRefreshNews,
  selectedLabel,
  units,
}: {
  briefing: BriefingContext | null;
  newsError: string | null;
  newsRefreshing: boolean;
  onRefreshNews: () => void;
  selectedLabel: string;
  units: string;
}) {
  if (!briefing) {
    return (
      <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-card)] text-center">
        <div className="text-4xl">☀️</div>
        <h1 className="mt-3 text-xl font-semibold">Building your morning briefing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Snarr is loading weather, roads, and news for your selected location.
        </p>
      </section>
    );
  }

  const { current, today, weatherDescription, rain, roads, articles, dateLine, recommendation } = briefing;

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-5 text-foreground shadow-[var(--shadow-soft)]"
      style={{ background: "var(--gradient-sky)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Morning Briefing · {selectedLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {greeting()} {weatherDescription.emoji}
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground/85">{dateLine}</p>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[44px] leading-none font-semibold tracking-tight">
            {fmtTemp(current.temp, units)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Feels {fmtTemp(current.feelsLike, units)}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-background/45 p-3 backdrop-blur-sm">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          What you need to know
        </div>
        <p className="mt-1 text-[14px] leading-relaxed text-foreground/90">
          {recommendation}
        </p>
      </div>

      {newsError && (
        <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          News refresh failed. Showing the last available stories.
        </p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <BriefingMetricCard
          label="Weather"
          value={`H ${fmtTemp(today.high, units)} · L ${fmtTemp(today.low, units)}`}
          detail={rain ? `Rain ${rain}` : `💧 ${today.rainChance}%`}
        />
        <BriefingMetricCard
          label="Roads"
          value={capitalize(roads.level)}
          detail={`${roads.roadEmoji} ${roads.roadLabel}`}
        />
        <BriefingMetricCard
          label="News"
          value={`${articles.length} stories`}
          detail={newsRefreshing ? "Updating" : articles.length ? "Ready" : "Loading"}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <HeroLink to="/weather" label="Weather" />
        <HeroLink to="/roads" label="Roads" />
        <button
          type="button"
          onClick={onRefreshNews}
          disabled={newsRefreshing}
          className="rounded-full bg-card/80 px-3 py-2 text-center text-[11px] font-medium text-foreground shadow-[var(--shadow-card)] disabled:opacity-60"
        >
          {newsRefreshing ? "Updating…" : "Refresh news"}
        </button>
      </div>
    </section>
  );
}

function TodayTimelineCard({ briefing, units }: { briefing: BriefingContext; units: string }) {
  const points = buildTodayTimeline(briefing, units);

  return (
    <section className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold text-foreground">Today Timeline</h2>
        <Link to="/weather" className="text-[11px] text-primary font-medium">Hourly →</Link>
      </div>
      <div className="mt-2 space-y-1.5">
        {points.map((point) => (
          <div key={point.label} className="flex items-center gap-2 rounded-xl bg-secondary/45 px-3 py-2">
            <span className="w-16 shrink-0 text-[11px] font-medium text-muted-foreground">{point.label}</span>
            <span className="text-base">{point.icon}</span>
            <span className="min-w-0 flex-1 text-[12px] text-foreground/85">{point.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildTodayTimeline(briefing: BriefingContext, units: string) {
  const { current, today, rain, roads, outfit } = briefing;
  const nextRainText = rain ? `Rain most likely ${rain}` : "No major rain window expected";

  return [
    {
      label: "Now",
      icon: briefing.weatherDescription.emoji,
      text: `${fmtTemp(current.temp, units)}, feels ${fmtTemp(current.feelsLike, units)}.` ,
    },
    {
      label: "Today",
      icon: today.rainChance >= 50 ? "🌧️" : "👕",
      text: today.rainChance >= 50 ? nextRainText : `Wear: ${outfit.main}.`,
    },
    {
      label: "Roads",
      icon: roads.emoji,
      text: `${capitalize(roads.level)} traffic, ${roads.roadLabel.toLowerCase()} roads.`,
    },
  ];
}

function BriefingMetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl bg-card/70 p-2.5">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="mt-0.5 text-[12px] font-semibold">{value}</div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function HeroLink({ to, label }: { to: "/weather" | "/roads"; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-full bg-card/80 px-3 py-2 text-center text-[11px] font-medium text-foreground shadow-[var(--shadow-card)]"
    >
      {label}
    </Link>
  );
}

function buildRecommendation({
  rainChance,
  high,
  roadLevel,
  rainWindowText,
  outfit,
}: {
  rainChance: number;
  high: number;
  roadLevel: string;
  rainWindowText: string | null;
  outfit: string;
}) {
  if (rainChance >= 60) {
    return `Bring rain gear today. ${rainWindowText ? `Rain is most likely ${rainWindowText}. ` : "Rain is likely at some point today. "}${outfit} is the safest clothing choice.`;
  }

  if (roadLevel === "heavy") {
    return "Roads may be slower than usual today. Leave a little earlier and check the roads page before heading out.";
  }

  if (high >= 85) {
    return `It will be hot today, so dress light and stay hydrated. ${outfit} should work well.`;
  }

  if (high <= 45) {
    return `It will feel cold today. ${outfit} is the better move before heading out.`;
  }

  return `Conditions look manageable today. ${outfit} should work, and roads do not look unusually risky from the current forecast.`;
}

function capitalize(value: string) {
  return value.length ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function RoadsBriefCard({ briefing }: { briefing: BriefingContext }) {
  const { roads } = briefing;
  const summary = `${roads.emoji} ${capitalize(roads.level)} traffic · ${roads.roadLabel.toLowerCase()} roads`;

  return (
    <CollapsibleCard id="briefing:roads" title="Roads Brief" icon="🛣️" summary={summary}>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{roads.summary}</p>
        <div className="rounded-xl bg-secondary/45 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Recommendation</div>
          <div className="mt-1 text-sm text-foreground/85">{roads.recommendation}</div>
        </div>
      </div>
      <div className="mt-2 text-right">
        <Link to="/roads" className="text-xs text-primary font-medium">Roads details →</Link>
      </div>
    </CollapsibleCard>
  );
}

function NewsBriefingCard({
  briefing,
  newsRefreshing,
}: {
  briefing: BriefingContext;
  newsRefreshing: boolean;
}) {
  const { articles, activeNewsSourceCount } = briefing;

  return (
    <CollapsibleCard
      id="briefing:news"
      title="Top Stories"
      icon="📰"
      summary={articles.length ? `${articles.length} stories · ${activeNewsSourceCount} source${activeNewsSourceCount === 1 ? "" : "s"}` : newsRefreshing ? "Loading local-first stories" : "No stories loaded yet"}
    >
      {articles.length ? (
        <div className="space-y-2">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl bg-secondary/45 px-3 py-2 transition-colors hover:bg-secondary/70"
            >
              <div className="text-sm font-medium leading-snug text-foreground">{article.headline}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{article.source}</div>
            </a>
          ))}
          <div className="text-right">
            <Link to="/news" className="text-xs text-primary font-medium">Full news briefing →</Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-secondary/45 px-3 py-2 text-sm text-muted-foreground">
          News is still loading. Open the News page for the full briefing.
          <div className="mt-2 text-right">
            <Link to="/news" className="text-xs text-primary font-medium">Open news →</Link>
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}

function NextDaysCard() {
  const { forecast, units } = useApp();
  if (!forecast) return null;
  const days = forecast.daily.slice(1, 4);

  return (
    <section className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold text-foreground">Next 3 Days</h2>
        <Link to="/weather" search={{ tab: "week" }} className="text-[11px] text-primary font-medium">Full week →</Link>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {days.map((d) => {
          const desc = describeCode(d.weatherCode);
          const day = parseForecastDateLocal(d.date).toLocaleDateString(undefined, { weekday: "short" });
          return (
            <div key={d.date} className="rounded-xl bg-secondary/50 px-2 py-2 text-center">
              <div className="text-[10px] font-medium text-muted-foreground">{day}</div>
              <div className="text-xl leading-none mt-1">{desc.emoji}</div>
              <div className="mt-1 text-[12px] font-semibold">{fmtTemp(d.high, units)}</div>
              <div className="text-[10px] text-muted-foreground">{fmtTemp(d.low, units)} · 💧{d.rainChance}%</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
