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

export type FederalAreaKind = "JURISDICTION" | "PROVINCIAL_UNITS" | "LATITUDE_BAND";

export interface FederalArea {
  jurisdictionId: string;
  kind: FederalAreaKind;
  name: string;
  /** The regulation's own definition of this area. */
  statedAs: string;
  units?: readonly string[];
  band?: { minLatitude?: number; maxLatitude?: number };
}

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
  point: { latitude: number },
  designation?: string,
): FederalAreaResolution {
  const here = FEDERAL_AREAS.filter((area) => area.jurisdictionId === jurisdictionId);
  if (!here.length) {
    return {
      status: "UNKNOWN",
      statedAs: "North Ground has not encoded the federal migratory-bird areas for this jurisdiction.",
    };
  }

  const jurisdictionWide = here.find((area) => area.kind === "JURISDICTION");
  if (jurisdictionWide) return { status: "RESOLVED", area: jurisdictionWide };

  const bands = here.filter((area) => area.kind === "LATITUDE_BAND");
  if (bands.length) {
    /* Near a stated line, say so rather than pick a side. */
    const lines = new Set(bands.flatMap((area) => [area.band?.minLatitude, area.band?.maxLatitude].filter((value): value is number => value !== undefined)));
    for (const line of lines) {
      if (Math.abs(point.latitude - line) <= LATITUDE_TOLERANCE_DEGREES) {
        return {
          status: "NEEDS_VERIFICATION",
          statedAs:
            `This point is within about 200 m of latitude ${line}°N, which the Migratory Birds Regulations use as an ` +
            "area boundary. North Ground will not choose a side of it.",
        };
      }
    }
    const band = bands.find((area) =>
      (area.band?.minLatitude === undefined || point.latitude > area.band.minLatitude) &&
      (area.band?.maxLatitude === undefined || point.latitude < area.band.maxLatitude));
    if (band) return { status: "RESOLVED", area: band };
    return { status: "UNKNOWN", statedAs: "This point falls in no federal area this jurisdiction's Part defines." };
  }

  if (!designation) {
    return {
      status: "UNKNOWN",
      statedAs:
        "The federal area here is defined by provincial management units, and no unit was resolved for this point.",
    };
  }
  const byUnit = here.filter((area) => area.kind === "PROVINCIAL_UNITS" && area.units?.includes(designation));
  if (byUnit.length === 1) return { status: "RESOLVED", area: byUnit[0] };
  if (byUnit.length > 1) {
    return {
      status: "NEEDS_VERIFICATION",
      statedAs:
        `The Migratory Birds Regulations place unit ${designation} in more than one federal area ` +
        `(${byUnit.map((area) => area.name).join(", ")}); North Ground will not choose between them.`,
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
