import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { CollapsibleCard } from "@/components/wb/CollapsibleCard";
import { OutdoorConditionsCard } from "@/components/wb/OutdoorConditions";
import { TodayAtAGlanceCard } from "@/components/wb/TodayAtAGlanceCard";
import { useApp } from "@/lib/weather/AppContext";
import { describeCode, fmtTemp, outfitFor, parseForecastDateLocal, rainWindow } from "@/lib/weather/weatherUtils";
import { buildRoadBriefing } from "@/lib/weather/trafficUtils";
import { fetchNewsBriefing, refreshNewsBriefing, type NewsArticle, type NewsBundle } from "@/lib/news/rssNews";

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

function Index() {
  const initialNews = Route.useLoaderData();
  const { selected } = useApp();
  const [news, setNews] = useState<NewsBundle | null>(initialNews);
  const [newsRefreshing, setNewsRefreshing] = useState(false);

  async function refreshNews() {
    if (newsRefreshing) return;

    setNewsRefreshing(true);
    try {
      const nextNews = await refreshNewsBriefing({
        data: {
          label: selected.label,
          lat: selected.lat,
          lon: selected.lon,
        },
      });
      setNews(nextNews);
    } catch {
      // Keep the last successful news bundle if refresh fails.
    } finally {
      setNewsRefreshing(false);
    }
  }

  useEffect(() => {
    refreshNews();
  }, [selected.id]);

  return (
    <PageShell>
      <MorningBriefingHero news={news} newsRefreshing={newsRefreshing} onRefreshNews={refreshNews} />
      <BriefingTiles news={news} />
      <TodayAtAGlanceCard />
      <NextDaysCard />
      <OutdoorConditionsCard />
    </PageShell>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstArticles(news: NewsBundle | null, limit = 3): NewsArticle[] {
  if (!news) return [];

  const local = news.sections.local ?? [];
  const top = news.sections.top ?? [];
  const weather = news.sections.weather ?? [];

  const seen = new Set<string>();
  return [...local, ...weather, ...top].filter((article) => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  }).slice(0, limit);
}

function MorningBriefingHero({
  news,
  newsRefreshing,
  onRefreshNews,
}: {
  news: NewsBundle | null;
  newsRefreshing: boolean;
  onRefreshNews: () => void;
}) {
  const { forecast, selected, units } = useApp();
  const topNews = useMemo(() => firstArticles(news, 3), [news]);

  if (!forecast) {
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

  const { current, today, hourly } = forecast;
  const desc = describeCode(today.weatherCode, current.isDay);
  const outfit = outfitFor(today.high, today.rainChance);
  const rain = rainWindow(hourly);
  const roads = buildRoadBriefing(today.weatherCode, today.rainChance);
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const recommendation = buildRecommendation(today.rainChance, today.high, roads.level, rain, outfit.main);

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-5 text-foreground shadow-[var(--shadow-soft)]"
      style={{ background: "var(--gradient-sky)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Morning Briefing · {selected.label}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {greeting()} {desc.emoji}
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

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-card/70 p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase">Weather</div>
          <div className="mt-0.5 text-[12px] font-semibold">
            H {fmtTemp(today.high, units)} · L {fmtTemp(today.low, units)}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">💧 {today.rainChance}%</div>
        </div>

        <div className="rounded-xl bg-card/70 p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase">Roads</div>
          <div className="mt-0.5 text-[12px] font-semibold capitalize">
            {roads.level}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{roads.roadEmoji} {roads.roadLabel}</div>
        </div>

        <div className="rounded-xl bg-card/70 p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase">News</div>
          <div className="mt-0.5 text-[12px] font-semibold">
            {topNews.length || 0} stories
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {newsRefreshing ? "Updating" : "Ready"}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{rain ? `Rain most likely ${rain}` : "No major rain window expected"}</span>
        <Link to="/weather" className="font-medium text-primary">Details →</Link>
      </div>

      <div className="mt-3 flex gap-2">
        <Link
          to="/weather"
          className="flex-1 rounded-full bg-card/80 px-3 py-2 text-center text-[11px] font-medium text-foreground shadow-[var(--shadow-card)]"
        >
          Weather
        </Link>
        <Link
          to="/roads"
          className="flex-1 rounded-full bg-card/80 px-3 py-2 text-center text-[11px] font-medium text-foreground shadow-[var(--shadow-card)]"
        >
          Roads
        </Link>
        <button
          type="button"
          onClick={onRefreshNews}
          disabled={newsRefreshing}
          className="flex-1 rounded-full bg-card/80 px-3 py-2 text-center text-[11px] font-medium text-foreground shadow-[var(--shadow-card)] disabled:opacity-60"
        >
          {newsRefreshing ? "Updating…" : "News"}
        </button>
      </div>
    </section>
  );
}

function buildRecommendation(rainChance: number, high: number, roadLevel: string, rainWindowText: string | null, outfit: string) {
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

function BriefingTiles({ news }: { news: NewsBundle | null }) {
  return (
    <>
      <WeatherBriefCard />
      <RoadsBriefCard />
      <NewsBriefingCard news={news} />
    </>
  );
}

function WeatherBriefCard() {
  const { forecast, units } = useApp();
  if (!forecast) return null;

  const { current, today, hourly } = forecast;
  const desc = describeCode(today.weatherCode, current.isDay);
  const rain = rainWindow(hourly);
  const outfit = outfitFor(today.high, today.rainChance);

  return (
    <CollapsibleCard
      id="briefing:weather"
      title="Weather Brief"
      icon={desc.emoji}
      summary={`${fmtTemp(today.high, units)} high · ${today.rainChance}% rain`}
    >
      <div className="space-y-2 text-sm">
        <p className="text-foreground/85">
          {desc.label}. High {fmtTemp(today.high, units)}, low {fmtTemp(today.low, units)}, feels like {fmtTemp(current.feelsLike, units)} now.
        </p>
        <div className="rounded-xl bg-secondary/45 px-3 py-2 text-[12px] text-muted-foreground">
          {rain ? `Rain most likely ${rain}.` : "No major rain window expected right now."}
        </div>
        <div className="rounded-xl bg-secondary/45 px-3 py-2 text-[12px] text-muted-foreground">
          Wear: {outfit.main}{outfit.extra ? `, ${outfit.extra.toLowerCase()}` : ""}.
        </div>
      </div>
    </CollapsibleCard>
  );
}

function RoadsBriefCard() {
  const { forecast } = useApp();
  if (!forecast) return null;

  const brief = buildRoadBriefing(forecast.today.weatherCode, forecast.today.rainChance);
  const summary = `${brief.emoji} ${brief.level[0].toUpperCase()}${brief.level.slice(1)} traffic · ${brief.roadLabel.toLowerCase()} roads`;

  return (
    <CollapsibleCard id="briefing:roads" title="Roads Brief" icon="🛣️" summary={summary}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span>{brief.emoji}</span>
          <span className="font-medium capitalize">{brief.level} traffic</span>
          <span className="text-muted-foreground">·</span>
          <span>{brief.roadEmoji}</span>
          <span>{brief.roadLabel} roads</span>
        </div>
        <p className="text-sm text-muted-foreground">{brief.summary}</p>
        <div className="rounded-xl bg-secondary/45 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Recommendation</div>
          <div className="mt-1 text-sm text-foreground/85">{brief.recommendation}</div>
        </div>
      </div>
      <div className="mt-2 text-right">
        <Link to="/roads" className="text-xs text-primary font-medium">Roads details →</Link>
      </div>
    </CollapsibleCard>
  );
}

function NewsBriefingCard({ news }: { news: NewsBundle | null }) {
  const articles = useMemo(() => firstArticles(news, 3), [news]);
  const sourceCount = news?.rssSources.filter((source) => source.status === "success" && source.storyCount > 0).length ?? 0;

  return (
    <CollapsibleCard
      id="briefing:news"
      title="News Brief"
      icon="📰"
      summary={articles.length ? `${articles.length} top stories · ${sourceCount} source${sourceCount === 1 ? "" : "s"}` : "Loading local-first stories"}
    >
      {articles.length ? (
        <div className="space-y-2">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl bg-secondary/45 px-3 py-2"
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
