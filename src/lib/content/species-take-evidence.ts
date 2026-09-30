import evidenceJson from "../../../content/published/species-take-evidence.json" with { type: "json" };
import type { CanonicalId } from "../content-contract/ids.ts";
import { CANADA_JURISDICTIONS } from "../hunt/canada/registry.ts";
import { UNITED_STATES_JURISDICTIONS } from "../hunt/united-states/registry.ts";

/**
 * Which authorities list a species for legal take, and how — generated from the
 * jurisdiction-first audit by `scripts/build-species-take-matrix.mjs`.
 *
 * A LISTING, NEVER A SEASON. A row says the authority's own regulations name
 * this animal as takeable in some season, place, licence class or program. It
 * says nothing about today, here, or this hunter: that is the regulatory
 * engine's answer, and only where North Ground holds certified rules. Every row
 * carries the source that was read.
 */
export type TakeMode =
  | "HUNTING"
  | "TRAPPING"
  | "MIGRATORY_HARVEST"
  | "NUISANCE_TAKE"
  | "INVASIVE_REMOVAL"
  | "REPTILE_HARVEST"
  | "AMPHIBIAN_HARVEST"
  | "OTHER_REGULATED_TAKE";

/** Words, because a take mode is never shown as a code. */
export const TAKE_MODE_LABELS: Record<TakeMode, string> = {
  HUNTING: "hunting",
  TRAPPING: "trapping",
  MIGRATORY_HARVEST: "migratory bird hunting",
  NUISANCE_TAKE: "nuisance or unprotected take",
  INVASIVE_REMOVAL: "invasive species removal",
  REPTILE_HARVEST: "reptile take",
  AMPHIBIAN_HARVEST: "amphibian take",
  OTHER_REGULATED_TAKE: "other regulated take",
};

interface EvidenceRow {
  jurisdictionId: string;
  takeModes: TakeMode[];
  statuses: string[];
  authorityNames: string[];
  resolvedBy: string[];
  sourceIds: CanonicalId<"source">[];
  /** Material conditions from a species-specific finding (Nevada's trumpeter quota). */
  conditions?: string[];
}

interface EvidenceBundle {
  takeEvidence: Array<{ speciesId: string; jurisdictions: EvidenceRow[] }>;
}

export interface SpeciesTakeListing extends EvidenceRow {
  jurisdictionName: string;
  country: "CA" | "US";
}

const NAMES = new Map<string, string>([
  ...CANADA_JURISDICTIONS.map(({ id, nameEn, kind }) => [id, kind === "federal" ? "Canada (federal migratory birds)" : nameEn] as [string, string]),
  ...UNITED_STATES_JURISDICTIONS.map(({ id, nameEn }) => [id, nameEn] as [string, string]),
  ["jurisdiction:us-federal", "United States (federal)"],
]);

const bySpecies = new Map((evidenceJson as unknown as EvidenceBundle).takeEvidence.map(({ speciesId, jurisdictions }) => [speciesId, jurisdictions]));

export function jurisdictionDisplayName(jurisdictionId: string): string | null {
  return NAMES.get(jurisdictionId) ?? null;
}

/** Canada first, then the United States, each alphabetical by name. */
export function takeListingsFor(speciesId: string): SpeciesTakeListing[] {
  return (bySpecies.get(speciesId) ?? [])
    .flatMap((row) => {
      const jurisdictionName = NAMES.get(row.jurisdictionId);
      if (!jurisdictionName) return [];
      return [{ ...row, jurisdictionName, country: row.jurisdictionId.startsWith("jurisdiction:ca-") ? "CA" as const : "US" as const }];
    })
    .sort((a, b) => a.country.localeCompare(b.country) || a.jurisdictionName.localeCompare(b.jurisdictionName));
}

/** Every species the audit shows as listed somewhere, for the completeness gates. */
export function speciesWithTakeListings(): string[] {
  return [...bySpecies.keys()];
}

export function allTakeEvidenceJurisdictionIds(): string[] {
  return [...new Set([...bySpecies.values()].flatMap((rows) => rows.map(({ jurisdictionId }) => jurisdictionId)))];
}
