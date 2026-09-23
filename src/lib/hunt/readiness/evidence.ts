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
    speciesIds?: string[] | "ALL";
    gearClasses?: string[];
  };
  /** Present where a package could not settle something. Never inferred away. */
  unresolved?: string[];
}

export interface EvidencePackage {
  package?: { jurisdictionId?: string };
  source?: { id?: string; inForce?: { state?: string; asOf?: string } };
  requirements?: EvidenceRow[];
}

const PACKAGES: Record<string, EvidencePackage[]> = {
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
  if (rows.length === 0) return { certified: false, reason: "No evidence row reaches this species." };

  if (category === "METHOD") {
    const allowed = rows.filter((row) => row.state === "ALLOWED").length;
    return allowed > 0
      ? { certified: true, reason: `${allowed} positive allowed-method rows.` }
      : {
          certified: false,
          reason: `${rows.length} method rows, none stating what is ALLOWED. The complement of a prohibition list is not a permission.`,
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
