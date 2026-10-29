import type { CanonicalId } from "../../content-contract/index.ts";
import { CANADA_JURISDICTIONS } from "../canada/registry.ts";
import { regulatoryEntryFor } from "../regulatory/registry.ts";
import { SINGLE_ZONE_JURISDICTIONS } from "../time-zone.ts";
import { officialTermPlural, ZONE_LAYERS, zoneIdFor, type ZoneLayer } from "../zone-layers.ts";
import nbBundle from "../../../../content/regulatory/ca-nb-2026.json" with { type: "json" };
import nlBundle from "../../../../content/regulatory/ca-nl-2026.json" with { type: "json" };
import nsBundle from "../../../../content/regulatory/ca-ns-2026.json" with { type: "json" };
import skBundle from "../../../../content/regulatory/ca-sk-2026.json" with { type: "json" };

/**
 * Which jurisdictions get a server-rendered season page, and which zones each
 * page asks the engine about.
 *
 * A page exists only where North Ground draws the authority's geography AND
 * serves certified rules for it (`rulesServing`), because a page with nothing
 * to evaluate would be the empty programmatic page §28 forbids. Canada only:
 * the United States is not presented in copy until it is properly served
 * (owner, 2026-09-29).
 */

export interface SeasonRegion {
  /** URL segment: /hunting/{slug}. */
  slug: string;
  jurisdictionId: CanonicalId<"jurisdiction">;
  name: string;
  /** The jurisdiction's own clock, used only to decide which calendar day the page describes. */
  timeZone: string;
  /** Served layers whose rules answer, each with the designations the page evaluates. */
  layers: Array<{ layer: ZoneLayer; designations: string[] }>;
  /** Where the authority publishes its own hunting rules. */
  huntingAuthorityUrl?: string;
  knownGaps: string[];
}

/*
 * Provenance clocks for the jurisdictions that span more than one IANA zone.
 * These stamp the date a page describes — never a legal hunting time, which
 * depends on the point (`time-zone.ts`). Each is the zone of the authority's
 * seat of government.
 */
const SEAT_TIME_ZONES: Readonly<Record<string, string>> = {
  "jurisdiction:ca-on": "America/Toronto",
  "jurisdiction:ca-qc": "America/Toronto",
  "jurisdiction:ca-bc": "America/Vancouver",
  "jurisdiction:ca-nl": "America/St_Johns",
};

/*
 * Layers that carry no generated `certifiedDesignations` list their units in
 * the bundle that certifies them. A unit belongs to a layer when the layer
 * mints that unit's own canonical id from its identifier — so Newfoundland's
 * moose, caribou and bear areas, which share one bundle, never mix.
 */
const BUNDLE_UNITS: ReadonlyArray<{ identifier: string; zoneId: string }> = [
  ...nbBundle.units, ...nlBundle.units, ...nsBundle.units, ...skBundle.units,
];

function designationsOf(layer: ZoneLayer): string[] {
  if (layer.certifiedDesignations) return [...layer.certifiedDesignations];
  return BUNDLE_UNITS
    .filter((unit) => zoneIdFor(layer, unit.identifier) === unit.zoneId)
    .map((unit) => unit.identifier);
}

export function slugOf(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Natural order for designations: "2" before "10", "10A" after "10". */
export function compareDesignations(a: string, b: string): number {
  return a.localeCompare(b, "en-CA", { numeric: true, sensitivity: "base" });
}

let regions: SeasonRegion[] | null = null;

export function seasonRegions(): SeasonRegion[] {
  if (regions) return regions;
  const built: SeasonRegion[] = [];
  for (const jurisdiction of CANADA_JURISDICTIONS) {
    if (jurisdiction.kind !== "province" && jurisdiction.kind !== "territory") continue;
    if (!regulatoryEntryFor(jurisdiction.id)) continue;
    const layers = ZONE_LAYERS
      .filter((layer) => layer.jurisdictionId === jurisdiction.id && layer.serving && layer.rulesServing === true)
      .map((layer) => ({ layer, designations: designationsOf(layer).sort(compareDesignations) }))
      .filter((entry) => entry.designations.length > 0);
    if (!layers.length) continue;
    const timeZone = SEAT_TIME_ZONES[jurisdiction.id] ?? SINGLE_ZONE_JURISDICTIONS[jurisdiction.id];
    if (!timeZone) throw new Error(`No provenance clock for ${jurisdiction.id}`);
    built.push({
      slug: slugOf(jurisdiction.nameEn),
      jurisdictionId: jurisdiction.id as CanonicalId<"jurisdiction">,
      name: jurisdiction.nameEn,
      timeZone,
      layers,
      ...(jurisdiction.regulatory.huntingAuthorityUrl ? { huntingAuthorityUrl: jurisdiction.regulatory.huntingAuthorityUrl } : {}),
      knownGaps: jurisdiction.knownGaps,
    });
  }
  regions = built.sort((a, b) => a.name.localeCompare(b.name, "en-CA"));
  return regions;
}

export function seasonRegionBySlug(slug: string): SeasonRegion | undefined {
  return seasonRegions().find((region) => region.slug === slug);
}

export function layerTermPlural(layer: ZoneLayer): string {
  return officialTermPlural(layer);
}
