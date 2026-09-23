/**
 * Two different timezones, which must never be mistaken for each other.
 *
 * A PROVENANCE timezone is a jurisdiction's own clock, used to stamp a date on
 * a record North Ground publishes on its behalf. One value per jurisdiction is
 * fine for that.
 *
 * A POINT timezone is the IANA zone at a hunt location. A legal hunting time
 * is a wall-clock time, so it depends on this and on nothing else — and a
 * jurisdiction-wide value is NOT this, because jurisdictions span zones.
 * Measured on two North Ground already serves:
 *
 *   British Columbia   declared America/Vancouver; the Peace River region is
 *                      America/Dawson_Creek. One hour out in December and
 *                      CORRECT IN SEPTEMBER, so an in-season check passes and
 *                      the error appears in the dark, at the hour a hunter
 *                      decides whether it is legal to shoot.
 *   Newfoundland and   declared America/St_Johns; Labrador is
 *   Labrador           America/Goose_Bay. Thirty minutes out year-round, which
 *                      is the size of a typical offset, so a "thirty minutes
 *                      before sunrise" rule there silently cancels or doubles
 *                      its own offset and still reads as a plausible time.
 *
 * The two are branded separately so the compiler refuses the substitution
 * rather than a reviewer having to notice it. A legal-time function takes a
 * `PointTimeZone`; a layer can only offer a `ProvenanceTimeZone`; there is no
 * conversion, because there is no safe one.
 */

declare const PROVENANCE: unique symbol;
declare const POINT: unique symbol;

/** A jurisdiction's own clock. Good for stamping a date; never a legal time. */
export type ProvenanceTimeZone = string & { readonly [PROVENANCE]: true };

/** The IANA zone AT a hunt location, established for that location. */
export type PointTimeZone = string & { readonly [POINT]: true };

/**
 * A point timezone, from something that actually established it for the point.
 *
 * Deliberately awkward to call: it takes the evidence, not just the string, so
 * "where did this come from?" is answerable at the call site. There is no
 * helper that turns a jurisdiction into one.
 */
export function pointTimeZone(
  iana: string,
  establishedBy: "SINGLE_ZONE_JURISDICTION" | "POINT_LOOKUP",
): PointTimeZone {
  if (!iana.includes("/")) throw new Error(`Not an IANA timezone: ${iana}`);
  void establishedBy;
  return iana as PointTimeZone;
}

/**
 * Jurisdictions whose whole extent is one IANA zone, so a point in them needs
 * no lookup.
 *
 * Membership is decided against the tz database's own country table
 * (`zone1970.tab` / `zone.tab`), which lists each zone with the areas it
 * covers, rather than against an impression of where a province sits. Alberta
 * and Manitoba each appear in exactly one row:
 *
 *   America/Edmonton   "AB, BC(E), NT(E), SK(W)"
 *   America/Winnipeg   "Central - ON (west), Manitoba"
 *
 * Ontario, Québec, British Columbia and Newfoundland and Labrador appear in
 * several and are deliberately absent, which is why `timeZoneAtPoint` returns
 * undefined for them.
 *
 * KNOWN EXPOSURE, RECORDED RATHER THAN SILENTLY FIXED — SASKATCHEWAN.
 * The same table shows Saskatchewan in THREE rows: America/Regina ("most
 * areas"), America/Swift_Current ("midwest") and America/Edmonton ("SK(W)").
 * Regina and Swift_Current agree on the wall clock — both CST year-round — but
 * the SK(W) area around Lloydminster keeps Alberta time, so it is MDT in
 * summer (UTC-6, agreeing with CST) and MST in winter (UTC-7, an hour apart).
 *
 * That is the failure shape this file was written about: correct in one season
 * and wrong in the other, so an in-season check passes. It is live rather than
 * theoretical, because `timeZoneAtPoint` feeds federal migratory-bird hours and
 * readiness, and those seasons run into November and December.
 *
 * It is NOT removed here on one agent's judgement: making it undefined would
 * withhold a legal time across the whole province to be right about one border
 * strip, which §8 treats as its own kind of false claim. It is reported to the
 * lane that owns Saskatchewan's serving posture so the trade is made
 * deliberately.
 */
export const SINGLE_ZONE_JURISDICTIONS: Readonly<Record<string, string>> = {
  "jurisdiction:ca-pe": "America/Halifax",
  "jurisdiction:ca-ns": "America/Halifax",
  "jurisdiction:ca-nb": "America/Moncton",
  "jurisdiction:ca-sk": "America/Regina",
  "jurisdiction:ca-yt": "America/Whitehorse",
  "jurisdiction:ca-ab": "America/Edmonton",
  "jurisdiction:ca-mb": "America/Winnipeg",
  /*
   * United States zones are described by EXCEPTION in the same table, so
   * membership here rests on an absence — which is evidence only because the
   * table would have shown it: it names exceptions down to single counties
   * (`Central - ND (Oliver)`, `Eastern - KY (Wayne)`). Montana is named in
   * none. Idaho IS named (`Mountain - ID (south), OR (east)`) and is therefore
   * absent from this table.
   */
  "jurisdiction:us-mt": "America/Denver",
};

/**
 * The timezone at a point, or undefined where North Ground cannot establish it.
 *
 * Undefined is the honest answer for British Columbia, Ontario, Québec and
 * Newfoundland and Labrador until a licensed point-timezone dataset exists:
 * each genuinely spans zones whose wall clocks differ. A hunter shown no time
 * checks; a hunter shown a wrong one does not.
 *
 * Alberta and Manitoba were in that list and should not have been — the tz
 * database puts each wholly inside one zone (see above). Withholding their
 * legal hours for a limitation that does not apply to them was a refusal
 * stricter than the evidence, which §8 makes as much a false claim as an
 * over-broad one.
 */
export function timeZoneAtPoint(jurisdictionId: string): PointTimeZone | undefined {
  const single = SINGLE_ZONE_JURISDICTIONS[jurisdictionId];
  return single ? pointTimeZone(single, "SINGLE_ZONE_JURISDICTION") : undefined;
}
