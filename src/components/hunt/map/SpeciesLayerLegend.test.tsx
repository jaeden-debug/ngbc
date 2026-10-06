import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SpeciesSurfaceState } from "../../../lib/hunt/exploration/surface-request.ts";
import SpeciesLayerLegend from "../SpeciesLayerLegend.tsx";

/**
 * NO EMPTY HEAT TOGGLE. A species layer that is on and paints nothing reads to
 * a hunter as "there are no animals here". When the view simply misses the
 * species' map, the legend says the map lies elsewhere, in words, and offers
 * the way to it — never a silent blank, and never "no evidence" for ground the
 * evidence was simply not about.
 */

const HAWAII = { west: -160.2, south: 18.9, east: -154.8, north: 22.2 };
const missed = (elsewhere: SpeciesSurfaceState["elsewhere"]): SpeciesSurfaceState => ({
  speciesId: "species:zebra-dove",
  outcome: "NONE_IN_VIEW",
  surfaces: [],
  legend: { layers: [], emptyMeans: "This species' map does not reach this ground.", refusals: [] },
  message: "This species' map does not reach this ground.",
  elsewhere,
});
const render = (surface: SpeciesSurfaceState, onShowWhere?: () => void) => renderToStaticMarkup(
  <SpeciesLayerLegend speciesName="Zebra dove" openZones={null} conditionalZones={0} hasEvidence={false} surface={surface} onShowWhere={onShowWhere} />,
);

test("a view that misses the map says it lies elsewhere and offers the way there", () => {
  const html = render(missed(HAWAII), () => {});
  assert.match(html, /mapped elsewhere/);
  assert.match(html, /Zebra dove&#x27;s map lies outside this view|Zebra dove’s map lies outside this view/);
  assert.match(html, /not a finding that it is absent/);
  assert.match(html, /<button[^>]*type="button"[^>]*>\s*Show where\s*<\/button>/, "a real control, not a link or a span");
});

test("with nowhere to go, nothing pretends there is; and a drawn map needs no such offer", () => {
  const nowhere = render(missed(null), () => {});
  assert.doesNotMatch(nowhere, /Show where/);
  assert.match(nowhere, /no evidence on this ground/);
  const drawn = render({ ...missed(HAWAII), outcome: "DRAWN" }, () => {});
  assert.doesNotMatch(drawn, /Show where/);
  assert.doesNotMatch(drawn, /mapped elsewhere/);
});
