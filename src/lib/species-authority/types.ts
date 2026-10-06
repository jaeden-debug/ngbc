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
}

export interface AuthoritySection {
  id: AuthoritySectionId;
  title: string;
  shortTitle: string;
  layer: KnowledgeLayer;
  directAnswer: string;
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
  originalPath: `/White tail deer/${string}`;
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
  huntingCompatibility: "HUNTABLE" | "LIMITED_TAKE" | "NON_QUARRY" | "UNKNOWN";
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
  huntLinks: { legality: `/hunt?${string}`; map: `/hunt?${string}` };
  visualAssets: AuthorityVisualAsset[];
  visualExplorers: AuthorityVisualExplorers;
}
