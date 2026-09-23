import type { ZoneLayer } from "../hunt/zone-layers.ts";
import { absoluteUrl, SITE_LANGUAGE } from "../site.ts";
import type { JsonLd } from "./structured-data.ts";

type CoverageLayer = Pick<ZoneLayer, "jurisdictionId" | "jurisdictionName" | "country" | "serving" | "rulesServing">;

const COUNTRY_NAMES = { CA: "Canada", US: "United States" } as const;

/**
 * Where Hunt ANSWERS: jurisdictions with a served layer whose certified rules
 * answer. Drawing a jurisdiction's boundaries is not answering its rules
 * (CLAUDE.md §41A, "Selectable is not answerable"), so a boundaries-only
 * jurisdiction is not claimed here — a machine repeats this list as coverage.
 */
export function huntAnsweringJurisdictions(layers: readonly CoverageLayer[]): Array<{ id: string; name: string; country: "CA" | "US" }> {
  const byId = new Map<string, { id: string; name: string; country: "CA" | "US" }>();
  for (const layer of layers) {
    if (!layer.serving || layer.rulesServing !== true) continue;
    byId.set(layer.jurisdictionId, { id: layer.jurisdictionId, name: layer.jurisdictionName, country: layer.country });
  }
  return [...byId.values()].sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
}

/**
 * North Ground Hunt as a web application. Built at call time from the layer
 * registry, so coverage can never be typed by hand. Hunt owns the page and its
 * copy; the caller passes its own description and the registry it serves from.
 */
export function huntWebApplicationJsonLd(input: { description: string; layers: readonly CoverageLayer[] }): JsonLd {
  const url = absoluteUrl("/hunt");
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${url}#app`,
    name: "North Ground Hunt",
    url,
    description: input.description,
    applicationCategory: "ReferenceApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript for the interactive map.",
    inLanguage: SITE_LANGUAGE,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
    areaServed: huntAnsweringJurisdictions(input.layers).map((jurisdiction) => ({
      "@type": "AdministrativeArea",
      name: jurisdiction.name,
      containedInPlace: { "@type": "Country", name: COUNTRY_NAMES[jurisdiction.country] },
    })),
    publisher: { "@id": absoluteUrl("/#organization") },
    isPartOf: { "@id": absoluteUrl("/#website") },
  };
}
