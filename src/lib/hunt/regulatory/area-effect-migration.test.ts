import assert from "node:assert/strict";
import test from "node:test";
import { MANITOBA_OVERLAYS, MANITOBA_OVERLAY_ZONES, restrictionTokensFor } from "./manitoba.ts";
import { MONTANA_OVERLAYS } from "./us-montana.ts";
import { regulatoryEntryFor } from "./registry.ts";
import { areaWithholdsSeason, restrictionsFor } from "../overlays.ts";
import { overlaysInZone } from "../overlay-zones.ts";
import type { ZoneResolution } from "../types.ts";

/**
 * WHAT A PUBLISHED AREA DOES TO A HUNT INSIDE IT, proved by changing it.
 *
 * The zone path degraded a CONDITIONAL zone to NEEDS_VERIFICATION whenever ANY
 * published area inside it reached the species — "the answer depends on where
 * in it you hunt". §41A (decided 2026-10-01 on Saskatchewan's ss. 7 and 7.1)
 * says an authority may DEEM an area open inside an open zone, and where it
 * does, that deeming IS the rule. Withholding the season there refuses a hunt
 * the authority granted, which is §8's understating direction and the one
 * nobody reports: a hunter told to look elsewhere simply goes elsewhere.
 *
 * TWO CLAIMS, AND NEITHER IS ASSERTED — BOTH ARE MEASURED.
 *
 * 1. Nothing in the corpus changes today, because every area is UNRESOLVED and
 *    UNRESOLVED withholds exactly as the old code did.
 * 2. The mechanism works, because changing one real area's declared effect
 *    changes that zone's answer and nothing else.
 *
 * Saskatchewan — the case that motivated the rule — has no overlay catalogue
 * at all, so it cannot be the subject. Manitoba's is the one with a zone index
 * (Québec's has none), and Churchill Special Conservation Area inside Game
 * Hunting Area 1 is exactly §41A's example: a conservation designation that
 * predicts nothing about hunting either way.
 *
 * The subject is ruffed grouse on 20 October, because the degradation only
 * applies to a CONDITIONAL zone: measured over 62 designations, 7 species and
 * 4 dates, 180 of 992 whole-zone answers are CONDITIONAL and 252 carry an
 * `exceptInside`. Deer in Game Hunting Area 2 — the first subject tried — is
 * CLOSED there, so nothing would have been proved by it.
 */

const GROUSE = "species:ruffed-grouse";
const DATE = "2026-10-20";
const AREA = "Churchill Special Conservation Area";
const DESIGNATION = "1";
const TOKENS = restrictionTokensFor(GROUSE);

/** Every designation in the zone index, with the areas that reach the species. */
function areasByDesignation() {
  const zones = (MANITOBA_OVERLAY_ZONES as unknown as { zones: Record<string, unknown> }).zones;
  return Object.keys(zones).map((designation) => {
    const lookup = overlaysInZone(MANITOBA_OVERLAYS, MANITOBA_OVERLAY_ZONES, designation);
    const areas = lookup ? restrictionsFor(lookup, TOKENS) : [];
    return { designation, areas, withholding: areas.filter((area) => areaWithholdsSeason(area)) };
  }).filter((entry) => entry.areas.length > 0);
}

const zoneIndex = () =>
  (MANITOBA_OVERLAY_ZONES as unknown as { zones: Record<string, { layer: string; objectId: number }[]> }).zones;

/** The one real feature this file mutates: an area, in a zone, with words. */
function subjectFeature() {
  for (const entry of zoneIndex()[DESIGNATION] ?? []) {
    const layer = MANITOBA_OVERLAYS.layers.find((candidate) => candidate.key === entry.layer);
    const feature = layer?.features.find((candidate) => candidate.objectId === entry.objectId && candidate.name === AREA);
    if (feature) return feature;
  }
  throw new Error(`${AREA} is no longer indexed in Game Hunting Area ${DESIGNATION}`);
}

/**
 * Every designation whose index holds the subject area.
 *
 * DERIVED, not written down. Churchill Special Conservation Area is indexed in
 * Game Hunting Areas 1 AND 2 — one area straddling two zones — and asserting
 * "exactly one zone moves" was a claim about the data that the data refused.
 * One feature with two zones should change both, and only those two.
 */
function designationsHoldingSubject(): string[] {
  const zones = zoneIndex();
  return Object.keys(zones).filter((designation) => zones[designation].some((entry) => {
    const layer = MANITOBA_OVERLAYS.layers.find((candidate) => candidate.key === entry.layer);
    return layer?.features.some((candidate) => candidate.objectId === entry.objectId && candidate.name === AREA);
  })).sort();
}

test("every published area in the corpus is UNRESOLVED, so the migration changes no answer", () => {
  const rows = areasByDesignation();
  /* A positive control: an empty index would pass every claim below. */
  assert.ok(rows.length > 20, `only ${rows.length} designations hold an area reaching this species`);
  for (const { designation, areas, withholding } of rows) {
    for (const area of areas) {
      assert.equal(area.effect, "UNRESOLVED",
        `GHA ${designation}: ${area.name} has a declared effect; the measurement in this file is stale and the counts below must be re-taken`);
    }
    /* UNRESOLVED withholds, so the set the zone card reads is unchanged. */
    assert.equal(withholding.length, areas.length, `GHA ${designation}`);
  }
});

test("declaring one real area DEEMED_OPEN changes that zone's answer and no other", () => {
  const feature = subjectFeature();
  /* DEEMED_OPEN needs the authority's own words, and this feature has them. */
  assert.ok(feature.statedAs, "the mutation subject must carry an authority quotation");

  const before = areasByDesignation();
  const withholdingBefore = new Map(before.map((row) => [row.designation, row.withholding.length]));

  try {
    (feature as { huntingEffect?: string }).huntingEffect = "DEEMED_OPEN";
    const after = areasByDesignation();
    const changed = after.filter((row) => row.withholding.length !== withholdingBefore.get(row.designation));
    /*
     * THE ZONES THAT MOVE ARE EXACTLY THE ZONES THAT HOLD THIS AREA. A
     * mechanism that changed every zone would mean the effect is not
     * per-area; one that changed none would mean the declared effect is not
     * read at all, which is what the old code did.
     */
    const expected = designationsHoldingSubject();
    assert.ok(expected.length >= 1, "the subject is indexed nowhere");
    assert.deepEqual(changed.map((row) => row.designation).sort(), expected);
    for (const designation of expected) {
      const zone = after.find((row) => row.designation === designation)!;
      assert.equal(zone.withholding.length, withholdingBefore.get(designation)! - 1, `GHA ${designation}`);
    }
    /* The area is still THERE and still carries its words — it has stopped
       withholding the season, which is not the same as disappearing. */
    for (const designation of expected) {
      const row = after.find((candidate) => candidate.designation === designation)!;
      const deemed = row.areas.find((area) => area.name.startsWith("Churchill"));
      assert.equal(deemed?.effect, "DEEMED_OPEN", `GHA ${designation}: the area left the list instead of changing effect`);
      assert.equal(deemed?.words.owner, "AUTHORITY", `GHA ${designation}: a deemed-open area without the authority's words`);
    }
  } finally {
    delete (feature as { huntingEffect?: string }).huntingEffect;
  }

  /* And back, in exactly what the path reads. */
  const restored = areasByDesignation();
  assert.deepEqual(
    restored.map((row) => [row.designation, row.withholding.length]),
    before.map((row) => [row.designation, row.withholding.length]),
  );
});

test("the zone card is degraded only by the areas that withhold a season", async () => {
  /*
   * The same proof one level up, through the registry path the zone card
   * actually reads. ZONE scope looks nothing up at a point, so this runs
   * offline with no fetcher.
   */
  const entry = regulatoryEntryFor("jurisdiction:ca-mb")!;
  const zone = {
    status: "RESOLVED",
    zoneId: `management_zone:ca-mb-gha-${DESIGNATION}`,
    officialName: `Game Hunting Area ${DESIGNATION}`,
    message: "",
  } as unknown as ZoneResolution;
  const ask = () => entry.evaluate(
    { speciesId: GROUSE, latitude: 58.7, longitude: -93.2, date: DATE, answers: {} } as never,
    zone,
    { verifiedAt: DATE, scope: "ZONE" },
  );

  const before = await ask();
  /* The area withholds today, so the zone has no single answer. */
  assert.ok(before.exceptInside?.some((name) => name.startsWith("Churchill")),
    `Game Hunting Area ${DESIGNATION} is no longer qualified by ${AREA}; this test's subject has moved`);

  const feature = subjectFeature();
  try {
    (feature as { huntingEffect?: string }).huntingEffect = "DEEMED_OPEN";
    const after = await ask();
    /* Deemed open, so it no longer qualifies the zone. */
    assert.ok(!(after.exceptInside ?? []).some((name) => name.startsWith("Churchill")),
      "a deemed-open area still degraded the zone");
    /* And the limitation naming it is gone with it: a season said to run
       everywhere except an area the authority opened is the understatement
       §41A forbids. */
    assert.ok(!after.regulation.limitations.some((limitation) => JSON.stringify(limitation).includes(AREA)),
      "the deemed-open area was still named as restricting the hunt");
  } finally {
    delete (feature as { huntingEffect?: string }).huntingEffect;
  }

  const restored = await ask();
  assert.deepEqual(restored.exceptInside, before.exceptInside);
  assert.equal(restored.regulation.status, before.regulation.status);
});

test("North Ground's own summary can never deem ground open, whatever the catalogue says", () => {
  /*
   * The refusal that `AreaEffect` makes structural: `DEEMED_OPEN` requires an
   * `AuthorityQuotation`, because deeming ground open on North Ground's own
   * say-so is §8's understating failure in its worst form — it would tell a
   * hunter a closed area is open.
   *
   * It needed a case of its own, and it needed MONTANA. The Manitoba subject
   * above carries `statedAs`, so it always takes the quotation branch, and a
   * mutation that let the summary branch return a declared effect verbatim
   * passed all three tests above. Manitoba has no summary-only feature at all
   * (0 of 231); Montana has 50, its Big Game Restricted Areas, whose rule for
   * upland birds is not in the regulations North Ground certified — so what we
   * hold about them is our own sentence, not FWP's.
   */
  const subject = MONTANA_OVERLAYS.layers
    .flatMap((layer) => layer.features.map((feature) => ({ layer, feature })))
    .find(({ feature }) => !feature.statedAs && feature.northGroundSummary);
  assert.ok(subject, "Montana no longer holds a summary-only area");

  /* The lookup shape `lookupOverlays` produces for a point inside it. */
  const lookup = {
    available: true,
    specialIds: new Set(subject!.feature.specialIds),
    hits: [{ layer: subject!.layer.key, sourceId: subject!.layer.sourceId, objectId: subject!.feature.objectId, feature: subject!.feature }],
    lang: MONTANA_OVERLAYS.lang,
  };
  const tokens = [...subject!.feature.tokens];
  /* A positive control on the probe: a feature the tokens do not reach
     produces no area at all, and then nothing below is tested. */
  assert.equal(restrictionsFor(lookup, tokens).length, 1, "the subject was not reached by its own tokens");

  try {
    (subject!.feature as { huntingEffect?: string }).huntingEffect = "DEEMED_OPEN";
    const [area] = restrictionsFor(lookup, tokens);
    assert.equal(area.words.owner, "NORTH_GROUND", "the subject must be our own wording");
    assert.notEqual(area.effect, "DEEMED_OPEN",
      `${area.name}: North Ground's own wording was allowed to deem ground open`);
    /* And it still withholds, which is the conservative direction. */
    assert.ok(areaWithholdsSeason(area), `${area.name}: stopped withholding on our own say-so`);
  } finally {
    delete (subject!.feature as { huntingEffect?: string }).huntingEffect;
  }
});
