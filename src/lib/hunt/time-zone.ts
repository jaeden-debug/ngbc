/**
 * Two different timezones, which must never be mistaken for each other.
 *
 * A PROVENANCE timezone is a jurisdiction's own clock, used to stamp a date on
 * a record North Ground publishes on its behalf. One value per jurisdiction is
 * fine for that.
 *
 * A POINT timezone is the IANA zone at a hunt location. A legal hunting time
 * is a wall-clock time, so it depends on this and on nothing else — and a
 * jurisdiction-wide value is NOT this, because jurisdictions span zones.
 * Measured on two North Ground already serves:
 *
 *   British Columbia   declared America/Vancouver; the Peace River region is
 *                      America/Dawson_Creek. One hour out in December and
 *                      CORRECT IN SEPTEMBER, so an in-season check passes and
 *                      the error appears in the dark, at the hour a hunter
 *                      decides whether it is legal to shoot.
 *   Newfoundland and   declared America/St_Johns; Labrador is
 *   Labrador           America/Goose_Bay. Thirty minutes out year-round, which
 *                      is the size of a typical offset, so a "thirty minutes
 *                      before sunrise" rule there silently cancels or doubles
 *                      its own offset and still reads as a plausible time.
 *
 * The two are branded separately so the compiler refuses the substitution
 * rather than a reviewer having to notice it. A legal-time function takes a
 * `PointTimeZone`; a layer can only offer a `ProvenanceTimeZone`; there is no
 * conversion, because there is no safe one.
 */

declare const PROVENANCE: unique symbol;
declare const POINT: unique symbol;

/** A jurisdiction's own clock. Good for stamping a date; never a legal time. */
export type ProvenanceTimeZone = string & { readonly [PROVENANCE]: true };

/** The IANA zone AT a hunt location, established for that location. */
export type PointTimeZone = string & { readonly [POINT]: true };

/**
 * A point timezone, from something that actually established it for the point.
 *
 * Deliberately awkward to call: it takes the evidence, not just the string, so
 * "where did this come from?" is answerable at the call site. There is no
 * helper that turns a jurisdiction into one.
 */
export function pointTimeZone(
  iana: string,
  establishedBy: "SINGLE_ZONE_JURISDICTION" | "POINT_LOOKUP",
): PointTimeZone {
  if (!iana.includes("/")) throw new Error(`Not an IANA timezone: ${iana}`);
  void establishedBy;
  return iana as PointTimeZone;
}

/**
 * Jurisdictions whose whole extent is one IANA zone, so a point in them needs
 * no lookup.
 *
 * Membership is decided against the tz database's own country table
 * (`zone1970.tab` / `zone.tab`), which lists each zone with the areas it
 * covers, rather than against an impression of where a province sits. Alberta
 * and Manitoba each appear in exactly one row:
 *
 *   America/Edmonton   "AB, BC(E), NT(E), SK(W)"
 *   America/Winnipeg   "Central - ON (west), Manitoba"
 *
 * Ontario, Québec, British Columbia and Newfoundland and Labrador appear in
 * several and are deliberately absent, which is why `timeZoneAtPoint` returns
 * undefined for them.
 *
 * KNOWN EXPOSURE, RECORDED RATHER THAN SILENTLY FIXED — SASKATCHEWAN.
 * The same table shows Saskatchewan in THREE rows: America/Regina ("most
 * areas"), America/Swift_Current ("midwest") and America/Edmonton ("SK(W)").
 * Regina and Swift_Current agree on the wall clock — both CST year-round — but
 * the SK(W) area around Lloydminster keeps Alberta time, so it is MDT in
 * summer (UTC-6, agreeing with CST) and MST in winter (UTC-7, an hour apart).
 *
 * That is the failure shape this file was written about: correct in one season
 * and wrong in the other, so an in-season check passes. It is live rather than
 * theoretical, because `timeZoneAtPoint` feeds federal migratory-bird hours and
 * readiness, and those seasons run into November and December.
 *
 * It is NOT removed here on one agent's judgement: making it undefined would
 * withhold a legal time across the whole province to be right about one border
 * strip, which §8 treats as its own kind of false claim. It is reported to the
 * lane that owns Saskatchewan's serving posture so the trade is made
 * deliberately.
 */
export const SINGLE_ZONE_JURISDICTIONS: Readonly<Record<string, string>> = {
  "jurisdiction:ca-pe": "America/Halifax",
  "jurisdiction:ca-ns": "America/Halifax",
  "jurisdiction:ca-nb": "America/Moncton",
  "jurisdiction:ca-sk": "America/Regina",
  "jurisdiction:ca-yt": "America/Whitehorse",
  "jurisdiction:ca-ab": "America/Edmonton",
  "jurisdiction:ca-mb": "America/Winnipeg",
  /*
   * United States zones are described by EXCEPTION in the same table, so
   * membership here rests on an absence — which is evidence only because the
   * table would have shown it: it names exceptions down to single counties
   * (`Central - ND (Oliver)`, `Eastern - KY (Wayne)`). Montana is named in
   * none. Idaho IS named (`Mountain - ID (south), OR (east)`) and is therefore
   * absent from this table.
   */
  "jurisdiction:us-mt": "America/Denver",
  /*
   * THE FEDERAL INSTRUMENT, NOT THE TZ TABLE — 49 CFR PART 71.
   *
   * The entries above rest on the tz database, which records what clocks people
   * keep. What a US hunter's legal hunting hours are EXPRESSED IN is set by
   * 49 CFR Part 71, and that is the authority these four rest on:
   * `CFR-2024-title49-vol1-part71.xml` from govinfo, sha256
   * 9988f17d4ce54d153a98a5e660080edbd5a5e135b79354b221f2cf9cc5989ee1.
   * (The eCFR API returns 406; govinfo serves it.)
   *
   * Part 71 defines each zone as the ground between two boundary LINES, and
   * names states only in the three sections that describe those lines — § 71.5
   * (eastern/central), § 71.7 (central/mountain), § 71.9 (mountain/Pacific). A
   * state no line crosses therefore lies wholly in one zone BY CONSTRUCTION,
   * which is why these are single-zone on a federal instrument rather than on
   * an impression of where they sit.
   *
   * § 71.9(b) puts the mountain/Pacific line on "the Utah-Nevada boundary, the
   * Nevada-Arizona boundary, and the Arizona-California boundary". So the line
   * is Utah's WESTERN border and Arizona's WESTERN border — both wholly
   * mountain — and California's EASTERN border, wholly Pacific. Nevada sits
   * west of it, wholly Pacific, with one exception recorded below.
   */
  "jurisdiction:us-ut": "America/Denver",
  "jurisdiction:us-ca": "America/Los_Angeles",
  /*
   * Arizona keeps mountain STANDARD time year-round, and Part 71 is NOT the
   * authority for that. § 71.2 implements 15 U.S.C. 260a(a) and "authorizes any
   * State to exempt itself" — but it names NO exempt state. So the exemption is
   * Arizona's own act under that statute, not a federal regulation, and
   * America/Phoenix rests on the CFR for the ZONE and on Arizona's own
   * exemption for the absence of DST. Recorded because the natural shortcut —
   * "the CFR says Arizona is Phoenix" — is not true of the CFR.
   *
   * The Navajo Nation observes DST within Arizona. That is not an exception
   * Part 71 makes, so it is not resolved here; see the exposure note below.
   */
  "jurisdiction:us-az": "America/Phoenix",
  /*
   * KNOWN EXPOSURE, RECORDED RATHER THAN SILENTLY FIXED — NEVADA.
   * § 71.9(b) carves the City of West Wendover, Nevada onto the MOUNTAIN side:
   * the line leaves the Utah-Nevada boundary, runs "along the northern,
   * western, and southern boundaries of the City of West Wendover back to the
   * Utah-Nevada boundary". West Wendover is in Elko County, so ELKO COUNTY
   * SPANS BOTH ZONES and a county-level table would be wrong there.
   *
   * Nevada is served as Pacific anyway, on the same reasoning the Saskatchewan
   * note above sets out: withholding a legal time across the whole state to be
   * right about one city is its own false claim under §8. But the direction of
   * this error is the unsafe one — a West Wendover hunter shown Pacific time
   * sees a legal window an hour early — so it is reported rather than absorbed,
   * and the fix is a municipal boundary, not more reading.
   */
  "jurisdiction:us-nv": "America/Los_Angeles",
  /*
   * § 71.7 does the same job for the central/mountain line, and three more
   * states fall out of it by construction — the line runs along their own
   * borders, so no part of them is on the other side:
   *
   * COLORADO. § 71.7(d) runs the line along the Kansas-Colorado boundary,
   * jogging east around six Kansas counties and back. So the line is at or east
   * of Colorado's eastern border, and § 71.9 never names Colorado, so nothing
   * crosses it in the west either.
   *
   * NEW MEXICO. § 71.7(e) runs "southerly along the west boundary of the State
   * of Oklahoma and the west boundary of the State of Texas to the southeast
   * corner of New Mexico; thence westerly along the Texas-New Mexico boundary".
   * That is New Mexico's eastern and southern border, and § 71.9 does not name
   * it.
   *
   * OKLAHOMA. The same route puts the line on Oklahoma's WEST boundary, so
   * Oklahoma lies wholly east of it, and § 71.5 does not name Oklahoma.
   *
   * MONTANA is above on the tz table; § 71.7(a) independently confirms it, the
   * line running along the Montana-North Dakota boundary and then east into
   * North Dakota. Two sources, one answer.
   */
  "jurisdiction:us-co": "America/Denver",
  "jurisdiction:us-nm": "America/Denver",
  "jurisdiction:us-ok": "America/Chicago",
};

/**
 * States the federal line splits along COUNTY boundaries.
 *
 * Kept apart from the feature splits below because the two differ in what a
 * person does next, which is the whole reason to distinguish them. A county
 * split is resolvable with county geometry — and North Ground already reads
 * Census TIGERweb for state identity, so the unlock is a layer it can already
 * reach. A feature split needs a river channel or a survey grid.
 *
 * Neither is served yet: `timeZoneAtPoint` answers per jurisdiction, and "Kansas
 * except six counties" is not a jurisdiction-level fact. Recording the counties
 * is what makes the next step a lookup rather than a re-read.
 */
export const UNITED_STATES_SPLIT_BY_COUNTY: Readonly<Record<string, {
  citation: string;
  majorityZone: string;
  exceptionZone: string;
  exceptionCounties: readonly string[];
  note: string;
}>> = {
  "jurisdiction:us-ks": {
    citation: "49 CFR § 71.7(d)",
    majorityZone: "America/Chicago",
    exceptionZone: "America/Denver",
    exceptionCounties: ["Sherman", "Wallace", "Greeley", "Hamilton", "Logan", "Wichita"],
    note:
      "The line jogs east off the Kansas-Colorado boundary around these six counties and back, so it is entirely county lines here. Sherman, Wallace, Greeley and Hamilton are the western tier the line encloses; Logan and Wichita are named where it steps back west. Which side each of the six sits on must be read off the route itself before any of them is served — the section traces a staircase, not a straight tier.",
  },
  "jurisdiction:us-tx": {
    citation: "49 CFR § 71.7(e)",
    majorityZone: "America/Chicago",
    exceptionZone: "America/Denver",
    exceptionCounties: ["Hudspeth", "El Paso"],
    note:
      "The line runs south along the west boundary of Texas, then west along the Texas-New Mexico boundary to \"the east line of Hudspeth County, Tex.\", then south to Mexico. So the mountain part of Texas is what lies west of Hudspeth's east line. Hudspeth is named by the CFR; El Paso lies west of it and is therefore also mountain, which is an inference from the geometry rather than a name in the section, and is flagged as such.",
  },
};

/**
 * Why a US state is NOT in the table above, where the reason is a specific
 * federal boundary that runs through something other than a county line.
 *
 * These are not "unresearched". Each has been read in 49 CFR Part 71 and found
 * to split on a feature North Ground holds no geometry for, so no single zone
 * is true of the state and no county table can fix it either. Naming the
 * feature is what turns each into an acquirable unlock rather than a gap.
 */
export const UNITED_STATES_SPLIT_BY_FEATURE: Readonly<Record<string, { citation: string; feature: string; consequence: string }>> = {
  "jurisdiction:us-id": {
    citation: "49 CFR § 71.9(a)",
    feature: "the main channel of the Salmon River, after the Idaho County / Lemhi County boundary",
    consequence:
      "Idaho County is split by a river, so even a county-level table is wrong there. Idaho's panhandle is Pacific and its south is mountain. Every currently certified Idaho unit is numbered 21A or above and none is in the panhandle, so America/Boise would be right for all of them today — and an hour wrong for the first panhandle species added, which is deer, elk, bear, turkey or grouse. Resolving it needs the Salmon River channel, or per-unit zoning rather than per-state.",
  },
  "jurisdiction:us-nd": {
    citation: "49 CFR § 71.7(a)",
    feature:
      "the Missouri River, the Yellowstone River and the Little Missouri (all by the MIDDLE of the channel), township and range lines (T. 150 N., R. 104 W. and others), and the centre of State Highway 31",
    consequence:
      "North Dakota's central/mountain line is overwhelmingly not a county boundary. It does touch Mercer, Morton and Sioux county lines, but between them it follows three river channels, a survey grid and a highway centreline — so a county table would be wrong along the whole corridor rather than merely incomplete. The unlock is hydrography plus the Public Land Survey System, not more reading.",
  },
  "jurisdiction:us-sd": {
    citation: "49 CFR § 71.7(b)",
    feature:
      "the main channel of the Missouri River, \"the crossing of the original Chicago & North Western Railway near Pierre\", and section corners (the NE 1/4, Sec. 6, T. 2 N., R. 30 E.)",
    consequence:
      "A railway that the section itself calls \"original\" is a historical alignment, which is worse than a river: it may no longer exist on the ground. The line then follows the west lines of Jones, Mellette and Todd Counties, so the southern half IS county-traceable — but the northern half is not. § 71.7(g) also singles out Murdo, S. Dak. as the one municipality on this line that is CENTRAL while every other is mountain, so Murdo must be handled explicitly by anything that serves South Dakota.",
  },
  "jurisdiction:us-ne": {
    citation: "49 CFR § 71.7(c)",
    feature:
      "township, range and section lines of the Public Land Survey System, with their offsets, for the entire described route",
    consequence:
      "Nebraska's line names no county at all — it is a staircase of section lines \"with their offsets\" from the South Dakota border to Kansas. There is no county approximation to make, so this is the clearest case in Part 71 that a county-level timezone table cannot be built for the United States generally. The unlock is PLSS geometry.",
  },
  "jurisdiction:us-ak": {
    citation: "49 CFR § 71.11 with § 71.12",
    feature: "169°30′ W longitude, qualified by the undefined class \"the Aleutian Islands\"",
    consequence:
      "Alaska has no counties, and § 71.12 reaches only \"that part of the Aleutian Islands\" west of the meridian. So a longitude-only test is wrong in the LOOSE direction: Alaska land west of 169°30′ W that is not Aleutian stays in the Alaska zone. St. Lawrence Island — Gambell and Savoonga, inhabited hunting country — is the live case a naive test would put on America/Adak, an hour off. Part 71 supplies no definition of the Aleutians, so membership must come from authoritative geometry outside the instrument.",
  },
};

/**
 * The timezone at a point, or undefined where North Ground cannot establish it.
 *
 * Undefined is the honest answer for British Columbia, Ontario, Québec and
 * Newfoundland and Labrador until a licensed point-timezone dataset exists:
 * each genuinely spans zones whose wall clocks differ. A hunter shown no time
 * checks; a hunter shown a wrong one does not.
 *
 * Alberta and Manitoba were in that list and should not have been — the tz
 * database puts each wholly inside one zone (see above). Withholding their
 * legal hours for a limitation that does not apply to them was a refusal
 * stricter than the evidence, which §8 makes as much a false claim as an
 * over-broad one.
 */
export function timeZoneAtPoint(jurisdictionId: string): PointTimeZone | undefined {
  const single = SINGLE_ZONE_JURISDICTIONS[jurisdictionId];
  return single ? pointTimeZone(single, "SINGLE_ZONE_JURISDICTION") : undefined;
}
