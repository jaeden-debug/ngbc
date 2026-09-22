#!/usr/bin/env node
/**
 * Certify North Ground's PostGIS zone registry against an authority's own service.
 *
 *   node scripts/certify-spatial-parity.mjs --jurisdiction ca-ab [--concurrency 3]
 *   node scripts/certify-spatial-parity.mjs --jurisdiction ca-qc --unverified \
 *     --samples fixtures/hunt/ca-qc-parity-samples.json --concurrency 2
 *
 * --unverified certifies a layer before it is served; --samples reads the
 * sample points from a file when sampling exceeds the REST statement timeout.
 *
 * The jurisdiction-neutral form of `certify-ontario-spatial-parity.mjs`, which
 * stays as Ontario's recorded regression. Any adapter that implements
 * `officialIdentifiersAt` can be certified here without a new script.
 *
 * Every point is put to both systems and must get the same answer:
 *
 *   inside    a point inside every unit           → that unit
 *   edge      just inside its closest boundary    → that unit
 *   across    just outside that same boundary     → the neighbour, or nothing
 *   component every sizeable part of a multipart unit
 *   outside   points beyond the jurisdiction      → nothing
 *   invalid   impossible coordinates              → nothing, from North Ground
 *
 * plus any extra cases the jurisdiction declares below (for Alberta, the
 * quarantined Elk Island record, which must resolve to no WMU in both).
 *
 * This is a certification, not a unit test: it deliberately calls the live
 * service. Disagreement is a finding, never something to resolve by preferring
 * the local copy. Exit 0 only when every point agrees.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { jurisdictionToday } from "./ontario-source.mjs";
import { loadZoneSource } from "./zone-adapters.mjs";

const EXTRA_CASES = {
  "ca-ab": {
    outside: [
      ["British Columbia, west of the Rockies", 50.7, -119.3],
      ["Saskatchewan, east", 52.1, -106.6],
      ["Montana, south", 47.5, -111.3],
      ["Northwest Territories, north", 61.5, -114.0],
      ["Saskatchewan, across the 110th meridian", 53.0, -109.9],
    ],
    special: [
      // Quarantined in the adapter: federal land, in no provincial WMU.
      ["Elk Island National Park (quarantined blank record)", 53.6134, -112.8653],
      ["Elk Island National Park, south block", 53.54, -112.86],
      // The other four national parks are simply absent from Alberta's layer:
      // 661,848 km² less 54,797 km² of parks leaves 607,051 km², and the 189
      // WMUs cover 608,042 km². Each point below was confirmed inside the park by
      // NRCan's legal boundary and in no WMU by Alberta's own service.
      ["Banff National Park, townsite", 51.1784, -115.5708],
      ["Jasper National Park, townsite", 52.8737, -118.0814],
      ["Waterton Lakes National Park, townsite", 49.052, -113.915],
      ["Wood Buffalo National Park, Alberta portion", 59.3, -112.8],
    ],
  },
};

EXTRA_CASES["ca-mb"] = {
  outside: [
    // Only places no registered jurisdiction covers. A point in Ontario rightly
    // resolves to an Ontario WMU in the national registry, so it cannot stand
    // for "nothing" here.
    ["Saskatchewan, west of the boundary", 51.0, -102.6],
    ["Saskatchewan, near the 60th parallel", 59.5, -102.3],
    ["North Dakota, south of the 49th parallel", 48.7, -98.0],
    ["Nunavut, north of the 60th parallel", 60.6, -97.0],
    ["Hudson Bay, offshore", 58.5, -91.0],
  ],
  special: [
    // Quarantined in the adapter: the layer's one undesignated polygon. M.R.
    // 220/86 draws GHAs 23 and 23A around Riding Mountain National Park, so
    // it is in no Game Hunting Area in either system.
    ["Riding Mountain National Park, Wasagaming", 50.6597, -99.9728],
    ["Riding Mountain National Park, interior", 50.85, -100.6],
    // Churchill, on the Hudson Bay shore, and Winnipeg, where M.R. 220/86 makes
    // the land inside the Perimeter Highway (PTH 100/101) GHA 38.
    ["Churchill", 58.7684, -94.1650],
    ["Winnipeg, inside the Perimeter (GHA 38)", 49.8951, -97.1384],
  ],
};

EXTRA_CASES["ca-qc"] = {
  outside: [
    ["Ontario, Ottawa", 45.4215, -75.6972],
    ["Ontario, just west of the Témiscamingue border", 47.5, -79.7],
    ["New Brunswick, Edmundston", 47.373, -68.3251],
    ["Maine, south of the border", 45.5, -70.0],
    ["New York, south of the 45th parallel", 44.8, -73.5],
    ["Labrador, Labrador City", 52.944, -66.911],
  ],
  special: [
    // The strategic fixture: the ministry's own service answers 10O here.
    ["Maniwaki (zone 10 partie ouest)", 46.3769, -75.9722],
    ["Gatineau", 45.4765, -75.7013],
    ["Québec City", 46.8139, -71.208],
    ["Île d'Orléans (a St Lawrence island designation)", 46.9167, -70.9667],
    ["Montagne de Rigaud (named territory)", 45.4667, -74.3],
    ["Grenville-sur-la-Rouge (CWD enhanced surveillance zone)", 45.65, -74.6],
    ["Seigneurie de Beaupré (named territory)", 47.3, -70.9],
    ["Harrington Harbour, Lower North Shore islands (19SE)", 50.5, -59.48],
    ["Gulf of St Lawrence (zone 21 waters)", 48.5, -63.0],
    ["Île du Havre Aubert, Îles-de-la-Madeleine", 47.23, -61.83],
    ["Anticosti (zone 20)", 49.5, -63.0],
    ["Zone 17", 49.6, -77.0],
    ["Kuujjuaq, Nunavik", 58.1, -68.4],
  ],
};

EXTRA_CASES["ca-bc"] = {
  outside: [
    // Only places no registered jurisdiction's PostGIS copy covers. Alberta is
    // registered, so no Alberta point can stand for "nothing" here; U.S. layers
    // are live-service only and hold no copy.
    ["Washington, Bellingham", 48.7519, -122.4787],
    ["Idaho, Bonners Ferry", 48.6913, -116.3163],
    ["Montana, Eureka", 48.8797, -115.0537],
    ["Yukon, Watson Lake", 60.0628, -128.7089],
    ["Alaska, Hyder", 55.9164, -130.0247],
    ["Pacific Ocean, west of Haida Gwaii", 53.0, -134.5],
  ],
  special: [
    // Real places across all nine regions. The expected unit is whatever the
    // province's own service answers there, never a value written here.
    ["Victoria (Region 1)", 48.4284, -123.3656],
    ["Tofino (Region 1)", 49.1530, -125.9066],
    ["Squamish (Region 2)", 49.7016, -123.1558],
    ["Kamloops (Region 3)", 50.6745, -120.3273],
    ["Cranbrook (Region 4)", 49.5097, -115.7688],
    ["Williams Lake (Region 5)", 52.1418, -122.1417],
    ["Smithers (Region 6)", 54.7804, -127.1743],
    ["Masset, Haida Gwaii (Region 6)", 54.0115, -132.1479],
    ["Atlin (Region 6, far north)", 59.5781, -133.6895],
    ["Prince George (Region 7a Omineca)", 53.9171, -122.7497],
    ["Fort St. John (Region 7b Peace)", 56.2524, -120.8466],
    ["Fort Nelson (Region 7b Peace)", 58.8050, -122.6972],
    ["Penticton (Region 8)", 49.4991, -119.5937],
  ],
};

const INVALID = [
  ["latitude above the pole", 95.0, -114.0],
  ["longitude beyond the meridian", 53.0, -200.0],
];

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
      }
    } catch {
      /* absent is fine */
    }
  }
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (server-only).");
    process.exit(1);
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function main() {
  const args = process.argv.slice(2);
  const jurisdiction = args[args.indexOf("--jurisdiction") + 1];
  const source = await loadZoneSource(jurisdiction);
  if (typeof source.officialIdentifiersAt !== "function") {
    throw new Error(`The ${jurisdiction} adapter cannot ask its authority about a point (no officialIdentifiersAt).`);
  }
  const { url, key } = loadEnv();

  /* Both sides are asked over the network hundreds of times. A transient failure
     on either is retried; a persistent one aborts the run, because a point that
     could not be asked is not a point that agreed. */
  async function retried(operation) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  }

  const rpc = (name, body = {}) => retried(async () => {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${name} -> ${response.status} ${text.slice(0, 300)}`);
    return JSON.parse(text);
  });

  const official = (latitude, longitude) => retried(() => source.officialIdentifiersAt(latitude, longitude));

  /* Parity certifies this authority's layer against North Ground's copy of THAT
     layer. The national registry also holds neighbouring jurisdictions, and a
     point just across a shared border rightly resolves to the neighbour's zone
     there while this authority reports nothing — that is agreement, not a
     finding. Neighbouring zones are recorded beside each point but not compared. */
  const prefix = `${source.canonicalZoneId("X").replace(/x$/i, "")}`;
  /* --unverified certifies a layer BEFORE it is served. The production resolver
     answers only for VERIFIED zones, which is what keeps an uncertified layer
     away from Hunt; this asks the certification resolver instead, which answers
     for this jurisdiction whatever its zones' status, through the same parts the
     production resolver will use once the layer is promoted. */
  const unverified = args.includes("--unverified");
  const resolve = (latitude, longitude) => unverified
    ? rpc("resolve_zone_for_certification", {
        p_latitude: latitude, p_longitude: longitude, p_jurisdiction_canonical_id: source.jurisdictionCanonicalId,
      })
    : rpc("resolve_management_zone", { p_latitude: latitude, p_longitude: longitude });
  async function northGround(latitude, longitude) {
    const rows = await resolve(latitude, longitude);
    const ids = rows.map((row) => String(row.canonical_id));
    return {
      own: ids.filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length)).sort(),
      neighbours: ids.filter((id) => !id.startsWith(prefix)).sort(),
    };
  }

  // Compare by canonical id: the adapter's identifiers mapped through its own
  // canonicalZoneId, so both sides use one vocabulary.
  const canonicalTail = (identifier) => source.canonicalZoneId(identifier).slice(prefix.length);

  const planned = [];
  const latencies = [];
  const check = (kind, label, latitude, longitude) => planned.push({ kind, label, latitude, longitude });

  async function run({ kind, label, latitude, longitude }) {
    const started = performance.now();
    const { own, neighbours } = await northGround(latitude, longitude);
    latencies.push(performance.now() - started);
    const theirs = (await official(latitude, longitude)).map(canonicalTail).sort();
    return {
      kind, label, latitude, longitude, official: theirs, northGround: own,
      ...(neighbours.length ? { neighbours } : {}),
      agree: JSON.stringify(theirs) === JSON.stringify(own),
    };
  }

  /* --samples FILE reads the same two sample sets from a file instead. Sampling
     measures every zone's full geometry in one statement, and a layer with a
     zone the size of Québec's 21 (838,537 vertices) exceeds the REST statement
     timeout; the file is those functions' own output, computed through SQL, and
     is named in the record so the run can be repeated. */
  const samplesFile = args.includes("--samples") ? args[args.indexOf("--samples") + 1] : null;
  let samples;
  let components;
  if (samplesFile) {
    const recorded = JSON.parse(readFileSync(samplesFile, "utf8"));
    if (recorded.jurisdiction !== source.jurisdictionCanonicalId) {
      throw new Error(`${samplesFile} samples ${recorded.jurisdiction}, not ${source.jurisdictionCanonicalId}.`);
    }
    ({ samples, components } = recorded);
    console.log(`Sampling ${source.jurisdictionCanonicalId} from ${samplesFile}...`);
  } else {
    console.log(`Sampling ${source.jurisdictionCanonicalId} from the North Ground registry...`);
    samples = await rpc("zone_sample_points", { p_jurisdiction_canonical_id: source.jurisdictionCanonicalId });
    components = await rpc("zone_component_sample_points", {
      p_jurisdiction_canonical_id: source.jurisdictionCanonicalId,
      p_max_components: 8,
    });
  }
  /* A jurisdiction can publish more than one geography (a U.S. state's elk and
     deer hunt areas), and the sampling functions return them all. Only this
     layer's zones are certified here; for a jurisdiction with one layer this
     keeps everything. Components carry no canonical id, so they follow the
     identifiers kept. */
  samples = samples.filter((sample) => String(sample.canonical_id).startsWith(prefix));
  const kept = new Set(samples.map((sample) => sample.official_identifier));
  components = components.filter((component) => kept.has(component.official_identifier));
  console.log(`  ${samples.length} zones, ${components.length} multipart components`);
  if (!samples.length) throw new Error("The registry holds no zones for this jurisdiction; nothing to certify.");

  for (const sample of samples) {
    check("inside", `inside ${sample.official_identifier}`, sample.inside_latitude, sample.inside_longitude);
    check("edge", `edge ${sample.official_identifier}`, sample.edge_latitude, sample.edge_longitude);
    check("across", `across ${sample.official_identifier}`, sample.across_latitude, sample.across_longitude);
  }
  for (const component of components) {
    check(
      "component",
      `component ${component.component_rank}/${component.component_count} of ${component.official_identifier}`,
      component.latitude,
      component.longitude,
    );
  }
  const extra = EXTRA_CASES[jurisdiction] ?? { outside: [], special: [] };
  for (const [label, latitude, longitude] of extra.outside) check("outside", label, latitude, longitude);
  for (const [label, latitude, longitude] of extra.special) check("special", label, latitude, longitude);

  // A few points at a time: polite to both services, and a run in minutes
  // rather than half an hour. The record keeps the planned order either way.
  const recorded = new Array(planned.length);
  let next = 0;
  let done = 0;
  // --concurrency N: how many points are in flight. Keep it low on a small
  // database, or right after an outage.
  const concurrency = Math.max(1, Number(args[args.indexOf("--concurrency") + 1]) || 4);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < planned.length) {
      const index = next++;
      recorded[index] = await run(planned[index]);
      done += 1;
      if (done % 50 === 0) console.log(`  ...${done} of ${planned.length} points checked`);
    }
  }));
  const disagreements = recorded.filter((item) => !item.agree);

  for (const [label, latitude, longitude] of INVALID) {
    const ours = await resolve(latitude, longitude);
    const agree = Array.isArray(ours) && ours.length === 0;
    recorded.push({ kind: "invalid", label, latitude, longitude, official: [], northGround: ours.map((row) => row.canonical_id), agree });
    if (!agree) disagreements.push({ kind: "invalid", label, latitude, longitude, official: [], northGround: ours });
  }

  latencies.sort((a, b) => a - b);
  const percentile = (p) => Math.round(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]);
  const counts = Object.fromEntries(
    [...new Set(recorded.map(({ kind }) => kind))].map((kind) => [kind, recorded.filter((item) => item.kind === kind).length]),
  );
  const file = `fixtures/hunt/${jurisdiction}-spatial-parity.json`;
  writeFileSync(file, `${JSON.stringify({
    jurisdiction: source.jurisdictionCanonicalId,
    layer: source.layerId,
    authority: source.authority,
    sourceUrl: source.sourceUrl,
    // A provenance date is a calendar day in the jurisdiction, never a UTC slice:
    // a run on a Québec evening would otherwise be dated tomorrow.
    certifiedOn: jurisdictionToday(source.timeZone ?? "America/Toronto"),
    resolver: unverified ? "resolve_zone_for_certification (before serving)" : "resolve_management_zone",
    ...(samplesFile ? { samplesFrom: samplesFile.split("/").at(-1) } : {}),
    zones: samples.length,
    counts,
    disagreements: disagreements.length,
    cases: recorded,
  }, null, 2)}\n`);

  console.log("");
  console.log(`Points checked    : ${recorded.length} ${JSON.stringify(counts)}`);
  console.log(`Zones in registry : ${samples.length}`);
  console.log(`PostGIS resolve   : median ${percentile(0.5)} ms, p90 ${percentile(0.9)} ms (REST round trip)`);
  console.log(`Disagreements     : ${disagreements.length}`);
  console.log(`Recorded          : ${file}`);
  if (disagreements.length) {
    for (const item of disagreements.slice(0, 40)) {
      console.log(`  [${item.kind}] ${item.label} @ ${item.latitude},${item.longitude}`);
      console.log(`     authority   : ${JSON.stringify(item.official)}`);
      console.log(`     North Ground: ${JSON.stringify(item.northGround)}`);
    }
    console.log("\nParity NOT established.");
    process.exit(1);
  }
  console.log("\nParity established: every sampled point resolves identically in both systems.");
}

main().catch((error) => {
  console.error(`Certification failed: ${error.message}`);
  process.exit(1);
});
