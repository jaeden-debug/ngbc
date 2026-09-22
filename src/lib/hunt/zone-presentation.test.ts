import assert from "node:assert/strict";
import test from "node:test";
import ontario from "../../../fixtures/hunt/ca-on-zone-certification.json" with { type: "json" };
import manitoba from "../../../fixtures/hunt/ca-mb-zone-certification.json" with { type: "json" };
import alberta from "../../../fixtures/hunt/ca-ab-zone-certification.json" with { type: "json" };
import quebec from "../../../fixtures/hunt/ca-qc-zone-certification.json" with { type: "json" };
import britishColumbia from "../../../fixtures/hunt/ca-bc-zone-certification.json" with { type: "json" };
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearOverlayCache } from "./overlays.ts";
import { clearZoneGeometryCache, fetchLayerGeometry } from "./zone-geometry.ts";
import { REGULATORY_REGISTRY } from "./regulatory/registry.ts";
import { summarizeZone } from "./exploration/zone-summary.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { layerById, ZONE_LAYERS, zoneDisplayLabel, zoneIdFor } from "./zone-layers.ts";
import {
  presentZone,
  presentZoneById,
  presentZoneInAllLocales,
  ZONE_LOCALES,
  ZONE_PRESENTATION_PROFILES,
} from "./zone-presentation.ts";

/**
 * The zone presentation contract, held against every certified production zone.
 *
 * The inventories are the authority-first certification fixtures — the same 461
 * designations production serves — so a zone the authorities add or rename
 * fails here before it can reach a label.
 */

const INVENTORY = [
  { layerId: "layer:ca-on-wmu", fixture: ontario, count: 151 },
  { layerId: "layer:ca-mb-gha", fixture: manitoba, count: 62 },
  { layerId: "layer:ca-ab-wmu", fixture: alberta, count: 189 },
  { layerId: "layer:ca-qc-zone-chasse", fixture: quebec, count: 59 },
] as const;

function everyZone() {
  return INVENTORY.flatMap(({ layerId, fixture }) => {
    const layer = layerById(layerId)!;
    return fixture.officialIdentifiers.map((designation: string) => ({ layer, designation }));
  });
}

test("1. all 461 certified production zones produce valid presentation in every locale", () => {
  assert.equal(everyZone().length, 461);
  for (const { layerId, fixture, count } of INVENTORY) assert.equal(fixture.officialIdentifiers.length, count, layerId);

  for (const { layer, designation } of everyZone()) {
    for (const locale of ZONE_LOCALES) {
      const presented = presentZone({ designation, layerId: layer.id, jurisdictionId: layer.jurisdictionId }, locale);
      const where = `${layer.id} ${designation} ${locale}`;
      assert.equal(presented.status, "PRESENTED", where);
      for (const label of [presented.fullLabel, presented.compactLabel, presented.designationLabel, presented.accessibleLabel]) {
        assert.ok(label.length > 0 && label === label.trim() && !/\s{2}/.test(label), `${where}: "${label}"`);
        assert.ok(!/undefined|null/.test(label), `${where}: "${label}"`);
      }
      assert.ok(presented.fullLabel.startsWith(`${presented.termShort} `), where);
      assert.ok(presented.accessibleLabel.endsWith(`, ${layer.jurisdictionName}`), where);
      // The zone number survives every rendering (leading zeros aside).
      const number = String(Number(/^\d+/.exec(designation)![0]));
      for (const label of [presented.fullLabel, presented.compactLabel]) assert.ok(label.includes(number), `${where}: "${label}"`);
    }
  }
});

test("2. canonical identity is unchanged by presentation, in every locale", () => {
  for (const { layer, designation } of everyZone()) {
    const zoneId = zoneIdFor(layer, designation);
    const officialName = `${layer.officialNamePrefix}${designation}`;
    const all = presentZoneInAllLocales({ designation, layerId: layer.id, zoneId, officialName });
    for (const locale of ZONE_LOCALES) {
      const presented = all[locale];
      assert.equal(presented.zoneId, zoneId);
      assert.equal(presented.sourceDesignation, designation);
      assert.equal(presented.officialName, officialName);
      assert.equal(presented.jurisdictionId, layer.jurisdictionId);
      assert.equal(presented.layerId, layer.id);
      // A label is never an identifier: it never mints the zone's canonical id.
      for (const label of [presented.fullLabel, presented.compactLabel]) {
        if (label !== designation) assert.notEqual(zoneIdFor(layer, label), zoneId, `${label} must not key ${zoneId}`);
      }
    }
    // Read back from a stored id, as a Hunt Brief does.
    const fromId = presentZoneById(zoneId, "en-CA", officialName);
    assert.equal(fromId.sourceDesignation, designation);
    assert.equal(fromId.zoneId, zoneId);
  }
});

test("every served zone layer has exactly one presentation profile that mirrors it", () => {
  for (const layer of ZONE_LAYERS.filter((candidate) => candidate.serving)) {
    const profiles = ZONE_PRESENTATION_PROFILES.filter((profile) => profile.layerId === layer.id);
    assert.equal(profiles.length, 1, layer.id);
    assert.equal(profiles[0].jurisdictionId, layer.jurisdictionId);
    assert.equal(profiles[0].zoneIdPrefix, layer.zoneIdPrefix);
    assert.equal(profiles[0].officialNamePrefix, layer.officialNamePrefix);
    assert.equal(profiles[0].term["en-CA"]?.short ?? layer.officialTermShort, layer.officialTermShort);
  }
});

test("8. Québec 10O is Zone 10 West / 10W in English and Zone 10 Ouest / 10O in French", () => {
  const layer = layerById("layer:ca-qc-zone-chasse")!;
  const zoneId = zoneIdFor(layer, "10O");
  assert.equal(zoneId, "management_zone:ca-qc-zone-10o");
  const en = presentZone({ designation: "10O", layerId: layer.id, zoneId }, "en-CA");
  const fr = presentZone({ designation: "10O", layerId: layer.id, zoneId }, "fr-CA");
  assert.deepEqual(
    [en.sourceDesignation, en.fullLabel, en.compactLabel, en.designationLabel, en.accessibleLabel, en.officialName],
    ["10O", "Zone 10 West", "10W", "10 West", "Zone 10 West, Québec", "Zone de chasse 10O"],
  );
  assert.deepEqual(
    [fr.sourceDesignation, fr.fullLabel, fr.compactLabel, fr.designationLabel, fr.officialName],
    ["10O", "Zone 10 Ouest", "10O", "10 Ouest", "Zone de chasse 10O"],
  );
  assert.equal(en.zoneId, fr.zoneId);
  // No canonical 10W zone exists or can be minted from the label.
  assert.ok(!quebec.officialIdentifiers.includes("10W"));
  assert.equal(presentZoneById("management_zone:ca-qc-zone-10w").status, "UNRECOGNIZED_DESIGNATION");
  assert.equal(zoneDisplayLabel(layer, "10O"), "Zone 10 West");
});

test("Québec directions are localised from the ministry's part names; territories keep theirs", () => {
  const cases: [string, string, string, string, string][] = [
    // designation, en full, en compact, fr full, fr compact
    ["01N", "Zone 1 North", "1N", "Zone 1 Nord", "1N"],
    ["06S", "Zone 6 South", "6S", "Zone 6 Sud", "6S"],
    ["10E", "Zone 10 East", "10E", "Zone 10 Est", "10E"],
    ["13SO", "Zone 13 Southwest", "13SW", "Zone 13 Sud-Ouest", "13SO"],
    ["19SE", "Zone 19 Southeast", "19SE", "Zone 19 Sud-Est", "19SE"],
    ["13", "Zone 13", "13", "Zone 13", "13"],
    // A direction continued into a territory: the direction is localised, the
    // territory stays the ministry's words, and the map keeps the source code.
    ["08NMR", "Zone 8 North (Montagne de Rigaud)", "08NMR", "Zone 8 Nord (Montagne de Rigaud)", "08NMR"],
    ["08NZ", "Zone 8 North ZSR", "08NZ", "Zone 8 Nord ZSR", "08NZ"],
    ["27ESB", "Zone 27 East (Seigneurie de Beaupré)", "27ESB", "Zone 27 Est (Seigneurie de Beaupré)", "27ESB"],
    ["02OI", "Zone 2 West (Île)", "02OI", "Zone 2 Ouest (Île)", "02OI"],
  ];
  for (const [designation, enFull, enCompact, frFull, frCompact] of cases) {
    const en = presentZone({ designation, jurisdictionId: "jurisdiction:ca-qc" }, "en-CA");
    const fr = presentZone({ designation, jurisdictionId: "jurisdiction:ca-qc" }, "fr-CA");
    assert.deepEqual([en.fullLabel, en.compactLabel, fr.fullLabel, fr.compactLabel], [enFull, enCompact, frFull, frCompact], designation);
  }
});

test("9. ambiguous identifiers are preserved, never expanded", () => {
  // « Sud-Nord-Ouest » is a part of Sud; "South-Northwest" is not what the ministry wrote.
  for (const locale of ZONE_LOCALES) {
    const presented = presentZone({ designation: "19SNO", jurisdictionId: "jurisdiction:ca-qc" }, locale);
    assert.equal(presented.fullLabel, "Zone 19SNO");
    assert.equal(presented.compactLabel, "19SNO");
    assert.equal(presented.localized, false);
  }
  // Subdivision letters are not directions: Ontario's E is a sub-unit, not East.
  const cases: [string, string, string, string][] = [
    ["layer:ca-on-wmu", "76E", "WMU 76E", "76E"],
    ["layer:ca-on-wmu", "69A-1", "WMU 69A-1", "69A-1"],
    ["layer:ca-on-wmu", "64B", "WMU 64B", "64B"],
    ["layer:ca-mb-gha", "25A", "GHA 25A", "25A"],
    ["layer:ca-mb-gha", "18C", "GHA 18C", "18C"],
  ];
  for (const [layerId, designation, full, compact] of cases) {
    const presented = presentZone({ designation, layerId }, "en-CA");
    assert.deepEqual([presented.fullLabel, presented.compactLabel], [full, compact], designation);
    assert.ok(!/East|North|South|West/.test(presented.fullLabel));
  }
  // A designation the authority does not publish is shown raw, not interpreted.
  const odd = presentZone({ designation: "10X", jurisdictionId: "jurisdiction:ca-qc" }, "en-CA");
  assert.equal(odd.status, "UNRECOGNIZED_DESIGNATION");
  assert.equal(odd.fullLabel, "Zone 10X");
  assert.equal(presentZone({ designation: "57 north", layerId: "layer:ca-on-wmu" }).status, "UNRECOGNIZED_DESIGNATION");
});

test("representative Ontario, Manitoba and Alberta zones read as the authority names them", () => {
  const cases: [string, string, string, string, string][] = [
    ["layer:ca-on-wmu", "64B", "WMU 64B", "64B", "Wildlife Management Unit 64B, Ontario"],
    ["layer:ca-on-wmu", "57", "WMU 57", "57", "Wildlife Management Unit 57, Ontario"],
    ["layer:ca-mb-gha", "38", "GHA 38", "38", "Game Hunting Area 38, Manitoba"],
    ["layer:ca-ab-wmu", "247", "WMU 247", "247", "Wildlife Management Unit 247, Alberta"],
  ];
  for (const [layerId, designation, full, compact, accessible] of cases) {
    for (const locale of ZONE_LOCALES) {
      const presented = presentZone({ designation, layerId }, locale);
      assert.deepEqual([presented.fullLabel, presented.compactLabel, presented.accessibleLabel], [full, compact, accessible]);
      // No French term is recorded from these authorities: kept, and said so.
      assert.equal(presented.localized, locale === "en-CA");
    }
  }
});

test("10. an unsupported or future jurisdiction is shown raw, never given a name", () => {
  for (const input of [
    // New Mexico and New Brunswick have no profile: shown raw, never named.
    { designation: "GMU 12", jurisdictionId: "jurisdiction:us-nm" },
    { designation: "21", jurisdictionId: "jurisdiction:ca-nb" },
    { designation: "21", layerId: "layer:ca-nb-wmz" },
  ]) {
    for (const locale of ZONE_LOCALES) {
      const presented = presentZone(input, locale);
      assert.equal(presented.status, "UNSUPPORTED_JURISDICTION");
      assert.equal(presented.fullLabel, input.designation);
      assert.equal(presented.compactLabel, input.designation);
      assert.equal(presented.termShort, null);
    }
  }
  assert.equal(presentZoneById("management_zone:us-nm-gmu-12", "en-CA", "GMU 12").fullLabel, "GMU 12");
  // The pre-existing fallback for a layer without a profile is unchanged.
  assert.equal(zoneDisplayLabel({ jurisdictionId: "jurisdiction:us-nm" as never, officialTermShort: "GMU" }, "12"), "GMU 12");
});

/* ── Locale never reaches a spatial or regulatory decision ─────────────── */

const QUEBEC_ENTRY = REGULATORY_REGISTRY.find((entry) => entry.jurisdictionId === "jurisdiction:ca-qc")!;
// The ministry's own WFS places both official-name points in 10O (part « Ouest »).
const PLACES = [
  { place: "Maniwaki", latitude: 46.3769, longitude: -75.9722 },
  { place: "Déléage", latitude: 46.3807098, longitude: -75.9190778 },
];

function resolved10O(): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: "management_zone:ca-qc-zone-10o" as ZoneResolution["zoneId"],
    jurisdictionId: "jurisdiction:ca-qc" as ZoneResolution["jurisdictionId"],
    officialName: "Zone de chasse 10O",
    boundaryDistanceMeters: 4_000,
    nearBoundary: false,
    sourceId: "source:ca-qc-zone-chasse-service" as ZoneResolution["sourceId"],
    message: "The point intersects one verified management-zone feature.",
  };
}

const noClosedTerritory = (async () =>
  new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), { status: 200 })) as unknown as typeof fetch;

test("3–4. Maniwaki and Déléage: one canonical zone, one regulatory answer, labels in two locales", async () => {
  const results = [];
  for (const { latitude, longitude } of PLACES) {
    const input: HuntInput = {
      latitude, longitude,
      date: "2026-09-27" as HuntInput["date"],
      speciesId: "species:moose" as HuntInput["speciesId"],
      answers: { HUNT_METHOD: "BOW" },
    };
    clearOverlayCache();
    const outcome = await QUEBEC_ENTRY.evaluate(input, resolved10O(), { verifiedAt: "2026-09-21", fetcher: noClosedTerritory, scope: "POINT" });
    results.push(outcome);
    const labels = presentZoneInAllLocales({ designation: "10O", jurisdictionId: "jurisdiction:ca-qc", zoneId: resolved10O().zoneId });
    assert.equal(labels["en-CA"].zoneId, labels["fr-CA"].zoneId);
    assert.equal(labels["en-CA"].fullLabel, "Zone 10 West");
    assert.equal(labels["fr-CA"].fullLabel, "Zone 10 Ouest");
  }
  assert.equal(results[0].regulation.status, "CONDITIONAL");
  // Evaluation takes no locale, so both places yield the identical answer and sources.
  assert.deepEqual(results[1].regulation, results[0].regulation);
  // The engine's prose names the zone as a reader would, never by its French code alone.
  assert.match(results[0].regulation.summary, /Zone 10 West/);
  assert.doesNotMatch(results[0].regulation.summary, /Zone de chasse 10O/);
});

test("5–6. map features carry the compact label; zone cards carry the full label", async () => {
  const quebec = layerById("layer:ca-qc-zone-chasse")!;
  clearZoneGeometryCache();
  const square = (west: number, south: number) => ({
    type: "Polygon",
    coordinates: [[[west, south], [west + 0.4, south], [west + 0.4, south + 0.4], [west, south + 0.4], [west, south]]],
  });
  const client = () => ({
    rpc: () => ({ abortSignal: () => Promise.resolve({ data: [
      { official_identifier: "10O", canonical_id: "management_zone:ca-qc-zone-10o", geometry: square(-76, 46.2) },
    ], error: null }) }),
  }) as unknown as Pick<SupabaseClient, "rpc">;
  const unreachable = (async () => { throw new Error("no authority call expected"); }) as unknown as typeof fetch;
  const drawn = await fetchLayerGeometry(quebec, { west: -77, south: 45.5, east: -75, north: 47 }, 7, unreachable, client);
  assert.equal(drawn.status, "OK");
  const feature = drawn.features.find((candidate) => candidate.name === "10O")!;
  assert.equal(feature.compactLabel, "10W");
  assert.equal(feature.accessibleLabel, "Zone 10 West, Québec");
  assert.equal(feature.label, "Zone 10 West");
  assert.equal(feature.name, "10O", "the feature is still keyed by the authority's designation");

  const card = await summarizeZone({ layerId: quebec.id, designation: "10O" }, "2026-09-27");
  assert.equal(card.zone.label, "Zone 10 West");
  assert.equal(card.zone.presentation.fullLabel, "Zone 10 West");
  assert.equal(card.zone.presentation.zoneId, "management_zone:ca-qc-zone-10o");
  assert.equal(card.zone.designation, "10O");
  assert.equal(card.zone.officialName, "Zone de chasse 10O");
});

test("British Columbia's 225 certified Management Units read as the regulation names them", () => {
  const layer = layerById("layer:ca-bc-mu")!;
  assert.equal(britishColumbia.officialIdentifiers.length, 225);
  for (const designation of britishColumbia.officialIdentifiers as string[]) {
    for (const locale of ZONE_LOCALES) {
      const presented = presentZone({ designation, layerId: layer.id }, locale);
      assert.equal(presented.status, "PRESENTED", `${designation} ${locale}`);
      // The hyphen is part of the designation and survives every label.
      assert.equal(presented.fullLabel, `MU ${designation}`);
      assert.equal(presented.compactLabel, designation);
      // B.C. Reg. 64/96 publishes the term in English only: kept, and said so.
      assert.equal(presented.localized, locale === "en-CA");
    }
  }
  const zoneId = zoneIdFor(layer, "7-15");
  assert.equal(zoneId, "management_zone:ca-bc-mu-7-15");
  assert.equal(presentZone({ designation: "7-15", layerId: layer.id }, "en-CA").accessibleLabel, "Management Unit 7-15, British Columbia");
  assert.equal(presentZoneById(zoneId, "en-CA", "Management Unit 7-15").sourceDesignation, "7-15");
  // Not a unit the regulation publishes: shown raw, never given a name.
  for (const designation of ["9-1", "7-0", "07-15", "7-15A"]) {
    assert.equal(presentZone({ designation, layerId: layer.id }).status, "UNRECOGNIZED_DESIGNATION", designation);
  }
});

test("Saskatchewan's zones in the ministry's terms, urban zones by their own codes", () => {
  const layerId = "layer:ca-sk-wmz";
  assert.equal(presentZone({ designation: "68N", layerId }).fullLabel, "WMZ 68N");
  assert.equal(presentZone({ designation: "SWMZ", layerId }).status, "PRESENTED");
  assert.equal(presentZone({ designation: "68N", layerId }, "fr-CA").localized, false);
});
