#!/usr/bin/env node
/**
 * The jurisdiction × species take matrix, generated from the jurisdiction-first
 * authority audit (research/hunting/take-audit/*.jsonl).
 *
 * Every audit row names what an authority lists for legal take, as a species or
 * as a group with members. This resolves each named animal to exactly one of:
 * a published canonical species, a recorded exclusion (take-exclusions.csv), or
 * UNMAPPED. UNMAPPED is a gap the completeness test refuses, so an animal an
 * authority lists cannot silently fall out of the catalogue.
 *
 * Outputs:
 * - research/hunting/species-take-matrix.csv — every row, resolved.
 * - content/published/species-take-evidence.json — per published species, the
 *   jurisdictions whose own regulations list it for take, the take modes and
 *   the source read. It is a LISTING, never a season: a row says an authority
 *   names the animal as takeable in some season, place or class, and nothing
 *   about today.
 *
 * Only rows with a take status (open, year-round, permit/draw, unprotected) and
 * HIGH or MEDIUM confidence are published. Closed rows, out-of-scope rows and
 * LOW-confidence rows stay in the research matrix.
 */

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { FEDERAL_GROUPS } from "../src/lib/hunt/regulatory/federal-groups.ts";
import { GROUP_STATES, makeGroupResolver } from "./lib/take-group-resolution.mjs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const AUDIT = resolve(ROOT, "research/hunting/take-audit");
const PUBLISHED = resolve(ROOT, "content/published");
const RETRIEVED = "2026-09-30";

const TAKE_STATUSES = new Set(["OPEN_SEASON", "YEAR_ROUND", "PERMIT_OR_DRAW", "UNPROTECTED"]);
const PUBLISHED_CONFIDENCE = new Set(["HIGH", "MEDIUM"]);
const MODES = new Set(["HUNTING", "TRAPPING", "MIGRATORY_HARVEST", "NUISANCE_TAKE", "INVASIVE_REMOVAL", "REPTILE_HARVEST", "AMPHIBIAN_HARVEST", "OTHER_REGULATED_TAKE"]);

/* Scientific names the authorities use that differ from the canonical record.
   Each is a naming difference only; none merges two animals. */
const SYNONYMS = new Map([
  ["lithobates catesbiana", "lithobates catesbeianus"],
  ["rana catesbeiana", "lithobates catesbeianus"],
  ["rana clamitans", "lithobates clamitans"],
  ["rana pipiens", "lithobates pipiens"],
  ["phalacrocorax auritus", "nannopterum auritum"],
  ["mustela frenata", "neogale frenata"],
  ["mustela vison", "neogale vison"],
  ["neovison vison", "neogale vison"],
  ["francolinus pondicerianus", "ortygornis pondicerianus"],
  ["francolinus erckelii", "pternistis erckelii"],
  ["streptopelia chinensis", "spilopelia chinensis"],
  ["spermophilus richardsonii", "urocitellus richardsonii"],
  ["spermophilus columbianus", "urocitellus columbianus"],
  ["spermophilus tridecemlineatus", "ictidomys tridecemlineatus"],
  ["spermophilus parryii", "urocitellus parryii"],
  ["spermophilus variegatus", "otospermophilus variegatus"],
  ["spermophilus beecheyi", "otospermophilus beecheyi"],
  ["bos bison", "bison bison"],
  ["chen caerulescens", "anser caerulescens"],
  ["chen rossii", "anser rossii"],
  ["anas americana", "mareca americana"],
  ["anas strepera", "mareca strepera"],
  ["anas penelope", "mareca penelope"],
  ["anas clypeata", "spatula clypeata"],
  ["anas discors", "spatula discors"],
  ["anas cyanoptera", "spatula cyanoptera"],
  ["porphyrio martinica", "porphyrio martinicus"],
  ["falcipennis canadensis", "canachites canadensis"],
  ["martes pennanti", "pekania pennanti"],
  ["dicotyles tajacu", "pecari tajacu"],
  ["tayassu tajacu", "pecari tajacu"],
  ["grus canadensis", "antigone canadensis"],
  ["masticophis flagellum", "coluber flagellum"],
  ["masticophis taeniatus", "coluber taeniatus"],
  ["lithobates catesbeiana", "lithobates catesbeianus"],
  ["python molurus", "python bivittatus"],
  ["pantherophis guttata", "pantherophis guttatus"],
  ["pantherophis obsoleta", "pantherophis obsoletus"],
  ["crotalus mitchellii", "crotalus pyrrhus"],
  ["lichanura roseofusca", "lichanura orcutti"],
  ["regina ridiga", "regina rigida"],
  ["bufo nebulifer", "incilius nebulifer"],
  ["rana sylvatica", "lithobates sylvaticus"],
  ["sonora occipitalis", "chionactis occipitalis"],
  /* Authorities' "mouflon" rows: the introduced European animal, published as Ovis musimon. */
  ["ovis gmelini", "ovis musimon"],
]);

/* Ermine was split in 2021. Authorities still write "ermine" or "Mustela
   erminea". Beringian jurisdictions hold M. erminea; everywhere else in North
   America the animal is M. richardsonii (Haida Gwaii's M. haidarum aside). The
   resolution is BY RANGE and the matrix records it as such. */
const ERMINE_BERINGIA = new Set(["us-ak", "ca-yt", "ca-nt", "ca-nu"]);

/* The tiger salamander was split: western authorities still write Ambystoma
   tigrinum for the western tiger salamander (A. mavortium). Resolved BY RANGE,
   and recorded as such; eastern jurisdictions keep A. tigrinum. */
const WESTERN_TIGER_SALAMANDER = new Set(["us-nv", "us-ut", "us-co", "us-wy", "us-mt", "us-id", "us-az", "us-nm", "us-ca", "us-or", "us-wa", "us-nd", "us-sd", "us-ne", "us-ks", "us-ok", "us-tx", "ca-bc", "ca-ab", "ca-sk", "ca-mb"]);

function parseCsv(text) {
  const [head, ...lines] = text.trim().split("\n");
  const keys = head.split(",");
  return lines.map((line) => {
    const values = [];
    let cell = "", quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(cell); cell = ""; }
      else cell += char;
    }
    values.push(cell);
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ""]));
  });
}

const csvCell = (raw) => { const value = String(raw).replace(/\s+/g, " ").trim(); return /[",]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value; };
const binomial = (name) => name.trim().toLowerCase().replace(/\s+/g, " ").split(" ").slice(0, 2).join(" ");

/* The published catalogue: scientific name (and any scientific-name alias) → id. */
const bySci = new Map();
/* Authorities also name group members by English common name ("Canada goose").
   The whole name must match a published title; a prefix never does. */
const byCommonName = new Map();
const eligibilityOf = new Map();
const catalogueRecords = new Map();
const shortNames = new Map();
const aliasNames = new Map();
for (const file of (await readdir(PUBLISHED)).filter((name) => name.endsWith(".json") && name !== "species-take-evidence.json")) {
  const bundle = JSON.parse(await readFile(resolve(PUBLISHED, file), "utf8"));
  for (const resource of bundle.resources ?? []) {
    if (resource.type !== "species") continue;
    bySci.set(binomial(resource.speciesProfile.scientificName), resource.speciesProfile.speciesId);
    catalogueRecords.set(resource.speciesProfile.speciesId, {
      title: resource.title,
      scientific: resource.speciesProfile.scientificName,
      genus: resource.speciesProfile.scientificName.split(" ")[0],
      family: resource.speciesProfile.taxonomy?.family ?? "",
      groups: resource.speciesProfile.speciesGroupIds ?? [],
    });
    eligibilityOf.set(resource.speciesProfile.speciesId, resource.speciesProfile.takeEligibility);
    byCommonName.set(resource.title.toLowerCase(), resource.speciesProfile.speciesId);
  }
  for (const entity of bundle.entities ?? []) {
    if (entity.type !== "species") continue;
    for (const alias of entity.aliases ?? []) {
      if (alias.type === "scientific_name" && !bySci.has(binomial(alias.value))) bySci.set(binomial(alias.value), entity.id);
    }
    /* The short common name an authority writes ("Red squirrel") when the
       published title is longer ("American red squirrel"), but only where the
       short name is unambiguous across the whole catalogue. */
    /* Verified common-name aliases resolve too ("groundhog"), but never over a
       published title, and an alias two species share resolves to neither. */
    for (const alias of entity.aliases ?? []) {
      if (alias.type !== "common_name" || alias.locale === "fr-CA") continue;
      const key = alias.value.toLowerCase();
      aliasNames.set(key, aliasNames.has(key) && aliasNames.get(key) !== entity.id ? null : entity.id);
    }
    for (const name of entity.names ?? []) {
      const short = name.value.toLowerCase().replace(/^(american|north american|common|eastern|western|northern) /, "");
      if (name.locale === "en-CA" && short !== name.value.toLowerCase()) shortNames.set(short, shortNames.has(short) ? null : entity.id);
    }
  }
}
/* Species-specific findings (take-eligibility-conflicts.csv): where a generic
   season names a group, whether it establishes take of THIS species here. */
const findings = new Map(parseCsv(await readFile(resolve(ROOT, "research/hunting/take-eligibility-conflicts.csv"), "utf8"))
  .map((row) => [`${row.species_id}|${row.jurisdiction_id}`, row]));

/**
 * Whether a resolved row becomes a published listing. Conventional quarry
 * (HUNTABLE, NUISANCE_OR_INVASIVE_TAKE) takes its listings from species and
 * group rows alike. Anything else never inherits a listing from a GROUP: a
 * generic swan season does not legalize a trumpeter swan. A LIMITED_TAKE species
 * is listed where the source names it, and otherwise only through a recorded
 * ESTABLISHED finding; NON_QUARRY and UNKNOWN only through a finding.
 */
function publication(row, speciesId, method) {
  if (!TAKE_STATUSES.has(row.status)) return [false, "NOT_A_TAKE_STATUS"];
  if (!PUBLISHED_CONFIDENCE.has(row.confidence)) return [false, "LOW_CONFIDENCE"];
  /* The content contract links only HTTPS sources. North Carolina's
     Administrative Code is served over HTTP alone; its rows stay in the matrix
     marked, and are never re-pointed at an unofficial HTTPS copy. */
  if (!/^https:\/\//.test(row.sourceUrl)) return [false, "SOURCE_NOT_HTTPS"];
  const finding = findings.get(`${speciesId}|jurisdiction:${row.jurisdiction}`);
  if (finding) return finding.finding === "ESTABLISHED" ? [true, "FINDING_ESTABLISHED"] : [false, `FINDING_${finding.finding}`];
  const eligibility = eligibilityOf.get(speciesId);
  if (eligibility === "HUNTABLE" || eligibility === "NUISANCE_OR_INVASIVE_TAKE") return [true, "CONVENTIONAL_QUARRY"];
  if (eligibility === "LIMITED_TAKE" && row.listedAs === "SPECIES") return [true, "SPECIES_SPECIFIC"];
  /* A group row reaches a LIMITED_TAKE species only where the SOURCE named it —
     the species itself, an enumeration, or a genus/family the rule states. */
  if (eligibility === "LIMITED_TAKE" && method?.endsWith(":NAMED")) return [true, "SPECIES_SPECIFIC"];
  /* "Unprotected" or "may be killed" alone is not a hunting opportunity (owner
     inclusion rule), so it neither lists a non-quarry species nor needs a finding. */
  if (row.status === "UNPROTECTED") return [false, "UNPROTECTED_ONLY"];
  return [false, "NEEDS_FINDING"];
}

const exclusions = new Map(parseCsv(await readFile(resolve(ROOT, "research/hunting/take-exclusions.csv"), "utf8")).map((row) => [binomial(row.scientific_name), row]));

const commonKey = (name) => name.trim().toLowerCase().replace(/\s*\(.*\)\s*$/, "").replace(/’/g, "'");

/* North American ranid frogs and true toads: authorities still write the older
   genera. Rana X → Lithobates X; Bufo X → Anaxyrus X (the Gulf Coast toad is
   Incilius, listed above). A naming difference only. */
function genusSynonym(key) {
  const [genus, species] = key.split(" ");
  if (genus === "rana" && !["boylii", "aurora", "cascadae", "draytonii", "muscosa", "sierrae", "pretiosa", "luteiventris", "chiricahuensis", "yavapaiensis", "tarahumarae"].includes(species)) {
    const plural = { sphenocephala: "sphenocephalus", palustris: "palustris", areolata: "areolatus", heckscheri: "heckscheri", berlandieri: "berlandieri", sylvatica: "sylvaticus", catesbeiana: "catesbeianus", clamitans: "clamitans", pipiens: "pipiens", blairi: "blairi", grylio: "grylio", septentrionalis: "septentrionalis", virgatipes: "virgatipes", capito: "capito", okaloosae: "okaloosae", sevosa: "sevosus", kauffeldi: "kauffeldi", fisheri: "fisheri", onca: "onca", yavapaiensis: "yavapaiensis" }[species] ?? species;
    return `lithobates ${plural}`;
  }
  if (genus === "bufo" && species !== "nebulifer" && species !== "marinus") return `anaxyrus ${species === "fowleri" ? "fowleri" : species}`;
  return key;
}

/* Hunter and authority common names that are not the published title. */
const COMMON_ALIASES = new Map([
  ["english sparrow", "house sparrow"], ["english sparrows", "house sparrow"], ["european starlings", "european starling"],
  ["blue goose", "snow goose"], ["eurasian collared", "eurasian collared-dove"], ["eurasian collared dove", "eurasian collared-dove"], ["tassel-eared (abert's) squirrel", "abert's squirrel"], ["tassel-eared", "abert's squirrel"], ["tassel-eared (abert's)", "abert's squirrel"],
  ["white-fronted goose", "greater white-fronted goose"], ["appalachian cottontail", "appalachian cottontail"],
]);

function resolveName(sci, jurisdiction) {
  const alias = COMMON_ALIASES.get(commonKey(sci)) ?? COMMON_ALIASES.get(sci.trim().toLowerCase());
  if (alias && byCommonName.has(alias)) return { speciesId: byCommonName.get(alias), method: "COMMON_NAME" };
  if (byCommonName.has(commonKey(sci))) return { speciesId: byCommonName.get(commonKey(sci)), method: "COMMON_NAME" };
  if (shortNames.get(commonKey(sci)) && !byCommonName.has(commonKey(sci))) return { speciesId: shortNames.get(commonKey(sci)), method: "COMMON_NAME" };
  let key = binomial(sci);
  let method = "SCIENTIFIC_NAME";
  if (key === "mustela erminea" && !ERMINE_BERINGIA.has(jurisdiction)) { key = "mustela richardsonii"; method = "RANGE_AFTER_2021_SPLIT"; }
  if (key === "ambystoma tigrinum" && WESTERN_TIGER_SALAMANDER.has(jurisdiction)) { key = "ambystoma mavortium"; method = "RANGE_AFTER_SPLIT"; }
  if (SYNONYMS.has(key)) { key = SYNONYMS.get(key); if (method === "SCIENTIFIC_NAME") method = "SYNONYM"; }
  if (!bySci.has(key) && genusSynonym(key) !== key && bySci.has(genusSynonym(key))) { key = genusSynonym(key); method = "SYNONYM"; }
  if (bySci.has(key)) return { speciesId: bySci.get(key), method };
  if (exclusions.has(key)) return { speciesId: "", method: `EXCLUDED:${exclusions.get(key).reason}`, excluded: key };
  return { speciesId: "", method: "UNMAPPED" };
}

const rows = [];
for (const file of (await readdir(AUDIT)).filter((name) => name.endsWith(".jsonl")).sort()) {
  for (const line of (await readFile(resolve(AUDIT, file), "utf8")).split("\n")) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
}

/* Species named CLOSED by an authority in a jurisdiction: a group row there
   never re-opens them by inheritance. */
const closedPairs = new Set();
for (const row of rows) {
  if (row.status !== "CLOSED_THIS_YEAR") continue;
  for (const name of row.scientificName ? [row.scientificName] : []) {
    const { speciesId } = resolveName(name, row.jurisdiction);
    if (speciesId) closedPairs.add(`${speciesId}|${row.jurisdiction}`);
  }
  const byName = byCommonName.get(commonKey(row.rawName));
  if (byName) closedPairs.add(`${byName}|${row.jurisdiction}`);
}
const occurrence = JSON.parse(await readFile(resolve(ROOT, "research/hunting/species-occurrence.json"), "utf8").catch(() => '{"species":{}}')).species;
const mbta = JSON.parse(await readFile(resolve(ROOT, "research/hunting/mbta-10-13.json"), "utf8")).species;
for (const [key, id] of aliasNames) if (id && !byCommonName.has(key) && !shortNames.has(key)) shortNames.set(key, id);
const resolveGroup = makeGroupResolver({
  catalogue: catalogueRecords, byCommonName, shortNames, occurrence, mbta, closedPairs,
  eligibilityOf: (id) => eligibilityOf.get(id) ?? "UNKNOWN",
  federalGroups: FEDERAL_GROUPS,
});
const groupResolutions = [];

const matrix = [];
const excludedEvidence = new Map();
const evidence = new Map();
const sources = new Map();
for (const row of rows) {
  if (row.status === "OUT_OF_SCOPE") {
    matrix.push({ ...row, member: "", speciesId: "", resolution: "OUT_OF_SCOPE" });
    continue;
  }
  const members = row.scientificName ? [row.scientificName] : (row.groupMembers ?? []);
  /* A genus placeholder ("Mustela spp.", "Lampropeltis t.") names no species. */
  const named = members
    /* "Lampropeltis t. elapsoides": the old trinomial for the scarlet kingsnake,
       now Lampropeltis elapsoides. */
    .map((name) => name.trim().replace(/^Lampropeltis t\. elapsoides$/, "Lampropeltis elapsoides"))
    .filter((name) => /^[A-Z][a-z]+[ -][a-zA-Z]/.test(name) && !/\bspp?\.|\s[a-z]\.$/.test(name));
  /* A row naming no member species is resolved by the group resolver, which
     gates on eligibility, same-jurisdiction closures and occurrence BEFORE it
     expands a group (scripts/lib/take-group-resolution.mjs). */
  let targets;
  if (!named.length) {
    const outcome = resolveGroup(row);
    groupResolutions.push({ row, ...outcome });
    if (!outcome.members.length) {
      matrix.push({ ...row, member: "", speciesId: "", resolution: `GROUP:${outcome.state}`, publication: outcome.basis });
      continue;
    }
    targets = outcome.members.map((speciesId) => ({ member: catalogueRecords.get(speciesId).scientific, forced: { speciesId, method: `GROUP:${outcome.state}:${outcome.kind}` } }));
  } else {
    targets = named.map((member) => ({ member, forced: null }));
  }
  for (const { member, forced } of targets) {
    const resolved = forced ?? resolveName(member, row.jurisdiction);
    const { speciesId, method } = resolved;
    if (resolved.excluded) {
      const seen = excludedEvidence.get(resolved.excluded) ?? { jurisdictions: new Set(), urls: new Set() };
      seen.jurisdictions.add(`jurisdiction:${row.jurisdiction}`);
      seen.urls.add(row.sourceUrl);
      excludedEvidence.set(resolved.excluded, seen);
    }
    const [publishable, why] = speciesId ? publication(row, speciesId, method) : [false, ""];
    matrix.push({ ...row, member, speciesId, resolution: method, published: publishable ? "Y" : "N", publication: why });
    if (!publishable) continue;
    const sourceId = `source:take-${row.jurisdiction}-${createHash("sha256").update(row.sourceUrl).digest("hex").slice(0, 16)}`;
    if (!sources.has(sourceId)) {
      sources.set(sourceId, {
        id: sourceId, authority: row.authority, title: row.sourceTitle, url: row.sourceUrl, publisher: row.authority,
        retrievedAt: `${RETRIEVED}T12:00:00Z`, type: "official", verificationStatus: "verified",
      });
    }
    const jurisdictionId = `jurisdiction:${row.jurisdiction}`;
    const perSpecies = evidence.get(speciesId) ?? new Map();
    const entry = perSpecies.get(jurisdictionId) ?? { jurisdictionId, takeModes: new Set(), statuses: new Set(), sourceIds: new Set(), authorityNames: new Set(), resolvedBy: new Set(), conditions: new Set() };
    const finding = findings.get(`${speciesId}|${jurisdictionId}`);
    if (finding?.condition) {
      entry.conditions.add(finding.condition);
      const titles = finding.source_titles.split("|");
      finding.source_urls.split("|").forEach((url, index) => {
        const id = `source:finding-${speciesId.slice(8)}-${row.jurisdiction}-${index + 1}`;
        sources.set(id, { id, authority: titles[index] ?? url, title: titles[index] ?? url, url, publisher: titles[index] ?? url, retrievedAt: `${finding.reviewed}T12:00:00Z`, type: "official", verificationStatus: "verified" });
        entry.sourceIds.add(id);
      });
    }
    for (const mode of row.takeModes ?? []) if (MODES.has(mode)) entry.takeModes.add(mode);
    entry.statuses.add(row.status);
    entry.sourceIds.add(sourceId);
    entry.authorityNames.add(row.rawName);
    entry.resolvedBy.add(method);
    perSpecies.set(jurisdictionId, entry);
    evidence.set(speciesId, perSpecies);
  }
}

const COLUMNS = ["jurisdiction", "authority", "rawName", "listedAs", "member", "speciesId", "resolution", "published", "publication", "takeModes", "status", "confidence", "seasonYear", "sourceTitle", "sourceUrl", "note"];
const csv = [COLUMNS.join(","), ...matrix
  .sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction) || a.rawName.localeCompare(b.rawName) || a.member.localeCompare(b.member))
  .map((row) => COLUMNS.map((key) => csvCell(Array.isArray(row[key]) ? row[key].join("|") : row[key] ?? "")).join(","))].join("\n");
await writeFile(resolve(ROOT, "research/hunting/species-take-matrix.csv"), `${csv}\n`);

const species = [...evidence].sort(([a], [b]) => a.localeCompare(b)).map(([speciesId, perSpecies]) => ({
  speciesId,
  jurisdictions: [...perSpecies.values()].sort((a, b) => a.jurisdictionId.localeCompare(b.jurisdictionId)).map((entry) => ({
    jurisdictionId: entry.jurisdictionId,
    takeModes: [...entry.takeModes].sort(),
    statuses: [...entry.statuses].sort(),
    authorityNames: [...entry.authorityNames].sort(),
    resolvedBy: [...entry.resolvedBy].sort(),
    sourceIds: [...entry.sourceIds].sort(),
    ...(entry.conditions.size ? { conditions: [...entry.conditions] } : {}),
  })),
}));
const bundle = {
  contractVersion: "1.0", generatedAt: `${RETRIEVED}T12:00:00Z`,
  entities: [], resources: [], blocks: [], relationships: [], claims: [], media: [],
  sources: [...sources.values()].sort((a, b) => a.id.localeCompare(b.id)),
  takeEvidence: species,
};
await writeFile(resolve(PUBLISHED, "species-take-evidence.json"), `${JSON.stringify(bundle, null, 1)}\n`);

/* Every group row's resolution, with its basis and the members it reached or
   refused — the regulatory lanes' finite workload for the rest. */
const GROUP_COLUMNS = ["jurisdiction", "rawName", "status", "state", "members", "excluded", "basis", "sourceUrl"];
await writeFile(resolve(ROOT, "research/hunting/take-group-resolutions.csv"), `${[GROUP_COLUMNS.join(","), ...groupResolutions
  .sort((a, b) => a.row.jurisdiction.localeCompare(b.row.jurisdiction) || a.row.rawName.localeCompare(b.row.rawName))
  .map(({ row, state, members, excluded, basis }) => [row.jurisdiction, row.rawName, row.status, state, members.join("|"), excluded.map(({ id, why }) => `${id} (${why})`).join("|"), basis, row.sourceUrl].map(csvCell).join(","))].join("\n")}\n`);
const groupCounts = Object.fromEntries(GROUP_STATES.map((state) => [state, groupResolutions.filter((item) => item.state === state).length]));
console.log(`group rows: ${groupResolutions.length}`, groupCounts);

/* The exclusions file documents, for each excluded taxon, the jurisdictions and
   sources that list it — filled from the audit so it cannot drift from it. */
const exclusionPath = resolve(ROOT, "research/hunting/take-exclusions.csv");
const exclusionRows = parseCsv(await readFile(exclusionPath, "utf8"));
const EXCLUSION_COLUMNS = ["scientific_name", "common_name", "reason", "detail", "jurisdiction_ids", "source_urls", "reviewed"];
await writeFile(exclusionPath, `${[EXCLUSION_COLUMNS.join(","), ...exclusionRows.map((row) => {
  const seen = excludedEvidence.get(binomial(row.scientific_name));
  const filled = { ...row, jurisdiction_ids: seen ? [...seen.jurisdictions].sort().join("|") : "", source_urls: seen ? [...seen.urls].sort().join("|") : "" };
  return EXCLUSION_COLUMNS.map((key) => csvCell(filled[key] ?? "")).join(",");
})].join("\n")}\n`);

const counts = matrix.reduce((acc, row) => ({ ...acc, [row.resolution]: (acc[row.resolution] ?? 0) + 1 }), {});
console.log(`${rows.length} audit rows → ${matrix.length} matrix rows`, counts);
console.log(`${species.length} published species carry take evidence from ${sources.size} authority sources`);
const unmapped = [...new Set(matrix.filter((row) => row.resolution === "UNMAPPED").map((row) => binomial(row.member)))].sort();
if (unmapped.length) console.log(`UNMAPPED (${unmapped.length}): ${unmapped.join(", ")}`);
