import {
  absoluteUrl,
  CONTACT_EMAIL,
  SITE_ALTERNATE_NAME,
  SITE_DESCRIPTION,
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
    description: SITE_DESCRIPTION,
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

export interface SpeciesPageSignals {
  /** The page's own meta description, so the entity says what the page says. */
  description: string;
  /** Absolute URL of the verified PRIMARY photo, when one exists. */
  imageUrl?: string | null;
}

/**
 * The biological entity, from verified taxonomy only. Genus and family appear
 * as parent taxa where the profile records them; nothing is inferred.
 */
function taxonJsonLd(resource: SpeciesResource, url: string): JsonLd {
  const profile = resource.speciesProfile;
  const alternateNames = [...new Set([
    ...profile.commonNames.map(({ value }) => value),
    /* Common and official names only: a misspelling or legacy id is not a name. */
    ...(profile.aliases ?? [])
      .filter((alias) => (alias.type === "common_name" || alias.type === "official_name") && alias.verificationStatus === "verified")
      .map((alias) => alias.value),
  ])].filter((name) => name.toLowerCase() !== resource.title.toLowerCase());
  const family = profile.taxonomy.family
    ? { "@type": "Taxon", name: profile.taxonomy.family, taxonRank: "family" }
    : undefined;
  return {
    "@type": "Taxon",
    "@id": `${url}#taxon`,
    name: resource.title,
    scientificName: profile.scientificName,
    taxonRank: "species",
    ...(alternateNames.length ? { alternateName: alternateNames } : {}),
    parentTaxon: {
      "@type": "Taxon",
      name: profile.taxonomy.genus,
      taxonRank: "genus",
      ...(family ? { parentTaxon: family } : {}),
    },
  };
}

export function speciesArticleJsonLd(resource: SpeciesResource, url: string, signals: SpeciesPageSignals): JsonLd {
  const taxon = taxonJsonLd(resource, url);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: resource.title,
    description: signals.description,
    url,
    mainEntityOfPage: url,
    inLanguage: resource.locale,
    datePublished: resource.publishedAt,
    dateModified: resource.updatedAt,
    ...(signals.imageUrl ? { image: signals.imageUrl } : {}),
    about: { "@id": taxon["@id"] },
    mainEntity: taxon,
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
  };
}

export interface CollectionItem {
  name: string;
  path: string;
}

/** A library page and the entities it lists, in the order it lists them. */
export function collectionPageJsonLd(input: {
  path: string;
  name: string;
  description: string;
  items: readonly CollectionItem[];
}): JsonLd {
  const url = absoluteUrl(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#page`,
    url,
    name: input.name,
    description: input.description,
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.items.length,
      itemListElement: input.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    },
  };
}
