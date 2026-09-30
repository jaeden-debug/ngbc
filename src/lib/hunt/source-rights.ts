/**
 * What North Ground may do with an authority's source, as three separate rights.
 *
 * §44, amended 2026-09-30 by the owner: reading, deriving and archiving are
 * three different rights and one licence flag may never decide all three.
 *
 * WHAT THE OLD SHAPE COST. `officialSources[].licenceStatus` was a single string,
 * so "no reuse terms located" and "the publisher refuses us" produced the same
 * value, and a jurisdiction reported blocked looked identical whether an
 * authority had refused us or nobody had asked. Eight United States states —
 * Alabama, Connecticut, Iowa, Illinois, Louisiana, Massachusetts, Mississippi and
 * Utah — were reported LICENCE_BLOCKED on unstated terms while nothing refused
 * us. That is the over-strict error §8 names, and §8 also says why it survived:
 * a refusal always looks defensible, so an unnecessary one is never reported.
 *
 * THIS MODULE IS JURISDICTION-NEUTRAL ON PURPOSE. The classification error is
 * systemic rather than American, so Canada's sources are held to the same
 * contract. §9 forbids hard-coding one country's assumptions into a universal
 * model, and a rights model that only understood US states would be exactly that.
 *
 * It is pure: no I/O, no clock, no network. Everything it decides is decided from
 * its input, so a source's rights are auditable and testable without reaching
 * any authority.
 */

/**
 * Whether North Ground can retrieve and read the authority's current public
 * material at all.
 *
 * A REFUSED READER IS A TECHNICAL PROBLEM AND NEVER A LEGAL FINDING (§44). Four
 * authorities refuse our client while serving a browser — mass.gov,
 * wildlife.nh.gov, dem.ri.gov and codes.ohio.gov — and not one of them has
 * thereby said anything about reuse.
 */
export type AccessState =
  | "PUBLIC_READABLE"
  /** The host answers, and refuses this client specifically (typically 403). */
  | "READER_REFUSED"
  /** No usable response at all: timeout, refused connection, DNS failure. */
  | "UNREACHABLE"
  /** Reaching it would require credentials, which is never done. */
  | "AUTH_REQUIRED"
  | "NOT_ATTEMPTED";

/** What the publisher's own terms say about reuse, as terms rather than as consequence. */
export type ReuseState =
  | "GRANTED"
  /** Terms exist and permit use subject to real obligations (attribution, ShareAlike, carry-the-metadata). */
  | "CONDITIONAL"
  | "REFUSED"
  /**
   * No reuse terms have been located.
   *
   * NOT a refusal and NOT a grant. This is the value the old single flag could
   * not hold, and the whole amendment exists because of it.
   */
  | "UNSTATED";

/**
 * Whether North Ground may store, mirror, redistribute or reproduce substantial
 * portions of the authority's material.
 *
 * UNSTATED TERMS NEVER REACH `PERMITTED` HERE. §44: "Never store a full local
 * copy merely because the page can be read." This is the direction the ruling is
 * most likely to be over-applied in, so the invariant below enforces it rather
 * than trusting anyone to remember.
 */
export type ArchiveState = "PERMITTED" | "PROHIBITED" | "UNCONFIRMED";

/**
 * Whether North Ground may store the structured facts derived from the source —
 * season dates, species, zones, legal hours, limits, permit and tag
 * requirements, weapon restrictions, residency conditions — with attribution.
 *
 * This is the right the eight states were wrongly denied.
 */
export type DerivedFactsState = "USABLE" | "BLOCKED" | "UNCONFIRMED";

/** Whether the terms were read, looked for and not found, or unreadable. */
export type TermsStatus =
  | "READ"
  /** Looked for in named places and not found. `whereTermsWereLooked` must say where. */
  | "NONE_LOCATED"
  /** A terms page exists and could not be read — a technical failure, not a silence. */
  | "UNREADABLE"
  | "NOT_ATTEMPTED";

/**
 * What kind of thing the source is.
 *
 * `PRIMARY_GOVERNMENT` is the codified instrument or the authority's own
 * regulation publication. `GOVERNMENT_SUMMARY` is an agency digest that usually
 * disclaims being the law — Ohio's says so explicitly and points at the code.
 * `GOVERNMENT_GIS` is spatial data, which §44 keeps under licence review.
 * `THIRD_PARTY` may never stand in for regulatory truth (§44).
 */
export type AuthorityLevel = "PRIMARY_GOVERNMENT" | "GOVERNMENT_SUMMARY" | "GOVERNMENT_GIS" | "THIRD_PARTY";

/**
 * How the source was actually retrieved, in §44's own fallback order.
 *
 * The order is the permission: earlier is preferred, and a later one is only
 * reached because the earlier ones failed. There is deliberately NO member for
 * defeating a restriction, because §44 forbids bypassing authentication,
 * CAPTCHAs, access controls or robots restrictions — so the vocabulary cannot
 * express it, and a record claiming it would not compile.
 */
export const RETRIEVAL_FALLBACK_ORDER = [
  "OFFICIAL_HTML",
  "OFFICIAL_PDF",
  "OFFICIAL_CODE_ENDPOINT",
  "OFFICIAL_ALTERNATE_DOMAIN",
  "OFFICIAL_API",
  "BROWSER_RENDERED",
  "REVIEWED_SNAPSHOT",
] as const;

export type RetrievalMethod = (typeof RETRIEVAL_FALLBACK_ORDER)[number];

/** One authority source, with its three rights recorded independently. */
export interface SourceRights {
  sourceId: string;
  sourceUrl: string;
  authorityLevel: AuthorityLevel;
  accessState: AccessState;
  reuseState: ReuseState;
  archiveState: ArchiveState;
  derivedFactsState: DerivedFactsState;
  termsStatus: TermsStatus;
  /** Where the terms are, when they were read. Absent when none was located. */
  termsUrl?: string;
  /** ISO date the access state was last established. */
  lastVerified: string;
  retrievalMethod: RetrievalMethod;
  /**
   * The methods tried and failed before this one.
   *
   * Required once the method is past the first: §44 states an ORDER, and a
   * record that reached a snapshot without saying what it tried first is
   * claiming a fallback it may not have earned.
   */
  fallbacksAttempted?: readonly RetrievalMethod[];
  /**
   * Where the terms were looked for. Required for NONE_LOCATED.
   *
   * An absence with no account of the search is a shrug, and it reads in the
   * record exactly like a finding.
   */
  whereTermsWereLooked?: readonly string[];
  /** The exact technical limitation, where every permitted route failed (§44). */
  technicalLimitation?: string;
  /** A hash of a permitted snapshot. Only meaningful where archiving is PERMITTED. */
  contentHash?: string;
}

/** A violated invariant, named so a reader knows which rule and why it exists. */
export interface RightsViolation {
  rule: string;
  why: string;
}

/**
 * The invariants §44 turns on, checked rather than trusted.
 *
 * Returns every violation rather than the first, because a record is corrected
 * once and a reader should see all of what is wrong with it.
 */
export function sourceRightsViolations(source: SourceRights): RightsViolation[] {
  const bad: RightsViolation[] = [];
  const readable = source.accessState === "PUBLIC_READABLE";
  const unstated = source.reuseState === "UNSTATED";
  const spatial = source.authorityLevel === "GOVERNMENT_GIS";

  /*
   * THE FIRST OF THE TWO INVARIANTS THE OWNER ASKED FOR.
   *
   * Terms-unstated must not imply source-unusable. A publicly readable primary
   * government regulation whose page carries no licence notice still establishes
   * its facts, and §44's closing line is explicit: "Missing copyright labels
   * never erase independently established regulatory facts."
   */
  if (readable && unstated && !spatial && source.derivedFactsState === "BLOCKED") {
    bad.push({
      rule: "UNSTATED_TERMS_DO_NOT_BLOCK_DERIVED_FACTS",
      why:
        "The source is publicly readable and its terms are merely unstated, so the structured facts derived from it " +
        "are usable with attribution. Blocking them is the error that reported eight US states as licence-blocked " +
        "while nothing refused us.",
    });
  }

  /*
   * THE SECOND, AND IT POINTS THE OTHER WAY.
   *
   * Terms-unstated must not imply permission to archive. This is the direction
   * the ruling is most likely to be over-applied in, because once a state stops
   * being blocked the tempting next step is to store its material.
   */
  if (unstated && source.archiveState === "PERMITTED") {
    bad.push({
      rule: "UNSTATED_TERMS_ARE_NOT_PERMISSION_TO_ARCHIVE",
      why:
        "§44: never store a full local copy merely because the page can be read. Unstated terms leave archival " +
        "UNCONFIRMED. A grant has to be found, not inferred from silence.",
    });
  }

  /*
   * GEOMETRY IS NOT A DERIVED FACT. §44: "A polygon dataset cannot be reduced to
   * a derived fact — storing it IS archival." So spatial data does not get the
   * eight states' relief, and the standing live-service-only decision stands.
   */
  if (spatial && unstated && source.derivedFactsState === "USABLE") {
    bad.push({
      rule: "GEOMETRY_IS_NOT_A_DERIVED_FACT",
      why:
        "Storing a polygon dataset is archival, not derivation, so unstated terms do not make it usable. The licence " +
        "review still governs spatial data and United States hunting geography remains live-service only.",
    });
  }

  /*
   * A BLOCKED READER IS NOT A LEGAL FINDING. Four authorities refuse our client
   * while serving a browser; none of them has said anything about reuse, and
   * writing REFUSED there would convert our transport problem into their
   * prohibition.
   */
  if ((source.accessState === "READER_REFUSED" || source.accessState === "UNREACHABLE") &&
      source.reuseState === "REFUSED" && source.termsStatus !== "READ") {
    bad.push({
      rule: "A_BLOCKED_READER_IS_NOT_A_REFUSAL",
      why:
        "The reader was refused and the terms were never read, so nothing establishes a refusal of reuse. §44 makes " +
        "this a source-acquisition failure, recorded as one.",
    });
  }

  /* An absence needs an account of the search, or it is indistinguishable from
     a place nobody looked. */
  if (source.termsStatus === "NONE_LOCATED" && (source.whereTermsWereLooked?.length ?? 0) < 2) {
    bad.push({
      rule: "AN_ABSENCE_NEEDS_ITS_SEARCH",
      why: "NONE_LOCATED must name at least two places the terms were looked for; otherwise it is a shrug that reads like a finding.",
    });
  }

  /* Terms that were read must say where they were read. */
  if (source.termsStatus === "READ" && !source.termsUrl) {
    bad.push({ rule: "READ_TERMS_NEED_THEIR_URL", why: "A licence claim whose instrument is not cited cannot be audited or re-checked." });
  }

  /* §44 states an ORDER. Reaching past the first method is a claim about what
     failed, and it has to be recorded. */
  const index = RETRIEVAL_FALLBACK_ORDER.indexOf(source.retrievalMethod);
  if (index > 0 && (source.fallbacksAttempted?.length ?? 0) < index) {
    bad.push({
      rule: "A_FALLBACK_MUST_NAME_WHAT_IT_FELL_BACK_FROM",
      why:
        `${source.retrievalMethod} is position ${index + 1} in §44's order, so at least ${index} earlier methods must ` +
        "be recorded as attempted. Otherwise a later route looks earned when it was merely chosen.",
    });
  }

  /* Where every route failed, the record names the limitation instead of
     implying the regulations do not exist. */
  if ((source.accessState === "READER_REFUSED" || source.accessState === "UNREACHABLE") && !source.technicalLimitation) {
    bad.push({
      rule: "A_FAILED_ROUTE_NAMES_ITS_LIMITATION",
      why: "§44: name the exact technical limitation rather than implying the regulations are unavailable.",
    });
  }

  /* A hash is a claim that a snapshot was taken, which only archiving permits. */
  if (source.contentHash && source.archiveState !== "PERMITTED") {
    bad.push({
      rule: "A_SNAPSHOT_HASH_IMPLIES_A_PERMITTED_SNAPSHOT",
      why: "A contentHash records a stored copy. §44 allows one only where archival is established as permitted.",
    });
  }

  /* Third-party material may never be the regulatory source. */
  if (source.authorityLevel === "THIRD_PARTY" && source.derivedFactsState === "USABLE") {
    bad.push({
      rule: "A_THIRD_PARTY_IS_NEVER_REGULATORY_TRUTH",
      why: "§44 forbids substituting an unofficial site for a primary authority, including when the official reader was refused.",
    });
  }

  return bad;
}

/**
 * The common case the old model could not express, as a constructor.
 *
 * §44 names it: publicly readable, terms unstated, archival unconfirmed, derived
 * facts usable, primary government authority. It exists as a function so that the
 * case the amendment was written for is the easy one to record, and so nobody
 * assembles it by hand and drifts a field.
 */
export function readableTermsUnstated(input: {
  sourceId: string;
  sourceUrl: string;
  lastVerified: string;
  whereTermsWereLooked: readonly string[];
  authorityLevel?: Extract<AuthorityLevel, "PRIMARY_GOVERNMENT" | "GOVERNMENT_SUMMARY">;
  retrievalMethod?: RetrievalMethod;
  fallbacksAttempted?: readonly RetrievalMethod[];
}): SourceRights {
  return {
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    authorityLevel: input.authorityLevel ?? "PRIMARY_GOVERNMENT",
    accessState: "PUBLIC_READABLE",
    reuseState: "UNSTATED",
    /* UNCONFIRMED, never PERMITTED: silence is not a grant to store. */
    archiveState: "UNCONFIRMED",
    derivedFactsState: "USABLE",
    termsStatus: "NONE_LOCATED",
    lastVerified: input.lastVerified,
    retrievalMethod: input.retrievalMethod ?? "OFFICIAL_HTML",
    ...(input.fallbacksAttempted ? { fallbacksAttempted: input.fallbacksAttempted } : {}),
    whereTermsWereLooked: input.whereTermsWereLooked,
  };
}
