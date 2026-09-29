import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalId, IsoDate } from "../../content-contract/index.ts";
import { hasEnumerableConditions } from "./condition.ts";
import { REGULATORY_REGISTRY } from "./registry.ts";
import type { HuntInput, RegulatoryResult, ZoneResolution } from "../types.ts";

/**
 * Invariants every production answer must satisfy, across the served matrix.
 *
 * WHY THESE AND NOT A SNAPSHOT. A snapshot of an answer fails when anything
 * changes and says nothing about whether the change was wrong. These test the
 * properties that made the product wrong: a status naming conditions it cannot
 * show, a condition with no source, a jurisdiction that silently stopped
 * stating its legal hours.
 *
 * THE HOURS ROW IS THE POINT OF THE FILE. Four jurisdictions once lost their
 * legal hours IN PRODUCTION and the suite stayed green, because the code that
 * could have failed was deleted along with its tests. A green suite after a
 * deletion is a measurement guaranteed by its method. So the expectation here
 * is DECLARED per jurisdiction rather than derived from whatever the code
 * currently does: removing a jurisdiction's hours makes this file fail, and it
 * cannot be made to pass by deleting the thing that broke.
 */

/*
 * One representative hunt per served jurisdiction.
 *
 * Real units and real species, from each jurisdiction's own certified bundle.
 * The point matters — legal hours are a wall-clock time at a place — so each
 * carries a coordinate inside that jurisdiction.
 */
const MATRIX = [
  {
    jurisdiction: "jurisdiction:ca-qc",
    zoneId: "management_zone:ca-qc-zone-10o",
    zoneName: "Zone de chasse 10O",
    speciesId: "species:arctic-hare",
    point: { latitude: 46.3789, longitude: -75.9664 },
    date: "2026-09-29",
    /* West of the 63rd meridian, where the Legal Time Act answers completely. */
    hours: "RESOLVED",
  },
  {
    jurisdiction: "jurisdiction:ca-ab",
    zoneId: "management_zone:ca-ab-wmu-102",
    zoneName: "WMU 102",
    speciesId: "species:white-tailed-deer",
    point: { latitude: 49.5, longitude: -112.0 },
    date: "2026-11-05",
    hours: "RESOLVED",
  },
  {
    jurisdiction: "jurisdiction:ca-mb",
    zoneId: "management_zone:ca-mb-gha-26",
    zoneName: "GHA 26",
    speciesId: "species:ruffed-grouse",
    point: { latitude: 50.5, longitude: -99.5 },
    date: "2026-10-15",
    hours: "RESOLVED",
  },
  {
    jurisdiction: "jurisdiction:ca-on",
    zoneId: "management_zone:ca-on-wmu-57",
    zoneName: "WMU 57",
    speciesId: "species:ruffed-grouse",
    point: { latitude: 45.0, longitude: -79.0 },
    date: "2026-10-15",
    hours: "RESOLVED",
  },
  {
    jurisdiction: "jurisdiction:ca-bc",
    zoneId: "management_zone:ca-bc-mu-7-15",
    zoneName: "MU 7-15",
    speciesId: "species:ruffed-grouse",
    point: { latitude: 55.0, longitude: -122.0 },
    date: "2026-10-15",
    /*
     * DECLARED NOT_CERTIFIED, AND THAT IS A FINDING RATHER THAN A GAP TO CLOSE
     * QUIETLY. British Columbia's hours rule is read and encoded — B.C. Reg.
     * 190/84 s. 14 (1), ONE hour either side, not the half-hour three other
     * provinces use. What is missing is the clock: the province spans zones and
     * the Peace and Kootenay communities keep Mountain time, so a wall-clock
     * window cannot be stated. `legalTimeFor` refuses without a timezone, which
     * is the behaviour this row pins.
     */
    hours: "NOT_CERTIFIED",
  },
  {
    jurisdiction: "jurisdiction:us-id",
    zoneId: "management_zone:us-id-gmu-37",
    zoneName: "Unit 37",
    speciesId: "species:pronghorn",
    point: { latitude: 43.5, longitude: -114.0 },
    date: "2026-09-15",
    /*
     * DECLARED NOT_CERTIFIED. Idaho's time-zone boundary is federal (49 CFR
     * § 71.9) and runs along the main channel of the Salmon River, with a
     * further override making every municipality ON the line Mountain. North
     * Ground holds neither an authority-grade river centreline nor Idaho
     * municipality polygons, so a point cannot be placed on a side of it.
     */
    hours: "NOT_CERTIFIED",
  },
] as const;

function zoneFor(entry: (typeof MATRIX)[number]): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: entry.zoneId as CanonicalId<"management_zone">,
    jurisdictionId: entry.jurisdiction as CanonicalId<"jurisdiction">,
    officialName: entry.zoneName,
    boundaryDistanceMeters: 25_000,
    nearBoundary: false,
    message: "fixture",
  };
}

/** No network: a unit test must never depend on a live government service. */
const offline = (async () => new Response(JSON.stringify({ type: "FeatureCollection", features: [] }),
  { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

async function answer(entry: (typeof MATRIX)[number]): Promise<RegulatoryResult | null> {
  const registry = REGULATORY_REGISTRY.find((candidate) => candidate.jurisdictionId === entry.jurisdiction);
  assert.ok(registry, `No registry entry for ${entry.jurisdiction}`);
  const input: HuntInput = {
    ...entry.point,
    date: entry.date as IsoDate,
    speciesId: entry.speciesId as CanonicalId<"species">,
    answers: {},
  };
  const outcome = await registry.evaluate(input, zoneFor(entry), {
    verifiedAt: "2026-09-29", fetcher: offline, scope: "POINT",
  });
  /* NEEDS_INPUT is a legitimate outcome — the engine knows the law and wants a
     fact. It has no settled regulation to assert invariants against. */
  return outcome.completeness === "NEEDS_INPUT" ? null : outcome.regulation;
}

test("every served jurisdiction still states its legal hunting hours", async () => {
  /*
   * DECLARED, not derived. The expectation lives in MATRIX above, so a
   * jurisdiction that stops resolving fails here — and a NOT_CERTIFIED row that
   * starts resolving fails too, which is deliberate: unblocking a clock is a
   * regulatory claim and must be made on purpose, with its reasoning, not
   * arrive as a side effect.
   */
  for (const entry of MATRIX) {
    const regulation = await answer(entry);
    if (!regulation) continue;
    assert.equal(
      regulation.legalTime.status === "RESOLVED" ? "RESOLVED" : "NOT_CERTIFIED",
      entry.hours,
      `${entry.jurisdiction} legal hours`,
    );
  }
});

test("a refused window still names the authority whose rule it is", async () => {
  /* NOT_CERTIFIED is an answer, not an empty state: it must say whose rule it
     is so a hunter knows who to ask. */
  for (const entry of MATRIX) {
    const regulation = await answer(entry);
    if (!regulation || regulation.legalTime.status !== "NOT_CERTIFIED") continue;
    assert.ok(regulation.legalTime.reason.length > 20, `${entry.jurisdiction} gives a reason`);
    assert.ok(regulation.legalTime.authority.length > 0, `${entry.jurisdiction} names an authority`);
  }
});

test("a resolved window cites the provision it came from", async () => {
  for (const entry of MATRIX) {
    const regulation = await answer(entry);
    if (!regulation || regulation.legalTime.status !== "RESOLVED") continue;
    /* A refusal always carried its provision because the reason string did.
       A stated window did not, so certifying a jurisdiction once REMOVED its
       citation from the answer — provenance going backwards as coverage went
       forwards. */
    assert.ok(regulation.legalTime.section.length > 0, `${entry.jurisdiction} cites a section`);
    assert.ok(regulation.legalTime.sourceId, `${entry.jurisdiction} names a source`);
  }
});

test("a window is never claimed without a timezone to state it in", async () => {
  for (const entry of MATRIX) {
    const regulation = await answer(entry);
    if (!regulation || regulation.legalTime.status !== "RESOLVED") continue;
    /* British Columbia once rendered "09:35 to 22:20 (undefined)" — a
       thirteen-hour window computed against UTC, reading as an answer rather
       than as an error. */
    assert.match(regulation.legalTime.timezone, /^[A-Za-z]+([/+][A-Za-z0-9_+-]+)+$/,
      `${entry.jurisdiction} states a real timezone`);
  }
});

test("an answer that says 'with conditions' can name at least one", async () => {
  /*
   * THE INVARIANT THE OWNER ASKED FOR. The sheet's status word is derived from
   * `hasEnumerableConditions`, so this is the contract that keeps the two in
   * step: whenever the word is the conditional one, a condition exists to show.
   */
  for (const entry of MATRIX) {
    const regulation = await answer(entry);
    if (!regulation) continue;
    const saysConditions = regulation.status === "CONDITIONAL"
      && hasEnumerableConditions(regulation.conditions);
    if (!saysConditions) continue;
    assert.ok(regulation.conditions?.length, `${entry.jurisdiction} enumerates a condition`);
  }
});

test("every condition carries a source and a pinpoint", async () => {
  /*
   * §16: provenance stays in the model even where the visible UI groups it.
   * A condition without a source cannot be checked by a hunter and cannot be
   * corrected when the authority changes it.
   */
  for (const entry of MATRIX) {
    const regulation = await answer(entry);
    for (const condition of regulation?.conditions ?? []) {
      assert.ok(condition.id, `${entry.jurisdiction} condition has an id`);
      assert.ok(condition.text.trim().length > 0, `${entry.jurisdiction} condition has text`);
      assert.ok(condition.sourceId, `${entry.jurisdiction} condition "${condition.id}" has a source`);
      assert.ok(condition.sourceSection.trim().length > 0,
        `${entry.jurisdiction} condition "${condition.id}" has a pinpoint`);
      assert.ok(["NORTH_GROUND", "AUTHORITY"].includes(condition.owner),
        `${entry.jurisdiction} condition "${condition.id}" declares whose words it is`);
    }
  }
});

test("the flattened requirements stay in step with the structured conditions", async () => {
  /* `requirements` is derived, so a divergence means somebody authored one of
     them by hand again. */
  for (const entry of MATRIX) {
    const regulation = await answer(entry);
    if (!regulation) continue;
    assert.equal(regulation.requirements.length, regulation.conditions?.length ?? 0,
      `${entry.jurisdiction} requirements match conditions`);
  }
});

test("a season never closes before it opens", async () => {
  for (const entry of MATRIX) {
    const regulation = await answer(entry);
    if (!regulation?.season) continue;
    assert.ok(regulation.season.opens <= regulation.season.closes,
      `${entry.jurisdiction} season ${regulation.season.opens} → ${regulation.season.closes}`);
  }
});

test("a next opening is strictly in the future, and never a rolled-forward guess", async () => {
  for (const entry of MATRIX) {
    const regulation = await answer(entry);
    if (regulation?.next.kind !== "SEASON") continue;
    assert.ok(regulation.next.opens > entry.date,
      `${entry.jurisdiction} next opening ${regulation.next.opens} is after ${entry.date}`);
    assert.ok(regulation.next.opens <= regulation.next.closes, `${entry.jurisdiction} next window is ordered`);
  }
});

/**
 * The carve-out criterion.
 *
 * In every jurisdiction the solar window is NOT the whole rule, and each
 * carve-out sits in a structurally different place — inline in the prohibition,
 * in a second subsection, in an enumerated list. An extractor that found one
 * shape will miss the others, and the miss looks like a clean answer.
 *
 * TWO QUESTIONS, NOT ONE. Does the answer carry the carve-out; and does the
 * carve-out apply to the hunter being answered? A carve-out correctly found and
 * wrongly attributed is worse than one missed. Manitoba is the case that proves
 * the second half: ss. 12.1 and 12.2 permit night hunting, and both open with
 * "an aboriginal person may hunt at night". They are rights-based harvesting
 * provisions, which CLAUDE.md §41A keeps verbatim out of North Ground's answers
 * — so presenting them to a licensed hunter would be both a blueprint breach
 * and a statement that they may do something they may not.
 */
const CARVE_OUTS = [
  {
    jurisdiction: "jurisdiction:ca-qc",
    where: "Règlement sur la chasse, r. 12, s. 21 — an enumerated species-and-method list",
    inScope: true,
    /* Hare by SNARE. The means is half the permission; dropped, it is read by a
       hunter carrying a rifle. */
    expect: /snare/i,
  },
  {
    jurisdiction: "jurisdiction:ca-ab",
    where: "Wildlife Act s. 28 — inline in the prohibition",
    inScope: true,
    expect: /trapping/i,
  },
  {
    jurisdiction: "jurisdiction:ca-mb",
    where: "Wildlife Act ss. 12.1 and 12.2 — rights-based, and out of scope by blueprint",
    inScope: false,
    expect: /aboriginal|treaty/i,
  },
] as const;

test("each jurisdiction's carve-out is carried, and only where it applies to this hunter", async () => {
  for (const carveOut of CARVE_OUTS) {
    const entry = MATRIX.find((candidate) => candidate.jurisdiction === carveOut.jurisdiction);
    assert.ok(entry, `${carveOut.jurisdiction} is in the matrix`);
    const regulation = await answer(entry);
    if (!regulation) continue;

    const said = [
      regulation.legalTime.status === "RESOLVED" ? regulation.legalTime.statedAs : "",
      ...(regulation.legalTime.status === "RESOLVED"
        ? (regulation.legalTime.exceptions ?? []).map((exception) => exception.text)
        : []),
    ].join("\n");

    if (carveOut.inScope) {
      assert.match(said, carveOut.expect, `${carveOut.jurisdiction} carries its carve-out (${carveOut.where})`);
    } else {
      /* Absence is the assertion. A rights-based provision must NOT appear in a
         licensed hunter's answer. */
      assert.doesNotMatch(said, carveOut.expect,
        `${carveOut.jurisdiction} does not attribute a rights-based carve-out to a licensed hunter (${carveOut.where})`);
    }
  }
});
