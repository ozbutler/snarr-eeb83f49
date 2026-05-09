export function AlertsCard({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] flex items-center gap-3">
        <span className="text-xl">✅</span>
        <p className="text-sm text-muted-foreground">No major weather alerts today.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl p-4 border border-destructive/40 bg-destructive/5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">⚠️</span>
        <h3 className="text-sm font-semibold text-foreground">Severe weather alerts</h3>
      </div>
      <ul className="space-y-1.5 text-sm text-foreground">
        {alerts.map((a, i) => <li key={i}>• {a}</li>)}
      </ul>
    </div>
  );
}