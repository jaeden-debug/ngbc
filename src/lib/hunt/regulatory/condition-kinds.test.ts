import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { CLASSIFIED_CONDITION_IDS, classificationOf, declaredClassification } from "./condition-kinds.ts";
import { REGULATORY_CONDITION_KINDS } from "./condition.ts";

/**
 * Every condition a bundle can emit is classified, and the table holds nothing
 * else.
 *
 * The map's `!` reads a condition's declared kind and scope. A condition with
 * neither is treated as material — the safe direction — so an unclassified one
 * would quietly put the marker back on every zone it reaches, which is the
 * 89.6% map this table replaced. This file is what makes "declared" true: the
 * universe is read from the committed bundles, so a new condition cannot be
 * added without someone reading it.
 *
 * THAT CLAIM WAS FALSE, AND IN THE WAY THE CLAIM ITSELF INVITED. The universe
 * was a HAND-KEPT list of seven filenames, so a new condition could not be
 * added to a listed bundle without someone reading it — and a new BUNDLE could
 * be added with none of its conditions read at all. Three were: New Brunswick,
 * Newfoundland and Labrador, and Nova Scotia, 55 conditions between them, every
 * one unclassified and therefore wearing a `!` on every zone it reached. The
 * exact map this table was built to retire, in three jurisdictions, while the
 * test that exists to prevent it passed.
 *
 * The directory is the universe now. A bundle cannot be added without its
 * conditions being read, because nothing has to remember to list it.
 */

interface BundleCondition { id: string; zoneIds?: string[]; activeWindowsByZone?: unknown }

function bundleConditions(file: string): BundleCondition[] {
  const bundle = JSON.parse(readFileSync(new URL(`../../../../content/regulatory/${file}`, import.meta.url), "utf8")) as {
    sources?: Array<{ conditions?: BundleCondition[] }>;
  };
  return (bundle.sources ?? []).flatMap((source) => source.conditions ?? []);
}

function quebecConditions(): BundleCondition[] {
  const bundle = JSON.parse(readFileSync(new URL("../../../../content/regulatory/ca-qc-2026.json", import.meta.url), "utf8")) as {
    statements: Array<{ id: string; scope: string; designations?: string[] }>;
  };
  /* The same selection `quebec.ts` makes: only rule- and designation-scoped
     statements become conditions; page-wide ones are standing limitations. */
  return bundle.statements
    .filter((statement) => statement.scope === "rule" || statement.scope === "designations")
    .map((statement) => ({ id: statement.id, ...(statement.designations ? { zoneIds: statement.designations } : {}) }));
}

/**
 * Every condition every committed bundle can emit.
 *
 * Read from the DIRECTORY, not a list. Québec keeps its conditions as
 * `statements` and the rest hang them off `sources[].conditions`, so both
 * shapes are read — and a bundle whose rules reference conditions while
 * yielding none is a THIRD shape nobody has taught this file, which fails
 * loudly below rather than contributing zero and looking complete.
 */
function allBundleConditions(): Array<{ file: string; conditions: BundleCondition[]; ruleReferences: number }> {
  const dir = new URL("../../../../content/regulatory/", import.meta.url);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((file) => {
      const bundle = JSON.parse(readFileSync(new URL(file, dir), "utf8")) as {
        sources?: Array<{ conditions?: BundleCondition[] }>;
        statements?: Array<{ id: string; scope: string; designations?: string[] }>;
        rules?: Array<{ conditionIds?: string[] }>;
      };
      /* The same selection `quebec.ts` makes: only rule- and designation-scoped
         statements become conditions; page-wide ones are standing limitations. */
      const fromStatements = (bundle.statements ?? [])
        .filter((statement) => statement.scope === "rule" || statement.scope === "designations")
        .map((statement) => ({ id: statement.id, ...(statement.designations ? { zoneIds: statement.designations } : {}) }));
      const conditions = [...(bundle.sources ?? []).flatMap((source) => source.conditions ?? []), ...fromStatements];
      const ruleReferences = (bundle.rules ?? []).filter((rule) => (rule.conditionIds ?? []).length > 0).length;
      return { file, conditions, ruleReferences };
    });
}

const BUNDLES = allBundleConditions();
const EMITTED: BundleCondition[] = BUNDLES.flatMap((bundle) => bundle.conditions);

test("every bundle's conditions are actually read, in whatever shape it keeps them", () => {
  /*
   * THE CONTROL THAT MAKES THE ENUMERATION HONEST. Reading a directory is only
   * better than a list if a shape this file does not understand FAILS rather
   * than quietly yielding nothing — otherwise the next bundle format
   * reintroduces exactly the hole the list left, and the count still looks
   * plausible.
   */
  const silent = BUNDLES.filter((bundle) => bundle.ruleReferences > 0 && bundle.conditions.length === 0);
  assert.deepEqual(silent.map((bundle) => bundle.file), [],
    "these bundles' rules reference conditions this file cannot find — teach it the shape");

  const contributing = BUNDLES.filter((bundle) => bundle.conditions.length > 0);
  assert.ok(contributing.length >= 9, `only ${contributing.length} bundles contribute conditions`);
  assert.ok(EMITTED.length > 100, `only ${EMITTED.length} conditions found across the corpus`);
});

/**
 * Conditions a person read and could not classify, with the reason.
 *
 * Not a backlog: each entry is a finding that the declared vocabulary cannot
 * express what an authority states, which §41A answers by expanding the model
 * rather than by rounding the source into the nearest field. An unclassified
 * condition keeps its marker, so the cost of one sitting here is noise, not a
 * hidden restriction.
 */
const UNCLASSIFIABLE = Object.keys(
  (JSON.parse(readFileSync(new URL("../../../../content/regulatory/condition-kinds.json", import.meta.url), "utf8")) as
    { unclassifiable?: Record<string, { reason: string; sourceSection?: string }> }).unclassifiable ?? {},
);

test("every condition a bundle can emit has a declared kind", () => {
  const missing = EMITTED
    .filter((condition) => !declaredClassification(condition.id) && !UNCLASSIFIABLE.includes(condition.id))
    .map((condition) => condition.id);
  assert.deepEqual(missing, [], `classify these in content/regulatory/condition-kinds.json: ${missing.join(", ")}`);

  /* And every declared exception must still be a condition something emits, and
     must carry a reason — otherwise it is a way to silence the check. */
  const emitted = new Set(EMITTED.map((condition) => condition.id));
  for (const id of UNCLASSIFIABLE) {
    assert.ok(emitted.has(id), `${id} is listed unclassifiable and no bundle emits it`);
    assert.ok(!declaredClassification(id), `${id} is both classified and listed unclassifiable`);
  }
});

test("the table classifies nothing a bundle does not emit", () => {
  const emitted = new Set(EMITTED.map((condition) => condition.id));
  const stale = CLASSIFIED_CONDITION_IDS.filter((id) => !emitted.has(id));
  assert.deepEqual(stale, [], "a stale row would outlive the rule it described");
});

test("every kind is in the vocabulary", () => {
  for (const id of CLASSIFIED_CONDITION_IDS) {
    const row = declaredClassification(id)!;
    assert.ok(REGULATORY_CONDITION_KINDS.includes(row.kind), `${id}: ${row.kind}`);
    assert.ok(row.scope === "JURISDICTION" || row.scope === "ZONE", `${id}: ${row.scope}`);
  }
});

test("a condition whose bundle row names its zones is declared ZONE", () => {
  /* The structure outranks the table, and the table must agree with it: a row
     saying JURISDICTION about a condition limited to three zones is a
     classification nobody checked. */
  for (const condition of EMITTED) {
    if (!condition.zoneIds?.length && !condition.activeWindowsByZone) continue;
    assert.equal(declaredClassification(condition.id)?.scope, "ZONE", condition.id);
    assert.equal(classificationOf(condition.id, true).scope, "ZONE");
  }
});

test("Alberta's WMU 936 permit reaches WMU 936 alone", () => {
  /*
   * The defect found while classifying: the footnote rides on rules whose
   * groups span 97 units, so a hunter in WMU 102 was told they needed the WMU
   * 936 discharge permit — a restriction stricter than the source, which §8
   * counts as false. The bundle row now names its unit.
   */
  const permit = EMITTED.find((condition) => condition.id === "ab-wmu-936-discharge-permit");
  assert.deepEqual(permit?.zoneIds, ["management_zone:ca-ab-wmu-936"]);
  const wainwright = EMITTED.find((condition) => condition.id === "ab-cfb-wainwright");
  assert.deepEqual(wainwright?.zoneIds, ["management_zone:ca-ab-wmu-728", "management_zone:ca-ab-wmu-730"]);
});
