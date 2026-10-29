import type { MetadataRoute } from "next";
import { contentRepository } from "../lib/content/repository";
import { getSpeciesPrimaryMediaMap } from "../lib/species-media/repository";
import { absoluteUrl } from "../lib/site";
import { seasonRegionBySlug, seasonRegions } from "../lib/hunt/season-pages/regions";
import { regionToday, seasonPageParams } from "../lib/hunt/season-pages/seasons";

/* Image entries are live PRIMARY media; an hourly regeneration keeps a
   replaced photo from lingering until the next deploy. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  /* Each species URL carries its verified PRIMARY photo, so the image is
     discoverable with the page it belongs to. No photo, no image entry. */
  const media = await getSpeciesPrimaryMediaMap(resources.flatMap((resource) =>
    resource.type === "species" ? [resource.speciesProfile.speciesId] : []));
  /* Season pages describe one calendar day, so they change daily: their
     lastModified is the province's own today, which is the day they state. */
  const seasonPairs = await seasonPageParams();
  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: absoluteUrl("/hunting"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/hunting/species"),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/hunting/how-north-ground-verifies"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...seasonRegions().map((region) => ({
      url: absoluteUrl(`/hunting/${region.slug}`),
      lastModified: regionToday(region),
      changeFrequency: "daily" as const,
      priority: 0.85,
    })),
    ...seasonPairs.map((pair) => ({
      url: absoluteUrl(`/hunting/${pair.region}/${pair.species}`),
      lastModified: regionToday(seasonRegionBySlug(pair.region)!),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...resources.flatMap((resource) => resource.canonicalUrl ? [{
      url: absoluteUrl(resource.canonicalUrl),
      lastModified: resource.updatedAt,
      changeFrequency: resource.type === "tool" ? "weekly" as const : "monthly" as const,
      priority: resource.type === "tool" ? 0.9 : 0.8,
      // Only photographs served from our own host; a provider's image is its host's to list.
      ...(resource.type === "species" && media.get(resource.speciesProfile.speciesId)?.source === "MANUAL"
        ? { images: [absoluteUrl(media.get(resource.speciesProfile.speciesId)!.renditions.profile.url)] }
        : {}),
    }] : []),
  ];
}
