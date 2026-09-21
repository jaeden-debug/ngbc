#!/usr/bin/env node
/**
 * Build North Ground's Manitoba regulatory bundle from the authority.
 *
 *   node scripts/build-manitoba-regulations.mjs           # rebuild and report
 *   node scripts/build-manitoba-regulations.mjs --check   # exit 2 if a source moved
 *   node scripts/build-manitoba-regulations.mjs --check --save-sources <dir>
 *                                     # also keep every source read, for drills
 *   node scripts/build-manitoba-regulations.mjs --check --sources <dir>
 *                                     # read only those recordings, never the network
 *
 * A replayed build only ever checks. Sources edited for a drill must never be
 * able to become the committed bundle.
 *
 * Source hierarchy, highest first, and what each is used for:
 *
 *   1. The Wildlife Act regulations, as consolidated by the King's Printer:
 *        M.R. 165/91  Hunting Seasons and Bag Limits — every season, licence,
 *                     equipment and bag limit encoded here (CONTROLLING)
 *        M.R. 220/86  Hunting Areas and Zones — what a Game Hunting Area and a
 *                     game bird hunting zone ARE (CONTROLLING)
 *        M.R. 351/87  General Hunting — hunting hours, hunter orange
 *        M.R. 171/2001 Designation of Wildlife Lands — the Oak Hammock
 *                     Waterfowl Control Area's legal description
 *   2. The 2026 Manitoba Hunting Guide — an official summary that says of
 *      itself it "is neither a legal document nor a complete collection of
 *      wildlife regulations". Used only to cross-check what was built.
 *   3. Official explanatory pages — the province's CWD page, for the mandatory
 *      sampling zone, cross-checked against the guide and the CWD layer.
 *   4. Official GIS — Game Hunting Area, CWD-zone, wildlife-lands and
 *      lands-closed layers. Indicative: they locate a point; the written law
 *      controls.
 *
 * The bundle is generated, never hand-edited. Parsing is strict: a row, term,
 * footnote or area this script does not recognise aborts the build.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { anchorToLicenceYear } from "../src/lib/hunt/regulatory/season.ts";
import { readPreviousBundle, retrievedAtFor, jurisdictionToday } from "./ontario-source.mjs";
import {
  GHA38_MACDONALD, MANITOBA_TIME_ZONE, NAMED_GEOGRAPHIES,
  classifyRestriction, compareAreas, consolidationVersion, cwdAreasFromPage, decodeEntities, definedGameHuntingAreas,
  fetchBytes, fetchJson, fetchText, gameBirdZones, lawBody, mentionedAreas, parseBirdLimit,
  parseEquipment, parseGeography, parseSeasonCell, requireProvision, scheduleParts, scheduleTable,
  section10_3, sha256, setRecordedSources, diffConditionalBundles, formatConditionalDiff,
} from "./manitoba-source.mjs";

const OUTPUT = "content/regulatory/ca-mb-2026.json";
const CERTIFIED_UNITS_OUTPUT = "content/regulatory/ca-mb-certified-units.json";
const CROSSCHECK = "content/regulatory/sources/ca-mb-hunting-guide-2026-crosscheck.json";
const OVERLAYS_OUTPUT = "content/regulatory/ca-mb-overlays.json";

const ARCGIS = "https://services.arcgis.com/mMUesHYPkXjaFGfS/arcgis/rest/services";
const URLS = {
  seasons: "https://web2.gov.mb.ca/laws/regs/current/165-91.php",
  areas: "https://web2.gov.mb.ca/laws/regs/current/220-86.php",
  general: "https://web2.gov.mb.ca/laws/regs/current/351-87.php",
  wildlifeLands: "https://web2.gov.mb.ca/laws/regs/current/171-2001.php",
  guide: "https://www.gov.mb.ca/nrnd/fish-wildlife/pubs/fish_wildlife/huntingguide.pdf",
  cwdPage: "https://www.gov.mb.ca/nrnd/fish-wildlife/wildlife/cwd.html",
  ghaService: `${ARCGIS}/Manitoba_Game_Hunting_Areas/FeatureServer/0`,
  cwdLayer: `${ARCGIS}/mandatory_(2)/FeatureServer/0`,
  closedLands: `${ARCGIS}/Lands_Closed_to_Hunting/FeatureServer/0`,
  refuges: `${ARCGIS}/Manitoba_Wildlife_Lands/FeatureServer/0`,
  scas: `${ARCGIS}/Manitoba_Wildlife_Lands/FeatureServer/1`,
  wmas: `${ARCGIS}/Manitoba_Wildlife_Lands/FeatureServer/2`,
};

/**
 * Land whose own published restrictions can close or limit a hunt at a point,
 * whatever the season table says: refuges, special conservation areas, WMAs and
 * lands closed to hunting. Each layer's restriction text is classified here, at
 * build time, into a reviewed catalogue; at run time a feature is only looked up.
 */
const OVERLAY_LAYERS = [
  { key: "closed", url: URLS.closedLands, nameField: "Name", textField: "Restric", regulationField: "Reg", sourceId: "source:ca-mb-lands-closed-to-hunting-service" },
  { key: "refuges", url: URLS.refuges, nameField: "NAME", textField: "HUNTING_RESTRICTIONS", typeField: "TYPE", sourceId: "source:ca-mb-wildlife-lands-service" },
  { key: "scas", url: URLS.scas, nameField: "NAME", textField: "RESTRICTIONS", sourceId: "source:ca-mb-wildlife-lands-service" },
  { key: "wmas", url: URLS.wmas, nameField: "NAME_E", textField: "HUNTING_RESTRICTIONS", sourceId: "source:ca-mb-wildlife-lands-service" },
];

const SPECIES = {
  "ruffed grouse": "species:ruffed-grouse",
  "spruce grouse": "species:spruce-grouse",
  "sharp-tailed grouse": "species:sharp-tailed-grouse",
};
const WHITE_TAILED_DEER = "species:white-tailed-deer";

/**
 * Each licence part of the schedules, by the heading the regulation prints.
 * A part carrying a certified species that is not listed here stops the build:
 * a new licence could open seasons this bundle would silently miss.
 */
const LICENCE_PARTS = {
  SchA: {
    "MANITOBA RESIDENT GAME BIRD AND MANITOBA RESIDENT DEER AND GAME BIRD LICENCE (YOUTH)": {
      licence: "MB_RESIDENT_GAME_BIRD", residency: "MANITOBA_RESIDENT", section: "s. 5(1)",
    },
    "CANADIAN RESIDENT GAME BIRD LICENCE": {
      licence: "CANADIAN_RESIDENT_GAME_BIRD", residency: "CANADIAN_RESIDENT", section: "s. 5(1)",
    },
    "NON-CANADIAN RESIDENT UPLAND GAME BIRD LICENCE": {
      licence: "NON_CANADIAN_UPLAND_GAME_BIRD", residency: "NON_CANADIAN_RESIDENT", section: "s. 5(2)",
    },
  },
  SchB: {
    "MANITOBA RESIDENT GENERAL WHITE-TAILED DEER LICENCE OR WHITE-TAILED DEER AND GAME BIRD LICENCE (YOUTH)": {
      licence: "MB_RESIDENT_GENERAL_WTD", residency: "MANITOBA_RESIDENT", section: "s. 8", bag: "ONE",
    },
    "MANITOBA RESIDENT SECOND WHITE-TAILED DEER LICENCE": {
      licence: "MB_RESIDENT_SECOND_WTD", residency: "MANITOBA_RESIDENT", section: "s. 9", bag: "ANTLERLESS",
      conditions: ["ca-mb-wtd-second-licence-prerequisite"],
    },
    "MANITOBA RESIDENT THIRD WHITE-TAILED DEER LICENCE": {
      licence: "MB_RESIDENT_THIRD_WTD", residency: "MANITOBA_RESIDENT", section: "s. 10", bag: "ANTLERLESS",
      conditions: ["ca-mb-wtd-third-licence-prerequisite"],
    },
    "CANADIAN RESIDENT GENERAL WHITE-TAILED DEER LICENCE": {
      licence: "CANADIAN_RESIDENT_GENERAL_WTD", residency: "CANADIAN_RESIDENT", section: "s. 10.1", bag: "ONE",
    },
    "NON-CANADIAN RESIDENT GENERAL WHITE-TAILED DEER LICENCE": {
      licence: "NON_CANADIAN_GENERAL_WTD", residency: "NON_CANADIAN_RESIDENT", section: "s. 10.2(1)", bag: "ONE",
      conditions: ["ca-mb-non-canadian-outfitter"],
    },
    "NON-CANADIAN RESIDENT ARCHERY WHITE-TAILED DEER LICENCE": {
      licence: "NON_CANADIAN_ARCHERY_WTD", residency: "NON_CANADIAN_RESIDENT", section: "s. 10.2(2)", bag: "ONE",
      conditions: ["ca-mb-non-canadian-outfitter"],
    },
    "NON-CANADIAN RESIDENT MUZZLELOADER WHITE-TAILED DEER LICENCE": {
      licence: "NON_CANADIAN_MUZZLELOADER_WTD", residency: "NON_CANADIAN_RESIDENT", section: "s. 10.2(3)", bag: "ONE",
      conditions: ["ca-mb-non-canadian-outfitter"],
    },
  },
};

/** Footnotes the deer table attaches to an equipment cell, and what each narrows. */
const FOOTNOTE_EFFECTS = {
  "Under age 18 only.": { HUNTER_AGE: "UNDER_18" },
};

/** Guide season names for the regulation's equipment rows, for the cross-check. */
function guideSeasonType(equipment, youth) {
  if (equipment === "Archery") return "Archery";
  if (equipment === "Muzzleloader and Crossbow") return youth ? "Youth Muzzleloader" : "Muzzleloader";
  if (equipment === "All equipment") return "General (rifle)";
  if (equipment === "Shotgun and Muzzleloader") return "Shotgun and Muzzleloader";
  throw new Error(`No guide season for "${equipment}"`);
}

const RESIDENCIES = ["MANITOBA_RESIDENT", "CANADIAN_RESIDENT", "NON_CANADIAN_RESIDENT"];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const short = (value) => sha256(value).slice(7, 15);
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const zoneId = (area) => `management_zone:ca-mb-gha-${area.toLowerCase()}`;

function visibleText(html) {
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

async function arcgisQuery(layer, parameters) {
  return await fetchJson(`${layer}/query?${new URLSearchParams({ f: "json", ...parameters })}`);
}

/** Areas whose polygons intersect an envelope, asked of the authority's own service. */
async function areasIntersecting(envelope) {
  const payload = await arcgisQuery(URLS.ghaService, {
    geometry: envelope.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: "GHA", returnGeometry: "false",
  });
  return [...new Set((payload.features ?? []).map((feature) => String(feature.attributes.GHA ?? "").trim().toUpperCase()).filter(Boolean))]
    .sort(compareAreas);
}

async function featureExtent(layer, where) {
  const payload = await arcgisQuery(layer, { where, returnExtentOnly: "true", returnCountOnly: "true", outSR: "4326" });
  if (!payload.count) throw new Error(`No feature in ${layer} matches ${where}`);
  const e = payload.extent;
  return { count: payload.count, envelope: [e.xmin, e.ymin, e.xmax, e.ymax].map((value) => Number(value.toFixed(6))) };
}

/* ── Main ────────────────────────────────────────────────────────────────── */

async function main() {
  const checkOnly = process.argv.includes("--check");
  const flag = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
  if (flag("--sources")) {
    if (!checkOnly) throw new Error("--sources replays recorded copies and may only be used with --check");
    setRecordedSources("replay", flag("--sources"));
  } else if (flag("--save-sources")) {
    setRecordedSources("save", flag("--save-sources"));
  }
  const today = jurisdictionToday(MANITOBA_TIME_ZONE);
  const previous = readPreviousBundle(OUTPUT);
  const crossCheck = JSON.parse(readFileSync(CROSSCHECK, "utf8"));

  /* ── Read every source ─────────────────────────────────────────────── */

  const [seasonsHtml, areasHtml, generalHtml, wildlifeLandsHtml, guideBytes, cwdHtml] = await Promise.all([
    fetchText(URLS.seasons), fetchText(URLS.areas), fetchText(URLS.general), fetchText(URLS.wildlifeLands),
    fetchBytes(URLS.guide), fetchText(URLS.cwdPage),
  ]);

  const seasonsVersion = consolidationVersion(seasonsHtml);
  const areasVersion = consolidationVersion(areasHtml);
  const generalVersion = consolidationVersion(generalHtml);
  const wildlifeLandsVersion = consolidationVersion(wildlifeLandsHtml);
  const seasonsBody = lawBody(seasonsHtml);
  const areasBody = lawBody(areasHtml);
  const generalBody = lawBody(generalHtml);
  const wildlifeLandsBody = lawBody(wildlifeLandsHtml);

  const guideHash = sha256(guideBytes);
  if (guideHash !== crossCheck.source.sha256) {
    const message = `The 2026 guide has changed (${guideHash}); ${CROSSCHECK} was transcribed from ${crossCheck.source.sha256} and must be redone before it can cross-check anything.`;
    if (checkOnly) { console.error(message); process.exit(2); }
    throw new Error(message);
  }

  /* ── What a Game Hunting Area is ───────────────────────────────────── */

  const ordered = definedGameHuntingAreas(areasHtml);
  const serviceMeta = await fetchJson(`${URLS.ghaService}?f=json`);
  const serviceRows = await arcgisQuery(URLS.ghaService, { where: "1=1", outFields: "GHA", returnGeometry: "false" });
  const serviceAreas = (serviceRows.features ?? []).map((feature) => String(feature.attributes.GHA ?? "").trim().toUpperCase());
  const namedServiceAreas = serviceAreas.filter(Boolean).sort(compareAreas);
  if (JSON.stringify(namedServiceAreas) !== JSON.stringify([...ordered].sort(compareAreas))) {
    throw new Error("The official GHA layer's designations no longer match the areas M.R. 220/86 defines; review before rebuilding");
  }

  /* Coarse extents per area, used only to decide which areas a game bird zone
     line or a named place can reach. Exact membership is decided per point. */
  const extents = new Map();
  for (let offset = 0; offset < serviceRows.features.length; offset += 20) {
    const page = await arcgisQuery(URLS.ghaService, {
      where: "1=1", outFields: "GHA", returnGeometry: "true", outSR: "4326", maxAllowableOffset: "0.02",
      resultOffset: String(offset), resultRecordCount: "20", orderByFields: "OBJECTID",
    });
    for (const feature of page.features ?? []) {
      const area = String(feature.attributes.GHA ?? "").trim().toUpperCase();
      if (!area) continue;
      let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const ring of feature.geometry.rings) for (const [x, y] of ring) {
        west = Math.min(west, x); east = Math.max(east, x); south = Math.min(south, y); north = Math.max(north, y);
      }
      extents.set(area, { west, south, east, north });
    }
  }
  if (extents.size !== ordered.length) throw new Error(`Read extents for ${extents.size} of ${ordered.length} areas`);

  /* ── Game bird hunting zones (M.R. 220/86 s. 1.1) ──────────────────── */

  const gbhz = gameBirdZones(areasBody);
  for (const area of gbhz.zone4Areas) if (!ordered.includes(area)) throw new Error(`GBHZ 4 names undefined area ${area}`);

  /* The zone 2/3 line runs along the 53rd parallel, then south-east along Lake
     Winnipegosis to the north limit of Township 43, then east. Township lines
     are six miles apart northward from the 49th parallel, so the north limit of
     Township 43 lies at least 43 × 6 miles (≈ 3.73°) north of it — above
     52.73°N — and every part of the line lies between that and 53°N. North
     Ground holds no survey geometry for the line, so a point in the band that
     margin allows is left undetermined rather than assigned. */
  const zoneLine = { southOfLineBelow: 52.7, northOfLineAbove: 53.05 };

  const possibleZones = (area) => {
    if (gbhz.zone4Areas.includes(area)) return [4];
    const box = extents.get(area);
    const zones = new Set();
    const inZone1Region = (lat, lon) => lat > gbhz.zone1.northOfLatitude || (lon > gbhz.zone1.eastOfLongitude && lat > gbhz.zone1.andNorthOfLatitude);
    const corners = [[box.north, box.east], [box.north, box.west], [box.south, box.east], [box.south, box.west]];
    const anyZone1 = box.north > gbhz.zone1.northOfLatitude || (box.east > gbhz.zone1.eastOfLongitude && box.north > gbhz.zone1.andNorthOfLatitude);
    const allZone1 = corners.every(([lat, lon]) => inZone1Region(lat, lon)) && box.south > gbhz.zone1.andNorthOfLatitude &&
      (box.south > gbhz.zone1.northOfLatitude || box.west > gbhz.zone1.eastOfLongitude);
    if (anyZone1) zones.add(1);
    if (!allZone1) {
      if (box.north > zoneLine.southOfLineBelow) zones.add(2);
      if (box.south < zoneLine.northOfLineAbove) zones.add(3);
    }
    return [...zones].sort();
  };
  const zonesByArea = Object.fromEntries(ordered.map((area) => [area, possibleZones(area)]));

  /* ── Named places the tables carve out ─────────────────────────────── */

  const oakHammockStatedAs = requireProvision(
    wildlifeLandsBody,
    "9(2) In Township 13, Range 3 East and being the east half of Section 32, Sections 33 and 34 and the west half of Section 35; in Township 14, Range 3 East",
    "M.R. 171/2001 s. 9(2)",
  );
  const oakHammockMarsh = await featureExtent(URLS.wmas, "NAME_E = 'Oak Hammock Marsh Wildlife Management Area'");
  const cfbShilo = await featureExtent(URLS.closedLands, "Name = 'Canadian Forces Base Shilo'");
  const whiteshell = await featureExtent(URLS.refuges, "NAME = 'Whiteshell' AND TYPE = 'Game Bird Refuge'");
  const macdonald = await featureExtent(URLS.closedLands, "Name = 'Portion of GHA 38 in RM of MacDonald'");
  /* The waterfowl control area is defined by sections of Township 13-14, Range
     3 East — a block about 19 km by 10 km that contains the Oak Hammock Marsh
     WMA. Its candidate areas are those within 0.15° of the WMA, which covers
     that whole block with room to spare. */
  const pad = (envelope, by) => [envelope[0] - by, envelope[1] - by, envelope[2] + by, envelope[3] + by].map((value) => Number(value.toFixed(6)));

  const specialGeographies = [
    {
      id: NAMED_GEOGRAPHIES["CFB Shilo"],
      name: "Canadian Forces Base Shilo",
      statedAs: "CFB Shilo",
      resolution: "OVERLAY",
      overlay: { layer: URLS.closedLands, where: "Name = 'Canadian Forces Base Shilo'", features: cfbShilo.count },
      envelope: cfbShilo.envelope,
      candidateAreas: await areasIntersecting(cfbShilo.envelope),
      sourceId: "source:ca-mb-lands-closed-to-hunting-service",
    },
    {
      id: NAMED_GEOGRAPHIES["Oak Hammock Waterfowl Control Area"],
      name: "Oak Hammock Waterfowl Control Area",
      statedAs: "Oak Hammock Waterfowl Control Area",
      resolution: "UNRESOLVED",
      legalDescription: oakHammockStatedAs,
      reason: "Defined only by a legal land description (M.R. 171/2001 s. 9(2)). No official polygon for it has been found, so North Ground cannot place a point inside or outside it.",
      envelope: pad(oakHammockMarsh.envelope, 0.15),
      envelopeDerivation: "The area is sections of Township 13-14, Range 3 East: a block of at most about 10 km east-west and 20 km north-south that contains the Oak Hammock Marsh WMA (official Wildlife Lands layer). The WMA's extent padded by 0.15° on every side therefore contains the whole area; a point outside that envelope is certainly outside it.",
      candidateAreas: await areasIntersecting(pad(oakHammockMarsh.envelope, 0.15)),
      sourceId: "source:ca-mb-designation-of-wildlife-lands-regulation",
    },
    {
      id: NAMED_GEOGRAPHIES["Whiteshell Game Bird Refuge"],
      name: "Whiteshell Game Bird Refuge",
      statedAs: "Whiteshell Game Bird Refuge",
      resolution: "OVERLAY",
      overlay: { layer: URLS.refuges, where: "NAME = 'Whiteshell' AND TYPE = 'Game Bird Refuge'", features: whiteshell.count },
      envelope: whiteshell.envelope,
      candidateAreas: await areasIntersecting(whiteshell.envelope),
      sourceId: "source:ca-mb-wildlife-lands-service",
    },
    {
      id: GHA38_MACDONALD,
      name: "Those parts of GHA 38 within the R.M. of Macdonald",
      statedAs: "those parts of area 38 found within the R.M. of Macdonald",
      resolution: "OVERLAY",
      overlay: { layer: URLS.closedLands, where: "Name = 'Portion of GHA 38 in RM of MacDonald'", features: macdonald.count },
      envelope: macdonald.envelope,
      candidateAreas: ["38"],
      sourceId: "source:ca-mb-lands-closed-to-hunting-service",
    },
  ];
  const specialById = new Map(specialGeographies.map((entry) => [entry.id, entry]));
  if (!(await areasIntersecting(macdonald.envelope)).includes("38")) throw new Error("The GHA 38 portion in the R.M. of Macdonald no longer intersects GHA 38");

  /* ── CWD mandatory surveillance zone: three official statements ────── */

  const cwdPage = cwdAreasFromPage(cwdHtml);
  const cwdLayerRows = await arcgisQuery(URLS.cwdLayer, { where: "1=1", outFields: "GHA", returnGeometry: "false" });
  const cwdLayerMeta = await fetchJson(`${URLS.cwdLayer}?f=json`);
  const cwdLayerAreas = (cwdLayerRows.features ?? []).map((feature) => String(feature.attributes.GHA).trim().toUpperCase()).sort(compareAreas);
  const cwdAreas = [...cwdPage.areas].sort(compareAreas);
  const cwdGuide = [...crossCheck.cwdMandatorySampling.areas].sort(compareAreas);
  if (JSON.stringify(cwdAreas) !== JSON.stringify(cwdGuide) || JSON.stringify(cwdAreas) !== JSON.stringify(cwdLayerAreas)) {
    throw new Error(
      `The CWD mandatory zone disagrees between sources: page [${cwdAreas}], guide [${cwdGuide}], layer [${cwdLayerAreas}]`,
    );
  }
  specialGeographies.push({
    id: "special_geography:ca-mb-cwd-mandatory-surveillance-zone",
    name: "CWD mandatory surveillance zone",
    statedAs: cwdPage.statement,
    resolution: "AREA_SET",
    areas: cwdAreas,
    agreement: "The province's CWD page, the 2026 guide (p. 5) and the official CWD surveillance-zone layer list the same areas.",
    sourceId: "source:ca-mb-cwd-program",
  });

  /* ── Body provisions encoded as conditions ─────────────────────────── */

  const provisions = {
    exhaustive: requireProvision(seasonsBody, "3 Except where this regulation provides otherwise, the holder of a hunting licence may only hunt (a) the species of wild animal named in the licence; (b) using the type of equipment stated in the licence; and (c) in an area designated in this regulation for such a species, licence and equipment type.", "M.R. 165/91 s. 3"),
    inclusive: requireProvision(seasonsBody, "2 All dates and all references to areas by means of numbers in this regulation are inclusive.", "M.R. 165/91 s. 2"),
    huntingYear: requireProvision(seasonsBody, "\"hunting year\" means the period beginning on April 1 and ending March 31;", "M.R. 165/91 s. 1"),
    archery: requireProvision(seasonsBody, "3.3 When the word \"archery\" is used in the name of a particular hunting licence or in a column of a Schedule, it means that a long, recurved or compound bow may be used", "M.R. 165/91 s. 3.3"),
    allEquipment: requireProvision(seasonsBody, "3.4 When the term \"all equipment\" is used in a column of a Schedule, it means a rifle, shotgun, muzzleloader, crossbow or a long, recurved or compound bow may be used", "M.R. 165/91 s. 3.4"),
    second: requireProvision(seasonsBody, "9(3) The holder of a Manitoba resident second white-tailed deer licence shall not hunt white-tailed deer under authority of that licence unless the holder is also in possession of a Manitoba resident general white-tailed deer licence that is valid during the period and for the area in which the second white-tailed deer licence is being used.", "M.R. 165/91 s. 9(3)"),
    third: requireProvision(seasonsBody, "10(3) The holder of a Manitoba resident third white-tailed deer licence shall not hunt white-tailed deer under authority of that licence unless the holder is also in possession of a Manitoba resident general white-tailed deer licence and a Manitoba resident second white-tailed deer licence that are valid during the period and for the area in which the third white-tailed deer licence is being used.", "M.R. 165/91 s. 10(3)"),
    bagOne: requireProvision(seasonsBody, "11(1) The bag limit is one white-tailed deer for the following types of white-tailed deer hunting licences:", "M.R. 165/91 s. 11(1)"),
    bagAntlerless: requireProvision(seasonsBody, "11(2) The bag limit for a Manitoba resident second white-tailed deer licence and a Manitoba resident third white-tailed deer licence is one antlerless white-tailed deer.", "M.R. 165/91 s. 11(2)"),
    antlerless: requireProvision(seasonsBody, "\"antlerless\" means without antlers or with antlers less than 10 centimetres (4 inches) in length;", "M.R. 165/91 s. 1"),
    crossbowPermit: requireProvision(seasonsBody, "29.1 Despite any other provision in this regulation, the holder of a disabled crossbow permit who holds a hunting licence that allows him or her to hunt using a long, recurved or compound bow may also use a crossbow when hunting under authority of that licence.", "M.R. 165/91 s. 29.1"),
    hours: requireProvision(generalBody, "3 No person shall hunt wildlife between 1/2 hour after sunset and 1/2 hour before sunrise of the following day.", "M.R. 351/87 s. 3"),
    orangeBigGame: requireProvision(generalBody, "10(1) No person shall hunt, dress or retrieve a big game animal or coyote or act as a guide or otherwise accompany a person hunting, dressing or retrieving a big game animal or a coyote unless the person is wearing the following items that are not covered in any way:", "M.R. 351/87 s. 10(1)"),
    orangeArchers: requireProvision(generalBody, "(a) archers hunting during an archery season;", "M.R. 351/87 s. 10(2)(a)"),
    orangeUpland: requireProvision(generalBody, "10(3) No person shall hunt upland game birds during the general deer season unless the person is wearing the following items that are not covered in any way:", "M.R. 351/87 s. 10(3)"),
    uplandCentrefire: requireProvision(generalBody, "(k) hunt or kill upland game birds with a centrefire rifle, shotgun or muzzleloading firearm loaded with a single projectile;", "M.R. 351/87 s. 6(k)"),
  };
  const s10_3 = section10_3(seasonsBody);

  /* ── The licence year this consolidation governs ───────────────────── */

  const licenceYearStart = { month: 4, day: 1 };
  const effective = seasonsVersion.inEffectSince;
  const startYear = Number(effective.slice(0, 4)) - (effective.slice(5) < "04-01" ? 1 : 0);
  const certifiedPeriod = { from: effective, to: `${startYear + 1}-03-31` };
  const anchor = (window) => ({ ...anchorToLicenceYear(window, startYear, licenceYearStart), statedAs: window.statedAs });

  const checkFollowing = (windows) => {
    for (const window of windows) {
      const resolved = anchor(window);
      if (window.followingYear && !resolved.crossesYear) throw new Error(`"${window.statedAs}" says the following year but does not cross it`);
    }
  };

  /* ── Schedules ─────────────────────────────────────────────────────── */

  const scheduleA = scheduleParts(scheduleTable(seasonsHtml, "SchA"), 4);
  const scheduleB = scheduleParts(scheduleTable(seasonsHtml, "SchB"), 3);
  const scheduleC = scheduleParts(scheduleTable(seasonsHtml, "SchC"), 3);
  const scheduleD = scheduleParts(scheduleTable(seasonsHtml, "SchD"), 3);
  const scheduleText = (id) => scheduleTable(seasonsHtml, id).rows.map((row) => row.map((cell) => cell.text).join(" | ")).join("\n");

  const groups = new Map();
  const rules = [];

  function groupFor(geography) {
    const key = geography.statedAs;
    if (groups.has(key)) return groups.get(key);
    const full = new Set();
    const partial = new Set();
    for (const area of ordered) {
      let state = "OUT";
      if (geography.include.ghas.includes(area)) state = "FULL";
      if (geography.include.gbhz.length) {
        const zones = zonesByArea[area];
        const inside = zones.filter((zone) => geography.include.gbhz.includes(zone));
        state = !inside.length ? "OUT" : inside.length === zones.length ? "FULL" : "PARTIAL";
      }
      for (const special of geography.include.special) {
        if (specialById.get(special)?.candidateAreas.includes(area)) state = state === "FULL" ? "FULL" : "PARTIAL";
      }
      if (state !== "OUT" && geography.exclude.ghas.includes(area)) state = "OUT";
      if (state === "FULL") {
        for (const special of geography.exclude.special) {
          if (specialById.get(special)?.candidateAreas.includes(area)) state = "PARTIAL";
        }
      }
      if (state === "FULL") full.add(area);
      if (state === "PARTIAL") partial.add(area);
    }
    const group = {
      id: `regulatory_group:ca-mb-2026-${short(key)}`,
      label: key,
      officialSpec: key,
      sourceVersion: seasonsVersion.lastAmendment,
      zoneIds: [...full].sort(compareAreas).map(zoneId),
      officialIdentifiers: [...full].sort(compareAreas),
      partialZoneIds: [...partial].sort(compareAreas).map(zoneId),
      partialIdentifiers: [...partial].sort(compareAreas),
    };
    groups.set(key, group);
    return group;
  }

  /* Game birds: Schedule A, parts A–C, the three grouse. */
  for (const part of scheduleA) {
    const licence = LICENCE_PARTS.SchA[part.heading];
    const carriesCertified = part.rows.some((row) => SPECIES[row[0].text]);
    if (!licence) {
      if (carriesCertified) throw new Error(`Schedule A part ${part.letter} ("${part.heading}") carries grouse but is not mapped to a licence`);
      continue;
    }
    for (const row of part.rows) {
      const speciesId = SPECIES[row[0].text];
      if (!speciesId) continue;
      const geography = parseGeography(row[1].text, ordered);
      const windows = parseSeasonCell(row[2].text);
      checkFollowing(windows);
      const limit = parseBirdLimit(row[3].text);
      const group = groupFor(geography);
      rules.push({
        id: `regulatory_rule:ca-mb-2026-${slug(speciesId.slice(8))}-${part.letter.toLowerCase()}-${short(geography.statedAs)}`,
        speciesId,
        regulatoryGroupId: group.id,
        geography,
        appliesWhen: { RESIDENCY: licence.residency, LICENCE_TYPE: licence.licence },
        seasonLabel: "Open season",
        seasonPhrase: row[2].text.replace(/\n/g, "; "),
        windows: windows.map(anchor),
        declaredNoSeason: false,
        limits: { daily: limit.daily, possession: limit.possession, combined: false, statedAs: limit.statedAs },
        conditionIds: ["ca-mb-upland-hunter-orange", "ca-mb-upland-no-single-projectile"],
        caveats: [],
        notes: [],
        disputes: [],
        sourceId: "source:ca-mb-hunting-seasons-regulation",
        sourceSection: `Schedule A, Part ${part.letter}; ${licence.section}`,
        sourceVersion: seasonsVersion.lastAmendment,
        reviewStatus: "VERIFIED",
      });
    }
  }

  /* White-tailed deer: every part of Schedule B. */
  for (const part of scheduleB) {
    const licence = LICENCE_PARTS.SchB[part.heading];
    if (!licence) throw new Error(`Schedule B part ${part.letter} ("${part.heading}") is not mapped to a licence`);
    for (const row of part.rows) {
      const geography = parseGeography(row[0].text, ordered);
      const equipment = parseEquipment(row[1].text);
      const narrowing = {};
      for (const marker of row[1].footnotes) {
        const note = part.footnotes[marker];
        const effect = note && FOOTNOTE_EFFECTS[note];
        if (!effect) throw new Error(`Unrecognised footnote ${marker} ("${note}") on "${row[1].text}"`);
        Object.assign(narrowing, effect);
      }
      const windows = parseSeasonCell(row[2].text);
      checkFollowing(windows);
      const group = groupFor(geography);
      const youth = narrowing.HUNTER_AGE === "UNDER_18";
      const archery = row[1].text === "Archery";
      rules.push({
        id: `regulatory_rule:ca-mb-2026-white-tailed-deer-${part.letter.toLowerCase()}-${short(geography.statedAs)}-${slug(row[1].text)}${youth ? "-youth" : ""}`,
        speciesId: WHITE_TAILED_DEER,
        regulatoryGroupId: group.id,
        geography,
        appliesWhen: {
          RESIDENCY: licence.residency,
          LICENCE_TYPE: licence.licence,
          ...narrowing,
          permittedImplements: equipment.methods,
        },
        equipmentStatedAs: row[1].text,
        seasonLabel: youth ? `${equipment.label} (under age 18 only)` : equipment.label,
        seasonPhrase: row[2].text.replace(/\n/g, "; "),
        windows: windows.map(anchor),
        declaredNoSeason: false,
        limits: licence.bag === "ANTLERLESS"
          ? { bag: 1, animalClass: "ANTLERLESS", statedAs: "one antlerless white-tailed deer", section: "s. 11(2)" }
          : { bag: 1, animalClass: "ANY", statedAs: "one white-tailed deer", section: "s. 11(1)" },
        conditionIds: [
          ...(licence.conditions ?? []),
          ...(archery ? ["ca-mb-archery-no-hunter-orange-exemption-note"] : ["ca-mb-big-game-hunter-orange"]),
          ...(row[1].text === "Shotgun and Muzzleloader" ? ["ca-mb-landowner-permission-shotgun-muzzleloader"] : []),
          ...(archery ? ["ca-mb-disabled-crossbow-permit"] : []),
        ],
        caveats: [],
        notes: [],
        disputes: [],
        sourceId: "source:ca-mb-hunting-seasons-regulation",
        sourceSection: `Schedule B, Part ${part.letter}; ${licence.section}`,
        sourceVersion: seasonsVersion.lastAmendment,
        reviewStatus: "VERIFIED",
      });
    }
  }

  /* No two rows of one licence part may give the same area, equipment and age
     twice: that would be the regulation contradicting itself. */
  const seen = new Map();
  for (const rule of rules) {
    const areas = [...groups.get(rule.geography.statedAs).officialIdentifiers, ...groups.get(rule.geography.statedAs).partialIdentifiers];
    for (const area of areas) {
      const key = JSON.stringify([rule.speciesId, rule.appliesWhen.LICENCE_TYPE, rule.appliesWhen.HUNTER_AGE ?? "", rule.equipmentStatedAs ?? "", area, rule.geography.include.special]);
      const prior = seen.get(key);
      if (prior && JSON.stringify(prior.geography.include.gbhz) === JSON.stringify(rule.geography.include.gbhz)) {
        throw new Error(`${rule.id} and ${prior.id} both address GHA ${area} for the same licence and equipment`);
      }
      seen.set(key, rule);
    }
  }

  /* ── Section 10.3: when a deer hunter needs a moose or elk licence ─── */

  const seasonsNaming = (schedule, areas, label) => {
    const out = new Map(areas.map((area) => [area, { windows: [], caveats: new Set() }]));
    for (const part of schedule) {
      for (const row of part.rows) {
        const mentioned = mentionedAreas(row[0].text, ordered);
        for (const area of areas) {
          if (!mentioned.areas.includes(area) && !mentioned.partial.includes(area)) continue;
          const entry = out.get(area);
          for (const window of parseSeasonCell(row[1].text)) entry.windows.push({ ...anchor(window), licence: part.heading });
          for (const caveat of mentioned.caveats) {
            if (caveat.area && caveat.area !== area) continue;
            entry.caveats.add(`The ${label.toLowerCase()} season row "${mentioned.statedAs}" reads: ${caveat.text}. North Ground does not hold that boundary.`);
          }
        }
      }
    }
    return out;
  };
  const mooseSeasons = seasonsNaming(scheduleD, s10_3.moose, "Moose");
  const elkSeasons = seasonsNaming(scheduleC, s10_3.elk, "Elk");

  const mergeWindows = (windows) => {
    const sorted = windows.map(({ opensIso, closesIso }) => ({ opensIso, closesIso })).sort((a, b) => a.opensIso.localeCompare(b.opensIso));
    const merged = [];
    for (const window of sorted) {
      const last = merged.at(-1);
      if (last && window.opensIso <= last.closesIso) { if (window.closesIso > last.closesIso) last.closesIso = window.closesIso; } else merged.push({ ...window });
    }
    return merged;
  };

  /* ── Conditions ─────────────────────────────────────────────────────── */

  const generalDeerWindowsByArea = new Map();
  for (const rule of rules) {
    if (rule.appliesWhen.LICENCE_TYPE !== "MB_RESIDENT_GENERAL_WTD" || rule.equipmentStatedAs !== "All equipment") continue;
    for (const area of groups.get(rule.geography.statedAs).officialIdentifiers) {
      generalDeerWindowsByArea.set(area, mergeWindows([...(generalDeerWindowsByArea.get(area) ?? []), ...rule.windows]));
    }
  }

  const conditions = [
    { id: "ca-mb-wtd-second-licence-prerequisite", text: "A second white-tailed deer licence may be used only while you also hold a Manitoba resident general white-tailed deer licence valid for this period and area.", sourceId: "source:ca-mb-hunting-seasons-regulation", sourceSection: "M.R. 165/91 s. 9(3)" },
    { id: "ca-mb-wtd-third-licence-prerequisite", text: "A third white-tailed deer licence may be used only while you also hold a Manitoba resident general and a second white-tailed deer licence valid for this period and area.", sourceId: "source:ca-mb-hunting-seasons-regulation", sourceSection: "M.R. 165/91 s. 10(3)" },
    { id: "ca-mb-non-canadian-outfitter", text: "A non-Canadian resident must book the hunt through a licensed lodge or outfitter, use only the outfitter named on the licence, and be accompanied by a licensed Manitoba guide.", sourceId: "source:ca-mb-hunting-guide-2026", sourceSection: "2026 Manitoba Hunting Guide, p. 28" },
    { id: "ca-mb-big-game-hunter-orange", text: "Wear a hunter orange head covering and at least 2,580 cm² (400 in²) of hunter orange above the waist, visible from all sides.", sourceId: "source:ca-mb-general-hunting-regulation", sourceSection: "M.R. 351/87 s. 10(1)" },
    { id: "ca-mb-archery-no-hunter-orange-exemption-note", text: "Archers hunting during an archery season are exempt from the hunter orange requirement.", sourceId: "source:ca-mb-general-hunting-regulation", sourceSection: "M.R. 351/87 s. 10(2)(a)" },
    { id: "ca-mb-disabled-crossbow-permit", text: "An archery season permits a long, recurved or compound bow. A crossbow may be used under an archery licence only by the holder of a disabled crossbow permit.", sourceId: "source:ca-mb-hunting-seasons-regulation", sourceSection: "M.R. 165/91 ss. 3.3, 29.1" },
    { id: "ca-mb-landowner-permission-shotgun-muzzleloader", text: "Written landowner permission is required during the shotgun and muzzleloader season in GHA 33 and the part of GHA 38 in the R.M. of Macdonald.", sourceId: "source:ca-mb-hunting-guide-2026", sourceSection: "2026 Manitoba Hunting Guide, p. 30" },
    { id: "ca-mb-upland-no-single-projectile", text: "Upland game birds may not be hunted with a centrefire rifle, or with a shotgun or muzzleloader loaded with a single projectile.", sourceId: "source:ca-mb-general-hunting-regulation", sourceSection: "M.R. 351/87 s. 6(k)" },
    {
      id: "ca-mb-upland-hunter-orange",
      text: "The general deer season is open in this Game Hunting Area on this date, so upland game bird hunters must wear a hunter orange head covering and at least 2,580 cm² (400 in²) of hunter orange above the waist.",
      sourceId: "source:ca-mb-general-hunting-regulation",
      sourceSection: "M.R. 351/87 s. 10(3); dates from M.R. 165/91 Schedule B, Part A (all equipment)",
      activeWindowsByZone: Object.fromEntries([...generalDeerWindowsByArea].sort(([a], [b]) => compareAreas(a, b)).map(([area, windows]) => [zoneId(area), windows])),
    },
    {
      id: "ca-mb-cwd-mandatory-sampling",
      text: "This Game Hunting Area is in Manitoba's CWD mandatory surveillance zone: submit biological samples from a harvested white-tailed deer (the head and upper neck, or the lymph nodes and lower jaw) to a provincial drop-off location within seven days of harvest.",
      sourceId: "source:ca-mb-cwd-program",
      sourceSection: "Manitoba CWD program page; 2026 Manitoba Hunting Guide, p. 5",
      zoneIds: cwdAreas.map(zoneId),
      speciesIds: [WHITE_TAILED_DEER],
    },
    ...s10_3.moose.map((area) => ({
      id: `ca-mb-wtd-moose-season-licence-${area.toLowerCase()}`,
      text: `A moose season is open in GHA ${area} on this date. You must not hunt white-tailed deer here during a moose season unless you hold a valid Manitoba resident draw general moose licence for this area with an unused tag.`,
      sourceId: "source:ca-mb-hunting-seasons-regulation",
      sourceSection: "M.R. 165/91 s. 10.3(a); moose season dates from Schedule D",
      zoneIds: [zoneId(area)],
      speciesIds: [WHITE_TAILED_DEER],
      activeWindows: mergeWindows(mooseSeasons.get(area).windows),
      caveats: [...mooseSeasons.get(area).caveats].sort(),
    })),
    ...s10_3.elk.map((area) => ({
      id: `ca-mb-wtd-elk-season-licence-${area.toLowerCase()}`,
      text: `An elk season is open in GHA ${area} on this date. You must not hunt white-tailed deer here during an elk season unless you hold a valid Manitoba resident draw archery elk licence for this area with an unused tag.`,
      sourceId: "source:ca-mb-hunting-seasons-regulation",
      sourceSection: "M.R. 165/91 s. 10.3(b); elk season dates from Schedule C",
      zoneIds: [zoneId(area)],
      speciesIds: [WHITE_TAILED_DEER],
      activeWindows: mergeWindows(elkSeasons.get(area).windows),
      caveats: [...elkSeasons.get(area).caveats].sort(),
    })),
  ];
  for (const rule of rules) {
    if (rule.speciesId !== WHITE_TAILED_DEER) continue;
    rule.conditionIds.push("ca-mb-cwd-mandatory-sampling", ...s10_3.moose.map((area) => `ca-mb-wtd-moose-season-licence-${area.toLowerCase()}`), ...s10_3.elk.map((area) => `ca-mb-wtd-elk-season-licence-${area.toLowerCase()}`));
  }

  /* ── Cross-check against the 2026 guide ─────────────────────────────── */

  const findings = [];
  const guideDeer = crossCheck.whiteTailedDeer;
  const windowKey = (statedAs) => {
    const [window] = parseSeasonCell(statedAs);
    const resolved = anchor(window);
    return `${resolved.opensIso}/${resolved.closesIso}`;
  };

  // Regulation: for each residency, the season types and windows a general
  // licence opens in each area (or the Macdonald portion).
  const generalLicences = { MANITOBA_RESIDENT: ["MB_RESIDENT_GENERAL_WTD"], CANADIAN_RESIDENT: ["CANADIAN_RESIDENT_GENERAL_WTD"], NON_CANADIAN_RESIDENT: ["NON_CANADIAN_GENERAL_WTD", "NON_CANADIAN_ARCHERY_WTD", "NON_CANADIAN_MUZZLELOADER_WTD"] };
  const places = [...ordered, "MACDONALD"];
  const regulationSeasons = (licences, place) => {
    const out = new Map();
    for (const rule of rules) {
      if (rule.speciesId !== WHITE_TAILED_DEER || !licences.includes(rule.appliesWhen.LICENCE_TYPE)) continue;
      const covers = place === "MACDONALD" ? rule.geography.include.special.includes(GHA38_MACDONALD) : rule.geography.include.ghas.includes(place);
      if (!covers) continue;
      const type = guideSeasonType(rule.equipmentStatedAs, rule.appliesWhen.HUNTER_AGE === "UNDER_18");
      const set = out.get(type) ?? new Set();
      for (const window of rule.windows) set.add(`${window.opensIso}/${window.closesIso}`);
      out.set(type, set);
    }
    return out;
  };
  const guideSeasons = (rows, residency, place) => {
    const out = new Map();
    for (const row of rows) {
      const covers = place === "MACDONALD" ? row.specialGeography === GHA38_MACDONALD : row.areas.includes(place);
      if (!covers) continue;
      for (const season of row.seasons) {
        if (season.residency && !season.residency.includes(residency)) continue;
        const set = out.get(season.type) ?? new Set();
        for (const window of season.windows) set.add(windowKey(window));
        out.set(season.type, set);
      }
    }
    return out;
  };
  const interpretiveMembers = (licences, place) => rules.some((rule) =>
    rule.speciesId === WHITE_TAILED_DEER && licences.includes(rule.appliesWhen.LICENCE_TYPE) &&
    rule.geography.include.interpretive.some((entry) => entry.area === place));

  const compare = (label, licences, guideRows, residency) => {
    for (const place of places) {
      const regulation = regulationSeasons(licences, place);
      const guide = guideSeasons(guideRows, residency, place);
      for (const type of new Set([...regulation.keys(), ...guide.keys()])) {
        const a = [...(regulation.get(type) ?? [])].sort();
        const b = [...(guide.get(type) ?? [])].sort();
        if (JSON.stringify(a) === JSON.stringify(b)) continue;
        const interpretive = !b.length && interpretiveMembers(licences, place);
        findings.push({
          table: label, residency, area: place === "MACDONALD" ? "GHA 38 (R.M. of Macdonald)" : place, seasonType: type,
          regulation: a, guide: b,
          effect: interpretive ? "DISPUTE" : "REGULATION_CONTROLS",
          reason: interpretive
            ? "The regulation reaches this area only through a range, read in the order the guide confirms elsewhere, and the guide lists no such season here. The disagreement may be North Ground's reading, so it is not answered."
            : "The regulation's own text differs from the guide. The regulation controls; the guide is a summary.",
        });
      }
    }
  };
  for (const residency of RESIDENCIES) compare("general", generalLicences[residency], guideDeer.general.zones, residency);
  compare("second", ["MB_RESIDENT_SECOND_WTD"], guideDeer.second.rows, "MANITOBA_RESIDENT");
  compare("third", ["MB_RESIDENT_THIRD_WTD"], guideDeer.third.rows, "MANITOBA_RESIDENT");

  // Grouse: windows by zone, limits, and the reduced sharp-tailed areas.
  for (const speciesId of Object.values(SPECIES)) {
    for (const residency of RESIDENCIES) {
      const forSpecies = rules.filter((rule) => rule.speciesId === speciesId && rule.appliesWhen.RESIDENCY === residency);
      for (const expected of crossCheck.uplandGameBirds.grouse) {
        const matching = forSpecies.filter((rule) => JSON.stringify(rule.geography.include.gbhz) === JSON.stringify(expected.gbhz));
        const want = windowKey(expected.window);
        if (!matching.length || matching.some((rule) => rule.windows.map((w) => `${w.opensIso}/${w.closesIso}`).join() !== want)) {
          findings.push({ table: "upland", residency, area: `GBHZ ${expected.gbhz.join(" & ")}`, seasonType: speciesId, regulation: matching.map((rule) => rule.seasonPhrase), guide: [expected.window], effect: "REGULATION_CONTROLS", reason: "Grouse season differs from the guide." });
        }
      }
    }
  }
  const reducedSharpTail = rules.filter((rule) => rule.speciesId === "species:sharp-tailed-grouse" && rule.geography.include.ghas.length);
  for (const rule of reducedSharpTail) {
    const guideNote = crossCheck.uplandGameBirds.sharpTailedNote;
    if (JSON.stringify(rule.geography.include.ghas) !== JSON.stringify([...guideNote.areas].sort(compareAreas)) || rule.limits.daily !== guideNote.daily || rule.limits.possession !== guideNote.possession) {
      throw new Error(`Sharp-tailed grouse reduced-limit areas disagree with the guide: ${rule.geography.include.ghas}`);
    }
  }

  // Apply findings to the rules they describe.
  for (const finding of findings) {
    if (finding.table === "upland") continue;
    const licences = finding.table === "second" ? ["MB_RESIDENT_SECOND_WTD"] : finding.table === "third" ? ["MB_RESIDENT_THIRD_WTD"] : generalLicences[finding.residency];
    const area = finding.area.startsWith("GHA 38") ? null : finding.area;
    for (const rule of rules) {
      if (rule.speciesId !== WHITE_TAILED_DEER || !licences.includes(rule.appliesWhen.LICENCE_TYPE)) continue;
      if (guideSeasonType(rule.equipmentStatedAs, rule.appliesWhen.HUNTER_AGE === "UNDER_18") !== finding.seasonType) continue;
      const covers = area ? rule.geography.include.ghas.includes(area) : rule.geography.include.special.includes(GHA38_MACDONALD);
      if (!covers) continue;
      const where = area ? `GHA ${area}` : "this part of GHA 38";
      if (finding.effect === "DISPUTE") {
        rule.disputes.push({
          zoneId: zoneId(area),
          statedAs: `M.R. 165/91 reaches ${where} for this licence only through the range "${rule.geography.include.interpretive.find((entry) => entry.area === area)?.range}", read so that it includes lettered areas between its ends. The 2026 guide lists no ${finding.seasonType.toLowerCase()} season for ${finding.residency.replace(/_/g, " ").toLowerCase()}s in ${where}. North Ground will not choose between them.`,
        });
      } else {
        const guideText = finding.guide.length ? finding.guide.map((key) => key.replace("/", " to ")).join(", ") : "no such season";
        const regulationText = finding.regulation.length ? finding.regulation.map((key) => key.replace("/", " to ")).join(", ") : "no such season";
        rule.notes.push({
          zoneId: area ? zoneId(area) : zoneId("38"),
          text: `For ${where}, the 2026 guide shows ${guideText} for this season; the regulation, which controls, gives ${regulationText}. This answer follows the regulation.`,
        });
      }
    }
  }

  /* ── Overlapping land and its published restrictions ────────────────── */

  const specialMatches = [
    { id: NAMED_GEOGRAPHIES["CFB Shilo"], layer: "closed", name: "Canadian Forces Base Shilo" },
    { id: GHA38_MACDONALD, layer: "closed", name: "Portion of GHA 38 in RM of MacDonald" },
    { id: NAMED_GEOGRAPHIES["Whiteshell Game Bird Refuge"], layer: "refuges", name: "Whiteshell", type: "Game Bird Refuge" },
  ];
  const overlayLayers = [];
  for (const layer of OVERLAY_LAYERS) {
    const fields = ["OBJECTID", layer.nameField, layer.textField, layer.regulationField, layer.typeField].filter(Boolean);
    const payload = await arcgisQuery(layer.url, { where: "1=1", outFields: fields.join(","), returnGeometry: "false", orderByFields: "OBJECTID" });
    const features = (payload.features ?? []).map(({ attributes }) => {
      const statedAs = decodeEntities(String(attributes[layer.textField] ?? "")).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const classified = classifyRestriction(attributes[layer.textField] ?? "");
      const name = String(attributes[layer.nameField] ?? "").trim();
      const type = layer.typeField ? String(attributes[layer.typeField] ?? "").trim() : undefined;
      return {
        objectId: attributes.OBJECTID,
        name,
        ...(type ? { type } : {}),
        statedAs,
        ...(layer.regulationField && attributes[layer.regulationField] ? { regulation: String(attributes[layer.regulationField]).trim() } : {}),
        tokens: classified.tokens,
        unclassified: classified.unclassified,
        specialIds: specialMatches.filter((match) => match.layer === layer.key && match.name === name && (!match.type || match.type === type)).map((match) => match.id),
      };
    });
    if (!features.length) throw new Error(`Overlay layer ${layer.key} returned no features`);
    overlayLayers.push({ key: layer.key, url: layer.url, sourceId: layer.sourceId, featureCount: features.length, contentHash: sha256(JSON.stringify(features)), features });
  }
  for (const match of specialMatches) {
    const found = overlayLayers.find((layer) => layer.key === match.layer).features.filter((feature) => feature.specialIds.includes(match.id));
    if (!found.length) throw new Error(`No overlay feature found for ${match.id} ("${match.name}")`);
  }
  const overlayCatalogue = {
    jurisdictionId: "jurisdiction:ca-mb",
    purpose: "Published restrictions on land that can close or limit a hunt at a point. Classified at build time; a feature that is not in this catalogue, or has changed, is treated as a restriction North Ground has not certified.",
    layers: overlayLayers,
  };

  /* ── Sources ────────────────────────────────────────────────────────── */

  const statusHash = (...parts) => sha256(parts.join("\n\n"));
  const sources = [
    {
      id: "source:ca-mb-hunting-seasons-regulation", hierarchy: "REGULATION", controlling: true,
      authority: "Government of Manitoba (Manitoba Laws)", title: seasonsVersion.title, url: URLS.seasons,
      version: `in effect since ${seasonsVersion.inEffectSince}; last amendment ${seasonsVersion.lastAmendment}`,
      effectiveFrom: seasonsVersion.inEffectSince,
      contentHash: statusHash(seasonsBody),
      scheduleHashes: Object.fromEntries(["SchA", "SchB", "SchC", "SchD"].map((id) => [id, sha256(scheduleText(id))])),
      conditions: conditions.filter((condition) => condition.sourceId === "source:ca-mb-hunting-seasons-regulation"),
    },
    {
      id: "source:ca-mb-hunting-areas-regulation", hierarchy: "REGULATION", controlling: true,
      authority: "Government of Manitoba (Manitoba Laws)", title: areasVersion.title, url: URLS.areas,
      version: `in effect since ${areasVersion.inEffectSince}; last amendment ${areasVersion.lastAmendment}`,
      effectiveFrom: areasVersion.inEffectSince, contentHash: statusHash(areasBody), conditions: [],
    },
    {
      id: "source:ca-mb-general-hunting-regulation", hierarchy: "REGULATION", controlling: true,
      authority: "Government of Manitoba (Manitoba Laws)", title: generalVersion.title, url: URLS.general,
      version: `in effect since ${generalVersion.inEffectSince}; last amendment ${generalVersion.lastAmendment}`,
      effectiveFrom: generalVersion.inEffectSince, contentHash: statusHash(generalBody),
      conditions: conditions.filter((condition) => condition.sourceId === "source:ca-mb-general-hunting-regulation"),
    },
    {
      id: "source:ca-mb-designation-of-wildlife-lands-regulation", hierarchy: "REGULATION", controlling: true,
      authority: "Government of Manitoba (Manitoba Laws)", title: wildlifeLandsVersion.title, url: URLS.wildlifeLands,
      version: `in effect since ${wildlifeLandsVersion.inEffectSince}; last amendment ${wildlifeLandsVersion.lastAmendment}`,
      effectiveFrom: wildlifeLandsVersion.inEffectSince, contentHash: statusHash(wildlifeLandsBody), conditions: [],
    },
    {
      id: "source:ca-mb-hunting-guide-2026", hierarchy: "OFFICIAL_SUMMARY", controlling: false,
      authority: "Government of Manitoba", title: crossCheck.source.title, url: URLS.guide,
      version: "2026 (licence year 1 April 2026 to 31 March 2027)", contentHash: guideHash,
      conditions: conditions.filter((condition) => condition.sourceId === "source:ca-mb-hunting-guide-2026"),
    },
    {
      id: "source:ca-mb-cwd-program", hierarchy: "OFFICIAL_EXPLANATORY", controlling: false,
      authority: "Manitoba Natural Resources and Indigenous Futures", title: "Chronic Wasting Disease in Manitoba", url: URLS.cwdPage,
      version: "web page", contentHash: statusHash(visibleText(cwdHtml)),
      conditions: conditions.filter((condition) => condition.sourceId === "source:ca-mb-cwd-program"),
    },
    {
      id: "source:ca-mb-cwd-surveillance-zone-service", hierarchy: "OFFICIAL_GIS", controlling: false,
      authority: "Government of Manitoba", title: "CWD Mandatory Surveillance Zone feature layer", url: URLS.cwdLayer,
      version: `data-${new Date(cwdLayerMeta.editingInfo?.dataLastEditDate ?? 0).toISOString().slice(0, 10)}`,
      contentHash: statusHash(cwdLayerAreas.join(",")), conditions: [],
    },
    {
      id: "source:ca-mb-gha-service", hierarchy: "OFFICIAL_GIS", controlling: false,
      authority: "Government of Manitoba", title: "Manitoba Game Hunting Areas feature layer", url: URLS.ghaService,
      version: `data-${new Date(serviceMeta.editingInfo?.dataLastEditDate ?? 0).toISOString().slice(0, 10)}`,
      contentHash: statusHash(serviceAreas.map((area) => area || "<blank>").sort().join(",")), conditions: [],
    },
    {
      id: "source:ca-mb-lands-closed-to-hunting-service", hierarchy: "OFFICIAL_GIS", controlling: false,
      authority: "Government of Manitoba", title: "Lands Closed to Hunting in Manitoba feature layer", url: URLS.closedLands,
      version: "feature layer", contentHash: statusHash(JSON.stringify([cfbShilo, macdonald]), ...overlayLayers.filter((layer) => layer.sourceId === "source:ca-mb-lands-closed-to-hunting-service").map((layer) => layer.contentHash)), conditions: [],
    },
    {
      id: "source:ca-mb-wildlife-lands-service", hierarchy: "OFFICIAL_GIS", controlling: false,
      authority: "Government of Manitoba", title: "Manitoba Wildlife Lands Boundaries feature layer", url: URLS.refuges,
      version: "feature layer", contentHash: statusHash(JSON.stringify([whiteshell, oakHammockMarsh]), ...overlayLayers.filter((layer) => layer.sourceId === "source:ca-mb-wildlife-lands-service").map((layer) => layer.contentHash)), conditions: [],
    },
  ];

  const contentHash = sha256(sources.map((source) => `${source.id}:${source.contentHash}`).join("\n"));
  const perSource = new Map((previous?.sources ?? []).map((source) => [source.id, source]));
  for (const source of sources) {
    source.retrievedAt = retrievedAtFor(perSource.get(source.id) ? { retrievedAt: perSource.get(source.id).retrievedAt } : null, perSource.get(source.id)?.contentHash, source.contentHash, today);
  }

  const bundle = {
    bundleId: "ca-mb-2026",
    jurisdictionId: "jurisdiction:ca-mb",
    sourceVersion: seasonsVersion.lastAmendment,
    retrievedAt: retrievedAtFor(previous, previous?.contentHash, contentHash, today),
    contentHash,
    licenceYear: { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31`, statedAs: provisions.huntingYear.text, section: "M.R. 165/91 s. 1" },
    certifiedPeriod: {
      ...certifiedPeriod,
      reason: `The consolidation of M.R. 165/91 encoded here has been in force since ${seasonsVersion.inEffectSince}. Earlier days of the licence year were governed by an earlier version, and later licence years by versions not yet published.`,
    },
    absence: {
      meaning: "CLOSED",
      statedAs: provisions.exhaustive.text,
      section: provisions.exhaustive.section,
      sourceId: "source:ca-mb-hunting-seasons-regulation",
      explanation: "A licence authorises hunting only in the areas, with the equipment and in the seasons the regulation designates for it. Where no row designates this place for this licence, the regulation closes it.",
    },
    officialUnitCount: ordered.length,
    officialUnits: ordered,
    /* The registry's id for each area, so evaluation never parses an id. */
    units: ordered.map((area) => ({ identifier: area, zoneId: zoneId(area) })),
    gameBirdZones: {
      source: "M.R. 220/86 s. 1.1",
      zone1: gbhz.zone1,
      zone2Line: { ...gbhz.zone2Line, ...zoneLine, derivation: "Township lines lie at least six miles apart northward from the 49th parallel, so the north limit of Township 43 is above 52.73°N, and the whole zone 2/3 line lies between that and the 53rd parallel. North Ground holds no survey geometry for it; a point between 52.70°N and 53.05°N outside GBHZ 4 is treated as undetermined between zones 2 and 3." },
      zone3: gbhz.zone3,
      zone4Areas: [...gbhz.zone4Areas].sort(compareAreas),
      possibleZonesByArea: zonesByArea,
    },
    specialGeographies,
    provisions: Object.values(provisions),
    sources,
    groups: [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)),
    rules: rules.sort((a, b) => a.id.localeCompare(b.id)),
    crossCheck: {
      against: "source:ca-mb-hunting-guide-2026",
      disputes: findings.filter((finding) => finding.effect === "DISPUTE"),
      regulationControls: findings.filter((finding) => finding.effect === "REGULATION_CONTROLS"),
    },
  };

  const idCount = new Set(bundle.rules.map((rule) => rule.id)).size;
  if (idCount !== bundle.rules.length) throw new Error("Two rules share an id");

  const certifiedUnits = {
    jurisdictionId: "jurisdiction:ca-mb",
    layerId: "layer:ca-mb-gha",
    officialUnitCount: ordered.length,
    certifiedUnits: ordered.filter((area) => bundle.groups.some((group) => group.officialIdentifiers.includes(area) || group.partialIdentifiers.includes(area))),
  };

  if (checkOnly) {
    if (!previous) { console.error("No existing Manitoba bundle to check against."); process.exit(1); }
    const moved = sources.filter((source) => perSource.get(source.id)?.contentHash !== source.contentHash);
    if (!moved.length && previous.contentHash === contentHash) {
      console.log(`Manitoba sources unchanged (${contentHash.slice(0, 23)}…).`);
      return;
    }
    console.error(`Manitoba source(s) moved: ${moved.map((source) => source.id).join(", ") || "bundle hash"}`);
    const diff = diffConditionalBundles(previous, bundle);
    console.error(diff.blastRadius.rules || diff.blastRadius.conditions
      ? formatConditionalDiff(diff)
      : "  No rule or condition changed; review the source diff.");
    process.exit(2);
  }

  writeFileSync(OUTPUT, `${JSON.stringify(bundle, null, 2)}\n`);
  writeFileSync(OVERLAYS_OUTPUT, `${JSON.stringify(overlayCatalogue, null, 2)}\n`);
  writeFileSync(CERTIFIED_UNITS_OUTPUT, `${JSON.stringify(certifiedUnits, null, 2)}\n`);

  console.log(`Wrote ${OUTPUT}`);
  console.log(`  ${seasonsVersion.title}: ${bundle.sources[0].version}`);
  console.log(`  certified period ${certifiedPeriod.from} to ${certifiedPeriod.to}`);
  console.log(`  ${bundle.rules.length} rules in ${bundle.groups.length} groups`);
  for (const speciesId of [...new Set(bundle.rules.map((rule) => rule.speciesId))]) {
    console.log(`    ${speciesId}: ${bundle.rules.filter((rule) => rule.speciesId === speciesId).length} rules`);
  }
  console.log(`  cross-check: ${bundle.crossCheck.disputes.length} dispute(s), ${bundle.crossCheck.regulationControls.length} where the regulation overrides the guide`);
  for (const finding of findings) console.log(`    ${finding.effect} ${finding.table}/${finding.residency} ${finding.area} ${finding.seasonType}: reg [${finding.regulation}] guide [${finding.guide}]`);
  console.log(`  content hash ${contentHash}`);
}

main().catch((error) => {
  console.error(`Manitoba build failed: ${error.message}`);
  process.exit(1);
});
