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
