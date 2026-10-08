/**
 * Iowa's zone layer, column by column — and why most of its columns may not
 * become a zone layer.
 *
 * ONE FEATURE, SEVEN ANSWERS. `Hunting Regulations/Zones` gives a point exactly
 * one polygon (86 in the state), and that polygon carries a separate value per
 * species in its own column. So a species-scoped layer per column over one
 * endpoint is the obvious shape — and three of the seven columns must not be
 * served that way, for three different reasons.
 *
 * THE AUTHORITY SPELLS OUT THE HUNTER CLASS ITSELF. This is not an inference
 * from an abbreviation: the field ALIASES are IDNR's own labels and they read
 * "Non-Resident Deer Zone", "Non-Resident Spring Turkey Zone" and "Resident
 * Fall Turkey Zone". Iowa encodes hunter class INTO the geography, so serving
 * `NR_Deer` as "the deer zone" would hand a resident a non-resident's
 * boundaries. Hunter class is a dimension of the opportunity (§8), never of the
 * map, and a layer cannot quietly carry one.
 *
 * TWO COLUMNS ARE NOT ZONES AT ALL. `CAGO`'s alias is "Closed Canada Goose
 * Area" — a closure, which is an `AreaEffect` and not a designation. `Grouse`
 * is Yes/No, which is a statement about whether hunting happens rather than
 * about where: §41A's OPEN_ONLY_IF_LISTED shape, with the authority publishing
 * the ground it is permitted on.
 *
 * AND THE ONE COLUMN I HAD CALLED CLEAN IS NOT. `Waterfowl` reads North,
 * Central and South — and two of its 86 rows read "N" and "S". Served as it
 * stands, those two would mint zones "n" and "s" alongside "north" and
 * "south", so a hunter in one of them lands in a zone of our invention.
 * Normalising them is a judgement about what IDNR meant, which is a different
 * act from reading what it published, so both rows are recorded as a defect and
 * the column is not served until the authority's intent is established.
 *
 * Measured 2026-10-07: all 86 features, `where=1=1`, no transfer limit
 * exceeded, so every value below is the whole column rather than a sample.
 */

import type { CanonicalId } from "../../content-contract/index.ts";
import { quoting } from "../provenance.ts";
import type { AreaEffect } from "../overlays.ts";

export const IOWA_ZONE_SERVICE =
  "https://services2.arcgis.com/r6iFVcMJeA4kB4GC/arcgis/rest/services/Atlas_Web_Application/FeatureServer/3";

export const IOWA_ZONE_SOURCE_ID = "source:us-ia-dnr-hunting-zones" as CanonicalId<"source">;

/** Why a column cannot be served as a general zone layer. */
export type IowaColumnBlocker =
  /** Its values are scoped to one hunter class, which the authority's own alias states. */
  | "CARRIES_A_HUNTER_CLASS"
  /** It states whether hunting happens, not where: a closure or a permission. */
  | "IS_AN_AREA_EFFECT_NOT_A_ZONE"
  /** Its own values are inconsistent, so serving it would mint zones we invented. */
  | "VALUES_INCONSISTENT";

export interface IowaZoneColumn {
  /** The service's own column name. */
  column: string;
  /** The service's own field alias, verbatim. This is IDNR's label, not ours. */
  authorityAlias: string;
  /** Values that are zone designations, with how many of the 86 rows carry each. */
  designations: Readonly<Record<string, number>>;
  /** Values that are not designations, with their counts. */
  nonDesignations: Readonly<Record<string, number>>;
  /** Empty where the column can be served as a general zone layer. */
  blockers: readonly IowaColumnBlocker[];
  /** What a reader needs to know, in North Ground's words. */
  note: string;
}

export const IOWA_ZONE_COLUMNS: readonly IowaZoneColumn[] = [
  {
    column: "NR_Deer",
    authorityAlias: "Non-Resident Deer Zone",
    designations: { "1": 9, "2": 14, "3": 13, "4": 8, "5": 3, "6": 4, "7": 19, "8": 6, "9": 2, "10": 3 },
    nonDesignations: { None: 5 },
    blockers: ["CARRIES_A_HUNTER_CLASS"],
    note:
      "Ten zones, and the authority's own alias says they are the NON-RESIDENT deer zones. Serving this as “the deer " +
      "zone” would give a resident a non-resident's boundaries. Iowa's resident deer geography is not in this layer.",
  },
  {
    column: "NR_S_Trky",
    authorityAlias: "Non-Resident Spring Turkey Zone",
    designations: { "4": 15, "5": 15, "6": 17, "7": 16, "8": 18 },
    nonDesignations: { None: 5 },
    blockers: ["CARRIES_A_HUNTER_CLASS"],
    note:
      "Five zones for NON-RESIDENT spring turkey, and the alias says so. Note the numbering starts at 4, which lines up " +
      "with the resident fall turkey column below rather than starting afresh \u2014 so the two classes share a numbering " +
      "space while carrying different geography, and a reader who saw only one column would take its zone 4 for the " +
      "state's zone 4.",
  },
  {
    column: "R_F_Trky",
    authorityAlias: "Resident Fall Turkey Zone",
    designations: { "4": 15, "5": 15, "6": 17, "7": 16, "8": 6, "9": 12 },
    nonDesignations: { None: 5 },
    blockers: ["CARRIES_A_HUNTER_CLASS"],
    note:
      "RESIDENT fall turkey — the mirror image of the column above, and proof the pattern is deliberate rather than a " +
      "naming accident: Iowa publishes turkey geography twice, once per hunter class, for different seasons.",
  },
  {
    column: "CAGO",
    authorityAlias: "Closed Canada Goose Area",
    designations: {},
    nonDesignations: { None: 75, "1": 1, "2": 1, "4": 1, "7": 1, "8": 1, "9": 3, "11": 1, "14": 1, "16": 1 },
    blockers: ["IS_AN_AREA_EFFECT_NOT_A_ZONE"],
    note:
      "Not a zone system: the alias says CLOSED. Eleven of the 86 polygons carry a closed-area number, and the numbers " +
      "identify which closed area rather than which zone. These are AreaEffect records, and a closure minted as a zone " +
      "would resolve hunters into ground the authority has shut.",
  },
  {
    column: "Waterfowl",
    authorityAlias: "Waterfowl Zone",
    designations: { North: 25, Central: 40, South: 14 },
    nonDesignations: { None: 5, N: 1, S: 1 },
    blockers: ["VALUES_INCONSISTENT"],
    note:
      "Iowa's real waterfowl zone system, hunter-class-neutral, and the one column that would otherwise serve — except " +
      "two of its 86 rows read “N” and “S” where the rest spell the direction out. Those two would mint " +
      "zones “n” and “s” beside “north” and “south”. Treating them as abbreviations is " +
      "a judgement about what IDNR meant, not a reading of what it published, so the column waits on that being " +
      "established rather than being quietly normalised.",
  },
  {
    column: "Bobcat",
    authorityAlias: "Bobcat Zone",
    designations: { "1": 38, "3": 11 },
    nonDesignations: { No: 32, None: 5 },
    blockers: ["IS_AN_AREA_EFFECT_NOT_A_ZONE"],
    note:
      "Two zones AND a closure in one column: 32 of the 86 polygons read “No”. The zones are real designations and " +
      "the “No” rows are an area effect, so the column needs splitting before either half can be served. Note the " +
      "zones are 1 and 3 with no 2, which is the authority's numbering and not a gap in the read.",
  },
  {
    column: "Grouse",
    authorityAlias: "Grouse Zone",
    designations: {},
    nonDesignations: { No: 70, Yes: 11, None: 5 },
    blockers: ["IS_AN_AREA_EFFECT_NOT_A_ZONE"],
    note:
      "Despite the alias, this is not a zone system: the values are Yes and No. It is §41A's OPEN_ONLY_IF_LISTED — the " +
      "authority publishing the eleven polygons grouse hunting is permitted on — and the Yes rows are the list.",
  },
];

/**
 * The closures and permissions in those columns, in the authority's own words.
 *
 * `words` quotes the FIELD ALIAS, because that is where IDNR states what the
 * column means, and the citation says it is a GIS attribute. §41B: an
 * authority's GIS does not override its regulations, so none of these is a
 * certified CLOSED or OPEN — they are evidence beside an UNKNOWN until Iowa's
 * own regulations are read.
 */
export const IOWA_AREA_EFFECTS: readonly AreaEffect[] = [
  {
    name: "Closed Canada Goose Area",
    words: quoting(
      "Closed Canada Goose Area",
      IOWA_ZONE_SOURCE_ID,
      "Hunting Regulations/Zones, layer 3, field alias for CAGO",
      "en-US",
    ),
    sourceId: IOWA_ZONE_SOURCE_ID,
    effect: "EXCLUDED",
  },
  {
    name: "Bobcat: No",
    words: quoting(
      "Bobcat Zone",
      IOWA_ZONE_SOURCE_ID,
      "Hunting Regulations/Zones, layer 3, Bobcat = “No” (32 of 86 polygons)",
      "en-US",
    ),
    sourceId: IOWA_ZONE_SOURCE_ID,
    effect: "EXCLUDED",
  },
  /*
   * Grouse is a positive list and both members are published, so neither is
   * LIST_NOT_HELD: the authority says where it is permitted and where it is not.
   */
  {
    name: "Grouse: Yes",
    words: quoting(
      "Grouse Zone",
      IOWA_ZONE_SOURCE_ID,
      "Hunting Regulations/Zones, layer 3, Grouse = “Yes” (11 of 86 polygons)",
      "en-US",
    ),
    sourceId: IOWA_ZONE_SOURCE_ID,
    effect: "OPEN_ONLY_IF_LISTED",
    listed: true,
  },
  {
    name: "Grouse: No",
    words: quoting(
      "Grouse Zone",
      IOWA_ZONE_SOURCE_ID,
      "Hunting Regulations/Zones, layer 3, Grouse = “No” (70 of 86 polygons)",
      "en-US",
    ),
    sourceId: IOWA_ZONE_SOURCE_ID,
    effect: "OPEN_ONLY_IF_LISTED",
    listed: false,
  },
];

/** Whether this column could be served as a general, hunter-neutral zone layer. */
export function iowaColumnIsServableAsAZoneLayer(column: IowaZoneColumn): boolean {
  return column.blockers.length === 0;
}

/** The designation for a raw value in one column, or null where it is not one. */
export function iowaDesignationOf(column: IowaZoneColumn, raw: unknown): string | null {
  const value = raw === null || raw === undefined ? "" : String(raw).trim();
  if (!value) return null;
  return Object.hasOwn(column.designations, value) ? value : null;
}
