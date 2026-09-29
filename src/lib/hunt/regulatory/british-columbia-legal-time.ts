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
 * TIME BASIS — AND THIS IS NO LONGER THE BLOCKER IT WAS. s. 14 is expressed in
 * solar terms with no clock-basis qualifier, so the window needs a wall clock
 * from somewhere else. British Columbia was refused one on the ground that it
 * spans two zones and the Peace River region keeps Mountain time year-round.
 * The Interpretation Act no longer says that:
 *
 *   26 (1) In this section, "Pacific Time" means 7 hours behind Coordinated
 *          Universal Time (UTC).
 *      (2) A reference to time in British Columbia is a reference to Pacific
 *          Time.
 *
 * Unqualified, province-wide, no region named. The absences carry as much as
 * the text: across the whole Act, "daylight saving", "standard time", "Peace
 * River", "Creston" and "time zone" each occur ZERO times — not repealed and
 * cross-referenced, simply gone. So British Columbia is UTC-7 year-round.
 *
 * Note the scoping words. "In this section" limits the DEFINITION in 26 (1);
 * the operative rule is 26 (2), which is in that same section and is
 * unqualified. Reading "in this section" as confining the whole rule would put
 * the province back where it started.
 *
 * THE TRAP, and it is still in the Act. « "Cascade Mountains" means the line
 * described in the Schedule to this Act » remains a live definition, and the
 * Schedule still describes that survey line in full. That line historically
 * divided British Columbia's time reckoning. The machinery of the old
 * geographic division is intact and merely unreferenced by s. 26 — so a reader
 * who finds the Schedule first can reasonably conclude the division persists.
 * Read s. 26, not the Schedule.
 *
 * WHAT IS NOT ESTABLISHED is WHEN s. 26 came into force, which is why the
 * clock below is date-bounded rather than applied to every date. See
 * `BRITISH_COLUMBIA_CLOCK_FROM`.
 */

import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { legalTimeFor, legalTimeNotCertified, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";
import { pointTimeZone } from "../time-zone.ts";
import { isFederalMigratoryBird } from "./federal.ts";

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

/** s. 14 (2) — migratory game birds, half an hour, DESPITE s. 14 (1)'s hour. */
export const BRITISH_COLUMBIA_MIGRATORY_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "Despite subsection (1), the prohibited hours for hunting migratory game birds are from one-half hour after " +
    "sunset on any day until one-half hour before sunrise of the day following.",
  section: "Hunting Regulation, B.C. Reg. 190/84, s. 14 (2)",
  sourceId: HUNTING_REGULATION,
};

/**
 * Every hours rule that binds in British Columbia for this species and date.
 *
 * s. 14 (2) is now ENCODED rather than only described. It binds no species
 * British Columbia serves today — the seven are black bear, rock and willow
 * ptarmigan, ruffed, sharp-tailed and spruce grouse, and snowshoe hare — so it
 * is latent, and the point of encoding it is that it stops being latent the
 * moment a migratory species is served, with nobody having to remember.
 *
 * Membership is asked of the FEDERAL instrument that defines the term rather
 * than a list written here, because "migratory game bird" is that instrument's
 * word and a hand-copied list is the thing that drifts.
 */
export function britishColumbiaHoursRules(speciesId: string, _date: IsoDate): LegalTimeRule[] {
  return [isFederalMigratoryBird(speciesId) ? BRITISH_COLUMBIA_MIGRATORY_HOURS : BRITISH_COLUMBIA_GENERAL_HOURS];
}

/**
 * The earliest date for which North Ground states a British Columbia clock.
 *
 * NOT the date the law changed — that is the point. The Interpretation Act
 * consolidation carrying s. 26 is published as current to this date, so s. 26
 * is certainly in force on it. WHEN it came into force was not established:
 * the amending instruments were not reachable in consolidated form and a
 * bringing-into-force order is commonly an Order in Council in the Gazette,
 * which was not reached.
 *
 * Picking the likely commencement date instead would be asserting the one fact
 * that could not be verified, and asserting it in the one place where being
 * wrong is invisible — a backdated Hunt would simply show an hour that looks
 * ordinary.
 */
export const BRITISH_COLUMBIA_CLOCK_FROM = "2026-09-22" as IsoDate;

/**
 * British Columbia's clock, where North Ground can state one.
 *
 * `Etc/GMT+7` and not `America/Vancouver`: the statute fixes an OFFSET, and a
 * named regional zone would import a daylight-saving policy the Act no longer
 * contains. POSIX sign convention — `Etc/GMT+7` is seven hours BEHIND
 * Greenwich.
 *
 * Deliberately NOT added to `SINGLE_ZONE_JURISDICTIONS`. That table is keyed by
 * jurisdiction alone and has no date dimension, so an entry there would apply
 * today's reckoning to every past date — which is the precise error this
 * function exists to prevent.
 */
export function britishColumbiaClock(date: IsoDate): PointTimeZone | undefined {
  return date >= BRITISH_COLUMBIA_CLOCK_FROM ? pointTimeZone("Etc/GMT+7", "SINGLE_ZONE_JURISDICTION") : undefined;
}

/**
 * British Columbia's legal hunting window at a point, for a species and date.
 *
 * Resolves its own clock, because that clock is date-bounded and no caller
 * should have to know that. A date before the bound is refused with the reason
 * rather than answered with today's reckoning.
 */
export function britishColumbiaLegalTime(
  speciesId: string,
  point: { latitude: number; longitude: number },
  date: IsoDate,
): LegalTimeResult {
  const rule = britishColumbiaHoursRules(speciesId, date)[0];
  const timezone = britishColumbiaClock(date);
  if (!timezone) {
    return legalTimeNotCertified(
      `British Columbia reckons time as a fixed offset under the Interpretation Act, and North Ground states a ` +
        `clock for it only from ${BRITISH_COLUMBIA_CLOCK_FROM}, the date the consolidation carrying that provision ` +
        `is current to. When the provision came into force was not established, and before it British Columbia's ` +
        `reckoning was divided geographically — so an earlier date could be an hour out.`,
      "Government of British Columbia",
      rule.sourceId,
    );
  }
  return legalTimeFor(rule, point, date, timezone);
}
