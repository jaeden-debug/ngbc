import type { MetadataRoute } from "next";
import { contentRepository } from "../lib/content/repository";
import { absoluteUrl } from "../lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "monthly",
      priority: 1,
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
    }] : []),
  ];
}
