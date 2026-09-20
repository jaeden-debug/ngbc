import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { buildHuntBriefMetadata } from "../../lib/hunt-share/metadata.ts";
import { huntBriefFixture } from "../../lib/hunt-share/test-fixture.ts";
import { huntBriefUrl } from "../../lib/hunt-share/urls.ts";
import HuntBriefCard from "./HuntBriefCard.tsx";

test("shared brief renders status, snapshot labels, timestamps, sources and current-check action", () => {
  const html = renderToStaticMarkup(<HuntBriefCard brief={huntBriefFixture()} />);
  assert.match(html, /<h1[^>]*>Ruffed grouse<\/h1>/);
  assert.match(html, /Conditional/);
  assert.match(html, /Weather when brief was created/);
  assert.match(html, /Brief generated September 20, 2026/);
  assert.match(html, /Official sources/);
  assert.match(html, /Check current Hunt/);
  assert.doesNotMatch(html, /45\.057|-77\.857|private cabin/i);
});

test("UNKNOWN remains visible and an unavailable forecast is labeled as a snapshot", () => {
  const html = renderToStaticMarkup(<HuntBriefCard brief={huntBriefFixture({
    regulatory: {
      status: "UNKNOWN",
      summary: "No certified rule is loaded for this selection.",
    },
    weatherSnapshot: {
      status: "unavailable",
      reason: "A forecast was unavailable when this brief was created.",
    },
  })} />);
  assert.match(html, /Unknown/);
  assert.match(html, /Weather snapshot/);
  assert.match(html, /forecast was unavailable when this brief was created/i);
});

test("share metadata is noindex with canonical and dynamic OG URLs", () => {
  const brief = huntBriefFixture();
  const metadata = buildHuntBriefMetadata(brief);
  assert.deepEqual(metadata.robots, { index: false, follow: true, noarchive: true });
  assert.equal(metadata.alternates?.canonical, huntBriefUrl(brief.shareId));
  assert.equal(metadata.openGraph?.url, huntBriefUrl(brief.shareId));
  const images = metadata.openGraph?.images;
  assert.ok(Array.isArray(images));
  assert.equal((images[0] as { url: string }).url, `${huntBriefUrl(brief.shareId)}/opengraph-image`);
});
