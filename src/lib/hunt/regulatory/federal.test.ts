import { legalTimeNotCertified } from "./legal-time.ts";
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
  legalTime: legalTimeNotCertified("", "test authority"),
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
  const shared = composed.limitations.find((line) => /SHARED/.test(line.text));
  assert.ok(shared, "the shared-limit sentence is present");
  assert.match(shared!.text, /not per species/);
  assert.match(shared!.text, /Ducks/);
});

/* ── Composition is conjunction ──────────────────────────────────────────── */

test("an uncertified province is said out loud, never implied away", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  const composed = composeFederalWithProvincial(answer, provincialUnknown, "Prince Edward Island");
  assert.equal(composed.status, "CONDITIONAL");
  assert.ok(
    composed.limitations.some((line) => /also apply, and North Ground has not certified them/.test(line.text)),
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

/* ── A refused row still covers real dates ───────────────────────────────── */

test("a date inside a season this build REFUSED answers UNKNOWN, never CLOSED", () => {
  /*
   * Schedule 3 Part 12: Central Yukon ducks are open "(i) August 15 to August
   * 31, for residents of Yukon only". That row is refused because the season
   * varies by residency — so North Ground does not know whether THIS hunter
   * may hunt, which is different from knowing they may not.
   *
   * Telling a Yukon resident CLOSED on August 20 would state a restriction
   * stricter than the law. That is a false regulatory claim, and a quiet one:
   * nobody complains about being wrongly told no.
   */
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-yt", { latitude: 64 }, on("2026-08-20"));
  assert.equal(answer.status, "UNKNOWN");
  assert.notEqual(answer.status, "CLOSED");
  assert.ok(
    answer.limitations.some((line) => /residency/.test(line) && /August 15 to August 31/.test(line)),
    "the refused season is quoted so a hunter can read what was not encoded",
  );
});

test("a date outside every season, encoded or refused, is still CLOSED", () => {
  /* Southern Yukon ducks run September 1 to October 31 with no August row at
     all, so December really is closed rather than unknown. */
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-yt", { latitude: 60.5 }, on("2026-12-10"));
  assert.equal(answer.status, "CLOSED");
});

test("Alberta ducks are UNKNOWN rather than CLOSED, because their row varies by residency", () => {
  const answer = evaluateFederal("species:mallard", "jurisdiction:ca-ab", { latitude: 53.5 }, on("2026-10-01"), "200");
  assert.equal(answer.status, "UNKNOWN");
});

test("Alberta geese, whose row does not vary by residency, do answer", () => {
  /* Zone No. 1: Canada Geese, Cackling Geese and White-fronted Geese,
     September 1 to December 16, daily 8. */
  const answer = evaluateFederal("species:canada-goose", "jurisdiction:ca-ab", { latitude: 53.5 }, on("2026-10-01"), "200");
  assert.equal(answer.status, "CONDITIONAL");
  assert.equal(answer.sharedLimit?.daily, 8);
  assert.match(answer.sharedLimit!.sharedWith, /Canada Geese, Cackling Geese and White-fronted Geese/);
});

test("Alberta Zone No. 2 opens a week later than Zone No. 1, and the map knows which unit is which", () => {
  /* Zone 1: September 1 to December 16. Zone 2: September 8 to December 23. */
  const zone2Unit = "102";
  assert.equal(evaluateFederal("species:canada-goose", "jurisdiction:ca-ab", { latitude: 53 }, on("2026-09-03"), zone2Unit).status, "CLOSED");
  assert.equal(evaluateFederal("species:canada-goose", "jurisdiction:ca-ab", { latitude: 53 }, on("2026-09-03"), "200").status, "CONDITIONAL");
  assert.equal(evaluateFederal("species:canada-goose", "jurisdiction:ca-ab", { latitude: 53 }, on("2026-12-20"), zone2Unit).status, "CONDITIONAL");
});

test("Northern Yukon sandhill crane is a DECLARED closure", () => {
  const answer = evaluateFederal("species:sandhill-crane", "jurisdiction:ca-yt", { latitude: 67.5 }, on("2026-09-20"));
  assert.equal(answer.status, "CLOSED");
  assert.match(answer.summary, /declare no open season/);
});
