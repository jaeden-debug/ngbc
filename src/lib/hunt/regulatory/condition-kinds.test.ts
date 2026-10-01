import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const EMITTED: BundleCondition[] = [
  ...["ca-ab-2026.json", "ca-mb-2026.json", "ca-on-major-game-2026.json", "us-id-pronghorn-2026.json", "us-mt-upland-2026.json", "us-wy-elk-2026.json", "ca-bc-2026.json", "ca-federal-2026.json"]
    .flatMap(bundleConditions),
  ...quebecConditions(),
];

test("every condition a bundle can emit has a declared kind", () => {
  const missing = EMITTED.filter((condition) => !declaredClassification(condition.id)).map((condition) => condition.id);
  assert.deepEqual(missing, [], `classify these in content/regulatory/condition-kinds.json: ${missing.join(", ")}`);
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
