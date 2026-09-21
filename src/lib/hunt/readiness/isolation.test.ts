import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { evaluateHunt } from "../evaluate.ts";
import type { HuntInput, ZoneResolution } from "../types.ts";
import { vendorSearchReducer, type VendorSearchState } from "./vendors.ts";

/**
 * The hunt location and the vendor-search location are different things.
 *
 * The hunt location decides the zone, the law, the weather and the brief. The
 * vendor-search location only sorts a list of licence issuers, on the device.
 * These tests prove the second cannot reach anything the first decides.
 */

const HUNT: HuntInput = { latitude: 45.23, longitude: -77.94, date: "2026-10-15", speciesId: "species:ruffed-grouse", answers: { RESIDENCY: "RESIDENT" } };
const ZONE: ZoneResolution = {
  status: "RESOLVED", zoneId: "management_zone:ca-on-wmu-57", jurisdictionId: "jurisdiction:ca-on",
  officialName: "Wildlife Management Unit 57", boundaryDistanceMeters: 2_000, nearBoundary: false,
  sourceId: "source:ca-on-wmu-service", message: "Resolved from official fixture.",
};
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

async function evaluateRecording() {
  const zoneCalls: number[][] = [];
  const weatherCalls: number[][] = [];
  const result = await evaluateHunt(HUNT, {
    resolveZone: async (latitude, longitude) => { zoneCalls.push([latitude, longitude]); return ZONE; },
    weather: async (latitude, longitude, date) => {
      weatherCalls.push([latitude, longitude]);
      return { status: "UNAVAILABLE", summary: "No forecast", date, sourceId: "source:open-meteo" };
    },
    now: () => new Date("2026-09-21T15:00:00Z"),
  });
  return { result, zoneCalls, weatherCalls };
}

describe("the vendor search cannot change the hunt", () => {
  it("evaluates zone and weather at the hunt location only, and builds the checklist from it", async () => {
    const { result, zoneCalls, weatherCalls } = await evaluateRecording();
    assert.deepEqual(zoneCalls, [[45.23, -77.94]]);
    assert.deepEqual(weatherCalls, [[45.23, -77.94]]);
    assert.equal(result.regulation.status, "CONDITIONAL");
    assert.equal(result.readiness?.coverage, "VERIFIED");
    assert.ok(result.readiness?.authorizations.some((item) => item.id === "authorization:ca-on-small-game-licence"));
  });

  it("gives the same result however the vendor search has moved", async () => {
    const before = await evaluateRecording();
    // A vendor search from somewhere else entirely: Thunder Bay, via the device.
    let vendor: VendorSearchState = vendorSearchReducer({ phase: "IDLE" }, { type: "USE_DEVICE" });
    vendor = vendorSearchReducer(vendor, { type: "DEVICE_LOCATED", latitude: 48.38, longitude: -89.25 });
    vendor = vendorSearchReducer(vendor, { type: "PLACE_CHOSEN", latitude: 43.65, longitude: -79.38, label: "Toronto" });
    assert.equal(vendor.phase, "RESULTS");
    const after = await evaluateRecording();
    assert.deepEqual(after.result, before.result);
    assert.deepEqual(after.zoneCalls, [[45.23, -77.94]]);
  });

  it("keeps the vendor location out of the evaluation entirely", async () => {
    const { result } = await evaluateRecording();
    const serialized = JSON.stringify(result);
    assert.ok(!/vendorSearchLocation|"origin":"DEVICE"/.test(serialized));
    // The only directory reference is the directory's ID, never a position.
    assert.equal(result.readiness?.vendorSearch?.directoryId, "ca-on-licence-issuers");
    assert.deepEqual(Object.keys(result.readiness!.vendorSearch!).sort(), ["attribution", "directoryId"]);
  });

  it("offers no online-only checklist a vendor search", async () => {
    // A requirement bought only online or from a federal program has no in-person issuer to find.
    const { result } = await evaluateRecording();
    const firearms = result.readiness!.authorizations.find((item) => item.id === "authorization:ca-federal-firearms-licence");
    assert.ok(firearms);
    assert.ok(!firearms.purchase?.channels.includes("PHYSICAL_VENDOR"));
    assert.equal(firearms.purchase?.vendorDirectoryId, undefined);
  });
});

describe("the vendor search component, read as source", () => {
  const vendor = read("../../../components/hunt/VendorSearch.tsx");
  const ready = read("../../../components/hunt/ReadyToHunt.tsx");

  it("cannot reach the hunt location, the map state or the evaluation", () => {
    for (const source of [vendor, ready]) {
      assert.doesNotMatch(source, /exploration\/map-state|HUNT_SET|\/api\/hunt\/evaluate|HuntLocation|selectLocation/);
    }
  });

  it("asks the device only from the button, never on open", () => {
    const calls = vendor.match(/navigator\.geolocation\.\w+/g) ?? [];
    assert.deepEqual(calls, ["navigator.geolocation.getCurrentPosition"]);
    const locate = vendor.slice(vendor.indexOf("function locateDevice"), vendor.indexOf("const results"));
    assert.match(locate, /getCurrentPosition/, "the only request sits inside the button's handler");
    assert.doesNotMatch(vendor, /watchPosition/);
  });

  it("stores nothing and sends nothing about the searcher", () => {
    for (const source of [vendor, ready]) {
      assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|sendBeacon|fetch\(|gtag|analytics/i);
    }
  });

  it("states that the current location is used only for finding vendors", () => {
    assert.match(vendor, /Your current location is used only to find nearby licence vendors\. It won&apos;t change your hunting location\./);
    assert.match(vendor, /Search another location/);
  });
});
