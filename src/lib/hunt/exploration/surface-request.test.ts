import assert from "node:assert/strict";
import test from "node:test";
import { notDrawnExplanation } from "./surface-request.ts";

test("a species with nothing drawn and nothing to say defers, rather than printing an empty line", () => {
  /*
   * THE MEASURED CASE. `species:moose` returns HTTP 200 with `surfaces: []`,
   * no refusals and `emptyMeans: ""`. That classifies as NONE_IN_VIEW, and the
   * legend branch for it ran FIRST — so it rendered an empty paragraph under
   * "Where to look for the animal" and hid the branch that says North Ground
   * holds zone-level figures which cannot be painted as heat.
   *
   * 1,093 moose records, 1,264 American black bear, 962 white-tailed deer. §41B:
   * a layer that cannot paint explains why, because a blank map reads to a
   * hunter as "there are no animals here".
   */
  assert.equal(
    notDrawnExplanation({ outcome: "NONE_IN_VIEW", message: null, legend: { layers: [], emptyMeans: "", refusals: [] } }),
    null,
    "with nothing to say it must defer to the branch that knows about zone-level evidence",
  );

  /* When the server DOES have a sentence, it is used verbatim rather than
     replaced by one of ours. */
  assert.equal(
    notDrawnExplanation({ outcome: "NONE_IN_VIEW", message: "The box asked for is too large to answer.", legend: null }),
    "The box asked for is too large to answer.",
  );
  assert.equal(
    notDrawnExplanation({ outcome: "NONE_IN_VIEW", message: null, legend: { layers: [], emptyMeans: "No plots were flown here.", refusals: [] } }),
    "No plots were flown here.",
  );

  /* A failure always says something: silence after an error is the one case a
     hunter would read as an answer about the animals. */
  assert.equal(
    notDrawnExplanation({ outcome: "UNAVAILABLE", message: "The species layer could not be loaded.", legend: null }),
    "The species layer could not be loaded.",
  );

  /* And it never speaks over a surface that IS drawn. */
  assert.equal(notDrawnExplanation({ outcome: "DRAWN", message: "ignored", legend: null }), null);
  assert.equal(notDrawnExplanation({ outcome: "LOADING", message: "ignored", legend: null }), null);
  assert.equal(notDrawnExplanation(null), null);
});
