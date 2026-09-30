#!/usr/bin/env node
/**
 * Build North Ground's Ontario major-game regulatory bundle.
 *
 *   node scripts/build-ontario-major-game.mjs           # rebuild and report
 *   node scripts/build-ontario-major-game.mjs --check   # fail if a source moved
 *
 * Major game differs from small game in one structural way: a season depends on
 * facts the hunter supplies. Ontario publishes deer seasons in three separate
 * tables by method, each with distinct resident and non-resident columns, and
 * "None" in a non-resident cell is a real closure rather than a gap. So a rule
 * here carries the dimension values it applies to, and the engine asks for them.
 *
 * As with small game, parsing is strict. A season phrase carrying a
 * qualification beyond its dates, an unreadable WMU token, or a table that has
 * moved all abort the build rather than producing a confident wrong answer.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  jurisdictionToday, readPreviousBundle, retrievedAtFor,
  diffBundles, expandWmuSpec, extractFootnotes, extractTables, fetchOfficialWmuIdentifiers,
  fetchText, formatBundleDiff, parseWmuCell, slug, zoneCanonicalId,
} from "./ontario-source.mjs";

/**
 * Implements, not table headings.
 *
 * Ontario's season tables grant a SET of implements, and per-unit footnotes take
 * some away: footnote 1 removes rifles from units listed under a table headed
 * "Rifles, shotguns, muzzle-loading guns and bows". Modelling the heading as a
 * single method would tell a hunter in WMU 65 that a rifle is fine when the
 * source says it is not, so a rule carries the set that actually applies to it.
 */
const IMPLEMENTS = {
  RIFLE: "RIFLE", SHOTGUN: "SHOTGUN", MUZZLELOADER: "MUZZLELOADER", BOW: "BOW", CROSSBOW: "CROSSBOW",
};

/**
 * ONTARIO'S "BOW" IS A CLASS CONTAINING TWO IMPLEMENTS, AND OMITTING ONE
 * UNDERSTATED THE LAW.
 *
 * The chain, read from the instruments rather than from the guide:
 *
 *   O. Reg. 670/98, Tables 1/5/8, column "Class of Firearm" — a NUMBER.
 *   O. Reg. 670/98 s. 6 — that number is the class prescribed by O. Reg.
 *     665/98 s. 69.
 *   O. Reg. 665/98 s. 69, Table — "Class 1 … Bow"; classes 2, 3 and 7 also
 *     contain Bow; classes 4, 5 and 6 do not.
 *   O. Reg. 665/98 s. 82 — "A person shall not hunt big game with a bow
 *     unless it is a CROSSBOW OR LONG-BOW", with draw weights of at least 45 kg
 *     (crossbow) or 18 kg (long-bow) for deer, and 54 kg or 22 kg for bear,
 *     American elk and moose.
 *   O. Reg. 665/98 s. 79(1)(b) — for wild turkey, likewise "a crossbow or
 *     long-bow", at 45 kg and 18 kg (s. 79(3)).
 *
 * So every Ontario season granting a bow grants both. Listing only BOW told a
 * hunter filtering for a crossbow that there was no opportunity where the law
 * provides one — North Ground's "no results" standing exactly where the law's
 * answer belongs. §8 names that the over-strict failure and says nobody ever
 * reports it, because a refusal always looks defensible. The opposite error any
 * hunter who reads the regulations would catch; this one is invisible to them.
 *
 * WHY WIDENING IS SAFE HERE AND IS NOT SAFE IN QUÉBEC. `gear-class.ts` records
 * that Québec's types 11 and 12 share their entire bow-and-crossbow definition
 * while only type 11 is exempt from hunter orange, so a method list holding
 * both cannot tell which applies. Ontario's exemption is scoped to the SEASON,
 * not the implement — s. 26 (1) (a) exempts "the seasons restricted to the use
 * of bows only", and s. 82 puts both implements inside "bows". Nothing in
 * Ontario's orange rule turns on which of the two a hunter draws.
 */
const BOWS = [IMPLEMENTS.BOW, IMPLEMENTS.CROSSBOW];

const ALL_IMPLEMENTS = [IMPLEMENTS.RIFLE, IMPLEMENTS.SHOTGUN, IMPLEMENTS.MUZZLELOADER, ...BOWS];

/**
 * How a footnote changes the rule it is attached to.
 *
 * Matched on the authority's exact wording. Anything unrecognised aborts the
 * build: a footnote North Ground cannot classify may be the one that makes the
 * answer wrong, and silently ignoring it is the failure this whole file exists
 * to prevent.
 */
const FOOTNOTE_EFFECTS = [
  {
    match: /^indicates that rifles are not permitted/i,
    effect: { kind: "REMOVE_IMPLEMENTS", implements: [IMPLEMENTS.RIFLE] },
  },
  {
    // Bear, WMU 7A. Unlike the deer footnote this REPLACES the permitted set
    // rather than subtracting from it, because the table it sits under names no
    // implements at all.
    match: /^only bows and muzzle-loading guns are permitted in wmu/i,
    effect: { kind: "SET_IMPLEMENTS", implements: [IMPLEMENTS.MUZZLELOADER, ...BOWS] },
  },
  {
    // Bear, WMUs 82A and 84: legal only inside named geographic townships,
    // whose boundaries North Ground does not hold.
    match: /^indicates bear hunting is only permitted in the geographic townships/i,
    effect: { kind: "GEOGRAPHIC_EXCLUSION" },
  },
  {
    // Moose: in the units carrying it, a "bow tag" is valid for the bows and
    // muzzle-loading guns season instead. That changes which tag opens which
    // season, so it travels as a caveat rather than being applied silently.
    match: /^for these wmus\s*,?\s*.bow tags. are for the bows and muzzle-loading guns only season/i,
    effect: { kind: "GEOGRAPHIC_EXCLUSION" },
  },
  {
    match: /^excluding parts of wmus? .* algonquin provincial park/i,
    // A boundary inside a boundary. North Ground holds WMU geometry, not the
    // park's, so this cannot be evaluated and must travel as a caveat.
    effect: { kind: "GEOGRAPHIC_EXCLUSION" },
  },
];

function classifyFootnote(text) {
  const found = FOOTNOTE_EFFECTS.find((entry) => entry.match.test(text));
  if (!found) throw new Error(`Unclassified footnote, refusing to publish: "${text}"`);
  return found.effect;
}

const OUTPUT = "content/regulatory/ca-on-major-game-2026.json";
const SOURCE_YEAR = 2026;
const SOURCE_VERSION = "2026";

const DOCUMENT = "https://www.ontario.ca/document/ontario-hunting-regulations-summary";

/**
 * The published season tables North Ground certifies.
 *
 * `dimensions` names what each table's columns turn on. The headings are matched
 * exactly: if Ontario renames or restructures one, the build stops rather than
 * guessing which table replaced it.
 */
/**
 * Ontario's legal animal classes for deer, from the provisions that define them.
 *
 * NOT FROM A SEASON LABEL. Ontario's deer seasons are named for the implement —
 * "gun season", "archery season", "muzzle-loader season" — and none of them
 * names a class. The class comes from the tag provision, which states what the
 * tag is valid for, and from the definitions the summary publishes:
 *
 *   ANTLERED   "a deer with at least 1 antler of at least 7.5 centimetres long"
 *   ANTLERLESS "deer with no antlers or with both antlers less than 7.5
 *               centimetres long, which generally include adult female deer and
 *               fawns of both sexes"
 *
 * THE WORD "GENERALLY" IS WHY ANTLERLESS IS NOT A SEX. A buck that has dropped
 * its antlers, or whose antlers are under the threshold, is antlerless in
 * Ontario by Ontario's own wording. §16 keeps biological sex separate from a
 * source-defined class, and here the source itself hedges.
 *
 * ANTLERLESS is carried as the NEGATION rather than as a second threshold, so
 * the two classes cannot drift apart and the boundary stays exactly where the
 * province put it: an antler of precisely 7.5 cm is antlered and is not
 * antlerless.
 */
const ONTARIO_DEER_CLASSES = [
  {
    id: "legal_animal_class:ca-on-deer-antlered",
    statedAs: "antlered",
    statedLanguage: "en",
    appliesToSpecies: ["species:white-tailed-deer"],
    criterionStatus: "STATED",
    criterion: {
      measure: "ANTLER_LENGTH",
      /* "at least 7.5 centimetres" — inclusive. Alberta's "exceeding 10.2 cm"
         is the other comparator, and normalising them would move a boundary. */
      comparator: "AT_LEAST",
      published: [{ value: 7.5, unit: "cm" }],
      /* "at least 1 antler" — the test reads over either side, not both. */
      aggregation: "ANY_SIDE",
      statedAs: "a deer with at least 1 antler of at least 7.5 centimetres long",
      statedLanguage: "en",
      sourceId: "source:ca-on-deer-2026",
      sourceSection: "Deer hunting requirements",
    },
    sourceId: "source:ca-on-deer-2026",
  },
  {
    id: "legal_animal_class:ca-on-deer-antlerless",
    statedAs: "antlerless",
    statedLanguage: "en",
    appliesToSpecies: ["species:white-tailed-deer"],
    criterionStatus: "BY_NEGATION",
    negates: "legal_animal_class:ca-on-deer-antlered",
    sourceId: "source:ca-on-deer-2026",
  },
];


/* ── Windows, from the instrument that prescribes them ────────────────────── */

/**
 * O. Reg. 670/98's own seasons, joined onto the certified rules.
 *
 * The certified rules are organised by season NAME, tag type and footnote
 * effect; the instrument's are organised by table item and residency. Same
 * seasons, two groupings — which is the two-homes shape that has produced most
 * of this week's defects, so a correspondence that cannot be DERIVED is treated
 * as evidence the groupings differ rather than as noise to resolve.
 *
 * **THE REFUSAL DIRECTION IS THE POINT.** A certified rule the instrument
 * cannot account for keeps its current answer and gains no window. Not a nearby
 * window, not an inferred one, not the table's closest match. A rule silently
 * acquiring the wrong season is the worst outcome available here, because it
 * would look complete and be wrong about dates — and dates are the dimension a
 * hunter checks least sceptically.
 *
 * The join key is (species, every unit in the group, residency, and the EXACT
 * set of derived windows). The certified prose carries no year — "September 19
 * to December 15" — so it can only be matched against dates the instrument
 * derived, which is what supplies the year.
 */
const EXTRACTED = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "content", "regulatory", "extracted", "ca-on-open-seasons-2026.json"), "utf8"),
);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * A certified season phrase as month-day pairs, or null where it does not read.
 *
 * "October 1 to November 1 November 16 to December 15" is two windows run
 * together — the builder stores them that way — so a boundary is a day number
 * followed by a month name.
 */
function proseWindows(phrase) {
  if (!phrase) return null;
  const parts = String(phrase).trim().split(/(?<=\d)\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean);
  const windows = [];
  for (const part of parts) {
    const match = /^([A-Z][a-z]+) (\d{1,2}) to ([A-Z][a-z]+) (\d{1,2})$/.exec(part);
    if (!match) return null;
    const from = MONTH_NAMES.indexOf(match[1]) + 1;
    const to = MONTH_NAMES.indexOf(match[3]) + 1;
    if (from < 1 || to < 1) return null;
    windows.push(`${String(from).padStart(2, "0")}-${match[2].padStart(2, "0")}/${String(to).padStart(2, "0")}-${match[4].padStart(2, "0")}`);
  }
  return windows.length ? windows : null;
}

const derivedKey = (rule) => rule.windows.map((window) => `${window.opensIso.slice(5)}/${window.closesIso.slice(5)}`);

const EXTRACTED_BY_UNIT = (() => {
  const index = new Map();
  for (const rule of EXTRACTED.rules) {
    for (const designation of rule.designations) {
      const key = `${rule.speciesId}|${designation}`;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(rule);
    }
  }
  return index;
})();

/**
 * The instrument rule that accounts for a certified rule, or a refusal reason.
 *
 * Every unit in the certified group must be covered by the SAME instrument rule.
 * A group split across two table items is a different grouping, not a partial
 * match, and taking either half would give some units a season the instrument
 * puts elsewhere.
 */
export function instrumentWindowsFor({ speciesId, units, residency, seasonPhrase, declaredNoSeason }) {
  if (!units.length) return { refused: "NO_GROUP_UNITS" };

  const candidates = (EXTRACTED_BY_UNIT.get(`${speciesId}|${units[0]}`) ?? []).filter((rule) =>
    units.every((unit) => rule.designations.includes(unit))
    && (rule.appliesWhen.RESIDENCY === residency || rule.appliesWhen.RESIDENCY === "RESIDENT_AND_NON_RESIDENT"
        || residency === null));
  if (!candidates.length) return { refused: "NO_CANDIDATE_COVERING_EVERY_UNIT" };

  if (declaredNoSeason) {
    /*
     * SEVERAL CANDIDATES ALL SAYING CLOSED IS AGREEMENT, NOT AMBIGUITY.
     *
     * A unit can appear in more than one table item — different seasons, same
     * ground — and a non-resident closure is often stated in each. The first
     * version refused whenever more than one closed candidate existed, which
     * cost ten rules a confirmation they all agreed on. A closure has no dates
     * to get wrong, so the risk the refusal guards against is not present.
     *
     * What DOES refuse: any candidate covering these units and this residency
     * that states a season. Then the instrument and the certified rule disagree
     * about whether anything is open, and that is a conflict to look at rather
     * than resolve here.
     */
    const open = candidates.filter((rule) => !rule.declaredNoSeason);
    if (open.length) return { refused: "INSTRUMENT_STATES_A_SEASON" };
    const closed = candidates.filter((rule) => rule.declaredNoSeason);
    if (!closed.length) return { refused: "INSTRUMENT_STATES_NEITHER" };
    return { matched: closed[0], windows: [], confirmedBy: closed.map((rule) => rule.sourceSection) };
  }

  const wanted = proseWindows(seasonPhrase);
  if (!wanted) return { refused: "CERTIFIED_PROSE_UNREADABLE" };
  const exact = candidates.filter((rule) => {
    const derived = derivedKey(rule);
    return derived.length === wanted.length && derived.every((value, index) => value === wanted[index]);
  });
  /* Two instrument rules producing the same dates for the same units and
     residency would mean the join key does not identify a season; refusing is
     the only answer that cannot be wrong. */
  if (exact.length !== 1) return { refused: exact.length ? "AMBIGUOUS_WINDOW_MATCH" : "NO_WINDOW_MATCHING_THE_CERTIFIED_PROSE" };
  return { matched: exact[0], windows: exact[0].windows };
}

const SPECIES = [
  {
    speciesId: "species:white-tailed-deer",
    legalAnimalClasses: ONTARIO_DEER_CLASSES,
    /*
     * What the base tag is valid for, stated by the authority: "The deer tag
     * included with the purchase of a deer licence is valid for 1 antlered deer
     * in any WMU with an open season."
     *
     * ANTLERLESS is real and is not on this list, because it is not what this
     * rule grants: it needs a tag that says so — the antlerless draw, an
     * additional deer tag, or party hunting with someone holding one. That is
     * an authorization fact and it lives in the `deer-antlerless` condition,
     * where it already is.
     */
    animalClasses: ["ANTLERED"],
    /* WHICH antlered — the 7.5 cm class, named rather than inferred from the
       word. Québec's « avec bois » flattens to ANTLERED too and is a different
       test; the link belongs on the rule, not in a string match. */
    legalAnimalClassIds: ["legal_animal_class:ca-on-deer-antlered"],
    page: "white-tailed-deer",
    sourceId: "source:ca-on-deer-2026",
    sourceTitle: "White-tailed deer — Ontario Hunting Regulations Summary",
    tables: [
      {
        heading: "Rifles, shotguns, muzzle-loading guns and bows",
        label: "gun season",
        implements: ALL_IMPLEMENTS,
        residencyColumns: true,
      },
      {
        heading: "Muzzle-loading guns and bows",
        label: "muzzle-loader season",
        implements: [IMPLEMENTS.MUZZLELOADER, ...BOWS],
        residencyColumns: true,
      },
      {
        heading: "Bows only",
        label: "archery season",
        implements: [...BOWS],
        residencyColumns: true,
      },
    ],
    /**
     * Season tables on this page that North Ground deliberately does not
     * certify. Each needs a reason, and their content is still hashed so a
     * change to one triggers review even though no rule comes from it.
     */
    excludedTables: [
      {
        heading: "Controlled deer hunt seasons (with hunt codes)",
        reason:
          "Controlled hunts are drawn per hunt code and are not open to a hunter by location and " +
          "date alone. Surfaced to readers by the deer-controlled condition instead.",
      },
    ],
    /** Conditions the season tables do not resolve, each with its own provenance. */
    conditions: [
      {
        id: "deer-licence",
        text:
          "A deer licence and the applicable seal or tag are required. North Ground cannot verify " +
          "what you hold; confirm your own licensing before hunting.",
        sourceSection: "Hunting licence information",
      },
      {
        id: "deer-antlerless",
        text:
          "Taking an antlerless deer generally requires an additional validated tag obtained through " +
          "the antlerless deer draw. North Ground does not evaluate draw outcomes or tag validation.",
        sourceSection: "Last year's antlerless deer draw results",
      },
      {
        id: "deer-controlled",
        text:
          "Some units also run controlled deer hunts with their own seasons and hunt codes. " +
          "North Ground has not certified those and they are not reflected in this result.",
        sourceSection: "Controlled deer hunt seasons (with hunt codes)",
      },
    ],
  },
  {
    speciesId: "species:wild-turkey",
    page: "wild-turkey",
    sourceId: "source:ca-on-wild-turkey-2026",
    sourceTitle: "Wild turkey — Ontario Hunting Regulations Summary",
    /**
     * Turkey publishes one season column for residents and non-residents alike,
     * and no rifle season at all. The spring season is limited to bearded
     * birds, which is a fact about the animal in front of you rather than about
     * the date, so it travels as a condition on the spring rules only.
     *
     * The "shotgun or bow" tables also admit a muzzle-loading gun, because the
     * law's "shotgun" does: O. Reg. 665/98 s. 79(1)(a) permits "a shotgun,
     * including a muzzle-loading shotgun of at least 20 gauge but not larger
     * than 10 gauge". A muzzle-loading RIFLE is not permitted. So the answer
     * "muzzle-loading gun" is conditional on the bore, not closed — it was
     * encoded as closed until 2026-09-21, which told a hunter with a legal
     * muzzle-loading shotgun that turkey was shut.
     */
    tables: [
      {
        heading: "Spring wild turkey season \u2014 shotgun or bow",
        label: "spring season",
        implements: [IMPLEMENTS.SHOTGUN, IMPLEMENTS.MUZZLELOADER, ...BOWS],
        residencyColumns: false,
        conditionIds: ["turkey-bearded", "turkey-muzzleloader-shotgun-only"],
      },
      {
        heading: "Fall wild turkey season \u2014 shotgun or bow",
        label: "fall shotgun season",
        implements: [IMPLEMENTS.SHOTGUN, IMPLEMENTS.MUZZLELOADER, ...BOWS],
        residencyColumns: false,
        conditionIds: ["turkey-muzzleloader-shotgun-only"],
      },
      {
        heading: "Fall wild turkey season \u2014 bow",
        label: "fall archery season",
        implements: [...BOWS],
        residencyColumns: false,
      },
    ],
    conditions: [
      {
        id: "turkey-licence",
        text:
          "A wild turkey licence and a valid turkey tag are required, and the season is one bird " +
          "per tag. North Ground cannot verify what you hold.",
        sourceSection: "Wild turkey licences and tags",
      },
      {
        id: "turkey-bearded",
        tableScoped: true,
        text:
          "The spring season is restricted to bearded turkeys. Identifying the bird before shooting " +
          "is the hunter's responsibility and North Ground cannot do it for you.",
        sourceSection: "Spring wild turkey season",
      },
      {
        id: "turkey-muzzleloader-shotgun-only",
        tableScoped: true,
        text:
          "A muzzle-loading gun is permitted only if it is a muzzle-loading shotgun of 10 to 20 gauge " +
          "loaded with shot size 4, 5, 6 or 7 (O. Reg. 665/98 s. 79(1)(a)). A muzzle-loading rifle is not permitted.",
        sourceSection: "Summary of firearms restrictions for hunting in Ontario",
      },
      {
        id: "turkey-mandatory-report",
        text:
          "Wild turkey harvests must be reported to the province. North Ground does not file reports.",
        sourceSection: "Reporting your wild turkey hunt",
      },
    ],
  },
  {
    speciesId: "species:american-black-bear",
    page: "black-bear",
    sourceId: "source:ca-on-black-bear-2026",
    sourceTitle: "Black bear \u2014 Ontario Hunting Regulations Summary",
    /**
     * Bear tables name no implements in their headings, so the default is every
     * implement and the footnotes narrow it: WMU 7A is bows and muzzle-loading
     * guns only, and two units are legal in named townships only.
     */
    tables: [
      {
        heading: "Spring black bear seasons",
        label: "spring season",
        implements: ALL_IMPLEMENTS,
        residencyColumns: false,
      },
      {
        heading: "Fall black bear seasons",
        label: "fall season",
        implements: ALL_IMPLEMENTS,
        residencyColumns: false,
      },
    ],
    conditions: [
      {
        id: "bear-licence",
        text:
          "A black bear licence and a valid bear tag are required for the wildlife management unit " +
          "you hunt in. North Ground cannot verify what you hold.",
        sourceSection: "Black bear licences and tags",
      },
      {
        id: "bear-cubs",
        text:
          "It is illegal to hunt a bear cub, or a female bear with a cub. Identification is the " +
          "hunter's responsibility and North Ground cannot make it for you.",
        sourceSection: "Black bear hunting rules",
      },
      {
        id: "bear-non-resident-outfitter",
        text:
          "Non-residents generally must hunt black bear through a licensed outfitter or on land they " +
          "own. North Ground has not certified which arrangement applies to you.",
        sourceSection: "Non-resident black bear hunting",
      },
    ],
  },
  {
    speciesId: "species:moose",
    page: "moose",
    sourceId: "source:ca-on-moose-2026",
    sourceTitle: "Moose \u2014 Ontario Hunting Regulations Summary",
    /**
     * Moose is gated by the TAG, not the implement. The province heads these
     * tables "seasons when gun tags are valid" and "season when bow tags are
     * valid": a person carrying a bow with no bow tag has no season here, so
     * the rule records the tag type the table is for and the engine asks which
     * tag was drawn. Every result stays conditional on a validated tag that
     * North Ground cannot see.
     *
     * The allocation tables on the same page are last year's draw quotas and
     * hunt codes, not seasons. They are not listed here, and the build refuses
     * any unlisted table that looks like a season.
     */
    tables: [
      {
        heading: "Rifles, shotguns, muzzle-loading guns and bows (the \"gun\" seasons when \"gun tags\" are valid)",
        label: "gun-tag season",
        implements: ALL_IMPLEMENTS,
        residencyColumns: true,
        appliesWhen: { TAG_TYPE: "GUN" },
      },
      {
        heading: "Bows and muzzle-loading guns only (seasons when bows and muzzle-loading guns only tags are valid)",
        label: "bow-and-muzzle-loader-tag season",
        implements: [IMPLEMENTS.MUZZLELOADER, ...BOWS],
        residencyColumns: true,
        appliesWhen: { TAG_TYPE: "BOW_MUZZLELOADER" },
      },
      {
        heading: "Bows only (season when \"bow tags\" are valid)",
        label: "bow-tag season",
        implements: [...BOWS],
        residencyColumns: true,
        appliesWhen: { TAG_TYPE: "BOW" },
      },
    ],
    excludedTables: [
      {
        heading: "Resident seasons with controlled hunter numbers",
        reason:
          "Controlled hunter numbers, including seasons restricted to hunters with a lower limb " +
          "disability and unit-specific rules. Eligibility is not decidable from location and date, " +
          "so these are surfaced by the moose-controlled condition rather than published as seasons.",
      },
    ],
    conditions: [
      {
        id: "moose-tag",
        text:
          "Every moose season requires a validated moose tag allocated through the province's tag " +
          "draw, and the tag determines both the season and the animal you may take. North Ground " +
          "does not evaluate draw applications, points or tag validation.",
        sourceSection: "Moose tag allocation process",
      },
      {
        id: "moose-calf",
        text:
          "A calf tag, a bull tag and a cow/calf tag permit different animals. Which one you hold " +
          "decides what is legal to take, and North Ground cannot verify it.",
        sourceSection: "Tag allocation process hunt codes",
      },
      {
        id: "moose-controlled",
        text:
          "Some units also run resident seasons with controlled hunter numbers, including seasons " +
          "for hunters with a lower limb disability and unit-specific rules. North Ground has not " +
          "certified those and they are not reflected in this result.",
        sourceSection: "Resident seasons with controlled hunter numbers",
      },
    ],
  },
];

/** A published cell meaning there is no season for that column. */
function isNoSeason(phrase) {
  return /^none$/i.test(phrase.trim());
}

/** One hash function for the bundle and for each of its sources. */
function sha256(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const previousBundle = readPreviousBundle(OUTPUT);
  const TODAY = jurisdictionToday();

  const officialIdentifiers = await fetchOfficialWmuIdentifiers();
  console.log(`Official Ontario units: ${officialIdentifiers.length}`);

  const groups = [];
  const rules = [];
  /* Certified rules the instrument could not account for, with the reason. */
  const windowRefusals = [];
  const sources = [];
  const hashParts = [];
  /** Hash inputs per published page, so a change is attributable to one source. */
  const hashPartsBySource = new Map();
  const recordHashPart = (sourceId, part) => {
    hashParts.push(part);
    if (!hashPartsBySource.has(sourceId)) hashPartsBySource.set(sourceId, []);
    hashPartsBySource.get(sourceId).push(part);
  };

  for (const species of SPECIES) {
    const url = `${DOCUMENT}/${species.page}`;
    console.log(`Fetching ${url}`);
    const pageHtml = await fetchText(url);
    const tables = extractTables(pageHtml);
    const footnoteText = extractFootnotes(pageHtml);

    // A page may carry tables North Ground has not certified — moose publishes
    // six allocation tables alongside its seasons. Ignoring them is correct;
    // ignoring a NEW season table would not be, so anything that looks like one
    // and is not declared stops the build.
    const declared = new Set(species.tables.map((table) => table.heading));
    for (const candidate of tables) {
      if (declared.has(candidate.heading)) continue;
      const header = (candidate.rows[0] ?? []).join(" ");
      if (!/open season/i.test(header)) continue;
      const excluded = (species.excludedTables ?? []).find((entry) => entry.heading === candidate.heading);
      if (!excluded) {
        throw new Error(
          `Undeclared season table on the ${species.page} page: "${candidate.heading}". ` +
          "Certify it or declare why it is excluded before publishing.",
        );
      }
      // Hashed even though no rule comes from it, so a change to an excluded
      // season still triggers review rather than passing unnoticed.
      recordHashPart(species.sourceId, `${species.page}|EXCLUDED|${candidate.heading}|${candidate.rows.map((r) => r.join("~")).join("\n")}`);
    }

    for (const table of species.tables) {
      const found = tables.find((candidate) => candidate.heading === table.heading);
      if (!found) throw new Error(`Table "${table.heading}" is no longer on the ${species.page} page`);

      const header = found.rows[0] ?? [];
      const dataRows = found.rows.filter((row) => row.length >= 2 && !/wildlife management unit/i.test(row[0]));
      if (!dataRows.length) throw new Error(`Table "${table.heading}" has no rows`);
      recordHashPart(species.sourceId, `${species.page}|${table.heading}|${found.rows.map((r) => r.join("~")).join("\n")}`);

      // Column order is read from the header rather than assumed.
      const residentColumn = header.findIndex((cell) => /^resident/i.test(cell));
      const nonResidentColumn = header.findIndex((cell) => /^non-?resident/i.test(cell));
      if (table.residencyColumns && (residentColumn < 1 || nonResidentColumn < 1)) {
        throw new Error(`Table "${table.heading}" no longer has the expected resident/non-resident columns`);
      }

      const tableImplements = table.implements;
      if (!tableImplements?.length) throw new Error(`No implement set declared for table "${table.heading}"`);

      for (const rowIndex of dataRows.keys()) {
        const row = dataRows[rowIndex];
        const rawRow = found.rawRows[found.rows.indexOf(row)];
        const spec = row[0];

        // Units in one row can carry different footnotes, so they are grouped by
        // the implement set and caveats that actually end up applying to them.
        const tokens = parseWmuCell(rawRow?.[0] ?? spec);
        const variants = new Map();
        for (const { token, footnotes } of tokens) {
          let permitted = [...tableImplements];
          const caveats = [];
          for (const id of footnotes) {
            const text = footnoteText.get(id);
            if (!text) throw new Error(`Footnote ${id} referenced under "${table.heading}" has no definition`);
            const effect = classifyFootnote(text);
            if (effect.kind === "REMOVE_IMPLEMENTS") {
              permitted = permitted.filter((item) => !effect.implements.includes(item));
            } else if (effect.kind === "SET_IMPLEMENTS") {
              permitted = [...effect.implements];
            } else {
              caveats.push(text);
            }
          }
          const key = `${permitted.join("+")}|${caveats.join("|")}`;
          if (!variants.has(key)) variants.set(key, { permitted, caveats, tokens: [] });
          variants.get(key).tokens.push(token);
        }

        for (const variant of variants.values()) {
          const variantSpec = variant.tokens.join(", ");
          const units = expandWmuSpec(variantSpec, officialIdentifiers);
          const groupId = `regulatory_group:ca-on-${slug(variantSpec)}`;
          if (!groups.some((group) => group.id === groupId)) {
            groups.push({
              id: groupId,
              jurisdictionId: "jurisdiction:ca-on",
              label: `Ontario WMU ${variantSpec}`,
              officialSpec: variantSpec,
              officialIdentifiers: units,
              zoneIds: units.map(zoneCanonicalId),
              sourceId: species.sourceId,
              sourceVersion: SOURCE_VERSION,
            });
          }

          const columns = table.residencyColumns
            ? [
                { residency: "RESIDENT", phrase: row[residentColumn] ?? "" },
                { residency: "NON_RESIDENT", phrase: row[nonResidentColumn] ?? "" },
              ]
            : [{ residency: null, phrase: row[1] ?? "" }];

          for (const column of columns) {
            if (!column.phrase) continue;
            const closed = isNoSeason(column.phrase);
            /*
             * The instrument's own window for this rule, or nothing. A refusal
             * leaves the rule exactly as it was — its prose season, no dates —
             * and is counted so the join can be read rather than trusted.
             */
            const joined = instrumentWindowsFor({
              speciesId: species.speciesId,
              units,
              residency: column.residency,
              seasonPhrase: closed ? null : column.phrase,
              declaredNoSeason: closed,
            });
            if (joined.refused) windowRefusals.push({ speciesId: species.speciesId, group: groupId, residency: column.residency, reason: joined.refused, phrase: closed ? null : column.phrase });
            rules.push({
              id: `regulatory_rule:ca-on-${slug(species.speciesId.replace("species:", ""))}` +
                `-${slug(table.label)}-${slug(variantSpec)}-${slug(variant.permitted.join("-"))}` +
                `-${slug(column.residency ?? "any")}-${SOURCE_VERSION}`,
              speciesId: species.speciesId,
              jurisdictionId: "jurisdiction:ca-on",
              regulatoryGroupId: groupId,
              // The facts this rule applies to. The engine asks for exactly these.
              appliesWhen: {
                permittedImplements: variant.permitted,
                ...(column.residency ? { RESIDENCY: column.residency } : {}),
                ...(table.appliesWhen ?? {}),
              },
              // What the province calls this season. Not a question — the date
              // decides it — but it says which season an answer came from.
              /* Only where the species record establishes it from a provision.
                 A species whose class the authority does not settle carries
                 none, and UNRESOLVED is the honest answer. */
              ...(species.animalClasses ? { animalClasses: species.animalClasses } : {}),
              ...(species.legalAnimalClassIds ? { legalAnimalClassIds: species.legalAnimalClassIds } : {}),
              seasonLabel: table.label,
              seasonPhrase: closed ? null : column.phrase,
              declaredNoSeason: closed,
              /* Both forms: the authority's rule and the date it produces for
                 the year named, so next year is a re-derivation. Absent where
                 the instrument does not account for this rule. */
              ...(joined.matched && closed ? {
                closureConfirmedBy: joined.confirmedBy,
                windowsSourceId: joined.matched.sourceId,
              } : {}),
              ...(joined.matched && !closed ? {
                windows: joined.windows.map((window) => ({
                  opensIso: window.opensIso,
                  closesIso: window.closesIso,
                  crossesYear: window.crossesYear,
                  statedAs: window.statedAs,
                })),
                windowsDerivedForYear: EXTRACTED.derivedForYear,
                windowsSourceId: joined.matched.sourceId,
                windowsSourceSection: joined.matched.sourceSection,
              } : {}),
              caveats: variant.caveats,
              // Species-wide conditions, plus the ones this particular season
              // carries. A condition marked `tableScoped` is defined once for
              // provenance but attaches only where a table names it — the
              // bearded-turkey rule is a spring rule, not a turkey rule.
              conditionIds: [
                ...species.conditions.filter((condition) => !condition.tableScoped).map((condition) => condition.id),
                ...(table.conditionIds ?? []),
              ],
              sourceId: species.sourceId,
              sourceSection: table.heading,
              sourceVersion: SOURCE_VERSION,
              sourceYear: SOURCE_YEAR,
              reviewStatus: "PUBLISHED",
            });
          }
        }
      }
    }

    sources.push({
      id: species.sourceId,
      authority: "Ontario Ministry of Natural Resources",
      title: species.sourceTitle,
      url,
      sourceVersion: SOURCE_VERSION,
      sourceYear: SOURCE_YEAR,
      // `tableScoped` is build-time bookkeeping; the published record carries
      // the condition itself and where it came from.
      conditions: species.conditions.map((condition) => ({
        id: condition.id,
        text: condition.text,
        sourceSection: condition.sourceSection,
        sourceId: species.sourceId,
      })),
    });
  }

  // The bundle hash still answers "did anything move?"; the per-source hashes
  // answer "which page moved?", which is what a reviewer actually needs when
  // four published pages feed one bundle.
  const contentHash = sha256(hashParts.join("\n\n"));

  /* The join, said out loud. A number nobody prints is a number nobody checks. */
  const withWindows = rules.filter((rule) => rule.windows?.length).length;
  const closures = rules.filter((rule) => rule.declaredNoSeason).length;
  process.stdout.write(`\n  O. Reg. 670/98 windows joined: ${withWindows} of ${rules.length} rules (${closures} declared closures, ${windowRefusals.length} refusals)\n`);
  const byReason = {};
  for (const entry of windowRefusals) byReason[entry.reason] = (byReason[entry.reason] ?? 0) + 1;
  for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`    ${reason.padEnd(38)} ${String(count).padStart(3)}\n`);
  }
  for (const entry of windowRefusals.filter((e) => !e.reason.includes("CLOSURE")).slice(0, 6)) {
    process.stdout.write(`      ${entry.speciesId.replace("species:", "").padEnd(20)} ${String(entry.residency ?? "-").padEnd(14)} ${JSON.stringify(entry.phrase)}\n`);
  }
  for (const entry of sources) {
    entry.contentHash = sha256((hashPartsBySource.get(entry.id) ?? []).join("\n\n"));
  }

  const bundle = {
    contractVersion: 1,
    generatedBy: "scripts/build-ontario-major-game.mjs",
    jurisdictionId: "jurisdiction:ca-on",
    sourceVersion: SOURCE_VERSION,
    sourceYear: SOURCE_YEAR,
    retrievedAt: retrievedAtFor(previousBundle, previousBundle?.contentHash, contentHash, TODAY),
    contentHash,
    officialUnitCount: officialIdentifiers.length,
    sources,
    /*
     * The legal animal classes live at the bundle ROOT, in one flat array —
     * the canonical shape (`physical-criterion.ts`). They were briefly hung
     * off each species' source record here while Québec keyed a map by
     * species: one fact, two shapes, in the same week. Neither had a consumer
     * yet, which is the only reason fixing it was free.
     */
    legalAnimalClasses: ONTARIO_DEER_CLASSES,
    groups,
    rules,
  };

  if (checkOnly) {
    let previous;
    try {
      previous = JSON.parse(readFileSync(OUTPUT, "utf8"));
    } catch {
      console.error("No existing major-game bundle to check against.");
      process.exit(1);
    }
    if (previous.contentHash !== contentHash) {
      console.error("An official major-game source has CHANGED since the bundle was built.");
      console.error(`  bundle : ${previous.contentHash}`);
      console.error(`  live   : ${contentHash}`);
      // Four published pages feed this bundle. Name the ones that actually moved.
      const previousBySource = new Map((previous.sources ?? []).map((entry) => [entry.id, entry.contentHash]));
      for (const entry of sources) {
        const before = previousBySource.get(entry.id);
        if (before !== entry.contentHash) {
          console.error(`  MOVED  ${entry.id}: ${before ?? "(not in bundle)"} -> ${entry.contentHash}`);
        }
      }
      // A moved hash alone does not tell a reviewer whether a season shifted or
      // a footnote appeared that removes an implement, so name the rules.
      const diff = diffBundles(previous, bundle);
      const affected = diff.added.length + diff.removed.length + diff.changed.length;
      if (affected) {
        console.error(`\n${affected} rule(s) affected:\n`);
        console.error(formatBundleDiff(diff));
      } else {
        console.error("\nNo rule changed: the source moved in a way that does not affect published rules.");
      }
      console.error("\nNothing has been published. Rebuild, review, and re-certify before promoting.");
      process.exit(2);
    }
    console.log(`Major-game sources unchanged (${contentHash.slice(0, 23)}...).`);
    return;
  }

  writeFileSync(OUTPUT, `${JSON.stringify(bundle, null, 2)}\n`);

  console.log("");
  console.log(`Wrote ${OUTPUT}`);
  console.log(`  content hash ${contentHash}`);
  console.log(`  groups       ${groups.length}`);
  console.log(`  rules        ${rules.length}`);
  for (const species of SPECIES) {
    const forSpecies = rules.filter((rule) => rule.speciesId === species.speciesId);
    const open = forSpecies.filter((rule) => !rule.declaredNoSeason);
    const closed = forSpecies.filter((rule) => rule.declaredNoSeason);
    const units = new Set(
      open.flatMap((rule) => groups.find((group) => group.id === rule.regulatoryGroupId).officialIdentifiers),
    );
    console.log(`    ${species.speciesId}`);
    console.log(`      rules with a season : ${open.length}`);
    console.log(`      rules stating None  : ${closed.length}`);
    console.log(`      units reached       : ${units.size} of ${officialIdentifiers.length}`);
  }
}

main().catch((error) => {
  console.error(`Build failed: ${error.message}`);
  process.exit(1);
});
