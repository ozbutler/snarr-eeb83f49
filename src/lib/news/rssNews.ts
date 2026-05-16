import { createServerFn } from "@tanstack/react-start";

export type NewsSection = "top" | "us" | "world" | "technology" | "business" | "sports";
export type NewsSourceStatus = "success" | "warning" | "error";

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  imageUrl?: string;
  section: NewsSection;
}

export interface RssSourceStatus {
  sourceName: string;
  status: NewsSourceStatus;
  lastUpdated: number;
  message: string;
  storyCount: number;
}

export interface NewsBundle {
  sections: Record<NewsSection, NewsArticle[]>;
  updatedAt: number;
  sourceStatus: {
    status: NewsSourceStatus;
    message: string;
    storyCount: number;
  };
  rssSources: RssSourceStatus[];
  sectionSources: Record<NewsSection, string[]>;
}

type CacheEntry = {
  expiresAt: number;
  data: NewsBundle;
};

type SectionResult = {
  articles: NewsArticle[];
  error?: string;
  sourceStatuses: RssSourceStatus[];
  sourcesUsed: string[];
};

type FeedResult = {
  articles: NewsArticle[];
  status: RssSourceStatus;
};

type RssFeedConfig = {
  url: string;
  source: string;
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_STORY_AGE_MS = 72 * 60 * 60 * 1000;
let cache: CacheEntry | null = null;

const SECTION_LABELS: Record<NewsSection, string> = {
  top: "Top Stories",
  us: "U.S.",
  world: "World",
  technology: "Technology",
  business: "Business",
  sports: "Sports",
};

const RSS_FEEDS: Record<NewsSection, RssFeedConfig[]> = {
  top: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
    { source: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },
    { source: "AP News", url: "https://apnews.com/hub/ap-top-news?output=rss" },
  ],
  us: [
    { source: "NPR", url: "https://feeds.npr.org/1003/rss.xml" },
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml" },
    { source: "AP News", url: "https://apnews.com/hub/us-news?output=rss" },
  ],
  world: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml" },
    { source: "AP News", url: "https://apnews.com/hub/world-news?output=rss" },
  ],
  technology: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
    { source: "NPR", url: "https://feeds.npr.org/1019/rss.xml" },
    { source: "TechCrunch", url: "https://techcrunch.com/feed/" },
    { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
    { source: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  ],
  business: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
    { source: "NPR", url: "https://feeds.npr.org/1006/rss.xml" },
    { source: "AP News", url: "https://apnews.com/hub/business?output=rss" },
  ],
  sports: [
    { source: "ESPN", url: "https://www.espn.com/espn/rss/news" },
    { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
  ],
};

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getTagValue(itemXml: string, tag: string) {
  const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function cleanSummary(description?: string | null, content?: string | null) {
  const source = description || content || "No summary available.";
  const clean = source.replace(/\s+/g, " ").replace(/\[\+\d+ chars\]$/i, "").trim();
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 177).trim()}...`;
}

function articleId(section: NewsSection, title: string, url: string) {
  return `${section}:${title}:${url}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 120);
}

function normalizeHeadline(value: string) {
  return value
    .toLowerCase()
    .replace(/\s[-|–—:]\s.*$/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(bbc|npr|espn|ap|reuters|techcrunch|ars technica|the verge)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isFreshArticle(article: NewsArticle) {
  const publishedAt = new Date(article.publishedAt).getTime();
  if (Number.isNaN(publishedAt)) return true;
  return Date.now() - publishedAt <= MAX_STORY_AGE_MS;
}

function pushUniqueArticles(target: NewsArticle[], articles: NewsArticle[], seen: Set<string>, limit = 6) {
  for (const article of articles) {
    const duplicateKey = normalizeHeadline(article.headline);
    if (!duplicateKey || seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    target.push(article);
    if (target.length >= limit) break;
  }
}

function mergeSourceStatuses(statuses: RssSourceStatus[]): RssSourceStatus[] {
  const bySource = new Map<string, RssSourceStatus>();

  for (const status of statuses) {
    const existing = bySource.get(status.sourceName);
    if (!existing) {
      bySource.set(status.sourceName, status);
      continue;
    }

    const storyCount = existing.storyCount + status.storyCount;
    const nextStatus: NewsSourceStatus = existing.status === "success" || status.status === "success"
      ? "success"
      : existing.status === "warning" || status.status === "warning"
        ? "warning"
        : "error";

    bySource.set(status.sourceName, {
      sourceName: status.sourceName,
      status: nextStatus,
      storyCount,
      lastUpdated: Math.max(existing.lastUpdated, status.lastUpdated),
      message: storyCount > 0
        ? `${status.sourceName} RSS loaded successfully with ${storyCount} stories.`
        : status.message,
    });
  }

  return Array.from(bySource.values()).sort((a, b) => a.sourceName.localeCompare(b.sourceName));
}

async function fetchRssFeed(section: NewsSection, feed: RssFeedConfig): Promise<FeedResult> {
  const checkedAt = Date.now();

  try {
    const res = await fetch(feed.url, {
      headers: {
        "User-Agent": "Snarr/1.0 RSS reader",
      },
    });

    if (!res.ok) {
      return {
        articles: [],
        status: {
          sourceName: feed.source,
          status: "error",
          lastUpdated: checkedAt,
          message: `${feed.source} RSS returned HTTP ${res.status}.`,
          storyCount: 0,
        },
      };
    }

    const xml = await res.text();
    const items = Array.from(xml.matchAll(/<item[\s\S]*?<\/item>/gi)).slice(0, 12);

    const articles = items.map((match, index) => {
      const itemXml = match[0];
      const headline = getTagValue(itemXml, "title");
      const url = getTagValue(itemXml, "link") || getTagValue(itemXml, "guid");
      const summary = cleanSummary(getTagValue(itemXml, "description"), getTagValue(itemXml, "content:encoded"));
      const publishedAt = getTagValue(itemXml, "pubDate") || new Date().toISOString();

      if (!headline || !url) return null;

      return {
        id: articleId(section, headline, url || `${feed.url}#${index}`),
        headline,
        summary,
        source: feed.source,
        publishedAt,
        url,
        section,
      } satisfies NewsArticle;
    }).filter(Boolean) as NewsArticle[];

    return {
      articles,
      status: {
        sourceName: feed.source,
        status: articles.length ? "success" : "warning",
        lastUpdated: checkedAt,
        message: articles.length
          ? `${feed.source} RSS loaded successfully with ${articles.length} stories.`
          : `${feed.source} RSS returned no usable stories.`,
        storyCount: articles.length,
      },
    };
  } catch (e) {
    return {
      articles: [],
      status: {
        sourceName: feed.source,
        status: "error",
        lastUpdated: checkedAt,
        message: e instanceof Error ? `${feed.source} RSS failed: ${e.message}` : `${feed.source} RSS failed.`,
        storyCount: 0,
      },
    };
  }
}

async function fetchRssSection(section: NewsSection, seen: Set<string>): Promise<SectionResult> {
  const feeds = RSS_FEEDS[section];
  const freshArticles: NewsArticle[] = [];
  const backupArticles: NewsArticle[] = [];
  const errors: string[] = [];
  const sourceStatuses: RssSourceStatus[] = [];

  for (const feed of feeds) {
    const result = await fetchRssFeed(section, feed);
    sourceStatuses.push(result.status);
    if (result.status.status === "error") errors.push(result.status.message);
    pushUniqueArticles(freshArticles, result.articles.filter(isFreshArticle), seen, 6);
    pushUniqueArticles(backupArticles, result.articles, seen, 6);
    if (freshArticles.length >= 6) break;
  }

  const articles = freshArticles.length ? freshArticles : backupArticles.slice(0, 3);
  const sourcesUsed = Array.from(new Set(articles.map((article) => article.source)));

  return {
    articles,
    sourceStatuses,
    sourcesUsed,
    error: articles.length ? undefined : errors[0],
  };
}

async function buildNewsBundle(): Promise<NewsBundle> {
  const sectionIds: NewsSection[] = ["top", "us", "world", "technology", "business", "sports"];
  const sections = Object.fromEntries(
    sectionIds.map((section) => [section, [] as NewsArticle[]]),
  ) as Record<NewsSection, NewsArticle[]>;
  const sectionSources = Object.fromEntries(
    sectionIds.map((section) => [section, [] as string[]]),
  ) as Record<NewsSection, string[]>;

  const seen = new Set<string>();
  const errors: string[] = [];
  const sourceStatuses: RssSourceStatus[] = [];

  const results = await Promise.allSettled(
    sectionIds.map(async (section) => [section, await fetchRssSection(section, seen)] as const),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      const [section, sectionResult] = result.value;
      sections[section] = sectionResult.articles;
      sectionSources[section] = sectionResult.sourcesUsed;
      sourceStatuses.push(...sectionResult.sourceStatuses);
      if (sectionResult.error) errors.push(`${SECTION_LABELS[section]}: ${sectionResult.error}`);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : "Unknown RSS fetch error.");
    }
  }

  const storyCount = Object.values(sections).reduce((total, articles) => total + articles.length, 0);
  const rssSources = mergeSourceStatuses(sourceStatuses);

  return {
    sections,
    updatedAt: Date.now(),
    rssSources,
    sectionSources,
    sourceStatus: storyCount > 0
      ? {
          status: errors.length ? "warning" : "success",
          message: errors.length
            ? `RSS news loaded with ${storyCount} stories, but some feeds failed.`
            : `RSS news loaded successfully with ${storyCount} stories.`,
          storyCount,
        }
      : {
          status: "error",
          message: errors[0] ?? "RSS news feeds returned zero usable stories.",
          storyCount: 0,
        },
  };
}

export const fetchNewsBriefing = createServerFn({ method: "GET" }).handler(async (): Promise<NewsBundle> => {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const data = await buildNewsBundle();
  cache = {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return data;
});

export const refreshNewsBriefing = createServerFn({ method: "POST" }).handler(async (): Promise<NewsBundle> => {
  const data = await buildNewsBundle();
  cache = {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return data;
});
