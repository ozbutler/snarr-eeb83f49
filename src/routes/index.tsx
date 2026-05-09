import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/wb/PageShell";
import { MorningSummaryCard } from "@/components/wb/MorningSummaryCard";
import { RainAlertsCard } from "@/components/wb/RainAlertsCard";
import { OutfitCard } from "@/components/wb/OutfitCard";
import { WeekPreviewCard } from "@/components/wb/WeekPreviewCard";
import { RoadsSummaryCard } from "@/components/wb/RoadsSummaryCard";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <PageShell>
      <MorningSummaryCard />
      <RainAlertsCard />
      <OutfitCard />
      <WeekPreviewCard />
      <RoadsSummaryCard />
    </PageShell>
  );
}
