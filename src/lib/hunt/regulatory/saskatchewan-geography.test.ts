import assert from "node:assert/strict";
import test from "node:test";
import {
  GAME_BIRD_DISTRICTS, GAME_BIRD_MANAGEMENT_UNITS, SASKATCHEWAN_NUMBERS_WITH_NO_BARE_ZONE,
  SASKATCHEWAN_ZONES, gameBirdDistrictOf, gameBirdUnitOf, zoneNumber, zonesInDistrict,
  zonesInRanges, zonesInUnit, zonesWithNoGameBirdDistrict,
} from "./saskatchewan-geography.ts";
import { canadaLiveAdapterConfig } from "../canada/live-layers.ts";

test("the zone list is the authority's own count, not a hand-kept list", () => {
  /* The certification adapter asserts 83 against the ministry's live service and
     fails closed when the service disagrees, so holding this list against it means
     a zone added or removed by the province breaks the build rather than drifting. */
  const adapter = canadaLiveAdapterConfig("layer:ca-sk-wmz");
  assert.ok(adapter, "the Saskatchewan live layer must still be configured");
  assert.equal(SASKATCHEWAN_ZONES.length, adapter.expectedUnits);
  assert.equal(SASKATCHEWAN_ZONES.length, 83);
  assert.equal(new Set(SASKATCHEWAN_ZONES).size, 83, "no duplicates");
});

test("s. 3(c) expands a numeric reference onto its suffixed zones", () => {
  /* THE RULE THAT WOULD OTHERWISE CLOSE TWELVE ZONES SILENTLY.
     "unless otherwise indicated, references to Wildlife Management Zones by number
     include zones that contain the descriptor 'East', 'West', 'North' or 'South'
     in the zone title." A literal numeric match drops 2E, 2W, 7E, 7W, 14E, 14W,
     42E, 42W, 45E, 45W, 68N and 68S from every season that names their number. */
  assert.deepEqual(zonesInRanges([[1, 14]]),
    ["1", "2E", "2W", "3", "4", "5", "6", "7E", "7W", "8", "9", "10", "11", "12", "13", "14E", "14W"]);
  assert.deepEqual(zonesInRanges([[68, 68]]), ["68N", "68S"]);
  assert.deepEqual(zonesInRanges([[45, 45]]), ["45E", "45W"]);
  /* And it never invents the bare number, because the province does not publish one. */
  for (const number of SASKATCHEWAN_NUMBERS_WITH_NO_BARE_ZONE) {
    assert.ok(!SASKATCHEWAN_ZONES.includes(String(number)),
      `the province publishes no bare zone ${number}; a rule naming it must resolve to its variants`);
  }
  /* 20 and 51 are numbers with no zone at all, suffixed or otherwise — a range
     that spans them contributes nothing for them rather than a phantom zone. */
  assert.deepEqual(zonesInRanges([[20, 20]]), []);
  assert.deepEqual(zonesInRanges([[51, 51]]), []);
  /* The three named zones have no number and are never reached by a range. */
  for (const named of ["PWMZ", "RWMZ", "SWMZ"]) {
    assert.equal(zoneNumber(named), null);
    assert.ok(!zonesInRanges([[1, 99]]).includes(named), `${named} is named, never numbered`);
  }
});

test("the six Game Bird Management Units partition 82 of the 83 zones, with no overlap", () => {
  /* This is what makes bird seasons answerable at all. The units are defined as
     zones PLUS parks and national wildlife areas North Ground holds no geometry
     for — and the ZONE lists alone are disjoint and all but complete, so a point
     that resolves to a zone resolves to a district without any park geometry. */
  const byUnit = new Map(GAME_BIRD_MANAGEMENT_UNITS.map((unit) => [unit.unit, zonesInUnit(unit)]));
  assert.equal(byUnit.size, 6);
  const covered = [...byUnit.values()].flat();
  assert.equal(covered.length, 82, "82 zone memberships");
  assert.equal(new Set(covered).size, 82, "and no zone is in two units");
  assert.deepEqual([...byUnit.values()].map((zones) => zones.length), [18, 11, 13, 9, 14, 17]);
  /* Every unit also names places, and they are kept rather than dropped: a unit
     reported as only its zones would misrepresent the regulation. */
  for (const unit of GAME_BIRD_MANAGEMENT_UNITS) {
    assert.ok(unit.places.length > 0, `unit ${unit.unit} names parks or wildlife areas`);
    assert.match(unit.statedAs, /Game Bird Management Unit/);
    assert.match(unit.section, /s\. 2\(n\./);
  }
});

test("the Prince Albert zone is in no unit, and that is the regulation's own silence", () => {
  /* The regulation names the Regina/Moose Jaw zone in unit 2 and the Saskatoon
     zone in unit 3, and never names the Prince Albert one — while naming it twelve
     times in the big-game Parts, so it is not absent from the instrument. A bird
     question there is UNRESOLVED. Guessing a district from its latitude would be
     inventing geography to avoid an UNKNOWN. */
  assert.deepEqual(zonesWithNoGameBirdDistrict(), ["PWMZ"]);
  assert.equal(gameBirdUnitOf("PWMZ"), null);
  assert.equal(gameBirdDistrictOf("PWMZ"), null);
  /* The other two urban zones DO map, which is what makes the silence specific
     rather than a gap in how urban zones are handled. */
  assert.equal(gameBirdDistrictOf("RWMZ"), "SOUTH");
  assert.equal(gameBirdDistrictOf("SWMZ"), "SOUTH");
});

test("the two districts are the units the regulation assigns them, and they tile", () => {
  assert.deepEqual([...GAME_BIRD_DISTRICTS.NORTH.units], [5, 6]);
  assert.deepEqual([...GAME_BIRD_DISTRICTS.SOUTH.units], [1, 2, 3, 4]);
  const north = zonesInDistrict("NORTH");
  const south = zonesInDistrict("SOUTH");
  assert.equal(north.length, 31);
  assert.equal(south.length, 51);
  assert.equal(north.length + south.length, 82, "every zone but Prince Albert");
  assert.deepEqual(north.filter((zone) => south.includes(zone)), [], "a zone is in one district");
  /* Spot-checks against the regulation's own words rather than against the
     arithmetic: unit 6's 70-76 is the far north, unit 1's 1-14 the far south. */
  assert.equal(gameBirdDistrictOf("73"), "NORTH");
  assert.equal(gameBirdDistrictOf("2W"), "SOUTH");
  assert.equal(gameBirdDistrictOf("68N"), "NORTH", "unit 5 names 68 North individually");
  assert.equal(gameBirdDistrictOf("45E"), "SOUTH", "unit 3 names 45 East individually");
});

test("every zone is either in a district or named as unresolved — nothing falls through", () => {
  /* The positive control on the two tests above: a zone the module simply failed
     to classify would be invisible to both of them. */
  for (const zone of SASKATCHEWAN_ZONES) {
    const district = gameBirdDistrictOf(zone);
    const unresolved = zonesWithNoGameBirdDistrict().includes(zone);
    assert.ok(district !== null || unresolved, `${zone} is neither in a district nor declared unresolved`);
    assert.ok(!(district !== null && unresolved), `${zone} cannot be both`);
  }
});
