import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStoredHuntBrief } from "./model.ts";
import { huntBriefFixture } from "./test-fixture.ts";

/**
 * A Hunt Brief is a SAVED artefact, and versions 1 to 4 are readable — so
 * briefs written before the rename exist on people's devices carrying
 * "UNKNOWN".
 *
 * The validator THROWS on an unsupported status rather than degrading, so
 * renaming without accepting the old word would not have shown a hunter a
 * stale term: it would have made their saved brief UNOPENABLE. That failure is
 * invisible to a type check, which is why it is tested here.
 *
 * The first version of this file asked the shared fixture for an
 * authorization. The fixture has none, so every case returned early and all
 * three passed WITHOUT EXERCISING ANYTHING. A test that passes by doing
 * nothing is worse than no test, because it reports the guarantee it does not
 * check — so the brief is built here instead, and one case asserts the rename
 * would be caught if the compatibility were removed.
 */

function storedWith(status: string): Record<string, unknown> {
  const brief = JSON.parse(JSON.stringify(huntBriefFixture())) as Record<string, unknown>;
  brief.readiness = {
    coverage: "VERIFIED",
    jurisdictionName: "Ontario",
    legalMethods: ["Shotgun"],
    authorizations: [{ status, name: "Small game licence", authority: "The ministry" }],
  };
  return brief;
}

/** The parsed brief, whatever shape the result wrapper takes. */
function authorizationStatus(value: unknown): string | undefined {
  const result = parseStoredHuntBrief(value) as
    | { status?: string; brief?: { readiness?: { authorizations?: Array<{ status?: string }> } } }
    | undefined;
  if (result?.status === "invalid") return undefined;
  return result?.brief?.readiness?.authorizations?.[0]?.status;
}

describe("a brief written before the rename still opens", () => {
  it("proves the case is exercised, so the assertions below mean something", () => {
    /* The brief must PARSE with a valid status, or every assertion below would
       pass on a rejected brief and prove nothing — which is the second version
       of the vacuum this file was rewritten to escape. */
    assert.equal(authorizationStatus(storedWith("NOT_CERTIFIED")), "NOT_CERTIFIED");
  });

  it("accepts the retired word and carries it forward under the current one", () => {
    assert.equal(authorizationStatus(storedWith("UNKNOWN")), "NOT_CERTIFIED");
  });

  it("accepts the current word unchanged", () => {
    assert.equal(authorizationStatus(storedWith("NOT_CERTIFIED")), "NOT_CERTIFIED");
  });

  it("still refuses a word that was never valid", () => {
    /* Back-compatibility is for retired words, not for anything at all. */
    assert.equal(authorizationStatus(storedWith("PROBABLY")), undefined);
  });
});
