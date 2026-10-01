/**
 * What a Saskatchewan season actually permits, from the regulation's own words
 * rather than from the section's name.
 *
 * THE MISTAKE THIS EXISTS TO PREVENT. Every big-game section in The Open Seasons
 * Game Regulations, 2009 is titled for ONE method — "White-tailed deer
 * muzzle-loading firearm open seasons" — and opens with a subsection saying which
 * means are permitted during it. Those envelopes NEST:
 *
 *   s. 9(1)  archery season      "a bow and arrow"
 *   s. 10(1) crossbow season     "a bow and arrow or crossbow"
 *   s. 11(1) muzzleloader season "a bow and arrow, crossbow or muzzle-loading firearm"
 *   s. 12(1) shotgun season      "a bow and arrow, crossbow, muzzle-loading firearm or shotgun"
 *   s. 13(1) rifle season        "the means prescribed in The Wildlife Regulations, 1981"
 *
 * So a hunter carrying a bow is open in all five, and the section titled
 * "muzzle-loading firearm open seasons" is open to a bow and a crossbow too.
 * Keying s. 11 as MUZZLELOADER alone — which is what the heading invites, and what
 * an extraction working from headings produces — tells a bow hunter the season is
 * CLOSED when it is open to them. A false CLOSED, in a province where the
 * cumulative seasons are much longer than the archery-only one, and §8 treats that
 * as exactly as wrong as a false open.
 *
 * All 39 envelopes in the regulation are recorded here with the authority's own
 * wording, so the permitted set is READ rather than inferred. Two shapes appear:
 * a cumulative list of named means, and an open envelope — "the means prescribed
 * in The Wildlife Regulations, 1981" — which is everything lawful, rifles
 * included.
 */

/** North Ground's method vocabulary, as the vocabulary's HUNT_METHOD offers it. */
export type SaskatchewanImplement = "BOW" | "CROSSBOW" | "MUZZLELOADER" | "SHOTGUN" | "RIFLE";

export const SASKATCHEWAN_IMPLEMENTS: readonly SaskatchewanImplement[] =
  ["BOW", "CROSSBOW", "MUZZLELOADER", "SHOTGUN", "RIFLE"];

/**
 * The five envelopes the regulation actually uses, keyed by the means it names.
 *
 * `openEnvelope` is the one that cross-references The Wildlife Regulations, 1981
 * rather than listing means. It is recorded as a distinct kind rather than
 * expanded in place, because what it permits is whatever THAT instrument permits —
 * so if the firearms provisions there change, this says where to look instead of
 * silently carrying a stale list.
 */
export interface MethodEnvelope {
  id: string;
  /** The authority's own words, verbatim, from the section's first subsection. */
  statedAs: string;
  permits: readonly SaskatchewanImplement[];
  /** True where the envelope defers to The Wildlife Regulations, 1981. */
  openEnvelope: boolean;
  /** Where the permitted means are then found, for an open envelope. */
  deferredTo?: string;
}

export const METHOD_ENVELOPES: Readonly<Record<string, MethodEnvelope>> = {
  BOW_ONLY: {
    id: "BOW_ONLY",
    statedAs: "a bow and arrow",
    permits: ["BOW"],
    openEnvelope: false,
  },
  BOW_OR_CROSSBOW: {
    id: "BOW_OR_CROSSBOW",
    statedAs: "a bow and arrow or crossbow",
    permits: ["BOW", "CROSSBOW"],
    openEnvelope: false,
  },
  THROUGH_MUZZLELOADER: {
    id: "THROUGH_MUZZLELOADER",
    statedAs: "a bow and arrow, crossbow or muzzle-loading firearm",
    permits: ["BOW", "CROSSBOW", "MUZZLELOADER"],
    openEnvelope: false,
  },
  THROUGH_SHOTGUN: {
    id: "THROUGH_SHOTGUN",
    statedAs: "a bow and arrow, crossbow, muzzle-loading firearm or shotgun",
    permits: ["BOW", "CROSSBOW", "MUZZLELOADER", "SHOTGUN"],
    openEnvelope: false,
  },
  /*
   * The general season. Several sections write it as a list PLUS the
   * cross-reference — "a bow and arrow, crossbow or muzzle-loading firearm, or by
   * any means other than the means prescribed in The Wildlife Regulations, 1981" —
   * which is awkward drafting for the same thing: the listed means and the
   * prescribed ones, rifles included.
   */
  ALL_LAWFUL_MEANS: {
    id: "ALL_LAWFUL_MEANS",
    statedAs: "the means prescribed in The Wildlife Regulations, 1981",
    permits: ["BOW", "CROSSBOW", "MUZZLELOADER", "SHOTGUN", "RIFLE"],
    openEnvelope: true,
    deferredTo: "The Wildlife Regulations, 1981, ss. 15 to 18 (firearms, discharge, prohibited firearms, prohibitions)",
  },
} as const;

/**
 * Which envelope each season section carries, read from its own first subsection.
 *
 * The key is the regulation's own season name as that subsection states it
 * ("during the <name> open seasons established pursuant to this section"), so a
 * builder joins on the authority's words rather than on a heading it paraphrased.
 */
export const SECTION_ENVELOPES: Readonly<Record<string, keyof typeof METHOD_ENVELOPES>> = {
  /* Part II — white-tailed deer, and Part III's antlerless counterpart. The two
     ladders are identical, which is itself worth asserting: a difference between
     them would be a real asymmetry rather than a transcription slip. */
  "white-tailed deer archery": "BOW_ONLY",
  "white-tailed deer crossbow": "BOW_OR_CROSSBOW",
  "white-tailed deer muzzle-loading firearm": "THROUGH_MUZZLELOADER",
  "white-tailed deer shotgun": "THROUGH_SHOTGUN",
  "white-tailed deer rifle": "ALL_LAWFUL_MEANS",
  "antlerless white-tailed deer archery": "BOW_ONLY",
  "antlerless white-tailed deer crossbow": "BOW_OR_CROSSBOW",
  "antlerless white-tailed deer muzzle-loading firearm": "THROUGH_MUZZLELOADER",
  "antlerless white-tailed deer shotgun": "THROUGH_SHOTGUN",
  "antlerless white-tailed deer rifle": "ALL_LAWFUL_MEANS",

  /* Elk. Note that the general elk season has no "rifle" in its name at all — it
     is simply "elk open seasons" — so a heading-driven reading would have no
     method for it. */
  "elk archery": "BOW_ONLY",
  "elk": "ALL_LAWFUL_MEANS",
  "elk archery special": "BOW_ONLY",
  "elk shotgun special": "THROUGH_SHOTGUN",
  "elk special": "ALL_LAWFUL_MEANS",

  /* Moose. Its archery season is the one exception to the ladder: it is "moose
     archery and crossbow special", a bow OR crossbow, so moose has no bow-only
     season. */
  "moose archery and crossbow special": "BOW_OR_CROSSBOW",
  "moose": "ALL_LAWFUL_MEANS",
  "moose shotgun special": "THROUGH_SHOTGUN",
  "moose special": "ALL_LAWFUL_MEANS",

  /* Part V — the four species that share it. */
  "barren-ground caribou": "ALL_LAWFUL_MEANS",
  "plains bison special": "ALL_LAWFUL_MEANS",
  "black bear": "ALL_LAWFUL_MEANS",
  "black bear archery and crossbow": "BOW_OR_CROSSBOW",
  "wolf": "ALL_LAWFUL_MEANS",

  /*
   * Mule deer, and s. 35 is the one a term search loses.
   *
   * THE REGULATION'S OWN TEXT IS MISSING A WORD. Every other envelope in the
   * instrument reads "by any means other THAN a bow and arrow …"; s. 35(1) reads
   * "no person shall hunt mule deer by any means other a bow and arrow, crossbow,
   * muzzle-loading firearm or shotgun". The typo is in the King's Printer
   * consolidation, and a search for "other than" therefore returns 39 envelopes
   * where the instrument has 40 — the missing one being a whole shotgun season
   * that would have been reported CLOSED to every shotgun hunter in the
   * Regina/Moose Jaw and Saskatoon zones.
   *
   * It was caught because the section tally and the envelope tally disagreed by
   * one and the difference was chased rather than rounded off. A count produced by
   * a pattern is guaranteed by that pattern; the only reason this one was visibly
   * wrong is that a second count existed to disagree with it.
   */
  "mule deer archery": "BOW_ONLY",
  "mule deer crossbow": "BOW_OR_CROSSBOW",
  "mule deer archery special": "BOW_ONLY",
  "mule deer crossbow special": "BOW_OR_CROSSBOW",
  "mule deer muzzle-loading firearm special": "THROUGH_MUZZLELOADER",
  "mule deer shotgun special": "THROUGH_SHOTGUN",
  "mule deer rifle special": "ALL_LAWFUL_MEANS",
  "antlerless mule deer archery special": "BOW_ONLY",
  "antlerless mule deer crossbow special": "BOW_OR_CROSSBOW",
  "antlerless mule deer muzzle-loading firearm special": "THROUGH_MUZZLELOADER",
  "antlerless mule deer shotgun special": "THROUGH_SHOTGUN",
  "antlerless mule deer rifle special": "ALL_LAWFUL_MEANS",

  /* Pronghorn antelope. */
  "pronghorn antelope archery special": "BOW_ONLY",
  "pronghorn antelope muzzle-loading firearm special": "THROUGH_MUZZLELOADER",
  "pronghorn antelope special": "ALL_LAWFUL_MEANS",
  "pronghorn antelope shotgun special": "THROUGH_SHOTGUN",
} as const;

/** The implements a season permits, by the regulation's own name for that season. */
export function implementsPermittedIn(seasonName: string): readonly SaskatchewanImplement[] {
  const envelope = SECTION_ENVELOPES[seasonName];
  if (!envelope) throw new Error(`No method envelope recorded for the "${seasonName}" open seasons`);
  return METHOD_ENVELOPES[envelope].permits;
}

/**
 * Whether one season's envelope contains another's.
 *
 * Used by the test that pins the ladder: within a species, each rung must permit
 * everything the rung below it permits. A regulation that broke that would be a
 * finding, not a bug in this file, and the test says which it is.
 */
export function envelopeContains(outer: string, inner: string): boolean {
  const wide = new Set(implementsPermittedIn(outer));
  return implementsPermittedIn(inner).every((implement) => wide.has(implement));
}

/**
 * One naming inconsistency in the regulation, recorded rather than smoothed.
 *
 * s. 41's envelope says "no person shall hunt MULE DEER by any means other than
 * the means prescribed …" while the section and every sibling in Part VI say
 * ANTLERLESS mule deer. It makes no difference to the permitted means, which is
 * why it is a note rather than an unresolved reading — but a future reader
 * comparing the species words across Part VI will find it, and should find it
 * already known.
 */
export const KNOWN_DRAFTING_INCONSISTENCIES: readonly string[] = [
  "s. 41(1), the antlerless mule deer rifle special season, states its species as “mule deer” where every sibling " +
    "subsection in Part VI says “antlerless mule deer”. The permitted means are unaffected.",
  "s. 35(1) is missing the word “than”: it reads “no person shall hunt mule deer by any means other a bow and " +
    "arrow, crossbow, muzzle-loading firearm or shotgun” where all 39 sibling envelopes read “other than”. The " +
    "meaning is not in doubt, but a term search for “other than” loses this envelope — and with it a whole " +
    "shotgun season — so the typo is recorded rather than read silently through.",
];
