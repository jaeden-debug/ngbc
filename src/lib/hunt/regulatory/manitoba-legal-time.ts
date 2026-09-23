/**
 * Manitoba's legal hunting hours.
 *
 * General Hunting Regulation, M.R. 351/87, s. 3, under the heading "Hunting
 * hours" / « Heures de chasse ». A census of that regulation's every
 * time-of-day reference returns exactly this one provision, so the general rule
 * is the whole of the general rule.
 *
 * THE EXCEPTION IS NOT TURKEY, AND THAT MATTERS. Ontario and Québec both
 * narrow their general rule for wild turkey, and carrying that prior into a
 * third jurisdiction would have looked for the wrong thing. Manitoba's single
 * time-of-day exception lives in the Hunting Seasons and Bag Limits Regulation
 * (M.R. 165/91) as footnote 2 to the MIGRATORY GAME BIRD table:
 *
 *   "Up to and including the second Sunday in October, in GHA 13A, 14, 14A,
 *    all that portion of GHA 16 south of the north limit of Township 33, GHA
 *    18, 18A, 18B, 18C, 19, 19A, 19B, 20, 21A, 23A, 25 and GBHZ 4, from one
 *    half-hour before sunrise until 12 noon, local time."
 *
 * It is recorded and NOT encoded, for two independent reasons, either of which
 * alone would be enough: Manitoba serves no migratory game birds, and federal
 * hours govern those birds in any event (Migratory Birds Regulations s. 28 (3)).
 * It is written down here because it becomes live the moment a migratory
 * species is served, and a future reader should inherit the finding rather than
 * repeat the census.
 *
 * TIME BASIS. s. 3 is expressed in solar terms with no clock qualifier, and the
 * one exception says "local time" in as many words — so the window is computed
 * on the point's own observed timezone, which is the clock a hunter reads.
 * Manitoba observes Central Time province-wide with daylight saving, so no
 * Atikokan-style divergence arises here.
 */

import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { legalTimeFor, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";

const GENERAL = "source:ca-mb-general-hunting-regulation" as CanonicalId<"source">;

/** M.R. 351/87, s. 3, stated as the prohibition it is. */
export const MANITOBA_GENERAL_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "No person shall hunt wildlife between 1/2 hour after sunset and 1/2 hour before sunrise of the following day.",
  section: "General Hunting Regulation, M.R. 351/87, s. 3",
  sourceId: GENERAL,
};

/**
 * Every hours rule that binds in Manitoba for this species and date.
 *
 * One, for every species Manitoba serves. The migratory-bird morning window
 * documented above is deliberately absent rather than missing.
 */
export function manitobaHoursRules(_speciesId: string, _date: IsoDate): LegalTimeRule[] {
  return [MANITOBA_GENERAL_HOURS];
}

/** Manitoba's legal hunting window at a point, for a species and date. */
export function manitobaLegalTime(
  speciesId: string,
  point: { latitude: number; longitude: number },
  date: IsoDate,
  timezone: PointTimeZone,
): LegalTimeResult {
  return legalTimeFor(manitobaHoursRules(speciesId, date)[0], point, date, timezone);
}
