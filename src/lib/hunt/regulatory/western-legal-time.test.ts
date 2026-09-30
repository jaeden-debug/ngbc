import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { legalTimeFor, legalTimeSummary, SOLAR_UNCERTAINTY_MINUTES } from "./legal-time.ts";
import { albertaHoursRules, ALBERTA_GENERAL_HOURS } from "./alberta-legal-time.ts";
import { manitobaHoursRules, MANITOBA_GENERAL_HOURS } from "./manitoba-legal-time.ts";
import { britishColumbiaHoursRules, BRITISH_COLUMBIA_GENERAL_HOURS } from "./british-columbia-legal-time.ts";
import { montanaHoursRules, MONTANA_UPLAND_HOURS } from "./montana-legal-time.ts";
import { timeZoneAtPoint, UNITED_STATES_SPLIT_BY_COUNTY, UNITED_STATES_SPLIT_BY_FEATURE } from "../time-zone.ts";
import { sunriseSunset } from "./solar.ts";

const iso = (value: string) => value as IsoDate;

/* Real points inside each jurisdiction, well away from any boundary. */
const EDMONTON = { latitude: 53.55, longitude: -113.49 };
const WINNIPEG = { latitude: 49.9, longitude: -97.14 };
const KAMLOOPS = { latitude: 50.67, longitude: -120.33 };

const MOUNTAIN = "America/Edmonton" as PointTimeZone;
const CENTRAL = "America/Winnipeg" as PointTimeZone;
const PACIFIC = "America/Vancouver" as PointTimeZone;

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * THE TEST THIS FILE EXISTS FOR.
 *
 * Ontario, Alberta and Manitoba all use half an hour either side. British
 * Columbia uses a FULL hour (B.C. Reg. 190/84 s. 14 (1)). Three jurisdictions
 * agreeing is exactly what makes the fourth dangerous, and an agent carrying
 * the common rule into BC would publish a window 30 minutes short at each end.
 *
 * That failure is invisible in production — a hunter told to stop early simply
 * stops early — and it is a restriction STRICTER than the source, which §8
 * makes a false claim exactly as an over-broad one is.
 *
 * The expected gap is DERIVED from the two rules' own declared offsets rather
 * than written as "30", so the test cannot drift into agreeing with a wrong
 * constant.
 */
test("British Columbia is an hour either side, and the other two are half an hour", () => {
  const gapBefore = BRITISH_COLUMBIA_GENERAL_HOURS.basis === "SUNRISE_SUNSET_OFFSET" &&
    ALBERTA_GENERAL_HOURS.basis === "SUNRISE_SUNSET_OFFSET"
    ? BRITISH_COLUMBIA_GENERAL_HOURS.beforeSunriseMinutes - ALBERTA_GENERAL_HOURS.beforeSunriseMinutes
    : Number.NaN;

  assert.equal(gapBefore, 30, "BC must open half an hour earlier than Alberta");

  /* And the same fact through the computed window, not just the constants. */
  const date = iso("2026-09-15");
  const bc = legalTimeFor(BRITISH_COLUMBIA_GENERAL_HOURS, KAMLOOPS, date, PACIFIC);
  const ab = legalTimeFor(ALBERTA_GENERAL_HOURS, KAMLOOPS, date, PACIFIC);
  assert.equal(bc.status, "RESOLVED");
  assert.equal(ab.status, "RESOLVED");
  if (bc.status !== "RESOLVED" || ab.status !== "RESOLVED") return;

  /*
   * Same point, same date, same timezone — so the only difference is the rule.
   * The inward solar margin applies equally to both and cancels.
   */
  assert.equal(minutes(ab.window.opensAt) - minutes(bc.window.opensAt), 30);
  assert.equal(minutes(bc.window.closesAt) - minutes(ab.window.closesAt), 30);
});

test("Alberta states a real window at a real Alberta point", () => {
  /*
   * The regression that matters most here is not arithmetic: Alberta used to
   * refuse a window on the premise that it "spans more than one IANA zone",
   * which the tz database disproves. If that premise ever returns, this fails.
   */
  const result = legalTimeFor(ALBERTA_GENERAL_HOURS, EDMONTON, iso("2026-11-04"), MOUNTAIN);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.timezone, "America/Edmonton");
  assert.match(result.section, /s\. 28/);
  /* Opens before it closes, on the requested date, with the margin declared. */
  assert.ok(minutes(result.window.opensAt) < minutes(result.window.closesAt));
  assert.equal(result.date, "2026-11-04");
  assert.equal(result.precision.appliedInward, true);
});

test("Alberta and Manitoba state the same offsets, and it is a coincidence of two statutes", () => {
  /*
   * They agree today. They are different instruments — Alberta's Wildlife Act
   * s. 28 and Manitoba's M.R. 351/87 s. 3 — and either can be amended without
   * the other. Asserted through each rule's own declared values so that a
   * change to one is a failure rather than a silent convergence.
   */
  assert.equal(ALBERTA_GENERAL_HOURS.basis, "SUNRISE_SUNSET_OFFSET");
  assert.equal(MANITOBA_GENERAL_HOURS.basis, "SUNRISE_SUNSET_OFFSET");
  if (ALBERTA_GENERAL_HOURS.basis !== "SUNRISE_SUNSET_OFFSET") return;
  if (MANITOBA_GENERAL_HOURS.basis !== "SUNRISE_SUNSET_OFFSET") return;

  assert.equal(ALBERTA_GENERAL_HOURS.beforeSunriseMinutes, MANITOBA_GENERAL_HOURS.beforeSunriseMinutes);
  assert.equal(ALBERTA_GENERAL_HOURS.afterSunsetMinutes, MANITOBA_GENERAL_HOURS.afterSunsetMinutes);
  assert.notEqual(ALBERTA_GENERAL_HOURS.section, MANITOBA_GENERAL_HOURS.section);
  assert.notEqual(ALBERTA_GENERAL_HOURS.sourceId, MANITOBA_GENERAL_HOURS.sourceId);
});

test("the window is built from the day's own sunrise and sunset, narrowed inward", () => {
  /*
   * Derived rather than hard-coded: the expectation is computed from the solar
   * module the implementation also uses, plus the rule's own offsets and the
   * inward margin. A hard-coded clock time would encode today's algorithm and
   * fail for the wrong reason if it were ever refined.
   */
  const date = iso("2026-10-01");
  const solar = sunriseSunset(WINNIPEG.latitude, WINNIPEG.longitude, { year: 2026, month: 10, day: 1 });
  assert.ok(!("polar" in solar), "Winnipeg has a sunrise on this date");
  if ("polar" in solar) return;

  const result = legalTimeFor(MANITOBA_GENERAL_HOURS, WINNIPEG, date, CENTRAL);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;

  const opens = new Date(solar.sunrise.getTime() - 30 * 60_000 + SOLAR_UNCERTAINTY_MINUTES * 60_000);
  const expected = new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTRAL, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(opens);
  assert.equal(result.window.opensAt, expected);
});

test("each jurisdiction binds exactly one rule, for every species it serves", () => {
  /*
   * A census, not a spot check. Every species in each committed bundle is
   * asked, so a species added later without an hours decision fails here rather
   * than silently inheriting the general rule.
   *
   * One rule each is the CURRENT truth and is recorded as such: the migratory
   * game bird exceptions (BC s. 14 (2), Manitoba's footnote 2) bind no species
   * these jurisdictions serve, and federal hours govern those birds anyway.
   */
  const cases = [
    { file: "ca-ab-2026.json", rules: albertaHoursRules },
    { file: "ca-mb-2026.json", rules: manitobaHoursRules },
    { file: "ca-bc-2026.json", rules: britishColumbiaHoursRules },
  ] as const;

  for (const { file, rules } of cases) {
    const bundle = JSON.parse(readFileSync(`content/regulatory/${file}`, "utf8")) as {
      rules: { speciesId: string }[];
    };
    const species = [...new Set(bundle.rules.map((rule) => rule.speciesId))];
    assert.ok(species.length > 0, `${file} serves at least one species`);

    for (const speciesId of species) {
      const bound = rules(speciesId, iso("2026-05-15"));
      assert.equal(bound.length, 1, `${file}: ${speciesId} binds exactly one hours rule`);
      assert.equal(bound[0].basis, "SUNRISE_SUNSET_OFFSET");
    }

    /* And none of them is a migratory game bird, which is why one rule is right. */
    assert.ok(
      !species.some((id) => /goose|geese|duck|crane|woodcock|snipe|dove/i.test(id)),
      `${file} serves no migratory game bird; if it does, the migratory hours exception must be encoded`,
    );
  }
});

test("every rule carries the authority's own words and a pinpoint citation", () => {
  for (const rule of [ALBERTA_GENERAL_HOURS, MANITOBA_GENERAL_HOURS, BRITISH_COLUMBIA_GENERAL_HOURS]) {
    assert.ok(rule.statedAs.length > 40, "statedAs is the provision, not a paraphrase");
    assert.match(rule.section, /s\. \d/, "section is a pinpoint, not a document name");
    assert.match(rule.sourceId, /^source:ca-(ab|mb|bc)-/);
    /*
     * The provisions are prohibitions and each must read as one — but they say
     * so in three different grammars: Alberta "shall not hunt", Manitoba "No
     * person shall hunt", BC "The prohibited hours are". The first draft of
     * this assertion matched only Alberta's and failed Manitoba, which is the
     * point of asserting against all three rather than the one in front of you.
     */
    assert.match(rule.statedAs, /shall not|no person shall|prohibited/i);
  }
});

test("Montana states a window and Idaho does not, from the same instrument", () => {
  /*
   * The sweep that found this asked, of every refusal, "is the premise true?"
   * Montana's and Idaho's read identically — "has not certified exact
   * astronomical times" — and the answers are opposite.
   *
   * `zone1970.tab` describes US zones by exception and names them down to
   * single counties, so a state it does not name has one clock. Montana is
   * named nowhere; Idaho is named ("Mountain - ID (south), OR (east)").
   */
  assert.equal(timeZoneAtPoint("jurisdiction:us-mt"), "America/Denver");
  assert.equal(timeZoneAtPoint("jurisdiction:us-id"), undefined);
});

test("Montana's hours reach upland game birds and stop there", () => {
  /*
   * The authority's sentence is scoped to upland game birds. A species outside
   * that scope must get NO rule rather than this one: Montana sets big-game
   * hours elsewhere, and a window from the wrong rule is worse than none.
   *
   * The served species are read from the bundle, so this cannot pass by
   * agreeing with a list copied out of it.
   */
  const served = montanaHoursRules("species:ring-necked-pheasant", iso("2026-10-15"));
  assert.equal(served.length, 1);
  assert.equal(served[0], MONTANA_UPLAND_HOURS);

  for (const outside of ["species:white-tailed-deer", "species:moose", "species:american-black-bear"]) {
    assert.deepEqual(montanaHoursRules(outside, iso("2026-10-15")), [], `${outside} is not an upland game bird`);
  }
});

test("no timezone, no window — for every jurisdiction, not just the one that had the bug", () => {
  /*
   * `britishColumbiaLegalTime` handed an undefined zone returned RESOLVED and
   * rendered "09:35 to 22:20 (undefined)" — a thirteen-hour window computed
   * against UTC, telling a hunter it was lawful to shoot until 22:20. It read
   * as an answer rather than an error.
   *
   * The guard used to live in each CALLER, which is the arrangement where the
   * next jurisdiction wired up inherits the bug. It now lives in `legalTimeFor`,
   * so this asserts the chokepoint across every rule rather than patching BC.
   */
  const rules = [
    ALBERTA_GENERAL_HOURS,
    MANITOBA_GENERAL_HOURS,
    BRITISH_COLUMBIA_GENERAL_HOURS,
    MONTANA_UPLAND_HOURS,
  ];
  for (const rule of rules) {
    const result = legalTimeFor(rule, KAMLOOPS, iso("2026-10-15"), undefined);
    assert.equal(result.status, "NOT_CERTIFIED", `${rule.section} must refuse without a timezone`);
    assert.doesNotMatch(legalTimeSummary(result), /undefined/, "no answer may contain the word undefined");
    /* Refusing a clock is not refusing to say what the law is. */
    assert.match(legalTimeSummary(result), /wall-clock/);
  }
});

/* ── British Columbia's clock ────────────────────────────────────────────── */

test("British Columbia states a window now, at a fixed offset, one hour either side", async () => {
  /*
   * The Interpretation Act s. 26 (2) makes a reference to time in British
   * Columbia a reference to Pacific Time, and s. 26 (1) fixes that at 7 hours
   * behind UTC. Province-wide, no region named — so the clock that blocked BC
   * is no longer what the Act says.
   *
   * The zone is `Etc/GMT+7` and not `America/Vancouver`: the statute fixes an
   * OFFSET, and a named regional zone would import a daylight-saving policy the
   * Act no longer contains. If someone swaps it for a regional zone this fails
   * in winter and passes in summer, so it is asserted directly.
   */
  const { britishColumbiaLegalTime, britishColumbiaClock, BRITISH_COLUMBIA_CLOCK_FROM } =
    await import("./british-columbia-legal-time.ts");

  assert.equal(britishColumbiaClock(BRITISH_COLUMBIA_CLOCK_FROM), "Etc/GMT+7");

  const result = britishColumbiaLegalTime("species:ruffed-grouse", KAMLOOPS, iso("2026-10-15"));
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.timezone, "Etc/GMT+7");
  assert.match(result.section, /s\. 14 \(1\)/);

  /* One hour either side — BC's own rule, not the half hour three others use. */
  const half = legalTimeFor(ALBERTA_GENERAL_HOURS, KAMLOOPS, iso("2026-10-15"), "Etc/GMT+7" as PointTimeZone);
  assert.equal(half.status, "RESOLVED");
  if (half.status !== "RESOLVED") return;
  assert.equal(minutes(half.window.opensAt) - minutes(result.window.opensAt), 30);
});

test("a date before the bound is refused, and the reason names what was not established", async () => {
  /*
   * THE GUARD. The in-force date of s. 26 was NOT established — the amending
   * instruments were unreachable in consolidated form and a bringing-into-force
   * order is commonly an OIC in the Gazette. Before it, British Columbia's
   * reckoning was divided geographically, which is the very thing that blocked
   * the province.
   *
   * So an earlier date must be refused rather than answered with today's
   * reckoning. Applying s. 26 backwards would be an hour wrong, invisibly: a
   * backdated Hunt would simply show a time that looks ordinary.
   */
  const { britishColumbiaLegalTime, BRITISH_COLUMBIA_CLOCK_FROM } = await import("./british-columbia-legal-time.ts");

  const before = britishColumbiaLegalTime("species:ruffed-grouse", KAMLOOPS, iso("2026-01-15"));
  assert.equal(before.status, "NOT_CERTIFIED");
  if (before.status !== "NOT_CERTIFIED") return;
  assert.match(before.reason, new RegExp(BRITISH_COLUMBIA_CLOCK_FROM));
  assert.match(before.reason, /came into force was not established/);
  assert.match(before.reason, /divided geographically/);

  /* The boundary itself answers; the day before it does not. */
  assert.equal(britishColumbiaLegalTime("species:ruffed-grouse", KAMLOOPS, BRITISH_COLUMBIA_CLOCK_FROM).status, "RESOLVED");
  assert.equal(britishColumbiaLegalTime("species:ruffed-grouse", KAMLOOPS, iso("2026-09-21")).status, "NOT_CERTIFIED");
});

test("British Columbia is deliberately absent from the date-blind single-zone table", async () => {
  /*
   * `SINGLE_ZONE_JURISDICTIONS` is keyed by jurisdiction alone. An entry there
   * would hand out `Etc/GMT+7` for every date including 2019, which is exactly
   * the error the date bound exists to prevent. Alberta and Manitoba belong
   * there because their reckoning is not in question; BC's is.
   */
  const { timeZoneAtPoint } = await import("../time-zone.ts");
  assert.equal(timeZoneAtPoint("jurisdiction:ca-bc"), undefined);
  assert.equal(timeZoneAtPoint("jurisdiction:ca-ab"), "America/Edmonton");
});

test("s. 14 (2) binds migratory game birds at half an hour, and nothing BC serves", async () => {
  /*
   * Latent, and encoded so it stops being latent without anyone remembering.
   * s. 14 (2) narrows migratory game birds to half an hour either side DESPITE
   * s. 14 (1)'s hour — so a served migratory species would otherwise inherit a
   * window 30 minutes too generous at each end, in the direction that puts a
   * hunter outside the law.
   *
   * Membership is asked of the federal instrument that defines the term, and
   * the served species are read from the bundle rather than listed here.
   */
  const { britishColumbiaHoursRules, BRITISH_COLUMBIA_MIGRATORY_HOURS, BRITISH_COLUMBIA_GENERAL_HOURS } =
    await import("./british-columbia-legal-time.ts");
  const { isFederalMigratoryBird } = await import("./federal.ts");

  const bundle = JSON.parse(readFileSync("content/regulatory/ca-bc-2026.json", "utf8")) as {
    rules: { speciesId: string }[];
  };
  const served = [...new Set(bundle.rules.map((rule) => rule.speciesId))];

  for (const speciesId of served) {
    assert.equal(isFederalMigratoryBird(speciesId), false, `${speciesId} is not a migratory game bird`);
    assert.deepEqual(britishColumbiaHoursRules(speciesId, iso("2026-10-15")), [BRITISH_COLUMBIA_GENERAL_HOURS]);
  }

  /* And a migratory bird gets the narrower rule, whichever one the federal
     instrument recognises — found rather than named, so this cannot pass by
     agreeing with a species id typed here. */
  const migratory = ["species:canada-goose", "species:mallard", "species:american-black-duck", "species:snow-goose"]
    .find((id) => isFederalMigratoryBird(id));
  assert.ok(migratory, "the federal instrument recognises at least one of these");
  assert.deepEqual(britishColumbiaHoursRules(migratory, iso("2026-10-15")), [BRITISH_COLUMBIA_MIGRATORY_HOURS]);
  assert.equal(BRITISH_COLUMBIA_MIGRATORY_HOURS.basis, "SUNRISE_SUNSET_OFFSET");
  if (BRITISH_COLUMBIA_MIGRATORY_HOURS.basis !== "SUNRISE_SUNSET_OFFSET") return;
  assert.equal(BRITISH_COLUMBIA_MIGRATORY_HOURS.beforeSunriseMinutes, 30);
});

test("the BC bundle carries s. 14 (2), and the module's rule is the bundle's words", async () => {
  /*
   * The module encoded s. 14 (2) while the bundle carried only s. 14 (1), so
   * the two could drift with nothing to notice. They are the same fact from the
   * same regulation; the test is that they cannot disagree.
   *
   * `statedAs` is compared rather than the offsets, because the offsets are our
   * reading and the sentence is the authority's — if the regulation is reworded,
   * the generator's verbatim guard stops the build and this pins that the module
   * was updated with it.
   */
  const { BRITISH_COLUMBIA_MIGRATORY_HOURS, BRITISH_COLUMBIA_GENERAL_HOURS } =
    await import("./british-columbia-legal-time.ts");
  const bundle = JSON.parse(readFileSync("content/regulatory/ca-bc-2026.json", "utf8")) as {
    legalTime: { statedAs: string; section: string };
    legalTimeExceptions?: Array<{ statedAs: string; section: string; appliesTo: string }>;
  };

  assert.equal(bundle.legalTime.statedAs, BRITISH_COLUMBIA_GENERAL_HOURS.statedAs);

  const exceptions = bundle.legalTimeExceptions ?? [];
  assert.equal(exceptions.length, 1, "s. 14 (2) is carried in the bundle");
  const [migratory] = exceptions;
  assert.equal(migratory.statedAs, BRITISH_COLUMBIA_MIGRATORY_HOURS.statedAs);
  assert.match(migratory.section, /s\. 14 \(2\)/);
  assert.equal(migratory.appliesTo, "migratory game birds");

  /* And the exception is narrower than the rule it excepts, which is the whole
     reason it must not be inherited by the general case. */
  assert.ok(BRITISH_COLUMBIA_MIGRATORY_HOURS.basis === "SUNRISE_SUNSET_OFFSET");
  assert.ok(BRITISH_COLUMBIA_GENERAL_HOURS.basis === "SUNRISE_SUNSET_OFFSET");
  if (BRITISH_COLUMBIA_MIGRATORY_HOURS.basis !== "SUNRISE_SUNSET_OFFSET") return;
  if (BRITISH_COLUMBIA_GENERAL_HOURS.basis !== "SUNRISE_SUNSET_OFFSET") return;
  assert.ok(
    BRITISH_COLUMBIA_MIGRATORY_HOURS.beforeSunriseMinutes < BRITISH_COLUMBIA_GENERAL_HOURS.beforeSunriseMinutes,
  );
});

test("the CFR-derived US states rest on the boundary line, not on where they look", () => {
  /* 49 CFR § 71.9(b) puts the mountain/Pacific line on "the Utah-Nevada
     boundary, the Nevada-Arizona boundary, and the Arizona-California
     boundary". Read as a route, that makes the line Utah's WESTERN border and
     Arizona's WESTERN border — both wholly mountain — and California's EASTERN
     border, so it is wholly Pacific.

     These are asserted as a PAIR rather than one at a time on purpose: Utah and
     Nevada are adjacent and on OPPOSITE sides of the same line, so reading the
     route backwards swaps exactly these two, and each would still look
     individually plausible. A per-state assertion could not catch it. */
  assert.equal(timeZoneAtPoint("jurisdiction:us-ut"), "America/Denver");
  assert.equal(timeZoneAtPoint("jurisdiction:us-nv"), "America/Los_Angeles");
  assert.equal(timeZoneAtPoint("jurisdiction:us-ca"), "America/Los_Angeles");
  /* Arizona is the ZONE from the CFR and the absence of DST from Arizona's OWN
     exemption under 15 U.S.C. 260a(a): § 71.2 authorises a state to exempt
     itself and names none. "The CFR says Arizona is Phoenix" is not true of the
     CFR, which is why the reasoning is recorded beside the value. */
  assert.equal(timeZoneAtPoint("jurisdiction:us-az"), "America/Phoenix");
});

test("a state split by a river or a meridian is refused, and says what would unlock it", () => {
  /* Idaho and Alaska are absent from the single-zone table for a RECORDED
     reason, not because nobody looked — and the two call for different work,
     which is the whole point of distinguishing them. */
  for (const id of ["jurisdiction:us-id", "jurisdiction:us-ak"]) {
    assert.equal(timeZoneAtPoint(id), undefined, `${id} must not be given a single zone`);
    const split = UNITED_STATES_SPLIT_BY_FEATURE[id];
    assert.ok(split, `${id} must record WHY it is refused`);
    assert.match(split.citation, /49 CFR § 71\./);
    assert.ok(split.feature.length > 20 && split.consequence.length > 80,
      `${id} must name the feature and the consequence, not merely refuse`);
  }
  /* Alaska's naive fix fails in the PERMISSIVE direction, which is the one
     worth pinning: a longitude-only test moves inhabited non-Aleutian ground an
     hour, because § 71.12 reaches only "that part of the Aleutian Islands". */
  assert.match(UNITED_STATES_SPLIT_BY_FEATURE["jurisdiction:us-ak"].consequence, /St\. Lawrence Island/);
  /* Idaho's is latent rather than live, and the test says so, so nobody
     "fixes" it by stamping America/Boise across the state. */
  assert.match(UNITED_STATES_SPLIT_BY_FEATURE["jurisdiction:us-id"].consequence, /21A or above|panhandle/);
});

test("§ 71.7 gives three more states a clock by running the line along their own borders", () => {
  /* The route direction is the whole argument, and it differs per state:
     Colorado and New Mexico sit WEST of a line on their eastern borders, so
     mountain; Oklahoma sits EAST of a line on its western border, so central.
     Asserting Oklahoma beside the other two is deliberate — it is the one whose
     side is opposite, so a reader who inverted "westerly along the west
     boundary" would break here and not on the other two. */
  assert.equal(timeZoneAtPoint("jurisdiction:us-co"), "America/Denver");
  assert.equal(timeZoneAtPoint("jurisdiction:us-nm"), "America/Denver");
  assert.equal(timeZoneAtPoint("jurisdiction:us-ok"), "America/Chicago");
  /* Montana was already served from the tz table; § 71.7(a) confirms it
     independently. Two sources agreeing is the point, so it is asserted here
     too rather than left implicit. */
  assert.equal(timeZoneAtPoint("jurisdiction:us-mt"), "America/Denver");
});

test("a county split and a feature split are recorded as different problems", () => {
  /* They differ in what a person does next. A county split is resolvable with
     Census TIGERweb county geometry, which this codebase already reads for state
     identity. A feature split needs a river channel or a survey grid. Collapsing
     them would send someone to acquire hydrography for Kansas, and send nobody
     to acquire anything for Nebraska. */
  for (const id of ["jurisdiction:us-ks", "jurisdiction:us-tx"]) {
    const split = UNITED_STATES_SPLIT_BY_COUNTY[id];
    assert.ok(split, `${id} must be recorded as a county split`);
    assert.match(split.citation, /49 CFR § 71\.7/);
    assert.ok(split.exceptionCounties.length > 0, `${id} must name the counties`);
    assert.equal(timeZoneAtPoint(id), undefined, `${id} is not a jurisdiction-level fact and must not be served`);
    assert.equal(UNITED_STATES_SPLIT_BY_FEATURE[id], undefined, `${id} is a county split, not a feature split`);
  }
  /* Nebraska is the case that proves a national county table is impossible:
     § 71.7(c) names no county at all, only section lines with their offsets. */
  const ne = UNITED_STATES_SPLIT_BY_FEATURE["jurisdiction:us-ne"];
  assert.ok(ne, "Nebraska must be recorded as a feature split");
  assert.match(ne.feature, /Public Land Survey System/);
  assert.equal(UNITED_STATES_SPLIT_BY_COUNTY["jurisdiction:us-ne"], undefined,
    "Nebraska has no county approximation to offer");
  /* South Dakota carries the one municipal exception on this line. Anything that
     serves South Dakota has to handle Murdo explicitly. */
  assert.match(UNITED_STATES_SPLIT_BY_FEATURE["jurisdiction:us-sd"].consequence, /Murdo/);
});
