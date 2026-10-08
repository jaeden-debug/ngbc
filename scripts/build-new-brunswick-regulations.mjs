/**
 * New Brunswick's certified rules, derived from standing ordinal rules.
 *
 * WHY THIS PROVINCE NEEDS NO ANNUAL INGEST. Every window in Hunting Regulation
 * s. 11(1) ends in the word "annually" and is written as an ordinal over
 * weekdays — "eight consecutive weeks beginning on the first Monday in October",
 * "the third Monday in April until the last Saturday in June". Moose is defined
 * the same way: 94-47 s. 2 says "moose season", with reference to any year,
 * means the Tuesday, Wednesday, Thursday, Friday and Saturday of the last full
 * week of September. So the regulation is standing law and one build serves
 * every year until it is amended, where Newfoundland needs its Open Seasons
 * Order re-read each August.
 *
 * The dates are therefore DERIVED here, by `scripts/nb-dates.mjs`, and both
 * forms are stored: the ordinal rule the regulation states and the ISO dates it
 * produces for the certified span. Storing only the dates would lose the rule;
 * storing only the rule would make the bundle uncheckable.
 *
 * FOUR THINGS ABOUT NEW BRUNSWICK THAT ARE NOT NEWFOUNDLAND:
 *
 *  1. DEER IS THREE DIFFERENT ANSWERS BY ZONE, from s. 11.1 alone. No antlered
 *     season at all in zones 4, 5 and 9; antlered only, and five weeks instead
 *     of eight, in zones 1, 2 and 3; eight weeks elsewhere. This is the first
 *     Canadian bundle where the zone changes the LENGTH of a season rather than
 *     only its conditions.
 *
 *  2. THE FIRST THREE WEEKS ARE BOW OR CROSSBOW, AND THE CROSSBOW IS INCLUDED.
 *     s. 11.2 excepts "a bow or crossbow" — the opposite of Newfoundland, whose
 *     pre-season is long bow and compound bow and expressly not a crossbow. The
 *     two provinces would be encoded identically by anyone who assumed archery
 *     means one thing.
 *
 *  3. HUNTER ORANGE IS ITS OWN REGULATION WITH A MEASURABLE MINIMUM. 81-58
 *     s. 3(1): a solid hunter orange hat AND not less than 2 580 cm² above the
 *     waist, with "hunter orange" defined in Judd units on a HunterLab
 *     instrument. It applies only from 1 September to 31 December (s. 5), so it
 *     does NOT reach the spring bear season, and it is excepted for bow and
 *     crossbow deer hunters in the first three weeks ONLY when they are hunting
 *     from a tree stand or ground blind (s. 3(2)).
 *
 *  4. THE PROVINCE GAVE UP ITS SUNRISE TABLE. Old Act s. 34, "Times of sunrise
 *     and sunset", was repealed by 2021, c.12, s. 2 and replaced by s. 109.1,
 *     which makes a certificate from the Herzberg Astronomy and Astrophysics
 *     Research Centre or an ECCC climatologist proof of the time. So unlike Nova
 *     Scotia there is no table that is the law, our astronomy is the right
 *     instrument — and our computed value is not the legal proof, which is the
 *     strongest reason yet for the inward precision margin.
 *
 * Run: node scripts/build-new-brunswick-regulations.mjs
 */

import { writeFileSync } from "node:fs";
import {
  consecutiveWeeks, days, isoOf, lastDayOfMonth, lastFullWeekAgreed,
  lastWeekdayOfMonth, nthWeekdayOfMonth,
} from "./nb-dates.mjs";

const OUT = "content/regulatory/ca-nb-2026.json";

const ACT = "source:ca-nb-fish-and-wildlife-act";
const HUNTING = "source:ca-nb-hunting-regulation";
const MOOSE = "source:ca-nb-moose-hunting-regulation";
const ORANGE = "source:ca-nb-hunter-orange-regulation";
const REFUGES = "source:ca-nb-refuges-regulation";
const SIGNS = "source:ca-nb-posting-of-signs-regulation";
const WMZ_SERVICE = "source:ca-nb-wmz-service";

const RETRIEVED = "2026-09-30";
const SOURCE_VERSION =
  "N.B. Reg. 84-133 consolidated to 26 July 2024; N.B. Reg. 94-47 to 21 April 2026; " +
  "N.B. Reg. 81-58 to 24 August 2021; Fish and Wildlife Act SNB 1980 c. F-14.1";

/* ── Geography ──────────────────────────────────────────────────────────── */

/**
 * The 27 Wildlife Management Zones, as s. 12 of the Hunting Regulation
 * establishes them: "For the purposes of regulations respecting the hunting of
 * any wildlife, wildlife management zones are as follows: (a) wildlife
 * management zone 1 includes the part of the county of Madawaska described as
 * follows …". The province's GIS layer is its digital product of s. 12, and
 * s. 12 controls.
 */
const ALL_ZONES = Array.from({ length: 27 }, (_, index) => String(index + 1));

/** s. 11.1(3): antlered only, five weeks rather than eight. */
const DEER_FIVE_WEEK_ZONES = ["1", "2", "3"];
/** s. 11.1(1): "No person shall hunt antlered deer in wildlife management zone 4, 5 or 9." */
const DEER_NO_ANTLERED_ZONES = ["4", "5", "9"];
const DEER_EIGHT_WEEK_ZONES = ALL_ZONES.filter(
  (zone) => !DEER_FIVE_WEEK_ZONES.includes(zone) && !DEER_NO_ANTLERED_ZONES.includes(zone));

const zoneId = (designation) => `management_zone:ca-nb-wmz-${designation}`;

/* ── The derived year ───────────────────────────────────────────────────── */

const FIRST_MONDAY_OCTOBER = nthWeekdayOfMonth(2026, 10, 1, 1);
const FOURTH_MONDAY_OCTOBER = nthWeekdayOfMonth(2026, 10, 1, 4);
const MOOSE_WEEK = lastFullWeekAgreed(2026, 9);

const EIGHT_WEEKS = consecutiveWeeks(FIRST_MONDAY_OCTOBER, 8);
const FIVE_WEEKS = consecutiveWeeks(FIRST_MONDAY_OCTOBER, 5);
const BOW_ONLY_THREE_WEEKS = consecutiveWeeks(FIRST_MONDAY_OCTOBER, 3);
const MUZZLELOADER_WEEK = consecutiveWeeks(FIRST_MONDAY_OCTOBER + 7 * 7 * days, 1);
/* Week 4 is the first day a firearm may be used: s. 11.2 excepts only a bow or
   crossbow for the first three consecutive weeks. */
const FIREARM_OPENS = isoOf(FIRST_MONDAY_OCTOBER + 3 * 7 * days);
/* And week 8 is the muzzle-loader week, whose zones are a ministerial
   determination North Ground has not located, so every other method's season is
   certified only to the day before it opens. */
const BEFORE_MUZZLELOADER_WEEK = isoOf(FIRST_MONDAY_OCTOBER + 7 * 7 * days - days);

const DERIVED = {
  firstMondayInOctober2026: isoOf(FIRST_MONDAY_OCTOBER),
  deerEightWeeks: EIGHT_WEEKS,
  deerFiveWeeks: FIVE_WEEKS,
  bowOrCrossbowOnlyFirstThreeWeeks: BOW_ONLY_THREE_WEEKS,
  muzzleLoaderWeek: MUZZLELOADER_WEEK,
  mooseSeason2026: { opensIso: MOOSE_WEEK.tuesday, closesIso: MOOSE_WEEK.saturday },
  bearAutumn2026: { opensIso: "2026-09-01", closesIso: isoOf(nthWeekdayOfMonth(2026, 11, 6, 1)) },
  bearSpring2027: {
    opensIso: isoOf(nthWeekdayOfMonth(2027, 4, 1, 3)),
    closesIso: isoOf(lastWeekdayOfMonth(2027, 6, 6)),
  },
  octoberToEndOfFebruary: { opensIso: "2026-10-01", closesIso: isoOf(lastDayOfMonth(2027, 2)) },
  octoberToEndOfDecember: { opensIso: "2026-10-01", closesIso: "2026-12-31" },
  januaryToSaturdayBeforeLastFullWeekOfSeptember2027: {
    opensIso: "2027-01-01", closesIso: lastFullWeekAgreed(2027, 9).saturdayBefore,
  },
  pheasantTwoWeeks: consecutiveWeeks(FOURTH_MONDAY_OCTOBER, 2),
};

/* ── Rules ──────────────────────────────────────────────────────────────── */

const geography = (statedAs, designations) => ({
  statedAs,
  include: { ghas: designations, gbhz: [], special: [] },
  exclude: { ghas: [], special: [] },
});

const BASE = [
  "ca-nb-licence-required",
  "ca-nb-no-night-hunting",
  "ca-nb-no-light",
  "ca-nb-firearm-setback",
  "ca-nb-no-impaired-hunting",
];
const BIG_GAME = [...BASE, "ca-nb-no-dogs-big-game", "ca-nb-bow-minimums", "ca-nb-hunter-orange"];
const DEER = [...BIG_GAME, "ca-nb-deer-licence-class", "ca-nb-deer-one-zone", "ca-nb-deer-tag"];
const SMALL_GAME = [...BASE, "ca-nb-small-game-licence-class"];

function rule({ id, speciesId, group, statedAs, designations, method, seasonPhrase, windows, limits, conditionIds, section, sourceId = HUNTING, notes = [], closureBasis }) {
  return {
    id: `regulatory_rule:ca-nb-2026-${id}`,
    speciesId,
    regulatoryGroupId: group,
    geography: geography(statedAs, designations),
    appliesWhen: method ? { permittedImplements: method } : {},
    seasonLabel: windows.length ? "Open season" : "No open season",
    seasonPhrase,
    windows,
    declaredNoSeason: windows.length === 0,
    limits,
    conditionIds,
    caveats: [],
    notes,
    disputes: [],
    sourceId,
    sourceSection: section,
    sourceVersion: SOURCE_VERSION,
    reviewStatus: "VERIFIED",
    ...(closureBasis ? { closureBasis } : {}),
  };
}

const window = (pair, statedAs) => ({ opensIso: pair.opensIso, closesIso: pair.closesIso, statedAs });

const ALL_METHODS = ["FIREARM", "MUZZLELOADER", "BOW", "CROSSBOW"];
const ARCHERY = ["BOW", "CROSSBOW"];
const FIREARMS = ["FIREARM", "MUZZLELOADER"];

const GROUPS = [
  { id: "regulatory_group:ca-nb-2026-province", officialSpec: "Every Wildlife Management Zone established by s. 12 of the Hunting Regulation", zoneIds: ALL_ZONES.map(zoneId) },
  { id: "regulatory_group:ca-nb-2026-deer-eight-week", officialSpec: "The Wildlife Management Zones s. 11.1 neither shortens nor closes to antlered deer", zoneIds: DEER_EIGHT_WEEK_ZONES.map(zoneId) },
  { id: "regulatory_group:ca-nb-2026-deer-five-week", officialSpec: "Wildlife Management Zones 1, 2 and 3 — s. 11.1(3), antlered deer only, five weeks", zoneIds: DEER_FIVE_WEEK_ZONES.map(zoneId) },
  { id: "regulatory_group:ca-nb-2026-deer-no-antlered", officialSpec: "Wildlife Management Zones 4, 5 and 9 — s. 11.1(1), no antlered deer season", zoneIds: DEER_NO_ANTLERED_ZONES.map(zoneId) },
];
const [PROVINCE, DEER_8, DEER_5, DEER_NONE] = GROUPS.map((group) => group.id);

const NO_LIMIT = { statedAs: "The regulation states no bag limit for this species" };

/** A species whose season is the same everywhere, with no method distinction. */
const provincial = (id, speciesId, phrase, windows, section, conditionIds = SMALL_GAME, limits = NO_LIMIT, notes = []) =>
  rule({
    id, speciesId, group: PROVINCE, statedAs: "Province-wide — every Wildlife Management Zone",
    designations: ALL_ZONES, method: ALL_METHODS, seasonPhrase: phrase, windows, limits, conditionIds, section, notes,
  });

const RULES = [
  /* ── White-tailed deer: three answers by zone, two by method ── */
  rule({
    id: "deer-archery-eight-week", speciesId: "species:white-tailed-deer", group: DEER_8,
    statedAs: "Wildlife Management Zones other than 1, 2, 3, 4, 5 and 9 — bow or crossbow",
    designations: DEER_EIGHT_WEEK_ZONES, method: ARCHERY,
    seasonPhrase: "a period of eight consecutive weeks beginning on the first Monday in October annually",
    windows: [{ opensIso: EIGHT_WEEKS.opensIso, closesIso: BEFORE_MUZZLELOADER_WEEK, statedAs: "a period of eight consecutive weeks beginning on the first Monday in October annually" }],
    limits: { statedAs: "One antlered deer per class I or class III licence", bag: 1, section: "Hunting Regulation s. 5(2)" },
    conditionIds: [...DEER, "ca-nb-archery-first-three-weeks"],
    section: "Hunting Regulation s. 11(1)(a); s. 11.2",
    notes: [{ text: "The season the regulation grants runs eight weeks, to 29 November 2026. This rule is certified to 22 November because s. 3.11(1) reserves the eighth week to muzzle-loading firearms, in zones set by a ministerial determination North Ground has not located." }],
  }),
  rule({
    id: "deer-firearm-eight-week", speciesId: "species:white-tailed-deer", group: DEER_8,
    statedAs: "Wildlife Management Zones other than 1, 2, 3, 4, 5 and 9 — firearm",
    designations: DEER_EIGHT_WEEK_ZONES, method: FIREARMS,
    seasonPhrase: "a period of eight consecutive weeks beginning on the first Monday in October annually, except the first three weeks",
    windows: [{ opensIso: FIREARM_OPENS, closesIso: BEFORE_MUZZLELOADER_WEEK, statedAs: "the fourth to the seventh of the eight consecutive weeks beginning on the first Monday in October" }],
    limits: { statedAs: "One antlered deer per class I or class III licence", bag: 1, section: "Hunting Regulation s. 5(2)" },
    conditionIds: [...DEER],
    section: "Hunting Regulation s. 11(1)(a); s. 11.2; s. 3.11(1)",
    notes: [{ text: "s. 11.2 reserves the first three weeks to a bow or crossbow, so a firearm season opens in week four." }],
  }),
  rule({
    id: "deer-archery-five-week", speciesId: "species:white-tailed-deer", group: DEER_5,
    statedAs: "Wildlife Management Zones 1, 2 and 3 — bow or crossbow, antlered deer only",
    designations: DEER_FIVE_WEEK_ZONES, method: ARCHERY,
    seasonPhrase: "a period of five consecutive weeks only beginning on the first Monday in October annually",
    windows: [window(FIVE_WEEKS, "a period of five consecutive weeks only beginning on the first Monday in October annually")],
    limits: { statedAs: "One antlered deer per class I or class III licence", bag: 1, section: "Hunting Regulation s. 5(2)" },
    conditionIds: [...DEER, "ca-nb-archery-first-three-weeks", "ca-nb-antlered-only-zones-1-3"],
    section: "Hunting Regulation s. 11.1(3)",
  }),
  rule({
    id: "deer-firearm-five-week", speciesId: "species:white-tailed-deer", group: DEER_5,
    statedAs: "Wildlife Management Zones 1, 2 and 3 — firearm, antlered deer only",
    designations: DEER_FIVE_WEEK_ZONES, method: FIREARMS,
    seasonPhrase: "the fourth and fifth of the five consecutive weeks beginning on the first Monday in October",
    windows: [{ opensIso: FIREARM_OPENS, closesIso: FIVE_WEEKS.closesIso, statedAs: "the fourth and fifth of the five consecutive weeks beginning on the first Monday in October" }],
    limits: { statedAs: "One antlered deer per class I or class III licence", bag: 1, section: "Hunting Regulation s. 5(2)" },
    conditionIds: [...DEER, "ca-nb-antlered-only-zones-1-3"],
    section: "Hunting Regulation s. 11.1(3); s. 11.2",
  }),
  rule({
    id: "deer-no-antlered", speciesId: "species:white-tailed-deer", group: DEER_NONE,
    statedAs: "Wildlife Management Zones 4, 5 and 9",
    designations: DEER_NO_ANTLERED_ZONES, method: undefined,
    seasonPhrase: "No antlered deer season",
    windows: [], limits: { statedAs: "No antlered deer season" }, conditionIds: [],
    section: "Hunting Regulation s. 11.1(1)",
    /* s. 11.1(1) reads "No person shall hunt antlered deer in wildlife management
       zone 4, 5 or 9" (see above); this is North Ground's compression of it, and
       the tag says so rather than leaving a renderer to quote us. */
    closureBasis: { owner: "NORTH_GROUND", text: "closed to antlered deer" },
    notes: [{ text: "s. 11.1(1) closes these three zones to ANTLERED deer only. Whether antlerless deer may be hunted here turns on s. 11.1(2) and the annual quota the Minister sets per zone under s. 3.1(4.1), which the regulation does not publish and North Ground has not located — so no antlerless answer is given for these zones, in either direction." }],
  }),

  /* ── Moose: a five-day season, defined as a rule ── */
  rule({
    id: "moose", speciesId: "species:moose", group: PROVINCE,
    statedAs: "Province-wide — every Wildlife Management Zone",
    designations: ALL_ZONES, method: ALL_METHODS,
    seasonPhrase: "the Tuesday, Wednesday, Thursday, Friday and Saturday of the last full week of September",
    windows: [window(DERIVED.mooseSeason2026, "the Tuesday, Wednesday, Thursday, Friday and Saturday of the last full week of September")],
    limits: { statedAs: "One moose per licence", bag: 1, section: "Moose Hunting Regulation s. 20" },
    conditionIds: [...BIG_GAME, "ca-nb-moose-draw", "ca-nb-moose-quota-unknown"],
    section: "Moose Hunting Regulation s. 2, definition of “moose season”",
    sourceId: MOOSE,
    notes: [{ text: "Five days, not a week. The definition names Tuesday to Saturday and omits the Sunday and Monday of the same week." }],
  }),

  /* ── Black bear: two windows, and orange does not reach the spring one ── */
  rule({
    id: "bear", speciesId: "species:american-black-bear", group: PROVINCE,
    statedAs: "Province-wide — every Wildlife Management Zone",
    designations: ALL_ZONES, method: ALL_METHODS,
    seasonPhrase: "from the third Monday in April until the last Saturday in June, inclusive, annually and from the first day in September until the first Saturday in November, inclusive, annually",
    windows: [
      window(DERIVED.bearAutumn2026, "from the first day in September until the first Saturday in November, inclusive, annually"),
      window(DERIVED.bearSpring2027, "from the third Monday in April until the last Saturday in June, inclusive, annually"),
    ],
    limits: { statedAs: "One bear per licence; a non-resident may obtain a second licence after registering the first bear", bag: 1, section: "Hunting Regulation ss. 6(2.4), 3.2(19)" },
    conditionIds: [...BIG_GAME, "ca-nb-bear-no-sow-with-cubs", "ca-nb-bear-tags"],
    section: "Hunting Regulation s. 11(1)(a.1)",
    notes: [{ text: "Hunter orange is required in the autumn window and not in the spring one: the Hunter Orange Regulation applies only from 1 September to 31 December (s. 5)." }],
  }),

  /* ── Small game, all province-wide ── */
  provincial("hare", "species:snowshoe-hare",
    "from the first day in October until the last day in February, inclusive, annually",
    [window(DERIVED.octoberToEndOfFebruary, "from the first day in October until the last day in February, inclusive, annually")],
    "Hunting Regulation s. 11(1)(b)", [...SMALL_GAME, "ca-nb-hare-dogs"], NO_LIMIT,
    [{ text: "The regulation's own term is “varying hare”, which is this species under its older name." }]),
  provincial("raccoon", "species:raccoon",
    "from the first day in October until the last day in December, inclusive, annually",
    [window(DERIVED.octoberToEndOfDecember, "from the first day in October until the last day in December, inclusive, annually")],
    "Hunting Regulation s. 11(1)(b.2)", [...SMALL_GAME, "ca-nb-raccoon-at-night"]),
  provincial("skunk", "species:striped-skunk",
    "from the first day in October until the last day in December, inclusive, annually",
    [window(DERIVED.octoberToEndOfDecember, "from the first day in October until the last day in December, inclusive, annually")],
    "Hunting Regulation s. 11(1)(b.3)"),
  provincial("ruffed-grouse", "species:ruffed-grouse",
    "from the first day in October until the last day in December, inclusive, annually",
    [window(DERIVED.octoberToEndOfDecember, "from the first day in October until the last day in December, inclusive, annually")],
    "Hunting Regulation s. 11(1)(e)"),
  provincial("spruce-grouse", "species:spruce-grouse",
    "from the first day in October until the last day in December, inclusive, annually",
    [window(DERIVED.octoberToEndOfDecember, "from the first day in October until the last day in December, inclusive, annually")],
    "Hunting Regulation s. 11(1)(e)"),
  provincial("coyote", "species:coyote",
    "from the first day in January until the Saturday before the last full week of September, inclusive, annually and from the first day in October until the last day in December, inclusive, annually",
    [
      window(DERIVED.octoberToEndOfDecember, "from the first day in October until the last day in December, inclusive, annually"),
      window(DERIVED.januaryToSaturdayBeforeLastFullWeekOfSeptember2027, "from the first day in January until the Saturday before the last full week of September, inclusive, annually"),
    ],
    "Hunting Regulation s. 11(1)(c)"),
  provincial("crow", "species:american-crow",
    "from the first day in January until the Saturday before the last full week of September, inclusive, annually and from the first day in October until the last day in December, inclusive, annually",
    [
      window(DERIVED.octoberToEndOfDecember, "from the first day in October until the last day in December, inclusive, annually"),
      window(DERIVED.januaryToSaturdayBeforeLastFullWeekOfSeptember2027, "from the first day in January until the Saturday before the last full week of September, inclusive, annually"),
    ],
    "Hunting Regulation s. 11(1)(c)"),
  provincial("pheasant", "species:ring-necked-pheasant",
    "male ring-necked pheasant for a period of two consecutive weeks beginning on the fourth Monday in October annually",
    [window(DERIVED.pheasantTwoWeeks, "a period of two consecutive weeks beginning on the fourth Monday in October annually")],
    "Hunting Regulation s. 11(1)(c.2)", [...SMALL_GAME, "ca-nb-pheasant-male-only", "ca-nb-pheasant-implements"]),
];

/* ── Conditions ─────────────────────────────────────────────────────────── */

const condition = (id, scope, text, sourceId, sourceSection, extra = {}) => ({ id, scope, text, sourceId, sourceSection, ...extra });

const CONDITIONS_BY_SOURCE = {
  [ACT]: [
    condition("ca-nb-licence-required", "JURISDICTION",
      "A licence issued under the Fish and Wildlife Act or its regulations is required to hunt any wildlife, and it must authorize the species you are hunting.",
      ACT, "Fish and Wildlife Act ss. 34(2)(a), 34(2)(b)"),
    condition("ca-nb-no-night-hunting", "JURISDICTION",
      "Hunting at night is an offence. “Night” is defined as the period from half an hour after sunset to half an hour before sunrise the following day, so the lawful window is half an hour before sunrise to half an hour after sunset.",
      ACT, "Fish and Wildlife Act s. 33(1)(a); s. 1, definition of “night”"),
    condition("ca-nb-no-light", "JURISDICTION",
      "Hunting with the assistance of a light is an offence, whether or not you intend to take an animal, and using a light capable of attracting or locating wildlife is prima facie proof of hunting.",
      ACT, "Fish and Wildlife Act ss. 33(1)(b), 108"),
    condition("ca-nb-no-dogs-big-game", "JURISDICTION",
      "Bear, moose, deer and fur bearing animals may not be hunted by means of, or while accompanied by, a dog.",
      ACT, "Fish and Wildlife Act s. 33(1)(c)"),
    condition("ca-nb-bow-minimums", "JURISDICTION",
      "A bow used for moose, deer or bear must draw at least 20 kg at or before a 70 cm draw, and a crossbow at least 20 kg. An arrow may not be poisoned, explosive or barbed, and its blade must be at least 20 mm at the widest point.",
      ACT, "Fish and Wildlife Act s. 43.2 and the arrow provisions preceding it"),
    condition("ca-nb-no-impaired-hunting", "JURISDICTION",
      "Hunting while your ability to hunt or handle a firearm safely is impaired by alcohol or a drug is an offence.",
      ACT, "Fish and Wildlife Act s. 46.1"),
    condition("ca-nb-firearm-setback", "JURISDICTION",
      "Land posted under the Posting of Signs on Land Regulation, wildlife refuges and wildlife management areas are separate restrictions North Ground has not resolved for this point.",
      SIGNS, "Posting of Signs on Land Regulation, N.B. Reg. 89-106; Wildlife Refuges and Wildlife Management Areas Regulation, N.B. Reg. 94-43"),
  ],
  [HUNTING]: [
    condition("ca-nb-deer-licence-class", "JURISDICTION",
      "Antlered deer requires a class I licence (non-resident) or a class III licence (resident). Antlerless deer requires a class III licence bearing an antlerless deer authorization won in the random computer draw, applied for by the third Friday of August.",
      HUNTING, "Hunting Regulation ss. 5(1), 5(2.1), 3.1(2.2), 3.1(3)"),
    condition("ca-nb-deer-one-zone", "JURISDICTION",
      "A class I or class III licence authorizes one antlered deer in any ONE Wildlife Management Zone, and an antlerless authorization names the single zone it is valid in.",
      HUNTING, "Hunting Regulation ss. 5(2), 3.1(1)(b), 3.1(10)(b)(ii)"),
    condition("ca-nb-deer-tag", "JURISDICTION",
      "A deer must be tagged immediately with the tag associated with your own licence, in accordance with Schedule B, and the tag may not be removed.",
      HUNTING, "Hunting Regulation ss. 14(2), 14(3), 15(2)(a)"),
    condition("ca-nb-archery-first-three-weeks", "JURISDICTION",
      "For the first three consecutive weeks beginning on the first Monday in October, deer may be hunted only by means of a bow or crossbow.",
      HUNTING, "Hunting Regulation s. 11.2"),
    condition("ca-nb-antlered-only-zones-1-3", "ZONE",
      "In this zone only ANTLERED deer may be hunted, and the season is five consecutive weeks rather than eight.",
      HUNTING, "Hunting Regulation s. 11.1(3)",
      {
        zoneIds: DEER_FIVE_WEEK_ZONES.map(zoneId),
        speciesIds: ["species:white-tailed-deer"],
        note: "One of the two genuinely zone-scoped conditions in this bundle, and the scope is declared where the rule was read rather than inferred from how often it fires.",
      }),
    condition("ca-nb-small-game-licence-class", "JURISDICTION",
      "A class I, II, III or IV licence, or a minor's licence held by a resident aged 12 to 15 while accompanied by an adult, authorizes this species.",
      HUNTING, "Hunting Regulation s. 3(1)"),
    condition("ca-nb-hare-dogs", "JURISDICTION",
      "Varying hare may be hunted with or without a dog of any breed. The Minister may also permit a class III, class IV or minor's licence holder to use a dog of any breed for varying hare, except at night.",
      HUNTING, "Hunting Regulation ss. 11(1)(b), 3.03"),
    condition("ca-nb-raccoon-at-night", "JURISDICTION",
      "Raccoon is the one species New Brunswick authorizes at night, by permit. Without that authorization the general night prohibition applies, and the hunter orange requirement does not apply to a person authorized to hunt raccoons at night.",
      HUNTING, "Hunter Orange Regulation s. 4; Fish and Wildlife Act s. 33"),
    condition("ca-nb-pheasant-male-only", "JURISDICTION",
      "Only MALE ring-necked pheasant may be hunted; the season paragraph itself names the sex.",
      HUNTING, "Hunting Regulation s. 11(1)(c.2)",
      { speciesIds: ["species:ring-necked-pheasant"] }),
    condition("ca-nb-pheasant-implements", "JURISDICTION",
      "Ring-necked pheasant may be hunted only with a bow or crossbow, or a shotgun no larger than 10 gauge with shot no larger than number 2.",
      HUNTING, "Hunting Regulation s. 9.1",
      { speciesIds: ["species:ring-necked-pheasant"] }),
    condition("ca-nb-bear-no-sow-with-cubs", "JURISDICTION",
      "From the third Monday in April until the last day in June, a female bear accompanied by a cub or cubs may not be shot or killed.",
      HUNTING, "Hunting Regulation s. 6(3)",
      { speciesIds: ["species:american-black-bear"] }),
    condition("ca-nb-bear-tags", "JURISDICTION",
      "A bear must be tagged immediately in accordance with Schedule B, and a resident bear licence may not be used once its tags are spent.",
      HUNTING, "Hunting Regulation ss. 21.11(5), 21.11(6), 21.11(7)",
      { speciesIds: ["species:american-black-bear"] }),
  ],
  [ORANGE]: [
    condition("ca-nb-hunter-orange", "JURISDICTION",
      "From 1 September to 31 December you must wear a solid hunter orange hat AND, above the waist, a solid hunter orange or camouflage blaze orange exterior garment of which at least 2 580 cm² is exposed and clearly visible from all directions. Bow and crossbow deer hunters are excepted during the first three weeks of the deer season, but only while hunting from a tree stand or ground blind.",
      ORANGE, "Hunter Orange Regulation ss. 3(1), 3(2), 5",
      { note: "“Hunter orange” is defined instrumentally, not by name: an L value of at least +55.0 Judd units, an a value of at least +65.0 and a b value of at least +30.0 on a HunterLab colour measuring instrument. “Camouflage blaze orange” means a camouflage pattern at least 50% hunter orange." }),
  ],
  [MOOSE]: [
    condition("ca-nb-moose-draw", "JURISDICTION",
      "A resident moose licence is allocated by random computer draw, and the applicant names the one Wildlife Management Zone they wish to hunt in. There is a separate outfitter stream.",
      MOOSE, "Moose Hunting Regulation ss. 9(2), 10(3.1), 9.1(1)(b)",
      { speciesIds: ["species:moose"] }),
    condition("ca-nb-moose-quota-unknown", "JURISDICTION",
      "The Minister sets an annual moose quota for each Wildlife Management Zone, which may vary by zone. The regulation does not publish the figures and North Ground has not located them, so the number of licences available in this zone is unknown.",
      MOOSE, "Moose Hunting Regulation s. 5(1)",
      { speciesIds: ["species:moose"] }),
  ],
  [REFUGES]: [],
};

/* ── Sources ────────────────────────────────────────────────────────────── */

const READABLE_TERMS_UNSTATED = {
  accessState: "PUBLIC_READABLE",
  reuseState: "UNSTATED",
  archiveState: "UNCONFIRMED",
  derivedFactsState: "USABLE",
  termsStatus: "NOT_LOCATED",
  retrievalMethod: "OFFICIAL_HTML",
  lastVerified: RETRIEVED,
  authorityLevel: "PRIMARY_GOVERNMENT",
};

const SOURCES = [
  {
    id: ACT, title: "Fish and Wildlife Act, SNB 1980, c. F-14.1",
    url: "https://laws.gnb.ca/en/showdoc/cs/F-14.1",
    authority: "Government of New Brunswick",
    ...READABLE_TERMS_UNSTATED,
    conditions: CONDITIONS_BY_SOURCE[ACT],
    note: "Carries the closed world (s. 34(2)), the night prohibition (s. 33(1)(a)) and the definition of “night” that the legal window is derived by inverting. Old s. 34, “Times of sunrise and sunset”, was repealed by 2021, c.12, s. 2 and replaced by s. 109.1, which makes a Herzberg Astronomy and Astrophysics Research Centre confirmation or an ECCC climatologist's certificate proof of the time — so there is no table that is the law here.",
  },
  {
    id: HUNTING, title: "Hunting Regulation – Fish and Wildlife Act, N.B. Reg. 84-133",
    url: "https://laws.gnb.ca/en/showdoc/cr/84-133",
    authority: "Lieutenant-Governor in Council, New Brunswick",
    ...READABLE_TERMS_UNSTATED,
    consolidatedAs: "26 July 2024",
    conditions: CONDITIONS_BY_SOURCE[HUNTING],
    note: "The season table is s. 11(1) and every window in it ends in “annually”. s. 12 establishes the 27 Wildlife Management Zones in words, and the province's GIS layer is its digital product of s. 12.",
  },
  {
    id: MOOSE, title: "Moose Hunting Regulation – Fish and Wildlife Act, N.B. Reg. 94-47",
    url: "https://laws.gnb.ca/en/showdoc/cr/94-47",
    authority: "Lieutenant-Governor in Council, New Brunswick",
    ...READABLE_TERMS_UNSTATED,
    consolidatedAs: "21 April 2026",
    conditions: CONDITIONS_BY_SOURCE[MOOSE],
  },
  {
    id: ORANGE, title: "Hunter Orange Regulation – Fish and Wildlife Act, N.B. Reg. 81-58",
    url: "https://laws.gnb.ca/en/showdoc/cr/81-58",
    authority: "Lieutenant-Governor in Council, New Brunswick",
    ...READABLE_TERMS_UNSTATED,
    consolidatedAs: "24 August 2021",
    conditions: CONDITIONS_BY_SOURCE[ORANGE],
  },
  {
    id: REFUGES, title: "Wildlife Refuges and Wildlife Management Areas Regulation, N.B. Reg. 94-43",
    url: "https://laws.gnb.ca/en/showdoc/cr/94-43",
    authority: "Lieutenant-Governor in Council, New Brunswick",
    ...READABLE_TERMS_UNSTATED,
    consolidatedAs: "5 June 2006",
    note: "Read; no geometry held for any refuge or management area it names, so it is a standing limitation rather than an encoded restriction.",
  },
  {
    id: SIGNS, title: "Posting of Signs on Land Regulation, N.B. Reg. 89-106",
    url: "https://laws.gnb.ca/en/showdoc/cr/89-106",
    authority: "Lieutenant-Governor in Council, New Brunswick",
    ...READABLE_TERMS_UNSTATED,
  },
  {
    id: WMZ_SERVICE, title: "OpenData/WMZ MapServer (Wildlife Management Zones)",
    url: "https://gis-erd-der.gnb.ca/server/rest/services/OpenData/WMZ/MapServer/0",
    authority: "New Brunswick Department of Natural Resources and Energy Development",
    authorityLevel: "PRIMARY_GOVERNMENT",
    accessState: "PUBLIC_READABLE", reuseState: "GRANTED", archiveState: "PERMITTED",
    derivedFactsState: "USABLE", termsStatus: "LOCATED",
    termsUrl: "https://www2.snb.ca/content/snb/en/products-and-services/open-data.html",
    retrievalMethod: "OFFICIAL_API", lastVerified: "2026-09-22",
    note: "The geography, under the New Brunswick Open Government Licence. 27 zones parity-certified 2026-09-22.",
  },
];

/* ── Absence ────────────────────────────────────────────────────────────── */

const ABSENCE = {
  meaning: "CLOSED",
  words: {
    owner: "AUTHORITY",
    text: "Every person commits an offence who hunts wildlife, other than beaver, bobcat, fisher, marten, mink, otter, raccoon or red fox unless authorized by licence issued under this Act or the regulations.",
    sourceId: ACT,
    citation: "Fish and Wildlife Act, SNB 1980, c. F-14.1, s. 34(2)(a)",
    lang: "en-CA",
  },
  section: "Fish and Wildlife Act ss. 34(2)(a), 34(2)(b); Hunting Regulation s. 11(1)",
  sourceId: ACT,
  explanation:
    "New Brunswick's closed world is two provisions read together rather than one sentence. The Act makes hunting an offence without a licence authorizing it — s. 34(2)(a) for wildlife generally and s. 34(2)(b) for the eight species (a) excepts, so between them every species needs one. The Hunting Regulation then opens s. 11(1) with “Wildlife may be hunted as follows:” and enumerates. That is an exhaustive grant, not a list of examples, so a species or a period s. 11(1) does not name has no authorization behind it and is CLOSED.",
  negativeControl:
    "“close season” occurs ZERO times in the Act and “closed season” twelve, none of them a general prohibition — all twelve are evidentiary or offence provisions about particular species (beaver traps, possession of bear, moose or deer carcasses). There is no “closed season except by order” sentence to quote the way Newfoundland's s. 89 gives one, which is why the absence rests on two provisions.",
  theStandingLimitOnEveryClosedClaim: {
    citation: "Fish and Wildlife Act s. 118 (regulation-making power); Hunting Regulation s. 3.1(4.1); Moose Hunting Regulation s. 5(1)",
    statedAs: "the Minister, if of the opinion that the population of antlerless deer does not support sustainable hunting of antlerless deer in a wildlife management zone, may establish a quota of zero for that wildlife management zone",
    whyItMatters:
      "New Brunswick delegates two figures to the Minister and publishes neither in the regulation: the antlerless deer quota per zone and the moose quota per zone. A quota of zero closes antlerless deer in a zone with no amendment to any regulation. So a closed antlerless answer here would rest on a determination North Ground cannot read, which is why none is given — in either direction.",
  },
};

/* ── Deliberate gaps ────────────────────────────────────────────────────── */

const NOT_ENCODED = [
  {
    what: "Antlerless deer, in every zone",
    reason: "MINISTERIAL QUOTA NOT PUBLISHED",
    detail:
      "The SEASON for antlerless deer is certain — s. 11(1)(a) gives it the same eight weeks as antlered deer. Everything else is not. s. 3.1 allocates antlerless authorizations by random computer draw per zone, s. 3.1(4) has the Minister set an annual quota range per zone, and s. 3.1(4.1) lets the Minister set a quota of ZERO, which closes the zone to antlerless deer without amending anything. The figures are published nowhere in the regulation. So the bundle answers for antlered deer and states the antlerless requirement as a condition, and gives no antlerless season or closure for any zone.",
  },
  {
    what: "The muzzle-loading firearm week",
    reason: "GEOGRAPHY IS A MINISTERIAL DETERMINATION",
    detail:
      "s. 3.11(1) reserves the week beginning the seventh Monday after the first Monday in October — 23 to 29 November 2026 — to hunters using a muzzle-loading firearm with a muzzle-loading authorization, and only “in a wildlife management zone referred to in subsection 11.1(4)”, which is the set of zones where antlerless deer may be hunted. That set depends on the unpublished quota. So every deer rule here is certified to 22 November rather than to the 29th the eight-week grant reaches, and the final week is left unresolved rather than claimed for any method.",
  },
  {
    what: "Squirrel",
    reason: "SOURCE NAMES NO SPECIES",
    detail:
      "s. 11(1)(b.1) gives “squirrel” a season from 1 October to the last day in February and does not say which. North Ground's catalogue carries American red squirrel and eastern grey squirrel as separate species, and encoding the season against either one would narrow or widen what the regulation says. Recorded rather than guessed.",
  },
  {
    what: "Cormorant",
    reason: "SOURCE NAMES NO SPECIES, AND ONE WINDOW IS FEDERAL",
    detail:
      "s. 11(1)(c.1) gives “cormorant” two windows and names no species; both double-crested and great cormorant occur in New Brunswick. The second window is “the period prescribed as open season for ducks under the Migratory Birds Regulations”, which depends on the federal layer — unmet — so it is not derivable even once the species is resolved.",
  },
  {
    what: "Groundhog",
    reason: "NOT IN THE SPECIES CATALOGUE",
    detail:
      "s. 11(1)(c) gives groundhog the same two windows as coyote and crow. The species is not canonicalized, so the rule would be unanswerable; it needs the species lane first.",
  },
  {
    what: "Wild turkey",
    reason: "REGULATION NOT YET READ",
    detail:
      "N.B. Reg. 2021-30, the Wild Turkey Hunting Regulation, was retrieved (133 KB, consolidated to 30 March 2026) and is not yet encoded. It is the cheapest remaining win in this province.",
  },
  {
    what: "Fur harvesting",
    reason: "REGULATION NOT RETRIEVED",
    detail:
      "N.B. Reg. 84-124, Fur Harvesting, governs beaver, bobcat, fisher, marten, mink, otter, raccoon and red fox — the eight species s. 34(2)(b) of the Act separates out. Trapping is a distinct activity from hunting and is a separate capability.",
  },
  {
    what: "The Baie de Tracadie and Tabusintac Lagoon time-of-day restriction",
    reason: "GEOGRAPHY DESCRIBED IN WORDS, NOT HELD",
    detail:
      "s. 8(1) bars hunting in those two areas between one o'clock in the afternoon and half an hour before sunrise the next day, excepting the Black Lands and the inland lakes in the Tabusintac area. Both areas are described in words in ss. 8(1.1) and following; North Ground holds no geometry for either, so this is a standing limitation rather than an encoded rule, and it is a NARROWER window than the province-wide one.",
  },
  {
    what: "Wildlife refuges, wildlife management areas and posted land",
    reason: "GEOGRAPHY NOT HELD",
    detail:
      "N.B. Reg. 94-43 names refuges and wildlife management areas; N.B. Reg. 89-106 governs land posted against hunting. Neither is a geography North Ground holds, so both are standing limitations.",
  },
  {
    what: "Licence fees",
    reason: "ENCODED AS DATA, NOT YET SURFACED",
    detail:
      "New Brunswick is the first jurisdiction where §41A's two fee certifications can BOTH be met: s. 3(1) states each fee in the same paragraph that defines what the licence authorizes, so the fee belongs to the authorization by construction, and the regulation carries its own consolidation date, so the source is current in its own terms. The figures are class I $173, class II $72, class III $29, class IV $14, guide exemption $150 (s. 3.011), and the antlerless application fee $4 (s. 3.1(3.1)). They are recorded in `licenceClasses` below rather than shown, because HST and any vendor surcharge are outside the regulation and a displayed figure has to say what it excludes.",
  },
];

/* ── Assemble ───────────────────────────────────────────────────────────── */

const bundle = {
  bundleId: "regulatory_bundle:ca-nb-2026",
  jurisdictionId: "jurisdiction:ca-nb",
  sourceVersion: SOURCE_VERSION,
  retrievedAt: RETRIEVED,
  licenceYear: null,
  whyThereIsNoLicenceYear: {
    finding:
      "New Brunswick has no single licence year. Hunting Regulation s. 4(1) has class I, II, III and IV licences and minor's licences expiring annually on a day tied to “the Saturday before the last full week of September”, while s. 4(4) has resident and non-resident bear licences expiring “annually seven weeks after the first Monday in October”.",
    negativeControl:
      "Two different expiry bases in ADJACENT SUBSECTIONS of the same section, which is what makes this a finding rather than an absence: the authority had the opportunity to state one period and deliberately stated two.",
    whatTheAuthorityDefinesInstead: [
      "A general licence expiry tied to the Saturday before the last full week of September (s. 4(1)).",
      "A bear licence expiry seven weeks after the first Monday in October (s. 4(4)).",
      "An event-based end for a bear licence, which is spent when its tags are used (s. 21.11(5)).",
      "A draw cycle for antlerless deer closing on the third Friday in August (s. 3.1(2.2)).",
    ],
  },
  certifiedPeriod: {
    from: "2026-09-01",
    to: DERIVED.januaryToSaturdayBeforeLastFullWeekOfSeptember2027.closesIso,
    reason:
      "New Brunswick's seasons are STANDING rules, so this period is North Ground's declared derivation span rather than the authority's: from the earliest window the derivation opens (black bear, 1 September 2026) to the latest it closes (coyote and crow, 18 September 2027). The rules themselves continue; what is certified is the arithmetic for these dates.",
  },
  absence: ABSENCE,
  sources: SOURCES,
  relativeDateRules: {
    finding:
      "New Brunswick writes almost no literal dates. Every window in Hunting Regulation s. 11(1) ends in “annually” and is stated as an ordinal over weekdays, and 94-47 s. 2 defines “moose season” the same way. Each window therefore carries the ordinal rule AND the ISO dates derived from it.",
    howTheDatesWereDerived:
      "By `scripts/nb-dates.mjs`, from the rule rather than by hand. The first Monday in October 2026 is the 5th, so the eight-week deer grant runs to 29 November, the five-week grant in zones 1 to 3 to 8 November, the bow-or-crossbow-only period to 25 October and the muzzle-loading week from 23 to 29 November.",
    theAmbiguityThatWasCHECKED:
      "“The last full week of September” does not say where a week begins, and three provisions turn on it — the moose season, the coyote and crow close, and two licence expiries. The derivation computes it under BOTH conventions, Sunday-start and Monday-start, and throws if the Tuesday, the Saturday or the preceding Saturday differ. For 2026 and 2027 they agree, which is a checked fact rather than an assumption: moose is 22 to 26 September 2026 either way.",
    derived: DERIVED,
  },
  legalHours: {
    basis: "SUNRISE_SUNSET_OFFSET",
    /* POSITIVE opens BEFORE sunrise; `legalTimeFor` shifts by `-before`. */
    beforeSunriseMinutes: 30,
    afterSunsetMinutes: 30,
    statedAs: "“night” means that period of time elapsing between one-half hour after sunset and one-half hour before sunrise of the following day",
    section: "Fish and Wildlife Act s. 33(1)(a), with s. 1's definition of “night”",
    statedAsAProhibition: true,
    howItWasDerived:
      "The Act makes hunting at night an offence and defines “night” as a term, so the lawful window is that term inverted: half an hour before sunrise to half an hour after sunset. A third encoding path — Manitoba states a window, Newfoundland states a prohibition over a period, New Brunswick states a prohibition over a defined term.",
    ourValueIsNotTheLegalProof:
      "s. 109.1, added by 2021, c.12, s. 6, makes proof of the time of sunrise or sunset a written confirmation certified by the Herzberg Astronomy and Astrophysics Research Centre of the National Research Council of Canada, or a certificate signed by an Environment and Climate Change Canada climatologist. North Ground's computed time is not that proof, which is why the precision margin is applied inward on both ends.",
    theTableWasREPEALED:
      "Old s. 34, headed “Times of sunrise and sunset”, was repealed by 2021, c.12, s. 2. So New Brunswick moved FROM a prescribed table TO the astronomical event, which is the opposite direction from Nova Scotia's Schedule A — and it is why our astronomy is the right instrument here and the wrong one there.",
    oneNarrowerLocalWindow:
      "Hunting Regulation s. 8(1) bars hunting in the Baie de Tracadie area and the Tabusintac Lagoon area between one o'clock in the afternoon and half an hour before sunrise the next day. North Ground holds no geometry for either, so the province-wide window is shown with that named as unresolved.",
  },
  licenceClasses: [
    { class: "I", feeCad: 173, residency: "NON_RESIDENT", minimumAge: 12, section: "Hunting Regulation s. 3(1)(a)", authorizes: "antlered deer, varying hare, groundhog, coyote, crow, spruce grouse, ruffed grouse, cormorant, migratory game birds, ring-necked pheasant, raccoon, squirrel, skunk" },
    { class: "II", feeCad: 72, residency: "NON_RESIDENT", minimumAge: 12, section: "Hunting Regulation s. 3(1)(b)", authorizes: "as class I, without antlered deer" },
    { class: "III", feeCad: 29, residency: "RESIDENT", minimumAge: 12, section: "Hunting Regulation s. 3(1)(c)", authorizes: "as class I, plus antlerless deer in accordance with s. 3.1" },
    { class: "IV", feeCad: 14, residency: "RESIDENT", minimumAge: 16, section: "Hunting Regulation s. 3(1)(d)", authorizes: "small game only" },
    { class: "minor's", feeCad: null, residency: "RESIDENT", minimumAge: 12, section: "Hunting Regulation s. 3(1)(e)", authorizes: "small game, while accompanied by an adult; resident aged 12 to under 16" },
    { class: "guide exemption", feeCad: 150, residency: "NON_RESIDENT", minimumAge: null, section: "Hunting Regulation s. 3.011", authorizes: "hunting without a guide, where the Minister so authorizes under Act s. 20(4)" },
  ],
  whyTheFeesAreRecordedAndNotShown:
    "§41A requires two independent certifications before a fee appears: that it belongs to the authorization for the evaluated hunt, and that the fee source is current in its own terms. Both hold here — the fee is stated in the same paragraph that defines what the licence authorizes, and the regulation carries its own consolidation note. What is not established is what the figure EXCLUDES: HST and any vendor surcharge are outside the regulation, as Newfoundland's guide shows by naming a $3.00 vendor fee its own regulation does not. So the figures are data here, ready to surface once the exclusions are stated.",
  units: ALL_ZONES.map((designation) => ({ identifier: designation, zoneId: zoneId(designation) })),
  officialUnitCount: ALL_ZONES.length,
  groups: GROUPS,
  rules: RULES,
  deerIsThreeAnswersByZone: {
    finding:
      "s. 11.1 alone makes white-tailed deer three different answers. Zones 4, 5 and 9 have no antlered season at all. Zones 1, 2 and 3 have antlered deer only, and five consecutive weeks rather than eight. Every other zone has the full eight weeks.",
    whyItMatters:
      "This is the first Canadian bundle where the ZONE changes the LENGTH of a season rather than only its conditions or its animal class. A province-wide deer rule would be three weeks too long in zones 1 to 3 and wholly wrong in 4, 5 and 9.",
    andTheMethodSplitsItAgain:
      "s. 11.2 reserves the first three consecutive weeks to a bow or crossbow, so a firearm season opens in week four. New Brunswick INCLUDES the crossbow where Newfoundland's pre-season expressly excludes it — the two provinces would be encoded identically by anyone who assumed archery means one thing.",
  },
  deliberatelyNotEncoded: NOT_ENCODED,
  whyTheZoneListIsUnderGhas:
    "`ghas` is the engine's generic list of area designations, named for the first jurisdiction wired to it, and `areaOf` resolves a point's zone id to an identifier through `units` before matching it there. New Brunswick's identifiers are the plain numbers “1” to “27” that `normaliseNewBrunswickWmz` produces from the province's service.",
};

writeFileSync(OUT, `${JSON.stringify(bundle, null, 1)}\n`);
const bySpecies = {};
for (const r of bundle.rules) bySpecies[r.speciesId] = (bySpecies[r.speciesId] ?? 0) + 1;
console.log(`${OUT}: ${bundle.rules.length} rules, ${bundle.units.length} units, ${bundle.sources.length} sources`);
console.log(bySpecies);
