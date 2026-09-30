import table from "../../../../content/regulatory/condition-kinds.json" with { type: "json" };
import type { ConditionScope, RegulatoryConditionKind } from "./condition.ts";

/**
 * The declared kind and scope of every condition a bundle carries.
 *
 * A sidecar rather than a field in each bundle because the bundles are
 * GENERATED from the authorities' own publications and reproduced byte for
 * byte by `check:regulatory-sources`; a classification is a reading of a rule,
 * not something the publication states, and it belongs beside the rule rather
 * than inside the builder's output. It is keyed by the condition's stable id,
 * which is what `condition.ts` promises ids are for.
 */
export interface ConditionClassification {
  kind: RegulatoryConditionKind;
  scope: ConditionScope;
}

const TABLE = (table as { conditions: Record<string, ConditionClassification> }).conditions;

/** Every classified id, for the test that holds the table to the bundles. */
export const CLASSIFIED_CONDITION_IDS: readonly string[] = Object.keys(TABLE);

/**
 * The classification to attach to a bundle condition.
 *
 * `namesItsZones` is the bundle row's own structure — it lists `zoneIds`, a
 * designation list or per-zone windows — and makes the scope ZONE by
 * construction whatever the table says; the test holds the table to agree.
 * An unclassified id returns no kind, which a consumer treats as material and
 * the test refuses before it ships.
 */
export function classificationOf(id: string, namesItsZones = false): Partial<ConditionClassification> {
  const row = TABLE[id];
  const scope: ConditionScope | undefined = namesItsZones ? "ZONE" : row?.scope;
  return {
    ...(row ? { kind: row.kind } : {}),
    ...(scope ? { scope } : {}),
  };
}

export function declaredClassification(id: string): ConditionClassification | undefined {
  return TABLE[id];
}
