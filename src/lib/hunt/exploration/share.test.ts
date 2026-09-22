import assert from "node:assert/strict";
import test from "node:test";
import { huntSharePayload, shareHunt } from "./share.ts";

const ORIGIN = "https://www.northgroundbushcraft.com";
const context = {
  zone: { fullLabel: "WMU 8", jurisdictionName: "Ontario" },
  species: { displayName: "White-tailed deer" },
  date: "2026-09-22",
  state: { zoneId: "management_zone:ca-on-wmu-8" as const, speciesId: "species:white-tailed-deer" as const, date: null, explore: false },
};

test("a shared hunt names the zone, species and day, and links to the same state", () => {
  const payload = huntSharePayload(context, ORIGIN);
  assert.equal(payload.title, "White-tailed deer · WMU 8");
  assert.equal(payload.text, "White-tailed deer in WMU 8 (Ontario) on September 22, 2026 — view this hunt on North Ground.");
  assert.equal(payload.url, `${ORIGIN}/hunt?zone=ca-on-wmu-8&species=white-tailed-deer&date=2026-09-22`);
});

test("the shared day is always explicit, because 'today' is a different day tomorrow", () => {
  const payload = huntSharePayload({ ...context, state: { ...context.state, date: null } }, ORIGIN);
  assert.match(payload.url, /date=2026-09-22/);
});

test("the message never states a legal status or a location", () => {
  const payload = huntSharePayload(context, ORIGIN);
  const all = `${payload.title} ${payload.text} ${payload.url}`;
  assert.doesNotMatch(all, /\bopen\b|closed|in season|conditional|legal|allowed|permitted/i);
  assert.doesNotMatch(all, /lat|lng|longitude|latitude|-?\d+\.\d{3,}/i);
});

test("a zone without a species still shares as a zone", () => {
  const payload = huntSharePayload({ ...context, species: null, state: { ...context.state, speciesId: null } }, ORIGIN);
  assert.equal(payload.title, "WMU 8");
  assert.match(payload.text, /^WMU 8 \(Ontario\) on September 22, 2026/);
  assert.equal(payload.url, `${ORIGIN}/hunt?zone=ca-on-wmu-8&date=2026-09-22`);
});

test("device share first; a cancelled sheet is respected; otherwise the link is copied", async () => {
  const payload = huntSharePayload(context, ORIGIN);
  const copied: string[] = [];
  const clipboard = { writeText: async (text: string) => { copied.push(text); } };

  assert.equal(await shareHunt({ share: async () => {}, clipboard }, payload), "shared");
  assert.equal(await shareHunt({ share: async () => { throw new DOMException("x", "AbortError"); }, clipboard }, payload), "cancelled");
  assert.deepEqual(copied, [], "a cancelled share does not silently copy");
  assert.equal(await shareHunt({ clipboard }, payload), "copied");
  assert.deepEqual(copied, [payload.url]);
  assert.equal(await shareHunt({}, payload), "failed");
});
