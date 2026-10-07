import assert from "node:assert/strict";
import test from "node:test";
import type { SpeciesMediaVariant, SpeciesPrimaryMedia } from "../species-media/types.ts";
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

test("FAQ structured data is emitted only when the page renders an FAQ", async () => {
  /*
   * A FAQPage whose mainEntity is empty is invalid structured data, and §29
   * forbids schema claims the page does not support. This was emitted
   * unconditionally — invisible while exactly one authority page existed and it
   * had five questions. An adapter-built page has none, so migrating the
   * catalogue would have published an empty FAQPage on every species, where the
   * only consumers who notice are search engines and answer engines.
   */
  const resource = await contentRepository.getResourceBySlug("white-tailed-deer", { locale: "en-CA" });
  assert.ok(resource?.type === "species");

  /* The positive control: the reference page HAS questions, so the schema must
     be present — otherwise this test would pass by the schema never rendering. */
  assert.ok(whiteTailedDeerAuthorityPage.faq.length > 0, "the reference page should carry FAQ entries");
  const withFaq = renderToStaticMarkup(
    <SpeciesAuthorityPage page={whiteTailedDeerAuthorityPage} resource={resource} image={null} regulatoryJurisdictions={[]} />,
  );
  assert.match(withFaq, /"@type":"FAQPage"/);

  const withoutFaq = renderToStaticMarkup(
    <SpeciesAuthorityPage
      page={{ ...whiteTailedDeerAuthorityPage, faq: [], sections: whiteTailedDeerAuthorityPage.sections.filter((s) => s.id !== "faq"), sectionOrder: whiteTailedDeerAuthorityPage.sectionOrder.filter((id) => id !== "faq") }}
      resource={resource} image={null} regulatoryJurisdictions={[]} />,
  );
  assert.doesNotMatch(withoutFaq, /"@type":"FAQPage"/, "a page with no FAQ still published FAQ structured data");
});

test("a species with no photograph renders no frame, no caption and no placeholder", async () => {
  /*
   * 216 of 485 species have no verified photograph, so this is the common state
   * and not the fallback. It used to render a 280px bordered box with a photo
   * icon and "No verified primary photograph is set" beneath it — an empty
   * frame and an apology, on nearly half the catalogue.
   *
   * The requirement is that the page look INTENTIONAL without a photo, which
   * means the media column is absent rather than empty.
   */
  const resource = await contentRepository.getResourceBySlug("white-tailed-deer", { locale: "en-CA" });
  assert.ok(resource?.type === "species");
  const html = renderToStaticMarkup(
    <SpeciesAuthorityPage page={whiteTailedDeerAuthorityPage} resource={resource} image={null} regulatoryJurisdictions={[]} />,
  );

  assert.doesNotMatch(html, /No verified primary photograph/, "the page apologised for a missing photo");
  assert.doesNotMatch(html, /image coming soon|photo unavailable|no image available/i, "an unfinished-looking state was rendered");
  assert.doesNotMatch(html, /heroMedia/, "an empty media figure was reserved for a photo that does not exist");
  assert.match(html, /data-media="none"/, "the hero does not declare that it has no media, so it cannot lay out without it");

  /* The page still has to be a page: name, answer and the facts that give it
     structure in place of the photograph. */
  assert.match(html, new RegExp(whiteTailedDeerAuthorityPage.identity.commonName));
  assert.ok(whiteTailedDeerAuthorityPage.facts.length > 0, "positive control: the reference page carries quick facts");

  /* And with a photograph the figure IS rendered — otherwise this test would
     pass by the media column never appearing at all. The fixture is typed, not
     cast: a cast let an earlier version of this compile without `focal`, and
     the only thing that caught it was the renderer throwing. */
  const rendition = (variant: SpeciesMediaVariant) => ({ variant, url: "/x.webp", width: 800, height: 600 });
  const photo: SpeciesPrimaryMedia = {
    assetId: "00000000-0000-4000-8000-000000000000",
    speciesId: "species:white-tailed-deer",
    source: "MANUAL",
    altText: "A white-tailed deer",
    caption: null,
    creator: "North Ground",
    licence: "All rights reserved",
    credit: null,
    renditions: { profile: rendition("profile"), card: rendition("card"), avatar: rendition("avatar"), cover: rendition("cover") },
    focal: { x: 50, y: 50 },
  };
  const withPhoto = renderToStaticMarkup(
    <SpeciesAuthorityPage page={whiteTailedDeerAuthorityPage} resource={resource} regulatoryJurisdictions={[]} image={photo} />,
  );
  assert.match(withPhoto, /heroMedia/, "a species WITH a photograph lost its media figure");
  assert.match(withPhoto, /data-media="photo"/);
});
