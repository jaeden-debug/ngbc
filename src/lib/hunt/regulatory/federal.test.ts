import assert from "node:assert/strict";
import { test } from "node:test";
import type { IsoDate } from "../../content-contract/index.ts";
import type { RegulatoryResult } from "../types.ts";
import {
  composeFederalWithProvincial, evaluateFederal, federalSpeciesIds, isFederalMigratoryBird,
} from "./federal.ts";

const on = (value: string) => value as IsoDate;

const provincialUnknown: RegulatoryResult = {
  status: "UNKNOWN",
  summary: "not certified",
  legalTime: { status: "NOT_AVAILABLE", text: "" },
  requirements: [], limitations: [], sourceIds: [], verifiedAt: "2026-09-23T00:00:00Z",
};

test("wave 1 makes migratory species answerable, and grouse are not among them", () => {
  const ids = federalSpeciesIds();
  assert.ok(ids.includes("species:mallard"));
  assert.ok(ids.includes("species:canada-goose"));
  assert.ok(ids.includes("species:wilsons-snipe"));
  /* Ptarmigan and grouse are provincial upland game, not federal migratory
     birds, however much they look like the same kind of hunting. */
  assert.equal(isFederalMigratoryBird("species:ruffed-grouse"), false);
  assert.equal(isFederalMigratoryBird("species:rock-ptarmigan"), false);
});

test("Prince Edward Island: snipe inside the season is CONDITIONAL with its own dates", () => {
  /* Schedule 3 Part 2: Snipe, October 1 to December 31, daily 10, possession 20. */
  const answer = evaluateFederal("species:wilsons-snipe", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  assert.equal(answer.status, "CONDITIONAL");
  assert.equal(answer.season?.opens, "10-01");
  assert.equal(answer.season?.closes, "12-31");
  assert.equal(answer.sharedLimit?.daily, 10);
  assert.equal(answer.sharedLimit?.possession, 20);
});

test("a date outside every federal season is CLOSED, not UNKNOWN", () => {
  const answer = evaluateFederal("species:wilsons-snipe", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-07-04"));
  assert.equal(answer.status, "CLOSED");
});

test("a season that crosses the new year is inside on both sides of it", () => {
  /* PEI ducks run October 1 to January 15. */
  for (const date of ["2026-10-02", "2026-12-31", "2027-01-14"]) {
    const answer = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on(date));
    assert.equal(answer.status, "CONDITIONAL", date);
  }
  const outside = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-09-15"));
  assert.equal(outside.status, "CLOSED");
});

test("a point on a stated latitude does not get a federal season", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-yt", { latitude: 66 }, on("2026-09-20"));
  assert.equal(answer.status, "NEEDS_VERIFICATION");
  assert.equal(answer.season, undefined);
});

test("federal requirements ride with every answer, including a CLOSED one", () => {
  const closed = evaluateFederal("species:wilsons-snipe", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-07-04"));
  assert.ok(closed.requirements.some((line) => /Migratory Game Bird Hunting Permit/.test(line)));
  assert.ok(closed.requirements.some((line) => /Habitat Conservation Stamp/i.test(line)));
});

/* ── The limit is the group's, never the species' ────────────────────────── */

test("a shared limit always names what it is shared with", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  assert.ok(answer.sharedLimit, "a duck answer carries a limit");
  assert.match(answer.sharedLimit!.sharedWith, /Ducks/);
  assert.match(answer.sharedLimit!.sharedWith, /combined/);
});

test("composing states the limit as SHARED, in words, not as a number beside the species", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  const composed = composeFederalWithProvincial(answer, provincialUnknown, "Prince Edward Island");
  const shared = composed.limitations.find((line) => /SHARED/.test(line));
  assert.ok(shared, "the shared-limit sentence is present");
  assert.match(shared!, /not per species/);
  assert.match(shared!, /Ducks/);
});

/* ── Composition is conjunction ──────────────────────────────────────────── */

test("an uncertified province is said out loud, never implied away", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  const composed = composeFederalWithProvincial(answer, provincialUnknown, "Prince Edward Island");
  assert.equal(composed.status, "CONDITIONAL");
  assert.ok(
    composed.limitations.some((line) => /also apply, and North Ground has not certified them/.test(line)),
    "the province's own half is named as uncertified",
  );
  assert.ok(composed.sourceIds.includes("source:ca-federal-migratory-birds-regulations"));
});

test("a province that has certified a restriction can only bind harder, never looser", () => {
  const federal = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  for (const provincialStatus of ["CLOSED", "CONFLICT", "NEEDS_VERIFICATION"] as const) {
    const composed = composeFederalWithProvincial(
      federal, { ...provincialUnknown, status: provincialStatus }, "Prince Edward Island",
    );
    assert.equal(composed.status, provincialStatus, provincialStatus);
    assert.equal(composed.season, undefined, `${provincialStatus} shows no season`);
  }
});

test("both authorities' requirements survive composition", () => {
  const federal = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  const composed = composeFederalWithProvincial(
    federal,
    { ...provincialUnknown, status: "CONDITIONAL", requirements: ["A provincial small game licence"] },
    "Prince Edward Island",
  );
  assert.ok(composed.requirements.some((line) => /Migratory Game Bird Hunting Permit/.test(line)));
  assert.ok(composed.requirements.some((line) => /provincial small game licence/.test(line)));
});
