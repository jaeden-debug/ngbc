import assert from "node:assert/strict";
import test from "node:test";
import {
  licenceHash, licencePermitsServing, licencePermitsStoredCopy, licenceRecordIsIntact, type SourceLicence,
} from "./source-licence.ts";

/**
 * The licence record is the gate between a publisher's terms and what North
 * Ground does with a dataset. These hold the four rules that make it a gate
 * rather than a comment.
 */

function licence(overrides: Partial<SourceLicence> = {}): SourceLicence {
  const statedAs = overrides.statedAs ?? "Open Government Licence – Canada";
  return {
    statedAs,
    url: "https://example.gov/dataset/terms",
    retrievedAt: "2026-09-22",
    sha256: licenceHash(statedAs),
    permittedUse: "COMMERCIAL_PERMITTED",
    attribution: "The publisher",
    ...overrides,
    ...(overrides.statedAs ? { sha256: overrides.sha256 ?? licenceHash(overrides.statedAs) } : {}),
  };
}

test("only a recorded grant permits use: silence, restriction and an absent record never do", () => {
  assert.equal(licencePermitsServing(licence({ permittedUse: "COMMERCIAL_PERMITTED" })), true);
  assert.equal(licencePermitsServing(licence({ permittedUse: "PUBLIC_DOMAIN" })), true);
  assert.equal(licencePermitsServing(licence({ permittedUse: "UNRESOLVED" })), false);
  assert.equal(licencePermitsServing(licence({ permittedUse: "RESTRICTED" })), false);
  assert.equal(licencePermitsServing(undefined), false, "a dataset with no recorded licence is never served");
});

test("using and keeping are different permissions: a live query may be allowed where a copy is not", () => {
  /* Saskatchewan's case: the item grants commercial use and the same item says
     "Not for resale", so the live service may be queried while storing and
     redistributing the file is for a person to settle. */
  const saskatchewan = licence({
    statedAs: "Saskatchewan Unrestricted Use Data Licence … Not for resale",
    permittedUse: "COMMERCIAL_PERMITTED",
    redistribution: "UNRESOLVED",
  });
  assert.equal(licencePermitsServing(saskatchewan), true, "the live service may be queried");
  assert.equal(licencePermitsStoredCopy(saskatchewan), false, "but no copy may be ingested or stored");

  // An open licence covers both.
  const ogl = licence({ redistribution: "PERMITTED" });
  assert.equal(licencePermitsServing(ogl), true);
  assert.equal(licencePermitsStoredCopy(ogl), true);

  // Absent is read as unresolved, never as permission.
  assert.equal(licencePermitsStoredCopy(licence()), false, "an unstated redistribution is not a grant");
  assert.equal(licencePermitsStoredCopy(licence({ redistribution: "PROHIBITED" })), false);
  // A copy is never permitted where the use itself is not.
  assert.equal(licencePermitsStoredCopy(licence({ permittedUse: "UNRESOLVED", redistribution: "PERMITTED" })), false);
  assert.equal(licencePermitsStoredCopy(undefined), false);
});

test("the recorded wording is hashed, so a reworded licence is a visible change", () => {
  const recorded = licence({ statedAs: "CC-BY Idaho Fish and Game" });
  assert.equal(licenceRecordIsIntact(recorded), true);
  assert.equal(recorded.sha256, licenceHash("CC-BY Idaho Fish and Game"));
  assert.match(recorded.sha256, /^sha256:[0-9a-f]{64}$/);

  // The publisher changes a word; the record no longer matches its own hash.
  assert.equal(licenceRecordIsIntact({ ...recorded, statedAs: "CC-BY-NC Idaho Fish and Game" }), false);
  // Hashing is over the exact text: whitespace is not normalised away.
  assert.notEqual(licenceHash("Open Government Licence"), licenceHash("Open Government  Licence"));
});
