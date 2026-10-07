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
import { quotedAuthority, type AuthorityQuotation } from "./provenance.ts";

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
  /**
   * What the words are about — a restricted area's name — kept OUTSIDE the
   * quotation. It used to be written into `text` ("Parc national de
   * Plaisance: “…”") and the whole line marked as the authority's, so the
   * screen showed « Parc national de Plaisance: “…” »: a name quoted as
   * though the ministry had written the line, and two sets of marks.
   */
  label?: string;
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

/**
 * An authority's own words that QUALIFY an answer rather than caption a source.
 *
 * `sourceDetail` already existed for an authority's caveat about its own data,
 * and it routes to Sources. This is the other kind: a ministry note that
 * belongs beside the answer — "Dans la zone 17, l'utilisation de collets…" is a
 * restriction a hunter acts on, not a footnote about a dataset — and it was
 * reaching a reader through `general()`, which hardcodes `en-CA` and
 * `NORTH_GROUND`. A wholly French ministry sentence was therefore shipping
 * attributed to North Ground and tagged English, so a screen reader read it
 * with English phonetics and a sighted reader had no way to know whose rule it
 * was.
 *
 * The provenance is REQUIRED, not defaulted: it takes the quotation itself, so
 * the language and the authorship arrive together with the citation that makes
 * them auditable, and a caller cannot supply the words while forgetting where
 * they came from.
 */
export function authorityNote(words: AuthorityQuotation, id?: string): Limitation {
  return { id: id ?? idFor(words.text), text: words.text, lang: words.lang, owner: "AUTHORITY", scope: "GENERAL" };
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

/**
 * Plain text of a limitation, for callers that still need one string. The
 * authority's own words are quoted here, exactly as AuthorityText quotes them
 * on screen: authorship decides the marks, so producers never add them. A
 * label stays outside the marks.
 */
export const limitationText = (limitation: Limitation): string =>
  `${limitation.label ? `${limitation.label}: ` : ""}${limitation.owner === "AUTHORITY" ? quotedAuthority(limitation.text) : limitation.text}`;

/**
 * The authority's own words about a named place, as a source detail. The name
 * is a label beside the quotation, never inside it; the id is of both, so two
 * areas with the same wording stay two lines.
 */
export function labelledSourceDetail(label: string, words: AuthorityQuotation): Limitation {
  return { id: idFor(`${label}: ${words.text}`), text: words.text, lang: words.lang, owner: "AUTHORITY", scope: "SOURCE_DETAIL", sourceId: words.sourceId, label };
}
