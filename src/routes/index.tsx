import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

type SeverityLevel = "critical" | "important" | "normal" | "background";
type SummaryState = "calm" | "moderate" | "disruptive" | "severe";
type BriefingContext = NonNullable<ReturnType<typeof buildBriefingContext>>;

type PriorityAlert = {
  level: "critical" | "warning" | "info";
  icon: string;
  title: string;
  detail: string;
  score: number;
};

type SectionConfig = {
  id: string;
  priorityScore: number;
  severityLevel: SeverityLevel;
  isCompact?: boolean;
  component: ReactNode;
};

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

  const adaptiveSections = useMemo(
    () => briefing ? buildAdaptiveSections(briefing, units) : [],
    [briefing, units],
  );

  useEffect(() => {
    if (!briefing) return;

    console.log("Homepage severity:", briefing.severity.totalScore);
    console.log("Homepage mood:", briefing.severity.summaryState);
    console.log("Sorted homepage sections:", adaptiveSections.map((section) => ({
      id: section.id,
      priorityScore: section.priorityScore,
      severityLevel: section.severityLevel,
      isCompact: section.isCompact,
    })));
  }, [adaptiveSections, briefing]);

  return (
    <PageShell>
      {briefing?.priorityAlerts.length ? <PriorityAlertsCard alerts={briefing.priorityAlerts} /> : null}

      <MorningBriefingHero
        briefing={briefing}
        newsError={newsError}
        newsRefreshing={newsRefreshing}
        onRefreshNews={refreshNews}
        selectedLabel={selected.label}
        units={units}
      />

      {briefing && adaptiveSections.map((section) => (
        <div key={section.id}>{section.component}</div>
      ))}
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
  const articles = firstArticles(news, 5);
  const severity = calculateBriefingSeverity({ today, roads, topStory: articles[0] });
  const priorityAlerts = buildPriorityAlerts({
    today,
    rain,
    roads,
    topStory: articles[0],
    severity,
  });

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
    priorityAlerts,
    severity,
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
      summaryState: severity.summaryState,
    }),
  };
}

function calculateBriefingSeverity({
  today,
  roads,
  topStory,
}: {
  today: ForecastData["today"];
  roads: ReturnType<typeof buildRoadBriefing>;
  topStory?: NewsArticle;
}) {
  let weatherScore = 0;
  let commuteScore = 0;
  let newsScore = 0;

  if (today.rainChance >= 85) weatherScore += 4;
  else if (today.rainChance >= 70) weatherScore += 3;
  else if (today.rainChance >= 50) weatherScore += 2;

  if (today.high >= 95 || today.low <= 20) weatherScore += 3;
  else if (today.high >= 88 || today.low <= 32) weatherScore += 2;

  if (roads.level === "heavy") commuteScore += 4;
  else if (roads.level === "moderate") commuteScore += 2;

  const storyText = `${topStory?.headline ?? ""} ${topStory?.summary ?? ""}`.toLowerCase();
  if (/breaking|emergency|evacuation|shooting|crash|closure|severe|warning|storm|flood|fire|transit|power outage/.test(storyText)) {
    newsScore += 4;
  } else if (topStory) {
    newsScore += 1;
  }

  const totalScore = weatherScore + commuteScore + newsScore;
  const summaryState: SummaryState = totalScore >= 9
    ? "severe"
    : totalScore >= 6
      ? "disruptive"
      : totalScore >= 3
        ? "moderate"
        : "calm";

  return {
    totalScore,
    weatherScore,
    commuteScore,
    newsScore,
    summaryState,
    summaryText: getSummaryText(summaryState),
  };
}

function getSummaryText(state: SummaryState) {
  if (state === "severe") return "Multiple major issues may affect your day.";
  if (state === "disruptive") return "Today could be disruptive.";
  if (state === "moderate") return "A few things may affect your day.";
  return "Today looks calm overall.";
}

function getSeverityLevel(score: number): SeverityLevel {
  if (score >= 5) return "critical";
  if (score >= 3) return "important";
  if (score >= 1) return "normal";
  return "background";
}

function buildAdaptiveSections(briefing: BriefingContext, units: string): SectionConfig[] {
  const { severity, articles } = briefing;
  const sections: SectionConfig[] = [
    {
      id: "today",
      priorityScore: Math.max(2, severity.weatherScore + 1),
      severityLevel: getSeverityLevel(severity.weatherScore),
      component: <TodayTimelineCard briefing={briefing} units={units} compact={severity.summaryState === "calm"} />,
    },
    {
      id: "commute",
      priorityScore: severity.commuteScore,
      severityLevel: getSeverityLevel(severity.commuteScore),
      isCompact: severity.commuteScore < 2,
      component: <CommuteCard briefing={briefing} compact={severity.commuteScore < 2} />,
    },
    {
      id: "top-story",
      priorityScore: articles.length ? severity.newsScore + 1 : 0,
      severityLevel: getSeverityLevel(severity.newsScore),
      isCompact: severity.newsScore < 3,
      component: <TopStoryCard briefing={briefing} compact={severity.newsScore < 3} />,
    },
    {
      id: "next-days",
      priorityScore: severity.summaryState === "calm" ? 2 : 0,
      severityLevel: "background",
      isCompact: severity.summaryState !== "calm",
      component: <NextDaysCard compact={severity.summaryState !== "calm"} />,
    },
  ];

  return sections
    .filter((section) => section.id !== "top-story" || articles.length > 0)
    .filter((section) => section.priorityScore > 0 || section.id === "next-days")
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function buildPriorityAlerts({
  today,
  rain,
  roads,
  topStory,
  severity,
}: {
  today: ForecastData["today"];
  rain: string | null;
  roads: ReturnType<typeof buildRoadBriefing>;
  topStory?: NewsArticle;
  severity: ReturnType<typeof calculateBriefingSeverity>;
}): PriorityAlert[] {
  const alerts: PriorityAlert[] = [];

  if (today.rainChance >= 85) {
    alerts.push({
      level: "critical",
      icon: "🌧️",
      title: "Heavy rain likely",
      detail: rain ? `Rain most likely ${rain}.` : "Rain is very likely today.",
      score: 5,
    });
  } else if (today.rainChance >= 70) {
    alerts.push({
      level: "warning",
      icon: "🌧️",
      title: "Rain may affect your day",
      detail: rain ? `Rain most likely ${rain}.` : "Rain is likely today.",
      score: 3,
    });
  }

  if (roads.level === "heavy") {
    alerts.push({
      level: "critical",
      icon: "🚗",
      title: "Commute may be slower",
      detail: roads.recommendation,
      score: 4,
    });
  } else if (roads.level === "moderate" && severity.summaryState !== "calm") {
    alerts.push({
      level: "warning",
      icon: "🚗",
      title: "Watch your commute",
      detail: roads.recommendation,
      score: 2,
    });
  }

  if (severity.newsScore >= 4 && topStory) {
    alerts.push({
      level: "warning",
      icon: "📰",
      title: "Important local story",
      detail: topStory.headline,
      score: severity.newsScore,
    });
  }

  return alerts.sort((a, b) => b.score - a.score).slice(0, 3);
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

  const { current, today, weatherDescription, articles, dateLine, recommendation, severity } = briefing;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl p-5 text-foreground shadow-[var(--shadow-soft)] ${severity.summaryState === "severe" || severity.summaryState === "disruptive" ? "ring-1 ring-amber-500/25" : ""}`}
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
          {severity.summaryText}
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
          value={`H ${fmtTemp(today.high, units)}`}
          detail={`L ${fmtTemp(today.low, units)}`}
        />
        <BriefingMetricCard
          label="Stories"
          value={`${articles.length}`}
          detail={newsRefreshing ? "Updating" : "Ready"}
        />
        <BriefingMetricCard
          label="Priority"
          value={capitalize(severity.summaryState)}
          detail={`${severity.totalScore} score`}
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
          {newsRefreshing ? "Updating…" : "Refresh"}
        </button>
      </div>
    </section>
  );
}

function PriorityAlertsCard({ alerts }: { alerts: PriorityAlert[] }) {
  if (!alerts.length) return null;

  return (
    <section className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)] ring-1 ring-amber-500/20">
      <div className="flex items-center gap-2 px-1">
        <span>⚠️</span>
        <h2 className="text-[13px] font-semibold text-foreground">Priority Alerts</h2>
      </div>

      <div className="mt-2 space-y-2">
        {alerts.map((alert) => (
          <div
            key={`${alert.title}-${alert.detail}`}
            className={`rounded-xl px-3 py-2 ${alert.level === "critical" ? "bg-destructive/10" : alert.level === "warning" ? "bg-amber-500/10" : "bg-secondary/45"}`}
          >
            <div className="flex items-start gap-2">
              <span className="text-base">{alert.icon}</span>
              <div>
                <div className="text-sm font-medium text-foreground">{alert.title}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{alert.detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TodayTimelineCard({ briefing, units, compact }: { briefing: BriefingContext; units: string; compact?: boolean }) {
  const points = buildTodayTimeline(briefing, units, compact);

  return (
    <section className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold text-foreground">Today</h2>
        <Link to="/weather" className="text-[11px] text-primary font-medium">Hourly →</Link>
      </div>
      <div className="mt-2 space-y-1.5">
        {points.map((point) => (
          <div key={point.label} className="flex items-center gap-2 rounded-xl bg-secondary/45 px-3 py-2">
            <span className="w-20 shrink-0 text-[11px] font-medium text-muted-foreground">{point.label}</span>
            <span className="text-base">{point.icon}</span>
            <span className="min-w-0 flex-1 text-[12px] text-foreground/85">{point.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildTodayTimeline(briefing: BriefingContext, units: string, compact?: boolean) {
  const { current, today, rain, roads, outfit } = briefing;
  const timeline = [
    {
      label: "Morning",
      icon: "☀️",
      text: `${fmtTemp(current.temp, units)}, feels ${fmtTemp(current.feelsLike, units)}.`,
    },
    {
      label: "Afternoon",
      icon: today.rainChance >= 50 ? "🌧️" : "😎",
      text: today.rainChance >= 50 ? rain || "Rain likely later today." : `High near ${fmtTemp(today.high, units)}.` ,
    },
    {
      label: "Commute",
      icon: roads.emoji,
      text: `${capitalize(roads.level)} traffic expected.`,
    },
    {
      label: "Tonight",
      icon: "🌙",
      text: `Low near ${fmtTemp(today.low, units)}. ${outfit.main}.`,
    },
  ];

  return compact ? timeline.slice(0, 3) : timeline;
}

function CommuteCard({ briefing, compact }: { briefing: BriefingContext; compact?: boolean }) {
  const { roads } = briefing;

  return (
    <CollapsibleCard
      id="briefing:commute"
      title="Commute"
      icon="🚗"
      summary={`${capitalize(roads.level)} traffic · ${roads.roadLabel}`}
    >
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{compact ? roads.recommendation : roads.summary}</p>

        {!compact && (
          <div className="rounded-xl bg-secondary/45 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Recommendation</div>
            <div className="mt-1 text-sm text-foreground/85">{roads.recommendation}</div>
          </div>
        )}
      </div>

      <div className="mt-2 text-right">
        <Link to="/roads" className="text-xs text-primary font-medium">Open roads →</Link>
      </div>
    </CollapsibleCard>
  );
}

function TopStoryCard({ briefing, compact }: { briefing: BriefingContext; compact?: boolean }) {
  const story = briefing.articles[0];

  if (!story) return null;

  return (
    <CollapsibleCard
      id="briefing:top-story"
      title={compact ? "Top Story" : "Important Story"}
      icon="📰"
      summary={story.source}
    >
      <a
        href={story.url}
        target="_blank"
        rel="noreferrer"
        className="block rounded-xl bg-secondary/45 px-3 py-3 transition-colors hover:bg-secondary/70"
      >
        <div className="text-base font-semibold leading-snug text-foreground">
          {story.headline}
        </div>

        {!compact && (
          <div className="mt-2 text-sm text-muted-foreground">
            {story.summary || "Open the full article to read more."}
          </div>
        )}
      </a>

      <div className="mt-2 text-right">
        <Link to="/news" className="text-xs text-primary font-medium">More stories →</Link>
      </div>
    </CollapsibleCard>
  );
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
  summaryState,
}: {
  rainChance: number;
  high: number;
  roadLevel: string;
  rainWindowText: string | null;
  outfit: string;
  summaryState: SummaryState;
}) {
  if (summaryState === "severe") {
    return "Multiple issues may affect your day. Check the priority alerts before heading out.";
  }

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

function NextDaysCard({ compact }: { compact?: boolean }) {
  const { forecast, units } = useApp();
  if (!forecast) return null;
  const days = forecast.daily.slice(1, compact ? 3 : 4);

  return (
    <section className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold text-foreground">Next {compact ? "2" : "3"} Days</h2>
        <Link to="/weather" search={{ tab: "week" }} className="text-[11px] text-primary font-medium">Full week →</Link>
      </div>
      <div className={`mt-2 grid gap-1.5 ${compact ? "grid-cols-2" : "grid-cols-3"}`}>
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
