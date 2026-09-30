import type { MetadataRoute } from "next";
import { contentRepository } from "../lib/content/repository";
import { getSpeciesPrimaryMediaMap } from "../lib/species-media/repository";
import { absoluteUrl } from "../lib/site";

/* Image entries are live PRIMARY media; an hourly regeneration keeps a
   replaced photo from lingering until the next deploy. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  /* Each species URL carries its verified PRIMARY photo, so the image is
     discoverable with the page it belongs to. No photo, no image entry. */
  const media = await getSpeciesPrimaryMediaMap(resources.flatMap((resource) =>
    resource.type === "species" ? [resource.speciesProfile.speciesId] : []));
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
