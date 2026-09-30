#!/usr/bin/env node
/**
 * Replaces placeholder citations on published species with the pages a
 * researcher actually read (research/hunting/profiles/<slug>.json).
 *
 * WHY. Waves 2 and 3 cited, for each species, either a Cornell page built from
 * the common name or the ITIS home page. Neither was read for that species —
 * Cornell refused every automated request — so the identification, habitat and
 * range text they "supported" was attributed to a page that never said it.
 * Re-pointing the citation alone would repeat the error, so for those species
 * the CONTENT is replaced too: identification from the profile's field marks
 * and lookalike comparisons, habitat and range from the profile, behaviour
 * added, and the quick answer rebuilt from what the sources say. A name alias
 * the new sources do not use keeps working in search but loses its citation
 * and is marked needs_review, rather than being re-cited to a page that does
 * not contain it.
 *
 * Species whose sources were read (government pages from waves 1 and 2) keep
 * their text; they gain behaviour and the profile's sources.
 *
 * Run AFTER the wave builders, which regenerate the placeholder text; the test
 * `species-provenance.test.ts` fails if a placeholder citation survives.
 * Idempotent.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const NOW = "2026-09-30T18:00:00Z";
const REVIEWED = "2026-09-30";
const BUNDLES = ["en-CA", "species-wave-1", "species-wave-2a", "species-wave-2b", "species-wave-2c", "species-wave-2d", "species-wave-3a", "species-wave-3b", "species-wave-3c"];
/* Wave 4 is generated from its profiles directly and needs no enrichment. */
const PLACEHOLDER = /^source:(cornell|itis)-/;
const OFFICIAL_HOSTS = /\.gov(\/|$)|\.gc\.ca|quebec\.ca|ontario\.ca|canada\.ca|alberta\.ca|gov\.bc\.ca|hww\.ca/;

const bundles = new Map();
for (const name of BUNDLES) bundles.set(name, JSON.parse(await readFile(resolve(ROOT, `content/published/${name}.json`), "utf8")));
const titles = new Map([...bundles.values()].flatMap((bundle) => bundle.resources.filter((item) => item.type === "species").map((item) => [item.title.toLowerCase(), item.id])));

/* Pass 1 — a plan per species: its profile, the new sources, and which
   placeholder ids it retires. */
const plans = new Map();
for (const bundle of bundles.values()) {
  for (const resource of bundle.resources.filter((item) => item.type === "species")) {
    let profile;
    try {
      profile = JSON.parse(await readFile(resolve(ROOT, `research/hunting/profiles/${resource.slug}.json`), "utf8"));
    } catch {
      continue;
    }
    const sources = profile.sources.map((source, index) => ({
      id: `source:profile-${resource.slug}-${index + 1}`, authority: source.publisher, title: source.title, url: source.url, publisher: source.publisher,
      retrievedAt: NOW, type: OFFICIAL_HOSTS.test(source.url) ? "official" : "scientific", verificationStatus: "verified",
    }));
    const placeholders = resource.speciesProfile.sourceIds.filter((id) => PLACEHOLDER.test(id));
    const marks = (profile.fieldMarks ?? []).map((text) => text.replace(/\.?$/, "."));
    plans.set(resource.id, { profile, sources, newIds: sources.map(({ id }) => id), placeholders: marks.length ? placeholders : [], marks });
  }
}
const retired = new Map([...plans.values()].flatMap((plan) => plan.placeholders.map((id) => [id, plan])));

/* Pass 2 — every bundle: retire placeholder citations wherever they appear. */
function rewrite(value) {
  if (Array.isArray(value)) {
    if (value.length && value.every((item) => typeof item === "string")) {
      return [...new Set(value.flatMap((item) => retired.get(item)?.newIds ?? [item]))];
    }
    return value.map(rewrite);
  }
  if (value && typeof value === "object") {
    /* An alias the new sources do not contain is not re-cited to them. */
    if (value.type && value.value && Array.isArray(value.sourceIds) && value.sourceIds.some((id) => retired.has(id)) && value.type !== "scientific_name") {
      const plan = retired.get(value.sourceIds.find((id) => retired.has(id)));
      const named = (plan.profile.aliases ?? []).some((alias) => alias.toLowerCase().includes(value.value.toLowerCase()));
      if (!named) {
        const rest = { ...value, verificationStatus: "needs_review" };
        delete rest.sourceIds;
        return rest;
      }
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "taxonomySourceId" && retired.has(item) ? retired.get(item).newIds[0] : rewrite(item)]));
  }
  return value;
}

let replaced = 0, enriched = 0;
for (const [name, original] of bundles) {
  let bundle = rewrite(original);
  bundle.sources = bundle.sources.filter((source) => !retired.has(source.id));
  bundle.resources = bundle.resources.map((resource) => {
    const plan = plans.get(resource.id);
    if (!plan || resource.type !== "species") return resource;
    enriched += 1;
    const { profile, sources, newIds, placeholders, marks } = plan;
    bundle.sources = [...bundle.sources.filter((source) => !newIds.includes(source.id)), ...sources];
    const sourced = (text) => ({ text, sourceIds: newIds });
    const updated = { ...resource, speciesProfile: { ...resource.speciesProfile } };
    if (placeholders.length) {
      const comparisons = (profile.lookalikes ?? []).filter((item) => item.howToTell)
        .map((item) => `Compared with ${item.name.toLowerCase().startsWith("the ") ? item.name : `the ${item.name.toLowerCase()}`}: ${item.howToTell.replace(/\.?$/, ".")}`);
      updated.speciesProfile.identification = [...marks, ...comparisons].map(sourced);
      if (profile.habitat?.length) updated.speciesProfile.habitat = profile.habitat.map(sourced);
      if (profile.range) {
        updated.speciesProfile.rangeSummary = [{ locale: "en-CA", value: profile.range }];
        updated.keyFacts = (updated.keyFacts ?? []).map((fact) => (fact.id === "range" ? { ...fact, label: "Range", value: profile.range, sourceIds: newIds } : fact));
      }
      const protectedLead = ["NON_QUARRY", "LIMITED_TAKE"].includes(updated.speciesProfile.takeEligibility) ? " Do not shoot unless you are certain of the species." : "";
      updated.quickAnswer = `${updated.title} (${updated.speciesProfile.scientificName}): ${marks.slice(0, 2).join(" ")}${protectedLead} This profile does not establish whether taking it is legal anywhere.`;
      replaced += 1;
    }
    updated.speciesProfile.sourceIds = [...new Set([...updated.speciesProfile.sourceIds, ...newIds])];
    updated.sourceIds = [...new Set([...(updated.sourceIds ?? []), ...newIds])];
    if (profile.behavior?.length) updated.speciesProfile.behavior = profile.behavior.map(sourced);
    const similar = (profile.lookalikes ?? []).map((item) => titles.get(String(item.name).toLowerCase()) ?? null).filter((id) => id && id !== resource.id);
    if (similar.length) updated.speciesProfile.similarSpeciesIds = [...new Set([...(updated.speciesProfile.similarSpeciesIds ?? []), ...similar])];
    updated.lastReviewed = REVIEWED;
    updated.speciesProfile.lastReviewed = REVIEWED;
    return updated;
  });
  await writeFile(resolve(ROOT, `content/published/${name}.json`), `${JSON.stringify(bundle, null, 2)}\n`);
}
console.log(`${enriched} species enriched; ${replaced} had placeholder-cited text replaced; ${retired.size} placeholder sources retired`);
