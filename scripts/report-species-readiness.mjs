#!/usr/bin/env node
/**
 * The species readiness matrix: every canonical species, every stage, every
 * jurisdiction — generated from repository data, never typed.
 *
 * "485 species published" is a catalogue fact. Whether a hunter can get a
 * certified answer for a species in a zone is a different fact per species and
 * jurisdiction, and this report keeps them apart so nobody can say "all animals
 * are done" while most of them lack rules.
 *
 * Writes:
 *   research/hunting/species-readiness.json         — per species, every stage
 *   research/hunting/species-jurisdiction-coverage.csv — species × jurisdiction
 *   docs/species-readiness.md                        — the summary and workload
 *
 *   node scripts/report-species-readiness.mjs [--check]
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PUBLISHED_SPECIES_BUNDLES } from "../src/lib/content/species-route.ts";
import { capabilitiesOf, takeEligibilityOf } from "../src/lib/content/species-eligibility.ts";
import { takeListingsFor } from "../src/lib/content/species-take-evidence.ts";
import { speciesSelectableIn } from "../src/lib/hunt/coverage.ts";
import { northAmericaCoverageReport } from "../src/lib/hunt/north-america/report.ts";
import { FEDERAL_GROUPS } from "../src/lib/hunt/regulatory/federal-groups.ts";
import { profileFor, resolves } from "../src/lib/hunt/regulatory/dimension-matrix.ts";
import { spatialStrategyFor } from "../src/lib/hunt/intelligence/spatial-strategy.ts";
import { ZONE_LAYERS } from "../src/lib/hunt/zone-layers.ts";
import { CANADA_JURISDICTIONS } from "../src/lib/hunt/canada/registry.ts";
import { UNITED_STATES_JURISDICTIONS } from "../src/lib/hunt/united-states/registry.ts";

const ROOT = resolve(import.meta.dirname, "..");
const CHECK = process.argv.includes("--check");
const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
function csv(text) {
  const [head, ...lines] = text.trim().split("\n");
  const keys = head.split(",");
  return lines.map((line) => {
    const values = []; let cell = "", quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(cell); cell = ""; }
      else cell += char;
    }
    values.push(cell);
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ""]));
  });
}
const cell = (value) => { const text = String(value ?? "").replace(/\s+/g, " ").trim(); return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };

/* ── Inputs, all from the repository ─────────────────────────────────────── */
const species = [];
const entities = new Map();
for (const bundle of PUBLISHED_SPECIES_BUNDLES) {
  for (const entity of bundle.entities ?? []) if (entity.type === "species") entities.set(entity.id, entity);
  for (const resource of bundle.resources ?? []) if (resource.type === "species") species.push(resource);
}
const occurrence = JSON.parse(read("research/hunting/species-occurrence.json")).species;
const findings = csv(read("research/hunting/take-eligibility-conflicts.csv"));
const auditStatus = new Map(csv(read("research/hunting/take-audit-status.csv")).map((row) => [row.jurisdiction_id, row]));
const matrixRows = csv(read("research/hunting/species-take-matrix.csv"));
const groupRows = csv(read("research/hunting/take-group-resolutions.csv"));
const production = (() => { try { return JSON.parse(read("research/hunting/species-production-verification.json")); } catch { return null; } })();
const auditedJurisdictions = new Set(matrixRows.map((row) => `jurisdiction:${row.jurisdiction}`));

/* Certified rules per species and jurisdiction: provincial/state bundles from
   the national coverage report, plus federal migratory rules by group. */
const report = northAmericaCoverageReport();
const certified = new Map(); // speciesId -> Map(jurisdictionId -> { source, full })
const note = (speciesId, jurisdictionId, value) => {
  const map = certified.get(speciesId) ?? new Map();
  map.set(jurisdictionId, { ...(map.get(jurisdictionId) ?? {}), ...value });
  certified.set(speciesId, map);
};
for (const jurisdiction of [...report.canada.jurisdictions, ...report.unitedStates.jurisdictions]) {
  for (const row of jurisdiction.species) {
    note(row.speciesId, jurisdiction.id, { provincial: row.unitsUnknown === 0 ? "FULL" : "PARTIAL", unitsCovered: row.unitsCovered, unitsUnknown: row.unitsUnknown });
  }
}
const federal = JSON.parse(read("content/regulatory/ca-federal-2026.json"));
const groupMembers = new Map(FEDERAL_GROUPS.map((group) => [group.id, group.members]));
for (const rule of federal.rules) for (const id of groupMembers.get(rule.groupId) ?? []) note(id, rule.jurisdictionId, { federal: true });

/* Rules per species and jurisdiction, for dimension measurement. */
const rulesBy = new Map();
for (const file of readdirSync(resolve(ROOT, "content/regulatory")).filter((name) => name.endsWith(".json"))) {
  let bundle; try { bundle = JSON.parse(read(`content/regulatory/${file}`)); } catch { continue; }
  for (const rule of bundle.rules ?? []) {
    const ids = rule.speciesId ? [rule.speciesId] : groupMembers.get(rule.groupId) ?? [];
    const jurisdictionId = rule.jurisdictionId ?? bundle.jurisdictionId;
    for (const id of ids) {
      const key = `${id}|${jurisdictionId}`;
      rulesBy.set(key, [...(rulesBy.get(key) ?? []), rule]);
    }
  }
}
const DIMENSIONS = [["currentSeasonResolvable", "DATES"], ["animalClassResolvable", "ANIMAL_CLASS"], ["implementResolvable", "IMPLEMENT"], ["limitResolvable", "LIMITS"], ["authorizationResolvable", "AUTHORIZATION"], ["conditionsResolvable", "CONDITIONS"], ["hoursResolvable", "LEGAL_HOURS"]];
function dimension(speciesId, jurisdictionId, dim, blocked) {
  const rules = rulesBy.get(`${speciesId}|${jurisdictionId}`) ?? [];
  if (!rules.length) return blocked ? "BLOCKED_SOURCE" : "NOT_RESEARCHED";
  if (rules.every((rule) => resolves(rule, dim))) return "RESOLVED";
  /* NOT_APPLICABLE needs evidence: only the declared dimension profile saying
     the authority does not normally use it, and only where rules were read. */
  if (profileFor(speciesId)?.[dim] === "NOT_NORMALLY_MATERIAL") return "NOT_APPLICABLE";
  return "UNRESOLVED";
}

const servedJurisdictions = new Set(ZONE_LAYERS.filter((layer) => layer.serving).map((layer) => layer.jurisdictionId));
const names = new Map([...CANADA_JURISDICTIONS, ...UNITED_STATES_JURISDICTIONS].map(({ id, nameEn }) => [id, nameEn]));
const allJurisdictions = [...names.keys()].filter((id) => id !== "jurisdiction:ca-federal");
const unresolvedGroupJurisdictions = new Map();
for (const row of groupRows) {
  if (!["UNRESOLVED", "BLOCKED_SOURCE", "GROUP_RULE_LEGALLY_APPLICABLE"].includes(row.state)) continue;
  unresolvedGroupJurisdictions.set(`jurisdiction:${row.jurisdiction}`, (unresolvedGroupJurisdictions.get(`jurisdiction:${row.jurisdiction}`) ?? 0) + 1);
}

/* ── Per species × jurisdiction ──────────────────────────────────────────── */
const coverageRows = [];
function jurisdictionState(speciesId, jurisdictionId, listing, rules) {
  const blocked = auditStatus.get(jurisdictionId)?.audit_status === "BLOCKED_SOURCE";
  const here = occurrence[speciesId]?.status === "FOUND" ? occurrence[speciesId].jurisdictions?.[jurisdictionId] : undefined;
  if (listing && rules?.provincial === "FULL") return "TAKE_ESTABLISHED_RULES_CERTIFIED";
  if (listing && (rules?.provincial === "PARTIAL" || rules?.federal)) return "TAKE_ESTABLISHED_RULES_PARTIAL";
  if (listing) return "TAKE_ESTABLISHED_RULES_NOT_INGESTED";
  if (rules) return "RULES_CERTIFIED_NO_AUDIT_LISTING";
  /* Range before a blocked source: an animal NatureServe does not record in New
     Jersey is not waiting on New Jersey's website. */
  if (occurrence[speciesId]?.status === "FOUND" && (!here || !here.present)) return "OUTSIDE_SUPPORTED_RANGE";
  if (blocked) return "SOURCE_BLOCKED";
  if (auditedJurisdictions.has(jurisdictionId) && here?.present) return "NO_TAKE_EVIDENCE";
  return "UNKNOWN";
}

const perSpecies = [];
for (const resource of species.sort((a, b) => a.id.localeCompare(b.id))) {
  const id = resource.speciesProfile.speciesId;
  const eligibility = takeEligibilityOf(id);
  const capabilities = capabilitiesOf(eligibility);
  const listings = takeListingsFor(id);
  const listed = new Map(listings.map((listing) => [listing.jurisdictionId, listing]));
  const rules = certified.get(id) ?? new Map();
  const entity = entities.get(id);
  const eligibilityEvidence = listings.length ? "TAKE_LISTINGS"
    : findings.some((row) => row.species_id === id) ? "RECORDED_FINDING"
    : (resource.speciesProfile.conservationStatus ?? []).length ? "CONSERVATION_STATUS"
    : (resource.speciesProfile.taxonomicNotes ?? []).length ? "RESEARCH_NOTE" : "NONE";
  const jurisdictions = {};
  if (capabilities.offeredInHunt) {
    for (const jurisdictionId of allJurisdictions) {
      const state = jurisdictionState(id, jurisdictionId, listed.get(jurisdictionId), rules.get(jurisdictionId));
      const blocked = auditStatus.get(jurisdictionId)?.audit_status === "BLOCKED_SOURCE";
      jurisdictions[jurisdictionId] = state;
      if (state === "OUTSIDE_SUPPORTED_RANGE" || (state === "UNKNOWN" && !listed.has(jurisdictionId))) continue;
      const row = {
        speciesId: id, jurisdictionId, state,
        takeEvidence: listed.has(jurisdictionId) ? "LISTED" : state === "NO_TAKE_EVIDENCE" ? "NONE_IN_AUDIT" : state === "SOURCE_BLOCKED" ? "BLOCKED_SOURCE" : "NOT_LISTED",
        zonesServed: servedJurisdictions.has(jurisdictionId) && speciesSelectableIn(id, jurisdictionId) ? "YES" : "NO",
        rulesResearched: rules.has(jurisdictionId) ? "YES" : blocked ? "BLOCKED_SOURCE" : "NOT_RESEARCHED",
        rulesStructured: rulesBy.has(`${id}|${jurisdictionId}`) ? "YES" : "NO",
        rulesCertified: rules.get(jurisdictionId)?.provincial ?? (rules.get(jurisdictionId)?.federal ? "FEDERAL_ONLY" : "NO"),
        ...Object.fromEntries(DIMENSIONS.map(([column, dim]) => [column, dimension(id, jurisdictionId, dim, blocked)])),
        sourceStatus: auditStatus.get(jurisdictionId)?.audit_status ?? (auditedJurisdictions.has(jurisdictionId) ? "AUDITED" : "NOT_AUDITED"),
      };
      coverageRows.push(row);
    }
  }
  const counts = Object.values(jurisdictions).reduce((acc, state) => ({ ...acc, [state]: (acc[state] ?? 0) + 1 }), {});
  const strategy = spatialStrategyFor(id);
  const certifiedAnywhere = [...rules.values()].some((value) => value.provincial);
  const surfaceRequired = capabilities.speciesHeat;
  /* A surface is any certified tier the canonical strategy serves (§41B), not only the survey's. */
  const hasSurface = strategy.tier !== "NO_SURFACE";
  const prod = production?.species?.[id];
  perSpecies.push({
    speciesId: id,
    name: resource.title,
    scientificName: resource.speciesProfile.scientificName,
    aliases: (entity?.aliases ?? []).filter((alias) => alias.type !== "scientific_name").length,
    group: resource.speciesProfile.speciesGroupIds?.[0] ?? null,
    eligibility,
    eligibilityEvidence,
    conservationStatements: (resource.speciesProfile.conservationStatus ?? []).length,
    stages: {
      CATALOGUED: true,
      ELIGIBILITY_RESEARCHED: eligibilityEvidence !== "NONE",
      TAKE_EVIDENCE_RESEARCHED: listings.length > 0 || findings.some((row) => row.species_id === id),
      SPECIES_PAGE_PUBLISHED: resource.status === "published",
      HUNT_SELECTABLE: capabilities.offeredInHunt,
      JURISDICTIONS_MAPPED: listings.length,
      ZONES_REACHABLE: capabilities.offeredInHunt ? [...servedJurisdictions].filter((jurisdictionId) => speciesSelectableIn(id, jurisdictionId)).length : 0,
      RULE_COVERAGE: !capabilities.offeredInHunt ? "NOT_APPLICABLE" : certifiedAnywhere ? ([...rules.values()].every((value) => value.provincial === "FULL") && (counts.TAKE_ESTABLISHED_RULES_NOT_INGESTED ?? 0) === 0 ? "FULL" : "PARTIAL") : [...rules.values()].some((value) => value.federal) ? "FEDERAL_ONLY" : "NONE",
      SURFACE_COVERAGE: !surfaceRequired ? "NOT_REQUIRED" : hasSurface ? "SURFACE" : `NO_SURFACE_${strategy.blocker?.reason ?? "UNEXPLAINED"}`,
      PRODUCTION_VERIFIED: prod ? prod.pageStatus === 200 && prod.inPicker === capabilities.offeredInHunt : null,
    },
    jurisdictionStates: counts,
    photo: null,
  });
}

/* ── Outputs ─────────────────────────────────────────────────────────────── */
const COLUMNS = ["speciesId", "jurisdictionId", "state", "takeEvidence", "zonesServed", "rulesResearched", "rulesStructured", "rulesCertified", ...DIMENSIONS.map(([column]) => column), "sourceStatus"];
const coverageCsv = `${[COLUMNS.join(","), ...coverageRows.map((row) => COLUMNS.map((key) => cell(row[key])).join(","))].join("\n")}\n`;
const readinessJson = `${JSON.stringify({ generatedBy: "scripts/report-species-readiness.mjs", species: perSpecies }, null, 1)}\n`;

const by = (key) => perSpecies.reduce((acc, row) => ({ ...acc, [key(row)]: (acc[key(row)] ?? 0) + 1 }), {});
const eligible = perSpecies.filter((row) => row.stages.HUNT_SELECTABLE);
const stateTotals = coverageRows.reduce((acc, row) => ({ ...acc, [row.state]: (acc[row.state] ?? 0) + 1 }), {});
const groupTotals = groupRows.reduce((acc, row) => ({ ...acc, [row.state]: (acc[row.state] ?? 0) + 1 }), {});
const top = (rows, n) => rows.slice(0, n).map((row) => `| ${row.name} | ${row.eligibility} | ${row.stages.JURISDICTIONS_MAPPED} | ${row.jurisdictionStates.TAKE_ESTABLISHED_RULES_CERTIFIED ?? 0} | ${row.jurisdictionStates.TAKE_ESTABLISHED_RULES_PARTIAL ?? 0} | ${row.jurisdictionStates.TAKE_ESTABLISHED_RULES_NOT_INGESTED ?? 0} | ${row.stages.SURFACE_COVERAGE} |`).join("\n");
const workload = [...eligible].sort((a, b) => (b.jurisdictionStates.TAKE_ESTABLISHED_RULES_NOT_INGESTED ?? 0) - (a.jurisdictionStates.TAKE_ESTABLISHED_RULES_NOT_INGESTED ?? 0) || a.name.localeCompare(b.name));
const markdown = `# Species readiness

Generated by \`scripts/report-species-readiness.mjs\` from repository data. Do not edit by hand; \`--check\` fails when it is stale.

**A published page is not a complete species.** Each stage below is measured on its own.

## Catalogue

| | count |
|---|---|
| Canonical species | ${perSpecies.length} |
${Object.entries(by((row) => row.eligibility)).sort().map(([key, value]) => `| ${key} | ${value} |`).join("\n")}
| Hunt-selectable | ${eligible.length} |
| Eligibility with evidence | ${perSpecies.filter((row) => row.stages.ELIGIBILITY_RESEARCHED).length} |
| With take listings | ${perSpecies.filter((row) => row.stages.JURISDICTIONS_MAPPED > 0).length} |
| With conservation statements | ${perSpecies.filter((row) => row.conservationStatements > 0).length} |

## Rule coverage (Hunt-selectable species)

| Rule coverage | species |
|---|---|
${Object.entries(eligible.reduce((acc, row) => ({ ...acc, [row.stages.RULE_COVERAGE]: (acc[row.stages.RULE_COVERAGE] ?? 0) + 1 }), {})).sort().map(([key, value]) => `| ${key} | ${value} |`).join("\n")}

FULL: certified in every jurisdiction where take is established. PARTIAL: certified somewhere, not everywhere. FEDERAL_ONLY: only Canadian federal migratory rules, which answer at a point but not yet on zone cards. NONE: take established or not, no certified rule anywhere.

## Species × jurisdiction states

| State | pairs |
|---|---|
${Object.entries(stateTotals).sort().map(([key, value]) => `| ${key} | ${value} |`).join("\n")}

UNKNOWN is never CLOSED, and a missing rule is never a prohibition. OUTSIDE_SUPPORTED_RANGE rests on NatureServe occurrence and is omitted from the CSV.

## Surfaces (Hunt-selectable species)

| Surface | species |
|---|---|
${Object.entries(eligible.reduce((acc, row) => ({ ...acc, [row.stages.SURFACE_COVERAGE]: (acc[row.stages.SURFACE_COVERAGE] ?? 0) + 1 }), {})).sort().map(([key, value]) => `| ${key} | ${value} |`).join("\n")}

## Production

${production ? `Checked ${production.checkedAt.slice(0, 10)} against ${production.base} (\`scripts/verify-species-production.mjs\`): page 200 and picker membership matching eligibility for ${perSpecies.filter((row) => row.stages.PRODUCTION_VERIFIED).length} of ${perSpecies.length} species. Failed: ${perSpecies.filter((row) => row.stages.PRODUCTION_VERIFIED === false).length}. Not checked: ${perSpecies.filter((row) => row.stages.PRODUCTION_VERIFIED === null).length}.` : "Not verified: run `scripts/verify-species-production.mjs`."}

## Group rows

| Resolution | rows |
|---|---|
${Object.entries(groupTotals).sort().map(([key, value]) => `| ${key} | ${value} |`).join("\n")}

## Largest regulatory workload

Species with the most jurisdictions where take is established and rules are not yet ingested.

| Species | eligibility | take listed | certified | partial | not ingested | surface |
|---|---|---|---|---|---|---|
${top(workload, 40)}

## Reference species

| Species | eligibility | take listed | certified | partial | not ingested | surface |
|---|---|---|---|---|---|---|
${top(["species:white-tailed-deer", "species:american-alligator", "species:wild-boar", "species:mallard", "species:moose", "species:american-black-bear", "species:trumpeter-swan", "species:burmese-python"].map((id) => perSpecies.find((row) => row.speciesId === id)).filter(Boolean), 20)}
`;

const outputs = [
  ["research/hunting/species-jurisdiction-coverage.csv", coverageCsv],
  ["research/hunting/species-readiness.json", readinessJson],
  ["docs/species-readiness.md", markdown],
];
if (CHECK) {
  const stale = outputs.filter(([path, content]) => { try { return read(path) !== content; } catch { return true; } }).map(([path]) => path);
  if (stale.length) { console.error(`stale: ${stale.join(", ")} — run node scripts/report-species-readiness.mjs`); process.exit(1); }
  console.log("species readiness is current");
} else {
  for (const [path, content] of outputs) writeFileSync(resolve(ROOT, path), content);
  console.log(`${perSpecies.length} species, ${eligible.length} Hunt-selectable, ${coverageRows.length} species × jurisdiction rows`);
}
