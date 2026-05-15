import type { Confidence } from "@/lib/weather/types";

export function compatibilitySourceLabel(level: Confidence, sources?: string[]) {
  if (level === "low") return "Sources vary";
  const count = sources?.length ?? 0;
  if (count >= 3) return `${count} sources`;
  if (count === 2) return "Multiple sources";
  return "1 source";
}
