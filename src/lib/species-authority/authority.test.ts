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

test("hunting sections are refused on every eligibility that may not carry a hunting guide", () => {
  /*
   * Widened from NON_QUARRY alone. The gate is the repository's existing
   * capability allowlist, so UNKNOWN — take status not established — and
   * LIMITED_TAKE, whose legal opportunity is narrow and conditional, are
   * refused for the same reason and by the same rule.
   */
  for (const eligibility of ["NON_QUARRY", "UNKNOWN", "LIMITED_TAKE"] as const) {
    const page = clone();
    page.huntingCompatibility = eligibility;
    assert.throws(
      () => validateSpeciesAuthorityPage(page),
      new RegExp(`a ${eligibility} page includes incompatible #(how-to-hunt|shot-placement|equipment)`),
      `${eligibility} was allowed to carry hunting guidance`,
    );
  }
  /* The positive control: an eligibility that MAY carry a hunting guide still
     validates, so the rule is a gate rather than a blanket refusal. */
  const huntable = clone();
  huntable.huntingCompatibility = "HUNTABLE";
  assert.doesNotThrow(() => validateSpeciesAuthorityPage(huntable));
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
  /* Explorers are optional now, so this reads the ones the page declares. The
     white-tail page declares all five; the filter asserts that rather than
     assuming it, so losing one would fail here rather than pass vacuously. */
  const explorers = whiteTailedDeerAuthorityPage.visualExplorers ?? {};
  const declared = [explorers.identification, explorers.habitat, explorers.diet, explorers.signs, explorers.shotPlacement].filter((explorer) => explorer !== undefined);
  assert.equal(declared.length, 5, "the reference page should still declare all five explorers");
  const usedRenditions = new Set(declared.flatMap((explorer) => explorer.items.flatMap((item) => [item.renditionId, "anatomyRenditionId" in item ? item.anatomyRenditionId : undefined]).filter(Boolean)));
  for (const asset of whiteTailedDeerAuthorityPage.visualAssets.filter(({ status }) => status !== "USED")) {
    for (const rendition of asset.renditions ?? []) assert.ok(!usedRenditions.has(rendition.id));
  }
  assert.equal(whiteTailedDeerAuthorityPage.visualAssets.find(({ id }) => id === "visual:sex-age")?.status, "REVIEW_REQUIRED");
  assert.equal(whiteTailedDeerAuthorityPage.visualAssets.find(({ id }) => id === "visual:tracks-diagram")?.status, "REVIEW_REQUIRED");
  assert.equal(whiteTailedDeerAuthorityPage.visualAssets.find(({ id }) => id === "visual:shot-frontal")?.status, "NOT_USED");
});

test("shot decisions and anatomy registration stay synchronized", () => {
  const shotPlacement = whiteTailedDeerAuthorityPage.visualExplorers?.shotPlacement;
  assert.ok(shotPlacement, "the reference page should still declare a shot-placement explorer");
  const shots = shotPlacement.items;
  assert.deepEqual(shots.map(({ id, assessment }) => [id, assessment]), [
    ["broadside", "PREFERRED"], ["quartering-away", "CONDITIONAL"], ["frontal", "PASS"], ["quartering-toward", "PASS"], ["rear-facing", "PASS"],
  ]);
  const anatomyItems = shots.filter(({ anatomyRenditionId }) => anatomyRenditionId);
  assert.deepEqual(anatomyItems.map(({ id, registration }) => [id, registration]), [["quartering-away", "REGISTERED_PAIR"]]);
  for (const item of shots.filter(({ assessment }) => assessment === "PASS")) assert.equal(item.renditionId, undefined);
});

test("an asserted claim with no citation is refused, and so is an uncited FAQ answer", () => {
  /*
   * THE HOLE WAS INSIDE THE RULE MEANT TO PREVENT IT. The validator checked the
   * SHAPE of a citation that existed — prefix, resolution to a declared source —
   * and was silent on a claim having none. Measured before the fix: stripping
   * `citations` to [] on `overview-adaptable`, text intact, was ACCEPTED with no
   * issues, as was a claim with empty text and a valid citation.
   *
   * It matters most for the adapter: 485 pages built from existing profile
   * prose would each have been able to ship an uncited assertion while still
   * looking sourced.
   */
  const uncited = clone();
  uncited.sections[0].claims[0].citations = [];
  assert.throws(() => validateSpeciesAuthorityPage(uncited), /asserts text with no citation/);

  const empty = clone();
  empty.sections[0].claims[0].text = "   ";
  assert.throws(() => validateSpeciesAuthorityPage(empty), /has no text/);

  const uncitedFaq = clone();
  uncitedFaq.faq[0].citations = [];
  assert.throws(() => validateSpeciesAuthorityPage(uncitedFaq), /answers with no citation/);

  /* The positive control: the reference page itself satisfies all three, so the
     rule is a gate rather than something that rejects every page. */
  assert.doesNotThrow(() => validateSpeciesAuthorityPage(clone()));
});
