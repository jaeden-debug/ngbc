/**
 * Jurisdictions whose official zone layer North Ground can ingest and certify.
 *
 * One list, shared by `ingest-zone-layer.mjs` and `certify-spatial-parity.mjs`,
 * so a jurisdiction cannot be ingestible without being certifiable or the
 * reverse. Adding a jurisdiction is one entry here plus its adapter.
 */
export const ZONE_ADAPTERS = {
  "ca-bc": {
    module: "../src/lib/hunt/ingestion/british-columbia-mu.ts",
    factory: "createBritishColumbiaMuSource",
  },
  "ca-ab": {
    module: "../src/lib/hunt/ingestion/alberta-wmu.ts",
    factory: "createAlbertaWmuSource",
  },
  "ca-yt": {
    module: "../src/lib/hunt/ingestion/yukon-subzones.ts",
    factory: "createYukonSubzoneSource",
  },
  "ca-nl-moose": {
    module: "../src/lib/hunt/ingestion/newfoundland-areas.ts",
    factory: "createNewfoundlandMooseSource",
  },
  "ca-nl-caribou": {
    module: "../src/lib/hunt/ingestion/newfoundland-areas.ts",
    factory: "createNewfoundlandCaribouSource",
  },
  "ca-nl-bear": {
    module: "../src/lib/hunt/ingestion/newfoundland-areas.ts",
    factory: "createNewfoundlandBearSource",
  },
  "ca-ns": {
    module: "../src/lib/hunt/ingestion/nova-scotia-deer.ts",
    factory: "createNovaScotiaDeerSource",
  },
  "ca-mb": {
    module: "../src/lib/hunt/ingestion/manitoba-gha.ts",
    factory: "createManitobaGhaSource",
  },
  "ca-on": {
    module: "../src/lib/hunt/ingestion/ontario-wmu.ts",
    factory: "createOntarioWmuSource",
  },
  "ca-qc": {
    module: "../src/lib/hunt/ingestion/quebec-zone.ts",
    factory: "createQuebecZoneSource",
  },
};

export async function loadZoneSource(jurisdiction) {
  const adapter = ZONE_ADAPTERS[jurisdiction];
  if (!adapter) {
    throw new Error(`Unknown jurisdiction "${jurisdiction}". Known: ${Object.keys(ZONE_ADAPTERS).join(", ")}`);
  }
  const loaded = await import(adapter.module);
  return loaded[adapter.factory]();
}
