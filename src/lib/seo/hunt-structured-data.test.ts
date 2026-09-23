import assert from "node:assert/strict";
import test from "node:test";
import { ZONE_LAYERS } from "../hunt/zone-layers.ts";
import { huntAnsweringJurisdictions, huntWebApplicationJsonLd } from "./hunt-structured-data.ts";

const layer = (id: string, name: string, country: "CA" | "US", serving: boolean, rulesServing?: boolean) =>
  ({ jurisdictionId: `jurisdiction:${id}` as const, jurisdictionName: name, country, serving, rulesServing });

test("only served layers whose rules answer are claimed as served area", () => {
  const answering = huntAnsweringJurisdictions([
    layer("ca-on", "Ontario", "CA", true, true),
    layer("ca-on", "Ontario", "CA", true, true),
    layer("ca-bc", "British Columbia", "CA", true, false),
    layer("ca-sk", "Saskatchewan", "CA", true),
    layer("us-mt", "Montana", "US", false, true),
    layer("us-id", "Idaho", "US", true, true),
  ]);
  assert.deepEqual(answering.map(({ name }) => name), ["Ontario", "Idaho"]);
});

test("the live registry's claim is exactly its rules-serving jurisdictions", () => {
  const app = huntWebApplicationJsonLd({ description: "d", layers: ZONE_LAYERS });
  const claimed = (app.areaServed as Array<{ name: string }>).map(({ name }) => name).sort();
  const expected = [...new Set(ZONE_LAYERS.filter((l) => l.serving && l.rulesServing === true).map((l) => l.jurisdictionName))].sort();
  assert.deepEqual(claimed, expected);
  assert.ok(claimed.length > 0);
});
