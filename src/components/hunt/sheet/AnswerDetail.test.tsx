import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { evaluateHunt } from "../../../lib/hunt/evaluate.ts";
import { placeInJurisdiction } from "../../../lib/hunt/jurisdiction-scope.ts";
import { clearStateLineProximityCache, clearUnitedStatesStateCache } from "../../../lib/hunt/united-states/state-boundary.ts";
import type { HuntInput } from "../../../lib/hunt/types.ts";
import AnswerDetail from "./AnswerDetail.tsx";

/**
 * THE SHEET'S SOURCES, FOR A POINT PLACED ONLY IN ITS JURISDICTION.
 *
 * Found by an independent verifier: Des Moines' pheasant answer listed the
 * U.S. Census Bureau's state boundary under "What decided this answer: the
 * rules and the zone boundary" — a cartographic state line presented as a
 * zone boundary. The answer here comes from the real engine (Iowa's certified
 * bundle) with the point placed by the real placement code; only the Census
 * service is answered from a recording, and the rendered sheet is read as a
 * hunter would read it: what sits under which words.
 */

const census = (async (input: string | URL | Request) => {
  const url = new URL(String(input));
  if (url.hostname !== "tigerweb.geo.census.gov") return Response.json({ type: "FeatureCollection", features: [] });
  /* Des Moines, recorded 2026-10-01: in Iowa, and a 500 m circle around it is wholly inside Iowa. */
  return Response.json({ features: [{ attributes: { NAME: "Iowa", STUSAB: "IA" } }] });
}) as typeof fetch;

async function desMoinesPheasant() {
  clearUnitedStatesStateCache();
  clearStateLineProximityCache();
  const placement = await placeInJurisdiction(41.5868, -93.625, census);
  assert.equal(placement.kind, "SCOPED");
  const resolution = placement.kind === "SCOPED" ? placement.resolution : undefined;
  return evaluateHunt(
    {
      latitude: 41.5868, longitude: -93.625, date: "2026-11-15" as HuntInput["date"],
      speciesId: "species:ring-necked-pheasant" as HuntInput["speciesId"], answers: { HUNT_METHOD: "NOT_FALCONRY" } as HuntInput["answers"],
    },
    {
      resolveZone: async () => resolution!,
      fetch: census,
      weather: async (_latitude: number, _longitude: number, date: string) =>
        ({ status: "UNAVAILABLE" as const, summary: "No forecast.", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const }),
      now: () => new Date("2026-10-01T12:00:00Z"),
    },
  );
}

test("the Census boundary sits under what PLACED the point, labelled as a cartographic state boundary — never under what decided the answer", async () => {
  const result = await desMoinesPheasant();
  assert.equal(result.regulation.status, "CONDITIONAL", "positive control: there is an answer with sources");
  const html = renderToStaticMarkup(
    <AnswerDetail result={result} species={null} placeLabel="Des Moines" jurisdiction={{ id: "jurisdiction:us-ia" as never, displayName: "Iowa" }} />,
  );
  const decided = html.indexOf("What decided this answer: the rules.");
  const placed = html.indexOf("What placed this point: the U.S. Census Bureau&#x27;s cartographic state boundary. It is not a hunting boundary, and it did not decide this answer.");
  assert.ok(decided >= 0, "the authority group is headed without claiming a zone boundary");
  assert.ok(placed > decided, "the placement group follows it, in its own words");
  assert.doesNotMatch(html, /the rules and the zone boundary/, "there is no zone boundary at a point with no zone");
  /* What sits between the two headings is what decided the answer: Iowa's rules, and not the Census line. */
  const authorityPart = html.slice(decided, placed);
  assert.match(authorityPart, /Iowa/);
  assert.doesNotMatch(authorityPart, /tigerweb|Census/i);
  /* And the Census source is listed — once, after its label. */
  assert.match(html.slice(placed), /tigerweb\.geo\.census\.gov/);
  assert.equal(html.match(/tigerweb\.geo\.census\.gov\/arcgis/g)?.length, 1);
});
