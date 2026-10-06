#!/usr/bin/env node
/**
 * Wave 4: every species the jurisdiction-first take audit found an authority
 * listing that the catalogue did not yet hold.
 *
 * Inputs:
 * - research/hunting/wave-4-candidates.tsv — identity, group, take eligibility.
 * - research/hunting/profiles/<slug>.json — the researched profile: field marks,
 *   behaviour, habitat, range, lookalikes, and the pages actually read.
 *
 * Unlike waves 2 and 3, every source cited is a page a researcher read for that
 * species (NatureServe, Animal Diversity Web, an agency page). Nothing here
 * states legality: a take listing lives in species-take-evidence.json, and a
 * season is only ever Hunt's answer.
 *
 * Also appends the wave's rows to research/hunting/species-master.csv, so the
 * catalogue keeps ONE species registry.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const NOW = "2026-09-30T18:00:00Z";
const REVIEWED = "2026-09-30";

const tsv = (text) => {
  const [head, ...lines] = text.trim().split("\n");
  const keys = head.split("\t");
  return lines.map((line) => Object.fromEntries(line.split("\t").map((value, index) => [keys[index], value ?? ""])));
};
function parseCsv(input) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...records] = rows;
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}
const csvCell = (value) => (/[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value));

const candidates = tsv(await readFile(resolve(ROOT, "research/hunting/wave-4-candidates.tsv"), "utf8"));
const groupRows = parseCsv(await readFile(resolve(ROOT, "research/hunting/species-groups.csv"), "utf8"));

/* What is already published, so groups and lookalikes resolve across waves. */
const EARLIER = ["en-CA", "species-wave-1", "species-wave-2a", "species-wave-2b", "species-wave-2c", "species-wave-2d", "species-wave-3a", "species-wave-3b", "species-wave-3c"];
const existingEntityIds = new Set();
const titleToId = new Map();
for (const name of EARLIER) {
  const bundle = JSON.parse(await readFile(resolve(ROOT, `content/published/${name}.json`), "utf8"));
  for (const entity of bundle.entities) existingEntityIds.add(entity.id);
  for (const resource of bundle.resources) if (resource.type === "species") titleToId.set(resource.title.toLowerCase(), resource.id);
}
for (const row of candidates) titleToId.set(row.en.toLowerCase(), `species:${row.slug}`);
const publishedIds = new Set(titleToId.values());

/* A lookalike resolves by its slug or by its exact common name; a proposed slug
   that names nothing published links nowhere, and its comparison text is kept. */
function lookalikeId(lookalike) {
  if (publishedIds.has(`species:${lookalike.slug}`)) return `species:${lookalike.slug}`;
  return titleToId.get(String(lookalike.name ?? "").toLowerCase()) ?? null;
}

function groupLineage(groupId) {
  const lineage = [];
  let current = groupRows.find((row) => row.species_group_id === groupId);
  while (current) {
    lineage.push(current.species_group_id);
    current = current.parent_group_id ? groupRows.find((row) => row.species_group_id === current.parent_group_id) : undefined;
  }
  if (!lineage.length) throw new Error(`unknown group ${groupId}`);
  return lineage;
}

const frenchName = (value) => (typeof value === "string" ? value : value?.name ?? null);
const OFFICIAL_HOSTS = /\.(gov|gc\.ca|gouv\.qc\.ca|state\.[a-z]{2}\.us)(\/|$)|\.gov\.[a-z]{2}\.ca|alberta\.ca|ontario\.ca|gov\.bc\.ca|quebec\.ca|canada\.ca|parks\.canada\.ca|hawaii\.gov|myfwc\.com|wildlife\.ca\.gov|dfw\.state|wdfw\.wa\.gov|adfg\.alaska\.gov|tpwd\.texas\.gov/;

const profiles = new Map();
for (const row of candidates) {
  let profile;
  try {
    profile = JSON.parse(await readFile(resolve(ROOT, `research/hunting/profiles/${row.slug}.json`), "utf8"));
  } catch {
    throw new Error(`research/hunting/profiles/${row.slug}.json is missing; a species is never published without its researched profile`);
  }
  if (!profile.sources?.length) throw new Error(`${row.slug} has no source`);
  /* Wikipedia only as a labelled last resort beside a primary source, never alone. */
  if (profile.sources.every((source) => /wikipedia\.org/i.test(source.url ?? ""))) throw new Error(`${row.slug} rests on Wikipedia alone`);
  profiles.set(row.slug, profile);
}

const WAVES = {
  "4a": (row) => ["Mammalia"].includes(classOf(row)),
  "4b": (row) => classOf(row) === "Aves",
  "4c": (row) => ["Reptilia", "Amphibia"].includes(classOf(row)),
};
function classOf(row) {
  if (["Crocodylia", "Squamata", "Testudines"].includes(row.order)) return "Reptilia";
  if (["Anura", "Caudata"].includes(row.order)) return "Amphibia";
  if (/formes$/.test(row.order)) return "Aves";
  return "Mammalia";
}

const emittedGroups = new Set();
const masterRows = [];
for (const [wave, belongs] of Object.entries(WAVES)) {
  const selected = candidates.filter(belongs);
  const entities = [], resources = [], blocks = [], relationships = [], sources = [];
  for (const groupId of new Set(selected.flatMap((row) => groupLineage(`species_group:${row.group}`)))) {
    if (existingEntityIds.has(groupId) || emittedGroups.has(groupId)) continue;
    const group = groupRows.find((row) => row.species_group_id === groupId);
    entities.push({ id: groupId, type: "species_group", status: "active", names: [{ locale: "en-CA", value: group.name_en }, { locale: "fr-CA", value: group.name_fr }], aliases: [], createdAt: NOW, updatedAt: NOW });
    emittedGroups.add(groupId);
  }
  for (const row of selected) {
    const profile = profiles.get(row.slug);
    const id = `species:${row.slug}`;
    const groupId = `species_group:${row.group}`;
    const sourceIds = profile.sources.map((source, index) => {
      const sourceId = `source:w4-${row.slug}-${index + 1}`;
      sources.push({ id: sourceId, authority: source.publisher, title: source.title, url: source.url, publisher: source.publisher, retrievedAt: NOW, type: OFFICIAL_HOSTS.test(source.url) ? "official" : "scientific", verificationStatus: "verified" });
      return sourceId;
    });
    const sourced = (text) => ({ text, sourceIds });
    const fr = frenchName(profile.commonNameFr);
    const [genus, species] = row.scientific.split(" ");
    const comparisons = (profile.lookalikes ?? []).filter((item) => item.howToTell).map((item) => `Compared with ${item.name.toLowerCase().startsWith("the ") ? item.name : `the ${item.name.toLowerCase()}`}: ${item.howToTell.replace(/\.?$/, ".")}`);
    const similar = [...new Set((profile.lookalikes ?? []).map(lookalikeId).filter((other) => other && other !== id))];
    const marks = (profile.fieldMarks ?? []).map((text) => text.replace(/\.?$/, "."));
    const aliases = [
      { value: row.scientific, type: "scientific_name", verificationStatus: "verified", sourceIds },
      ...(profile.aliases ?? []).filter((value) => value && value.toLowerCase() !== row.en.toLowerCase()).map((value) => ({ value, locale: "en-CA", type: "common_name", verificationStatus: "verified", sourceIds })),
      ...(row.group === "hares-rabbits" ? [{ value: row.en.toLowerCase().includes("hare") ? "hare" : "rabbit", locale: "en-CA", type: "common_name", verificationStatus: "verified" }] : []),
    ].filter((alias, index, all) => all.findIndex((other) => other.value.toLowerCase() === alias.value.toLowerCase()) === index);
    entities.push({
      id, type: "species", status: "active",
      names: [{ locale: "en-CA", value: row.en }, ...(fr ? [{ locale: "fr-CA", value: fr }] : [])],
      slugs: [{ locale: "en-CA", value: row.slug }], aliases, createdAt: NOW, updatedAt: NOW,
    });
    const lead = marks.slice(0, 2).join(" ");
    /* A native non-quarry species here is protected (the eiders, federally
       threatened). A domestic animal gone feral (the ferret) is non-quarry for
       another reason entirely, and calling it protected would be false. */
    const isProtected = row.eligibility === "NON_QUARRY" && row.native !== "INTRODUCED";
    const protectedNote = isProtected ? " It is protected; if you are not certain of the species, do not shoot." : "";
    resources.push({
      id, type: "species", status: "published", locale: "en-CA", slug: row.slug, canonicalUrl: `/hunting/species/${row.slug}`, title: row.en,
      description: `Identify the ${row.en.toLowerCase()} (${row.scientific}), tell it from its lookalikes, and see its habitat, behaviour and North American range.`,
      primaryQuery: row.en.toLowerCase(), searchIntent: "informational",
      entityIds: [id, ...groupLineage(groupId)], speciesIds: [id],
      quickAnswer: `${row.en} (${row.scientific})${lead ? `: ${lead}` : "."}${protectedNote} This profile does not establish whether taking it is legal anywhere.`,
      keyFacts: [
        { id: "scientific-name", label: "Scientific name", value: row.scientific, sourceIds },
        { id: "family", label: "Family", value: profile.family || row.family, sourceIds },
        { id: "status", label: "In North America", value: row.native === "INTRODUCED" ? "Introduced" : "Native", sourceIds },
        ...(profile.range ? [{ id: "range", label: "Range", value: profile.range, sourceIds }] : []),
      ],
      sourceIds, relatedResourceIds: ["tool:season-finder"], relatedSpeciesIds: similar,
      verificationStatus: "verified", fieldTested: false, lastReviewed: REVIEWED, publishedAt: NOW, updatedAt: NOW,
      speciesProfile: {
        speciesId: id,
        commonNames: [{ locale: "en-CA", value: row.en }, ...(fr ? [{ locale: "fr-CA", value: fr }] : [])],
        scientificName: row.scientific,
        takeEligibility: row.eligibility,
        taxonomy: { order: profile.order || row.order, family: profile.family || row.family, genus, species, taxonomySourceId: sourceIds[0] },
        ...(profile.taxonomyNote || row.note ? { taxonomicStatus: "authority_dependent", taxonomicNotes: [profile.taxonomyNote, row.note].filter(Boolean).map((text) => sourced(text)) } : {}),
        speciesGroupIds: groupLineage(groupId),
        ...(profile.range ? { rangeSummary: [{ locale: "en-CA", value: profile.range }] } : {}),
        identification: [...marks, ...comparisons].map(sourced),
        ...(similar.length ? { similarSpeciesIds: similar } : {}),
        ...(profile.habitat?.length ? { habitat: profile.habitat.map(sourced) } : {}),
        ...(profile.behavior?.length ? { behavior: profile.behavior.map(sourced) } : {}),
        sourceIds, verificationStatus: "verified", lastReviewed: REVIEWED,
      },
    });
    relationships.push({ id: `rel:${row.slug}-member-${row.group}`, fromId: id, toId: groupId, type: "member_of", direction: "directed", origin: "manual", sourceIds, status: "active", createdAt: NOW, updatedAt: NOW });
    for (const other of similar) {
      relationships.push({ id: `rel:${row.slug}-similar-${other.slice(8)}`, fromId: id, toId: other, type: "similar_to", direction: "undirected", origin: "manual", sourceIds, status: "active", createdAt: NOW, updatedAt: NOW });
    }
    if (comparisons.length) {
      blocks.push({ id: `content_block:${row.slug}.identification.01`, type: "identification_warning", ownerId: id, status: "published", locale: "en-CA", title: "Lookalike caution",
        content: { plainText: `Confirm a ${row.en.toLowerCase()} before you act. ${comparisons[0]}` }, priority: 60,
        applicability: { speciesIds: [id] }, sourceIds, verificationStatus: "verified", lastReviewed: REVIEWED, publishedAt: NOW, updatedAt: NOW });
    }
    if (isProtected) {
      blocks.push({ id: `content_block:${row.slug}.safety.01`, type: "safety_note", ownerId: id, status: "published", locale: "en-CA", title: "If you are not certain, do not shoot",
        content: { plainText: `The ${row.en.toLowerCase()} is protected and resembles species that are hunted. Identify every bird before the shot; if you cannot be certain, do not shoot.` }, priority: 100,
        applicability: { speciesIds: [id, ...similar], activityIds: ["activity:hunting"] }, sourceIds, verificationStatus: "verified", lastReviewed: REVIEWED, publishedAt: NOW, updatedAt: NOW });
    }
    masterRows.push([id, row.en, fr ?? "", row.scientific, genus, species, profile.family || row.family, profile.order || row.order, groupId, "source:itis-taxonomy", row.native, profile.range ?? "", "SOURCE_FOUND", row.note]);
  }
  const bundle = { contractVersion: "1.0", generatedAt: NOW, entities, resources, blocks, relationships, sources, claims: [], media: [] };
  await writeFile(resolve(ROOT, `content/published/species-wave-${wave}.json`), `${JSON.stringify(bundle, null, 2)}\n`);
  console.log(`wave ${wave}: ${resources.length} species`);
}

/* One registry: the wave's rows join species-master.csv (idempotent). */
const masterPath = resolve(ROOT, "research/hunting/species-master.csv");
const master = await readFile(masterPath, "utf8");
const have = new Set(parseCsv(master).map((row) => row.species_id));
const append = masterRows.filter((row) => !have.has(row[0])).map((row) => row.map(csvCell).join(","));
if (append.length) await writeFile(masterPath, `${master.replace(/\n?$/, "\n")}${append.join("\n")}\n`);
console.log(`species-master.csv: ${append.length} rows appended`);
