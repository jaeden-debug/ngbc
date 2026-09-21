import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import directory from "../../../../content/regulatory/readiness/ca-on-licence-issuers.json" with { type: "json" };
import {
  distanceKm, issuerAdvice, issuerMapUrl, nearestIssuers, vendorSearchLocation, vendorSearchReducer,
  type LicenceIssuer, type VendorSearchState,
} from "./vendors.ts";

const issuers = directory.issuers as LicenceIssuer[];
const OTTAWA = vendorSearchLocation(45.4215, -75.6972, "Ottawa", "SEARCH");

describe("finding a licence issuer", () => {
  it("measures distance on the sphere", () => {
    // Ottawa to Toronto is about 352 km in a straight line.
    const km = distanceKm(OTTAWA, { latitude: 43.6532, longitude: -79.3832 });
    assert.ok(km > 340 && km < 365, `got ${km}`);
  });

  it("returns the nearest published issuers, closest first", () => {
    const near = nearestIssuers(OTTAWA, issuers, 5);
    assert.equal(near.length, 5);
    for (let i = 1; i < near.length; i++) assert.ok(near[i - 1].distanceKm <= near[i].distanceKm);
    assert.ok(near[0].distanceKm < 30, "an issuer exists within 30 km of Ottawa");
  });

  it("links to an issuer by its name and address, never by the searcher's position", () => {
    const [{ issuer }] = nearestIssuers(OTTAWA, issuers, 1);
    const url = issuerMapUrl(issuer);
    assert.ok(url.startsWith("https://www.google.com/maps/search/?api=1&query="));
    assert.ok(!url.includes("45.42") && !url.includes("75.69"));
  });

  it("tells the hunter to call a seasonal issuer before driving there", () => {
    assert.match(issuerAdvice({ name: "x", city: "y", type: "Seasonal", latitude: 0, longitude: 0 }) ?? "", /call ahead/);
    assert.equal(issuerAdvice({ name: "x", city: "y", type: "Year Round", address: "1 Main St", latitude: 0, longitude: 0 }), undefined);
  });

  it("refuses an impossible coordinate rather than searching from it", () => {
    assert.throws(() => vendorSearchLocation(Number.NaN, 0, "x", "SEARCH"));
    assert.throws(() => vendorSearchLocation(91, 0, "x", "SEARCH"));
  });
});

describe("the vendor search never becomes the hunt location", () => {
  const idle: VendorSearchState = { phase: "IDLE" };

  it("uses the device only after the hunter asks, and labels it as the device", () => {
    const locating = vendorSearchReducer(idle, { type: "USE_DEVICE" });
    assert.equal(locating.phase, "LOCATING");
    const found = vendorSearchReducer(locating, { type: "DEVICE_LOCATED", latitude: 45.4, longitude: -75.7 });
    assert.equal(found.phase, "RESULTS");
    assert.equal(found.phase === "RESULTS" && found.location.origin, "DEVICE");
    assert.equal(found.phase === "RESULTS" && found.location.kind, "VENDOR_SEARCH");
  });

  it("offers another place when location permission is denied", () => {
    const denied = vendorSearchReducer({ phase: "LOCATING" }, { type: "DEVICE_FAILED", code: 1 });
    assert.deepEqual(denied, { phase: "SEARCHING", reason: "DENIED" });
    const chosen = vendorSearchReducer(denied, { type: "PLACE_CHOSEN", latitude: 46.3, longitude: -79.46, label: "North Bay" });
    assert.equal(chosen.phase, "RESULTS");
    assert.equal(chosen.phase === "RESULTS" && chosen.location.origin, "SEARCH");
  });

  it("ignores a late device fix once the hunter has moved on", () => {
    const searching: VendorSearchState = { phase: "SEARCHING" };
    assert.equal(vendorSearchReducer(searching, { type: "DEVICE_LOCATED", latitude: 1, longitude: 1 }), searching);
  });

  it("holds nothing but a vendor-search location in any state", () => {
    const states: VendorSearchState[] = [
      idle,
      vendorSearchReducer(idle, { type: "USE_DEVICE" }),
      vendorSearchReducer({ phase: "LOCATING" }, { type: "DEVICE_LOCATED", latitude: 45, longitude: -75 }),
      vendorSearchReducer({ phase: "SEARCHING" }, { type: "PLACE_CHOSEN", latitude: 46, longitude: -79, label: "North Bay" }),
    ];
    for (const state of states) {
      for (const key of Object.keys(state)) assert.ok(["phase", "reason", "location"].includes(key), key);
      if (state.phase === "RESULTS") assert.equal(state.location.kind, "VENDOR_SEARCH");
    }
  });

  it("performs no request of its own", () => {
    const source = readFileSync(new URL("./vendors.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|sendBeacon/);
  });
});

describe("the published issuer directory", () => {
  it("carries the Open Government Licence attribution and every issuer's position", () => {
    assert.match(directory.attribution, /Open Government Licence – Ontario/);
    assert.equal(directory.issuers.length, directory.count);
    for (const issuer of issuers) {
      assert.ok(issuer.name && issuer.city);
      assert.ok(issuer.latitude > 41 && issuer.latitude < 57 && issuer.longitude > -96 && issuer.longitude < -74, issuer.name);
    }
  });
});
