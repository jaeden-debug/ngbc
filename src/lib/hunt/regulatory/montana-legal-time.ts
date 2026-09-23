/**
 * Montana's authorized hunting hours for upland game birds.
 *
 * Found by sweeping the refusals rather than the gaps. Montana stated its rule
 * plainly and then declined to compute a window, on the same premise that had
 * been withholding Alberta's and Manitoba's: that the point's timezone could
 * not be established. It can. **Montana is wholly within `America/Denver`.**
 *
 * THE EVIDENCE, AND THE CONTROL THAT MAKES IT AN ARGUMENT RATHER THAN A
 * MEMORY. The tz database's `zone1970.tab` describes United States zones by
 * EXCEPTION, so "Montana is not named" is an absence — and an absence is only
 * evidence when the instrument would have shown the thing had it existed. It
 * would: the same table names exceptions down to individual counties, among
 * them `Central - ND (Oliver)`, `Central - IN (Perry)` and
 * `Eastern - KY (Wayne)`. A table that distinguishes one North Dakota county
 * would not have missed a Montana time zone.
 *
 * Idaho, by contrast, IS named — `Mountain - ID (south), OR (east)` — so Idaho
 * genuinely splits and its refusal stands. Same instrument, opposite answers,
 * which is what a real test looks like.
 *
 * SCOPE: UPLAND GAME BIRDS, because that is what the authority's sentence says
 * and what Montana serves here. It is not widened to "hunting" — Montana sets
 * big-game hours separately, and this rule does not speak for them.
 *
 * The wording is already carried in the Montana vocabulary and is quoted from
 * the 2026 regulations; no new text is stored by this module.
 */

import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { legalTimeFor, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";
import MONTANA_UPLAND_BUNDLE from "../../../../content/regulatory/us-mt-upland-2026.json" with { type: "json" };

const UPLAND = "source:us-mt-upland-regulations-2026" as CanonicalId<"source">;

/** The authority's own sentence, as a rule. */
export const MONTANA_UPLAND_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "Authorized hunting hours for the taking of upland game birds begin one-half hour before sunrise and end " +
    "one-half hour after sunset each day of the hunting season.",
  section: "Montana Upland Game Bird Regulations 2026, p. 4",
  sourceId: UPLAND,
};

/**
 * The species this rule reaches, DERIVED from the authority's own bundle.
 *
 * Not a hand-written list: the 2026 regulations are upland-game-bird
 * regulations, so every species in them is one, and reading the bundle keeps
 * that true when it changes. A hand-written copy would drift silently, and the
 * direction of the drift matters — a species wrongly included gets a window
 * from a rule that does not speak for it.
 */
const UPLAND_SPECIES: ReadonlySet<string> = new Set(
  (MONTANA_UPLAND_BUNDLE.rules as { speciesId: string }[]).map((rule) => rule.speciesId),
);

/**
 * Every hours rule that binds in Montana for this species and date.
 *
 * Empty where the species is not one the upland regulations cover: the
 * authority's sentence is scoped to upland game birds, and Montana sets
 * big-game hours elsewhere. A caller must get NOTHING rather than a window
 * built from a rule that does not reach the animal being hunted.
 */
export function montanaHoursRules(speciesId: string, _date: IsoDate): LegalTimeRule[] {
  return UPLAND_SPECIES.has(speciesId) ? [MONTANA_UPLAND_HOURS] : [];
}

/** Montana's legal hunting window at a point, for an upland game bird and date. */
export function montanaLegalTime(
  speciesId: string,
  point: { latitude: number; longitude: number },
  date: IsoDate,
  timezone: PointTimeZone,
): LegalTimeResult | undefined {
  const [rule] = montanaHoursRules(speciesId, date);
  return rule ? legalTimeFor(rule, point, date, timezone) : undefined;
}
