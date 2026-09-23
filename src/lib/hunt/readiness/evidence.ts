/**
 * Requirement evidence packages, read as data.
 *
 * A research lane returns evidence in the shape of
 * `docs/contracts/requirement-evidence-package.md`; this reads those packages
 * and answers what a jurisdiction can actually support, per species, per fact.
 *
 * It is deliberately a READER and not a translator. It does not convert a row
 * into an answer, does not decide a legal status, and does not fill anything
 * a package left unresolved. Its whole job is to say what evidence exists, so
 * the completeness matrix stops being Ontario-shaped and starts being a
 * function of what the lanes actually produced.
 *
 * Silence rules apply unchanged: a fact with no row is not "no requirement",
 * a PROHIBITED row is never inferred from the absence of an ALLOWED one, and
 * a species not named by a row is not thereby exempt from it.
 */

import quebecLoi from "../../../../content/regulatory/evidence/ca-qc/ca-qc-loi-conservation-faune.json" with { type: "json" };
import quebecActivites from "../../../../content/regulatory/evidence/ca-qc/ca-qc-reglement-activites-chasse.json" with { type: "json" };
import quebecChasse from "../../../../content/regulatory/evidence/ca-qc/ca-qc-reglement-chasse.json" with { type: "json" };
import quebecTarification from "../../../../content/regulatory/evidence/ca-qc/ca-qc-tarification-faune.json" with { type: "json" };

import bcDesignationExemptionRegulation from "../../../../content/regulatory/evidence/ca-bc/ca-bc-designation-exemption-regulation.json" with { type: "json" };
import bcHuntingLicensingRegulation from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-licensing-regulation.json" with { type: "json" };
import bcHuntingRegulationS119 from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-regulation-s1-19.json" with { type: "json" };
import bcHuntingRegulationSchedule1 from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-regulation-schedule-1.json" with { type: "json" };
import bcHuntingRegulationSchedule2 from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-regulation-schedule-2.json" with { type: "json" };
import bcHuntingRegulationSchedule3 from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-regulation-schedule-3.json" with { type: "json" };
import bcHuntingRegulationSchedule4 from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-regulation-schedule-4.json" with { type: "json" };
import bcHuntingRegulationSchedule5 from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-regulation-schedule-5.json" with { type: "json" };
import bcHuntingRegulationSchedule6 from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-regulation-schedule-6.json" with { type: "json" };
import bcHuntingRegulationSchedule7 from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-regulation-schedule-7.json" with { type: "json" };
import bcHuntingRegulationSchedule8 from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-regulation-schedule-8.json" with { type: "json" };
import bcHuntingTrappingSynopsis20262028 from "../../../../content/regulatory/evidence/ca-bc/ca-bc-hunting-trapping-synopsis-2026-2028.json" with { type: "json" };
import bcWildlifeAct from "../../../../content/regulatory/evidence/ca-bc/ca-bc-wildlife-act.json" with { type: "json" };
import bcOrangeAbsence from "../../../../content/regulatory/evidence/ca-bc/measured-absence-orange.json" with { type: "json" };
import idahoBigGame from "../../../../content/regulatory/evidence/us-id/us-id-big-game-2026.json" with { type: "json" };
import idahoOrangeAbsence from "../../../../content/regulatory/evidence/us-id/us-id-measured-absence-orange.json" with { type: "json" };

export type EvidenceCategory =
  | "AUTHORIZATION" | "VISIBILITY" | "METHOD" | "AMMUNITION" | "LIMIT"
  | "SPECIES_CONDITION" | "PLACE_CONDITION" | "TIME_CONDITION" | "FEE";

export type EvidenceState =
  | "REQUIRED" | "ALLOWED" | "PROHIBITED" | "NOT_APPLICABLE" | "CONDITIONAL";

export interface EvidenceRow {
  category: EvidenceCategory;
  state?: EvidenceState;
  kind?: string;
  citation?: string;
  scope?: {
    /** A list, or the string "ALL" where the source says so. */
    speciesIds?: string[] | "ALL" | null;
    gearClasses?: string[] | null;
    /** What the row is about, where it turns on method. Null where it does not. */
    methods?: string[] | null;
  };
  /** Present where a package could not settle something. Never inferred away. */
  unresolved?: string[];
}

export interface EvidencePackage {
  package?: { jurisdictionId?: string };
  source?: { id?: string; inForce?: { state?: string; asOf?: string } };
  requirements?: EvidenceRow[];
  /**
   * Facts the LANE concluded cannot be certified from this source, and why.
   *
   * A researcher who reads a whole instrument and concludes "this province
   * publishes no positive allowed-methods list" knows something the reader
   * cannot see from the rows. When the reader certifies it anyway, the
   * evidence and the certification disagree and nothing surfaces it — which
   * is exactly what happened to British Columbia's methods, and is the worst
   * shape of over-claim because the correction already existed and was
   * silently overridden.
   *
   * So a declared non-certification is a CONTRADICTION to raise, never a
   * difference to resolve in the reader's favour.
   */
  cannotCertify?: Array<{ fact: string; reason: string }>;
}

const PACKAGES: Record<string, EvidencePackage[]> = {
  "jurisdiction:us-id": [idahoBigGame as EvidencePackage, idahoOrangeAbsence as EvidencePackage],
  "jurisdiction:ca-bc": [
    bcDesignationExemptionRegulation as EvidencePackage,
    bcHuntingLicensingRegulation as EvidencePackage,
    bcHuntingRegulationS119 as EvidencePackage,
    bcHuntingRegulationSchedule1 as EvidencePackage,
    bcHuntingRegulationSchedule2 as EvidencePackage,
    bcHuntingRegulationSchedule3 as EvidencePackage,
    bcHuntingRegulationSchedule4 as EvidencePackage,
    bcHuntingRegulationSchedule5 as EvidencePackage,
    bcHuntingRegulationSchedule6 as EvidencePackage,
    bcHuntingRegulationSchedule7 as EvidencePackage,
    bcHuntingRegulationSchedule8 as EvidencePackage,
    bcHuntingTrappingSynopsis20262028 as EvidencePackage,
    bcWildlifeAct as EvidencePackage,
  ],
  "jurisdiction:ca-qc": [
    quebecLoi as EvidencePackage,
    quebecActivites as EvidencePackage,
    quebecChasse as EvidencePackage,
    quebecTarification as EvidencePackage,
  ],
};

/** Every package for a jurisdiction, or none. Never a partial guess. */
export function evidenceFor(jurisdictionId: string): EvidencePackage[] {
  return PACKAGES[jurisdictionId] ?? [];
}

export function hasEvidence(jurisdictionId: string): boolean {
  return evidenceFor(jurisdictionId).length > 0;
}

/**
 * Whether a row reaches a species.
 *
 * "ALL" means the SOURCE says all, which is a statement rather than a default.
 * A row naming no species reaches none: an unscoped row is unevidenced for
 * every species, not applicable to every species.
 */
export function rowReaches(row: EvidenceRow, speciesId: string): boolean {
  const species = row.scope?.speciesIds;
  if (species === "ALL") return true;
  return Array.isArray(species) && species.includes(speciesId);
}

/** Rows in a category that reach this species, from every package. */
export function rowsFor(
  jurisdictionId: string,
  speciesId: string,
  category: EvidenceCategory,
): EvidenceRow[] {
  return evidenceFor(jurisdictionId)
    .flatMap((entry) => entry.requirements ?? [])
    .filter((row) => row.category === category && rowReaches(row, speciesId));
}

/**
 * Whether a category has evidence that can CERTIFY for this species.
 *
 * Two categories answer differently, and both differences are load-bearing:
 *
 * METHOD certifies only from a positive ALLOWED row. An authority that
 * publishes prohibitions alone — British Columbia does, and Québec is 11
 * PROHIBITED to 2 ALLOWED — has not stated what may be used, and the
 * complement of a ban list is not a permission.
 *
 * VISIBILITY does not certify while any reaching row is scoped by a gear class
 * we cannot establish. Québec's orange exemption turns on « engin de type 6 ou
 * 11 »; with the class unknown the honest answer is UNKNOWN, and the
 * alternative is telling a bow hunter they need no orange.
 */
export function certifies(
  jurisdictionId: string,
  speciesId: string,
  category: EvidenceCategory,
): { certified: boolean; reason: string } {
  const rows = rowsFor(jurisdictionId, speciesId, category);
  if (rows.length === 0) {
    /* A MEASURED absence is a different answer from an unexamined one, and it
       must not read as "nobody looked". British Columbia's lane searched nine
       terms across five instruments and an 84-page synopsis for a hunter
       orange requirement, with a control that matched, and found none. That
       work is recorded and surfaced here so it is not repeated — and it still
       does not certify NOT_APPLICABLE, because the provision could sit in an
       instrument that was not among the ones read. */
    const measured = measuredAbsence(jurisdictionId, category);
    return measured
      ? { certified: false, reason: measured }
      : { certified: false, reason: "No evidence row reaches this species." };
  }

  if (category === "METHOD") {
    /* An ALLOWED row certifies only when it says WHICH implements it permits.
       British Columbia's two ALLOWED method rows are dog-pursuit carve-outs —
       "a person does not commit an offence where the person causes a dog to
       pursue small game" — which is an exception to a prohibition, not a
       statement of what may be hunted with. They carry no `scope.methods`,
       and certifying from them said BC had a positive list when its lane had
       reported, correctly, that it has none. */
    const positive = rows.filter((row) => row.state === "ALLOWED" && (row.scope?.methods?.length ?? 0) > 0);
    if (positive.length === 0) {
      const carveOuts = rows.filter((row) => row.state === "ALLOWED").length;
      return {
        certified: false,
        reason: carveOuts > 0
          ? `${rows.length} method rows. The ${carveOuts} marked ALLOWED are carve-outs from prohibitions and name no implements, so they are not a positive list.`
          : `${rows.length} method rows, none stating what is ALLOWED. The complement of a prohibition list is not a permission.`,
      };
    }
    const gearScoped = positive.some((row) => (row.scope?.methods ?? []).some((method) => /engin|type/i.test(method)));
    return {
      certified: true,
      reason: gearScoped
        ? `${positive.length} positive rows, expressed as the authority's numbered gear classes. Which apply to a given season needs the class populated; the list of permitted implements itself is stated.`
        : `${positive.length} positive rows naming permitted implements.`,
    };
  }

  if (category === "VISIBILITY") {
    const gearScoped = rows.filter((row) => (row.scope?.gearClasses?.length ?? 0) > 0);
    if (gearScoped.length > 0) {
      return {
        certified: false,
        reason: `Scoped by gear class (${[...new Set(gearScoped.flatMap((row) => row.scope!.gearClasses!))].join(", ")}), which is not populated. Answering without it would risk telling a hunter no orange is required when it is.`,
      };
    }
  }

  /* A row with a definite state HAS stated its fact. `unresolved` records what
     the source left open ABOUT ADJACENT questions — that Québec's certificate
     is weapon-coded, that it lapses on ceasing residency rather than expiring
     — not whether the requirement exists.
     
     Blocking on any unresolved note treated a lane's diligence as a gap, and
     penalised the lane that documented nuance against one that wrote nothing.
     That is backwards, and it would teach lanes to write fewer notes. So the
     open questions are SURFACED rather than suppressed, and a fact certifies
     on rows that state it. */
  const stated = rows.filter((row) => row.state !== undefined);
  if (stated.length === 0) {
    return { certified: false, reason: `${rows.length} rows, none stating a requirement state.` };
  }
  const unresolved = rows.flatMap((row) => row.unresolved ?? []);
  return {
    certified: true,
    reason: unresolved.length > 0
      ? `${stated.length} evidence rows; ${unresolved.length} open questions recorded alongside them.`
      : `${stated.length} evidence rows.`,
  };
}


/**
 * A recorded search that found nothing, for a jurisdiction and category.
 *
 * Kept apart from "no rows" because the two mean opposite things about what
 * anybody knows, and because a lane that ran nine searches with a control
 * should not be indistinguishable from one that ran none.
 */
export function measuredAbsence(jurisdictionId: string, category: EvidenceCategory): string | undefined {
  if (category !== "VISIBILITY") return undefined;
  const source = jurisdictionId === "jurisdiction:ca-bc" ? bcOrangeAbsence
    : jurisdictionId === "jurisdiction:us-id" ? idahoOrangeAbsence
    : undefined;
  if (!source) return undefined;
  const evidence = (source as { absenceEvidence?: { instruments?: unknown[]; closedBy?: string } }).absenceEvidence;
  const instruments = evidence?.instruments?.length ?? 0;
  return `Searched and not found across ${instruments} instruments with a matching control. ${
    evidence?.closedBy ?? "An authority statement would be needed to close it."
  }`;
}


/**
 * Where this reader would certify a fact the lane said it cannot.
 *
 * Returns the disagreements rather than resolving them. A reader that wins
 * these silently is a reader that discards research, and the researcher is the
 * one who read the whole instrument.
 */
export function certificationContradictions(
  jurisdictionId: string,
  speciesId: string,
): Array<{ fact: string; laneReason: string; readerReason: string }> {
  const declared = evidenceFor(jurisdictionId).flatMap((entry) => entry.cannotCertify ?? []);
  return declared.flatMap((claim) => {
    const category = claim.fact as EvidenceCategory;
    const verdict = certifies(jurisdictionId, speciesId, category);
    return verdict.certified
      ? [{ fact: claim.fact, laneReason: claim.reason, readerReason: verdict.reason }]
      : [];
  });
}
