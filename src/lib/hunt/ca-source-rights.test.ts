import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { sourceRightsViolations, type SourceRights } from "./source-rights.ts";

/**
 * The Canadian audit against §44's corrected model.
 *
 * The owner's point was that the classification error is systemic, not
 * American: one licence flag deciding reading, deriving and archiving together
 * hides a refusal behind an absence and an absence behind a refusal. These
 * assert the two directions stay apart in the Canadian records, and that the
 * genuine refusals are genuinely refusals.
 */

const registry = JSON.parse(
  readFileSync(join(process.cwd(), "content", "registry", "ca-source-rights.json"), "utf8"),
) as { sources: Record<string, SourceRights & { note?: string }>; notYetAudited: { jurisdictions: string[] } };

const at = (id: string) => {
  const source = registry.sources[id];
  assert.ok(source, `${id} must be in the Canadian rights registry`);
  return source;
};

test("every Canadian record satisfies the contract", () => {
  const broken: string[] = [];
  for (const [id, source] of Object.entries(registry.sources)) {
    for (const violation of sourceRightsViolations(source)) broken.push(`${id}: ${violation.rule}`);
  }
  assert.deepEqual(broken, [], "a rights record that breaks its own invariants is worse than none");
});

test("legisquebec's refused reader is not a refusal of reuse", () => {
  /*
   * THE RECORD THIS AUDIT EXISTS TO CORRECT. It was held as blocked on a
   * combination of two things: legisquebec returns 403 to our agent and 200 to
   * a browser, and its reuse terms were never located. Under the corrected
   * model neither blocks the facts, and they are separate findings.
   */
  const quebec = at("source:ca-qc-legisquebec");
  assert.equal(quebec.accessState, "PUBLIC_READABLE", "a browser reaches it; our client is the thing that was refused");
  assert.equal(quebec.reuseState, "UNSTATED", "nothing was found that refuses reuse");
  assert.equal(quebec.derivedFactsState, "USABLE", "so Québec's regulatory facts are derivable with attribution");
  assert.equal(quebec.archiveState, "UNCONFIRMED", "and storing substantial prose is still not established");
  assert.equal(quebec.retrievalMethod, "BROWSER_RENDERED");
  assert.equal(quebec.fallbacksAttempted?.length, 5, "the ordered fallbacks it fell back from");
  assert.ok((quebec.whereTermsWereLooked?.length ?? 0) >= 3, "an absence has to say where it looked");
});

test("a real refusal stays a refusal, in both provinces that have one", () => {
  /*
   * The amendment loosens nothing that was read at the authority. Both of these
   * were, and both are spatial, which §44 keeps out of the relief entirely:
   * storing a polygon is archival, not derivation.
   */
  for (const id of ["source:ca-qc-tfs", "source:ca-bc-wildlife-species-inventory"]) {
    const source = at(id);
    assert.equal(source.termsStatus, "READ", `${id} was read at the authority, not inferred`);
    assert.equal(source.reuseState, "REFUSED");
    assert.equal(source.archiveState, "PROHIBITED");
    assert.equal(source.derivedFactsState, "BLOCKED");
    assert.ok(source.termsUrl, `${id} must cite the licence it was refused by`);
  }
});

test("British Columbia's boundaries are open while its animal surveys are not", () => {
  /*
   * The contrast is the argument for the whole model: one flag for "British
   * Columbia" could not have said this, and it is why Hunt draws BC's zones
   * while holding none of its survey data.
   */
  const units = at("source:ca-bc-wildlife-management-units");
  const surveys = at("source:ca-bc-wildlife-species-inventory");
  assert.equal(units.reuseState, "CONDITIONAL");
  assert.equal(units.archiveState, "PERMITTED");
  assert.equal(surveys.reuseState, "REFUSED");
  assert.notEqual(units.termsUrl, surveys.termsUrl, "two licences, read separately");
});

test("Manitoba stopped being terms-unstated because the terms were read", () => {
  const guide = at("source:ca-mb-hunting-guide-2026");
  assert.equal(guide.termsStatus, "READ");
  assert.equal(guide.reuseState, "CONDITIONAL", "OpenMB permits commercial reuse, with carve-outs");
  assert.equal(guide.archiveState, "PERMITTED");
  assert.match(guide.termsUrl ?? "", /gov\.mb\.ca/);
});

test("what has not been audited is recorded as a gap, not left to look audited", () => {
  /*
   * Six served jurisdictions whose terms nobody has read. An absent record and
   * a checked one must not look alike, which is the same distinction the
   * time-basis sweep draws between VERIFIED and ASSERTED.
   */
  assert.deepEqual(registry.notYetAudited.jurisdictions.sort(), [
    "jurisdiction:ca-nb", "jurisdiction:ca-nl", "jurisdiction:ca-ns",
    "jurisdiction:ca-pe", "jurisdiction:ca-sk", "jurisdiction:ca-yt",
  ]);
  for (const jurisdiction of registry.notYetAudited.jurisdictions) {
    const recorded = Object.values(registry.sources).some((source) => source.sourceId.includes(jurisdiction.replace("jurisdiction:", "")));
    assert.equal(recorded, false, `${jurisdiction} is listed as unaudited and must not also carry a record`);
  }
});

test("every record explains itself to the next reader", () => {
  for (const [id, source] of Object.entries(registry.sources)) {
    assert.ok((source.note?.length ?? 0) > 60, `${id} must say why its states are what they are`);
    assert.match(source.lastVerified, /^\d{4}-\d{2}-\d{2}$/);
  }
});
