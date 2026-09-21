import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { supersedeQuery } from "./publish-regulations.mjs";

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
