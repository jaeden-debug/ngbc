import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { makeGroupResolver } from "../../../scripts/lib/take-group-resolution.mjs";
import { capabilitiesOf, eligibilityFromBundles, offeredAsQuarry, SPECIES_TAKE_ELIGIBILITY, takeEligibilityOf } from "./species-eligibility.ts";
import { PUBLISHED_SPECIES_BUNDLES } from "./species-route.ts";
import { takeListingsFor } from "./species-take-evidence.ts";

/**
 * CI invariants for the species catalogue → eligibility → take evidence →
 * coverage chain. Each fails on the named species, jurisdiction or row.
 */

type Row = Record<string, string>;
function csv(path: string): Row[] {
  const [head, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const keys = head.split(",");
  return lines.map((line) => {
    const values: string[] = [];
    let cell = "", quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (quoted) {
        if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = false; else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { values.push(cell); cell = ""; } else cell += char;
    }
    values.push(cell);
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ""]));
  });
}

type Resource = { type?: string; status?: string; speciesProfile?: { speciesId: string; scientificName: string; conservationStatus?: unknown[] } };
const resources = (PUBLISHED_SPECIES_BUNDLES as Array<{ resources?: Resource[] }>).flatMap((bundle) => bundle.resources ?? []).filter((resource) => resource.type === "species");
const catalogueIds = new Set(resources.map((resource) => resource.speciesProfile!.speciesId));
const matrix = csv("research/hunting/species-take-matrix.csv");
const coverage = csv("research/hunting/species-jurisdiction-coverage.csv");

/* ── Group inheritance: synthetic adversarial cases ─────────────────────── */

const SYNTHETIC: Record<string, { title: string; scientific: string; family: string; eligibility: string; where: string[] }> = {
  "species:tundra-swan": { title: "Tundra swan", scientific: "Cygnus columbianus", family: "Anatidae", eligibility: "HUNTABLE", where: ["us-nv", "us-id"] },
  "species:trumpeter-swan": { title: "Trumpeter swan", scientific: "Cygnus buccinator", family: "Anatidae", eligibility: "LIMITED_TAKE", where: ["us-nv", "us-id"] },
  "species:sandhill-crane": { title: "Sandhill crane", scientific: "Antigone canadensis", family: "Gruidae", eligibility: "HUNTABLE", where: ["us-tx"] },
  "species:whooping-crane": { title: "Whooping crane", scientific: "Grus americana", family: "Gruidae", eligibility: "NON_QUARRY", where: ["us-tx"] },
  "species:western-diamondback-rattlesnake": { title: "Western diamondback rattlesnake", scientific: "Crotalus atrox", family: "Viperidae", eligibility: "LIMITED_TAKE", where: ["us-az"] },
  "species:eastern-diamondback-rattlesnake": { title: "Eastern diamondback rattlesnake", scientific: "Crotalus adamanteus", family: "Viperidae", eligibility: "LIMITED_TAKE", where: ["us-fl"] },
  "species:eastern-cottontail": { title: "Eastern cottontail", scientific: "Sylvilagus floridanus", family: "Leporidae", eligibility: "HUNTABLE", where: ["us-tx"] },
  "species:black-tailed-jackrabbit": { title: "Black-tailed jackrabbit", scientific: "Lepus californicus", family: "Leporidae", eligibility: "HUNTABLE", where: ["us-tx"] },
};

type GroupOutcome = { state: string; members: string[]; excluded: unknown[]; basis: string };
type GroupRow = { jurisdiction: string; rawName: string; status: string; listedAs: string };

function syntheticResolver(closedPairs: string[] = []): (row: GroupRow) => GroupOutcome {
  const catalogue = new Map(Object.entries(SYNTHETIC).map(([id, record]) => [id, { title: record.title, scientific: record.scientific, family: record.family, genus: record.scientific.split(" ")[0], groups: [] }]));
  const occurrence = Object.fromEntries(Object.entries(SYNTHETIC).map(([id, record]) => [id, {
    status: "FOUND",
    jurisdictions: Object.fromEntries(record.where.map((code) => [`jurisdiction:${code}`, { present: true }])),
  }]));
  return makeGroupResolver({
    catalogue, occurrence,
    byCommonName: new Map([...catalogue].map(([id, record]) => [record.title.toLowerCase(), id])),
    shortNames: new Map(),
    eligibilityOf: (id: string) => SYNTHETIC[id]?.eligibility ?? "UNKNOWN",
    federalGroups: [],
    mbta: [{ group: "Swan", scientificName: "Cygnus columbianus" }, { group: "Swan", scientificName: "Cygnus buccinator" }],
    closedPairs: new Set(closedPairs),
  });
}
const row = (jurisdiction: string, rawName: string, status = "OPEN_SEASON") => ({ jurisdiction, rawName, status, listedAs: "GROUP" });

test("a broad swan rule never makes trumpeter swan take by inheritance", () => {
  const resolve = syntheticResolver();
  assert.ok(resolve(row("us-id", "Swans")).members.includes("species:tundra-swan"), "positive control: the rule reaches its HUNTABLE member");
  for (const name of ["Swans", "Swan", "Tundra and other swans"]) {
    const outcome = resolve(row("us-id", name));
    assert.ok(!outcome.members.includes("species:trumpeter-swan"), `${name}: trumpeter attributed by inheritance`);
  }
});

test("a genus the source names may reach a LIMITED_TAKE member; a closure by name still wins", () => {
  assert.ok(syntheticResolver()(row("us-nv", "Swans (Cygnus)")).members.includes("species:trumpeter-swan"));
  const closed = syntheticResolver(["species:trumpeter-swan|us-nv"])(row("us-nv", "Swans (Cygnus)"));
  assert.ok(!closed.members.includes("species:trumpeter-swan"), "a same-jurisdiction closure was re-opened by a group rule");
  assert.equal(closed.state, "PARTIAL_GROUP_WITH_EXCLUSIONS");
});

test("a NON_QUARRY species is never a member, even of a family the source names", () => {
  const outcome = syntheticResolver()(row("us-tx", "Cranes (family Gruidae)"));
  assert.ok(!outcome.members.includes("species:whooping-crane"));
});

test("a group member the range records do not place here is not attributed", () => {
  const outcome = syntheticResolver()(row("us-az", "Rattlesnakes (Crotalus)"));
  assert.deepEqual(outcome.members, ["species:western-diamondback-rattlesnake"]);
});

test("a qualified group row never falls back to its bare word", () => {
  const outcome = syntheticResolver()(row("us-tx", "Rabbit (Jack)"));
  assert.ok(!outcome.members.includes("species:eastern-cottontail"), "Rabbit (Jack) fell back to every rabbit");
});

test("a blocked source resolves to BLOCKED_SOURCE, never to members", () => {
  const outcome = syntheticResolver()(row("us-tx", "Rabbits", "UNVERIFIED_SEASON"));
  assert.equal(outcome.state, "BLOCKED_SOURCE");
  assert.deepEqual(outcome.members, []);
});

/* ── Group inheritance: the published matrix ────────────────────────────── */

test("no published group attribution reaches a NON_QUARRY or UNKNOWN species, or a LIMITED_TAKE one unnamed", () => {
  const bad = matrix.filter((entry) => entry.published === "Y" && entry.resolution.startsWith("GROUP:")).filter((entry) => {
    const eligibility = takeEligibilityOf(entry.speciesId);
    return eligibility === "NON_QUARRY" || eligibility === "UNKNOWN" || (eligibility === "LIMITED_TAKE" && !entry.resolution.endsWith(":NAMED"));
  });
  assert.deepEqual(bad.map((entry) => `${entry.speciesId} ${entry.jurisdiction} ${entry.rawName}`), []);
});

test("no published group attribution re-opens a species the same jurisdiction closes by name", () => {
  const closed = new Set(matrix.filter((entry) => entry.status === "CLOSED_THIS_YEAR" && entry.speciesId && !entry.resolution.startsWith("GROUP:")).map((entry) => `${entry.speciesId}|${entry.jurisdiction}`));
  assert.ok(closed.size > 0, "positive control: the audit records named closures");
  const reopened = matrix.filter((entry) => entry.published === "Y" && entry.resolution.startsWith("GROUP:") && closed.has(`${entry.speciesId}|${entry.jurisdiction}`));
  assert.deepEqual(reopened.map((entry) => `${entry.speciesId} ${entry.jurisdiction} ${entry.rawName}`), []);
});

test("trumpeter swan: listed only where an authority names it, with its conditions, and never through a group", () => {
  const listings = takeListingsFor("species:trumpeter-swan");
  assert.deepEqual(listings.map((listing) => listing.jurisdictionId), ["jurisdiction:us-nv"]);
  assert.ok((listings[0]?.conditions?.length ?? 0) > 0, "Nevada's quota condition is carried");
  assert.equal(matrix.filter((entry) => entry.speciesId === "species:trumpeter-swan" && entry.published === "Y" && entry.resolution.startsWith("GROUP:") && !entry.resolution.endsWith(":NAMED")).length, 0);
  assert.equal(capabilitiesOf(takeEligibilityOf("species:trumpeter-swan")).speciesHeat, false);
});

/* ── Canonical identity ─────────────────────────────────────────────────── */

test("no duplicate taxa: one species id and one binomial per catalogue entry", () => {
  const ids = resources.map((resource) => resource.speciesProfile!.speciesId);
  assert.equal(new Set(ids).size, ids.length, "duplicate species id");
  const binomials = resources.map((resource) => resource.speciesProfile!.scientificName.toLowerCase().split(/\s+/).slice(0, 2).join(" "));
  const repeated = binomials.filter((name, index) => binomials.indexOf(name) !== index);
  assert.deepEqual(repeated, []);
});

test("every take listing and every coverage row references a canonical catalogue species", () => {
  const strays = [...new Set([...matrix.filter((entry) => entry.speciesId).map((entry) => entry.speciesId), ...coverage.map((entry) => entry.speciesId)])].filter((id) => !catalogueIds.has(id));
  assert.deepEqual(strays, []);
});

test("every catalogue species has an occurrence record, and a synonym never hides a mismatch", () => {
  const occurrence = JSON.parse(readFileSync("research/hunting/species-occurrence.json", "utf8")).species as Record<string, { status: string; scientificName: string }>;
  const missing = [...catalogueIds].filter((id) => !occurrence[id]);
  assert.deepEqual(missing, []);
  const drifted = resources.filter((resource) => occurrence[resource.speciesProfile!.speciesId].scientificName !== resource.speciesProfile!.scientificName).map((resource) => resource.speciesProfile!.speciesId);
  assert.deepEqual(drifted, [], "occurrence was fetched for another name; re-run scripts/fetch-species-occurrence.mjs --only <id>");
});

/* ── Eligibility and surfaces ───────────────────────────────────────────── */

test("eligibility has provenance: every non-UNKNOWN class rests on listings, a finding or a research note", () => {
  const readiness = JSON.parse(readFileSync("research/hunting/species-readiness.json", "utf8")).species as Array<{ speciesId: string; eligibility: string; eligibilityEvidence: string }>;
  const bare = readiness.filter((entry) => entry.eligibility !== "UNKNOWN" && entry.eligibilityEvidence === "NONE").map((entry) => entry.speciesId);
  assert.ok(readiness.length === catalogueIds.size, "positive control: the report covers the catalogue");
  assert.deepEqual(bare, []);
});

test("Hunt offers exactly the species whose class grants it", () => {
  const offered = new Set(offeredAsQuarry(resources as Array<{ type: string }>).map((resource) => resource.speciesProfile.speciesId));
  const expected = [...SPECIES_TAKE_ELIGIBILITY].filter(([, eligibility]) => capabilitiesOf(eligibility).offeredInHunt).map(([id]) => id);
  assert.deepEqual([...offered].sort(), expected.sort());
  assert.ok(offered.size > 400, "positive control: the offered set is the catalogue, not an empty filter");
});

test("the surface universe follows eligibility: no surface or plan for a species without heat", () => {
  const registry = JSON.parse(readFileSync("content/intelligence/surface-registry.json", "utf8")) as { surfaces: Array<{ speciesId: string }> };
  const strategy = JSON.parse(readFileSync("content/intelligence/spatial-strategy.json", "utf8")) as { species: Record<string, { next?: unknown[] }> };
  assert.deepEqual(registry.surfaces.filter((surface) => !capabilitiesOf(takeEligibilityOf(surface.speciesId)).speciesHeat).map((surface) => surface.speciesId), []);
  assert.deepEqual(Object.entries(strategy.species).filter(([id, entry]) => entry.next?.length && !capabilitiesOf(takeEligibilityOf(id)).speciesHeat).map(([id]) => id), []);
  assert.deepEqual([...catalogueIds].filter((id) => !strategy.species[id]), [], "a catalogue species is missing from the spatial strategy");
});

test("conservation statements never change eligibility", () => {
  const stripped = (PUBLISHED_SPECIES_BUNDLES as Array<{ resources?: Resource[] }>).map((bundle) => ({
    ...bundle,
    resources: (bundle.resources ?? []).map((resource) => resource.speciesProfile ? { ...resource, speciesProfile: { ...resource.speciesProfile, conservationStatus: [] } } : resource),
  }));
  assert.deepEqual([...eligibilityFromBundles(stripped)], [...SPECIES_TAKE_ELIGIBILITY]);
});

/* ── Coverage states ────────────────────────────────────────────────────── */

test("UNKNOWN is never CLOSED, and NOT_RESEARCHED is never NOT_APPLICABLE", () => {
  const states = new Set(coverage.map((entry) => entry.state));
  assert.ok(!states.has("CLOSED"), "the coverage matrix has no CLOSED state; a missing rule is not a prohibition");
  const dimensionColumns = Object.keys(coverage[0]).filter((key) => key.endsWith("Resolvable"));
  const claimed = coverage.filter((entry) => entry.rulesStructured !== "YES" && dimensionColumns.some((key) => entry[key] === "NOT_APPLICABLE" || entry[key] === "RESOLVED"));
  assert.deepEqual(claimed.map((entry) => `${entry.speciesId} ${entry.jurisdictionId}`), [], "a dimension was resolved or ruled out without any rule read");
});

test("blocked sources stay visible in the coverage matrix", () => {
  const blocked = csv("research/hunting/take-audit-status.csv").filter((entry) => entry.audit_status === "BLOCKED_SOURCE").map((entry) => entry.jurisdiction_id);
  assert.ok(blocked.length > 0, "positive control: some audit sources are blocked");
  const invisible = blocked.filter((id) => !coverage.some((entry) => entry.jurisdictionId === id && (entry.state === "SOURCE_BLOCKED" || entry.sourceStatus === "BLOCKED_SOURCE")));
  assert.deepEqual(invisible, []);
});

test("the readiness report is current with the data it measures", () => {
  execFileSync(process.execPath, ["scripts/report-species-readiness.mjs", "--check"], { stdio: "pipe" });
});
