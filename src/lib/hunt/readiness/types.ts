/**
 * Ready to Hunt — what someone needs before they can go.
 *
 * Hunt answers "can I hunt this, here, on this date?". A new hunter's next
 * question is different: "then what do I actually need?". This module answers
 * that and nothing more — the authorizations, the hunter-orange rule, what the
 * law lets them hunt with, and where to get the paperwork. It is deliberately
 * not a gear list.
 *
 * Three layers are kept apart here, and nothing in the interface is allowed to
 * blur them:
 *
 *   REQUIRED     The law requires it for this hunt.
 *   ALLOWED      The law permits it, subject to the stated restriction.
 *   RECOMMENDED  North Ground's practical advice, inside what the law allows.
 *
 * A recommendation never changes a regulatory status, and it is refused at
 * build time if it falls outside the legal restriction it sits beside.
 *
 * The model is jurisdiction-neutral. Nothing below names Ontario: a U.S.
 * state's licence + tag + hunt code + stamp + federal duck stamp compose the
 * same way Ontario's Outdoors Card + small game licence + turkey tag do.
 */

import type { RequirementRow } from "./requirements.ts";

/* ── Identity ────────────────────────────────────────────────────────────── */

/**
 * `authorization:<jurisdiction-key>-<slug>`, where the jurisdiction key is the
 * key of a `jurisdiction:` ID (`ca-on`, `ca-federal`, `us-co`, `us-federal`).
 * The slug is the authority's own name. The licence year is a property of the
 * record, not part of the ID, so an ID is stable across years.
 *
 * A regulatory-layer ID like `regulatory_rule:`, deliberately not a content-
 * contract entity type.
 */
export type AuthorizationId = `authorization:${string}`;

export const AUTHORIZATION_ID_PATTERN = /^authorization:[a-z0-9](?:[a-z0-9-]{0,117}[a-z0-9])?$/;

export function isAuthorizationId(value: unknown): value is AuthorizationId {
  return typeof value === "string" && AUTHORIZATION_ID_PATTERN.test(value);
}

/**
 * What kind of authorization this is. The authority's own name always travels
 * in `officialName`; this is for grouping and behaviour, never for display.
 * Calling everything a "permit" is exactly the flattening this avoids.
 */
export type AuthorizationKind =
  | "HUNTING_LICENCE"
  | "SPECIES_LICENCE"
  | "TAG"
  | "PERMIT"
  | "VALIDATION"
  | "STAMP"
  | "DRAW_AUTHORIZATION"
  | "HUNT_CODE"
  | "LIMITED_ENTRY"
  | "FEDERAL_PERMIT"
  | "CONSERVATION_REQUIREMENT"
  | "IDENTIFICATION_CARD"
  | "FIREARMS_LICENCE"
  | "HUNTER_EDUCATION"
  | "OTHER";

export type Residency = "RESIDENT" | "NON_RESIDENT";

/**
 * Hunting methods, in the vocabulary the regulatory engine already asks in.
 * CROSSBOW and AIR_GUN appear only where a jurisdiction restricts them apart
 * from other bows or guns; the engine's BOW answer covers both kinds of bow.
 */
export type MethodClass = "RIFLE" | "SHOTGUN" | "MUZZLELOADER" | "BOW" | "CROSSBOW" | "AIR_GUN";

export const GUN_METHODS: readonly MethodClass[] = ["RIFLE", "SHOTGUN", "MUZZLELOADER", "AIR_GUN"];

/* ── Provenance ──────────────────────────────────────────────────────────── */

export type SourceTier =
  | "LAW"
  | "OFFICIAL_SUMMARY"
  | "OFFICIAL_FEE_SCHEDULE"
  | "OFFICIAL_DATASET";

/**
 * Where a legal statement comes from.
 *
 * `quote` is the authority's own words, and the builder refuses to publish if
 * that quote is no longer present in the source it cites. So a displayed
 * requirement is not merely attributed to a source — it was re-read there on
 * the day the bundle was built.
 */
export interface Provenance {
  sourceId: string;
  url: string;
  /** "O. Reg. 665/98 s. 26(1)" or the summary heading it sits under. */
  citation: string;
  tier: SourceTier;
  quote?: string;
  retrievedAt: string;
}

/* ── Authorizations ──────────────────────────────────────────────────────── */

/**
 * The facts an authorization, a rule or a price turns on. The keys are the
 * regulatory engine's own dimensions, so the checklist reuses answers the
 * hunter has already given and never runs a second questionnaire.
 */
export interface ApplicabilityCondition {
  residency?: Residency[];
  methods?: MethodClass[];
  /** Only for a jurisdiction that publishes seasons per tag type. */
  tagTypes?: string[];
}

export type PurchaseChannel =
  | "ONLINE"
  | "PHONE"
  | "PHYSICAL_VENDOR"
  | "LICENSED_OPERATOR"
  | "DRAW"
  | "FEDERAL_APPLICATION";

export interface PurchaseOptions {
  channels: PurchaseChannel[];
  onlineUrl?: string;
  phone?: string;
  /** The authority's page explaining the authorization. Always present. */
  infoUrl: string;
  /**
   * The ID of an authoritative vendor dataset, when one exists. Never a general
   * business search: a sporting-goods store that appears on a map has not
   * thereby been shown to issue this licence.
   */
  vendorDirectoryId?: string;
  note?: string;
}

/**
 * A fee as the authority publishes it.
 *
 * `label` is the authority's own line ("Resident small game licence") and
 * `amount` the figure beside it, before any tax the authority says it adds —
 * Ontario publishes fees before 13% HST, so the displayed figure says "+ HST"
 * rather than quietly becoming a total nobody published.
 */
export interface Price {
  amount: number;
  currency: "CAD" | "USD";
  label: string;
  appliesTo: ApplicabilityCondition;
  /** A published variant of the same product: "3-year", "spring". */
  variant?: string;
  taxNote?: string;
  /**
   * The licence year the fee schedule belongs to. A fee is presented as current
   * only inside that year: a new year's fees are unknown until they are read.
   *
   * Not every authority prices by licence year — Québec indexes on 1 April by
   * CPI — so `currency` below is the general form and this stays for the
   * jurisdictions that do.
   */
  licenceYear: number;
  /**
   * When this FIGURE is the figure, which is not when the instrument is law.
   *
   * Québec's r.32 still reads "À jour" and remains in force after its amounts
   * are superseded on 1 April: the instrument, the provision and the number
   * can each go stale independently. A fee outside its window is not shown.
   */
  figureInForce?: { effectiveFrom: string; supersededOn?: string; statedAs: string };
  /**
   * What KIND of money this is, so it cannot be summed into the wrong total.
   *
   * Québec's 8,18 $ registration fee is a POST-HUNT charge on deer, moose,
   * bear and turkey — real, payable, and not part of what a licence costs. A
   * model with one kind of money adds it to the licence price.
   */
  chargeType?: "LICENCE_FEE" | "MANDATORY_CONTRIBUTION" | "POST_HUNT_REGISTRATION" | "SURCHARGE";
  /**
   * Compulsory amounts payable ON TOP, set elsewhere than the fee table.
   *
   * Québec's contribution to the Fondation pour la biodiversité et la faune —
   * 5,30 $ big game, 2,59 $ small game — lives in a different annexe from the
   * obviously-titled fee table. Reading the fee table and stopping is wrong on
   * every licence in the province, and wrong LOW, which is the direction a
   * hunter discovers at the counter.
   */
  mandatoryAdditions?: Array<{ label: string; amount: number; statedAs: string; citation: string }>;
  /** The authority's own column heading, where it labels one. Never reconciled. */
  columnHeading?: string;
  provenance: Provenance;
}

export interface AuthorizationRecord {
  id: AuthorizationId;
  kind: AuthorizationKind;
  /** The authority's own name, kept exactly — never translated or normalised. */
  officialName: string;
  officialNameFr?: string;
  authority: string;
  jurisdictionId: string;
  /**
   * Who this record applies to. Absent keys mean "not restricted on this", which
   * is itself a claim the provenance has to support.
   */
  appliesTo: ApplicabilityCondition & { minAge?: number; maxAge?: number };
  effectiveFrom?: string;
  effectiveTo?: string;
  /** What must be held before this can be issued. */
  prerequisites: AuthorizationId[];
  draw?: { required: boolean; infoUrl: string; note?: string };
  /**
   * Always false. North Ground never knows whether someone holds a licence, and
   * no result may read as though it does.
   */
  possessionVerifiable: false;
  purchase: PurchaseOptions;
  prices: Price[];
  /** Why it is required, and what it is. */
  provenance: Provenance[];
  /** One plain sentence a new hunter needs to hear, if any. */
  note?: string;
}

/**
 * Which authorizations a hunt requires.
 *
 * A requirement may be unconditional, or conditional on a fact the engine
 * already asks about. Unresolved references are kept, never dropped: dropping
 * one would read as "nothing needed", which is the one answer this must never
 * produce.
 */
export interface AuthorizationRequirement {
  authorizationId: AuthorizationId;
  when?: ApplicabilityCondition;
  /** When the condition depends on a fact nobody has given, say which. */
  conditionText?: string;
  provenance: Provenance[];
}

/* ── Hunter orange ───────────────────────────────────────────────────────── */

/**
 * NOT_CERTIFIED rather than UNKNOWN, throughout.
 *
 * UNKNOWN reads as a fact about the LAW — that nobody knows whether orange is
 * required here. NOT_CERTIFIED is a fact about NORTH GROUND: we hold no
 * certified record. The second is what is true, and the name should say which.
 * Agreed with Hunt overhaul, who conceded their half's wording.
 */
export type RequirementStatus = "REQUIRED" | "NOT_REQUIRED" | "CONDITIONAL" | "NOT_CERTIFIED";

export interface OrangeResult {
  status: RequirementStatus;
  /** One line: why, today, here. */
  summary: string;
  /** The minimum the law sets, when it sets one. Never shortened to "wear orange". */
  specification?: string;
  /** Exceptions the hunter may fall under that North Ground cannot see. */
  exceptions: string[];
  provenance: Provenance[];
}

/* ── Methods and ammunition ──────────────────────────────────────────────── */

export interface LegalMethod {
  method: MethodClass;
  /**
   * PROHIBITED is a positive claim and needs positive evidence, exactly as an
   * open season does. The opposite of ALLOWED is "not certified" — which is
   * absence, and absence is never rendered. A method North Ground cannot speak
   * about does not appear in either list.
   */
  status: "ALLOWED" | "CONDITIONAL" | "PROHIBITED";
  /** The legal restriction on it, or why it is ruled out, in the authority's terms. */
  restriction?: string;
  provenance: Provenance[];
}

export interface AmmunitionRestriction {
  status: "REQUIRED" | "CONDITIONAL";
  appliesToMethods: MethodClass[];
  summary: string;
  provenance: Provenance[];
}

/**
 * North Ground's practical advice. It is never a legal statement, it is never
 * shown without being labelled as North Ground's, and it never claims a field
 * test that did not happen. `withinLegal` states the legal restriction it was
 * checked against, and the builder refuses a recommendation outside it.
 */
export interface Recommendation {
  layer: "NORTH_GROUND_KNOWLEDGE";
  topic: "WEAPON" | "AMMUNITION";
  appliesToMethods: MethodClass[];
  text: string;
  withinLegal?: string;
}

/* ── The result ──────────────────────────────────────────────────────────── */

export type PriceState =
  /** A current published fee for a known category. */
  | { kind: "VERIFIED"; prices: Price[] }
  /** Fees differ by a fact nobody has given yet; the answer is one choice away. */
  | { kind: "NEEDS_CATEGORY"; dimension: "RESIDENCY" }
  /** No current published fee. Say so; never carry an old figure forward. */
  | { kind: "CHECK_OFFICIAL"; reason: string };

export interface AuthorizationChecklistItem {
  id: AuthorizationId;
  status: "REQUIRED" | "CONDITIONAL" | "NOT_CERTIFIED";
  officialName: string;
  kind: AuthorizationKind;
  authority: string;
  /** Present when status is CONDITIONAL: the fact it turns on, in plain words. */
  conditionText?: string;
  price: PriceState;
  purchase?: PurchaseOptions;
  prerequisites: { id: AuthorizationId; officialName: string }[];
  draw?: AuthorizationRecord["draw"];
  note?: string;
  provenance: Provenance[];
}

export type ReadinessCoverage = "VERIFIED" | "PARTIAL" | "UNAVAILABLE";

export interface ReadinessResult {
  coverage: ReadinessCoverage;
  jurisdictionName: string;
  /** The authority's own page, for anything the checklist does not cover. */
  officialInfoUrl: string;
  authorizations: AuthorizationChecklistItem[];
  orange?: OrangeResult;
  /**
   * `notAllowed` carries the same shape as `allowed` because a prohibition is
   * a legal statement like any other and must show the law behind it. A bare
   * method list cannot, and a method with nothing behind it is omitted rather
   * than listed.
   */
  methods?: { allowed: LegalMethod[]; notAllowed: LegalMethod[]; recommended: Recommendation[] };
  ammunition?: { required: AmmunitionRestriction[]; recommended: Recommendation[] };
  /** Present when at least one required authorization can be bought in person. */
  vendorSearch?: { directoryId: string; attribution: string };
  /** What this checklist does not cover, so its silence is never read as "none". */
  limitations: string[];
  /**
   * The same requirements as STRUCTURE, in the shared statement vocabulary.
   *
   * Added beside the existing fields rather than replacing them: five
   * regulatory producers write the prose form, so it is retired only when all
   * of them have moved. Until then both exist and must agree, which is
   * asserted rather than assumed.
   *
   * Currently AUTHORIZATION only. A category absent from here is NOT a claim
   * that nothing is required in it — that is what `coverage` reports, and why
   * a missing row must never be read as "nothing required".
   */
  requirements?: RequirementRow[];
}

/* ── The requirement vocabulary ──────────────────────────────────────────── */

/**
 * One vocabulary for every statement Ready to Hunt makes, so that "required",
 * "allowed" and "forbidden" mean the same thing in every category.
 *
 * The rule that holds the whole thing up:
 *
 *   PROHIBITED needs positive evidence exactly as an open season does, and the
 *   opposite of ALLOWED is NOT_CERTIFIED, not PROHIBITED.
 *
 * Which is a consequence of a more general one, learned from a real defect
 * here: every "everything else is forbidden" is a complement in disguise. A
 * closed set of possibilities invites taking its complement, and a complement
 * over a set that does not describe the world asserts prohibitions nobody
 * legislated. Ontario's hunting methods were one instance — `notAllowed` was
 * the complement of a hardcoded four-method list, so a unit North Ground held
 * no rules for answered "Not allowed: Rifle, Shotgun, Muzzleloader, Bow".
 *
 * So no category may default to PROHIBITED, and none may be derived by
 * subtraction.
 */
export type RequirementState =
  /** The law requires it for this hunt. */
  | "REQUIRED"
  /** The law permits it. */
  | "ALLOWED"
  /** The law forbids it — and a source says so. Never derived from absence. */
  | "PROHIBITED"
  /** The law addresses it and it does not reach this hunt. */
  | "NOT_APPLICABLE"
  /** It applies only under a stated condition, which travels with it. */
  | "CONDITIONAL"
  /** North Ground has not established this. The default for everything. */
  | "NOT_CERTIFIED";

/**
 * What a CONDITIONAL statement turns on.
 *
 * Both forms are required and neither substitutes for the other. `when` is the
 * engine's own dimensions, so the checklist reuses answers already given
 * instead of asking twice. `statedAs` is the authority's words, so a surface
 * that cannot use the machine form still has a true sentence to show — and so
 * a condition the dimensions cannot express is still carried rather than lost.
 */
export interface RequirementCondition {
  when: ApplicabilityCondition;
  /** "while hunting deer during a gun season", in the authority's own words. */
  statedAs: string;
}

/**
 * A single statement about one requirement.
 *
 * A discriminated union rather than an object with optional fields, so that a
 * CONDITIONAL without its condition does not compile. Rendering "Hunter orange
 * ✓" where the law says "while hunting X during Y" is a false claim, and a
 * convention would eventually lose to a builder in a hurry. Hunt overhaul
 * refuses to render a CONDITIONAL that arrives without a condition; this makes
 * one impossible to send.
 *
 * NOT_CERTIFIED carries no provenance — there is nothing to cite — but it does
 * carry where to go instead, because it must render as "Verify requirement"
 * rather than vanish. A row that disappears reads as "nothing required", which
 * is the one thing silence must never mean.
 *
 * Deliberately absent: any notion of importance or criticality. Loudness is
 * presentation and belongs to Hunt overhaul; this supplies `kind`, `state` and
 * `condition` only. Two lanes owning one judgement is how they come to
 * disagree without anyone noticing.
 */
export type Statement<T> =
  | { state: "REQUIRED" | "ALLOWED" | "PROHIBITED" | "NOT_APPLICABLE"; value: T; provenance: Provenance[] }
  | { state: "CONDITIONAL"; value: T; condition: RequirementCondition; provenance: Provenance[] }
  | { state: "NOT_CERTIFIED"; value: T; verifyAt: string };

/** True when this statement is the law rather than North Ground's silence. */
export function isCertified<T>(statement: Statement<T>): boolean {
  return statement.state !== "NOT_CERTIFIED";
}

/**
 * Every legal statement carries its source, and one that does not is refused
 * at the boundary rather than rendered. This is the runtime companion to the
 * type: a builder can satisfy `Provenance[]` with an empty array, and an empty
 * array is exactly what let a sourceless prohibition reach a hunter before.
 */
export function statementIsSound<T>(statement: Statement<T>): boolean {
  if (statement.state === "NOT_CERTIFIED") return statement.verifyAt.length > 0;
  if (statement.provenance.length === 0) return false;
  return statement.state !== "CONDITIONAL" || statement.condition.statedAs.trim().length > 0;
}
