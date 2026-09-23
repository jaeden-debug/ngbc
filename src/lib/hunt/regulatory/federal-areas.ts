/**
 * Which federal migratory-bird area a point is in.
 *
 * Schedule 3 defines its areas over geography North Ground already holds — a
 * province's whole extent, a list of that province's own management units, or
 * a latitude the regulation names. So a federal area is RESOLVED FROM the
 * provincial answer rather than drawn as a second geometry, and it composes
 * with it: both the federal rule and the provincial rule apply, and neither
 * replaces the other.
 */

import bundle from "../../../../content/regulatory/ca-federal-2026.json" with { type: "json" };

export type FederalAreaKind =
  | "JURISDICTION"
  | "PROVINCIAL_UNITS"
  | "LATITUDE_BAND"
  /*
   * An area the regulation defines by latitude AND longitude together.
   * Manitoba's Game Bird Hunting Zone No. 1 is "the portion of Manitoba lying
   * north of latitude 57°N AND the portion lying east of longitude 94°W and
   * north of latitude 56°N" — two half-open boxes joined by "and", which in
   * the regulation's sense is a UNION of two portions, not an intersection.
   */
  | "LATITUDE_LONGITUDE_REGION";

/** One half-open box. A point is in the region if it is in ANY clause. */
export interface RegionClause {
  minLatitude?: number;
  maxLatitude?: number;
  /** Degrees east, so 94°W is -94 and "east of" means greater than. */
  minLongitude?: number;
  maxLongitude?: number;
}

export interface FederalArea {
  jurisdictionId: string;
  kind: FederalAreaKind;
  name: string;
  /** The regulation's own definition of this area. */
  statedAs: string;
  units?: readonly string[];
  band?: { minLatitude?: number; maxLatitude?: number };
  region?: { clauses: readonly RegionClause[] };
}

/**
 * Areas a Part defines that North Ground could NOT resolve.
 *
 * This is the difference between two facts that look identical at a point and
 * are not: Alberta's unit 728 is in NO federal area, because the regulation
 * does not place it in one — a real answer about the regulation. A Manitoba
 * hunting area outside Zone No. 4 IS placed, in Zone No. 2 or No. 3, and North
 * Ground cannot say which because those zones are drawn along a lake shore and
 * a township line it does not hold.
 *
 * Saying "the regulation places this in no federal area" for the second case
 * would be a claim about the law that is simply false.
 */
export const UNRESOLVED_AREAS = (bundle.unresolvedAreas ?? {}) as Readonly<Record<string, readonly string[]>>;

/**
 * Why a Part this build has READ still yields no areas.
 *
 * "North Ground has not encoded this jurisdiction" and "North Ground has read
 * this jurisdiction's Part and its zones are drawn on geography it does not
 * hold" are different facts, and until this existed they rendered identically.
 * The first invites waiting; the second names what would have to be acquired.
 */
export const UNRESOLVABLE_BECAUSE = (bundle.unresolvableBecause ?? {}) as Readonly<Record<string, string>>;

export const FEDERAL_AREAS = bundle.areas as readonly FederalArea[];

/**
 * How close to a stated latitude is too close to call.
 *
 * The regulation draws a line at a whole degree; a consumer GPS fix is not a
 * survey, and §41 forbids presenting one as legally infallible. Roughly 200 m
 * of latitude, which is far wider than any real fix and deliberately so: the
 * cost of an extra NEEDS_VERIFICATION is a hunter checking with the authority,
 * and the cost of the other error is a hunter told the wrong season.
 */
const LATITUDE_TOLERANCE_DEGREES = 0.002;

export type FederalAreaResolution =
  | { status: "RESOLVED"; area: FederalArea }
  | { status: "NEEDS_VERIFICATION"; statedAs: string }
  | { status: "UNKNOWN"; statedAs: string };

/**
 * The federal area for a point, given the provincial answer at that point.
 *
 * `designation` is the province's own unit designation where one was resolved
 * (Alberta's "200"), absent where the jurisdiction publishes no units.
 */
export function federalAreaAt(
  jurisdictionId: string,
  point: { latitude: number; longitude?: number },
  designation?: string,
): FederalAreaResolution {
  const here = FEDERAL_AREAS.filter((area) => area.jurisdictionId === jurisdictionId);
  if (!here.length) {
    const blocked = UNRESOLVABLE_BECAUSE[jurisdictionId];
    return {
      status: "UNKNOWN",
      statedAs: blocked
        ? `North Ground has read this jurisdiction's Part of the Migratory Birds Regulations and cannot place a ` +
          `point in any of its federal areas, because ${blocked}.`
        : "North Ground has not encoded the federal migratory-bird areas for this jurisdiction.",
    };
  }

  const jurisdictionWide = here.find((area) => area.kind === "JURISDICTION");
  if (jurisdictionWide) return { status: "RESOLVED", area: jurisdictionWide };

  /*
   * Near a line the regulation names, say so rather than pick a side — for
   * longitude as well as latitude, now that a Part uses both.
   */
  const latitudeLines = new Set<number>();
  const longitudeLines = new Set<number>();
  for (const area of here) {
    for (const value of [area.band?.minLatitude, area.band?.maxLatitude]) if (value !== undefined) latitudeLines.add(value);
    for (const clause of area.region?.clauses ?? []) {
      for (const value of [clause.minLatitude, clause.maxLatitude]) if (value !== undefined) latitudeLines.add(value);
      for (const value of [clause.minLongitude, clause.maxLongitude]) if (value !== undefined) longitudeLines.add(value);
    }
  }
  for (const line of latitudeLines) {
    if (Math.abs(point.latitude - line) <= LATITUDE_TOLERANCE_DEGREES) {
      return {
        status: "NEEDS_VERIFICATION",
        statedAs:
          `This point is within about 200 m of latitude ${line}°N, which the Migratory Birds Regulations use as an ` +
          "area boundary. North Ground will not choose a side of it.",
      };
    }
  }
  if (point.longitude !== undefined) {
    for (const line of longitudeLines) {
      if (Math.abs(point.longitude - line) <= LATITUDE_TOLERANCE_DEGREES) {
        return {
          status: "NEEDS_VERIFICATION",
          statedAs:
            `This point is within about 200 m of longitude ${Math.abs(line)}°W, which the Migratory Birds ` +
            "Regulations use as an area boundary. North Ground will not choose a side of it.",
        };
      }
    }
  }

  /*
   * EVERY KIND IS CONSIDERED, NOT THE FIRST KIND THAT MATCHES.
   *
   * Manitoba is the first Part that defines its areas two ways at once — Zone
   * No. 1 by latitude and longitude, Zone No. 4 by a list of provincial hunting
   * areas — so a point can be tested by both. Returning on the first matching
   * KIND would have silently preferred whichever was checked first, and the
   * two are only believed to be disjoint. This does not assume it: a point
   * matching two areas is NEEDS_VERIFICATION, which checks the claim at every
   * real point rather than once, in advance, against geometry we would have to
   * trust separately.
   */
  const needsLongitude = here.some((area) => area.kind === "LATITUDE_LONGITUDE_REGION");
  const matches = [
    ...here.filter((area) =>
      area.kind === "LATITUDE_BAND" &&
      (area.band?.minLatitude === undefined || point.latitude > area.band.minLatitude) &&
      (area.band?.maxLatitude === undefined || point.latitude < area.band.maxLatitude)),
    ...here.filter((area) =>
      area.kind === "LATITUDE_LONGITUDE_REGION" && point.longitude !== undefined &&
      (area.region?.clauses ?? []).some((clause) =>
        (clause.minLatitude === undefined || point.latitude > clause.minLatitude) &&
        (clause.maxLatitude === undefined || point.latitude < clause.maxLatitude) &&
        (clause.minLongitude === undefined || point.longitude! > clause.minLongitude) &&
        (clause.maxLongitude === undefined || point.longitude! < clause.maxLongitude))),
    ...(designation
      ? here.filter((area) => area.kind === "PROVINCIAL_UNITS" && area.units?.includes(designation))
      : []),
  ];

  if (matches.length === 1) return { status: "RESOLVED", area: matches[0] };
  if (matches.length > 1) {
    return {
      status: "NEEDS_VERIFICATION",
      statedAs:
        `The Migratory Birds Regulations appear to place this point in more than one federal area ` +
        `(${matches.map((area) => area.name).join(", ")}); North Ground will not choose between them.`,
    };
  }

  /* Nothing matched. Which UNKNOWN this is depends on WHY. */
  if (needsLongitude && point.longitude === undefined) {
    return {
      status: "UNKNOWN",
      statedAs:
        "The federal areas here are defined partly by longitude, and this point carries none.",
    };
  }

  const unresolved = UNRESOLVED_AREAS[jurisdictionId] ?? [];
  if (unresolved.length) {
    return {
      status: "UNKNOWN",
      statedAs:
        `The Migratory Birds Regulations place this point in ${unresolved.join(" or ")}, which ` +
        "North Ground cannot resolve from the geography it holds, so it holds no federal season for it.",
    };
  }

  if (here.some((area) => area.kind === "PROVINCIAL_UNITS")) {
    if (!designation) {
      return {
        status: "UNKNOWN",
        statedAs:
          "The federal area here is defined by provincial management units, and no unit was resolved for this point.",
      };
    }
    /* A unit in NO federal area is a real answer about the regulation, not a
       gap in North Ground: the regulation simply does not place it in one. */
    return {
      status: "UNKNOWN",
      statedAs:
        `The Migratory Birds Regulations place unit ${designation} in no federal migratory-bird area, so North ` +
        "Ground holds no federal season for it.",
    };
  }

  return { status: "UNKNOWN", statedAs: "This point falls in no federal area this jurisdiction's Part defines." };
}
