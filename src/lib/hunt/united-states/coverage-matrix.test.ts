import assert from "node:assert/strict";
import test from "node:test";
import { enquiryState, unitedStatesCoverageMatrix } from "./coverage-matrix.ts";

test("all 50 states and D.C. have one explicit production row with official sources", () => {
  const rows = unitedStatesCoverageMatrix();
  assert.equal(rows.length, 51);
  assert.equal(new Set(rows.map((row) => row.code)).size, 51);
  for (const row of rows) {
    assert.match(row.authority.url, /^https:\/\//);
    assert.match(row.regulationsSource.url, /^https:\/\//);
    assert.ok(row.managementGeography.length > 0);
    assert.ok(row.knownGaps.length > 0);
  }
});

test("production status follows the actual serving path, not research depth", () => {
  const byCode = new Map(unitedStatesCoverageMatrix().map((row) => [row.code, row]));
  assert.equal(byCode.get("ID")!.productionStatus, "PARTIAL");
  /* Promoted 2026-09-30, on purpose. Idaho's clock is now computed for every
     CERTIFIED unit: 49 CFR § 71.9(a) runs the mountain/Pacific line along the
     Idaho County / Lemhi County boundary and then the main channel of the Salmon
     River, and Idaho County's own TIGERweb polygon used as a spatial filter
     against IDFG's GMU service shows 22 units intersecting it with NONE of the
     42 certified units among them. It stays PARTIAL rather than COMPLETE because
     one species of a 99-unit system is not a complete state. */
  assert.equal(byCode.get("ID")!.huntingHours.status, "CERTIFIED_EXACT_POINT");
  /* The scope is the load-bearing half: a clock for SOME units is not a clock
     for the state, and the record must say which. */
  assert.match(byCode.get("ID")!.huntingHours.detail, /every CERTIFIED unit/);
  assert.equal(byCode.get("ID")!.readyToHunt, "PARTIAL");
  assert.equal(byCode.get("MT")!.productionStatus, "REGULATIONS_ONLY");
  /* Wyoming's elk bundle has no law-first cases (regulations PARTIAL) and its
     layer does not serve: nothing reaches a hunter, so production is never
     PARTIAL above a state like Colorado whose rules are fully certified. */
  assert.equal(byCode.get("WY")!.regulations.status, "PARTIAL");
  assert.equal(byCode.get("WY")!.productionStatus, "REGULATIONS_ONLY");
  assert.equal(byCode.get("MT")!.huntingHours.status, "CERTIFIED_EXACT_POINT");
  assert.equal(byCode.get("ID")!.regulationsSource.verificationStatus, "CERTIFIED");
  assert.equal(byCode.get("ID")!.boundarySource?.verificationStatus, "CERTIFIED_PARITY");
  assert.ok(!byCode.get("ID")!.knownGaps.some((gap) => gap.startsWith("No geometry ingested")));
  assert.equal(byCode.get("MT")!.regulationsSource.verificationStatus, "CERTIFIED");
  assert.equal(byCode.get("MT")!.boundarySource?.verificationStatus, "CERTIFIED_PARITY");
  assert.ok(!byCode.get("MT")!.knownGaps.some((gap) => gap.startsWith("No geometry ingested")));
  assert.equal(byCode.get("AK")!.productionStatus, "UNSUPPORTED");
  assert.equal(byCode.get("HI")!.productionStatus, "UNSUPPORTED");
});

test("no state can silently claim complete before the full path is represented", () => {
  assert.deepEqual(unitedStatesCoverageMatrix().filter((row) => row.productionStatus === "COMPLETE"), []);
});

/* ── How far anyone has got with each jurisdiction's geography ───────────── */

test("the matrix distinguishes a measured dead end from a jurisdiction nobody examined", () => {
  /*
   * THE DEFECT THIS FIXES. 44 of 51 rows read productionStatus "UNSUPPORTED",
   * and nothing in the row separated Alabama — whose authority was measured and
   * found to publish no season geography at all — from a state nobody had
   * looked at. A matrix generated from repository truth passed its own
   * validation and still erased that difference, which is §16's failure in its
   * most plausible dress: the report looks complete.
   */
  const rows = unitedStatesCoverageMatrix();
  const unsupported = rows.filter((row) => row.productionStatus === "UNSUPPORTED");
  assert.ok(unsupported.length > 20, `only ${unsupported.length} UNSUPPORTED rows, so this measures nothing`);
  const states = new Set(unsupported.map((row) => row.geography.enquiry));
  assert.ok(states.size > 1,
    `every UNSUPPORTED row reports the same enquiry state (${[...states]}), so the matrix still cannot tell them apart`);
});

test("every row says what answers its geography and how far anyone got", () => {
  for (const row of unitedStatesCoverageMatrix()) {
    const { strategy, enquiry, because, evidence } = row.geography;
    assert.ok(because.length > 40, `${row.code}: a strategy needs a reason`);
    assert.ok(evidence.length > 20, `${row.code}: a strategy needs evidence`);
    assert.ok(["ANSWERING", "MEASURED_AND_HELD", "LICENCE_MEASURED", "NOT_EXAMINED"].includes(enquiry));
    /* The two cannot disagree: a declared strategy IS the top rung. */
    assert.equal(enquiry === "ANSWERING", strategy !== "UNDECLARED",
      `${row.code}: strategy ${strategy} and enquiry ${enquiry} contradict each other`);
  }
});

test("the measured counts are what we think, and the held states name their reason", () => {
  const rows = unitedStatesCoverageMatrix();
  const by = (state: string) => rows.filter((row) => row.geography.enquiry === state).map((row) => row.code).sort();
  /* Grows as jurisdictions earn a strategy; the list is pinned so it can only
     move deliberately, which is what caught Missouri joining it. */
  assert.deepEqual(by("ANSWERING"), ["GA", "IA", "ID", "KY", "LA", "MA", "MO", "SC", "VA", "WV"]);
  assert.deepEqual(by("MEASURED_AND_HELD"), ["AL", "CT", "IL", "MS", "UT"]);
  assert.equal(by("LICENCE_MEASURED").length, 36);
  /* Every held state records WHAT was measured, not merely that it was. */
  for (const row of rows.filter((r) => r.geography.enquiry === "MEASURED_AND_HELD")) {
    assert.ok((row.geography.disposition ?? "").length > 8, `${row.code}: a held state names its disposition`);
  }
});

test("NOT_EXAMINED is empty today, and the rung still works — proved on a code nobody has examined", () => {
  /*
   * The rung is currently unexercised: every U.S. jurisdiction has had its
   * publisher's terms looked for, so no row reports NOT_EXAMINED. An
   * unexercised rung is exactly the vacuous check that bit me on the composed-
   * unit lookup order, so the function is tested directly on a code that is in
   * neither register.
   *
   * It also matters that the rung exists rather than being dropped: a
   * jurisdiction added tomorrow must arrive as NOT_EXAMINED rather than
   * inheriting a reassuring default.
   */
  const rows = unitedStatesCoverageMatrix();
  assert.deepEqual(rows.filter((row) => row.geography.enquiry === "NOT_EXAMINED").map((row) => row.code), []);
  assert.equal(enquiryState("ZZ", "UNDECLARED"), "NOT_EXAMINED");
  /* And a declared strategy outranks the registers, for any code. */
  assert.equal(enquiryState("ZZ", "ADMINISTRATIVE_COMPOSITION"), "ANSWERING");
});
