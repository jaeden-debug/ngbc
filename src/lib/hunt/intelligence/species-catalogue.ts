import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isTakeEligibility, type TakeEligibility } from "../../content/species-eligibility.ts";

/**
 * Every species North Ground publishes a profile for, with its scientific name.
 *
 * WHY THIS EXISTS. The Breeding Bird Survey builder used to join against
 * `SUPPORTED_SPECIES` — a hand-kept list of 32 — so six species Hunt publishes
 * and the survey records could never receive a surface: American black duck,
 * cackling goose, willow ptarmigan, rock ptarmigan, gray partridge and
 * ring-necked pheasant. Black duck was the one that showed it, because it
 * answered 200 with its waterfowl plots and no field: partially present, which
 * is the failure that survives a reachability check, because something did come
 * back.
 *
 * The registry could not have caught it. A registry certifies what a builder
 * produced, so it is structurally blind to a species the builder never
 * considered — a gate that validates output cannot see a missing input. This is
 * the third defect of one shape in a day: a reachable set written somewhere a
 * human had to remember to update.
 *
 * So the catalogue is READ, from the directory the profiles are published in.
 * Adding a published species puts it in scope automatically; there is no list.
 */
const PUBLISHED = join(process.cwd(), "content", "published");

export interface CatalogueSpecies {
  speciesId: string;
  scientificName: string;
  /**
   * Read from the profile, never defaulted. A species with no eligibility fails
   * the catalogue rather than being treated as game: trumpeter swan got a
   * "where to look for this animal" surface because the only thing between a
   * protected bird and a hunting aid was a hand-kept list it was missing from.
   */
  takeEligibility: TakeEligibility;
}

function collect(value: unknown, into: Map<string, CatalogueSpecies>): void {
  if (Array.isArray(value)) {
    for (const item of value) collect(item, into);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.speciesId === "string" && typeof record.scientificName === "string" && record.scientificName.trim()) {
    if (!isTakeEligibility(record.takeEligibility)) {
      throw new Error(`${record.speciesId} has no take eligibility; every published species must declare one`);
    }
    into.set(record.speciesId, {
      speciesId: record.speciesId,
      scientificName: record.scientificName.trim(),
      takeEligibility: record.takeEligibility,
    });
  }
  for (const nested of Object.values(record)) collect(nested, into);
}

let cached: CatalogueSpecies[] | null = null;

export function catalogueSpecies(): readonly CatalogueSpecies[] {
  if (cached) return cached;
  const found = new Map<string, CatalogueSpecies>();
  for (const file of readdirSync(PUBLISHED)) {
    if (!file.endsWith(".json")) continue;
    collect(JSON.parse(readFileSync(join(PUBLISHED, file), "utf8")), found);
  }
  cached = [...found.values()].sort((a, b) => a.speciesId.localeCompare(b.speciesId));
  return cached;
}
