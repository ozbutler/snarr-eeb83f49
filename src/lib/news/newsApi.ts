import { createServerFn } from "@tanstack/react-start";

export type NewsSection = "top" | "us" | "world" | "technology" | "business" | "sports";

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
}

type CacheEntry = {
  expiresAt: number;
  data: NewsBundle;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
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
  return process.env.NEWS_API_KEY || process.env.VITE_NEWS_API_KEY;
}

async function fetchSection(section: NewsSection, seen: Set<string>): Promise<NewsArticle[]> {
  const key = getNewsApiKey();
  if (!key) throw new Error("News API key is not configured");

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

  const res = await fetch(`${endpoint}?${params.toString()}`);
  if (!res.ok) throw new Error(`NewsAPI failed for ${section}`);
  const json = await res.json();
  const articles = Array.isArray(json?.articles) ? json.articles : [];

  const out: NewsArticle[] = [];
  for (const article of articles) {
    const headline = String(article?.title ?? "").trim();
    const url = String(article?.url ?? "").trim();
    if (!headline || !url) continue;
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

  return out.slice(0, 6);
}

export const fetchNewsBriefing = createServerFn({ method: "GET" }).handler(async (): Promise<NewsBundle> => {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const seen = new Set<string>();
  const sectionIds: NewsSection[] = ["top", "us", "world", "technology", "business", "sports"];
  const entries = await Promise.all(
    sectionIds.map(async (section) => [section, await fetchSection(section, seen)] as const),
  );

  const data: NewsBundle = {
    sections: Object.fromEntries(entries) as Record<NewsSection, NewsArticle[]>,
    updatedAt: Date.now(),
  };

  cache = {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return data;
});
