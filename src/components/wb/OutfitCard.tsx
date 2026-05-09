import { useApp } from "@/lib/weather/AppContext";
import { outfitFor, describeCode } from "@/lib/weather/weatherUtils";

export function OutfitCard() {
  const { forecast } = useApp();
  if (!forecast) return null;
  const { today } = forecast;
  const outfit = outfitFor(today.high, today.rainChance);
  const sunny = describeCode(today.weatherCode).label === "Clear";

  return (
    <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Today's Outfit</h3>
        <span className="text-xl">👕</span>
      </div>
      <p className="mt-2 text-base text-foreground">{outfit.main}.</p>
      <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
        {sunny && <li>• Sunglasses recommended.</li>}
        {outfit.extra && <li>• {outfit.extra}.</li>}
        {!outfit.extra && today.rainChance < 20 && <li>• Umbrella probably not needed.</li>}
      </ul>
    </section>
  );
}