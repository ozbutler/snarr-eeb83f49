import type { NewsArticle } from "@/lib/news/rssNews";
import { CollapsibleCard } from "@/components/wb/CollapsibleCard";

function relativeTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NewsSection({
  title,
  articles,
  icon,
  sources = [],
}: {
  title: string;
  articles: NewsArticle[];
  icon: string;
  sources?: string[];
}) {
  const sourceLabel = sources.length ? `Sources: ${sources.join(" + ")}` : "RSS news feeds";

  return (
    <CollapsibleCard
      id={`news:${title.toLowerCase()}`}
      title={title}
      icon={icon}
      summary={articles.length === 1 ? "1 story" : `${articles.length} stories`}
    >
      <div className="mb-2 rounded-full bg-secondary/40 px-2.5 py-1 text-[10px] text-muted-foreground w-fit">
        {sourceLabel}
      </div>

      {articles.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-secondary/25 p-3 text-sm text-muted-foreground">
          No stories available right now.
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl border border-border/50 bg-secondary/25 p-3 hover:bg-secondary/40 transition-colors"
            >
              <div className="flex gap-3">
                {article.imageUrl ? (
                  <img
                    src={article.imageUrl}
                    alt={article.headline}
                    loading="lazy"
                    className="h-16 w-16 rounded-xl object-cover shrink-0"
                  />
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground mb-1">
                    <span className="truncate">{article.source}</span>
                    <span className="shrink-0">{relativeTime(article.publishedAt)}</span>
                  </div>

                  <h3 className="text-[13px] font-semibold leading-snug text-foreground line-clamp-2">
                    {article.headline}
                  </h3>

                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
                    {article.summary}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
}
