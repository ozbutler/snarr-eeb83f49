import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { NewsSection } from "@/components/wb/NewsSection";
import { fetchNewsBriefing } from "@/lib/news/newsApi";

export const Route = createFileRoute("/news")({
  loader: async () => {
    try {
      return await fetchNewsBriefing();
    } catch {
      return null;
    }
  },
  head: () => ({
    meta: [
      { title: "News — Snarr" },
      {
        name: "description",
        content: "Daily news briefing with top stories, technology, business, world news, and sports.",
      },
      { property: "og:title", content: "News — Snarr" },
      {
        property: "og:description",
        content: "A clean daily personal news briefing experience.",
      },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const data = Route.useLoaderData();

  if (!data) {
    return (
      <PageShell>
        <section className="rounded-3xl bg-card p-8 shadow-[var(--shadow-card)] text-center">
          <div className="text-4xl">📰</div>
          <h2 className="mt-3 text-lg font-semibold">News temporarily unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Snarr could not load your daily briefing right now.
          </p>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section
        className="rounded-3xl p-5 shadow-[var(--shadow-soft)]"
        style={{ background: "var(--gradient-sky)" }}
      >
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Daily Briefing
        </p>

        <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          Morning News
        </h1>

        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
          Concise updates across top stories, world events, technology, business, and sports.
        </p>
      </section>

      <NewsSection title="Top Stories" icon="📰" articles={data.sections.top} />
      <NewsSection title="U.S." icon="🇺🇸" articles={data.sections.us} />
      <NewsSection title="World" icon="🌎" articles={data.sections.world} />
      <NewsSection title="Technology" icon="💻" articles={data.sections.technology} />
      <NewsSection title="Business" icon="📈" articles={data.sections.business} />
      <NewsSection title="Sports" icon="🏈" articles={data.sections.sports} />

      <p className="text-center text-[11px] text-muted-foreground">
        Updated {new Date(data.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </p>
    </PageShell>
  );
}
