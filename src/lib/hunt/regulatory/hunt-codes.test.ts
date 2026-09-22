import assert from "node:assert/strict";
import test from "node:test";
import { decodeHuntCode, huntCodeId, type HuntCodeFormat } from "./hunt-codes.ts";

/* A structured format in the shape Colorado publishes. The legend here is a
   fixture; each state's real legend is read from its own source by its builder. */
const format: HuntCodeFormat = {
  jurisdictionId: "jurisdiction:us-test",
  authorityTerm: "hunt code",
  pattern: "^(?<species>[A-Z])-(?<sex>[A-Z])-(?<unit>\\d{3})-(?<season>[A-Z]\\d)-(?<method>[A-Z])$",
  legends: {
    species: [{ symbol: "E", meaning: "Elk" }, { symbol: "D", meaning: "Deer" }],
    sex: [{ symbol: "M", meaning: "Male" }, { symbol: "F", meaning: "Female" }, { symbol: "E", meaning: "Either sex" }],
    season: [{ symbol: "O1", meaning: "First rifle season" }],
    method: [{ symbol: "R", meaning: "Rifle" }, { symbol: "A", meaning: "Archery" }],
  },
  sourceId: "source:test",
  sourceSection: "Hunt code legend",
};

test("a structured code decodes only through its published legend, with the unit carried verbatim", () => {
  const decoded = decodeHuntCode(format, "E-E-054-O1-R");
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;
  assert.deepEqual(decoded.parts, [
    { part: "species", symbol: "E", meaning: "Elk" },
    { part: "sex", symbol: "E", meaning: "Either sex" },
    { part: "unit", symbol: "054" },
    { part: "season", symbol: "O1", meaning: "First rifle season" },
    { part: "method", symbol: "R", meaning: "Rifle" },
  ]);
});

test("the same symbol means different things in different positions, and is read per position", () => {
  const decoded = decodeHuntCode(format, "E-E-054-O1-R");
  assert.ok(decoded.ok);
  if (!decoded.ok) return;
  assert.equal(decoded.parts.find((part) => part.part === "species")?.meaning, "Elk");
  assert.equal(decoded.parts.find((part) => part.part === "sex")?.meaning, "Either sex");
});

test("an undefined symbol or a malformed code is refused, never guessed", () => {
  const unknown = decodeHuntCode(format, "E-E-054-O1-Z");
  assert.equal(unknown.ok, false);
  assert.match(unknown.ok ? "" : unknown.reason, /"Z".*not defined for method/);
  assert.equal(decodeHuntCode(format, "E-E-54-O1-R").ok, false);
  assert.equal(decodeHuntCode(format, "e-e-054-o1-r").ok, false);
});

test("hunt code ids are stable, lower-case and never collapse to a species id", () => {
  assert.equal(huntCodeId("us-co", "E-E-054-O1-R"), "hunt_code:us-co-e-e-054-o1-r");
  assert.equal(huntCodeId("us-nm", "ELK-1-100"), "hunt_code:us-nm-elk-1-100");
  assert.equal(huntCodeId("us-id", "1144"), "hunt_code:us-id-1144");
  assert.throws(() => huntCodeId("us-id", " -- "));
});
