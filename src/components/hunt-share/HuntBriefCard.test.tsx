import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { buildHuntBriefMetadata } from "../../lib/hunt-share/metadata.ts";
import { huntBriefFixture } from "../../lib/hunt-share/test-fixture.ts";
import { huntBriefUrl } from "../../lib/hunt-share/urls.ts";
import HuntBriefCard from "./HuntBriefCard.tsx";
import { briefZoneLabels } from "../../lib/hunt-share/zone-label.ts";

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

test("a version 3 brief shows its Ready to Hunt checklist in words, not colour", () => {
  const html = renderToStaticMarkup(<HuntBriefCard brief={huntBriefFixture({
    readiness: {
      coverage: "VERIFIED",
      jurisdictionName: "Ontario",
      officialInfoUrl: "https://www.ontario.ca/document/ontario-hunting-regulations-summary/hunting-licence-information",
      authorizations: [
        { status: "REQUIRED", name: "Outdoors Card", authority: "Ontario Ministry of Natural Resources", fee: "2026 fee: $8.57 + 13% HST" },
        { status: "CONDITIONAL", name: "Firearms licence", authority: "Canadian Firearms Program (RCMP)", condition: "Required if you hunt with a gun." },
      ],
      orange: { status: "REQUIRED", summary: "An elk season is open in this unit." },
      legalMethods: ["Shotgun", "Bow"],
    },
  })} />);
  assert.match(html, /Ready to hunt/);
  assert.match(html, /Required[\s\S]*Outdoors Card/);
  assert.match(html, /Depends[\s\S]*Firearms licence/);
  assert.match(html, /Hunter orange/);
  assert.match(html, /2026 fee: \$8\.57/);
  assert.doesNotMatch(html, /vendor|issuer near/i);
});

test("7. a Hunt Brief keeps Québec's canonical zone and reads it as Zone 10 West", () => {
  const brief = huntBriefFixture({
    jurisdiction: { id: "jurisdiction:ca-qc", displayName: "Québec" },
    managementZone: { id: "management_zone:ca-qc-zone-10o", displayName: "Zone de chasse 10O" },
  } as never);
  // Stored identity is the canonical id and the ministry's own name, untouched.
  assert.deepEqual(brief.managementZone, { id: "management_zone:ca-qc-zone-10o", displayName: "Zone de chasse 10O" });
  const html = renderToStaticMarkup(<HuntBriefCard brief={brief} />);
  assert.match(html, /Zone 10 West \(Zone de chasse 10O\)/);
  assert.equal(String(buildHuntBriefMetadata(brief).title), "Ruffed grouse Hunt — Zone 10 West");
  // Locale changes words only.
  assert.equal(briefZoneLabels(brief.managementZone, "fr-CA")?.label, "Zone 10 Ouest");
  assert.equal(briefZoneLabels(brief.managementZone, "en-CA")?.officialName, "Zone de chasse 10O");
  // A stored name that disagrees with the id is not trusted to relabel it.
  assert.equal(briefZoneLabels({ id: "management_zone:ca-qc-zone-10o", displayName: "Zone de chasse 10E" })?.label, "Zone 10 West");
  // A zone with no presentation profile is shown exactly as stored.
  assert.equal(briefZoneLabels({ id: "management_zone:us-co-gmu-12", displayName: "GMU 12" })?.label, "GMU 12");
});

test("an Ontario brief reads WMU 57 and names no second label", () => {
  const html = renderToStaticMarkup(<HuntBriefCard brief={huntBriefFixture()} />);
  assert.match(html, /WMU 57 \(Wildlife Management Unit 57\)/);
});
