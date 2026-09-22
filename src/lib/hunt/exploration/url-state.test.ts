import assert from "node:assert/strict";
import test from "node:test";
import { ZONE_LAYERS } from "../zone-layers.ts";
import {
  EMPTY_HUNT_URL_STATE, huntDeepLink, parseHuntUrlState, serializeHuntUrlState, zoneRefFromId,
  type HuntUrlValidators,
} from "./url-state.ts";

const SERVED = ZONE_LAYERS.filter((layer) => layer.serving);
const validators: HuntUrlValidators = {
  isServedZoneId: (id) => SERVED.some((layer) => id.startsWith(layer.zoneIdPrefix)),
  isPublishedSpecies: (id) => ["species:white-tailed-deer", "species:moose", "species:ruffed-grouse"].includes(id),
};

test("a full hunt link round-trips through its URL", () => {
  const state = {
    zoneId: "management_zone:ca-on-wmu-57" as const,
    speciesId: "species:white-tailed-deer" as const,
    date: "2026-09-22",
    explore: true,
  };
  const query = serializeHuntUrlState(state);
  assert.equal(query, "zone=ca-on-wmu-57&species=white-tailed-deer&date=2026-09-22&explore=1");
  assert.deepEqual(parseHuntUrlState(new URLSearchParams(query), validators), { state, rejected: [] });
  assert.equal(huntDeepLink(state), `/hunt?${query}`);
  assert.equal(huntDeepLink(state, "https://www.northgroundbushcraft.com"), `https://www.northgroundbushcraft.com/hunt?${query}`);
});

test("the empty state is the plain Hunt URL", () => {
  assert.equal(huntDeepLink(EMPTY_HUNT_URL_STATE), "/hunt");
  assert.deepEqual(parseHuntUrlState(new URLSearchParams(""), validators).state, EMPTY_HUNT_URL_STATE);
});

test("existing species-profile links keep working", () => {
  // Profiles link with the canonical id, percent-encoded by encodeURIComponent.
  const parsed = parseHuntUrlState(new URLSearchParams(`species=${encodeURIComponent("species:ruffed-grouse")}`), validators);
  assert.equal(parsed.state.speciesId, "species:ruffed-grouse");
  assert.deepEqual(parsed.rejected, []);
});

test("the full canonical zone id is accepted as well as the short form", () => {
  const parsed = parseHuntUrlState({ zone: "management_zone:ca-qc-zone-10o" }, validators);
  assert.equal(parsed.state.zoneId, "management_zone:ca-qc-zone-10o");
});

test("zone numbers are never zones: a bare designation or a label is refused", () => {
  for (const zone of ["57", "WMU 57", "10W", "Zone 10 West", "ca-on-wmu-57<script>", "../../etc", "ca-zz-wmu-1"]) {
    const parsed = parseHuntUrlState({ zone }, validators);
    assert.equal(parsed.state.zoneId, null, `${zone} must not name a zone`);
    assert.deepEqual(parsed.rejected, ["zoneId"]);
  }
});

test("each malformed parameter is dropped on its own", () => {
  const parsed = parseHuntUrlState(
    { zone: "ca-mb-gha-38", species: "unicorn", date: "2026-02-30", explore: "maybe" },
    validators,
  );
  assert.deepEqual(parsed.state, { zoneId: "management_zone:ca-mb-gha-38", speciesId: null, date: null, explore: false });
  assert.deepEqual(parsed.rejected.sort(), ["date", "explore", "speciesId"]);
});

test("impossible and malformed dates are refused rather than rolled forward", () => {
  for (const date of ["2026-02-29", "2026-13-01", "20260922", "2026/09/22", "", "2026-9-2"]) {
    assert.equal(parseHuntUrlState({ date }, validators).state.date, null, date);
  }
  assert.equal(parseHuntUrlState({ date: "2028-02-29" }, validators).state.date, "2028-02-29");
});

test("a repeated parameter is ambiguous and chooses neither copy", () => {
  const parsed = parseHuntUrlState({ zone: ["ca-on-wmu-57", "ca-on-wmu-61"] }, validators);
  assert.equal(parsed.state.zoneId, null);
});

test("explore is written only when there is a species to colour by", () => {
  assert.equal(serializeHuntUrlState({ ...EMPTY_HUNT_URL_STATE, explore: true }), "");
  assert.equal(
    serializeHuntUrlState({ ...EMPTY_HUNT_URL_STATE, speciesId: "species:moose", explore: true }),
    "species=moose&explore=1",
  );
});

test("a URL can never carry a coordinate", () => {
  const query = serializeHuntUrlState({
    zoneId: "management_zone:ca-ab-wmu-102", speciesId: "species:moose", date: "2026-10-01", explore: false,
  });
  assert.doesNotMatch(query, /lat|lng|lon|coord|point/i);
  // Unknown parameters, including coordinates, are simply not read.
  const parsed = parseHuntUrlState({ lat: "45.2", lng: "-77.9", zone: "ca-ab-wmu-102" }, validators);
  assert.deepEqual(Object.keys(parsed.state).sort(), ["date", "explore", "speciesId", "zoneId"]);
});

test("zone ids map back to the layer and the authority's designation", () => {
  assert.deepEqual(zoneRefFromId("management_zone:ca-on-wmu-69a-1", SERVED), { layerId: "layer:ca-on-wmu", designation: "69A-1" });
  assert.deepEqual(zoneRefFromId("management_zone:ca-qc-zone-10o", SERVED), { layerId: "layer:ca-qc-zone-chasse", designation: "10O" });
  assert.deepEqual(zoneRefFromId("management_zone:ca-mb-gha-25a", SERVED), { layerId: "layer:ca-mb-gha", designation: "25A" });
  assert.deepEqual(zoneRefFromId("management_zone:ca-ab-wmu-102", SERVED), { layerId: "layer:ca-ab-wmu", designation: "102" });
  assert.equal(zoneRefFromId("management_zone:ca-zz-wmu-1", SERVED), null);
});

test("designations repeat across jurisdictions, and the id keeps them apart", () => {
  const ontario = zoneRefFromId("management_zone:ca-on-wmu-22", SERVED);
  const manitoba = zoneRefFromId("management_zone:ca-mb-gha-22", SERVED);
  assert.equal(ontario?.designation, manitoba?.designation);
  assert.notEqual(ontario?.layerId, manitoba?.layerId);
});

test("the longest zone-id prefix names the layer, so nested prefixes never collide", () => {
  const layers = [
    { id: "layer:us-wy", zoneIdPrefix: "management_zone:us-wy-" },
    { id: "layer:us-wy-elk-area", zoneIdPrefix: "management_zone:us-wy-elk-area-" },
  ];
  assert.deepEqual(zoneRefFromId("management_zone:us-wy-elk-area-7", layers), { layerId: "layer:us-wy-elk-area", designation: "7" });
  assert.deepEqual(zoneRefFromId("management_zone:us-wy-12", layers), { layerId: "layer:us-wy", designation: "12" });
});
