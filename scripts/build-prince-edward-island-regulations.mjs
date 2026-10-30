/**
 * Prince Edward Island's hunting seasons: province-wide rules from the
 * Wildlife Conservation Act regulations.
 *
 * WHY THE WHOLE PROVINCE. Prince Edward Island publishes no hunting units, and
 * its seasons regulation names none: Schedule I sets each season with no
 * geographic qualifier. The province is the extent of every rule here, and a
 * point reaches them through `layer:ca-pe-province`, which is served at
 * geography level JURISDICTION and gives no zone id (CLAUDE.md §41B, "A legal
 * rule's geography is not always a polygon"). The one sub-provincial rule is
 * s. 1(2) — no Hungarian partridge season in Lots 1 to 10 and 43 to 47 — and
 * North Ground holds no geometry for PEI's Lots, so that exception is an
 * UNRESOLVED area inside the province and partridge answers "needs a closer
 * look" everywhere rather than open anywhere.
 *
 * THE SOURCES. The Legislative Counsel Office's consolidations, read from the
 * province's site on 2026-10-29 by the research runner (.research/pages):
 *
 *   Hunting and Trapping Seasons Regulations (EC592/16), current to
 *   September 3, 2022, last amendment EC654/22
 *     https://www.princeedwardisland.ca/sites/default/files/legislation/w04-1-6-wildlife_conservation_act_hunting_and_trapping_seasons_regulations.pdf
 *     sha256 c805b7d413030784730cfd74901e53873303db76abe4e0f7a282fad0fdb17613
 *   Hunting Regulations (EC534/19), current to October 3, 2020
 *     https://www.princeedwardisland.ca/sites/default/files/legislation/w04-1-5-wildlife_conservation_act_hunting_regulations.pdf
 *     sha256 b43648619d12678090737c8650c59a2679134995ac1348a2a038d1478f3db6f5
 *
 * and, as a cross-check only, the province's 2025 Hunting Summary
 *     https://www.princeedwardisland.ca/sites/default/files/25f6/Hunting%20Summary%202025.pdf
 *     sha256 009b6ec29cc14081ceb9a3a448feecdba24f5c025ceef2edaed886b731af5569
 * whose season table (p. 18) agrees with Schedule I on every species, date and
 * limit. Reuse terms for these documents were not located, so (§44) the facts
 * are derived and attributed and no copy is published.
 *
 * THE DATES ARE STANDING RULES. Schedule I states month and day only, so the
 * regulation is the same every year until amended; the windows are derived for
 * the 2025–26 and 2026–27 seasons. A later amendment the Legislative Counsel
 * Office has not yet consolidated would not be reflected, and every answer says
 * which consolidation it rests on.
 *
 * Run: node scripts/build-prince-edward-island-regulations.mjs
 */

import { writeFileSync } from "node:fs";

const OUT = "content/regulatory/ca-pe-2026.json";
const JURISDICTION = "jurisdiction:ca-pe";

const SEASONS = "source:ca-pe-hunting-trapping-seasons-regulations";
const HUNTING = "source:ca-pe-hunting-regulations";
const SUMMARY = "source:ca-pe-hunting-summary-2025";

const RETRIEVED = "2026-10-29";
const SEASONS_VERSION = "Hunting and Trapping Seasons Regulations (EC592/16), consolidated to September 3, 2022 (last amendment EC654/22)";
const YEARS = [2025, 2026];
const CERTIFIED = { from: "2025-04-01", to: "2027-03-31" };

const pad = (value) => String(value).padStart(2, "0");
const iso = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

/* One window per season year; a season that runs past 31 December closes in
   the next calendar year, and says so. */
function windows(statedAs, [openMonth, openDay], [closeMonth, closeDay]) {
  return YEARS.map((year) => {
    const crossesYear = closeMonth < openMonth;
    const opensIso = iso(year, openMonth, openDay);
    const closesIso = iso(crossesYear ? year + 1 : year, closeMonth, closeDay);
    return { opensIso, closesIso, crossesYear, statedAs };
  });
}

/* ── Geography ──────────────────────────────────────────────────────────── */

const PROVINCE_GROUP = "regulatory_group:ca-pe-2026-province";
const PARTRIDGE_LOTS = "special_geography:ca-pe-lots-1-10-43-47";
const province = (statedAs, exclude = []) => ({
  statedAs,
  include: { ghas: [], gbhz: [], special: [], jurisdiction: JURISDICTION },
  exclude: { ghas: [], special: exclude },
});
const SCHEDULE_I = "Prince Edward Island (Schedule I states no area)";

const specialGeographies = [
  {
    id: PARTRIDGE_LOTS,
    name: "Lots 1 to 10 and Lots 43 to 47",
    statedAs: "Lots 1 to 10 and Lots 43 to 47 of Prince Edward Island",
    resolution: "UNRESOLVED",
    withinJurisdiction: JURISDICTION,
    reason:
      "Section 1(2) of the seasons regulation names these Lots (the province's historic townships), and North Ground holds no " +
      "boundary for them that it can test, so it cannot say whether this point lies inside them.",
    sourceId: SEASONS,
  },
];

/* ── Conditions ─────────────────────────────────────────────────────────── */

const conditions = [
  {
    id: "ca-pe-hunting-licence",
    text: "A Prince Edward Island hunting licence is required; a licence vendor may issue one only to a person who shows a hunter safety certificate.",
    sourceId: SUMMARY, sourceSection: "2025 Hunting Summary, pp. 13, 17",
  },
  {
    id: "ca-pe-firearm-safety-certificate",
    text: "Carry a valid firearm safety (hunter safety) certificate to have a firearm in game habitat or to hunt with one.",
    sourceId: HUNTING, sourceSection: "Hunting Regulations s. 12(1)",
  },
  {
    id: "ca-pe-non-resident-accompanied",
    text: "A non-resident must be accompanied by a licensed resident hunter or a registered hunting guide.",
    sourceId: SUMMARY, sourceSection: "2025 Hunting Summary, p. 12",
  },
  {
    id: "ca-pe-no-bullet",
    text: "Use no rifle and no firearm loaded with a bullet for this species: only red squirrel, snowshoe hare, raccoon, fox and coyote may be hunted with a bullet.",
    sourceId: HUNTING, sourceSection: "Hunting Regulations s. 2(1)(b)",
  },
  {
    id: "ca-pe-rimfire-22",
    text: "No shotgun slug and no rifle larger than .22 calibre; rifle cartridges must be rimfire.",
    sourceId: HUNTING, sourceSection: "Hunting Regulations s. 2(3), (5)",
  },
  {
    id: "ca-pe-fox-calibre",
    text: "No shotgun slug; rifle cartridges no larger than .22 calibre rimfire or .17 calibre centre fire.",
    sourceId: HUNTING, sourceSection: "Hunting Regulations s. 2(3), (6)",
  },
  {
    id: "ca-pe-coyote-calibre",
    text: "No shotgun slug and no rifle larger than .22 calibre; a muzzle-loading firearm may fire balls or sabots larger than .22 calibre.",
    sourceId: HUNTING, sourceSection: "Hunting Regulations s. 2(3), (4)",
  },
  {
    id: "ca-pe-shotgun-three-shells",
    text: "A shotgun may hold no more than three shells in the magazine and chamber combined, and any second shotgun must be unloaded and disassembled or cased.",
    sourceId: HUNTING, sourceSection: "Hunting Regulations s. 2(8)",
  },
  {
    id: "ca-pe-shot-size",
    text: "Use no shot larger than BB (lead) or T (non-toxic).",
    sourceId: HUNTING, sourceSection: "Hunting Regulations s. 4(1)(b), (2)",
  },
  {
    id: "ca-pe-crow-non-toxic-shot",
    text: "Lead shot may not be used or carried: crow is not among the species s. 4(1)(a) allows lead shot for. Non-toxic shot may be no larger than T.",
    sourceId: HUNTING, sourceSection: "Hunting Regulations s. 4(1)",
  },
  {
    id: "ca-pe-raccoon-night-permit",
    text: "Raccoon may be hunted at night with a firearm only under a permit from the Minister that specifically authorizes it.",
    sourceId: HUNTING, sourceSection: "Hunting Regulations s. 2(2)(a)",
  },
];

/* ── Rules ──────────────────────────────────────────────────────────────── */

function rule({ slug, speciesId, seasonLabel, seasonPhrase, windows: spans, limits, section, conditionIds = [], exclude = [], scope = SCHEDULE_I, declaredNoSeason = false, closureBasis, notes = [] }) {
  return {
    id: `regulatory_rule:ca-pe-2026-${slug}`,
    speciesId,
    regulatoryGroupId: PROVINCE_GROUP,
    geography: province(scope, exclude),
    appliesWhen: {},
    seasonLabel,
    seasonPhrase,
    windows: spans,
    declaredNoSeason,
    ...(closureBasis ? { closureBasis } : {}),
    ...(limits ? { limits: { ...limits, section } } : {}),
    conditionIds: [...conditionIds, "ca-pe-hunting-licence", "ca-pe-firearm-safety-certificate", "ca-pe-non-resident-accompanied"],
    caveats: [],
    notes,
    disputes: [],
    sourceId: SEASONS,
    sourceSection: section,
    sourceVersion: SEASONS_VERSION,
    reviewStatus: "VERIFIED",
  };
}

/* "No closed season" is a standing open season. The rule holds one window
   over the span North Ground certifies, and says the end is that span, not a
   closing date. */
const NO_CLOSED_SEASON_NOTE = "The regulation sets no closed season; the end date shown is the span North Ground has certified, not a closing date.";
const noClosedSeason = [{ opensIso: CERTIFIED.from, closesIso: CERTIFIED.to, crossesYear: true, statedAs: "No closed season" }];

const BIRD_GUN = ["ca-pe-no-bullet", "ca-pe-shotgun-three-shells", "ca-pe-shot-size"];

const rules = [
  rule({
    slug: "ruffed-grouse", speciesId: "species:ruffed-grouse", seasonLabel: "Open season",
    seasonPhrase: "September 26 - December 31", windows: windows("September 26 - December 31", [9, 26], [12, 31]),
    limits: { daily: 3, possession: 6, statedAs: "3 daily; 6 in possession" }, section: "Schedule I",
    conditionIds: BIRD_GUN,
  }),
  rule({
    slug: "gray-partridge", speciesId: "species:gray-partridge", seasonLabel: "Open season",
    seasonPhrase: "October 15 - November 15", windows: windows("October 15 - November 15", [10, 15], [11, 15]),
    limits: { daily: 3, possession: 6, statedAs: "3 daily; 6 in possession" }, section: "Schedule I; s. 1(2)",
    conditionIds: BIRD_GUN, exclude: [PARTRIDGE_LOTS],
    scope: "Prince Edward Island, except Lots 1 to 10 and Lots 43 to 47 (s. 1(2))",
  }),
  rule({
    slug: "ring-necked-pheasant", speciesId: "species:ring-necked-pheasant", seasonLabel: "Pheasant",
    seasonPhrase: "No open season", windows: [], declaredNoSeason: true,
    closureBasis: { owner: "NORTH_GROUND", text: "Schedule I of Prince Edward Island's seasons regulation gives pheasant no open season." },
    section: "Schedule I",
  }),
  rule({
    slug: "snowshoe-hare", speciesId: "species:snowshoe-hare", seasonLabel: "Open season (hunting)",
    seasonPhrase: "October 1 - March 31", windows: windows("October 1 - March 31", [10, 1], [3, 31]),
    limits: { daily: 5, statedAs: "5 daily; no possession limit" }, section: "Schedule I",
    conditionIds: ["ca-pe-rimfire-22", "ca-pe-shotgun-three-shells", "ca-pe-shot-size"],
  }),
  rule({
    slug: "red-fox", speciesId: "species:red-fox", seasonLabel: "Open season",
    seasonPhrase: "November 1 - January 31", windows: windows("November 1 - January 31", [11, 1], [1, 31]),
    section: "Schedule I", conditionIds: ["ca-pe-fox-calibre", "ca-pe-shotgun-three-shells", "ca-pe-shot-size"],
  }),
  rule({
    slug: "raccoon", speciesId: "species:raccoon", seasonLabel: "Open season",
    seasonPhrase: "October 1 - March 31", windows: windows("October 1 - March 31", [10, 1], [3, 31]),
    section: "Schedule I", conditionIds: ["ca-pe-rimfire-22", "ca-pe-raccoon-night-permit", "ca-pe-shotgun-three-shells", "ca-pe-shot-size"],
  }),
  rule({
    slug: "coyote", speciesId: "species:coyote", seasonLabel: "Open season",
    seasonPhrase: "October 1 - March 31", windows: windows("October 1 - March 31", [10, 1], [3, 31]),
    section: "Schedule I", conditionIds: ["ca-pe-coyote-calibre", "ca-pe-shotgun-three-shells"],
  }),
  rule({
    slug: "american-red-squirrel", speciesId: "species:american-red-squirrel", seasonLabel: "No closed season",
    seasonPhrase: "No closed season", windows: noClosedSeason,
    section: "Schedule I", conditionIds: ["ca-pe-rimfire-22", "ca-pe-shotgun-three-shells", "ca-pe-shot-size"],
    notes: [NO_CLOSED_SEASON_NOTE],
  }),
  {
    ...rule({
      slug: "american-crow", speciesId: "species:american-crow", seasonLabel: "No closed season",
      seasonPhrase: "No closed season", windows: noClosedSeason,
      section: "Schedule II", conditionIds: ["ca-pe-crow-non-toxic-shot", "ca-pe-shotgun-three-shells"],
      scope: "Prince Edward Island (Schedule II states no area)",
      notes: [NO_CLOSED_SEASON_NOTE],
    }),
  },
];

/* ── Legal hours ────────────────────────────────────────────────────────── */

/* s. 2(1)(a): no hunting game, and no firearm discharged where game or
   harvestable wildlife is found, from half an hour after sunset to half an
   hour before the next sunrise. It covers every species here; raccoon by
   permit at night is s. 2(2)(a), carried as a condition. */
const legalHours = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs:
    "No person shall hunt game or discharge a firearm in a locality frequented by game or harvestable wildlife during the period " +
    "from one-half hour after sunset in any day to one-half hour before the next sunrise.",
  section: "Hunting Regulations s. 2(1)(a)",
  sourceId: HUNTING,
};

/* ── Cross-check against the 2025 summary (p. 18) ───────────────────────── */

const SUMMARY_TABLE = {
  "species:ring-necked-pheasant": "No open season",
  "species:ruffed-grouse": "September 26 - December 31",
  "species:gray-partridge": "October 15 - November 15",
  "species:snowshoe-hare": "October 1 - March 31",
  "species:red-fox": "November 1 - January 31",
  "species:raccoon": "October 1 - March 31",
  "species:coyote": "October 1 - March 31",
  "species:american-red-squirrel": "No closed season",
};
for (const [speciesId, phrase] of Object.entries(SUMMARY_TABLE)) {
  const found = rules.find((entry) => entry.speciesId === speciesId);
  if (!found || found.seasonPhrase !== phrase) throw new Error(`${speciesId}: the regulation and the 2025 summary disagree`);
}

/* ── What this bundle deliberately does not answer ──────────────────────── */

const refused = [
  {
    what: "Hungarian partridge in Lots 1 to 10 and 43 to 47",
    reason: "NO_GEOMETRY",
    detail:
      "Section 1(2) excludes these Lots from the partridge season. North Ground holds no boundary for PEI's Lots, so partridge answers " +
      "\"needs a closer look\" across the province rather than open anywhere it cannot place.",
  },
  {
    what: "Snowshoe hare snaring",
    reason: "OUTSIDE_THIS_INSTRUMENT",
    detail:
      "The 2025 summary gives snaring its own season (1 November to 28 February) and licence. It is not in the seasons regulation read " +
      "here, so only the hunting season is answered.",
  },
  {
    what: "Trapping seasons (Schedule III) and the beaver restricted zone (Schedule IV)",
    reason: "NOT_HUNTING",
    detail: "Trapping is a distinct activity from hunting and is not answered by Hunt.",
  },
  {
    what: "Migratory game birds",
    reason: "FEDERAL_INSTRUMENT",
    detail: "Answered by the federal Migratory Birds Regulations layer, not by this bundle.",
  },
  {
    what: "Waterfowl near four Wildlife Management Areas",
    reason: "NO_GEOMETRY",
    detail:
      "Hunting Regulations s. 3 bars hunting migratory waterfowl within 100 m of the centre line of a highway bounding the Indian River, " +
      "Rollo Bay, New Glasgow or Pisquid River Wildlife Management Areas. The province publishes no boundary for them that North Ground may use.",
  },
];

/* ── Bundle ─────────────────────────────────────────────────────────────── */

const bundle = {
  bundleId: "ca-pe-2026",
  jurisdictionId: JURISDICTION,
  sourceVersion: SEASONS_VERSION,
  retrievedAt: RETRIEVED,
  geographyScope: {
    kind: "WHOLE_JURISDICTION",
    statedAs: SCHEDULE_I,
    resolvedBy: "layer:ca-pe-province",
    why:
      "Prince Edward Island publishes no hunting units and its seasons regulation names none, so each rule's geography is the province. " +
      "A point reaches these rules through the province layer, served at geography level JURISDICTION with no zone id.",
  },
  editionCurrency: {
    checkedAt: RETRIEVED,
    statedAs:
      "The Legislative Counsel Office's consolidation published on 2026-10-29 is current to September 3, 2022, and its amendment history " +
      "ends at EC654/22. The province's 2025 Hunting Summary agrees with it on every species, date and limit.",
  },
  certifiedPeriod: {
    ...CERTIFIED,
    reason:
      "Schedule I is a standing rule stated by month and day, so this period is North Ground's declared derivation span: the 2025–26 and " +
      "2026–27 seasons. The 2025 summary confirms the first; an amendment made since the September 2022 consolidation would not be reflected.",
  },
  absence: {
    meaning: "UNKNOWN",
    section: "Hunting and Trapping Seasons Regulations, Schedule I",
    sourceId: SEASONS,
    explanation:
      "Every rule in this bundle reaches the whole province, so a place no rule reaches is outside Prince Edward Island or inside an " +
      "exception, and that says nothing about whether a season is open there.",
  },
  specialGeographies,
  sources: [
    {
      id: SEASONS,
      title: "Wildlife Conservation Act, Hunting and Trapping Seasons Regulations",
      url: "https://www.princeedwardisland.ca/sites/default/files/legislation/w04-1-6-wildlife_conservation_act_hunting_and_trapping_seasons_regulations.pdf",
      authority: "Government of Prince Edward Island (Legislative Counsel Office consolidation)",
      edition: "EC592/16, consolidated to September 3, 2022",
      contentHash: "sha256:c805b7d413030784730cfd74901e53873303db76abe4e0f7a282fad0fdb17613",
      accessState: "PUBLIC_READABLE", reuseState: "UNSTATED", archiveState: "UNCONFIRMED", derivedFactsState: "USABLE",
      termsStatus: "NOT_LOCATED", retrievalMethod: "OFFICIAL_PDF", lastVerified: RETRIEVED, authorityLevel: "PRIMARY_GOVERNMENT",
      conditions: conditions.filter((condition) => condition.sourceId === SEASONS),
    },
    {
      id: HUNTING,
      title: "Wildlife Conservation Act, Hunting Regulations",
      url: "https://www.princeedwardisland.ca/sites/default/files/legislation/w04-1-5-wildlife_conservation_act_hunting_regulations.pdf",
      authority: "Government of Prince Edward Island (Legislative Counsel Office consolidation)",
      edition: "EC534/19, consolidated to October 3, 2020",
      contentHash: "sha256:b43648619d12678090737c8650c59a2679134995ac1348a2a038d1478f3db6f5",
      accessState: "PUBLIC_READABLE", reuseState: "UNSTATED", archiveState: "UNCONFIRMED", derivedFactsState: "USABLE",
      termsStatus: "NOT_LOCATED", retrievalMethod: "OFFICIAL_PDF", lastVerified: RETRIEVED, authorityLevel: "PRIMARY_GOVERNMENT",
      conditions: conditions.filter((condition) => condition.sourceId === HUNTING),
    },
    {
      id: SUMMARY,
      title: "Prince Edward Island Hunting Summary 2025",
      url: "https://www.princeedwardisland.ca/sites/default/files/25f6/Hunting%20Summary%202025.pdf",
      authority: "Government of Prince Edward Island, Fish and Wildlife",
      edition: "2025",
      contentHash: "sha256:009b6ec29cc14081ceb9a3a448feecdba24f5c025ceef2edaed886b731af5569",
      accessState: "PUBLIC_READABLE", reuseState: "UNSTATED", archiveState: "UNCONFIRMED", derivedFactsState: "USABLE",
      termsStatus: "NOT_LOCATED", retrievalMethod: "OFFICIAL_PDF", lastVerified: RETRIEVED, authorityLevel: "GOVERNMENT_SUMMARY",
      conditions: conditions.filter((condition) => condition.sourceId === SUMMARY),
    },
  ],
  legalHours,
  units: [],
  officialUnitCount: null,
  groups: [{ id: PROVINCE_GROUP, officialSpec: "The whole Province of Prince Edward Island", zoneIds: [] }],
  rules,
  deliberatelyNotEncoded: refused,
};

writeFileSync(OUT, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`${OUT}: ${rules.length} rules over ${new Set(rules.map((entry) => entry.speciesId)).size} species, ${refused.length} refusals`);
