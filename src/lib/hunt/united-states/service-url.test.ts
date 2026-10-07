import assert from "node:assert/strict";
import test from "node:test";
import findings from "../../../../content/registry/us-map-licence-findings.json" with { type: "json" };

/**
 * A RECORDED SERVICE URL MUST BE FETCHABLE, OR IT IS NOT PROVENANCE.
 *
 * Ten findings recorded the authority's service with its organisation id
 * replaced by "..." — `https://services1.arcgis.com/.../Deer_Turkey_Management_
 * Zones/FeatureServer/0`. The row looks complete: there is a URL, it names the
 * right service, and nothing in the registry says it cannot be dereferenced. It
 * was found only when Connecticut's was needed and could not be used.
 *
 * §16 requires the service URL among a capability's provenance and §17 names a
 * missing source URL as a failure mode to validate. An unusable one is the same
 * defect wearing a URL.
 *
 * The set is recorded with its exact membership rather than tolerated, so a NEW
 * elided URL fails here instead of joining nine others unnoticed.
 */

interface Finding { state: string; geography?: { service?: string } }
const ALL = (findings as { findings: Finding[] }).findings;

/** The ten found on 2026-10-07, each with its disposition recorded in the registry. */
const KNOWN_ELIDED = ["CA", "CT", "GA", "KS", "NC", "OK", "TN", "TX", "VT", "WV"];

test("a finding's recorded service URL is dereferenceable, or it is a known one", () => {
  const elided = ALL.filter((f) => (f.geography?.service ?? "").includes("..."))
    .map((f) => f.state).sort();
  /* The positive control: an empty sweep and a clean one are the same output. */
  assert.ok(ALL.length >= 40, `only ${ALL.length} findings read, so this may be checking nothing`);
  assert.deepEqual(elided, KNOWN_ELIDED,
    "a service URL was recorded with its organisation id elided; record the real endpoint, or add it to the registry's elidedServiceUrls with why it could not be recovered");
});

test("every finding records a service URL at all", () => {
  const missing = ALL.filter((f) => !f.geography?.service).map((f) => f.state);
  assert.deepEqual(missing, [], "a finding names a geography with no service URL");
});

test("each recovered URL is complete, and each unrecovered one says why", () => {
  /*
   * The recovery is only worth recording if it is checkable. A recovered entry
   * must carry a real endpoint and whether its account is organisational —
   * because a title match is not a publisher match, and searching West
   * Virginia's service name returns a private council of governments serving
   * TEXAS Parks and Wildlife data with a plausible licence attached.
   */
  const block = (findings as { elidedServiceUrls?: {
    recovered: Record<string, { service: string; owner: string; organisationAccount: boolean; confidence: string }>;
    notRecovered: Record<string, string>;
  } }).elidedServiceUrls;
  assert.ok(block, "the registry must record what became of each elided URL");

  const accounted = [...Object.keys(block!.recovered), ...Object.keys(block!.notRecovered)].sort();
  assert.deepEqual(accounted, KNOWN_ELIDED, "every elided URL is either recovered or has a stated reason it was not");

  for (const [code, r] of Object.entries(block!.recovered)) {
    assert.match(r.service, /^https:\/\/[^/]+\/.+\/(Feature|Map)Server\/\d+$/, `${code}: not a complete layer endpoint`);
    assert.ok(!r.service.includes("..."), `${code}: still elided`);
    assert.ok(r.owner.length > 0, `${code}: must name the owning account`);
    assert.equal(typeof r.organisationAccount, "boolean", `${code}: must say whether the account is organisational`);
    assert.ok(r.confidence.length > 10, `${code}: must state how far it is trusted`);
  }
  for (const [code, why] of Object.entries(block!.notRecovered)) {
    assert.ok(why.length > 30, `${code}: "not recovered" needs a reason, not a shrug`);
  }
});
