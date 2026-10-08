import { ZONE_LAYERS } from "./zone-layers.ts";
import { JURISDICTION_SCOPES } from "./jurisdiction-scope-declarations.ts";
import { ADMINISTRATIVE_SCOPES } from "./united-states/administrative-scope-declarations.ts";

/**
 * HOW EACH JURISDICTION'S GEOGRAPHIC QUESTION IS ANSWERED IN PRODUCTION.
 *
 * The completion architecture changed on 2026-10-07 (owner, CLAUDE.md §41B, "A
 * legal rule's geography is not always a polygon"). A jurisdiction is complete
 * when it has a production-safe, tested way to answer Hunt's geographic
 * question — not when North Ground holds the authority's polygons for it.
 * Forcing LEGAL RULE → POLYGON leaves jurisdictions unfinished for a technical
 * reason, and §8 counts an unanswerable jurisdiction as no coverage at all.
 *
 * SOURCE STATUS AND PRODUCT CAPABILITY ARE DIFFERENT FIELDS. "The authority's
 * GIS is licence-refused" is a true statement about a source and is not a
 * product strategy; this module holds the second thing only.
 *
 * DERIVED, NOT TYPED, WHEREVER POSSIBLE. A served layer IS authority geometry,
 * and a declared jurisdiction scope IS a jurisdiction-wide resolver, so both are
 * read from the registries rather than restated here — a hand-kept list cannot
 * fail for a jurisdiction nobody remembered to add to it.
 */

export type ResolutionStrategy =
  /** The authority publishes polygons that ARE the legal units. */
  | "AUTHORITY_GEOMETRY"
  /** The rule names counties/towns; North Ground composes the unit from authoritative administrative geometry. */
  | "ADMINISTRATIVE_COMPOSITION"
  /** The authority defines the unit in words; North Ground constructs geometry from that text. */
  | "DERIVED_FROM_DEFINITION"
  /** A lookup answers the legal question — a county, a named area, an identifier, a predicate — with no polygon of ours. */
  | "NON_POLYGON_RESOLVER"
  /** No spatial subdivision: the jurisdiction itself is the geography. */
  | "JURISDICTION_WIDE"
  /** Authoritative evidence establishes that no spatial subdivision governs this question. */
  | "NOT_APPLICABLE"
  /** No product strategy has been established yet. NOT a completion state. */
  | "UNDECLARED";

export interface StrategyDeclaration {
  jurisdictionId: string;
  strategy: ResolutionStrategy;
  /** Why this is the strategy, in terms of what the authority actually publishes. */
  because: string;
  /** What a reader can check it against. */
  evidence: string;
}

/**
 * Declarations for jurisdictions whose strategy is NOT derivable from a served
 * layer or a jurisdiction scope — each written from a measurement, with the
 * measurement named so it can be re-run.
 *
 * IOWA IS DELIBERATELY ABSENT. It carried an UNDECLARED declaration here while
 * also serving a jurisdiction scope, and the derivation outranks a declaration
 * — so the declaration was unreachable data that still read as a claim that
 * Iowa had no strategy. Iowa's strategy is JURISDICTION_WIDE: its chapter 96
 * rules are whole-state and are answered. What that dead entry described is a
 * separate, true fact about a DIFFERENT question — Iowa's per-species deer and
 * turkey zone fields carry hunter class in their names (NR_Deer is
 * non-resident), so those sub-state geographies are not servable until hunter
 * class is modelled as a dimension rather than as a map. That belongs with
 * Iowa's zone work, not in a register of jurisdictions with no strategy.
 */
const DECLARED: readonly StrategyDeclaration[] = [
  {
    jurisdictionId: "jurisdiction:us-al",
    strategy: "UNDECLARED",
    because:
      "Alabama's season geography is not published as GIS at all: ADCNR's own server enumerates 47 root services and nine in SWAP with no season zone, its recorded service has one layer of properties, and ArcGIS Online returns zero for three phrasings against a positive control of 176 hits elsewhere. The definition has now been READ, and it is a linear traverse: Zone A is a closed circuit of highways, rivers and state lines, and Zone B is \"those areas south or west of a line described as\" one.",
    evidence:
      "r. 220-2-.01, recorded in research/hunting/us-al-deer-zone-definitions.json with the authority's own wording. This RULES OUT county composition, which was the other candidate route: the Zone A line runs along US Hwy. 80 through the middle of Sumter and Dallas Counties, so composing the zone from whole counties would be fabrication rather than simplification. DERIVED_FROM_DEFINITION over public-domain road and hydrography geometry is the strategy, and it is not built. One part IS servable today and is not yet declared: the CWD Management Zone \"includes all of Lauderdale, Colbert, and Franklin Counties\" (01077, 01033, 01059), which is county composition and needs no traverse.",
  },
  {
    jurisdictionId: "jurisdiction:us-ut",
    strategy: "UNDECLARED",
    because:
      "A Utah point falls inside many Active boundaries at once — Vernal 25, Moab 13 — because one combined layer carves the same ground differently per species and hunt type, so it cannot be a zone layer.",
    evidence:
      "BoundaryID is a clean key across all 654 Active rows, so the missing piece is the species/hunt-type model Utah keeps in its hunt tables, not identity. A NON_POLYGON_RESOLVER over those tables is the likely strategy and is not built.",
  },
  {
    jurisdictionId: "jurisdiction:us-il",
    strategy: "UNDECLARED",
    because:
      "A point returns six features, one per species and season, so filtering on Species yields exactly one zone — but the same Zone field carries legal closures where an identifier goes (\"No Spring Turkey Hunting Permitted\").",
    evidence:
      "Servable per species once designationOf rejects every closure phrasing and the closure is kept as evidence beside an UNKNOWN rather than minted into a zone or certified as CLOSED.",
  },
  {
    jurisdictionId: "jurisdiction:us-ms",
    strategy: "UNDECLARED",
    because:
      "The authority does not refuse us; its server sends only the leaf certificate, omitting the GlobalSign intermediate, so our client fails where curl succeeds. A transport defect of ours is not a regulatory-model blocker.",
    evidence:
      "Layer 7 is MDWFP DEER ZONES and serves normally to a client with the intermediate. The strategy is AUTHORITY_GEOMETRY once acquisition is fixed or an alternate official route is used. A SEPARATE currency caveat binds the rule text, not the geometry: the Rule 2.2 PDF that can be fetched is the 2025-26 PROPOSED edition (Rev. 04-2025), the adopted 2026-27 text has not been found, and the 2026-27 seasons PDF words the North Central unit differently — so those definitions must not be encoded as current while two sources already disagree.",
  },
  {
    jurisdictionId: "jurisdiction:us-ct",
    strategy: "UNDECLARED",
    because:
      "The zone layer answers a NARROWER question than a hunter asks: it is Connecticut's private-land deer and turkey reporting zones by town, while hunting on state land is governed by DEEP's hunting-area and lottery system. A zone answer on state land would answer the wrong question, so Connecticut needs land status as a dimension of the opportunity rather than a better polygon.",
    evidence:
      "Held on SCOPE. The earlier hold on PROVENANCE — that the service was a personal ArcGIS account asserting CT DEEP's attribution — is WITHDRAWN: the service is hosted in CT DEEP's own organisation (orgId FjPcSmEFuDYlIdKC resolves to \"Department of Energy & Environmental Protection\", urlKey CTDEEP), so §41A is satisfied. The item's own metadata does omit an orgId, and that is weak evidence about anything — Maine's layer, owned by a named individual, is treated in the same corpus as its authority's own service. Separately, RCSA 26-86a-6(b)(3) delegates these boundaries to the annual guide, which prints only a labelled town map, so there is no text to derive them from either.",
  },
  {
    jurisdictionId: "jurisdiction:us-mi",
    strategy: "UNDECLARED",
    because:
      "The authority contradicts itself: Commission minutes record a vote to rescind DMUs 351 and 352, and MDNR's own layer still publishes both, created and last edited four months after that vote.",
    evidence:
      "Neither minutes nor a GIS attribute is the controlling instrument. The conformed text of Wildlife Conservation Order Amendment No. 6 of 2026 is unread after nine filename probes, and it is what decides.",
  },
  {
    jurisdictionId: "jurisdiction:ca-pe",
    strategy: "JURISDICTION_WIDE",
    because:
      "Prince Edward Island publishes no hunting units. Its seasons regulation sets open seasons and limits for the whole province, with ONE sub-provincial exception — s. 1(2) excludes Hungarian partridge from Lots 1 to 10 and 43 to 47.",
    evidence:
      "The province is already served at geography level JURISDICTION (layer:ca-pe-province, 1 drawn area). The partridge exception is a NON_POLYGON_RESOLVER over PEI's historic Lots and is recorded as unbuilt; it does not make the other species sub-provincial.",
  },
];

/** Jurisdictions whose geography question is answered by a served zone layer. */
function fromServedLayers(): Map<string, StrategyDeclaration> {
  const out = new Map<string, StrategyDeclaration>();
  for (const layer of ZONE_LAYERS) {
    if (!layer.serving || out.has(layer.jurisdictionId)) continue;
    /*
     * A LAYER AT JURISDICTION LEVEL IS NOT AUTHORITY UNIT GEOMETRY. Prince
     * Edward Island is served through `layer:ca-pe-province`, whose single
     * feature is the provincial outline — the province publishes no hunting
     * units at all. Calling that AUTHORITY_GEOMETRY would say the authority
     * publishes units it does not, which is the claim this whole contract
     * exists to keep honest, so `geographyLevel` decides rather than the fact
     * that a layer happens to serve.
     */
    const jurisdictionLevel = layer.geographyLevel === "JURISDICTION";
    out.set(layer.jurisdictionId, {
      jurisdictionId: layer.jurisdictionId,
      strategy: jurisdictionLevel ? "JURISDICTION_WIDE" : "AUTHORITY_GEOMETRY",
      because: jurisdictionLevel
        ? `${layer.jurisdictionName} publishes no hunting units, so the jurisdiction's own boundary resolves the point.`
        : `${layer.jurisdictionName} is served from ${layer.authority}'s own ${layer.officialTerm} geometry.`,
      evidence: `${layer.id}, geography level ${layer.geographyLevel ?? "ZONE"}.`,
    });
  }
  return out;
}

/** Jurisdictions answered by their own boundary because the rule has no subdivision. */
function fromJurisdictionScopes(): Map<string, StrategyDeclaration> {
  const out = new Map<string, StrategyDeclaration>();
  for (const scope of JURISDICTION_SCOPES) {
    if (!scope.serving) continue;
    out.set(scope.jurisdictionId, {
      jurisdictionId: scope.jurisdictionId,
      strategy: "JURISDICTION_WIDE",
      because: "Every certified rule here is whole-jurisdiction, so the jurisdiction's own boundary resolves the point.",
      evidence: "A declared jurisdiction scope, serving.",
    });
  }
  return out;
}

/** Jurisdictions whose legal unit IS an administrative division we resolve. */
function fromAdministrativeScopes(): Map<string, StrategyDeclaration> {
  const out = new Map<string, StrategyDeclaration>();
  for (const scope of ADMINISTRATIVE_SCOPES) {
    if (!scope.serving) continue;
    out.set(scope.jurisdictionId, {
      jurisdictionId: scope.jurisdictionId,
      strategy: "ADMINISTRATIVE_COMPOSITION",
      because:
        `${scope.name} writes its hunting rules in the ${scope.officialTerm}, in the authority's own words: ` +
        `“${scope.authorityDefinition.quote}”`,
      evidence:
        `${scope.authorityDefinition.section}, ${scope.authorityDefinition.effectiveAs}. The unit is resolved from the ` +
        "U.S. Census Bureau's own county boundary, which is what the authority legislates in, so no polygon of the " +
        `authority's is needed. ${scope.furtherDimensions.length} further dimension(s) sit on top of the unit and are ` +
        "recorded with it rather than flattened into it.",
    });
  }
  return out;
}

/**
 * The strategy for a jurisdiction: derived first, declared second, UNDECLARED
 * last. A served layer outranks a declaration, so a jurisdiction that starts
 * serving stops needing one.
 */
export function resolutionStrategyFor(jurisdictionId: string): StrategyDeclaration {
  return fromServedLayers().get(jurisdictionId)
    ?? fromJurisdictionScopes().get(jurisdictionId)
    ?? fromAdministrativeScopes().get(jurisdictionId)
    ?? DECLARED.find((d) => d.jurisdictionId === jurisdictionId)
    ?? {
      jurisdictionId,
      strategy: "UNDECLARED",
      because: "No production strategy has been declared or derived for this jurisdiction.",
      evidence: "Neither a served layer, a jurisdiction scope, nor a declaration names one.",
    };
}

/** Every strategy over a population, for the completeness check and the matrix. */
export function strategiesOver(jurisdictionIds: readonly string[]): StrategyDeclaration[] {
  return jurisdictionIds.map(resolutionStrategyFor);
}

/** A strategy that actually answers a hunter. UNDECLARED is the only one that does not. */
export function isCompletionStrategy(strategy: ResolutionStrategy): boolean {
  return strategy !== "UNDECLARED";
}
