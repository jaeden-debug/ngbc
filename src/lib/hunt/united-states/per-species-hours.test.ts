import assert from "node:assert/strict";
import test from "node:test";
import { unitedStatesCoverageMatrix } from "./coverage-matrix.ts";

const rows = unitedStatesCoverageMatrix();
const byCode = new Map(rows.map((row) => [row.code, row]));
const perSpecies = rows.filter((row) => row.huntingHours.perSpecies?.length);

test("a species with no stated rule is structurally incapable of carrying one", () => {
  /* THE INVARIANT THAT MAKES THE THREE-WAY SPLIT WORTH HAVING.
     NO_RESTRICTION and NOT_STATED must not carry a `basis` or a `statedAs`,
     because the failure mode is not a wrong value — it is somebody helpfully
     filling one in later, after which the record reads exactly like a rule the
     authority never wrote.

     Iowa is why. IAC 571—96.5 and 571—96.8 say "There are no restrictions on
     shooting hours" for pigeon and squirrel, and the booklet independently
     prints "No Restrictions". Encoding half-an-hour-before-sunrise there would
     invent a restriction the authority does not impose, which §8 makes as
     serious as inventing a permission. */
  let checked = 0;
  for (const row of perSpecies) {
    for (const rule of row.huntingHours.perSpecies!) {
      checked += 1;
      if (rule.state === "STATED") {
        assert.ok(rule.basis, `${row.code} ${rule.species}: a stated rule needs its basis`);
        assert.ok(rule.statedAs, `${row.code} ${rule.species}: a stated rule needs the authority's words`);
      } else {
        assert.equal(rule.basis, undefined, `${row.code} ${rule.species}: ${rule.state} must carry no basis`);
        assert.equal(rule.statedAs, undefined, `${row.code} ${rule.species}: ${rule.state} must quote no window`);
        /* And it must say WHY, or an absence is indistinguishable from a species
           somebody forgot to read. */
        assert.ok((rule.note ?? "").length > 40, `${row.code} ${rule.species}: ${rule.state} needs its evidence`);
      }
      assert.ok(rule.citation.length > 3, `${row.code} ${rule.species}: every state of every rule is cited`);
    }
  }
  /* A count of what was checked, so a vacuous pass is visible (§9). */
  assert.ok(checked >= 55, `only ${checked} species rules were checked`);
});

test("the counts are computed from the records, not typed", () => {
  /* §9: no number in a coverage report may be a constant somebody can edit to
     make a jurisdiction look covered. */
  for (const row of perSpecies) {
    const rules = row.huntingHours.perSpecies!;
    assert.deepEqual(row.huntingHours.speciesCounts, {
      stated: rules.filter((rule) => rule.state === "STATED").length,
      noRestriction: rules.filter((rule) => rule.state === "NO_RESTRICTION").length,
      notStated: rules.filter((rule) => rule.state === "NOT_STATED").length,
    }, `${row.code}'s counts must equal its records`);
  }
});

test("a state with silent species is not reported as hours-certified wholesale", () => {
  /* Indiana states hours for five species and for nothing else — twenty species
     unread, including raccoon and opossum, which are NIGHT-HUNTED there. A
     silent inheritance of the deer offsets would not merely be unsupported; it
     would be substantively wrong. So the row must name the gap. */
  const indiana = byCode.get("IN")!;
  assert.equal(indiana.huntingHours.status, "RULE_CERTIFIED_PER_SPECIES");
  assert.ok(indiana.huntingHours.speciesCounts!.notStated > 0);
  assert.ok(indiana.knownGaps.some((gap) => /not stated by the authority/.test(gap)),
    "the gap is named in the row, not only in the registry");
  assert.ok(indiana.knownGaps.some((gap) => /never inherit the general rule/.test(gap)));
});

test("three different turkey answers in one state are three records", () => {
  /* ILLINOIS. Spring turkey ends at a fixed 1:00 p.m.; fall firearm at sunset;
     fall archery half an hour past sunset. A single turkey value is wrong for
     two of them. And its upland game is "Sunrise until sunset" with no offset at
     all, so applying the deer rule there would create an hour of illegal hunting
     every day — which is the concrete cost of one-basis-per-state. */
  const turkey = byCode.get("IL")!.huntingHours.perSpecies!.filter((rule) => /turkey/i.test(rule.species));
  assert.equal(turkey.length, 3, "three turkey rules");
  assert.equal(new Set(turkey.map((rule) => rule.statedAs)).size, 3, "and three different windows");
  const upland = byCode.get("IL")!.huntingHours.perSpecies!.find((rule) => /pheasant/.test(rule.species))!;
  assert.equal(upland.basis, "SUNRISE_TO_SUNSET");
  assert.match(upland.note!, /NO half-hour offset/);
});

test("a defined term is resolved, and an undefined one is refused", () => {
  /* The same words in two states. Kentucky's regulations mostly state no times
     at all — they prohibit taking outside "daylight hours" — and KRS 150.010(8)
     defines that once for the chapter. Searching the species rules for "sunrise"
     finds nothing and produces a FALSE ABSENCE; a first pass nearly recorded
     Kentucky deer as having no hours rule.

     Alabama states the identical phrase and never defines it, so there is no
     numeric rule to reproduce and picking an offset would be inventing the law. */
  const kentucky = byCode.get("KY")!.huntingHours;
  assert.equal(kentucky.status, "RULE_CERTIFIED_PER_SPECIES");
  assert.equal(kentucky.rootDefinition!.term, "daylight hours");
  assert.match(kentucky.rootDefinition!.citation, /KRS 150\.010\(8\)/);
  assert.match(kentucky.detail, /FALSE ABSENCE/);

  const alabama = byCode.get("AL")!.huntingHours;
  assert.equal(alabama.status, "RULE_CERTIFIED_EXACT_CLOCK_UNAVAILABLE", "read and cited, and not computable");
  assert.equal(alabama.rootDefinition, undefined, "there is nothing to inherit");
  assert.match(alabama.detail, /UNDEFINED in the rule/);
});

test("an area override that changes the basis is named in the row", () => {
  /* Inside these areas a correctly computed solar answer is the WRONG answer,
     which is a limit on the state-level rule rather than trivia — so it belongs
     where a reader of the coverage row will see it. */
  for (const code of ["FL", "IL", "IN"]) {
    const row = byCode.get(code)!;
    assert.ok(row.huntingHours.areaOverridesChangeTheBasis, `${code} records its area overrides`);
    assert.ok(row.huntingHours.areaOverridesChangeTheBasis!.examples.length > 0, `${code} quotes at least one`);
    assert.ok(row.knownGaps.some((gap) => /Inside named areas the hours basis changes/.test(gap)),
      `${code}'s row says a state-level solar answer is wrong there`);
  }
  /* Indiana's is the one stated in BOTH time zones — noon (CT) or 1 p.m. (ET),
     one instant written twice, because the state straddles two zones. */
  assert.match(byCode.get("IN")!.huntingHours.areaOverridesChangeTheBasis!.examples[0], /noon \(CT\) or 1 p\.m\. \(ET\)/);
});

test("a state whose hours are a table is not confused with a state whose hours are per species", () => {
  /* Washington and Pennsylvania publish tables we have not transcribed; Alabama
     publishes a term with no formula. All three are RULE_CERTIFIED_EXACT_CLOCK_
     UNAVAILABLE and their details must say WHICH, because the remedies differ:
     transcribe a table, or get a definition. */
  for (const code of ["WA", "PA"]) {
    assert.equal(byCode.get(code)!.huntingHours.status, "RULE_CERTIFIED_EXACT_CLOCK_UNAVAILABLE");
    assert.equal(byCode.get(code)!.huntingHours.perSpecies, undefined);
  }
  assert.match(byCode.get("WA")!.huntingHours.detail, /SEVEN of them/);
  assert.match(byCode.get("AL")!.huntingHours.detail, /NO FORMULA AT ALL/);
});
