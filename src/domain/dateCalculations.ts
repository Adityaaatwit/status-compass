/**
 * Calendar-date helpers.
 *
 * All dates are handled as plain ISO `yyyy-mm-dd` strings in UTC so that the
 * evaluator is timezone-independent and deterministic. No function here reads
 * the clock: `asOfDate` is always supplied by the caller.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns true only for a well-formed, real calendar date. */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = parts(value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Normalises a possibly-malformed value to an ISO date or null. */
export function toIsoDate(value: unknown): string | null {
  if (isValidIsoDate(value)) return value;
  if (typeof value === "string" && value.length > 10) {
    const head = value.slice(0, 10);
    if (isValidIsoDate(head)) return head;
  }
  return null;
}

/** Splits an ISO date into numeric [year, month, day]. */
function parts(iso: string): [number, number, number] {
  const [y = 0, m = 0, d = 0] = iso.split("-").map(Number);
  return [y, m, d];
}

function toUtc(iso: string): Date {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

/** Adds calendar days (weekends and holidays included, per the corpus). */
export function addDays(iso: string, days: number): string | null {
  if (!isValidIsoDate(iso)) return null;
  const dt = toUtc(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtc(dt);
}

/** Adds whole years, clamping Feb 29 to Feb 28 in non-leap target years. */
export function addYears(iso: string, years: number): string | null {
  if (!isValidIsoDate(iso)) return null;
  const [y, m, d] = parts(iso);
  const target = new Date(Date.UTC(y + years, m - 1, d));
  if (target.getUTCMonth() !== m - 1) {
    // Feb 29 -> Feb 28
    return fromUtc(new Date(Date.UTC(y + years, m - 1, d - 1)));
  }
  return fromUtc(target);
}

/** Positive when `b` is after `a`. */
export function diffInDays(a: string, b: string): number | null {
  if (!isValidIsoDate(a) || !isValidIsoDate(b)) return null;
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function isOnOrAfter(a: string, b: string): boolean {
  return a >= b;
}

/** Earliest valid date, ignoring nulls. Returns null when nothing is valid. */
export function minDate(...dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter(isValidIsoDate);
  return valid.length ? valid.reduce((a, b) => (a <= b ? a : b)) : null;
}

/** Latest valid date, ignoring nulls. */
export function maxDate(...dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter(isValidIsoDate);
  return valid.length ? valid.reduce((a, b) => (a >= b ? a : b)) : null;
}

/** Clamps `date` so it never exceeds `cap`. */
export function capAt(date: string | null, cap: string): string | null {
  if (!isValidIsoDate(date)) return null;
  return date > cap ? cap : date;
}
