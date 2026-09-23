import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveZoneFromRegistry } from "./zone.ts";

/**
 * Labrador, where Québec and Newfoundland both publish hunting geography.
 *
 * Québec's zone 19N covers 99.8% of Newfoundland's moose area 050, 87.0% of
 * 049, 84.0% of 086 and 53.2% of 060; its black bear area 200 overlaps by
 * 28,904 km². Both geometries are the authorities' own and each is
 * parity-certified against its own source, so neither ingest is defective.
 * Serving Newfoundland did not create this conflict — it revealed one that was
 * always in the data and had been resolved silently in Québec's favour,
 * because Québec's was the only claim North Ground held.
 *
 * Until the owner rules on what North Ground says at a point two governments
 * both claim, the honest answer is a conflict that names every claimant. These
 * tests pin the two defects that made it dishonest, not the policy.
 */

const POINT = { latitude: 52.38076152, longitude: -62.50878603 };

function registry(rows: Array<{ canonical_id: string; official_name: string }>) {
  return (() => ({
    rpc: () => ({
      abortSignal: async () => ({
        data: rows.map((row) => ({
          ...row,
          location_accuracy: null,
          source_canonical_id: row.canonical_id.includes("ca-qc") ? "source:ca-qc-zone-chasse-service" : "source:ca-nl-big-game-area-service",
          boundary_distance_meters: 13_268,
          near_boundary: false,
          display_geometry: { type: "Polygon", coordinates: [[[-62.6, 52.3], [-62.4, 52.3], [-62.4, 52.5], [-62.6, 52.5], [-62.6, 52.3]]] },
        })),
        error: null,
      }),
    }),
  })) as unknown as () => SupabaseClient;
}

test("a point both governments claim reports a conflict naming every claimant", async () => {
  /*
   * All three rows the database now returns: Newfoundland's bear and moose
   * areas and Québec's zone. The bear area is species-scoped and drops out as
   * a location answer; what remains is two AUTHORITIES, which is the real
   * conflict and must be reported as one rather than silently resolved.
   */
  const result = await resolveZoneFromRegistry(POINT.latitude, POINT.longitude, registry([
    { canonical_id: "management_zone:ca-nl-bma-200", official_name: "Black Bear Management Area 200" },
    { canonical_id: "management_zone:ca-nl-mma-050", official_name: "Moose Management Area 050" },
    { canonical_id: "management_zone:ca-qc-zone-19n", official_name: "Zone de chasse 19N" },
  ]));

  assert.equal(result.status, "UNKNOWN", "a disputed point is never resolved to one claimant");
  assert.equal(result.zoneId, undefined);
  assert.match(result.message, /overlapping regulatory zones/);
  assert.match(result.message, /Moose Management Area 050/, "Newfoundland's claim is named");
  assert.match(result.message, /Zone de chasse 19N/, "Québec's claim is named — it was dropped by `limit 2` before this");

  // No authority is invented for an answer that has none. This cited Ontario.
  assert.equal(result.sourceId, undefined, "a conflict with no single authority cites none");
});

test("a species-scoped peer is not a second claimant, but it must not hide one either", async () => {
  /*
   * Newfoundland publishes moose, caribou and black bear areas over the same
   * ground by design, so its own layers stacking is normal and not a conflict.
   * The filter that removes them is only safe because the database now returns
   * every claimant: narrowing an already-truncated set turned a visible
   * conflict into a silent answer.
   */
  const stackedOnly = await resolveZoneFromRegistry(POINT.latitude, POINT.longitude, registry([
    { canonical_id: "management_zone:ca-nl-bma-200", official_name: "Black Bear Management Area 200" },
    { canonical_id: "management_zone:ca-nl-mma-050", official_name: "Moose Management Area 050" },
  ]));
  assert.equal(stackedOnly.status, "RESOLVED", "one jurisdiction's own species geographies are not in conflict");
  assert.equal(stackedOnly.zoneId, "management_zone:ca-nl-mma-050", "the location layer answers; the bear area is not a location answer");
  assert.equal(stackedOnly.sourceId, "source:ca-nl-big-game-area-service");
});

test("a point in one jurisdiction alone still resolves, and cites its own authority", async () => {
  const quebecOnly = await resolveZoneFromRegistry(51.0, -64.0, registry([
    { canonical_id: "management_zone:ca-qc-zone-19n", official_name: "Zone de chasse 19N" },
  ]));
  assert.equal(quebecOnly.status, "RESOLVED");
  assert.equal(quebecOnly.zoneId, "management_zone:ca-qc-zone-19n");
  assert.equal(quebecOnly.sourceId, "source:ca-qc-zone-chasse-service", "Québec's answer cites Québec, not Ontario");
});
