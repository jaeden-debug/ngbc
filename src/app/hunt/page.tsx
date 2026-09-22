import type { Metadata, Viewport } from "next";
import HuntAbout from "../../components/hunt/HuntAbout";
import HuntApp from "../../components/hunt/HuntApp";
import type { CanonicalId } from "../../lib/content-contract";
import { contentRepository } from "../../lib/content/repository";
import type { SpeciesSelectorOption } from "../../lib/hunt/coverage";
import { northAmericaCoverageReport, regulatoryJurisdictionsForSpecies } from "../../lib/hunt/north-america/report";
import { HUNT_DEFAULT_TIME_ZONE, jurisdictionTodayIso } from "../../lib/hunt/date";
import { longDayLabel } from "../../lib/hunt/exploration/date-presets";
import { huntDeepLink, parseHuntUrlState, type HuntUrlValidators } from "../../lib/hunt/exploration/url-state";
import { ZONE_LAYERS } from "../../lib/hunt/zone-layers";
import { presentZoneById } from "../../lib/hunt/zone-presentation";
import { absoluteUrl, SITE_NAME } from "../../lib/site";
import { getSpeciesPrimaryMediaMap } from "../../lib/species-media/repository";

export const dynamic = "force-dynamic";

const canonicalPath = "/hunt";
const metaTitle = "Hunting Zone & Season Finder | North Ground Hunt";
const metaDescription =
  "Find your hunting zone on the map, check current seasons and rules, and read the official source behind every answer. Free, no account.";
const socialTitle = "North Ground Hunt | Your Zone. Your Season. Your Hunt.";
const socialDescription =
  "Find hunting zones, check current seasons and rules, verify official sources, and share your hunt with friends.";
const socialImage = absoluteUrl("/north-ground-hunt-zones-seasons-share-results.jpg");
const socialImageAlt =
  "North Ground Hunt social preview showing hunting zones, current seasons, official sources and Hunt Brief sharing.";

/* The app fills the screen edge to edge, under the notch and the home indicator, and lays itself out inside the safe areas. */
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0b0d0c",
  viewportFit: "cover",
};

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SearchParams> };

const SERVED = ZONE_LAYERS.filter((layer) => layer.serving);

async function publishedSpeciesIds(): Promise<Set<string>> {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  return new Set(resources.filter((resource) => resource.type === "species").map((resource) => resource.speciesProfile.speciesId));
}

function validators(published: Set<string>): HuntUrlValidators {
  return {
    isServedZoneId: (id) => SERVED.some((layer) => id.startsWith(layer.zoneIdPrefix)),
    isPublishedSpecies: (id) => published.has(id),
  };
}

/**
 * A shared hunt previews as itself — "White-tailed deer · WMU 8 · September 22,
 * 2026" — while the canonical page stays /hunt: query states are views of one
 * tool, not pages of their own.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { state } = parseHuntUrlState(await searchParams, validators(await publishedSpeciesIds()));
  const base: Metadata = {
    title: { absolute: metaTitle },
    description: metaDescription,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      locale: "en_CA",
      url: absoluteUrl(canonicalPath),
      siteName: SITE_NAME,
      title: socialTitle,
      description: socialDescription,
      images: [{ url: socialImage, width: 1536, height: 803, alt: socialImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
      images: [{ url: socialImage, alt: socialImageAlt }],
    },
  };
  if (!state.zoneId) return base;

  const zone = presentZoneById(state.zoneId);
  const jurisdiction = SERVED.find((layer) => state.zoneId!.startsWith(layer.zoneIdPrefix))?.jurisdictionName;
  const species = state.speciesId
    ? (await contentRepository.getPublishedResources({ locale: "en-CA" }))
      .find((resource) => resource.type === "species" && resource.speciesProfile.speciesId === state.speciesId)?.title
    : undefined;
  const title = [species, `${zone.fullLabel}${jurisdiction ? ` (${jurisdiction})` : ""}`, state.date ? longDayLabel(state.date) : null]
    .filter(Boolean).join(" · ");
  const description = species
    ? `${species} in ${zone.fullLabel}: official zone, current rules and sources on North Ground Hunt.`
    : `${zone.fullLabel}${jurisdiction ? `, ${jurisdiction}` : ""}: the official hunting zone and what its certified rules say, on North Ground Hunt.`;
  return {
    ...base,
    title: { absolute: `${title} | North Ground Hunt` },
    description,
    openGraph: { ...base.openGraph, url: absoluteUrl(huntDeepLink(state)), title, description },
    twitter: { ...base.twitter, title, description },
  };
}

export default async function HuntPage({ searchParams }: Props) {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  const speciesResources = resources.filter((resource) => resource.type === "species");
  const published = new Set<string>(speciesResources.map((resource) => resource.speciesProfile.speciesId));
  const { state, rejected } = parseHuntUrlState(await searchParams, validators(published));

  const primaryMedia = await getSpeciesPrimaryMediaMap(speciesResources.map((resource) => resource.speciesProfile.speciesId));
  const coverageReport = northAmericaCoverageReport();
  const speciesOptions: SpeciesSelectorOption[] = await Promise.all(speciesResources.map(async (resource) => {
    const [aliases, groups] = await Promise.all([
      contentRepository.getSpeciesAliases(resource.speciesProfile.speciesId),
      contentRepository.getSpeciesGroups(resource.speciesProfile.speciesId),
    ]);
    const searchTerms = [
      ...resource.speciesProfile.commonNames.map(({ value }) => value),
      ...aliases.map(({ value }) => value),
      ...(resource.speciesProfile.sexAgeInfo?.terminology.map(({ value }) => value) ?? []),
      ...groups.flatMap((group) => [...group.names, ...(group.aliases ?? [])].map(({ value }) => value)),
    ];
    return {
      id: resource.speciesProfile.speciesId,
      displayName: resource.title,
      scientificName: resource.speciesProfile.scientificName,
      category: groups[0]?.names.find(({ locale }) => locale === "en-CA")?.value ?? "Other",
      aliases: aliases.map(({ value }) => value),
      searchTerms: [...new Set(searchTerms)],
      resourcePath: resource.canonicalUrl ?? `/hunting/species/${resource.slug}`,
      image: primaryMedia.get(resource.speciesProfile.speciesId) ?? null,
      /* Where rules exist, and whether each jurisdiction answers straight away or
         asks a question first. Both are fully certified; saying so up front stops
         the question arriving as a surprise. */
      regulatoryJurisdictions: regulatoryJurisdictionsForSpecies(resource.speciesProfile.speciesId, coverageReport)
        .map(({ id, nameEn, requiresInput }) => ({ id, name: nameEn, asksQuestion: requiresInput })),
    };
  }));

  return (
    <main className="hunt-page">
      {/* The page's name for every reader; the map and sheet are its interface. */}
      <h1 className="ng-visually-hidden">Your zone. Your season. Your hunt.</h1>
      <HuntApp
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
        speciesOptions={speciesOptions}
        /* A link's day is kept. Otherwise the server cannot know the viewer's
           time zone, so it renders the jurisdiction's day and the browser
           corrects it to the viewer's own on mount. */
        initialDate={state.date ?? jurisdictionTodayIso(HUNT_DEFAULT_TIME_ZONE)}
        initialUrl={{ ...state, speciesId: state.speciesId as CanonicalId<"species"> | null }}
        linkIssues={rejected.length}
        about={<HuntAbout />}
      />
    </main>
  );
}
