import { createHash } from "node:crypto";
import certifiedZones from "../fixtures/hunt/ca-on-zone-certification.json" with { type: "json" };

/**
 * Ontario's harvest datasets, which are one shape published five times.
 *
 * Every one of them is a Wildlife Management Unit, a year, an optional active
 * hunter count and one or more harvest columns, under the Open Government
 * Licence – Ontario. The deer builder that came first encoded all of that
 * inline; a second copy of it per species would be five places for the
 * zero-padding rule, the larger-area partition and the suppression rule to
 * drift apart, and each of those three rules exists because getting it wrong
 * puts a wrong number on a map.
 *
 * So the rules live here once and each species declares only what is genuinely
 * its own: its columns, its species id, and what its authority does and does
 * not publish.
 */

/** Every Wildlife Management Unit the authority's own layer publishes, certified against it. */
export const OFFICIAL_UNITS = new Set(certifiedZones.officialIdentifiers);

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

/**
 * The designation the authority's own spatial layer publishes.
 *
 * The harvest tables zero-pad ("01C", "09A") where the Wildlife Management Unit
 * layer, and O. Reg. 663/98 Part 6 behind it, write "1C" and "9A". Minting a
 * canonical id from the padded form produces zones that exist in no layer, so
 * the map shows gaps exactly where the authority reports harvest.
 */
export function designationOf(reported) {
  return reported.replace(/^0+(?=\d)/, "");
}

export function zoneIdOf(reported) {
  return `management_zone:ca-on-wmu-${designationOf(reported).toLowerCase()}`;
}

/**
 * A cell the authority suppressed.
 *
 * Ontario writes an ellipsis where it withholds a figure, and it uses BOTH the
 * three-dot ASCII form and the single ellipsis character, sometimes in adjacent
 * rows of the same file. A suppressed cell is NO DATA. Reading it as zero would
 * publish "nothing was taken here" over a figure the authority declined to
 * release — a fabricated fact, in the direction that looks like a finding.
 */
export function isSuppressed(cell) {
  return /^(?:\.{2,}|…)$/.test(cell.trim());
}

/** A count, or null where the authority suppressed it. Never zero for absent. */
export function count(cell, row) {
  if (isSuppressed(cell)) return null;
  const value = Number(cell.trim());
  if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid count "${cell}" on row ${row}`);
  return value;
}

export function percentileRanks(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return [0.5];
  return values.map((value) => ((sorted.indexOf(value) + sorted.lastIndexOf(value)) / 2) / (sorted.length - 1));
}

/**
 * Ontario reports some harvest under a shorter code than any unit it maps:
 * "76" covers 76A-76E, "69A" covers 69A-1 to 69A-3. Such a figure is never
 * spread across the sub-units, because the authority did not say how it
 * divides, and never dropped, because the authority did report it. It is
 * carried as its own state and kept out of the ranked pool, so a parent's total
 * cannot rank against a single unit's.
 */
export function partitionLargerAreas(current, sourceId, year) {
  const mapped = current.filter((row) => OFFICIAL_UNITS.has(designationOf(row.wmu)));
  const unmapped = current.filter((row) => !OFFICIAL_UNITS.has(designationOf(row.wmu)));
  if (mapped.length + unmapped.length !== current.length) throw new Error("Partition lost a reported unit");

  const reportedSeparately = new Set(mapped.map((row) => designationOf(row.wmu)));
  const larger = unmapped.map((row) => {
    const reportedAs = designationOf(row.wmu);
    const covers = [...OFFICIAL_UNITS]
      .filter((unit) => unit !== reportedAs && unit.startsWith(reportedAs) && !reportedSeparately.has(unit))
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    const separatelyReported = [...OFFICIAL_UNITS]
      .filter((unit) => unit !== reportedAs && unit.startsWith(reportedAs) && reportedSeparately.has(unit))
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    if (!covers.length) throw new Error(`Ontario reports ${row.wmu}, which matches no unit and no group of units in the layer`);
    return {
      reportedAs,
      coversZoneIds: covers.map((unit) => `management_zone:ca-on-wmu-${unit.toLowerCase()}`),
      sourceId,
      observationPeriod: { from: `${year}-01-01`, through: `${year}-12-31` },
      ...row.figures,
      statedAs: `Ontario reports this harvest under WMU ${reportedAs}. Its Wildlife Management Unit layer, and O. Reg. 663/98 Part 6 behind it, publish ${covers.join(", ")} and no unit ${reportedAs}.`,
      ...(separatelyReported.length ? { excludesSeparatelyReported: separatelyReported.map((unit) => `management_zone:ca-on-wmu-${unit.toLowerCase()}`) } : {}),
      limitation: "The authority does not say how this figure divides among those units, so it is not apportioned, not ranked against single units, and not counted in opportunity classes.",
    };
  });
  return { mapped, larger };
}

/**
 * The evidence records for one species in one year.
 *
 * HARVEST_TOTAL always, because every one of these datasets publishes it.
 * HARVEST_PER_HUNTER only where the authority published the hunter count that
 * is its denominator — wild turkey does not, so wild turkey gets no rate, and
 * no denominator is invented to give it one.
 *
 * HUNTER_COUNT is emitted as its own record where published. It is EFFORT, it
 * is marked as such by `methodology.ts`, and it never moves the shade; it is
 * carried because a hunter wants to know a unit is crowded.
 */
export function buildEvidence({ mapped, speciesId, sourceId, slug, year, retrievedAt, unit, methodology, confidence = "MODERATE" }) {
  const harvestRanks = percentileRanks(mapped.map(({ figures }) => figures.totalHarvest));
  const withHunters = mapped.every(({ figures }) => typeof figures.activeHunters === "number");
  const perHunterValues = withHunters
    ? mapped.map(({ figures }) => (figures.activeHunters ? figures.totalHarvest / figures.activeHunters : 0))
    : null;
  const perHunterRanks = perHunterValues ? percentileRanks(perHunterValues) : null;
  const hunterRanks = withHunters ? percentileRanks(mapped.map(({ figures }) => figures.activeHunters)) : null;

  return mapped.flatMap((row, index) => {
    const designation = designationOf(row.wmu).toLowerCase();
    const common = {
      speciesId,
      jurisdictionId: "jurisdiction:ca-on",
      geographyId: zoneIdOf(row.wmu),
      geographyType: "MANAGEMENT_ZONE",
      sourceId,
      observationPeriod: { from: `${year}-01-01`, through: `${year}-12-31` },
      retrievedAt,
      verifiedAt: retrievedAt,
      confidence,
      methodology,
      spatialPrecision: "Ontario Wildlife Management Unit",
      version: String(year),
      superseded: false,
    };
    const records = [{
      ...common,
      id: `evidence:ca-on-wmu-${designation}-${slug}-harvest-${year}`,
      metric: "HARVEST_TOTAL",
      rawValue: row.figures.totalHarvest,
      normalizedValue: Number(harvestRanks[index].toFixed(6)),
      unit,
      notes: withHunters
        ? `${row.figures.totalHarvest} ${unit}; ${row.figures.activeHunters} estimated active resident hunters.`
        : `${row.figures.totalHarvest} ${unit}. The authority publishes no hunter count for this species, so no rate is derived.`,
    }];
    if (perHunterRanks && perHunterValues) {
      records.push({
        ...common,
        id: `evidence:ca-on-wmu-${designation}-${slug}-harvest-per-hunter-${year}`,
        metric: "HARVEST_PER_HUNTER",
        rawValue: Number(perHunterValues[index].toFixed(6)),
        normalizedValue: Number(perHunterRanks[index].toFixed(6)),
        unit: `${unit} per estimated active resident hunter`,
        notes: "Derived from the authority's estimated total harvest divided by its own estimated active resident hunters; not a hunter-success probability.",
      });
    }
    if (hunterRanks) {
      records.push({
        ...common,
        id: `evidence:ca-on-wmu-${designation}-${slug}-active-hunters-${year}`,
        metric: "HUNTER_COUNT",
        rawValue: row.figures.activeHunters,
        normalizedValue: Number(hunterRanks[index].toFixed(6)),
        unit: "estimated active resident hunters",
        notes: `${row.figures.activeHunters} estimated active resident hunters. This is hunting pressure, not animals, and it does not move the heat shade.`,
      });
    }
    return records;
  });
}

/** Every evidence id must name a unit the authority's own layer publishes. */
export function assertZonesExist(evidence) {
  for (const record of evidence) {
    const designation = record.geographyId.slice("management_zone:ca-on-wmu-".length).toUpperCase();
    if (!OFFICIAL_UNITS.has(designation)) {
      throw new Error(`Evidence names ${record.geographyId}, which the authority's layer does not publish`);
    }
  }
}

export async function fetchSource(url, fetcher = fetch) {
  const response = await fetcher(url, {
    headers: { "user-agent": "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Ontario harvest source returned HTTP ${response.status}`);
  /* The files are cp1252, not UTF-8. Decoding them as UTF-8 changes the bytes
     of every row carrying an accented place name and would change the hash. */
  return new TextDecoder("windows-1252").decode(await response.arrayBuffer());
}
