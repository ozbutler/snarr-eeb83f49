import { createServerFn } from "@tanstack/react-start";

type LocationInput = {
  label?: string;
  lat?: number;
  lon?: number;
};

export type NewsSection =
  | "top"
  | "local"
  | "us"
  | "world"
  | "technology"
  | "business"
  | "sports"
  | "weather"
  | "trending";

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
  badges?: string[];
  relevanceScore?: number;
  relevanceReasons?: string[];
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
  userLocation?: LocationInput;
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
  local?: boolean;
};

type RankedArticle = NewsArticle & {
  relevanceScore: number;
  relevanceReasons: string[];
  badges: string[];
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_STORY_AGE_MS = 72 * 60 * 60 * 1000;
const TOP_STORY_LIMIT = 8;
const SECTION_STORY_LIMIT = 6;
const SOURCE_CAP_TOP = 2;
const SOURCE_CAP_SECTION = 2;
const cache = new Map<string, CacheEntry>();

const SECTION_IDS: NewsSection[] = [
  "top",
  "local",
  "us",
  "world",
  "technology",
  "business",
  "sports",
  "weather",
  "trending",
];

const SECTION_LABELS: Record<NewsSection, string> = {
  top: "Top Stories",
  local: "Local",
  us: "U.S.",
  world: "World",
  technology: "Technology",
  business: "Business",
  sports: "Sports",
  weather: "Weather Alerts",
  trending: "Trending",
};

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "Washington DC",
};

const LOW_VALUE_TERMS = [
  "royal family",
  "prince harry",
  "meghan",
  "celebrity",
  "reality tv",
  "gossip",
  "red carpet",
  "opinion",
  "column",
];

const WEATHER_ALERT_TERMS = [
  "storm",
  "tornado",
  "hurricane",
  "flood",
  "wildfire",
  "severe weather",
  "heat advisory",
  "winter storm",
  "emergency",
  "evacuation",
];

const BREAKING_TERMS = ["breaking", "live updates", "urgent", "developing", "emergency"];
const TECH_TERMS = ["ai", "artificial intelligence", "tech", "software", "chip", "cyber", "startup", "app", "robot"];
const BUSINESS_TERMS = ["market", "stocks", "economy", "inflation", "company", "business", "earnings", "fed"];
const SPORTS_TERMS = ["nfl", "nba", "mlb", "nhl", "college football", "basketball", "baseball", "football", "soccer"];

const BASE_RSS_FEEDS: Record<Exclude<NewsSection, "local" | "weather">, RssFeedConfig[]> = {
  top: [
    { source: "AP News", url: "https://apnews.com/hub/ap-top-news?output=rss" },
    { source: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },
    { source: "Google News", url: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en" },
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  ],
  us: [
    { source: "AP News", url: "https://apnews.com/hub/us-news?output=rss" },
    { source: "NPR", url: "https://feeds.npr.org/1003/rss.xml" },
    { source: "Google News U.S.", url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-US&gl=US&ceid=US:en" },
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml" },
  ],
  world: [
    { source: "AP News", url: "https://apnews.com/hub/world-news?output=rss" },
    { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml" },
    { source: "Google News World", url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en" },
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  ],
  technology: [
    { source: "TechCrunch", url: "https://techcrunch.com/feed/" },
    { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
    { source: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
    { source: "NPR", url: "https://feeds.npr.org/1019/rss.xml" },
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  ],
  business: [
    { source: "AP News", url: "https://apnews.com/hub/business?output=rss" },
    { source: "NPR", url: "https://feeds.npr.org/1006/rss.xml" },
    { source: "Google News Business", url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en" },
    { source: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  ],
  sports: [
    { source: "ESPN", url: "https://www.espn.com/espn/rss/news" },
    { source: "Google News Sports", url: "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-US&gl=US&ceid=US:en" },
    { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
  ],
  trending: [
    { source: "Google News", url: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en" },
    { source: "AP News", url: "https://apnews.com/hub/ap-top-news?output=rss" },
    { source: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },
  ],
};

function googleNewsSearchUrl(query: string) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

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
    .replace(/\b(bbc|npr|espn|ap|reuters|techcrunch|ars technica|the verge|google news)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isFreshArticle(article: NewsArticle) {
  const publishedAt = new Date(article.publishedAt).getTime();
  if (Number.isNaN(publishedAt)) return true;
  return Date.now() - publishedAt <= MAX_STORY_AGE_MS;
}

function extractLocationParts(location?: LocationInput) {
  const label = location?.label?.replace(/^📍\s*Current\s*·\s*/i, "").replace(/^📍\s*/i, "").trim() || "";
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  const city = parts[0] && !/current location/i.test(parts[0]) ? parts[0] : undefined;
  const rawState = parts[1]?.split(/\s+/)[0]?.toUpperCase();
  const stateCode = rawState && STATE_NAMES[rawState] ? rawState : undefined;
  const stateName = stateCode ? STATE_NAMES[stateCode] : parts[1];

  return {
    label,
    city,
    stateCode,
    stateName,
    tokens: [city, stateCode, stateName].filter(Boolean).map((token) => token!.toLowerCase()),
  };
}

function getLocationFeeds(location?: LocationInput): RssFeedConfig[] {
  const parts = extractLocationParts(location);
  const feeds: RssFeedConfig[] = [];

  if (parts.city && parts.stateName) {
    feeds.push({
      source: `Local News: ${parts.city}`,
      url: googleNewsSearchUrl(`${parts.city} ${parts.stateName} local news OR breaking news`),
      local: true,
    });
  }

  if (parts.stateName) {
    feeds.push({
      source: `State News: ${parts.stateName}`,
      url: googleNewsSearchUrl(`${parts.stateName} news OR politics OR weather OR traffic`),
      local: true,
    });
  }

  if (!feeds.length) {
    feeds.push({
      source: "Google News Local",
      url: googleNewsSearchUrl("local news near me United States"),
      local: true,
    });
  }

  return feeds;
}

function getWeatherFeeds(location?: LocationInput): RssFeedConfig[] {
  const parts = extractLocationParts(location);
  const area = [parts.city, parts.stateName].filter(Boolean).join(" ") || "United States";

  return [
    {
      source: "Weather Alerts",
      url: googleNewsSearchUrl(`${area} weather alert severe storm flood heat advisory`),
      local: true,
    },
    {
      source: "National Weather News",
      url: googleNewsSearchUrl("United States severe weather forecast alerts"),
    },
  ];
}

function getFeedsForSection(section: NewsSection, location?: LocationInput): RssFeedConfig[] {
  if (section === "local") return getLocationFeeds(location);
  if (section === "weather") return getWeatherFeeds(location);
  return BASE_RSS_FEEDS[section];
}

function textIncludesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function scoreArticle(article: NewsArticle, section: NewsSection, location?: LocationInput): RankedArticle {
  let score = 0;
  const reasons: string[] = [];
  const badges = new Set<string>();
  const parts = extractLocationParts(location);
  const text = `${article.headline} ${article.summary} ${article.source}`.toLowerCase();
  const ageMs = Date.now() - new Date(article.publishedAt).getTime();
  const ageHours = Number.isNaN(ageMs) ? 12 : ageMs / (60 * 60 * 1000);

  if (section === "local") {
    score += 35;
    badges.add("Local");
    reasons.push("local section boost");
  }

  if (section === "weather") {
    score += 25;
    badges.add("Weather Alert");
    reasons.push("weather section boost");
  }

  if (parts.tokens.some((token) => token && text.includes(token))) {
    score += 40;
    badges.add("Near You");
    reasons.push("matches selected location");
  }

  if (ageHours <= 6) {
    score += 25;
    reasons.push("very recent");
  } else if (ageHours <= 24) {
    score += 15;
    reasons.push("recent");
  } else if (ageHours > 48) {
    score -= 20;
    reasons.push("older story penalty");
  }

  if (textIncludesAny(text, BREAKING_TERMS)) {
    score += 35;
    badges.add("Breaking");
    reasons.push("breaking/developing story");
  }

  if (textIncludesAny(text, WEATHER_ALERT_TERMS)) {
    score += 50;
    badges.add("Weather Alert");
    reasons.push("severe weather or emergency relevance");
  }

  if (section === "us") {
    score += 30;
    badges.add("U.S.");
    reasons.push("national news section boost");
  }

  if (section === "world") {
    score += 20;
    badges.add("World");
    reasons.push("world news section boost");
  }

  if (section === "technology" || textIncludesAny(text, TECH_TERMS)) {
    score += 20;
    badges.add("Tech");
    reasons.push("tech or AI relevance");
  }

  if (section === "business" || textIncludesAny(text, BUSINESS_TERMS)) {
    score += 18;
    badges.add("Business");
    reasons.push("business relevance");
  }

  if (section === "sports" || textIncludesAny(text, SPORTS_TERMS)) {
    score += 10;
    badges.add("Sports");
    reasons.push("sports relevance");
  }

  if (section === "trending") {
    score += 12;
    badges.add("Trending");
    reasons.push("trending feed boost");
  }

  if (/ap news|npr|techcrunch|ars technica|the verge|espn|google news/i.test(article.source)) {
    score += 8;
    reasons.push("preferred/diverse source");
  }

  if (/bbc/i.test(article.source)) {
    score -= 8;
    reasons.push("BBC source diversity penalty");
  }

  if (textIncludesAny(text, LOW_VALUE_TERMS) && !textIncludesAny(text, BREAKING_TERMS)) {
    score -= 35;
    reasons.push("low-value filler penalty");
  }

  return {
    ...article,
    badges: Array.from(badges).slice(0, 3),
    relevanceScore: score,
    relevanceReasons: reasons,
  };
}

function rankArticles(articles: NewsArticle[], section: NewsSection, location?: LocationInput) {
  return articles
    .filter(isFreshArticle)
    .map((article) => scoreArticle(article, section, location))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function selectBalancedArticles(articles: RankedArticle[], limit: number, sourceCap: number) {
  const selected: RankedArticle[] = [];
  const seenTopics = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const filteredStories: Array<{ headline: string; source: string; reason: string }> = [];

  for (const article of articles) {
    const topic = normalizeHeadline(article.headline);
    const sourceCount = sourceCounts.get(article.source) ?? 0;

    if (!topic) {
      filteredStories.push({ headline: article.headline, source: article.source, reason: "empty normalized topic" });
      continue;
    }

    if (seenTopics.has(topic)) {
      filteredStories.push({ headline: article.headline, source: article.source, reason: "duplicate topic" });
      continue;
    }

    if (sourceCount >= sourceCap && !article.badges.includes("Breaking")) {
      filteredStories.push({ headline: article.headline, source: article.source, reason: "source cap reached" });
      continue;
    }

    selected.push(article);
    seenTopics.add(topic);
    sourceCounts.set(article.source, sourceCount + 1);

    if (selected.length >= limit) break;
  }

  return { selected, filteredStories };
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
      console.log("News source failed:", feed.source, res.status);

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
    const items = Array.from(xml.matchAll(/<item[\s\S]*?<\/item>/gi)).slice(0, 18);

    const articles = items.map((match, index) => {
      const itemXml = match[0];
      const headline = getTagValue(itemXml, "title");
      const url = getTagValue(itemXml, "link") || getTagValue(itemXml, "guid");
      const sourceFromItem = getTagValue(itemXml, "source");
      const summary = cleanSummary(getTagValue(itemXml, "description"), getTagValue(itemXml, "content:encoded"));
      const publishedAt = getTagValue(itemXml, "pubDate") || new Date().toISOString();

      if (!headline || !url) return null;

      return {
        id: articleId(section, headline, url || `${feed.url}#${index}`),
        headline,
        summary,
        source: sourceFromItem || feed.source,
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
    console.log("News source failed:", feed.source, e);

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

async function fetchRssSection(section: NewsSection, location?: LocationInput): Promise<SectionResult> {
  const feeds = getFeedsForSection(section, location);
  const results = await Promise.all(feeds.map((feed) => fetchRssFeed(section, feed)));
  const sourceStatuses = results.map((result) => result.status);
  const errors = sourceStatuses.filter((status) => status.status === "error").map((status) => status.message);
  const ranked = rankArticles(results.flatMap((result) => result.articles), section, location);
  const { selected, filteredStories } = selectBalancedArticles(
    ranked,
    section === "top" ? TOP_STORY_LIMIT : SECTION_STORY_LIMIT,
    section === "top" ? SOURCE_CAP_TOP : SOURCE_CAP_SECTION,
  );
  const sourcesUsed = Array.from(new Set(selected.map((article) => article.source)));
  const sourcesFailed = sourceStatuses.filter((status) => status.status === "error").map((status) => status.sourceName);

  console.log(`News section ranked: ${SECTION_LABELS[section]}`, {
    sourcesUsed,
    sourcesFailed,
    filteredStories,
    rankedStories: selected.map((article) => ({
      title: article.headline,
      source: article.source,
      category: article.section,
      relevanceScore: article.relevanceScore,
      reasons: article.relevanceReasons,
    })),
  });

  return {
    articles: selected,
    sourceStatuses,
    sourcesUsed,
    error: selected.length ? undefined : errors[0],
  };
}

function buildTopStoriesFromSections(sections: Record<NewsSection, NewsArticle[]>, location?: LocationInput) {
  const candidates = [
    ...sections.local,
    ...sections.weather,
    ...sections.us,
    ...sections.technology,
    ...sections.business,
    ...sections.world,
    ...sections.sports,
    ...sections.trending,
  ].map((article) => scoreArticle({ ...article, section: "top" }, "top", location));

  const { selected, filteredStories } = selectBalancedArticles(candidates.sort((a, b) => b.relevanceScore - a.relevanceScore), TOP_STORY_LIMIT, SOURCE_CAP_TOP);

  console.log("Top story relevance scores:", selected.map((article) => ({
    title: article.headline,
    source: article.source,
    category: article.section,
    relevanceScore: article.relevanceScore,
    reasons: article.relevanceReasons,
  })));
  console.log("Stories filtered out:", filteredStories);

  return selected;
}

function cacheKeyForLocation(location?: LocationInput) {
  const label = location?.label ?? "default";
  const lat = typeof location?.lat === "number" ? location.lat.toFixed(1) : "";
  const lon = typeof location?.lon === "number" ? location.lon.toFixed(1) : "";
  return `${label}:${lat}:${lon}`.toLowerCase();
}

async function buildNewsBundle(location?: LocationInput): Promise<NewsBundle> {
  const sections = Object.fromEntries(
    SECTION_IDS.map((section) => [section, [] as NewsArticle[]]),
  ) as Record<NewsSection, NewsArticle[]>;
  const sectionSources = Object.fromEntries(
    SECTION_IDS.map((section) => [section, [] as string[]]),
  ) as Record<NewsSection, string[]>;

  const errors: string[] = [];
  const sourceStatuses: RssSourceStatus[] = [];
  const sectionsToFetch = SECTION_IDS.filter((section) => section !== "top");

  console.log("User location:", location ?? null);

  const results = await Promise.allSettled(
    sectionsToFetch.map(async (section) => [section, await fetchRssSection(section, location)] as const),
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

  sections.top = buildTopStoriesFromSections(sections, location);
  sectionSources.top = Array.from(new Set(sections.top.map((article) => article.source)));

  const storyCount = Object.values(sections).reduce((total, articles) => total + articles.length, 0);
  const rssSources = mergeSourceStatuses(sourceStatuses);
  const sourcesUsed = rssSources.filter((source) => source.storyCount > 0).map((source) => source.sourceName);
  const sourcesFailed = rssSources.filter((source) => source.status === "error").map((source) => source.sourceName);

  console.log("News sources used:", sourcesUsed);
  console.log("News sources failed:", sourcesFailed);

  return {
    sections,
    updatedAt: Date.now(),
    userLocation: location,
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

export const fetchNewsBriefing = createServerFn({ method: "GET" })
  .validator((location?: LocationInput) => location)
  .handler(async ({ data: location }): Promise<NewsBundle> => {
    const key = cacheKeyForLocation(location);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const data = await buildNewsBundle(location);
    cache.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return data;
  });

export const refreshNewsBriefing = createServerFn({ method: "POST" })
  .validator((location?: LocationInput) => location)
  .handler(async ({ data: location }): Promise<NewsBundle> => {
    const data = await buildNewsBundle(location);
    cache.set(cacheKeyForLocation(location), {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return data;
  });
