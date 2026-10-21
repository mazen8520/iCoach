import { GOALS, isOneOf } from "./taxonomy";
import type { TranslationKey } from "./i18n";
import type { ClientGoalsRow } from "./database.types";

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** The athlete's primary goal as display text (custom goals show their own wording). */
export function goalLabel(
  t: Translate,
  goals: Pick<ClientGoalsRow, "primary_goal" | "primary_goal_custom"> | null,
) {
  if (!goals?.primary_goal) return null;
  if (goals.primary_goal === "custom") return goals.primary_goal_custom?.trim() || t("goal.custom");
  return isOneOf(GOALS, goals.primary_goal) ? t(`goal.${goals.primary_goal}`) : goals.primary_goal;
}

/** True when a new weigh-in reaches (or crosses) the athlete's target weight. */
export function reachedWeightTarget(
  target: number | null | undefined,
  previous: number | null | undefined,
  next: number,
): boolean {
  if (target == null) return false;
  if (previous == null) return Math.abs(next - target) <= 0.2;
  if (previous > target) return next <= target;
  if (previous < target) return next >= target;
  return false;
}
