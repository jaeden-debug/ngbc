import assert from "node:assert/strict";
import test from "node:test";
import {
  jurisdictionTone, labelMinimumSpanPx, SELECTED_STROKE, zoneStyle, zoomBand,
  type Emphasis, type ZoneStyleInput, type ZoomBand,
} from "./cartography.ts";

const BANDS: ZoomBand[] = ["national", "regional", "local"];
const EMPHASES: Emphasis[] = ["light", "standard", "strong"];

const zone = (over: Partial<ZoneStyleInput> = {}): ZoneStyleInput => ({
  coverage: "VERIFIED",
  jurisdictionId: "jurisdiction:ca-on",
  selected: false, hunt: false, hovered: false, dimmed: false,
  filtering: false, band: "regional", emphasis: "standard",
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
        zone({ band, emphasis, stateColor: { color: "#7cc08a", opacity: 0.2 } }),
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

test("a species state colours a zone, and is never the only thing that says so", () => {
  const state = { color: "#7cc08a", opacity: 0.22 };
  const filtered = zoneStyle(zone({ stateColor: state, filtering: true }));
  assert.equal(filtered.fillColor, state.color, "the state's colour wins over the tone");
  // Zones with no state in a filtered view are left empty rather than tinted a default.
  assert.equal(zoneStyle(zone({ filtering: true })).fillOpacity, 0);
});

test("the emphasis presets only change how strong it looks, and never exceed the ceiling", () => {
  const light = zoneStyle(zone({ emphasis: "light" }));
  const standard = zoneStyle(zone({ emphasis: "standard" }));
  const strong = zoneStyle(zone({ emphasis: "strong" }));
  assert.ok(light.fillOpacity < standard.fillOpacity);
  assert.ok(standard.fillOpacity < strong.fillOpacity);
  for (const style of [light, standard, strong]) {
    assert.ok(style.fillOpacity <= 0.32 && style.fillOpacity >= 0);
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
