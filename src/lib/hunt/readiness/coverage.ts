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
  /** Why it is not CERTIFIED, when it is not. Never a bare state. */
  note?: string;
}

export interface JurisdictionReadinessCoverage {
  jurisdictionId: string;
  jurisdictionName: string;
  licenceYear: number;
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

  const capabilities: CapabilityCoverage[] = [
    {
      capability: "SEASON_STATUS", state: "NOT_CERTIFIED", species: { certified: 0, claimed },
      note: "Season status is the regulatory engine's answer, not the checklist's; it is reported there.",
    },
    {
      capability: "LEGAL_TIME", state: "NOT_CERTIFIED", species: { certified: 0, claimed },
      note: "Legal hunting time is held outside this model and is not duplicated here.",
    },
    {
      capability: "LICENCE", state: state(withRequirements, claimed), species: { certified: withRequirements, claimed },
      ...(withRequirements < claimed ? { note: "Some species have no certified licence requirement." } : {}),
    },
    {
      capability: "AUTHORIZATION", state: state(withRequirements, claimed), species: { certified: withRequirements, claimed },
      ...(withRequirements < claimed ? { note: "Tags, validations and draws are certified only where a requirement record exists." } : {}),
    },
    {
      capability: "VISIBILITY",
      state: orangeCertified ? "CERTIFIED" : "NOT_CERTIFIED",
      species: { certified: orangeCertified ? claimed : 0, claimed },
      ...(orangeCertified
        ? { note: `${orangeRules} certified rules, including the exemptions.` }
        : { note: "No certified hunter-orange rule." }),
    },
    {
      capability: "METHOD", state: state(withMethods, claimed), species: { certified: withMethods, claimed },
      ...(withMethods < claimed ? { note: "Some species have no certified method table." } : {}),
    },
    {
      capability: "AMMUNITION", state: state(withAmmunition, claimed), species: { certified: withAmmunition, claimed },
      ...(withAmmunition < claimed
        ? { note: "Ammunition is certified only where the summary states a restriction; silence is not 'no restriction'." }
        : {}),
    },
    {
      capability: "BAG_POSSESSION", state: "NOT_CERTIFIED", species: { certified: 0, claimed },
      note: "Not yet built. Bag and possession limits are unknown here, not unlimited.",
    },
    {
      capability: "TAGGING_REPORTING", state: "NOT_CERTIFIED", species: { certified: 0, claimed },
      note: "Not yet built. Whether a harvest must be tagged or reported is unknown here.",
    },
    {
      capability: "LOCATION_RESTRICTIONS", state: "NOT_CERTIFIED", species: { certified: 0, claimed },
      note: "Not yet built. Restrictions that vary within a unit are unknown here.",
    },
  ];

  return {
    jurisdictionId: bundle.jurisdictionId as string,
    jurisdictionName: bundle.jurisdictionName as string,
    licenceYear: bundle.licenceYear as number,
    capabilities,
  };
}

/** Every jurisdiction with a readiness bundle. Ontario is currently the only one. */
export function readinessCoverageReport(): JurisdictionReadinessCoverage[] {
  return [ontarioReadinessCoverage()];
}
