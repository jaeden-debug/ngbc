/**
 * British Columbia's legal hunting hours.
 *
 * **BC IS AN HOUR, NOT HALF AN HOUR, AND THAT IS THE WHOLE POINT OF READING IT.**
 * Ontario, Alberta and Manitoba all use half an hour either side, and three
 * jurisdictions agreeing is exactly what makes the fourth dangerous. Hunting
 * Regulation, B.C. Reg. 190/84, Division 4 — Shooting Hours, s. 14 (1):
 *
 *   "The prohibited hours for hunting wildlife are from one hour after sunset
 *    on any day until one hour before sunrise of the day following."
 *
 * Assuming the common rule would have published a window 30 minutes short at
 * each end — a restriction STRICTER than the source, which §8 makes a false
 * claim exactly as an over-broad one is. The failure would have been invisible:
 * a hunter told to stop early simply stops early.
 *
 * s. 14 (2) narrows migratory game birds to half an hour either side. BC serves
 * black bear, ptarmigan, grouse and snowshoe hare — no migratory game birds —
 * and federal hours govern those birds in any event (Migratory Birds
 * Regulations s. 28 (3)), so it is recorded and not encoded. It becomes live
 * the moment a migratory species is served.
 *
 * DIVISION 4 IS THE WHOLE SCHEME, structurally rather than by keyword: the
 * regulation's own table of contents gives Division 4 — Shooting Hours exactly
 * one section, s. 14. A division census cannot miss a section the way a keyword
 * sweep can miss a synonym.
 *
 * THE CLOSED AREAS REGULATION PREVAILS, AND DOES NOT REACH HOURS. B.C. Reg.
 * 76/84 s. 1.1 (B.C. Reg. 97/2026) says that where it conflicts with another
 * regulation under the Act, it prevails. It closes areas and it does so in
 * terms that override 190/84 — but a census of the COMPLETE consolidation finds
 * no time-of-day provision in it at all: its only sunrise/sunset strings are
 * the place names "Sunset Creek" and "Sunset Prairie". So s. 14 stands as the
 * hours rule. (What 76/84 does reach — closed areas — is the within-zone
 * model's, not this module's.)
 *
 * That census was run twice, and the first run was wrong: bclaws serves
 * `190_84_01` and `76_84_01` as PART of each regulation, and the first pass
 * read only sections 1 and 1.1 of 76/84 while appearing to succeed. The
 * complete consolidations are the `_00_multi` documents. A partial document
 * that answers is worse than one that fails.
 *
 * TIME BASIS. s. 14 is expressed in solar terms with no clock-basis qualifier.
 * BC is the one jurisdiction here that spans two zones and contains territory
 * that does not observe daylight saving, so the point's own timezone does real
 * work — it is supplied by the caller and this module never assumes one.
 */

import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { legalTimeFor, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";

const HUNTING_REGULATION = "source:ca-bc-hunting-regulation" as CanonicalId<"source">;

/** s. 14 (1), stated as the prohibition it is. One hour, both ends. */
export const BRITISH_COLUMBIA_GENERAL_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 60,
  afterSunsetMinutes: 60,
  statedAs:
    "The prohibited hours for hunting wildlife are from one hour after sunset on any day until one hour before " +
    "sunrise of the day following.",
  section: "Hunting Regulation, B.C. Reg. 190/84, s. 14 (1)",
  sourceId: HUNTING_REGULATION,
};

/**
 * Every hours rule that binds in British Columbia for this species and date.
 *
 * One, for every species BC serves. s. 14 (2) is deliberately absent rather
 * than missing — see the note above.
 */
export function britishColumbiaHoursRules(_speciesId: string, _date: IsoDate): LegalTimeRule[] {
  return [BRITISH_COLUMBIA_GENERAL_HOURS];
}

/** British Columbia's legal hunting window at a point, for a species and date. */
export function britishColumbiaLegalTime(
  speciesId: string,
  point: { latitude: number; longitude: number },
  date: IsoDate,
  timezone: PointTimeZone,
): LegalTimeResult {
  return legalTimeFor(britishColumbiaHoursRules(speciesId, date)[0], point, date, timezone);
}
