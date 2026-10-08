/**
 * Newfoundland and Labrador's certified big-game rules, built from the ORDERS.
 *
 * WHY THIS PROVINCE IS BUILT FROM ORDERS RATHER THAN FROM A REGULATION.
 *
 * The Wild Life Regulations (CNLR 1156/96) contain NO season dates. They
 * delegate: s. 38 "Open season by order", s. 39(1) "A person shall not hunt,
 * take or kill any big game except during the open seasons prescribed in an
 * order made under these regulations", and s. 89 "In relation to any wild life
 * species that is not named in an order made under these regulations, there is
 * no open season."
 *
 * So the authority for a date is an ORDER, and the province publishes them as
 * numbered regulations marked "This is an official version":
 *
 *   NLR 43/26  Open Seasons Hunting and Trapping Order, 2026-2027 — the dates
 *   NLR 72/18  Moose Hunting Order            — Schedule A (Island) / B (Labrador)
 *   NLR 69/18  Caribou Hunting Order          — the Schedule (Island only)
 *   NLR 22/23  Black Bear Hunting and Trapping Order — the Schedule (Island only)
 *
 * That split is the whole shape of this bundle: the geography is in the
 * species orders and the dates are in the annual one, so a new licence year is
 * a new Open Seasons Order and nothing else moves.
 *
 * FOUR THINGS ABOUT NEWFOUNDLAND AND LABRADOR NO OTHER PROVINCE HAS DONE YET,
 * all of them here as data:
 *
 *  1. IT IS GENUINELY TWO ANSWERS. The owner's "NL is not one answer" warning
 *     was about geography; it is truer of the rules. Island moose closes
 *     31 December and Labrador moose runs to 14 March. Caribou has NO open
 *     season in Labrador at all — declared, for conservation, by NLR 43/26 s. 8
 *     — while the Island has four different windows. Black bear opens a month
 *     earlier in Labrador. Every rule here is therefore Island-scoped or
 *     Labrador-scoped, never provincial, and the split is derived from the
 *     Moose Hunting Order's own words ("All that area of Labrador" against
 *     "All that area of the Island of Newfoundland") rather than from a range
 *     of numbers.
 *
 *  2. THE PRE-SEASON IS A BOW SEASON THAT EXCLUDES CROSSBOWS. NLR 43/26 says
 *     "by long bow or compound bow and arrow"; the department's guide says it
 *     three times more plainly — "does not include cross bows". A crossbow
 *     hunter therefore has the general season and not the pre-season, which is
 *     why HUNT_METHOD distinguishes BOW from CROSSBOW rather than lumping them
 *     as archery.
 *
 *  3. SIX CARIBOU AREAS ARE CLOSED AND THE GUIDE NAMES ONLY THREE. The guide
 *     says "Zones 63, 65, and 69 are Closed". The geography contains 73, 74 and
 *     75 as well, and NLR 43/26 s. 9(2) names no season for any of the six. A
 *     hunter reading the guide's closed list would infer three areas are open
 *     that are not. All six are encoded as declared closures on the Order.
 *
 *  4. TWO AREAS THE ORDER NAMES HAVE NO PUBLISHED GEOMETRY. Moose management
 *     areas 100 and 101 are the Moose Reduction Zones: 3-kilometre buffer
 *     corridors along the Trans-Canada Highway that OVERLAP the numbered areas.
 *     The province's own service does not carry them, and the department says
 *     of its own printed maps "MRZ maps are for general reference purposes
 *     only". They are recorded as unserviceable geography and counted nowhere.
 *
 * Run: node scripts/build-newfoundland-regulations.mjs
 */

import { writeFileSync } from "node:fs";

const OUT = "content/regulatory/ca-nl-2026.json";

const OPEN_SEASONS = "source:ca-nl-open-seasons-order-2026-27";
const MOOSE_ORDER = "source:ca-nl-moose-hunting-order";
const CARIBOU_ORDER = "source:ca-nl-caribou-hunting-order";
const BEAR_ORDER = "source:ca-nl-black-bear-order";
const REGULATIONS = "source:ca-nl-wild-life-regulations";
const ACT = "source:ca-nl-wild-life-act";
const GUIDE = "source:ca-nl-hunting-trapping-guide-2026-27";
const PROHIBITION = "source:ca-nl-hunting-prohibition-order-1998";
const MIDDLE_RIDGE = "source:ca-nl-middle-ridge-reserve-regulations";
const BIG_BARASWAY = "source:ca-nl-big-barasway-reserve-regulations";
const LITTLE_GRAND_LAKE = "source:ca-nl-little-grand-lake-reserve-regulations";
const AREA_SERVICE = "source:ca-nl-big-game-area-service";

const RETRIEVED = "2026-09-30";
const SOURCE_VERSION = "NLR 43/26, filed 7 August 2026; NLR 72/18; NLR 69/18; NLR 22/23 as amended 34/25 and 10/26";

/* ── The geography, from the species orders' own schedules ──────────────── */

/**
 * Moose management areas, split by the words the Moose Hunting Order uses.
 *
 * Schedule A is the Island and Schedule B is Labrador, and every entry in
 * Schedule B opens "All that area of Labrador" while every entry in Schedule A
 * names Newfoundland. The split below was derived by reading that wording for
 * each of the 76 areas the Order names, not by assuming a numeric range — which
 * matters, because the ranges interleave: Labrador is 48-60 AND 84-96, and area
 * 51 is "Baikie Lake" in Labrador while the province's GIS service calls the
 * same area "Grand Falls", a name that reads as an Island town.
 */
const MOOSE_ISLAND = [
  "001", "002", "002A", "002B", "003", "004", "005", "005A", "006", "007", "008", "009", "010",
  "011", "012", "013", "014", "015", "016", "017", "018", "019", "020", "021", "022", "023", "024",
  "025", "026", "027", "028", "029", "030", "031", "032", "033", "034", "035", "036", "037", "038",
  "039", "039A", "040", "041", "042", "043", "044", "045", "047",
];
const MOOSE_LABRADOR = [
  "048", "049", "050", "051", "052", "053", "054", "057", "058", "059", "060",
  "084", "085", "086", "087", "088", "089", "090", "091", "092", "093", "094", "095", "096",
];

/**
 * Caribou management areas. The Order's Schedule names twenty — 61 to 79, with
 * 71 appearing as 71A "Grey Islands (Bell)" and 71B "Grey Islands (Groais)" —
 * and the province's service carries nineteen, because its single record 071
 * "Grey Islands" is exactly those two islands: its two parts are tagged
 * "Bell Island" and "Groais Island" in the service's own `cma_island` field.
 * Both halves carry identical dates in NLR 43/26 s. 9(2) and both are excluded
 * from the pre-season by s. 9(3), so one answer is correct for either — a
 * reason, not an assumption.
 */
const CARIBOU_ISLAND_DECEMBER = ["061", "062", "064", "066", "067", "068", "076", "077", "078", "079"];
const CARIBOU_MERASHEEN = ["070"];
const CARIBOU_GREY_ISLANDS = ["071"];
const CARIBOU_FOGO = ["072"];
const CARIBOU_CLOSED = ["063", "065", "069", "073", "074", "075"];

/** Black bear: 200 is Labrador in the province's service; 201-206 are the Island. */
const BEAR_LABRADOR = ["200"];
const BEAR_ISLAND = ["201", "202", "203", "204", "205", "206"];

const zoneId = (prefix, designation) => `management_zone:ca-nl-${prefix}-${designation.toLowerCase()}`;
const moose = (list) => list.map((d) => zoneId("mma", d));
const caribou = (list) => list.map((d) => zoneId("cma", d));
const bear = (list) => list.map((d) => zoneId("bma", d));

/*
 * `ghas` HOLDS THE AUTHORITY'S DESIGNATION, NOT A ZONE ID, AND THAT IS NOT A
 * NAMING PREFERENCE.
 *
 * `areaOf` in geography.ts resolves a point's zone id to an IDENTIFIER through
 * the bundle's `units`, and `appliesInWorld` matches that identifier against
 * `include.ghas`. Put zone ids in both and `areaOf` returns null for every
 * point, every rule fails to apply, and a hunter standing in an open area is
 * told the season is CLOSED. Nova Scotia shipped exactly that way, and eleven
 * tests passed over it because all eleven read the bundle rather than asking the
 * engine. `engine-answers-somewhere.test.ts` is the check that catches it.
 *
 * The designations are the province's own three-digit forms — "001", "002A",
 * "071", "200" — which is what `normaliseNewfoundlandArea` produces from the
 * Wildlife Division's service, so the identifier a resolved point carries and
 * the identifier a rule names are the same string by construction.
 */
const geography = (statedAs, designations) => ({
  statedAs,
  include: { ghas: designations, gbhz: [], special: [] },
  exclude: { ghas: [], special: [] },
});

/* ── Rules ──────────────────────────────────────────────────────────────── */

let ruleSeq = 0;
function rule({ id, speciesId, statedAs, designations, method, seasonPhrase, windows, limits, conditionIds, section, sourceId = OPEN_SEASONS, notes = [], closureSummary, group }) {
  ruleSeq += 1;
  return {
    id: `regulatory_rule:ca-nl-2026-${id}`,
    speciesId,
    regulatoryGroupId: group,
    geography: geography(statedAs, designations),
    /* `permittedImplements` is the key HUNT_METHOD answers — `ruleKeyOf` maps
       the dimension id to it, because a method is a SET a rule allows rather
       than a single value it requires. Keying these `HUNT_METHOD` left every
       rule unconstrained and the pre-season unreachable. */
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
    ...(closureSummary ? { closureSummary } : {}),
  };
}

const window = (opensIso, closesIso, statedAs) => ({ opensIso, closesIso, statedAs });

/* Every method the vocabulary offers, for a rule the Order does not restrict. */
const ALL_METHODS = ["FIREARM", "BOW", "CROSSBOW"];
/* The pre-season's own words: "by long bow or compound bow and arrow". */
const BOW_ONLY = ["BOW"];

const BIG_GAME_CONDITIONS = [
  "ca-nl-big-game-licence",
  "ca-nl-licence-names-the-area",
  "ca-nl-licence-expires-on-the-kill",
  "ca-nl-minimum-age-16",
  "ca-nl-outdoor-identification-card",
  "ca-nl-non-resident-guide",
  "ca-nl-calibre-minimums",
  "ca-nl-service-ammunition",
  "ca-nl-no-dogs",
  "ca-nl-not-while-swimming",
  "ca-nl-must-retrieve",
  "ca-nl-no-artificial-light",
  "ca-nl-no-aircraft-or-offroad",
  "ca-nl-firearm-setbacks",
  "ca-nl-proof-of-sex",
];
const BOW_CONDITIONS = [...BIG_GAME_CONDITIONS, "ca-nl-bow-minimums"];
const DRAW = "ca-nl-resident-draw-one-per-year";

const GROUPS = [
  { id: "regulatory_group:ca-nl-2026-moose-island", officialSpec: "Every moose management area in Schedule A to the Moose Hunting Order — the Island of Newfoundland", zoneIds: moose(MOOSE_ISLAND) },
  { id: "regulatory_group:ca-nl-2026-moose-labrador", officialSpec: "Every moose management area in Schedule B to the Moose Hunting Order — Labrador", zoneIds: moose(MOOSE_LABRADOR) },
  { id: "regulatory_group:ca-nl-2026-caribou-island", officialSpec: "The caribou management areas in the Schedule to the Caribou Hunting Order, Newfoundland", zoneIds: caribou([...CARIBOU_ISLAND_DECEMBER, ...CARIBOU_MERASHEEN, ...CARIBOU_GREY_ISLANDS, ...CARIBOU_FOGO, ...CARIBOU_CLOSED]) },
  { id: "regulatory_group:ca-nl-2026-bear-island", officialSpec: "Black bear management areas 201 to 206 in the Schedule to the Black Bear Hunting and Trapping Order — the Island of Newfoundland", zoneIds: bear(BEAR_ISLAND) },
  { id: "regulatory_group:ca-nl-2026-bear-labrador", officialSpec: "Labrador, excluding Torngat Mountains National Park and Akami-Uapishkᵁ-KakKasuak-Mealy Mountains National Park Reserve", zoneIds: bear(BEAR_LABRADOR) },
];

const MOOSE_ISLAND_GROUP = GROUPS[0].id;
const MOOSE_LABRADOR_GROUP = GROUPS[1].id;
const CARIBOU_GROUP = GROUPS[2].id;
const BEAR_ISLAND_GROUP = GROUPS[3].id;
const BEAR_LABRADOR_GROUP = GROUPS[4].id;

const MOOSE_BAG = { statedAs: "1 moose per licence", bag: 1, section: "Moose Hunting Order s. 3" };
const CARIBOU_BAG = { statedAs: "1 caribou per licence", bag: 1, section: "Caribou Hunting Order s. 3" };
const BEAR_BAG = { statedAs: "2 black bear of any age or sex per licence", bag: 2, section: "Black Bear Hunting and Trapping Order s. 5(1)" };

const RULES = [
  /* ── Moose ── */
  rule({
    id: "moose-island", speciesId: "species:moose", group: MOOSE_ISLAND_GROUP,
    statedAs: "The Island of Newfoundland, in all moose management areas",
    designations: MOOSE_ISLAND, method: ALL_METHODS,
    seasonPhrase: "September 12, 2026 to December 31, 2026",
    windows: [window("2026-09-12", "2026-12-31", "September 12, 2026 to December 31, 2026")],
    limits: MOOSE_BAG, conditionIds: [...BIG_GAME_CONDITIONS, DRAW, "ca-nl-moose-white-mma-43"],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 11(2)",
  }),
  rule({
    id: "moose-island-bow", speciesId: "species:moose", group: MOOSE_ISLAND_GROUP,
    statedAs: "The Island of Newfoundland, in all moose management areas — long bow or compound bow only",
    designations: MOOSE_ISLAND, method: BOW_ONLY,
    seasonPhrase: "August 29, 2026 to September 11, 2026",
    windows: [window("2026-08-29", "2026-09-11", "August 29, 2026 to September 11, 2026")],
    limits: MOOSE_BAG, conditionIds: [...BOW_CONDITIONS, DRAW, "ca-nl-moose-white-mma-43", "ca-nl-no-crossbow-in-preseason"],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 11(3)",
    notes: [{ text: "A pre-season that precedes the general one rather than replacing it: the department states it as \"Bow hunting begins August 29, 2026 … for areas opening on September 12, 2026\", so a bow hunter also has the general season." }],
  }),
  rule({
    id: "moose-labrador", speciesId: "species:moose", group: MOOSE_LABRADOR_GROUP,
    statedAs: "Labrador, in all moose management areas",
    designations: MOOSE_LABRADOR, method: ALL_METHODS,
    seasonPhrase: "September 12, 2026 to March 14, 2027",
    windows: [window("2026-09-12", "2027-03-14", "September 12, 2026 to March 14, 2027")],
    limits: MOOSE_BAG, conditionIds: [...BIG_GAME_CONDITIONS, DRAW],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 10(2)",
  }),
  rule({
    id: "moose-labrador-bow", speciesId: "species:moose", group: MOOSE_LABRADOR_GROUP,
    statedAs: "Labrador, in all moose management areas — long bow or compound bow only",
    designations: MOOSE_LABRADOR, method: BOW_ONLY,
    seasonPhrase: "August 29, 2026 to September 11, 2026",
    windows: [window("2026-08-29", "2026-09-11", "August 29, 2026 to September 11, 2026")],
    limits: MOOSE_BAG, conditionIds: [...BOW_CONDITIONS, DRAW, "ca-nl-no-crossbow-in-preseason"],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 10(3)",
    notes: [{ text: "The department's guide prints \"Bow hunting begins August 29, 2025\" for Labrador moose. The Order says 2026, and the Order is the law; 2025 is a typographical error in a 2026-27 publication." }],
  }),

  /* ── Caribou ── */
  rule({
    id: "caribou-island-december", speciesId: "species:caribou", group: CARIBOU_GROUP,
    statedAs: "Caribou management areas 61, 62, 64, 66 to 68 and 76 to 79",
    designations: CARIBOU_ISLAND_DECEMBER, method: ALL_METHODS,
    seasonPhrase: "September 12, 2026 to December 6, 2026",
    windows: [window("2026-09-12", "2026-12-06", "September 12, 2026 to December 6, 2026")],
    limits: CARIBOU_BAG, conditionIds: [...BIG_GAME_CONDITIONS, DRAW],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 9(2)",
  }),
  rule({
    id: "caribou-island-december-bow", speciesId: "species:caribou", group: CARIBOU_GROUP,
    statedAs: "Caribou management areas 61, 62, 64, 66 to 68 and 76 to 79 — long bow or compound bow only",
    designations: CARIBOU_ISLAND_DECEMBER, method: BOW_ONLY,
    seasonPhrase: "August 29, 2026 to September 11, 2026",
    windows: [window("2026-08-29", "2026-09-11", "August 29, 2026 to September 11, 2026")],
    limits: CARIBOU_BAG, conditionIds: [...BOW_CONDITIONS, DRAW, "ca-nl-no-crossbow-in-preseason"],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 9(3)",
  }),
  rule({
    id: "caribou-merasheen", speciesId: "species:caribou", group: CARIBOU_GROUP,
    statedAs: "Caribou management area 70 — Merasheen, Long, King and Rose au Rue Islands",
    designations: CARIBOU_MERASHEEN, method: ALL_METHODS,
    seasonPhrase: "September 19, 2026 to October 4, 2026",
    windows: [window("2026-09-19", "2026-10-04", "September 19, 2026 to October 4, 2026")],
    limits: CARIBOU_BAG, conditionIds: [...BIG_GAME_CONDITIONS, DRAW],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 9(2)",
    notes: [{ text: "There is no pre-season bow hunt in this area: s. 9(3) excludes areas 70, 71A, 71B and 72 from it by name." }],
  }),
  rule({
    id: "caribou-grey-islands", speciesId: "species:caribou", group: CARIBOU_GROUP,
    statedAs: "Caribou management areas 71A and 71B — the Grey Islands",
    designations: CARIBOU_GREY_ISLANDS, method: ALL_METHODS,
    seasonPhrase: "September 12, 2026 to November 30, 2026",
    windows: [window("2026-09-12", "2026-11-30", "September 12, 2026 to November 30, 2026")],
    limits: CARIBOU_BAG, conditionIds: [...BIG_GAME_CONDITIONS, DRAW],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 9(2)",
    notes: [
      { text: "The Order divides this geography into 71A (Bell Island) and 71B (Groais Island); the province's map carries them as one area, 071, whose two parts its own data names Bell Island and Groais Island. Both halves carry these dates and both are excluded from the pre-season bow hunt, so one answer is correct for either." },
      { text: "The province's map service tags this area CLOSED. The Order opens it and the department's own guide prints the same dates, so the map attribute is stale metadata rather than law." },
    ],
  }),
  rule({
    id: "caribou-fogo", speciesId: "species:caribou", group: CARIBOU_GROUP,
    statedAs: "Caribou management area 72 — Fogo Island",
    designations: CARIBOU_FOGO, method: ALL_METHODS,
    seasonPhrase: "September 12, 2026 to October 11, 2026",
    windows: [window("2026-09-12", "2026-10-11", "September 12, 2026 to October 11, 2026")],
    limits: CARIBOU_BAG, conditionIds: [...BIG_GAME_CONDITIONS, DRAW],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 9(2)",
    notes: [{ text: "There is no pre-season bow hunt in this area: s. 9(3) excludes areas 70, 71A, 71B and 72 from it by name." }],
  }),
  rule({
    id: "caribou-closed", speciesId: "species:caribou", group: CARIBOU_GROUP,
    statedAs: "Caribou management areas 63, 65, 69, 73, 74 and 75",
    designations: CARIBOU_CLOSED, method: undefined,
    seasonPhrase: "No open season for 2026-2027",
    windows: [], limits: { statedAs: "No season" }, conditionIds: [],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 9(2), which names no season for these areas",
    closureSummary: "no open season",
    notes: [{ text: "The department's guide says \"Zones 63, 65, and 69 are Closed\" and does not mention 73, 74 or 75, which the Order equally does not name and the province's map equally tags CLOSED. A hunter reading the guide's closed list alone would infer three open areas that are not open." }],
  }),

  /* ── Black bear ── */
  rule({
    id: "bear-island-fall", speciesId: "species:american-black-bear", group: BEAR_ISLAND_GROUP,
    statedAs: "The Island of Newfoundland, in all black bear management areas",
    designations: BEAR_ISLAND, method: ALL_METHODS,
    seasonPhrase: "September 12, 2026 to November 30, 2026 and May 1, 2027 to July 15, 2027",
    windows: [
      window("2026-09-12", "2026-11-30", "September 12, 2026 to November 30, 2026"),
      window("2027-05-01", "2027-07-15", "May 1, 2027 to July 15, 2027"),
    ],
    limits: BEAR_BAG,
    conditionIds: [...BIG_GAME_CONDITIONS, "ca-nl-bear-no-cubs-or-sows", "ca-nl-bear-foot-snare"],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 7(2)",
  }),
  rule({
    id: "bear-island-bow", speciesId: "species:american-black-bear", group: BEAR_ISLAND_GROUP,
    statedAs: "The Island of Newfoundland, in all black bear management areas — long bow or compound bow only",
    designations: BEAR_ISLAND, method: BOW_ONLY,
    seasonPhrase: "August 29, 2026 to September 11, 2026",
    windows: [window("2026-08-29", "2026-09-11", "August 29, 2026 to September 11, 2026")],
    limits: BEAR_BAG,
    conditionIds: [...BOW_CONDITIONS, "ca-nl-bear-no-cubs-or-sows", "ca-nl-no-crossbow-in-preseason"],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 7(3)",
    notes: [{ text: "Autumn only. The department states \"There is no preseason bow hunt for the spring season\", and s. 7(3) gives dates in 2026 alone." }],
  }),
  rule({
    id: "bear-labrador", speciesId: "species:american-black-bear", group: BEAR_LABRADOR_GROUP,
    statedAs: "Labrador, excluding Torngat Mountains National Park and Akami-Uapishkᵁ-KakKasuak-Mealy Mountains National Park Reserve",
    designations: BEAR_LABRADOR, method: ALL_METHODS,
    seasonPhrase: "August 10, 2026 to November 30, 2026 and April 1, 2027 to July 13, 2027",
    windows: [
      window("2026-08-10", "2026-11-30", "August 10, 2026 to November 30, 2026"),
      window("2027-04-01", "2027-07-13", "April 1, 2027 to July 13, 2027"),
    ],
    limits: BEAR_BAG,
    conditionIds: [...BIG_GAME_CONDITIONS, "ca-nl-bear-no-cubs-or-sows", "ca-nl-bear-foot-snare", "ca-nl-labrador-national-parks", "ca-nl-labrador-inuit-lands"],
    section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 6",
    notes: [
      { text: "There is no pre-season bow hunt in Labrador in either season; the department states so for both." },
      { text: "The department's guide prints the spring season as \"April 1 to July 13, 2026\". The Order says 2027, and the Order is the law. The guide's year would have a hunter believe the spring season had already passed." },
    ],
  }),
];

/* ── Conditions ─────────────────────────────────────────────────────────── */

const condition = (id, scope, text, sourceId, sourceSection, extra = {}) => ({ id, scope, text, sourceId, sourceSection, ...extra });

const CONDITIONS_BY_SOURCE = {
  [REGULATIONS]: [
    condition("ca-nl-big-game-licence", "JURISDICTION",
      "A big game licence is required, and it must be on your person while you hunt.",
      REGULATIONS, "Wild Life Regulations ss. 37(1), 37(2)"),
    condition("ca-nl-licence-names-the-area", "JURISDICTION",
      "Your licence must name this management area. Newfoundland and Labrador issues big game licences per area, and hunting in an area the licence does not name is an offence even inside the open season.",
      REGULATIONS, "Wild Life Regulations s. 37(3); Open Seasons Hunting and Trapping Order, 2026-2027, s. 3(b)"),
    condition("ca-nl-licence-expires-on-the-kill", "JURISDICTION",
      "The licence, seal and tag are valid only until the animal has been killed, or until the open season ends, whichever comes first.",
      REGULATIONS, "Wild Life Regulations s. 35(3)"),
    condition("ca-nl-minimum-age-16", "JURISDICTION",
      "A big game licence is issued only to a person who was 16 years of age on 31 August of the year the licence relates to.",
      REGULATIONS, "Wild Life Regulations s. 36"),
    condition("ca-nl-resident-draw-one-per-year", "JURISDICTION",
      "Island moose and caribou licences are allocated by draw. A resident holding a draw licence may hold only one moose licence or one caribou licence in the 12 months ending 30 April.",
      REGULATIONS, "Wild Life Regulations s. 35(5)",
      { speciesIds: ["species:moose", "species:caribou"] }),
    condition("ca-nl-non-resident-guide", "JURISDICTION",
      "A non-resident may not hunt big game anywhere in the province without employing and being accompanied by a licensed guide.",
      REGULATIONS, "Wild Life Regulations s. 111.1(2)"),
    condition("ca-nl-calibre-minimums", "JURISDICTION",
      "Big game may not be taken with a rifle smaller than .243 calibre, with ammunition whose bullet weighs under 100 grains or carries under 1,500 foot-pounds of muzzle energy, or with a shotgun smaller than 20 gauge.",
      REGULATIONS, "Wild Life Regulations s. 107(14)"),
    condition("ca-nl-service-ammunition", "JURISDICTION",
      "Fully metal cased non-exploding bullets — service ammunition — may not be used on big game or carried where wildlife is found, and no missile other than a single bullet or ball may be used.",
      REGULATIONS, "Wild Life Regulations ss. 107(21), 107(22)"),
    condition("ca-nl-bow-minimums", "JURISDICTION",
      "A long bow or compound bow must draw at least 20 kilograms, a crossbow at least 68 kilograms, and the arrow must be tipped with a metal hunting head having two or more sharpened cutting edges.",
      REGULATIONS, "Wild Life Regulations ss. 108(2), 108(3), 108(3.1), 108(4)"),
    condition("ca-nl-no-dogs", "JURISDICTION",
      "A dog may not be used to hunt big game.",
      REGULATIONS, "Wild Life Regulations s. 40(1)"),
    condition("ca-nl-not-while-swimming", "JURISDICTION",
      "Big game may not be hunted, taken, killed or molested while the animal is swimming.",
      REGULATIONS, "Wild Life Regulations s. 41"),
    condition("ca-nl-must-retrieve", "JURISDICTION",
      "If you kill, cripple or wound a big game animal you must immediately make all reasonable efforts to retrieve it.",
      REGULATIONS, "Wild Life Regulations s. 39(3)"),
    condition("ca-nl-no-artificial-light", "JURISDICTION",
      "No artificial light, or device using one, may be used to hunt any game.",
      REGULATIONS, "Wild Life Regulations s. 42(1)"),
    condition("ca-nl-no-aircraft-or-offroad", "JURISDICTION",
      "Wildlife may not be hunted from an aircraft, a four-wheel-drive vehicle or a tracked vehicle, moving or stationary, and an aircraft may not be used to spot or locate wildlife for a hunt.",
      REGULATIONS, "Wild Life Regulations ss. 105(1), 105(2)"),
    condition("ca-nl-firearm-setbacks", "JURISDICTION",
      "A firearm may not be discharged within 1,000 metres of a school, playground or athletic field, within 300 metres of a dwelling, within 1,000 metres of a commercial wood cutting operation signed \"No Hunting\", or from or across a railway, highway or road.",
      REGULATIONS, "Wild Life Regulations ss. 111(1), 111(3), 107(20)"),
    condition("ca-nl-proof-of-sex", "JURISDICTION",
      "On a male-only licence you must be able to produce the scrotum attached to one quarter of the animal on a wildlife officer's request.",
      REGULATIONS, "Wild Life Regulations s. 65(1)"),
  ],
  [OPEN_SEASONS]: [
    condition("ca-nl-no-crossbow-in-preseason", "JURISDICTION",
      "The pre-season is for a long bow or compound bow and arrow. A crossbow is not included, so a crossbow hunter has the general season only.",
      OPEN_SEASONS, "Open Seasons Hunting and Trapping Order, 2026-2027, ss. 7(3), 9(3), 10(3), 11(3)"),
  ],
  [MOOSE_ORDER]: [
    condition("ca-nl-moose-white-mma-43", "ZONE",
      "In moose management area 43 there is no open season for moose that are predominately white in colour.",
      OPEN_SEASONS, "Open Seasons Hunting and Trapping Order, 2026-2027, s. 11(4)",
      {
        zoneIds: [zoneId("mma", "043")],
        note: "The one genuinely zone-specific condition in this bundle, and the scope is declared where the rule is read rather than inferred from how often it fires.",
      }),
  ],
  [BEAR_ORDER]: [
    condition("ca-nl-bear-no-cubs-or-sows", "JURISDICTION",
      "A black bear cub under one year of age, and a female black bear accompanied by cubs under one year of age, may not be taken by shooting.",
      BEAR_ORDER, "Black Bear Hunting and Trapping Order s. 5(2), as amended by NLR 10/26 s. 1",
      { speciesIds: ["species:american-black-bear"] }),
    condition("ca-nl-bear-foot-snare", "JURISDICTION",
      "Black bear may be trapped only with an Aldrich foot snare or a similar foot-holding device, set in a covered \"cubby set\", clearly signed as a bear trapping device and checked daily. Steel-jaw leghold, spring and jump traps and neck snares may not be used. Trapping bear also requires a valid trapping licence alongside the big game bear licence.",
      BEAR_ORDER, "Black Bear Hunting and Trapping Order ss. 2, 3; Wild Life Regulations s. 35(1.1)",
      { speciesIds: ["species:american-black-bear"] }),
  ],
  [GUIDE]: [
    condition("ca-nl-outdoor-identification-card", "JURISDICTION",
      "A resident hunting with a firearm must hold an Outdoor Identification Card, which the department issues on completion of the hunter education and firearm safety courses the regulations require.",
      GUIDE, "Hunting and Trapping Guide 2026-27, General, p. 23; the course requirement itself is Wild Life Regulations s. 91.1",
      { note: "\"Outdoor Identification Card\" appears nowhere in the Wild Life Act or the Wild Life Regulations. It is the department's evidence that s. 91.1's training was completed, which is why this line cites the guide and is North Ground's sentence rather than the regulation's." }),
  ],
  [ACT]: [
    condition("ca-nl-labrador-national-parks", "JURISDICTION",
      "The Labrador black bear season expressly excludes Torngat Mountains National Park and Akami-Uapishkᵁ-KakKasuak-Mealy Mountains National Park Reserve. North Ground holds no certified park boundary here and has not verified any rule inside a national park.",
      OPEN_SEASONS, "Open Seasons Hunting and Trapping Order, 2026-2027, s. 6",
      { speciesIds: ["species:american-black-bear"] }),
    condition("ca-nl-labrador-inuit-lands", "JURISDICTION",
      "Access to Labrador Inuit Lands requires permission from the Nunatsiavut Government unless your interests are accommodated under the Labrador Inuit Land Claims Agreement. That is a land access question, separate from the season.",
      GUIDE, "Hunting and Trapping Guide 2026-27, Labrador Inuit Land Claims Agreement",
      { speciesIds: ["species:american-black-bear", "species:moose"] }),
  ],
};

/* ── Sources ────────────────────────────────────────────────────────────── */

/**
 * §44's three rights, recorded separately for every source.
 *
 * Every instrument here is served publicly by the House of Assembly at
 * assembly.nl.ca and marked "This is an official version", and every one
 * carries "Copyright © 2026: King's Printer, St. John's, Newfoundland and
 * Labrador, Canada" with no reuse grant located. That is the exact case §44
 * names as previously unrepresentable: publicly readable, terms unstated,
 * archival unconfirmed, derived facts usable, primary government authority.
 * The facts below are derived and attributed; no source document is stored.
 */
const READABLE_TERMS_UNSTATED = {
  accessState: "PUBLIC_READABLE",
  reuseState: "UNSTATED",
  archiveState: "UNCONFIRMED",
  derivedFactsState: "USABLE",
  termsStatus: "NOT_LOCATED",
  retrievalMethod: "OFFICIAL_HTML",
};

const SOURCES = [
  {
    id: ACT, title: "Wild Life Act, RSNL 1990 c. W-8",
    url: "https://www.assembly.nl.ca/Legislation/sr/statutes/w08.htm",
    authority: "Government of Newfoundland and Labrador (House of Assembly)",
    authorityLevel: "PRIMARY_GOVERNMENT", ...READABLE_TERMS_UNSTATED, lastVerified: RETRIEVED,
    conditions: CONDITIONS_BY_SOURCE[ACT],
  },
  {
    id: REGULATIONS, title: "Wild Life Regulations, CNLR 1156/96",
    url: "https://www.assembly.nl.ca/Legislation/sr/regulations/rc961156.htm",
    authority: "Government of Newfoundland and Labrador (House of Assembly)",
    authorityLevel: "PRIMARY_GOVERNMENT", ...READABLE_TERMS_UNSTATED, lastVerified: RETRIEVED,
    note: "Contains no season dates. It delegates them to ministerial orders (ss. 16, 38, 73, 81.2) and declares what silence means (s. 89).",
    conditions: CONDITIONS_BY_SOURCE[REGULATIONS],
  },
  {
    id: OPEN_SEASONS, title: "Open Seasons Hunting and Trapping Order, 2026-2027, NLR 43/26",
    url: "https://www.assembly.nl.ca/Legislation/sr/regulations/rc260043.htm",
    authority: "Minister of Forestry, Agriculture and Lands",
    authorityLevel: "PRIMARY_GOVERNMENT", ...READABLE_TERMS_UNSTATED, lastVerified: RETRIEVED,
    madeOn: "2026-08-06", filedOn: "2026-08-07",
    note: "The instrument that carries the dates. Dated at St. John's 6 August 2026 and filed 7 August 2026, under the authority of ss. 16, 25, 38, 39, 73, 81.2 and 114 of the Wild Life Regulations and the Wild Life Act.",
    conditions: CONDITIONS_BY_SOURCE[OPEN_SEASONS],
  },
  {
    id: MOOSE_ORDER, title: "Moose Hunting Order, Newfoundland and Labrador, NLR 72/18",
    url: "https://www.assembly.nl.ca/Legislation/sr/regulations/rc180072.htm",
    authority: "Minister of Forestry, Agriculture and Lands",
    authorityLevel: "PRIMARY_GOVERNMENT", ...READABLE_TERMS_UNSTATED, lastVerified: RETRIEVED,
    note: "Schedule A describes the Island's moose management areas and Schedule B Labrador's. It also sets the bag limit (s. 3).",
    conditions: CONDITIONS_BY_SOURCE[MOOSE_ORDER],
  },
  {
    id: CARIBOU_ORDER, title: "Caribou Hunting Order, Newfoundland, NLR 69/18",
    url: "https://www.assembly.nl.ca/Legislation/sr/regulations/rc180069.htm",
    authority: "Minister of Forestry, Agriculture and Lands",
    authorityLevel: "PRIMARY_GOVERNMENT", ...READABLE_TERMS_UNSTATED, lastVerified: RETRIEVED,
    note: "Its Schedule describes twenty areas, 61 to 79 with 71 split into 71A and 71B. The word \"Area\" is printed \"A rea\" for area 70 in the official version, an artefact of the source document.",
  },
  {
    id: BEAR_ORDER, title: "Black Bear Hunting and Trapping Order, Newfoundland and Labrador, NLR 22/23",
    url: "https://www.assembly.nl.ca/Legislation/sr/regulations/rc230022.htm",
    authority: "Minister of Forestry, Agriculture and Lands",
    authorityLevel: "PRIMARY_GOVERNMENT", ...READABLE_TERMS_UNSTATED, lastVerified: RETRIEVED,
    amendedBy: ["NLR 34/25 s. 1 (black bear management areas)", "NLR 10/26 s. 1 (cubs and accompanied females)"],
    note: "Its Schedule describes management areas 201 to 206 only, all on the Island. There is no Area 200 in the Order; the province's map service carries a polygon numbered 200 and names it \"Labrador\".",
    conditions: CONDITIONS_BY_SOURCE[BEAR_ORDER],
  },
  {
    id: PROHIBITION, title: "Hunting Prohibition Order, 1998, NLR 56/98",
    url: "https://www.assembly.nl.ca/Legislation/sr/regulations/rc980056.htm",
    authority: "Minister of Forestry, Agriculture and Lands",
    authorityLevel: "PRIMARY_GOVERNMENT", ...READABLE_TERMS_UNSTATED, lastVerified: RETRIEVED,
    note: "Prohibits hunting by firearm in nine named localities (Schedule A) and by firearm, snare or trap in two more (Schedule B). The text is published; the geometry is not.",
  },
  {
    id: MIDDLE_RIDGE, title: "Wild Life Middle Ridge Reserve Regulations, NLR 128/90",
    url: "https://www.assembly.nl.ca/Legislation/sr/regulations/rc960799.htm",
    authority: "Government of Newfoundland and Labrador",
    authorityLevel: "PRIMARY_GOVERNMENT", ...READABLE_TERMS_UNSTATED, lastVerified: RETRIEVED,
    note: "Section 4 bars entry to the reserve except under a permit, with no seasonal limit. Caribou management area 64 is also named Middle Ridge.",
  },
  {
    id: BIG_BARASWAY, title: "Wild Life Reserve Big Barasway, Burgeo Regulations, NLR 146/92",
    url: "https://www.assembly.nl.ca/Legislation/sr/regulations/rc960770.htm",
    authority: "Government of Newfoundland and Labrador",
    authorityLevel: "PRIMARY_GOVERNMENT", ...READABLE_TERMS_UNSTATED, lastVerified: RETRIEVED,
  },
  {
    id: LITTLE_GRAND_LAKE, title: "Little Grand Lake Wild Life Reserve Regulations, CNLR 85/02",
    url: "https://www.assembly.nl.ca/Legislation/sr/regulations/rc020085.htm",
    authority: "Government of Newfoundland and Labrador",
    authorityLevel: "PRIMARY_GOVERNMENT", ...READABLE_TERMS_UNSTATED, lastVerified: RETRIEVED,
    note: "Section 5 prohibits disturbing, hunting, taking or killing the Newfoundland Marten within the reserve and restricts dogs, traps, nets and snares.",
  },
  {
    id: GUIDE, title: "Newfoundland and Labrador Hunting and Trapping Guide 2026-27",
    url: "https://www.gov.nl.ca/hunting-trapping-guide/wp-content/uploads/2026-27-Hunting-Trapping-Guide.pdf",
    authority: "Department of Forestry, Agriculture and Lands",
    authorityLevel: "GOVERNMENT_SUMMARY",
    accessState: "PUBLIC_READABLE", reuseState: "UNSTATED", archiveState: "UNCONFIRMED",
    derivedFactsState: "USABLE", termsStatus: "NOT_LOCATED", retrievalMethod: "OFFICIAL_PDF",
    lastVerified: RETRIEVED,
    note: "A summary, used here to cross-check the orders and for the two administrative facts the regulations do not carry: the Outdoor Identification Card, and the department's own advice to wear blaze orange. Its own caution: \"MRZ maps are for general reference purposes only.\"",
    conditions: CONDITIONS_BY_SOURCE[GUIDE],
  },
  {
    id: AREA_SERVICE, title: "WLD_BigGameManagementArea FeatureServer (Wildlife Division)",
    url: "https://services8.arcgis.com/aCyQID5qQcyrJMm2/arcgis/rest/services/WLD_BigGameManagementArea/FeatureServer",
    authority: "Department of Forestry, Agriculture and Lands, Wildlife Division",
    authorityLevel: "PRIMARY_GOVERNMENT",
    accessState: "PUBLIC_READABLE", reuseState: "GRANTED", archiveState: "PERMITTED",
    derivedFactsState: "USABLE", termsStatus: "LOCATED",
    termsUrl: "https://www.gov.nl.ca/public-ll/open-government-licence-nl/",
    retrievalMethod: "OFFICIAL_API", lastVerified: "2026-09-22",
    note: "The geography, under the Newfoundland and Labrador Open Government Licence. Its attributes are administrative metadata, not law: its `status_ope` field tags caribou area 071 CLOSED while NLR 43/26 opens it.",
  },
];

/* ── Absence ────────────────────────────────────────────────────────────── */

const ABSENCE = {
  meaning: "CLOSED",
  words: {
    owner: "AUTHORITY",
    text: "A person shall not hunt, take or kill fur bearing animals, big game, small game or coyotes at any time unless (a) the person holds a valid licence for the species being hunted; (b) the person holds a valid licence for the area in which the person is hunting; and (c) it is during the open season prescribed in this Order for the species and the area.",
    sourceId: OPEN_SEASONS,
    citation: "Open Seasons Hunting and Trapping Order, 2026-2027, NLR 43/26, s. 3",
    lang: "en-CA",
  },
  section: "Open Seasons Hunting and Trapping Order, 2026-2027, s. 3; Wild Life Regulations ss. 39(1), 89",
  sourceId: OPEN_SEASONS,
  explanation:
    "Newfoundland and Labrador states its closed world three times over, which is why an area the Order does not name is CLOSED here rather than UNKNOWN. The Order's own s. 3 requires that it be \"during the open season prescribed in this Order for the species and the area\". The Wild Life Regulations s. 39(1) repeat it for big game. And s. 89, headed \"Closed season except by order\", covers the species level: \"In relation to any wild life species that is not named in an order made under these regulations, there is no open season.\"",
  reinforcedPerSpecies: [
    "Moose — named in NLR 43/26 ss. 10 and 11, so the species is open somewhere; an unnamed area is closed by s. 3(c).",
    "Caribou — named in s. 9 for the Island. Labrador is CLOSED BY DECLARATION rather than by silence: s. 8 reads \"For the purpose of conservation, there shall be no open season in Labrador for the hunting of caribou.\"",
    "Black bear — named in ss. 6 and 7 for Labrador and the Island respectively.",
  ],
  theStandingLimitOnEveryClosedClaim: {
    citation: "Wild Life Act s. 30 (regulation-making power) and Wild Life Regulations s. 114 (orders by minister)",
    statedAs: "close, alter or vary an open season prescribed in these regulations or in an order made under them",
    whyItMatters:
      "The Minister may close, alter or vary an open season by a later order. A closed answer here is closed on the orders North Ground has read; it cannot see an order made after them. This is the same standing limit Nova Scotia's bundle records, and it is the reason a certified CLOSED is still dated.",
  },
};

/* ── Deliberate gaps ────────────────────────────────────────────────────── */

const NOT_ENCODED = [
  {
    what: "Moose management areas 100 and 101 — the Moose Reduction Zones",
    reason: "GEOGRAPHY NOT PUBLISHED",
    detail:
      "The Moose Hunting Order's Schedule A describes them as 3-kilometre buffer corridors along the Trans-Canada Highway, so they OVERLAP the numbered areas rather than tiling beside them. The province's own WLD_BigGameManagementArea service carries neither, and the department writes \"Note: MRZ maps are for general reference purposes only\". Because they overlap, the answer for the underlying numbered area is still correct — the department confirms that \"Hunters who hold a valid licence for an MMA that overlaps with a portion of an MRZ are permitted to hunt the portion of the MRZ that is within their MMA boundary\" — so this is a missing licence opportunity, not a wrong answer. The Order calls area 100 the Eastern Moose Reduction Zone and the guide calls it the Avalon MRZ.",
  },
  {
    what: "Moose inside Gros Morne National Park and Terra Nova National Park",
    reason: "FEDERAL GEOGRAPHY AND RULES NOT CERTIFIED",
    detail:
      "The guide publishes real park moose seasons in park sub-areas the provincial order does not describe — Gros Morne \"2E: Zone 1\" through \"2E: Zone 4\" with three different opening dates and Zone 4 closed, and Terra Nova \"28A\" — with 90 of the not-for-profit licences issued by Parks Canada. The province's area service quarantines both park polygons. North Ground therefore resolves no zone inside either park and must never report moose as closed there.",
  },
  {
    what: "Caribou in Labrador",
    reason: "DECLARED CLOSED, NO GEOGRAPHY TO ANSWER IN",
    detail:
      "NLR 43/26 s. 8 declares no open season in Labrador for caribou, for the purpose of conservation. The province's caribou area layer is Island-only, so there is no Labrador caribou zone to resolve and the closure is carried as a limitation rather than as a rule with a geography.",
  },
  {
    what: "Small game — ptarmigan, grouse, snowshoe hare, arctic hare, porcupine, red squirrel",
    reason: "GEOGRAPHY NOT HELD",
    detail:
      "NLR 43/26 ss. 13 and 14 give real seasons, but the Island ones are scoped to small game management areas (the Burin Area, the Avalon/Swift Current Area, the Topsails Area, the Pine Marten Study Area, the Main River Study Area, the Little Grand Lake Wild Life Reserve and the Little Grand Lake Provisional Ecological Reserve) and to named islands (Great Island, Little Bay Islands, Bell Island, Glover Island, Kelly's Island, Brunette Island). North Ground holds none of that geography, and three of the Island's ptarmigan windows differ by area, so a point cannot be resolved. Labrador's small game seasons are Labrador-wide and would be answerable if a Labrador extent were served.",
  },
  {
    what: "Coyote, wolf and fur bearing animals",
    reason: "GEOGRAPHY NOT HELD",
    detail:
      "Coyote shooting is province-wide under NLR 43/26 s. 15 (12 September 2026 to 15 July 2027), which needs no zone; coyote trapping and the fur bearing animals are scoped to fur management areas and zones described in another order's schedules, which North Ground does not hold. One composed rule is worth encoding next: the guide states that a holder of a valid moose, caribou or black bear licence may take coyote during that species' open season and in the management area the licence is valid for — geography North Ground already serves.",
  },
  {
    what: "Polar bear in Labrador",
    reason: "GEOGRAPHY NOT HELD",
    detail:
      "NLR 43/26 s. 12 gives a season from 1 February to 30 June 2027 in the area from Fish Cove Point in Groswater Bay to Cape Chidley. That description is not a served layer, and polar bear is not in North Ground's species catalogue.",
  },
  {
    what: "Fees",
    reason: "CURRENTNESS NOT INDEPENDENTLY CERTIFIED",
    detail:
      "The guide prints licence fees and says of them \"All licence fees are non-refundable and subject to change\" and \"Prices do not include HST\", and adds a $3.00 vendor fee. §41A requires two independent certifications — that a fee belongs to the authorization for the evaluated hunt, and that the fee source is current in its own terms — and the second has not been established, so no figure is shown.",
  },
  {
    what: "Legal hunting hours in Labrador",
    reason: "OBSERVED CLOCK NOT CERTIFIED",
    detail:
      "The rule itself is certain and province-wide: Wild Life Regulations s. 42(2) prohibits hunting big game from half an hour after sunset to half an hour before sunrise. The CLOCK is not. Labrador is not one timezone — most of it keeps Atlantic Time while a southeastern coastal strip keeps Newfoundland Time — and North Ground has not certified where that line runs. A window shown in the wrong one of those would be wrong by thirty minutes at both ends, so Labrador answers state the rule and decline the clock. The Island is wholly Newfoundland Time and gets a computed window.",
  },
  {
    what: "Whether the Minister has designated Labrador areas for .22 centre-fire rifles",
    reason: "POWER UNEXERCISED IN THE ORDERS READ",
    detail:
      "Wild Life Regulations s. 107(15) lets the Minister designate Labrador areas where .22 calibre centre-fire rifles may be used for big game, despite the .243 minimum in s. 107(14). None of the ten hunting orders North Ground read designates any, and the guide reproduces the .243 minimum with no Labrador exception. The minimum is therefore encoded province-wide, with the unexercised power recorded rather than assumed away.",
  },
];

/* ── Assemble ───────────────────────────────────────────────────────────── */

const bundle = {
  bundleId: "regulatory_bundle:ca-nl-2026",
  jurisdictionId: "jurisdiction:ca-nl",
  sourceVersion: SOURCE_VERSION,
  retrievedAt: RETRIEVED,
  licenceYear: null,
  whyThereIsNoLicenceYear: {
    finding:
      "Newfoundland and Labrador does not issue big game licences for a licence year. Wild Life Regulations s. 35(3): every big game licence, seal and tag \"is valid only until the big game animal has been killed or for the period of the open season in respect of which the licence, seal or tag is issued, whichever first occurs.\"",
    negativeControl:
      "\"licence year\" and \"license year\" occur zero times in the Wild Life Act, the Wild Life Regulations and the ten hunting orders read for this bundle, while \"open season\" occurs 48 times in the Regulations alone.",
    whatTheAuthorityDefinesInstead: [
      "Event-based expiry — the licence ends when the animal is killed (s. 35(3)).",
      "Season-based expiry — otherwise it ends with the open season it was issued for (s. 35(3)).",
      "A twelve-month allocation period ending 30 April, which limits how many draw licences a resident may HOLD rather than how long one lasts (s. 35(5)).",
      "An annual Order, dated and filed, which is what actually turns over each year (NLR 43/26).",
    ],
  },
  certifiedPeriod: {
    from: "2026-08-10",
    to: "2027-07-15",
    reason:
      "The Open Seasons Hunting and Trapping Order, 2026-2027 is certified for exactly the span it prescribes: from the earliest window it opens (Labrador black bear, 10 August 2026) to the latest it closes (Island black bear, 15 July 2027). Outside that span this bundle has no authority, because the next Order had not been made when it was read.",
  },
  absence: ABSENCE,
  sources: SOURCES,
  legalHours: {
    basis: "SUNRISE_SUNSET_OFFSET",
    statedAs:
      "A person shall not hunt, take or kill big game during the period commencing one-half hour after sunset on any day ending and ending one-half hour before sunrise on the day next following.",
    section: "Wild Life Regulations s. 42(2)",
    statedAsAProhibition: true,
    howItWasDerived:
      "The regulation states the CLOSED period, so the permitted window is its inverse: half an hour before sunrise to half an hour after sunset. The department's guide states the same rule the other way up — \"It is unlawful to hunt big game earlier than one-half hour before sunrise or later than one-half hour after sunset\" — which is the cross-check on the inversion.",
    sunriseIsNotDefined:
      "Unlike Nova Scotia, Newfoundland and Labrador does not define sunrise and sunset as a published table. Neither word is defined anywhere in the Act or the Regulations, so they are the astronomical events at the hunt location and North Ground may compute them.",
    smallGameIsNotCovered:
      "s. 42(2) speaks only of BIG GAME. Small game has no night window in these regulations, only the artificial-light prohibition in s. 42(1). A daylight window for small game would be stricter than the source.",
    theSourceTypo:
      "The official version reads \"commencing one-half hour after sunset on any day ending and ending one-half hour before sunrise\". The duplicated \"ending\" is in the King's Printer text; the rule it states is unambiguous.",
  },
  units: [
    ...[...MOOSE_ISLAND, ...MOOSE_LABRADOR].map((d) => ({ identifier: d, zoneId: zoneId("mma", d) })),
    ...[...CARIBOU_ISLAND_DECEMBER, ...CARIBOU_MERASHEEN, ...CARIBOU_GREY_ISLANDS, ...CARIBOU_FOGO, ...CARIBOU_CLOSED]
      .map((d) => ({ identifier: d, zoneId: zoneId("cma", d) })),
    ...[...BEAR_ISLAND, ...BEAR_LABRADOR].map((d) => ({ identifier: d, zoneId: zoneId("bma", d) })),
  ],
  officialUnitCount: MOOSE_ISLAND.length + MOOSE_LABRADOR.length + CARIBOU_ISLAND_DECEMBER.length + CARIBOU_MERASHEEN.length + CARIBOU_GREY_ISLANDS.length + CARIBOU_FOGO.length + CARIBOU_CLOSED.length + BEAR_ISLAND.length + BEAR_LABRADOR.length,
  /*
   * ONE PROVINCE, THREE DENOMINATORS — because the province manages each species
   * in its own areas rather than in one shared set.
   *
   * 100 polygons cover the same ground three times over: 74 moose areas, 19
   * caribou areas and 7 black bear areas. Measuring moose against 100 reports it
   * CLOSED in 26 units that are caribou and black bear areas, and caribou CLOSED
   * in 81 that are not caribou areas at all — closures no hunter could ever be
   * shown, because the layers are species-scoped and a caribou question never
   * resolves to a moose area. §8 requires capability reporting to measure
   * deliverable answers, so each species is measured against the authority's own
   * count for THAT species.
   */
  officialUnitCountBySpecies: {
    "species:moose": MOOSE_ISLAND.length + MOOSE_LABRADOR.length,
    "species:caribou": CARIBOU_ISLAND_DECEMBER.length + CARIBOU_MERASHEEN.length + CARIBOU_GREY_ISLANDS.length + CARIBOU_FOGO.length + CARIBOU_CLOSED.length,
    "species:american-black-bear": BEAR_ISLAND.length + BEAR_LABRADOR.length,
  },
  groups: GROUPS,
  rules: RULES,
  islandAndLabrador: {
    finding:
      "Every rule in this bundle is Island-scoped or Labrador-scoped, and none is provincial. Island moose closes 31 December while Labrador moose runs to 14 March; Labrador black bear opens 10 August against the Island's 12 September; caribou has four Island windows and no Labrador season at all.",
    howTheSplitWasDerived:
      "From the Moose Hunting Order's own wording for each of the 76 areas it names — Schedule B's entries open \"All that area of Labrador\" and Schedule A's name Newfoundland — rather than from a numeric range. The ranges interleave: Labrador is 48 to 60 AND 84 to 96. Area 51 is \"Baikie Lake\" in Labrador in the Order while the province's map service calls the same area \"Grand Falls\", which reads as an Island town; taking the map's name for the Order's would have put a Labrador area on the Island and given it a season ending ten weeks early.",
    fiftyPlusTwentyFour:
      "Schedule A names 52 areas and Schedule B names 24. Two of Schedule A's — 100 and 101, the Moose Reduction Zones — have no published geometry, so 50 Island areas and 24 Labrador areas are answerable, which is exactly the 74 the certification run parity-checked.",
  },
  theBearAreaThatIsNotInAnyOrder: {
    finding:
      "The province's map service carries a black bear polygon numbered 200 and names it \"Labrador\". The Black Bear Hunting and Trapping Order's Schedule describes areas 201 to 206 only, all on the Island, and never mentions 200.",
    whyItStillAnswers:
      "NLR 43/26 s. 6 sets the Labrador black bear season for Labrador as a whole rather than for an area, so the rule needs no area to be correct. The polygon is the province's own cartographic extent of Labrador, which is the right geography for a Labrador-wide rule.",
    whatItIsNot:
      "It is not a black bear management area in law. \"management area\" is defined in Wild Life Regulations s. 2 as an area \"described in an order made under these regulations\", and no order describes this one. A label reading \"Black Bear Management Area 200\" would assert a legal object the Order does not create.",
  },
  guideCrossCheck: {
    whatWasCompared:
      "Every date in this bundle was read from NLR 43/26 and then checked against the department's Hunting and Trapping Guide 2026-27. The Order controls in every case; the guide's disagreements are recorded rather than resolved silently.",
    agreements: [
      "Island moose 12 September to 31 December 2026; Labrador moose 12 September 2026 to 14 March 2027.",
      "Island caribou by area, including Merasheen (70) 19 September to 4 October and Fogo Island (72) 12 September to 11 October.",
      "Both Grey Islands areas open 12 September to 30 November, against the map service's stale CLOSED attribute.",
      "Black bear bag limit of two per licence, and the new prohibition on cubs and accompanied females.",
      "Legal hours: half an hour before sunrise to half an hour after sunset for big game.",
      "The .243 calibre minimum, with no Labrador exception.",
      "The pre-season excludes crossbows.",
    ],
    disagreements: [
      { where: "Labrador moose pre-season", guide: "Bow hunting begins August 29, 2025", order: "August 29, 2026", resolution: "The Order controls. A 2025 date in a 2026-27 publication is a typographical error." },
      { where: "Labrador black bear spring season", guide: "April 1 to July 13, 2026", order: "April 1, 2027 to July 13, 2027", resolution: "The Order controls. The guide's year would have a hunter believe the spring season had already passed." },
      { where: "Closed caribou areas", guide: "Zones 63, 65, and 69 are Closed", order: "No season is named for 63, 65, 69, 73, 74 or 75", resolution: "All six are closed. The guide's list is incomplete against the geography, and a hunter relying on it would infer three open areas that are not open." },
      { where: "The pre-season bow", guide: "long bow, recurve bow or compound bow", order: "long bow or compound bow and arrow", resolution: "Recorded, not resolved. The guide is the broader statement; the Order does not name a recurve bow, and North Ground has not established whether one is a long bow for this purpose." },
      { where: "Moose management area 100", guide: "Avalon MRZ", order: "Eastern Moose Reduction Zone", resolution: "A naming difference in an area neither publishes geometry for." },
    ],
  },
  deliberatelyNotEncoded: NOT_ENCODED,
  whyTheZoneListIsUnderGhas:
    "`ghas` is the engine's generic list of area designations, named for the first jurisdiction wired to it. Newfoundland and Labrador's areas are moose, caribou and black bear management areas, each its own geography for its own species, and they go in the same field.",
};

writeFileSync(OUT, `${JSON.stringify(bundle, null, 1)}\n`);
const bySpecies = {};
for (const r of bundle.rules) bySpecies[r.speciesId] = (bySpecies[r.speciesId] ?? 0) + 1;
console.log(`${OUT}: ${bundle.rules.length} rules, ${bundle.units.length} units, ${bundle.sources.length} sources`);
console.log(bySpecies);
