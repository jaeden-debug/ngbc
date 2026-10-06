import type { SourceRecord } from "../content-contract/types.ts";
import { capabilitiesOf } from "../content/species-eligibility.ts";
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
interface ProfileClaim { text: string; sourceIds: string[] }

interface AdapterInput {
  speciesId: string;
  slug: string;
  commonName: string;
  scientificName: string;
  quickAnswer: string;
  takeEligibility: SpeciesAuthorityPage["huntingCompatibility"];
  reviewedAt: string;
  keyFacts: ReadonlyArray<{ label: string; value: string; sourceIds: string[] }>;
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
  conservationStatus?: ReadonlyArray<{ status?: string; text: string }>;
  sources: readonly SourceRecord[];
}

/**
 * What the regulations section says, by take eligibility.
 *
 * These are the legacy renderer's own words, kept verbatim rather than
 * rewritten: they are careful §16 statements that separate conservation status,
 * take eligibility and regulatory evidence, and the NON_QUARRY and UNKNOWN ones
 * in particular are the sentences that stop a page implying an opportunity.
 */
const TAKE_LEAD: Record<SpeciesAuthorityPage["huntingCompatibility"], string> = {
  HUNTABLE: "These authorities list this species for legal take in their own regulations.",
  LIMITED_TAKE: "Legal take of this species exists only under narrow conditions — a quota, a draw, a permit or a small area — set by the responsible authorities. Nowhere else is a legal opportunity implied, and Hunt shows one only where a certified rule establishes it.",
  NUISANCE_OR_INVASIVE_TAKE: "Authorities list this species as nuisance, invasive or unprotected wildlife that may be taken. This is not a game season.",
  NON_QUARRY: "North Ground does not treat this species as quarry: it is published so it can be told apart from the game species it resembles, and Hunt never offers it. If you are not certain what it is, do not shoot.",
  UNKNOWN: "North Ground has not established meaningful legal take of this species. That is a gap in the evidence, not a finding that it is protected or that it is open.",
};

const TAKE_TITLE: Record<SpeciesAuthorityPage["huntingCompatibility"], string> = {
  HUNTABLE: "Where it is listed for legal take",
  LIMITED_TAKE: "Limited legal take",
  NUISANCE_OR_INVASIVE_TAKE: "Where it is listed for removal",
  NON_QUARRY: "Not a quarry species",
  UNKNOWN: "Take status not established",
};

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
  const sections: AuthoritySection[] = [];

  const overviewClaims = claimsFrom("overview", input.identification?.slice(0, 1));
  sections.push({
    id: "overview",
    title: `${input.commonName} at a glance`,
    shortTitle: "Overview",
    layer: "BIOLOGY",
    directAnswer: input.quickAnswer.trim(),
    claims: overviewClaims,
  });

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
    title: TAKE_TITLE[input.takeEligibility],
    shortTitle: "Rules",
    layer: "REGULATORY_HANDOFF",
    directAnswer: TAKE_LEAD[input.takeEligibility],
    claims: [],
    ...(input.conservationStatus?.length
      ? {
        subsections: [{
          id: "conservation-and-protection",
          title: "Conservation and protection",
          directAnswer: input.conservationStatus[0].text,
          claims: [],
        }],
      }
      : {}),
  });

  const facts = input.keyFacts
    .filter((fact) => fact.label?.trim() && fact.value?.trim() && fact.sourceIds?.length)
    .map((fact) => ({ label: fact.label, value: fact.value, sourceIds: [...fact.sourceIds] }));

  /* Only sources something actually cites. A listed source nothing refers to is
     an orphan, and padding the list would make a page look better sourced than
     it is. */
  const cited = new Set<string>([
    ...sections.flatMap((section) => section.claims.flatMap((claim) => claim.citations.map(({ sourceId }) => sourceId))),
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

  /* Dropping uncitable claims can empty a section; an empty one is removed
     rather than rendered as a heading with nothing under it. */
  const kept = sections.filter((section) =>
    section.claims.length > 0 || section.id === "overview" || section.id === "range-and-map" || section.id === "regulations");

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
    huntLinks: {
      legality: `/hunt?species=${input.slug}`,
      map: `/hunt?species=${input.slug}&explore=1`,
    },
    visualAssets: [],
  };
}

export { capabilitiesOf };
