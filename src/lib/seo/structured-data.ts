import {
  absoluteUrl,
  CONTACT_EMAIL,
  SITE_ALTERNATE_NAME,
  SITE_LANGUAGE,
  SITE_NAME,
} from "../site.ts";
import type { SpeciesResource } from "../content-contract/types.ts";

export type JsonLd = Record<string, unknown>;

const ORGANIZATION_ID = absoluteUrl("/#organization");
const WEBSITE_ID = absoluteUrl("/#website");

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAME,
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo-mark.webp"),
    },
    email: CONTACT_EMAIL,
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAME,
    url: absoluteUrl("/"),
    inLanguage: SITE_LANGUAGE,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]): JsonLd {
  if (items.length < 2) {
    throw new Error("BreadcrumbList requires at least two real navigation levels");
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function speciesArticleJsonLd(resource: SpeciesResource, url: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: resource.title,
    description: resource.description,
    url,
    inLanguage: resource.locale,
    datePublished: resource.publishedAt,
    dateModified: resource.updatedAt,
    mainEntity: {
      "@type": "Taxon",
      name: resource.title,
      scientificName: resource.speciesProfile.scientificName,
    },
    publisher: { "@id": ORGANIZATION_ID },
  };
}
