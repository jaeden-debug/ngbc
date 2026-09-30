import policyJson from "../../../../content/species-media/identity-policy.json" with { type: "json" };
import { PUBLISHED_SPECIES_BUNDLES } from "../../content/species-route.ts";
import { buildIdentity, buildLexicon, type IdentityPolicy, type NameLexicon, type SpeciesIdentityInput, type SpeciesImageIdentity } from "./identity.ts";

interface BundleEntity { id?: string; type?: string; aliases?: Array<{ value?: string; type?: string; verificationStatus?: string }> }
interface BundleResource {
  type?: string;
  status?: string;
  slug?: string;
  canonicalUrl?: string;
  speciesProfile?: {
    speciesId: string;
    commonNames: Array<{ locale: string; value: string }>;
    scientificName: string;
    speciesGroupIds?: string[];
    takeEligibility?: string;
  };
}
interface Bundle { entities?: BundleEntity[]; resources?: BundleResource[] }

export interface CatalogueSpecies extends SpeciesIdentityInput {
  slug: string;
  canonicalUrl: string | null;
  takeEligibility: string;
}

/** Every published species profile, with its verified common-name aliases, in bundle order. */
export function catalogueSpecies(bundles: readonly unknown[] = PUBLISHED_SPECIES_BUNDLES): CatalogueSpecies[] {
  const entities = new Map<string, BundleEntity>();
  for (const bundle of bundles as Bundle[]) for (const entity of bundle.entities ?? []) {
    if (entity.type === "species" && entity.id) entities.set(entity.id, entity);
  }
  const species: CatalogueSpecies[] = [];
  const seen = new Set<string>();
  for (const bundle of bundles as Bundle[]) for (const resource of bundle.resources ?? []) {
    const profile = resource.speciesProfile;
    if (resource.type !== "species" || resource.status !== "published" || !profile || !resource.slug) continue;
    if (seen.has(profile.speciesId)) continue;
    seen.add(profile.speciesId);
    const commonName = profile.commonNames.find(({ locale }) => locale === "en-CA")?.value ?? profile.commonNames[0]?.value;
    if (!commonName) continue;
    const aliases = (entities.get(profile.speciesId)?.aliases ?? [])
      .filter((alias) => alias.type === "common_name" && alias.verificationStatus === "verified" && alias.value)
      .map((alias) => alias.value!);
    species.push({
      speciesId: profile.speciesId,
      slug: resource.slug,
      canonicalUrl: resource.canonicalUrl ?? null,
      commonName,
      scientificName: profile.scientificName,
      aliases,
      groupIds: profile.speciesGroupIds ?? [],
      takeEligibility: profile.takeEligibility ?? "UNKNOWN",
    });
  }
  return species;
}

export const IDENTITY_POLICY = policyJson as IdentityPolicy;

export interface SpeciesIdentityCatalogue {
  species: CatalogueSpecies[];
  lexicon: NameLexicon;
  identities: Map<string, SpeciesImageIdentity>;
}

export function speciesIdentityCatalogue(
  species: CatalogueSpecies[] = catalogueSpecies(),
  policy: IdentityPolicy = IDENTITY_POLICY,
): SpeciesIdentityCatalogue {
  const lexicon = buildLexicon(species, policy);
  return {
    species,
    lexicon,
    identities: new Map(species.map((entry) => [entry.speciesId, buildIdentity(entry, lexicon, policy)])),
  };
}
