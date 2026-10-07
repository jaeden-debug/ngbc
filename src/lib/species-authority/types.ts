import type { SpeciesPageContext } from "./context.ts";
export const AUTHORITY_SECTION_IDS = [
  "overview", "identification", "habitat", "diet", "behaviour", "tracks-and-sign",
  "seasonal-pattern", "how-to-hunt", "shot-placement", "equipment", "regulations",
  "range-and-map", "faq", "sources",
] as const;

export type AuthoritySectionId = (typeof AUTHORITY_SECTION_IDS)[number];
export type KnowledgeLayer = "BIOLOGY" | "FIELD_KNOWLEDGE" | "HUNTING_INTELLIGENCE" | "GEOSPATIAL_INTELLIGENCE" | "REGULATORY_HANDOFF";
export type CitationKind = "BIOLOGICAL" | "FIELD_GUIDANCE" | "HUNTING_EDUCATION" | "REGULATORY_AUTHORITY" | "GEOSPATIAL";

export interface AuthorityCitation {
  sourceId: string;
  locator?: string;
}

export interface AuthorityClaim {
  id: string;
  text: string;
  citations: AuthorityCitation[];
}

export interface AuthoritySubsection {
  id: string;
  title: string;
  directAnswer: string;
  claims: AuthorityClaim[];
  caution?: string;
  /**
   * An optional link to the species this subsection compares against. The
   * renderer used to hard-code a link to the Mule deer profile whenever a
   * subsection happened to be called "similar-species", which would have sent
   * every species' lookalike section to the same deer.
   */
  compareLink?: { href: `/hunting/species/${string}`; label: string };
}

export interface AuthoritySection {
  id: AuthoritySectionId;
  title: string;
  shortTitle: string;
  layer: KnowledgeLayer;
  directAnswer: string;
  /**
   * The sources behind the direct answer, where the answer IS a sourced claim
   * rather than a summary written over several.
   *
   * An authored section summarises its claims, so its direct answer cites
   * nothing itself and the claims beneath carry the provenance. An adapted
   * section has no summary to write — §61 forbids inventing one — so its
   * first sourced sentence becomes the answer. Rendering that sentence as the
   * answer AND again as the first claim put the same words twice on every one
   * of 485 pages; dropping it from the claims list without this field would
   * have dropped its citation with it, which §8 does not allow.
   */
  directAnswerCitations?: AuthorityClaim["citations"];
  claims: AuthorityClaim[];
  subsections?: AuthoritySubsection[];
}

export interface AuthoritySource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  kind: CitationKind;
  reviewedAt: string;
  note: string;
}

export interface AuthorityVisualAsset {
  id: string;
  /**
   * Where the unprocessed source image lives, as supplied.
   *
   * This was typed `/White tail deer/${string}`, which made it impossible for
   * any other species to declare a visual asset at all — the contract itself
   * was the reason the renderer could only serve one species.
   */
  originalPath: string;
  purpose: string;
  section: AuthoritySectionId;
  role: string;
  width: number;
  height: number;
  status: "USED" | "REVIEW_REQUIRED" | "NOT_USED";
  requirement: string;
  provenance: string;
  renditions?: AuthorityVisualRendition[];
}

export interface AuthorityVisualRendition {
  id: string;
  src: `/species-authority/${string}`;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

export interface AuthorityExplorerItem {
  id: string;
  label: string;
  directAnswer: string;
  details: string[];
  renditionId?: string;
  caution?: string;
  citations: AuthorityCitation[];
}

export interface AuthorityVisualExplorer {
  id: string;
  sectionId: AuthoritySectionId;
  title: string;
  intro: string;
  items: AuthorityExplorerItem[];
}

export interface AuthorityShotExplorerItem extends AuthorityExplorerItem {
  assessment: "PREFERRED" | "CONDITIONAL" | "PASS";
  targetRegion: string;
  anatomyRenditionId?: string;
  registration?: "REGISTERED_PAIR" | "NOT_APPLICABLE";
}

export interface AuthorityShotExplorer extends Omit<AuthorityVisualExplorer, "items"> {
  items: AuthorityShotExplorerItem[];
  legalHandoff: string;
}

export interface AuthorityVisualExplorers {
  identification: AuthorityVisualExplorer;
  habitat: AuthorityVisualExplorer;
  diet: AuthorityVisualExplorer;
  signs: AuthorityVisualExplorer;
  shotPlacement: AuthorityShotExplorer;
}

export interface AuthorityFaq {
  id: string;
  question: string;
  directAnswer: string;
  citations: AuthorityCitation[];
}

/** Structured knowledge contract shared by HTML, JSON-LD, future APIs and MCP. */
export interface SpeciesAuthorityPage {
  schemaVersion: "1.0.0";
  speciesId: `species:${string}`;
  slug: string;
  canonicalPath: `/hunting/species/${string}`;
  status: "REFERENCE_IMPLEMENTATION" | "PUBLISHED";
  /**
   * Which of §16's take-eligibility answers applies, and therefore which
   * sections this page may show at all.
   *
   * `NUISANCE_OR_INVASIVE_TAKE` was missing while 28 catalogue species carry
   * it, so those species could not be represented honestly: the nearest
   * available value would have read as either a game season or a protection.
   */
  huntingCompatibility: "HUNTABLE" | "LIMITED_TAKE" | "NUISANCE_OR_INVASIVE_TAKE" | "NON_QUARRY" | "UNKNOWN";
  reviewedAt: string;
  identity: {
    commonName: string;
    scientificName: string;
    frenchName?: string;
    family: string;
    directAnswer: string;
  };
  facts: Array<{ label: string; value: string; sourceIds: string[] }>;
  sectionOrder: AuthoritySectionId[];
  sections: AuthoritySection[];
  faq: AuthorityFaq[];
  sources: AuthoritySource[];
  speciesReferences: Array<{ speciesId: `species:${string}`; label: string; path: `/hunting/species/${string}` }>;
  /**
   * Hand-authored search copy, OPTIONAL.
   *
   * The route used to hold one hard-coded White-tailed Deer title and
   * description and apply them to every authority page, so a second species
   * would have published this one's `<title>`. Absent here, the route keeps the
   * species' own generic copy, which is already correct per species — a page
   * only overrides it by actually supplying one.
   */
  seo?: { title: string; description: string; ogTitle: string; ogDescription: string };
  /**
   * Where the page hands off to Hunt, decided by the species' own
   * capabilities rather than assumed.
   *
   * `legality` is species-scoped only where Hunt actually offers the species
   * (`offeredInHunt`); otherwise it is `/hunt`, which is what the legacy page
   * linked. A NON_QUARRY page used to say "Hunt never offers it" directly
   * above a button opening Hunt with that species selected.
   *
   * `map` is OPTIONAL and present only where the species may carry a Species
   * Heat surface (`speciesHeat`). §41B: protected and non-quarry species get no
   * hunter-facing map, and LIMITED_TAKE gets none either — a narrow quota in
   * three counties must never read as huntable everywhere.
   */
  huntLinks: { legality: "/hunt" | `/hunt?${string}`; map?: `/hunt?${string}` };
  visualAssets: AuthorityVisualAsset[];
  /**
   * Curated visual explorers, OPTIONAL and partial.
   *
   * This was a required record of five fixed explorers, so a page with no
   * curated visuals could not be expressed — and omitting one was not a
   * validation issue but a TypeError, because the validator dereferenced all
   * five. 216 of 485 species have no image at all, so the absent case is the
   * common one rather than the exception.
   */
  visualExplorers?: Partial<AuthorityVisualExplorers>;
  /**
   * The six field families carried beside the prose — take evidence,
   * lookalikes, field notes, groups, related resources and the review date.
   *
   * OPTIONAL in the type and supplied by the route for every page, because it
   * is a PROJECTION of data the species already owns rather than page content:
   * a validator run on the contract alone must not demand it, and a rendered
   * page must not be missing it. See `context.ts` for why it is derived and
   * never authored.
   */
  context?: SpeciesPageContext;
}
