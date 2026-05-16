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

const RSS_FALLBACKS: Record<NewsSection, RssFeedConfig[]> = {
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

function getNewsApiKey() {
  return process.env.NEWS_API_KEY;
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
        "User-Agent": "Snarr/1.0 RSS fallback reader",
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

async function fetchRssFallbackSection(section: NewsSection, seen: Set<string>): Promise<SectionResult> {
  const feeds = RSS_FALLBACKS[section];
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

async function fetchNewsApiSection(section: NewsSection, seen: Set<string>, key: string): Promise<SectionResult> {
  const base = "https://newsapi.org/v2";
  const params = new URLSearchParams({
    apiKey: key,
    pageSize: "8",
    language: "en",
  });

  let endpoint = `${base}/top-headlines`;

  if (section === "top") {
    params.set("country", "us");
  } else if (section === "us") {
    params.set("country", "us");
  } else if (section === "technology") {
    params.set("country", "us");
    params.set("category", "technology");
  } else if (section === "business") {
    params.set("country", "us");
    params.set("category", "business");
  } else if (section === "sports") {
    params.set("country", "us");
    params.set("category", "sports");
  } else {
    endpoint = `${base}/everything`;
    params.set("q", "world OR global OR international");
    params.set("sortBy", "publishedAt");
  }

  try {
    const res = await fetch(`${endpoint}?${params.toString()}`);

    if (!res.ok) {
      let message = `News API returned HTTP ${res.status}`;

      try {
        const errorJson = await res.json();
        if (errorJson?.message) message = String(errorJson.message);
      } catch {}

      return { articles: [], error: message };
    }

    const json = await res.json();

    if (json?.status === "error") {
      return {
        articles: [],
        error: json?.message ? String(json.message) : "News API returned an error response.",
      };
    }

    const articles = Array.isArray(json?.articles) ? json.articles : [];

    const out: NewsArticle[] = [];
    for (const article of articles) {
      const headline = String(article?.title ?? "").trim();
      const url = String(article?.url ?? "").trim();
      if (!headline || !url || headline === "[Removed]") continue;

      const duplicateKey = `${headline.toLowerCase()}|${url}`;
      if (seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);

      out.push({
        id: articleId(section, headline, url),
        headline,
        summary: cleanSummary(article?.description, article?.content),
        source: article?.source?.name || SECTION_LABELS[section],
        publishedAt: article?.publishedAt || new Date().toISOString(),
        url,
        imageUrl: article?.urlToImage || undefined,
        section,
      });
    }

    return { articles: out.slice(0, 6) };
  } catch (e) {
    return {
      articles: [],
      error: e instanceof Error ? e.message : "News API request failed.",
    };
  }
}

export const fetchNewsBriefing = createServerFn({ method: "GET" }).handler(async (): Promise<NewsBundle> => {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const key = getNewsApiKey();
  const sectionIds: NewsSection[] = ["top", "us", "world", "technology", "business", "sports"];
  const sections = Object.fromEntries(
    sectionIds.map((section) => [section, [] as NewsArticle[]]),
  ) as Record<NewsSection, NewsArticle[]>;

  const seen = new Set<string>();
  const errors: string[] = [];
  const usedFallbackSections: NewsSection[] = [];

  if (key) {
    const results = await Promise.allSettled(
      sectionIds.map(async (section) => [section, await fetchNewsApiSection(section, seen, key)] as const),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const [section, sectionResult] = result.value;
        sections[section] = sectionResult.articles;
        if (sectionResult.error) errors.push(`${SECTION_LABELS[section]}: ${sectionResult.error}`);
      } else {
        errors.push(result.reason instanceof Error ? result.reason.message : "Unknown news fetch error.");
      }
    }
  } else {
    errors.push("NEWS_API_KEY is missing, using free RSS fallback feeds.");
  }

  const missingSections = sectionIds.filter((section) => sections[section].length === 0);
  for (const section of missingSections) {
    const fallbackResult = await fetchRssFallbackSection(section, seen);
    sections[section] = fallbackResult.articles;

    if (fallbackResult.articles.length) {
      usedFallbackSections.push(section);
    } else if (fallbackResult.error) {
      errors.push(`${SECTION_LABELS[section]} RSS fallback: ${fallbackResult.error}`);
    }
  }

  const storyCount = Object.values(sections).reduce((total, articles) => total + articles.length, 0);
  const fallbackText = usedFallbackSections.length
    ? ` RSS fallback used for ${usedFallbackSections.map((section) => SECTION_LABELS[section]).join(", ")}.`
    : "";

  const data: NewsBundle = {
    sections,
    updatedAt: Date.now(),
    sourceStatus: storyCount > 0
      ? {
          status: errors.length || usedFallbackSections.length ? "warning" : "success",
          message: errors.length || usedFallbackSections.length
            ? `News loaded with ${storyCount} stories.${fallbackText}`
            : `News API loaded successfully with ${storyCount} stories.`,
          storyCount,
        }
      : {
          status: "error",
          message: errors[0] ?? "News API and RSS fallbacks returned zero usable stories.",
          storyCount: 0,
        },
  };

  cache = {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return data;
});
