import { addDaysIso, isoParts, MONTH_NAMES, todayIso, WEEKDAY_NAMES, weekdayOf } from "../date.ts";

/**
 * The quick date choices, and how the chosen day is named.
 *
 * Only presets whose meaning is a single, unambiguous calendar day are offered:
 * Today and Tomorrow. "This weekend" is deliberately absent — a Hunt is checked
 * for one day, the weekend is two, and Sunday rules differ from Saturday's in
 * several jurisdictions (Alberta closes big game on Sundays in many units), so
 * silently picking Saturday would answer a question the hunter did not ask.
 *
 * "Today" is the viewer's own calendar day, read on the device. The server
 * never decides it: a Vercel function runs in UTC and would hand an Ontario
 * hunter tomorrow's date every evening.
 */

export type DatePreset = "today" | "tomorrow";

export function presetDate(preset: DatePreset, now: Date = new Date()): string {
  const today = todayIso(now);
  return preset === "today" ? today : addDaysIso(today, 1);
}

/** Which preset, if any, a day is, relative to the viewer's today. */
export function presetOf(iso: string, now: Date = new Date()): DatePreset | null {
  if (iso === presetDate("today", now)) return "today";
  if (iso === presetDate("tomorrow", now)) return "tomorrow";
  return null;
}

const SHORT_MONTHS = MONTH_NAMES.map((name) => name.slice(0, 3));
const SHORT_WEEKDAYS = WEEKDAY_NAMES.map((name) => name.slice(0, 3));

/** "Sat, Oct 3", or "Sat, Oct 3, 2027" when it is not this year. Never through a timestamp. */
export function shortDayLabel(iso: string, now: Date = new Date()): string {
  const parts = isoParts(iso);
  if (!parts) return iso;
  const weekday = SHORT_WEEKDAYS[weekdayOf(parts.year, parts.month, parts.day)];
  const base = `${weekday}, ${SHORT_MONTHS[parts.month - 1]} ${parts.day}`;
  const thisYear = isoParts(todayIso(now))?.year;
  return parts.year === thisYear ? base : `${base}, ${parts.year}`;
}

/** "September 22, 2026": the long form a shared link and an announcement use. */
export function longDayLabel(iso: string): string {
  const parts = isoParts(iso);
  if (!parts) return iso;
  return `${MONTH_NAMES[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

/** The chip's words: "Today", "Tomorrow" or the short day. */
export function dateChipLabel(iso: string, now: Date = new Date()): string {
  const preset = presetOf(iso, now);
  if (preset === "today") return "Today";
  if (preset === "tomorrow") return "Tomorrow";
  return shortDayLabel(iso, now);
}
