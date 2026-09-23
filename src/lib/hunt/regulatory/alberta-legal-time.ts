/**
 * Alberta's legal hunting hours, read from the Act rather than from the guide.
 *
 * The rule is in the STATUTE, not the regulation, and that is worth stating
 * because the obvious place to look is the wrong one. The Wildlife Regulation
 * (AR 143/97) runs to 336 pages and sets seasons, licences and equipment — and
 * contains **no shooting-hours provision at all**. A census of its every
 * sunrise/sunset reference returns exactly one, and it is not about hunting
 * hours: it prohibits transporting a weapon on an off-highway vehicle between
 * one hour before sunrise and 12 noon in WMUs 400 to 446. Reading that as an
 * hours rule would invent a noon close for a third of the province.
 *
 * A SECOND PROVISION LOOKS LIKE AN HOURS RULE AND IS NOT. The Act also makes a
 * signed certificate stating the time of sunrise or sunset proof of that fact
 * absent evidence to the contrary. That is an EVIDENTIARY provision about how
 * a time is proven in a prosecution — the same shape as Québec's night
 * definition, which serves a presumption rather than a window. It sets no
 * hours and is deliberately not encoded.
 *
 * WHAT ALBERTA DOES NOT HAVE: a species exception. Ontario's turkey window and
 * Québec's turkey noon both narrow the general rule; the census above finds no
 * Alberta equivalent, and Alberta serves no migratory game birds, whose hours
 * are federal in any event.
 *
 * TIME BASIS. s. 28 is expressed in solar terms with no clock-basis qualifier —
 * no meridian, no named standard time — so the window is computed on the
 * point's own observed timezone, which is the clock a hunter reads. Alberta
 * observes Mountain Time province-wide with daylight saving, so no Atikokan-
 * style divergence arises here; where one does, it is the point timezone that
 * carries it, not this module.
 */

import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { legalTimeFor, type LegalTimeResult, type LegalTimeRule } from "./legal-time.ts";

const ACT = "source:ca-ab-wildlife-act" as CanonicalId<"source">;

/** Wildlife Act, s. 28, stated as the prohibition it is. */
export const ALBERTA_GENERAL_HOURS: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "A person shall not hunt wildlife, except by trapping, during the period commencing at 1/2 hour after sunset " +
    "and ending at 1/2 hour before sunrise the following day.",
  section: "Wildlife Act, RSA 2000, c. W-10, s. 28",
  sourceId: ACT,
};

/**
 * Every hours rule that binds in Alberta for this species and date.
 *
 * One, and the signature still takes the species and date: a jurisdiction
 * whose exception set is empty today is not a jurisdiction that cannot have
 * one, and a caller should not have to change shape when Alberta adds a spring
 * turkey window.
 */
export function albertaHoursRules(_speciesId: string, _date: IsoDate): LegalTimeRule[] {
  return [ALBERTA_GENERAL_HOURS];
}

/** Alberta's legal hunting window at a point, for a species and date. */
export function albertaLegalTime(
  speciesId: string,
  point: { latitude: number; longitude: number },
  date: IsoDate,
  timezone: PointTimeZone,
): LegalTimeResult {
  return legalTimeFor(albertaHoursRules(speciesId, date)[0], point, date, timezone);
}
