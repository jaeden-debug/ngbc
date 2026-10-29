/**
 * British Columbia deer: mule (black-tailed) deer and white-tailed deer, read
 * from B.C. Reg. 190/84 Schedules 1–8 as consolidated to October 27, 2026.
 *
 * A deer season in British Columbia is a Part 1 row narrowed by Part 2 clauses
 * that name their own units and days: a four-point restriction on some weeks
 * of a buck season, a youth-only restriction on the first nine days, an
 * island with its own dates. So nothing here is a rule yet. This file states
 * what was read — every row's printed units, every restriction with the days
 * and units it names, every Part 2 season — and `composeDeer` turns them into
 * rules by walking each season day by day and asking which restrictions reach
 * that day. A rule therefore opens exactly on the days the regulation leaves
 * open on the terms it states, and no restriction is applied beyond its own
 * units, days or class.
 *
 * Every `quote` is checked verbatim against its schedule's Part 2 on every
 * build, and every row's printed units against `spec`; a changed regulation
 * stops the build rather than being read through a stale plan.
 */

const MD = "species:mule-deer";
const WT = "species:white-tailed-deer";

/* Mule deer buck antler restrictions, as ANIMAL_CLASS:ANTLER_POINTS answers.
   The regulation counts points (tines) of at least 2.5 cm on one antler, not
   counting the brow tine. */
export const MD4 = ["MD_FOUR_OR_MORE"];
export const MD2 = ["MD_TWO_OR_THREE", "MD_FOUR_OR_MORE"];

/** Areas no boundary of which North Ground holds: they are asked about, never assumed. */
export const DEER_AREAS = [
  { kind: "area", id: "bc-s1-deer-campbell", schedule: 1, section: "s. 1 (6)", species: [],
    name: "The portion of M.U. 1-6 between the District of Campbell River, the BC Hydro 138 KV line and the Strait of Georgia",
    candidateAreas: ["1-6"],
    quote: "In that portion of M.U. 1-6 bounded on the north by the southern boundary of the District of Campbell River" },
  { kind: "area", id: "bc-s1-deer-denman-hornby", schedule: 1, section: "s. 1 (6.1), (16)", species: [],
    name: "Denman and Hornby Islands (M.U. 1-6)", candidateAreas: ["1-6"],
    quote: "In that portion of M.U. 1-6 that is known as Denman and Hornby Islands" },
  { kind: "area", id: "bc-s1-deer-sidney-james", schedule: 1, section: "s. 1 (7)", species: [],
    name: "Sidney Island outside the Gulf Islands National Park Reserve, and James Island (M.U. 1-1)", candidateAreas: ["1-1"],
    quote: "in that portion of Sidney Island outside the boundaries of the Gulf Islands National Park Reserve and on James Island" },
  { kind: "area", id: "bc-s1-deer-s1-8", schedule: 1, section: "s. 1 (8)", species: [],
    name: "The portions of M.U.s 1-1, 1-2 and 1-4 to 1-6 described in Schedule 1 Part 2 s. 1 (8), excluding Indian Reserve lands",
    candidateAreas: ["1-1", "1-2", "1-4", "1-5", "1-6"],
    quote: "In those portions of M.U.s 1-1, 1-2, 1-4, 1-5 and 1-6 that are contained within the following described boundaries" },
  { kind: "area", id: "bc-s1-deer-quadra", schedule: 1, section: "s. 1 (12)", species: [],
    name: "Quadra Island south of North Gowland Harbour Road and Lakberg Road (M.U. 1-15)", candidateAreas: ["1-15"],
    quote: "On that portion of M.U. 1-15 known as Quadra Island south of the midline of North Gowland Harbour Road and Lakberg Road" },
  { kind: "area", id: "bc-s1-deer-iron-river", schedule: 1, section: "s. 1 (14)", species: [],
    name: "Managed Forest Unit 19 Block 8 Iron River (M.U. 1-6)", candidateAreas: ["1-6"],
    quote: "that portion of M.U. 1-6 known as Managed Forest Unit (MFU) 19 Block 8 Iron River" },
  { kind: "area", id: "bc-s1-deer-valdes", schedule: 1, section: "s. 1 (17)", species: [],
    name: "Valdes Island (M.U. 1-1)", candidateAreas: ["1-1"],
    quote: "On that portion of M.U. 1-1 known as Valdes Island" },
  { kind: "area", id: "bc-s1-deer-nanaimo-south", schedule: 1, section: "s. 4 (4) (b), (5)", species: [],
    name: "The watershed of the south fork of the Nanaimo River (M.U. 1-5)", candidateAreas: ["1-5"],
    quote: "that portion of M.U. 1-5 being the watershed of the south fork of the Nanaimo River" },
  { kind: "area", id: "bc-s2-deer-bowen", schedule: 2, section: "s. 1 (1) (a)", species: [],
    name: "Bowen Island (M.U. 2-16)", candidateAreas: ["2-16"],
    quote: "(a) Bowen Island, the open season for antlered mule (black-tailed) deer is September 1 to December 15" },
  { kind: "area", id: "bc-s2-deer-texada", schedule: 2, section: "s. 1 (1) (b)", species: [],
    name: "Texada Island (M.U. 2-16)", candidateAreas: ["2-16"],
    quote: "(b) Texada Island, the open seasons for mule (black-tailed) deer bucks and antlerless mule (black-tailed) deer is from December 16 to January 15" },
  { kind: "area", id: "bc-s2-deer-2-11-zone-a", schedule: 2, section: "Part 1 item 6.1", species: [],
    name: "Zone A of M.U. 2-11 (map '2010 Mule Deer GOS Zone A of 2-11')", candidateAreas: ["2-11"],
    quote: "Zone A of M.U. 2-11, as shown on map '2010 Mule Deer GOS Zone A of 2-11'" },
  { kind: "area", id: "bc-s4-deer-cranbrook", schedule: 4, section: "Part 1 items 4.1, 7.1", species: [],
    name: "The portions of M.U.s 4-3 to 4-5 and 4-20 on map '2025 Mule Deer & White-Tail Deer Cranbrook General Open Season'",
    candidateAreas: ["4-3", "4-4", "4-5", "4-20"],
    reason: "Part 1 of Schedule 4 names this area by its map, which North Ground does not hold; it cannot tell whether this point is inside it." },
  { kind: "area", id: "bc-s5-deer-5-11-hotnarko", schedule: 5, section: "s. 9 (7) (b)", species: [],
    name: "The portion of M.U. 5-11 described in Schedule 5 Part 2 s. 9 (7) (b) (Hotnarko and Atnarko rivers)", candidateAreas: ["5-11"],
    quote: "in that portion of M.U. 5-11 contained within the following described boundaries: commencing at the point of intersection of the midline of Hotnarko River" },
];

/**
 * Every Part 1 deer row. `spec` is the unit column as printed, asterisks
 * removed. `parts` splits a row where Part 2 gives part of its ground its own
 * season or excludes it; with no `parts` the row is its printed units.
 */
export const DEER_ROWS = {
  "1:1": { spec: "1-1 to 1-15",
    // Denman and Hornby, and Sidney and James islands, have their own deer seasons (s. 1 (7), (16)).
    // Iron River (s. 1 (14)) is part of the row with its own antler restriction.
    parts: [
      { units: "1-1 to 1-15", exclude: ["bc-s1-deer-denman-hornby", "bc-s1-deer-sidney-james", "bc-s1-deer-iron-river"] },
      { include: ["bc-s1-deer-iron-river"] },
    ] },
  "2:1": { spec: "2-16", parts: [{ units: "2-16", exclude: ["bc-s2-deer-bowen", "bc-s2-deer-texada"] }] },
  "2:2": { spec: "2-16", parts: [{ units: "2-16", exclude: ["bc-s2-deer-bowen", "bc-s2-deer-texada"] }] },
  "2:4": { spec: "2-9 to 2-11" },
  "2:5": { spec: "2-2 to 2-4, 2-6 to 2-8, 2-13 to 2-15, 2-17 to 2-19" },
  "2:5.1": { spec: "2-5, 2-12" },
  "2:6": { spec: "2-16", parts: [{ units: "2-16", exclude: ["bc-s2-deer-bowen", "bc-s2-deer-texada"] }] },
  "2:6.1": { spec: "Zone A of 2-11 as shown on map '2010 Mule Deer GOS Zone A of 2-11'",
    parts: [{ include: ["bc-s2-deer-2-11-zone-a"] }] },
  "3:1": { spec: "3-12 to 3-14, 3-17 to 3-31, 3-34 to 3-44" },
  "3:2": { spec: "3-15, 3-16, 3-32, 3-33" },
  "3:3": { spec: "3-12 to 3-20, 3-26 to 3-44" },
  "3:4": { spec: "3-46" },
  "3:5": { spec: "3-12 to 3-20, 3-26 to 3-44, 3-46" },
  "3:6": { spec: "3-12 to 3-20, 3-26 to 3-44, 3-46" },
  "3:7": { spec: "3-12 to 3-20, 3-26 to 3-44" },
  "3:8": { spec: "3-12 to 3-20, 3-26 to 3-44" },
  "3:8.1": { spec: "3-46" },
  "3:9": { spec: "3-12 to 3-20, 3-26 to 3-44, 3-46" },
  "3:10": { spec: "3-12 to 3-20, 3-26 to 3-44" },
  "3:10.1": { spec: "3-12 to 3-20, 3-26 to 3-44, 3-46" },
  "4:1": { spec: "4-1 to 4-9, 4-14 to 4-40" },
  "4:4": { spec: "4-1 to 4-9, 4-14 to 4-40" },
  "4:4.1": { spec: "Those portions of 4-3 to 4-5 and 4-20 shown on map '2025 Mule Deer & White-Tail Deer Cranbrook General Open Season'",
    parts: [{ include: ["bc-s4-deer-cranbrook"] }] },
  "4:5": { spec: "4-1 to 4-9, 4-14 to 4-40" },
  "4:6.1": { spec: "4-28 to 4-31, 4-38, 4-39" },
  "4:6.2": { spec: "4-1 to 4-6, 4-20 to 4-26, 4-34 to 4-37, 4-40" },
  "4:7": { spec: "4-1 to 4-9, 4-14 to 4-40" },
  "4:7.1": { spec: "Those portions of 4-3 to 4-5 and 4-20 shown on map '2025 Mule Deer & White-Tail Deer Cranbrook General Open Season'",
    parts: [{ include: ["bc-s4-deer-cranbrook"] }] },
  "5:1": { spec: "5-4, 5-5, 5-6, 5-15" },
  "5:2": { spec: "5-1 to 5-6, 5-10 to 5-15" },
  "5:3": { spec: "5-1 to 5-6, 5-10 to 5-15" },
  "5:3.1": { spec: "5-7 to 5-9" },
  "5:4": { spec: "5-1 to 5-6, 5-8, 5-11 to 5-15" },
  "5:4.1": { spec: "5-1 to 5-6, 5-8, 5-11 to 5-15" },
  "5:4.2": { spec: "5-1 to 5-6, 5-8, 5-11 to 5-15" },
  "5:4.3": { spec: "5-1 to 5-6, 5-8, 5-11 to 5-15" },
  "6:1": { spec: "6-1, 6-2, 6-4 to 6-9, 6-30" },
  "6:2": { spec: "6-3, 6-10, 6-11, 6-14, 6-15" },
  "6:3": { spec: "6-1, 6-2, 6-4 to 6-9, 6-30" },
  "6:4": { spec: "6-7 to 6-9, 6-30" },
  "6:5": { spec: "6-1, 6-2, 6-4 to 6-6" },
  "6:6": { spec: "6-12, 6-13" },
  "6:7": { spec: "6-12, 6-13" },
  "6:8": { spec: "6-1 to 6-11, 6-14, 6-15, 6-30" },
  "6:8.1": { spec: "6-1 to 6-11, 6-14, 6-15, 6-30" },
  "6:8.2": { spec: "6-1 to 6-11, 6-14, 6-15, 6-30" },
  "6:8.3": { spec: "6-1 to 6-11, 6-14, 6-15, 6-30" },
  "6:8.4": { spec: "6-1 to 6-11, 6-14, 6-15, 6-30" },
  "7:1": { spec: "7-2 to 7-11, 7-15 to 7-18, 7-23, 7-26 to 7-30, 7-37 to 7-41" },
  "7:2": { spec: "7-2 to 7-11, 7-15 to 7-18, 7-23, 7-26 to 7-30, 7-37 to 7-41" },
  /* The law opens four-point bucks here from September 10; the synopsis prints October 1. The days
     only the law opens are carried as its reading of a dispute. */
  "7:2.1": { spec: "7-12 to 7-14, 7-24, 7-25",
    parts: [
      { units: "7-12 to 7-14, 7-24, 7-25", season: "Oct. 1 to Nov. 15" },
      { units: "7-12 to 7-14, 7-24, 7-25", season: "Sept. 10 to Sept. 30", dispute: "7-12 four-point" },
    ] },
  // s. 2 (9): in 7-43 this season is confined to Zone A of 7-43.
  "7:2.2": { spec: "7-19, 7-36, 7-42, 7-43, 7-48 to 7-52, 7-57, 7-58",
    parts: [{ units: "7-19, 7-36, 7-42, 7-48 to 7-52, 7-57, 7-58" }, { include: ["bc-s7-elk-7-43a"] }] },
  "7:2.3": { spec: "7-12 to 7-14, 7-24, 7-25" },
  // Part 2 s. 2 (12) (a) makes this row's season bow only.
  "7:2.4": { spec: "7-2 to 7-18, 7-23 to 7-30, 7-37 to 7-41", bow: { section: "s. 2 (12) (a)",
    quote: "(a) in M.U.s 7-2 to 7-18, 7-23 to 7-30 and 7-37 to 7-41, from September 1 to September 9" } },
  "7:2.5": { spec: "7-2 to 7-11, 7-15 to 7-18, 7-23, 7-26 to 7-30, 7-37 to 7-41" },
  // Part 2 s. 2 (12) (b) makes this row's season bow only.
  "7:2.6": { spec: "7-20, 7-21, 7-32 to 7-35, 7-44 to 7-47", bow: { section: "s. 2 (12) (b)",
    quote: "(b) in M.U.s. 7-20, 7-21, 7-32 to 7-35 and 7-44 to 7-47, from September 1 to 30" } },
  // s. 2 (9): in 7-43 this season is confined to Zone B of 7-43.
  "7:3": { spec: "7-20 to 7-22, 7-31 to 7-35, 7-43 to 7-47, 7-54",
    parts: [{ units: "7-20 to 7-22, 7-31 to 7-35, 7-44 to 7-47, 7-54" }, { include: ["bc-s7-elk-7-43b"] }] },
  // Part 2 s. 2 (8) makes this row's season bow only.
  "7:7": { spec: "7-12 to 7-14, 7-24, 7-25", bow: { section: "s. 2 (8)",
    quote: "The open season for antlerless mule deer with a bow only in M.U.s 7-12 to 7-14, 7-24 and 7-25 is from September 1 to September 9" } },
  "7:7.1": { spec: "7-12 to 7-14, 7-24, 7-25" },
  "7:8": { spec: "7-2 to 7-18, 7-23 to 7-30, 7-37 to 7-41" },
  "7:8.1": { spec: "7-19 to 7-22, 7-31 to 7-36, 7-42 to 7-50, 7-54 to 7-58" },
  "7:10": { spec: "7-2 to 7-50, 7-54 to 7-58" },
  "7:12": { spec: "7-2 to 7-18, 7-23 to 7-30, 7-32 to 7-34, 7-37 to 7-41, Zone A of 7-20 as shown on map '2010 Elk GOS Zone A of 7-20'",
    parts: [{ units: "7-2 to 7-18, 7-23 to 7-30, 7-32 to 7-34, 7-37 to 7-41", include: ["bc-s7-elk-7-20a"] }] },
  "7:12.1": { spec: "7-2 to 7-5, 7-7 to 7-10, 7-12, 7-13, 7-15, 7-17, 7-32 to 7-34, Zone A of 7-20 as shown on map '2010 Elk GOS Zone A of 7-20'",
    parts: [{ units: "7-2 to 7-5, 7-7 to 7-10, 7-12, 7-13, 7-15, 7-17, 7-32 to 7-34", include: ["bc-s7-elk-7-20a"] }] },
  "8:1": { spec: "8-1 to 8-11, 8-21 to 8-26" },
  "8:2": { spec: "8-1 to 8-11, 8-21 to 8-26" },
  "8:3": { spec: "8-1 to 8-11, 8-21 to 8-26" },
  "8:4": { spec: "8-12 to 8-15" },
  "8:5": { spec: "8-1 to 8-15, 8-21 to 8-26" },
  "8:7": { spec: "8-1 to 8-15, 8-21 to 8-26" },
  "8:8": { spec: "8-1 to 8-15, 8-21 to 8-26" },
  "8:9": { spec: "8-1 to 8-15, 8-21 to 8-26" },
  "8:9.1": { spec: "8-1 to 8-15, 8-21 to 8-26" },
};

/**
 * Part 2 restrictions on deer seasons. Each reaches only its species, class,
 * units (or area) and days. `points` narrows bucks to the antlers it names;
 * `ages` narrows the season to the hunters it names. `exceptBow` is the
 * regulation's own "excepting bow only seasons".
 */
export const DEER_RESTRICTIONS = [
  // Schedule 1
  { schedule: 1, section: "s. 1 (14)", species: MD, cls: "ANTLERED", include: ["bc-s1-deer-iron-river"], days: "Sept. 10 to Dec. 10", points: MD2,
    quote: "there is no open season on mule (black-tailed) deer bucks from September 10 to December 10 in that portion of M.U. 1-6 known as Managed Forest Unit (MFU) 19 Block 8 Iron River unless the buck has at least two tines (points) on one antler, not including the brow tine" },
  // Schedule 2
  { schedule: 2, section: "Part 2 (youth)", species: MD, cls: "ANTLERLESS", units: "2-16", days: "Oct. 21 to Oct. 31", ages: ["UNDER_18"], exceptBow: true,
    quote: "The open season, excepting bow only seasons, for hunting antlerless mule (black-tailed) deer in M.U. 2-16 from October 21 to October 31 is restricted to persons who are less than 18 years of age" },
  { schedule: 2, section: "Part 2 (youth and 65 or older)", species: MD, cls: "ANTLERLESS", include: ["bc-s2-deer-2-11-zone-a"], days: "Sept. 10 to Sept. 30", ages: ["UNDER_18", "SENIOR_65"],
    quote: "from September 10 to September 30 is restricted to persons who are less than 18 years of age or at least 65 years of age" },
  // Schedule 3
  { schedule: 3, section: "s. 1 (4) (a)", species: MD, cls: "ANTLERED", units: "3-12 to 3-14, 3-17 to 3-20, 3-26 to 3-31, 3-34 to 3-44", days: "Sept. 10 to Sept. 30 Nov. 1 to Dec. 10", points: MD4,
    quote: "(a) in M.U.s 3-12 to 3-14, 3-17 to 3-20, 3-26 to 3-31 and 3-34 to 3-44 from September 10 to September 30, or from November 1 to December 10" },
  { schedule: 3, section: "s. 1 (4) (b)", species: MD, cls: "ANTLERED", units: "3-46", days: "Sept. 20 to Sept. 30 Nov. 1 to Dec. 10", points: MD4,
    quote: "(b) in M.U. 3-46 from September 20 to September 30, or from November 1 to December 10" },
  { schedule: 3, section: "s. 1 (4) (c)", species: MD, cls: "ANTLERED", units: "3-15, 3-16, 3-32, 3-33", days: "Sept. 1 to Sept. 9 Sept. 10 to Sept. 30 Nov. 1 to Dec. 10", points: MD4,
    quote: "(c) in M.U.s 3-15, 3-16, 3-32 and 3-33 from September 1 to September 9, or from September 10 to September 30, or from November 1 to December 10, unless the buck has at least one antler which has at least 4 points (tines) not including the brow tine" },
  { schedule: 3, section: "s. 9 (a)", species: MD, cls: "ANTLERED", units: "3-12 to 3-14, 3-17 to 3-31, 3-34 to 3-44", days: "Sept. 1 to Sept. 9", ages: ["UNDER_18"], exceptBow: true,
    quote: "(a) the open season, excepting bow only seasons, for hunting mule (black-tailed) deer bucks in M.U.s 3-12 to 3-14, 3-17 to 3-31 and 3-34 to 3-44 from September 1 to September 9" },
  { schedule: 3, section: "s. 9 (b)", species: WT, cls: "ANTLERED", units: "3-12 to 3-20, 3-26 to 3-44", days: "Sept. 1 to Sept. 9", ages: ["UNDER_18"], exceptBow: true,
    quote: "(b) the open season, excepting bow only seasons, for hunting white-tailed deer bucks in M.U.s 3-12 to 3-20 and 3-26 to 3-44 from September 1 to September 9" },
  { schedule: 3, section: "s. 9 (c)", species: WT, cls: "ANTLERLESS", units: "3-12 to 3-20, 3-26 to 3-44", days: "Nov. 1 to Nov. 30", ages: ["UNDER_18"],
    quote: "(c) the open season for hunting antlerless white-tailed deer in M.U.s 3-12 to 3-20 and 3-26 to 3-44 from November 1 to November 30" },
  // Schedule 4
  { schedule: 4, section: "s. 17 (1)", species: MD, cls: "ANTLERED", units: "4-1 to 4-9, 4-14 to 4-40", days: "Sept. 10 to Sept. 30 Nov. 1 to Nov. 10", points: MD4,
    quote: "A person commits an offence if the person kills a mule (black-tailed) deer buck in M.U.s 4-1 to 4-9 and 4-14 to 4-40 during the open season from September 10 to September 30 and November 1 to November 10" },
  { schedule: 4, section: "s. 17 (1)", species: MD, cls: "ANTLERED", units: "4-3, 4-4, 4-5, 4-20, 4-26", days: "Oct. 1 to Oct. 31", points: MD4,
    quote: "and in M.U.s 4-3, 4-4, 4-5, 4-20 and 4-26 during the open season from October 1 to October 31, unless the buck has at least 4 points on one antler, not including the brow tine" },
  { schedule: 4, section: "s. 23 (a)", species: WT, cls: "ANTLERED", units: "4-1 to 4-9, 4-14 to 4-40", days: "Sept. 1 to Sept. 9", ages: ["UNDER_18"], exceptBow: true,
    quote: "(a) the open seasons for hunting white-tailed deer bucks and mule (black-tailed) deer bucks in M.U.s 4-1 to 4-9 and 4-14 to 4-40 from September 1 to September 9" },
  { schedule: 4, section: "s. 23 (a)", species: MD, cls: "ANTLERED", units: "4-1 to 4-9, 4-14 to 4-40", days: "Sept. 1 to Sept. 9", ages: ["UNDER_18"], exceptBow: true,
    quote: "(a) the open seasons for hunting white-tailed deer bucks and mule (black-tailed) deer bucks in M.U.s 4-1 to 4-9 and 4-14 to 4-40 from September 1 to September 9" },
  { schedule: 4, section: "s. 23 (b)", species: WT, cls: "ANTLERLESS", units: "4-1 to 4-9, 4-14 to 4-40", days: "Nov. 1 to Nov. 30", ages: ["UNDER_18"], exceptBow: true,
    quote: "(b) the open season for hunting antlerless white-tailed deer in M.U.s 4-1 to 4-9 and 4-14 to 4-40 from November 1 to November 30" },
  // Schedule 5
  { schedule: 5, section: "s. 9 (5)", species: MD, cls: "ANTLERED", units: "5-1 to 5-16", days: "Sept. 10 to Sept. 30 Nov. 1 to Nov. 10 Nov. 21 to Nov. 30", points: MD4,
    quote: "there is no open season on mule (black-tailed) deer bucks during the period September 10 to September 30, November 1 to November 10 or November 21 to November 30 unless the buck has 4 or more points (tines) on at least one antler, excluding the brow tine" },
  { schedule: 5, section: "s. 9 (9)", species: MD, cls: "ANTLERED", units: "5-4, 5-5, 5-6, 5-15", days: "Sept. 1 to Sept. 9", points: MD4,
    quote: "there is no open season on mule (black-tailed) deer bucks during the period September 1 to September 9 in M.U.s 5-4, 5-5, 5-6 or 5-15 unless the buck has 4 or more points (tines) on at least one antler" },
  { schedule: 5, section: "s. 16 (a)", species: WT, cls: "ANTLERED", units: "5-1 to 5-6, 5-8, 5-11 to 5-15", days: "Sept. 1 to Sept. 9", ages: ["UNDER_18"], exceptBow: true,
    quote: "(a) the open season, excepting bow only seasons, for hunting white-tailed deer bucks in M.U.s 5-1 to 5-6, 5-8 and 5-11 to 5-15 from September 1 to September 9" },
  { schedule: 5, section: "s. 16 (b)", species: WT, cls: "ANTLERLESS", units: "5-1 to 5-6, 5-8, 5-11 to 5-15", days: "Nov. 1 to Nov. 30", ages: ["UNDER_18"],
    quote: "(b) the open season for hunting antlerless white-tailed deer in M.U.s 5-1 to 5-6, 5-8 and 5-11 to 5-15 from November 1 to November 30" },
  // Schedule 6
  { schedule: 6, section: "s. 11 (1)", species: MD, cls: "ANTLERED", units: "6-1, 6-2, 6-4 to 6-9, 6-30", days: "Sept. 10 to Sept. 30", points: MD4,
    quote: "there is no open season for hunting mule (black-tailed) deer buck in M.U.s 6-1, 6-2, 6-4 to 6-9 and 6-30 during the period September 10 to September 30 unless the buck has at least one antler with at least 4 tines (points), excluding the brow tine" },
  { schedule: 6, section: "s. 11 (3)", species: MD, cls: "ANTLERED", units: "6-7 to 6-9, 6-30", days: "Dec. 1 to Dec. 10", points: MD4,
    quote: "There is no open season for hunting mule (black-tailed) deer buck in M.U.s 6-7 to 6-9 and 6-30 with a bow only during the period December 1 to December 10 unless the buck has at least one antler with at least 4 tines (points)" },
  { schedule: 6, section: "s. 11", species: MD, cls: "ANTLERED", units: "6-1, 6-2, 6-4 to 6-6", days: "Oct. 20 to Nov. 15", points: MD4,
    quote: "there is no open season for hunting mule (black-tailed) deer bucks in M.U.s 6-1, 6-2 and 6-4 to 6-6 during the period October 20 to November 15 unless the buck has at least one antler with at least 4 tines (points)" },
  { schedule: 6, section: "s. 11", species: MD, cls: "ANTLERED", units: "6-7 to 6-9, 6-30", days: "Oct. 20 to Nov. 30", points: MD4,
    quote: "there is no open season for hunting mule (black-tailed) deer bucks in M.U.s 6-7 to 6-9 and 6-30 during the period October 20 to November 30 unless the buck has at least one antler with at least 4 tines (points)" },
  { schedule: 6, section: "s. 19 (a)", species: WT, cls: "ANTLERED", units: "6-1 to 6-11, 6-14, 6-15, 6-30", days: "Sept. 1 to Sept. 9 Dec. 11 to Dec. 20", ages: ["UNDER_18"], exceptBow: true,
    quote: "(a) the open seasons for hunting white-tailed deer bucks in M.U.s 6-1 to 6-11, 6-14, 6-15 and 6-30 from September 1 to September 9 and from December 11 to December 20" },
  { schedule: 6, section: "s. 19 (b)", species: WT, cls: "ANTLERLESS", units: "6-1 to 6-11, 6-14, 6-15, 6-30", days: "Dec. 1 to Dec. 20", ages: ["UNDER_18"], exceptBow: true,
    quote: "(b) the open season for hunting antlerless white-tailed deer in M.U.s 6-1 to 6-11, 6-14, 6-15 and 6-30 from December 1 to December 20" },
  // Schedule 7
  { schedule: 7, section: "s. 2 (1) (a)", species: MD, cls: "ANTLERED", units: "7-2 to 7-11, 7-15 to 7-18, 7-23, 7-26 to 7-30, 7-37 to 7-41", days: "Sept. 10 to Sept. 30 Nov. 1 to Nov. 30", points: MD4,
    quote: "(a) in M.U.s 7-2 to 7-11, 7-15 to 7-18, 7-23, 7-26 to 7-30 and 7-37 to 7-41 from September 10 to September 30 and from November 1 to November 30" },
  { schedule: 7, section: "s. 2 (1) (b)", species: MD, cls: "ANTLERED", units: "7-12 to 7-14, 7-24, 7-25", days: "Sept. 10 to Nov. 15", points: MD4,
    quote: "(b) in M.U.s 7-12 to 7-14, 7-24 and 7-25 from September 10 to November 15" },
  { schedule: 7, section: "s. 2 (1) (c)", species: MD, cls: "ANTLERED", units: "7-19, 7-36, 7-42, 7-43, 7-48 to 7-52, 7-57, 7-58", days: "Sept. 10 to Oct. 5", points: MD4,
    quote: "(c) in M.U.s 7-19, 7-36, 7-42, 7-43, 7-48 to 7-52, 7-57 and 7-58 from September 10 to October 5" },
  { schedule: 7, section: "s. 2 (1) (d)", species: MD, cls: "ANTLERED", units: "7-20 to 7-22, 7-31 to 7-35, 7-43 to 7-47, 7-54", days: "Nov. 1 to Nov. 30", points: MD4,
    quote: "(d) in M.U.s 7-20 to 7-22, 7-31 to 7-35, 7-43 to 7-47 and 7-54 from November 1 to November 30" },
  { schedule: 7, section: "s. 8.1 (a)", species: WT, cls: "ANTLERED", units: "7-2 to 7-50, 7-54 to 7-58", days: "Sept. 1 to Sept. 9", ages: ["UNDER_18"], exceptBow: true,
    quote: "(a) the open season, excepting bow only seasons, for hunting white-tailed deer bucks in M.U.s 7-2 to 7-50 and 7-54 to 7-58 from September 1 to September 9" },
  { schedule: 7, section: "s. 8.1 (b)", species: WT, cls: "ANTLERLESS", units: "7-2 to 7-5, 7-7 to 7-10, 7-12, 7-13, 7-15, 7-17, 7-32 to 7-34", include: ["bc-s7-elk-7-20a"], days: "Nov. 1 to Nov. 30", ages: ["UNDER_18"],
    quote: "(b) the open season for hunting antlerless white-tailed deer in M.U.s 7-2 to 7-5, 7-7 to 7-10, 7-12, 7-13, 7-15, 7-17, 7-32 to 7-34, and Zone A of 7-20" },
  { schedule: 7, section: "s. 8.1 (c)", species: MD, cls: "ANTLERLESS", units: "7-12 to 7-14, 7-24, 7-25", days: "Sept. 1 to Sept. 9 Oct. 1 to Oct. 19", ages: ["UNDER_18"],
    quote: "(i) in M.U.s 7-12 to 7-14, 7-24 and 7-25 from September 1 to September 9, and  (ii) in M.U.s 7-12 to 7-14, 7-24 and 7-25 from October 1 to October 19" },
  { schedule: 7, section: "s. 8.1 (d)", species: MD, cls: "ANTLERED", units: "7-2 to 7-11, 7-15 to 7-18, 7-23, 7-26 to 7-30, 7-37 to 7-41", days: "Sept. 10 to Sept. 30", ages: ["UNDER_18"], item: "2.5",
    quote: "(d) the open season for hunting mule (black-tailed) deer bucks in M.U.s 7-2 to 7-11, 7-15 to 7-18, 7-23, 7-26 to 7-30 and 7-37 to 7-41 from September 10 to September 30" },
  { schedule: 7, section: "s. 8.1 (e)", species: MD, cls: "ANTLERED", units: "7-12 to 7-14, 7-24, 7-25", days: "Oct. 1 to Oct. 19", ages: ["UNDER_18"], item: "2.3",
    quote: "(e) the open season for hunting mule (black-tailed) deer bucks in M.U.s 7-12 to 7-14, 7-24 and 7-25 from October 1 to October 19" },
  // Schedule 8
  { schedule: 8, section: "s. 1 (11) (a)", species: MD, cls: "ANTLERED", units: "8-1 to 8-11, 8-21 to 8-26", days: "Sept. 10 to Sept. 30 Nov. 1 to Nov. 10", points: MD4,
    quote: "(a) in M.U.s 8-1 to 8-11 and 8-21 to 8-26 during the periods September 10 to September 30 and November 1 to November 10" },
  { schedule: 8, section: "s. 1 (11) (b)", species: MD, cls: "ANTLERED", units: "8-12 to 8-15", days: "Sept. 10 to Nov. 10", points: MD4,
    quote: "(b) in M.U.s 8-12 to 8-15 during the period September 10 to November 10" },
  { schedule: 8, section: "s. 15 (a)", species: WT, cls: "ANTLERED", units: "8-1 to 8-15, 8-21 to 8-26", days: "Sept. 1 to Sept. 9", ages: ["UNDER_18"], exceptBow: true,
    quote: "(a) the open season, excepting bow only seasons, for hunting white-tailed deer bucks in M.U.s 8-1 to 8-15 and 8-21 to 8-26 from September 1 to September 9" },
  { schedule: 8, section: "s. 15 (b)", species: MD, cls: "ANTLERED", units: "8-1 to 8-15, 8-21 to 8-26", days: "Sept. 1 to Sept. 30", ages: ["UNDER_18"], item: "5",
    quote: "(b) the open season for hunting mule (black-tailed) deer bucks in M.U.s 8-1 to 8-15 and 8-21 to 8-26 from September 1 to September 30" },
  { schedule: 8, section: "s. 15 (c)", species: WT, cls: "ANTLERLESS", units: "8-1 to 8-15, 8-21 to 8-26", days: "Nov. 1 to Nov. 30", ages: ["UNDER_18"],
    quote: "(c) the open season for hunting antlerless white-tailed deer in M.U.s 8-1 to 8-15 and 8-21 to 8-" },
];

/** Seasons Part 2 itself opens. `cls` null is either sex. */
export const DEER_EXTRAS = [
  // Schedule 1
  { schedule: 1, section: "s. 1 (6)", species: MD, cls: "ANTLERLESS", include: ["bc-s1-deer-campbell"], season: "Sept. 10 to Dec. 10",
    quote: "the open season for antlerless mule (black-tailed) deer is from September 10 to December 10" },
  { schedule: 1, section: "s. 1 (6.1)", species: MD, cls: "ANTLERLESS", include: ["bc-s1-deer-denman-hornby"], season: "Oct. 5 to Dec. 10",
    quote: "known as Denman and Hornby Islands, the open season for antlerless mule (black-tailed) deer is from October 5 to December 10" },
  { schedule: 1, section: "s. 1 (16)", species: MD, cls: "ANTLERED", include: ["bc-s1-deer-denman-hornby"], season: "Oct. 5 to Dec. 10",
    quote: "known as Denman and Hornby Islands, the open season for mule (black-tailed) deer bucks is from October 5 to December 10" },
  { schedule: 1, section: "s. 1 (7)", species: MD, cls: null, include: ["bc-s1-deer-sidney-james"], season: "Aug. 26 to Feb. 28",
    quote: "is August 26 to February 28" },
  { schedule: 1, section: "s. 1 (8)", species: MD, cls: "ANTLERLESS", include: ["bc-s1-deer-s1-8"], season: "Sept. 10 to Dec. 10",
    note: "Indian Reserve lands within these areas are excluded (Schedule 1 Part 2 s. 1 (8) (f)).",
    quote: "excluding all Indian Reserve lands, the open season for antlerless mule (black-tailed) deer is from September 10 to December 10" },
  { schedule: 1, section: "s. 1 (12)", species: MD, cls: "ANTLERLESS", include: ["bc-s1-deer-quadra"], season: "Sept. 10 to Dec. 10",
    quote: "Quadra Island south of the midline of North Gowland Harbour Road and Lakberg Road, the open season for antlerless mule (black-tailed) deer is from September 10 to December 10" },
  { schedule: 1, section: "s. 1 (17)", species: MD, cls: "ANTLERLESS", include: ["bc-s1-deer-valdes"], season: "Nov. 1 to Nov. 10",
    quote: "known as Valdes Island, the open season for antlerless mule (black-tailed) deer is November 1 to November 10" },
  { schedule: 1, section: "s. 1.1 (1) (a), (2)", species: MD, cls: "ANTLERLESS", units: "1-1, 1-2, 1-4 to 1-6", season: "Aug. 25 to Sept. 9", bow: true, ages: ["UNDER_18"],
    quote: "(a) August 25 to September 9, restricted to the use of the bow only" },
  { schedule: 1, section: "s. 1.1 (1) (b), (2)", species: MD, cls: "ANTLERLESS", units: "1-1, 1-2, 1-4 to 1-6", season: "Sept. 10 to Dec. 10", ages: ["UNDER_18"],
    quote: "The open seasons described in subsection" },
  // Not on the Gulf Islands other than Gabriola, the south fork of the Nanaimo River (s. 4 (4)), or the islands with their own seasons.
  { schedule: 1, section: "s. 4 (1) (a)", species: MD, cls: "ANTLERED", units: "1-1 to 1-15", season: "Aug. 25 to Sept. 9", bow: true,
    exclude: ["bc-s1-4-bow-exceptions", "bc-s1-deer-denman-hornby", "bc-s1-deer-sidney-james"],
    quote: "(a) mule (black-tailed) deer bucks and black bear in M.U.s 1-1 to 1-15, is from August 25 to September 9" },
  { schedule: 1, section: "s. 4 (3), (5)", species: MD, cls: "ANTLERLESS", include: ["bc-s1-deer-s1-8"], season: "Aug. 25 to Sept. 9", bow: true,
    exclude: ["bc-s1-deer-valdes", "bc-s1-deer-nanaimo-south"],
    quote: "excluding all Indian Reserve Lands, the open season for hunting with a bow only for antlerless mule (black-tailed) deer is from August 25 to September 9" },
  // Schedule 2 — Bowen and Texada islands are bow only (s. 1 (2)).
  { schedule: 2, section: "s. 1 (1) (a), (2)", species: MD, cls: "ANTLERED", include: ["bc-s2-deer-bowen"], season: "Sept. 1 to Dec. 15", bow: true,
    quote: "(a) Bowen Island, the open season for antlered mule (black-tailed) deer is September 1 to December 15" },
  { schedule: 2, section: "s. 1 (1) (a), (2)", species: MD, cls: "ANTLERLESS", include: ["bc-s2-deer-bowen"], season: "Nov. 5 to Dec. 5", bow: true,
    quote: "for antlerless mule (black-tailed) deer the open season is November 5 to December 5" },
  { schedule: 2, section: "s. 1 (1) (a), (2)", species: MD, cls: null, include: ["bc-s2-deer-bowen"], season: "Jan. 1 to Jan. 15", bow: true,
    quote: "for any deer (antlered or antlerless), the open season is January 1 to January 15" },
  { schedule: 2, section: "s. 1 (1) (b), (2)", species: MD, cls: null, include: ["bc-s2-deer-texada"], season: "Dec. 16 to Jan. 15", bow: true,
    quote: "(b) Texada Island, the open seasons for mule (black-tailed) deer bucks and antlerless mule (black-tailed) deer is from December 16 to January 15" },
  { schedule: 2, section: "s. 4 (a)", species: MD, cls: "ANTLERED", units: "2-2 to 2-19", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "antlered mule (black-tailed) deer, black bear and blue, spruce (Franklin) and ruffed grouse in M.U.s 2-2 to 2-19" },
  // Schedule 3
  { schedule: 3, section: "s. 1 (7) (a)", species: MD, cls: "ANTLERED", units: "3-12 to 3-14, 3-17 to 3-31, 3-34 to 3-44", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "(a) mule (black-tailed) deer bucks with a bow only in M.U.s 3-12 to 3-14, 3-17 to 3-31 and 3-34 to 3-44" },
  { schedule: 3, section: "s. 1 (7) (b)", species: WT, cls: "ANTLERED", units: "3-12 to 3-20, 3-26 to 3-44", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "(b) white-tailed deer bucks with a bow only in M.U.s 3-12 to 3-20 and 3-26 to 3-44 is September 1 to September 9" },
  { schedule: 3, section: "s. 1 (9)", species: WT, cls: null, units: "3-12 to 3-20, 3-26 to 3-44", season: "Dec. 11 to Dec. 20", bow: true,
    quote: "The open season for hunting white-tailed deer of either sex with a bow only in M.U.s 3-12 to 3-20 and 3-26 to 3-44 is December 11 to December 20" },
  // Schedule 4
  { schedule: 4, section: "s. 15 (1)", species: MD, cls: "ANTLERED", units: "4-1 to 4-9, 4-14 to 4-40", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "The open season for hunting with a bow only for mule (black-tailed) deer bucks and white-tailed deer bucks in M.U.s 4-1 to 4-9, 4-14 to 4-40 is September 1 to September 9" },
  { schedule: 4, section: "s. 15 (1)", species: WT, cls: "ANTLERED", units: "4-1 to 4-9, 4-14 to 4-40", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "The open season for hunting with a bow only for mule (black-tailed) deer bucks and white-tailed deer bucks in M.U.s 4-1 to 4-9, 4-14 to 4-40 is September 1 to September 9" },
  { schedule: 4, section: "s. 15 (13)", species: WT, cls: null, units: "4-1 to 4-9, 4-14 to 4-40", season: "Dec. 1 to Dec. 20", bow: true,
    quote: "The open season for hunting with a bow only for white-tailed deer in M.U.s 4-1 to 4-9 and 4-14 to 4-40 is December 1 to December 20" },
  // Schedule 5
  { schedule: 5, section: "s. 9 (7) (b)", species: MD, cls: "ANTLERED", units: "5-8", include: ["bc-s5-deer-5-11-hotnarko"], season: "Dec. 1 to Dec. 24", bow: true,
    quote: "(b) December 1 to December 24 in M.U. 5-8 and in that portion of M.U. 5-11" },
  { schedule: 5, section: "s. 9 (8)", species: MD, cls: "ANTLERED", units: "5-1, 5-2, 5-3, 5-7, 5-8, 5-9, 5-12, 5-13, 5-14", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "The open season for hunting mule (black-tailed) deer bucks with a bow only is from September 1 to September 9 in M.U.s 5-1, 5-2, 5-3, 5-7, 5-8, 5-9, 5-12, 5-13 and 5-14" },
  { schedule: 5, section: "s. 9 (8)", species: MD, cls: "ANTLERED", units: "5-1 to 5-6, 5-13, 5-14", season: "Dec. 1 to Dec. 10", bow: true,
    quote: "and from December 1 to December 10 in M.U.s 5-1 to 5-6, 5-13 and 5-14" },
  { schedule: 5, section: "s. 14 (a)", species: WT, cls: "ANTLERED", units: "5-1 to 5-6, 5-8, 5-11 to 5-15", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "(a) in M.U.s 5-1 to 5-6, 5-8 and 5-11 to 5-15 is from September 1 to September 9" },
  { schedule: 5, section: "s. 14 (b)", species: WT, cls: "ANTLERED", units: "5-1, 5-2, 5-8, 5-11, 5-13, 5-14", season: "Dec. 1 to Dec. 10", bow: true,
    quote: "(b) in M.U.s 5-1, 5-2, 5-8, 5-11, 5-13 and 5-14 is from December 1 to December 10" },
  // Schedule 6
  { schedule: 6, section: "s. 11 (2) (a)", species: MD, cls: "ANTLERED", units: "6-3, 6-10, 6-11, 6-14, 6-15", season: "Sept. 1 to Sept. 9 Dec. 1 to Dec. 10", bow: true,
    quote: "(a) in M.U.s 6-3, 6-10, 6-11, 6-14 and 6-15, September 1 to September 9 and December 1 to December 10" },
  { schedule: 6, section: "s. 11 (2) (b)", species: MD, cls: "ANTLERED", units: "6-1, 6-2, 6-4 to 6-9, 6-30", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "(b) in M.U.s 6-1, 6-2, 6-4 to 6-9 and 6-30, September 1 to September 9" },
  { schedule: 6, section: "s. 11 (2) (c)", species: MD, cls: "ANTLERED", units: "6-7 to 6-9, 6-30", season: "Dec. 1 to Dec. 10", bow: true,
    quote: "(c) in M.U.s 6-7 to 6-9 and 6-30, December 1 to December 10" },
  { schedule: 6, section: "s. 11 (6.1)", species: MD, cls: "ANTLERLESS", units: "6-10, 6-11, 6-14, 6-15", season: "Dec. 1 to Dec. 10", bow: true,
    quote: "The open season for hunting antlerless mule (black-tailed) deer with a bow only in M.U.s 6-10, 6-11, 6-14 and 6-15 is from December 1 to December 10" },
  { schedule: 6, section: "s. 13 (2)", species: WT, cls: "ANTLERED", units: "6-1 to 6-11, 6-14, 6-15, 6-30", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "the open seasons for hunting white-tailed deer buck with a bow only in M.U.s 6-1 to 6-11, 6-14, 6-15 and 6-30 are September 1 to September 9" },
  { schedule: 6, section: "s. 13 (6) (a)", species: WT, cls: "ANTLERED", units: "6-1 to 6-11, 6-14, 6-15, 6-30", season: "Dec. 11 to Dec. 20", bow: true,
    quote: "(a) for white-tailed deer bucks, December 11 to December 20" },
  { schedule: 6, section: "s. 13 (6) (b)", species: WT, cls: "ANTLERLESS", units: "6-1 to 6-11, 6-14, 6-15, 6-30", season: "Dec. 1 to Dec. 20", bow: true,
    quote: "(b) for antlerless white-tailed deer, December 1 to December 20" },
  // Schedule 7
  { schedule: 7, section: "s. 2 (11)", species: WT, cls: "ANTLERED", units: "7-2 to 7-50, 7-54 to 7-58", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "The open season for hunting white-tailed deer bucks with a bow only in M.U.s 7-2 to 7-50 and 7-54 to 7-58 is from September 1 to September 9" },
  // Schedule 8
  { schedule: 8, section: "s. 1 (1)", species: MD, cls: "ANTLERED", units: "8-1 to 8-15, 8-21 to 8-26", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "The open season for hunting with a bow only for mule (black-tailed) deer bucks and white-tailed deer bucks in M.U.s 8-1 to 8-15 and 8-21 to 8-26 is September 1 to September 9" },
  { schedule: 8, section: "s. 1 (1)", species: WT, cls: "ANTLERED", units: "8-1 to 8-15, 8-21 to 8-26", season: "Sept. 1 to Sept. 9", bow: true,
    quote: "The open season for hunting with a bow only for mule (black-tailed) deer bucks and white-tailed deer bucks in M.U.s 8-1 to 8-15 and 8-21 to 8-26 is September 1 to September 9" },
  { schedule: 8, section: "s. 1 (2)", species: WT, cls: null, units: "8-1 to 8-15, 8-21 to 8-26", season: "Dec. 1 to Dec. 20", bow: true,
    quote: "The open season for hunting with a bow only for white-tailed deer (either sex) in M.U.s 8-1 to 8-15 and 8-21 to 8-26 is December 1 to December 20" },
];

/**
 * Where the regulation and the 2026–2028 synopsis disagree. The law's own
 * reading is encoded as a disputed rule, and a season only the synopsis prints
 * as its alternative; the engine answers CONFLICT exactly where they differ.
 */
export const DEER_DISPUTES = {
  "7-12 four-point": "B.C. Reg. 190/84 Schedule 7 item 2.1 opens four-point mule deer bucks in M.U.s 7-12 to 7-14, 7-24 and 7-25 from September 10 to November 15. The 2026–2028 synopsis prints that season from October 1 to November 15.",
  "7 youth bucks": "Schedule 7 Part 2 s. 8.1 (d) and (e) restrict two mule deer buck seasons to hunters under 18, and s. 2 (1) (a) and (b) close the same days to any buck without four points. The 2026–2028 synopsis prints both youth seasons for any buck.",
};

/** Seasons only the synopsis prints, as its reading of a dispute. */
export const DEER_SYNOPSIS_ONLY = [
  { schedule: 7, species: MD, cls: "ANTLERED", units: "7-2 to 7-11, 7-15 to 7-18, 7-23, 7-26 to 7-30, 7-37 to 7-41", season: "Sept. 10 to Sept. 30", ages: ["UNDER_18"], dispute: "7 youth bucks" },
  { schedule: 7, species: MD, cls: "ANTLERED", units: "7-12 to 7-14, 7-24, 7-25", season: "Oct. 1 to Oct. 19", ages: ["UNDER_18"], dispute: "7 youth bucks" },
];

/**
 * Ranges the synopsis-versus-law comparison is told about, each read: the
 * synopsis prints these seasons somewhere other than its regional table (a
 * footnote or a map), or the difference is an encoded dispute above.
 */
export const DEER_RANGE_REVIEW = {
  "1:mule-deer": {
    onlyLaw: ["10/5/12/10", "11/1/11/10", "8/26/2/28"],
    onlySynopsis: [],
    reason: "Denman and Hornby (Oct. 5 to Dec. 10) is a footnote to the Region 1 table, Valdes Island's Nov. 1 to 10 antlerless season is on Map A1, and Map A1 names the Sidney and James Islands season without printing dates; the law states all three (Schedule 1 Part 2 s. 1 (6.1), (7), (16), (17)).",
  },
  "7:mule-deer": {
    onlyLaw: ["9/10/11/30"],
    onlySynopsis: ["10/1/11/30"],
    reason: "The four-point season in 7-12 to 7-14, 7-24 and 7-25 opens September 10 in the law and October 1 in the synopsis: an encoded dispute.",
  },
};

/** The species and class a Part 1 deer cell names, and whether the cell itself says youth. */
export function deerRowOf(cell) {
  const text = cell.replace(/\s+/g, " ").trim();
  const species = /^MULE \(Black-tailed\) DEER/i.test(text) ? MD : /^WHITE-TAILED DEER/i.test(text) ? WT : null;
  if (!species) return null;
  const rest = text.replace(/^MULE \(Black-tailed\) DEER|^WHITE-TAILED DEER/i, "").trim();
  const known = /^(Bucks|Antlerless|Either sex)(?: \((?:4 pt\.(?: or better)?|youth season)\))?$/i;
  if (!known.test(rest)) throw new Error(`Unread deer class "${text}"`);
  const cls = /^Bucks/i.test(rest) ? "ANTLERED" : /^Antlerless/i.test(rest) ? "ANTLERLESS" : null;
  return { species, cls, youth: /youth season/i.test(rest) };
}

const DAY = 86_400_000;
const isoDay = (date) => date.toISOString().slice(0, 10);
const daysOf = (windows) => {
  const out = [];
  for (const window of windows) {
    for (let day = Date.parse(`${window.opensIso}T00:00:00Z`); day <= Date.parse(`${window.closesIso}T00:00:00Z`); day += DAY) {
      out.push(isoDay(new Date(day)));
    }
  }
  return [...new Set(out)].sort();
};
const MONTH_ABBR = ["", "Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
const stated = (iso) => `${MONTH_ABBR[Number(iso.slice(5, 7))]} ${Number(iso.slice(8, 10))}`;

/**
 * The rules a set of deer seasons makes once every restriction is applied.
 *
 * `seasons` are Part 1 row parts and Part 2 seasons, each with its species,
 * class (null for either sex), units or areas, windows and whether it is bow
 * only. For each season and each group of units the same restrictions reach,
 * every day is labelled with the points and ages its restrictions leave open,
 * and consecutive days with the same label become one window.
 */
export function composeDeer(seasons, restrictions, { expand, windowsFor }) {
  const out = [];
  for (const season of seasons) {
    const classes = season.cls ? [season.cls] : ["ANTLERED", "ANTLERLESS"];
    const units = season.units ? expand(season.units) : [];
    const reaching = (restriction, unit) =>
      // A season only the synopsis prints is its reading, not the law's, so no Part 2 clause narrows it.
      !season.synopsisOnly
      && restriction.species === season.species
      && restriction.schedule === season.schedule
      && !(restriction.exceptBow && season.bow)
      && (!restriction.item || restriction.item === season.item)
      && ((restriction.include !== undefined && unit === null && (season.include ?? []).some((id) => restriction.include.includes(id)))
        || (restriction.units !== undefined && unit !== null && expand(restriction.units).includes(unit)));
    // Groups of ground the same restrictions reach: each unit, and the season's own areas.
    const grounds = [];
    for (const unit of units) grounds.push({ units: [unit], include: [], reach: (r) => reaching(r, unit) });
    if (season.include?.length) grounds.push({ units: [], include: season.include, reach: (r) => reaching(r, null) });

    const perClass = [];
    for (const cls of classes) {
      const byLabel = new Map();
      for (const ground of grounds) {
        const applicable = restrictions.filter((restriction) => restriction.cls === cls && ground.reach(restriction));
        const days = daysOf(season.windows);
        const labelled = days.map((day) => {
          let points = null;
          let ages = season.ages ?? null;
          const sections = [];
          for (const restriction of applicable) {
            if (!daysOf(windowsFor(restriction.days)).includes(day)) continue;
            sections.push(restriction.section);
            if (restriction.points && cls === "ANTLERED") {
              points = points ? points.filter((value) => restriction.points.includes(value)) : [...restriction.points];
            }
            if (restriction.ages) ages = ages ? ages.filter((value) => restriction.ages.includes(value)) : [...restriction.ages];
          }
          return { day, key: JSON.stringify([points, ages]), points, ages, sections };
        });
        // Runs of consecutive days with the same label.
        const runs = [];
        for (const entry of labelled) {
          const last = runs[runs.length - 1];
          const next = last && Date.parse(`${entry.day}T00:00:00Z`) - Date.parse(`${last.closesIso}T00:00:00Z`) === DAY;
          if (last && next && last.key === entry.key) {
            last.closesIso = entry.day;
            for (const section of entry.sections) last.sections.add(section);
          } else {
            runs.push({ opensIso: entry.day, closesIso: entry.day, key: entry.key, points: entry.points, ages: entry.ages, sections: new Set(entry.sections) });
          }
        }
        for (const run of runs) {
          const signature = run.key;
          const bucket = byLabel.get(signature) ?? { points: run.points, ages: run.ages, groundsKey: new Map() };
          const groundKey = JSON.stringify(ground.include);
          const slot = bucket.groundsKey.get(groundKey) ?? { units: [], include: ground.include, runsByUnit: new Map() };
          const unitKey = ground.units.join(",");
          const list = slot.runsByUnit.get(unitKey) ?? [];
          list.push(run);
          slot.runsByUnit.set(unitKey, list);
          bucket.groundsKey.set(groundKey, slot);
          byLabel.set(signature, bucket);
        }
      }
      // One rule per label and per identical window list, over every ground that shares it.
      const rules = [];
      for (const bucket of byLabel.values()) {
        for (const slot of bucket.groundsKey.values()) {
          const byWindows = new Map();
          for (const [unitKey, runs] of slot.runsByUnit) {
            const windows = runs.map((run) => ({
              opensIso: run.opensIso,
              closesIso: run.closesIso,
              sections: [...run.sections],
            }));
            const key = JSON.stringify(windows.map((window) => [window.opensIso, window.closesIso]));
            const entry = byWindows.get(key) ?? { units: [], windows };
            if (unitKey) entry.units.push(...unitKey.split(","));
            for (const [index, window] of windows.entries()) for (const section of window.sections) if (!entry.windows[index].sections.includes(section)) entry.windows[index].sections.push(section);
            byWindows.set(key, entry);
          }
          for (const entry of byWindows.values()) {
            rules.push({ cls, points: bucket.points, ages: bucket.ages, units: entry.units, include: slot.include, windows: entry.windows });
          }
        }
      }
      perClass.push({ cls, rules });
    }
    // Either sex with nothing that tells the classes apart stays one rule for either sex.
    const same = perClass.length === 2
      && JSON.stringify(perClass[0].rules.map(({ cls, ...rest }) => rest)) === JSON.stringify(perClass[1].rules.map(({ cls, ...rest }) => rest));
    const emitted = same ? perClass[0].rules.map((rule) => ({ ...rule, cls: null })) : perClass.flatMap((entry) => entry.rules);
    for (const rule of emitted) {
      out.push({
        season,
        ...rule,
        windows: rule.windows.map((window) => {
          const whole = season.windows.some((own) => own.opensIso === window.opensIso && own.closesIso === window.closesIso);
          const ownStated = season.windows.find((own) => own.opensIso <= window.opensIso && window.closesIso <= own.closesIso)?.statedAs;
          return {
            opensIso: window.opensIso,
            closesIso: window.closesIso,
            // A part of a stated season: its own days, and the clauses that divide it. The season as printed is the rule's seasonPhrase.
            statedAs: whole ? ownStated : `${stated(window.opensIso)} to ${stated(window.closesIso)}${window.sections.length ? ` (under Part 2 ${[...new Set(window.sections)].join(", ")})` : " (part of a longer printed season)"}`,
          };
        }),
      });
    }
  }
  return out;
}

export { MD, WT };
