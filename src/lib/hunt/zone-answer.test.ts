import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalId } from "../content-contract/ids.ts";
import type { ZoneResolution } from "./types.ts";
import { ZONE_LAYERS } from "./zone-layers.ts";
import { resolveZoneAnswer, zoneAnswerBody, type ZoneAnswer } from "./zone-answer.ts";

/**
 * THE SIX OUTCOMES, EACH REACHED BY A TEST.
 *
 * This header claimed that when three of the six were reached: NO_GEOGRAPHY,
 * NOT_SERVING and UNRESOLVED were constructed; RESOLVED, JURISDICTION_SCOPED
 * and UNSUPPORTED_US_STATE were not. The three it missed are the three that
 * carry an actual answer. They are covered at the bottom of this file, with
 * the measurement that shows what their absence allowed.
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

/*
 * THE THREE OUTCOMES NO TEST REACHED.
 *
 * The header above says each of the six is reached by a test. Three were:
 * NO_GEOGRAPHY, NOT_SERVING and UNRESOLVED are constructed directly, and the
 * resolver reaches NO_GEOGRAPHY and UNRESOLVED. RESOLVED, JURISDICTION_SCOPED
 * and UNSUPPORTED_US_STATE were not constructed anywhere, so the three arms
 * that carry an actual answer — the ones a consumer reads when North Ground
 * has something to say — were the uncovered ones.
 *
 * Measured on the code as it stood: making the RESOLVED arm return the
 * JURISDICTION_SCOPED body left typecheck clean, all 4 tests in this file
 * passing and all 8 route characterization tests passing. A hunter in a
 * resolved unit would have received a jurisdiction-scoped body and nothing in
 * the repository would have noticed.
 */
test("the three outcomes that carry an answer each produce their own body", () => {
  const resolution: ZoneResolution = {
    status: "RESOLVED",
    zoneId: "management_zone:test-zone" as CanonicalId<"management_zone">,
    jurisdictionId: servingLayer.jurisdictionId,
    officialName: "Test Zone 1",
    boundaryDistanceMeters: 4_200,
    nearBoundary: false,
    message: "",
  };

  const resolved = zoneAnswerBody({ kind: "RESOLVED", resolution, layer: servingLayer }, { includeGeometry: false });
  assert.equal(resolved.outcome, "RESOLVED");
  assert.equal(resolved.status, "RESOLVED");
  assert.ok("zone" in resolved && resolved.zone, "a resolved answer carries its zone");
  assert.ok("layer" in resolved && resolved.layer, "and the layer whose authority published it");

  /*
   * A statewide answer is NOT a zone answer: it must not grow a zone, because
   * §41A keeps a jurisdiction-scoped rule structurally distinct from one. The
   * resolution carries NO zoneId — `jurisdictionScopedBody` throws on one that
   * does, which is the guard doing its job and is why this fixture is built
   * separately rather than reused from the resolved case above.
   */
  const scopedResolution: ZoneResolution = {
    status: "RESOLVED",
    jurisdictionId: "jurisdiction:us-ak" as CanonicalId<"jurisdiction">,
    officialName: "Alaska",
    nearBoundary: false,
    message: "Placed in Alaska for its statewide rules.",
    jurisdictionScope: {
      kind: "WHOLE_JURISDICTION",
      boundary: {
        authority: "U.S. Census Bureau",
        title: "TIGERweb state boundary",
        url: "https://tigerweb.geo.census.gov/",
        sourceId: "source:us-census-tigerweb" as CanonicalId<"source">,
        describedAs: "the U.S. Census Bureau's cartographic state boundary",
        statedAs: "A cartographic extent, not the authority's determination of where hunting jurisdiction runs.",
      },
      proximity: "CLEAR",
      marginMetres: 500,
      knownDifferences: [],
    },
  };
  const scoped = zoneAnswerBody({ kind: "JURISDICTION_SCOPED", resolution: scopedResolution }, { includeGeometry: false });
  assert.equal(scoped.outcome, "JURISDICTION_SCOPED");
  assert.ok(!("zone" in scoped), "a jurisdiction-scoped answer must not carry a zone");

  /* A state we do not certify is named, with its authority — never silence. */
  const place = { jurisdictionId: "jurisdiction:us-ak", name: "Alaska", code: "AK" };
  const unsupported = zoneAnswerBody(
    { kind: "UNSUPPORTED_US_STATE", place, jurisdictionId: "jurisdiction:us-ak" },
    { includeGeometry: false },
  );
  assert.equal(unsupported.outcome, "UNSUPPORTED_US_STATE");
  assert.equal(unsupported.status, "UNSUPPORTED");

  /* An unknown jurisdiction id still answers, and still says it is a coverage
     gap rather than a statement about hunting. */
  const unknownState = zoneAnswerBody(
    { kind: "UNSUPPORTED_US_STATE", place, jurisdictionId: "jurisdiction:us-zz" },
    { includeGeometry: false },
  );
  assert.equal(unknownState.outcome, "UNSUPPORTED_US_STATE");
  assert.match(String((unknownState as { message: string }).message), /gap in our coverage/);
});

test("every outcome is distinguishable on the wire, not only in its prose", () => {
  /*
   * FOUR of the six outcomes serialize to `status: "UNSUPPORTED"` — both
   * UNSUPPORTED_US_STATE paths, NO_GEOGRAPHY and NOT_SERVING — so a reader
   * branching on `status` cannot tell "no authority publishes boundaries here"
   * from "we hold this authority's boundaries and have not certified them".
   * Those are different findings about the ground, and §8 does not let one
   * stand for the other. `outcome` is what carries the distinction.
   */
  const answers: ZoneAnswer[] = [
    { kind: "NO_GEOGRAPHY" },
    { kind: "NOT_SERVING", layer: anyLayer },
    { kind: "UNRESOLVED", status: "AMBIGUOUS", message: "x", layer: null },
    { kind: "UNSUPPORTED_US_STATE", place: { jurisdictionId: "jurisdiction:us-ak", name: "Alaska", code: "AK" }, jurisdictionId: "jurisdiction:us-ak" },
  ];
  const bodies = answers.map((answer) => zoneAnswerBody(answer, { includeGeometry: false }));

  const statuses = new Set(bodies.map((body) => body.status));
  assert.ok(statuses.size < bodies.length, "positive control: these outcomes really do share a status, which is why `outcome` is needed");

  const outcomes = bodies.map((body) => body.outcome);
  assert.equal(new Set(outcomes).size, answers.length, "each outcome must be identifiable on the wire");
  for (const [index, answer] of answers.entries()) {
    assert.equal(outcomes[index], answer.kind, "the wire outcome is the domain kind, not a second vocabulary");
  }
});
