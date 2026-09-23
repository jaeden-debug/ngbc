import { general } from "../hunt/limitation.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
  copyHuntBriefLink,
  createHuntBriefRequestPayload,
  invokeNativeShare,
} from "./client.ts";
import { huntEvaluationToShareInput } from "./from-hunt-evaluation.ts";
import {
  createShareableHuntBrief,
  HUNT_BRIEF_STATUSES,
  parseStoredHuntBrief,
} from "./model.ts";
import { createHuntBriefRequestHandler } from "./request.ts";
import {
  generateHuntBriefShareId,
  getHuntBrief,
  persistHuntBrief,
} from "./service.ts";
import {
  InMemoryHuntBriefStore,
  InMemoryShareCreationLimiter,
} from "./store.ts";
import { huntBriefFixture, huntShareInput, testShareId } from "./test-fixture.ts";
import { huntBriefUrl } from "./urls.ts";

test("share projection strips coordinates and all private location inputs", () => {
  const brief = createShareableHuntBrief(huntShareInput(), {
    shareId: testShareId,
    createdAt: "2026-09-20T12:00:00Z",
  });
  const serialized = JSON.stringify(brief);

  assert.equal(brief.generalLocationLabel, "Near Bancroft");
  assert.doesNotMatch(serialized, /45\.057|-77\.857|private cabin|K0L|Private Road|private-account|private-session/);

  const unapproved = createShareableHuntBrief(
    huntShareInput({ location: { generalLabel: "Secret trail", shareApproved: false, latitude: 45, longitude: -77 } }),
    { shareId: testShareId, createdAt: "2026-09-20T12:00:00Z" },
  );
  assert.equal(unapproved.generalLocationLabel, undefined);
});

test("HuntEvaluation adapter preserves the engine result and excludes coordinates", () => {
  const input = huntEvaluationToShareInput({
    completeness: "RESOLVED",
    dimensions: [],
    input: {
      latitude: 45.23,
      longitude: -77.94,
      date: "2026-10-24",
      speciesId: "species:ruffed-grouse",
    },
    species: {
      id: "species:ruffed-grouse",
      name: "Ruffed grouse",
      canonicalPath: "/hunting/species/ruffed-grouse",
    },
    zone: {
      status: "RESOLVED",
      zoneId: "management_zone:ca-on-wmu-57",
      officialName: "Wildlife Management Unit 57",
      sourceId: "source:ca-on-wmu-service",
      message: "Resolved from the official service.",
    },
    regulation: {
      status: "CONDITIONAL",
      summary: "Conditions apply.",
      legalTime: { status: "RULE_ONLY", text: "Verified rule summary." },
      requirements: ["Licence required."],
      limitations: [general("Check local restrictions.")],
      sourceIds: ["source:ca-on-small-game-2026"],
      verifiedAt: "2026-09-20",
    },
    weather: {
      status: "UNAVAILABLE",
      summary: "Forecast unavailable.",
      date: "2026-10-24",
      sourceId: "source:open-meteo",
    },
    knowledge: {
      contractVersion: "1.0",
      resolvedLocale: "en-CA",
      fallbackUsed: false,
      context: { locale: "en-CA", activityId: "activity:hunting" },
      blocks: [],
      warnings: [],
      revision: "2026-09-20T12:00:00Z",
    },
    sources: [],
    evaluatedAt: "2026-09-20T12:00:00Z",
  }, {
    jurisdiction: { id: "jurisdiction:ca-on", displayName: "Ontario" },
  });

  assert.equal(input.regulatory.status, "CONDITIONAL");
  assert.equal(input.weather?.status, "unavailable");
  assert.doesNotMatch(JSON.stringify(input), /45\.23|-77\.94/);
});

test("client creation payload also strips private fields before transmission", () => {
  const payload = createHuntBriefRequestPayload(huntShareInput());
  assert.deepEqual(payload.location, { generalLabel: "Near Bancroft", shareApproved: true });
  assert.equal("privateContext" in payload, false);
});

test("share IDs are opaque, random and accepted by storage lookup", () => {
  const first = generateHuntBriefShareId();
  const second = generateHuntBriefShareId();
  assert.match(first, /^[A-Za-z0-9_-]{24}$/);
  assert.notEqual(first, second);
});

test("persistence creates an immutable snapshot and reads it back", async () => {
  const store = new InMemoryHuntBriefStore();
  const brief = await persistHuntBrief(huntShareInput(), {
    store,
    generateId: () => testShareId,
    now: () => new Date("2026-09-20T12:00:00Z"),
  });
  const result = await getHuntBrief(testShareId, store);
  assert.equal(result.status, "found");
  if (result.status === "found") assert.deepEqual(result.brief, brief);
});

test("invalid and missing share IDs do not resolve", async () => {
  const store = new InMemoryHuntBriefStore();
  assert.deepEqual(await getHuntBrief("1", store), { status: "invalid_id" });
  assert.deepEqual(await getHuntBrief(testShareId, store), { status: "missing" });
});

test("all regulatory statuses are preserved without simplification", () => {
  for (const status of HUNT_BRIEF_STATUSES) {
    const brief = createShareableHuntBrief(
      huntShareInput({ regulatory: { status, summary: `Result is ${status}.` } }),
      { shareId: testShareId, createdAt: "2026-09-20T12:00:00Z" },
    );
    assert.equal(brief.regulatory.status, status);
  }
});

test("unsupported snapshot versions fail gracefully", () => {
  for (const version of [0, 5, 99]) {
    assert.deepEqual(parseStoredHuntBrief({ ...huntBriefFixture(), version }), {
      status: "unsupported_version",
      version,
    });
  }
  assert.deepEqual(parseStoredHuntBrief({ ...huntBriefFixture(), version: "2" }), {
    status: "unsupported_version",
    version: null,
  });
});

test("a version 1 brief is still readable and gains no assumptions it never had", () => {
  // Version 1 predates conditional species. Reading one must reproduce exactly
  // what was stored — not upgrade it, and not attribute assumptions to a hunter
  // who was never asked anything.
  const stored = { ...huntBriefFixture(), version: 1 };
  delete (stored as { assumptions?: unknown }).assumptions;

  const parsed = parseStoredHuntBrief(stored);
  assert.equal(parsed.status, "found");
  if (parsed.status !== "found") return;
  assert.equal(parsed.brief.version, 1);
  assert.deepEqual(parsed.brief.assumptions, []);
  assert.equal(parsed.brief.regulatory.status, stored.regulatory.status);
  assert.equal(parsed.brief.regulatory.summary, stored.regulatory.summary);
});

test("a version 1 brief cannot acquire assumptions from its stored payload", () => {
  // Defence against a record that was tampered with or migrated badly: the
  // version, not the payload, decides whether assumptions may exist.
  const parsed = parseStoredHuntBrief({
    ...huntBriefFixture(),
    version: 1,
    assumptions: [{ question: "Are you a resident of Ontario?", answer: "Resident" }],
  });
  assert.equal(parsed.status, "found");
  if (parsed.status !== "found") return;
  assert.deepEqual(parsed.brief.assumptions, []);
});

test("a version 2 brief round-trips the hunter's own answers", () => {
  const assumptions = [
    { question: "Are you a resident of Ontario?", answer: "Resident" },
    { question: "What will you hunt with?", answer: "Shotgun" },
  ];
  const parsed = parseStoredHuntBrief({ ...huntBriefFixture(), version: 2, assumptions });
  assert.equal(parsed.status, "found");
  if (parsed.status !== "found") return;
  assert.equal(parsed.brief.version, 2);
  assert.deepEqual(parsed.brief.assumptions, assumptions);
});

const AUTHORIZATION = {
  requirement: "DRAW_REQUIRED",
  huntCodes: [{ code: "E-E-054-O1-R", authorityTerm: "hunt code", allocationTerm: "limited licence", quota: "150 licences" }],
  draws: ["Applications for the 2026 primary draw closed April 7, 2026; results are due by May 29, 2026."],
  statedAs: "This season is open under hunt code E-E-054-O1-R only to holders of a limited licence issued through the draw. North Ground cannot see whether you applied, were drawn, or hold one.",
};

test("a version 4 brief keeps the hunt a result rests on, and how its licence is issued", () => {
  const parsed = parseStoredHuntBrief({ ...huntBriefFixture(), version: 4, authorization: AUTHORIZATION });
  assert.equal(parsed.status, "found");
  if (parsed.status !== "found") return;
  assert.deepEqual(parsed.brief.authorization, AUTHORIZATION);
});

test("a brief from before version 4 never acquires a hunt code it was not created with", () => {
  for (const version of [1, 2, 3]) {
    const parsed = parseStoredHuntBrief({ ...huntBriefFixture(), version, authorization: AUTHORIZATION });
    assert.equal(parsed.status, "found");
    if (parsed.status !== "found") return;
    assert.equal(parsed.brief.authorization, undefined);
  }
});

test("a malformed authorization refuses the brief rather than being trimmed", () => {
  assert.equal(parseStoredHuntBrief({ ...huntBriefFixture(), version: 4, authorization: { ...AUTHORIZATION, requirement: "YOU_CAN_HUNT" } }).status, "invalid");
  assert.equal(parseStoredHuntBrief({ ...huntBriefFixture(), version: 4, authorization: { ...AUTHORIZATION, huntCodes: [] } }).status, "invalid");
});

test("creation endpoint validates, rate limits and returns an opaque URL", async () => {
  const handler = createHuntBriefRequestHandler({
    canonicalOrigin: "https://northgroundbushcraft.com",
    rateLimitSecret: "test-secret",
    limiter: new InMemoryShareCreationLimiter(1),
    persist: async () => huntBriefFixture(),
  });
  const request = () => new Request("https://northgroundbushcraft.com/api/hunt/share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://northgroundbushcraft.com",
      "X-Forwarded-For": "203.0.113.10",
    },
    body: JSON.stringify(huntShareInput()),
  });
  const created = await handler(request());
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), {
    ok: true,
    shareId: testShareId,
    url: huntBriefUrl(testShareId),
  });
  const limited = await handler(request());
  assert.equal(limited.status, 429);
});

test("native share and copy-link fallbacks report outcomes", async () => {
  assert.equal(await invokeNativeShare({}, { title: "Brief", url: "https://example.com" }), "unsupported");
  assert.equal(
    await invokeNativeShare({ share: async () => undefined }, { title: "Brief", url: "https://example.com" }),
    "shared",
  );
  let copied = "";
  assert.equal(
    await copyHuntBriefLink({ clipboard: { writeText: async (value) => { copied = value; } } }, "https://example.com/brief"),
    "copied",
  );
  assert.equal(copied, "https://example.com/brief");
  assert.equal(await copyHuntBriefLink({}, "https://example.com/brief"), "failed");
});

test("a brief's warnings are bounded, and anything beyond the bound is said, not dropped", async () => {
  const { HUNT_BRIEF_MAX_WARNINGS, createShareableHuntBrief: create } = await import("./model.ts");
  const make = (count: number) => huntEvaluationToShareInput({
    completeness: "RESOLVED",
    dimensions: [],
    input: { latitude: 45.23, longitude: -77.94, date: "2026-10-24", speciesId: "species:ruffed-grouse" },
    species: { id: "species:ruffed-grouse", name: "Ruffed grouse", canonicalPath: "/hunting/species/ruffed-grouse" },
    zone: { status: "RESOLVED", zoneId: "management_zone:ca-on-wmu-57", officialName: "Wildlife Management Unit 57", sourceId: "source:ca-on-wmu-service", message: "Resolved." },
    regulation: {
      status: "CONDITIONAL",
      summary: "Conditions apply.",
      legalTime: { status: "RULE_ONLY", text: "Verified rule summary." },
      requirements: Array.from({ length: count }, (_, index) => `Requirement ${index + 1}.`),
      limitations: [],
      sourceIds: ["source:ca-on-small-game-2026"],
      verifiedAt: "2026-09-20",
    },
    weather: { status: "UNAVAILABLE", summary: "Forecast unavailable.", date: "2026-10-24", sourceId: "source:open-meteo" },
    knowledge: { contractVersion: "1.0", resolvedLocale: "en-CA", fallbackUsed: false, context: { locale: "en-CA", activityId: "activity:hunting" }, blocks: [], warnings: [], revision: "2026-09-20T12:00:00Z" },
    sources: [],
    evaluatedAt: "2026-09-20T12:00:00Z",
  }, { jurisdiction: { id: "jurisdiction:ca-on", displayName: "Ontario" } });
  const exact = make(HUNT_BRIEF_MAX_WARNINGS).warnings!;
  assert.equal(exact.length, HUNT_BRIEF_MAX_WARNINGS);
  assert.ok(!exact.some((line) => /not shown in this brief/.test(line)));
  const over = make(HUNT_BRIEF_MAX_WARNINGS + 5).warnings!;
  assert.equal(over.length, HUNT_BRIEF_MAX_WARNINGS);
  assert.equal(over.at(-1), "6 further conditions and limitations are not shown in this brief. Check the current Hunt result for all of them.");
  // The schema still refuses more than the bound; the projection never sends it.
  const input = make(HUNT_BRIEF_MAX_WARNINGS);
  assert.throws(() => create({ ...input, warnings: [...input.warnings!, "one too many"] }, { shareId: "hb_boundedWarnings000001", createdAt: "2026-09-21T12:00:00Z" }), /too many/);
});
