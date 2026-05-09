import type { ReactNode } from "react";
import { useApp } from "@/lib/weather/AppContext";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ErrorCard } from "./ErrorCard";

export function PageShell({ children }: { children: ReactNode }) {
  const { loading, error, forecast, refresh } = useApp();

  return (
    <main className="mx-auto max-w-md px-4 py-4 pb-24 space-y-4 animate-in fade-in">
      {error && <ErrorCard message={error} onRetry={refresh} />}
      {loading && !forecast ? <LoadingSkeleton lines={3} /> : children}
    </main>
  );
}