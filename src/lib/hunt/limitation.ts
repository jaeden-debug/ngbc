/**
 * A limitation, and what KIND of statement it is.
 *
 * These used to be `string[]`. By the time a caveat reached a hunter it was
 * flat prose, with nothing separating "there is a published refuge inside this
 * zone" from "North Ground is not the authority" — so every answer carried a
 * wall of undifferentiated text and the important line sat in the middle of it.
 *
 * AND AN AUTHORITY'S WORDS ATTACH ONLY TO WHAT THAT AUTHORITY DESCRIBED.
 * `owner: "AUTHORITY"` is an attribution, and an attribution to a government
 * is a claim: a line that is North Ground's sentence QUOTING a ministry stays
 * NORTH_GROUND, because marking the whole line AUTHORITY would put our own
 * caution in the ministry's mouth. That is the symmetric failure to §8's —
 * there we must not assert a prohibition nobody legislated; here we must not
 * assert a caution nobody issued, which is quieter because it looks careful.
 * Splitting a mixed line into a quotation plus our own sentence is authorship,
 * not annotation, and belongs to whoever owns that jurisdiction's voice.
 *
 * The kind is recorded by the AUTHOR of the string, never inferred by a
 * renderer. String-matching prose for legal meaning inverts §57, and a
 * hand-kept list of "which strings are critical" inside a component puts the
 * safety-relevant half of a fact in the file least likely to be read by
 * whoever edits the regulation. Only the author of a line knows what it is.
 */

import type { CanonicalId } from "../content-contract/index.ts";

/** The languages North Ground renders a limitation in. */
export type LimitationLang = "en-CA" | "fr-CA";

/**
 * Why a CONTEXTUAL limitation applies, named as something the evaluation
 * ALREADY decided.
 *
 * Deliberately a closed set and not a string: a renderer must never parse
 * prose to decide whether a warning fires, and an author who cannot state a
 * condition as data should write the line GENERAL instead. A warning fired by
 * guessing is worse than one that waits.
 */
export type LimitationCondition =
  | "NEAR_BOUNDARY"
  | "RESTRICTED_AREA_PRESENT"
  | "SPECIAL_AREA_UNREAD"
  | "HUNTER_CLASS_UNKNOWN"
  | "METHOD_UNKNOWN"
  | "OUTSIDE_CERTIFIED_PERIOD"
  | "PROVINCIAL_RULES_UNCERTIFIED"
  | "SEASON_NOT_ENCODED";

interface LimitationBase {
  /** Stable, so a consumer can key and test one line. */
  id: string;
  text: string;
  lang: LimitationLang;
  /**
   * Whose words these are. North Ground's render plainly; an authority's
   * render quoted and attributed, and are never paraphrased or translated —
   * §47 keeps an official term in the language the authority published it in.
   */
  owner: "NORTH_GROUND" | "AUTHORITY";
}

/**
 * `condition` and `sourceId` are required by the TYPE rather than by
 * convention, so a builder cannot emit a CONTEXTUAL limitation with nothing to
 * test against or a SOURCE_DETAIL with nothing to attribute it to.
 */
export type Limitation =
  | (LimitationBase & { scope: "GENERAL" })
  /** Earned, never assumed: a line promoted because it MIGHT matter is how the wall grows back. */
  | (LimitationBase & { scope: "CRITICAL" })
  | (LimitationBase & { scope: "CONTEXTUAL"; condition: LimitationCondition })
  | (LimitationBase & { scope: "SOURCE_DETAIL"; sourceId: CanonicalId<"source"> });

/** A short stable id from the text, so an unnamed line still keys and tests. */
function idFor(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `limitation:${hash.toString(16).padStart(8, "0")}`;
}

/**
 * The default. Every string that existed before this shape becomes GENERAL,
 * untouched and untriaged: the wall collapses into one said-once section the
 * moment the shape lands, and each jurisdiction's owner promotes its own lines
 * afterwards. Nobody classifies a jurisdiction they do not own.
 */
export function general(text: string, id?: string): Limitation {
  return { id: id ?? idFor(text), text, lang: "en-CA", owner: "NORTH_GROUND", scope: "GENERAL" };
}

/** A line that changes what a hunter may do today. Earned, not assumed. */
export function critical(text: string, id?: string): Limitation {
  return { id: id ?? idFor(text), text, lang: "en-CA", owner: "NORTH_GROUND", scope: "CRITICAL" };
}

/** A line that applies only when the evaluation already decided `condition`. */
export function contextual(text: string, condition: LimitationCondition, id?: string): Limitation {
  return { id: id ?? idFor(text), text, lang: "en-CA", owner: "NORTH_GROUND", scope: "CONTEXTUAL", condition };
}

/**
 * An authority's own words, attached to the source they came from.
 *
 * `lang` is the language the authority published in. A Québec ministry
 * quotation stays fr-CA and is rendered quoted and tagged rather than
 * translated: §47 forbids inventing a translation of law, and the answer to
 * "no untranslated French wall" is attribution and tagging, not a paraphrase.
 */
export function sourceDetail(
  text: string,
  sourceId: CanonicalId<"source">,
  lang: LimitationLang = "en-CA",
  id?: string,
): Limitation {
  return { id: id ?? idFor(text), text, lang, owner: "AUTHORITY", scope: "SOURCE_DETAIL", sourceId };
}

/** Plain text of a limitation, for callers that still need one string. */
export const limitationText = (limitation: Limitation): string => limitation.text;
