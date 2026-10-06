import type { TakeEligibility } from "./species-eligibility.ts";

/**
 * The words North Ground uses to say what kind of take question a species page
 * is answering — in ONE home, because they are load-bearing legal wording.
 *
 * §16 keeps conservation status, take eligibility and regulatory evidence as
 * three questions; these sentences say which one the page is answering, and the
 * NON_QUARRY and UNKNOWN ones in particular are what stop a page implying an
 * opportunity that no rule establishes.
 *
 * WHY THEY MOVED HERE. They lived in the species route as literals, and the
 * authority adapter re-typed them. The copy had already drifted on its first
 * day: the LIMITED_TAKE lead lost "or animals released or held on private
 * land", so two surfaces would have described the same legal class differently
 * while both looking authoritative. §14 — one fact, one best home — and this is
 * the fact most worth it.
 *
 * Presentation may differ per surface. The sentences may not.
 */

export const TAKE_HEADINGS: Record<TakeEligibility, string> = {
  HUNTABLE: "Where it is listed for legal take",
  LIMITED_TAKE: "Limited legal take",
  NUISANCE_OR_INVASIVE_TAKE: "Where it is listed for removal or nuisance take",
  NON_QUARRY: "Not a quarry species",
  UNKNOWN: "Take status not established",
};

export const TAKE_LEADS: Record<TakeEligibility, string> = {
  HUNTABLE: "These authorities list this species for legal take in their own regulations.",
  LIMITED_TAKE: "Legal take of this species exists only under narrow conditions — a quota, a draw, a permit, a small area, or animals released or held on private land — set by the authorities below. Nowhere else is a legal opportunity implied, and Hunt shows one only where a certified rule establishes it.",
  NUISANCE_OR_INVASIVE_TAKE: "These authorities list this species as nuisance, invasive or unprotected wildlife that may be taken. This is not a game season.",
  NON_QUARRY: "North Ground does not treat this species as quarry: it is published so it can be told apart from the game species it resembles, and Hunt never offers it. If you are not certain what it is, do not shoot.",
  UNKNOWN: "North Ground has not established meaningful legal take of this species. That is a gap in the evidence, not a finding that it is protected or that it is open.",
};

export const CONSERVATION_WORDS: Record<string, string> = {
  ENDANGERED: "Endangered",
  THREATENED: "Threatened",
  SPECIAL_CONCERN: "Special concern",
  PROTECTED: "Protected",
  CLOSED_TO_TAKE: "Closed to take",
};

/**
 * Said every time a listing list is shown, because the list is exactly what a
 * hunter would misread. A listing records that an authority names the species;
 * it is not a season, and only the regulatory engine answers that.
 */
export const LISTING_IS_NOT_A_SEASON =
  "Being listed is not an open season. Seasons, zones, licences, methods and limits decide whether "
  + "this animal may be taken on a given day and place — check Hunt or the authority before you go.";

/**
 * When the take-evidence corpus was last read against its authorities.
 *
 * It lived as a literal in the species route, which meant the authority
 * renderer could show a listing without saying when it was read — and a
 * listing whose read date is unstated is §45 provenance missing from the one
 * surface that asserts legality exists.
 */
export const TAKE_EVIDENCE_READ = "2026-09-30";
