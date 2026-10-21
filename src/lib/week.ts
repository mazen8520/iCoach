// Nutrition weeks run Saturday -> Friday. Weekdays are stored with JavaScript's numbering
// (0 = Sunday ... 6 = Saturday) in meals.day_of_week and nutrition_plans.day_types.
import { addDays, isoDate } from "./format";

/** Display order: Saturday first. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

/** The Saturday that starts the nutrition week containing `date`. */
export function startOfSaturdayWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const sinceSaturday = (d.getDay() + 1) % 7;
  d.setDate(d.getDate() - sinceSaturday);
  return d;
}

/** The calendar date of `weekday` inside the Saturday-start week containing `anchor`. */
export function dateForWeekday(weekday: number, anchor: Date = new Date()): Date {
  const position = WEEK_ORDER.indexOf(weekday as (typeof WEEK_ORDER)[number]);
  return addDays(startOfSaturdayWeek(anchor), Math.max(0, position));
}

export function isoForWeekday(weekday: number, anchor: Date = new Date()): string {
  return isoDate(dateForWeekday(weekday, anchor));
}

/** A reference date for each weekday (any week) so Intl can print its name. */
export function sampleDateForWeekday(weekday: number): Date {
  // 2026-01-03 was a Saturday (weekday 6).
  return addDays(new Date(2026, 0, 3), (weekday + 1) % 7);
}
