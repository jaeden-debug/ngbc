#!/usr/bin/env node
/**
 * Derive the migratory species Hunt can offer, from the published library.
 *
 *   node scripts/derive-federal-species.mjs [--check]
 *
 * The alternative was typing twenty-five binomials into a constant. That is a
 * fabrication risk in exactly the class nobody audits: wrong enough to be
 * wrong, plausible enough to survive review forever. Every name here is READ
 * from a species record whose scientific name is verified and carries a source
 * id, and a species whose record does not meet that bar is REPORTED rather
 * than filled in.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { federalSpeciesIds } from "../src/lib/hunt/regulatory/federal.ts";

const OUT = "content/regulatory/ca-federal-species.generated.json";

function library() {
  const records = new Map();
  for (const file of readdirSync("content/published").filter((name) => name.endsWith(".json"))) {
    for (const entity of JSON.parse(readFileSync(`content/published/${file}`, "utf8")).entities ?? []) {
      if (entity.type !== "species") continue;
      const scientific = (entity.aliases ?? []).find((alias) => alias.type === "scientific_name");
      records.set(entity.id, {
        displayName: (entity.names ?? []).find((name) => name.locale === "en-CA")?.value,
        scientificName: scientific?.value,
        scientificVerified: scientific?.verificationStatus === "verified",
        scientificSourced: (scientific?.sourceIds ?? []).length > 0,
        slug: (entity.slugs ?? []).find((slug) => slug.locale === "en-CA")?.value,
      });
    }
  }
  return records;
}

function main() {
  const records = library();
  const offered = [];
  const withheld = [];

  for (const id of [...federalSpeciesIds()].sort()) {
    const record = records.get(id);
    if (!record) {
      withheld.push({ id, reason: "no species record in the published library" });
      continue;
    }
    const missing = [
      !record.displayName && "an English name",
      !record.scientificName && "a scientific name",
      record.scientificName && !record.scientificVerified && "a VERIFIED scientific name",
      record.scientificName && !record.scientificSourced && "a source for its scientific name",
      !record.slug && "a slug, so it has no species page to link to",
    ].filter(Boolean);
    if (missing.length) {
      withheld.push({ id, displayName: record.displayName ?? null, reason: `the library record lacks ${missing.join(", ")}` });
      continue;
    }
    offered.push({
      id,
      displayName: record.displayName,
      scientificName: record.scientificName,
      resourcePath: `/hunting/species/${record.slug}`,
    });
  }

  const derived = {
    generatedBy: "scripts/derive-federal-species.mjs",
    note:
      "Derived from the published species library. Names are never typed here: a species whose record lacks a " +
      "verified, sourced scientific name or a slug is WITHHELD and listed below, because a plausible binomial " +
      "nobody audits is worse than a declared gap. Withheld species remain members of their federal group, so a " +
      "shared limit still names them in the regulation's own words.",
    offered,
    withheld,
  };
  const serialised = `${JSON.stringify(derived, null, 2)}\n`;

  if (process.argv.includes("--check")) {
    if (readFileSync(OUT, "utf8") !== serialised) throw new Error(`${OUT} does not reproduce from the library.`);
    console.log("Derived species reproduce byte for byte.");
    return;
  }
  writeFileSync(OUT, serialised);
  console.log(`offered ${offered.length} | withheld ${withheld.length}`);
  for (const entry of withheld) console.log(`  withheld ${entry.id}: ${entry.reason}`);
  console.log(`Wrote ${OUT}`);
}

main();
