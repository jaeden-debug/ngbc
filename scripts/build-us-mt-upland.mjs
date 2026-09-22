#!/usr/bin/env node
/**
 * Build Montana's certified upland game bird bundle from the 2026 regulations.
 *
 *   node scripts/build-us-mt-upland.mjs           write the bundle, overlay catalogue and certified districts
 *   node scripts/build-us-mt-upland.mjs --check   exit 2 if a source moved, 3 if a committed file differs
 *
 * Source: Montana Fish, Wildlife & Parks, "2026 Upland Game Bird Hunting
 * Regulations", adopted by the Fish and Wildlife Commission on Dec. 4, 2025 and
 * "valid March 1, 2026, through Feb. 28, 2027" (p. 2). The web page's season
 * list says it is "provided only as a general reference", so the booklet is
 * the source and nothing is read from the page.
 *
 * What Montana adds to Hunt:
 *
 *   - Seasons set statewide and split only at the Continental Divide, read in
 *     Montana's own upland game bird districts rather than its deer and elk
 *     districts (a species-specific geography).
 *   - Residency and land type: "Nonresidents hunting on public lands and
 *     privately owned lands that are a part of a hunting access program begin
 *     hunting 10 days later than residents for all species except mountain
 *     grouse." That is asked only where it changes the answer.
 *   - A youth-only pheasant weekend and a later start for nonresident 3-day
 *     licences.
 *   - Tribal authority: the Commission "closed all lands within the exterior
 *     boundaries of Montana's Indian Reservations to the hunting of upland game
 *     birds with the use of state licenses unless provided for in a cooperative
 *     agreement" (p. 4). North Ground reads the reservation boundaries from the
 *     U.S. Census Bureau at the point and answers CLOSED for a state licence on
 *     five reservations; on the Flathead Reservation (cooperative agreement) and
 *     the Crow Reservation (state rules on deeded fee land only) it will not
 *     state a status. None of it describes hunting under tribal authority.
 *
 * Every rule is generated from wording the builder expects to find exactly
 * once. Anything else stops the build.
 */

import {
  expectOne, fetchJson, fetchPdf, flatten, jurisdictionToday, parseRange, readPreviousBundle,
  retrievedAtFor, sha256, recordSourcesFromArgs, writeOrCheck,
} from "./us-source.mjs";

const BUNDLE = "content/regulatory/us-mt-upland-2026.json";
const OVERLAYS = "content/regulatory/us-mt-overlays.json";
const CERTIFIED = "content/regulatory/us-mt-certified-units.json";

const PDF_URL = "https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-upgbrd-final-for-web.pdf";
const SOURCE_ID = "source:us-mt-upland-regulations-2026";
const SOURCE_VERSION = "2026 Montana Upland Game Bird Hunting Regulations";
const LICENCE_YEAR = 2026;
const TIME_ZONE = "America/Denver";

const FWP_BASE = "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer";
const TIGER_RESERVATIONS = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/AIANNHA/MapServer/2";
const SOURCES = {
  booklet: SOURCE_ID,
  restricted: "source:us-mt-fwp-restricted-areas-service",
  reservations: "source:us-census-tigerweb-federal-reservations-2026",
  districts: "source:us-mt-upland-district-service",
};

const EAST = "East of the Continental Divide";
const WEST = "West of the Continental Divide";
const DISTRICTS = [EAST, WEST];
const zoneId = (designation) => `management_zone:us-mt-upland-${designation.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;

const RESERVATION_CLOSED = "us-mt-reservation-state-licence-closed";
const CLOSED_TO_ALL = "us-mt-closed-to-all-hunting";
const CARBON_PORTION = "us-mt-carbon-county-partridge-portion";

/* ── What the booklet must say ─────────────────────────────────────────── */

const RESERVATION_RULE =
  "The F&W Commission has, by rule, closed all lands within the exterior boundaries of Montana’s Indian Reservations " +
  "to the hunting of upland game birds with the use of state licenses unless provided for in a cooperative agreement " +
  "between the Tribal Government and the State of Montana.";
const FLATHEAD_TEXT =
  "The State of Montana and the Confederated Salish and Kootenai Tribes have entered into a cooperative management " +
  "agreement on the Flathead Indian Reservation. Please check for upland game bird regulations specific to the " +
  "Flathead Reservation.";
const CROW_TEXT =
  "Exception: State upland game bird regulations apply to deeded “fee” land within the exterior boundary of the Crow " +
  "Indian Reservation.";

function readBooklet(pages) {
  if (pages.length !== 12) throw new Error(`The 2026 upland booklet has ${pages.length} pages; 12 were reviewed`);
  const p = pages.map(flatten);
  const validity = expectOne(p[1],
    /Regulations for season dates, structures, and restrictions were adopted by the Fish and Wildlife Commission on Dec\. 4, 2025, under the authority granted in MCA 87-1-301 and are valid March 1, 2026, through Feb\. 28, 2027\./,
    "validity (p. 2)");
  expectOne(p[1], /Nonresidents hunting on public lands and privately owned lands that are a part of a hunting access program begin hunting 10 days later than residents for all species except mountain grouse\./, "nonresident delay (p. 2)");
  expectOne(p[1], /Upland Game Birds: sharp-tailed grouse, blue grouse, spruce \(Franklin\) grouse, prairie chicken, sage hen or sage grouse, ruffed grouse, ring-necked pheasant, Hungarian partridge, ptarmigan, wild turkey, and chukar partridge\./, "species definition (p. 2)");
  expectOne(p[3], /Hunting Hours \(CR\) - Authorized hunting hours for the taking of upland game birds begin one-half hour before sunrise and end one-half hour after sunset each day of the hunting season\./, "hunting hours (p. 4)");
  for (const text of [RESERVATION_RULE, FLATHEAD_TEXT, CROW_TEXT]) {
    if (!p[3].includes(text)) throw new Error(`Reservation wording on p. 4 has changed: "${text.slice(0, 80)}…"`);
  }
  expectOne(p[3], /Landowner Permission \(MCA 87-6-415\) - A person may not hunt or attempt to hunt furbearers, game animals, migratory game birds, nongame wildlife, predatory animals, upland game birds, or wolves while hunting on private property without first obtaining permission of the landowner, the lessee, or their agents\./, "landowner permission (p. 4)");

  const page9 = p[8];
  expectOne(page9,
    /Residents hunting on all lands in the state and Nonresidents hunting on privately owned lands that are not a part of a hunting access program Season Dates Nonresidents hunting on public lands and private- ly owned lands that are a part of a hunting access program Season Dates Bag Limit Additional Information/,
    "p. 9 column heads");
  const range = String.raw`[A-Z][a-z]{2,3}\.? \d{1,2} - [A-Z][a-z]{2,3}\.? \d{1,2}`;
  const mountain = expectOne(page9, new RegExp(
    String.raw`Mountain Grouse: Blue, ruffed, and Franklin’s grouse may be taken with .+? All other means of taking are prohibited\. (${range}) (${range}) Bag Limit: (\d+) in aggregate daily\. Possession limit is four times the daily bag limit\.`), "mountain grouse (p. 9)");
  const partridge = expectOne(page9, new RegExp(
    String.raw`Partridge: Hungarian and chukar partridge may be taken with .+? All other means of taking are prohibited\. (${range}) (${range}) Bag Limit: (\d+) in aggregate daily\. Possession limit is four times the daily bag limit\. Chukar partridge occur primarily in Carbon County\. (${range}) (${range}) Bag Limit: (\d+) in aggregate daily\. Possession limit is four times the daily bag limit\. Portion of Carbon County within the following boundary: (.+?), the point of beginning\.`), "partridge (p. 9)");
  const sharptail = expectOne(page9, new RegExp(
    String.raw`Sharp-tailed Grouse: Sharp-tailed grouse may be taken with .+? All other means of taking are prohibited\. (${range}) (${range}) Bag Limit: (\d+) daily\. Possession limit is four times the daily bag limit\. Closed West of the Continental Divide\.`), "sharp-tailed grouse (p. 9)");

  const page10 = p[9];
  expectOne(page10,
    /Residents hunting on all lands in the state Season Dates Nonresidents hunting on pri- vately owned lands that are not a part of a hunting access program Season Dates Nonresidents hunting on public lands and privately owned lands that are a part of a hunting access program Season Dates Bag Limit Additional Information/,
    "p. 10 column heads");
  const pheasant = expectOne(page10, new RegExp(
    String.raw`Ring-necked Pheasant: Pheasants may be taken with .+? All other means of taking are prohibited\. (${range}) Youth Only (${range}) Youth Only (${range}) Youth Only Bag Limit: (\d+) cock pheas- ants daily\. Possession limit is three times the daily bag limit\. (Legally licensed youth ages 15 and under when accompanied by a nonhunting adult at least 18 years of age\.) Mentors for Apprentice Hunters must be at least 21 years of age\. (${range}) (${range}) (${range}) Bag Limit: \d+ cock pheas- ants daily\. Possession limit is three times the daily bag limit\. Resident and Nonresident Season License holders\. - (${range}) (${range}) Bag Limit: \d+ cock pheas- ants daily\. Possession limit is three times the daily bag limit\. Nonresident 3-day License holders\.`), "pheasant (p. 10)");
  const gates = expectOne(page10, /Gates of the Mountains Game Preserve: Closed to all hunting:/, "Gates of the Mountains (p. 10)");
  const helena = expectOne(page10, /Helena Valley Regulating Reservoir \(Lewis and Clark County\): (Open to upland game bird hunting up to the opening day of the waterfowl season at which point it is closed to all hunting\.)/, "Helena Valley (p. 10)");
  const freezout = expectOne(page10, /Freezout Lake Wildlife Management Area \(Teton County\): (Open to upland game bird hunting until the opening of the general waterfowl season, then it will be closed to all hunting in the following described portion of the Wildlife Management Area: .+? The area closed will reopen Nov\. 20\.)/, "Freezout Lake (p. 10)");
  const badRock = expectOne(page10, /Bad Rock Canyon WMA: (Hunting by limited access permit only\.)/, "Bad Rock Canyon (p. 10)");

  const dates = (text) => parseRange(text, { licenceYear: LICENCE_YEAR, firstMonth: 3 });
  const [mountainResident, mountainPublic] = [mountain[1], mountain[2]].map(dates);
  if (JSON.stringify(mountainResident) !== JSON.stringify({ ...mountainPublic, statedAs: mountainResident.statedAs })) {
    throw new Error("Mountain grouse now has different dates for nonresidents on public land; the rules must model it");
  }
  return {
    validity: validity[0],
    mountain: { window: mountainResident, daily: Number(mountain[3]) },
    partridge: {
      general: { resident: dates(partridge[1]), publicLand: dates(partridge[2]), daily: Number(partridge[3]) },
      carbon: { resident: dates(partridge[4]), publicLand: dates(partridge[5]), daily: Number(partridge[6]), description: `${partridge[7]}, the point of beginning.` },
    },
    sharptail: { resident: dates(sharptail[1]), publicLand: dates(sharptail[2]), daily: Number(sharptail[3]) },
    pheasant: {
      youth: [pheasant[1], pheasant[2], pheasant[3]].map(dates),
      daily: Number(pheasant[4]),
      youthCondition: pheasant[5],
      seasonLicence: { resident: dates(pheasant[6]), privateLand: dates(pheasant[7]), publicLand: dates(pheasant[8]) },
      threeDay: { privateLand: dates(pheasant[9]), publicLand: dates(pheasant[10]) },
    },
    restricted: { gates: Boolean(gates), helena: helena[1], freezout: freezout[1], badRock: badRock[1] },
  };
}

/* ── Overlays: what Montana and the Census Bureau publish at a point ─── */

const STATE_LICENCE_CLOSED_RESERVATIONS = {
  "0305R": "Blackfeet Indian Reservation",
  "1150R": "Fort Belknap Reservation",
  "1250R": "Fort Peck Indian Reservation",
  "2490R": "Northern Cheyenne Indian Reservation",
  "3205R": "Rocky Boy's Reservation",
};
const FLATHEAD = { "1110R": "Flathead Reservation" };
const CROW = { "0845R": "Crow Reservation" };

/* FWP's Big Game Restricted Areas. Only Gates of the Mountains is described
   by the upland booklet; everything else is an area whose own rules North
   Ground has not certified for upland birds, and a point inside it is not
   given a season status. Freezout and Helena Valley are read from FWP's
   upland restricted-areas layer, which carries the booklet's wording. */
const BIG_GAME_RESTRICTED_DESCRIBED = { "Gates of the Mountains Game Preserve": CLOSED_TO_ALL };
const BIG_GAME_RESTRICTED_UPLAND_LAYER = ["Freezout Lake Wildlife Management Area", "Helena Valley Regulating Reservoir"];
const BIG_GAME_RESTRICTED_EXPECTED = 53;

async function readLayer(url, fields) {
  const parameters = new URLSearchParams({ where: "1=1", outFields: fields, returnGeometry: "false", orderByFields: "OBJECTID", f: "json" });
  const payload = await fetchJson(`${url}/query?${parameters}`);
  if (payload.error || !Array.isArray(payload.features)) throw new Error(`${url} did not answer: ${JSON.stringify(payload.error ?? payload).slice(0, 200)}`);
  return payload.features.map((feature) => feature.attributes);
}

async function readReservations() {
  const parameters = new URLSearchParams({
    where: "1=1", geometry: "-116.06,44.35,-104.03,49.01", geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,NAME,GEOID,FUNCSTAT", returnGeometry: "false", orderByFields: "OBJECTID", f: "json",
  });
  const layer = await fetchJson(`${TIGER_RESERVATIONS}?f=json`);
  const payload = await fetchJson(`${TIGER_RESERVATIONS}/query?${parameters}`);
  if (payload.error || !Array.isArray(payload.features)) throw new Error("TIGERweb reservations did not answer");
  return { description: layer.description, rows: payload.features.map((feature) => feature.attributes) };
}

function buildOverlays(booklet, restricted, uplandRestricted, portions, reservations) {
  if (!/January 1, 2026 vintage/.test(reservations.description ?? "")) {
    throw new Error(`TIGERweb reservations layer is no longer the January 1, 2026 vintage: "${reservations.description}"`);
  }
  const reservationFeatures = [];
  const wanted = { ...STATE_LICENCE_CLOSED_RESERVATIONS, ...FLATHEAD, ...CROW };
  for (const [geoid, name] of Object.entries(wanted)) {
    const row = reservations.rows.find((entry) => entry.GEOID === geoid);
    if (!row || row.NAME !== name) throw new Error(`TIGERweb no longer publishes ${name} as GEOID ${geoid}`);
    const closed = geoid in STATE_LICENCE_CLOSED_RESERVATIONS;
    reservationFeatures.push({
      objectId: row.OBJECTID,
      name,
      statedAs: closed ? RESERVATION_RULE : geoid in FLATHEAD ? FLATHEAD_TEXT : CROW_TEXT,
      regulation: "2026 Montana Upland Game Bird Hunting Regulations, p. 4, Indian Reservations (Commission rule)",
      tokens: closed ? [] : ["tribal_authority"],
      unclassified: [],
      specialIds: closed ? [RESERVATION_CLOSED] : [],
    });
  }

  if (restricted.length !== BIG_GAME_RESTRICTED_EXPECTED) {
    throw new Error(`FWP Big Game Restricted Areas has ${restricted.length} features; ${BIG_GAME_RESTRICTED_EXPECTED} were reviewed`);
  }
  const restrictedFeatures = restricted.map((row) => {
    const name = String(row.PORTIONNAME ?? "").replace(/\s+/g, " ").trim();
    if (!name) throw new Error(`FWP restricted area ${row.OBJECTID} has no name`);
    if (name in BIG_GAME_RESTRICTED_DESCRIBED) {
      if (!booklet.restricted.gates) throw new Error("The booklet no longer closes Gates of the Mountains to all hunting");
      return {
        objectId: row.OBJECTID, name, statedAs: "Closed to all hunting",
        regulation: "2026 Montana Upland Game Bird Hunting Regulations, p. 10", tokens: [], unclassified: [], specialIds: [BIG_GAME_RESTRICTED_DESCRIBED[name]],
      };
    }
    if (BIG_GAME_RESTRICTED_UPLAND_LAYER.includes(name)) {
      return { objectId: row.OBJECTID, name, statedAs: "", regulation: "Read from FWP's upland restricted-areas layer", tokens: [], unclassified: [], specialIds: [] };
    }
    return {
      objectId: row.OBJECTID, name,
      statedAs: "Listed in Montana Fish, Wildlife & Parks' Big Game Restricted Areas; any rule it has for upland game birds is not in the regulations North Ground has certified.",
      regulation: "Montana Fish, Wildlife & Parks, Big Game Restricted Areas layer", tokens: ["restricted_area_not_evaluated"], unclassified: [], specialIds: [],
    };
  });

  const uplandTexts = { "Freezout Wildlife Management Area": booklet.restricted.freezout, "Helena Valley Regulating Reservoir": booklet.restricted.helena };
  if (uplandRestricted.length !== 2) throw new Error(`FWP Upland Game Bird Restricted Areas has ${uplandRestricted.length} features; 2 were reviewed`);
  const uplandFeatures = uplandRestricted.map((row) => {
    const statedAs = uplandTexts[row.PORTIONNAME];
    if (!statedAs) throw new Error(`Unreviewed upland restricted area "${row.PORTIONNAME}"`);
    return {
      objectId: row.OBJECTID, name: row.PORTIONNAME, statedAs, regulation: "2026 Montana Upland Game Bird Hunting Regulations, p. 10",
      tokens: ["upland_restricted_waterfowl_opening"], unclassified: [], specialIds: [],
    };
  });

  if (portions.length !== 1 || portions[0].PORTIONNAME !== "Carbon County Partridge Portion" || portions[0].REGYEAR !== "2026") {
    throw new Error(`FWP Upland Game Bird Portions changed: ${JSON.stringify(portions)}`);
  }
  const portionFeatures = [{
    objectId: portions[0].OBJECTID, name: "Portion of Carbon County (partridge)", statedAs: "",
    regulation: "2026 Montana Upland Game Bird Hunting Regulations, p. 9", tokens: [], unclassified: [], specialIds: [CARBON_PORTION],
  }];

  const layer = (key, url, sourceId, features) => ({
    key, url, sourceId, featureCount: features.length, contentHash: sha256(JSON.stringify(features)), features,
  });
  return {
    jurisdictionId: "jurisdiction:us-mt",
    purpose:
      "Published areas that change an upland game bird answer at a point: Indian reservations (U.S. Census Bureau boundaries, " +
      "Montana Commission rule), Montana's restricted areas and the Carbon County partridge portion. Read live at the point; " +
      "only names and ids are kept here, never geometry.",
    layers: [
      layer("reservations", TIGER_RESERVATIONS, SOURCES.reservations, reservationFeatures),
      layer("upland-restricted", `${FWP_BASE}/33`, SOURCES.restricted, uplandFeatures),
      layer("upland-portions", `${FWP_BASE}/32`, SOURCES.restricted, portionFeatures),
      layer("big-game-restricted", `${FWP_BASE}/2`, SOURCES.restricted, restrictedFeatures),
    ],
  };
}

/* ── Rules ──────────────────────────────────────────────────────────────── */

const RESIDENT = { RESIDENCY: "RESIDENT" };
const NONRESIDENT_PRIVATE = { RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS" };
const NONRESIDENT_PUBLIC = { RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" };

function buildRules(booklet) {
  const rules = [];
  const groups = new Map();
  const group = (designations) => {
    const id = `regulatory_group:us-mt-upland-2026-${designations.length === 2 ? "statewide" : designations[0] === EAST ? "east" : "west"}`;
    groups.set(id, { id, officialSpec: designations.length === 2 ? "Statewide" : designations[0], zoneIds: designations.map(zoneId), officialIdentifiers: designations });
    return id;
  };
  const statewide = group(DISTRICTS);
  const east = group([EAST]);
  const west = group([WEST]);
  const geography = (statedAs, include, exclude = []) => ({
    statedAs,
    include: { ghas: include, gbhz: [], special: [] },
    exclude: { ghas: [], special: [RESERVATION_CLOSED, CLOSED_TO_ALL, ...exclude] },
  });
  const base = (id, speciesId, fields) => ({
    id: `regulatory_rule:us-mt-upland-2026-${id}`,
    speciesId,
    conditionIds: ["mt-upland-licence", "mt-landowner-permission"],
    caveats: [],
    notes: [],
    disputes: [],
    sourceId: SOURCE_ID,
    sourceVersion: SOURCE_VERSION,
    reviewStatus: "VERIFIED",
    declaredNoSeason: false,
    authority: { level: "STATE_REGULATION", instrument: "Montana Fish and Wildlife Commission upland game bird regulations (Dec. 4, 2025)" },
    ...fields,
  });
  const closures = (speciesId, slug, statedAs) => [
    base(`${slug}-reservation-closed`, speciesId, {
      regulatoryGroupId: statewide,
      geography: { statedAs: "Indian reservations closed to state-licensed upland game bird hunting", include: { ghas: [], gbhz: [], special: [RESERVATION_CLOSED] }, exclude: { ghas: [], special: [] } },
      appliesWhen: {}, seasonLabel: "Indian reservation", seasonPhrase: "Closed to state-licensed upland game bird hunting",
      windows: [], declaredNoSeason: true, sourceSection: "p. 4, Indian Reservations (CR)",
      closureStatedAs: "Montana's Fish and Wildlife Commission has closed all lands within the exterior boundaries of this reservation to the hunting of upland game birds with a state license (p. 4). That is not a statement about hunting under the tribe's own authority, which North Ground does not evaluate.",
      notes: [
        `${RESERVATION_RULE} This is about hunting with a state licence. Hunting under the tribe's own authority is a matter for the tribal government, and North Ground does not evaluate it.`,
      ],
      limits: undefined,
    }),
    base(`${slug}-closed-to-all-hunting`, speciesId, {
      regulatoryGroupId: statewide,
      geography: { statedAs: "Gates of the Mountains Game Preserve", include: { ghas: [], gbhz: [], special: [CLOSED_TO_ALL] }, exclude: { ghas: [], special: [] } },
      appliesWhen: {}, seasonLabel: "Gates of the Mountains Game Preserve", seasonPhrase: "Closed to all hunting",
      windows: [], declaredNoSeason: true, sourceSection: "p. 10, Closed or Restricted Areas", notes: ["Gates of the Mountains Game Preserve: closed to all hunting."],
      closureStatedAs: "Closed to all hunting (p. 10).",
      limits: undefined,
    }),
  ].map((entry) => ({ ...entry, seasonPhrase: entry.seasonPhrase ?? statedAs }));

  const limits = (daily, possession, statedAs, combinedWithNames) => ({
    daily, possession, combined: Boolean(combinedWithNames), ...(combinedWithNames ? { combinedWithNames } : {}), statedAs, section: "pp. 9–10",
  });

  // Mountain grouse: ruffed and spruce (Franklin's), statewide, the same for everyone.
  for (const [speciesId, slug] of [["species:ruffed-grouse", "ruffed-grouse"], ["species:spruce-grouse", "spruce-grouse"]]) {
    rules.push(base(`${slug}-statewide`, speciesId, {
      regulatoryGroupId: statewide,
      geography: geography("Statewide", DISTRICTS),
      appliesWhen: {},
      seasonLabel: "Mountain grouse season", seasonPhrase: booklet.mountain.window.statedAs,
      windows: [booklet.mountain.window],
      limits: limits(booklet.mountain.daily, booklet.mountain.daily * 4,
        `${booklet.mountain.daily} in aggregate daily (blue, ruffed and Franklin’s grouse); possession limit four times the daily bag limit`,
        ["blue grouse", "ruffed grouse", "Franklin’s grouse"]),
      sourceSection: "p. 9, Mountain Grouse",
      ...(slug === "spruce-grouse" ? { notes: ["Montana calls the spruce grouse “Franklin’s grouse” (“spruce (Franklin) grouse”, p. 2)."] } : {}),
    }));
    rules.push(...closures(speciesId, slug));
  }

  // Partridge: statewide, with a longer season in a described portion of Carbon County.
  const partridgeLimits = limits(booklet.partridge.general.daily, booklet.partridge.general.daily * 4,
    `${booklet.partridge.general.daily} in aggregate daily (Hungarian and chukar partridge); possession limit four times the daily bag limit`,
    ["Hungarian partridge", "chukar partridge"]);
  for (const [label, where, windows, extra] of [
    ["statewide", geography("Statewide, except the described portion of Carbon County", DISTRICTS, [CARBON_PORTION]), booklet.partridge.general, {}],
    ["carbon-county", {
      statedAs: "Portion of Carbon County (p. 9)",
      include: { ghas: [], gbhz: [], special: [CARBON_PORTION] },
      exclude: { ghas: [], special: [RESERVATION_CLOSED, CLOSED_TO_ALL] },
    }, booklet.partridge.carbon, { notes: [`Portion of Carbon County within the following boundary: ${booklet.partridge.carbon.description}`] }],
  ]) {
    for (const [who, appliesWhen, window] of [
      ["resident", RESIDENT, windows.resident],
      ["nonresident-private", NONRESIDENT_PRIVATE, windows.resident],
      ["nonresident-public", NONRESIDENT_PUBLIC, windows.publicLand],
    ]) {
      rules.push(base(`gray-partridge-${label}-${who}`, "species:gray-partridge", {
        regulatoryGroupId: label === "statewide" ? statewide : east,
        geography: where, appliesWhen,
        seasonLabel: `Partridge season${label === "carbon-county" ? " (portion of Carbon County)" : ""}`,
        seasonPhrase: window.statedAs, windows: [window], limits: partridgeLimits,
        sourceSection: "p. 9, Partridge", notes: ["Montana’s “Hungarian partridge” is the gray partridge.", ...(extra.notes ?? [])],
      }));
    }
  }
  rules.push(...closures("species:gray-partridge", "gray-partridge"));

  // Sharp-tailed grouse: east of the Divide only; closed west of it.
  const sharptailLimits = limits(booklet.sharptail.daily, booklet.sharptail.daily * 4, `${booklet.sharptail.daily} daily; possession limit four times the daily bag limit`);
  for (const [who, appliesWhen, window] of [
    ["resident", RESIDENT, booklet.sharptail.resident],
    ["nonresident-private", NONRESIDENT_PRIVATE, booklet.sharptail.resident],
    ["nonresident-public", NONRESIDENT_PUBLIC, booklet.sharptail.publicLand],
  ]) {
    rules.push(base(`sharp-tailed-grouse-east-${who}`, "species:sharp-tailed-grouse", {
      regulatoryGroupId: east, geography: geography(EAST, [EAST]), appliesWhen,
      seasonLabel: "Sharp-tailed grouse season", seasonPhrase: window.statedAs, windows: [window], limits: sharptailLimits,
      sourceSection: "p. 9, Sharp-tailed Grouse",
    }));
  }
  rules.push(base("sharp-tailed-grouse-west-closed", "species:sharp-tailed-grouse", {
    regulatoryGroupId: west, geography: geography(WEST, [WEST]), appliesWhen: {},
    seasonLabel: "West of the Continental Divide", seasonPhrase: "Closed West of the Continental Divide.",
    windows: [], declaredNoSeason: true, closureStatedAs: "Closed West of the Continental Divide (p. 9).", sourceSection: "p. 9, Sharp-tailed Grouse; p. 2, Highlights",
  }));
  rules.push(...closures("species:sharp-tailed-grouse", "sharp-tailed-grouse"));

  // Ring-necked pheasant: youth weekend, season licence, nonresident 3-day licence.
  const pheasantLimits = limits(booklet.pheasant.daily, booklet.pheasant.daily * 3, `${booklet.pheasant.daily} cock pheasants daily; possession limit three times the daily bag limit`);
  const [youth] = booklet.pheasant.youth;
  if (booklet.pheasant.youth.some((window) => window.opensIso !== youth.opensIso || window.closesIso !== youth.closesIso)) {
    throw new Error("The youth pheasant weekend now differs by residency or land; the rules must model it");
  }
  const pheasant = (slug, appliesWhen, window, label, extra = {}) => rules.push(base(`ring-necked-pheasant-${slug}`, "species:ring-necked-pheasant", {
    regulatoryGroupId: statewide, geography: geography("Statewide", DISTRICTS), appliesWhen,
    seasonLabel: label, seasonPhrase: window.statedAs, windows: [window], limits: pheasantLimits, sourceSection: "p. 10, Ring-necked Pheasant", ...extra,
  }));
  pheasant("youth", { HUNTER_AGE: "YOUTH_15_AND_UNDER" }, youth, "Youth-only pheasant weekend", { conditionIds: ["mt-upland-licence", "mt-landowner-permission", "mt-youth-pheasant"] });
  pheasant("resident", RESIDENT, booklet.pheasant.seasonLicence.resident, "Pheasant season");
  pheasant("nonresident-season-private", { ...NONRESIDENT_PRIVATE, LICENCE_TYPE: "SEASON" }, booklet.pheasant.seasonLicence.privateLand, "Pheasant season (season license)");
  pheasant("nonresident-season-public", { ...NONRESIDENT_PUBLIC, LICENCE_TYPE: "SEASON" }, booklet.pheasant.seasonLicence.publicLand, "Pheasant season (season license)");
  pheasant("nonresident-3-day-private", { ...NONRESIDENT_PRIVATE, LICENCE_TYPE: "THREE_DAY" }, booklet.pheasant.threeDay.privateLand, "Pheasant season (3-day license)");
  pheasant("nonresident-3-day-public", { ...NONRESIDENT_PUBLIC, LICENCE_TYPE: "THREE_DAY" }, booklet.pheasant.threeDay.publicLand, "Pheasant season (3-day license)");
  rules.push(...closures("species:ring-necked-pheasant", "ring-necked-pheasant"));

  const ids = new Set();
  for (const rule of rules) {
    if (ids.has(rule.id)) throw new Error(`Duplicate rule id ${rule.id}`);
    ids.add(rule.id);
    if (rule.limits === undefined) delete rule.limits;
  }
  return { rules, groups: [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

/* ── Build ──────────────────────────────────────────────────────────────── */

async function main() {
  const check = process.argv.includes("--check");
  recordSourcesFromArgs();
  const { sha256: pdfHash, pypdf, pages } = await fetchPdf(PDF_URL);
  const booklet = readBooklet(pages);
  const [restricted, uplandRestricted, portions, reservations] = await Promise.all([
    readLayer(`${FWP_BASE}/2`, "OBJECTID,PORTIONNAME"),
    readLayer(`${FWP_BASE}/33`, "OBJECTID,PORTIONNAME,REGYEAR"),
    readLayer(`${FWP_BASE}/32`, "OBJECTID,PORTIONNAME,REGYEAR"),
    readReservations(),
  ]);
  const overlays = buildOverlays(booklet, restricted, uplandRestricted, portions, reservations);
  const { rules, groups } = buildRules(booklet);

  const sourceHashes = { pdf: pdfHash, text: sha256(JSON.stringify(pages)), overlays: sha256(JSON.stringify(overlays.layers.map((layer) => layer.contentHash))) };
  const contentHash = sha256(JSON.stringify(sourceHashes));
  const previous = readPreviousBundle(BUNDLE);
  const retrievedAt = retrievedAtFor(previous, previous?.contentHash, contentHash, jurisdictionToday(TIME_ZONE));

  const bundle = {
    schemaVersion: 1,
    bundleId: "regulatory_bundle:us-mt-upland-2026",
    jurisdictionId: "jurisdiction:us-mt",
    sourceVersion: SOURCE_VERSION,
    retrievedAt,
    contentHash,
    certifiedPeriod: { from: "2026-03-01", to: "2027-02-28", reason: booklet.validity },
    absence: {
      meaning: "UNKNOWN",
      excludedCombination: "CLOSED",
      statedAs:
        "Montana's upland seasons are statewide. A combination the booklet gives no season to on a date — a nonresident on public land " +
        "before the tenth day, a sharp-tailed grouse west of the Divide — is closed by the booklet's own table.",
      section: "pp. 9–10",
      sourceId: SOURCE_ID,
    },
    officialUnitCount: DISTRICTS.length,
    units: DISTRICTS.map((designation) => ({ identifier: designation, zoneId: zoneId(designation) })),
    specialGeographies: [
      {
        id: RESERVATION_CLOSED, name: "Indian reservation closed to state-licensed upland game bird hunting", resolution: "OVERLAY",
        statedAs: RESERVATION_RULE, candidateAreas: DISTRICTS,
      },
      {
        id: CLOSED_TO_ALL, name: "Gates of the Mountains Game Preserve", resolution: "OVERLAY",
        statedAs: "Closed to all hunting", candidateAreas: [EAST],
      },
      {
        id: CARBON_PORTION, name: "Portion of Carbon County (partridge)", resolution: "OVERLAY",
        statedAs: `Portion of Carbon County within the following boundary: ${booklet.partridge.carbon.description}`, candidateAreas: [EAST],
      },
    ],
    sources: [
      {
        id: SOURCE_ID,
        authority: "Montana Fish, Wildlife & Parks",
        title: SOURCE_VERSION,
        url: PDF_URL,
        licence: "Published regulations; North Ground records facts — dates, areas, limits — with the page as provenance.",
        extractedWith: `pypdf ${pypdf}`,
        sourceHashes,
        conditions: [
          {
            id: "mt-upland-licence", sourceId: SOURCE_ID, sourceSection: "p. 2, License Chart",
            text: "An Upland Game Bird License, with the Base Hunting and Conservation licenses it requires, is needed. North Ground has not verified what you hold.",
          },
          {
            id: "mt-landowner-permission", sourceId: SOURCE_ID, sourceSection: "p. 4, Landowner Permission (MCA 87-6-415)",
            text: "Hunting on private property requires the permission of the landowner, the lessee, or their agents, whether or not the land is posted.",
          },
          {
            id: "mt-youth-pheasant", sourceId: SOURCE_ID, sourceSection: "p. 10, Ring-necked Pheasant",
            text: `${booklet.pheasant.youthCondition} Mentors for Apprentice Hunters must be at least 21 years of age.`,
          },
        ],
      },
    ],
    sourceRecords: [
      { id: SOURCE_ID, authority: "Montana Fish, Wildlife & Parks", title: SOURCE_VERSION, url: PDF_URL },
      { id: SOURCES.restricted, authority: "Montana Fish, Wildlife & Parks", title: "Hunting district restricted areas and portions (map service)", url: `${FWP_BASE}` },
      {
        id: SOURCES.reservations, authority: "U.S. Census Bureau", title: "TIGERweb Federal American Indian Reservations (January 1, 2026 vintage)", url: TIGER_RESERVATIONS,
        licence: "A work of the United States Government, not subject to copyright in the United States (17 U.S.C. § 105).",
      },
      { id: SOURCES.districts, authority: "Montana Fish, Wildlife & Parks", title: "Upland Game Bird Districts (map service)", url: `${FWP_BASE}/31` },
    ],
    limitations: [
      "This is a state-licensed recreational result. It does not describe hunting under tribal authority or under treaty or other rights, which North Ground does not evaluate.",
      "Reservation boundaries are the U.S. Census Bureau's; near a boundary, or on the Flathead and Crow reservations, the tribal government and Montana Fish, Wildlife & Parks decide what applies.",
      "Montana's district map is a guide to the Continental Divide line in its regulations. Near the Divide, confirm which side you are on.",
      "National parks, wildlife refuges, military land and other areas Montana lists as restricted have their own rules; North Ground does not state a season inside them.",
      "The Fish and Wildlife Commission reserves the authority to amend the seasons, limits and regulations during the year.",
      "Sage grouse, ptarmigan, turkey and falconry seasons are not encoded here.",
    ],
    groups,
    rules,
  };

  const certified = {
    jurisdictionId: "jurisdiction:us-mt",
    layerId: "layer:us-mt-upland",
    officialUnitCount: DISTRICTS.length,
    certifiedUnits: DISTRICTS,
  };

  writeOrCheck({ check, outputs: { [BUNDLE]: bundle, [OVERLAYS]: overlays, [CERTIFIED]: certified }, bundlePath: BUNDLE, contentHash, previous, label: "Montana upland 2026" });
  if (!check) {
    const bySpecies = {};
    for (const rule of rules) bySpecies[rule.speciesId] = (bySpecies[rule.speciesId] ?? 0) + 1;
    console.log(`${rules.length} rules in ${groups.length} groups:`, bySpecies);
  }
}

main().catch((error) => {
  console.error(`Montana upland build failed: ${error.message}`);
  process.exit(1);
});
