import assert from "node:assert/strict";
import test from "node:test";
import { access, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AUTHORITY_SECTION_IDS, type SpeciesAuthorityPage } from "./types.ts";
import { SpeciesAuthorityValidationError, validateSpeciesAuthorityPage } from "./validate.ts";
import { whiteTailedDeerAuthorityPage } from "./white-tailed-deer.ts";

const clone = () => structuredClone(whiteTailedDeerAuthorityPage) as SpeciesAuthorityPage;

test("white-tailed deer satisfies the authority-page knowledge contract", () => {
  const page = validateSpeciesAuthorityPage(clone(), new Set(["species:white-tailed-deer", "species:mule-deer"]));
  assert.deepEqual(page.sectionOrder, [...AUTHORITY_SECTION_IDS]);
  assert.equal(page.huntLinks.legality, "/hunt?species=white-tailed-deer");
  assert.equal(page.huntLinks.map, "/hunt?species=white-tailed-deer&explore=1");
  assert.equal(page.status, "REFERENCE_IMPLEMENTATION");
});

test("validation catches broken anchors, species references, citations, Hunt links and orphan sources", () => {
  const page = clone();
  page.sectionOrder[0] = "missing" as "overview";
  page.speciesReferences[0].speciesId = "species:not-real";
  page.sections[0].claims[0].citations[0].sourceId = "bad-source";
  page.huntLinks.legality = "/hunt?species=mule-deer";
  page.sources.push({ ...page.sources[0], id: "source:orphan" });
  assert.throws(
    () => validateSpeciesAuthorityPage(page, new Set(["species:white-tailed-deer"])),
    (error: unknown) => error instanceof SpeciesAuthorityValidationError
      && /missing #overview|missing #missing|navigation/.test(error.message)
      && /nonexistent species reference/.test(error.message)
      && /malformed citation/.test(error.message)
      && /not canonical/.test(error.message)
      && /orphan source/.test(error.message),
  );
});

test("hunting sections are incompatible with a non-quarry authority page", () => {
  const page = clone();
  page.huntingCompatibility = "NON_QUARRY";
  assert.throws(() => validateSpeciesAuthorityPage(page), /non-quarry page includes incompatible/);
});

test("missing direct answers and duplicate FAQ ids fail validation", () => {
  const page = clone();
  page.sections[2].directAnswer = "";
  page.faq[1].id = page.faq[0].id;
  assert.throws(() => validateSpeciesAuthorityPage(page), /no direct answer[\s\S]*duplicate section\/FAQ ids|duplicate section\/FAQ ids[\s\S]*no direct answer/);
});

test("every published visual exists with the declared intrinsic dimensions", async () => {
  const renditions = whiteTailedDeerAuthorityPage.visualAssets.flatMap((asset) => asset.renditions ?? []);
  assert.equal(renditions.length, 17);
  for (const rendition of renditions) {
    const file = path.join(process.cwd(), "public", rendition.src);
    await access(file);
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.format, "webp", rendition.id);
    assert.equal(metadata.width, rendition.width, rendition.id);
    assert.equal(metadata.height, rendition.height, rendition.id);
  }
});

test("the asset manifest accounts for every supplied original and its dimensions", async () => {
  const sourceDir = path.join(process.cwd(), "public", "White tail deer");
  const files = (await readdir(sourceDir)).sort();
  const declared = whiteTailedDeerAuthorityPage.visualAssets.map(({ originalPath }) => originalPath.split("/").at(-1)!).sort();
  assert.equal(files.length, 17);
  assert.deepEqual(declared, files);
  for (const asset of whiteTailedDeerAuthorityPage.visualAssets) {
    const metadata = await sharp(path.join(process.cwd(), "public", asset.originalPath)).metadata();
    assert.equal(metadata.width, asset.width, asset.id);
    assert.equal(metadata.height, asset.height, asset.id);
  }
});

test("review-required and conflicting source art is omitted from every explorer", () => {
  const explorers = whiteTailedDeerAuthorityPage.visualExplorers;
  const usedRenditions = new Set([explorers.identification, explorers.habitat, explorers.diet, explorers.signs, explorers.shotPlacement].flatMap((explorer) => explorer.items.flatMap((item) => [item.renditionId, "anatomyRenditionId" in item ? item.anatomyRenditionId : undefined]).filter(Boolean)));
  for (const asset of whiteTailedDeerAuthorityPage.visualAssets.filter(({ status }) => status !== "USED")) {
    for (const rendition of asset.renditions ?? []) assert.ok(!usedRenditions.has(rendition.id));
  }
  assert.equal(whiteTailedDeerAuthorityPage.visualAssets.find(({ id }) => id === "visual:sex-age")?.status, "REVIEW_REQUIRED");
  assert.equal(whiteTailedDeerAuthorityPage.visualAssets.find(({ id }) => id === "visual:tracks-diagram")?.status, "REVIEW_REQUIRED");
  assert.equal(whiteTailedDeerAuthorityPage.visualAssets.find(({ id }) => id === "visual:shot-frontal")?.status, "NOT_USED");
});

test("shot decisions and anatomy registration stay synchronized", () => {
  const shots = whiteTailedDeerAuthorityPage.visualExplorers.shotPlacement.items;
  assert.deepEqual(shots.map(({ id, assessment }) => [id, assessment]), [
    ["broadside", "PREFERRED"], ["quartering-away", "CONDITIONAL"], ["frontal", "PASS"], ["quartering-toward", "PASS"], ["rear-facing", "PASS"],
  ]);
  const anatomyItems = shots.filter(({ anatomyRenditionId }) => anatomyRenditionId);
  assert.deepEqual(anatomyItems.map(({ id, registration }) => [id, registration]), [["quartering-away", "REGISTERED_PAIR"]]);
  for (const item of shots.filter(({ assessment }) => assessment === "PASS")) assert.equal(item.renditionId, undefined);
});
