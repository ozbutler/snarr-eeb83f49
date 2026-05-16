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

export interface NewsBundle {
  sections: Record<NewsSection, NewsArticle[]>;
  updatedAt: number;
  sourceStatus: {
    status: NewsSourceStatus;
    message: string;
    storyCount: number;
  };
}

type CacheEntry = {
  expiresAt: number;
  data: NewsBundle;
};

type SectionResult = {
  articles: NewsArticle[];
  error?: string;
};

type RssFeedConfig = {
  url: string;
  source: string;
};

const CACHE_TTL_MS = 15 * 60 * 1000;
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
  ],
  us: [
    { source: "NPR", url: "https://feeds.npr.org/1003/rss.xml" },
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml" },
  ],
  world: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml" },
  ],
  technology: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
    { source: "NPR", url: "https://feeds.npr.org/1019/rss.xml" },
  ],
  business: [
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
    { source: "NPR", url: "https://feeds.npr.org/1006/rss.xml" },
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

function pushUniqueArticles(target: NewsArticle[], articles: NewsArticle[], seen: Set<string>, limit = 6) {
  for (const article of articles) {
    const duplicateKey = `${article.headline.toLowerCase()}|${article.url}`;
    if (seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    target.push(article);
    if (target.length >= limit) break;
  }
}

async function fetchRssFeed(section: NewsSection, feed: RssFeedConfig): Promise<SectionResult> {
  try {
    const res = await fetch(feed.url, {
      headers: {
        "User-Agent": "Snarr/1.0 RSS reader",
      },
    });

    if (!res.ok) {
      return { articles: [], error: `${feed.source} RSS returned HTTP ${res.status}` };
    }

    const xml = await res.text();
    const items = Array.from(xml.matchAll(/<item[\s\S]*?<\/item>/gi)).slice(0, 10);

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

    return { articles };
  } catch (e) {
    return {
      articles: [],
      error: e instanceof Error ? `${feed.source} RSS failed: ${e.message}` : `${feed.source} RSS failed.`,
    };
  }
}

async function fetchRssSection(section: NewsSection, seen: Set<string>): Promise<SectionResult> {
  const feeds = RSS_FEEDS[section];
  const articles: NewsArticle[] = [];
  const errors: string[] = [];

  for (const feed of feeds) {
    const result = await fetchRssFeed(section, feed);
    if (result.error) errors.push(result.error);
    pushUniqueArticles(articles, result.articles, seen, 6);
    if (articles.length >= 6) break;
  }

  return {
    articles,
    error: articles.length ? undefined : errors[0],
  };
}

export const fetchNewsBriefing = createServerFn({ method: "GET" }).handler(async (): Promise<NewsBundle> => {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const sectionIds: NewsSection[] = ["top", "us", "world", "technology", "business", "sports"];
  const sections = Object.fromEntries(
    sectionIds.map((section) => [section, [] as NewsArticle[]]),
  ) as Record<NewsSection, NewsArticle[]>;

  const seen = new Set<string>();
  const errors: string[] = [];

  const results = await Promise.allSettled(
    sectionIds.map(async (section) => [section, await fetchRssSection(section, seen)] as const),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      const [section, sectionResult] = result.value;
      sections[section] = sectionResult.articles;
      if (sectionResult.error) errors.push(`${SECTION_LABELS[section]}: ${sectionResult.error}`);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : "Unknown RSS fetch error.");
    }
  }

  const storyCount = Object.values(sections).reduce((total, articles) => total + articles.length, 0);
  const data: NewsBundle = {
    sections,
    updatedAt: Date.now(),
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

  cache = {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return data;
});
