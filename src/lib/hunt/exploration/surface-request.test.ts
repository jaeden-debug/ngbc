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

test("in view means found ground in the VIEW, not in the box the reply covered", async () => {
  const { surfaceInView, surfacePaintsWithin } = await import("./surface-request.ts");
  const { UNSUITABLE_VALUE } = await import("./surface-paint.ts");
  /* A 1° grid from 188°W (Attu written below -180) to 150°W, 18–22°N... */
  const grid = { latStep: 1, lonStep: 1, south: 18, west: -188, rows: 5, cols: 39 };
  const at = (lon: number, lat: number) => (lat - grid.south) * grid.cols + (lon - grid.west);
  const field = (cells: Array<[number, number, number]>) => ({
    id: "s", speciesId: "species:x", continuity: "CONTINUOUS" as const, effectiveResolutionMetres: 1000, grid,
    cells: new Map(cells.map(([lon, lat, value]) => [at(lon, lat), value])),
  });
  const hawaii = field([[-157, 20, 0.6]]);
  assert.equal(surfacePaintsWithin([hawaii], { west: -146, south: 22, east: -34, north: 70 }), false);
  assert.equal(surfacePaintsWithin([hawaii], { west: -158, south: 19, east: -156, north: 21 }), true);
  /* Unsuitable is drawn as nothing; a measured zero keeps its neutral and is drawn. */
  assert.equal(surfacePaintsWithin([field([[-157, 20, UNSUITABLE_VALUE]])], { west: -158, south: 19, east: -156, north: 21 }), false);
  assert.equal(surfacePaintsWithin([field([[-157, 20, 0]])], { west: -158, south: 19, east: -156, north: 21 }), true);
  /* A cell stored at -185 (175°E) is seen by a view across 180° and by one east of it. */
  const attu = field([[-185, 20, 0.4]]);
  assert.equal(surfacePaintsWithin([attu], { west: 170, south: 18, east: -170, north: 22 }), true);
  assert.equal(surfacePaintsWithin([attu], { west: 174, south: 18, east: 176, north: 22 }), true);
  assert.equal(surfacePaintsWithin([attu], { west: -179, south: 18, east: -160, north: 22 }), false);
  /* Plots are boxes of their own rings. */
  const plots = { id: "p", speciesId: "species:x", continuity: "DISCRETE" as const, effectiveResolutionMetres: 1000, plots: [{ id: "a", score: 0.5, rings: [[[-66, 46], [-65.9, 46], [-65.9, 46.1], [-66, 46.1], [-66, 46]]] }] };
  assert.equal(surfacePaintsWithin([plots], { west: -67, south: 45, east: -65, north: 47 }), true);
  assert.equal(surfacePaintsWithin([plots], { west: -80, south: 45, east: -70, north: 47 }), false);

  /* Only a DRAWN state is reread, and it keeps its surfaces for the renderer. */
  const extent = { west: -160.2, south: 18.9, east: -154.8, north: 22.2 };
  const drawn = { speciesId: "species:x", outcome: "DRAWN" as const, surfaces: [hawaii], legend: { layers: [], emptyMeans: "range", refusals: [] }, message: null, extent };
  const missed = surfaceInView(drawn, { west: -146, south: 22, east: -34, north: 70 });
  assert.equal(missed.outcome, "NONE_IN_VIEW");
  assert.deepEqual(missed.elsewhere, extent);
  assert.equal(missed.surfaces, drawn.surfaces);
  assert.equal(surfaceInView(drawn, { west: -158, south: 19, east: -156, north: 21 }), drawn);
  assert.equal(surfaceInView(drawn, null), drawn, "no view yet: nothing is reread");
  const loading = { ...drawn, outcome: "LOADING" as const };
  assert.equal(surfaceInView(loading, { west: -146, south: 22, east: -34, north: 70 }), loading);
});

test("the ground a floating panel leaves visible is the view's right-hand share", async () => {
  const { groundRightOf, surfacePaintsWithin } = await import("./surface-request.ts");
  /* 1920 px across, the panel's right edge at 411 px: Hawaiʻi at 157°W sits
     under the panel of a view from 174°W, in the map's view and not the hunter's. */
  const view = { west: -174, south: 15, east: -6, north: 72 };
  const clear = groundRightOf(view, 411 / 1920);
  assert.ok(Math.abs(clear.west - (-174 + 168 * (411 / 1920))) < 1e-9);
  assert.equal(clear.east, -6);
  const grid = { latStep: 1, lonStep: 1, south: 18, west: -160, rows: 5, cols: 10 };
  const hawaii = { id: "s", speciesId: "species:x", continuity: "CONTINUOUS" as const, effectiveResolutionMetres: 1000, grid, cells: new Map([[2 * grid.cols + 3, 0.6]]) };
  assert.equal(surfacePaintsWithin([hawaii], view), true, "the map's view holds it");
  assert.equal(surfacePaintsWithin([hawaii], clear), false, "the hunter's does not");
  /* Across 180°: a view from 160°E to 140°W with a quarter covered starts at 175°E. */
  assert.deepEqual(groundRightOf({ west: 160, south: 50, east: -140, north: 60 }, 0.25), { west: 175, south: 50, east: -140, north: 60 });
  assert.deepEqual(groundRightOf({ west: 170, south: 50, east: -150, north: 60 }, 0.5), { west: -170, south: 50, east: -150, north: 60 });
  assert.deepEqual(groundRightOf(view, 0), view);
});
