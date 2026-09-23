import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalId } from "../content-contract/index.ts";
import { hasSpeciesCoverageIn, speciesSelectableIn } from "./coverage.ts";
import { ZONE_LAYERS } from "./zone-layers.ts";

const BC = "jurisdiction:ca-bc" as CanonicalId<"jurisdiction">;
const ON = "jurisdiction:ca-on" as CanonicalId<"jurisdiction">;
const NL = "jurisdiction:ca-nl" as CanonicalId<"jurisdiction">;
const MOOSE = "species:moose" as CanonicalId<"species">;
const BEAR = "species:american-black-bear" as CanonicalId<"species">;

test("selectable is not answerable: a drawn jurisdiction can be explored before its rules are certified", () => {
  /* British Columbia is drawn and resolves points; no rule there is certified.
     A hunter must still be able to choose a species and learn their zone. */
  assert.equal(speciesSelectableIn(MOOSE, BC), true, "the geography is served, so it can be chosen");
  assert.equal(hasSpeciesCoverageIn({ regulatoryJurisdictions: [] }, BC), false, "and nothing is answered there");
  assert.equal(speciesSelectableIn(MOOSE, ON), true);
  assert.equal(
    hasSpeciesCoverageIn({ regulatoryJurisdictions: [{ id: ON, name: "Ontario", asksQuestion: false }] }, ON),
    true,
    "Ontario is both selectable and answerable",
  );
});

test("with no place in hand every species is selectable: the map has not been asked yet", () => {
  assert.equal(speciesSelectableIn(MOOSE, undefined), true);
});

test("a species-scoped jurisdiction only offers the species it has geography for", () => {
  /* Newfoundland writes its seasons in species geographies. Whether a species
     is selectable there follows which of those layers are served, so the
     selector can never offer a species whose boundary cannot be drawn. */
  const served = ZONE_LAYERS.filter((layer) => layer.jurisdictionId === NL && layer.serving);
  const scoped = new Set(served.flatMap((layer) => layer.speciesScope ?? []));
  const unscoped = served.some((layer) => !layer.speciesScope);
  for (const species of [MOOSE, BEAR]) {
    assert.equal(
      speciesSelectableIn(species, NL),
      unscoped || scoped.has(species),
      `${species} follows Newfoundland's served geographies`,
    );
  }
});
