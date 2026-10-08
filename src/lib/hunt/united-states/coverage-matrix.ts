import hoursEvidence from "../../../../content/registry/us-hunting-hours-evidence.json" with { type: "json" };
import licenceFindings from "../../../../content/registry/us-map-licence-findings.json" with { type: "json" };
import { isCompletionStrategy, resolutionStrategyFor, type ResolutionStrategy } from "../resolution-strategy.ts";
import { ZONE_LAYERS } from "../zone-layers.ts";
import coverageEvidence from "../../../../content/registry/us-coverage-evidence.generated.json" with { type: "json" };
import { certificationFor, type StateCertification } from "./certification.ts";
import { UNITED_STATES_JURISDICTIONS, type UnitedStatesJurisdiction } from "./registry.ts";

/** The user-facing production classification requested for every state. */
export type StateProductionStatus = "COMPLETE" | "PARTIAL" | "BOUNDARIES_ONLY" | "REGULATIONS_ONLY" | "UNSUPPORTED";

export type HuntingHoursStatus =
  | "NOT_CERTIFIED"
  | "RULE_CERTIFIED_EXACT_CLOCK_UNAVAILABLE"
  | "CERTIFIED_EXACT_POINT"
  /**
   * The authority states hours PER SPECIES rather than once, and each species'
   * rule is read and cited.
   *
   * This exists because one-basis-per-state could not describe a single state
   * honestly. Eight jurisdictions state hours per species — Missouri, Kentucky,
   * Florida, Illinois, Iowa, Indiana, Alabama and Pennsylvania's exceptions —
   * so it is the norm, not the exception, and §41A's rule applies: a source that
   * does not fit the schema is evidence the schema is incomplete.
   *
   * Illinois alone has twelve distinct answers and THREE different turkey rules.
   * Upland game there is "Sunrise until sunset" with no offset at all, so
   * applying its deer rule would create an hour of illegal hunting per day.
   */
  | "RULE_CERTIFIED_PER_SPECIES";

/**
 * One species' hours rule, in one of THREE mutually exclusive states.
 *
 * The three-way split is the whole point, and collapsing any two of them is a
 * false claim in one direction or the other:
 *
 *  STATED          the authority states hours. `basis` and `statedAs` carry them.
 *  NO_RESTRICTION  the authority states AFFIRMATIVELY that there are none. Iowa
 *                  571—96.5 and 571—96.8: "There are no restrictions on shooting
 *                  hours", for pigeon and squirrel, confirmed independently by
 *                  the booklet printing "No Restrictions". Encoding the general
 *                  offset here would INVENT a restriction the authority does not
 *                  impose — which §8 makes as serious as inventing a permission.
 *  NOT_STATED      the authority is silent. UNKNOWN, and never the general rule.
 *                  Indiana states hours for five species and nothing for twenty,
 *                  including raccoon and opossum, which are night-hunted there —
 *                  so a silent inheritance of the deer offsets would not merely
 *                  be unsupported, it would be substantively wrong.
 *
 * NO_RESTRICTION and NOT_STATED are deliberately kept apart: the first is a
 * finding about the law, the second is a finding about our reading of it, and
 * only the second is resolved by reading more.
 */
export interface SpeciesHoursRule {
  /** The authority's own species wording, not a canonical id: this is evidence. */
  species: string;
  citation: string;
  state: "STATED" | "NO_RESTRICTION" | "NOT_STATED";
  /** Present only where `state` is STATED. Absent otherwise, structurally. */
  basis?: string;
  statedAs?: string;
  note?: string;
}

/**
 * HOW FAR ANYONE HAS GOT WITH THIS JURISDICTION'S GEOGRAPHY.
 *
 * The defect this exists to fix: 44 of 51 rows read `productionStatus:
 * "UNSUPPORTED"`, and nothing in the row distinguished a jurisdiction whose
 * authority was measured and found to publish no geography at all from one
 * nobody has ever looked at. A matrix generated from repository truth would
 * pass its own validation and still erase that difference — which is the §16
 * failure in its most plausible dress, because the report looks complete.
 *
 * Derived from what the repository already holds, never typed:
 *
 *  - ANSWERING: a product strategy exists (`resolution-strategy.ts`).
 *  - MEASURED_AND_HELD: the authority's own service was reached or its absence
 *    established, and the reason it is not served is recorded with it.
 *  - LICENCE_MEASURED: the publisher's terms were looked for and recorded,
 *    with a positive control, and nothing further has been done.
 *  - NOT_EXAMINED: nobody has looked. This is a finding about US, not about the
 *    authority, and it must never be reported as the authority's limitation.
 */
export type GeographyEnquiryState = "ANSWERING" | "MEASURED_AND_HELD" | "LICENCE_MEASURED" | "NOT_EXAMINED";

export interface UnitedStatesCoverageMatrixRow {
  code: string;
  jurisdictionId: string;
  name: string;
  productionStatus: StateProductionStatus;
  authority: UnitedStatesJurisdiction["authority"];
  regulationsSource: UnitedStatesJurisdiction["officialSources"][number];
  boundarySource: UnitedStatesJurisdiction["officialSources"][number] | null;
  managementGeography: string;
  /**
   * What answers this jurisdiction's geographic question, and how far anyone
   * has got. Separate from `map`, which is about a drawn layer: a jurisdiction
   * can answer without one (§41B) and can have a layer and answer nothing.
   */
  geography: {
    strategy: ResolutionStrategy;
    enquiry: GeographyEnquiryState;
    /** Why this is the strategy, in the registry's own words. */
    because: string;
    evidence: string;
    /** The recorded live-read disposition, where one was measured. */
    disposition: string | null;
  };
  map: StateCertification["map"];
  species: { status: StateCertification["regulations"]["status"]; canonicalIds: string[] };
  regulations: StateCertification["regulations"];
  huntingHours: {
    status: HuntingHoursStatus;
    basis: string | null;
    sourceId: string | null;
    citation: string | null;
    detail: string;
    rootDefinition?: { term: string; statedAs: string; citation: string };
    perSpecies?: SpeciesHoursRule[];
    /** Counted from `perSpecies`, never typed by hand, so a state cannot be made to look covered. */
    speciesCounts?: { stated: number; noRestriction: number; notStated: number };
    areaOverridesChangeTheBasis?: { finding: string; examples: string[] };
  };
  provenance: "CERTIFIED" | "DISCOVERED";
  intelligence: StateCertification["intelligence"];
  readyToHunt: "SUPPORTED" | "PARTIAL" | "NOT_IMPLEMENTED";
  knownGaps: string[];
}

type HoursRecord = {
  status: Exclude<HuntingHoursStatus, "NOT_CERTIFIED">;
  basis: string;
  sourceId: string;
  citation: string;
  detail: string;
  /**
   * A defined term every species inherits, where the authority uses one.
   *
   * Kentucky's regulations mostly state no times at all — they prohibit taking
   * outside "daylight hours", and KRS 150.010(8) defines that once. Searching
   * the species rules for "sunrise" finds nothing and produces a FALSE ABSENCE.
   * Alabama uses the identical phrase and never defines it, which is why the
   * same words are certifiable in one state and not the other.
   */
  rootDefinition?: { term: string; statedAs: string; citation: string };
  perSpecies?: SpeciesHoursRule[];
  /**
   * Inside a named area the basis itself changes, usually to a fixed clock.
   *
   * Florida 68A-15.061: "Turkey may be taken only during the special-opportunity
   * turkey hunts and only from one-half hour before sunrise until 1 p.m."
   * Illinois 17 Ill. Adm. Code 530.110 publishes per-site hours "from 9:00 a.m.
   * to 4:00 p.m." Indiana caps spring turkey on DNR properties at "noon (CT) or
   * 1 p.m. (ET)" — one instant written twice, because the state straddles two
   * zones. On such an area a correctly computed solar answer is the WRONG answer,
   * so this is recorded as a limit on the state-level rule, not as trivia.
   */
  areaOverridesChangeTheBasis?: { finding: string; examples: string[] };
};

const hours = hoursEvidence.states as Record<string, HoursRecord | undefined>;
type MatrixSource = UnitedStatesJurisdiction["officialSources"][number];
type ParityEvidence = { layerId: string; service: string; legalStanding: string };
type BundleEvidence = { source?: { id: string; title: string; url: string; licence: string | null } | null };
const parityEvidence = coverageEvidence.parity as Record<string, ParityEvidence[] | undefined>;
const bundleEvidence = coverageEvidence.bundles as Record<string, BundleEvidence[] | undefined>;

function productionStatus(certification: StateCertification): StateProductionStatus {
  const mapServed = certification.map.status === "SERVED";
  const regulationsServed = certification.regulations.status === "SERVED";
  if (mapServed && regulationsServed) return "PARTIAL"; // Hours/readiness/core-species breadth still gate COMPLETE.
  if (mapServed) return "BOUNDARIES_ONLY";
  /* A bundle with no law-first certification cases is PARTIAL in
     `regulations.status`, but with nothing served it is still rules without a
     map — production PARTIAL would rank it above a fully certified state that
     serves equally nothing, and this status reaches a hunter through the
     unsupported-state response (§8: capability is what is delivered). */
  if (["PARTIAL", "CERTIFIED", "SERVED"].includes(certification.regulations.status)) return "REGULATIONS_ONLY";
  if (certification.map.status === "CERTIFIED") return "PARTIAL";
  return "UNSUPPORTED";
}

const dispositions = (licenceFindings.liveReadDisposition?.states ?? {}) as Record<string, { disposition?: string } | undefined>;
/**
 * States whose publisher's terms have been looked for and recorded — from the
 * licence-findings register OR from a registered layer that carries a licence.
 *
 * BOTH SOURCES, because the first alone was wrong. The register holds 47 of 51
 * states, and the four it does not include are not unexamined: Colorado,
 * Montana and Wyoming each have a registered (non-serving) layer whose licence
 * records the publisher's own words — Montana's a full paragraph of terms,
 * Colorado's and Wyoming's attribution strings. Reporting those three as
 * NOT_EXAMINED would have been this matrix asserting an ignorance that is not
 * ours, which is the same overstatement in the other direction.
 */
const licenceChecked = new Set<string>([
  ...(licenceFindings.findings as Array<{ state: string }>).map((finding) => finding.state),
  ...ZONE_LAYERS
    .filter((layer) => layer.licence?.statedAs && layer.jurisdictionId.startsWith("jurisdiction:us-"))
    .map((layer) => layer.jurisdictionId.replace("jurisdiction:us-", "").toUpperCase()),
]);

/**
 * The enquiry state, strongest rung first. Each rung is a fact already in the
 * repository, so a jurisdiction cannot be moved up it by editing this file.
 */
export function enquiryState(code: string, strategy: ResolutionStrategy): GeographyEnquiryState {
  if (isCompletionStrategy(strategy)) return "ANSWERING";
  if (dispositions[code]?.disposition) return "MEASURED_AND_HELD";
  if (licenceChecked.has(code)) return "LICENCE_MEASURED";
  return "NOT_EXAMINED";
}

function isBoundarySource(source: UnitedStatesJurisdiction["officialSources"][number]): boolean {
  return /GIS|MAP|BOUNDAR|UNIT|DISTRICT|ZONE/i.test(`${source.scope} ${source.title}`) && source.scope !== "STATE_OFFICIAL_HUB";
}

function certifiedRegulationsSource(code: string, fallback: MatrixSource): MatrixSource {
  const source = bundleEvidence[code]?.find((bundle) => bundle.source)?.source;
  return source ? {
    id: source.id,
    scope: "ANNUAL_REGULATION",
    title: source.title,
    url: source.url,
    legalStanding: source.licence ?? "Certified production regulation source.",
    licenceStatus: "FACT_EXTRACTION_RECORDED",
    verificationStatus: "CERTIFIED",
  } : fallback;
}

function certifiedBoundarySource(code: string, fallback: MatrixSource | null): MatrixSource | null {
  const source = parityEvidence[code]?.[0];
  return source ? {
    id: `${source.layerId}:official-service`,
    scope: "OFFICIAL_GIS_SERVICE",
    title: "Official hunting-management boundary service",
    url: source.service,
    legalStanding: source.legalStanding,
    licenceStatus: "SEE_MAP_LAYER_LICENCE",
    verificationStatus: "CERTIFIED_PARITY",
  } : fallback;
}

export function unitedStatesCoverageMatrix(): UnitedStatesCoverageMatrixRow[] {
  return UNITED_STATES_JURISDICTIONS
    .filter((jurisdiction) => jurisdiction.kind !== "federal")
    .map((jurisdiction) => {
      const code = jurisdiction.code.slice(3);
      const certification = certificationFor(code);
      const regulationsSource = jurisdiction.officialSources.find((source) => source.scope === "STATE_OFFICIAL_HUB");
      if (!regulationsSource) throw new Error(`${code} has no official regulations source`);
      const hour = hours[code];
      return {
        code,
        jurisdictionId: jurisdiction.id,
        name: jurisdiction.nameEn,
        productionStatus: productionStatus(certification),
        authority: jurisdiction.authority,
        regulationsSource: certifiedRegulationsSource(code, regulationsSource),
        boundarySource: certifiedBoundarySource(code, jurisdiction.officialSources.find(isBoundarySource) ?? null),
        managementGeography: jurisdiction.spatial.officialTerm,
        geography: (() => {
          const strategy = resolutionStrategyFor(jurisdiction.id);
          return {
            strategy: strategy.strategy,
            enquiry: enquiryState(code, strategy.strategy),
            because: strategy.because,
            evidence: strategy.evidence,
            disposition: dispositions[code]?.disposition ?? null,
          };
        })(),
        map: certification.map,
        species: { status: certification.regulations.status, canonicalIds: certification.regulations.species },
        regulations: certification.regulations,
        huntingHours: hour
          ? {
              ...hour,
              /* Counted here rather than stored, because §9 requires coverage to
                 be computed from the records: a hand-typed count is a number
                 nobody can contradict. */
              ...(hour.perSpecies
                ? {
                    speciesCounts: {
                      stated: hour.perSpecies.filter((rule) => rule.state === "STATED").length,
                      noRestriction: hour.perSpecies.filter((rule) => rule.state === "NO_RESTRICTION").length,
                      notStated: hour.perSpecies.filter((rule) => rule.state === "NOT_STATED").length,
                    },
                  }
                : {}),
            }
          : {
              status: "NOT_CERTIFIED",
              basis: null,
              sourceId: null,
              citation: null,
              detail: "No state hunting-hours rule is certified in the production regulatory path.",
            },
        provenance: certification.map.status === "SERVED" || ["CERTIFIED", "SERVED"].includes(certification.regulations.status)
          ? "CERTIFIED"
          : "DISCOVERED",
        intelligence: certification.intelligence,
        readyToHunt: code === "ID" ? "PARTIAL" : "NOT_IMPLEMENTED",
        knownGaps: [
          ...jurisdiction.knownGaps.filter((gap) =>
            !(certification.map.layers.length > 0 || certification.regulations.rules > 0) ||
            !gap.startsWith("No geometry ingested and no rules certified;")),
          ...(certification.map.detail ? [certification.map.detail] : []),
          ...(hour ? [] : ["Hunting-hours coverage is not certified."]),
          /* A state with per-species hours is not "hours certified" wholesale.
             Naming the species the authority is silent about is the difference
             between a covered UNKNOWN and an accidental gap (§9). */
          ...(hour?.perSpecies?.some((rule) => rule.state === "NOT_STATED")
            ? [`Hunting hours are not stated by the authority for ${hour.perSpecies.filter((rule) => rule.state === "NOT_STATED").length} species read; those remain UNKNOWN and never inherit the general rule.`]
            : []),
          ...(hour?.areaOverridesChangeTheBasis
            ? [`Inside named areas the hours basis changes, often to a fixed clock, so a state-level solar answer is wrong there: ${hour.areaOverridesChangeTheBasis.finding}`]
            : []),
          code === "ID"
            ? "Ready to Hunt covers the hunting licence and controlled-hunt tag only; methods, orange, education, ammunition and current fees remain uncertified."
            : "Ready to Hunt requirements are not implemented for this state.",
        ],
      } satisfies UnitedStatesCoverageMatrixRow;
    });
}
