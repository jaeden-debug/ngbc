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
 *
 * ---
 *
 * A FIFTH RULE, about ACCESS rather than terms, because the two get confused
 * and confusing them breaks research in both directions.
 *
 * A publisher can refuse us in two quite different ways, and they are not
 * answered the same way:
 *
 *  - An ACCESS CONTROL on a data service — a query endpoint that returns 403
 *    anonymously and answers only for a particular referrer, an item reading
 *    "Limit Usage in place", a key requirement. That is the publisher deciding
 *    who may call its service. North Ground honours it: we do not add a
 *    referrer, spoof a user agent, or reach the data through a proxy endpoint,
 *    and a future agent must not "fix" the 403. South Dakota's deer service is
 *    the recorded example.
 *
 *  - A BOT FILTER on a public web page — a regulations summary or a hunting
 *    guide that a CDN serves to browsers and refuses to curl. That is not a
 *    decision about who may read the regulations; the page is published TO THE
 *    PUBLIC and the refusal is aimed at automated clients generally. Reading it
 *    in a real browser is not circumvention: it is using the document the way
 *    it is published. Michigan's is the recorded example — michigan.gov returns
 *    403 to curl and to WebFetch and serves its accessible HTML perfectly to
 *    the browser pane.
 *
 * The distinction has to be drawn explicitly, because collapsing it breaks
 * something either way. Treat every 403 as a gate and we can never read any
 * state's regulations — a rule defeating its own purpose, and one that would
 * quietly turn "we could not read it" into "they do not publish it", which is
 * the §8 inference failure wearing a research coat. Treat every 403 as a bot
 * filter and we route around real access controls.
 *
 * A THIRD THING THAT LOOKS LIKE PERMISSION AND IS NOT: the word "Public" in a
 * dataset's title. It is the ArcGIS sharing level — who may call the service —
 * and says nothing about what may be done with what comes back. Indiana
 * publishes `Indiana Counties Public` and `Waterfowl Hunting Zones Public`,
 * both anonymously queryable, and both stating: "restricted for use by the
 * Indiana Department of Natural Resources Division of Fish and Wildlife and
 * approved partners only." A refusal wearing the word Public, on a service
 * that answers. It will catch someone, and the catching will feel like
 * success: the data arrives, the query works, and nothing fails.
 *
 * The test is WHAT is refusing and to WHOM: a data service gating its callers
 * is a gate; a public document's CDN declining non-browser clients is a
 * delivery mechanism. When it is genuinely unclear, treat it as a gate and say
 * so — and record what was tried, so the next person inherits evidence rather
 * than a verdict.
 *
 * A FOURTH, AND THE WORST OF THEM, BECAUSE THE CHECK COMES BACK CLEAN: THE
 * LICENCE OF A DATASET IS NOT THE LICENCE OF THE TOOL THAT BUILT IT.
 * `timezone-boundary-builder` declares MIT in its repository metadata — that
 * is the CODE. Its own README says the OUTPUT DATA is ODbL, which carries
 * share-alike on derivative databases. A licence check against repository
 * metadata returns MIT and proceeds, and nothing fails. Read the project's own
 * statement about its DATA, not the badge on its source.
 *
 * And a clear licence is not authority. They are two independent gates and
 * passing one has never implied the other: that same dataset describes itself
 * as "the approximate boundaries … according to community input" with no
 * stated accuracy, which is third-party community data standing in for a legal
 * fact — the same shape as the ECCC Draft district layer, which was rejected
 * for saying it had no legal value.
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
