// Language-independent date helpers. User-facing formatting (weekday/month names, "5 min ago",
// clock times) lives in the i18n formatters (`useI18n().fmt`) so it follows the chosen language.

export function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** The LOCAL calendar date as YYYY-MM-DD. (`toISOString()` is UTC, which shifts the day for
 *  anyone east or west of Greenwich — e.g. Monday 00:30 in Cairo is still Sunday in UTC.) */
export function isoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses a YYYY-MM-DD column value as a LOCAL date (`new Date("2026-09-23")` would be UTC). */
export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** "HH:MM" of a timestamp in local time. */
export function localTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "YYYY-MM-DDTHH:MM" in local time — the value format of <input type="datetime-local">. */
export function dateTimeLocal(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return `${isoDate(d)}T${localTime(d)}`;
}

export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function weekDates(anchor: Date = new Date()): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Only http(s) links are ever rendered as clickable hrefs. */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
