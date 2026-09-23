/**
 * Ontario's legal hunting hours, read from the law rather than from the summary.
 *
 * The general rule is a PROHIBITION, not a permission. Fish and Wildlife
 * Conservation Act, 1997, s. 20 (1): "A person shall not, during the period
 * from half an hour after sunset to half an hour before sunrise, (a) hunt
 * wildlife…". s. 20 (2) then says it "does not apply in the circumstances
 * prescribed by the regulations" — so the statute points at an exception set by
 * name, and reading the general rule without it is reading half a sentence.
 *
 * THE EXCEPTION THAT MATTERS IS WORTH TWO HOURS. O. Reg. 670/98, Table 7.2,
 * item 1 gives spring wild turkey "½ hour before sunrise to 7 p.m." Half an
 * hour after sunset in mid-May Ontario is about 9 p.m. Computing from the
 * general rule alone would publish roughly two hours of unlawful hunting with a
 * source link beside it.
 *
 * THE EXCEPTION SET IS COMPLETE FOR THE SERVED SPECIES, and structurally so
 * rather than by keyword search. O. Reg. 670/98 s. 1 prescribes "areas, open
 * seasons, TIMES, classes or types of firearm…" per Table, so hours live in a
 * Table's column — and of the regulation's thirteen tables exactly one has a
 * "Time Limits" column: wild turkey. Asking what shape a provision must take,
 * then enumerating that shape, is a census rather than a search: a keyword
 * sweep can miss a synonym, a column census cannot miss a column.
 *
 * Two further exceptions exist and touch no species Ontario serves. They are
 * recorded because either becomes live the moment its species is served:
 *
 *   O. Reg. 665/98 s. 80   exempts named licence holders from s. 20 (1) to hunt
 *                          RACCOON at night — the only widening in the scheme.
 *   O. Reg. 665/98 ss. 113, 125
 *                          narrow MIGRATORY GAME BIRDS to noon in named Hunting
 *                          Areas. Federal hours govern those birds (Migratory
 *                          Birds Regulations s. 28 (3)); this would compose with
 *                          them, not replace them.
 */

import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import { intersectLegalTime, legalTimeFor, legalTimeNotCertified, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";
import { ontarioStatutoryClock } from "./statutory-time.ts";

const ACT = "source:ca-on-fish-wildlife-conservation-act" as CanonicalId<"source">;
const OPEN_SEASONS = "source:ca-on-open-seasons-regulation" as CanonicalId<"source">;

/** s. 20 (1), stated as the prohibition it is. */
export const ONTARIO_GENERAL_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "A person shall not, during the period from half an hour after sunset to half an hour before sunrise, (a) hunt " +
    "wildlife; (b) have a firearm in the person's possession in an area usually inhabited by wildlife, unless the " +
    "firearm is unloaded and encased; or (c) shine a light for the purpose of hunting wildlife.",
  section: "Fish and Wildlife Conservation Act, 1997, S.O. 1997, c. 41, s. 20 (1)",
  sourceId: ACT,
};

/** Table 7.2, item 1 — the spring turkey window, verbatim. */
export const ONTARIO_SPRING_TURKEY_HOURS: LegalTimeRule = {
  basis: "SUNRISE_OFFSET_TO_FIXED_CLOSE",
  beforeSunriseMinutes: 30,
  closesAt: "19:00",
  statedAs: "½ hour before sunrise to 7 p.m.",
  section: "O. Reg. 670/98 (Open Seasons — Wildlife), Table 7.2, item 1",
  sourceId: OPEN_SEASONS,
};

/**
 * The Wildlife Management Units Table 7.2 item 1 names, verbatim.
 *
 * Read from the table rather than transcribed: Column 1 of the row whose
 * Column 3 is the 7 p.m. window.
 */
const SPRING_TURKEY_UNITS = [
  "36", "42", "45", "46", "47", "48", "49", "50", "53", "54", "55", "56", "57", "58", "59", "60",
  "61", "62", "63", "64", "65", "66A", "67", "68", "69", "70", "71", "72", "73", "74", "75", "76",
  "77", "78", "79", "80", "81", "82", "83A", "84", "85", "86", "87", "88", "89", "90", "91", "92",
  "93", "94", "95",
] as const;

/**
 * Whether a Management Unit is one the table names.
 *
 * O. Reg. 670/98 s. 4: "if a wildlife management unit is referred to by whole
 * number only, the whole number includes a reference to all of the wildlife
 * management units referred to in Schedule 1 by that number used in combination
 * with a letter, or a letter and another number."
 *
 * So "36" reaches 36A and 36B, and the regulation says so itself — the same
 * rule the federal build met as "53 to 59 covers 53A and 53B", here stated
 * outright rather than inferred. A unit named WITH a letter (66A, 83A) reaches
 * only itself.
 */
function namedByTable(designation: string, units: readonly string[]): boolean {
  const unit = designation.trim().toUpperCase();
  return units.some((named) => {
    if (named === unit) return true;
    /* A bare number reaches its lettered subdivisions; a lettered one does not. */
    if (!/^\d+$/.test(named)) return false;
    return new RegExp(`^${named}[A-Z]`).test(unit);
  });
}

/** April 25 to May 31 in any year, inclusive (O. Reg. 670/98, s. 2). */
function inSpringTurkeySeason(date: IsoDate): boolean {
  const monthDay = date.slice(5);
  return monthDay >= "04-25" && monthDay <= "05-31";
}

/**
 * Every hours rule that binds for this species, unit and date.
 *
 * MORE THAN ONE MAY BIND, and they compose by intersection rather than by the
 * narrower replacing the broader — s. 20 prohibits, the Table prescribes, and a
 * hunter satisfies both. See `intersectLegalTime`.
 */
export function ontarioHoursRules(
  speciesId: string,
  designation: string | undefined,
  date: IsoDate,
): LegalTimeRule[] {
  const rules: LegalTimeRule[] = [ONTARIO_GENERAL_HOURS];

  if (
    speciesId === "species:wild-turkey" &&
    designation !== undefined &&
    inSpringTurkeySeason(date) &&
    namedByTable(designation, SPRING_TURKEY_UNITS)
  ) {
    rules.push(ONTARIO_SPRING_TURKEY_HOURS);
  }

  return rules;
}

/**
 * Ontario's legal hunting window at a point, for a species, unit and date.
 *
 * Everything the rule needs and nothing it does not: the statutory clock from
 * the Time Act, the general prohibition, whatever exception the Tables
 * prescribe, and the intersection of them.
 *
 * A whole-zone question has no answer here, and that is not a gap. A zone spans
 * degrees of longitude and its sunrise differs across it, so there is no single
 * legal window for one — the answer belongs to a point. `scope: "ZONE"`
 * evaluations pass no usable coordinate and correctly receive NOT_CERTIFIED.
 */
export function ontarioLegalTime(
  speciesId: string,
  designation: string | undefined,
  point: { latitude: number; longitude: number },
  date: IsoDate,
): LegalTimeResult {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
    return legalTimeNotCertified(
      "Legal hunting time depends on sunrise and sunset at a place. A zone spans too much longitude to have one, so " +
      "North Ground states it for a point rather than for a whole zone.",
      "Province of Ontario",
      ACT,
    );
  }

  const clock = ontarioStatutoryClock(point, date);
  if (clock.status !== "RESOLVED") {
    return legalTimeNotCertified(clock.reason, clock.authority, ACT);
  }

  const composed = intersectLegalTime(
    ontarioHoursRules(speciesId, designation, date)
      .map((rule) => legalTimeFor(rule, point, date, clock.zone as Parameters<typeof legalTimeFor>[3])),
  );

  /*
   * The window is the law's. Whether it is also the clock at this point is a
   * separate fact and travels with it, so a renderer can show an actionable
   * local time where they agree and must not pretend to one where they do not.
   */
  return composed.status === "RESOLVED" ? { ...composed, observedClock: clock.observed } : composed;
}
