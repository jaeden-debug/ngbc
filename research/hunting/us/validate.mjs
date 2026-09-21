import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
let failures = 0;

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function parseCsv(path) {
  const text = readFileSync(path, 'utf8');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...body] = rows.filter((item) => item.some(Boolean));
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

const matrix = parseCsv(join(here, 'state-coverage-matrix.csv'));
const manifest = parseCsv(join(here, 'source-manifest.csv'));
const jurisdictions = parseCsv(join(root, 'jurisdictions.csv'));
const authorities = parseCsv(join(root, 'authorities.csv'));
const sources = parseCsv(join(root, 'regulatory-sources.csv'));

const expected = new Set(jurisdictions
  .filter(({ jurisdiction_id, jurisdiction_type }) => jurisdiction_id.startsWith('jurisdiction:us-') && jurisdiction_type !== 'FEDERAL')
  .map(({ jurisdiction_id }) => jurisdiction_id));
const actual = new Set(matrix.map(({ jurisdiction_id }) => jurisdiction_id));
const authorityIds = new Set(authorities.map(({ authority_id }) => authority_id));
const sourceIds = new Set(sources.map(({ source_id }) => source_id));
const waveOne = new Set(['us-ak', 'us-az', 'us-co', 'us-id', 'us-mt', 'us-nm', 'us-ut', 'us-wy'].map((id) => `jurisdiction:${id}`));

if (matrix.length !== 51) fail(`expected 51 state/district rows, found ${matrix.length}`);
if (actual.size !== matrix.length) fail('state matrix has duplicate jurisdiction IDs');
for (const id of expected) if (!actual.has(id)) fail(`missing matrix jurisdiction ${id}`);
for (const id of actual) if (!expected.has(id)) fail(`unexpected matrix jurisdiction ${id}`);

for (const row of matrix) {
  if (!authorityIds.has(row.authority_id)) fail(`${row.jurisdiction_id} references unknown authority ${row.authority_id}`);
  if (!sourceIds.has(row.regulatory_source_id)) fail(`${row.jurisdiction_id} references unknown source ${row.regulatory_source_id}`);
  if (waveOne.has(row.jurisdiction_id)) {
    if (row.research_depth !== 'WAVE_1_DEEP') fail(`${row.jurisdiction_id} lacks Wave 1 depth`);
    for (const field of ['regulatory_system', 'management_geographies', 'gis_status', 'required_dimensions', 'known_blockers', 'engine_gaps', 'fixture_candidates']) {
      if (!row[field] || row[field].includes('Pending state')) fail(`${row.jurisdiction_id} has incomplete ${field}`);
    }
  } else if (row.research_depth !== 'NATIONAL_DISCOVERY') fail(`${row.jurisdiction_id} overstates national discovery depth`);
  if (['READY', 'PRODUCTION_READY', 'SUPPORTED'].includes(row.implementation_readiness)) fail(`${row.jurisdiction_id} makes a production-readiness claim`);
}

const manifestKeys = new Set();
for (const row of manifest) {
  if (manifestKeys.has(row.source_key)) fail(`duplicate source key ${row.source_key}`);
  manifestKeys.add(row.source_key);
  if (!row.url.startsWith('https://')) fail(`${row.source_key} does not use an HTTPS URL`);
  if (!authorityIds.has(row.authority_id)) fail(`${row.source_key} references unknown authority ${row.authority_id}`);
}
for (const id of [...expected, 'jurisdiction:us-federal']) {
  if (!manifest.some(({ jurisdiction_id }) => jurisdiction_id === id)) fail(`source manifest has no row for ${id}`);
}

if (failures) process.exit(1);
console.log(`PASS: 51 state/district rows, ${manifest.length} source rows, 8 deep Wave 1 rows, all references valid.`);
