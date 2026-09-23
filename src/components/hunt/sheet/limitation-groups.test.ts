import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalId } from "../../../lib/content-contract/index.ts";
import { contextual, critical, general, sourceDetail } from "../../../lib/hunt/limitation.ts";
import { groupLimitations, orphanCaveats, sourceCaveats } from "./limitation-groups.ts";

const QC = "source:ca-qc-zone-chasse-service" as CanonicalId<"source">;
const OTHER = "source:ca-on-summary" as CanonicalId<"source">;

test("each scope goes to the one place it belongs", () => {
  const groups = groupLimitations([
    general("North Ground is not the authority."),
    sourceDetail("« aucune portée légale »", QC, "fr-CA"),
    contextual("This point is near a mapped boundary.", "NEAR_BOUNDARY"),
    critical("A published refuge lies inside this zone."),
  ]);
  assert.deepEqual(groups.here.map((l) => l.scope), ["CRITICAL", "CONTEXTUAL"], "critical leads, and both stay out of a disclosure");
  assert.equal(groups.always.length, 1);
  assert.equal(groups.sources.length, 1);
});

test("nothing is lost and nothing is duplicated", () => {
  const lines = [general("a"), general("b"), critical("c"), sourceDetail("d", QC), contextual("e", "METHOD_UNKNOWN")];
  const groups = groupLimitations(lines);
  const seen = [...groups.here, ...groups.always, ...groups.sources].map((l) => l.id).sort();
  assert.deepEqual(seen, lines.map((l) => l.id).sort());
});

test("a caveat reaches the source it describes, and one whose source is absent is still found", () => {
  const groups = groupLimitations([sourceDetail("map caveat", QC), sourceDetail("summary caveat", OTHER)]);
  assert.deepEqual(sourceCaveats(groups, QC).map((l) => l.text), ["map caveat"]);
  assert.deepEqual(orphanCaveats(groups, [QC]).map((l) => l.text), ["summary caveat"]);
  assert.deepEqual(orphanCaveats(groups, [QC, OTHER]), [], "nothing is orphaned when every source is shown");
});

test("an empty answer groups into three empty lists rather than undefined", () => {
  assert.deepEqual(groupLimitations([]), { here: [], always: [], sources: [] });
});
