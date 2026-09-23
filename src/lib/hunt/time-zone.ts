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

/** Jurisdictions whose whole extent is one IANA zone, so a point in them needs no lookup. */
export const SINGLE_ZONE_JURISDICTIONS: Readonly<Record<string, string>> = {
  "jurisdiction:ca-pe": "America/Halifax",
  "jurisdiction:ca-ns": "America/Halifax",
  "jurisdiction:ca-nb": "America/Moncton",
  "jurisdiction:ca-sk": "America/Regina",
  "jurisdiction:ca-yt": "America/Whitehorse",
};

/**
 * The timezone at a point, or undefined where North Ground cannot establish it.
 *
 * Undefined is the honest answer for British Columbia, Ontario, Québec,
 * Manitoba, Alberta and Newfoundland until a licensed point-timezone dataset
 * exists. A hunter shown no time checks; a hunter shown a wrong one does not.
 */
export function timeZoneAtPoint(jurisdictionId: string): PointTimeZone | undefined {
  const single = SINGLE_ZONE_JURISDICTIONS[jurisdictionId];
  return single ? pointTimeZone(single, "SINGLE_ZONE_JURISDICTION") : undefined;
}
