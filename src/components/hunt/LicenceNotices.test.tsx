import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { evaluateHunt } from "../../lib/hunt/evaluate.ts";
import { attributionsForSourceIds } from "../../lib/hunt/source-attribution-lookup.ts";
import type { HuntInput, ZoneResolution } from "../../lib/hunt/types.ts";
import { huntBriefFixture } from "../../lib/hunt-share/test-fixture.ts";
import HuntBriefCard from "../hunt-share/HuntBriefCard.tsx";
import AnswerDetail from "./sheet/AnswerDetail.tsx";
import HuntAnswer from "./sheet/HuntAnswer.tsx";

/**
 * THE KING'S PRINTER STATEMENT, ON THE SURFACES A HUNTER READS.
 *
 * Rendered from British Columbia's committed bundle through the real engine:
 * the answer's Sources and a Hunt Brief each print the licence's statement,
 * and print it once — nine BC Laws schedules share one licence.
 */

const STATEMENT = JSON.parse(readFileSync("docs/research/bc-within-zone/ca-bc-closed-areas-enumeration.json", "utf8")).source.licence
  .mandatoryAttribution as string;
/* React escapes the apostrophe in "King's"; count a stretch without one. */
const MARK = "THESE MATERIALS ARE NOT AN OFFICIAL VERSION.";

function occurrences(html: string): number {
  return html.split(MARK).length - 1;
}

const bcZone: ZoneResolution = {
  status: "RESOLVED",
  zoneId: "management_zone:ca-bc-mu-3-17" as ZoneResolution["zoneId"],
  jurisdictionId: "jurisdiction:ca-bc",
  officialName: "Management Unit 3-17",
  boundaryDistanceMeters: 5_000,
  nearBoundary: false,
  sourceId: "source:ca-bc-mu-service",
  message: "The point intersects one verified management-zone feature.",
};

test("a BC answer shows the licence statement once, without opening its details", async () => {
  const result = await evaluateHunt(
    { latitude: 50.6745, longitude: -120.3273, date: "2026-10-30" as HuntInput["date"], speciesId: "species:ruffed-grouse" as HuntInput["speciesId"] },
    {
      resolveZone: async () => bcZone,
      weather: async (_latitude: number, _longitude: number, date: string) =>
        ({ status: "UNAVAILABLE" as const, summary: "No forecast", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const }),
      fetch: (async (input: string | URL) => { throw new Error(`unexpected request ${String(input)}`); }) as typeof fetch,
      now: () => new Date("2026-10-30T12:00:00Z"),
    },
  );
  assert.ok(result.sources.filter((source) => source.url.startsWith("https://www.bclaws.gov.bc.ca/")).length >= 2, "positive control: two BC Laws sources decided this answer");
  const jurisdiction = { id: "jurisdiction:ca-bc" as never, displayName: "British Columbia" };
  /* The answer as it first appears, with "Rules, sources and what you need"
     still closed: the statement is on screen, not behind it (owner, 2026-10-30). */
  const answer = renderToStaticMarkup(
    <HuntAnswer
      evaluation={{ kind: "ready", key: "k", result }} result={result} species={null} answered={[]}
      onAnswer={() => {}} onRetry={() => {}} placeLabel="Kamloops" jurisdiction={jurisdiction}
      detailed={false} onShowDetails={() => {}}
    />,
  );
  assert.equal(occurrences(answer), 1);
  /* And the long form does not print it a second time when opened. */
  const detail = renderToStaticMarkup(<AnswerDetail result={result} species={null} placeLabel="Kamloops" jurisdiction={jurisdiction} />);
  assert.equal(occurrences(detail), 0);
});

test("a Hunt Brief citing BC Laws prints the statement once, even one stored before it was recorded", () => {
  const brief = huntBriefFixture();
  const sources = [
    { id: "source:ca-bc-hunting-regulation" as never, authority: "Province of British Columbia", title: "Hunting Regulation", url: "https://www.bclaws.gov.bc.ca/x" },
    { id: "source:ca-bc-hunting-regulation-sch3" as never, authority: "Province of British Columbia", title: "Schedule 3", url: "https://www.bclaws.gov.bc.ca/y" },
  ];
  const notices = attributionsForSourceIds("jurisdiction:ca-bc", sources.map((source) => source.id));
  assert.deepEqual(notices.map((notice) => notice.text), [STATEMENT]);
  const html = renderToStaticMarkup(<HuntBriefCard brief={{ ...brief, officialSources: sources }} licenceNotices={notices} />);
  assert.equal(occurrences(html), 1);
});

test("a surface with no licensed source prints no notice", () => {
  const html = renderToStaticMarkup(<HuntBriefCard brief={huntBriefFixture()} />);
  assert.equal(occurrences(html), 0);
  assert.ok(!html.includes("data-licence-notices"));
});
