export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] animate-pulse">
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="mt-3 h-10 w-2/3 rounded bg-muted" />
          <div className="mt-3 h-3 w-full rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}