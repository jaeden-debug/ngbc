/**
 * Whose words a piece of regulatory text contains.
 *
 * This generalises the owner tag already established by `limitation.ts`.
 * Authorship is declared by the writer and never inferred by a renderer.
 */

import type { CanonicalId } from "../content-contract/index.ts";
import type { LimitationLang } from "./limitation.ts";

/** An authority's own words, with mandatory provenance. */
export interface AuthorityQuotation {
  readonly owner: "AUTHORITY";
  /** Verbatim. Never paraphrased or translated. */
  readonly text: string;
  readonly sourceId: CanonicalId<"source">;
  /** Instrument, section, table, page, or source-layer feature. */
  readonly citation: string;
  /** The language in which the authority published the words. */
  readonly lang: LimitationLang;
}

/** North Ground's own words. These can never satisfy a quotation contract. */
export interface NorthGroundStatement {
  readonly owner: "NORTH_GROUND";
  readonly text: string;
}

export type ProvenancedText = AuthorityQuotation | NorthGroundStatement;

/** Declare authority wording. Every provenance argument is required. */
export function quoting(
  text: string,
  sourceId: CanonicalId<"source">,
  citation: string,
  lang: LimitationLang,
): AuthorityQuotation {
  return { owner: "AUTHORITY", text, sourceId, citation, lang };
}

/** Declare North Ground wording. */
export function authored(text: string): NorthGroundStatement {
  return { owner: "NORTH_GROUND", text };
}

/** Test the authorship tag itself; do not infer ownership from another field. */
export function isQuotation(value: ProvenancedText): value is AuthorityQuotation {
  return value.owner === "AUTHORITY";
}

/** Render a restriction line with quotation marks decided by authorship. */
export function provenancedLine(name: string, words: ProvenancedText): string {
  return isQuotation(words) ? `${name}: “${words.text}”` : `${name}: ${words.text}`;
}

/**
 * The authority's own words as they are written out: in « », once.
 *
 * Authorship decides the marks, so a producer passes the words bare and every
 * writer — the sheet (AuthorityText), the Hunt Brief, the legal-hours summary
 * — quotes them here. Words that already open with a quotation mark carry
 * their own (Québec's closed-territory lines are stored as « … » (category).,
 * and the readings in translations/hunt.json are keyed on exactly that), so
 * they are not quoted again: production showed « « … » » (2026-10-07).
 */
export function quotedAuthority(text: string): string {
  return /^[«“"]/.test(text) ? text : `« ${text} »`;
}
