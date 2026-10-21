// Text helpers shared by the coach planner and the athlete's nutrition page.
import { useI18n } from "@/lib/i18n";
import { sampleDateForWeekday } from "@/lib/week";
import type { FoodUnit } from "@/lib/database.types";

/** Weekday name in the viewer's language (0 = Sunday ... 6 = Saturday). */
export function useWeekdayName() {
  const { fmt } = useI18n();
  return (weekday: number, style: "long" | "short" = "long") =>
    fmt.date(sampleDateForWeekday(weekday), { weekday: style });
}

/** "80 g · Oats" — quantity + translated unit + name. */
export function useFoodLine() {
  const { t } = useI18n();
  return (item: { name: string; quantity?: number | null; unit?: FoodUnit | null }) => {
    const amount =
      item.quantity != null
        ? `${item.quantity}${item.unit ? ` ${t(`foodUnit.${item.unit}`)}` : ""}`
        : "";
    return amount ? `${amount} · ${item.name}` : item.name;
  };
}
