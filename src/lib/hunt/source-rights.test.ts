import assert from "node:assert/strict";
import test from "node:test";
import {
  RETRIEVAL_FALLBACK_ORDER,
  readableTermsUnstated,
  sourceRightsViolations,
  type SourceRights,
} from "./source-rights.ts";

/** Massachusetts, the owner's named acceptance case for the amended §44. */
const MASSACHUSETTS = readableTermsUnstated({
  sourceId: "source:us-ma-hunting-regulations",
  sourceUrl: "https://www.mass.gov/hunting-regulations",
  lastVerified: "2026-09-30",
  whereTermsWereLooked: [
    "the zone dataset's service-level copyrightText (empty string)",
    "its layer-0 copyrightText (empty string)",
    "its ArcGIS portal item licenseInfo (null)",
    "its portal item accessInformation (null)",
  ],
});

const rules = (source: SourceRights) => sourceRightsViolations(source).map((violation) => violation.rule);

test("terms unstated does not mean the source is unusable", () => {
  /* THE FIRST INVARIANT THE OWNER ASKED FOR, and the one the old single flag got
     wrong for eight states. A publicly readable primary government regulation
     whose page carries no licence notice still establishes its facts. §44's
     closing line: "Missing copyright labels never erase independently established
     regulatory facts."

     Recorded as a positive assertion, not merely as the absence of a violation:
     the record that SHOULD be possible has to actually be possible. */
  assert.deepEqual(sourceRightsViolations(MASSACHUSETTS), [], "the case §44 was written for must be representable");
  assert.equal(MASSACHUSETTS.derivedFactsState, "USABLE");
  assert.equal(MASSACHUSETTS.reuseState, "UNSTATED");
  assert.equal(MASSACHUSETTS.accessState, "PUBLIC_READABLE");

  /* And the inverse is a violation by name, so a future edit back to the old
     model fails rather than quietly re-blocking a state. */
  assert.ok(
    rules({ ...MASSACHUSETTS, derivedFactsState: "BLOCKED" }).includes("UNSTATED_TERMS_DO_NOT_BLOCK_DERIVED_FACTS"),
    "blocking derived facts on unstated terms must fail",
  );
});

test("terms unstated does not mean permission to archive", () => {
  /* THE SECOND, AND IT POINTS THE OPPOSITE WAY. This is the direction the ruling
     is most likely to be over-applied in, because the tempting next step once a
     state stops being blocked is to store its material. §44: "Never store a full
     local copy merely because the page can be read." */
  assert.equal(MASSACHUSETTS.archiveState, "UNCONFIRMED", "silence leaves archiving unconfirmed, not permitted");
  assert.ok(
    rules({ ...MASSACHUSETTS, archiveState: "PERMITTED" }).includes("UNSTATED_TERMS_ARE_NOT_PERMISSION_TO_ARCHIVE"),
    "archiving on unstated terms must fail",
  );

  /* A hash is a claim that a copy was taken, so it cannot travel with an
     unconfirmed archive state — otherwise the stored copy arrives without the
     permission that would have allowed it. */
  assert.ok(
    rules({ ...MASSACHUSETTS, contentHash: "sha256:abc" }).includes("A_SNAPSHOT_HASH_IMPLIES_A_PERMITTED_SNAPSHOT"),
  );
});

test("the two invariants are independent, so satisfying one cannot satisfy the other", () => {
  /* The failure mode the owner warned about: "both directions, or the model
     drifts back to one flag under the next deadline." A single flag can satisfy
     either rule alone. Only two independent fields can satisfy both, so this
     asserts that one record violates exactly one of them at a time. */
  const blocked = rules({ ...MASSACHUSETTS, derivedFactsState: "BLOCKED" });
  const archived = rules({ ...MASSACHUSETTS, archiveState: "PERMITTED" });
  assert.deepEqual(blocked, ["UNSTATED_TERMS_DO_NOT_BLOCK_DERIVED_FACTS"]);
  assert.deepEqual(archived, ["UNSTATED_TERMS_ARE_NOT_PERMISSION_TO_ARCHIVE"]);
  /* And a record can be wrong in both directions at once, which one flag could
     not even express. */
  assert.equal(rules({ ...MASSACHUSETTS, derivedFactsState: "BLOCKED", archiveState: "PERMITTED" }).length, 2);
});

test("geometry is not a derived fact, so the ruling does not unblock it", () => {
  /* §44 is explicit: "A polygon dataset cannot be reduced to a derived fact —
     storing it IS archival." Mississippi's Deer Management Units are readable and
     its terms are unstated, and that still does not make its geometry usable. The
     standing decision that United States hunting geography is live-service only is
     unchanged, and Kentucky's and Kansas's findings are untouched. */
  const geometry: SourceRights = {
    ...MASSACHUSETTS,
    sourceId: "source:us-ms-dmu-service",
    sourceUrl: "https://arcgis.mdwfp.com/arcgis/rest/services/Public/Public_WMA_Data/MapServer/7",
    authorityLevel: "GOVERNMENT_GIS",
  };
  assert.ok(rules(geometry).includes("GEOMETRY_IS_NOT_A_DERIVED_FACT"),
    "a spatial source must not inherit the eight states' relief");
  /* The same spatial source is fine once its facts are not claimed as usable —
     the geography is read live rather than derived and stored. */
  assert.deepEqual(rules({ ...geometry, derivedFactsState: "UNCONFIRMED" }), []);
});

test("a refused reader is a technical problem, never the authority's refusal", () => {
  /* Four authorities refuse our client while serving a browser. None of them has
     said anything about reuse, and writing REFUSED there would convert our
     transport failure into their prohibition. */
  const refused: SourceRights = {
    ...MASSACHUSETTS,
    accessState: "READER_REFUSED",
    technicalLimitation:
      "mass.gov returns HTTP 403 to WebFetch and to curl with a desktop Chrome User-Agent on three separate URLs, " +
      "with a 14,061-byte block page; the same URLs return HTTP 200 in a real browser engine.",
    derivedFactsState: "UNCONFIRMED",
  };
  assert.deepEqual(rules(refused), [], "a refused reader is recordable without asserting anything about reuse");
  assert.ok(
    rules({ ...refused, reuseState: "REFUSED" }).includes("A_BLOCKED_READER_IS_NOT_A_REFUSAL"),
    "a 403 must not be recorded as the publisher refusing reuse",
  );
  /* And a failed route must name its limitation rather than implying the
     regulations do not exist. */
  const { technicalLimitation: _dropped, ...withoutLimitation } = refused;
  assert.ok(rules(withoutLimitation).includes("A_FAILED_ROUTE_NAMES_ITS_LIMITATION"));
});

test("the retrieval vocabulary cannot express bypassing a restriction", () => {
  /* §44 forbids bypassing authentication, CAPTCHAs, access controls and robots
     restrictions. The strongest form of that is a vocabulary with no word for it:
     a record claiming it would not compile.

     Pinned as an explicit enumeration so that adding such a member is a visible
     change to this test rather than a quiet one to the type. */
  assert.deepEqual([...RETRIEVAL_FALLBACK_ORDER], [
    "OFFICIAL_HTML",
    "OFFICIAL_PDF",
    "OFFICIAL_CODE_ENDPOINT",
    "OFFICIAL_ALTERNATE_DOMAIN",
    "OFFICIAL_API",
    "BROWSER_RENDERED",
    "REVIEWED_SNAPSHOT",
  ]);
  for (const method of RETRIEVAL_FALLBACK_ORDER) {
    assert.doesNotMatch(method, /BYPASS|CAPTCHA|SCRAPE_AROUND|CIRCUMVENT|UNOFFICIAL/,
      "no retrieval method may name defeating a restriction");
  }
  // @ts-expect-error — a bypass is not in the vocabulary, and this line is the test.
  const _refused: SourceRights["retrievalMethod"] = "BYPASS_CAPTCHA";
});

test("a fallback names what it fell back from", () => {
  /* §44 states an ORDER, so reaching past the first method is a claim about what
     failed. A snapshot is the last resort and the most consequential, because it
     is the only route that stores anything. */
  const snapshot: SourceRights = {
    ...MASSACHUSETTS,
    retrievalMethod: "REVIEWED_SNAPSHOT",
    fallbacksAttempted: ["OFFICIAL_HTML", "OFFICIAL_PDF"],
  };
  assert.ok(rules(snapshot).includes("A_FALLBACK_MUST_NAME_WHAT_IT_FELL_BACK_FROM"),
    "a last-resort snapshot must record the five earlier routes, not two");
  assert.deepEqual(rules({ ...snapshot, fallbacksAttempted: RETRIEVAL_FALLBACK_ORDER.slice(0, 6) }), []);
  /* The first method needs no account of itself. */
  assert.deepEqual(rules({ ...MASSACHUSETTS, retrievalMethod: "OFFICIAL_HTML" }), []);
});

test("an absence still needs its search, and read terms still need their instrument", () => {
  /* Carried over from the licence findings, because the new model must not lose
     what the old one had: NONE_LOCATED with no account of the search is a shrug
     that reads like a finding, and a licence claim whose instrument is not cited
     cannot be re-checked. */
  assert.ok(rules({ ...MASSACHUSETTS, whereTermsWereLooked: ["one place"] }).includes("AN_ABSENCE_NEEDS_ITS_SEARCH"));
  assert.ok(
    rules({ ...MASSACHUSETTS, reuseState: "GRANTED", termsStatus: "READ", archiveState: "PERMITTED" })
      .includes("READ_TERMS_NEED_THEIR_URL"),
  );
  /* A granted licence with its instrument cited is clean, including its archive
     permission — which is what distinguishes it from silence. */
  assert.deepEqual(
    rules({
      ...MASSACHUSETTS,
      reuseState: "GRANTED",
      termsStatus: "READ",
      termsUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      archiveState: "PERMITTED",
      contentHash: "sha256:0000",
    }),
    [],
  );
});

test("a third party is never regulatory truth, including when the official reader was refused", () => {
  /* The tempting move when an authority's host 403s, and §44 forbids it by name.
     Four authorities refuse us right now, so this is live rather than theoretical. */
  assert.ok(
    rules({ ...MASSACHUSETTS, authorityLevel: "THIRD_PARTY" }).includes("A_THIRD_PARTY_IS_NEVER_REGULATORY_TRUTH"),
  );
});

test("every recorded source satisfies the contract, and Massachusetts is the acceptance case", async () => {
  /* The link that makes the registry real rather than decorative: the records are
     held to the same invariants as a hand-built one, so a source cannot be written
     into the registry in a combination §44 forbids. */
  /* Cast through `unknown`: TypeScript infers the JSON's literals as `string`,
     which is wider than the unions, and the point of this test is to hold the
     data to the unions at RUNTIME rather than to have the compiler assume it. */
  const registry = (await import("../../../content/registry/us-source-rights.json", { with: { type: "json" } }))
    .default as unknown as { sources: Record<string, SourceRights & Record<string, unknown>> };
  const entries = Object.entries(registry.sources);
  assert.ok(entries.length > 0, "the registry is empty");
  for (const [id, source] of entries) {
    assert.deepEqual(sourceRightsViolations(source), [], `${id} violates §44`);
    assert.equal(source.sourceId, id, `${id}'s key and sourceId must agree`);
  }

  /* MASSACHUSETTS, the owner's named acceptance case. Its four properties are
     asserted individually, because the case is the combination and not any one
     of them: public authority, no assumed open-data licence, structured fact
     extraction, no unnecessary republication. */
  const ma = registry.sources["source:us-ma-hunting-season-summary"];
  assert.ok(ma, "Massachusetts is the acceptance case and must be recorded");
  assert.equal(ma.accessState, "PUBLIC_READABLE");
  assert.equal(ma.reuseState, "UNSTATED", "no open-data licence is assumed");
  assert.equal(ma.derivedFactsState, "USABLE", "the facts are usable with attribution");
  assert.equal(ma.archiveState, "UNCONFIRMED", "and nothing is republished or stored");
  assert.equal(ma.contentHash, undefined, "no snapshot was taken");

  /* IT WAS REACHED BY §44's ORDER, and the record proves it rather than asserting
     it: browser-rendered is position six, so five earlier routes must be named. */
  assert.equal(ma.retrievalMethod, "BROWSER_RENDERED");
  assert.equal(ma.fallbacksAttempted?.length, 5, "five earlier routes were tried first");
  assert.deepEqual([...(ma.fallbacksAttempted ?? [])],
    ["OFFICIAL_HTML", "OFFICIAL_PDF", "OFFICIAL_CODE_ENDPOINT", "OFFICIAL_ALTERNATE_DOMAIN", "OFFICIAL_API"]);

  /* And the honest limit on it: this is a SUMMARY, not the codified instrument.
     321 CMR 3.00 was not read, because the routes to Massachusetts's code are the
     ones that failed — so the facts sit at GOVERNMENT_SUMMARY authority and a
     season turning on the codified wording is not settled by them. */
  assert.equal(ma.authorityLevel, "GOVERNMENT_SUMMARY", "the summary is not the code");
  assert.match(String(ma.whatIsNOTClaimed), /321 CMR 3\.00/);
});

test("the Massachusetts facts record what a date-range resolver would get wrong", async () => {
  const REGISTRY = (await import("../../../content/registry/us-source-rights.json", { with: { type: "json" } }))
    .default as unknown as { derivedFacts: Record<string, { seasons: Array<Record<string, unknown>>; fiveThingsInTHISSOURCEThatAResolverWouldGetWRONG: string[] }> };
  /* The facts are only worth deriving if their limits travel with them. Four of
     the five traps below are properties of the SOURCE rather than of our reading,
     and each one breaks a naive model in a different way. */
  const facts = REGISTRY.derivedFacts["us-ma-2026-seasons"];
  assert.ok(facts.seasons.length >= 14);
  assert.equal(facts.fiveThingsInTHISSOURCEThatAResolverWouldGetWRONG.length, 5);

  /* ZONE SCOPE IS NOT UNIFORM: bobcat is zones 1–8 while most species are 1–14,
     so a statewide model authorises bobcat in six closed zones. */
  const bobcat = facts.seasons.find((s) => s.species === "bobcat")!;
  assert.match(String(bobcat.zones), /1–8 ONLY/);

  /* A CROSS-SPECIES CONDITION: eleven species close during shotgun deer season,
     so a date inside a listed range is not thereby open. */
  assert.ok(facts.seasons.filter((s) => s.closedDuringShotgunDeer).length >= 5);

  /* A DAY-OF-WEEK RESTRICTION on crow, which a date-range model answers wrongly
     on a Wednesday. */
  const crow = facts.seasons.find((s) => s.species === "American crow")!;
  assert.match(String(crow.dayOfWeekRestriction), /Monday, Friday and Saturday only/);

  /* AND ONE ROW OMITS ITS YEAR. 2026 is the obvious reading, and it is flagged
     rather than silently completed, because completing a truncated source is how
     an inference becomes a fact. */
  const primitive = facts.seasons.find((s) => s.season === "Primitive Firearms")!;
  assert.equal(primitive.yearIsNotStatedInTheSource, true);
});
