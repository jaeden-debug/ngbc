import assert from "node:assert/strict";
import { test } from "node:test";
import { partitionEvaluationSources } from "./source-roles.ts";

const source = (id: string) => ({ id, title: id, url: `https://example.org/${id}`, publisher: "p", type: "official" }) as never;

test("only the rules' and the boundary's sources are the answer's authority", () => {
  const { authority, context } = partitionEvaluationSources({
    sources: [source("source:ca-qc-orignal-2026-2027"), source("source:ca-qc-zone-chasse-service"), source("source:ontario-moose-habitat"), source("source:open-meteo")],
    regulation: { sourceIds: ["source:ca-qc-orignal-2026-2027"] } as never,
    zone: { sourceId: "source:ca-qc-zone-chasse-service" } as never,
  });
  assert.deepEqual(authority.map(({ id }) => id), ["source:ca-qc-orignal-2026-2027", "source:ca-qc-zone-chasse-service"]);
  assert.deepEqual(context.map(({ id }) => id), ["source:ontario-moose-habitat", "source:open-meteo"]);
});

test("a knowledge source that the rules also cite stays authority", () => {
  const { authority, context } = partitionEvaluationSources({
    sources: [source("source:shared")],
    regulation: { sourceIds: ["source:shared"] } as never,
    zone: { sourceId: "source:zone" } as never,
  });
  assert.equal(authority.length, 1);
  assert.equal(context.length, 0);
});

test("what placed a point with no zone is never authority, even where something cites it as one", () => {
  /* Adversarial: the Census source arrives in BOTH places that once made it
     "decisive" — the answer's sourceIds and the resolution's sourceId. */
  const census = "source:us-census-tigerweb-states";
  const { authority, placement, context } = partitionEvaluationSources({
    sources: [source("source:us-ia-571-iac-96"), source(census), source("source:open-meteo")],
    regulation: { sourceIds: ["source:us-ia-571-iac-96", census] } as never,
    zone: { sourceId: census, jurisdictionScope: { boundary: { sourceId: census } } } as never,
  });
  assert.deepEqual(authority.map(({ id }) => id), ["source:us-ia-571-iac-96"]);
  assert.deepEqual(placement.map(({ id }) => id), [census]);
  assert.deepEqual(context.map(({ id }) => id), ["source:open-meteo"]);
});
