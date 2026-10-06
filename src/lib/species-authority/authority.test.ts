import assert from "node:assert/strict";
import test from "node:test";
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
