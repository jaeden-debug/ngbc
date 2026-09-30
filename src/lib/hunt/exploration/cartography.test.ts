import assert from "node:assert/strict";
import test from "node:test";
import {
  jurisdictionTone, labelMinimumSpanPx, MAX_STATE_FILL, SEASON_OPEN_STROKE, SELECTED_STROKE, zoneStyle, zoomBand,
  type Emphasis, type ZoneStyleInput, type ZoomBand,
} from "./cartography.ts";
import { heatFillFor, HEAT_FILL, zoneHasConditions, zoneIsGreen } from "./species-layer.ts";
import type { ExplorationState, ZoneSpeciesAnswer } from "./states.ts";
import type { ZoneOpportunity } from "./opportunity.ts";

const BANDS: ZoomBand[] = ["national", "regional", "local"];
const EMPHASES: Emphasis[] = ["light", "standard", "strong"];

const zone = (over: Partial<ZoneStyleInput> = {}): ZoneStyleInput => ({
  coverage: "VERIFIED",
  jurisdictionId: "jurisdiction:ca-on",
  selected: false, hunt: false, hovered: false, dimmed: false,
  seasonOpen: false, band: "regional", emphasis: "standard",
  ...over,
});

test("the three bands are the three questions a hunter asks in order", () => {
  assert.equal(zoomBand(4), "national");
  assert.equal(zoomBand(6.4), "national");
  assert.equal(zoomBand(7), "regional");
  assert.equal(zoomBand(9.4), "regional");
  assert.equal(zoomBand(10), "local");
  assert.equal(zoomBand(16), "local");
});

test("the chosen zone is the loudest thing on the map, at every band and setting", () => {
  for (const band of BANDS) {
    for (const emphasis of EMPHASES) {
      const selected = zoneStyle(zone({ selected: true, band, emphasis }));
      for (const other of [
        zone({ band, emphasis }),
        zone({ band, emphasis, hovered: true }),
        zone({ band, emphasis, hunt: true }),
        zone({ band, emphasis, dimmed: true }),
        zone({ band, emphasis, heat: HEAT_FILL.VERY_HIGH }),
        zone({ band, emphasis, seasonOpen: true }),
        zone({ band, emphasis, seasonOpen: true, hovered: true, heat: HEAT_FILL.VERY_HIGH }),
      ]) {
        const style = zoneStyle(other);
        assert.ok(selected.zIndex > style.zIndex, `zIndex ${band}/${emphasis}`);
        assert.ok(selected.fillOpacity >= style.fillOpacity, `fill ${band}/${emphasis}`);
        assert.ok(selected.strokeWeight >= style.strokeWeight, `stroke ${band}/${emphasis}`);
      }
      assert.equal(selected.strokeColor, SELECTED_STROKE, "only the chosen zone wears the bone outline");
    }
  }
});

test("choosing a zone does not erase the heat on every other zone", () => {
  // The layer's content survives the focal plane; only a decorative tone recedes.
  const hot = zoneStyle(zone({ heat: HEAT_FILL.HIGH }));
  const hotDimmed = zoneStyle(zone({ heat: HEAT_FILL.HIGH, dimmed: true }));
  assert.equal(hotDimmed.fillOpacity, hot.fillOpacity, "a neighbour's evidence is still readable");
  // And the chosen zone still leads over an undimmed neighbour at the top of the ramp.
  const selected = zoneStyle(zone({ selected: true, heat: HEAT_FILL.VERY_HIGH }));
  assert.ok(selected.fillOpacity >= zoneStyle(zone({ heat: HEAT_FILL.VERY_HIGH, hovered: true })).fillOpacity);
});

test("a dimmed neighbour keeps its boundary: a focal plane, not a blackout", () => {
  const plain = zoneStyle(zone());
  const dimmed = zoneStyle(zone({ dimmed: true }));
  assert.ok(dimmed.fillOpacity < plain.fillOpacity, "its fill recedes");
  assert.ok(dimmed.strokeOpacity > 0.13, "its line stays readable");
  assert.ok(dimmed.strokeWeight === plain.strokeWeight, "boundaries do not thin out");
});

test("terrain reads through where it matters: fills thin as the map closes in", () => {
  const national = zoneStyle(zone({ band: "national" }));
  const regional = zoneStyle(zone({ band: "regional" }));
  const local = zoneStyle(zone({ band: "local" }));
  assert.ok(national.fillOpacity > regional.fillOpacity);
  assert.ok(regional.fillOpacity > local.fillOpacity);
  // And the lines take over as the fills go.
  assert.ok(local.strokeWeight > regional.strokeWeight);
  assert.ok(regional.strokeWeight > national.strokeWeight);
});

test("jurisdictions differ in tone, never in loudness", () => {
  const ontario = zoneStyle(zone({ jurisdictionId: "jurisdiction:ca-on" }));
  const manitoba = zoneStyle(zone({ jurisdictionId: "jurisdiction:ca-mb" }));
  assert.notEqual(ontario.fillColor, manitoba.fillColor, "you can see where one ends");
  assert.equal(ontario.fillOpacity, manitoba.fillOpacity, "neither shouts over the other");
  assert.equal(jurisdictionTone("jurisdiction:ca-on"), jurisdictionTone("jurisdiction:ca-on"));
  // An unregistered jurisdiction is drawn neutrally rather than given a colour of its own.
  assert.equal(jurisdictionTone("jurisdiction:zz-zz"), jurisdictionTone(undefined));
});

test("the species layer is two independent channels, and all four combinations draw", () => {
  const tone = jurisdictionTone("jurisdiction:ca-on");
  const hot = zoneStyle(zone({ heat: HEAT_FILL.VERY_HIGH }));
  const open = zoneStyle(zone({ seasonOpen: true }));
  const both = zoneStyle(zone({ heat: HEAT_FILL.VERY_HIGH, seasonOpen: true }));
  const neither = zoneStyle(zone());

  // Heat is the fill; an open season is the stroke. Neither reaches into the other.
  assert.equal(hot.fillColor, HEAT_FILL.VERY_HIGH.color, "heat takes the fill");
  assert.notEqual(hot.strokeColor, SEASON_OPEN_STROKE, "heat never claims a season");
  assert.equal(open.fillColor, tone, "an open season never tints the fill: green implies no animals");
  assert.equal(open.strokeColor, SEASON_OPEN_STROKE);
  // Both at once is the point of the layer: the heat stays visible under the green ring.
  assert.equal(both.fillColor, HEAT_FILL.VERY_HIGH.color);
  assert.equal(both.fillOpacity, hot.fillOpacity);
  assert.equal(both.strokeColor, SEASON_OPEN_STROKE);
  assert.equal(neither.strokeColor, tone);
});

test("a zone with no certified evidence draws no heat, and is not a cold one", () => {
  // Absent evidence is not evidence of absence: the zone keeps the map's own tone.
  const nothing = zoneStyle(zone());
  const low = zoneStyle(zone({ heat: HEAT_FILL.LOW }));
  assert.equal(nothing.fillColor, jurisdictionTone("jurisdiction:ca-on"));
  assert.notEqual(low.fillColor, nothing.fillColor, "LOW must be distinguishable from no data");
  assert.ok(low.fillOpacity > nothing.fillOpacity, "and it must be visible as a value");
  // LIMITED_DATA holds evidence that will not support a rank, so it takes no fill either.
  assert.equal(heatFillFor("LIMITED_DATA"), null);
  assert.equal(heatFillFor(undefined), null);
});

/** A zone answer whose state and opportunity are stated independently. */
function answer(state: ExplorationState, opportunity: Partial<ZoneOpportunity> = {}): ZoneSpeciesAnswer {
  return {
    state,
    opportunity: {
      hasCurrentLegalOpportunity: false, hasMaterialConditions: false, conditions: [],
      coverage: "CLOSED", exhaustive: true, ...opportunity,
    },
  };
}

test("green follows the opportunity, not the zone list's word for it", () => {
  /* The production defect in one assertion: CHECK_REQUIREMENTS is the word the
     zone list uses, and it is green whenever the engine established a hunt. */
  const conditional = answer("CHECK_REQUIREMENTS", { hasCurrentLegalOpportunity: true, hasMaterialConditions: true, coverage: "OPEN" });
  assert.equal(zoneIsGreen(conditional), true);
  assert.equal(zoneHasConditions(conditional), true);
  assert.equal(zoneIsGreen(answer("SEASON_AVAILABLE", { hasCurrentLegalOpportunity: true, coverage: "OPEN" })), true);

  // NOT-GREEN IS NOT CLOSED, and there is still no second map colour: every one
  // of these draws the jurisdiction's own quiet tone and nothing else.
  for (const state of ["CHECK_REQUIREMENTS", "CLOSED", "NEEDS_VERIFICATION", "CONFLICT", "UNKNOWN", "NOT_CERTIFIED"] as const) {
    const shut = answer(state);
    assert.equal(zoneIsGreen(shut), false, state);
    assert.equal(zoneHasConditions(shut), false, state);
    assert.equal(zoneStyle(zone({ seasonOpen: zoneIsGreen(shut) })).strokeColor, jurisdictionTone("jurisdiction:ca-on"), state);
  }
  assert.equal(zoneIsGreen(undefined), false);
  assert.equal(zoneHasConditions(undefined), false);
});

test("the condition indicator is never drawn on a zone that is not green", () => {
  /* On its own it would read as a warning about a hunt that does not exist —
     and a hunter would take it for the opposite of what it means. */
  const impossible = answer("CLOSED", { hasCurrentLegalOpportunity: false, hasMaterialConditions: true });
  assert.equal(zoneHasConditions(impossible), false);
});

test("the heat ramp is monotonic and stays under the ceiling the chosen zone clears", () => {
  const order = ["LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
  let previous = 0;
  for (const classification of order) {
    const style = zoneStyle(zone({ heat: HEAT_FILL[classification] }));
    assert.ok(style.fillOpacity > previous, `${classification} must be stronger than the class below it`);
    /* Against the DERIVED ceiling, never a literal. This assertion previously
       read `<= 0.32`, which was only ever true of the ramp it was written for:
       raising the ramp to make the layer visible made a correct style fail a
       stale number. */
    assert.ok(style.fillOpacity <= MAX_STATE_FILL, `${classification} must stay under the ceiling`);
    previous = style.fillOpacity;
  }
});

test("the emphasis presets only change how strong it looks, and never exceed the ceiling", () => {
  const light = zoneStyle(zone({ emphasis: "light" }));
  const standard = zoneStyle(zone({ emphasis: "standard" }));
  const strong = zoneStyle(zone({ emphasis: "strong" }));
  assert.ok(light.fillOpacity < standard.fillOpacity);
  assert.ok(standard.fillOpacity < strong.fillOpacity);
  for (const style of [light, standard, strong]) {
    assert.ok(style.fillOpacity <= MAX_STATE_FILL && style.fillOpacity >= 0);
    assert.ok(style.strokeOpacity <= 1 && style.strokeOpacity > 0);
  }
  // Even at "strong" the chosen zone still leads.
  assert.ok(zoneStyle(zone({ selected: true, emphasis: "light" })).zIndex > zoneStyle(zone({ emphasis: "strong" })).zIndex);
});

test("an uncertified boundary is drawn more quietly than a certified one", () => {
  const certified = zoneStyle(zone({ coverage: "VERIFIED" }));
  const boundaryOnly = zoneStyle(zone({ coverage: "IN_DEVELOPMENT" }));
  assert.ok(boundaryOnly.fillOpacity < certified.fillOpacity);
  assert.ok(boundaryOnly.strokeOpacity < certified.strokeOpacity);
  assert.ok(boundaryOnly.zIndex < certified.zIndex);
});

test("labels are rationed by how much room a zone has on screen", () => {
  assert.ok(labelMinimumSpanPx("national") > labelMinimumSpanPx("regional"));
  assert.ok(labelMinimumSpanPx("regional") > labelMinimumSpanPx("local"));
});


test("heat does not fade with the zoom band — it is content, not tone", () => {
  /*
   * The defect this pins, from the owner: "why do i still not have an actual
   * heat map". Heat was multiplied by STATE_BAND_SCALE — national 0.9,
   * regional 0.8, local 0.7 — so the hottest zone anywhere never passed ~0.29
   * and the layer was WEAKEST at local zoom, which is exactly where a hunter
   * decides where to walk.
   *
   * §41A's "fills nearly gone at local" is about a jurisdiction's TONE, so the
   * terrain and roads carry the ground. Heat is the layer's content. The same
   * distinction already exempts heat from the focal-plane dimming; this is that
   * rule applied to the other place it was missing.
   */
  const fills = BANDS.map((band) => zoneStyle(zone({ band, heat: HEAT_FILL.VERY_HIGH })).fillOpacity);
  assert.equal(new Set(fills).size, 1, `heat must read the same at every band, got ${JSON.stringify(fills)}`);

  /* And it has to be legible, not merely equal: a ramp everyone can agree on
     and nobody can see is the bug that was shipped. */
  assert.ok(fills[0] >= 0.45, `the hot end must be visible over a dark basemap, got ${fills[0]}`);

  /* The chosen zone still clears the loudest heat at every band and setting —
     asserted at the NEW values rather than the ones this was written for,
     because the derivation is what stops a hot neighbour out-shouting it. */
  for (const band of BANDS) {
    for (const emphasis of EMPHASES) {
      const chosen = zoneStyle(zone({ selected: true, band, emphasis }));
      const hottest = zoneStyle(zone({ band, emphasis, heat: HEAT_FILL.VERY_HIGH, hovered: true }));
      assert.ok(chosen.fillOpacity >= hottest.fillOpacity, `chosen must lead at ${band}/${emphasis}`);
    }
  }
});
