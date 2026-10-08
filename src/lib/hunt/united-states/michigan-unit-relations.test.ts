import assert from "node:assert/strict";
import test from "node:test";
import {
  michiganResolution, michiganUnitIsCurrent, MICHIGAN_OVERLAPS, MICHIGAN_RESCINDED_UNITS,
} from "./michigan-unit-relations.ts";

/**
 * Michigan's units overlap because its Order lets them, and no answer may
 * resolve that by choosing.
 */

test("a point in several units is a CONFLICT, never a pick", () => {
  /*
   * THE WHOLE POINT. Measured on MDNR's own service: a point at 42.8, -83.5 is
   * in Oakland County, the Southern Lower Peninsula multicounty unit and the
   * Urban deer management zone at once. The Order states no precedence — zero
   * hits for precedence, supersede, most restrictive, shall govern and shall
   * control across 183 pages — so naming one asserts a rule the authority
   * declined to state.
   */
  const three = michiganResolution(["063", "486", "499"]);
  assert.equal(three.outcome, "CONFLICT");
  if (three.outcome !== "CONFLICT") return;
  assert.deepEqual([...three.designations], ["063", "486", "499"], "every unit is named, not just the first");
  assert.match(three.because, /states no rule of precedence/);
  /* And a conflict is not an error: the hunter is told which units apply. */
  assert.ok(three.designations.length > 1);
});

test("one unit resolves, and no unit is an answer too", () => {
  assert.deepEqual(michiganResolution(["021"]), { outcome: "RESOLVED", designation: "021" });
  assert.deepEqual(michiganResolution([]), { outcome: "NO_UNIT" });
  assert.deepEqual(michiganResolution(["  "]), { outcome: "NO_UNIT" }, "a blank designation is not a unit");
  assert.deepEqual(michiganResolution([" 021 "]), { outcome: "RESOLVED", designation: "021" }, "trimmed");
});

test("a rescinded unit is excluded by a sourced list, and cannot turn a conflict into an answer", () => {
  /*
   * DMU 351 and 352 were rescinded by the Natural Resources Commission and
   * MDNR's own service still publishes both, stamped Year=2026 like every other
   * row. Nothing on the layer distinguishes them — the two do not even share a
   * naming pattern — so the exclusion is an explicit list rather than a rule
   * inferred from the data.
   */
  assert.deepEqual([...MICHIGAN_RESCINDED_UNITS], ["351", "352"]);
  assert.equal(michiganUnitIsCurrent("351"), false);
  assert.equal(michiganUnitIsCurrent("352"), false);
  assert.equal(michiganUnitIsCurrent("021"), true);

  /* A point the service places in a live unit AND a rescinded one resolves to
     the live one: the rescinded unit is not a competing answer. */
  assert.deepEqual(michiganResolution(["021", "351"]), { outcome: "RESOLVED", designation: "021" });
  /* And a point only in rescinded units has no unit, rather than one. */
  assert.deepEqual(michiganResolution(["351", "352"]), { outcome: "NO_UNIT" });
});

test("a carve-out needs the authority's own sentence; an overlap needs a reason", () => {
  /*
   * CARVED_OUT_BY_DEFINITION structurally carries the defining words, because
   * North Ground cannot remove land from a unit on its own say-so — the same
   * discipline AreaEffect applies to DEEMED_OPEN. Everything else must say why
   * it is unresolved rather than simply being unresolved.
   */
  let carveOuts = 0;
  for (const overlap of MICHIGAN_OVERLAPS) {
    const relation = overlap.relation;
    if (relation.relation === "CARVED_OUT_BY_DEFINITION") {
      carveOuts += 1;
      assert.equal(relation.words.owner, "AUTHORITY", `${overlap.container}: the sentence must be the authority's`);
      assert.ok(relation.words.citation.length > 20, `${overlap.container}: cite the section`);
      assert.match(relation.words.text, /except those lands defined/, "the carve-out is stated as an exception");
    } else {
      assert.ok(relation.because.length > 40, `${overlap.container}: say why it is unresolved`);
    }
  }
  assert.equal(carveOuts, 1, "one carve-out pattern is read from the Order; the rest are genuinely unresolved");
});

test("the carve-out citation says it comes from the stale consolidation", () => {
  /*
   * The consolidated Order is current only through Amendment 5 of 2026 and
   * still contains the rescinded sections, so it must never certify a unit's
   * current extent. Quoting its DRAFTING PATTERN is a different act, and the
   * citation has to make that visible or the next reader will take it for a
   * current rule.
   */
  const carve = MICHIGAN_OVERLAPS.find((o) => o.relation.relation === "CARVED_OUT_BY_DEFINITION")!;
  const relation = carve.relation;
  if (relation.relation !== "CARVED_OUT_BY_DEFINITION") return;
  assert.match(relation.words.citation, /consolidated through Amendment 5 of 2026/);
});

test("the four known overlapping containers are all recorded as unresolved", () => {
  /* 486, 487, 499 and 333 overlap the county units with nothing resolving them.
     If one of these ever becomes CARVED_OUT, it must be because someone read
     the Order, which this assertion forces them to notice. */
  const unresolved = MICHIGAN_OVERLAPS
    .filter((o) => o.relation.relation === "GENUINE_OVERLAP_UNRESOLVED")
    .map((o) => o.container).sort();
  assert.deepEqual(unresolved, ["333", "486", "487", "499"]);
});
