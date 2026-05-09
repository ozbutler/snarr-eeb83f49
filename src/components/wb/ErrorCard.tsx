export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] border border-destructive/30">
      <div className="flex items-start gap-3">
        <div className="text-2xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Couldn't load weather</h3>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
          <button
            onClick={onRetry}
            className="mt-3 h-9 px-3 rounded-full text-xs font-medium bg-primary text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}