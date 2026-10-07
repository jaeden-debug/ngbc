import type { SourceRecord } from "../content-contract/types.ts";
import { capabilitiesOf } from "../content/species-eligibility.ts";
import { TAKE_HEADINGS, TAKE_LEADS } from "../content/species-take-words.ts";
import { AUTHORITY_SECTION_IDS } from "./types.ts";
import type {
  AuthorityClaim, AuthoritySection, AuthoritySectionId, AuthoritySource, SpeciesAuthorityPage,
} from "./types.ts";

/**
 * A species authority page built from the structured profile a species already
 * has — not from a hand-authored file, and not from anything invented.
 *
 * WHY AN ADAPTER AND NOT 485 FILES. The catalogue holds 485 published species
 * and exactly one authored authority page. Every other species already carries
 * the same facts in `speciesProfile`, cited, and renders them through a second
 * template. Measured across all 485: `quickAnswer`, `keyFacts` and
 * `rangeSummary` are populated 485/485, `behavior` 483, `habitat` 481 and
 * `identification` 479. Those are real sourced sentences; this turns them into
 * the one contract every surface reads.
 *
 * WHAT IT WILL NOT DO. It emits a section only where that species has content
 * for it, so the page is SHORTER for a thinly-researched animal rather than
 * padded. The sparse fields are sparse for a reason and the numbers say so:
 * `seasonalBehavior` 10 of 485, `sexAgeInfo` 6, `conservationStatus` 37 and
 * `signsAndTracks` 1 — the last being white-tailed deer alone, which is why it
 * is the only species that can carry a Tracks & Sign explorer. Rendering those
 * sections catalogue-wide would mean 484 empty frames presented as research.
 *
 * `diet` is deliberately absent: it is populated for 0 of 485 species,
 * including the deer's own profile, whose diet content is hand-authored. There
 * is nothing to adapt and inventing it is the §61 failure.
 *
 * Hunting, shot placement and equipment are never emitted here. They need
 * guidance no profile holds, and the validator gates them on eligibility
 * besides.
 */

/** Profile prose as it is stored: a sentence and the sources that support it. */
export interface ProfileClaim { text: string; sourceIds: readonly string[] }

export interface AdapterInput {
  speciesId: string;
  slug: string;
  commonName: string;
  scientificName: string;
  quickAnswer: string;
  takeEligibility: SpeciesAuthorityPage["huntingCompatibility"];
  reviewedAt: string;
  keyFacts: ReadonlyArray<{ label: string; value: string; sourceIds?: readonly string[] }>;
  identification?: ReadonlyArray<ProfileClaim>;
  habitat?: ReadonlyArray<ProfileClaim>;
  behavior?: ReadonlyArray<ProfileClaim>;
  seasonalBehavior?: ReadonlyArray<ProfileClaim>;
  signsAndTracks?: ReadonlyArray<ProfileClaim>;
  rangeSummary?: string;
  /**
   * The authority's own conservation statements, kept as recorded: §16 requires
   * a listed subspecies or population to be named as the authority names it,
   * so the statement text is used verbatim rather than summarised.
   */
  conservationStatus?: ReadonlyArray<{ status?: string; text: string; sourceIds?: readonly string[] }>;
  sources: readonly SourceRecord[];
}

const SOURCE_KIND: Record<string, AuthoritySource["kind"]> = {
  scientific: "BIOLOGICAL",
  government: "REGULATORY_AUTHORITY",
  reference: "BIOLOGICAL",
};

function claimsFrom(prefix: string, items: ReadonlyArray<ProfileClaim> | undefined): AuthorityClaim[] {
  return (items ?? [])
    .filter((item) => item.text?.trim() && item.sourceIds?.length)
    .map((item, index) => ({
      id: `${prefix}-${index + 1}`,
      text: item.text.trim(),
      citations: item.sourceIds.map((sourceId) => ({ sourceId })),
    }));
}

/**
 * One prose section, or nothing.
 *
 * The lead sentence is the species' own first sourced statement, never a
 * summary written here — and it stays in `claims` as well, so it keeps its
 * citation. A section with no sourced content returns null and is simply not
 * rendered, which is the difference between a short page and a padded one.
 */
function sectionFrom(
  id: AuthoritySectionId,
  title: string,
  shortTitle: string,
  layer: AuthoritySection["layer"],
  claims: AuthorityClaim[],
): AuthoritySection | null {
  if (!claims.length) return null;
  return { id, title, shortTitle, layer, directAnswer: claims[0].text, claims };
}

export function adaptSpeciesAuthorityPage(input: AdapterInput): SpeciesAuthorityPage | null {
  const capabilities = capabilitiesOf(input.takeEligibility);
  const sections: AuthoritySection[] = [];

  /*
   * AN OVERVIEW SECTION ONLY WHERE IT ADDS SOMETHING.
   *
   * The hero already carries the quick answer — that is §25's direct answer,
   * and it is what §29 reads out of the server HTML. This section repeated it
   * as its own direct answer and then quoted the species' first identification
   * sentence beneath it, which for 475 of 485 species is a substring of that
   * same quick answer: the same words three times in a row, which §41A calls
   * redundant and deletes rather than calls thoroughness.
   *
   * Nothing is lost by omitting it. Every identification sentence, the first
   * included, is carried by the identification section, which leads with it as
   * its own direct answer.
   */
  const quickAnswer = input.quickAnswer.replace(/\s+/g, " ").trim();
  const overviewClaims = claimsFrom("overview", input.identification?.slice(0, 1))
    .filter((claim) => !quickAnswer.includes(claim.text.replace(/\s+/g, " ").trim()));
  if (overviewClaims.length) {
    sections.push({
      id: "overview",
      title: `${input.commonName} at a glance`,
      shortTitle: "Overview",
      layer: "BIOLOGY",
      directAnswer: quickAnswer,
      claims: overviewClaims,
    });
  }

  for (const candidate of [
    sectionFrom("identification", "How to identify it", "Identification", "BIOLOGY", claimsFrom("identification", input.identification)),
    sectionFrom("habitat", "Where it lives", "Habitat", "FIELD_KNOWLEDGE", claimsFrom("habitat", input.habitat)),
    sectionFrom("behaviour", "How it behaves", "Behaviour", "FIELD_KNOWLEDGE", claimsFrom("behaviour", input.behavior)),
    sectionFrom("seasonal-pattern", "What changes by season", "Seasonal", "FIELD_KNOWLEDGE", claimsFrom("seasonal", input.seasonalBehavior)),
    sectionFrom("tracks-and-sign", "Tracks and sign", "Sign", "FIELD_KNOWLEDGE", claimsFrom("sign", input.signsAndTracks)),
  ]) if (candidate) sections.push(candidate);

  /* Range is prose on the profile and carries no per-sentence sources, so it is
     the section's direct answer with no claim beneath it rather than an
     assertion dressed as a cited one. */
  if (input.rangeSummary?.trim()) {
    sections.push({
      id: "range-and-map",
      title: "Where it is found",
      shortTitle: "Range",
      layer: "GEOSPATIAL_INTELLIGENCE",
      directAnswer: input.rangeSummary.trim(),
      claims: [],
    });
  }

  /* The regulatory handoff is always present: a species page that says nothing
     about whether it may be taken is the gap §16 exists to close. */
  sections.push({
    id: "regulations",
    title: TAKE_HEADINGS[input.takeEligibility],
    shortTitle: "Rules",
    layer: "REGULATORY_HANDOFF",
    directAnswer: TAKE_LEADS[input.takeEligibility],
    claims: [],
    /*
     * Conservation statements are CARRIED, not built here.
     *
     * They are facts about the species rather than page content, so they live
     * in the context (`context.ts`) and reach the authored page and the 484
     * adapted ones through one path. Building them here showed them on the
     * adapted pages only — white-tailed deer's own two statements appeared on
     * neither renderer.
     */
  });

  const facts = input.keyFacts
    .filter((fact) => fact.label?.trim() && fact.value?.trim() && fact.sourceIds?.length)
    .map((fact) => ({ label: fact.label, value: fact.value, sourceIds: [...(fact.sourceIds ?? [])] }));

  /* Only sources something actually cites. A listed source nothing refers to is
     an orphan, and padding the list would make a page look better sourced than
     it is. */
  const cited = new Set<string>([
    ...sections.flatMap((section) => section.claims.flatMap((claim) => claim.citations.map(({ sourceId }) => sourceId))),
    /* Subsection claims cite too. Omitting them left a citation pointing at a
       source the page did not list — a dead anchor, and the validator's own
       orphan rule read from the wrong side. */
    ...sections.flatMap((section) => (section.subsections ?? []).flatMap((sub) => sub.claims.flatMap((claim) => claim.citations.map(({ sourceId }) => sourceId)))),
    ...facts.flatMap((fact) => fact.sourceIds),
  ]);
  const sources: AuthoritySource[] = input.sources
    .filter((record) => cited.has(record.id))
    .filter((record) => { try { return new URL(record.url).protocol === "https:"; } catch { return false; } })
    .map((record) => ({
      id: record.id,
      title: record.title,
      publisher: record.publisher ?? record.authority ?? "",
      url: record.url,
      kind: SOURCE_KIND[record.type] ?? "BIOLOGICAL",
      reviewedAt: String(record.retrievedAt).slice(0, 10),
      note: record.authority ?? record.publisher ?? "",
    }));

  /* A source the page cites but cannot list is a citation to nothing, so those
     citations are dropped rather than left dangling. */
  const listed = new Set(sources.map(({ id }) => id));
  for (const section of sections) {
    section.claims = section.claims
      .map((claim) => ({ ...claim, citations: claim.citations.filter(({ sourceId }) => listed.has(sourceId)) }))
      .filter((claim) => claim.citations.length);
  }
  const keptFacts = facts
    .map((fact) => ({ ...fact, sourceIds: fact.sourceIds.filter((id) => listed.has(id)) }))
    .filter((fact) => fact.sourceIds.length);

  /*
   * THE LEAD SENTENCE BECOMES THE ANSWER, after the citation cleanup above and
   * not before it.
   *
   * It was being split out in `sectionFrom`, which ran first — so a section
   * with a single identification sentence ended up with an empty `claims` list
   * and was then deleted by the emptiness filter below as if it had nothing in
   * it. Measured: 8 lookalike lists disappeared, because they hang off the
   * identification section, and beaver, elk, snowshoe hare and pronghorn each
   * have exactly one identification sentence.
   */
  for (const section of sections) {
    if (section.claims.length && section.claims[0].text === section.directAnswer) {
      section.directAnswerCitations = section.claims[0].citations;
      section.claims = section.claims.slice(1);
    }
  }

  /* Dropping uncitable claims can empty a section; an empty one is removed
     rather than rendered as a heading with nothing under it. A section whose
     only sourced sentence is now its direct answer is NOT empty. */
  const kept = sections.filter((section) =>
    section.claims.length > 0 || (section.directAnswerCitations?.length ?? 0) > 0
    || section.id === "overview" || section.id === "range-and-map" || section.id === "regulations");

  if (!sources.length) return null;

  /* Sorted into the contract's canonical reading order rather than the order
     this function happens to build them in. Measured: emitting them in build
     order failed 448 of 485 pages, because the canonical order puts sign before
     season and rules before range, and the adapter built the opposite. */
  kept.sort((a, b) => AUTHORITY_SECTION_IDS.indexOf(a.id) - AUTHORITY_SECTION_IDS.indexOf(b.id));
  const sectionOrder = kept.map(({ id }) => id);
  sectionOrder.push("sources");
  kept.push({
    id: "sources",
    title: "Sources",
    shortTitle: "Sources",
    layer: "BIOLOGY",
    directAnswer: "Every claim above is attributed to one of these published sources.",
    claims: [],
  });

  return {
    schemaVersion: "1.0.0",
    speciesId: input.speciesId as `species:${string}`,
    slug: input.slug,
    canonicalPath: `/hunting/species/${input.slug}`,
    status: "PUBLISHED",
    huntingCompatibility: input.takeEligibility,
    reviewedAt: input.reviewedAt,
    identity: {
      commonName: input.commonName,
      scientificName: input.scientificName,
      family: "",
      directAnswer: input.quickAnswer.trim(),
    },
    facts: keptFacts,
    sectionOrder,
    sections: kept,
    faq: [],
    sources,
    speciesReferences: [],
    /* Capability, never class name: the allowlist in species-eligibility.ts is
       the owner-sanctioned decision and this reads it rather than restating
       it. §41B gives heat to HUNTABLE and NUISANCE_OR_INVASIVE_TAKE alone. */
    huntLinks: {
      legality: capabilities.offeredInHunt ? `/hunt?species=${input.slug}` as const : "/hunt" as const,
      ...(capabilities.speciesHeat ? { map: `/hunt?species=${input.slug}&explore=1` as const } : {}),
    },
    visualAssets: [],
  };
}

export { capabilitiesOf };

/**
 * The adapter input a published species resource implies.
 *
 * ONE mapping, because there were about to be two: the catalogue-wide test
 * built this by hand and the route was going to build it again. A field read
 * in one place and forgotten in the other is exactly the drift that put the
 * take-eligibility wording in two files, and it would have meant the page CI
 * certifies is not the page production serves.
 *
 * `reviewedAt` is supplied by the caller rather than invented here: it is the
 * date the PAGE was reviewed, and only the caller knows it.
 */
export function adapterInputFor(
  resource: {
    slug: string;
    title: string;
    quickAnswer?: string;
    keyFacts?: ReadonlyArray<{ label: string; value: string; sourceIds?: readonly string[] }>;
    speciesProfile: {
      speciesId: string;
      scientificName?: string;
      takeEligibility: SpeciesAuthorityPage["huntingCompatibility"];
      identification?: ReadonlyArray<ProfileClaim>;
      habitat?: ReadonlyArray<ProfileClaim>;
      behavior?: ReadonlyArray<ProfileClaim>;
      seasonalBehavior?: ReadonlyArray<ProfileClaim>;
      signsAndTracks?: ReadonlyArray<ProfileClaim>;
      rangeSummary?: ReadonlyArray<{ value: string }>;
      conservationStatus?: ReadonlyArray<{ status?: string; text: string; sourceIds?: readonly string[] }>;
    };
  },
  sources: readonly SourceRecord[],
  reviewedAt: string,
): AdapterInput {
  const profile = resource.speciesProfile;
  return {
    speciesId: profile.speciesId, slug: resource.slug, commonName: resource.title,
    scientificName: profile.scientificName ?? "", quickAnswer: resource.quickAnswer ?? "",
    takeEligibility: profile.takeEligibility, reviewedAt,
    keyFacts: resource.keyFacts ?? [], identification: profile.identification,
    habitat: profile.habitat, behavior: profile.behavior,
    seasonalBehavior: profile.seasonalBehavior, signsAndTracks: profile.signsAndTracks,
    rangeSummary: profile.rangeSummary?.[0]?.value, conservationStatus: profile.conservationStatus,
    sources,
  };
}

/** The source ids the adapted page will cite, so the caller can fetch them. */
export function adapterSourceIds(resource: {
  keyFacts?: ReadonlyArray<{ sourceIds?: readonly string[] }>;
  speciesProfile: {
    identification?: ReadonlyArray<ProfileClaim>; habitat?: ReadonlyArray<ProfileClaim>;
    behavior?: ReadonlyArray<ProfileClaim>; seasonalBehavior?: ReadonlyArray<ProfileClaim>;
    signsAndTracks?: ReadonlyArray<ProfileClaim>;
    conservationStatus?: ReadonlyArray<{ sourceIds?: readonly string[] }>;
  };
}): string[] {
  const profile = resource.speciesProfile;
  return [...new Set<string>([
    ...(profile.identification ?? []).flatMap((claim) => claim.sourceIds ?? []),
    ...(profile.habitat ?? []).flatMap((claim) => claim.sourceIds ?? []),
    ...(profile.behavior ?? []).flatMap((claim) => claim.sourceIds ?? []),
    ...(profile.seasonalBehavior ?? []).flatMap((claim) => claim.sourceIds ?? []),
    ...(profile.signsAndTracks ?? []).flatMap((claim) => claim.sourceIds ?? []),
    ...(profile.conservationStatus ?? []).flatMap((statement) => statement.sourceIds ?? []),
    ...(resource.keyFacts ?? []).flatMap((fact) => fact.sourceIds ?? []),
  ])];
}
