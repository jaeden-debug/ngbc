import type { Allocation } from "./allocation.ts";

/**
 * Hunt codes, hunt numbers and permit codes, as first-class records.
 *
 * Many U.S. states do not publish "the deer season in unit 54". They publish
 * hunts: Colorado's `E-E-054-O1-R`, Idaho's controlled hunt 1144, New Mexico's
 * `ELK-1-100`. A hunt binds a species, often a sex or antler class, one or more
 * units (sometimes parts of units), a method, dates and a licence together, and
 * a hunter's licence is valid for exactly that hunt.
 *
 * A hunt code is NOT a species and not a zone, and it is never flattened into
 * either: `species:elk` stays the canonical biological species, units stay
 * zones, and the hunt is its own record that points at both. Where the code is
 * structured, its parts are decoded only through the authority's own published
 * legend — never guessed from what the characters look like — and the builder
 * cross-checks every decoded part against the table row the code appears in.
 */

/** One published meaning of one position in a structured code. */
export interface LegendEntry {
  /** The characters as printed ("E", "O1", "R"). */
  symbol: string;
  /** The authority's words for it ("Elk", "First rifle season", "Rifle"). */
  meaning: string;
}

/**
 * How a jurisdiction writes its codes: a pattern with named parts, and for each
 * part that has a legend, the legend. A part with no legend (a unit number) is
 * carried verbatim.
 */
export interface HuntCodeFormat {
  jurisdictionId: string;
  /** The authority's term ("hunt code", "hunt number", "controlled hunt number"). */
  authorityTerm: string;
  /** Anchored pattern with named groups, e.g. `^(?<species>[A-Z])-(?<sex>[A-Z])-(?<unit>\d{3})-(?<season>[A-Z0-9]{2})-(?<method>[A-Z])$`. */
  pattern: string;
  legends: Record<string, LegendEntry[]>;
  /** Where the format is defined, so a decoding can be checked against it. */
  sourceId: string;
  sourceSection: string;
}

export interface DecodedPart {
  part: string;
  symbol: string;
  /** Absent for a part the format carries verbatim, such as a unit number. */
  meaning?: string;
}

export type HuntCodeDecoding =
  | { ok: true; parts: DecodedPart[] }
  | { ok: false; reason: string };

/**
 * Decode a code through its jurisdiction's published legend.
 *
 * Refuses rather than guesses: a code that does not match the pattern, or a
 * symbol the legend does not define, is an error the builder must stop on.
 */
export function decodeHuntCode(format: HuntCodeFormat, code: string): HuntCodeDecoding {
  const match = new RegExp(format.pattern).exec(code);
  if (!match?.groups) return { ok: false, reason: `"${code}" does not match the published ${format.authorityTerm} format` };
  const parts: DecodedPart[] = [];
  for (const [part, symbol] of Object.entries(match.groups)) {
    if (symbol === undefined) continue;
    const legend = format.legends[part];
    if (!legend) {
      parts.push({ part, symbol });
      continue;
    }
    const entry = legend.find((candidate) => candidate.symbol === symbol);
    if (!entry) return { ok: false, reason: `"${symbol}" in ${format.authorityTerm} "${code}" is not defined for ${part} (${format.sourceSection})` };
    parts.push({ part, symbol, meaning: entry.meaning });
  }
  return { ok: true, parts };
}

/**
 * One published hunt.
 *
 * Everything a rule needs to point at: the code exactly as printed, what it
 * covers, how its licence is allocated and which authorizations it requires.
 * Seasons themselves stay rules in the bundle; a hunt code groups them.
 */
export interface HuntCode {
  /** `hunt_code:<jurisdiction-key>-<code, lower-case, non-alphanumerics as hyphens>`. */
  id: string;
  /** Exactly as the authority prints it. */
  code: string;
  jurisdictionId: string;
  authorityTerm: string;
  speciesId: string;
  /** Decoded parts, where the code is structured, each from the published legend. */
  parts?: DecodedPart[];
  /** The rule group whose zones this hunt covers, and the authority's own wording of them. */
  geography: { regulatoryGroupId: string; statedAs: string };
  allocation: Allocation;
  /**
   * Authorization records the hunt requires, by id (`authorization:us-co-...`).
   * An id with no record yet is kept: dropping it would read as "nothing is
   * required". Possession is never inferred from any of them.
   */
  requiresAuthorizations: string[];
  sourceId: string;
  sourceSection: string;
}

/** The canonical id for a code: stable, lower-case, and unique within its jurisdiction. */
export function huntCodeId(jurisdictionKey: string, code: string): string {
  const slug = code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new Error(`Hunt code "${code}" has no identifying characters`);
  return `hunt_code:${jurisdictionKey}-${slug}`;
}
