/**
 * What Ready to Hunt can actually answer, per jurisdiction and per capability.
 *
 * This replaces a single word per jurisdiction (`VERIFIED | PARTIAL |
 * UNAVAILABLE`). One word cannot say that Ontario knows its licences and its
 * hunter-orange rule but nothing about bag limits or tagging, which is exactly
 * what a coverage report exists to show. "Ready to Hunt: supported" is worse
 * still — it is a boolean standing in front of ten different facts.
 *
 * Every count and state below is COMPUTED from the published bundles at call
 * time. Nothing is typed in, so no jurisdiction can be made to look covered by
 * editing a constant — the same discipline as `canada/report.ts`.
 */

import bundle from "../../../../content/regulatory/readiness/ca-on-2026.json" with { type: "json" };
import { REGULATORY_REGISTRY } from "../regulatory/registry.ts";

/**
 * The capabilities a hunter's "what do I need?" actually decomposes into.
 * Each is reported on its own because each is separately knowable: holding
 * certified licences says nothing about holding certified bag limits.
 */
export type ReadinessCapability =
  | "SEASON_STATUS"
  | "LEGAL_TIME"
  | "LICENCE"
  | "AUTHORIZATION"
  | "VISIBILITY"
  | "METHOD"
  | "AMMUNITION"
  | "BAG_POSSESSION"
  | "TAGGING_REPORTING"
  | "LOCATION_RESTRICTIONS";

export const READINESS_CAPABILITIES: readonly ReadinessCapability[] = [
  "SEASON_STATUS", "LEGAL_TIME", "LICENCE", "AUTHORIZATION", "VISIBILITY",
  "METHOD", "AMMUNITION", "BAG_POSSESSION", "TAGGING_REPORTING", "LOCATION_RESTRICTIONS",
];

/**
 * CERTIFIED means every species the jurisdiction claims is covered for this
 * capability. PARTIAL means some are. NOT_CERTIFIED means none — and it is the
 * default, so a capability nobody has built reports honestly rather than
 * being absent from the report.
 */
export type CapabilityState = "CERTIFIED" | "PARTIAL" | "NOT_CERTIFIED";

export interface CapabilityCoverage {
  capability: ReadinessCapability;
  state: CapabilityState;
  /** Species with a certified record for this capability, out of those claimed. */
  species: { certified: number; claimed: number };
  /**
   * ANSWERS A HUNTER COULD ACTUALLY RECEIVE, which is the number that counts.
   *
   * CLAUDE.md §8: capability reporting measures deliverable answers, not
   * encoded records — "a system that can report something as built when a
   * hunter could never receive it is misreporting its own capability". This
   * report did exactly that: it counted a species as covered when a record
   * existed, without asking whether any hunter could reach it.
   *
   * A readiness answer is delivered only where the regulatory engine can
   * produce a season for that species in that unit, because the checklist is
   * shown only for a CONDITIONAL answer. So the measure is species-unit pairs
   * the engine can actually answer, out of species × official units.
   */
  deliverable: { pairs: number; of: number };
  /** Why it is not CERTIFIED, when it is not. Never a bare state. */
  note?: string;
}

export interface JurisdictionReadinessCoverage {
  jurisdictionId: string;
  jurisdictionName: string;
  licenceYear: number;
  /** The authority's own unit count, from the certified spatial layer. */
  officialUnits: number | null;
  capabilities: CapabilityCoverage[];
}

type SpeciesMethods = Record<string, { methods: string; ammunition: string[]; smallGame?: boolean }>;

function state(certified: number, claimed: number): CapabilityState {
  if (claimed === 0 || certified === 0) return "NOT_CERTIFIED";
  return certified === claimed ? "CERTIFIED" : "PARTIAL";
}

/**
 * Ontario's coverage, read from Ontario's own bundle.
 *
 * A jurisdiction appears here only when a bundle exists for it. A jurisdiction
 * with no bundle is not listed as zero — it is absent, and the caller reports
 * it as having no checklist at all, which is a different statement from "we
 * checked and found nothing".
 */
export function ontarioReadinessCoverage(): JurisdictionReadinessCoverage {
  const speciesMethods = bundle.speciesMethods as SpeciesMethods;
  const requirements = bundle.requirements as Record<string, unknown>;
  const claimed = Object.keys(speciesMethods).length;

  const withMethods = Object.values(speciesMethods).filter(
    (entry) => Object.keys((bundle.methods as Record<string, { allowed?: object }>)[entry.methods]?.allowed ?? {}).length > 0,
  ).length;
  const withAmmunition = Object.values(speciesMethods).filter((entry) => entry.ammunition.length > 0).length;
  const withRequirements = Object.keys(speciesMethods).filter((id) => requirements[id] !== undefined).length;
  /* Ontario's orange provenance is an OBJECT keyed by rule (wear, bigGame,
     bear, garment, smallGameExempt, treeStand, bowsConcurrent, camouflage),
     not an array. Reading it as an array reported a certified rule as
     uncertified — under-claiming rather than over-claiming, but a coverage
     report that is wrong in either direction is not evidence. */
  const orange = bundle.orange as unknown as { specification?: string; provenance?: Record<string, unknown> };
  const orangeRules = Object.keys(orange.provenance ?? {}).length;
  const orangeCertified = orangeRules > 0 && (orange.specification ?? "").trim().length > 0;

  /* Deliverability, from the regulatory engine's own certified coverage rather
     than from this module's opinion: `unitsCovered` is the units where a
     certified rule can produce a season, which is exactly the precondition for
     a checklist appearing at all. */
  const regulatory = REGULATORY_REGISTRY.find((entry) => entry.jurisdictionId === bundle.jurisdictionId)?.coverage();
  const officialUnits = regulatory?.officialUnits ?? null;
  const deliverableUnits = new Map<string, number>(
    (regulatory?.species ?? []).map((row) => [row.speciesId, row.unitsCovered]),
  );
  const possiblePairs = officialUnits === null ? 0 : claimed * officialUnits;
  /** Pairs a hunter could receive this capability's answer in. */
  const pairsFor = (hasData: (speciesId: string) => boolean): number =>
    Object.keys(speciesMethods)
      .filter(hasData)
      .reduce((total, speciesId) => total + (deliverableUnits.get(speciesId) ?? 0), 0);

  const everySpecies = () => true;
  const hasRequirements = (speciesId: string) => requirements[speciesId] !== undefined;
  const hasMethods = (speciesId: string) =>
    Object.keys((bundle.methods as Record<string, { allowed?: object }>)[speciesMethods[speciesId].methods]?.allowed ?? {}).length > 0;
  const hasAmmunition = (speciesId: string) => speciesMethods[speciesId].ammunition.length > 0;
  const none = () => false;

  const capabilities: CapabilityCoverage[] = [
    {
      capability: "SEASON_STATUS", state: "NOT_CERTIFIED", species: { certified: 0, claimed }, deliverable: { pairs: pairsFor(none), of: possiblePairs },
      note: "Season status is the regulatory engine's answer, not the checklist's; it is reported there.",
    },
    {
      capability: "LEGAL_TIME", state: "NOT_CERTIFIED", species: { certified: 0, claimed }, deliverable: { pairs: pairsFor(none), of: possiblePairs },
      note: "Legal hunting time is held outside this model and is not duplicated here.",
    },
    {
      capability: "LICENCE", state: state(withRequirements, claimed), species: { certified: withRequirements, claimed }, deliverable: { pairs: pairsFor(hasRequirements), of: possiblePairs },
      ...(withRequirements < claimed ? { note: "Some species have no certified licence requirement." } : {}),
    },
    {
      capability: "AUTHORIZATION", state: state(withRequirements, claimed), species: { certified: withRequirements, claimed }, deliverable: { pairs: pairsFor(hasRequirements), of: possiblePairs },
      ...(withRequirements < claimed ? { note: "Tags, validations and draws are certified only where a requirement record exists." } : {}),
    },
    {
      capability: "VISIBILITY",
      state: orangeCertified ? "CERTIFIED" : "NOT_CERTIFIED",
      species: { certified: orangeCertified ? claimed : 0, claimed },
      deliverable: { pairs: pairsFor(orangeCertified ? everySpecies : none), of: possiblePairs },
      ...(orangeCertified
        ? { note: `${orangeRules} certified rules, including the exemptions.` }
        : { note: "No certified hunter-orange rule." }),
    },
    {
      capability: "METHOD", state: state(withMethods, claimed), species: { certified: withMethods, claimed }, deliverable: { pairs: pairsFor(hasMethods), of: possiblePairs },
      ...(withMethods < claimed ? { note: "Some species have no certified method table." } : {}),
    },
    {
      capability: "AMMUNITION", state: state(withAmmunition, claimed), species: { certified: withAmmunition, claimed }, deliverable: { pairs: pairsFor(hasAmmunition), of: possiblePairs },
      ...(withAmmunition < claimed
        ? { note: "Ammunition is certified only where the summary states a restriction; silence is not 'no restriction'." }
        : {}),
    },
    {
      capability: "BAG_POSSESSION", state: "NOT_CERTIFIED", species: { certified: 0, claimed }, deliverable: { pairs: pairsFor(none), of: possiblePairs },
      note: "Not yet built. Bag and possession limits are unknown here, not unlimited.",
    },
    {
      capability: "TAGGING_REPORTING", state: "NOT_CERTIFIED", species: { certified: 0, claimed }, deliverable: { pairs: pairsFor(none), of: possiblePairs },
      note: "Not yet built. Whether a harvest must be tagged or reported is unknown here.",
    },
    {
      capability: "LOCATION_RESTRICTIONS", state: "NOT_CERTIFIED", species: { certified: 0, claimed }, deliverable: { pairs: pairsFor(none), of: possiblePairs },
      note: "Not yet built. Restrictions that vary within a unit are unknown here.",
    },
  ];

  /* A capability's own data can be complete while the answer still cannot
     reach a hunter in most of the province, because the checklist appears only
     where the regulatory engine can produce a season. Saying so here keeps the
     shortfall attributed to the right lane: it is not a gap in the requirement
     data, and reporting it as one would send someone to fix the wrong thing. */
  for (const entry of capabilities) {
    if (entry.state === "NOT_CERTIFIED" || entry.deliverable.of === 0) continue;
    if (entry.deliverable.pairs >= entry.deliverable.of) continue;
    const short = entry.deliverable.of - entry.deliverable.pairs;
    const reason = `Deliverable in ${entry.deliverable.pairs} of ${entry.deliverable.of} species-unit pairs; ` +
      `${short} cannot be answered because no certified season reaches them, so no checklist appears there.`;
    entry.note = entry.note ? `${entry.note} ${reason}` : reason;
  }

  return {
    jurisdictionId: bundle.jurisdictionId as string,
    jurisdictionName: bundle.jurisdictionName as string,
    licenceYear: bundle.licenceYear as number,
    officialUnits,
    capabilities,
  };
}

/** Every jurisdiction with a readiness bundle. Ontario is currently the only one. */
export function readinessCoverageReport(): JurisdictionReadinessCoverage[] {
  return [ontarioReadinessCoverage()];
}
