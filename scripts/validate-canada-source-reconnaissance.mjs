#!/usr/bin/env node

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Ajv = require("ajv");

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_MANIFEST_PATH = path.join(ROOT_DIR, "research/hunting/canada-source-reconnaissance.json");
const DEFAULT_SCHEMA_PATH = path.join(ROOT_DIR, "research/hunting/canada-source-reconnaissance.schema.json");

const EXPECTED_JURISDICTIONS = new Map([
  ["jurisdiction:ca-bc", "CA-BC"], ["jurisdiction:ca-ab", "CA-AB"],
  ["jurisdiction:ca-sk", "CA-SK"], ["jurisdiction:ca-mb", "CA-MB"],
  ["jurisdiction:ca-nb", "CA-NB"], ["jurisdiction:ca-ns", "CA-NS"],
  ["jurisdiction:ca-pe", "CA-PE"], ["jurisdiction:ca-nl", "CA-NL"],
  ["jurisdiction:ca-yt", "CA-YT"], ["jurisdiction:ca-nt", "CA-NT"],
  ["jurisdiction:ca-nu", "CA-NU"],
]);
const GIS_STATES = new Set(["VERIFIED_MACHINE_READABLE", "PARTIAL_SPECIES_GEOGRAPHY", "MAP_ONLY", "NO_COMPREHENSIVE_SYSTEM", "UNRESOLVED"]);
const LEGAL_STANDINGS = new Set(["AUTHORITATIVE", "OFFICIAL_BUT_INDICATIVE", "REFERENCE_ONLY", "UNRESOLVED"]);
const LICENCE_CLASSIFICATIONS = new Set(["OPEN", "RESTRICTED", "CONFLICTING", "UNRESOLVED", "NOT_APPLICABLE"]);
const REGULATION_STATES = new Set(["CURRENT_PRIMARY_AND_SUMMARY_FOUND", "PRIMARY_FOUND_SUMMARY_NEEDS_REVIEW", "CURRENT_SUMMARY_FOUND_PRIMARY_COMPLEX", "PARTIAL"]);
const READINESS_STATES = new Set(["READY_FOR_INGESTION", "SOURCE_FOUND_NEEDS_REVIEW", "GIS_BLOCKED", "REGULATION_SOURCE_BLOCKED", "LICENCE_BLOCKED", "MULTIPLE_BLOCKERS"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttps(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function requireValue(errors, condition, location, message) {
  if (!condition) errors.push(`${location}: ${message}`);
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

export function validateManifest(manifest, schema) {
  const errors = [];
  requireValue(errors, schema?.$schema === "http://json-schema.org/draft-07/schema#", "schema.$schema", "must use JSON Schema draft 7");
  requireValue(errors, schema?.properties?.jurisdictions?.minItems === 11, "schema.properties.jurisdictions", "must require all 11 jurisdictions");
  requireValue(errors, schema?.properties?.jurisdictions?.maxItems === 11, "schema.properties.jurisdictions", "must reject extra jurisdictions");

  try {
    const validateSchema = new Ajv({ allErrors: true, jsonPointers: true }).compile(schema);
    if (!validateSchema(manifest)) {
      for (const error of validateSchema.errors ?? []) {
        errors.push(`schema${error.dataPath || "/"}: ${error.message}`);
      }
    }
  } catch (error) {
    errors.push(`schema: could not compile (${error instanceof Error ? error.message : String(error)})`);
  }
  requireValue(errors, manifest?.version === 1, "version", "must equal 1");
  requireValue(errors, /^\d{4}-\d{2}-\d{2}$/.test(manifest?.generatedAt ?? ""), "generatedAt", "must be an ISO date");
  requireValue(errors, isNonEmptyString(manifest?.scope), "scope", "is required");
  requireValue(errors, Array.isArray(manifest?.jurisdictions), "jurisdictions", "must be an array");
  if (!Array.isArray(manifest?.jurisdictions)) return errors;

  const ids = manifest.jurisdictions.map((item) => item?.id);
  const codes = manifest.jurisdictions.map((item) => item?.code);
  for (const duplicate of findDuplicates(ids)) errors.push(`jurisdictions: duplicate id ${duplicate}`);
  for (const duplicate of findDuplicates(codes)) errors.push(`jurisdictions: duplicate code ${duplicate}`);
  requireValue(errors, manifest.jurisdictions.length === EXPECTED_JURISDICTIONS.size, "jurisdictions", `must contain exactly ${EXPECTED_JURISDICTIONS.size} entries`);
  for (const [id, code] of EXPECTED_JURISDICTIONS) {
    const item = manifest.jurisdictions.find((candidate) => candidate?.id === id);
    requireValue(errors, Boolean(item), "jurisdictions", `missing ${id}`);
    if (item) requireValue(errors, item.code === code, id, `code must be ${code}`);
  }

  const allGisIds = [];
  const allSourceIds = [];
  for (const jurisdiction of manifest.jurisdictions) {
    const location = jurisdiction?.id ?? "jurisdiction:<missing-id>";
    requireValue(errors, isNonEmptyString(jurisdiction?.name), location, "name is required");
    requireValue(errors, isNonEmptyString(jurisdiction?.authority?.name), `${location}.authority`, "name is required");
    requireValue(errors, isHttps(jurisdiction?.authority?.url), `${location}.authority.url`, "must be an HTTPS official source");
    requireValue(errors, Array.isArray(jurisdiction?.managementSystems) && jurisdiction.managementSystems.length > 0, `${location}.managementSystems`, "must describe at least one management system");

    requireValue(errors, GIS_STATES.has(jurisdiction?.gis?.state), `${location}.gis.state`, "is not recognized");
    requireValue(errors, Array.isArray(jurisdiction?.gis?.candidates) && jurisdiction.gis.candidates.length > 0, `${location}.gis.candidates`, "must include a candidate or explicit NONE_FOUND record");
    for (const candidate of jurisdiction?.gis?.candidates ?? []) {
      allGisIds.push(candidate?.id);
      const itemLocation = `${location}.gis.${candidate?.id ?? "<missing-id>"}`;
      requireValue(errors, isNonEmptyString(candidate?.id), itemLocation, "id is required");
      requireValue(errors, isNonEmptyString(candidate?.authority), itemLocation, "authority is required");
      requireValue(errors, candidate?.serviceUrl === null || isHttps(candidate.serviceUrl), `${itemLocation}.serviceUrl`, "must be null or HTTPS");
      requireValue(errors, LEGAL_STANDINGS.has(candidate?.legalStanding), `${itemLocation}.legalStanding`, "is not recognized");
      requireValue(errors, isNonEmptyString(candidate?.legalStandingEvidence), `${itemLocation}.legalStandingEvidence`, "is required");
      requireValue(errors, LICENCE_CLASSIFICATIONS.has(candidate?.licence?.classification), `${itemLocation}.licence.classification`, "is not recognized");
      requireValue(errors, isNonEmptyString(candidate?.licence?.notes), `${itemLocation}.licence.notes`, "is required");
      requireValue(errors, Array.isArray(candidate?.limitations) && candidate.limitations.length > 0, `${itemLocation}.limitations`, "must state at least one limitation");
    }

    requireValue(errors, REGULATION_STATES.has(jurisdiction?.regulations?.state), `${location}.regulations.state`, "is not recognized");
    requireValue(errors, Array.isArray(jurisdiction?.regulations?.sources) && jurisdiction.regulations.sources.length >= 2, `${location}.regulations.sources`, "must include at least two primary official sources");
    for (const source of jurisdiction?.regulations?.sources ?? []) {
      allSourceIds.push(source?.id);
      const itemLocation = `${location}.regulations.${source?.id ?? "<missing-id>"}`;
      requireValue(errors, isNonEmptyString(source?.id), itemLocation, "id is required");
      requireValue(errors, isNonEmptyString(source?.authority), itemLocation, "authority is required");
      requireValue(errors, isHttps(source?.url), `${itemLocation}.url`, "must be HTTPS");
      requireValue(errors, isNonEmptyString(source?.effectivePeriod), `${itemLocation}.effectivePeriod`, "is required");
      requireValue(errors, isNonEmptyString(source?.changeDetection), `${itemLocation}.changeDetection`, "is required");
    }

    requireValue(errors, READINESS_STATES.has(jurisdiction?.readiness), `${location}.readiness`, "is not recognized");
    requireValue(errors, Array.isArray(jurisdiction?.blockers), `${location}.blockers`, "must be an array, including an empty array when ready");
    requireValue(errors, Array.isArray(jurisdiction?.fixtures) && jurisdiction.fixtures.length >= 2 && jurisdiction.fixtures.length <= 5, `${location}.fixtures`, "must contain 2-5 representative validation fixtures");
    requireValue(errors, isNonEmptyString(jurisdiction?.nextAction), `${location}.nextAction`, "is required");

    const furbearers = Object.values(jurisdiction?.furbearers ?? {}).flatMap((value) => Array.isArray(value) ? value : []);
    for (const duplicate of findDuplicates(furbearers.map((value) => value.toLowerCase()))) {
      errors.push(`${location}.furbearers: ${duplicate} appears in more than one classification`);
    }
  }

  for (const duplicate of findDuplicates(allGisIds)) errors.push(`gis candidates: duplicate id ${duplicate}`);
  for (const duplicate of findDuplicates(allSourceIds)) errors.push(`regulation sources: duplicate id ${duplicate}`);
  return errors;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runCli() {
  const manifestPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_MANIFEST_PATH;
  const schemaPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_SCHEMA_PATH;
  const manifest = readJson(manifestPath);
  const schema = readJson(schemaPath);
  const errors = validateManifest(manifest, schema);
  if (errors.length > 0) {
    console.error(`Canada source reconnaissance validation failed (${errors.length} error${errors.length === 1 ? "" : "s"}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  const gisCandidates = manifest.jurisdictions.reduce((total, item) => total + item.gis.candidates.length, 0);
  const regulationSources = manifest.jurisdictions.reduce((total, item) => total + item.regulations.sources.length, 0);
  console.log(`Validated ${manifest.jurisdictions.length} jurisdictions, ${gisCandidates} GIS candidates, and ${regulationSources} official regulation sources.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
