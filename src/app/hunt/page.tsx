import type { Metadata } from "next";
import Link from "next/link";
import HuntComposer from "../../components/hunt/HuntComposer";
import HuntNav from "../../components/hunt/HuntNav";
import styles from "../../components/hunt/Hunt.module.css";
import { COVERAGE_SUMMARY } from "../../lib/hunt/coverage";
import { isSupportedSpecies, type SpeciesSelectorOption, type SupportedSpeciesId } from "../../lib/hunt/coverage";
import { contentRepository } from "../../lib/content/repository";
import { COVERAGE_ROADMAP } from "../../lib/hunt/zone-layers";
import { HUNT_DEFAULT_TIME_ZONE, jurisdictionTodayIso } from "../../lib/hunt/date";
import { canadaCoverageReport, regulatoryJurisdictionsForSpecies } from "../../lib/hunt/canada/report";
import { absoluteUrl, SITE_NAME } from "../../lib/site";

export const dynamic = "force-dynamic";

const canonicalPath = "/hunt";
const metaTitle = "Hunting Zone & Season Finder | North Ground Hunt";
const metaDescription =
  "Find your hunting area, check current seasons and rules, and read the official source behind every answer. Free, no account.";
const socialTitle = "North Ground Hunt | Your Zone. Your Season. Your Hunt.";
const socialDescription =
  "Find hunting zones, check current seasons and rules, verify official sources, and share your Hunt Brief with friends.";
const socialImage = absoluteUrl("/north-ground-hunt-zones-seasons-share-results.jpg");
const socialImageAlt =
  "North Ground Hunt social preview showing hunting zones, current seasons, official sources and Hunt Brief sharing.";

export const metadata: Metadata = {
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

/**
 * Trust indicators state what the product actually does.
 *
 * "Current & verified" would overstate a deliberately narrow certified dataset, so
 * the wording is precise about what is verified and what is not.
 */
const TRUST_POINTS = [
  {
    title: "Official sources",
    detail: "Every answer cites one",
    icon: (
      <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true" fill="none">
        <path d="M9 1.6 2.6 4.1v5.1c0 3.7 2.7 6.4 6.4 7.2 3.7-.8 6.4-3.5 6.4-7.2V4.1L9 1.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="m6.4 9 1.9 1.9 3.5-3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Official boundaries",
    detail: "Drawn from the authority's own GIS",
    icon: (
      <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true" fill="none">
        <path d="M6.8 2.2 2.2 4.1v11.7l4.6-1.9 4.4 1.9 4.6-1.9V2.2l-4.6 1.9-4.4-1.9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M6.8 2.2v11.7M11.2 4.1v11.7" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    title: "Source-dated",
    detail: "You see when it was checked",
    icon: (
      <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true" fill="none">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3" />
        <path d="M9 4.8V9l2.8 1.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

type Props = { searchParams: Promise<{ species?: string | string[] }> };

export default async function HuntPage({ searchParams }: Props) {
  const requestedSpecies = (await searchParams).species;
  const initialSpeciesId: SupportedSpeciesId | null = typeof requestedSpecies === "string" && isSupportedSpecies(requestedSpecies)
    ? requestedSpecies
    : null;
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  const coverageReport = canadaCoverageReport();
  const speciesOptions: SpeciesSelectorOption[] = await Promise.all(resources
    .filter((resource) => resource.type === "species")
    .map(async (resource) => {
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
        /* Where rules exist, and whether each jurisdiction answers straight away or
           asks a question first. Both are fully certified; the difference is how
           that authority publishes the species, and saying so up front stops the
           question arriving as a surprise. */
        regulatoryJurisdictions: regulatoryJurisdictionsForSpecies(
          resource.speciesProfile.speciesId,
          coverageReport,
        ).map(({ id, nameEn, requiresInput }) => ({ id, name: nameEn, asksQuestion: requiresInput })),
      };
    }));
  return (
    <main className={styles.page}>
      <HuntNav />

      <HuntComposer
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
        speciesOptions={speciesOptions}
        initialSpeciesId={initialSpeciesId}
        /* The server cannot know the viewer's time zone, so it renders the
           jurisdiction's day. The composer corrects it on mount. */
        initialDate={jurisdictionTodayIso(HUNT_DEFAULT_TIME_ZONE)}
      />

      <section className={styles.trustStrip} aria-label="How North Ground answers">
        <ul className={styles.trustRow}>
          {TRUST_POINTS.map((point) => (
            <li className={`${styles.trustItem} ng-glass-card`} key={point.title}>
              <span className={styles.trustIcon} aria-hidden="true">{point.icon}</span>
              <span className={styles.trustText}>
                <span className={styles.trustTitle}>{point.title}</span>
                <span className={styles.trustDetail}>{point.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.trustNote}>{COVERAGE_ROADMAP.summary}</p>
      </section>

      <footer className={styles.footer}>
        <p>
          {COVERAGE_SUMMARY} North Ground organises official information and does not
          replace the legislation, regulations or instructions of the responsible
          authority. Regulations change — confirm current requirements before you hunt.
        </p>
        <p>
          <Link href="/hunting/species">Species library</Link>
          {" · "}
          <Link href="/">North Ground</Link>
        </p>
      </footer>
    </main>
  );
}
