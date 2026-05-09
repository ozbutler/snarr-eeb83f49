import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  id: string;                  // localStorage key
  title: string;
  icon?: string;               // emoji
  summary?: ReactNode;         // shown when collapsed
  defaultOpen?: boolean;
  children: ReactNode;
  tone?: "default" | "alert";
}

const KEY = (id: string) => `wb:collapse:${id}`;

export function CollapsibleCard({
  id, title, icon, summary, defaultOpen = false, children, tone = "default",
}: Props) {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY(id));
      if (v === "1") setOpen(true);
      else if (v === "0") setOpen(false);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try { localStorage.setItem(KEY(id), next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const base =
    tone === "alert"
      ? "rounded-2xl border border-destructive/40 bg-destructive/5"
      : "rounded-2xl bg-card shadow-[var(--shadow-card)]";

  return (
    <section className={base}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        {icon && <span className="text-lg leading-none">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {!open && summary && (
            <div className="mt-0.5 text-xs text-muted-foreground truncate">{summary}</div>
          )}
        </div>
        <ChevronDown
          className={
            "h-4 w-4 text-muted-foreground transition-transform duration-200 " +
            (open ? "rotate-180" : "")
          }
        />
      </button>
      <div
        className={
          "grid transition-all duration-200 ease-out " +
          (open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")
        }
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-0">{children}</div>
        </div>
      </div>
    </section>
  );
}