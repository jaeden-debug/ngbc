/**
 * Idaho's legal hunting hours, for the units North Ground can prove are on one
 * side of the federal time-zone line.
 *
 * Idaho's rule was never the problem — the authority states it plainly, and it
 * is quoted below. What blocked a window was the timezone, and the refusal was
 * correct about the STATE and too strict about the UNITS North Ground actually
 * serves. §8 makes a claim stricter than the evidence as false as a loose one,
 * so the refusal is narrowed to exactly what was proven.
 *
 * WHY IDAHO GENUINELY SPLITS. 49 CFR § 71.9(a) runs the mountain/Pacific line
 * "southerly along the Idaho-Montana boundary to the boundary line between
 * Idaho County, Idaho, and Lemhi County, Idaho; thence southwesterly along the
 * boundary line between those two counties to the main channel of the Salmon
 * River; thence westerly along the main channel of the Salmon River to the
 * Idaho-Oregon boundary". So the line is partly a COUNTY boundary and partly a
 * RIVER, which is why `time-zone.ts` records Idaho as split by a feature and
 * why no county-level table can resolve it: Idaho County is cut in half by the
 * river. The tz database agrees the split exists, naming
 * `Mountain - ID (south), OR (east)`.
 *
 * WHY EVERY CERTIFIED UNIT IS NEVERTHELESS MOUNTAIN, MEASURED RATHER THAN
 * REASONED FROM UNIT NUMBERS. Idaho County's own polygon was read from Census
 * TIGERweb and used as a spatial filter against IDFG's own GMU service. Twenty-
 * two units intersect it — 10, 10A, 11, 11A, 12, 13, 14, 15, 16, 16A, 17, 18,
 * 19, 19A, 20, 20A, 21, 22, 23, 24, 26, 27 — and NONE of the 42 certified units
 * is among them. Because counties tile without gaps, a unit cannot lie north of
 * Idaho County without touching it, so no certified unit is north or west of
 * the line either. Every certified unit is therefore south and east of it, in
 * `America/Boise`.
 *
 * THE INFERENCE THAT WOULD HAVE BEEN WRONG. Every certified unit is numbered
 * 21A or above, and "so they are all southern" is the obvious argument. It does
 * not hold: units 21A, 28, 29 and 30 all reach latitude 45°N, which is inside
 * Idaho County's latitude band. They are in Lemhi, Custer and Valley counties —
 * mountain — but a latitude test alone would have flagged them, and a unit-
 * number test alone would have missed the question. Only the county polygon
 * settles it.
 *
 * SCOPE, AND WHY IT IS SELF-LIMITING. A window is offered only for a unit in
 * `certifiedUnits`, read from the bundle rather than copied here. Any other unit
 * gets nothing. That is deliberate: when Idaho's deer, elk, bear or turkey
 * bundles arrive they will name panhandle units, those units will not be in this
 * set, and they will get no window until someone repeats the spatial test for
 * them. The failure direction is a missing time rather than a wrong one.
 */

import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import { pointTimeZone } from "../time-zone.ts";
import { legalTimeFor, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";
import IDAHO_CERTIFIED from "../../../../content/regulatory/us-id-certified-units.json" with { type: "json" };

const BIG_GAME = "source:us-id-big-game-seasons-2026" as CanonicalId<"source">;

/** The authority's own sentence, as a rule. */
export const IDAHO_BIG_GAME_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs: "Big game animals may be hunted only from one-half hour before sunrise to one-half hour after sunset",
  section: "Idaho Big Game 2026 Seasons and Rules, p. 95",
  sourceId: BIG_GAME,
};

/**
 * The units proven to sit east of 49 CFR § 71.9(a)'s line, read from the bundle.
 *
 * Deriving it rather than copying it is what keeps the proof and the data in
 * step: if a unit is ever certified without repeating the spatial test, it
 * appears here and the test below is what should fail.
 */
export const IDAHO_MOUNTAIN_UNITS: ReadonlySet<string> = new Set(
  (IDAHO_CERTIFIED as { certifiedUnits: string[] }).certifiedUnits,
);

/**
 * The same units as canonical zone ids, built the way the bundle builds them
 * (`management_zone:us-id-gmu-${unit.toLowerCase()}`).
 *
 * Derived here rather than matched loosely, because a zone id is identity and a
 * designation is presentation: comparing them by trimming a prefix is how a
 * label ends up selecting a rule.
 */
export const IDAHO_MOUNTAIN_ZONE_IDS: ReadonlySet<string> = new Set(
  [...IDAHO_MOUNTAIN_UNITS].map((unit) => `management_zone:us-id-gmu-${unit.toLowerCase()}`),
);

/**
 * Units that intersect Idaho County, which the Salmon River splits.
 *
 * Recorded, not just excluded, because the next lane needs to know these are
 * the ones that cannot be zoned from a county at all — the remedy for them is
 * the river channel, not another county read. Measured against Idaho County's
 * TIGERweb polygon through IDFG's own service, 2026-09-30.
 */
export const IDAHO_UNITS_SPLIT_BY_THE_SALMON_RIVER: readonly string[] = [
  "10", "10A", "11", "11A", "12", "13", "14", "15", "16", "16A", "17",
  "18", "19", "19A", "20", "20A", "21", "22", "23", "24", "26", "27",
];

/** Every hours rule binding in Idaho for this species and date. */
export function idahoHoursRules(_speciesId: string, _date: IsoDate): LegalTimeRule[] {
  return [IDAHO_BIG_GAME_HOURS];
}

/**
 * Idaho's legal hunting window at a point, where the point's unit is one whose
 * timezone was established. Undefined otherwise, which is the safe direction.
 */
export function idahoLegalTime(
  place: { zoneId: string; latitude: number; longitude: number; scope?: "POINT" | "ZONE" },
  date: IsoDate,
): LegalTimeResult | undefined {
  /* A zone-scoped question has no point to compute sunrise at, and a window for
     "somewhere in this unit" would be a different claim from the one asked. */
  if (place.scope === "ZONE") return undefined;
  if (!IDAHO_MOUNTAIN_ZONE_IDS.has(place.zoneId)) return undefined;
  /* America/Boise is mountain time. It is correct here because the unit was
     proven east of the line, not because it is Idaho's capital. */
  return legalTimeFor(IDAHO_BIG_GAME_HOURS, place, date, pointTimeZone("America/Boise", "POINT_LOOKUP"));
}
