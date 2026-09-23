import assert from "node:assert/strict";
import test from "node:test";
import {
  breadcrumbJsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from "./structured-data.ts";

test("Organization and WebSite share stable entity identifiers", () => {
  const organization = organizationJsonLd();
  const website = websiteJsonLd();

  assert.equal(organization["@type"], "Organization");
  assert.equal(organization["@id"], "https://www.northgroundbushcraft.com/#organization");
  assert.equal(website["@type"], "WebSite");
  assert.deepEqual(website.publisher, { "@id": organization["@id"] });
});

test("breadcrumb schema uses absolute URLs and sequential positions", () => {
  const data = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Field notes", path: "/field-notes" },
  ]);

  assert.deepEqual(data.itemListElement, [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.northgroundbushcraft.com/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Field notes",
      item: "https://www.northgroundbushcraft.com/field-notes",
    },
  ]);
});

test("breadcrumb schema rejects a non-breadcrumb", () => {
  assert.throws(() => breadcrumbJsonLd([{ name: "Home", path: "/" }]));
});

test("species article says what the page says, about a taxon built only from verified names", async () => {
  const { speciesArticleJsonLd } = await import("./structured-data.ts");
  const resource = {
    title: "Ruffed grouse",
    locale: "en-CA",
    publishedAt: "2026-09-20T12:00:00Z",
    updatedAt: "2026-09-20T12:00:00Z",
    speciesProfile: {
      scientificName: "Bonasa umbellus",
      commonNames: [{ locale: "en-CA", value: "Ruffed grouse" }, { locale: "fr-CA", value: "Gélinotte huppée" }],
      aliases: [
        { value: "Partridge", type: "common_name", verificationStatus: "verified" },
        { value: "Rufed grouse", type: "misspelling", verificationStatus: "verified" },
        { value: "Birch partridge", type: "common_name", verificationStatus: "needs_review" },
      ],
      taxonomy: { genus: "Bonasa", species: "umbellus", family: "Phasianidae" },
    },
  } as unknown as Parameters<typeof speciesArticleJsonLd>[0];
  const url = "https://www.northgroundbushcraft.com/hunting/species/ruffed-grouse";
  const article = speciesArticleJsonLd(resource, url, { description: "Meta description.", imageUrl: "https://x/p" });
  const taxon = article.mainEntity as Record<string, unknown>;
  assert.equal(article.description, "Meta description.");
  assert.equal(article.image, "https://x/p");
  assert.deepEqual(article.about, { "@id": `${url}#taxon` });
  assert.deepEqual(taxon.alternateName, ["Gélinotte huppée", "Partridge"]);
  assert.equal((taxon.parentTaxon as Record<string, unknown>).name, "Bonasa");

  const withoutPhoto = speciesArticleJsonLd(resource, url, { description: "d", imageUrl: null });
  assert.equal("image" in withoutPhoto, false);
});

test("collection page lists its items in order with absolute URLs", async () => {
  const { collectionPageJsonLd } = await import("./structured-data.ts");
  const page = collectionPageJsonLd({
    path: "/hunting/species",
    name: "Library",
    description: "d",
    items: [{ name: "Moose", path: "/hunting/species/moose" }, { name: "Elk", path: "/hunting/species/elk" }],
  });
  const list = page.mainEntity as { numberOfItems: number; itemListElement: Array<Record<string, unknown>> };
  assert.equal(list.numberOfItems, 2);
  assert.equal(list.itemListElement[1].position, 2);
  assert.equal(list.itemListElement[1].url, "https://www.northgroundbushcraft.com/hunting/species/elk");
});
