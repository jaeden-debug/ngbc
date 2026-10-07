import assert from "node:assert/strict";
import test from "node:test";
import { contentRepository } from "../content/repository.ts";
import { capabilitiesOf } from "../content/species-eligibility.ts";
import { adaptSpeciesAuthorityPage, adapterInputFor, adapterSourceIds } from "./adapt.ts";
import { validateSpeciesAuthorityPage } from "./validate.ts";

/**
 * EVERY PUBLISHED SPECIES BUILDS A VALID AUTHORITY PAGE FROM ITS OWN DATA.
 *
 * The catalogue holds 485 published species and had exactly one authored
 * authority page. This asserts the adapter closes that gap without inventing
 * anything: each page is built from the species' own cited profile prose and
 * then run through the real validator.
 */

const HUNTING_SECTIONS = new Set(["how-to-hunt", "shot-placement", "equipment"]);

/** Only the fields the adapter reads; typed here so the test is not `any`. */
interface ProfileClaim { text: string; sourceIds: string[] }
interface SpeciesLike {
  type: string;
  slug: string;
  title: string;
  quickAnswer?: string;
  keyFacts?: Array<{ label: string; value: string; sourceIds: string[] }>;
  speciesProfile: {
    speciesId: string;
    scientificName?: string;
    takeEligibility: "HUNTABLE" | "LIMITED_TAKE" | "NUISANCE_OR_INVASIVE_TAKE" | "NON_QUARRY" | "UNKNOWN";
    identification?: ProfileClaim[];
    habitat?: ProfileClaim[];
    behavior?: ProfileClaim[];
    seasonalBehavior?: ProfileClaim[];
    signsAndTracks?: ProfileClaim[];
    rangeSummary?: Array<{ value: string }>;
    conservationStatus?: Array<{ status?: string; text: string; sourceIds?: string[] }>;
  };
}

async function publishedSpecies(): Promise<SpeciesLike[]> {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  return resources.filter((resource) => resource.type === "species") as unknown as SpeciesLike[];
}

async function pageFor(resource: SpeciesLike) {
  /*
   * The route's own mapping, not a copy of it.
   *
   * This built the adapter input and its source list by hand, and the moment
   * the adapter started citing conservation statements the hand-built list did
   * not fetch their sources — 37 species failed validation here while the
   * route would have served them. A gate that constructs its own input is
   * certifying something production does not run.
   */
  const sourceIds = adapterSourceIds(resource);
  const sources = sourceIds.length
    ? await contentRepository.getSources(sourceIds as Parameters<typeof contentRepository.getSources>[0])
    : [];
  return adaptSpeciesAuthorityPage(adapterInputFor(resource, sources, "2026-10-06"));
}

test("every published species builds a page the real validator accepts", async () => {
  const resources = await publishedSpecies();
  /* A positive control on the denominator: this is the whole catalogue, not a
     sample that happens to be easy. A shrinking corpus would otherwise make
     this test pass by having less to check. */
  assert.ok(resources.length >= 400, `only ${resources.length} published species found`);

  const failures: string[] = [];
  const sectionCounts: number[] = [];
  const eligibilities = new Set<string>();
  for (const resource of resources) {
    const page = await pageFor(resource);
    if (!page) { failures.push(`${resource.slug}: no page built`); continue; }
    eligibilities.add(page.huntingCompatibility);
    sectionCounts.push(page.sections.length);
    try { validateSpeciesAuthorityPage(page); }
    catch (error) { failures.push(`${resource.slug}: ${String((error as Error).message).split("\n")[1]?.trim()}`); }
  }
  assert.deepEqual(failures.slice(0, 8), [], `pages failed validation (${failures.length} total)`);

  /*
   * The page is SHORTER where the research is thinner, never padded. If every
   * page carried the same number of sections the adapter would be emitting
   * empty ones, which is the failure this whole design exists to avoid.
   */
  assert.ok(Math.min(...sectionCounts) < Math.max(...sectionCounts), "every page has the same section count, so sections are not following the evidence");

  /* All five take eligibilities are represented, including the ones that could
     not previously be expressed at all. */
  for (const eligibility of ["HUNTABLE", "LIMITED_TAKE", "NUISANCE_OR_INVASIVE_TAKE", "NON_QUARRY", "UNKNOWN"]) {
    assert.ok(eligibilities.has(eligibility), `no adapted page carries ${eligibility}`);
  }
});

test("no adapted page carries hunting guidance its eligibility forbids", async () => {
  /*
   * The validator gates this, but the adapter must not rely on being caught.
   * A profile holds no hunting guidance for any species, so an adapted page
   * asserting a hunt would be fabricating one.
   */
  const resources = await publishedSpecies();
  let checked = 0;
  for (const resource of resources) {
    const page = await pageFor(resource);
    if (!page) continue;
    checked += 1;
    const hunting = page.sections.filter((section) => HUNTING_SECTIONS.has(section.id));
    if (!capabilitiesOf(page.huntingCompatibility).huntingGuideTitle) {
      assert.deepEqual(hunting, [], `${page.slug} is ${page.huntingCompatibility} and carries hunting guidance`);
    }
    assert.deepEqual(hunting, [], `${page.slug} asserts hunting guidance no profile holds`);
  }
  assert.ok(checked >= 400, `positive control: only ${checked} pages were checked`);
});

test("the Hunt handoff follows each species' capabilities, across the whole catalogue", async () => {
  /*
   * Found by looking at a rendered page, not by reading code: whooping crane —
   * NON_QUARRY — offered "Open the whooping crane map" directly beneath the
   * sentence "Hunt never offers it". The adapter gave every species both links
   * because the one authored page is HUNTABLE, where both are correct.
   *
   * §41B: Species Heat is drawn for HUNTABLE and NUISANCE_OR_INVASIVE_TAKE
   * alone. LIMITED_TAKE is excluded deliberately — a narrow quota in three
   * counties must never read as huntable everywhere — and that is 237 of the
   * 485 species in this catalogue, the largest class.
   */
  const resources = await publishedSpecies();
  const counts = { map: 0, scoped: 0, plain: 0 };
  const wrong: string[] = [];
  for (const resource of resources) {
    const page = await pageFor(resource);
    if (!page) continue;
    const capabilities = capabilitiesOf(page.huntingCompatibility);
    const slug = resource.slug;
    if (capabilities.speciesHeat) {
      if (page.huntLinks.map !== `/hunt?species=${slug}&explore=1`) wrong.push(`${slug}: ${page.huntingCompatibility} should have a species map`);
      else counts.map++;
    } else if (page.huntLinks.map) {
      wrong.push(`${slug}: ${page.huntingCompatibility} may not carry a species map`);
    }
    if (capabilities.offeredInHunt) {
      if (page.huntLinks.legality !== `/hunt?species=${slug}`) wrong.push(`${slug}: legality link should name the species`);
      else counts.scoped++;
    } else {
      if (page.huntLinks.legality !== "/hunt") wrong.push(`${slug}: ${page.huntingCompatibility} must not select a species Hunt does not offer`);
      else counts.plain++;
    }
  }
  assert.deepEqual(wrong.slice(0, 8), [], `${wrong.length} species carry the wrong Hunt handoff`);
  /* Measured 2026-10-06: 203 HUNTABLE + 27 NUISANCE_OR_INVASIVE_TAKE get a map;
     203 + 27 + 237 LIMITED_TAKE are offered in Hunt; 5 NON_QUARRY + 13 UNKNOWN
     are not. Asserted as numbers so a class silently losing its handoff is
     visible rather than absorbed. */
  assert.equal(counts.map, 230, "species carrying a Species Heat map");
  assert.equal(counts.scoped, 467, "species whose legality link names them");
  assert.equal(counts.plain, 18, "species Hunt does not offer");
});

test("a species with one sourced sentence still gets that section", async () => {
  /*
   * The regression this exists for passed every test in this file.
   *
   * Moving each section's lead sentence into its direct answer left a
   * single-sentence section with an empty `claims` list, and the filter that
   * removes sections emptied by uncitable claims then deleted it. Only a
   * rendered diff of all 485 pages found it: 8 lookalike lists vanished,
   * because they hang off the identification section. beaver, elk, snowshoe
   * hare and pronghorn each have exactly one identification sentence.
   *
   * A section is empty when it has no sourced content, not when its sourced
   * content happens to be its answer.
   */
  const resources = await publishedSpecies();
  const missing: string[] = [];
  let single = 0;
  for (const resource of resources) {
    const profile = resource.speciesProfile;
    const cited = (profile.identification ?? []).filter((claim) => claim.sourceIds?.length);
    if (!cited.length) continue;
    if (cited.length === 1) single++;
    const page = await pageFor(resource);
    const section = page?.sections.find(({ id }) => id === "identification");
    if (!section) { missing.push(`${resource.slug} (${cited.length} sourced identification sentences)`); continue; }
    /* And the sentence is still ON the page, as the answer or as a claim. */
    const present = section.directAnswer === cited[0].text || section.claims.some((claim) => claim.text === cited[0].text);
    if (!present) missing.push(`${resource.slug}: its identification sentence is not rendered anywhere`);
  }
  assert.deepEqual(missing.slice(0, 6), [], `${missing.length} species lost their identification section`);
  /* Measured 2026-10-06: 27 species. The positive control — if this reached
     zero the test above would pass by having nothing to test. */
  assert.equal(single, 27, "the number of single-sentence species changed; re-measure before changing this");
});
