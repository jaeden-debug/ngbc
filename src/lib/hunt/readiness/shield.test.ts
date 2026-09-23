import assert from "node:assert/strict";
import { describe, it } from "node:test";
import bundle from "../../../../content/regulatory/readiness/ca-on-2026.json" with { type: "json" };
import { resolveReadiness } from "./index.ts";
import { REGULATORY_REGISTRY } from "../regulatory/registry.ts";
import type { RegulatoryResult, ZoneResolution } from "../types.ts";

/**
 * WHAT READY TO HUNT REFUSES TODAY, AND WHY — pinned before the requirements
 * engine changes how any of it is produced.
 *
 * The reason this file exists, in one sentence: a hunt that shows no checklist
 * today may show none because the checklist path had nothing to say, NOT
 * because North Ground established that nothing is required. If a later change
 * makes those hunts start producing rows, that reads as coverage and is
 * actually a shield removed — and the failure is silent, existing only in the
 * window between the old behaviour and the new.
 *
 * Measured 2026-09-24 over 280 Ontario combinations (8 species × 7 units ×
 * 5 dates), through the production path rather than by calling the resolver
 * directly:
 *
 *     CLOSED               46   no checklist
 *     NEEDS_VERIFICATION   75   no checklist
 *     UNKNOWN              85   no checklist
 *     CONDITIONAL          74   checklist, and every section populated
 *
 * So the refusal is not missing data. **The gate IS the shield**: 206 of 280
 * never reach a checklist, and the 74 that do are complete. Nothing can "light
 * up" an empty section here, because no empty section reaches a hunter.
 *
 * Which locates the real risk precisely. It is not that structured
 * requirements will fill gaps; it is that relaxing the gate — showing
 * requirements beside a CLOSED or an UNKNOWN answer, which will look like
 * helpfulness — would start producing checklists for 206 combinations,
 * including 85 where North Ground does not know the law. A checklist beside
 * UNKNOWN says we know the hunt is possible when we do not.
 */

const NOW = new Date("2026-09-21T15:00:00Z");
const ONTARIO = REGULATORY_REGISTRY.find((entry) => entry.jurisdictionId === "jurisdiction:ca-on")!;

function zoneOf(unit: string): ZoneResolution {
  return {
    status: "RESOLVED", zoneId: `management_zone:ca-on-wmu-${unit.toLowerCase()}`,
    jurisdictionId: "jurisdiction:ca-on", officialName: `WMU ${unit}`,
    sourceId: "source:ca-on-hunting-regulations-summary-2026", message: "",
  } as ZoneResolution;
}

async function evaluate(speciesId: string, unit: string, date: string) {
  const zone = zoneOf(unit);
  const outcome = await ONTARIO.evaluate({ speciesId, date, latitude: 45, longitude: -79 } as never, zone, { now: NOW } as never);
  const regulation = ((outcome as { regulation?: RegulatoryResult }).regulation ?? outcome) as RegulatoryResult;
  return { regulation, readiness: resolveReadiness({ speciesId, date }, zone, regulation, { now: NOW }) };
}

const SPECIES = Object.keys(bundle.speciesMethods).sort();
const UNITS = ["1A", "15A", "60", "71", "82C", "93C", "95"];
const DATES = ["2026-04-30", "2026-09-20", "2026-10-15", "2026-11-10", "2027-01-15"];

describe("what Ready to Hunt refuses, and why", () => {
  it("gives a checklist for exactly the CONDITIONAL hunts and no others", async () => {
    const counted: Record<string, number> = {};
    let reached = 0;
    for (const speciesId of SPECIES) for (const unit of UNITS) for (const date of DATES) {
      const { regulation, readiness } = await evaluate(speciesId, unit, date);
      counted[regulation.status] = (counted[regulation.status] ?? 0) + 1;
      if (readiness) reached += 1;
      /* The property, stated as an equivalence so neither direction can drift:
         a checklist beside CLOSED reads as an invitation, and beside UNKNOWN it
         claims we know the hunt is possible when we do not. */
      assert.equal(
        readiness !== undefined, regulation.status === "CONDITIONAL",
        `${speciesId} WMU ${unit} ${date}: status ${regulation.status} ${readiness ? "produced" : "produced no"} checklist`,
      );
    }
    assert.equal(Object.values(counted).reduce((a, b) => a + b, 0), 280);
    assert.equal(reached, counted.CONDITIONAL);
    /* Recorded baseline, 2026-09-24. If these move, the shield moved: find out
       whether the LAW changed or whether the gate did, before accepting it. */
    assert.deepEqual(counted, { CLOSED: 46, NEEDS_VERIFICATION: 75, UNKNOWN: 85, CONDITIONAL: 74 });
  });

  it("never shows a hunter a section with nothing in it", async () => {
    /* Every checklist that reaches a hunter today is complete. This is what
       makes the shield finding precise: structured requirements cannot fill a
       gap here, because there is no populated-but-empty state to fill. If this
       ever fails, an empty section is reaching someone and "nothing listed"
       will be read as "nothing required". */
    let checked = 0;
    for (const speciesId of SPECIES) for (const unit of UNITS) for (const date of DATES) {
      const { readiness } = await evaluate(speciesId, unit, date);
      if (!readiness) continue;
      checked += 1;
      const where = `${speciesId} WMU ${unit} ${date}`;
      assert.ok(readiness.authorizations.length > 0, `${where}: no authorizations`);
      assert.ok(readiness.orange, `${where}: no hunter-orange answer`);
      assert.ok(readiness.methods && readiness.methods.allowed.length > 0, `${where}: no legal method`);
      assert.equal(readiness.coverage, "VERIFIED", `${where}: Ontario is the built jurisdiction`);
    }
    assert.equal(checked, 74);
  });

  it("says a jurisdiction has no checklist rather than showing an empty one", async () => {
    /* The other refusal, and it must stay a SENTENCE rather than an empty
       card: an unbuilt jurisdiction with no limitations reads as "nothing
       needed here". */
    const zone = { ...zoneOf("60"), jurisdictionId: "jurisdiction:ca-mb", zoneId: "management_zone:ca-mb-gha-26" } as ZoneResolution;
    const regulation = { status: "CONDITIONAL" } as RegulatoryResult;
    const readiness = resolveReadiness({ speciesId: SPECIES[0], date: "2026-10-15" }, zone, regulation, { now: NOW })!;
    assert.equal(readiness.coverage, "UNAVAILABLE");
    assert.equal(readiness.authorizations.length, 0);
    assert.ok(readiness.limitations.length > 0, "an empty list with no explanation reads as 'nothing required'");
    assert.match(readiness.limitations[0], /has not built a Ready to Hunt checklist/);
  });
});
