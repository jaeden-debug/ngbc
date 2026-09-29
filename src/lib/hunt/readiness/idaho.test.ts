import assert from "node:assert/strict";
import test from "node:test";
import { resolveIdahoReadiness } from "./idaho.ts";

test("Idaho pronghorn Ready to Hunt states the certified licence and controlled-tag requirements", () => {
  const result = resolveIdahoReadiness({
    speciesId: "species:pronghorn",
    date: "2026-10-01",
    zoneId: "management_zone:us-id-gmu-29",
    answers: {},
  });
  assert.equal(result.coverage, "PARTIAL");
  assert.deepEqual(result.authorizations.map((item) => [item.id, item.status]), [
    ["authorization:us-id-hunting-license", "REQUIRED"],
    ["authorization:us-id-controlled-hunt-tag", "REQUIRED"],
  ]);
  assert.equal(result.authorizations[1].draw?.required, true);
  assert.equal(result.requirements?.every((row) => row.statement.state === "REQUIRED"), true);
  assert.ok(result.limitations.some((line) => /orange.*not yet certified/i.test(line)));
});

test("Idaho readiness does not leak from pronghorn to an uncertified species", () => {
  const result = resolveIdahoReadiness({
    speciesId: "species:elk",
    date: "2026-10-01",
    zoneId: "management_zone:us-id-gmu-29",
    answers: {},
  });
  assert.equal(result.coverage, "UNAVAILABLE");
  assert.deepEqual(result.authorizations, []);
});
