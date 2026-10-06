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

test("a reply that misses the view carries where the map is, and only a real box", async () => {
  const { surfaceStateFromReply } = await import("./surface-request.ts");
  const reply = (elsewhere: unknown, speciesId = "species:zebra-dove") => ({ speciesId, surfaces: [], refusals: [], emptyMeans: "elsewhere", elsewhere }) as never;
  const kept = surfaceStateFromReply("species:zebra-dove", "species:zebra-dove", 200, reply({ west: -160.2, south: 18.9, east: -154.8, north: 22.2 }));
  assert.equal(kept?.outcome, "NONE_IN_VIEW");
  assert.deepEqual(kept?.elsewhere, { west: -160.2, south: 18.9, east: -154.8, north: 22.2 });
  /* A range across the antimeridian is written below -180, and is still a box. */
  assert.deepEqual(surfaceStateFromReply("species:emperor-goose", "species:emperor-goose", 200, reply({ west: -187.4, south: 51, east: -141, north: 72 }, "species:emperor-goose"))?.elsewhere, { west: -187.4, south: 51, east: -141, north: 72 });
  for (const bad of [null, undefined, { west: "a", south: 1, east: 2, north: 3 }, { west: 10, south: 50, east: 5, north: 60 }, { west: 0, south: 80, east: 5, north: 95 }]) {
    assert.equal(surfaceStateFromReply("species:zebra-dove", "species:zebra-dove", 200, reply(bad))?.elsewhere ?? null, null, JSON.stringify(bad));
  }
});
