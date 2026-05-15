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

async function fetchSection(section: NewsSection, seen: Set<string>, key: string): Promise<SectionResult> {
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

  if (!key) {
    return {
      sections,
      updatedAt: Date.now(),
      sourceStatus: {
        status: "error",
        message: "NEWS_API_KEY is missing. Add it to the app environment variables, then redeploy.",
        storyCount: 0,
      },
    };
  }

  const seen = new Set<string>();
  const errors: string[] = [];
  const results = await Promise.allSettled(
    sectionIds.map(async (section) => [section, await fetchSection(section, seen, key)] as const),
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

  const storyCount = Object.values(sections).reduce((total, articles) => total + articles.length, 0);
  const data: NewsBundle = {
    sections,
    updatedAt: Date.now(),
    sourceStatus: storyCount > 0
      ? {
          status: errors.length ? "warning" : "success",
          message: errors.length
            ? `News loaded with ${storyCount} stories, but some sections failed.`
            : `News API loaded successfully with ${storyCount} stories.`,
          storyCount,
        }
      : {
          status: "error",
          message: errors[0] ?? "News API returned zero usable stories. Check the API key, quota, or provider response.",
          storyCount: 0,
        },
  };

  cache = {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return data;
});
