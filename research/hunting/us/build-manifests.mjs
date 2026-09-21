import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const reviewedAt = '2026-09-20';

function parseCsv(text) {
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

function csv(rows, columns) {
  const escape = (value) => {
    const string = String(value ?? '');
    return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
  };
  return `${columns.join(',')}\n${rows.map((row) => columns.map((column) => escape(row[column])).join(',')).join('\n')}\n`;
}

const jurisdictions = parseCsv(readFileSync(join(root, 'jurisdictions.csv'), 'utf8'))
  .filter(({ jurisdiction_id }) => jurisdiction_id.startsWith('jurisdiction:us-'));
const authorities = parseCsv(readFileSync(join(root, 'authorities.csv'), 'utf8'));
const regulatorySources = parseCsv(readFileSync(join(root, 'regulatory-sources.csv'), 'utf8'))
  .filter(({ jurisdiction_id }) => jurisdiction_id.startsWith('jurisdiction:us-'));

const authorityById = new Map(authorities.map((row) => [row.authority_id, row]));
const hubByJurisdiction = new Map(regulatorySources
  .filter(({ source_id }) => !['source:us-fws-migratory', 'source:us-fws-refuge-hunting'].includes(source_id))
  .map((row) => [row.jurisdiction_id, row]));

const waveOne = {
  'jurisdiction:us-ak': {
    regulatory_system: 'GMU/subunit + species + hunt number/type + residency + permit/harvest ticket + subsistence overlay',
    management_geographies: 'Game Management Units and subunits; controlled-use/closed/management areas; federal subsistence areas',
    regulation_formats: 'HTML hub; annual PDFs by GMU; hunt-number web views; emergency orders',
    gis_status: 'OFFICIAL_DOWNLOAD_PAGE_FOUND_SERVICE_UNRESOLVED',
    gis_legal_standing: 'Map guidance; current regulations, legal descriptions, and emergency orders control',
    gis_licensing: 'UNRESOLVED',
    required_dimensions: 'species; regulatory class; sex/age; GMU/subunit; hunt number/type; residency; permit type; season; method; bag period; subsistence eligibility; emergency order',
    federal_land_dependencies: 'USFWS refuges; NPS units; BLM/USFS access; federal subsistence regime',
    known_blockers: 'No stable feature-service contract certified; state/federal subsistence conflicts require separate authority scopes; emergency orders are mutable',
    implementation_readiness: 'RESEARCH_DEEP_SOURCE_CONTRACT_BLOCKED',
    engine_compatibility: 'PARTIAL_MAJOR_EXTENSION',
    engine_gaps: 'hunt identifiers; residency/eligibility; permit and harvest-ticket classes; emergency-order precedence; dual state/federal subsistence authority',
    annual_artifact: 'Annual statewide/GMU regulation PDFs plus permit supplements and emergency orders',
    monitor_strategy: 'Version annual artifacts; poll emergency-order index; diff hunt-number tables and GMU legal descriptions',
    fixture_candidates: 'GMU 1 black bear general vs permit hunt; GMU 26 resident/nonresident split; federal subsistence overlap',
  },
  'jurisdiction:us-co': {
    regulatory_system: 'Species brochure + 8-character hunt code + limited/OTC license + primary/secondary draw',
    management_geographies: 'Game Management Units; species-specific hunt-code unit sets; Ranching for Wildlife/private-land programs',
    regulation_formats: 'HTML hub; annual PDF brochures; corrections pages; draw pages',
    gis_status: 'OFFICIAL_PORTAL_FOUND_LAYER_CONTRACT_UNRESOLVED',
    gis_legal_standing: 'Planning map; brochure, regulations, license, and hunt code govern',
    gis_licensing: 'PORTAL_TERMS_REVIEW_REQUIRED',
    required_dimensions: 'species; sex; GMU/unit set; season; method; hunt code; license list; residency; draw; quota; private-land program',
    federal_land_dependencies: 'USFS/BLM access; NPS and refuge closures; wilderness/access constraints',
    known_blockers: 'Hunt-code tables and post-publication corrections need structured diffing; GIS layer/version and reuse terms not certified',
    implementation_readiness: 'RESEARCH_DEEP_PARSER_AND_GIS_BLOCKED',
    engine_compatibility: 'PARTIAL_MAJOR_EXTENSION',
    engine_gaps: 'first-class hunt code; quota/draw lifecycle; multi-unit hunts; license lists; correction precedence',
    annual_artifact: 'Species-specific annual brochures and correction notices',
    monitor_strategy: 'Pin brochure versions; poll corrections; parse and diff hunt-code tables',
    fixture_candidates: 'D-M-014-E1-R hunt-code decomposition; limited vs OTC elk; brochure correction supersession',
  },
  'jurisdiction:us-wy': {
    regulatory_system: 'Species-specific hunt area + license type + quota/limitation + season chapter',
    management_geographies: 'Species-specific hunt areas; nonresident regions; HMAs/WHMAs/walk-in areas; wilderness overlays',
    regulation_formats: 'HTML regulation index; chapter PDFs; species maps; brochures; access-area rules',
    gis_status: 'OFFICIAL_MAPS_FOUND_DOWNLOAD_CONTRACT_UNRESOLVED',
    gis_legal_standing: 'Written hunt-area descriptions are authoritative; maps state they are general reference',
    gis_licensing: 'UNRESOLVED',
    required_dimensions: 'species; hunt area; license type; quota; sex/age class; season; method; residency; special permit; access property',
    federal_land_dependencies: 'National Elk Refuge; USFS/BLM; wilderness guide rule for nonresidents; refuge permits',
    known_blockers: 'Species-specific geometries cannot be replaced by one statewide unit layer; written descriptions must be retained and versioned',
    implementation_readiness: 'RESEARCH_DEEP_LEGAL_GEOMETRY_BLOCKED',
    engine_compatibility: 'PARTIAL_MAJOR_EXTENSION',
    engine_gaps: 'species-specific geography versions; license types and quotas; property permission; written-description authority',
    annual_artifact: 'Species season chapters, maps, brochures, and access-property rules',
    monitor_strategy: 'Diff chapter rules and written boundaries; treat map changes as advisory until reconciled',
    fixture_candidates: 'elk Area 77 + National Elk Refuge permit; limited-quota vs general region; species-specific area mismatch',
  },
  'jurisdiction:us-mt': {
    regulatory_system: 'Species regulations + hunting district + license/permit + drawing + species exceptions',
    management_geographies: 'Species hunting districts; administrative regions; Block Management Areas and access overlays',
    regulation_formats: 'HTML hub; annual species PDFs; separately adopted legal descriptions; interactive planner',
    gis_status: 'OFFICIAL_PLANNER_AND_GIS_PAGE_FOUND_SERVICE_REVIEW_REQUIRED',
    gis_legal_standing: 'Planner is guidance; regulations and commission-adopted legal descriptions control',
    gis_licensing: 'UNRESOLVED',
    required_dimensions: 'species; hunting district; license/permit; residency; draw; season; method; sex/age class; access program',
    federal_land_dependencies: 'USFS/BLM access; refuge-specific rules; tribal jurisdiction boundaries',
    known_blockers: 'District geometry is species-dependent; legal descriptions are separately versioned; planner disclaimer prevents legal substitution',
    implementation_readiness: 'RESEARCH_DEEP_GEOMETRY_VERSION_BLOCKED',
    engine_compatibility: 'PARTIAL_MAJOR_EXTENSION',
    engine_gaps: 'species-to-district geometry binding; permit/draw identifiers; legal-description versioning; access overlays',
    annual_artifact: 'Species booklets and annual hunting-district legal descriptions',
    monitor_strategy: 'Version commission-adopted boundaries and species booklets; diff planner only as a secondary signal',
    fixture_candidates: 'deer/elk district with license exception; district legal-description revision; Block Management access overlay',
  },
  'jurisdiction:us-id': {
    regulatory_system: 'Game unit/elk zone + general or controlled hunt + hunt number + tag + weapon class',
    management_geographies: 'Game Management Units; Elk Zones; Controlled Hunt Areas; Access Yes properties',
    regulation_formats: 'Interactive hunt planner; annual PDF rules; filterable grids; downloadable shapefile/KML links',
    gis_status: 'OFFICIAL_DOWNLOADS_ADVERTISED_DIRECT_ASSETS_REQUIRE_CERTIFICATION',
    gis_legal_standing: 'Planner warns users to verify against current regulation-booklet boundaries',
    gis_licensing: 'UNRESOLVED',
    required_dimensions: 'species; GMU/zone; controlled hunt number; tag; weapon; season; sex/age; residency; draw odds/quota; land program',
    federal_land_dependencies: 'USFWS refuge special rules; USFS/BLM access; tribal jurisdiction',
    known_blockers: 'Controlled-hunt areas may be portions/combinations of units; downloadable dataset version and license need capture',
    implementation_readiness: 'RESEARCH_DEEP_DOWNLOAD_CERTIFICATION_BLOCKED',
    engine_compatibility: 'PARTIAL_MAJOR_EXTENSION',
    engine_gaps: 'controlled-hunt ID and unit expressions; elk-zone parallel geography; tags/quotas/draw; species-specific partial units',
    annual_artifact: 'Big-game season/rule PDFs plus hunt-planner datasets',
    monitor_strategy: 'Archive PDF and downloadable boundary snapshot; diff controlled-hunt table by hunt number',
    fixture_candidates: 'controlled hunt 1144 multi-date restrictions; elk zone vs GMU; partial-unit boundary',
  },
  'jurisdiction:us-ut': {
    regulatory_system: 'Hunt/permit code + species + unit/boundary + general/limited-entry/CWMU + draw',
    management_geographies: 'Species hunt units; limited-entry and antlerless boundaries; CWMUs; extended-archery areas',
    regulation_formats: 'Versioned PDF guidebooks; correction log; interactive hunt-boundary application; mobile permit maps',
    gis_status: 'OFFICIAL_INTERACTIVE_BOUNDARIES_FOUND_DOWNLOAD_AND_TERMS_UNRESOLVED',
    gis_legal_standing: 'Guidebooks summarize statute/rules; legal rules and current boundary descriptions govern',
    gis_licensing: 'UNRESOLVED',
    required_dimensions: 'species; hunt code; unit; permit class; sex/age; season; method; draw; CWMU/private land; correction version',
    federal_land_dependencies: 'USFS/BLM; refuge/park restrictions; tribal land permissions',
    known_blockers: 'Guidebooks receive dated corrections; CWMU and extended-archery geometries are independent overlays; boundary API not certified',
    implementation_readiness: 'RESEARCH_DEEP_API_AND_CORRECTIONS_BLOCKED',
    engine_compatibility: 'PARTIAL_MAJOR_EXTENSION',
    engine_gaps: 'hunt/permit codes; program-specific geometry; corrections ledger; draw and private-land eligibility',
    annual_artifact: 'Versioned application and field guidebooks plus correction entries',
    monitor_strategy: 'Poll version and corrections metadata; snapshot boundary descriptions and map service',
    fixture_candidates: 'deleted CWMU hunt correction; extended-archery overlay; general vs limited-entry permit',
  },
  'jurisdiction:us-az': {
    regulatory_system: 'GMU + four-digit hunt number + permit-tag/nonpermit-tag + draw + season/order',
    management_geographies: 'Game Management Units and species hunt areas; six administrative regions; special access/closure areas',
    regulation_formats: 'HTML hub; annual hunting and draw booklets; draw-process pages; unit pages/maps',
    gis_status: 'OFFICIAL_UNIT_MAPS_FOUND_DOWNLOAD_SERVICE_UNRESOLVED',
    gis_legal_standing: 'Planning/unit maps; commission orders, regulations, and permit-tag conditions govern',
    gis_licensing: 'UNRESOLVED',
    required_dimensions: 'species; hunt number; GMU/area; permit-tag class; draw; bonus points; season; method; sex/age; residency; quota',
    federal_land_dependencies: 'USFS/BLM; National Wildlife Refuges; tribal lands; border/military access constraints',
    known_blockers: 'Commission orders and draw booklets must be composed; unit-map service and reuse terms not certified',
    implementation_readiness: 'RESEARCH_DEEP_ORDER_AND_GIS_BLOCKED',
    engine_compatibility: 'PARTIAL_MAJOR_EXTENSION',
    engine_gaps: 'hunt number; permit-tag taxonomy; commission-order precedence; bonus-point/draw metadata',
    annual_artifact: 'Annual regulations/draw booklet and species commission orders',
    monitor_strategy: 'Version booklets and orders; diff hunt-number tables and corrections',
    fixture_candidates: 'four-digit draw hunt; nonpermit-tag opportunity; same GMU with species/order differences',
  },
  'jurisdiction:us-nm': {
    regulatory_system: 'GMU + hunt code/license + draw or private-land authorization + species program',
    management_geographies: 'Game Management Units; species ranges; EPLUS/private-land units; Open Gate and state/federal/tribal land overlays',
    regulation_formats: 'Annual PDF rule book; publication hub; unit PDFs; interactive maps; dated shapefile/KMZ download',
    gis_status: 'OFFICIAL_SHAPEFILE_AND_KMZ_FOUND_STALE_2017',
    gis_legal_standing: 'Statewide map says not for precise boundaries; rules and unit descriptions control',
    gis_licensing: 'UNRESOLVED',
    required_dimensions: 'species; GMU; hunt code; license type; draw; season; method; sex/age; residency; land status; private-land authorization',
    federal_land_dependencies: 'BLM/USFS; Valles Caldera/NPS; refuges; tribal licenses and lawful-possession documentation',
    known_blockers: 'Published downloadable GMU data is dated October 2017; private-land systems and tribal authority cannot be inferred from GMU',
    implementation_readiness: 'RESEARCH_DEEP_STALE_GIS_AND_LAND_BLOCKED',
    engine_compatibility: 'PARTIAL_MAJOR_EXTENSION',
    engine_gaps: 'hunt code/license; private-land authorization; land/tribal scope; dated geometry provenance',
    annual_artifact: 'Annual Hunting Rules and Information PDF plus unit descriptions and program pages',
    monitor_strategy: 'Archive rule book; compare legal descriptions against dated GIS; monitor EPLUS and land-access rule changes',
    fixture_candidates: 'GMU 48 description vs GIS; EPLUS private-land elk; tribal-land lawful-possession boundary',
  },
};

const matrixRows = jurisdictions
  .filter(({ jurisdiction_type }) => jurisdiction_type !== 'FEDERAL')
  .map((jurisdiction) => {
    const deep = waveOne[jurisdiction.jurisdiction_id];
    const hub = hubByJurisdiction.get(jurisdiction.jurisdiction_id);
    const isDc = jurisdiction.jurisdiction_id === 'jurisdiction:us-dc';
    return {
      jurisdiction_id: jurisdiction.jurisdiction_id,
      subdivision_code: jurisdiction.subdivision_code,
      jurisdiction_name: jurisdiction.name_en,
      authority_id: jurisdiction.primary_authority_id,
      regulatory_source_id: hub?.source_id ?? '',
      research_depth: deep ? 'WAVE_1_DEEP' : 'NATIONAL_DISCOVERY',
      regulatory_system: deep?.regulatory_system ?? (isDc ? 'No ordinary recreational hunting program established' : 'State rules and annual seasons; detailed system not yet decomposed'),
      management_geographies: deep?.management_geographies ?? (jurisdiction.official_management_term || 'UNRESOLVED'),
      regulation_formats: deep?.regulation_formats ?? (hub?.format || 'UNRESOLVED'),
      gis_status: deep?.gis_status ?? (isDc ? 'NOT_APPLICABLE_PENDING_AUTHORITY_REVIEW' : 'NOT_CERTIFIED'),
      gis_legal_standing: deep?.gis_legal_standing ?? 'UNRESOLVED',
      gis_licensing: deep?.gis_licensing ?? 'UNRESOLVED',
      required_dimensions: deep?.required_dimensions ?? 'species; regulatory class; geography; season; method; bag; license/permit; residency; land status — state decomposition required',
      federal_land_dependencies: deep?.federal_land_dependencies ?? 'Migratory-bird framework and federal-land/refuge rules; state-specific dependency inventory pending',
      known_blockers: deep?.known_blockers ?? (isDc ? 'Confirm statutory prohibition/absence and any controlled wildlife-management exceptions' : 'Annual artifact, authoritative boundaries, source terms, and rule dimensions not yet certified'),
      implementation_readiness: deep?.implementation_readiness ?? (isDc ? 'UNAVAILABLE_REQUIRES_LEGAL_CONFIRMATION' : 'DISCOVERY_ONLY'),
      engine_compatibility: deep?.engine_compatibility ?? 'NOT_ASSESSED',
      engine_gaps: deep?.engine_gaps ?? 'State rule model and authoritative geography contract not decomposed',
      annual_artifact: deep?.annual_artifact ?? 'Current official hunting hub identified; annual controlling artifact unresolved',
      monitor_strategy: deep?.monitor_strategy ?? 'Resolve annual artifact and update/correction channel before implementation',
      fixture_candidates: deep?.fixture_candidates ?? 'Pending state decomposition',
      reviewed_at: reviewedAt,
    };
  });

const supplementalSources = [
  ['us-federal-migratory-framework', 'jurisdiction:us-federal', 'authority:us-fws', 'FEDERAL_COMPOSITION', 'Migratory-bird federal framework', 'https://www.fws.gov/law/migratory-bird-hunting-regulations', 'HTML', 'Federal framework; must be composed with state/tribal seasons', 'PUBLICATION_REUSE_REVIEW_REQUIRED', 'ANNUAL_AND_RULEMAKING', 'SOURCE_FOUND'],
  ['us-federal-refuge-station-rules', 'jurisdiction:us-federal', 'authority:us-fws', 'FEDERAL_LAND', 'National Wildlife Refuge station-specific hunting rules', 'https://www.fws.gov/federal-register-publication/national-wildlife-refuge-system-2026-2027-station-specific-hunting-0', 'HTML', 'Controlling federal rule for covered stations', 'PUBLICATION_REUSE_REVIEW_REQUIRED', 'ANNUAL_RULEMAKING', 'SOURCE_FOUND'],
  ['us-ak-gmu-maps', 'jurisdiction:us-ak', 'authority:us-ak-adfg', 'GIS_AND_HUNT_INDEX', 'Alaska hunting maps by GMU/species/hunt number', 'https://www.adfg.alaska.gov/index.cfm?adfg=huntingmaps.main', 'HTML/PDF/INTERACTIVE', 'Guidance; regulations and emergency orders control', 'UNRESOLVED', 'CONTINUOUS_PLUS_ANNUAL', 'SOURCE_FOUND'],
  ['us-co-big-game-2026', 'jurisdiction:us-co', 'authority:us-co-cpw', 'ANNUAL_REGULATION', '2026 Colorado Big Game brochure', 'https://cpw.state.co.us/sites/default/files/dam/erjzbk48be/colorado-big-game-hunting-brochure.pdf', 'PDF', 'Current official brochure; corrections must be composed', 'PUBLICATION_REUSE_REVIEW_REQUIRED', 'ANNUAL_PLUS_CORRECTIONS', 'SOURCE_FOUND'],
  ['us-wy-regulations', 'jurisdiction:us-wy', 'authority:us-wy-wgfd', 'REGULATION_INDEX', 'Wyoming regulations and species hunt-area chapters', 'https://wgfd.wyo.gov/regulations', 'HTML/PDF', 'Written hunt-area descriptions control over reference maps', 'UNRESOLVED', 'ANNUAL_AND_RULEMAKING', 'SOURCE_FOUND'],
  ['us-mt-regulations', 'jurisdiction:us-mt', 'authority:us-mt-fwp', 'REGULATION_INDEX', 'Montana hunting regulations and adopted district descriptions', 'https://fwp.mt.gov/hunt/regulations', 'HTML/PDF', 'Commission-adopted legal descriptions and regulations control', 'UNRESOLVED', 'ANNUAL_AND_COMMISSION_ACTION', 'SOURCE_FOUND'],
  ['us-mt-hunt-planner', 'jurisdiction:us-mt', 'authority:us-mt-fwp', 'GIS_PLANNER', 'Montana FWP Hunt Planner', 'https://fwp.mt.gov/gis/maps/huntPlanner/', 'INTERACTIVE', 'Guidance only; regulations control', 'UNRESOLVED', 'CONTINUOUS', 'SOURCE_FOUND'],
  ['us-id-hunt-planner', 'jurisdiction:us-id', 'authority:us-id-fg', 'REGULATION_AND_GIS_PLANNER', 'Idaho Hunt Planner', 'https://idfg.idaho.gov/ifwis/huntplanner/', 'HTML/INTERACTIVE/DOWNLOADS', 'Planning tool; regulation booklets control boundaries', 'UNRESOLVED', 'ANNUAL_PLUS_CONTINUOUS', 'SOURCE_FOUND'],
  ['us-ut-guidebooks', 'jurisdiction:us-ut', 'authority:us-ut-dwr', 'REGULATION_INDEX', 'Utah hunting guidebooks and corrections', 'https://wildlife.utah.gov/guidebooks', 'HTML/PDF', 'Guidebooks summarize statutes/rules and publish corrections', 'PUBLICATION_REUSE_REVIEW_REQUIRED', 'VERSIONED_PLUS_CORRECTIONS', 'SOURCE_FOUND'],
  ['us-ut-boundaries', 'jurisdiction:us-ut', 'authority:us-ut-dwr', 'GIS_PLANNER', 'Utah hunt boundary maps', 'https://dwrapps.utah.gov/huntboundary/hbstart', 'INTERACTIVE', 'Boundary guidance; current descriptions/rules control', 'UNRESOLVED', 'CONTINUOUS', 'SOURCE_FOUND'],
  ['us-az-regulations', 'jurisdiction:us-az', 'authority:us-az-gfd', 'REGULATION_INDEX', 'Arizona hunting regulations and draw booklets', 'https://www.azgfd.com/hunting/regulations/', 'HTML/PDF', 'Official regulations/booklets; commission orders also required', 'PUBLICATION_REUSE_REVIEW_REQUIRED', 'ANNUAL_PLUS_ORDERS', 'SOURCE_FOUND'],
  ['us-nm-publications', 'jurisdiction:us-nm', 'authority:us-nm-dgf', 'REGULATION_INDEX', 'New Mexico current rules and information publications', 'https://wildlife.dgf.nm.gov/home/publications/', 'HTML/PDF', 'Official summary; cited statutes and administrative rules control', 'PUBLICATION_REUSE_REVIEW_REQUIRED', 'ANNUAL', 'SOURCE_FOUND'],
  ['us-nm-gmu', 'jurisdiction:us-nm', 'authority:us-nm-dgf', 'GIS_AND_DESCRIPTIONS', 'New Mexico GMU maps, descriptions, shapefile and KMZ', 'https://wildlife.dgf.nm.gov/hunting/maps/big-game-unit-maps-pdfs/', 'HTML/PDF/SHP/KMZ', 'Statewide map disclaims precise-boundary use; descriptions control', 'UNRESOLVED', 'UNKNOWN_DOWNLOAD_DATED_2017', 'SOURCE_FOUND_STALE_DATA'],
].map(([source_key, jurisdiction_id, authority_id, scope, title, url, format, legal_standing, licence_status, refresh_model, verification_status]) => ({
  source_key, jurisdiction_id, authority_id, scope, title, url, format, legal_standing, licence_status, refresh_model, verification_status, reviewed_at: reviewedAt,
}));

const baseManifestRows = jurisdictions.map((jurisdiction) => {
  const source = jurisdiction.jurisdiction_type === 'FEDERAL'
    ? regulatorySources.find(({ source_id }) => source_id === 'source:us-fws-migratory')
    : hubByJurisdiction.get(jurisdiction.jurisdiction_id);
  const authority = authorityById.get(jurisdiction.primary_authority_id);
  return {
    source_key: source?.source_id ?? `${jurisdiction.jurisdiction_id}:unresolved`,
    jurisdiction_id: jurisdiction.jurisdiction_id,
    authority_id: jurisdiction.primary_authority_id,
    scope: jurisdiction.jurisdiction_type === 'FEDERAL' ? 'FEDERAL_COMPOSITION' : 'STATE_OFFICIAL_HUB',
    title: source?.source_title ?? `${jurisdiction.name_en} source unresolved`,
    url: source?.url ?? authority?.official_url ?? '',
    format: source?.format ?? 'HTML',
    legal_standing: jurisdiction.jurisdiction_type === 'FEDERAL' ? 'Federal framework; state/tribal composition required' : 'Official discovery hub; controlling annual artifact not certified',
    licence_status: 'UNRESOLVED',
    refresh_model: 'CURRENT_HUB_MONITOR_ANNUAL_CHILD_ARTIFACTS',
    verification_status: source?.verification_status ?? 'NEEDS_REVIEW',
    reviewed_at: reviewedAt,
  };
});

writeFileSync(join(here, 'state-coverage-matrix.csv'), csv(matrixRows, [
  'jurisdiction_id', 'subdivision_code', 'jurisdiction_name', 'authority_id', 'regulatory_source_id', 'research_depth',
  'regulatory_system', 'management_geographies', 'regulation_formats', 'gis_status', 'gis_legal_standing', 'gis_licensing',
  'required_dimensions', 'federal_land_dependencies', 'known_blockers', 'implementation_readiness', 'engine_compatibility',
  'engine_gaps', 'annual_artifact', 'monitor_strategy', 'fixture_candidates', 'reviewed_at',
]));

writeFileSync(join(here, 'source-manifest.csv'), csv([...baseManifestRows, ...supplementalSources], [
  'source_key', 'jurisdiction_id', 'authority_id', 'scope', 'title', 'url', 'format', 'legal_standing', 'licence_status',
  'refresh_model', 'verification_status', 'reviewed_at',
]));

console.log(`Wrote ${matrixRows.length} state/district rows and ${baseManifestRows.length + supplementalSources.length} source rows.`);
