import bundleJson from "../../../content/published/en-CA.json" with { type: "json" };
import speciesWaveJson from "../../../content/published/species-wave-1.json" with { type: "json" };
import speciesWave2aJson from "../../../content/published/species-wave-2a.json" with { type: "json" };
import speciesWave2bJson from "../../../content/published/species-wave-2b.json" with { type: "json" };
import speciesWave2cJson from "../../../content/published/species-wave-2c.json" with { type: "json" };
import speciesWave2dJson from "../../../content/published/species-wave-2d.json" with { type: "json" };

/**
 * The species profile slugs that exist, read from the same published bundles
 * the content repository serves.
 *
 * The profile route is rendered per request (its PRIMARY image is live data),
 * which defeats `dynamicParams = false`: an unknown slug reaches `notFound()`
 * mid-render, and Next 16 then serves a 404 with an empty body. The proxy asks
 * this first and answers a miss before rendering, as it does for Hunt Briefs.
 */
type Bundle = { resources?: Array<{ type?: string; status?: string; slug?: string }> };

const BUNDLES: Bundle[] = [bundleJson, speciesWaveJson, speciesWave2aJson, speciesWave2bJson, speciesWave2cJson, speciesWave2dJson] as Bundle[];

export const PUBLISHED_SPECIES_SLUGS: ReadonlySet<string> = new Set(
  BUNDLES.flatMap((bundle) => bundle.resources ?? [])
    .filter((resource) => resource.type === "species" && resource.status === "published" && typeof resource.slug === "string")
    .map((resource) => resource.slug as string),
);

export function isPublishedSpeciesSlug(slug: string): boolean {
  return PUBLISHED_SPECIES_SLUGS.has(slug);
}
