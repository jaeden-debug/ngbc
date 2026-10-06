import assert from "node:assert/strict";
import test from "node:test";
import { contentRepository } from "../content/repository.ts";
import { capabilitiesOf } from "../content/species-eligibility.ts";
import { adaptSpeciesAuthorityPage } from "./adapt.ts";
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
    conservationStatus?: Array<{ status?: string; text: string }>;
  };
}

async function publishedSpecies(): Promise<SpeciesLike[]> {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  return resources.filter((resource) => resource.type === "species") as unknown as SpeciesLike[];
}

async function pageFor(resource: SpeciesLike) {
  const profile = resource.speciesProfile;
  const sourceIds = [...new Set<string>([
    ...(profile.identification ?? []).flatMap((claim) => claim.sourceIds ?? []),
    ...(profile.habitat ?? []).flatMap((claim) => claim.sourceIds ?? []),
    ...(profile.behavior ?? []).flatMap((claim) => claim.sourceIds ?? []),
    ...(profile.seasonalBehavior ?? []).flatMap((claim) => claim.sourceIds ?? []),
    ...(profile.signsAndTracks ?? []).flatMap((claim) => claim.sourceIds ?? []),
    ...(resource.keyFacts ?? []).flatMap((fact) => fact.sourceIds ?? []),
  ])];
  const sources = sourceIds.length
    ? await contentRepository.getSources(sourceIds as Parameters<typeof contentRepository.getSources>[0])
    : [];
  return adaptSpeciesAuthorityPage({
    speciesId: profile.speciesId, slug: resource.slug, commonName: resource.title,
    scientificName: profile.scientificName ?? "", quickAnswer: resource.quickAnswer ?? "",
    takeEligibility: profile.takeEligibility, reviewedAt: "2026-10-06",
    keyFacts: resource.keyFacts ?? [], identification: profile.identification,
    habitat: profile.habitat, behavior: profile.behavior,
    seasonalBehavior: profile.seasonalBehavior, signsAndTracks: profile.signsAndTracks,
    rangeSummary: profile.rangeSummary?.[0]?.value, conservationStatus: profile.conservationStatus,
    sources,
  });
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
