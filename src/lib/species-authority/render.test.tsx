import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import SpeciesAuthorityPage from "../../components/species-authority/SpeciesAuthorityPage.tsx";
import { contentRepository } from "../content/repository.ts";
import { whiteTailedDeerAuthorityPage } from "./white-tailed-deer.ts";

test("authority page server HTML exposes one H1, every canonical anchor, answers, links and FAQ schema", async () => {
  const resource = await contentRepository.getResourceBySlug("white-tailed-deer", { locale: "en-CA" });
  assert.ok(resource?.type === "species");
  const html = renderToStaticMarkup(<SpeciesAuthorityPage page={whiteTailedDeerAuthorityPage} resource={resource} image={null} regulatoryJurisdictions={[{ nameEn: "Ontario" }]} />);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  for (const id of whiteTailedDeerAuthorityPage.sectionOrder) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /This page does not tell you that a hunt is legal/);
  assert.match(html, /href="\/hunt\?species=white-tailed-deer"/);
  assert.match(html, /href="\/hunt\?species=white-tailed-deer&amp;explore=1"/);
  assert.match(html, /"@type":"FAQPage"/);
  const declaredExplorers = Object.values(whiteTailedDeerAuthorityPage.visualExplorers ?? {}).filter((explorer) => explorer !== undefined);
  assert.equal(declaredExplorers.length, 5, "the reference page should still declare all five explorers");
  for (const explorer of declaredExplorers) {
    assert.match(html, new RegExp(`data-explorer="${explorer.id}"`));
    for (const item of explorer.items) assert.match(html, new RegExp(`data-explorer-panel="${item.id}"`));
  }
  assert.match(html, /Choose the angle before the target/);
  assert.match(html, /Several signs together/);
  assert.match(html, /This explorer does not make a hunt legal/);
  assert.doesNotMatch(html, /White spots \(year-round\)/);
});

test("every direct answer and claim is in the SERVER-rendered HTML", async () => {
  /*
   * §29: important facts exist in server-rendered HTML, and are not hidden in
   * client-only state. The authority page's whole premise is that each section
   * opens with a direct answer a reader — or a crawler, or an answer engine —
   * receives without running JavaScript. If one moved into client state the
   * page would look identical in a browser and nothing would fail.
   *
   * `renderToStaticMarkup` is the server render with no hydration, so a string
   * absent here is a string no crawler ever sees. Baselined against production
   * before the catalogue migration: 14 of 14 direct answers and 34 of 34 claims
   * were present, so a later regression is attributable to the change that
   * caused it rather than to history.
   */
  const resource = await contentRepository.getResourceBySlug("white-tailed-deer", { locale: "en-CA" });
  assert.ok(resource?.type === "species");
  const served = renderToStaticMarkup(
    <SpeciesAuthorityPage page={whiteTailedDeerAuthorityPage} resource={resource} image={null} regulatoryJurisdictions={[{ nameEn: "Ontario" }]} />,
  );
  const entities = (value: string) => value
    .replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/").replace(/\s+/g, " ");
  /*
   * VISIBLE TEXT, not the HTML string.
   *
   * Searching the raw markup was not the check it looked like: replacing
   * `<p>{section.directAnswer}</p>` with `<p data-answer={section.directAnswer} />`
   * — which removes the sentence from everything a reader or a crawler sees —
   * left this test green, because the string was still present as an attribute
   * value. Tags are stripped first so the assertion is about content.
   */
  const normalise = (value: string) => entities(value);
  const markup = entities(served.replace(/<[^>]*>/g, " "));

  const missingAnswers = whiteTailedDeerAuthorityPage.sections
    .filter((section) => section.directAnswer.trim())
    .filter((section) => !markup.includes(normalise(section.directAnswer).slice(0, 60)))
    .map((section) => section.id);
  assert.deepEqual(missingAnswers, [], "these sections' direct answers are not in the server response");

  const claims = whiteTailedDeerAuthorityPage.sections
    .flatMap((section) => [...section.claims, ...(section.subsections ?? []).flatMap((sub) => sub.claims)]);
  /* A positive control: the assertions above are satisfied by there being
     nothing to check, so the corpus has to be real. */
  assert.ok(claims.length >= 20, `only ${claims.length} claims to check`);
  const missingClaims = claims
    .filter((claim) => !markup.includes(normalise(claim.text).slice(0, 55)))
    .map((claim) => claim.id);
  assert.deepEqual(missingClaims, [], "these claims are not in the server response");
});
