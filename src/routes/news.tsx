import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { NewsBriefCard } from "@/components/wb/NewsBriefCard";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "News — Snarr" },
      { name: "description", content: "Daily news brief — coming soon." },
      { property: "og:title", content: "News — Snarr" },
      { property: "og:description", content: "Your morning news briefing." },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  return (
    <PageShell>
      <NewsBriefCard />
    </PageShell>
  );
}