import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { READINESS_FACTS, completenessFor, completenessMatrix, remainingFor } from "./completeness.ts";

/**
 * The completeness matrix, held to the two rules that make it a coordination
 * artifact rather than a dashboard.
 */

describe("completeness matrix", () => {
  it("answers the question it exists for, as an exact list", async () => {
    /* The owner's test: "What remains before Québec ruffed grouse is Ready to
       Hunt complete?" must return an exact list, not a percentage. */
    const { found, remaining } = await remainingFor("jurisdiction:ca-qc", "species:ruffed-grouse");
    assert.equal(found, true);
    assert.ok(remaining.length > 0);
    const facts = remaining.map((cell) => cell.fact);
    for (const expected of ["LICENCE", "METHODS", "AMMUNITION", "HUNTER_ORANGE", "LEGAL_HOURS"]) {
      assert.ok(facts.includes(expected as never), `${expected} should remain for Québec ruffed grouse`);
    }
    // Québec has a certified season, so SEASON is NOT on the remaining list.
    assert.ok(!facts.includes("SEASON" as never), "Québec's ruffed grouse season is certified");
    // Every remaining item tells a research lane what to do, not merely that it is missing.
    for (const cell of remaining) assert.ok(cell.note.length > 10, `${cell.fact} has no actionable note`);
  });

  it("separates 'nobody has read it' from 'the source cannot be used'", async () => {
    /* A queue item and a blocker go to different lanes. Collapsing them sends
       a researcher to read a source that is licence-blocked, or leaves a
       blocker sitting in a research queue nobody can clear. */
    const { remaining } = await remainingFor("jurisdiction:ca-qc", "species:ruffed-grouse");
    const hours = remaining.find((cell) => cell.fact === "LEGAL_HOURS")!;
    assert.equal(hours.state, "SOURCE_BLOCKED");
    assert.match(hours.note, /licence-blocked/);
    const licence = remaining.find((cell) => cell.fact === "LICENCE")!;
    assert.equal(licence.state, "RESEARCH_REQUIRED");
  });

  it("counts species-unit PAIRS, and never reports a species count as coverage", async () => {
    /* "Complete for 8 of 8 species" was a true sentence producing a false
       impression: it meant 874 of 1208 pairs. Species counts do not appear in
       this report at all, so that sentence cannot be formed from it. */
    const rows = await completenessMatrix();
    assert.ok(rows.length > 0);
    for (const row of rows) {
      assert.ok(!("species" in (row as object) && typeof (row as { species?: unknown }).species === "number"));
      for (const cell of row.facts) {
        assert.equal(cell.deliverable.of, row.unitsCovered, `${row.speciesId} ${cell.fact}: ceiling is the certified season`);
        assert.ok(cell.deliverable.pairs <= cell.deliverable.of);
        if (cell.state === "CERTIFIED") assert.equal(cell.deliverable.pairs, cell.deliverable.of);
        else assert.equal(cell.deliverable.pairs, 0, `${row.speciesId} ${cell.fact} is not certified and claims pairs`);
      }
    }
  });

  it("reports every fact for every certified species, so a gap cannot be invisible", async () => {
    const rows = await completenessMatrix();
    for (const row of rows) {
      assert.deepEqual([...row.facts.map((cell) => cell.fact)].sort(), [...READINESS_FACTS].sort(), row.speciesId);
    }
    // Ontario is the proving ground and must be the best-covered jurisdiction.
    const ontario = await completenessFor("jurisdiction:ca-on");
    assert.equal(ontario.length, 8);
    const certified = (rowsIn: typeof ontario) =>
      rowsIn.reduce((total, row) => total + row.facts.filter((cell) => cell.state === "CERTIFIED").length, 0);
    const quebec = await completenessFor("jurisdiction:ca-qc");
    assert.ok(certified(ontario) / ontario.length > certified(quebec) / quebec.length);
  });

  it("no species is complete yet, and the matrix says so plainly", async () => {
    /* Recorded as of 2026-09-24. When this fails, something became genuinely
       complete — check it against the nine facts before celebrating. */
    const rows = await completenessMatrix();
    assert.equal(rows.filter((row) => row.complete).length, 0);
  });
});
