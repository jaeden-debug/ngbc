#!/usr/bin/env node
/**
 * Alberta's aerial ungulate survey densities, by Wildlife Management Unit.
 *
 *   node scripts/build-alberta-ungulate-density.mjs [--in .research/alberta-ungulate] [--check]
 *
 * WHAT IT READS. The text of every survey report the province publishes on its
 * open-data catalogue, as `fetch-alberta-ungulate-surveys.mjs` extracted it
 * with the pinned pypdf, each with its PDF's sha256 and its licence as the
 * catalogue states it.
 *
 * WHAT IT WRITES. One zone-evidence bundle per species
 * (`content/intelligence/ca-ab-<species>-aerial-survey.json`): for each unit,
 * the density the province estimated in its most recent survey, in animals per
 * km², with the abundance and its 90% confidence interval where published, the
 * survey period, the method, and the report it came from. A figure for a
 * whole unit, never painted (§41B): it is shown in the unit's card.
 *
 * HOW IT READS, AND WHAT IT REFUSES. The reports are written prose, and their
 * wording drifted over a decade. A figure is taken only from the report's
 * Results, only from a sentence whose wording a pattern below recognises, and
 * only for the species the sentence or its section heading names. It refuses:
 *
 *   - a sentence about a stratum or block rather than the unit;
 *   - a sentence that dates its figure to a year before the survey (a report's
 *     Results often restate the last survey);
 *   - a report covering several units — one density for a union is not a
 *     density for any member, so it is carried at the area it describes and
 *     never apportioned;
 *   - a report whose sentence names no species and sits under no heading.
 *
 * Every refusal and every report it could not read is listed with its reason
 * in `docs/research/alberta-ungulate-density-read.md`, so a gap is a record
 * rather than an absence. Every figure keeps the sentence it came from.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const IN = args.includes("--in") ? args[args.indexOf("--in") + 1] : ".research/alberta-ungulate";
const CHECK = args.includes("--check");
const OUT_DIR = "content/intelligence";
const REPORT = "docs/research/alberta-ungulate-density-read.md";
const CERTIFIED_UNITS = new Set(JSON.parse(readFileSync("content/regulatory/ca-ab-certified-units.json", "utf8")).certifiedUnits);

const SPECIES = [
  { id: "species:mule-deer", key: "mule-deer", heading: /^mule deer$/i, named: /\bmule deer\b/i, noun: "mule deer" },
  { id: "species:white-tailed-deer", key: "white-tailed-deer", heading: /^white[- ]tailed deer$/i, named: /\bwhite[- ]?tailed deer\b/i, noun: "white-tailed deer" },
  { id: "species:moose", key: "moose", heading: /^moose$/i, named: /\bmoose\b/i, noun: "moose" },
];

const OGLA = {
  licence: "Open Government Licence – Alberta",
  licenceUrl: "https://open.alberta.ca/licence",
  attribution: "Contains information licensed under the Open Government Licence – Alberta.",
};

/* ---------- reading one report ---------- */

/** The unit a report is about, or the several it covers. */
function unitsOf(title) {
  const t = title.replace(/\s+/g, " ");
  const m = t.match(/(?:Wildlife Management Units?|WMUs?)\s*([\d/,\s-]+?(?:\s*(?:and|&)\s*\d+)?)(?=\s|\(|:|$|[A-Za-z])/i);
  if (!m) return [];
  return [...m[1].matchAll(/\d{3}/g)].map((x) => x[0]);
}

/** The survey period as the title states it, and the latest year in it. */
function periodOf(title) {
  const years = [...title.matchAll(/(?:19|20)\d{2}(?:\s*[-–/]\s*\d{2,4})?/g)].map((m) => m[0].replace(/\s+/g, ""));
  if (!years.length) return null;
  const last = years.at(-1);
  const parts = last.split(/[-–/]/);
  let endYear = Number(parts[0]);
  if (parts[1]) endYear = parts[1].length === 2 ? Number(`${parts[0].slice(0, 2)}${parts[1]}`) : Number(parts[1]);
  return { statedAs: last, startYear: Number(parts[0]), endYear };
}

const number = (s) => Number(String(s).replace(/,/g, ""));

/** Results, as lines, and the species heading in force at each line. */
function resultsOf(pages) {
  /* The page footer lands mid-sentence wherever a page breaks. */
  const footer = /^(More reports online at\b|©\s*\d{4} Government of Alberta|Classification:\s*Public\s*$)/i;
  const lines = pages.join("\n").split("\n").map((line) => line.trim()).filter((line) => !footer.test(line));
  const start = lines.findIndex((line) => /^results\b/i.test(line));
  if (start < 0) return null;
  const end = lines.findIndex((line, i) => i > start && /^(discussion|management (implications|recommendations)|literature cited|references|acknowledg)/i.test(line));
  return lines.slice(start + 1, end > 0 ? end : undefined);
}

/**
 * Sentences with the species heading each sits under. pypdf breaks lines at
 * the column edge, so text is re-flowed between headings before splitting.
 */
function sentencesOf(results) {
  const out = [];
  let heading = null;
  let buffer = [];
  const flush = () => {
    const text = buffer.join(" ").replace(/\s+/g, " ").replace(/(\w)- (\w)/g, "$1$2");
    const sentences = text.split(/(?<=[.])\s+(?=[A-Z])/).map((sentence) => sentence.trim());
    sentences.forEach((sentence, i) => {
      /* Where a report has no species headings, the paragraph names its subject
         in the sentences before the figure ("we observed 679 mule deer …"). Taken
         only when exactly one species is named in the three before it. */
      const named = new Set(sentences.slice(Math.max(0, i - 3), i).flatMap((before) => SPECIES.filter((sp) => sp.named.test(before))));
      out.push({ heading, context: named.size === 1 ? [...named][0] : null, sentence, next: sentences[i + 1] ?? "" });
    });
    buffer = [];
  };
  for (const line of results) {
    const species = SPECIES.find((s) => s.heading.test(line));
    if (species) { flush(); heading = species; continue; }
    /* Another species' section ends the last one: nothing under "Elk" inherits "Moose". */
    if (/^(elk|pronghorn|bighorn sheep|mountain goats?|bison|wood bison|other (?:species|wildlife|observations))$/i.test(line)) { flush(); heading = null; continue; }
    buffer.push(line);
  }
  flush();
  return out;
}

const DENSITY = /\bdensity\b(?:\s+estimate)?(?:\s+in\s+(?:WMU|Wildlife Management Unit)\s*\d+)?\s+(?:was|of|is)\s+(?:estimated\s+(?:to\s+be|at)\s+)?(\d*\.\d+|\d+)\s*(mule deer|white[- ]tailed deer|deer|moose|individuals|animals)?\s*(?:\/|per)\s*km\s*(?:2|²)/i;
/* A second figure in the same sentence: "… 2.10 mule deer per km2 and 1.17 white-tailed deer per km2". */
const ALSO = /^\s*and\s+(\d*\.\d+|\d+)\s+(mule deer|white[- ]tailed deer|moose)\s*(?:\/|per)\s*km\s*(?:2|²)/i;
/* The density's own 90% interval, before the abundance clause begins: "(90% CI 0.58 – 0.90)",
   "(90% CI 1.785–2.626; CV=0.117)", "with a CV of 17.3% (90% CI 0.43 – 0.75)",
   "(CV 0.17, 90% CI 0.068 - 0.117)", "(90% Confidence Interval (CI) 0.509– 0.765; …)",
   "log-based 90% confidence interval of (0.274, 0.452)". */
const DENSITY_CI = /90\s*(?:%|per cent)\s*(?:confidence interval|CI)(?:\s*\(CI\))?(?:\s+of)?\s*:?\s*\(?\s*(\d*\.\d+)(?:\s*\/\s*km\s*2)?\s*(?:[–,-]|to)\s*(\d*\.\d+)/i;
/* The authority's own statement that it could not estimate. */
const NOT_ESTIMATED = /insufficient to (?:calculate|estimate)|not (?:enough|sufficient|suitable) to estimate|too few [a-z ]+ to estimate/i;
const ABUNDANCE = /\b(?:abundance|population)\s+(?:was|of|is)\s+([\d,]+)\s*(?:individuals|moose|deer|mule deer|white[- ]?tailed deer)?[^()]*?\((?:90%|90 per cent)\s*CI\s*\(?([\d,]+)\s*[–-]\s*([\d,]+)/i;
const ABUNDANCE_BARE = /\b(?:abundance|population)\s+(?:was|of|is)\s+([\d,]+)\s*(?:individuals|moose|deer|mule deer|white[- ]?tailed deer)?/i;
/* The authority says its figure is for part of the unit. */
const PORTION = /\bportion\b|\bpart of (?:the )?(?:WMU|unit)\b|\bnon-alpine\b/i;

/** An interval is shown only when it contains its own estimate; a transposed or mistyped one is refused. */
const holds = (ci, value) => Boolean(ci) && ci[0] <= value && value <= ci[1];

/** The clause the figure is in, not the bullet list pypdf ran into it. */
function clauseOf(sentence, at) {
  const starts = [...sentence.slice(0, at).matchAll(/(?:^|\s)(The |Estimated |Using |Moose |In the |This )/g)];
  return sentence.slice(starts.length ? starts.at(-1).index : 0).trim();
}

function readReport(pkg, texts) {
  const period = periodOf(pkg.title);
  /* A report that surveys one species names it in its title ("… survey for moose"). */
  const titled = SPECIES.filter((s) => s.named.test(pkg.title));
  const titleSpecies = titled.length === 1 && !/ungulate survey(?! for)/i.test(pkg.title) ? titled[0] : null;
  const units = unitsOf(pkg.title);
  const found = [];
  const refused = [];
  for (const text of texts) {
    const results = resultsOf(text.pages);
    if (!results) { refused.push({ reason: "no Results section" }); continue; }
    for (const { heading, context, sentence, next } of sentencesOf(results)) {
      const d = sentence.match(DENSITY);
      if (!d) continue;
      const before = sentence.slice(0, d.index);
      const named = SPECIES.filter((s) => s.named.test(before) || (d[2] && s.named.test(d[2])));
      const generic = named.length === 0 && (!d[2] || /^(deer|individuals|animals)$/i.test(d[2]));
      const species = named.length === 1 ? named[0] : generic ? heading ?? context ?? titleSpecies : null;
      /* How the species was attributed, kept on the record for audit. */
      const attributedBy = named.length === 1 ? "NAMED_IN_SENTENCE" : heading ? "SECTION_HEADING" : context ? "PARAGRAPH_SUBJECT" : "REPORT_TITLE";
      if (!species) { refused.push({ reason: "names no single species", sentence }); continue; }
      if (/\bstrat(um|a)\b|\bblock\b/i.test(sentence)) { refused.push({ species: species.key, reason: "a stratum or block, not the unit", sentence }); continue; }
      const earlier = [...before.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1])).filter((y) => period && y < period.startYear);
      if (earlier.length) { refused.push({ species: species.key, reason: `dated to ${earlier[0]}, before the survey`, sentence }); continue; }
      if (found.some((f) => f.species === species)) continue;
      const clauseEnd = (() => { const i = sentence.slice(d.index + d[0].length).search(/\band\s+(?:the\s+)?estimated\s+(?:abundance|population)|\band\s+t\s?he\s+estimated/i); return i < 0 ? sentence.length : d.index + d[0].length + i; })();
      const ciText = sentence.slice(d.index + d[0].length, clauseEnd).match(DENSITY_CI);
      const density = number(d[1]);
      const ci = ciText ? [number(ciText[1]), number(ciText[2])] : null;
      const ab = sentence.match(ABUNDANCE);
      /* "… density was estimated at 0.71 individuals/km2. Population was estimated at 1883 (Table 3)". */
      const following = ab ? null : next.match(/^(?:The\s+)?(?:estimated\s+)?(?:[a-z -]+\s+)?(?:population|abundance)\s+(?:was\s+estimated\s+at|is|was|of)\s+([\d,]+)/i);
      const bare = ab ? null : sentence.match(ABUNDANCE_BARE) ?? following;
      const abundance = ab ? number(ab[1]) : bare ? number(bare[1]) : null;
      const abundanceCi = ab ? [number(ab[2]), number(ab[3])] : null;
      found.push({
        species,
        attributedBy,
        density,
        /* As the report prints them: 2.10 is not 2.1, and 0.90 is not 0.9. */
        printed: { density: d[1], ci: ciText ? [ciText[1], ciText[2]] : null },
        densityCi: holds(ci, density) ? ci : null,
        refusedCi: ci && !holds(ci, density) ? ci : null,
        abundance,
        abundanceCi: abundance !== null && holds(abundanceCi, abundance) ? abundanceCi : null,
        portion: PORTION.test(sentence),
        sentence: clauseOf(sentence, d.index),
        resource: text,
      });
      /* A second species in the same sentence. */
      const also = sentence.slice(d.index + d[0].length).match(ALSO);
      if (also) {
        const other = SPECIES.find((s) => s.named.test(also[2]));
        if (other && !found.some((f) => f.species === other)) {
          found.push({ species: other, attributedBy: "NAMED_IN_SENTENCE", printed: { density: also[1], ci: null }, density: number(also[1]), densityCi: null, refusedCi: null, abundance: null, abundanceCi: null, portion: PORTION.test(sentence), sentence: clauseOf(sentence, d.index), resource: text });
        }
      }
    }
  }
  for (const f of found) {
    f.tableDensity = tableDensityFor(texts, f.abundance);
    f.conflict = f.tableDensity !== null && disagrees(f.density, f.tableDensity);
  }
  const declined = texts.some((text) => NOT_ESTIMATED.test(text.pages.join(" ").replace(/\s+/g, " ")));
  return { period, units, found, refused, declined };
}

/**
 * The same survey in the report's own results table: the row carrying the same
 * abundance, then its interval, then its density. Keyed by abundance because
 * the tables list earlier surveys too, and a year alone would match those.
 */
function tableDensityFor(texts, abundance) {
  if (abundance === null) return null;
  const flat = texts.map((text) => text.pages.join(" ")).join(" ").replace(/\s+/g, " ");
  const n = String(abundance);
  const forms = [n, Number(abundance).toLocaleString("en-CA")].map((form) => form.replace(/,/g, ",?"));
  for (const form of forms) {
    const row = flat.match(new RegExp(`(?<![\\d.,])${form}\\s*\\(\\s*[\\d,]+\\s*[–-]\\s*[\\d,]+\\s*\\)\\s*(\\d*\\.\\d+)`));
    /* Some tables put the standard error after the interval, not the density.
       A density implies an area, abundance ÷ density, and a unit is between a
       hundred and thirty thousand km²; a standard error implies a few km². */
    if (row && Number(row[1]) > 0 && abundance / Number(row[1]) >= 100 && abundance / Number(row[1]) <= 30000) return Number(row[1]);
  }
  return null;
}

/** A difference beyond the rounding of two published figures is the authority disagreeing with itself. */
const disagrees = (a, b) => Math.abs(a - b) > 0.011 && Math.abs(a - b) / Math.max(a, b) > 0.02;

/* ---------- the catalogue ---------- */

const index = JSON.parse(readFileSync(join(IN, "index.json"), "utf8"));
const surveys = index.packages.filter((pkg) => /(WMU|Wildlife Management Unit)/i.test(pkg.title) && /ungulate|moose|deer/i.test(pkg.title) && !/composition|protocol|manual/i.test(pkg.title));

const readings = [];
for (const pkg of surveys) {
  const texts = pkg.resources.filter((r) => r.textFile).map((r) => ({ ...JSON.parse(readFileSync(join(IN, r.textFile), "utf8")), resourceId: r.id }));
  readings.push({ pkg, ...readReport(pkg, texts) });
}

/* Latest survey per unit and species; several units in one report are held apart. */
const latest = new Map();
const larger = [];
const unread = [];
for (const reading of readings) {
  const { pkg, period, units, found, refused, declined } = reading;
  if (!period) { unread.push({ title: pkg.title, reason: "the title states no survey year" }); continue; }
  if (!units.length) { unread.push({ title: pkg.title, reason: "the title names no unit" }); continue; }
  if (!found.length) {
    unread.push({ title: pkg.title, reason: declined ? "the report says its data were insufficient to estimate a density" : refused[0]?.reason ?? "no density sentence in a recognised form" });
    continue;
  }
  if (units.length > 1) { larger.push({ title: pkg.title, units, period, found }); continue; }
  const unit = units[0];
  if (!CERTIFIED_UNITS.has(unit)) { unread.push({ title: pkg.title, reason: `unit ${unit} is not in Alberta's certified unit list` }); continue; }
  for (const f of found) {
    const key = `${f.species.key}|${unit}`;
    const held = latest.get(key);
    if (!held || held.period.endYear < period.endYear) latest.set(key, { unit, period, pkg, f, supersedes: held ? [...held.supersedes, held] : [] });
    else held.supersedes.push({ unit, period, pkg, f });
  }
}

/* ---------- bundles ---------- */

const RETRIEVED = index.retrievedAt;
const bundles = [];
for (const species of SPECIES) {
  const rows = [...latest.values()].filter((row) => row.f.species === species).sort((a, b) => a.unit.localeCompare(b.unit));
  if (!rows.length) continue;
  /* Only a whole-unit figure the report states consistently is ranked. */
  const rankable = (f) => !f.portion && !f.conflict;
  const densities = rows.filter((row) => rankable(row.f)).map((row) => row.f.density).sort((a, b) => a - b);
  const rank = (value) => densities.length === 1 ? 0.5 : ((densities.indexOf(value) + densities.lastIndexOf(value)) / 2) / (densities.length - 1);
  const evidence = rows.map((row) => {
    const { f, period, pkg, unit } = row;
    const resource = pkg.resources.find((r) => r.id === f.resource.resourceId);
    const figures = [
      `${f.printed.density} ${species.noun} per km²${f.densityCi ? ` (90% CI ${f.printed.ci[0]}–${f.printed.ci[1]})` : ""}`,
      f.abundance !== null ? `an estimated ${f.abundance.toLocaleString("en-CA")} in the unit${f.abundanceCi ? ` (90% CI ${f.abundanceCi[0].toLocaleString("en-CA")}–${f.abundanceCi[1].toLocaleString("en-CA")})` : ""}` : null,
    ].filter(Boolean).join("; ");
    const scope = f.portion ? " Estimated for the part of the unit the survey flew, not the whole unit." : "";
    const conflict = f.conflict ? ` The report states ${f.printed.density} in its text and ${f.tableDensity} in its results table for the same survey; North Ground shows both and ranks neither.` : "";
    const refused = f.refusedCi ? ` The report's stated interval (${f.printed.ci[0]}–${f.printed.ci[1]}) does not contain its estimate, so it is not shown.` : "";
    return {
      id: `evidence:ca-ab-wmu-${unit}-${species.key}-aerial-survey-${period.endYear}`,
      speciesId: species.id,
      jurisdictionId: "jurisdiction:ca-ab",
      geographyId: `management_zone:ca-ab-wmu-${unit}`,
      geographyType: "MANAGEMENT_ZONE",
      sourceId: `source:ca-ab-aerial-survey-${pkg.name}`,
      metric: "POPULATION_DENSITY",
      rawValue: f.density,
      ...(rankable(f) ? { normalizedValue: Number(rank(f.density).toFixed(6)) } : {}),
      unit: `${species.noun} per km²`,
      methodology: "Alberta's winter aerial survey of the unit; the report states its method and how the estimate and interval were computed.",
      observationPeriod: { from: `${period.startYear}-01-01`, through: `${period.endYear}-12-31` },
      retrievedAt: RETRIEVED,
      verifiedAt: RETRIEVED,
      confidence: f.portion || f.conflict ? "LOW" : f.densityCi || f.abundanceCi ? "MODERATE" : "LOW",
      spatialPrecision: "Alberta Wildlife Management Unit",
      notes: `${figures}. Aerial survey, ${period.statedAs}.${scope}${refused}${conflict}`,
      version: period.statedAs,
      superseded: false,
      statedAs: f.sentence,
      speciesAttributedBy: f.attributedBy,
      tableCheck: f.tableDensity === null ? "NO_TABLE_ROW" : f.conflict ? "CONFLICT" : "AGREES",
      ...(f.conflict ? { tableValue: f.tableDensity } : {}),
      report: {
        title: pkg.title,
        url: pkg.catalogueUrl,
        resourceUrl: resource?.url ?? null,
        sourceHash: resource?.sha256 ?? null,
        licence: pkg.licenceId === "OGLA" ? OGLA.licence : pkg.licenceTitle,
      },
      earlierSurveys: row.supersedes.map((s) => ({ title: s.pkg.title, density: s.f.density, period: s.period.statedAs })),
    };
  });
  const bundle = {
    schemaVersion: 1,
    /* The within-dataset percentile rank every bundle uses; the weighting on top is the endpoint's. */
    methodologyVersion: "opportunity-v1",
    speciesId: species.id,
    jurisdictionId: "jurisdiction:ca-ab",
    source: {
      id: `source:ca-ab-aerial-ungulate-surveys-${species.key}`,
      authority: "Government of Alberta",
      title: "Aerial wildlife survey reports",
      url: "https://www.alberta.ca/aerial-wildlife-survey-reports",
      resourceUrl: "https://open.alberta.ca/api/3/action/package_search",
      licence: OGLA.licence,
      licenceUrl: OGLA.licenceUrl,
      attribution: OGLA.attribution,
      sourceHash: `reports:${rows.length}`,
      retrievedAt: RETRIEVED,
      verifiedAt: RETRIEVED,
    },
    coverage: "PARTIAL_DATA",
    latestObservationYear: Math.max(...rows.map((row) => row.period.endYear)),
    seasonalBasis: {
      observedSeason: "winter (aerial surveys are flown in December to March)",
      matchesHuntingSeason: false,
      warning: "Counted from the air in winter, after the hunting season; a unit's autumn numbers can differ.",
    },
    limitations: [
      "One figure for the whole unit: it cannot say where inside the unit the animals are, so it is never painted on the map.",
      "Each unit's figure is from its own most recent survey; surveys are years apart, and the year is stated with each figure.",
      "The estimate is the province's, with its confidence interval where the report publishes one; North Ground does not recompute it.",
      "Density is not a hunting opportunity and says nothing about whether hunting is open, legal or permitted here.",
      "Units without a survey report North Ground could read carry no figure; no figure is not a low figure.",
    ],
    evidence,
  };
  bundles.push({ path: join(OUT_DIR, `ca-ab-${species.key}-aerial-survey.json`), text: `${JSON.stringify(bundle, null, 2)}\n` });
}

/* ---------- what was not read, said ---------- */

const lines = [
  "# Alberta aerial ungulate survey densities — what was read",
  "",
  "Generated by `scripts/build-alberta-ungulate-density.mjs` from the reports on",
  `Alberta's open-data catalogue (retrieved ${RETRIEVED}). Every report is under the Open Government Licence – Alberta.`,
  "",
  `**${surveys.length} survey reports; ${latest.size} unit×species figures served** (${SPECIES.map((s) => `${s.noun} ${[...latest.values()].filter((r) => r.f.species === s).length}`).join(", ")}).`,
  "",
  `**Checked against each report's own results table** (the row with the same abundance): ${[...latest.values()].filter((r) => r.f.tableDensity !== null && !r.f.conflict).length} agree, ${[...latest.values()].filter((r) => r.f.conflict).length} disagree beyond rounding, ${[...latest.values()].filter((r) => r.f.tableDensity === null).length} have no matching row.`,
  "",
  "## Where a report disagrees with itself (both shown, neither ranked)",
  "",
  ...[...latest.values()].filter((r) => r.f.conflict).map((r) => `- WMU ${r.unit}, ${r.f.species.noun}, ${r.period.statedAs}: text ${r.f.density}/km², table ${r.f.tableDensity}/km² — ${r.pkg.title}`),
  "",
  "## Several units in one report (carried at that area, never apportioned)",
  "",
  ...larger.map((row) => `- ${row.title}: ${row.found.map((f) => `${f.species.noun} ${f.density}/km²`).join(", ")}`),
  "",
  "## Reports not read, and why",
  "",
  ...unread.map((row) => `- ${row.title} — ${row.reason}`),
  "",
];

if (CHECK) {
  let stale = false;
  for (const { path, text } of bundles) if (readFileSync(path, "utf8") !== text) { stale = true; process.stderr.write(`${path} is not what the builder produces\n`); }
  process.exit(stale ? 1 : 0);
}
for (const { path, text } of bundles) writeFileSync(path, text);
writeFileSync(REPORT, lines.join("\n"));
process.stdout.write(`${surveys.length} reports; ${latest.size} unit×species figures; ${larger.length} multi-unit; ${unread.length} not read\n`);
