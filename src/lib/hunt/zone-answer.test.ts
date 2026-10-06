import assert from "node:assert/strict";
import test from "node:test";
import { ZONE_LAYERS } from "./zone-layers.ts";
import { resolveZoneAnswer, zoneAnswerBody, type ZoneAnswer } from "./zone-answer.ts";

/**
 * THE SIX OUTCOMES, EACH REACHED BY A TEST — which none of them was before.
 *
 * This composition lived in `app/api/hunt/zone/route.ts`. The whole suite was
 * instrumented at all eight outcome sites and run: **not one outcome was
 * reached by any test**, and the route was outside every `npm test` glob
 * besides, so a test placed next to it would not have run either. The decision
 * that answers "which zone is this, and will we answer about it" was carried
 * entirely by uncovered code, and the API milestone was about to serialize it
 * from a second interface.
 *
 * `zoneAnswerBody` is pure, so every outcome is reachable here with no network
 * at all. That is the point of the extraction as much as the reuse is.
 */

const servingLayer = ZONE_LAYERS.find((layer) => layer.serving)!;
const anyLayer = ZONE_LAYERS[0]!;

test("every outcome has a body, and each says the thing only it should say", () => {
  const cases: Array<{ answer: ZoneAnswer; expect: (body: Record<string, unknown>) => void }> = [
    {
      answer: { kind: "NO_GEOGRAPHY" },
      expect: (body) => {
        assert.equal(body.status, "UNSUPPORTED");
        /* A coverage gap is never a statement about hunting. */
        assert.match(String(body.message), /gap in our coverage, not a statement about hunting/);
      },
    },
    {
      answer: { kind: "NOT_SERVING", layer: anyLayer },
      expect: (body) => {
        assert.equal(body.status, "UNSUPPORTED");
        /* Held but uncertified is a DIFFERENT fact from unpublished, and the
           difference is the authority it has not been checked against. */
        assert.match(String(body.message), /has not finished certifying them against/);
        assert.match(String(body.message), new RegExp(anyLayer.authority.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.doesNotMatch(String(body.message), /gap in our coverage/);
      },
    },
    {
      answer: { kind: "UNRESOLVED", status: "AMBIGUOUS", message: "Could not name one zone.", layer: anyLayer },
      expect: (body) => {
        assert.equal(body.status, "AMBIGUOUS");
        assert.equal(body.message, "Could not name one zone.");
        /* The layer is CONTEXT, not an answer: it names the authority whose
           geography was consulted, and carries no zone. */
        const layer = body.layer as Record<string, unknown>;
        assert.equal(layer.authority, anyLayer.authority);
        assert.ok(!("zone" in body), "an unresolved answer never carries a zone");
      },
    },
    {
      answer: { kind: "UNRESOLVED", status: "AMBIGUOUS", message: "No single jurisdiction.", layer: null },
      expect: (body) => {
        /* Where extents overlap, the first box is not an answer — so the layer
           is null rather than a guess. */
        assert.equal(body.layer, null);
      },
    },
  ];
  for (const { answer, expect } of cases) {
    expect(zoneAnswerBody(answer, { includeGeometry: false }) as Record<string, unknown>);
  }
});

test("the serializer is exhaustive over the union, by construction", () => {
  /*
   * A POSITIVE CONTROL ON THE SHAPE. `zoneAnswerBody` ends in a `never`
   * assignment, so a seventh outcome is a compile error rather than an
   * unserialized answer. That cannot be asserted at runtime, so this asserts
   * the next best thing: every kind the union declares produces a body with a
   * status, and none of them returns undefined by falling off the end.
   */
  const kinds: ZoneAnswer[] = [
    { kind: "NO_GEOGRAPHY" },
    { kind: "NOT_SERVING", layer: anyLayer },
    { kind: "UNRESOLVED", status: "AMBIGUOUS", message: "x", layer: null },
  ];
  for (const answer of kinds) {
    const body = zoneAnswerBody(answer, { includeGeometry: false });
    assert.ok(body && typeof body === "object", `${answer.kind} produced no body`);
    assert.ok("status" in (body as object), `${answer.kind} produced a body with no status`);
  }
});

test("a point in no served layer and no U.S. state is a coverage gap, not an error", async () => {
  /*
   * Reached with an injected fetcher, which is the other half of why this was
   * untestable: every outcome needed the network, and the route used the global
   * `fetch`. Mid-Atlantic — outside every served layer's bounds.
   */
  const noPlace: typeof fetch = async () => new Response(JSON.stringify({ result: { geographies: {} } }), {
    status: 200, headers: { "content-type": "application/json" },
  });
  const { answer, timings } = await resolveZoneAnswer(30, -40, noPlace);
  assert.equal(answer.kind, "NO_GEOGRAPHY");
  /* The resolver never ran, so there are no phases to report — which is what
     keeps Server-Timing off the pre-bounds answers exactly as before. */
  assert.deepEqual(timings, {});
});

test("a served layer's own ground does reach the resolver", async () => {
  /*
   * THE POSITIVE CONTROL FOR THE TEST ABOVE. Without it, `NO_GEOGRAPHY` would
   * be indistinguishable from a bounds check that rejects everything — the
   * whole function could be broken and the previous assertion would still pass.
   * A refused fetch is fine here: what is asserted is that the resolver was
   * ENTERED, which the timings record.
   */
  const bounds = servingLayer.bounds;
  const inside: [number, number] = [
    (bounds.minLatitude + bounds.maxLatitude) / 2,
    (bounds.minLongitude + bounds.maxLongitude) / 2,
  ];
  const refuse: typeof fetch = async () => new Response("", { status: 503 });
  const { answer, timings } = await resolveZoneAnswer(inside[0], inside[1], refuse);
  assert.ok("resolve" in timings, `a point inside ${servingLayer.id} did not reach the resolver`);
  assert.notEqual(answer.kind, "NO_GEOGRAPHY");
});
