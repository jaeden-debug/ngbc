/**
 * The United States coverage registry.
 *
 * The same contract as the Canada registry, extended to the other country Hunt
 * serves — not a second coverage truth. It declares structure only: identity,
 * each authority's own management terms, the official source, and what is
 * known to be missing. Every count is computed from certified bundles by the
 * report, through the same regulatory registry Hunt evaluates from.
 *
 * Fifty of the fifty-one entries come from the research inventory
 * (`research/hunting/us/`, via `jurisdictions.generated.json`), because they
 * are research: an official hub exists, nothing is certified. A state becomes
 * more than that only by an entry in `CERTIFIED_STATES` below, written next to
 * the evidence that justifies it — never by editing a status.
 *
 * Canada remains Hunt's first complete target (CLAUDE.md §9). U.S. states are
 * added in parallel through the same engine and pipeline, one certified state
 * at a time.
 */

import type { CanonicalId } from "../../content-contract/index.ts";
import type { CoverageState, JurisdictionRegulatory, JurisdictionSpatial } from "../canada/registry.ts";
import generated from "./jurisdictions.generated.json" with { type: "json" };

export interface UnitedStatesJurisdiction {
  id: CanonicalId<"jurisdiction">;
  /** `US-CO`, or `US-FEDERAL` for the federal layer. */
  code: string;
  nameEn: string;
  /** Federal layers compose WITH a state's rules; they never replace them. */
  kind: "state" | "district" | "federal";
  spatial: JurisdictionSpatial;
  regulatory: JurisdictionRegulatory;
  /** How deep the research behind this entry went, from the inventory. */
  research: { depth: string; implementationReadiness: string; engineGaps: string };
  knownGaps: string[];
}

interface GeneratedJurisdiction {
  id: string;
  code: string;
  name: string;
  kind: "state" | "district";
  managementGeographies: string;
  officialSourceUrl: string;
  research: {
    depth: string;
    gisStatus: string;
    implementationReadiness: string;
    engineGaps: string;
    annualArtifact: string;
  };
  sourceLeads: Array<{ title: string; url: string }>;
  knownGaps: string[];
}

/**
 * States North Ground has actually certified, and how far. Each field here is
 * a claim with evidence: `parityCertified` only with a recorded certification
 * in `fixtures/hunt/`, `bundleIds` only with a generated bundle. The registry
 * test holds every one of them to that evidence.
 */
export const CERTIFIED_STATES: Readonly<Record<string, {
  spatial: Omit<JurisdictionSpatial, "officialSourceUrl"> & { officialSourceUrl?: string };
  regulatory: JurisdictionRegulatory;
  knownGaps: string[];
}>> = {};

function fromResearch(entry: GeneratedJurisdiction): UnitedStatesJurisdiction {
  const certified = CERTIFIED_STATES[entry.code];
  /* A state the national pass only discovered has an official hub and no
     researched geography: its spatial capability is not yet known. A Wave 1
     state has a named geometry source that has not been certified. D.C. is
     recorded as unavailable pending legal confirmation, as the research says. */
  const researchedSpatial: CoverageState = entry.kind === "district"
    ? "UNAVAILABLE"
    : entry.research.depth === "WAVE_1_DEEP" ? "IN_DEVELOPMENT" : "UNKNOWN";
  const spatial: JurisdictionSpatial = certified
    ? { officialSourceUrl: entry.officialSourceUrl, ...certified.spatial }
    : {
        status: researchedSpatial,
        officialTerm: entry.managementGeographies,
        officialSourceUrl: entry.officialSourceUrl,
        parityCertified: false,
        notes: `Research: ${entry.research.gisStatus}.`,
      };
  const regulatory: JurisdictionRegulatory = certified?.regulatory ?? {
    status: entry.kind === "district" ? "UNAVAILABLE" : "IN_DEVELOPMENT",
    bundleIds: [],
    sourceLeads: [entry.research.annualArtifact, ...entry.sourceLeads.map((lead) => lead.title)],
    sourceState: "NOT_INGESTED",
  };
  return {
    id: entry.id as CanonicalId<"jurisdiction">,
    code: entry.code,
    nameEn: entry.name,
    kind: entry.kind,
    spatial,
    regulatory,
    research: {
      depth: entry.research.depth,
      implementationReadiness: entry.research.implementationReadiness,
      engineGaps: entry.research.engineGaps,
    },
    knownGaps: certified
      ? certified.knownGaps
      : [`No geometry ingested and no rules certified; every ${entry.name} query is UNKNOWN.`, ...entry.knownGaps],
  };
}

const FEDERAL: UnitedStatesJurisdiction = {
  id: "jurisdiction:us-federal" as CanonicalId<"jurisdiction">,
  code: "US-FEDERAL",
  nameEn: "United States (federal)",
  kind: "federal",
  spatial: {
    status: "IN_DEVELOPMENT",
    officialTerm: "Migratory bird flyway and zone; National Wildlife Refuge; National Park; federal land unit",
    officialSourceUrl: generated.federal.sources[0].url,
    parityCertified: false,
    notes:
      "Federal geography composes with a state's units rather than replacing them: a refuge, park or military " +
      "installation sits inside a state unit and can add or remove permission there.",
  },
  regulatory: {
    status: "IN_DEVELOPMENT",
    bundleIds: [],
    sourceLeads: generated.federal.sources.map((source) => source.title),
    sourceState: "NOT_INGESTED",
  },
  research: { depth: "NATIONAL_DISCOVERY", implementationReadiness: "DISCOVERY_ONLY", engineGaps: "Federal composition not implemented" },
  knownGaps: [
    "No federal migratory-bird framework is ingested. Every duck, goose, dove and other migratory-bird query in the United States is UNKNOWN: the U.S. Fish and Wildlife Service framework sets the outer limits and each state selects its season within them, so a state bundle alone cannot answer it.",
    "National Wildlife Refuge station rules, National Park Service closures, military installations and other federal land restrictions are not evaluated. A state season does not by itself authorise hunting on federal land.",
    "Endangered Species Act protections and federal firearms restrictions are not evaluated.",
    "Tribal governments are separate sovereign authorities. Hunting on reservation or trust land, and rights-based harvest under treaty, is not evaluated and is never inferred from a state unit.",
  ],
};

export const UNITED_STATES_JURISDICTIONS: readonly UnitedStatesJurisdiction[] = [
  ...(generated.jurisdictions as GeneratedJurisdiction[]).map(fromResearch),
  FEDERAL,
];

export function unitedStatesJurisdictionById(id: string): UnitedStatesJurisdiction | undefined {
  return UNITED_STATES_JURISDICTIONS.find((entry) => entry.id === id);
}
