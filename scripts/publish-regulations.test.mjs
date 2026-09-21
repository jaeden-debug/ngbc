import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectivePeriod, ruleColumns, supersedeQuery } from "./publish-regulations.mjs";

/**
 * What a bundle may retire.
 *
 * This exists because of a real incident: the supersede sweep was scoped to the
 * whole jurisdiction, which is indistinguishable from correct while one bundle
 * exists. The moment a second one was published it retired all 11 small-game
 * rules, and publishing small game would then have retired all 135 major-game
 * rules — each run silently undoing the last.
 */

const JURISDICTION = "1111-aaaa";
const DEER = "2222-bbbb";
const TURKEY = "3333-cccc";

describe("the rules a bundle may supersede", () => {
  it("is scoped to the sources the bundle was built from", () => {
    const query = supersedeQuery(JURISDICTION, [DEER, TURKEY]);
    assert.match(query, new RegExp(`source_id=in\\.\\(${DEER},${TURKEY}\\)`));
  });

  it("is never the whole jurisdiction", () => {
    // A query filtered only by jurisdiction would sweep up every other bundle's
    // rules. If this assertion ever has to be relaxed, that is the bug.
    const query = supersedeQuery(JURISDICTION, [DEER]);
    assert.ok(query.includes("source_id=in."), "an unscoped sweep retires other bundles' rules");
  });

  it("still limits itself to the jurisdiction and to live rules", () => {
    const query = supersedeQuery(JURISDICTION, [DEER]);
    assert.match(query, new RegExp(`jurisdiction_id=eq\\.${JURISDICTION}`));
    assert.match(query, /review_status=in\.\(VERIFIED,PUBLISHED\)/);
  });

  it("refuses to run at all when it has no source to scope by", () => {
    // An empty list would render `source_id=in.()`, which PostgREST rejects or —
    // worse, on a different filter syntax — matches everything.
    assert.throws(() => supersedeQuery(JURISDICTION, []), /no source to scope by/);
  });
});

describe("the period a rule is stored as in force", () => {
  const bundle = { certifiedPeriod: { from: "2026-01-01", to: "2027-12-31" } };
  const rule = (extra) => ({ id: "regulatory_rule:ca-qc-moose-2026-x", speciesId: "species:moose", seasonPhrase: "Du 26 septembre au 12 octobre 2026", ...extra });

  it("takes a rule's own year over the bundle's period, so two published years stay two rules", () => {
    assert.deepEqual(effectivePeriod(bundle, rule({ effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" })), { from: "2026-01-01", to: "2026-12-31" });
    assert.deepEqual(effectivePeriod(bundle, rule({ effectiveFrom: "2027-01-01", effectiveTo: "2027-12-31" })), { from: "2027-01-01", to: "2027-12-31" });
    const columns = ruleColumns(bundle, rule({ effectiveFrom: "2027-01-01", effectiveTo: "2027-12-31", sourceVersion: "2027", reviewStatus: "VERIFIED" }));
    assert.equal(columns.effective_from, "2027-01-01");
    assert.equal(columns.effective_to, "2027-12-31");
  });

  it("keeps the bundle's certified period for rules that state none, exactly as before", () => {
    assert.deepEqual(effectivePeriod(bundle, rule({})), { from: "2026-01-01", to: "2027-12-31" });
    assert.deepEqual(effectivePeriod({}, rule({ sourceYear: 2026 })), { from: "2026-01-01", to: null });
  });

  it("refuses a rule that ends before it begins, or states no period at all", () => {
    assert.throws(() => effectivePeriod(bundle, rule({ effectiveFrom: "2027-01-01", effectiveTo: "2026-12-31" })), /ends/);
    assert.throws(() => effectivePeriod({}, rule({})), /states no source year/);
  });
});
