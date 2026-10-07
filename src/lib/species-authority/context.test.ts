import assert from "node:assert/strict";
import test from "node:test";
import { contentRepository } from "../content/repository.ts";
import { takeListingsFor } from "../content/species-take-evidence.ts";
import { speciesPageContext, withSpeciesContext } from "./context.ts";
import type { SpeciesResource } from "../content-contract/types.ts";

async function species(): Promise<SpeciesResource[]> {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  return resources.filter((resource): resource is SpeciesResource => resource.type === "species");
}

async function contextFor(resource: SpeciesResource) {
  const ids = resource.speciesProfile.similarSpeciesIds ?? [];
  const resolved = await Promise.all(ids.map((id) => contentRepository.getSpecies(id)));
  const blocks = await contentRepository.getSpeciesBlocks(resource.speciesProfile.speciesId, {
    locale: resource.locale, countryId: "country:ca",
    jurisdictionIds: resource.speciesProfile.documentedHuntingJurisdictionIds,
    activityId: "activity:hunting",
    blockTypes: ["safety_note", "habitat_tip", "identification_warning", "seasonal_behavior", "legal_note"],
    date: resource.lastReviewed,
  });
  return speciesPageContext({
    resource,
    takeListings: takeListingsFor(resource.speciesProfile.speciesId),
    authoritySources: [],
    conservationStatements: resource.speciesProfile.conservationStatus ?? [],
    lookalikes: resolved.flatMap((other) => (other && other.status === "published"
      ? [{ id: other.speciesProfile.speciesId, title: other.title, href: `/hunting/species/${other.slug}`, scientificName: other.speciesProfile.scientificName }]
      : [])),
    fieldNotes: blocks.blocks.map(({ block }) => block),
    groups: await contentRepository.getSpeciesGroups(resource.speciesProfile.speciesId),
    relatedResources: await contentRepository.getRelatedResources(resource.id, { locale: resource.locale, limit: 5 }),
  });
}

/*
 * THE COUNTS, BY NUMBER.
 *
 * Measured 2026-10-06 against the whole catalogue. They are asserted as
 * numbers rather than as "more than none" because the failure this guards is a
 * silent shrink: a projection that quietly stops carrying a family looks
 * exactly like a species that never had one. A number that no longer matches
 * is either a regression or a corpus change, and both deserve to be read by a
 * person rather than absorbed.
 */
const MEASURED = {
  species: 485,
  takeSpecies: 466, takeJurisdictions: 4462, mallard: 52, coyote: 55,
  lookalikeSpecies: 300, relatedSpeciesIdsSpecies: 294,
  fieldNoteSpecies: 334, groupSpecies: 485, groupNames: 942,
  relatedResourceSpecies: 485, reviewedSpecies: 485, conservationSpecies: 37,
};

test("every carried family reaches the page at its measured count", async () => {
  const all = await species();
  assert.equal(all.length, MEASURED.species, "the catalogue changed size; re-measure before changing these numbers");

  const counts = { take: 0, takeJur: 0, lookalike: 0, fieldNote: 0, group: 0, groupNames: 0, resource: 0, reviewed: 0, conservation: 0 };
  let mallard = 0, coyote = 0;
  for (const resource of all) {
    const context = await contextFor(resource);
    if (context.takeListings.length) { counts.take++; counts.takeJur += context.takeListings.length; }
    if (resource.slug === "mallard") mallard = context.takeListings.length;
    if (resource.slug === "coyote") coyote = context.takeListings.length;
    if (context.lookalikes.length) counts.lookalike++;
    if (context.fieldNotes.length) counts.fieldNote++;
    if (context.groups.length) { counts.group++; counts.groupNames += context.groups.length; }
    if (context.relatedResources.length) counts.resource++;
    if (context.lastReviewed) counts.reviewed++;
    if (context.conservationStatements.length) counts.conservation++;
  }
  assert.equal(counts.take, MEASURED.takeSpecies);
  assert.equal(counts.takeJur, MEASURED.takeJurisdictions);
  assert.equal(mallard, MEASURED.mallard);
  assert.equal(coyote, MEASURED.coyote);
  assert.equal(counts.lookalike, MEASURED.lookalikeSpecies);
  assert.equal(counts.fieldNote, MEASURED.fieldNoteSpecies);
  assert.equal(counts.group, MEASURED.groupSpecies);
  assert.equal(counts.groupNames, MEASURED.groupNames, "every group a species belongs to is carried, not just the first");
  assert.equal(counts.resource, MEASURED.relatedResourceSpecies);
  assert.equal(counts.reviewed, MEASURED.reviewedSpecies);
  assert.equal(counts.conservation, MEASURED.conservationSpecies);
});

test("a take listing keeps the whole evidence row, not the fields one renderer used", async () => {
  const all = await species();
  const mallard = all.find((resource) => resource.slug === "mallard");
  assert.ok(mallard, "mallard is the reference case for take evidence");
  const { takeListings } = await contextFor(mallard);
  assert.equal(takeListings.length, MEASURED.mallard);
  /* The narrowed prop shape this replaced carried jurisdiction and takeModes
     and dropped the rest, which is the difference between an auditable
     listing and a decorative one. */
  for (const listing of takeListings) {
    assert.ok(listing.jurisdictionId && listing.jurisdictionName, "a listing needs its jurisdiction");
    assert.ok(Array.isArray(listing.takeModes) && listing.takeModes.length, `${listing.jurisdictionId} has no take mode`);
    assert.ok(Array.isArray(listing.statuses), `${listing.jurisdictionId} lost statuses`);
    assert.ok(Array.isArray(listing.authorityNames), `${listing.jurisdictionId} lost authorityNames`);
    assert.ok(Array.isArray(listing.resolvedBy), `${listing.jurisdictionId} lost resolvedBy`);
    assert.ok(listing.sourceIds.length, `${listing.jurisdictionId} has no source`);
  }
});

test("lookalikes read similarSpeciesIds, which contains every relatedSpeciesIds entry", async () => {
  const all = await species();
  /*
   * WHY similarSpeciesIds IS CANONICAL, measured rather than preferred.
   *
   * Every `relatedSpeciesIds` entry in the catalogue is also a
   * `similarSpeciesIds` entry — 0 exceptions over 485 species — while similar
   * covers 300 species to related's 294 and holds strictly more wherever the
   * two differ. The legacy page read related, so six species showed no
   * lookalikes at all, white-tailed deer among them.
   */
  let notContained = 0, related = 0, similar = 0;
  for (const resource of all) {
    const rel = resource.relatedSpeciesIds ?? [];
    const sim = new Set(resource.speciesProfile.similarSpeciesIds ?? []);
    if (rel.length) related++;
    if (sim.size) similar++;
    if (rel.some((id) => !sim.has(id))) notContained++;
  }
  assert.equal(notContained, 0, "a relatedSpeciesIds entry is missing from similarSpeciesIds, so reading similar alone would drop it");
  assert.equal(related, MEASURED.relatedSpeciesIdsSpecies);
  assert.equal(similar, MEASURED.lookalikeSpecies);
});

test("the projection equals its source, so the two cannot drift", async () => {
  const all = await species();
  /* The agreement check the carry rests on: nothing here is authored, so every
     value must still equal the data that owns it. A second home would show up
     as a disagreement on at least one species. */
  for (const resource of all) {
    const context = await contextFor(resource);
    const id = resource.speciesProfile.speciesId;
    assert.deepEqual(
      context.takeListings.map(({ jurisdictionId }) => jurisdictionId),
      takeListingsFor(id).map(({ jurisdictionId }) => jurisdictionId),
      `${resource.slug}: carried take listings differ from the evidence bundle`,
    );
    assert.deepEqual(
      context.conservationStatements.map(({ text }) => text),
      (resource.speciesProfile.conservationStatus ?? []).map(({ text }) => text),
      `${resource.slug}: carried conservation statements differ from the profile`,
    );
    assert.equal(context.lastReviewed, resource.lastReviewed ?? null, `${resource.slug}: review date differs`);
    assert.equal(
      context.lookalikes.length,
      (await Promise.all((resource.speciesProfile.similarSpeciesIds ?? []).map((other) => contentRepository.getSpecies(other))))
        .filter((other) => other?.status === "published").length,
      `${resource.slug}: a published lookalike was dropped`,
    );
  }
});

test("withSpeciesContext attaches context without changing the page", async () => {
  const all = await species();
  const resource = all[0];
  const context = await contextFor(resource);
  const page = {
    schemaVersion: "1.0.0" as const, speciesId: "species:x" as const, slug: "x",
    canonicalPath: "/hunting/species/x" as const, status: "PUBLISHED" as const,
    huntingCompatibility: "UNKNOWN" as const, reviewedAt: "2026-10-06",
    identity: { commonName: "X", scientificName: "X x", family: "X", directAnswer: "X." },
    facts: [], sectionOrder: [], sections: [], faq: [], sources: [], speciesReferences: [],
    huntLinks: { legality: "/hunt?species=x" as const, map: "/hunt?species=x&explore=1" as const },
    visualAssets: [],
  };
  const carried = withSpeciesContext(page, context);
  assert.deepEqual({ ...carried, context: undefined }, { ...page, context: undefined }, "attaching context changed the page itself");
  assert.deepEqual(carried.context, context);
});
