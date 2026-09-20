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
  assert.equal(organization["@id"], "https://northgroundbushcraft.com/#organization");
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
      item: "https://northgroundbushcraft.com/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Field notes",
      item: "https://northgroundbushcraft.com/field-notes",
    },
  ]);
});

test("breadcrumb schema rejects a non-breadcrumb", () => {
  assert.throws(() => breadcrumbJsonLd([{ name: "Home", path: "/" }]));
});
