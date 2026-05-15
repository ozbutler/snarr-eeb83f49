import { AlertTriangle, CheckCircle2, Database, XCircle } from "lucide-react";

export type SourceStatusState = "success" | "warning" | "error";

export interface SourceStatusItem {
  sourceName: string;
  status: SourceStatusState;
  lastUpdated?: number | string | Date | null;
  message?: string;
  isFallbackData?: boolean;
}

interface SourceStatusProps {
  sources: SourceStatusItem[];
  title?: string;
  compact?: boolean;
}

const STATUS_CONFIG: Record<SourceStatusState, { label: string; icon: typeof CheckCircle2; tone: string; bg: string }> = {
  success: {
    label: "Success",
    icon: CheckCircle2,
    tone: "text-emerald-600",
    bg: "bg-emerald-500/10",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    tone: "text-amber-600",
    bg: "bg-amber-500/10",
  },
  error: {
    label: "Error",
    icon: XCircle,
    tone: "text-destructive",
    bg: "bg-destructive/10",
  },
};

function formatUpdatedAt(value?: number | string | Date | null) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function SourceStatus({ sources, title = "Sources", compact = true }: SourceStatusProps) {
  if (!sources.length) return null;

  return (
    <section className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)] border border-border/50">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-[12px] font-semibold text-foreground">{title}</h2>
        </div>

        {compact && (
          <span className="text-[10px] text-muted-foreground">
            {sources.length} source{sources.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        {sources.map((source) => {
          const config = STATUS_CONFIG[source.status];
          const Icon = config.icon;
          const updatedAt = formatUpdatedAt(source.lastUpdated);

          return (
            <div
              key={`${source.sourceName}-${source.message ?? source.status}`}
              className="rounded-xl bg-secondary/40 px-2.5 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${config.bg}`}>
                      <Icon className={`h-3 w-3 ${config.tone}`} />
                    </span>
                    <span className="truncate text-[12px] font-medium text-foreground">
                      {source.sourceName}
                    </span>
                  </div>

                  {source.message && (
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      {source.message}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.tone}`}>
                    {source.isFallbackData ? "Fallback" : config.label}
                  </span>
                  {updatedAt && (
                    <span className="text-[10px] text-muted-foreground">
                      {updatedAt}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
