import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { evaluateHunt } from "./evaluate.ts";
import { regulatoryEntryFor } from "./regulatory/registry.ts";
import { BRITISH_COLUMBIA_BUNDLE } from "./regulatory/british-columbia.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { ZONE_LAYERS, layerForResolution, zoneCoverage } from "./zone-layers.ts";

/**
 * British Columbia serves rules — for exactly what it certified, and nothing
 * more.
 *
 * The first wave from B.C. Reg. 190/84 reaches 221 of the province's 225
 * Management Units, for seven small-game species. The failure mode a rules
 * landing invites is quietly widening that: the other four units and every
 * other species must still answer UNKNOWN, and this file exists to make a
 * silent widening fail.
 */

const BC = ZONE_LAYERS.find((layer) => layer.jurisdictionId === "jurisdiction:ca-bc")!;
const CERTIFIED_SPECIES = new Set(BRITISH_COLUMBIA_BUNDLE.rules.map((rule) => rule.speciesId));

const zoneIn = (designation: string): ZoneResolution => ({
  status: "RESOLVED",
  zoneId: `management_zone:ca-bc-mu-${designation.toLowerCase()}` as ZoneResolution["zoneId"],
  jurisdictionId: "jurisdiction:ca-bc",
  officialName: `Management Unit ${designation}`,
  boundaryDistanceMeters: 5_000,
  nearBoundary: false,
  sourceId: "source:ca-bc-mu-service",
  message: "",
});

const evaluate = (zone: ZoneResolution, speciesId: string, date = "2026-10-15") => evaluateHunt(
  { latitude: 50.6745, longitude: -120.3273, date: date as HuntInput["date"], speciesId: speciesId as HuntInput["speciesId"] },
  {
    resolveZone: async () => zone,
    weather: async (_la: number, _lo: number, on: string) => ({ status: "UNAVAILABLE" as const, summary: "", date: on as HuntInput["date"], sourceId: "source:open-meteo" as const }),
    fetch: (async () => { throw new Error("no request expected"); }) as typeof fetch,
    now: () => new Date("2026-09-23T12:00:00Z"),
  },
);

test("both switches are on, and the bundle answers", () => {
  assert.equal(BC.serving, true);
  assert.equal(BC.rulesServing, true);
  assert.ok(regulatoryEntryFor("jurisdiction:ca-bc"), "British Columbia answers");
});

test("the wave reaches 221 of 225 units, and the registry says so rather than rounding up", () => {
  assert.equal(BRITISH_COLUMBIA_BUNDLE.officialUnitCount, 225);
  assert.equal(BC.certifiedDesignations?.size, 221);
  assert.ok(BC.certifiedDesignations!.size < BRITISH_COLUMBIA_BUNDLE.officialUnitCount, "a partial wave must stay partial");
});

test("exactly seven species are certified, and the eighth is not quietly included", () => {
  assert.deepEqual([...CERTIFIED_SPECIES].sort(), [
    "species:american-black-bear",
    "species:rock-ptarmigan",
    "species:ruffed-grouse",
    "species:sharp-tailed-grouse",
    "species:snowshoe-hare",
    "species:spruce-grouse",
    "species:willow-ptarmigan",
  ]);
});

test("a certified species in a certified unit answers from the regulation", async () => {
  const result = await evaluate(zoneIn("3-20"), "species:ruffed-grouse");
  assert.notEqual(result.regulation.status, "UNKNOWN");
  assert.ok(
    result.sources.some((source) => source.id.startsWith("source:ca-bc")),
    "the answer cites a British Columbia source",
  );
});

test("an UNCERTIFIED species in a certified unit still answers UNKNOWN", async () => {
  /* The widening this file exists to catch. Moose is hunted in British
     Columbia and is not in this wave; a season must not appear for it. */
  const result = await evaluate(zoneIn("3-20"), "species:moose");
  assert.equal(result.regulation.status, "UNKNOWN");
  assert.ok(result.regulation.season === undefined, "no season is shown for a species with no certified rule");
});

test("a certified species in an UNCERTIFIED unit still answers UNKNOWN", async () => {
  /* The authority's own 225 identifiers, read from the bundle file: the typed
     view exposes the rules, not the full inventory the wave is measured
     against. */
  const published = JSON.parse(readFileSync("content/regulatory/ca-bc-2026.json", "utf8")) as { officialIdentifiers: string[] };
  const uncertified = published.officialIdentifiers
    .filter((designation) => !BC.certifiedDesignations!.has(designation.toUpperCase()));
  assert.equal(uncertified.length, 4, "four units are outside the wave");
  for (const designation of uncertified) {
    const result = await evaluate(zoneIn(designation), "species:ruffed-grouse");
    assert.equal(result.regulation.status, "UNKNOWN", designation);
    assert.equal(zoneCoverage(BC, designation), "IN_DEVELOPMENT", designation);
  }
});

test("a certified unit reads as certified rules; an uncertified one never does", () => {
  assert.equal(zoneCoverage(BC, [...BC.certifiedDesignations!][0]), "VERIFIED");
  assert.equal(layerForResolution(zoneIn("3-20")).kind, "SERVING");
});

/* ── The disputes survive the landing ────────────────────────────────────── */

test("the three cross-check disputes are still encoded, not resolved away", () => {
  /*
   * Two genuine disagreements between B.C. Reg. 190/84 and the 2026-2028
   * synopsis, found when the bundle was built. A later rebuild quietly picking
   * a side would be the worst kind of regression: the answer would look
   * cleaner and be less true. The engine reads a dispute as two worlds, so
   * where the readings disagree the status is CONFLICT.
   */
  const disputed = BRITISH_COLUMBIA_BUNDLE.rules.filter((rule) => rule.disputes.length > 0);
  assert.equal(disputed.length, 3);

  const bear = disputed.find((rule) => rule.speciesId === "species:american-black-bear")!;
  assert.match(bear.disputes[0].statedAs, /April 1 to June 20;.*synopsis prints April 1 to June 30/);

  /* The youth-season dispute reaches both grouse the clause names. */
  const grouse = disputed.filter((rule) => rule.speciesId !== "species:american-black-bear");
  assert.deepEqual(grouse.map((rule) => rule.speciesId).sort(), ["species:ruffed-grouse", "species:spruce-grouse"]);
  for (const rule of grouse) {
    assert.match(rule.disputes[0].statedAs, /September 1 to September 9 grouse season to persons under 18/);
    assert.match(rule.disputes[0].statedAs, /Part 1 of Schedule 8 lists no such season/);
  }
});

test("a day outside the certified period is NEEDS_VERIFICATION, not an answer", async () => {
  /* The bundle covers one year of seasons. Outside it there is no certified
     rule, and the dispute below is not even reached. */
  const before = await evaluate(zoneIn("3-20"), "species:american-black-bear", "2026-06-25");
  assert.equal(before.regulation.status, "NEEDS_VERIFICATION");
});

test("a disputed reading surfaces as CONFLICT rather than a clean answer", async () => {
  /*
   * Spring black bear inside the disputed window: June 25 is open on the
   * synopsis's reading and closed on the regulation's, and North Ground says
   * so. The date is June 2027, not June 2026: the bundle is certified for
   * 2026-07-01 to 2027-06-30, so June 2026 is BEFORE the certified period and
   * correctly answers NEEDS_VERIFICATION rather than reaching the dispute at
   * all. Asking about a day the bundle does not cover proves nothing about it.
   */
  const result = await evaluate(zoneIn("3-20"), "species:american-black-bear", "2027-06-25");
  assert.equal(result.regulation.status, "CONFLICT");
  assert.ok(
    JSON.stringify(result.regulation).includes("June 30"),
    "the conflict states both readings rather than hiding one",
  );
});
