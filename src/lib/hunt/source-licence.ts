import { createHash } from "node:crypto";

/**
 * What a dataset's own publisher says may be done with it.
 *
 * The chain is: official source → exact dataset → exact licence → permitted
 * use → attribution → provenance → certification → Hunt. This record is the
 * middle of it, held per dataset rather than per agency: a department's
 * open-data page says nothing about the particular service Hunt queries, and
 * two layers from one agency can carry different terms.
 *
 * Four rules this file exists to enforce:
 *
 *  1. Silence is not permission. A service that states a copyright line and no
 *     terms is UNRESOLVED, never "probably fine because a government made it".
 *  2. North Ground is built as a commercial product. A term is read against
 *     commercial use, never against "the app is free".
 *  3. Using and KEEPING are different permissions. A licence may allow a live
 *     query while saying nothing about storing or redistributing the data —
 *     Saskatchewan's zones are licensed for commercial use and the same item
 *     says "Not for resale" — so `permittedUse` alone cannot decide an ingest.
 *     `redistribution` does, and the ingest path asks it separately.
 *  4. The wording is recorded verbatim, with where it was read, when, and a
 *     hash of the text, so a reworded licence is a visible change rather than
 *     something someone remembered.
 *
 * Jurisdiction-neutral: Canadian and U.S. layers use the same record.
 */

export type PermittedUse =
  /** The publisher grants use, including commercially, on the stated terms. */
  | "COMMERCIAL_PERMITTED"
  /** Not subject to copyright (a U.S. federal work, 17 U.S.C. § 105). */
  | "PUBLIC_DOMAIN"
  /** The publisher's own words restrict use. Serving is blocked. */
  | "RESTRICTED"
  /** No grant of use found. Serving is blocked until a person resolves it. */
  | "UNRESOLVED";

/**
 * Whether North Ground may keep a copy of the data — ingest it, store it,
 * derive from it, serve it onward — as distinct from querying the publisher's
 * own service live.
 */
export type Redistribution =
  /** The licence covers copying and onward distribution (an open licence). */
  | "PERMITTED"
  /** Use is granted but copying is not addressed, or is qualified in a way a person must settle. */
  | "UNRESOLVED"
  /** The publisher forbids redistribution. */
  | "PROHIBITED";

export interface SourceLicence {
  /** The publisher's words, quoted exactly and never paraphrased. */
  statedAs: string;
  /** Where those words were read: the dataset's own page or service document. */
  url: string;
  /** ISO date the wording above was read. */
  retrievedAt: string;
  /** sha256 of `statedAs`, so a reworded licence is a visible change. */
  sha256: string;
  permittedUse: PermittedUse;
  /** Whether a stored copy is permitted. Absent is read as UNRESOLVED. */
  redistribution?: Redistribution;
  /** The credit the publisher asks for, shown wherever the data is. Null where none is required. */
  attribution: string | null;
  /** Why this reading, and what a person must do where it is not resolved. */
  note?: string;
}

/**
 * May Hunt use this dataset at all — draw it, resolve a point in it, answer
 * from it — by querying the publisher's own service?
 */
export function licencePermitsServing(licence: SourceLicence | undefined): boolean {
  return licence !== undefined && (licence.permittedUse === "COMMERCIAL_PERMITTED" || licence.permittedUse === "PUBLIC_DOMAIN");
}

/**
 * May Hunt keep a copy — ingest the geometry, store derivatives, serve it from
 * North Ground's own database? Every ingest asks this, not the serving gate:
 * a licence can permit the live query and leave copying unresolved, and that
 * difference is exactly what a stored copy would quietly discard.
 */
export function licencePermitsStoredCopy(licence: SourceLicence | undefined): boolean {
  return licencePermitsServing(licence) && licence!.redistribution === "PERMITTED";
}

export function licenceHash(statedAs: string): string {
  return `sha256:${createHash("sha256").update(statedAs).digest("hex")}`;
}

/** Every recorded licence's hash matches its text; a build fails otherwise. */
export function licenceRecordIsIntact(licence: SourceLicence): boolean {
  return licence.sha256 === licenceHash(licence.statedAs);
}
