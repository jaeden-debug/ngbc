/**
 * Illinois's season-zone layer, split into what it is: eleven zone identities
 * and four statements about whether hunting happens at all.
 *
 * THE TRAP THIS MODULE EXISTS FOR. `DNRGIS.Wildlife_SeasonZones` keeps its
 * zone identity and its legal closures IN THE SAME FIELD. A naive read of
 * `Zone` mints a management zone called "No Spring Turkey Hunting Permitted"
 * and then resolves hunters into it — a zone named after a prohibition, with an
 * id, a label and a card.
 *
 * AND THE OPPOSITE VALUE IS IN THERE TOO, which is the half that would have
 * been lost. Fall Firearm Turkey has NO named zone at all: the layer carries
 * exactly two polygons for it, "Open to Fall Firearm Turkey Hunting" and
 * "Closed to Fall Firearm Turkey Hunting". So the authority is OPENING ground
 * in the same field it closes other ground in, which is §41A's
 * OPEN_ONLY_IF_LISTED in its purest form, and a mechanism that can only
 * restrict cannot express it. Discarding the Open polygon as "not a zone" would
 * withhold a season the authority expressly granted — §8's understating
 * direction, the one nobody reports.
 *
 * THE INVENTORY IS COMPLETE AND MEASURED, not sampled. The service holds
 * exactly 15 features, read 2026-10-07 with `where=1=1`: every distinct value
 * of `Species`, `Season` and `Zone` is below, and `exceededTransferLimit` was
 * absent, so this is the whole layer rather than a page of it. That is what
 * lets the classification be exhaustive — and what lets an UNRECOGNISED value
 * be refused rather than absorbed.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not define overlay semantics: the
 * `AreaEffect` vocabulary is the Hunt lane's and is consumed here, not
 * reinvented. It does not certify any Illinois rule — no Illinois bundle
 * exists — and it does not serve the layer. It separates base geography from
 * area effects and characterises each effect in the authority's own words,
 * which is the half that has to exist before either can be used.
 */

import type { CanonicalId } from "../../content-contract/index.ts";
import { quoting } from "../provenance.ts";
import type { AreaEffect } from "../overlays.ts";

export const ILLINOIS_SEASON_ZONE_SERVICE =
  "https://geoservices3.dnr.illinois.gov/arcgis/rest/services/Wildlife/HFSM_Lines_Pts/MapServer/4";

export const ILLINOIS_SEASON_ZONE_SOURCE_ID = "source:us-il-dnr-wildlife-season-zones" as CanonicalId<"source">;

/** What the layer publishes for one species, and for one season where it names one. */
export interface IllinoisSpeciesGeography {
  /** The layer's own `Species` value, verbatim. */
  species: string;
  /** The layer's own `Season` value, verbatim, or null where it carries none. */
  season: string | null;
  /** `Zone` values that ARE zone identities. */
  designations: readonly string[];
  /** `Zone` values that are statements about hunting rather than identities. */
  effects: readonly string[];
}

/**
 * Every row in the layer, by species and season. Verbatim values; the spelling
 * is the authority's, including "Fall Fire Arm Turkey" in `Season` against
 * "Fall Firearm Turkey" in `Zone`, which is left exactly as published.
 */
export const ILLINOIS_SEASON_ZONES: readonly IllinoisSpeciesGeography[] = [
  {
    species: "Bobcat",
    season: null,
    designations: ["Bobcat Hunting and Trapping Zone"],
    effects: ["No Bobcat Hunting or Trapping Permitted"],
  },
  {
    species: "Furbearer",
    season: null,
    designations: ["North Furbearer Zone", "South Furbearer Zone"],
    effects: [],
  },
  {
    /* The only species whose geography is ENTIRELY open-or-closed: no named
       zone exists for this season anywhere in the layer. */
    species: "Turkey",
    season: "Fall Fire Arm Turkey",
    designations: [],
    effects: ["Open to Fall Firearm Turkey Hunting", "Closed to Fall Firearm Turkey Hunting"],
  },
  {
    species: "Turkey",
    season: "Spring Turkey Hunting",
    designations: ["North Spring Turkey Hunting Zone", "South Spring Turkey Hunting Zone"],
    effects: ["No Spring Turkey Hunting Permitted"],
  },
  {
    species: "Upland Game",
    season: null,
    designations: ["North Upland Game Zone", "South Upland Game Zone"],
    effects: [],
  },
  {
    species: "Waterfowl",
    season: "Duck & Goose",
    designations: [
      "North Duck & Goose Zone", "Central Duck & Goose Zone",
      "South Central Duck & Goose Zone", "South Duck & Goose Zone",
    ],
    effects: [],
  },
];

/** Every `Zone` value that is a zone identity. */
export const ILLINOIS_DESIGNATIONS: readonly string[] =
  ILLINOIS_SEASON_ZONES.flatMap((row) => row.designations);

/** Every `Zone` value that states something about hunting instead. */
export const ILLINOIS_EFFECT_VALUES: readonly string[] =
  ILLINOIS_SEASON_ZONES.flatMap((row) => row.effects);

/**
 * What each non-identity value does, in the authority's own words.
 *
 * Each `words` is the layer's own string, quoted, with the service and layer as
 * its citation — so the provenance says what it is: a GIS attribute, which is
 * NOT the instrument. §41B's rule that an authority's GIS does not override its
 * regulations is why none of these is a certified CLOSED; they are evidence
 * beside an UNKNOWN until Illinois's own regulations are read.
 */
export const ILLINOIS_AREA_EFFECTS: readonly AreaEffect[] = [
  {
    name: "No Bobcat Hunting or Trapping Permitted",
    words: quoting(
      "No Bobcat Hunting or Trapping Permitted",
      ILLINOIS_SEASON_ZONE_SOURCE_ID,
      "DNRGIS.Wildlife_SeasonZones, layer 4, Zone attribute, Species = Bobcat",
      "en-US",
    ),
    sourceId: ILLINOIS_SEASON_ZONE_SOURCE_ID,
    effect: "EXCLUDED",
  },
  {
    name: "No Spring Turkey Hunting Permitted",
    words: quoting(
      "No Spring Turkey Hunting Permitted",
      ILLINOIS_SEASON_ZONE_SOURCE_ID,
      "DNRGIS.Wildlife_SeasonZones, layer 4, Zone attribute, Species = Turkey, Season = Spring Turkey Hunting",
      "en-US",
    ),
    sourceId: ILLINOIS_SEASON_ZONE_SOURCE_ID,
    effect: "EXCLUDED",
  },
  /*
   * THE PAIR. Fall Firearm Turkey is a positive list: the authority publishes
   * the ground that IS open and the ground that is not, and there is no third
   * polygon. So `listed` is the fact, and it is read from which polygon the
   * point falls in rather than from the area's name.
   */
  {
    name: "Open to Fall Firearm Turkey Hunting",
    words: quoting(
      "Open to Fall Firearm Turkey Hunting",
      ILLINOIS_SEASON_ZONE_SOURCE_ID,
      "DNRGIS.Wildlife_SeasonZones, layer 4, Zone attribute, Species = Turkey, Season = Fall Fire Arm Turkey",
      "en-US",
    ),
    sourceId: ILLINOIS_SEASON_ZONE_SOURCE_ID,
    effect: "OPEN_ONLY_IF_LISTED",
    listed: true,
  },
  {
    name: "Closed to Fall Firearm Turkey Hunting",
    words: quoting(
      "Closed to Fall Firearm Turkey Hunting",
      ILLINOIS_SEASON_ZONE_SOURCE_ID,
      "DNRGIS.Wildlife_SeasonZones, layer 4, Zone attribute, Species = Turkey, Season = Fall Fire Arm Turkey",
      "en-US",
    ),
    sourceId: ILLINOIS_SEASON_ZONE_SOURCE_ID,
    effect: "OPEN_ONLY_IF_LISTED",
    listed: false,
  },
];

/**
 * How a raw `Zone` value is classified. Three answers, and the third is the
 * one that keeps the layer honest as IDNR edits it.
 */
export type IllinoisZoneReading =
  /** A zone identity. */
  | { kind: "DESIGNATION"; designation: string }
  /** A statement about hunting, with what it does. */
  | { kind: "AREA_EFFECT"; area: AreaEffect }
  /**
   * Neither — a value this module has not measured.
   *
   * REFUSED, NOT ABSORBED. An exact list cannot recognise a phrasing IDNR adds
   * tomorrow, and the failure direction is not symmetric: absorbing an unknown
   * value as a designation mints a zone that may be named after a prohibition,
   * while refusing it costs a zone that can be added in one line once someone
   * has read it. A pattern that quietly accepted anything prohibition-shaped
   * would be the same mistake as a word list, which is why there is none.
   */
  | { kind: "UNRECOGNISED"; raw: string };

const BY_VALUE: ReadonlyMap<string, IllinoisZoneReading> = new Map<string, IllinoisZoneReading>([
  ...ILLINOIS_DESIGNATIONS.map<[string, IllinoisZoneReading]>((designation) =>
    [designation, { kind: "DESIGNATION", designation }]),
  ...ILLINOIS_AREA_EFFECTS.map<[string, IllinoisZoneReading]>((area) =>
    [area.name, { kind: "AREA_EFFECT", area }]),
]);

export function readIllinoisZoneValue(raw: unknown): IllinoisZoneReading {
  const value = typeof raw === "string" ? raw.trim() : "";
  return BY_VALUE.get(value) ?? { kind: "UNRECOGNISED", raw: value };
}

/**
 * The layer's `designationOf`: the designation for a zone identity, and null
 * for everything else.
 *
 * Null is the right answer for an area effect AND for an unrecognised value,
 * because neither is a zone — but they are different findings, and a caller
 * that needs to know which asks `readIllinoisZoneValue`. This function exists
 * so one declaration feeds both the guard and the evidence, and they cannot
 * drift apart.
 */
export function illinoisDesignationOf(raw: unknown): string | null {
  const reading = readIllinoisZoneValue(raw);
  return reading.kind === "DESIGNATION" ? reading.designation : null;
}
