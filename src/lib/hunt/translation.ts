import type { LimitationLang } from "./limitation.ts";
import translations from "../../../content/regulatory/translations/hunt.json" with { type: "json" };

/**
 * Reading an authority's words in a language the hunter has.
 *
 * TWO FACTS BIND AT ONCE, and every line below exists to hold both.
 *
 *   A hunter must never need French to use Hunt. Québec's ministry publishes in
 *   French, and an English interface was rendering « Territoires où toute
 *   activité de chasse est interdite. » and « La chasse est permise à partir
 *   d'une demi-heure avant le lever du soleil jusqu'à midi. » with no reading
 *   at all — a legal-hours answer, in a language the reader may not have.
 *
 *   The authority's own words ARE the fact and may not be rewritten. §47 keeps
 *   an official term in the language the authority published it in, and
 *   `limitation.ts` has the reason at length: `owner: "AUTHORITY"` is an
 *   attribution, and an attribution to a government is a claim.
 *
 * So a translation is never a REPLACEMENT. It is North Ground presentation laid
 * OVER an original that is kept, unchanged, in its own language, with its own
 * citation identity, and reachable in one action.
 *
 * FOUR RULES, each enforced by a type rather than by care.
 *
 * 1. **A translation is structurally incapable of being an authority
 *    quotation.** `Translation` carries `owner: "NORTH_GROUND"` and no
 *    `sourceId` or `citation`, so it cannot satisfy `AuthorityQuotation` — the
 *    compiler refuses it, and `translation.test.ts` asserts the refusal. This
 *    is the negative type test the provenance split established, extended
 *    rather than reimplemented beside it.
 *
 * 2. **Source language is metadata, never detection.** Every function here
 *    takes the language the record declares. Nothing inspects a string to guess
 *    what it is written in. A defaulted `lang` once labelled « Territoires où
 *    toute activité de chasse est interdite. » as English, which is exactly the
 *    failure a render-time detector would reintroduce with more machinery.
 *    (A detector exists in the TEST suite, where guessing is the point: it
 *    hunts for records whose declared language and actual script disagree.)
 *
 * 3. **The authority's own other-language text wins.** Where a ministry
 *    publishes both, BOTH are authority-owned and both keep their provenance.
 *    North Ground's translation is the second choice and a generated one the
 *    third. Where none exists, the original stays and the interface SAYS SO
 *    rather than hiding the fact.
 *
 * 4. **A translation is keyed by the exact original text.** If the authority
 *    changes a word, the key misses and the reading degrades to UNTRANSLATED —
 *    it never silently shows yesterday's reading of today's rule. Keying by an
 *    id would have made a stale translation invisible.
 *
 * Translation NEVER changes structured legality. Nothing here is read by the
 * regulatory engine; interpretation runs on canonical data, and this module is
 * imported only by presentation.
 *
 * The mechanism is generic. French→English and English→French are one path,
 * and a further source language is a further row in the data file.
 */

/** Text whose language and authorship the record itself declares. */
export interface LanguagedText {
  text: string;
  lang: LimitationLang;
  owner: "AUTHORITY" | "NORTH_GROUND";
}

/**
 * Who produced a reading, and therefore how loudly the interface hedges.
 *
 * `NORTH_GROUND_GENERATED` is the honest tier for a reading no person has
 * signed off. It is labelled as such wherever it is shown; promoting one to
 * REVIEWED is a human act and is never done by the code that renders it.
 */
export type TranslationProvenance = "NORTH_GROUND_REVIEWED" | "NORTH_GROUND_GENERATED";

/**
 * North Ground's reading of someone else's words.
 *
 * `owner` is a literal and there is no `sourceId` or `citation`, so this can
 * never be passed where an `AuthorityQuotation` is required. That is the point:
 * a renderer cannot put a translation through the quotation path by mistake,
 * because the mistake does not compile.
 */
export interface Translation {
  readonly owner: "NORTH_GROUND";
  readonly kind: "TRANSLATION";
  readonly text: string;
  /** The language this reads in. */
  readonly lang: LimitationLang;
  /** The language it was read FROM. Always stated, so the label can name it. */
  readonly from: LimitationLang;
  readonly provenance: TranslationProvenance;
}

/**
 * What the interface should show for one piece of text, and what it must say
 * about it.
 *
 * A discriminated union rather than a nullable translation, because "the
 * authority published this in English too" and "North Ground translated it" and
 * "nobody has read this into English" are three different statements to a
 * hunter and only the first is the authority speaking.
 */
export type Reading =
  /** Already in the reader's language. Nothing to say. */
  | { kind: "ORIGINAL"; show: LanguagedText }
  /** The authority published it in this language too; both sides stay theirs. */
  | { kind: "AUTHORITY_OTHER_LANGUAGE"; show: LanguagedText; original: LanguagedText }
  /** North Ground's reading, over an original that is kept and reachable. */
  | { kind: "TRANSLATION"; show: Translation; original: LanguagedText }
  /** No reading exists. The original stays, and the interface says why. */
  | { kind: "UNTRANSLATED"; original: LanguagedText };

/** How a language is named to a reader. */
const LANGUAGE_NAME: Record<LimitationLang, string> = {
  "en-CA": "English",
  "fr-CA": "French",
};

export const languageName = (lang: LimitationLang): string => LANGUAGE_NAME[lang] ?? lang;

/**
 * The language the interface is in.
 *
 * One declared value rather than a literal at each call site, and rather than a
 * DEFAULT PARAMETER. The difference matters: a default makes the language
 * invisible at the call site, so a caller that should have thought about it
 * never does — and a defaulted `lang` has already mislabelled authority text in
 * this codebase once. Naming it here makes every reader of a call site see
 * which language was chosen, and gives a locale selector one place to attach.
 *
 * It is the READER's language, never a source's. Nothing about a record's own
 * language is decided here.
 */
export const INTERFACE_LANGUAGE: LimitationLang = "en-CA";

interface TranslationRow {
  /** The source text, verbatim and complete. The key. */
  from: string;
  fromLang: string;
  into: string;
  intoLang: string;
  provenance: string;
  /** Why this reading is what it is, where a term needed a decision. */
  note?: string;
}

/**
 * The stored readings, keyed by exact source text and target language.
 *
 * Built once at module load from a committed file, so a lookup is a map hit and
 * no surface pays for the shape of the data.
 */
const STORED = new Map<string, Translation>();
for (const row of (translations as { readings: TranslationRow[] }).readings) {
  STORED.set(`${row.fromLang}\u0000${row.intoLang}\u0000${row.from}`, {
    owner: "NORTH_GROUND",
    kind: "TRANSLATION",
    text: row.into,
    lang: row.intoLang as LimitationLang,
    from: row.fromLang as LimitationLang,
    provenance: row.provenance as TranslationProvenance,
  });
}

/** How many readings are held, so a test can refuse to pass on an empty file. */
export const storedReadingCount = STORED.size;

/**
 * The reading to show, for one text, in one interface language.
 *
 * `authorityAlso` is the authority's OWN text in another language, where the
 * record holds one. It is preferred over anything North Ground wrote, and it
 * stays authority-owned on both sides.
 */
export function readingFor(
  original: LanguagedText,
  into: LimitationLang,
  authorityAlso?: LanguagedText,
): Reading {
  if (original.lang === into) return { kind: "ORIGINAL", show: original };
  if (authorityAlso?.lang === into) {
    /* Both sides are the authority's. Neither is a translation, and neither is
       ever re-labelled: a ministry's English text is the ministry's English
       text, not North Ground's reading of its French. */
    return { kind: "AUTHORITY_OTHER_LANGUAGE", show: authorityAlso, original };
  }
  const stored = STORED.get(`${original.lang}\u0000${into}\u0000${original.text}`);
  if (stored) return { kind: "TRANSLATION", show: stored, original };
  return { kind: "UNTRANSLATED", original };
}

/**
 * Whether anything needs saying about this reading.
 *
 * ORIGINAL is silent: labelling English text "in English" on an English page is
 * noise, and §13 deletes a line that repeats what the reader already has.
 */
export function readingNeedsLabel(reading: Reading): boolean {
  return reading.kind !== "ORIGINAL";
}
