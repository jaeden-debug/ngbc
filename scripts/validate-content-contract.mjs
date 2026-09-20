#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ID_PATTERN = /^(species|species_group|country|jurisdiction|management_zone|special_territory|activity|hunt_type|method|condition|weather_condition|temperature_band|clothing_system|equipment_category|equipment_item|pack_template|skill|safety_topic|regulation_topic|guide|field_test|tool|product|source|content_block):[a-z0-9](?:[a-z0-9.-]{0,117}[a-z0-9])?$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERIFICATION = new Set(["unverified", "needs_review", "verified", "conflict", "stale", "superseded"]);
const RESOURCE_STATUS = new Set(["draft", "in_review", "published", "stale", "archived"]);
const QUICK_ANSWER_TYPES = new Set(["guide", "condition", "reference"]);
const BIOLOGICAL_SEX = new Set(["MALE", "FEMALE", "UNKNOWN"]);
const BIOLOGICAL_AGE = new Set(["ADULT", "JUVENILE", "CALF", "FAWN", "OTHER", "UNKNOWN"]);
const REGULATORY_DIMENSIONS = new Set(["ANTLER_CLASS", "BIRD_CHARACTERISTIC", "JURISDICTION_DEFINED"]);
const SPECIES_MEDIA_ROLES = new Set(["general", "adult_male", "adult_female", "juvenile", "winter_form", "breeding_plumage", "nonbreeding_plumage", "lookalike_comparison"]);
const APPLICABILITY_ID_KEYS = ["countryIds", "jurisdictionIds", "zoneIds", "speciesIds", "activityIds", "huntTypeIds", "methodIds", "conditionIds", "weatherConditionIds"];
const RELATION_ENDPOINTS = {
  evaluates_product: [["field_test"], ["product"]],
  similar_to: [["species"], ["species"]],
  uses_skill: [["guide", "activity", "hunt_type"], ["skill"]],
  uses_clothing_system: [["activity", "hunt_type", "guide"], ["clothing_system"]],
  uses_pack_template: [["activity", "hunt_type", "guide"], ["pack_template"]],
  has_regulatory_resource: [["jurisdiction", "management_zone", "species"], ["source", "guide"]],
};

const args = process.argv.slice(2);
const strict = args.includes("--strict") || args.includes("--mode=strict");
const paths = args.filter((arg) => !arg.startsWith("--"));
if (paths.length === 0) paths.push("fixtures/content-contract/valid-bundle.json");

const problems = [];
const error = (code, path, message) => problems.push({ severity: "error", code, path, message });
const warn = (code, path, message) => problems.push({ severity: "warning", code, path, message });

function asArray(value, path) {
  if (Array.isArray(value)) return value;
  error("EXPECTED_ARRAY", path, "must be an array");
  return [];
}

function validId(value, path, prefix) {
  if (typeof value !== "string" || value.length > 120 || !ID_PATTERN.test(value)) {
    error("INVALID_ID", path, `invalid canonical ID: ${String(value)}`);
    return false;
  }
  if (prefix && !value.startsWith(`${prefix}:`)) {
    error("WRONG_ID_TYPE", path, `expected ${prefix}: ID, received ${value}`);
    return false;
  }
  return true;
}

function unique(records, collection, key = "id") {
  const seen = new Map();
  for (const [index, record] of records.entries()) {
    const value = record?.[key];
    if (typeof value !== "string") continue;
    if (seen.has(value)) {
      error("DUPLICATE_VALUE", `${collection}[${index}].${key}`, `duplicates ${collection}[${seen.get(value)}].${key}: ${value}`);
    } else {
      seen.set(value, index);
    }
  }
}

function interval(record, path, startKey = "validFrom", endKey = "validThrough") {
  const start = record?.[startKey];
  const end = record?.[endKey];
  if (start && end && start > end) error("INVALID_INTERVAL", path, `${startKey} is after ${endKey}`);
}

function collectIdRefs(value, keys, into) {
  if (!value || typeof value !== "object") return;
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string") into.push([key, candidate]);
    if (Array.isArray(candidate)) {
      candidate.forEach((id, index) => into.push([`${key}[${index}]`, id]));
    }
  }
}

function validateApplicability(value, path, ids) {
  if (value == null) return;
  if (typeof value !== "object" || Array.isArray(value)) {
    error("INVALID_APPLICABILITY", path, "must be an object");
    return;
  }
  const refs = [];
  collectIdRefs(value, APPLICABILITY_ID_KEYS, refs);
  refs.forEach(([key, id]) => {
    if (!validId(id, `${path}.${key}`)) return;
    if (!ids.has(id)) error("BROKEN_REFERENCE", `${path}.${key}`, `unknown canonical ID: ${id}`);
  });
  interval(value, path);
  for (const rangeKey of ["temperatureC", "durationMinutes"]) {
    const range = value[rangeKey];
    if (range && typeof range === "object" && typeof range.min === "number" && typeof range.max === "number" && range.min > range.max) {
      error("INVALID_RANGE", `${path}.${rangeKey}`, "min is greater than max");
    }
  }
}

function idType(id) {
  return typeof id === "string" ? id.slice(0, id.indexOf(":")) : "";
}

function findDirectedCycle(edges, types) {
  const graph = new Map();
  edges.filter((edge) => types.has(edge?.type) && edge?.status === "active").forEach((edge) => {
    const next = graph.get(edge.fromId) ?? [];
    next.push(edge.toId);
    graph.set(edge.fromId, next);
  });
  const visiting = new Set();
  const visited = new Set();
  function visit(node) {
    if (visiting.has(node)) return node;
    if (visited.has(node)) return null;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    visiting.delete(node);
    visited.add(node);
    return null;
  }
  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

async function loadBundles() {
  const bundles = [];
  for (const input of paths) {
    const absolute = resolve(input);
    let parsed;
    try {
      parsed = JSON.parse(await readFile(absolute, "utf8"));
    } catch (cause) {
      error("READ_FAILED", input, cause instanceof Error ? cause.message : String(cause));
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      error("INVALID_BUNDLE", input, "root must be an object");
      continue;
    }
    bundles.push({ input, parsed });
  }
  return bundles;
}

const loaded = await loadBundles();
const bundle = {
  contractVersion: "1.0",
  entities: [],
  resources: [],
  blocks: [],
  relationships: [],
  sources: [],
  claims: [],
  media: [],
};

for (const { input, parsed } of loaded) {
  if (parsed.contractVersion !== "1.0") {
    error("UNSUPPORTED_VERSION", input, `expected contractVersion 1.0, received ${String(parsed.contractVersion)}`);
  }
  for (const key of ["entities", "resources", "blocks", "relationships", "sources", "claims", "media"]) {
    bundle[key].push(...asArray(parsed[key] ?? [], `${input}.${key}`));
  }
}

for (const key of ["entities", "resources", "blocks", "relationships", "sources", "claims", "media"]) {
  unique(bundle[key], key);
}

const ids = new Set();
for (const entity of bundle.entities) if (typeof entity?.id === "string") ids.add(entity.id);
for (const resource of bundle.resources) if (typeof resource?.id === "string") ids.add(resource.id);
for (const block of bundle.blocks) if (typeof block?.id === "string") ids.add(block.id);
for (const source of bundle.sources) if (typeof source?.id === "string") ids.add(source.id);

const sourcesById = new Map(bundle.sources.map((source) => [source?.id, source]));
const relationshipsByType = new Map();
for (const relation of bundle.relationships) {
  const list = relationshipsByType.get(relation?.type) ?? [];
  list.push(relation);
  relationshipsByType.set(relation?.type, list);
}

bundle.entities.forEach((entity, index) => {
  const path = `entities[${index}]`;
  if (!validId(entity?.id, `${path}.id`)) return;
  if (entity.type !== entity.id.split(":", 1)[0]) error("TYPE_MISMATCH", `${path}.type`, "entity type must match ID prefix");
  if (!Array.isArray(entity.names) || entity.names.length === 0) error("MISSING_NAME", `${path}.names`, "entity requires at least one localized name");
  interval(entity, path);
  const aliases = Array.isArray(entity.aliases) ? entity.aliases : [];
  const aliasKeys = new Set();
  aliases.forEach((alias, aliasIndex) => {
    const key = `${alias?.locale ?? "*"}|${String(alias?.value ?? "").trim().toLocaleLowerCase("en-CA")}`;
    if (aliasKeys.has(key)) error("DUPLICATE_ALIAS", `${path}.aliases[${aliasIndex}]`, `duplicate alias in locale scope: ${String(alias?.value)}`);
    aliasKeys.add(key);
  });
});

const slugKeys = new Map();
const urlKeys = new Map();
bundle.resources.forEach((resource, index) => {
  const path = `resources[${index}]`;
  validId(resource?.id, `${path}.id`);
  if (!RESOURCE_STATUS.has(resource?.status)) error("INVALID_STATUS", `${path}.status`, `invalid resource status: ${String(resource?.status)}`);
  if (typeof resource?.slug !== "string" || !SLUG_PATTERN.test(resource.slug)) error("INVALID_SLUG", `${path}.slug`, `invalid slug: ${String(resource?.slug)}`);
  if (!VERIFICATION.has(resource?.verificationStatus)) error("INVALID_VERIFICATION", `${path}.verificationStatus`, "unknown verification status");

  const slugKey = `${resource?.locale}|${resource?.type}|${resource?.slug}`;
  if (slugKeys.has(slugKey)) error("DUPLICATE_CANONICAL_SLUG", `${path}.slug`, `duplicates ${slugKeys.get(slugKey)}`);
  else slugKeys.set(slugKey, path);

  if (resource?.canonicalUrl) {
    const key = `${resource?.locale}|${resource.canonicalUrl}`;
    if (urlKeys.has(key)) error("DUPLICATE_CANONICAL_URL", `${path}.canonicalUrl`, `duplicates ${urlKeys.get(key)}`);
    else urlKeys.set(key, path);
    if (!resource.canonicalUrl.startsWith("/")) error("INVALID_CANONICAL_URL", `${path}.canonicalUrl`, "must be a root-relative canonical path");
  }

  if (resource?.status === "published") {
    if (!resource?.canonicalUrl) error("MISSING_CANONICAL_URL", `${path}.canonicalUrl`, "published resource requires a canonical URL");
    if (QUICK_ANSWER_TYPES.has(resource?.type) && !resource?.quickAnswer?.trim()) error("MISSING_QUICK_ANSWER", `${path}.quickAnswer`, "published resource type requires a quick answer");
    if (!Array.isArray(resource?.entityIds) || resource.entityIds.length === 0) warn("ORPHAN_RESOURCE", `${path}.entityIds`, "published resource has no subject entities");
  }

  if (resource?.type === "species" && !resource?.speciesProfile) {
    error("MISSING_SPECIES_PROFILE", `${path}.speciesProfile`, "species resource requires a species profile");
  }
  if (resource?.type === "species" && resource?.speciesProfile) {
    const profile = resource.speciesProfile;
    if (!resource?.quickAnswer?.trim()) error("MISSING_QUICK_ANSWER", `${path}.quickAnswer`, "published species requires a direct answer");
    if (!Array.isArray(profile.sourceIds) || profile.sourceIds.length === 0) error("UNSOURCED_SPECIES", `${path}.speciesProfile.sourceIds`, "species profile requires at least one authoritative source");
    const expectedScientificName = `${profile?.taxonomy?.genus ?? ""} ${profile?.taxonomy?.species ?? ""}`.trim();
    if (!/^[A-Z][a-z-]+ [a-z][a-z-]+$/.test(profile?.scientificName ?? "") || profile.scientificName !== expectedScientificName) {
      error("INVALID_SCIENTIFIC_NAME", `${path}.speciesProfile.scientificName`, "must be a binomial matching taxonomy genus and species");
    }
    const terminology = profile?.sexAgeInfo?.terminology;
    if (terminology != null && !Array.isArray(terminology)) error("INVALID_SPECIES_TERMINOLOGY", `${path}.speciesProfile.sexAgeInfo.terminology`, "must be an array");
    const termKeys = new Set();
    for (const [termIndex, term] of (Array.isArray(terminology) ? terminology : []).entries()) {
      const termPath = `${path}.speciesProfile.sexAgeInfo.terminology[${termIndex}]`;
      const key = `${term?.locale ?? "*"}|${String(term?.value ?? "").trim().toLocaleLowerCase("en-CA")}`;
      if (!term?.value?.trim()) error("EMPTY_SPECIES_TERM", `${termPath}.value`, "terminology requires a value");
      if (termKeys.has(key)) error("DUPLICATE_SPECIES_TERM", `${termPath}.value`, `duplicate terminology in locale scope: ${String(term?.value)}`);
      termKeys.add(key);
      const intent = term?.intent;
      if (intent?.kind === "BIOLOGICAL" && intent?.dimension === "SEX" && !BIOLOGICAL_SEX.has(intent?.value)) error("INVALID_BIOLOGICAL_SEX", `${termPath}.intent.value`, "unknown biological sex");
      else if (intent?.kind === "BIOLOGICAL" && intent?.dimension === "AGE_CLASS" && !BIOLOGICAL_AGE.has(intent?.value)) error("INVALID_BIOLOGICAL_AGE", `${termPath}.intent.value`, "unknown biological age class");
      else if (intent?.kind === "REGULATORY_CLASS") {
        if (!REGULATORY_DIMENSIONS.has(intent?.dimension)) error("INVALID_REGULATORY_DIMENSION", `${termPath}.intent.dimension`, "unknown regulatory animal-class dimension");
        if (!Array.isArray(term?.sourceIds) || term.sourceIds.length === 0) error("UNSOURCED_REGULATORY_TERM", `${termPath}.sourceIds`, "regulatory-class terminology requires a source; it is not a biological synonym");
      } else if (intent?.kind !== "BIOLOGICAL") error("INVALID_CHARACTERISTIC_INTENT", `${termPath}.intent`, "terminology requires a biological or regulatory-class intent");
    }
  }
  validateApplicability(resource?.applicability, `${path}.applicability`, ids);

  const refs = [];
  collectIdRefs(resource, ["entityIds", "jurisdictionIds", "speciesIds", "huntTypeIds", "methodIds", "conditionIds", "safetyNotes", "sourceIds", "northGroundSourceIds", "relatedResourceIds", "relatedSpeciesIds", "relatedGuideIds", "relatedGearIds", "relatedFieldTestIds"], refs);
  refs.forEach(([key, id]) => {
    if (!validId(id, `${path}.${key}`)) return;
    if (!ids.has(id)) error("BROKEN_REFERENCE", `${path}.${key}`, `unknown canonical ID: ${id}`);
  });

  if (resource?.fieldTested) {
    const direct = Array.isArray(resource.relatedFieldTestIds) && resource.relatedFieldTestIds.length > 0;
    const edge = (relationshipsByType.get("has_field_test") ?? []).some((relation) => relation.fromId === resource.id || relation.toId === resource.id);
    if (!direct && !edge) error("UNSUPPORTED_FIELD_TESTED", `${path}.fieldTested`, "fieldTested requires a field-test relationship");
  }
});

bundle.sources.forEach((source, index) => {
  const path = `sources[${index}]`;
  validId(source?.id, `${path}.id`, "source");
  if (!VERIFICATION.has(source?.verificationStatus)) error("INVALID_VERIFICATION", `${path}.verificationStatus`, "unknown verification status");
  if (typeof source?.url !== "string" || !/^https:\/\//.test(source.url)) error("INVALID_SOURCE_URL", `${path}.url`, "source URL must use HTTPS");
  interval(source, path, "effectiveFrom", "effectiveThrough");
});

bundle.claims.forEach((claim, index) => {
  const path = `claims[${index}]`;
  if (!validId(claim?.ownerId, `${path}.ownerId`) || !ids.has(claim.ownerId)) error("BROKEN_CLAIM_OWNER", `${path}.ownerId`, `unknown owner: ${String(claim?.ownerId)}`);
  if (!VERIFICATION.has(claim?.verificationStatus)) error("INVALID_VERIFICATION", `${path}.verificationStatus`, "unknown verification status");
  const sourceIds = Array.isArray(claim?.sourceIds) ? claim.sourceIds : [];
  if (claim?.verificationStatus === "verified" && sourceIds.length === 0) error("VERIFIED_CLAIM_WITHOUT_SOURCE", `${path}.sourceIds`, "verified claim requires at least one source");
  sourceIds.forEach((id, sourceIndex) => {
    if (!sourcesById.has(id)) error("BROKEN_SOURCE_REFERENCE", `${path}.sourceIds[${sourceIndex}]`, `unknown source: ${String(id)}`);
  });
});

bundle.blocks.forEach((block, index) => {
  const path = `blocks[${index}]`;
  validId(block?.id, `${path}.id`, "content_block");
  if (!validId(block?.ownerId, `${path}.ownerId`) || !ids.has(block.ownerId)) error("BROKEN_BLOCK_OWNER", `${path}.ownerId`, `unknown owner: ${String(block?.ownerId)}`);
  if (!Number.isInteger(block?.priority) || block.priority < 0 || block.priority > 100) error("INVALID_PRIORITY", `${path}.priority`, "priority must be an integer from 0 to 100");
  if (!block?.content?.plainText?.trim()) error("EMPTY_BLOCK", `${path}.content.plainText`, "block plain text is required");
  interval(block, path);
  validateApplicability(block?.applicability, `${path}.applicability`, ids);
  validateApplicability(block?.exclusions, `${path}.exclusions`, ids);
  const sourceIds = Array.isArray(block?.sourceIds) ? block.sourceIds : [];
  sourceIds.forEach((id, sourceIndex) => {
    if (!sourcesById.has(id)) error("BROKEN_SOURCE_REFERENCE", `${path}.sourceIds[${sourceIndex}]`, `unknown source: ${String(id)}`);
  });
  if (block?.type === "legal_note" && block?.status === "published") {
    const official = sourceIds.some((id) => sourcesById.get(id)?.type === "official");
    if (!official) error("LEGAL_NOTE_WITHOUT_OFFICIAL_SOURCE", `${path}.sourceIds`, "published legal note requires an official source");
  }
  if (block?.type === "north_ground_field_note" && block?.status === "published") {
    const evidence = sourceIds.some((id) => sourcesById.get(id)?.type === "north_ground_evidence");
    if (!evidence) error("FIELD_NOTE_WITHOUT_EVIDENCE", `${path}.sourceIds`, "published field note requires North Ground evidence");
  }
});

const relationKeys = new Map();
const parents = new Map();
bundle.relationships.forEach((relation, index) => {
  const path = `relationships[${index}]`;
  for (const key of ["fromId", "toId"]) {
    if (!validId(relation?.[key], `${path}.${key}`) || !ids.has(relation[key])) error("BROKEN_RELATIONSHIP", `${path}.${key}`, `unknown endpoint: ${String(relation?.[key])}`);
  }
  if (relation?.fromId === relation?.toId) error("SELF_RELATIONSHIP", path, "relationship endpoints must differ");
  interval(relation, path);
  const key = `${relation?.fromId}|${relation?.type}|${relation?.toId}|${relation?.locale ?? ""}|${relation?.validFrom ?? ""}|${relation?.validThrough ?? ""}`;
  if (relationKeys.has(key)) error("DUPLICATE_RELATIONSHIP", path, `duplicates ${relationKeys.get(key)}`);
  else relationKeys.set(key, path);
  if (relation?.type === "canonical_parent" && relation?.status === "active") {
    const parentKey = `${relation.fromId}|${relation.locale ?? "*"}`;
    if (parents.has(parentKey)) error("MULTIPLE_CANONICAL_PARENTS", path, `also defined at ${parents.get(parentKey)}`);
    else parents.set(parentKey, path);
  }
  if (relation?.origin === "derived" && !relation?.derivation?.rule) error("MISSING_DERIVATION", `${path}.derivation`, "derived relationship requires derivation metadata");
  const endpointRule = RELATION_ENDPOINTS[relation?.type];
  if (endpointRule) {
    const [allowedFrom, allowedTo] = endpointRule;
    if (!allowedFrom.includes(idType(relation?.fromId))) error("INVALID_RELATIONSHIP_ENDPOINT", `${path}.fromId`, `${relation.type} does not allow this source type`);
    if (!allowedTo.includes(idType(relation?.toId))) error("INVALID_RELATIONSHIP_ENDPOINT", `${path}.toId`, `${relation.type} does not allow this target type`);
  }
});

const relationshipCycle = findDirectedCycle(bundle.relationships, new Set(["canonical_parent", "supersedes"]));
if (relationshipCycle) error("RELATIONSHIP_CYCLE", "relationships", `cycle detected through ${relationshipCycle}`);

bundle.media.forEach((media, index) => {
  const path = `media[${index}]`;
  if (!media?.creator || !media?.licence || !media?.assetUrl) error("INCOMPLETE_MEDIA_PROVENANCE", path, "creator, licence, and assetUrl are required");
  if (Array.isArray(media?.depictsSpeciesIds) && media.depictsSpeciesIds.length > 0 && media.identityVerification !== "verified") {
    error("UNVERIFIED_SPECIES_MEDIA", `${path}.identityVerification`, "species-targeted media identity must be verified");
  }
  if (Array.isArray(media?.depictsSpeciesIds) && media.depictsSpeciesIds.length > 1) {
    error("AMBIGUOUS_PRIMARY_SPECIES_MEDIA", `${path}.depictsSpeciesIds`, "species media must identify exactly one canonical species record");
  }
  if (media?.speciesMediaRole && !SPECIES_MEDIA_ROLES.has(media.speciesMediaRole)) {
    error("INVALID_SPECIES_MEDIA_ROLE", `${path}.speciesMediaRole`, "unknown species media role");
  }
  if ((media?.depictsSex || media?.depictsAgeClass || media?.speciesMediaRole) && (!Array.isArray(media?.depictsSpeciesIds) || media.depictsSpeciesIds.length !== 1)) {
    error("UNSCOPED_SPECIES_MEDIA_ROLE", path, "sex, age and species-media roles require exactly one canonical species");
  }
  if (media?.depictsSex && !BIOLOGICAL_SEX.has(media.depictsSex)) error("INVALID_MEDIA_SEX", `${path}.depictsSex`, "unknown biological sex");
  if (media?.depictsAgeClass && !BIOLOGICAL_AGE.has(media.depictsAgeClass)) error("INVALID_MEDIA_AGE", `${path}.depictsAgeClass`, "unknown biological age class");
  if (media?.sourceType === "unsplash" && media?.status === "active") {
    if (!media?.sourceUrl || !media?.attribution || !media?.altText) {
      error("INCOMPLETE_UNSPLASH_ATTRIBUTION", path, "active Unsplash media requires sourceUrl, attribution, and useful altText");
    }
    if (media?.identityVerification !== "verified" || !media?.identityVerifiedAt || !media?.identityVerifiedBy) {
      error("UNVERIFIED_UNSPLASH_MEDIA", path, "active Unsplash species media requires recorded human verification");
    }
  }
  const refs = [];
  collectIdRefs(media, ["depictsEntityIds", "depictsSpeciesIds", "sourceIds"], refs);
  refs.forEach(([key, id]) => {
    if (!validId(id, `${path}.${key}`)) return;
    if (!ids.has(id)) error("BROKEN_REFERENCE", `${path}.${key}`, `unknown canonical ID: ${id}`);
  });
});

const severityOrder = { error: 0, warning: 1 };
problems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
for (const problem of problems) {
  console.log(`${problem.severity.toUpperCase()} ${problem.code} ${problem.path}: ${problem.message}`);
}

const errors = problems.filter((problem) => problem.severity === "error").length;
const warnings = problems.length - errors;
console.log(`Content contract validation: ${errors} error(s), ${warnings} warning(s), ${bundle.entities.length} entities, ${bundle.resources.length} resources, ${bundle.blocks.length} blocks.`);
if (strict && errors > 0) process.exitCode = 1;
