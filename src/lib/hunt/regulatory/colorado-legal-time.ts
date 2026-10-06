/**
 * Colorado's legal hunting hours for small game and furbearers, as Chapter W-3
 * states them.
 *
 * "1. Small Game - from one-half (1/2) hour before sunrise to sunset.
 *  2. Furbearers - from one-half (1/2) hour before sunrise to one-half (1/2)
 *  hour after sunset." (2 CCR 406-3, Chapter W-3 #302(A), 07/16/2026, effective
 * September 1, 2026). The Colorado builder stops if those sentences change.
 *
 * #302(A)(2) goes on: "Additionally", eight furbearers may be hunted at night
 * under #303(E)(7)–(8). That WIDENS the window rather than replacing it, so it
 * travels with the window as an exception and is never hidden behind one.
 *
 * Colorado lies wholly in `America/Denver` (`time-zone.ts`, from 49 CFR § 71.9
 * and the tz table), so a point anywhere in the state has one clock. The
 * caller passes that point timezone; this module never assumes one.
 *
 * SCOPE: the species the Colorado bundle certifies — Chapter W-3's small game
 * and furbearers — derived from the bundle, so a species added to it inherits
 * a rule by being there and one Chapter W-3 does not set never gets a window.
 * Big game hours are another chapter and are not read here.
 */

import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { legalTimeFor, type LegalTimeException, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";
import COLORADO_BUNDLE from "../../../../content/regulatory/us-co-small-game-2026.json" with { type: "json" };

const W3 = "source:us-co-ccr-406-3-chapter-w-3" as CanonicalId<"source">;

export const COLORADO_SMALL_GAME_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 0,
  statedAs: "Small Game - from one-half (1/2) hour before sunrise to sunset.",
  section: "Chapter W-3 #302(A)(1)",
  sourceId: W3,
};

export const COLORADO_FURBEARER_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs: "Furbearers - from one-half (1/2) hour before sunrise to one-half (1/2) hour after sunset.",
  section: "Chapter W-3 #302(A)(2)",
  sourceId: W3,
};

/** #302(A)(2), "Additionally", with #303(E)(7)–(8): night hunting for eight furbearers. */
export const COLORADO_FURBEARER_NIGHT_HUNTING: LegalTimeException = {
  id: "us-co-furbearer-night-hunting",
  text:
    "This species may also be hunted at night with an artificial light: on private land with the written permission of the landowner, " +
    "designated agent, lessee or authorized employee, or on public land only under a Division permit valid for the time, species and place on it. " +
    "A light attached to or projected from a vehicle is prohibited.",
  effect: "WIDENS",
  section: "Chapter W-3 #302(A)(2); #303(E)(7)–(8)",
  sourceId: W3,
};

/** #300(B): the furbearers, whose hours are #302(A)(2) rather than (A)(1). */
const FURBEARERS: ReadonlySet<string> = new Set([
  "species:american-mink", "species:american-marten", "species:american-badger", "species:gray-fox", "species:red-fox",
  "species:swift-fox", "species:raccoon", "species:ringtail", "species:striped-skunk", "species:western-spotted-skunk",
  "species:long-tailed-weasel", "species:american-ermine", "species:virginia-opossum", "species:muskrat",
  "species:bobcat", "species:coyote", "species:beaver",
]);

/** #302(A)(2), "Additionally": the eight furbearers that may be hunted at night under #303(E)(7)–(8). */
const NIGHT_FURBEARERS: ReadonlySet<string> = new Set([
  "species:beaver", "species:bobcat", "species:coyote", "species:gray-fox", "species:raccoon", "species:red-fox",
  "species:striped-skunk", "species:swift-fox",
]);

/** The species Chapter W-3 sets seasons for here, derived from the certified bundle. */
export const COLORADO_HOURS_SPECIES: ReadonlySet<string> = new Set(
  (COLORADO_BUNDLE.rules as { speciesId: string }[]).map((rule) => rule.speciesId),
);

/**
 * Every hours rule that binds in Colorado for this species and date: furbearers
 * by #302(A)(2), every other species Chapter W-3 covers by #302(A)(1), and none
 * for a species it does not cover, so a window is never built from a rule that
 * does not reach it.
 */
export function coloradoHoursRules(speciesId: string, _date: IsoDate): LegalTimeRule[] {
  if (!COLORADO_HOURS_SPECIES.has(speciesId)) return [];
  return [FURBEARERS.has(speciesId) ? COLORADO_FURBEARER_HOURS : COLORADO_SMALL_GAME_HOURS];
}

/** Colorado's legal hunting window at a point, with the night-hunting exception where it reaches. */
export function coloradoLegalTime(
  speciesId: string,
  point: { latitude: number; longitude: number },
  date: IsoDate,
  timezone: PointTimeZone | undefined,
): LegalTimeResult | undefined {
  const [rule] = coloradoHoursRules(speciesId, date);
  if (!rule) return undefined;
  const result = legalTimeFor(rule, point, date, timezone);
  if (result.status !== "RESOLVED" || !NIGHT_FURBEARERS.has(speciesId)) return result;
  return { ...result, exceptions: [...(result.exceptions ?? []), COLORADO_FURBEARER_NIGHT_HUNTING] };
}
