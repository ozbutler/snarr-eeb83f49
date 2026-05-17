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
  badges?: string[];
  relevanceScore?: number;
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

const emptySections: Record<NewsSection, NewsArticle[]> = {
  top: [],
  us: [],
  world: [],
  technology: [],
  business: [],
  sports: [],
};

const emptySectionSources: Record<NewsSection, string[]> = {
  top: [],
  us: [],
  world: [],
  technology: [],
  business: [],
  sports: [],
};

function buildNewsBundle(): NewsBundle {
  return {
    sections: emptySections,
    sectionSources: emptySectionSources,
    updatedAt: Date.now(),
    rssSources: [],
    sourceStatus: {
      status: "warning",
      message: "News is temporarily unavailable while the feed system is repaired.",
      storyCount: 0,
    },
  };
}

export const fetchNewsBriefing = createServerFn({ method: "GET" }).handler(async (): Promise<NewsBundle> => {
  return buildNewsBundle();
});

export const refreshNewsBriefing = createServerFn({ method: "POST" }).handler(async (): Promise<NewsBundle> => {
  return buildNewsBundle();
});
