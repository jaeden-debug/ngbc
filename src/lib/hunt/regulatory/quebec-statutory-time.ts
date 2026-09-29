/**
 * The clock a Québec hunting hour is measured by, computed from the statute.
 *
 * Loi sur le temps légal / Legal Time Act, RLRQ c. T-5.1. Like Ontario's Time
 * Act, it states the reckoning completely and in its own terms, so the offset
 * comes from the statute and never from a timezone database. Consolidated text
 * to 10 June 2026, read 2026-09-29; the Act's regulations tab lists none, so
 * nothing varies it.
 *
 * THE LINE IS THE 63RD MERIDIAN WEST, NOT THE 68TH. It is easy to reach for the
 * 68th — that is roughly where the Côte-Nord "feels" like it changes, and it is
 * the number a summary would give. The Act says 63.
 *
 *   s. 1  west of 63° W  — Eastern Standard Time, stated in the Act as UTC−5,
 *                          advancing to UTC−4 from the second Sunday in March
 *                          at 2:00 a.m. to the first Sunday in November at
 *                          2:00 a.m. Its third paragraph ALSO applies s. 1 to
 *                          the whole territory of the MRC de Minganie, which
 *                          lies east of the line.
 *   s. 2  east of 63° W  — Atlantic Standard Time, UTC−4. Its advanced-time
 *                          paragraph is NOT general: it reaches only the
 *                          Îles-de-la-Madeleine and the Listuguj reserve.
 *
 * SO THE REST OF QUÉBEC EAST OF 63° W NEVER ADVANCES. That is an exemption by
 * OMISSION — the Act nowhere says "does not observe daylight time", it simply
 * declines to extend the paragraph — and it is the whole reason this file
 * cannot be a lookup table. From March to November the Basse-Côte-Nord (UTC−4,
 * standard) and the Eastern-daylight part of the province (UTC−4, advanced)
 * read the SAME wall clock, and then diverge by an hour in winter. That is the
 * failure shape `time-zone.ts` is written about: correct in the season a check
 * is run in, wrong in the dark months when hare and ptarmigan are hunted.
 *
 * WHAT NORTH GROUND WILL NOT DO HERE. Three of the Act's territories are named
 * places, not lines: the MRC de Minganie, the Listuguj reserve and the
 * Îles-de-la-Madeleine. North Ground holds no authority's boundary for any of
 * them, and inventing one to produce a friendlier answer is the same error as
 * inventing a zone line. So everything east of the meridian is refused rather
 * than guessed, and the refusal names what would settle it. West of the
 * meridian — which is every hunting zone in the settled south, including the
 * Outaouais — the Act answers completely and the window resolves.
 *
 * Both facts are kept, as §41A requires: the statutory reckoning is the legal
 * truth, and whether a hunter's own clock reads the same is stated separately
 * and never assumed.
 */

import type { IsoDate } from "../../content-contract/index.ts";
import { daylightSavingInEffect, MERIDIAN_TOLERANCE_DEGREES, type ObservedClock, type StatutoryClock } from "./statutory-time.ts";

/** The Legal Time Act's dividing line. */
const QUEBEC_MERIDIAN = -63;

/**
 * West of the meridian the two clocks are the same, and that is MEASURED.
 *
 * The Act's reckoning for s. 1 territory — UTC−5 standard, UTC−4 from the
 * second Sunday in March to the first Sunday in November — is the same rule
 * `America/Montreal` implements, on every day of 2026 and 2027. So the
 * statutory window is already the window a hunter's phone shows, one window
 * serves both purposes and nothing is converted. The IANA zone is the evidence
 * here, never the source: the offset still comes from the statute.
 */
const OBSERVED_WEST: ObservedClock = {
  status: "SAME_AS_STATUTORY",
  statedAs:
    "West of the meridian of 63° W. longitude the locally observed clock and the Legal Time Act's reckoning agree on " +
    "every day of 2026 and 2027, checked against the IANA zone America/Montreal. The window shown is the statutory " +
    "one and needs no conversion.",
};

/**
 * Québec's statutory clock at a point, for a date.
 *
 * Longitude decides which section governs, the date decides advanced time, and
 * a point on the meridian decides nothing — it refuses, on the same tolerance
 * Ontario uses and for the same reason: a consumer GPS fix is not a survey.
 */
export function quebecStatutoryClock(
  point: { longitude: number },
  date: IsoDate,
): StatutoryClock {
  if (!Number.isFinite(point.longitude)) {
    return {
      status: "NOT_CERTIFIED",
      reason:
        "Québec's Legal Time Act divides the province by a line of longitude, so North Ground cannot say which clock " +
        "governs without one.",
      authority: "Gouvernement du Québec",
    };
  }

  if (Math.abs(point.longitude - QUEBEC_MERIDIAN) <= MERIDIAN_TOLERANCE_DEGREES) {
    return {
      status: "NOT_CERTIFIED",
      reason:
        "This point is within about 150 m of the meridian of 63° W. longitude, which Québec's Legal Time Act uses to " +
        "divide Eastern from Atlantic time. North Ground will not choose a side of it.",
      authority: "Gouvernement du Québec",
    };
  }

  /*
   * EAST OF THE LINE IS REFUSED, AND THE REFUSAL IS THE ACCURATE ANSWER.
   *
   * Three different reckonings apply east of 63° W and which one governs turns
   * on named territories — the MRC de Minganie keeps s. 1's Eastern time, the
   * Listuguj reserve and the Îles-de-la-Madeleine advance while the rest of the
   * east does not. North Ground holds no official boundary for any of the
   * three, so a point here could be on UTC−5, UTC−4 advancing, or UTC−4
   * standing still, and the three are an hour apart in winter.
   *
   * Refusing the whole east rather than the whole province is the point: §8
   * treats a refusal stricter than the evidence as its own false claim, and the
   * evidence west of the line is complete.
   */
  if (point.longitude > QUEBEC_MERIDIAN) {
    return {
      status: "NOT_CERTIFIED",
      reason:
        "East of the meridian of 63° W. longitude, Québec's Legal Time Act applies three different reckonings " +
        "depending on territory: the MRC de Minganie keeps Eastern time, the Îles-de-la-Madeleine and the Listuguj " +
        "reserve observe Atlantic time with advanced time, and the remainder observes Atlantic standard time all " +
        "year. North Ground holds no official boundary for those territories and will not guess which governs here.",
      authority: "Gouvernement du Québec",
    };
  }

  const daylightSaving = daylightSavingInEffect(date);
  const hoursBehind = daylightSaving ? 4 : 5;

  return {
    status: "RESOLVED",
    offsetMinutes: -hoursBehind * 60,
    /* POSIX sign convention: Etc/GMT+5 is five hours BEHIND Greenwich. */
    zone: `Etc/GMT+${hoursBehind}`,
    daylightSaving,
    statedAs: daylightSaving
      ? "In the part of Québec west of the meridian of 63° W. longitude, advanced time is five hours behind " +
        "Greenwich time plus one hour, from the second Sunday in March to the first Sunday in November."
      : "In the part of Québec west of the meridian of 63° W. longitude, standard time is five hours behind " +
        "Greenwich time.",
    section: "Legal Time Act, CQLR c. T-5.1, s. 1",
    observed: OBSERVED_WEST,
  };
}
