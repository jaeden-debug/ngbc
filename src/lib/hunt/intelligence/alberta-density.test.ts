import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { opportunityAt, servableDatasets } from "./bundles.ts";
import { spatialStrategyFor } from "./spatial-strategy.ts";
import { surfaceRegistry } from "./surface.ts";
import type { EvidenceRecord } from "./types.ts";

/**
 * Alberta's aerial-survey densities are read from PDF prose, so what is held is
 * only as good as the reading. These tests hold the reading to its rules on the
 * committed data, and to figures checked by hand against the reports.
 */

type AlbertaRecord = EvidenceRecord & {
  speciesAttributedBy: string;
  tableCheck: "AGREES" | "CONFLICT" | "NO_TABLE_ROW";
  tableValue?: number;
};

const SPECIES = ["moose", "mule-deer", "white-tailed-deer"] as const;
const bundles = Object.fromEntries(SPECIES.map((key) => [key, JSON.parse(readFileSync(`content/intelligence/ca-ab-${key}-aerial-survey.json`, "utf8"))])) as Record<(typeof SPECIES)[number], { evidence: AlbertaRecord[]; seasonalBasis: { matchesHuntingSeason: boolean; warning: string } }>;
const certified = new Set(JSON.parse(readFileSync("content/regulatory/ca-ab-certified-units.json", "utf8")).certifiedUnits as string[]);
const all = SPECIES.flatMap((key) => bundles[key].evidence);
const find = (key: (typeof SPECIES)[number], unit: string) => bundles[key].evidence.find((record) => record.geographyId === `management_zone:ca-ab-wmu-${unit}`);

test("every figure is a unit density that its own sentence states", () => {
  for (const record of all) {
    assert.equal(record.metric, "POPULATION_DENSITY");
    assert.equal(record.geographyType, "MANAGEMENT_ZONE");
    assert.ok(certified.has(record.geographyId.replace("management_zone:ca-ab-wmu-", "")), `${record.geographyId} is not a certified Alberta unit`);
    /* The number is in the authority's sentence, as the authority wrote it. */
    const stated = [...(record.statedAs ?? "").matchAll(/\d*\.\d+|\d+/g)].map((m) => Number(m[0]));
    assert.ok(stated.includes(record.rawValue as number), `${record.id}: ${record.rawValue} is not in "${record.statedAs}"`);
    assert.ok(["NAMED_IN_SENTENCE", "SECTION_HEADING", "PARAGRAPH_SUBJECT", "REPORT_TITLE"].includes(record.speciesAttributedBy));
    assert.match(record.report?.url ?? "", /^https:\/\/open\.alberta\.ca\/publications\//);
    assert.match(record.report?.sourceHash ?? "", /^sha256:[0-9a-f]{64}$/);
    assert.equal(record.report?.licence, "Open Government Licence – Alberta");
  }
  /* One figure per unit and species: the latest survey, never two. */
  for (const key of SPECIES) {
    const units = bundles[key].evidence.map((record) => record.geographyId);
    assert.equal(new Set(units).size, units.length, key);
  }
});

test("an interval is shown only when it contains its own estimate", () => {
  for (const record of all) {
    for (const [, lo, hi] of (record.notes ?? "").matchAll(/per km² \(90% CI ([\d.]+)–([\d.]+)\)/g)) {
      assert.ok(Number(lo) <= (record.rawValue as number) && (record.rawValue as number) <= Number(hi), `${record.id}: ${lo}–${hi}`);
    }
  }
  /* WMU 216 prints "(90% CI 0.5 – 0.11)" for an estimate of 0.80: refused, and said. */
  const wmu216 = find("white-tailed-deer", "216")!;
  assert.doesNotMatch(wmu216.notes!, /per km² \(90% CI/);
  assert.match(wmu216.notes!, /does not contain its estimate/);
});

test("a report that disagrees with itself is shown both ways and ranked neither", () => {
  /* WMU 336 (2020): the text says 0.71 moose per km², Table 3 says 0.56, for the
     same 1,883 animals. Checked by hand against the report. */
  const wmu336 = find("moose", "336")!;
  assert.equal(wmu336.tableCheck, "CONFLICT");
  assert.equal(wmu336.rawValue, 0.71);
  assert.equal(wmu336.tableValue, 0.56);
  assert.match(wmu336.notes!, /0\.71 in its text and 0\.56 in its results table/);
  assert.equal(wmu336.normalizedValue, undefined);
  assert.equal(wmu336.confidence, "LOW");
  for (const record of all.filter((r) => r.tableCheck === "CONFLICT")) assert.equal(record.normalizedValue, undefined, record.id);
});

test("a figure for part of a unit says so and is not ranked", () => {
  /* WMU 440 (2020): "In the portion of WMU 440 that was flown (i.e. non-alpine)". */
  const wmu440 = find("moose", "440")!;
  assert.match(wmu440.notes!, /part of the unit the survey flew, not the whole unit/);
  assert.equal(wmu440.normalizedValue, undefined);
});

test("figures checked by hand against their reports", () => {
  const cases: Array<[(typeof SPECIES)[number], string, number, string, string | null]> = [
    /* unit, density, survey, abundance interval as the report prints it */
    ["mule-deer", "116", 0.79, "2025", "1,012–2,312"],
    ["white-tailed-deer", "116", 0.75, "2025", "1,072–2,059"],
    ["moose", "116", 0.02, "2025", "22–63"],
    ["mule-deer", "204", 0.74, "2019", "1,008–1,564"],
    ["white-tailed-deer", "204", 0.37, "2019", "486–788"],
    ["moose", "204", 0.13, "2019", "164–299"],
    ["mule-deer", "108", 2.1, "2018", null],
    ["white-tailed-deer", "108", 1.17, "2018", null],
    ["mule-deer", "203", 0.76, "2018", null],
    ["white-tailed-deer", "166", 0.46, "2021", "1,724–2,196"],
  ];
  for (const [key, unit, density, survey, abundanceCi] of cases) {
    const record = find(key, unit);
    assert.ok(record, `${key} ${unit}`);
    assert.equal(record.rawValue, density, `${key} ${unit}`);
    assert.equal(record.version, survey, `${key} ${unit}`);
    if (abundanceCi) assert.match(record.notes!, new RegExp(`\\(90% CI ${abundanceCi}\\)`), `${key} ${unit}`);
  }
});

test("the card cites the report the figure came from, for the year it describes", () => {
  const reply = opportunityAt("species:mule-deer", "management_zone:ca-ab-wmu-204")!;
  assert.match(reply.source.url, /open\.alberta\.ca\/publications\//);
  assert.match(reply.source.title, /Unit 204 aerial ungulate survey/);
  /* The bundle runs to 2025; this unit was flown in 2019, and says 2019. */
  assert.equal(reply.zoneObservationYear, 2019);
  assert.equal(reply.latestObservationYear, 2025);
  assert.match(reply.seasonalBasis?.warning ?? "", /winter/);
  assert.equal(reply.result.legalStatus, null);
});

test("a unit density is a better number, not a finer place: never a surface", () => {
  for (const key of SPECIES) {
    assert.equal(spatialStrategyFor(`species:${key}`).strategy, "D_COARSE_SUPPORTING", key);
    assert.equal(bundles[key].seasonalBasis.matchesHuntingSeason, false);
  }
  assert.ok(!surfaceRegistry().surfaces.some((entry) => SPECIES.some((key) => entry.speciesId === `species:${key}`)));
  for (const dataset of servableDatasets().filter((d) => d.jurisdictionId === "jurisdiction:ca-ab")) {
    assert.equal(dataset.renderKind, "ZONE_AREA");
    assert.equal(dataset.grade, "A");
  }
});
