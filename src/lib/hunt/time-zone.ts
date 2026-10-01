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
 * and wrong in the other, so an in-season check passes.
 *
 * It was NOT removed on one agent's judgement: making the province undefined
 * would withhold a legal time everywhere to be right about one border strip,
 * which §8 treats as its own kind of false claim. It was reported to the lane
 * that owns Saskatchewan's serving posture so the trade could be made
 * deliberately.
 *
 * AND THAT LANE ANSWERED IT: THE DIVERGENCE IS HISTORICAL, NOT CURRENT.
 * Alberta keeps UTC-6 year-round from 1 November 2026 — Red Tape Reduction
 * Statutes Amendment Act, 2026, SA 2026 c. 12 s. 3, proclaimed 18 June 2026,
 * which `observed-clock.ts` already holds. So Lloydminster and Regina now agree
 * on the wall clock in every month, and the paragraph above describes winters up
 * to and including early 2026. Saskatchewan's own bundle limitation was
 * corrected with the same finding (PROJECT-STATE, 2026-10-01); this note is the
 * second home for it and was left stale, which is why a reader could still have
 * concluded the exposure was live "into November and December".
 *
 * MEASURE THIS THROUGH `renderingZone`, NOT THROUGH `Intl` DIRECTLY. Node's own
 * tzdata here is 2026a and still returns MST for Edmonton in November, so a raw
 * comparison reproduces the OLD divergence and looks like evidence for it. That
 * is how I first "confirmed" an exposure that had ended: the platform disagreed
 * with the law, and `observed-clock.ts` exists precisely because tzdata lags
 * legislatures.
 *
 * IT REMAINS CONTINGENT RATHER THAN RESOLVED. The Time Act, 2026 still allows
 * time option areas to be established by regulation, and Saskatchewan currently
 * has none. If one is established this paragraph becomes live again, which is a
 * different thing from the tz table changing and will not announce itself.
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
  /*
   * TWENTY-THREE STATES NO BOUNDARY LINE TOUCHES, CONFIRMED TWICE.
   *
   * Part 71 names a state only in the section describing a line that runs
   * through or along it — § 71.5 (eastern/central), § 71.7 (central/mountain),
   * § 71.9 (mountain/Pacific), § 71.11 and § 71.12 (Alaska, Hawaii). The 25
   * states those sections name are: MN MI WI IN IL KY TN GA AL FL, MT ND SD NE
   * KS CO OK TX NM, ID OR UT NV AZ CA, plus AK and HI. Every other state is
   * crossed by no line at all, so it lies wholly in one zone BY CONSTRUCTION.
   *
   * That is one source. The second is the tz database's own zone1970.tab
   * (sha256 cf7a21adf7153794a684c03e499e882ee119f828ad77a579ed99db26ceeae87b),
   * which describes the United States BY EXCEPTION and names exceptions for
   * exactly MI, KY, IN, ND, ID, OR, AZ and sub-areas of Alaska. None of the 23
   * appears. Two independent sources, one answer — the same standard the
   * Canadian entries above are held to.
   *
   * WHAT THE TZ TABLE CANNOT DO, recorded so it is not leaned on later: it is
   * NOT a county-level source. It lists no Kansas exception even though
   * § 71.7(d) puts western Kansas counties in the mountain zone, because
   * "Mountain (most areas)" covers them without enumerating. So the tz table
   * can only CONFIRM a state-level answer the CFR already establishes; it can
   * never be used to rule out a county split.
   *
   * § 71.3 also settles Maine positively rather than by absence: the Atlantic
   * zone "does not include any part of the State of Maine".
   */
  "jurisdiction:us-wy": "America/Denver",
  "jurisdiction:us-wa": "America/Los_Angeles",
  "jurisdiction:us-ar": "America/Chicago",
  "jurisdiction:us-ia": "America/Chicago",
  "jurisdiction:us-la": "America/Chicago",
  "jurisdiction:us-mo": "America/Chicago",
  "jurisdiction:us-ms": "America/Chicago",
  "jurisdiction:us-ct": "America/New_York",
  "jurisdiction:us-de": "America/New_York",
  "jurisdiction:us-ma": "America/New_York",
  "jurisdiction:us-md": "America/New_York",
  "jurisdiction:us-me": "America/New_York",
  "jurisdiction:us-nh": "America/New_York",
  "jurisdiction:us-nj": "America/New_York",
  "jurisdiction:us-ny": "America/New_York",
  "jurisdiction:us-nc": "America/New_York",
  "jurisdiction:us-oh": "America/New_York",
  "jurisdiction:us-pa": "America/New_York",
  "jurisdiction:us-ri": "America/New_York",
  "jurisdiction:us-sc": "America/New_York",
  "jurisdiction:us-va": "America/New_York",
  "jurisdiction:us-vt": "America/New_York",
  "jurisdiction:us-wv": "America/New_York",
  "jurisdiction:us-dc": "America/New_York",
  /*
   * Hawaii is the one state Part 71 assigns POSITIVELY rather than by the
   * absence of a line: § 71.12 "includes the entire State of Hawaii". Its lack
   * of daylight saving is Hawaii's own exemption under 15 U.S.C. 260a(a), not
   * § 71.2, which names no exempt state — the same distinction recorded for
   * Arizona above.
   */
  "jurisdiction:us-hi": "Pacific/Honolulu",
  /*
   * § 71.5 is the eastern/central line, and five of the ten states it names are
   * single-zone for the same border-run reason as Colorado and Oklahoma:
   *
   * GEORGIA and ALABAMA — § 71.5(e) runs the line along "the Tennessee-Georgia
   * boundary westerly to its junction with the Alabama-Georgia boundary; thence
   * southerly along that boundary and the Florida-Georgia boundary". That is
   * Georgia's WESTERN border, so Georgia is wholly east and Alabama wholly west.
   * They are adjacent and opposite, like Utah and Nevada.
   *
   * ILLINOIS — § 71.5(b) runs the line along "the western boundary of the State
   * of Indiana", so Illinois lies wholly west of it.
   *
   * WISCONSIN and MINNESOTA — § 71.5(a) runs entirely along MICHIGAN's county
   * lines and then Michigan's western boundary. It never enters either, so both
   * are wholly west. The paragraph's heading names Minnesota, which is why this
   * is written down: the heading is not the provision, and the route is what
   * decides.
   */
  "jurisdiction:us-ga": "America/New_York",
  "jurisdiction:us-al": "America/Chicago",
  "jurisdiction:us-il": "America/Chicago",
  "jurisdiction:us-wi": "America/Chicago",
  "jurisdiction:us-mn": "America/Chicago",
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
  "jurisdiction:us-mi": {
    citation: "49 CFR § 71.5(a)",
    majorityZone: "America/Detroit",
    exceptionZone: "America/Menominee",
    exceptionCounties: ["Gogebic", "Ontonagon", "Iron", "Dickinson", "Menominee"],
    note:
      "Five Upper Peninsula counties sit on the central side; the rest of Michigan is eastern. The route is county lines throughout. The tz database confirms the split independently with America/Menominee, \"Central - MI (Wisconsin border)\", against America/Detroit for most areas.",
  },
  "jurisdiction:us-in": {
    citation: "49 CFR § 71.5(b)",
    majorityZone: "America/Indiana/Indianapolis",
    exceptionZone: "America/Indiana/Knox",
    exceptionCounties: ["LaPorte", "Starke", "Marshall", "Pulaski", "Jasper", "Newton", "Gibson", "Pike", "Warrick", "Spencer", "Perry"],
    note:
      "Indiana is the strongest cross-check in Part 71: the CFR names Starke and Perry Counties, and the tz database independently carries America/Indiana/Knox as \"Central - IN (Starke)\" and America/Indiana/Tell_City as \"Central - IN (Perry)\". Two instruments, the same two counties. The counties listed are those the route names; which side each falls on must be read off the route, because it is a staircase, and Indiana has eight tz zones rather than two.",
  },
  "jurisdiction:us-ky": {
    citation: "49 CFR § 71.5(c)",
    majorityZone: "America/Kentucky/Louisville",
    exceptionZone: "America/Chicago",
    exceptionCounties: ["Meade", "Hardin", "Larue", "Taylor", "Casey", "Pulaski", "Wayne"],
    note:
      "Entirely county lines. The CFR names Wayne County and the tz database independently carries America/Kentucky/Monticello as \"Eastern - KY (Wayne)\" — the second two-source county agreement in this section.",
  },
  "jurisdiction:us-tn": {
    citation: "49 CFR § 71.5(d)",
    majorityZone: "America/Chicago",
    exceptionZone: "America/New_York",
    exceptionCounties: ["Scott", "Morgan", "Roane", "Rhea", "Hamilton"],
    note:
      "Entirely county lines. The tz database names NO Tennessee exception, which is not disagreement — it is the tz table declining to enumerate below its \"most areas\" rows, and is the clearest demonstration that it cannot be used to rule a county split out.",
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
  "jurisdiction:us-or": {
    citation: "49 CFR § 71.9(a)",
    feature:
      "the west line of Malheur County and \"the southwest corner of T. 35 S., R. 37 E.\" — a Public Land Survey System township corner INSIDE Malheur County",
    consequence:
      "Oregon is Pacific except its eastern edge, and the line does not follow Malheur County's boundary the whole way: it steps to a township corner within the county. So Malheur cannot be assigned a single zone from the CFR, and a county table is wrong there. The tz database agrees Oregon is split, naming America/Boise as \"Mountain - ID (south), OR (east)\" — which confirms the split exists but not where it runs, because the tz table is not a county-level source. The unlock is PLSS geometry for T. 35 S., R. 37 E.",
  },
  "jurisdiction:us-fl": {
    citation: "49 CFR § 71.5(f)",
    feature:
      "the middle of the main channel of the Apalachicola River from the downstream side of Jim Woodruff Dam, then the centre of the Jackson River, then the centre of the Intracoastal Waterway",
    consequence:
      "Florida's panhandle split follows two river channels and a navigable waterway, reaching a county line only at the very end (the west line of Gulf County). So it is a feature split, not a county one. The unlock is hydrography plus the Intracoastal Waterway centreline.",
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
