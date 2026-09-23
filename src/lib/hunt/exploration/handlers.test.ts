import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter } from "../../newsletter/rate-limit.ts";
import { createOverlayHandler, createZoneStatusHandler, createZoneSummaryHandler } from "./handlers.ts";
import { clearOverlayGeometryCache, overlayLayersFor } from "./overlay-layers.ts";
import { layerById } from "../zone-layers.ts";

/* A layer that is registered but not served must be refused. Québec is served
   now, so that guarantee is exercised by switching it off for the check. */
async function whileQuebecUnserved<T>(check: () => Promise<T>): Promise<T> {
  const quebec = layerById("layer:ca-qc-zone-chasse")!;
  const was = quebec.serving;
  quebec.serving = false;
  try { return await check(); } finally { quebec.serving = was; }
}

const open = () => createRateLimiter({ limit: 1_000, windowMs: 60_000 });
const ORIGIN = "https://www.northgroundbushcraft.com";

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/hunt/zone-status`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: JSON.stringify(body),
  });
}

test("zone summary: a served layer, a designation and a calendar day, nothing else", async () => {
  const GET = createZoneSummaryHandler({ limiter: open() });
  const ok = await GET(new Request(`${ORIGIN}/api/hunt/zone-summary?layer=layer:ca-mb-gha&zone=26&date=2026-09-21`));
  assert.equal(ok.status, 200);
  const payload = await ok.json() as { status: string; summary: { zone: { label: string } } };
  assert.equal(payload.summary.zone.label, "GHA 26");

  await whileQuebecUnserved(async () => {
    const response = await GET(new Request(`${ORIGIN}/api/hunt/zone-summary?layer=layer:ca-qc-zone-chasse&zone=10E&date=2026-09-21`));
    assert.equal(response.status, 400, "an unserved layer");
  });
  for (const query of [
    "layer=layer:ca-on-wmu&zone=57&date=2026-02-30",
    "layer=layer:ca-on-wmu&zone=<script>&date=2026-09-21",
    "layer=layer:ca-on-wmu&date=2026-09-21",
  ]) {
    const response = await GET(new Request(`${ORIGIN}/api/hunt/zone-summary?${query}`));
    assert.equal(response.status, 400, query);
  }
});

test("zone status: rejects what it cannot answer rather than guessing", async () => {
  const POST = createZoneStatusHandler({ limiter: open(), canonicalOrigin: ORIGIN });
  const ok = await POST(post({ speciesId: "species:ruffed-grouse", date: "2026-09-21", zones: [{ layerId: "layer:ca-on-wmu", designation: "57" }] }));
  assert.equal(ok.status, 200);
  const payload = await ok.json() as { states: Array<{ state: string }> };
  assert.equal(payload.states[0].state, "SEASON_AVAILABLE");

  /*
   * An UNCERTIFIED species is refused. Gray wolf, not mallard: mallard became
   * answerable when the federal migratory rules landed, and a test that uses a
   * species as its example of "not certified" silently stops testing anything
   * the day that species IS certified.
   */
  assert.equal((await POST(post({ speciesId: "species:gray-wolf", date: "2026-09-21", zones: [{ layerId: "layer:ca-on-wmu", designation: "57" }] }))).status, 400);
  /* An empty zone list is NOT an error — it asks about nothing and is answered
     with nothing. The original 400 here came from the species, not the list. */
  assert.equal((await POST(post({ speciesId: "species:ruffed-grouse", date: "2026-09-21", zones: [] }))).status, 200);
  await whileQuebecUnserved(async () => {
    assert.equal((await POST(post({ speciesId: "species:ruffed-grouse", date: "2026-09-21", zones: [{ layerId: "layer:ca-qc-zone-chasse", designation: "10E" }] }))).status, 400);
  });
  const tooMany = Array.from({ length: 451 }, (_, index) => ({ layerId: "layer:ca-on-wmu", designation: String(index) }));
  assert.equal((await POST(post({ speciesId: "species:ruffed-grouse", date: "2026-09-21", zones: tooMany }))).status, 400);
  assert.equal((await POST(post({ speciesId: "species:ruffed-grouse", date: "2026-09-21", zones: [] }, { origin: "https://evil.example" }))).status, 403);
});

test("overlays: only the authority layers North Ground reads, with their standing", async () => {
  const manitoba = overlayLayersFor({ west: -100, south: 49, east: -96, north: 51 });
  assert.deepEqual(manitoba.map((layer) => layer.name).sort(), ["Lands closed to hunting", "Special conservation areas", "Wildlife management areas", "Wildlife refuges"]);
  assert.ok(manitoba.every((layer) => /written regulation controls/.test(layer.standing)));
  assert.deepEqual(overlayLayersFor({ west: -120, south: 49, east: -115, north: 52 }), [], "Alberta publishes no such layer here, so none is offered");
});

test("overlays: an outage draws nothing and says so", async () => {
  clearOverlayGeometryCache();
  const GET = createOverlayHandler({ limiter: open(), fetcher: (async () => new Response("down", { status: 503 })) as typeof fetch });
  const response = await GET(new Request(`${ORIGIN}/api/hunt/overlays?layer=overlay:ca-mb-refuges&bounds=-100,49,-96,51&zoom=8`));
  const payload = await response.json() as { status: string; features: unknown[]; message: string };
  assert.equal(payload.status, "PROVIDER_ERROR");
  assert.deepEqual(payload.features, []);
  assert.match(payload.message, /Nothing is drawn in its place/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("overlays: features are named from the catalogue, and an unread feature is kept, not dropped", async () => {
  clearOverlayGeometryCache();
  const square = { type: "Polygon", coordinates: [[[-97.5, 49.5], [-97.4, 49.5], [-97.4, 49.6], [-97.5, 49.6], [-97.5, 49.5]]] };
  const fetcher = (async () => new Response(JSON.stringify({
    type: "FeatureCollection",
    features: [{ id: 1, properties: { OBJECTID: 1 }, geometry: square }, { id: 99_999, properties: { OBJECTID: 99_999 }, geometry: square }],
  }), { status: 200 })) as typeof fetch;
  const GET = createOverlayHandler({ limiter: open(), fetcher });
  const response = await GET(new Request(`${ORIGIN}/api/hunt/overlays?layer=overlay:ca-mb-refuges&bounds=-98,49,-97,50&zoom=9`));
  const payload = await response.json() as { features: Array<{ name: string; statedAs: string }> };
  assert.equal(payload.features[0].name, "Harry Cox");
  assert.equal(payload.features[1].name, "An area North Ground has not read");
  assert.match(payload.features[1].statedAs, /Check the authority's own record/);
});
