/**
 * The Canadian Wildlife Service Eastern Waterfowl Survey, as North Ground evidence.
 *
 * WHAT THIS DATASET IS. Helicopters fly 332 fixed squares of 25 km² each in
 * Québec, Ontario and the Maritimes every spring and count the breeding
 * waterfowl on them. It is the only public Canadian dataset found (research,
 * 2026-09-29, docs/research/species-density-evidence.md) that measures where
 * animals are at a resolution finer than a hunting zone, under a licence North
 * Ground may use.
 *
 * WHAT IT IS NOT, AND WHY EACH REFUSAL IS CODE RATHER THAN A COMMENT:
 *
 *  1. It is not a surface. 332 plots × 25 km² is 8,300 km² of five provinces;
 *     everything between them was never looked at. The evidence is emitted as
 *     `SAMPLE_PLOT`, whose render kind draws each plot evenly and draws nothing
 *     at all off-plot — see `intelligence/rendering.ts`.
 *  2. It is not autumn. The survey counts BREEDING birds in May. Every bundle
 *     carries a `seasonalBasis` whose warning the heat surfaces show, and
 *     `bundles.ts` refuses to load a mismatched bundle that has no warning.
 *  3. It is not a population estimate and it is not density. The counts are
 *     detections under a double-observer protocol, uncorrected. The metric is
 *     `SURVEY_OBSERVATION` and this script rejects any attempt to emit
 *     `POPULATION_ESTIMATE` or `POPULATION_DENSITY`.
 *
 * FOUR ROWS ARE REJECTED, AND EVERY REJECTION IS COUNTED AND ASSERTED. A silent
 * filter is how a sentinel becomes a coordinate again: if the publisher changes
 * one of these conventions the count moves and this script stops.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync, inflateRawSync } from "node:zlib";

const MART = "https://data-donnees.az.ec.gc.ca/api/file?path=%2Fspecies%2Fassess%2FWaterfowl-Surveys-in-Canada%2FEastern-Waterfowl-Survey-(EWS25)-1990%2F";
export const DATASET_URL = "https://open.canada.ca/data/en/dataset/b8c79d2f-3bd7-4f26-8102-be268be1582b";
export const DOI = "https://doi.org/10.18164/b8c79d2f-3bd7-4f26-8102-be268be1582b";
export const OBSERVATIONS_URL = `${MART}CWS_EWS25_SurveyObservations_ObservationsInventaire.csv`;
export const CONDITIONS_URL = `${MART}CWS_EWS25_SurveyConditions_ConditionsInventaire.csv`;
export const PLOTS_URL = `${MART}CWS_EWS25_SurveyAreas_Plots_SecteursInventaire_Quadrats.kmz`;
export const PLOTS_OUTPUT = resolve("content/intelligence/ews25-plots.json");
export const BUNDLE_DIR = resolve("content/intelligence");

/**
 * The authority's own missing-value convention, quoted from its data
 * dictionary: "In all data files, '9999' indicates unknown".
 */
const UNKNOWN = 9999;

/**
 * Species North Ground serves, by the survey's own four-letter code.
 *
 * Presence here is not permission to publish: a pair must also clear
 * PLOT_SHARE_FLOOR below. This map exists because a survey code is not a
 * canonical id, not to decide coverage.
 */
export const SPECIES_CODES = {
  ABDU: "species:american-black-duck",
  MALL: "species:mallard",
  RNDU: "species:ring-necked-duck",
  COGO: "species:common-goldeneye",
  BAGO: "species:barrows-goldeneye",
  CANG: "species:canada-goose",
  GWTE: "species:green-winged-teal",
  BWTE: "species:blue-winged-teal",
  WODU: "species:wood-duck",
  BUFF: "species:bufflehead",
};

const JURISDICTIONS = { ON: "jurisdiction:ca-on", QC: "jurisdiction:ca-qc", NB: "jurisdiction:ca-nb", NS: "jurisdiction:ca-ns", NL: "jurisdiction:ca-nl" };

/**
 * A species is drawable in a jurisdiction only if the survey has recorded it on
 * at least HALF that jurisdiction's plots.
 *
 * THIS IS A DECLARED PART OF THE METHODOLOGY, NOT A TUNING CONSTANT, and the
 * reason is the failure it prevents. Below half, a plot without the species is
 * more likely to be a plot where it was not detected than a plot where it does
 * not live — so a ramp built on the minority of plots that happened to record
 * it ranks OUR sampling, not the birds. Gadwall, recorded on 9 of 332 plots,
 * must be undrawable for the same reason a coin landing heads twice is not a
 * biased coin.
 *
 * Changing this number changes what North Ground claims, so it is versioned
 * with the methodology and stated in every bundle it admits.
 */
export const PLOT_SHARE_FLOOR = 0.5;

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function rowsToObjects(text) {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const header = rows[0];
  return rows.slice(1).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])));
}

/** A number, or null where the field is blank, unparseable or the unknown sentinel. */
export function reading(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "NA" || text === "<NULL>") return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return Math.abs(number) >= UNKNOWN ? null : number;
}

/**
 * The plot polygons, read from the authority's own KMZ.
 *
 * Read rather than assumed: the plot's area comes from the publisher's own
 * `areaHa` attribute on each plot, because §41B says a grid without its
 * publisher's cell size is a shape, not a resolution.
 */
export function parsePlots(kml) {
  const plots = [];
  for (const block of kml.match(/<Placemark[\s\S]*?<\/Placemark>/g) ?? []) {
    const attribute = (name) => block.match(new RegExp(`<th>${name}</th>\\s*<td>([\\s\\S]*?)</td>`))?.[1]?.trim() ?? null;
    const coordinates = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/)?.[1];
    const id = attribute("survArID");
    if (!id || !coordinates) continue;
    const ring = coordinates.trim().split(/\s+/).map((point) => {
      const [lon, lat] = point.split(",").map(Number);
      return [Number(lon.toFixed(6)), Number(lat.toFixed(6))];
    });
    plots.push({
      plotId: id,
      jurisdictionId: JURISDICTIONS[attribute("provTerr")] ?? null,
      province: attribute("provTerr"),
      areaHectares: Number(attribute("areaHa")),
      shape: attribute("plotShape")?.split("|")[0].trim() ?? null,
      ring,
    });
  }
  return plots.sort((a, b) => a.plotId.localeCompare(b.plotId));
}

/** Plot-years the authority flew completely. `cov` is its own percentage of habitable area flown. */
export function fullyFlown(conditions) {
  const flown = new Set();
  let partial = 0;
  for (const row of conditions) {
    const coverage = reading(row.cov);
    if (coverage === 100) flown.add(`${row.survArID}|${row.yr}`);
    else partial += 1;
  }
  return { flown, partial };
}

/**
 * Every observation that may be attributed to the plot it was recorded under,
 * with each reason for refusing one counted.
 *
 * `distOut` is the authority's distance from the observation to the survey-area
 * boundary, and a positive value means the bird was OUTSIDE the plot — birds
 * seen in transit, up to 7 km away. Attributing those to a 25 km² square they
 * were never in would inflate every plot by about an eighth. The reading was
 * confirmed independently before it was relied on: 4,000 rows with `distOut`
 * of 0 all fall inside their plot's published polygon and 4,000 rows with a
 * positive `distOut` all fall outside it.
 */
export function admissible(observations, flown) {
  const rejected = { unknownCoordinate: 0, outsidePlot: 0, partiallyFlown: 0, unreadableCount: 0 };
  const kept = [];
  for (const row of observations) {
    if (!(row.spEN in SPECIES_CODES)) continue;
    const latitude = reading(row.lat);
    const longitude = reading(row.lon);
    if (latitude === null || longitude === null) { rejected.unknownCoordinate += 1; continue; }
    const outside = reading(row.distOut);
    if (outside === null || outside > 0) { rejected.outsidePlot += 1; continue; }
    if (!flown.has(`${row.survArID}|${row.yr}`)) { rejected.partiallyFlown += 1; continue; }
    const total = reading(row.total);
    if (total === null) { rejected.unreadableCount += 1; continue; }
    kept.push({ plotId: row.survArID, year: Number(row.yr), code: row.spEN, total });
  }
  return { kept, rejected };
}

/** The most recent completely-flown year for each plot, and what was counted on it. */
export function latestCounts(kept) {
  const latestYear = new Map();
  for (const { plotId, year } of kept) {
    if (!latestYear.has(plotId) || year > latestYear.get(plotId)) latestYear.set(plotId, year);
  }
  const counts = new Map();
  const everRecorded = new Map();
  for (const { plotId, year, code, total } of kept) {
    const key = `${code}|${plotId}`;
    if (!everRecorded.has(code)) everRecorded.set(code, new Set());
    if (total > 0) everRecorded.get(code).add(plotId);
    if (year !== latestYear.get(plotId)) continue;
    counts.set(key, (counts.get(key) ?? 0) + total);
  }
  return { latestYear, counts, everRecorded };
}

function percentileRanks(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((value) => {
    if (sorted.length < 2) return 0.5;
    const below = sorted.filter((other) => other < value).length;
    const equal = sorted.filter((other) => other === value).length;
    return Number(((below + equal / 2) / sorted.length).toFixed(4));
  });
}

export function buildBundles({ plots, kept, hashes, retrievedAt }) {
  const { latestYear, counts, everRecorded } = latestCounts(kept);
  const byJurisdiction = new Map();
  for (const plot of plots) {
    if (!plot.jurisdictionId) continue;
    const list = byJurisdiction.get(plot.jurisdictionId) ?? [];
    list.push(plot);
    byJurisdiction.set(plot.jurisdictionId, list);
  }

  const bundles = [];
  const refused = [];
  for (const [code, speciesId] of Object.entries(SPECIES_CODES)) {
    for (const [jurisdictionId, jurisdictionPlots] of byJurisdiction) {
      const recorded = jurisdictionPlots.filter((plot) => everRecorded.get(code)?.has(plot.plotId));
      const share = recorded.length / jurisdictionPlots.length;
      if (share < PLOT_SHARE_FLOOR) {
        refused.push({ speciesId, jurisdictionId, plotsRecorded: recorded.length, plotsInJurisdiction: jurisdictionPlots.length, reason: "BELOW_PLOT_SHARE_FLOOR" });
        continue;
      }
      /* Every plot in the jurisdiction gets a record, including the zeros: a
         surveyed plot with none of this species is a real observation of none,
         which is different from ground nobody flew. */
      const values = jurisdictionPlots.map((plot) => counts.get(`${code}|${plot.plotId}`) ?? 0);
      const ranks = percentileRanks(values);
      const years = jurisdictionPlots.map((plot) => latestYear.get(plot.plotId)).filter(Boolean);
      const evidence = jurisdictionPlots.map((plot, index) => ({
        id: `evidence:ews25-${code.toLowerCase()}-${plot.plotId.toLowerCase()}`,
        speciesId,
        jurisdictionId,
        geographyId: `sample_plot:${plot.plotId.toLowerCase()}`,
        geographyType: "SAMPLE_PLOT",
        sourceId: "source:ca-ews25",
        metric: "SURVEY_OBSERVATION",
        rawValue: values[index],
        normalizedValue: ranks[index],
        unit: "birds observed on a 25 km² plot",
        sampleSize: 1,
        methodology: "Helicopter plot survey with a double-observer protocol; counts are detections and are not corrected for detection bias.",
        observationPeriod: { from: `${latestYear.get(plot.plotId)}-05-01`, through: `${latestYear.get(plot.plotId)}-06-30` },
        retrievedAt,
        verifiedAt: retrievedAt,
        confidence: "MODERATE",
        spatialPrecision: "25 km² surveyed plot, 5 km by 5 km, as published by the Canadian Wildlife Service",
        version: "ews25-1",
        superseded: false,
      }));
      bundles.push({
        schemaVersion: 1,
        /* The bundle's own NORMALIZATION version, which is deliberately separate
           from the scoring methodology's. Percentile ranks are computed the same
           way here as in every harvest bundle. */
        methodologyVersion: "opportunity-v1",
        speciesId,
        jurisdictionId,
        coverage: "PARTIAL_DATA",
        latestObservationYear: Math.max(...years),
        plotShare: Number(share.toFixed(4)),
        plotShareFloor: PLOT_SHARE_FLOOR,
        seasonalBasis: {
          observedSeason: "May and June, when the birds are breeding",
          matchesHuntingSeason: false,
          warning: "Counted in spring, on the breeding grounds. Where these birds are in the autumn is a different question, and this survey does not answer it.",
        },
        limitations: [
          "Each shade is what the survey counted on one 25 km² plot. Nothing is claimed about the ground between the plots, which was never surveyed.",
          "Counts are detections under a double-observer protocol and are not corrected for the birds the crew did not see. They are not a population estimate and not a density.",
          "A plot is shown at its most recent fully-flown year. The survey runs on a rotation, so neighbouring plots may be from different years.",
          "Observations recorded outside the plot boundary are excluded, so a plot's count is what was on the plot and not what was seen near it.",
          "The evidence does not determine hunting legality, land access, or permission to hunt.",
        ],
        source: {
          id: "source:ca-ews25",
          authority: "Canadian Wildlife Service, Environment and Climate Change Canada",
          title: "Eastern Waterfowl Survey (EWS25)",
          url: DATASET_URL,
          resourceUrl: OBSERVATIONS_URL,
          licence: "Open Government Licence – Canada",
          licenceUrl: "https://open.canada.ca/en/open-government-licence-canada",
          attribution: "Contains information licensed under the Open Government Licence – Canada. Canadian Wildlife Service, Environment and Climate Change Canada, Eastern Waterfowl Survey (EWS25).",
          doi: DOI,
          sourceHash: hashes.observations,
          retrievedAt,
          verifiedAt: retrievedAt,
        },
        evidence,
      });
    }
  }
  return { bundles: bundles.sort((a, b) => `${a.jurisdictionId}${a.speciesId}`.localeCompare(`${b.jurisdictionId}${b.speciesId}`)), refused };
}

/** A metric this dataset may never claim, refused where it would be written rather than where it would be read. */
const FORBIDDEN_METRICS = new Set(["POPULATION_ESTIMATE", "POPULATION_DENSITY"]);

export function assertClaims(bundles) {
  for (const bundle of bundles) {
    for (const record of bundle.evidence) {
      if (FORBIDDEN_METRICS.has(record.metric)) {
        throw new Error(`${record.id}: the Eastern Waterfowl Survey counts detections, so it may not be published as ${record.metric}`);
      }
      if (record.geographyType !== "SAMPLE_PLOT") {
        throw new Error(`${record.id}: a surveyed plot is not ${record.geographyType}; drawing it as one states that the ground between plots was surveyed`);
      }
    }
    if (bundle.seasonalBasis.matchesHuntingSeason || !bundle.seasonalBasis.warning) {
      throw new Error(`${bundle.speciesId}/${bundle.jurisdictionId}: a spring survey needs its autumn warning`);
    }
  }
}

function unzip(buffer) {
  /* A KMZ is a ZIP holding one doc.kml. Read the single deflated entry rather
     than adding a dependency for one file. */
  const view = Buffer.from(buffer);
  const signature = view.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (signature !== 0) throw new Error("plot archive is not a ZIP");
  const method = view.readUInt16LE(8);
  const compressedSize = view.readUInt32LE(18);
  const nameLength = view.readUInt16LE(26);
  const extraLength = view.readUInt16LE(28);
  const start = 30 + nameLength + extraLength;
  const body = view.subarray(start, start + compressedSize);
  if (method === 0) return body.toString("utf8");
  if (method === 8) return inflateRawSync(body).toString("utf8");
  if (method === 9) return gunzipSync(body).toString("utf8");
  throw new Error(`unsupported compression method ${method}`);
}

async function get(url, binary = false) {
  const response = await fetch(url, {
    headers: { "user-agent": "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)" },
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) throw new Error(`Eastern Waterfowl Survey source returned HTTP ${response.status} for ${url}`);
  return binary ? Buffer.from(await response.arrayBuffer()) : response.text();
}

/**
 * What the publisher's conventions produced last time this was verified.
 *
 * These are asserted, not logged. If ECCC changes its unknown sentinel, stops
 * publishing `distOut`, or alters the coverage field, one of these numbers moves
 * and the build stops with the number in the message — which is the point.
 */
export const EXPECTED = {
  plots: 332,
  plotsWithGeometry: 332,
  unknownCoordinate: 502,
  outsidePlot: 10199,
  partiallyFlown: 878,
  unreadableCount: 0,
};

export async function build({ fetcher = get, retrievedAt = new Date().toISOString().slice(0, 10) } = {}) {
  const [observationsCsv, conditionsCsv, plotArchive] = await Promise.all([
    fetcher(OBSERVATIONS_URL), fetcher(CONDITIONS_URL), fetcher(PLOTS_URL, true),
  ]);
  const hashes = {
    observations: sha256(observationsCsv),
    conditions: sha256(conditionsCsv),
    plots: sha256(plotArchive),
  };
  const plots = parsePlots(unzip(plotArchive));
  if (plots.length !== EXPECTED.plots) throw new Error(`Eastern Waterfowl Survey published ${plots.length} plots, expected ${EXPECTED.plots}`);

  const { flown } = fullyFlown(rowsToObjects(conditionsCsv));
  const { kept, rejected } = admissible(rowsToObjects(observationsCsv), flown);
  for (const [reason, count] of Object.entries(rejected)) {
    if (count !== EXPECTED[reason]) {
      throw new Error(`Eastern Waterfowl Survey rejected ${count} rows as ${reason}, expected ${EXPECTED[reason]}. The publisher's convention may have changed; read the data dictionary before moving this number.`);
    }
  }
  const { bundles, refused } = buildBundles({ plots, kept, hashes, retrievedAt });
  assertClaims(bundles);
  return { plots, bundles, refused, rejected, hashes };
}

function plotsArtifact({ plots, hashes, retrievedAt }) {
  return {
    schemaVersion: 1,
    authority: "Canadian Wildlife Service, Environment and Climate Change Canada",
    title: "Eastern Waterfowl Survey (EWS25) survey plots",
    url: DATASET_URL,
    licence: "Open Government Licence – Canada",
    attribution: "Contains information licensed under the Open Government Licence – Canada.",
    sourceHash: hashes.plots,
    retrievedAt,
    note: "Sampled plots, not a tiling. Ground outside a plot was not surveyed and carries no evidence either way.",
    plots,
  };
}

function bundlePath(bundle) {
  const jurisdiction = bundle.jurisdictionId.replace("jurisdiction:", "");
  const species = bundle.speciesId.replace("species:", "");
  return resolve(BUNDLE_DIR, `${jurisdiction}-${species}-ews-breeding.json`);
}

export async function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const retrievedAt = new Date().toISOString().slice(0, 10);
  const { plots, bundles, refused, rejected, hashes } = await build({ retrievedAt });
  const files = [
    [PLOTS_OUTPUT, `${JSON.stringify(plotsArtifact({ plots, hashes, retrievedAt }), null, 2)}\n`],
    ...bundles.map((bundle) => [bundlePath(bundle), `${JSON.stringify(bundle, null, 2)}\n`]),
  ];
  if (check) {
    for (const [path, contents] of files) {
      const existing = await readFile(path, "utf8").catch(() => null);
      if (existing === null) throw new Error(`Missing committed Eastern Waterfowl Survey artifact: ${path}`);
      /* The retrieval date moves every run and is not evidence, so it is not
         what --check is about: compare everything else. */
      const strip = (text) => text.replace(/"(retrievedAt|verifiedAt)": "\d{4}-\d{2}-\d{2}"/g, '"$1": "-"');
      if (strip(existing) !== strip(contents)) throw new Error(`Committed Eastern Waterfowl Survey evidence does not match the authoritative source: ${path}`);
    }
    console.log(`Eastern Waterfowl Survey unchanged: ${plots.length} plots, ${bundles.length} bundles, ${refused.length} pairs below the plot-share floor.`);
    return;
  }
  await mkdir(BUNDLE_DIR, { recursive: true });
  for (const [path, contents] of files) await writeFile(path, contents);
  console.log(`Eastern Waterfowl Survey: ${plots.length} plots, ${bundles.length} bundles written.`);
  console.log(`  rejected rows: ${Object.entries(rejected).map(([reason, count]) => `${reason} ${count}`).join(", ")}`);
  for (const pair of refused) {
    console.log(`  not drawable: ${pair.speciesId} in ${pair.jurisdictionId} — recorded on ${pair.plotsRecorded} of ${pair.plotsInJurisdiction} plots, below the ${PLOT_SHARE_FLOOR} floor`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
