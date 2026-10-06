import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import type { CanonicalId } from "../../content-contract/index.ts";
import { openOn } from "../regulatory/opportunity-row.ts";
import { ZONE_LAYERS } from "../zone-layers.ts";
import { summarizeZone, zoneStatesForSpecies } from "./zone-summary.ts";

/**
 * ONE CANONICAL OPPORTUNITY SET, SEEN FROM TWO SURFACES.
 *
 * The map's green outline and the zone sheet's opportunity rows are produced by
 * two different derivations of the same engine: green from `opportunityOf`,
 * which walks the engine's answer tree, and the rows from the root evaluation's
 * `opportunities`. Nothing compared them, and they disagreed.
 *
 * WHAT WAS MEASURED BEFORE THIS EXISTED, over real certified bundles, 534
 * comparisons across 8 served layers:
 *
 *   green + an open row      190
 *   green + NO open row       49   <- every one of them Ontario
 *   an open row + NOT green    1
 *
 * Ontario was the only jurisdiction of fourteen whose `RegulatoryEntry` is
 * bespoke rather than built by `conditionalEntry`, and the only one that never
 * emitted opportunities at all: 37 of 37 open Ontario species-dates carried no
 * structured opportunity while every other jurisdiction carried one for every
 * open season. So the map asserted a current legal opportunity — which is
 * exactly what §41A's amended green means — while the card it opens had nothing
 * to name but prose.
 *
 * This test is the invariant, not the fix. It fails if any surface starts
 * answering from its own derivation again.
 */

const DATES = ["2026-10-15", "2026-11-20"] as const;
const UNITS_PER_LAYER = 2;

/**
 * Where green and the rows are KNOWN to differ, with the reason.
 *
 * Pinned rather than tolerated: a case that is not here fails, so a new
 * divergence cannot join the list quietly. Each entry is a defect or a pending
 * decision elsewhere, never a licence for the disagreement.
 */
const RECORDED_EXCEPTIONS: ReadonlyArray<{ speciesId: string; layerId: string; designation: string; why: string }> = [
  /*
   * Ontario small game publishes a `seasonPhrase` and no derived ISO windows,
   * so the adapter correctly yields no row — a row with an invented window
   * would put a date on screen the ministry never published. Deriving them is
   * certified regulatory work with its own provenance, not an architecture
   * change. Until then these four keep the prose summary under a green zone.
   */
  { speciesId: "species:ruffed-grouse", layerId: "layer:ca-on-wmu", designation: "10", why: "ON small game: seasonPhrase, no derived ISO windows" },
  { speciesId: "species:sharp-tailed-grouse", layerId: "layer:ca-on-wmu", designation: "10", why: "ON small game: seasonPhrase, no derived ISO windows" },
  { speciesId: "species:snowshoe-hare", layerId: "layer:ca-on-wmu", designation: "10", why: "ON small game: seasonPhrase, no derived ISO windows" },
  { speciesId: "species:spruce-grouse", layerId: "layer:ca-on-wmu", designation: "10", why: "ON small game: seasonPhrase, no derived ISO windows" },
  /*
   * Idaho controlled hunts: the rows carry the hunts that run on the date while
   * the tree walk returns NEEDS_CLOSER_LOOK, because a drawn tag is not
   * something the engine can establish a hunter holds. Whether a draw-qualified
   * hunt is a CURRENT legal opportunity under §41A's amended green is a product
   * decision with the owner; it is not settled here.
   */
  { speciesId: "species:pronghorn", layerId: "layer:us-id-gmu", designation: "29", why: "ID controlled hunt: draw-qualified, green semantics with the owner" },
];

function isRecorded(layerId: string, speciesId: string): string | undefined {
  return RECORDED_EXCEPTIONS.find((e) => e.speciesId === speciesId && e.layerId === layerId)?.why;
}

function certifiedUnits(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of readdirSync("content/regulatory").filter((n) => n.endsWith("certified-units.json"))) {
    const bundle = JSON.parse(readFileSync(`content/regulatory/${file}`, "utf8")) as {
      jurisdictionId?: string; certifiedUnits?: string[];
    };
    if (bundle.jurisdictionId && Array.isArray(bundle.certifiedUnits)) out.set(bundle.jurisdictionId, bundle.certifiedUnits);
  }
  return out;
}

test("the map's green and the zone sheet's rows describe the same opportunity set", async () => {
  const units = certifiedUnits();
  let greenWithRow = 0, compared = 0;
  const divergent: string[] = [];

  for (const layer of ZONE_LAYERS.filter((l) => l.serving && l.rulesServing)) {
    const designations = units.get(layer.jurisdictionId) ?? Object.keys(layer.officialNames ?? {});
    for (const designation of designations.slice(0, UNITS_PER_LAYER)) {
      for (const date of DATES) {
        let card: Awaited<ReturnType<typeof summarizeZone>>;
        try { card = await summarizeZone({ layerId: layer.id, designation }, date); } catch { continue; }
        for (const entry of card.species) {
          const [onMap] = await zoneStatesForSpecies(entry.speciesId as CanonicalId<"species">, date, [
            { layerId: layer.id, designation },
          ]);
          const green = onMap.opportunity.hasCurrentLegalOpportunity;
          const rowOpen = (entry.opportunities ?? []).some((row) => openOn(row, date));
          compared += 1;
          if (green && rowOpen) { greenWithRow += 1; continue; }
          if (green === rowOpen) continue;
          const recorded = isRecorded(layer.id, entry.speciesId);
          if (recorded) continue;
          divergent.push(
            `${layer.id} ${designation} ${entry.speciesId} ${date}: green=${green} openRow=${rowOpen} ` +
            `state=${entry.state} rows=${(entry.opportunities ?? []).length} coverage=${onMap.opportunity.coverage}`,
          );
        }
      }
    }
  }

  /*
   * THE POSITIVE CONTROL, and it is not optional. Every assertion below is
   * satisfied by comparing nothing: a renamed field, an empty unit list or a
   * throwing summary would turn this green while no surface was ever compared.
   * Green has to have been exercised, not merely never contradicted.
   */
  assert.ok(compared >= 100, `only ${compared} species-dates compared; the sweep has stopped finding its subjects`);
  assert.ok(greenWithRow >= 50, `green agreed with an open row only ${greenWithRow} times; green is barely being exercised`);

  assert.deepEqual(divergent, [],
    `a surface is answering from its own derivation again:\n  ${divergent.join("\n  ")}`);
});

test("every recorded exception still diverges, or it should be deleted", async () => {
  /*
   * An exception register rots in the quiet direction: a case fixed elsewhere
   * leaves an entry that now excuses nothing, and the next real divergence in
   * that species lands inside it unnoticed. So each entry is checked AT THE
   * UNIT IT WAS OBSERVED IN — an entry sampled somewhere it never diverged
   * would pass for the wrong reason, which is the failure this test would
   * otherwise have.
   */
  const dead: string[] = [];
  for (const exception of RECORDED_EXCEPTIONS) {
    let diverged = false;
    for (const date of DATES) {
      let card: Awaited<ReturnType<typeof summarizeZone>>;
      try { card = await summarizeZone({ layerId: exception.layerId, designation: exception.designation }, date); }
      catch { continue; }
      const entry = card.species.find((s) => s.speciesId === exception.speciesId);
      if (!entry) continue;
      const [onMap] = await zoneStatesForSpecies(exception.speciesId as CanonicalId<"species">, date, [
        { layerId: exception.layerId, designation: exception.designation },
      ]);
      const green = onMap.opportunity.hasCurrentLegalOpportunity;
      const rowOpen = (entry.opportunities ?? []).some((row) => openOn(row, date));
      if (green !== rowOpen) diverged = true;
    }
    if (!diverged) dead.push(`${exception.layerId} ${exception.designation} ${exception.speciesId} — ${exception.why}`);
  }
  assert.deepEqual(dead, [],
    `these exceptions no longer diverge and must be deleted rather than left excusing nothing:\n  ${dead.join("\n  ")}`);
});
