import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { evaluateConditional, type ConditionalBundle, type ConditionalVocabulary } from "./conditional-engine.ts";
import { MANITOBA_VOCABULARY } from "./manitoba.ts";
import { NOVA_SCOTIA_VOCABULARY } from "./nova-scotia.ts";
import { NEWFOUNDLAND_VOCABULARY } from "./newfoundland.ts";
import { NEW_BRUNSWICK_VOCABULARY } from "./new-brunswick.ts";
import { SASKATCHEWAN_VOCABULARY } from "./saskatchewan.ts";

/**
 * EVERY CERTIFIED BUNDLE MUST ACTUALLY ANSWER SOMEWHERE.
 *
 * WHY THIS EXISTS. Nova Scotia shipped with eleven certified rules over eight
 * species and answered CLOSED everywhere. `areaOf` resolves a point's zone id to
 * an IDENTIFIER through the bundle's `units`, and `appliesInWorld` matches that
 * identifier against a rule's `include.ghas`; the bundle held zone ids in both,
 * so `areaOf` returned null for every point in the province and not one rule
 * applied. A hunter standing in Deer Management Zone 104 on 15 November — deep
 * inside a season the bundle encoded correctly — was told deer hunting was
 * CLOSED, with the Wildlife Act quoted underneath it. Newfoundland and Labrador
 * then reproduced the same defect in its first draft, plus a second of the same
 * kind: its pre-season was keyed `HUNT_METHOD` where the engine reads
 * `permittedImplements`, so a bow hunter lost two weeks of season.
 *
 * WHY NOTHING CAUGHT IT. Eleven Nova Scotia tests passed. Every one of them read
 * the BUNDLE — the windows, the conditions, the closures — and none asked the
 * ENGINE for an answer. A test that asserts the data you just typed cannot fail,
 * whatever it says about the data. So this file deliberately asks the only
 * question the other tests cannot: given a real point in a real area on a real
 * date inside a real window, does a hunter get a season?
 *
 * WHAT IT DOES NOT DO. It does not check that any particular answer is right —
 * that is each jurisdiction's own test file. It checks that the wiring between
 * bundle, geography and engine is connected at all, which is the failure that
 * turns a correct bundle into a product that says CLOSED to everyone.
 */

const BUNDLES = join(process.cwd(), "content", "regulatory");

interface Wired {
  file: string;
  vocabulary: ConditionalVocabulary;
  /** A point inside the first unit, for jurisdictions whose extent we know. */
  latitude: number;
  longitude: number;
}

/*
 * The conditional bundles wired to a vocabulary, which is what this can drive.
 * Ontario, Québec, Alberta, British Columbia, Montana and Idaho evaluate through
 * their own entry functions rather than `evaluateConditional`, and each has its
 * own integration test; adding one here needs its vocabulary exported.
 */
const WIRED: Wired[] = [
  { file: "ca-mb-2026.json", vocabulary: MANITOBA_VOCABULARY, latitude: 49.9, longitude: -97.1 },
  { file: "ca-ns-2026.json", vocabulary: NOVA_SCOTIA_VOCABULARY, latitude: 45.1, longitude: -63.5 },
  { file: "ca-nl-2026.json", vocabulary: NEWFOUNDLAND_VOCABULARY, latitude: 48.95, longitude: -57.95 },
  { file: "ca-nb-2026.json", vocabulary: NEW_BRUNSWICK_VOCABULARY, latitude: 46.09, longitude: -64.79 },
  { file: "ca-sk-2026.json", vocabulary: SASKATCHEWAN_VOCABULARY, latitude: 52.13, longitude: -106.67 },
];

function load(file: string): ConditionalBundle {
  return JSON.parse(readFileSync(join(BUNDLES, file), "utf8")) as ConditionalBundle;
}

test("every conditional bundle in the directory is wired here, or named as evaluated elsewhere", () => {
  /* The positive control. A list that silently stops covering new bundles is how
     this check comes to pass by testing nothing. */
  const conditional = readdirSync(BUNDLES).filter((file) => {
    if (!file.endsWith(".json")) return false;
    const bundle = JSON.parse(readFileSync(join(BUNDLES, file), "utf8")) as Partial<ConditionalBundle>;
    /* A conditional bundle is one whose rules carry `regulatoryGroupId` and
       whose geography speaks in `ghas` — the shape `evaluateConditional` reads. */
    return Array.isArray(bundle.rules) && bundle.rules.some((rule) => rule.regulatoryGroupId && rule.geography);
  });
  const covered = new Set(WIRED.map((entry) => entry.file));
  /* Evaluated through their own entry function and asserted in their own
     integration test, not through `evaluateConditional`'s vocabulary path. */
  const elsewhere = new Set(["ca-ab-2026.json", "ca-bc-2026.json", "us-id-pronghorn-2026.json", "us-mt-upland-2026.json"]);
  const unaccounted = conditional.filter((file) => !covered.has(file) && !elsewhere.has(file));
  assert.deepEqual(unaccounted, [], `conditional bundles neither driven here nor named as evaluated elsewhere:\n${unaccounted.join("\n")}`);
  assert.ok(covered.size >= 5, "the wired list must not empty out");
});

for (const entry of WIRED) {
  test(`${entry.file} gives a hunter a season somewhere inside its own windows`, () => {
    const bundle = load(entry.file);
    const groups = new Map(bundle.groups.map((group) => [group.id, group]));
    const byZoneId = new Map((bundle.units ?? []).map((unit) => [unit.zoneId, unit.identifier]));
    assert.ok(byZoneId.size > 0, "a bundle whose `units` are not identifier/zoneId pairs can never resolve an area");

    /* For each species, take one rule that has a window, one zone its group
       reaches, and a date in the middle of that window. If the wiring is sound
       the engine must not answer CLOSED there. */
    const species = [...new Set(bundle.rules.map((rule) => rule.speciesId))];
    assert.ok(species.length > 0);
    let answered = 0;
    const closed: string[] = [];
    for (const speciesId of species) {
      const rule = bundle.rules.find((candidate) =>
        candidate.speciesId === speciesId && candidate.windows.length > 0 && !candidate.declaredNoSeason);
      if (!rule) continue;
      const zoneId = groups.get(rule.regulatoryGroupId)?.zoneIds[0];
      assert.ok(zoneId, `${rule.id} names a group with no zones`);
      assert.ok(byZoneId.has(zoneId), `${zoneId} is in a group but not in \`units\`, so no point in it can resolve`);

      /* Midpoint of the first window, so a boundary-date bug cannot mask this. */
      const open = Date.parse(`${rule.windows[0].opensIso}T12:00:00Z`);
      const close = Date.parse(`${rule.windows[0].closesIso}T12:00:00Z`);
      const date = new Date((open + close) / 2).toISOString().slice(0, 10);

      /* Every method the rule allows, so a method-keyed rule is asked with a
         method it accepts rather than with nothing. */
      const implement = (rule.appliesWhen.permittedImplements as string[] | undefined)?.[0];
      const answers = implement ? { HUNT_METHOD: implement } : {};
      const evaluation = evaluateConditional(bundle, entry.vocabulary, {
        speciesId, speciesName: speciesId.replace("species:", ""), date,
        place: {
          zoneId, zoneName: byZoneId.get(zoneId)!,
          latitude: entry.latitude, longitude: entry.longitude,
          overlays: new Set<string>(),
        },
        answers,
      });
      answered += 1;
      /* NEEDS_INPUT is a legitimate answer and not a failure: the engine knows
         the law and wants a fact from the hunter (§ the engine's own comment).
         What is never legitimate is CLOSED on a date the bundle itself opens. */
      const where = `${speciesId} in ${zoneId} on ${date}, inside ${rule.windows[0].opensIso}..${rule.windows[0].closesIso} (${rule.id})`;
      if (evaluation.completeness === "NEEDS_INPUT" && !evaluation.result) {
        assert.ok(evaluation.required ?? evaluation.dimensions.length, `${where}: NEEDS_INPUT with nothing to ask`);
        continue;
      }
      assert.ok(evaluation.result, `${where}: RESOLVED with no result`);
      if (evaluation.result.status === "CLOSED") closed.push(where);
    }
    assert.ok(answered > 0, "no species in this bundle has a window to test, which cannot be right for a certified bundle");
    assert.deepEqual(closed, [],
      `the engine answered CLOSED inside the bundle's own season windows — the bundle and the engine are not connected:\n${closed.join("\n")}`);
  });
}

test("crossesYearAgreesWithTheBundle", () => {
  /*
   * ONE FACT, TWO DEFINITIONS, AND THEY HAD DRIFTED.
   *
   * `crossesYear()` in `season.ts` decides whether a season spans the turn of
   * the calendar year by comparing MONTH-AND-DAY anchors, so 15 October to
   * 15 March crosses. The bundles carry that answer on each resolved window.
   * The engine derived its own for the season list it reports, as
   * `closesIso < opensIso` — but a resolved window is anchored to its licence
   * year and so never wraps, which made the engine's answer false for every
   * window in every bundle, including the 31 that genuinely cross.
   *
   * Nothing read it yet, which is exactly why it was worth pinning: a latent
   * disagreement between two definitions of one fact is found by whoever trusts
   * the wrong one first.
   */
  let crossing = 0;
  const spansTurnWithoutFlag: Record<string, number> = {};
  const anotherSchema: string[] = [];
  for (const file of readdirSync(BUNDLES).filter((name) => name.endsWith(".json"))) {
    const bundle = JSON.parse(readFileSync(join(BUNDLES, file), "utf8")) as Partial<ConditionalBundle>;
    const windows = (bundle.rules ?? []).flatMap((rule) => rule.windows ?? []);
    /* Québec's bundle is not a ConditionalBundle at all — its own contract keys
       windows `opens`/`closes` and carries `statements` and `legalAnimalClasses`
       — so it has its own evaluator and is not swept here. Naming it rather than
       skipping it silently is the point: a bundle in a THIRD shape fails this
       line instead of being read as zero windows. */
    if (windows.length && !windows.every((window) => typeof window.opensIso === "string")) {
      anotherSchema.push(file);
      continue;
    }
    for (const rule of bundle.rules ?? []) {
      for (const window of rule.windows ?? []) {
        if (typeof window.crossesYear !== "boolean") {
          if (window.opensIso.slice(0, 4) !== window.closesIso.slice(0, 4)) {
            spansTurnWithoutFlag[file] = (spansTurnWithoutFlag[file] ?? 0) + 1;
          }
          continue;
        }
        const fromResolvedDates = window.opensIso.slice(0, 4) !== window.closesIso.slice(0, 4);
        assert.equal(fromResolvedDates, window.crossesYear,
          `${file} ${rule.id}: the bundle says crossesYear=${window.crossesYear} for ${window.opensIso}..${window.closesIso}`);
        /* And no resolved window wraps, which is what makes the derivation from
           dates equivalent to the derivation from anchors. */
        assert.ok(window.opensIso <= window.closesIso, `${file} ${rule.id}: ${window.opensIso}..${window.closesIso} closes before it opens`);
        if (window.crossesYear) crossing += 1;
      }
    }
  }
  /* The positive control: an empty sweep and a clean one look identical. */
  assert.ok(crossing >= 31, `only ${crossing} crossing windows found, so this test may not be reading the bundles`);

  /*
   * AND THE WINDOWS THAT SPAN THE TURN AND SAY NOTHING ABOUT IT.
   *
   * Manitoba, Nova Scotia, Ontario and Saskatchewan set the flag; Alberta,
   * British Columbia, New Brunswick, Newfoundland and Labrador and Montana never
   * emit it. Thirty-six windows across those five genuinely span the turn of the
   * calendar year with the field absent. No answer is wrong today, because the
   * engine derives its own from the dates — but a window that says nothing about
   * crossing is indistinguishable from one nobody checked, so the exact counts
   * are recorded here. A NEW bundle that omits the flag fails this line rather
   * than joining a tolerated set.
   *
   * The first measurement of this said twenty windows in four bundles, because it
   * was taken with a `ca-*.json` glob and Montana's sixteen were outside it. The
   * number below comes from the sweep, which reads the directory.
   */
  assert.deepEqual(anotherSchema, ["ca-qc-2026.json"]);
  assert.deepEqual(spansTurnWithoutFlag, {
    "ca-ab-2026.json": 4,
    "ca-bc-2026.json": 14,
    "ca-nb-2026.json": 1,
    "ca-nl-2026.json": 1,
    "us-mt-upland-2026.json": 16,
  });
});
