import { programTimezone } from "./config";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the program-local calendar date for an instant, "YYYY-MM-DD". */
export function todayInTimezone(
  now: Date = new Date(),
  timezone: string = programTimezone(),
): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True for a real calendar date that is not "2026-02-31" style nonsense. */
export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** "2026-09-26" -> "Sunday, 26 September 2026". */
export function formatLongDate(value: string): string {
  if (!isValidDateString(value)) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

/** "2026-09-26" -> "26 Sep 2026". */
export function formatShortDate(value: string): string {
  if (!isValidDateString(value)) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

/** Shifts a program date by whole days, staying in "YYYY-MM-DD". */
export function addDays(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Epoch milliseconds -> "14:05". */
export function formatClock(atMs: number, timezone = programTimezone()): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(atMs));
}
