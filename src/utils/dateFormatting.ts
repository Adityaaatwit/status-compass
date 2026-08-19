/** Display-only date helpers. Never used inside the rules engine. */

import { diffInDays } from "@/domain/dateCalculations";

const FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return FORMATTER.format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatDate(parsed.toISOString().slice(0, 10));
}

export function relativeDays(asOfDate: string, iso: string): string {
  const days = diffInDays(asOfDate, iso);
  if (days === null) return "";
  if (days === 0) return "today";
  if (days > 0) return days === 1 ? "in 1 day" : `in ${days} days`;
  const past = Math.abs(days);
  return past === 1 ? "1 day ago" : `${past} days ago`;
}

/** Today's date in UTC as ISO yyyy-mm-dd. Only the app shell calls this. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
