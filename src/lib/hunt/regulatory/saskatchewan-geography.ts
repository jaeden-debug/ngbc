/**
 * Saskatchewan's TWO hunting geographies, and the rule that expands the first.
 *
 * Saskatchewan writes big-game seasons in Wildlife Management Zones and bird
 * seasons in Game Bird Districts, and the districts are COMPOSED from the zones.
 * Both facts are in The Open Seasons Game Regulations, 2009 (W-13.12 Reg 3), and
 * both are load-bearing in a way that is easy to get silently wrong.
 *
 * ── THE SUFFIX RULE (s. 3(c)) ───────────────────────────────────────────────
 *
 * "unless otherwise indicated, references to Wildlife Management Zones by number
 * include zones that contain the descriptor 'East', 'West', 'North' or 'South' in
 * the zone title."
 *
 * So a season written for "Wildlife Management Zones 1 to 14" reaches 2E, 2W, 7E,
 * 7W, 14E and 14W, and there is no zone "2", "7" or "14" for it to reach instead.
 * A literal numeric match would drop every suffixed zone from every season it
 * appears in — twelve of the province's 83 zones, silently reported CLOSED. §8
 * treats a restriction stricter than the source as exactly as false as a looser
 * one, and this is the stricter kind: nobody complains about a season that was
 * wrongly closed.
 *
 * ── THE SECOND GEOGRAPHY (ss. 2(n.1)–(n.6), (r), (w)) ───────────────────────
 *
 * Six Game Bird Management Units compose into two Districts — North is units 5
 * and 6, South is units 1 to 4 — and every bird season in Parts VIII to X is
 * written in District terms. Each unit is defined as a list of Wildlife
 * Management Zones PLUS named provincial parks, recreation sites, a wildlife
 * management unit and federal national wildlife areas.
 *
 * North Ground holds none of that park or national-wildlife-area geometry. What
 * makes the districts answerable anyway is that the ZONE lists alone are
 * complete and disjoint: 82 of the province's 83 designations fall in exactly one
 * unit, with no overlap. So a point that resolves to a zone resolves to a
 * district, and the parks are additional members rather than alternatives.
 *
 * ── THE ONE ZONE THAT DOES NOT MAP, AND IT IS NOT A BUG ─────────────────────
 *
 * The Prince Albert Wildlife Management Zone is named in NO Game Bird Management
 * Unit. The regulation names the Regina/Moose Jaw zone in unit 2 and the
 * Saskatoon zone in unit 3, and simply does not name the Prince Albert one —
 * while naming it twelve times in the BIG GAME Parts, so it is not an omission
 * from the instrument as a whole.
 *
 * A bird question there is therefore UNRESOLVED, never closed. Guessing a
 * district from the zone's latitude would be inventing geography to avoid an
 * UNKNOWN, which §8 forbids in the same breath as it forbids unnecessary
 * refusals.
 */

/**
 * Every designation the Ministry of Environment's own service publishes, read
 * live from `WildlifeManagement/MapServer/0` on 2026-09-30.
 *
 * Saskatchewan's geometry is live-service only (owner decision, 2026-09-22: the
 * Standard Unrestricted Use Data Licence v2.0 grants commercial reuse and the
 * same item adds "Not for resale"), so this is the designation list rather than a
 * stored copy of the boundaries, and `saskatchewan-geography.test.ts` holds it
 * against the certification adapter's own expected count.
 */
export const SASKATCHEWAN_ZONES: readonly string[] = [
  "1", "2E", "2W", "3", "4", "5", "6", "7E", "7W", "8", "9", "10", "11", "12", "13", "14E", "14W",
  "15", "16", "17", "18", "19", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
  "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42E", "42W", "43", "44",
  "45E", "45W", "46", "47", "48", "49", "50", "52", "53", "54", "55", "56", "57", "58", "59",
  "60", "61", "62", "63", "64", "65", "66", "67", "68N", "68S", "69", "70", "71", "72", "73",
  "74", "75", "76", "PWMZ", "RWMZ", "SWMZ",
];

/**
 * The numbers the province does NOT publish as bare zones.
 *
 * Declared rather than derived, because it is the evidence that the suffix rule
 * is doing real work: every one of these appears in season rows as a number, and
 * every one of them resolves only to its suffixed variants. A builder that
 * emitted the bare number would emit a zone that does not exist, and a resolver
 * would never match it — a rule that looks encoded and answers nothing.
 */
export const SASKATCHEWAN_NUMBERS_WITH_NO_BARE_ZONE: readonly number[] = [2, 7, 14, 20, 42, 45, 51, 68];

/** A designation's number, or null for the three zones the province names rather than numbers. */
export function zoneNumber(designation: string): number | null {
  const match = /^(\d+)(?:[EWNS])?$/.exec(designation.trim());
  return match ? Number(match[1]) : null;
}

/**
 * The designations a numeric reference reaches, under s. 3(c).
 *
 * Takes the authority's own ranges as it writes them — `[1, 14]` for "Zones 1 to
 * 14", `[19, 19]` for "and 19" — and returns only designations the province
 * actually publishes. A number with no zone contributes nothing rather than a
 * designation that does not exist.
 */
export function zonesInRanges(ranges: ReadonlyArray<readonly [number, number]>): string[] {
  const out: string[] = [];
  for (const zone of SASKATCHEWAN_ZONES) {
    const number = zoneNumber(zone);
    if (number === null) continue;
    if (ranges.some(([low, high]) => number >= low && number <= high)) out.push(zone);
  }
  return out;
}

/**
 * The six Game Bird Management Units, as ss. 2(n.1) to (n.6) compose them.
 *
 * `zoneRanges` and `namedZones` are the parts North Ground can resolve; `places`
 * is every park, recreation site, wildlife management unit and national wildlife
 * area the definition also names, verbatim, kept because dropping them would
 * misrepresent the unit as being only its zones.
 */
export interface GameBirdManagementUnit {
  unit: 1 | 2 | 3 | 4 | 5 | 6;
  section: string;
  statedAs: string;
  zoneRanges: ReadonlyArray<readonly [number, number]>;
  namedZones: readonly string[];
  places: readonly string[];
}

export const GAME_BIRD_MANAGEMENT_UNITS: readonly GameBirdManagementUnit[] = [
  {
    unit: 1,
    section: "The Open Seasons Game Regulations, 2009, s. 2(n.1)",
    statedAs:
      "“Game Bird Management Unit 1” includes Wildlife Management Zones 1 to 14 and 19, Saskatchewan Landing " +
      "Provincial Park, Cypress Hills Inter-Provincial Park (West Block), Webb National Wildlife Area and Prairie " +
      "National Wildlife Area Unit Numbers 5, 10, 11, 14 to 21 and 23 to 26",
    zoneRanges: [[1, 14], [19, 19]],
    namedZones: [],
    places: [
      "Saskatchewan Landing Provincial Park",
      "Cypress Hills Inter-Provincial Park (West Block)",
      "Webb National Wildlife Area",
      "Prairie National Wildlife Area Unit Numbers 5, 10, 11, 14 to 21 and 23 to 26",
    ],
  },
  {
    unit: 2,
    section: "The Open Seasons Game Regulations, 2009, s. 2(n.2)",
    statedAs:
      "“Game Bird Management Unit 2” includes Wildlife Management Zones 15 to 18 and 31 to 36, Regina/Moose " +
      "Jaw Wildlife Management Zone, Moose Mountain Provincial Park and Prairie National Wildlife Area Unit 27",
    zoneRanges: [[15, 18], [31, 36]],
    namedZones: ["RWMZ"],
    places: ["Moose Mountain Provincial Park", "Prairie National Wildlife Area Unit 27"],
  },
  {
    unit: 3,
    section: "The Open Seasons Game Regulations, 2009, s. 2(n.3)",
    statedAs:
      "“Game Bird Management Unit 3” includes Wildlife Management Zones 23 to 30, 44, 45 East, 45 West and 46, " +
      "Saskatoon Wildlife Management Zone, that portion of Douglas Provincial Park located west of Diefenbaker Lake " +
      "(Gordon McKenzie Arm), Bradwell National Wildlife Area and Prairie National Wildlife Area Unit Numbers 2, 3, 8, " +
      "9, 12, 13, 22 and 28",
    zoneRanges: [[23, 30], [44, 44], [46, 46]],
    /* 45 East and 45 West are named individually here rather than as "45", so
       they are taken as named rather than through the suffix rule. The result is
       the same; the provenance is not. */
    namedZones: ["45E", "45W", "SWMZ"],
    places: [
      "that portion of Douglas Provincial Park located west of Diefenbaker Lake (Gordon McKenzie Arm)",
      "Bradwell National Wildlife Area",
      "Prairie National Wildlife Area Unit Numbers 2, 3, 8, 9, 12, 13, 22 and 28",
    ],
  },
  {
    unit: 4,
    section: "The Open Seasons Game Regulations, 2009, s. 2(n.4)",
    statedAs:
      "“Game Bird Management Unit 4” includes Wildlife Management Zones 21, 22 and 37 to 42, Duck Mountain " +
      "Provincial Park and Last Mountain Lake, Stalwart and Tway National Wildlife Areas",
    zoneRanges: [[21, 22], [37, 42]],
    namedZones: [],
    places: [
      "Duck Mountain Provincial Park",
      "Last Mountain Lake National Wildlife Area",
      "Stalwart National Wildlife Area",
      "Tway National Wildlife Area",
    ],
  },
  {
    unit: 5,
    section: "The Open Seasons Game Regulations, 2009, s. 2(n.5)",
    statedAs:
      "“Game Bird Management Unit 5” includes Wildlife Management Zones 43, 47 to 50, 52 to 57, 67, 68 North " +
      "and 68 South, Fort a la Corne Wildlife Management Unit, Greenwater Lake and Porcupine Hills Provincial Parks, " +
      "Bronson Forest and Round Lake Recreation Sites and Prairie National Wildlife Area Unit Numbers 1, 4, 6 and 7",
    zoneRanges: [[43, 43], [47, 50], [52, 57], [67, 67]],
    namedZones: ["68N", "68S"],
    places: [
      "Fort a la Corne Wildlife Management Unit",
      "Greenwater Lake Provincial Park",
      "Porcupine Hills Provincial Park",
      "Bronson Forest Recreation Site",
      "Round Lake Recreation Site",
      "Prairie National Wildlife Area Unit Numbers 1, 4, 6 and 7",
    ],
  },
  {
    unit: 6,
    section: "The Open Seasons Game Regulations, 2009, s. 2(n.6)",
    statedAs:
      "“Game Bird Management Unit 6” includes Wildlife Management Zones 58 to 66 and 69 to 76, Athabasca Sand " +
      "Dunes, Clarence-Steepbank Lakes, Clearwater River, Great Blue Heron, Lac La Ronge, Meadow Lake, Narrow Hills and " +
      "Wildcat Hill Provincial Parks and Nesslin Lake Recreation Site",
    zoneRanges: [[58, 66], [69, 76]],
    namedZones: [],
    places: [
      "Athabasca Sand Dunes Provincial Park",
      "Clarence-Steepbank Lakes Provincial Park",
      "Clearwater River Provincial Park",
      "Great Blue Heron Provincial Park",
      "Lac La Ronge Provincial Park",
      "Meadow Lake Provincial Park",
      "Narrow Hills Provincial Park",
      "Wildcat Hill Provincial Park",
      "Nesslin Lake Recreation Site",
    ],
  },
];

/** s. 2(r): North is units 5 and 6. s. 2(w): South is units 1 to 4. */
export const GAME_BIRD_DISTRICTS = {
  NORTH: { section: "The Open Seasons Game Regulations, 2009, s. 2(r)", statedAs: "“North Game Bird District” includes Game Bird Management Unit 5 and Game Bird Management Unit 6", units: [5, 6] as const },
  SOUTH: { section: "The Open Seasons Game Regulations, 2009, s. 2(w)", statedAs: "“South Game Bird District” includes Game Bird Management Unit 1, Game Bird Management Unit 2, Game Bird Management Unit 3 and Game Bird Management Unit 4", units: [1, 2, 3, 4] as const },
} as const;

export type GameBirdDistrict = keyof typeof GAME_BIRD_DISTRICTS;

/** The zones each unit reaches, resolved: its ranges under s. 3(c) plus its named zones. */
export function zonesInUnit(unit: GameBirdManagementUnit): string[] {
  return [...new Set([...zonesInRanges(unit.zoneRanges), ...unit.namedZones])]
    .filter((zone) => SASKATCHEWAN_ZONES.includes(zone));
}

/**
 * Which Game Bird Management Unit a zone is in, or null where the regulation
 * names none — which is the Prince Albert zone, and only it.
 */
export function gameBirdUnitOf(designation: string): 1 | 2 | 3 | 4 | 5 | 6 | null {
  for (const unit of GAME_BIRD_MANAGEMENT_UNITS) {
    if (zonesInUnit(unit).includes(designation)) return unit.unit;
  }
  return null;
}

/**
 * Which Game Bird District a zone is in.
 *
 * Returns null for the Prince Albert zone, and the caller must answer UNRESOLVED
 * rather than picking a district: the regulation composes the districts out of
 * units, the units out of named zones, and it never names this one.
 */
export function gameBirdDistrictOf(designation: string): GameBirdDistrict | null {
  const unit = gameBirdUnitOf(designation);
  if (unit === null) return null;
  return (GAME_BIRD_DISTRICTS.NORTH.units as readonly number[]).includes(unit) ? "NORTH" : "SOUTH";
}

/** The zones a district reaches, for a bird rule's geography. */
export function zonesInDistrict(district: GameBirdDistrict): string[] {
  return SASKATCHEWAN_ZONES.filter((zone) => gameBirdDistrictOf(zone) === district);
}

/**
 * Zones the regulation's bird geography does not reach, with the reason.
 *
 * A function rather than a constant so it cannot drift from the unit
 * definitions: if a future amendment adds the Prince Albert zone to a unit, this
 * empties out on its own and the test that pins it fails deliberately.
 */
export function zonesWithNoGameBirdDistrict(): string[] {
  return SASKATCHEWAN_ZONES.filter((zone) => gameBirdDistrictOf(zone) === null);
}
