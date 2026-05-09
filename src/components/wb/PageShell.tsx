import type { ReactNode } from "react";
import { useApp } from "@/lib/weather/AppContext";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { ErrorCard } from "./ErrorCard";

export function PageShell({ children }: { children: ReactNode }) {
  const { loading, error, forecast, refresh } = useApp();

  return (
    <main
      className="mx-auto max-w-md px-4 py-3 space-y-3 animate-fade-in"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}
    >
      {error && <ErrorCard message={error} onRetry={refresh} />}
      {loading && !forecast ? <LoadingSkeleton lines={3} /> : children}
    </main>
  );
}