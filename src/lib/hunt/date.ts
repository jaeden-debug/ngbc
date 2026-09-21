/**
 * Hunt dates.
 *
 * A hunt date is a CALENDAR DAY, not an instant. Turning "2026-08-08" into a
 * timestamp and formatting it back is how date pickers lose a day: `new
 * Date("2026-08-08")` is midnight UTC, which is the 7th in every Canadian time
 * zone. Nothing here converts a hunt date through a timestamp. Days are handled as
 * (year, month, day) triples, and the single place a clock is read is
 * `todayIso()`, which reads the viewer's own local calendar day — never the
 * server's, because a Vercel function runs in UTC and would hand an Ontario hunter
 * tomorrow's date every evening.
 *
 * `YYYY/MM/DD` is what a person sees and types. `YYYY-MM-DD` is what is stored and
 * sent. The two never mix.
 */

export const DISPLAY_PATTERN = "YYYY/MM/DD";

const ISO_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParseResult {
  status: "EMPTY" | "INCOMPLETE" | "INVALID" | "OK";
  /** Present only when `status` is "OK". */
  iso?: string;
  /** Plain-language reason, written for someone typing quickly with gloves on. */
  message?: string;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

export function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isoParts(iso: string): { year: number; month: number; day: number } | null {
  const match = ISO_SHAPE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isValidYmd(year, month, day) ? { year, month, day } : null;
}

export function isValidIso(value: unknown): value is string {
  return typeof value === "string" && isoParts(value) !== null;
}

/** "2026-08-08" → "2026/08/08". Returns the input unchanged if it is not an ISO day. */
export function isoToDisplay(iso: string): string {
  const parts = isoParts(iso);
  if (!parts) return iso;
  return `${parts.year}/${String(parts.month).padStart(2, "0")}/${String(parts.day).padStart(2, "0")}`;
}

/**
 * Progressive display formatting while typing.
 *
 * Every non-digit is dropped and the slashes are re-inserted, so typing `20260808`,
 * pasting `2026-08-08` and pasting `2026/08/08` all converge on the same text and
 * nobody has to reach for the slash key.
 */
export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}/${digits.slice(4)}`;
  return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`;
}

/**
 * Interpret what has been typed so far.
 *
 * "Not finished yet" is deliberately distinct from "wrong": a half-typed date must
 * never flash an error at someone mid-keystroke, but `2026/02/31` must be refused
 * outright rather than silently rolled into March 3rd.
 */
export function parseDateInput(raw: string): DateParseResult {
  const digits = raw.replace(/\D/g, "");
  if (!digits.length) return { status: "EMPTY" };
  if (digits.length < 8) {
    return { status: "INCOMPLETE", message: `Keep typing — dates use ${DISPLAY_PATTERN}.` };
  }
  if (digits.length > 8) {
    return { status: "INVALID", message: `That is too long for a date. Use ${DISPLAY_PATTERN}.` };
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));

  if (year < 1900 || year > 2200) {
    return { status: "INVALID", message: "Enter a year between 1900 and 2200." };
  }
  if (month < 1 || month > 12) {
    return { status: "INVALID", message: `There is no month ${digits.slice(4, 6)}. Months run 01 to 12.` };
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    const limit = daysInMonth(year, month);
    return {
      status: "INVALID",
      message: `${MONTH_NAMES[month - 1]} ${year} has ${limit} days, so ${digits.slice(6, 8)} is not a date.`,
    };
  }

  return { status: "OK", iso: toIso(year, month, day) };
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The viewer's own local calendar day. Client-side only — see below. */
export function todayIso(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * The calendar day in a named jurisdiction, computed identically anywhere.
 *
 * `todayIso()` is right for the browser and wrong on the server, where the
 * "viewer" is a Vercel function in UTC — and a React state initializer runs in
 * BOTH places. Server and client then disagree, which breaks hydration and, far
 * worse, ships server HTML dated tomorrow to every crawler for the four hours
 * each evening that Ontario is a day behind UTC.
 *
 * So the server renders the jurisdiction's day, which is deterministic and is
 * the correct default for a Canada-first product, and the browser corrects it to
 * the viewer's own day once it has mounted. Both agree during hydration because
 * both start from this value.
 */
export function jurisdictionTodayIso(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return toIso(read("year"), read("month"), read("day"));
}

/**
 * Where Hunt's certified coverage is, and therefore whose calendar day the
 * server should assume before it knows the viewer's.
 */
export const HUNT_DEFAULT_TIME_ZONE = "America/Toronto";

/**
 * Calendar arithmetic that stays on the calendar.
 *
 * `Date.UTC` is used purely as a day counter here — the value is converted straight
 * back to a (year, month, day) triple with the UTC getters and never formatted as a
 * local time, so no offset can shift the result.
 */
export function addDaysIso(iso: string, days: number): string {
  const parts = isoParts(iso);
  if (!parts) return iso;
  const stamp = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return toIso(stamp.getUTCFullYear(), stamp.getUTCMonth() + 1, stamp.getUTCDate());
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/** Weekday index (0 = Sunday) for a calendar day, without touching local time. */
export function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** "Sat, Aug 8, 2026" — the long form shown once a date is settled. */
export function readableIso(iso: string): string {
  const parts = isoParts(iso);
  if (!parts) return iso;
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
